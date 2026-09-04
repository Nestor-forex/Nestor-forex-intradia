// Banco de pruebas de Nestor Forex Intradía.
//
// Corre las reglas del barrido sobre miles de velas H1 reales y dice cuánto
// habrían acertado. Portado del de la app hermana de swing, donde midiendo se
// descubrió que la app perdía −0,15 por unidad de riesgo y que varias ideas
// que sonaban bien —incluida la mía— no funcionaban.
//
// Aquí hace más falta todavía: las 6 señales que esta app lleva dadas en su
// historial real salieron TODAS perdedoras, y cinco de ellas eran compras con
// el RSI entre 77 y 86.
//
// Cómo evita hacer trampa
// -----------------------
// Para decidir la vela i solo se le entregan velas hasta la i, y además solo
// las últimas 300 —que es exactamente lo que ve el vigía en producción—.
// `prueba-backtest.mjs` lo comprueba generando las señales sobre medio
// mercado y sobre el mercado entero y exigiendo que el tramo común salga
// idéntico hasta el último decimal.
//
// La entrada es el cierre de la vela en que aparece la señal, y el resultado
// lo juzga el mismo `resolver.mjs` que usa el vigía de verdad.
//
// Corre en GitHub Actions porque el entorno de la sesión de Claude tiene
// bloqueado api.twelvedata.com:
//   Actions → "Banco de pruebas de las reglas" → Run workflow

import { computarBarrido } from '../src/lib/marketCalc.js'
import { leerLlave, obtenerVelas } from './lib/velas.mjs'
import { costeEnPips, nochesEntre, NIVELES_SWAP, SPREAD_PIPS } from './lib/costes.mjs'
import { generarSenales, medir, barridoSwap, VENTANA } from './lib/backtest-nucleo.mjs'
import { GEOMETRIAS, simetrica, actual } from './lib/geometrias.mjs'
import { reglaBarrido } from './lib/patrones.mjs'
import { resolver } from './lib/resolver.mjs'
import { senalesApertura } from './lib/apertura.mjs'

// Cuántas horas se piden POR TANDA. 5000 es el tope de Twelve Data y cuesta lo
// mismo que pedir 300: se cobra por consulta, no por vela.
const VELAS = 5000

// Cuántas tandas encadenadas hacia atrás. Aquí está el cambio de fondo.
//
// Con una sola tanda son 5000 horas ≈ 7 meses, y 7 meses son UN SOLO humor de
// mercado. Una regla puede parecer buena solo porque el dólar cayó durante ese
// tramo. Con 4 tandas son unos 28 meses: entran dólar subiendo, cayendo y
// quieto, que es lo único que distingue una estrategia de una apuesta.
//
// Cuesta 7 créditos por tanda de los 800 diarios, y una pausa de 65 s entre
// tandas porque el plan gratuito da 8 créditos por minuto. Unos 4 minutos.
const PAGINAS = Number(process.env.PAGINAS || 4)

const THR = 0.5
const TOP_N = 3

const { barras, rates, rangos } = await obtenerVelas(leerLlave(), { velas: VELAS, paginas: PAGINAS })
const completo = computarBarrido(barras, rates, rangos)

// --------------------------------------------------------------------------

// Lo que cuesta operar sale de scripts/lib/costes.mjs: spread POR PAR (no uno
// solo para los 18, que hacía parecer baratos los cruces) y swap por noche.
//
// El spread pesa aquí más que en swing: los objetivos de intradía son de
// decenas de pips, así que un pip de más o de menos se lleva un pedazo grande
// del resultado. Un sistema que gana +0,14 por unidad de riesgo con stops de
// 15 pips se lo come el spread entero.
//
// ⚠️ Y EL SWAP TAMPOCO SE CONTABA, aunque parecía razonable ignorarlo: la app
// se llama Intradía y su idea es abrir y cerrar el mismo día. Pero eso es la
// INTENCIÓN, no lo que pasa. Medido sobre las 42 operaciones reales ya
// resueltas: mediana 9 horas, media 17,9, la más larga 102 — y 22 de 42 (52%)
// cruzaron al menos una vez el corte al que el bróker cobra swap.
//
// Las noches se cuentan por los cortes REALES entre entrada y salida, no por
// la duración: una operación de 6 horas abierta a las 20:00 cruza el corte, y
// una de 20 horas abierta a las 23:00 no.


function correr(opciones) {
  const senales = generarSenales(barras, rates, rangos, { thr: THR, topN: TOP_N, ...opciones })
  const { resultados } = resolver(senales, completo)
  return { senales, porClave: new Map(resultados.map((r) => [r.clave, r])) }
}

const fila = (nombre, m) => {
  const acierto = m.acierto === null ? '   —  ' : `${m.acierto.toFixed(0).padStart(4)}%`
  const porR = m.porRiesgo === null ? '    —' : `${m.porRiesgo >= 0 ? '+' : ''}${m.porRiesgo.toFixed(2)}`
  console.log(
    `${nombre.padEnd(46)} ${String(m.total).padStart(5)}   ${acierto}   ${String(m.pips).padStart(7)}   ${porR.padStart(7)}`
  )
}

const CAB = '                                                 ops   acierto      pips   por 1R'
const RAYA = '─'.repeat(86)

console.log('---BACKTEST-INICIO---')
console.log(`Velas H1 descargadas: ${barras.length} · de ${barras[0]} a ${barras.at(-1)}`)
console.log(`Velas medidas: ${barras.length - VENTANA} (las primeras ${VENTANA} son la ventana del barrido)`)

// --------------------------------------------------------------------------
// 1. La app tal cual, y el desglose que en swing destapó el problema.
// --------------------------------------------------------------------------

const app = correr({})
console.log('')
console.log('LA APP TAL COMO ESTÁ HOY')
console.log('')
console.log(`regla${CAB.slice(5)}`)
console.log(RAYA)
fila('Todo junto', medir(app.senales, app.porClave))
for (const lado of ['COMPRA', 'VENTA']) {
  fila(`  solo ${lado}`, medir(app.senales.filter((s) => s.lado === lado), app.porClave))
}
for (const tipo of ['tendencia', 'rango']) {
  fila(`  solo ${tipo}`, medir(app.senales.filter((s) => s.tipo === tipo), app.porClave))
}
console.log(RAYA)
console.log('"por 1R" = cuánto se gana o se pierde por cada unidad de riesgo.')
console.log('Es LA columna: positivo gana, negativo pierde. Los pips engañan.')

// --------------------------------------------------------------------------
// 2. Geometrías. En swing ninguna propuesta le ganó a la de la app, pero la
//    NEUTRA fue la que destapó que las compras no tenían ninguna ventaja: con
//    la geometría de la app parecían acertar el 58% y con la neutra salieron
//    al 50% pelado.
// --------------------------------------------------------------------------

console.log('')
console.log('GEOMETRÍA DEL STOP Y EL OBJETIVO')
console.log('Mismas señales en todas. Solo cambia dónde van los niveles.')
console.log('')
console.log(`geometría${CAB.slice(9)}`)
console.log(RAYA)
const porGeometria = []
for (const [nombre, geo] of GEOMETRIAS) {
  const r = correr({ geometria: geo })
  const m = medir(r.senales, r.porClave)
  fila(nombre, m)
  porGeometria.push({ nombre, r, m })
}
console.log(RAYA)

// --------------------------------------------------------------------------
// 3. Con la geometría NEUTRA, ¿hay información en algún sitio?
//
//    Con 1 a 1 el resultado depende solo de acertar la dirección: por encima
//    del 50% hay señal, por debajo hay señal con el signo cambiado, y en el
//    50% no hay nada. Es la pregunta de fondo de todo el proyecto.
// --------------------------------------------------------------------------

const neutra = correr({ geometria: simetrica })
const neutraInv = correr({ geometria: simetrica, invertirVentas: true })

