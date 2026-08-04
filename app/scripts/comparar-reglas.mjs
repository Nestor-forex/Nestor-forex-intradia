// Compara, sobre las velas H1 REALES de ahora mismo, el efecto de los dos
// cambios de cálculo:
//   · ATR sustituto (solo cierres)  vs  ATR de Wilder con rango real
//   · stop en el extremo de 10 velas ∓ ½ ATR  vs  stop a 1.5 × ATR
//
// Corre en GitHub Actions porque el entorno de la sesión de Claude tiene
// bloqueado api.twelvedata.com. No manda nada ni cambia nada: solo imprime.
// Sirve para volver a medir cada vez que se toque una regla de cálculo.

import { readFileSync } from 'node:fs'
import { computarBarrido } from '../src/lib/marketCalc.js'

function leerLlave() {
  const env = readFileSync(new URL('../.env.production', import.meta.url), 'utf8')
  const m = env.match(/^VITE_TWELVEDATA_KEY=(.+)$/m)
  if (!m || !m[1].trim()) throw new Error('VITE_TWELVEDATA_KEY no está configurada en .env.production')
  return m[1].trim()
}

const SYMBOLS = ['USD/EUR', 'USD/GBP', 'USD/JPY', 'USD/CHF', 'USD/AUD', 'USD/NZD', 'USD/CAD']
const SYM_TO_CCY = { 'USD/EUR': 'EUR', 'USD/GBP': 'GBP', 'USD/JPY': 'JPY', 'USD/CHF': 'CHF', 'USD/AUD': 'AUD', 'USD/NZD': 'NZD', 'USD/CAD': 'CAD' }

async function obtenerVelas(apiKey) {
  const r = await fetch(
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(SYMBOLS.join(','))}&interval=1h&outputsize=100&timezone=UTC&apikey=${apiKey}`
  )
  if (!r.ok) throw new Error('HTTP ' + r.status)
  const j = await r.json()
  const porSimbolo = {}
  for (const sym of SYMBOLS) {
    const bloque = j[sym]
    if (!bloque || bloque.status === 'error' || !Array.isArray(bloque.values)) throw new Error(`sin datos de ${sym}`)
    const mapa = new Map()
    for (const v of bloque.values) mapa.set(v.datetime, { c: parseFloat(v.close), h: parseFloat(v.high), l: parseFloat(v.low) })
    porSimbolo[sym] = mapa
  }
  const barras = [...porSimbolo[SYMBOLS[0]].keys()].filter((t) => SYMBOLS.every((s) => porSimbolo[s].has(t))).sort()
  const rates = {}
  const rangos = {}
  for (const t of barras) {
    const fila = {}
    const filaR = {}
    for (const sym of SYMBOLS) {
      const v = porSimbolo[sym].get(t)
      fila[SYM_TO_CCY[sym]] = v.c
      filaR[SYM_TO_CCY[sym]] = { h: v.h, l: v.l }
    }
    rates[t] = fila
    rangos[t] = filaR
  }
  return { barras, rates, rangos }
}

// R/B con la regla vieja (stop al extremo de 10 velas ∓ ½ ATR) y con la
// nueva (stop a 1.5 × ATR). El objetivo es el mismo en las dos.
const objetivoNuevo = (p, compra) => {
  const min = p.c + (compra ? 1 : -1) * p.atrAbs
  const niveles = compra ? [p.hi20, p.pivots.r1, p.pivots.r2].filter((x) => x > min) : [p.lo20, p.pivots.s1, p.pivots.s2].filter((x) => x < min)
  if (!niveles.length) return p.c + (compra ? 1 : -1) * 2.5 * p.atrAbs
  return compra ? Math.min(...niveles) : Math.max(...niveles)
}

const rb = (p, compra, vieja) => {
  const sl = vieja ? (compra ? p.lo10 - 0.5 * p.atrAbs : p.hi10 + 0.5 * p.atrAbs) : compra ? p.c - 1.5 * p.atrAbs : p.c + 1.5 * p.atrAbs
  const tp = vieja ? (compra ? Math.max(p.hi20, p.c + 2 * p.atrAbs) : Math.min(p.lo20, p.c - 2 * p.atrAbs)) : objetivoNuevo(p, compra)
  return Math.abs(tp - p.c) / Math.abs(p.c - sl)
}

const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length

const { barras, rates, rangos } = await obtenerVelas(leerLlave())
const viejo = computarBarrido(barras, rates) // sin rangos = comportamiento anterior
const nuevo = computarBarrido(barras, rates, rangos)

console.log('---COMPARACION-INICIO---')
console.log(`Velas H1 usadas: ${barras.length} · última: ${barras[barras.length - 1]} UTC`)
console.log(`Pares calculados: ${nuevo.pares.length}\n`)
console.log('par        ATR% antes  ATR% ahora   R/B antes  R/B ahora   tendencia')
const rbV = []
const rbN = []
for (const pN of nuevo.pares) {
  const pV = viejo.pares.find((x) => x.name === pN.name)
  const compra = pN.tend !== 'Bajista'
  const a = rb(pV, compra, true)
  const b = rb(pN, compra, false)
  rbV.push(a)
  rbN.push(b)
  console.log(
    `${pN.name.padEnd(9)}  ${pV.atrPctH.toFixed(3).padStart(8)}  ${pN.atrPctH.toFixed(3).padStart(9)}   ${('1:' + a.toFixed(1)).padStart(8)}  ${('1:' + b.toFixed(1)).padStart(8)}   ${pN.tend}`
  )
}
console.log(`\nATR% promedio: antes ${media(viejo.pares.map((p) => p.atrPctH)).toFixed(3)} → ahora ${media(nuevo.pares.map((p) => p.atrPctH)).toFixed(3)}`)
console.log(`R/B promedio:  antes 1:${media(rbV).toFixed(2)} → ahora 1:${media(rbN).toFixed(2)}`)
console.log(`Pares con R/B bajo 1:1.5 — antes ${rbV.filter((r) => r < 1.5).length}/${rbV.length} · ahora ${rbN.filter((r) => r < 1.5).length}/${rbN.length}`)
console.log('---COMPARACION-FIN---')
