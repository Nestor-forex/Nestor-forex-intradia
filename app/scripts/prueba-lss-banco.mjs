// El adaptador del NFX-LSS al banco de pruebas de INTRADÍA, de punta a punta.
//
// PRIMO del de Swing, no gemelo. Las diferencias son reales y cada una puede
// romper el resultado en silencio:
//
//   · aquí las velas vienen por DIVISA (`USD/EUR`), no por par, así que los
//     pares hay que reconstruirlos — y cuatro de los siete, invirtiendo;
//   · el resolver de esta app busca `s.vela`, no `s.cierre`;
//   · y solo se miden 7 pares, porque los otros once se derivan y sus mechas
//     salen infladas (ver la cabecera de `lib/lss-banco.mjs`).
//
// ⚠️ La comprobación que más importa aquí es la de INVERTIR. Si alguien
// confunde el máximo con el mínimo al dar la vuelta a una cotización, las
// velas salen con el máximo por debajo del mínimo, TODOS los barridos se
// detectan al revés y el número final es basura creíble.

import { readFileSync, readdirSync } from 'node:fs'
import { DIRECTOS, velasDe, datosExactos, senalesLSSBanco } from './lib/lss-banco.mjs'
import { medir, barridoSwap } from './lib/backtest-nucleo.mjs'
import { resolver } from './lib/resolver.mjs'

let mal = 0
let n = 0
const ok = (cond, que) => {
  n++
  if (!cond) {
    mal++
    console.log(`  MAL — ${que}`)
  }
}
const titulo = (t) => console.log(`\n${t}`)

// ── Un mercado inventado, con la forma que devuelve `obtenerVelas` ─────────
const barras = []
const rates = {}
const rangos = {}
const CCYS = DIRECTOS.map((d) => d.ccy)
const BASE = { EUR: 0.92, GBP: 0.79, AUD: 1.52, NZD: 1.65, JPY: 150, CHF: 0.88, CAD: 1.36 }