console.log('')
console.log('CON LA REGLA DE MEDIR NEUTRA: ¿HAY INFORMACIÓN?')
console.log('Con 1 a 1, más del 50% es señal, menos del 50% es señal al revés,')
console.log('y el 50% clavado es una moneda al aire.')
console.log('')
console.log(`qué se hizo${CAB.slice(11)}`)
console.log(RAYA)
fila('COMPRAS del barrido', medir(neutra.senales.filter((s) => s.lado === 'COMPRA'), neutra.porClave))
fila('VENTAS del barrido', medir(neutra.senales.filter((s) => s.lado === 'VENTA'), neutra.porClave))
fila(
  'COMPRAR lo que manda vender (al revés)',
  medir(neutraInv.senales.filter((s) => s.ladoOriginal === 'VENTA'), neutraInv.porClave)
)
fila('Solo las de RANGO', medir(neutra.senales.filter((s) => s.tipo === 'rango'), neutra.porClave))
fila('Solo las de TENDENCIA', medir(neutra.senales.filter((s) => s.tipo === 'tendencia'), neutra.porClave))
console.log(RAYA)

// --------------------------------------------------------------------------
// 4. El RSI. En el historial real, cinco de las seis señales perdedoras eran
//    compras con el RSI entre 77 y 86: comprando en el techo. El RSI se
//    calcula y se enseña, pero no filtra nada. Aquí se ve si filtrarlo sirve.
//    Se mira con la geometría NEUTRA, para que no lo tape el maquillaje.
// --------------------------------------------------------------------------

console.log('')
console.log('¿IMPORTA EL RSI AL ENTRAR? (con regla de medir neutra)')
console.log('')
console.log(`tramo${CAB.slice(5)}`)
console.log(RAYA)
const TRAMOS = [
  ['COMPRA con RSI > 70 (estirado)', (s) => s.lado === 'COMPRA' && s.rsi > 70],
  ['COMPRA con RSI 50-70', (s) => s.lado === 'COMPRA' && s.rsi > 50 && s.rsi <= 70],
  ['COMPRA con RSI ≤ 50 (retroceso)', (s) => s.lado === 'COMPRA' && s.rsi <= 50],
  ['VENTA con RSI < 30 (estirado)', (s) => s.lado === 'VENTA' && s.rsi < 30],
  ['VENTA con RSI 30-50', (s) => s.lado === 'VENTA' && s.rsi >= 30 && s.rsi < 50],
  ['VENTA con RSI ≥ 50 (retroceso)', (s) => s.lado === 'VENTA' && s.rsi >= 50],
]
for (const [nombre, f] of TRAMOS) fila(nombre, medir(neutra.senales.filter(f), neutra.porClave))
console.log(RAYA)

// --------------------------------------------------------------------------
// 5. El ADX. Intradía sí lo tiene (swing no). Aquí se ve si el umbral está en
//    el sitio correcto: se trocean las señales de tendencia por tramo de ADX.
//
//    ⚠️ Se trocea `sinFiltroAdx`, NO `neutra`. Desde que la app exige ADX ≥ 35,
//    `neutra` ya no contiene ni una sola señal por debajo de 35, así que los
//    dos primeros tramos saldrían vacíos y parecería que ahí no hay nada que
//    medir — cuando lo que pasa es que la app ya las descartó. Para juzgar un
//    filtro hay que mirar lo que el filtro tira, no solo lo que deja pasar.
// --------------------------------------------------------------------------

const sinFiltroAdx = correr({ geometria: simetrica, vista: { adxMin: 0 } })

console.log('')
console.log('¿SIRVE EL ADX? (tendencia, con regla de medir neutra)')
console.log('Sin el filtro puesto, para poder ver también lo que hoy se descarta.')
console.log('')
console.log(`tramo${CAB.slice(5)}`)
console.log(RAYA)
const soloTend = sinFiltroAdx.senales.filter((s) => s.tipo === 'tendencia')
for (const [nombre, f] of [
  ['ADX < 20 (sin tendencia)', (s) => s.adx < 20],
  ['ADX 20-25 (tendencia floja)', (s) => s.adx >= 20 && s.adx < 25],
  ['ADX 25-35', (s) => s.adx >= 25 && s.adx < 35],
  ['ADX ≥ 35 (tendencia fuerte) ← lo que da la app hoy', (s) => s.adx >= 35],
]) {
  fila(nombre, medir(soloTend.filter(f), sinFiltroAdx.porClave))
}
console.log(RAYA)

// --------------------------------------------------------------------------
// 6. LAS TRES COSAS JUNTAS.
//
//    Por separado apuntaron a lo mismo: entrar en retroceso y no estirado
//    (y el patrón salió en los DOS lados por separado, que es lo que lo hace
//    creíble), subir el ADX, y que las de rango son las únicas positivas.
//    Aquí se ve si juntas suman o se estorban.
//
//    Todo con la regla de medir neutra, para que no lo tape la geometría.
// --------------------------------------------------------------------------

// Entrar cuando el precio ya se retrocedió, no cuando está estirado. Es la
// idea que trajo Néstor en su propuesta (EMA200 + RSI bajo) y la única que
// aparece sola en los dos lados.
const enRetroceso = (s) => (s.lado === 'COMPRA' ? s.rsi <= 50 : s.rsi >= 50)

console.log('')
console.log('LAS TRES COSAS JUNTAS (con regla de medir neutra)')
console.log('')
console.log(`combinación${CAB.slice(11)}`)
console.log(RAYA)

// El ADX ≥ 35 ya ES la app desde el 2026-08-12, así que `neutra` lo trae
// puesto. Lo que hace falta ahora para comparar es lo contrario: cómo era con
// el umbral viejo. Solo se mueve el listón de TENDENCIA; el de rango se queda
// donde está, o las filas mezclarían dos cambios distintos.
const conAdx20 = correr({ geometria: simetrica, vista: { adxMin: 20 } })
const COMBIS = [
  ['C0. La app de hoy (ADX ≥ 35)', neutra, () => true],
  ['C1. + entrar solo en retroceso', neutra, enRetroceso],
  ['C2. Solo las de rango', neutra, (s) => s.tipo === 'rango'],
  ['C3. Solo las de tendencia', neutra, (s) => s.tipo === 'tendencia'],
  ['C4. Como estaba antes (ADX ≥ 20)', conAdx20, () => true],
  ['C5. Antes + retroceso', conAdx20, enRetroceso],
]
for (const [nombre, fuente, f] of COMBIS) fila(nombre, medir(fuente.senales.filter(f), fuente.porClave))
console.log(RAYA)

console.log('')
console.log('LO MISMO, DESCONTANDO EL SPREAD DEL BRÓKER')
// Antes aquí se imprimía UN número, porque se cobraba 1 pip igual a los 18
// pares. Ya no: cada par tiene el suyo (ver lib/costes.mjs), así que se enseña
// el rango — un número único sería mentira para casi todos.
{
  const v = Object.values(SPREAD_PIPS)
  const medio = v.reduce((a, x) => a + x, 0) / v.length
  console.log(`(de ${Math.min(...v)} a ${Math.max(...v)} pips según el par, ${medio.toFixed(1)} de media,`)
  console.log(' se gane o se pierda. El swap va aparte, en la tabla siguiente.)')
}
console.log('')
console.log(`combinación${CAB.slice(11)}`)
console.log(RAYA)
for (const [nombre, fuente, f] of COMBIS) {
  fila(nombre, medir(fuente.senales.filter(f), fuente.porClave, { conSpread: true }))
}
console.log(RAYA)
console.log('Esta es la tabla que decide. Lo de arriba es teoría; esto es lo que')
console.log('quedaría en la cuenta.')

// --------------------------------------------------------------------------
// 7. ¿ERA MEJOR LA APP ANTES DEL ADX?
//
//    Lo preguntó Néstor por su recuerdo de cómo iba antes. El ADX, la
//    confirmación de 4 horas y el filtro de compresión entraron todos en el
//    mismo commit (b36abf1), así que "antes" significa sin los tres. Se miden
//    por separado para saber cuál aportó qué, en vez de quedarnos con la
//    impresión.
//
//    Ya no aparece la fila "sin la confirmación de 4 horas": esa medición dio
//    resultados IDÉNTICOS a la app entera (el veto no descartó ni una señal en
//    7 meses), así que la confirmación se quitó del código el 2026-08-12 y ya
//    no queda nada que apagar. La fila diría siempre lo mismo que la primera.
// --------------------------------------------------------------------------

