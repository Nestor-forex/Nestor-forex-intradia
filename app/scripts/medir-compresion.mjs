// ¿QUÉ VALORES TOMA DE VERDAD LA COMPRESIÓN EN ESTA APP?
//
//     node scripts/medir-compresion.mjs
//
// Cuesta 7 créditos de Twelve Data (los 7 símbolos) y nada más.
//
// ⚠️⚠️ ES UN DIAGNÓSTICO, NO UNA REGLA NI UN FILTRO. No genera señales, no las
// juzga y no toca `src/`. Su workflow lleva permiso de SOLO LECTURA.
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ HACE FALTA, Y POR QUÉ AQUÍ MÁS QUE EN LA APP HERMANA
// ─────────────────────────────────────────────────────────────────────────
//
// La tarjeta de compresión pone una palabra al lado de cada par («muy
// apretado», «normal», «más suelto») con los cortes de `UMBRALES_COMPRESION`.
// Esos cortes están elegidos A MANO y su propio comentario lo dice: salieron
// de mirar los 18 pares de UNA lectura de producción, que caían entre 0,88 y
// 1,12. Dieciocho números del mismo instante comparten el mercado entre sí:
// no son una distribución, son un punto.
//
// ⚠️ Y aquí hay algo que en Swing no pasa: en esta app la compresión **YA
// DECIDE SEÑALES**. `clasificarRango` rechaza una señal de rango cuando la
// compresión baja de `COMPRESION_MIN` (0,75), y eso lleva meses corriendo sin
// que nadie supiera en qué parte de la distribución cae ese 0,75. Si casi
// ningún par baja de ahí, el filtro no está filtrando nada; si baja la mitad,
// está decidiendo media app. Las dos cosas son posibles y ninguna está
// medida.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ LA DISTRIBUCIÓN SE MIDE SOBRE LO QUE LA TARJETA ENSEÑA, NO SOBRE LAS
// SEÑALES — y esto corrige lo que se hizo en la hermana
// ─────────────────────────────────────────────────────────────────────────
//
// La tarjeta pone una etiqueta a LOS 18 PARES, en TODAS las lecturas. Así que
// la unidad de observación correcta es «un par, una vela», no «una señal». Una
// señal es una selección: exige divergencia de fuerza, y si la compresión
// tuviera cualquier relación con esa divergencia, los percentiles de las
// señales no describirían lo que se ve en pantalla.
//
// En Swing los cortes se fijaron con la distribución de las SEÑALES
// (2026-10-30). Aquí se mide sobre los 18 pares de todas las velas, que es lo
// que la tarjeta enseña. Las dos no tienen por qué coincidir, y comprobar
// cuánto difieren en Swing es trabajo aparte — queda dicho, no callado.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ LO QUE ESTO NO AUTORIZA
// ─────────────────────────────────────────────────────────────────────────
//
// Mover `COMPRESION_MIN`. Saber dónde cae ese 0,75 dentro de la distribución
// dice CUÁNTO filtra, no si filtrar AYUDA. Eso lo contesta el banco de pruebas
// —que ya tiene su fila, «Sin el filtro de compresión»— y van NUEVE familias
// de filtros medidas en este proyecto y nueve que no pasan.

import { leerLlave, obtenerVelas } from './lib/velas.mjs'
import {
  PAIRS,
  CCY,
  VELAS_ATRAS_COMPRESION,
  UMBRALES_COMPRESION,
  atrWilder,
  precioDePar,
  maxDePar,
  minDePar,
} from '../src/lib/marketCalc.js'
import { compresionDe, nivelDe } from '../src/lib/compresion.js'

// El filtro vive dentro de `marketCalc.js` sin exportarse (es de la app, no de
// la pantalla). Se escribe aquí con su nombre al lado Y se comprueba contra el
// archivo, para que no puedan separarse en silencio — es la disciplina de
// `UMBRAL_FUERZA`, que llegó a estar copiado en nueve guiones.
const COMPRESION_MIN = 0.75

// Velas a pedir. 1.500 son ~62 días de mercado por par: suficientes para que
// cada par aporte más de mil observaciones y la distribución no dependa de una
// semana concreta.
const VELAS = Number(process.env.VELAS || 1500)

