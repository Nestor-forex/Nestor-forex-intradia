// ¿CUÁNTO CUESTA OPERAR CON UN BARRIDO VIEJO? — la medición.
//
// Correr con: node scripts/medir-frescura.mjs      (7 créditos de Twelve Data)
// O desde Actions → «¿Cuánto cuesta un barrido viejo?» → Run workflow.
//
// NO escribe nada: ni en la rama `datos`, ni en el historial, ni en `src/`.
// Solo imprime. El workflow lleva `permissions: contents: read`.
//
// El listón, el porqué y qué obliga cada resultado están en
// `lib/preregistro-frescura.mjs`, escrito ANTES que esto.

import { desvioDelRB, porcentajes, senalesConRetraso } from './lib/frescura-banco.mjs'
import { medir } from './lib/backtest-nucleo.mjs'
import { actual, simetrica } from './lib/geometrias.mjs'
import { resolver } from './lib/resolver.mjs'
import { computarBarrido } from '../src/lib/marketCalc.js'
import { leerLlave, obtenerVelas } from './lib/velas.mjs'
import {
  COMO_SE_MIDE,
  FECHA_DEL_LISTON,
  LO_QUE_NO_CONTESTA,
  MIN_OPS,
  QUE_OBLIGA_CADA_RESULTADO,
  RETRASOS,
  POR_1R_NO_DECIDE,
  UMBRAL_NO_USABLES,
  juzgar,
} from './lib/preregistro-frescura.mjs'

const VELAS = 5000
const PAGINAS = Number(process.env.PAGINAS || 4)
const THR = 0.5
const TOP_N = 3

console.log('---FRESCURA-INICIO---')
console.log(`Listón escrito el ${FECHA_DEL_LISTON} · DECIDE la fracción no usable, umbral ${UMBRAL_NO_USABLES} de cada 100`)
console.log(`Cómo se mide: ${COMO_SE_MIDE}`)
console.log('')

const { barras, rates, rangos } = await obtenerVelas(leerLlave(), { velas: VELAS, paginas: PAGINAS })
const completo = computarBarrido(barras, rates, rangos)
console.log(`${barras.length} velas de una hora · de ${barras[0]} a ${barras[barras.length - 1]}`)
console.log('')

function correr(retraso, geometria) {
  const r = senalesConRetraso(barras, rates, rangos, { retraso, thr: THR, topN: TOP_N, geometria })
  const { resultados } = resolver(r.senales, completo)
  const porClave = new Map(resultados.map((x) => [x.clave, x]))
  return { ...r, porClave }
}

// ─────────────────────────────────────────────────────────────────────────
// La tabla que decide: VARA NEUTRA 1:1, con el spread por par descontado.
//
// ⚠️ Decide la neutra y no la geometría de la app, y está escrito desde el
// preregistro del COT por qué: con objetivos variables un cambio puede mover
// el resultado seleccionando operaciones con buena proporción sin acertar ni
// una dirección de más. Aquel día eso casi enciende un filtro que no sabía
// nada.
// ─────────────────────────────────────────────────────────────────────────
console.log('VARA NEUTRA 1:1, con spread por par')
console.log(`⚠️ ${POR_1R_NO_DECIDE}`)
console.log('')
console.log(' retraso │    ops │ acierto │  por 1R │ stop ya roto │ obj. ya pasado │ R/B real − enseñado')
console.log('─────────┼────────┼─────────┼─────────┼──────────────┼────────────────┼────────────────────')

const filas = []
for (const retraso of RETRASOS) {
  const r = correr(retraso, simetrica)
  const m = medir(r.senales, r.porClave, { conSpread: true })
  const p = porcentajes(r)
  const d = desvioDelRB(r.senales)
  filas.push({
    retraso,
    ops: m.total,
    porRiesgo: m.porRiesgo,
    acierto: m.acierto,
    vistas: p?.vistas ?? 0,
    pctNoUsables: p?.pctNoUsables ?? NaN,
  })

  const et = retraso === 0 ? '  fresco' : `${String(retraso).padStart(4)} h  `
  console.log(
    `${et} │ ${String(m.total).padStart(6)} │ ` +
      `${m.acierto === null ? '    —  ' : (m.acierto.toFixed(0) + ' %').padStart(6)} │ ` +
      `${m.porRiesgo === null ? '    —  ' : m.porRiesgo.toFixed(3).padStart(7)} │ ` +
      `${p === null ? "      —" : (p.pctRoto.toFixed(1) + " %").padStart(11)}  │ ` +
      `${p === null ? '       —' : (p.pctObjetivo.toFixed(1) + ' %').padStart(13)}  │ ` +
      `${d === null ? '    —' : d.toFixed(3).padStart(10)}`
  )
}

console.log('')
console.log('LAS DOS COLUMNAS DEL MEDIO SON LAS QUE DECIDEN: de cada 100 señales que la')
console.log('app enseñaba, cuántas llegaban con el stop YA roto (nacen perdidas) y cuántas')
console.log('con el objetivo YA pasado (nacen ganadas). Van las DOS a propósito: enseñar')
console.log('solo las rotas sería quedarse con la mitad que asusta. Ninguna de las dos se')
console.log('puntúa —nadie abre una operación con el stop ya roto—, y por eso la columna')
console.log('de «ops» encoge: ESE encogimiento es el coste, no un defecto de la tabla.')
console.log('')

// ─────────────────────────────────────────────────────────────────────────
// La geometría REAL de la app, como comprobación y no como decisión.
// ─────────────────────────────────────────────────────────────────────────
console.log('GEOMETRÍA REAL DE LA APP (comprobación, no decide)')
console.log('')
console.log(' retraso │    ops │ acierto │  por 1R')
console.log('─────────┼────────┼─────────┼─────────')
for (const retraso of RETRASOS) {
  const r = correr(retraso, actual)
  const m = medir(r.senales, r.porClave, { conSpread: true })
  const et = retraso === 0 ? '  fresco' : `${String(retraso).padStart(4)} h  `
  console.log(
    `${et} │ ${String(m.total).padStart(6)} │ ` +
      `${m.acierto === null ? '    —  ' : (m.acierto.toFixed(0) + ' %').padStart(6)} │ ` +
      `${m.porRiesgo === null ? '    —  ' : m.porRiesgo.toFixed(3).padStart(7)}`
  )
}

// ─────────────────────────────────────────────────────────────────────────
// EL VEREDICTO, calculado.
// ─────────────────────────────────────────────────────────────────────────
const v = juzgar(filas)

console.log('')
console.log('════════════════════════════════════════════════════════════════════')
console.log(`VEREDICTO: ${v.veredicto.toUpperCase()}`)
console.log(`  ${v.porque}`)
if (v.dano !== null) console.log(`  (por 1R, solo como contexto: cambia ${v.dano.toFixed(3)} — no decide)`)
console.log('')
console.log('  Lo que obliga este resultado, escrito antes de verlo:')
for (const linea of String(QUE_OBLIGA_CADA_RESULTADO[v.veredicto] || QUE_OBLIGA_CADA_RESULTADO.noCuesta).match(/.{1,70}(\s|$)/g) || []) {
  console.log(`    ${linea.trim()}`)
}
console.log('════════════════════════════════════════════════════════════════════')
console.log('')
console.log('Lo que esta medición NO contesta:')
for (const l of LO_QUE_NO_CONTESTA) console.log(`  · ${l}`)
console.log('')
console.log(`(Una fila con menos de ${MIN_OPS} operaciones se imprime pero no decide.)`)
console.log('---FRESCURA-FIN---')