console.log('')
console.log('¿ERA MEJOR ANTES DEL ADX? (con regla de medir neutra)')
console.log('El ADX y la compresión entraron juntos (con la confirmación de 4')
console.log('horas, que resultó no hacer nada y ya se quitó de la app).')
console.log('')
console.log(`versión${CAB.slice(7)}`)
console.log(RAYA)
// Cada fila cambia UNA cosa. `adxMin: 0` quita el filtro a las de tendencia
// y deja las de rango como están: antes, al compartir umbral, ponerlo en 0
// borraba TODAS las de rango y el resultado no medía lo que decía medir.
const ANTES = [
  ['Como está hoy (ADX ≥ 35)', {}],
  ['Con el ADX viejo (≥ 20)', { adxMin: 20 }],
  ['Sin el filtro de ADX en tendencia', { adxMin: 0 }],
  ['Sin el filtro de compresión', { compresionMin: 0 }],
  ['Sin ninguno de los dos (como antes de aquel cambio)', { adxMin: 0, compresionMin: 0 }],
  ['  …y de esas, solo las de tendencia', { adxMin: 0, compresionMin: 0, soloTipo: 'tendencia' }],
]
for (const [nombre, opciones] of ANTES) {
  const { soloTipo, ...vista } = opciones
  const r = Object.keys(vista).length ? correr({ geometria: simetrica, vista }) : neutra
  const lista = soloTipo ? r.senales.filter((s) => s.tipo === soloTipo) : r.senales
  fila(nombre, medir(lista, r.porClave))
}

// La comparación limpia de la pregunta de Néstor: SOLO las de tendencia, con
// y sin el filtro de ADX. Es lo único que responde "¿ayudó el ADX?" sin que se
// cuele el efecto de las de rango.
console.log('')
console.log('  Y la comparación limpia, solo señales de TENDENCIA:')
for (const [nombre, vista] of [
  ['sin filtro de ADX', { adxMin: 0 }],
  ['con ADX ≥ 20 (el de antes)', { adxMin: 20 }],
  ['con ADX ≥ 35 (hoy)', {}],
]) {
  const r = Object.keys(vista).length ? correr({ geometria: simetrica, vista }) : neutra
  const m = medir(r.senales.filter((s) => s.tipo === 'tendencia'), r.porClave)
  const ac = m.acierto === null ? '  — ' : (m.acierto.toFixed(0) + '%').padStart(4)
  const pr = m.porRiesgo === null ? '—' : (m.porRiesgo >= 0 ? '+' : '') + m.porRiesgo.toFixed(2)
  console.log(`  ${nombre.padEnd(26)} ${String(m.total).padStart(5)} ops   acierto ${ac}   por 1R ${pr.padStart(6)}`)
}
console.log(RAYA)

// --------------------------------------------------------------------------
// 9. EL BARRIDO DEL ADX, CON LA COLUMNA QUE ME FALTÓ.
//
// El 2026-08-12 subí el ADX de 20 a 35 porque medí que acertaba más. Y era
// verdad. Pero medí SOLO cuánto acierta, no cuántas señales deja vivas — y el
// resultado fue una app que en una semana no dio ni una sola señal. Elegí bien
// según lo que medí, y medí lo que no era.
//
// Un filtro tiene DOS efectos y hay que mirar los dos a la vez:
//   · sube el acierto (para eso está),
//   · y baja cuántas veces la app habla (ese es su precio).
//
// Una app que acierta el 60% y habla una vez al mes no le sirve a nadie: no
// hay con qué componer un resultado, y el usuario deja de abrirla. Por eso
// aquí va "señales/mes" al lado del acierto, y la decisión se toma mirando
// las dos columnas juntas.
//
// El "por 1R" va CON SPREAD, porque es lo que quedaría en la cuenta.
// --------------------------------------------------------------------------

const MESES = (() => {
  const ms = new Date(barras.at(-1) + 'Z') - new Date(barras[VENTANA] + 'Z')
  return Math.max(1, ms / (1000 * 60 * 60 * 24 * 30.44))
})()

console.log('')
console.log('EL BARRIDO DEL ADX: ACIERTO **Y** CUÁNTAS SEÑALES DEJA')
console.log(`Sobre ${MESES.toFixed(1)} meses medidos. "por 1R" con spread descontado.`)
console.log('Un umbral que acierta mucho pero no habla nunca no sirve.')
console.log('')
console.log('umbral            tendencia: ops  señales/mes  acierto   por 1R     TODAS: ops  señales/mes')
console.log(RAYA)
for (const u of [0, 15, 20, 25, 28, 30, 32, 35, 40]) {
  const r = correr({ geometria: simetrica, vista: { adxMin: u } })
  const tend = r.senales.filter((s) => s.tipo === 'tendencia')
  const m = medir(tend, r.porClave, { conSpread: true })
  const mt = medir(r.senales, r.porClave, { conSpread: true })
  const ac = m.acierto === null ? '  — ' : (m.acierto.toFixed(0) + '%').padStart(4)
  const pr = (m.porRiesgo === null ? '—' : (m.porRiesgo >= 0 ? '+' : '') + m.porRiesgo.toFixed(2)).padStart(6)
  const marca = u === 35 ? '  ← hoy' : u === 20 ? '  ← antes' : ''
  console.log(
    `ADX >= ${String(u).padStart(2)}${' '.repeat(10)} ${String(tend.length).padStart(5)}   ` +
      `${(tend.length / MESES).toFixed(1).padStart(6)}      ${ac}   ${pr}   ` +
      `${String(r.senales.length).padStart(6)}   ${(r.senales.length / MESES).toFixed(1).padStart(6)}${marca}`
  )
}
console.log(RAYA)
console.log('Lo que hay que buscar: el umbral más alto que TODAVÍA deje suficientes')
console.log('señales para que la app sirva. No el que más acierte.')
console.log('Ojo: quitar un filtro AÑADE operaciones, así que aquí el número de')
console.log('operaciones sí cambia y hay que mirarlo junto con el acierto.')

// --------------------------------------------------------------------------
// 8. LA SEÑAL NUEVA: ENTRAR EN RETROCESO.
//
//    Tendencia fuerte (ADX ≥ 35, medias ordenadas) pero el precio se devolvió
//    hasta la EMA9 sin romper la EMA21. La app NO la da todavía: está apagada
//    tras `incluirRetrocesos` justamente para poder medirla antes de que
//    llegue a nadie.
//
//    Por qué merecía probarse: troceando por RSI, entrar retrocedido salía
//    mejor que entrar estirado, y salía en los DOS lados por separado. Pero
//    ese troceo era sobre las señales que la app YA daba; esto de aquí es la
//    regla escrita de frente, que es distinto y puede salir peor.
//
//    Se mide con la geometría neutra (el veredicto de si acierta) y también
//    con la de la app (lo que quedaría en la cuenta), y descontando spread.
// --------------------------------------------------------------------------

const conRetro = correr({ geometria: simetrica, vista: { incluirRetrocesos: true } })
const retro = conRetro.senales.filter((s) => s.tipo === 'retroceso')

console.log('')
console.log('LA SEÑAL NUEVA: ENTRAR EN RETROCESO (con regla de medir neutra)')
console.log('Hoy la app NO la da. Esto es para decidir si debería.')
console.log('')
console.log(`qué se midió${CAB.slice(12)}`)
console.log(RAYA)
fila('Retrocesos: todos', medir(retro, conRetro.porClave))
fila('  solo COMPRA', medir(retro.filter((s) => s.lado === 'COMPRA'), conRetro.porClave))
fila('  solo VENTA', medir(retro.filter((s) => s.lado === 'VENTA'), conRetro.porClave))
fila('Retrocesos, descontando el spread', medir(retro, conRetro.porClave, { conSpread: true }))
console.log(RAYA)
console.log('Para comparar, con las mismas velas:')
fila('  las de TENDENCIA de la app', medir(neutra.senales.filter((s) => s.tipo === 'tendencia'), neutra.porClave))
fila('  las de RANGO de la app', medir(neutra.senales.filter((s) => s.tipo === 'rango'), neutra.porClave))
console.log(RAYA)