// Desde dónde se empieza a mirar. `atrWilder` usa 60 velas y el ATR «de antes»
// descarta las últimas 12, así que antes de 73 velas el número no es el que la
// app calcularía. Se deja margen.
const CALENTAMIENTO = 90

console.log('\n╔════════════════════════════════════════════════════════════════════╗')
console.log('║  LA COMPRESIÓN EN INTRADÍA: QUÉ VALORES TOMA DE VERDAD            ║')
console.log('╚════════════════════════════════════════════════════════════════════╝')
console.log('')
console.log('⚠️  DIAGNÓSTICO. No genera señales, no toca `src/` y no enciende nada.')
console.log('')
console.log('Dos preguntas, una sola descarga:')
console.log('  (a) ¿dónde están de verdad los cortes de la ETIQUETA de la tarjeta?')
console.log(`  (b) ¿cuánto filtra COMPRESION_MIN = ${COMPRESION_MIN}, que aquí SÍ decide señales?`)
console.log('')

// ── Comprobación de que el 0,75 escrito arriba es el de la app ────────────
//
// Sin esto, el informe podría estar midiendo un umbral que la app ya no usa, y
// el número saldría perfectamente creíble. Es el fallo de las etiquetas
// «(hoy)» del banco de pruebas, que envejecieron solas.
{
  const { readFileSync } = await import('node:fs')
  const fuente = readFileSync(new URL('../src/lib/marketCalc.js', import.meta.url), 'utf8')
  const m = fuente.match(/const\s+COMPRESION_MIN\s*=\s*([\d.]+)/)
  if (!m || Number(m[1]) !== COMPRESION_MIN) {
    console.log('')
    console.log('❌ EL UMBRAL DE ESTE INFORME NO ES EL DE LA APP.')
    console.log(`   aquí: ${COMPRESION_MIN} · en marketCalc.js: ${m ? m[1] : 'no se encontró'}`)
    console.log('   No se sigue: un informe que mide otro umbral del que dice medir')
    console.log('   es peor que no tener informe.')
    process.exit(1)
  }
  console.log(`✓ COMPRESION_MIN = ${COMPRESION_MIN}, comprobado contra marketCalc.js.`)
}

// ── Las velas ─────────────────────────────────────────────────────────────

const { fechas, rates, rangosPar } = await obtenerVelas(leerLlave(), { velas: VELAS })
const L = fechas.length - 1
console.log(`Velas H1: ${fechas.length} · de ${fechas[0]} a ${fechas[L]}`)
console.log('')

// ── Las series por par, exactamente como las arma `computarBarrido` ───────
//
// ⚠️ Se reconstruyen con las MISMAS funciones exportadas (`precioDePar`,
// `maxDePar`, `minDePar`) en vez de rehacer la aritmética: dos definiciones
// del precio de un par que puedan separarse es justo lo que este proyecto
// lleva meses cerrando. Y el máximo de un cruce combina el mínimo de la base
// con el máximo de la cotizada — escribirlo de memoria es como salió el ATR un
// 400 % mayor del real el 2026-08-09.
const serie = {}
const serieHi = {}
const serieLo = {}
for (const c of CCY) {
  serie[c] = fechas.map((t) => (c === 'USD' ? 1 : rates[t][c]))
  serieHi[c] = fechas.map((t, i) => (c === 'USD' ? 1 : (rangosPar?.[t]?.[c]?.h ?? serie[c][i])))
  serieLo[c] = fechas.map((t, i) => (c === 'USD' ? 1 : (rangosPar?.[t]?.[c]?.l ?? serie[c][i])))
}

// ── La compresión, par por par y vela por vela ────────────────────────────
//
// 📌 Esto es EXACTAMENTE lo que la app calcula, y no una aproximación: en
// producción el vigía le pasa a `computarBarrido` las últimas 300 velas, pero
// `atrWilder` solo mira las últimas 60 de lo que recibe, así que darle la
// serie entera hasta la vela `i` devuelve el mismo número.
const porPar = new Map()
const todas = []

