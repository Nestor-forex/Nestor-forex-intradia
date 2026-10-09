// ¿SIRVE LA «ESTRATEGIA FASE 1» QUE SE PARAMETRIZÓ EL 2026-10-07?
//
//     Actions → «Medir la estrategia Fase 1» → Run workflow
//
// El listón está en `lib/preregistro-fase1.mjs`, escrito ANTES de esta corrida,
// y ahí está también lo que NO se mide y por qué (el oro y el H4).
//
// ⚠️ ESTO NO TOCA NI UNA LÍNEA DE `src/`. Es una medición.
// ⚠️ GASTA 7 CRÉDITOS de Twelve Data (los 7 símbolos de esta app).
//
// ─────────────────────────────────────────────────────────────────────────
// LO QUE MIDE, EN UNA LÍNEA
// ─────────────────────────────────────────────────────────────────────────
// La entrada de la Fase 1 ES el retroceso que ya corre en la sombra. Así que
// lo único sin número son las DOS condiciones que la especificación añade: la
// ventana de Nueva York y el rechazo por RSI extendido. Se miden por separado
// y juntas, contra el retroceso a secas y contra la app.

import { leerLlave, obtenerVelas } from './lib/velas.mjs'
import { computarBarrido, ADX_MIN } from '../src/lib/marketCalc.js'
import { generarSenales, medir } from './lib/backtest-nucleo.mjs'
import { resolver } from './lib/resolver.mjs'
import { actual, simetrica } from './lib/geometrias.mjs'
import {
  juzgar,
  VENTANA_NY,
  MEJORA_MINIMA,
  SENALES_MES_MINIMAS,
  CONCENTRACION_MAXIMA,
  FECHA_REDACCION,
} from './lib/preregistro-fase1.mjs'

const CALENTAMIENTO = 300
const THR = 0.5
// ⚠️⚠️ TRES, NO CINCO. Swing se queda con los 5 mejores por lado y de allá vino
// este guion; aquí el valor por defecto de `derivarVista` es `topN = 3` y
// `backtest.mjs` usa 3. Con 5 la fila rotulada «CONTROL: la app tal cual» NO es
// la app tal cual, y además deja de ser comparable con la tabla ya publicada de
// esta app — que es la única razón por la que el control existe. Es el mismo
// error que el campo `cierre`: una constante de la app hermana colada aquí.
const TOP_N = 3
const VELAS = Number(process.env.VELAS || 5000)
// ⚠️ SIN `paginas` SOLO SE MIDEN 6,4 MESES, Y ESO NO ES UNA MEDICIÓN.
// Twelve Data devuelve como mucho 5.000 velas por consulta, y 5.000 velas H1
// son 196 días. La primera corrida de este guion (2026-10-09) salió así: 848
// operaciones de la app en vez de las ~8.000 de cinco años, y la Fase 1 se
// quedó en **2 operaciones**, con las que no se puede decir nada de nada.
// `backtest.mjs` pide 4 páginas desde siempre; esto se había quedado en 1.
// ⚠️ Cuesta 7 créditos por página (28 en total) y tarda ~3,5 min: hay una
// pausa obligatoria de 65 s entre páginas porque el plan gratuito da 8
// créditos por minuto.
const PAGINAS = Number(process.env.PAGINAS || 4)
const SWAP_CONTROL = 0.5

const enVentanaNY = (h) => h >= VENTANA_NY.desde && h < VENTANA_NY.hasta

// ⚠️ LA REGLA, ESCRITA UNA SOLA VEZ Y PARAMETRIZADA. Copiarla cuatro veces con
// una condición cambiada en cada copia es la forma más fácil de que una de las
// cuatro diga algo distinto de lo que su rótulo promete — y aquí está escrito
// que una etiqueta equivocada es un error de medición.
//
// Las tres condiciones del retroceso son las de `clasificarRetroceso` en
// `src/lib/marketCalc.js`, no una reescritura: medias ordenadas, el precio
// devuelto a la EMA9 sin romper la EMA21, y la fuerza acompañando.
const reglaFase1 =
  ({ conVentana = false, conRSI = false } = {}) =>
  (p, _esc, thr, hora) => {
    if (conVentana && !enVentanaNY(hora)) return null
    if (p.adx < ADX_MIN) return null
    const compra = p.e9 > p.e21 && p.dif > thr && p.c <= p.e9 && p.c > p.e21
    const venta = p.e9 < p.e21 && p.dif < -thr && p.c >= p.e9 && p.c < p.e21
    if (!compra && !venta) return null
    // El punto 6 de la especificación: no perseguir lo ya extendido.
    if (conRSI && compra && p.rsiV >= 70) return null
    if (conRSI && venta && p.rsiV <= 30) return null
    return compra ? 'COMPRA' : 'VENTA'
  }

