// Prueba del aviso de vigilancia por RSI. Sin internet y sin claves:
//
//     node scripts/prueba-vigilancia.mjs
//
// Nació de dos fallos reales que el reporte diario enseñó en producción:
// el número del RSI salía como "undefined" (faltaba el campo), y la frase
// decía "por encima de 70" incluso en las ventas, donde el filtro dispara
// por DEBAJO de 30. Un texto así no rompe nada, solo desinforma — que es
// justo lo que no ve ni el compilador ni el linter.
//
// Comprueba:
//   1. que muestre el número y no "undefined"
//   2. que la comparación case con el lado (compra → "por encima", venta → "por debajo")
import { computarBarrido, derivarVista } from '../src/lib/marketCalc.js'

const CCY = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD']
const HORAS = 400

function mercado(derivas, semilla) {
  let x = semilla
  const azar = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648 }
  const barras = []
  for (let i = 0; i < HORAS; i++) {
    barras.push(new Date(Date.UTC(2026, 0, 1, 0) + i * 3600_000).toISOString().slice(0, 19).replace('T', ' '))
  }
  const nivel = { EUR: 0.92, GBP: 0.79, JPY: 150, CHF: 0.88, AUD: 1.52, NZD: 1.64, CAD: 1.36 }
  const rates = {}, rangos = {}
  for (const t of barras) {
    const fila = {}, filaRangos = {}
    for (const c of CCY) {
      nivel[c] *= 1 + derivas[c] + (azar() - 0.5) * 0.0008
      fila[c] = nivel[c]
      const mecha = nivel[c] * 0.0012 * azar()
      filaRangos[c] = { h: nivel[c] + mecha, l: nivel[c] - mecha }
    }
    rates[t] = fila; rangos[t] = filaRangos
  }
  return derivarVista(computarBarrido(barras, rates, rangos), { thr: 0.5, topN: 3 })
}

let fallos = 0
const comprobar = (bien, que) => { console.log(`  ${bien ? '✓' : '✗'} ${que}`); if (!bien) fallos++ }

// Dos mercados con derivas opuestas para que salgan avisos de los dos lados.
const vistas = [
  mercado({ EUR: 0.0012, GBP: 0.0009, JPY: -0.0011, CHF: -0.0008, AUD: 0.0010, NZD: -0.0010, CAD: 0.0002 }, 7),
  mercado({ EUR: -0.0012, GBP: -0.0009, JPY: 0.0011, CHF: 0.0008, AUD: -0.0010, NZD: 0.0010, CAD: -0.0002 }, 13),
]

const todos = vistas.flatMap((v) => v.vigilancia)
console.log(`\nAvisos de vigilancia en total: ${todos.length}`)
for (const v of todos) console.log(' •', v.name, '—', v.razon)

console.log('\n1. Ningún texto sale roto')
comprobar(!todos.some((v) => /undefined|NaN|null/.test(v.razon)), 'sin "undefined", "NaN" ni "null"')

const porRsi = todos.filter((v) => /RSI ya está/.test(v.razon))
console.log('\n2. Salen avisos por RSI de los dos lados')
const altos = porRsi.filter((v) => /por encima de/.test(v.razon))
const bajos = porRsi.filter((v) => /por debajo de/.test(v.razon))
comprobar(altos.length > 0, `${altos.length} con "por encima de"`)
comprobar(bajos.length > 0, `${bajos.length} con "por debajo de"`)

console.log('\n3. El número y el umbral casan con la comparación')
for (const v of porRsi) {
  const m = v.razon.match(/RSI ya está en (\d+): por (encima|debajo) de (\d+)/)
  if (!m) { comprobar(false, `no pude leer el texto: ${v.razon}`); continue }
  const [, rsi, comparacion, umbral] = m
  const n = Number(rsi)
  const u = Number(umbral)
  const ok = comparacion === 'encima' ? n >= u : n <= u
  comprobar(ok, `${v.name}: RSI ${n} por ${comparacion} de ${u}`)
}

console.log('')
console.log(fallos ? `${fallos} comprobación(es) FALLARON` : 'Todas las comprobaciones pasaron.')
process.exit(fallos ? 1 : 0)
