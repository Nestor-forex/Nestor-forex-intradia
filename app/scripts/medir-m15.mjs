// ¿Y LA MISMA APP EN VELAS DE 15 MINUTOS?
//
//     node scripts/medir-m15.mjs
//
// ─────────────────────────────────────────────────────────────────────────
// QUÉ ES ESTO Y QUÉ NO ES
// ─────────────────────────────────────────────────────────────────────────
// NO CAMBIA NADA. No publica, no escribe en la rama `datos`, no toca el
// historial y no modifica ni un archivo de la app: solo imprime números.
// Néstor lo pidió con estas palabras — «hagamos las pruebas, pero sin
// cambiarle o quitarle nada a la app».
//
// Contesta UNA pregunta que este proyecto nunca había contestado: el barrido de
// la app de intradía (fuerza relativa entre divisas + EMA9/21 + RSI + ADX), con
// sus ventanas medidas con el MISMO RELOJ pero sobre velas de 15 minutos,
// ¿tiene ventaja?
//
// 📌 Lo que SÍ estaba medido y no hay que confundir: el NFX-LSS en M15
// (`medir-lss-m15.mjs`, 2026-09-20), que dio −0,16 con barrido y −0,15 sin él.
// Aquello mide el indicador del concurso; esto mide LA APP. Su propio guion lo
// decía: «NO hay fila "la app" aquí».
//
// ─────────────────────────────────────────────────────────────────────────
// EL LISTÓN ESTÁ ESCRITO ANTES, EN OTRO ARCHIVO
// ─────────────────────────────────────────────────────────────────────────
// `scripts/lib/preregistro-m15.mjs`, con fecha dentro y commiteado antes de la
// primera corrida. El veredicto lo CALCULA `juzgar()`; este guion solo imprime
// lo que salga. Así, si algún resultado queda a un pelo, no hay margen para
// argumentar que pasa.
//
// ⚠️ Y SE MIDE UNA SOLA CONFIGURACIÓN, no veinte. Escalar las ventanas por
// reloj no es una de varias opciones a comparar: es LA traducción de la app a
// otra temporalidad. Barrer ventanas sobre estos mismos años sería buscar otra
// vez en el pozo con el que ya se eligieron las reglas de hoy, y eso devuelve
// el mejor número por construcción y no porque funcione.
//
// ─────────────────────────────────────────────────────────────────────────
// LO QUE CUESTA
// ─────────────────────────────────────────────────────────────────────────
// 7 créditos de Twelve Data por tanda, 16 tandas por omisión = 112 créditos de
// los 800 del día, y unos 16 minutos solo de descarga (pausa de 65 s entre
// tandas porque el plan gratuito da 8 créditos por minuto).
//
// ⚠️ El H1 con el que se compara NO se descarga: sale de reagrupar estas mismas
// velas de 15 minutos. Así la comparación es sobre los mismos días, los mismos
// pares y la misma descarga — si se midiera en otra corrida habría DOS
// diferencias a la vez (la temporalidad y el periodo) y no diría nada.

import { generarSenales, medir } from './lib/backtest-nucleo.mjs'
import { MARCO_H1, MARCO_M15, barridoConMarco, reagruparAHoras } from './lib/marco.mjs'
import { obtenerVelas, leerLlave } from './lib/velas.mjs'
import { resolver } from './lib/resolver.mjs'
import { simetrica } from './lib/geometrias.mjs'
import {
  CRITERIOS,
  FECHA_PREREGISTRO,
  QUE_PASA_SI_PASA,
  SWAP_EXIGIDO,
  VARA,
  juzgar,
} from './lib/preregistro-m15.mjs'

const VELAS = 5000
const PAGINAS = Number(process.env.PAGINAS || 16)
const THR = 0.5
const TOP_N = 3

// Cuánta historia ve el barrido en cada momento. En H1 son 300 velas; en M15
// tienen que ser las mismas HORAS, o el barrido de M15 estaría calculado sobre
// menos mercado del que la app usa. 300 × 4 = 1200.
const VENTANA_H1 = 300
const VENTANA_M15 = VENTANA_H1 * MARCO_M15.porHora