console.log('\n╔════════════════════════════════════════════════════════════════════╗')
console.log('║  LA ESTRATEGIA FASE 1, MEDIDA                                      ║')
console.log('╚════════════════════════════════════════════════════════════════════╝')
console.log(`\nListón escrito el ${FECHA_REDACCION}, antes de esta corrida.`)
console.log('El veredicto lo calcula `juzgar()`.\n')
console.log('⚠️ La ENTRADA de la Fase 1 ya existe: es el retroceso que corre en la')
console.log('   sombra. Lo que se mide aquí son las DOS condiciones que la')
console.log('   especificación le añade — la ventana de Nueva York y el filtro de RSI.')
console.log('⚠️ El ORO no entra: la regla decide por diferencia de fuerza entre las dos')
console.log('   divisas del par, y el oro no es una de las ocho del barrido. El motivo')
console.log('   entero está en el preregistro.\n')

const { barras, rates, rangos } = await obtenerVelas(leerLlave(), { velas: VELAS, paginas: PAGINAS })
const completo = computarBarrido(barras, rates, rangos)
console.log(`Velas H1: ${barras.length} · de ${barras[0]} a ${barras.at(-1)}`)

const CORTE = barras[Math.floor((CALENTAMIENTO + barras.length) / 2)]
console.log(`Corte de las dos mitades: ${CORTE}`)

const HORAS = (new Date(barras.at(-1)) - new Date(barras[CALENTAMIENTO])) / 36e5
const MESES = HORAS / (24 * 30.44)
console.log(`Periodo medido: ${(HORAS / 24).toFixed(0)} días → ${MESES.toFixed(1)} meses\n`)

function correr(reglaEntrada, geometria) {
  const senales = generarSenales(barras, rates, rangos, {
    calentamiento: CALENTAMIENTO,
    thr: THR,
    topN: TOP_N,
    geometria,
    reglaEntrada,
  })
  const { resultados } = resolver(senales, completo)
  return { senales, porClave: new Map(resultados.map((r) => [r.clave, r])) }
}