// Y con la geometría de verdad, que es lo que se apuntaría en el diario.
const conRetroApp = correr({ vista: { incluirRetrocesos: true } })
const retroApp = conRetroApp.senales.filter((s) => s.tipo === 'retroceso')
console.log('Con la geometría de la app (stop al otro lado de la EMA21):')
fila('  retrocesos', medir(retroApp, conRetroApp.porClave))
fila('  retrocesos con spread', medir(retroApp, conRetroApp.porClave, { conSpread: true }))
console.log(RAYA)
console.log('Y la comprobación de que no se pisan con las que ya existen:')
{
  const sin = new Set(neutra.senales.map((s) => `${s.id}@${s.vistoEl}`))
  const repetidas = retro.filter((s) => sin.has(`${s.id}@${s.vistoEl}`)).length
  const pares = new Set(retro.map((s) => s.par))
  console.log(`  ${retro.length} retrocesos, ${repetidas} repetidos de otra lista, en ${pares.size} pares distintos`)
}
console.log(RAYA)

// ⚠️ EL RETROCESO, PAGANDO LAS NOCHES. ESTA TABLA FALTABA, Y ES LA QUE DECIDE.
//
// El retroceso es la ÚNICA regla candidata a salir de la sombra, y hasta ahora
// se medía con spread pero SIN swap — mientras que el barrido de swap se
// aplicaba solo a las señales de la app.
//
// Y aquí el swap no es un detalle: de las 42 operaciones reales ya resueltas,
// 22 (el 52%) cruzaron al menos una noche, pese a que la app se llama
// Intradía. Decidir si esta regla se enciende con un número que no cuenta eso
// sería decidir con la cuenta a medias.
{
  console.log('')
  console.log('EL RETROCESO, PERO PAGANDO LAS NOCHES')
  const b = barridoSwap(retro, conRetro.porClave)
  if (!b.total) {
    console.log('  (sin operaciones resueltas)')
  } else {
    console.log(
      `${b.total} ops · ${b.cruzaron} cruzaron alguna noche ` +
        `(${Math.round((b.cruzaron / b.total) * 100)}%), ${b.mediaNoches.toFixed(2)} de media`
    )
    console.log('')
    console.log('   swap/noche      acierto   por 1R   coste medio')
    const sinNada = medir(retro, conRetro.porClave)
    console.log(
      `   sin costes       ${(sinNada.acierto ?? 0).toFixed(0).padStart(5)}%` +
        `  ${(sinNada.porRiesgo ?? 0).toFixed(3).padStart(7)}         —`
    )
    for (const { nivel, medicion: m, costeMedio } of b.filas) {
      const etiqueta = nivel === 0 ? 'solo spread' : `+ ${nivel.toFixed(2)} pips`
      console.log(
        `   ${etiqueta.padEnd(15)} ${(m.acierto ?? 0).toFixed(0).padStart(5)}%` +
          `  ${(m.porRiesgo ?? 0).toFixed(3).padStart(7)}   ${costeMedio.toFixed(1).padStart(6)} pips`
      )
    }
    // La pregunta práctica no es "cuánto gana" sino "cuánto aguanta".
    const ultimoBueno = [...b.filas].reverse().find((f) => (f.medicion.porRiesgo ?? -1) > 0)
    if (!ultimoBueno) {
      console.log('   → PIERDE ya solo con el spread. El swap ni hace falta.')
    } else if (ultimoBueno.nivel === b.filas.at(-1).nivel) {
      console.log(`   → aguanta hasta ${ultimoBueno.nivel} pips de swap por noche, el nivel más caro que se mide.`)
    } else {
      console.log(`   → deja de ganar por encima de ${ultimoBueno.nivel} pips de swap por noche.`)
    }
  }
  console.log(RAYA)
}

// --------------------------------------------------------------------------
// 10. EL ROMPIMIENTO DEL RANGO DE APERTURA.
//
// La única regla de aquí que NO es la app. Todo lo demás que se mide en este
// archivo son variantes de la misma idea —mirar qué divisa está fuerte y
// perseguirla—, y sobre 35 meses esa idea da 46% en todos sus umbrales. Medir
// una variante más no iba a cambiar eso.
//
// El rompimiento pregunta otra cosa: por dónde sale el precio cuando entra el
// volumen de la apertura de Londres o de Nueva York. Es la herramienta estándar
// del intradía y la app nunca la ha tenido.
//
// Casi todo con la geometría NEUTRA (1:1) a propósito. Con el objetivo cerca
// del stop el acierto sube solo, y en swing eso ya escondió una vez un 50%
// pelado detrás de un 58% aparente. Con 1 a 1, lo único que puede subir el
// número es acertar la dirección.
//
// El "por 1R" va CON SPREAD, porque es lo que quedaría en la cuenta.
// --------------------------------------------------------------------------

console.log('')
console.log('EL ROMPIMIENTO DEL RANGO DE APERTURA (no es la app: regla nueva)')
console.log('Geometría neutra 1:1 y spread descontado. 50% es la moneda al aire.')
console.log('')
console.log(CAB)
console.log(RAYA)

const aperturas = []
for (const modo of ['cierre', 'toque']) {
  for (const horasRango of [1, 2, 3]) {
    const ss = senalesApertura(completo, { modo, horasRango, horasVentana: 4, neutra: true })
    const { resultados } = resolver(ss, completo)
    const porClave = new Map(resultados.map((r) => [r.clave, r]))
    aperturas.push({ modo, horasRango, ss, porClave })
    fila(
      `${modo === 'cierre' ? 'cierra fuera' : 'toca el borde'}, rango de ${horasRango}h`,
      medir(ss, porClave, { conSpread: true })
    )
  }
}
console.log(RAYA)

// El mejor de los seis, desglosado. Se elige por resultado por unidad de riesgo
// y no por acierto: un 52% con pocas operaciones vale menos que un 50% con
// muchas.
const mejor = aperturas.reduce((a, b) =>
  (medir(b.ss, b.porClave, { conSpread: true }).porRiesgo ?? -9) >
  (medir(a.ss, a.porClave, { conSpread: true }).porRiesgo ?? -9)
    ? b
    : a
)

console.log('')
console.log(`DESGLOSE DEL MEJOR: ${mejor.modo}, rango de ${mejor.horasRango}h`)
console.log(CAB)
console.log(RAYA)
for (const [nombre, filtro] of [
  ['Londres', (s) => s.sesion === 'sesion.londres'],
  ['Nueva York', (s) => s.sesion === 'sesion.nuevaYork'],
  ['solo compras', (s) => s.lado === 'COMPRA'],
  ['solo ventas', (s) => s.lado === 'VENTA'],
  ['solo pares con dólar (exactos)', (s) => s.par.includes('USD')],
  ['solo cruces (aproximados)', (s) => !s.par.includes('USD')],
]) {
  fila(nombre, medir(mejor.ss.filter(filtro), mejor.porClave, { conSpread: true }))
}
console.log(RAYA)

// ¿Y si el objetivo fuera más ambicioso? Aquí ya NO es 1:1, así que el acierto
// baja por construcción y lo único comparable entre filas es el "por 1R".
console.log('')
console.log('EL MISMO, CON OBJETIVOS MÁS LEJOS (ya no es 1:1 — mirar solo "por 1R")')
console.log(CAB)
console.log(RAYA)
for (const objetivoX of [1, 1.5, 2, 3]) {
  const ss = senalesApertura(completo, {
    modo: mejor.modo,
    horasRango: mejor.horasRango,
    horasVentana: 4,
    objetivoX,
  })
  const { resultados } = resolver(ss, completo)
  fila(
    `objetivo ${objetivoX}× el ancho, stop al otro borde`,
    medir(ss, new Map(resultados.map((r) => [r.clave, r])), { conSpread: true })
  )
}
console.log(RAYA)

