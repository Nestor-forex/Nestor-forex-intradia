// Prueba del rompimiento de apertura. Sin internet y sin claves:
//
//     node scripts/prueba-apertura.mjs
//
// Igual que con el banco de pruebas: una regla mal programada no da un error,
// da un número bonito y falso. Y un número falso da confianza, que es peor que
// no tener número.
//
// La que de verdad importa es la 3: que no mire el futuro.

import { senalesApertura, APERTURAS } from './lib/apertura.mjs'
import { computarBarrido } from '../src/lib/marketCalc.js'

let fallos = 0
const comprobar = (bien, que) => {
  console.log(`  ${bien ? '✓' : '✗'} ${que}`)
  if (!bien) fallos++
}

// --- Un mercado de mentira, pero con forma de mercado -----------------------
//
// Mismo generador que `prueba-backtest.mjs`: un paseo aleatorio con tramos de
// tendencia, determinista, en velas de una hora. Números al azar puros no
// darían rupturas y la prueba pasaría sin haber probado nada.
//
// Aquí hacen falta MUCHAS más horas que allí: cada día aporta como mucho dos
// sesiones, así que 700 horas serían unas 29 aperturas. Con 2500 son ~104 días
// y da para que salgan rupturas de sobra.

const CCY = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD']
const HORAS = 2500

function mercadoFalso(semilla = 11) {
  let x = semilla
  const azar = () => {
    x = (x * 1103515245 + 12345) % 2147483648
    return x / 2147483648
  }

  const barras = []
  for (let i = 0; i < HORAS; i++) {
    const d = new Date(Date.UTC(2026, 0, 1, 0) + i * 3600_000)
    barras.push(d.toISOString().slice(0, 19).replace('T', ' '))
  }

  const nivel = { EUR: 0.92, GBP: 0.79, JPY: 150, CHF: 0.88, AUD: 1.52, NZD: 1.64, CAD: 1.36 }
  const deriva = {}
  CCY.forEach((c) => (deriva[c] = (azar() - 0.5) * 0.0004))

  const rates = {}
  const rangos = {}
  barras.forEach((t, i) => {
    const fila = {}
    const filaRangos = {}
    for (const c of CCY) {
      if (i % 120 === 0) deriva[c] = (azar() - 0.5) * 0.0004
      nivel[c] *= 1 + deriva[c] + (azar() - 0.5) * 0.0015
      fila[c] = nivel[c]
      const mecha = nivel[c] * 0.0012 * azar()
      filaRangos[c] = { h: nivel[c] + mecha, l: nivel[c] - mecha }
    }
    rates[t] = fila
    rangos[t] = filaRangos
  })

  return { barras, rates, rangos }
}

const { barras, rates, rangos } = mercadoFalso()
const data = computarBarrido(barras, rates, rangos)

// --- 1. Produce algo con lo que trabajar -----------------------------------

console.log('\n1. Encuentra rupturas en un mercado con forma de mercado')
const cierre = senalesApertura(data, { modo: 'cierre' })
const toque = senalesApertura(data, { modo: 'toque' })
comprobar(cierre.length > 0, `modo cierre: ${cierre.length} señales`)
comprobar(toque.length > 0, `modo toque: ${toque.length} señales`)
// El toque dispara con solo rozar el borde; el cierre exige quedarse fuera. El
// toque tiene que salir SIEMPRE al menos tantas veces como el cierre.
comprobar(toque.length >= cierre.length, `el toque dispara al menos tanto como el cierre (${toque.length} ≥ ${cierre.length})`)

console.log('\n2. Los niveles tienen sentido')
for (const [nombre, ss] of [
  ['cierre', cierre],
  ['toque', toque],
]) {
  comprobar(
    ss.every((s) => Number.isFinite(s.precio) && Number.isFinite(s.sl) && Number.isFinite(s.tp) && Number.isFinite(s.rr)),
    `${nombre}: precio, stop, objetivo y R/B son números de verdad`
  )
  comprobar(
    ss.every((s) => (s.lado === 'COMPRA' ? s.sl < s.precio && s.tp > s.precio : s.sl > s.precio && s.tp < s.precio)),
    `${nombre}: el stop y el objetivo caen del lado correcto`
  )
  comprobar(
    ss.every((s) => s.pipRiesgo >= 1 && s.pipBeneficio >= 1),
    `${nombre}: riesgo y beneficio en pips nunca salen en cero`
  )
  comprobar(
    ss.every((s) => s.tipo === 'apertura' && s.id === `${s.par}|${s.lado}|apertura`),
    `${nombre}: el identificador lleva par, lado y tipo, como el del vigía`
  )
}

// --- 3. LA IMPORTANTE: no mira el futuro -----------------------------------
//
// Si al decidir la vela k se colara un precio posterior, las señales del
// principio cambiarían al añadir velas del final. Se corre sobre medio mercado
// y sobre el mercado entero, y el tramo común tiene que salir IDÉNTICO, hasta
// el último decimal del stop.
//
// Aquí es donde se cazaría el error más fácil de cometer: usar `par.atrAbs`
// para filtrar rangos estrechos. Ese ATR es el del FINAL de toda la serie, así
// que juzgar una sesión de hace dos años con él es mirar el futuro — y con
// media serie daría otro valor, así que esta comprobación lo canta.