function fila(reglaEntrada, geometria, etq = '') {
  const { senales, porClave } = correr(reglaEntrada, geometria)
  const m = (lista, opts = {}) => medir(lista, porClave, { conSpread: true, ...opts })
  const todo = m(senales)

  // ⚠️⚠️ EL GUARDIÁN QUE FALTABA, Y NO ES «TENER MÁS CUIDADO».
  // Si una fila tiene señales y el corte de las mitades no deja NINGUNA a un
  // lado, eso no es un resultado flojo: es que el guion no sabe partir las
  // señales — un nombre de campo equivocado, un corte fuera de rango. Y se
  // imprime igual de bien que un resultado de verdad, con `n/d` en una
  // columna que nadie mira dos veces. Revienta a propósito: una medición que
  // no puede juzgar tiene que DECIRLO, no dejar que el veredicto le eche la
  // culpa a la regla.
  if (senales.length > 0) {
    const a = senales.filter((s) => s.vela < CORTE).length
    const b = senales.filter((s) => s.vela >= CORTE).length
    if (a + b !== senales.length) {
      throw new Error(
        `${etq}: el corte pierde señales (${a} + ${b} ≠ ${senales.length}). ` +
          'Probablemente el campo de fecha no se llama como este guion cree.'
      )
    }
  }

  return {
    // ⚠️ `medir` devuelve `total` (resueltas) y NO `perdidas`, y su `acierto`
    // ya viene EN PORCENTAJE (0-100), no en fracción. La primera versión de
    // este guion hacía `ganadas + perdidas` → NaN, y multiplicaba el acierto
    // por 100 otra vez → «4900 %». Es la lección de siempre: antes de creerse
    // un resultado, comprobar que el lector lee.
    ops: todo.total,
    acierto: todo.acierto,
    porRiesgo: todo.porRiesgo,
    // ⚠️⚠️ AQUÍ EL CAMPO SE LLAMA `vela`, NO `cierre`. En swing es `cierre`, y
    // `backtest-nucleo.mjs` lo dice por escrito en el propio objeto. La primera
    // versión de este guion llegó copiada de allá con `s.cierre`, que aquí es
    // `undefined` — así que **las dos mitades salían vacías a la vez** y la
    // tabla imprimía `n/d` en las dos columnas de las cinco filas, sin un solo
    // error. El listón lo cazó («faltan las mitades: sin ellas no se puede
    // juzgar»), pero la tabla ya se leía como un resultado.
    // Es la regla de siempre: lo escrito en una app no vale en la otra.
    porRiesgo1aMitad: m(senales.filter((s) => s.vela < CORTE)).porRiesgo,
    porRiesgo2aMitad: m(senales.filter((s) => s.vela >= CORTE)).porRiesgo,
    porRiesgoConSwap: m(senales, { swapPipsNoche: SWAP_CONTROL }).porRiesgo,
    senalesMes: senales.length / MESES,
    pips: todo.pips,
    senales,
    porClave,
  }
}

// La concentración por par del resultado, para el criterio 6.
function concentracion(f) {
  const porPar = new Map()
  let total = 0
  for (const s of f.senales) {
    const r = f.porClave.get(`${s.id}@${s.vistoEl}`)
    if (!r || (r.resultado !== 'ganada' && r.resultado !== 'perdida')) continue
    const rr = r.resultado === 'ganada' ? s.pipBeneficio / s.pipRiesgo : -1
    porPar.set(s.par, (porPar.get(s.par) ?? 0) + rr)
    total += rr
  }
  // ⚠️ `null` cuando el total no es positivo: repartir una pérdida entre pares
  // no contesta «¿viene de un solo par la ventaja?», porque no hay ventaja.
  if (!(total > 0)) return null
  return Math.max(...porPar.values()) / total
}

const n3 = (x) => (x === null || x === undefined ? '  n/d' : (x >= 0 ? '+' : '') + x.toFixed(3))
// `acierto` llega ya en porcentaje desde `medir`; `concentracion` en fracción.
const pct = (x) => (x === null || x === undefined ? ' n/d' : `${x.toFixed(0)} %`)
const pctFrac = (x) => (x === null || x === undefined ? ' n/d' : `${(100 * x).toFixed(0)} %`)

const FILAS = [
  ['0. CONTROL: la app tal cual', null],
  ['1. El retroceso (lo que ya corre)', reglaFase1()],
  ['2. + solo ventana de Nueva York', reglaFase1({ conVentana: true })],
  ['3. + solo rechazar RSI extendido', reglaFase1({ conRSI: true })],
  ['4. LA FASE 1 (ventana + RSI)', reglaFase1({ conVentana: true, conRSI: true })],
]

function tabla(nombre, geometria) {
  console.log('─'.repeat(94))
  console.log(nombre)
  console.log('─'.repeat(94))
  console.log('                                      ops  señ/mes  acierto   por 1R    1ª mit    2ª mit   con swap')
  const out = {}
  for (const [etq, regla] of FILAS) {
    const f = fila(regla, geometria, etq)
    out[etq] = f
    console.log(
      `  ${etq.padEnd(34)}${String(f.ops).padStart(5)}  ${f.senalesMes.toFixed(1).padStart(7)}  ` +
        `${pct(f.acierto).padStart(7)}   ${n3(f.porRiesgo).padStart(6)}    ` +
        `${n3(f.porRiesgo1aMitad).padStart(6)}    ${n3(f.porRiesgo2aMitad).padStart(6)}     ` +
        `${n3(f.porRiesgoConSwap).padStart(6)}`
    )
  }
  console.log('')
  return out
}