// ¿Filtrar los rangos estrechos ayuda? Un rango de dos pips no marca dónde
// están las órdenes de nadie.
console.log('')
console.log('¿AYUDA EXIGIR QUE EL RANGO SEA ANCHO? (neutra 1:1, con spread)')
console.log(CAB)
console.log(RAYA)
for (const minAncho of [null, 1.2, 1.5, 2]) {
  const ss = senalesApertura(completo, {
    modo: mejor.modo,
    horasRango: mejor.horasRango,
    horasVentana: 4,
    minAncho,
    neutra: true,
  })
  const { resultados } = resolver(ss, completo)
  fila(
    minAncho === null ? 'sin filtro' : `rango ≥ ${minAncho}× la anchura media del día previo`,
    medir(ss, new Map(resultados.map((r) => [r.clave, r])), { conSpread: true })
  )
}
console.log(RAYA)

// --------------------------------------------------------------------------
// 11. EL FILTRO DE "NO PERSEGUIR" (RSI), MEDIDO DE FRENTE.
//
// POR QUÉ ESTE Y NO OTRA REGLA NUEVA
//
// Es lo ÚNICO que ha salido positivo en esta app, y ha salido tres veces por
// caminos distintos: en el historial real de 37 operaciones (entrando con el
// RSI extendido, 12% de acierto y −0,74; entrando en zona sana, 50% y +0,22),
// en el troceo de la medición de 3 años, y en el historial viejo de 11.
//
// Y no es una regla nueva: es un filtro sobre las que la app YA da. Hoy el RSI
// se enseña en pantalla pero no rechaza nada.
//
// LA TRAMPA QUE HAY QUE ESQUIVAR, Y CÓMO
//
// Las tres veces anteriores fueron TROCEOS A POSTERIORI: partir los resultados
// después de verlos. Con suficientes cortes siempre aparece uno que separa las
// buenas de las malas en los datos que ya tienes, y después no sirve de nada.
// Volver a trocear lo mismo no confirma nada: da el mismo número otra vez.
//
// Tres cosas lo ponen a prueba de verdad:
//
//   1. EL FILTRO ES DE VERDAD. Va dentro de `clasificar`, o sea que la app
//      rechaza la señal antes de darla. No se borran resultados al final.
//   2. BARRIDO DE UMBRALES. Si solo funciona justo en 70 y no en 65 ni en 75,
//      es casualidad. Una regla de mercado de verdad no depende de un número
//      exacto.
//   3. LAS DOS MITADES DEL TIEMPO POR SEPARADO. Es la prueba que el ADX no
//      pasó: allí la "mejora" existía en 7 meses y desaparecía en 35. Un
//      filtro que solo funciona en una mitad no es un filtro, es una
//      coincidencia de esa mitad.
//
// Y la columna de señales/mes al lado, porque el error del ADX fue medir solo
// el acierto: un filtro que deja la app muda no sirve aunque acierte.
// --------------------------------------------------------------------------

const mitad = barras[Math.floor((VENTANA + barras.length) / 2)]
const MESES_MITAD = MESES / 2

console.log('')
console.log('EL FILTRO DE "NO PERSEGUIR" (RSI), MEDIDO DE FRENTE')
console.log('Solo señales de TENDENCIA, geometría neutra 1:1, spread descontado.')
console.log(`Las dos mitades se parten en ${mitad}.`)
console.log('')
console.log('umbral               ops  señ/mes  acierto   por 1R  │  1ª mitad  │  2ª mitad')
console.log(RAYA)
for (const u of [null, 80, 75, 70, 65, 60]) {
  const r = correr({ geometria: simetrica, vista: { rsiMax: u } })
  const tend = r.senales.filter((s) => s.tipo === 'tendencia')
  const m = medir(tend, r.porClave, { conSpread: true })
  const m1 = medir(tend.filter((s) => s.vistoEl < mitad), r.porClave, { conSpread: true })
  const m2 = medir(tend.filter((s) => s.vistoEl >= mitad), r.porClave, { conSpread: true })
  const pr = (x) => (x === null ? '   —  ' : ((x >= 0 ? '+' : '') + x.toFixed(2)).padStart(6))
  const ac = (x) => (x === null ? '  — ' : (x.toFixed(0) + '%').padStart(4))
  console.log(
    `${(u === null ? 'sin filtro (hoy)' : `rechaza si RSI ≥ ${u}`).padEnd(20)} ` +
      `${String(tend.length).padStart(5)}  ${(tend.length / MESES).toFixed(1).padStart(6)}    ` +
      `${ac(m.acierto)}   ${pr(m.porRiesgo)}  │ ${ac(m1.acierto)} ${pr(m1.porRiesgo)} │ ` +
      `${ac(m2.acierto)} ${pr(m2.porRiesgo)}   (${(m1.total / MESES_MITAD).toFixed(0)}/${(m2.total / MESES_MITAD).toFixed(0)} al mes)`
  )
}
console.log(RAYA)
console.log('Qué tiene que pasar para creerlo: que mejore en VARIOS umbrales')
console.log('seguidos, en las DOS mitades, y que siga dejando señales de sobra.')
console.log('Si solo mejora en uno, o solo en una mitad, es una coincidencia de')
console.log('estos meses — exactamente lo que le pasó al ADX en 35.')

// Y con la geometría de la app, que es lo que de verdad se le daría a nadie.
console.log('')
console.log('EL MISMO, PERO CON LA GEOMETRÍA REAL DE LA APP (con spread)')
console.log(CAB)
console.log(RAYA)
for (const u of [null, 75, 70, 65]) {
  const r = correr({ vista: { rsiMax: u } })
  const tend = r.senales.filter((s) => s.tipo === 'tendencia')
  fila(u === null ? 'sin filtro (hoy)' : `rechaza si RSI ≥ ${u}`, medir(tend, r.porClave, { conSpread: true }))
}
console.log(RAYA)


// --------------------------------------------------------------------------
// ¿CUÁNTO SE COME EL SWAP?
//
// Parecía razonable ignorarlo —la app se llama Intradía y su idea es abrir y
// cerrar el mismo día— pero eso es la INTENCIÓN, no lo que pasa. Más de la
// mitad de las operaciones reales se quedan abiertas cuando el bróker pasa el
// corte y cobra swap.
//
// No se elige un número de swap porque no se sabe: depende del diferencial de
// tipos de cada momento y del margen de cada bróker. Se mide a varios niveles
// y se enseña a partir de cuál cambia la conclusión.
// --------------------------------------------------------------------------

console.log('')
console.log('══════════════════════════════════════════════════════════════════')
console.log('¿CUÁNTO SE COME EL SWAP? (mismas señales, regla neutra 1:1)')
console.log('══════════════════════════════════════════════════════════════════')
console.log('')

