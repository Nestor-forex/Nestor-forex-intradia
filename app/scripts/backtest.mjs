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
import { generarSenales, VENTANA } from './lib/backtest-nucleo.mjs'
import { GEOMETRIAS, simetrica } from './lib/geometrias.mjs'
import { resolver } from './lib/resolver.mjs'

// Cuántas horas se piden. Twelve Data admite hasta 5000 y cuesta lo mismo que
// pedir 300: se cobra por consulta, no por vela. Con 5000 horas son unos 7
// meses de mercado, de los que las primeras 300 se van en la ventana.
const VELAS = 5000

const THR = 0.5
const TOP_N = 3

const { barras, rates, rangos } = await obtenerVelas(leerLlave(), { velas: VELAS })
const completo = computarBarrido(barras, rates, rangos)

// --------------------------------------------------------------------------

// Cuánto cobra el bróker por abrir y cerrar, en pips. Es un coste FIJO por
// operación, así que pesa mucho más cuanto más corto sea el objetivo — y en
// intradía los objetivos son cortos. Un sistema que gana +0,14 por unidad de
// riesgo con stops de 15 pips se lo come el spread entero.
//
// 1,5 pips es una estimación prudente para los pares mayores de una cuenta
// normal; en los cruces suele ser más. Cuando el puente de MT5 dé el spread
// real de AvaTrade se puede poner el de verdad.
const SPREAD_PIPS = 1.5

function medir(senales, porClave, { conSpread = false } = {}) {
  let ganadas = 0
  let perdidas = 0
  let pips = 0
  // Resultado en "veces el riesgo de ESA operación", acumulado una a una. Los
  // pips sueltos no sirven para comparar: 100 pips en GBP/JPY no son 100 en
  // EUR/CHF, y dos geometrías con riesgos distintos no se pueden comparar en
  // pips de ninguna manera.
  let sumaR = 0

  for (const s of senales) {
    const r = porClave.get(`${s.id}@${s.vistoEl}`)
    if (!r || (r.resultado !== 'ganada' && r.resultado !== 'perdida')) continue
    // El spread se paga SIEMPRE, se gane o se pierda, y en veces el riesgo
    // cuesta más cuanto más estrecho sea el stop.
    const coste = conSpread ? SPREAD_PIPS / s.pipRiesgo : 0
    if (r.resultado === 'ganada') {
      ganadas++
      sumaR += s.pipBeneficio / s.pipRiesgo - coste
    } else {
      perdidas++
      sumaR -= 1 + coste
    }
    pips += r.pips - (conSpread ? SPREAD_PIPS : 0)
  }

  const total = ganadas + perdidas
  return {
    total,
    ganadas,
    pips: Math.round(pips),
    acierto: total ? (ganadas / total) * 100 : null,
    porRiesgo: total ? sumaR / total : null,
  }
}

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
// 5. El ADX. Intradía sí lo tiene (swing no) y exige ADX ≥ 20 para dar señal
//    de tendencia. Aquí se ve si ese umbral está en el sitio correcto.
// --------------------------------------------------------------------------