const neutra = tabla('CON LA VARA NEUTRA 1:1 — ESTA ES LA QUE DECIDE', simetrica)
const real = tabla('Con la geometría REAL de la app (comprobación, NO decide)', actual)

// ─────────────────────────────────────────────────────────────────────────
console.log('═'.repeat(94))
console.log('EL VEREDICTO, CALCULADO')
console.log('═'.repeat(94))
console.log(`\nCriterios: gana con costes · gana en las DOS mitades ·`)
console.log(`           las condiciones añadidas aportan ≥ ${MEJORA_MINIMA} sobre el retroceso a secas ·`)
console.log(`           ≥ ${SENALES_MES_MINIMAS} señales/mes · aguanta ${SWAP_CONTROL} de swap ·`)
console.log(`           ningún par aporta más del ${100 * CONCENTRACION_MAXIMA} %\n`)

const r = {
  app: neutra['0. CONTROL: la app tal cual'],
  retroceso: neutra['1. El retroceso (lo que ya corre)'],
  ventana: neutra['2. + solo ventana de Nueva York'],
  rsi: neutra['3. + solo rechazar RSI extendido'],
  fase1: neutra['4. LA FASE 1 (ventana + RSI)'],
}
r.concentracion = concentracion(r.fase1)

console.log(`La app tal cual ............ ${n3(r.app.porRiesgo)}`)
console.log(`El retroceso a secas ....... ${n3(r.retroceso.porRiesgo)}`)
console.log(`LA FASE 1 .................. ${n3(r.fase1.porRiesgo)}`)
console.log(
  `  lo que aportan la ventana y el RSI: ` +
    `${n3(r.fase1.porRiesgo - r.retroceso.porRiesgo)}   (hace falta +${MEJORA_MINIMA})`
)
console.log(
  `  concentración por par: ` +
    `${r.concentracion === null ? 'n/d (no hay ventaja que repartir)' : pctFrac(r.concentracion)}`
)

const v = juzgar(r)
console.log('')
if (v.pasa) {
  console.log('✅ PASA EL LISTÓN.')
  console.log('')
  console.log('⚠️ Y pasar el listón es NECESARIO Y NO SUFICIENTE: estos mismos días ya se')
  console.log('   miraron para otras cosas. Lo limpio sería el registro hacia adelante —')
  console.log('   y el retroceso YA lo está acumulando en la sombra, que es la ventaja')
  console.log('   de que la entrada no fuera nueva.')
} else {
  console.log('❌ NO PASA EL LISTÓN. Motivos:')
  for (const f of v.fallos) console.log(`   · ${f}`)
  console.log('')
  console.log('⚠️ La respuesta NO es aflojar un criterio: para eso se escribió antes.')
}

if (v.mejoraSobreApp !== null) {
  console.log('')
  console.log(
    `Contra lo que Néstor ve hoy, la Fase 1 ${v.mejoraSobreApp > 0 ? 'MEJORA' : 'empeora'} ` +
      `en ${Math.abs(v.mejoraSobreApp).toFixed(3)} por unidad de riesgo.`
  )
  console.log('⚠️ Mejorar sobre algo que pierde no es ganar. La fila que decide es la de')
  console.log('   arriba: si la Fase 1 no da positivo, no hay estrategia que operar.')
}

console.log('')
console.log('Con la geometría real (comprobación):')
console.log(`  la app ${n3(real['0. CONTROL: la app tal cual'].porRiesgo)} · ` +
  `retroceso ${n3(real['1. El retroceso (lo que ya corre)'].porRiesgo)} · ` +
  `Fase 1 ${n3(real['4. LA FASE 1 (ventana + RSI)'].porRiesgo)}`)
console.log('⚠️ Si esta línea y la neutra no coinciden en el signo, manda la NEUTRA. El')
console.log('   2026-09-14 el COT salió positivo con la real y negativo con la neutra')
console.log('   sobre las mismas operaciones: con objetivos variables, una regla puede')
console.log('   elegir buena proporción sin acertar una dirección de más.')
console.log('')