let semilla = 4242
const azar = () => ((semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)

for (let i = 0; i < 700; i++) {
  const t = `2026-01-01 ${String(i % 24).padStart(2, '0')}:00:00`.replace(
    '2026-01-01',
    `2026-${String(1 + Math.floor(i / 24 / 28)).padStart(2, '0')}-${String(1 + (Math.floor(i / 24) % 28)).padStart(2, '0')}`,
  )
  barras.push(t)
  rates[t] = {}
  rangos[t] = {}
  for (const ccy of CCYS) {
    const b = BASE[ccy]
    // Onda con fase propia + ruido: produce pivotes de verdad y mechas que
    // los perforan. Un mercado liso no daría ni un barrido y la prueba pasaría
    // comparando dos listas vacías — el error que ya se documentó en
    // `prueba-barrido-publicado.mjs`.
    const c = b * (1 + Math.sin(i / 11 + CCYS.indexOf(ccy)) * 0.02 + (azar() - 0.5) * 0.01)
    rates[t][ccy] = c
    rangos[t][ccy] = { h: c * (1 + azar() * 0.004), l: c * (1 - azar() * 0.004) }
  }
}

// ───────────────────────────────────────────────────────────────────────────
titulo('1. Reconstruir los pares: lo que se invierte y lo que no')

{
  const jpy = DIRECTOS.find((d) => d.par === 'USD/JPY')
  const eur = DIRECTOS.find((d) => d.par === 'EUR/USD')
  ok(jpy && !jpy.invertir, 'USD/JPY se usa tal cual (la cotización cruda YA es ese par)')
  ok(eur && eur.invertir, 'EUR/USD sí se invierte (lo que se baja es USD/EUR)')

  const vJ = velasDe(barras, rates, rangos, jpy)
  const vE = velasDe(barras, rates, rangos, eur)

  ok(
    vJ.every((v) => v.h >= v.c && v.c >= v.l),
    'sin invertir: máximo ≥ cierre ≥ mínimo',
  )
  // ⚠️ LA COMPROBACIÓN QUE MÁS IMPORTA. Al invertir, el máximo pasa a ser el
  // inverso del MÍNIMO. Confundirlos deja velas dadas la vuelta y todos los
  // barridos salen al revés, sin que nada falle.
  ok(
    vE.every((v) => v.h >= v.c && v.c >= v.l),
    'INVIRTIENDO: máximo ≥ cierre ≥ mínimo (no se intercambiaron mal)',
  )

  const i = 5
  const crudo = rangos[barras[i]].EUR
  ok(Math.abs(vE[i].h - 1 / crudo.l) < 1e-12, 'el máximo invertido es el inverso del mínimo crudo')
  ok(Math.abs(vE[i].l - 1 / crudo.h) < 1e-12, 'y el mínimo invertido, el inverso del máximo crudo')
  // Invertir dos veces devuelve el original: la transformación es exacta, no
  // una aproximación como sí lo sería derivar un cruce.
  ok(Math.abs(1 / vE[i].c - rates[barras[i]].EUR) < 1e-12, 'invertir es exacto: ida y vuelta devuelve el original')
}

{
  ok(DIRECTOS.length === 7, `son exactamente 7 pares directos (son ${DIRECTOS.length})`)
  // ⚠️ Ningún cruce puede colarse: sus mechas se derivan y fabricarían
  // barridos que nunca ocurrieron.
  ok(
    DIRECTOS.every((d) => d.par.includes('USD')),
    'NINGÚN cruce entra en la medición — todos llevan USD',
  )
}

// ───────────────────────────────────────────────────────────────────────────
titulo('2. Las señales que llegan al banco')

const senales = senalesLSSBanco(barras, rates, rangos, {
  swingLen: 3,
  sweepWindow: 6,
  rr: 2,
  calentamiento: 20,
})

{
  ok(senales.length > 5, `el adaptador saca señales del mercado inventado (${senales.length})`)
  ok(senales.every((s) => s.tipo === 'lss'), 'todas llevan `tipo: lss`')
  // ⚠️ El resolver de ESTA app busca `vela`, no `cierre`. Si el campo se
  // llamara mal, `indexOf(undefined)` daría -1 y TODAS saldrían caducadas nada
  // más nacer — el mismo fallo que ya se documentó dentro del resolver.
  ok(senales.every((s) => typeof s.vela === 'string' && s.vela.length > 0), 'todas traen `vela` (no solo `cierre`)')
  ok(
    new Set(senales.map((s) => `${s.id}@${s.vela}`)).size === senales.length,
    'no hay dos señales con la misma clave',
  )
  ok(senales.every((s) => s.pipRiesgo >= 1 && s.pipBeneficio >= 1), 'ninguna con riesgo o beneficio de cero pips')
  ok(senales.every((s) => Math.abs(s.rr - 2) < 1e-9), 'el ratio que llega al banco es el pedido')
  ok(
    senales.every((s) => (s.lado === 'COMPRA' ? s.sl < s.precio && s.tp > s.precio : s.sl > s.precio && s.tp < s.precio)),
    'stop y objetivo en los lados correctos',
  )
  ok(senales.every((s, i) => i === 0 || senales[i - 1].vela <= s.vela), 'salen en orden de vela')
  ok(senales.every((s) => barras.indexOf(s.vela) >= 20), 'ninguna señal dentro del calentamiento')
  ok(
    senales.every((s) => DIRECTOS.some((d) => d.par === s.par)),
    'todas son de un par directo',
  )
}

// ───────────────────────────────────────────────────────────────────────────
titulo('3. Las mismas llamadas que hace el banco')

{
  const data = datosExactos(barras, rates, rangos)
  ok(Array.isArray(data.barras) && data.barras.length === barras.length, '`datosExactos` trae `barras` en la raíz')
  ok(data.pares.length === 7, 'y los 7 pares')
  // El resolver marca `exacto: !par.esCruce`. Si algún día entrara un cruce
  // aquí, sus resultados saldrían marcados como exactos siendo aproximados.
  ok(data.pares.every((p) => p.esCruce === false), 'los 7 van marcados como NO cruce — porque no lo son')
  ok(
    data.pares.every((p) => p.highs.length === barras.length && p.lows.length === barras.length),
    'cada par trae `highs` y `lows` completos',
  )
  ok(
    data.pares.every((p) => p.highs.every((h, i) => h >= p.lows[i])),
    'en los 7, el máximo nunca queda por debajo del mínimo',
  )

  const { resultados } = resolver(senales, data)
  const juzgadas = resultados.filter((r) => r.resultado === 'ganada' || r.resultado === 'perdida')
  ok(juzgadas.length > 0, `el resolver juzga señales del LSS (${juzgadas.length} de ${resultados.length})`)
  ok(juzgadas.every((r) => r.exacto), 'y las marca EXACTAS, que es el punto de medir solo los directos')

  const porClave = new Map(resultados.map((r) => [r.clave, r]))
  const m = medir(senales, porClave, { conSpread: true })
  ok(Number.isFinite(m.porRiesgo ?? 0), '`medir` devuelve un número, no basura')
  ok(m.total === juzgadas.length, 'el total de `medir` cuadra con lo que juzgó el resolver')

  // ⚠️⚠️ LA LLAMADA QUE YA SE ESCRIBIÓ MAL DOS VECES, y la segunda costó los
  // 112 créditos de una corrida de M15: la tabla se imprimió entera y reventó
  // en el último bloque con «Cannot read properties of undefined».
  //
  // Este bloque decía comprobar «los campos EXACTOS que devuelve» y solo
  // miraba `total` y `filas`, así que no mordió. Ahora se comprueban TODOS,
  // incluidos los dos que faltaban.
  //
  // 📌 Y el motivo de que sea tan fácil equivocarse aquí importa: en SWING
  // devuelve `mediana` y `media` (cuánto duró la operación, porque allá cada
  // vela ES un día y la duración son las noches). Aquí devuelve `cruzaron` y
  // `mediaNoches`, porque las noches NO se deducen de la duración: una
  // operación de 6 horas abierta a las 20:00 cruza el corte de las 22:00 UTC y
  // una de 20 horas abierta a las 23:00 no cruza ninguno.
  //
  // O sea que copiar la línea de la app hermana no es un descuido de
  // escritura: es traerse una suposición sobre el mercado que aquí es falsa.
  const b = barridoSwap(senales, porClave)
  ok(typeof b.total === 'number', '`barridoSwap` devuelve `total`')
  ok(Array.isArray(b.filas) && b.filas.length > 0, 'y `filas` (NO `niveles`)')
  ok(typeof b.cruzaron === 'number', 'y `cruzaron` — cuántas pasaron por el corte de las 22:00')
  ok(typeof b.mediaNoches === 'number', 'y `mediaNoches` (NO `media`, que es de Swing)')
  ok(b.mediana === undefined, 'y NO trae `mediana`: ése es el nombre de Swing, aquí no existe')
  ok(b.media === undefined, 'ni `media`, por lo mismo')
  ok(b.cruzaron <= b.total, 'no pueden cruzar la noche más operaciones de las que hay')
  ok(
    b.filas.every((f) => typeof f.nivel === 'number' && f.medicion && typeof f.costeMedio === 'number'),
    'cada fila trae `nivel`, `medicion` y `costeMedio`',
  )
}

// ───────────────────────────────────────────────────────────────────────────
titulo('4. Que NINGÚN guion use los nombres de `barridoSwap` de la app hermana')

// ⚠️ Las comprobaciones de arriba guardan lo que `barridoSwap` DEVUELVE, y eso
// no basta: un guion puede seguir pidiéndole `b.mediana` y reventar igual.
// Es justo lo que pasó, DOS VECES el mismo día y en DOS archivos distintos:
// primero tumbó la tabla del M15 (112 créditos) y después la del banco normal
// (28 créditos y 37 minutos). Las dos veces se imprimió entera y murió en el
// último bloque.
//
// 📌 Y la primera versión de esta comprobación miraba UN SOLO archivo, así que
// no habría cazado la segunda. Por eso ahora recorre TODOS los guiones: un
// error que se acaba de cometer en un sitio es exactamente el que se va a
// cometer en el de al lado.
//
// Se lee cada guion COMO TEXTO, igual que `prueba-costes.mjs` hace con las
// etiquetas «(hoy)»: comprobar lo que el archivo DICE, no solo lo que la
// librería devuelve.
{
  const dir = new URL('./', import.meta.url)
  // Este mismo archivo queda fuera, y no por comodidad: lleva `b.mediana` y
  // `b.media` escritos DENTRO, en el propio patrón que busca. Sin excluirlo se
  // marcaría a sí mismo y la prueba fallaría siempre, que es la forma más
  // rápida de que alguien la desactive por pesada.
  const YO = 'prueba-lss-banco.mjs'
  const guiones = readdirSync(dir)
    .filter((f) => f.endsWith('.mjs') && f !== YO)
    .map((f) => [f, readFileSync(new URL(f, dir), 'utf8')])
    .filter(([, src]) => src.includes('barridoSwap('))

  // Guarda contra una prueba que se adapta a lo que encuentra: si nadie llama
  // ya a `barridoSwap`, el bucle no entraría y esto quedaría en verde sin
  // haber mirado ni un archivo.
  ok(guiones.length >= 2, `hay guiones que llaman a \`barridoSwap\` (${guiones.length}); si no, esta prueba no comprueba nada`)

  for (const [nombre, src] of guiones) {
    for (const campo of ['mediana', 'media']) {
      ok(
        !new RegExp(`\\bb\\.${campo}\\b`).test(src),
        `${nombre} NO usa \`b.${campo}\` — ése es el nombre de Swing y aquí sale undefined`,
      )
    }
  }
}

console.log(`\n${mal ? `✗ ${mal} de ${n} MAL` : `✓ las ${n} comprobaciones pasan`}\n`)
process.exit(mal ? 1 : 0)
