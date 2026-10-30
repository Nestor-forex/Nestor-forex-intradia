// Comprobaciones de la distribución de la compresión. SIN INTERNET y sin
// gastar un crédito.
//
//     node scripts/prueba-compresion-dist.mjs
//
// ⚠️⚠️ EXISTE POR UN FALLO REAL, y el bloque 1 es el que lo cierra.
//
// La primera versión del diagnóstico leía `{ fechas, rangosPar }` —los nombres
// del lector de velas de la app HERMANA— cuando aquí se llaman
// `{ barras, rangos }`. Falló en producción gastando 7 créditos. Y la prueba
// de humo NO lo cazó porque el mercado inventado lo había escrito yo con los
// MISMOS nombres equivocados: el banco confirmaba mi propio error.
//
// Por eso el bloque 1 no se conforma con que el mercado falso funcione: LEE
// `velas.mjs` y exige que los nombres que la librería espera sean exactamente
// los que esa función devuelve. Un mercado inventado puede estar equivocado;
// el contrato del lector de verdad, no.

import { readFileSync } from 'node:fs'
import { PAIRS, VELAS_ATRAS_COMPRESION, computarBarrido } from '../src/lib/marketCalc.js'
import { compresionDe } from '../src/lib/compresion.js'
import {
  distribucionDeCompresion,
  percentiles,
  fraccionBajo,
} from './lib/compresion-dist.mjs'

let mal = 0
const comprobar = (texto, ok) => {
  console.log(`  ${ok ? '✓' : '✗'} ${texto}`)
  if (!ok) mal++
}

// ── Un mercado inventado, determinista ────────────────────────────────────
//
// ⚠️ Con OLAS de volatilidad dentro: sin ellas la compresión saldría clavada
// en 1 y la prueba pasaría comparando una lista de unos con otra, que es el
// agujero de «una prueba que se adapta a lo que encuentra».
function mercado(n = 400) {
  const CCY7 = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD']
  let semilla = 12345
  const azar = () => {
    semilla = (semilla * 1103515245 + 12345) % 2147483648
    return semilla / 2147483648
  }
  const barras = []
  const rates = {}
  const rangos = {}
  const nivel = { EUR: 0.92, GBP: 0.78, JPY: 150, CHF: 0.88, AUD: 1.52, NZD: 1.68, CAD: 1.38 }
  for (let i = 0; i < n; i++) {
    const t = new Date(Date.UTC(2026, 0, 1) + i * 3600_000).toISOString().slice(0, 19)
    barras.push(t)
    rates[t] = {}
    rangos[t] = {}
    CCY7.forEach((c, k) => {
      const ola = 0.4 + 0.9 * Math.abs(Math.sin((i / (37 + k * 11)) * Math.PI))
      nivel[c] *= 1 + (azar() - 0.5) * 0.004 * ola
      const amplitud = Math.abs(nivel[c]) * 0.0015 * ola * (0.5 + azar())
      rates[t][c] = nivel[c]
      rangos[t][c] = { h: nivel[c] + amplitud, l: nivel[c] - amplitud }
    })
  }
  return { barras, rates, rangos }
}

console.log('\n1. ⚠️ EL CONTRATO: los nombres que espera la librería son los que devuelve `velas.mjs`')
{
  const fuente = readFileSync(new URL('./lib/velas.mjs', import.meta.url), 'utf8')
  // La función devuelve un objeto literal con los nombres cortos. Se busca la
  // ÚLTIMA forma `return { a, b, c }` del archivo, que es la de `obtenerVelas`.
  const todos = [...fuente.matchAll(/return\s*\{\s*([a-zA-Z0-9_,\s]+?)\s*\}/g)]
  comprobar('se encontró al menos un `return { ... }` en velas.mjs', todos.length > 0)
  if (todos.length) {
    const claves = todos.at(-1)[1].split(',').map((s) => s.trim()).filter(Boolean)
    // ⚠️ Lo que se exige NO es «que estén las tres»: es que estén las que la
    // librería lee. Si mañana `velas.mjs` renombra una, esto cae.
    for (const k of ['barras', 'rates', 'rangos']) {
      comprobar(`velas.mjs devuelve \`${k}\` (lo que la librería lee)`, claves.includes(k))
    }
    // Y la contraria: que NO devuelva los nombres de la app hermana, que es
    // exactamente lo que yo di por supuesto.
    for (const k of ['fechas', 'rangosPar']) {
      comprobar(`y NO devuelve \`${k}\` (ésos son de la app hermana)`, !claves.includes(k))
    }

    // ⚠️⚠️ Y LA MITAD QUE DE VERDAD ATA LAS DOS PUNTAS: que la librería LEA
    // esos nombres. Comprobar solo lo que devuelve `velas.mjs` dejaría pasar
    // exactamente el fallo del 2026-10-30, porque el error no estaba allí sino
    // en quien lo leía.
    const lib = readFileSync(new URL('./lib/compresion-dist.mjs', import.meta.url), 'utf8')
    const firma = lib.match(/export function distribucionDeCompresion\(\{([^}]*)\}/)
    comprobar('se encontró la firma de `distribucionDeCompresion`', !!firma)
    if (firma) {
      const lee = firma[1].split(',').map((s) => s.trim()).filter(Boolean)
      comprobar(
        `la librería lee exactamente lo que velas.mjs devuelve (${lee.join(', ')})`,
        lee.length > 0 && lee.every((k) => claves.includes(k)),
      )
    }
  }
}