console.log('')
console.log('¿SIRVE EL ADX? (tendencia, con regla de medir neutra)')
console.log('')
console.log(`tramo${CAB.slice(5)}`)
console.log(RAYA)
const soloTend = neutra.senales.filter((s) => s.tipo === 'tendencia')
for (const [nombre, f] of [
  ['ADX 20-25 (tendencia floja)', (s) => s.adx >= 20 && s.adx < 25],
  ['ADX 25-35', (s) => s.adx >= 25 && s.adx < 35],
  ['ADX ≥ 35 (tendencia fuerte)', (s) => s.adx >= 35],
]) {
  fila(nombre, medir(soloTend.filter(f), neutra.porClave))
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

// Solo sube el listón a las de TENDENCIA. Antes esto movía también el de
// rango sin querer, y las filas de abajo mezclaban dos cambios distintos.
const conAdx35 = correr({ geometria: simetrica, vista: { adxMin: 35 } })
const COMBIS = [
  ['C0. La app de hoy', neutra, () => true],
  ['C1. + entrar solo en retroceso', neutra, enRetroceso],
  ['C2. + ADX ≥ 35', conAdx35, () => true],
  ['C3. Retroceso Y ADX ≥ 35', conAdx35, enRetroceso],
  ['C4. Retroceso Y ADX ≥ 35, solo rango', conAdx35, (s) => enRetroceso(s) && s.tipo === 'rango'],
  ['C5. Retroceso Y ADX ≥ 35, solo tendencia', conAdx35, (s) => enRetroceso(s) && s.tipo === 'tendencia'],
]
for (const [nombre, fuente, f] of COMBIS) fila(nombre, medir(fuente.senales.filter(f), fuente.porClave))
console.log(RAYA)

console.log('')
console.log('LO MISMO, DESCONTANDO EL SPREAD DEL BRÓKER')
console.log(`(${SPREAD_PIPS} pips por operación, se gane o se pierda)`)
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
// --------------------------------------------------------------------------

console.log('')
console.log('¿ERA MEJOR ANTES DEL ADX? (con regla de medir neutra)')
console.log('El ADX, la confirmación de 4 horas y la compresión entraron juntos.')
console.log('')
console.log(`versión${CAB.slice(7)}`)
console.log(RAYA)
// Cada fila cambia UNA cosa. `adxMin: 0` quita el filtro a las de tendencia
// y deja las de rango como están: antes, al compartir umbral, ponerlo en 0
// borraba TODAS las de rango y el resultado no medía lo que decía medir.
const ANTES = [
  ['Como está hoy', {}],
  ['Sin el filtro de ADX en tendencia', { adxMin: 0 }],
  ['Sin la confirmación de 4 horas', { exigirH4: false }],
  ['Sin el filtro de compresión', { compresionMin: 0 }],
  ['Sin los tres (como antes de aquel cambio)', { adxMin: 0, exigirH4: false, compresionMin: 0 }],
  ['  …y de esas, solo las de tendencia', { adxMin: 0, exigirH4: false, compresionMin: 0, soloTipo: 'tendencia' }],
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
  ['con ADX ≥ 20 (hoy)', {}],
  ['sin filtro de ADX', { adxMin: 0 }],
  ['con ADX ≥ 35', { adxMin: 35 }],
]) {
  const r = Object.keys(vista).length ? correr({ geometria: simetrica, vista }) : neutra
  const m = medir(r.senales.filter((s) => s.tipo === 'tendencia'), r.porClave)
  const ac = m.acierto === null ? '  — ' : (m.acierto.toFixed(0) + '%').padStart(4)
  const pr = m.porRiesgo === null ? '—' : (m.porRiesgo >= 0 ? '+' : '') + m.porRiesgo.toFixed(2)
  console.log(`  ${nombre.padEnd(26)} ${String(m.total).padStart(5)} ops   acierto ${ac}   por 1R ${pr.padStart(6)}`)
}
console.log(RAYA)
console.log('Ojo: quitar un filtro AÑADE operaciones, así que aquí el número de')
console.log('operaciones sí cambia y hay que mirarlo junto con el acierto.')

console.log('')
console.log('Cómo leerlo, y con qué desconfianza:')
console.log(' · Con menos de ~30 operaciones el porcentaje puede ser suerte.')
console.log('   Y con 100, un 58% puede ser en realidad un 49%: el margen es')
console.log('   de casi ±10 puntos. No basta con que salga por encima de 50.')
console.log(' · Los filtros solo QUITAN operaciones, así que siempre se puede')
console.log('   encontrar uno que borre justo las malas de ESTOS meses sin que')
console.log('   sirva de nada después. Vale la pena cuando además tiene una')
console.log('   razón de mercado detrás, no solo un número bonito.')
console.log(' · Los pips no descuentan el spread, y en intradía el spread pesa')
console.log('   mucho más que en swing porque los objetivos son más cortos.')
console.log(' · En los cruces (los que no llevan dólar) el rango se deriva de')
console.log('   los dos pares contra el dólar, así que sale algo más amplio que')
console.log('   el real. Sus números son aproximados.')
console.log('---BACKTEST-FIN---')