{
  // Se reutiliza la corrida neutra que ya está calculada arriba. Recalcularla
  // aquí sería repetir el barrido entero sobre miles de velas para obtener
  // exactamente las mismas señales.
  const base = neutra
  const { total, cruzaron, mediaNoches, filas } = barridoSwap(base.senales, base.porClave)

  console.log(`De ${total} operaciones resueltas, ${cruzaron} cruzaron al menos una noche`)
  console.log(`(${total ? Math.round((cruzaron / total) * 100) : 0}%), con una media de ${mediaNoches.toFixed(2)} noches cada una.`)
  console.log('')
  console.log('Si ese porcentaje fuera casi cero, ignorar el swap estaría bien.')
  console.log('No lo es.')
  console.log('')

  console.log('swap/noche      ops  acierto   por 1R   coste medio')
  console.log('─────────────────────────────────────────────────────')
  const sinCostes = medir(base.senales, base.porClave)
  console.log(
    `sin costes    ${String(sinCostes.total).padStart(5)}` +
      `  ${(sinCostes.acierto ?? 0).toFixed(0).padStart(5)}%` +
      `  ${(sinCostes.porRiesgo ?? 0).toFixed(3).padStart(7)}` +
      `        —`
  )
  for (const { nivel, medicion: m, costeMedio } of filas) {
    const etiqueta = nivel === 0 ? 'solo spread' : `+ ${nivel.toFixed(2)} pips`
    console.log(
      `${etiqueta.padEnd(13)} ${String(m.total).padStart(5)}` +
        `  ${(m.acierto ?? 0).toFixed(0).padStart(5)}%` +
        `  ${(m.porRiesgo ?? 0).toFixed(3).padStart(7)}` +
        `  ${total ? costeMedio.toFixed(1).padStart(6) : '     —'} pips`
    )
  }
  console.log('')
  console.log('El acierto NO cambia entre filas: los costes no mueven si el precio')
  console.log('llegó al objetivo o al stop, solo lo que queda después. Lo que hay')
  console.log('que mirar es la columna "por 1R".')
  console.log('')
  console.log('Y ojo con leerlo al revés: que el swap empeore poco NO quiere decir')
  console.log('que el sistema esté bien. Quiere decir que ya perdía antes.')
}



// --------------------------------------------------------------------------
// LA REVERSIÓN, QUE NUNCA SE HABÍA MEDIDO EN ESTA APP.
//
// POR QUÉ SE MIDE AHORA
// ---------------------
// En esta app se han medido ya cuatro familias de reglas —tendencia, rango,
// retroceso y rompimiento de apertura— y NINGUNA gana después de costes. Pero
// la reversión no estaba entre ellas, y es la única que ha dado positivo en
// todo el proyecto: en la app hermana de swing mide +0,051 por unidad de
// riesgo con spread por par y medio pip de swap.
//
// Además tiene respaldo fuera de este proyecto. La investigación sobre
// reversión en velas HORARIAS de Forex encuentra que los rebotes son
// "generalizados y altamente significativos" en las divisas más operadas, y
// —esto es lo importante aquí— que el efecto es MÁS FUERTE EN CIERTAS HORAS,
// sobre todo en el solape de Londres con Nueva York.
//
// ⚠️ NO SE HEREDA NINGÚN NÚMERO DE SWING. Allí el umbral es RSI ≤35 sobre
// velas de un día. Aquí son velas de una hora, con otras medias y otro
// horizonte, y está comprobado en este proyecto que un número que funciona en
// una app puede empeorar la otra (pasó con el filtro de RSI). Por eso el
// umbral se BARRE en vez de copiarse.
//
// La app tal cual COMPRA lo fuerte. Estas reglas hacen lo contrario.
// --------------------------------------------------------------------------

// El solape de Londres (7-16) con Nueva York (12-21): de 12 a 16 UTC. Es la
// franja que la investigación señala como la de más información.
const enSolape = (h) => h >= 12 && h < 16

const REGLAS_REVERSION = [
  ['R1. Comprar lo débil, vender lo fuerte', (p, esc, thr) => (p.dif < -thr ? 'COMPRA' : p.dif > thr ? 'VENTA' : null)],
  [
    'R2. …y solo con el RSI estirado (35/65)',
    (p, esc, thr) => (p.dif < -thr && p.rsiV <= 35 ? 'COMPRA' : p.dif > thr && p.rsiV >= 65 ? 'VENTA' : null),
  ],
  [
    'R3. …y solo lejos de la EMA21',
    (p, esc, thr) => (p.dif < -thr && p.c < p.e21 ? 'COMPRA' : p.dif > thr && p.c > p.e21 ? 'VENTA' : null),
  ],
  [
    'R4. R2 solo en el solape Londres-NY',
    (p, esc, thr, hora) =>
      !enSolape(hora) ? null : p.dif < -thr && p.rsiV <= 35 ? 'COMPRA' : p.dif > thr && p.rsiV >= 65 ? 'VENTA' : null,
  ],
  [
    'R5. CONTROL: la inversión, de frente',
    (p, esc, thr) =>
      p.dif < -thr && p.tend === 'Bajista' ? 'COMPRA' : p.dif > thr && p.tend === 'Alcista' ? 'VENTA' : null,
  ],
]

console.log('')
console.log('LA REVERSIÓN, MEDIDA AQUÍ POR PRIMERA VEZ (regla de medir neutra)')
console.log('Comprar lo que se cayó en vez de lo que subió. Es la única familia')
console.log('que ha dado positivo en el proyecto, y nunca se había probado aquí.')
console.log('')
console.log(`regla                                       ops  acierto   por 1R   CON COSTES`)
console.log(RAYA)
const revCorridas = []
for (const [nombre, regla] of REGLAS_REVERSION) {
  const r = correr({ geometria: simetrica, reglaEntrada: regla })
  revCorridas.push({ nombre, r })
  const m = medir(r.senales, r.porClave)
  const ms = medir(r.senales, r.porClave, { conSpread: true, swapPipsNoche: 0.5 })
  const num = (x) => (x === null ? '   —  ' : (x >= 0 ? '+' : '') + x.toFixed(3)).padStart(7)
  console.log(
    `${nombre.padEnd(42)} ${String(m.total).padStart(5)}  ` +
      `${m.acierto === null ? '  — ' : (m.acierto.toFixed(0) + '%').padStart(5)}  ${num(m.porRiesgo)}   ${num(ms.porRiesgo)}`
  )
}
console.log(RAYA)
console.log('"CON COSTES" = spread por par + medio pip de swap por noche.')
console.log('Para comparar, la app tal cual con la misma vara:')
{
  const m = medir(neutra.senales, neutra.porClave)
  const ms = medir(neutra.senales, neutra.porClave, { conSpread: true, swapPipsNoche: 0.5 })
  const num = (x) => (x === null ? '   —  ' : (x >= 0 ? '+' : '') + x.toFixed(3)).padStart(7)
  console.log(
    `${'   la app hoy'.padEnd(42)} ${String(m.total).padStart(5)}  ` +
      `${(m.acierto.toFixed(0) + '%').padStart(5)}  ${num(m.porRiesgo)}   ${num(ms.porRiesgo)}`
  )
}

// --------------------------------------------------------------------------
// ¿A QUÉ HORAS FUNCIONA?
//
// Esto es lo propio de intradía y no existe en swing, donde solo hay una vela
// por día. Si la investigación acierta, el efecto debería concentrarse en las
// horas de más actividad y desaparecer en las muertas.
//
// No cuesta ninguna corrida nueva: se reparten por hora las señales de R2, que
// ya están medidas.
// --------------------------------------------------------------------------

console.log('')
console.log('¿A QUÉ HORAS FUNCIONA LA REVERSIÓN? (R2, con costes)')
console.log('Si el efecto es real debería concentrarse donde hay actividad.')
console.log('')
console.log('franja horaria (UTC)              ops  acierto   por 1R')
console.log(RAYA)
{
  const r2 = revCorridas.find((x) => x.nombre.startsWith('R2'))
  const FRANJAS = [
    ['Asia (0-7)', (h) => h >= 0 && h < 7],
    ['Londres sin NY (7-12)', (h) => h >= 7 && h < 12],
    ['SOLAPE Londres-NY (12-16)', (h) => h >= 12 && h < 16],
    ['NY sin Londres (16-21)', (h) => h >= 16 && h < 21],
    ['Noche (21-24)', (h) => h >= 21],
  ]
  for (const [nombre, dentro] of FRANJAS) {
    const suyas = r2.r.senales.filter((s) => dentro(Number(String(s.vela).slice(11, 13))))
    const m = medir(suyas, r2.r.porClave, { conSpread: true, swapPipsNoche: 0.5 })
    const num = (x) => (x === null ? '   —  ' : (x >= 0 ? '+' : '') + x.toFixed(3)).padStart(7)
    console.log(
      `${nombre.padEnd(30)} ${String(m.total).padStart(5)}  ` +
        `${m.acierto === null ? '  — ' : (m.acierto.toFixed(0) + '%').padStart(5)}  ${num(m.porRiesgo)}`
    )
  }
}
console.log(RAYA)
console.log('⚠️ Con pocas operaciones en una franja, su número no significa nada.')