console.log('\n2. Se niega a trabajar con el objeto de la app hermana')
{
  const m = mercado(200)
  let dioError = false
  try {
    distribucionDeCompresion({ fechas: m.barras, rates: m.rates, rangosPar: m.rangos })
  } catch (e) {
    dioError = /barras/.test(e.message)
  }
  comprobar('pasarle `{ fechas, rangosPar }` lanza un error que NOMBRA el problema', dioError)
}

console.log('\n3. La distribución sale, y no es una lista de unos')
const d = distribucionDeCompresion(mercado(400), { calentamiento: 90 })
{
  comprobar(`hay observaciones (${d.todas.length})`, d.todas.length > 1000)
  comprobar(
    `cubre los ${PAIRS.length} pares`,
    d.porPar.size === PAIRS.length && [...d.porPar.values()].every((v) => v.length > 0),
  )
  const p = percentiles(d.todas)
  comprobar(`la mediana es un número (${p.p50.toFixed(2)})`, Number.isFinite(p.p50))
  // Si p10 y p90 salieran pegados, el mercado inventado no tendría olas y toda
  // la prueba sería decorativa.
  comprobar(`p10 (${p.p10.toFixed(2)}) y p90 (${p.p90.toFixed(2)}) están separados`, p.p90 - p.p10 > 0.1)
  comprobar('los percentiles van en orden', p.min <= p.p10 && p.p10 <= p.p50 && p.p50 <= p.p90 && p.p90 <= p.max)
}

console.log('\n4. ⚠️ FIDELIDAD: el número es EL MISMO que calcula la app')
// Era una afirmación en un comentario («atrWilder solo mira las últimas 60, así
// que la serie entera y las últimas 300 dan lo mismo»). Aquí se comprueba.
{
  const m = mercado(400)
  // Lo que la app calcula de verdad: las últimas 300 velas, como en producción.
  const app = computarBarrido(m.barras.slice(-300), m.rates, m.rangos)
  const deApp = new Map(app.pares.map((p) => [p.name, p.compresion]))
  // Lo que calcula la librería: la serie ENTERA, solo la última vela.
  const soloUltima = distribucionDeCompresion(m, { calentamiento: m.barras.length - 1 })
  const ultima = new Map([...soloUltima.porPar.entries()].map(([n, v]) => [n, v.at(-1)]))
  let iguales = 0
  for (const [b, q] of PAIRS) {
    const nombre = `${b}/${q}`
    if (Math.abs(ultima.get(nombre) - deApp.get(nombre)) < 1e-12) iguales++
  }
  comprobar(
    `los ${PAIRS.length} pares coinciden con computarBarrido hasta el último decimal (${iguales})`,
    iguales === PAIRS.length,
  )
}

console.log('\n5. `percentiles` y `fraccionBajo` no inventan ceros')
{
  comprobar('percentiles([]) es null, no ceros', percentiles([]) === null)
  comprobar('percentiles(null) es null', percentiles(null) === null)
  comprobar('fraccionBajo([], 0.75) es null, no 0', fraccionBajo([], 0.75) === null)
  comprobar('fraccionBajo(xs, NaN) es null', fraccionBajo([1, 2], NaN) === null)
  comprobar('fraccionBajo cuenta bien', fraccionBajo([0.5, 0.6, 1, 1], 0.75) === 50)
}

console.log('\n6. Los no calculables NO se cuentan como 1')
{
  // Con una serie demasiado corta para el ATR «de antes», `compresionDe`
  // devuelve null. Lo que no puede pasar es que aparezcan como 1,00 y creen un
  // pico falso justo en el valor que más decide.
  comprobar('compresionDe(x, 0) es null', compresionDe(1, 0) === null)
  comprobar('compresionDe(NaN, 1) es null', compresionDe(NaN, 1) === null)
  const corto = distribucionDeCompresion(mercado(VELAS_ATRAS_COMPRESION + 2), { calentamiento: 0 })
  comprobar('ningún valor calculado es exactamente 1 por relleno', !corto.todas.some((x) => x === 1))
}

console.log('')
if (mal) {
  console.log(`✗ ${mal} comprobación(es) MAL.`)
  process.exit(1)
}
console.log('✓ Todo bien.')