console.log('LA APP EN VELAS DE 15 MINUTOS')
console.log('='.repeat(74))
console.log(`Listón preregistrado el ${FECHA_PREREGISTRO}. Vara: ${VARA}.`)
console.log('Este guion NO cambia nada: solo mide.')
console.log('')

console.log(`Bajando ${PAGINAS} tandas de velas de 15 minutos (${PAGINAS * 7} créditos)…`)
const m15 = await obtenerVelas(leerLlave(), { velas: VELAS, paginas: PAGINAS, intervalo: '15min' })
console.log(`  ${m15.barras.length} velas de 15 min, de ${m15.barras[0]} a ${m15.barras.at(-1)}`)

const h1 = reagruparAHoras(m15.barras, m15.rates, m15.rangos)
console.log(`  reagrupadas: ${h1.barras.length} velas de una hora (mismos días, misma descarga)`)
console.log('')

// Los datos completos con los que el resolver decide si una señal llegó a su
// objetivo o a su stop. Cada uno con SU marco, porque el recorrido se mira en
// las velas de su propia temporalidad.
const completoM15 = barridoConMarco(m15.barras, m15.rates, m15.rangos, MARCO_M15)
const completoH1 = barridoConMarco(h1.barras, h1.rates, h1.rangos, MARCO_H1)

function correr({ barras, rates, rangos }, marco, ventana, completo) {
  const senales = generarSenales(barras, rates, rangos, {
    calentamiento: ventana,
    thr: THR,
    topN: TOP_N,
    geometria: simetrica,
    computar: (b, r, g) => barridoConMarco(b, r, g, marco),
    ventana,
  })
  const { resultados } = resolver(senales, completo)
  return { senales, porClave: new Map(resultados.map((r) => [r.clave, r])) }
}

console.log('Midiendo M15… (esto es lo que tarda: el barrido se recalcula en cada vela)')
const enM15 = correr(m15, MARCO_M15, VENTANA_M15, completoM15)
console.log(`  ${enM15.senales.length} señales`)

console.log('Midiendo H1 sobre los mismos días, para tener con qué comparar…')
const enH1 = correr(h1, MARCO_H1, VENTANA_H1, completoH1)
console.log(`  ${enH1.senales.length} señales`)
console.log('')

// ── La tabla ─────────────────────────────────────────────────────────────

const corteM15 = m15.barras[Math.floor((VENTANA_M15 + m15.barras.length) / 2)]
const corteH1 = h1.barras[Math.floor((VENTANA_H1 + h1.barras.length) / 2)]
const meses = (m15.barras.length - VENTANA_M15) / (4 * 24 * 21)

const ac = (x) => (x === null ? '  — ' : (x.toFixed(0) + '%').padStart(4))
const pr = (x) => (x === null ? '   —  ' : ((x >= 0 ? '+' : '') + x.toFixed(3)).padStart(7))

function resumen(r, corte, opciones = {}) {
  const m = medir(r.senales, r.porClave, { conSpread: true, ...opciones })
  const m1 = medir(r.senales.filter((x) => x.vistoEl < corte), r.porClave, { conSpread: true, ...opciones })
  const m2 = medir(r.senales.filter((x) => x.vistoEl >= corte), r.porClave, { conSpread: true, ...opciones })
  return { m, m1, m2 }
}

const rM15 = resumen(enM15, corteM15)
const rH1 = resumen(enH1, corteH1)
const rM15Swap = resumen(enM15, corteM15, { swapPipsNoche: SWAP_EXIGIDO })

console.log('='.repeat(84))
console.log(`Las mitades se parten en ${corteM15} (M15) y ${corteH1} (H1).`)
console.log('')
console.log('qué se midió                        ops  señ/mes  acierto    por 1R  │  1ª mit │  2ª mit')
console.log('─'.repeat(84))
const fila = (nombre, { m, m1, m2 }, mesesFila = meses) => {
  console.log(
    `${nombre.padEnd(32)} ${String(m.total).padStart(6)}  ${(m.total / mesesFila).toFixed(1).padStart(7)}     ` +
      `${ac(m.acierto)}  ${pr(m.porRiesgo)}  │ ${pr(m1.porRiesgo)} │ ${pr(m2.porRiesgo)}`,
  )
}
fila('LA APP EN M15', rM15)
fila('la app en H1(mismos días)', rH1, (h1.barras.length - VENTANA_H1) / (24 * 21))
fila(`M15 + swap ${SWAP_EXIGIDO}/noche`, rM15Swap)
console.log('─'.repeat(84))