// --------------------------------------------------------------------------
// ¿ES REAL EL UMBRAL DEL RSI, O LO ELEGÍ YO?
//
// El 35 viene de swing, y aquí NO tiene por qué valer: son velas de una hora,
// no de un día. Si el efecto es real, los umbrales vecinos tienen que
// acompañar y el resultado debe cambiar poco a poco. Un pico solitario en un
// número es una curva ajustada a estos meses, no un descubrimiento.
// --------------------------------------------------------------------------

console.log('')
console.log('¿ES REAL EL UMBRAL, O LO ELEGÍ YO? (con costes, regla neutra)')
console.log('')
console.log('RSI ≤ (compra) / ≥ (venta)     ops  acierto   por 1R    1ª mitad   2ª mitad')
console.log(RAYA)
{
  const corte = barras[Math.floor(barras.length / 2)]
  for (const u of [25, 30, 35, 40, 45, 50]) {
    const regla = (p, esc, thr) =>
      p.dif < -thr && p.rsiV <= u ? 'COMPRA' : p.dif > thr && p.rsiV >= 100 - u ? 'VENTA' : null
    const r = correr({ geometria: simetrica, reglaEntrada: regla })
    const opciones = { conSpread: true, swapPipsNoche: 0.5 }
    const m = medir(r.senales, r.porClave, opciones)
    const m1 = medir(r.senales.filter((s) => s.vistoEl < corte), r.porClave, opciones)
    const m2 = medir(r.senales.filter((s) => s.vistoEl >= corte), r.porClave, opciones)
    const num = (x) => (x === null ? '   —  ' : (x >= 0 ? '+' : '') + x.toFixed(3)).padStart(7)
    console.log(
      `RSI ${String(u).padStart(2)} / ${String(100 - u).padEnd(2)}                  ${String(m.total).padStart(5)}  ` +
        `${m.acierto === null ? '  — ' : (m.acierto.toFixed(0) + '%').padStart(5)}  ${num(m.porRiesgo)}   ` +
        `${num(m1.porRiesgo)}   ${num(m2.porRiesgo)}`
    )
  }
}
console.log(RAYA)
console.log('Si TODA la columna es positiva y cambia suave, el efecto es real.')
console.log('Si solo destaca uno y los vecinos se caen, lo ajusté yo y no sirve.')

// --------------------------------------------------------------------------
// Y EL SWAP, que es lo que decide si una regla positiva lo sigue siendo.
// --------------------------------------------------------------------------

console.log('')
console.log('LA MEJOR DE ELLAS, PAGANDO LAS NOCHES')
for (const { nombre, r } of revCorridas) {
  const b = barridoSwap(r.senales, r.porClave)
  if (!b.total) {
    console.log(`${nombre} — sin operaciones resueltas`)
    continue
  }
  const sinNada = medir(r.senales, r.porClave)
  // Solo se detalla la que tenga alguna posibilidad: si ya pierde sin costes,
  // la tabla entera sobra y solo estorba para leer.
  if ((sinNada.porRiesgo ?? -1) <= 0) {
    console.log(`${nombre} — pierde ya SIN costes (${(sinNada.porRiesgo ?? 0).toFixed(3)}), no hace falta mirar el swap`)
    continue
  }
  console.log('')
  console.log(`${nombre}  (${b.total} ops · ${b.cruzaron} cruzaron noche, ${b.mediaNoches.toFixed(2)} de media)`)
  console.log('   swap/noche      acierto   por 1R   coste medio')
  console.log(
    `   sin costes       ${(sinNada.acierto ?? 0).toFixed(0).padStart(5)}%` +
      `  ${(sinNada.porRiesgo ?? 0).toFixed(3).padStart(7)}         —`
  )
  for (const { nivel, medicion: m, costeMedio } of b.filas) {
    const etiqueta = nivel === 0 ? 'solo spread' : `+ ${nivel.toFixed(2)} pips`
    console.log(
      `   ${etiqueta.padEnd(15)} ${(m.acierto ?? 0).toFixed(0).padStart(5)}%` +
        `  ${(m.porRiesgo ?? 0).toFixed(3).padStart(7)}   ${costeMedio.toFixed(1).padStart(6)} pips`
    )
  }
  const ultimoBueno = [...b.filas].reverse().find((f) => (f.medicion.porRiesgo ?? -1) > 0)
  if (!ultimoBueno) console.log('   → PIERDE ya solo con el spread.')
  else if (ultimoBueno.nivel === b.filas.at(-1).nivel) console.log(`   → aguanta hasta ${ultimoBueno.nivel} pips de swap, el nivel más caro que se mide.`)
  else console.log(`   → deja de ganar por encima de ${ultimoBueno.nivel} pips de swap por noche.`)
}

// --------------------------------------------------------------------------
// AFLOJAR LOS FILTROS: esta app tiene CINCO puertas en fila
//
// Lo pidió Néstor tras investigar por su cuenta, y su observación es correcta:
// los operadores con experiencia usan POCOS indicadores, y una razón es esta —
// cada condición parece razonable sola y apiladas no dejan pasar nada.
//
// Para que salga una señal aquí hay que pasar: fuerza > thr, medias alineadas,
// ADX ≥ 20, RSI dentro de 30-70, y R/B ≥ 1.5 para el aviso al celular. El
// 2026-09-04 salieron DOS reportes seguidos completamente vacíos, uno de ellos
// durante el solape de Londres con Nueva York, que es la mejor hora del día.
//
// ⚠️ AFLOJAR NO ES MEJORAR. Da más señales, y las de esta app pierden −0,10 por
// unidad de riesgo con costes. Más señales de un sistema que pierde es perder
// más rápido. Lo único que puede justificar aflojar es que la app SIRVA como
// herramienta de información sin que el resultado por operación empeore. Las
// señales/mes van al lado del "por 1R" porque la decisión es un intercambio.
// --------------------------------------------------------------------------

{
  const meses = (barras.length - VENTANA) / (24 * 21)

  console.log('')
  console.log('AFLOJAR LOS FILTROS (regla neutra 1:1, con spread)')
  console.log('Cada fila quita o relaja una pared. Las DOS columnas juntas:')
  console.log('más señales no es mejor si el resultado por operación empeora.')
  console.log('')
  console.log('qué se afloja                          ops  señ/mes  acierto   por 1R')
  console.log('─'.repeat(80))

  const linea = (nombre, r) => {
    const m = medir(r.senales, r.porClave, { conSpread: true })
    const ac = m.acierto === null ? '  — ' : (m.acierto.toFixed(0) + '%').padStart(4)
    const pr =
      m.porRiesgo === null
        ? '   —  '
        : ((m.porRiesgo >= 0 ? '+' : '') + m.porRiesgo.toFixed(2)).padStart(6)
    console.log(
      `${nombre.padEnd(34)} ${String(m.total).padStart(5)}   ${(m.total / meses).toFixed(1).padStart(5)}    ${ac}   ${pr}`
    )
  }

  console.log('· El ADX mínimo (hoy 20)')
  for (const a of [0, 10, 15, 20, 25]) {
    linea(`  ADX ≥ ${a}${a === 20 ? '  (hoy)' : ''}`, correr(simetrica, null, { adxMin: a }))
  }

  console.log('')
  console.log('· El filtro de "no perseguir" (hoy RSI 70)')
  for (const r of [null, 80, 75, 70]) {
    linea(`  ${r === null ? 'apagado' : `rechaza si RSI ≥ ${r}`}${r === 70 ? '  (hoy)' : ''}`,
      correr(simetrica, null, { rsiMax: r }))
  }

  console.log('')
  console.log('· Cuánta tendencia se exige')
  for (const [clave, nombre] of [
    ['alineada', '  medias alineadas  (hoy)'],
    ['media', '  solo precio sobre la EMA9'],
    ['ninguna', '  nada: manda solo la fuerza'],
  ]) {
    linea(nombre, correr(simetrica, null, { tendenciaMin: clave }))
  }

  console.log('')
  console.log('· Varias a la vez, que es lo que de verdad se plantea')
  for (const [nombre, vista] of [
    ['  ADX 10', { adxMin: 10 }],
    ['  ADX 10 + RSI apagado', { adxMin: 10, rsiMax: null }],
    ['  ADX 10 + RSI apagado + EMA9', { adxMin: 10, rsiMax: null, tendenciaMin: 'media' }],
    ['  todo suelto', { adxMin: 0, rsiMax: null, tendenciaMin: 'ninguna' }],
  ]) {
    linea(nombre, correr(simetrica, null, vista))
  }

  console.log('─'.repeat(80))
  console.log('Con la geometría REAL de la app:')
  console.log('filtro                                           ops   acierto      pips   por 1R')
  for (const [nombre, vista] of [
    ['tal cual (hoy)', {}],
    ['ADX 10 + RSI apagado', { adxMin: 10, rsiMax: null }],
    ['todo suelto', { adxMin: 0, rsiMax: null, tendenciaMin: 'ninguna' }],
  ]) {
    const r = correr(actual, null, vista)
    fila(nombre, medir(r.senales, r.porClave, { conSpread: true }))
  }
}