for (const [b, q] of PAIRS) {
  const closes = fechas.map((_, i) => precioDePar(serie[b][i], serie[q][i]))
  const highs = fechas.map((_, i) => maxDePar(serieLo[b][i], serieHi[q][i]))
  const lows = fechas.map((_, i) => minDePar(serieHi[b][i], serieLo[q][i]))

  const vals = []
  for (let i = CALENTAMIENTO; i <= L; i++) {
    const h = highs.slice(0, i + 1)
    const l = lows.slice(0, i + 1)
    const c = closes.slice(0, i + 1)
    const atrAhora = atrWilder(h, l, c)
    const atrAntes = atrWilder(
      h.slice(0, -VELAS_ATRAS_COMPRESION),
      l.slice(0, -VELAS_ATRAS_COMPRESION),
      c.slice(0, -VELAS_ATRAS_COMPRESION),
    )
    // ⚠️ Sin el `?? 1` de la app, y a propósito: aquí se quiere la DISTRIBUCIÓN
    // de lo que se puede calcular. Meter unos a mano crearía un pico falso justo
    // en el valor que más decide. Los no calculables se cuentan aparte.
    const x = compresionDe(atrAhora, atrAntes)
    if (Number.isFinite(x)) vals.push(x)
  }
  porPar.set(`${b}/${q}`, vals)
  todas.push(...vals)
}

const esperadas = PAIRS.length * (L - CALENTAMIENTO + 1)
console.log(`Observaciones (un par, una vela): ${todas.length} de ${esperadas} posibles`)
if (todas.length < esperadas) {
  console.log(`  (${esperadas - todas.length} no se pudieron calcular y NO se cuentan como 1)`)
}
console.log('')

if (!todas.length) {
  console.log('❌ Cero observaciones. No hay nada que medir.')
  process.exit(1)
}

// ── Los percentiles ───────────────────────────────────────────────────────

const percentiles = (xs) => {
  const v = [...xs].sort((a, b) => a - b)
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))]
  return { n: v.length, min: q(0), p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9), max: q(1) }
}

const linea = (etiqueta, d) =>
  `${etiqueta.padEnd(22)} n=${String(d.n).padStart(6)}  mín ${d.min.toFixed(2)}  p10 ${d.p10.toFixed(2)}  ` +
  `p25 ${d.p25.toFixed(2)}  mediana ${d.p50.toFixed(2)}  p75 ${d.p75.toFixed(2)}  ` +
  `p90 ${d.p90.toFixed(2)}  máx ${d.max.toFixed(2)}`

const dTodas = percentiles(todas)

console.log('═'.repeat(100))
console.log('(a) LA DISTRIBUCIÓN — un par, una vela: lo que la TARJETA enseña')
console.log('═'.repeat(100))
console.log('')
console.log(linea('los 18 pares', dTodas))
console.log('')
console.log('Los cortes que esto propone, con la misma regla que la app hermana')
console.log('(la palabra dice QUÉ TAN RARO es el valor, nunca qué hacer con él):')
console.log('')
console.log(`  muy apretado  < p10 = ${dTodas.p10.toFixed(2)}     (el 10 % más estrecho)`)
console.log(`  algo apretado < p25 = ${dTodas.p25.toFixed(2)}     (el 15 % siguiente)`)
console.log(`  más suelto    > p90 = ${dTodas.p90.toFixed(2)}     (el 10 % más ancho)`)
console.log('')
console.log('Los que usa hoy la tarjeta, para comparar:')
console.log(`  muy ${UMBRALES_COMPRESION.muy} · algo ${UMBRALES_COMPRESION.algo} · ancho ${UMBRALES_COMPRESION.ancho}`)
console.log('')

// Qué fracción cae en cada etiqueta HOY. Es lo que de verdad dice si una
// etiqueta es decorativa: si «muy apretado» sale en el 0,3 % de las lecturas,
// un par casi nunca llega a merecerla.
const cuenta = { muy: 0, algo: 0, normal: 0, ancho: 0 }
for (const x of todas) cuenta[nivelDe(x, UMBRALES_COMPRESION)]++
console.log('Y cómo reparte la tarjeta HOY, sobre estas mismas observaciones:')
console.log('')
for (const k of ['muy', 'algo', 'normal', 'ancho']) {
  const p = (cuenta[k] / todas.length) * 100
  const barra = '█'.repeat(Math.max(0, Math.round(p / 2)))
  console.log(`  ${k.padEnd(7)} ${`${p.toFixed(1)} %`.padStart(7)}  ${barra}`)
}
console.log('')

