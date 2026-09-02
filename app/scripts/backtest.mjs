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
import { GEOMETRIAS, simetrica } from './lib/geometrias.mjs'
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