console.log('\n3. No mira el futuro (lo que haría falsos todos los números)')
{
  const corte = 1800
  const mitad = computarBarrido(barras.slice(0, corte), rates, rangos)

  for (const modo of ['cierre', 'toque']) {
    for (const minAncho of [null, 1.2]) {
      const conMitad = senalesApertura(mitad, { modo, minAncho })
      const conTodo = senalesApertura(data, { modo, minAncho })
      // Solo el tramo que las dos pueden ver. La mitad no puede juzgar las
      // sesiones del borde porque le falta la ventana de ruptura, así que se
      // recorta con margen.
      const limite = barras[corte - 24]
      const a = conMitad.filter((s) => s.vistoEl < limite)
      const b = conTodo.filter((s) => s.vistoEl < limite)
      const clave = (s) => `${s.id}@${s.vistoEl}|${s.precio}|${s.sl}|${s.tp}`
      const iguales = a.length === b.length && a.every((s, i) => clave(s) === clave(b[i]))
      comprobar(
        a.length > 0 && iguales,
        `modo ${modo}${minAncho ? ' con filtro de anchura' : ''}: ${a.length} señales idénticas con media serie y con la serie entera`
      )
    }
  }
}

// --- 4. El filtro de anchura recorta, no inventa ---------------------------

console.log('\n4. El filtro de anchura solo quita señales, nunca añade')
{
  const sinFiltro = senalesApertura(data, { modo: 'cierre' })
  const conFiltro = senalesApertura(data, { modo: 'cierre', minAncho: 1.5 })
  const clavesSin = new Set(sinFiltro.map((s) => `${s.id}@${s.vistoEl}`))
  comprobar(conFiltro.length < sinFiltro.length, `recorta (${sinFiltro.length} → ${conFiltro.length})`)
  comprobar(
    conFiltro.every((s) => clavesSin.has(`${s.id}@${s.vistoEl}`)),
    'y todas las que deja ya estaban sin el filtro'
  )
}

// --- 5. Una sola operación por par y por sesión ----------------------------

console.log('\n5. Una sola operación por par y por sesión')
{
  const vistas = new Set()
  let repetidas = 0
  for (const s of toque) {
    // Día + sesión + par. Si el mismo par entrara dos veces en la misma
    // apertura, serían dos operaciones donde debería haber una.
    const k = `${s.vistoEl.slice(0, 10)}|${s.sesion}|${s.par}`
    if (vistas.has(k)) repetidas++
    vistas.add(k)
  }
  comprobar(repetidas === 0, `ninguna sesión repite par (${vistas.size} operaciones distintas)`)
}

// --- 6. La vara de medir neutra es de verdad 1:1 ---------------------------
//
// Es la comprobación que hace que el número final signifique algo. Con stop y
// objetivo a la MISMA distancia, el resultado depende solo de acertar la
// dirección: no se puede inflar el acierto poniendo el objetivo cerca.

console.log('\n6. La vara de medir neutra es exactamente 1:1')
{
  const n = senalesApertura(data, { modo: 'cierre', neutra: true })
  comprobar(n.length > 0, `salieron ${n.length} señales`)
  const maxError = Math.max(...n.map((s) => Math.abs(Math.abs(s.tp - s.precio) - Math.abs(s.precio - s.sl))))
  comprobar(maxError < 1e-12, `stop y objetivo a la misma distancia (mayor diferencia: ${maxError.toExponential(1)})`)
}

// --- 7. Solo entra en las aperturas de Londres y Nueva York ---------------

console.log('\n7. Solo opera las dos aperturas que mueven el día')
{
  comprobar(APERTURAS.length === 2, `son 2 aperturas: ${APERTURAS.map((a) => `${a.clave} a las ${a.hora}:00 UTC`).join(', ')}`)
  const horasRango = 2
  const horasVentana = 4
  // La ruptura solo puede ocurrir entre el fin del rango y el fin de la
  // ventana, o sea entre apertura+2 y apertura+5 inclusive.
  const permitidas = new Set()
  for (const a of APERTURAS) {
    for (let d = horasRango; d < horasRango + horasVentana; d++) permitidas.add((a.hora + d) % 24)
  }
  const horaDe = (s) => Number(s.vistoEl.slice(11, 13))
  comprobar(
    toque.every((s) => permitidas.has(horaDe(s))),
    `todas las entradas caen en la ventana de ruptura (horas UTC ${[...permitidas].sort((x, y) => x - y).join(', ')})`
  )
}

// --- 8. El rango nunca se arma con dos días distintos ---------------------
//
// Los fines de semana el mercado cierra. Sin esta guarda, el "rango de
// apertura" del lunes podría armarse con velas del viernes y salir enorme.

console.log('\n8. El rango nunca se arma cruzando un hueco de días')
{
  const dias = new Set(barras.map((b) => b.slice(0, 10)))
  comprobar(dias.size > 50, `el mercado de prueba tiene ${dias.size} días`)
  // Reconstruir el rango de cada señal y exigir que sus velas sean del mismo
  // día que la entrada.
  const idx = new Map(barras.map((b, i) => [b, i]))
  let malos = 0
  for (const s of toque) {
    const k = idx.get(s.vistoEl)
    // El arranque de la sesión está entre 5 y 2 velas antes de la entrada.
    let arranque = null
    for (let d = 2; d <= 5; d++) {
      const j = k - d
      if (j >= 0 && APERTURAS.some((a) => a.hora === Number(barras[j].slice(11, 13)))) arranque = j
    }
    if (arranque === null) { malos++; continue }
    if (barras[arranque].slice(0, 10) !== s.vistoEl.slice(0, 10)) malos++
  }
  comprobar(malos === 0, 'el rango y la entrada son siempre del mismo día')
}

console.log('')
console.log(fallos ? `${fallos} comprobación(es) FALLARON` : 'Todas las comprobaciones pasaron.')
process.exit(fallos ? 1 : 0)
