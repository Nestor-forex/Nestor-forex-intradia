// Prueba local del cambio a máximo/mínimo reales y stop por ATR.
// Genera velas H1 sintéticas con mechas y compara el resultado contra el
// comportamiento anterior (cierre solamente), que se reproduce pasando
// `rangos = null`. No pega a ninguna API: sirve para verificar el cálculo
// sin depender de la red.

import { computarBarrido, derivarVista, PAIRS } from '../src/lib/marketCalc.js'

const CCY = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD']
const BASE = { EUR: 0.92, GBP: 0.78, JPY: 157, CHF: 0.88, AUD: 1.54, NZD: 1.7, CAD: 1.37 }
// Tendencia por divisa (por hora) para que salgan setups de compra y de venta.
const DERIVA = { EUR: -0.0004, GBP: 0.0002, JPY: 0.0009, CHF: 0.0005, AUD: -0.0011, NZD: -0.0008, CAD: 0.0003 }
const MECHA = 0.0009 // tamaño típico de la mecha, como fracción del precio

let semilla = 20260804
const rnd = () => {
  semilla = (semilla * 1103515245 + 12345) % 2147483648
  return semilla / 2147483648
}

const barras = []
const rates = {}
const rangos = {}
const N = 100
for (let i = 0; i < N; i++) {
  const t = new Date(Date.UTC(2026, 7, 1, 0, 0, 0) + i * 3600e3).toISOString().slice(0, 19).replace('T', ' ')
  barras.push(t)
  const fila = {}
  const filaR = {}
  for (const c of CCY) {
    // Tendencia + retrocesos periódicos. Sin los retrocesos la serie queda
    // demasiado lisa y el mínimo de las últimas 10 velas cae casi encima del
    // precio, que es justo el caso en el que la regla vieja del stop NO se
    // notaba mal. El mercado real hace estos dientes de sierra.
    const retroceso = Math.sin(i / 7) * 0.0022 + Math.sin(i / 3.3) * 0.0009
    const px = BASE[c] * (1 + DERIVA[c] * i + retroceso * Math.sign(DERIVA[c] || 1) + (rnd() - 0.5) * 0.001)
    const mechaArriba = px * MECHA * rnd()
    const mechaAbajo = px * MECHA * rnd()
    fila[c] = px
    filaR[c] = { h: px + mechaArriba, l: px - mechaAbajo }
  }
  rates[t] = fila
  rangos[t] = filaR
}

// "antes" = sin rangos (la fuente daba solo cierres) · "ahora" = con rangos.
const dAntes = computarBarrido(barras, rates)
const dAhora = computarBarrido(barras, rates, rangos)
const antes = derivarVista(dAntes, { thr: 0.5, topN: 3 })
const ahora = derivarVista(dAhora, { thr: 0.5, topN: 3 })

const num = (s) => parseFloat(String(s).replace('1:', ''))
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)

// La regla vieja del stop, aplicada sobre los datos viejos, para poder
// comparar manzanas con manzanas: mkSetup ya usa la nueva y no hay forma de
// pedirle la anterior.
function rbRegla(par, compra, { stopViejo }) {
  const sl = stopViejo
    ? compra
      ? par.lo10 - 0.5 * par.atrAbs
      : par.hi10 + 0.5 * par.atrAbs
    : compra
      ? par.c - 1.5 * par.atrAbs
      : par.c + 1.5 * par.atrAbs
  const tp = compra ? Math.max(par.hi20, par.c + 2 * par.atrAbs) : Math.min(par.lo20, par.c - 2 * par.atrAbs)
  return Math.abs(tp - par.c) / Math.abs(par.c - sl)
}

console.log('Pares calculados:', ahora.pares.length, '(antes eran 14)')
console.log('Pares nuevos presentes:', ['AUD/JPY', 'NZD/JPY', 'AUD/NZD', 'EUR/GBP'].filter((n) => ahora.pares.some((p) => p.name === n)).join(', '))

console.log('\nATR%% promedio  ANTES (solo cierres):', media(antes.pares.map((p) => p.atr)).toFixed(4))
console.log('ATR%% promedio  AHORA (rango real)  :', media(ahora.pares.map((p) => p.atr)).toFixed(4))

console.log('\nSetups ANTES:')
for (const s of antes.setups) console.log(' ', s.name, s.lado, '· R/B', s.rr)
console.log('Setups AHORA:')
for (const s of ahora.setups) console.log(' ', s.name, s.lado, '· R/B', s.rr)

// Comparación real: misma señal, las dos reglas de stop.
console.log('\nRegla del stop, señal por señal (R/B):')
const rbAntes = []
const rbAhora = []
for (const s of ahora.setups) {
  const compra = s.lado === 'COMPRA'
  const viejo = dAntes.pares.find((p) => p.name === s.name)
  const nuevo = dAhora.pares.find((p) => p.name === s.name)
  const rA = rbRegla(viejo, compra, { stopViejo: true })
  const rN = rbRegla(nuevo, compra, { stopViejo: false })
  rbAntes.push(rA)
  rbAhora.push(rN)
  console.log(`  ${s.name} ${s.lado}: antes 1:${rA.toFixed(1)}  →  ahora 1:${rN.toFixed(1)}`)
}
console.log('\nR/B promedio ANTES:', media(rbAntes).toFixed(2))
console.log('R/B promedio AHORA:', media(rbAhora).toFixed(2))
console.log('Setups bajo 1:1.5 — antes:', rbAntes.filter((r) => r < 1.5).length, '/', rbAntes.length, '· ahora:', rbAhora.filter((r) => r < 1.5).length, '/', rbAhora.length)

// Invariantes que no se pueden romper.
const fallos = []
for (const s of ahora.setups) {
  const c = s.crudo
  if (c.compra && !(c.sl < c.precio && c.tp > c.precio)) fallos.push(`${s.name}: compra con niveles cruzados`)
  if (!c.compra && !(c.sl > c.precio && c.tp < c.precio)) fallos.push(`${s.name}: venta con niveles cruzados`)
  if (!(c.sup <= c.precio + 1e-9 && c.res >= c.precio - 1e-9)) fallos.push(`${s.name}: precio fuera de soporte/resistencia`)
  if (!(c.rr > 0 && Number.isFinite(c.rr))) fallos.push(`${s.name}: R/B inválido`)
  if (!(c.atrPct > 0)) fallos.push(`${s.name}: ATR no positivo`)
}
for (const p of ahora.pares) {
  const [b, q] = p.name.split('/')
  if (!PAIRS.some(([x, y]) => x === b && y === q)) fallos.push(`${p.name}: par no declarado`)
}
console.log('\nInvariantes:', fallos.length ? 'FALLAN → ' + fallos.join(' | ') : 'todas OK')