// ── El reparto por par ────────────────────────────────────────────────────
//
// ⚠️ Un corte único para los 18 pares solo vale si los 18 viven en el mismo
// sitio. Si un par tuviera la mediana en 0,90 y otro en 1,05, la palabra «muy
// apretado» significaría cosas distintas según la fila, y eso no se ve en los
// percentiles del montón junto.
//
// 📌 Lo que este guion NO puede contestar, y se dice en vez de callarlo: si la
// distribución de las SEÑALES difiere de ésta. Para eso hay que generar las
// señales, o sea el banco de pruebas entero. Lo que sí deja comprobado es la
// otra fuente de sesgo obvia, que es el par.
console.log('═'.repeat(100))
console.log('POR PAR — para ver si algún par arrastra la distribución')
console.log('═'.repeat(100))
console.log('')
const filas = [...porPar.entries()].map(([nombre, vals]) => ({ nombre, d: percentiles(vals) }))
filas.sort((a, b) => a.d.p50 - b.d.p50)
for (const f of filas) console.log(`  ${linea(f.nombre, f.d)}`)
console.log('')
const medianas = filas.map((f) => f.d.p50)
console.log(
  `  Las medianas por par van de ${Math.min(...medianas).toFixed(2)} a ${Math.max(...medianas).toFixed(2)}.`,
)
console.log('  (si ese rango fuera ancho, un corte único no valdría para los 18)')
console.log('')

// ── (b) CUÁNTO FILTRA EL UMBRAL QUE SÍ DECIDE ─────────────────────────────

console.log('═'.repeat(100))
console.log(`(b) COMPRESION_MIN = ${COMPRESION_MIN} — el único sitio del proyecto donde esto DECIDE`)
console.log('═'.repeat(100))
console.log('')
const bajo = todas.filter((x) => x < COMPRESION_MIN).length
const pctBajo = (bajo / todas.length) * 100
console.log(`Observaciones por debajo de ${COMPRESION_MIN}: ${bajo} de ${todas.length} = ${pctBajo.toFixed(2)} %`)
console.log('')
console.log('Qué significa cada caso, escrito ANTES de ver el número:')
console.log('  · si sale cerca de 0 %  → el filtro no filtra nada y es un adorno caro:')
console.log('                            ocupa una línea de código que decide señales')
console.log('                            y nunca se activa.')
console.log('  · si sale alto         → está decidiendo buena parte de las señales de')
console.log('                            rango, y entonces NO tener su número medido')
console.log('                            es el problema, no un detalle.')
console.log('')
console.log('⚠️  Esto dice CUÁNTO filtra, no si filtrar AYUDA. Lo segundo lo contesta')
console.log('    el banco de pruebas, que ya tiene su fila («Sin el filtro de')
console.log('    compresión»). Van nueve familias de filtros medidas y nueve que no')
console.log('    pasan, así que la respuesta por defecto es que no ayuda.')
console.log('')

// Y por par, porque un filtro puede estar apagado en 17 pares y encendido en uno.
const porParBajo = filas
  .map((f) => {
    const vals = porPar.get(f.nombre)
    return { nombre: f.nombre, pct: (vals.filter((x) => x < COMPRESION_MIN).length / vals.length) * 100 }
  })
  .sort((a, b) => b.pct - a.pct)
console.log('Por par (los cinco que más lo tocan):')
for (const f of porParBajo.slice(0, 5)) console.log(`  ${f.nombre.padEnd(10)} ${f.pct.toFixed(2)} %`)
console.log('')

console.log('⚠️  LO QUE ESTE INFORME NO AUTORIZA:')
console.log('   · mover COMPRESION_MIN — esto no mide si el filtro ayuda;')
console.log('   · encender ni apagar una sola señal de ninguna de las dos apps;')
console.log('   · copiar estos cortes a la app hermana: allí `atrWilder` recorre la')
console.log('     serie ENTERA y aquí tiene ventana DURA de 60 velas, así que el')
console.log('     cociente se mueve mucho menos. Lo medido en una app no vale en la otra.')
console.log('')