// ── La concentración por par ─────────────────────────────────────────────

const porPar = new Map()
for (const s of enM15.senales) porPar.set(s.par, (porPar.get(s.par) || 0) + 1)
const orden = [...porPar.entries()].sort((a, b) => b[1] - a[1])
const total = enM15.senales.length || 1
const parMayor = orden.length ? orden[0][1] / total : 1
console.log('')
console.log('Los cinco pares que más aportan:')
for (const [par, n] of orden.slice(0, 5)) {
  console.log(`  ${par.padEnd(9)} ${String(n).padStart(5)}  ${((n / total) * 100).toFixed(1)}%`)
}

// ── El veredicto, que lo calcula el listón ───────────────────────────────

const medido = {
  ops: rM15.m.total,
  porRiesgo: rM15.m.porRiesgo,
  mitad1: rM15.m1.porRiesgo,
  mitad2: rM15.m2.porRiesgo,
  conSwap: rM15Swap.m.porRiesgo,
  h1PorRiesgo: rH1.m.porRiesgo,
  parMayor,
}

const v = juzgar(medido)

console.log('')
console.log('='.repeat(84))
console.log(`EL VEREDICTO, contra el listón escrito el ${FECHA_PREREGISTRO}`)
console.log('─'.repeat(84))
for (const c of CRITERIOS) {
  const r = v.resultados.find((x) => x.clave === c.clave)
  const val = Array.isArray(r.valor) ? r.valor.map((x) => (x === null ? '—' : x.toFixed(3))).join(' vs ') : r.valor
  console.log(`  ${r.pasa ? '✓' : '✗'} ${c.dice}`)
  console.log(`      salió: ${val}`)
  if (!r.pasa) console.log(`      (${c.porque})`)
}
console.log('─'.repeat(84))
if (v.pasa) {
  console.log('PASA los seis criterios.')
  console.log('')
  console.log(`⚠️ Y lo que eso autoriza, que está escrito desde antes: ${QUE_PASA_SI_PASA}`)
} else {
  console.log(`NO PASA. Falla ${v.fallan.length} de ${CRITERIOS.length}: ${v.fallan.join(', ')}.`)
  console.log('')
  console.log('⚠️ La respuesta a esto NO es aflojar un criterio. Para ese momento exacto')
  console.log('   se escribió el listón antes de medir.')
}
console.log('='.repeat(84))

// ── Con la geometría real, COMO COMPROBACIÓN Y NUNCA COMO CRITERIO ───────
//
// ⚠️ Esto se imprime al final y a propósito: con el COT (2026-09-14) un filtro
// salió POSITIVO en las dos mitades con la geometría real y NEGATIVO en las dos
// con la vara neutra, sobre las MISMAS operaciones. Un filtro que sabe hacia
// dónde va el precio acierta con cualquier vara; ése no sabía nada, solo elegía
// operaciones con buena proporción objetivo/riesgo. Si se hubiera decidido con
// la geometría real se habría encendido una regla que no sabe nada.
console.log('')
console.log('Con la geometría REAL de la app (comprobación, NO criterio):')
// Una pasada más, y solo una: `correr` usa la geometría simétrica y aquí hace
// falta la de la app. Es el precio de no confundir las dos varas.
const senalesReales = generarSenales(m15.barras, m15.rates, m15.rangos, {
  calentamiento: VENTANA_M15,
  thr: THR,
  topN: TOP_N,
  computar: (b, r, g) => barridoConMarco(b, r, g, MARCO_M15),
  ventana: VENTANA_M15,
})
const { resultados: resReales } = resolver(senalesReales, completoM15)
const mReal = medir(senalesReales, new Map(resReales.map((r) => [r.clave, r])), { conSpread: true })
console.log(`  ops ${mReal.total} · acierto ${ac(mReal.acierto)} · pips ${mReal.pips} · por 1R ${pr(mReal.porRiesgo)}`)