// --------------------------------------------------------------------------
// EL BARRIDO DE LIQUIDEZ (idea traída por Néstor de los métodos ICT / SMC)
//
// El precio perfora un máximo o un mínimo anterior —donde está la gente con sus
// stops— y CIERRA DE VUELTA DENTRO. Ver `lib/patrones.mjs` para el porqué de
// esta idea antes que las otras de esa lista.
//
// ⚠️ AQUÍ LOS NÚMEROS DE VELAS SIGNIFICAN OTRA COSA QUE EN SWING, y por eso NO
// se copian. Allí una vela es un día, así que «barrido de 5» es la semana
// pasada. Aquí una vela es una HORA:
//
//     n = 24  → el máximo/mínimo del DÍA anterior (el nivel del que hablan
//               los métodos ICT, y que esta app no tenía)
//     n = 8   → la sesión anterior, más o menos
//     n = 120 → la semana pasada (5 días × 24 h)
//
// Es la regla de siempre de este proyecto: lo medido en una app no vale en la
// otra, y menos cuando la unidad de tiempo es distinta.
//
// Y AQUÍ HAY UNA ADVERTENCIA PROPIA DE ESTA APP: en los CRUCES (los que no
// llevan dólar) el máximo y el mínimo se derivan de los dos pares contra el
// dólar, o sea que salen algo más amplios que los reales. Un barrido depende
// justo de si el extremo se perforó por poco, así que en los cruces este
// patrón se detecta con más ruido que en los pares con dólar. Por eso la tabla
// separa las dos cosas.
// --------------------------------------------------------------------------

{
  const corteBar = barras[Math.floor((VENTANA + barras.length) / 2)]
  const meses = (barras.length - VENTANA) / (24 * 21)

  console.log('')
  console.log('EL BARRIDO DE LIQUIDEZ (regla nueva, vara neutra 1:1, con spread)')
  console.log('El precio perfora un extremo anterior y CIERRA DE VUELTA dentro.')
  console.log(`Las dos mitades se parten en ${corteBar}.`)
  console.log('')
  console.log('regla                                  ops  señ/mes  acierto  por 1R  │ 1ª mit │ 2ª mit')
  console.log('─'.repeat(92))

  const linea = (nombre, regla, filtro = null) => {
    const r = correr(simetrica, regla)
    const sel = filtro ? r.senales.filter(filtro) : r.senales
    const m = medir(sel, r.porClave, { conSpread: true })
    const m1 = medir(sel.filter((x) => x.vistoEl < corteBar), r.porClave, { conSpread: true })
    const m2 = medir(sel.filter((x) => x.vistoEl >= corteBar), r.porClave, { conSpread: true })
    const pr = (x) => (x === null ? '   —  ' : ((x >= 0 ? '+' : '') + x.toFixed(2)).padStart(6))
    const ac = (x) => (x === null ? '  — ' : (x.toFixed(0) + '%').padStart(4))
    console.log(
      `${nombre.padEnd(36)} ${String(m.total).padStart(5)}   ${(m.total / meses).toFixed(1).padStart(5)}    ` +
        `${ac(m.acierto)}  ${pr(m.porRiesgo)} │ ${pr(m1.porRiesgo)} │ ${pr(m2.porRiesgo)}`
    )
    return r
  }

  console.log('· Cuántas HORAS atrás está el nivel que se barre')
  for (const [n, que] of [[4, 'las últimas 4 h'], [8, 'la sesión anterior'], [24, 'el DÍA anterior'], [120, 'la semana pasada']]) {
    linea(`  B${n}. barrido de ${n} h (${que})`, reglaBarrido(n))
  }

  console.log('')
  console.log('· Añadiéndole condiciones al del día anterior (24 h)')
  linea('  + fuerza relativa a favor', reglaBarrido(24, { exigirFuerza: true }))
  linea('  + RSI estirado', reglaBarrido(24, { rsiEstirado: true }))
  linea('  + las dos', reglaBarrido(24, { exigirFuerza: true, rsiEstirado: true }))

  console.log('')
  console.log('· CONTROL: la misma perforación pero cerrando FUERA (rompimiento)')
  console.log('  Si esto da lo mismo, lo que importa es tocar el nivel, no volverse.')
  for (const n of [8, 24, 120]) {
    linea(`  R${n}. rompimiento de ${n} h`, reglaBarrido(n, { volver: false }))
  }

  // Los cruces llevan máximo y mínimo derivados, así que el barrido se detecta
  // con más ruido en ellos. Si el patrón sirviera SOLO en los cruces, habría
  // que desconfiar: sería más probable que fuera un artefacto de la derivación
  // que un efecto de mercado.
  console.log('')
  console.log('· El del día anterior, separando pares con dólar de cruces')
  const conDolar = (s) => s.par.includes('USD')
  linea('  solo pares con dólar (exactos)', reglaBarrido(24), conDolar)
  linea('  solo cruces (aproximados)', reglaBarrido(24), (s) => !conDolar(s))

  console.log('─'.repeat(92))
  {
    const base = correr(simetrica)
    const m = medir(base.senales, base.porClave, { conSpread: true })
    console.log(
      `Para comparar, la app hoy:           ${String(m.total).padStart(5)}   ${(m.total / meses).toFixed(1).padStart(5)}    ` +
        `${(m.acierto ?? 0).toFixed(0).padStart(3)}%  ${((m.porRiesgo ?? 0) >= 0 ? '+' : '') + (m.porRiesgo ?? 0).toFixed(2)}`
    )
  }
}

console.log('')
console.log('Cómo leerlo, y con qué desconfianza:')
console.log(' · Con menos de ~30 operaciones el porcentaje puede ser suerte.')
console.log('   Y con 100, un 58% puede ser en realidad un 49%: el margen es')
console.log('   de casi ±10 puntos. No basta con que salga por encima de 50.')
console.log(' · Los filtros solo QUITAN operaciones, así que siempre se puede')
console.log('   encontrar uno que borre justo las malas de ESTOS meses sin que')
console.log('   sirva de nada después. Vale la pena cuando además tiene una')
console.log('   razón de mercado detrás, no solo un número bonito.')
console.log(' · Donde dice "con costes" ya van descontados spread por par y')
console.log('   swap por noche. En intradía el spread pesa mucho más que en')
console.log('   swing, porque los objetivos son más cortos.')
console.log(' · En los cruces (los que no llevan dólar) el rango se deriva de')
console.log('   los dos pares contra el dólar, así que sale algo más amplio que')
console.log('   el real. Sus números son aproximados.')
console.log('---BACKTEST-FIN---')
