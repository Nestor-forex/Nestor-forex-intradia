// ¿DEBE LA APP APAGAR EL MODO TENDENCIA Y QUEDARSE SOLO CON EL RANGO?
//
// Correr con: Actions → «¿Conviene apagar el modo tendencia?» → Run workflow
// Cuesta 7 créditos de Twelve Data (una descarga de velas, las mismas que el
// resto del banco).
//
// ⚠️ ESTO NO CAMBIA NADA DE LA APP. Es un diagnóstico: no toca ningún archivo
// de `src/`, el workflow lleva `permissions: contents: read` y el veredicto lo
// CALCULA `juzgar()` en `lib/preregistro-modos.mjs`, que se escribió el
// 2026-10-12 antes de correr esto ni una vez.
//
// El porqué de la pregunta, el listón y lo que autoriza cada veredicto están
// todos ahí dentro. Aquí solo se mide.

import { computarBarrido, UMBRAL_FUERZA } from '../src/lib/marketCalc.js'
import { generarSenales, medir } from './lib/backtest-nucleo.mjs'
import { resolver } from './lib/resolver.mjs'
import { simetrica, actual } from './lib/geometrias.mjs'
import { leerLlave, obtenerVelas } from './lib/velas.mjs'
import { PREREGISTRO, CRITERIOS, QUE_HACER, juzgar } from './lib/preregistro-modos.mjs'

const VELAS = 5000
const PAGINAS = Number(process.env.PAGINAS || 4)
// ⚠️ NO se escribe el número: se importa. Tres copias a mano del umbral que
// decide todas las señales eran tres formas de medir otra app (2026-10-12).
const THR = UMBRAL_FUERZA
const TOP_N = 3
const SWAP_PRUEBA = 0.5

const n3 = (x) => (x == null ? '   —   ' : ((x >= 0 ? '+' : '') + x.toFixed(3)).padStart(7))
const pct = (x) => (x == null ? '   — ' : (x.toFixed(0) + ' %').padStart(5))

console.log('---MODOS-INICIO---')
console.log('═'.repeat(88))
console.log('¿CONVIENE APAGAR EL MODO TENDENCIA?')
console.log(`Listón escrito el ${PREREGISTRO.fecha}, antes de correr esto. Decide la vara ${PREREGISTRO.vara}.`)
console.log('═'.repeat(88))
console.log('')

const { barras, rates, rangos } = await obtenerVelas(leerLlave(), { velas: VELAS, paginas: PAGINAS })
const completo = computarBarrido(barras, rates, rangos)
console.log(`${barras.length} velas de una hora · de ${barras[0]} a ${barras[barras.length - 1]}`)

// ─────────────────────────────────────────────────────────────────────────
// UNA SOLA CORRIDA, Y DESPUÉS SE PARTE POR `tipo`
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ Es a propósito y es lo que hace esta medición fiable: las señales de los
// dos modos salen del MISMO barrido, de los MISMOS días y con los MISMOS
// pares. Correr dos veces con configuraciones distintas abriría la puerta a
// que cambiara algo más sin darse cuenta.
function correr(geometria) {
  // ⚠️ `generarSenales` devuelve la LISTA, no un objeto con `senales` dentro.
  // La primera versión de este guion suponía lo segundo y reventaba con
  // «senales is not iterable» — lo cazó el humo con un mercado inventado,
  // antes de gastar un solo crédito. Es exactamente el fallo que ya está
  // documentado para esta misma función (los argumentos cambiados, 2026-09-02).
  const senales = generarSenales(barras, rates, rangos, { thr: THR, topN: TOP_N, geometria })
  const { resultados } = resolver(senales, completo)
  return { senales, porClave: new Map(resultados.map((x) => [x.clave, x])) }
}

const neutra = correr(simetrica)
const deTipo = (senales, tipo) => senales.filter((s) => (s.tipo || 'tendencia') === tipo)

// Cuántos meses de mercado, para las señales al mes. 21 días hábiles y 24
// velas por día, igual que el resto del banco.
const meses = barras.length / (21 * 24)

// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ LO PRIMERO: COMPROBAR QUE APAGAR TENDENCIA ES UNA RESTA LIMPIA
// ─────────────────────────────────────────────────────────────────────────
// El listón se apoya en que los dos modos son listas INDEPENDIENTES, así que
// apagar uno no cambia las señales del otro. El código dice que no pueden ser
// el mismo par a la vez (el rango exige ADX bajo y la tendencia lo contrario),
// pero eso hay que comprobarlo y no suponerlo: si algún día dejaran de serlo,
// esta medición mediría otra cosa sin fallar.
//
// Es justo lo que NO pasa con un filtro: allí la app se queda con los N
// mejores por lado, así que rechazar uno hace subir al siguiente y la medición
// deja de ser «la app menos las malas» (medido el 2026-08-25).
console.log('')
console.log('0. ¿Es una resta limpia? (si no lo fuera, nada de lo de abajo significaría lo que dice)')
{
  const clave = (s) => `${s.par}|${s.lado}|${s.vistoEl}`
  const rangosSolos = new Set(deTipo(neutra.senales, 'rango').map(clave))
  const otros = neutra.senales.filter((s) => (s.tipo || 'tendencia') !== 'rango').map(clave)
  const choques = otros.filter((k) => rangosSolos.has(k))
  console.log(`   señales de rango: ${rangosSolos.size} · del resto: ${otros.length} · que coinciden en par, lado y hora: ${choques.length}`)
  if (choques.length > 0) {
    console.log('')
    console.log('   ⚠️⚠️ LOS DOS MODOS SE PISAN. Apagar tendencia NO sería una resta limpia,')
    console.log('   así que esta medición no contesta la pregunta que dice contestar. Se para aquí.')
    console.log('---MODOS-FIN---')
    process.exit(1)
  }
  console.log('   ✓ ninguno se pisa: apagar tendencia deja las señales de rango intactas')
}

// ─────────────────────────────────────────────────────────────────────────
// LA TABLA QUE DECIDE
// ─────────────────────────────────────────────────────────────────────────
const corte = barras[Math.floor(barras.length / 2)]
const mitad = (senales, cual) => senales.filter((s) => (cual === 1 ? s.vistoEl < corte : s.vistoEl >= corte))

function fila(senales, porClave, swap = 0) {
  const m = medir(senales, porClave, { conSpread: true, swapPipsNoche: swap })
  return {
    ops: m.total,
    acierto: m.acierto,
    // ⚠️ `null` y NUNCA 0, y esto lo destapó el humo: con cero señales de rango
    // el `?? 0` de la primera versión hacía que «+0,000» le ganara a «−1,356»
    // y el criterio más importante pasara sobre un grupo vacío. «No se pudo
    // medir» y «midió cero» no son lo mismo. Misma decisión que `pearson`,
    // `difMax` y `edadEnMinutos`; `juzgar()` se niega a dar veredicto con esto.
    por1R: m.porRiesgo,
    mitad1: medir(mitad(senales, 1), porClave, { conSpread: true, swapPipsNoche: swap }).porRiesgo,
    mitad2: medir(mitad(senales, 2), porClave, { conSpread: true, swapPipsNoche: swap }).porRiesgo,
    senalesMes: m.total / meses,
  }
}

const todas = neutra.senales
const soloRango = deTipo(todas, 'rango')
const soloTendencia = deTipo(todas, 'tendencia')
const otrosTipos = todas.filter((s) => !['rango', 'tendencia'].includes(s.tipo || 'tendencia'))

// ⚠️ El cajón para lo que no encaje, que es la pieza que faltó cinco veces en
// este proyecto: un `tipo` nuevo no puede desaparecer de la tabla en silencio.
if (otrosTipos.length) {
  console.log('')
  console.log(`   ⚠️ hay ${otrosTipos.length} señales de otros tipos (${[...new Set(otrosTipos.map((s) => s.tipo))].join(', ')}):`)
  console.log('   no entran en «la app» de abajo. Si eso es nuevo, esta medición hay que revisarla.')
}

const d = {
  app: fila(todas, neutra.porClave),
  rango: fila(soloRango, neutra.porClave),
  tendencia: fila(soloTendencia, neutra.porClave),
  appSwap: fila(todas, neutra.porClave, SWAP_PRUEBA),
  rangoSwap: fila(soloRango, neutra.porClave, SWAP_PRUEBA),
  tendenciaSwap: fila(soloTendencia, neutra.porClave, SWAP_PRUEBA),
}

// Cuánto aporta el par que más aporta a la ventaja del rango.
{
  const porPar = new Map()
  for (const s of soloRango) {
    const uno = medir([s], neutra.porClave, { conSpread: true }).porRiesgo
    if (uno == null) continue
    porPar.set(s.par, (porPar.get(s.par) ?? 0) + uno)
  }
  const positivos = [...porPar.values()].filter((v) => v > 0)
  const total = positivos.reduce((a, b) => a + b, 0)
  d.aporteDelMejorPar = total > 0 ? Math.max(...positivos) / total : 1
}

console.log('')
console.log('VARA NEUTRA 1:1, con spread por par descontado')
console.log('')
console.log('                       │    ops │ señ/mes │ acierto │  por 1R │  1ª mit │  2ª mit │ +0,5 swap')
console.log('───────────────────────┼────────┼─────────┼─────────┼─────────┼─────────┼─────────┼──────────')
const linea = (nombre, k, kSwap) =>
  console.log(
    `${nombre.padEnd(22)} │ ${String(d[k].ops).padStart(6)} │ ${d[k].senalesMes.toFixed(1).padStart(7)} │ ` +
      `${pct(d[k].acierto)}   │ ${n3(d[k].por1R)} │ ${n3(d[k].mitad1)} │ ${n3(d[k].mitad2)} │ ${n3(d[kSwap].por1R)}`
  )
linea('LA APP HOY (los dos)', 'app', 'appSwap')
linea('  solo modo RANGO', 'rango', 'rangoSwap')
linea('  solo modo TENDENCIA', 'tendencia', 'tendenciaSwap')

// ─────────────────────────────────────────────────────────────────────────
// LA COMPROBACIÓN: la geometría real de la app
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ NO decide, y está escrito en el preregistro por qué: el 2026-09-14 un
// filtro medía POSITIVO en las dos mitades con esta geometría y NEGATIVO en
// las dos con la neutra. Si las dos varas no coinciden, manda la neutra y hay
// que decirlo.
console.log('')
console.log('COMPROBACIÓN — la geometría REAL de la app (no decide, ver el preregistro)')
const real = correr(actual)
const rr = {
  app: fila(real.senales, real.porClave),
  rango: fila(deTipo(real.senales, 'rango'), real.porClave),
  tendencia: fila(deTipo(real.senales, 'tendencia'), real.porClave),
}
console.log(`   la app ${n3(rr.app.por1R)} (${rr.app.ops} ops) · rango ${n3(rr.rango.por1R)} (${rr.rango.ops}) · tendencia ${n3(rr.tendencia.por1R)} (${rr.tendencia.ops})`)
const coinciden = rr.rango.por1R - rr.app.por1R > 0 === d.rango.por1R - d.app.por1R > 0
console.log(`   ¿apunta en la misma dirección que la vara neutra? ${coinciden ? 'SÍ' : '⚠️ NO — manda la neutra, y esto hay que mirarlo'}`)

// ─────────────────────────────────────────────────────────────────────────
// EL VEREDICTO, CALCULADO
// ─────────────────────────────────────────────────────────────────────────
console.log('')
console.log('═'.repeat(88))
console.log(`VEREDICTO PREREGISTRADO — ${PREREGISTRO.pregunta}`)
console.log('═'.repeat(88))
const v = juzgar(d)
if (v.noSePudoMedir) {
  console.log('')
  console.log(`  ⚠️⚠️ NO SE PUDO MEDIR — ${v.noSePudoMedir}`)
  console.log('')
  console.log('  Eso NO es «no pasa el listón»: es que no hay con qué juzgar. La app se')
  console.log('  queda como está y hay que mirar por qué faltan señales antes de volver.')
  console.log('---MODOS-FIN---')
  process.exit(1)
}
for (const c of v.detalle) {
  console.log(`  ${c.pasa ? '✅' : '❌'} ${c.titulo}`)
  console.log(`       ${c.explica}`)
}
console.log('')
console.log(`  → ${v.pasados} de ${CRITERIOS.length} criterios. ${v.pasa ? '✅ PASA' : '❌ NO PASA'}`)
console.log('')
console.log(`  ${v.pasa ? QUE_HACER.pasa : QUE_HACER.noPasa}`)
console.log('')
console.log('⚠️ Y lo que NINGÚN veredicto autoriza: apagar el modo rango si saliera al revés')
console.log('   (este listón está escrito en una sola dirección a propósito), usar el registro')
console.log('   real de 79 operaciones como confirmación (va sesgado por el reloj, medido el')
console.log('   2026-10-06), ni aflojar un criterio porque el resultado quede a un pelo.')
console.log('---MODOS-FIN---')
