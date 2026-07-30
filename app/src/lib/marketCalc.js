// Cálculos del barrido intradía: mismo motor que Nestor Forex (portado de los
// prototipos originales) pero recalibrado para velas de 1 hora (H1) en vez de
// velas diarias — ventanas más cortas, EMAs más rápidas, y puntos pivote /
// rango de sesión que solo tienen sentido en intradía.

export const CCY = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD']

export const PAIRS = [
  ['EUR', 'USD'],
  ['GBP', 'USD'],
  ['USD', 'JPY'],
  ['USD', 'CHF'],
  ['USD', 'CAD'],
  ['AUD', 'USD'],
  ['NZD', 'USD'],
  ['EUR', 'CHF'],
  ['EUR', 'CAD'],
  ['EUR', 'NZD'],
  ['GBP', 'CAD'],
  ['GBP', 'JPY'],
  ['NZD', 'CHF'],
  ['NZD', 'CAD'],
]

// Velas H1 por "día de trading intradía": 24 horas.
const BARRAS_POR_DIA = 24

const emaLast = (c, p) => {
  const k = 2 / (p + 1)
  let e = c.slice(0, p).reduce((a, b) => a + b) / p
  for (let i = p; i < c.length; i++) e = c[i] * k + e * (1 - k)
  return e
}

const rsi = (c, p = 14) => {
  let g = 0
  let l = 0
  for (let i = 1; i <= p; i++) {
    const d = c[i] - c[i - 1]
    if (d > 0) g += d
    else l -= d
  }
  g /= p
  l /= p
  for (let i = p + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1]
    g = (g * (p - 1) + Math.max(d, 0)) / p
    l = (l * (p - 1) + Math.max(-d, 0)) / p
  }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l)
}

// Puntos pivote clásicos (P, S1/S2, R1/R2) a partir de las 24 horas previas
// a la vela actual, usadas como aproximación del "día anterior". Esta fuente
// solo trae precio de cierre por hora (sin máximo/mínimo intrabar real), así
// que el "máximo"/"mínimo" del día anterior es el máximo/mínimo de esos
// cierres — una aproximación honesta, igual de transparente que las demás
// limitaciones de datos ya documentadas en la app hermana.
function calcularPivots(closes, L) {
  const desde = Math.max(0, L - 2 * BARRAS_POR_DIA + 1)
  const hasta = Math.max(desde, L - BARRAS_POR_DIA)
  const ventana = closes.slice(desde, hasta + 1)
  const hi = Math.max(...ventana)
  const lo = Math.min(...ventana)
  const cierre = closes[hasta]
  const p = (hi + lo + cierre) / 3
  return {
    p,
    r1: 2 * p - lo,
    s1: 2 * p - hi,
    r2: p + (hi - lo),
    s2: p - (hi - lo),
  }
}

// Twelve Data devuelve la hora como "2026-07-30 02:00:00", sin zona. Se le
// pide explícitamente timezone=UTC al API (su valor por omisión es la zona del
// mercado, que venía adelantada varias horas y hacía que el reporte mostrara
// velas "del futuro"). Aun así hay que convertirla a mano: `new Date('2026-07-30
// 02:00:00')` la leería como hora *local* del dispositivo, o sea 5 horas
// corridas en Colombia.
function aFechaUTC(ts) {
  const s = String(ts).trim().replace(' ', 'T')
  if (/(Z|[+-]\d\d:?\d\d)$/.test(s)) return new Date(s)
  return new Date(s.includes('T') ? s + 'Z' : s + 'T00:00:00Z')
}

// barras: array de timestamps ISO (UTC) ascendentes, uno por vela H1.
// rates: { [timestamp]: { EUR, GBP, JPY, CHF, AUD, NZD, CAD } } — cuántas
// unidades de esa divisa vale 1 USD en esa hora (mismo formato que el
// barrido diario, solo que muestreado cada hora en vez de una vez al día).
export function computarBarrido(barras, rates) {
  const serie = {}
  CCY.forEach((c) => (serie[c] = barras.map((t) => (c === 'USD' ? 1 : rates[t][c]))))
  const L = barras.length - 1
  const px = (b, q, i) => serie[q][i] / serie[b][i]
  const chg = (b, q, k) => (px(b, q, L) / px(b, q, Math.max(0, L - k)) - 1) * 100

  const raw = {}
  CCY.forEach((b) => {
    let s = 0
    CCY.forEach((q) => {
      // Ventanas cortas de intradía: 1h / 4h / 24h (en vez de 1d / 5d / 20d).
      if (q !== b) s += 0.2 * chg(b, q, 1) + 0.4 * chg(b, q, 4) + 0.4 * chg(b, q, 24)
    })
    raw[b] = s / 7
  })
  const vals = Object.values(raw)
  const mn = Math.min(...vals)
  const mx = Math.max(...vals)
  const esc = {}
  CCY.forEach((c) => (esc[c] = ((raw[c] - mn) / (mx - mn)) * 10))

  const pares = PAIRS.map(([b, q]) => {
    const closes = barras.map((_, i) => px(b, q, i))
    const c = closes[L]
    const e9 = emaLast(closes, 9)
    const e21 = emaLast(closes, 21)
    let sum = 0
    for (let i = L - 13; i <= L; i++) sum += Math.abs(closes[i] - closes[i - 1]) / closes[i - 1]
    const atrPctH = (sum / 14) * 100
    const atrAbs = (c * atrPctH) / 100
    const tend = c > e9 && e9 > e21 ? 'Alcista' : c < e9 && e9 < e21 ? 'Bajista' : 'Rango'
    const last20 = closes.slice(-20)
    const last10 = closes.slice(-10)
    return {
      name: b + '/' + q,
      b,
      q,
      c,
      e9,
      e21,
      rsiV: rsi(closes.slice(-60)),
      atrPctH,
      atrAbs,
      tend,
      dif: raw[b] - raw[q],
      hi20: Math.max(...last20),
      lo20: Math.min(...last20),
      hi10: Math.max(...last10),
      lo10: Math.min(...last10),
      dec: b === 'JPY' || q === 'JPY' ? 2 : 4,
      serie20: last20,
      pivots: calcularPivots(closes, L),
    }
  })

  const ratesUSD = { USD: 1 }
  CCY.slice(1).forEach((c) => (ratesUSD[c] = rates[barras[L]][c]))

  return { barras, ultima: barras[L], raw, esc, pares, ratesUSD }
}

const clasificar = (p, thr) => {
  if (p.dif > thr && p.tend === 'Alcista') return 'COMPRA'
  if (p.dif < -thr && p.tend === 'Bajista') return 'VENTA'
  if (Math.abs(p.dif) > thr) return 'VIGILAR'
  return '—'
}

const razon = (p, esc) => {
  const ext =
    p.rsiV > 70 || p.rsiV < 30
      ? ' — RSI extendido, no perseguir, esperar retroceso'
      : p.rsiV >= 40 && p.rsiV <= 60
        ? ' — RSI en zona de continuación'
        : ''
  return `${p.b} (${esc[p.b].toFixed(1)}) vs ${p.q} (${esc[p.q].toFixed(1)}), EMA9/21 alineadas, RSI ${p.rsiV.toFixed(0)}${ext}`
}

const mkSetup = (p, lado, esc = {}) => {
  const d = p.dec
  const compra = lado === 'COMPRA'
  const sl = compra ? p.lo10 - 0.5 * p.atrAbs : p.hi10 + 0.5 * p.atrAbs
  const tp = compra ? Math.max(p.hi20, p.c + 2 * p.atrAbs) : Math.min(p.lo20, p.c - 2 * p.atrAbs)
  const rr = Math.abs(tp - p.c) / Math.abs(p.c - sl)
  return {
    name: p.name,
    lado,
    // Los campos de abajo son texto ya armado, que es lo que consumen el
    // tablero y el reporte .md. `crudo` lleva los mismos datos sin formatear,
    // para la pantalla de detalle, que necesita dibujarlos y no solo leerlos.
    crudo: {
      b: p.b,
      q: p.q,
      dec: d,
      compra,
      precio: p.c,
      sl,
      tp,
      ema: p.e9,
      rr,
      // Distancias al stop y al objetivo, en pips (JPY cotiza a 2 decimales,
      // así que ahí un pip es 0.01 y no 0.0001).
      pipRiesgo: Math.abs(p.c - sl) / (d === 2 ? 0.01 : 0.0001),
      pipBeneficio: Math.abs(tp - p.c) / (d === 2 ? 0.01 : 0.0001),
      sup: p.lo20,
      res: p.hi20,
      pivote: p.pivots.p,
      serie20: p.serie20,
      rsi: Math.round(p.rsiV),
      atrPct: p.atrPctH,
      tend: p.tend,
      fuerzaB: esc[p.b],
      fuerzaQ: esc[p.q],
    },
    sup: p.lo20.toFixed(d),
    res: p.hi20.toFixed(d),
    entrada: `${p.c.toFixed(d)} actual · mejor en retroceso a EMA9 (${p.e9.toFixed(d)})`,
    sl: sl.toFixed(d) + (compra ? ' (bajo el mínimo de 10 horas − ½ ATR)' : ' (sobre el máximo de 10 horas + ½ ATR)'),
    tp: tp.toFixed(d),
    rr: '1:' + rr.toFixed(1) + (rr < 1.5 ? ' ⚠ por debajo de 1:1.5' : ''),
    rrOk: rr >= 1.5,
    pivots: {
      p: p.pivots.p.toFixed(d),
      s1: p.pivots.s1.toFixed(d),
      s2: p.pivots.s2.toFixed(d),
      r1: p.pivots.r1.toFixed(d),
      r2: p.pivots.r2.toFixed(d),
    },
    inval: compra
      ? `cierre horario por debajo de ${sl.toFixed(d)}, o pérdida de fuerza de ${p.b} en el ranking.`
      : `cierre horario por encima de ${sl.toFixed(d)}, o recuperación de fuerza de ${p.q}.`,
  }
}

const porDifAbs = (a, b) => Math.abs(b.dif) - Math.abs(a.dif)

// data: salida de computarBarrido(). Devuelve todo ya formateado para las pantallas.
// vivo: si la vela más reciente trae el precio en vivo de TrueFX (en vez de
// solo el último cierre de Twelve Data) — únicamente cambia el texto de "corte".
export function derivarVista(data, { thr = 0.5, topN = 3, vivo = false } = {}) {
  const { esc, pares: paresRaw } = data

  const monedas = Object.keys(esc)
    .sort((a, b) => esc[b] - esc[a])
    .map((cod) => ({ cod, score: esc[cod] }))

  const pares = paresRaw.map((p) => ({
    name: p.name,
    b: p.b,
    q: p.q,
    dif: p.dif,
    sesgo: clasificar(p, thr),
    tend: p.tend,
    rsi: Math.round(p.rsiV),
    atr: p.atrPctH,
    precio: p.c,
    dec: p.dec,
    serie20: p.serie20,
    cambio20: ((p.serie20.at(-1) - p.serie20[0]) / p.serie20[0]) * 100,
    pivots: p.pivots,
  }))

  const cands = [...paresRaw].sort(porDifAbs)
  const comprasRaw = cands.filter((p) => clasificar(p, thr) === 'COMPRA').slice(0, 5)
  const ventasRaw = cands.filter((p) => clasificar(p, thr) === 'VENTA').slice(0, 5)
  const vigilanciaRaw = cands.filter((p) => clasificar(p, thr) === 'VIGILAR').slice(0, 4)

  const compras = comprasRaw.map((p) => ({ name: p.name, razon: razon(p, esc) }))
  const ventas = ventasRaw.map((p) => ({ name: p.name, razon: razon(p, esc) }))
  const vigilancia = vigilanciaRaw.map((p) => ({
    name: p.name,
    razon: `Diferencial ${p.dif >= 0 ? '+' : ''}${p.dif.toFixed(1)} a favor de ${p.dif > 0 ? p.b : p.q}, pero el par sigue en ${p.tend.toLowerCase()} — fuerza sin confirmación técnica todavía.`,
  }))

  const setups = [...comprasRaw.slice(0, topN).map((p) => mkSetup(p, 'COMPRA', esc)), ...ventasRaw.slice(0, topN).map((p) => mkSetup(p, 'VENTA', esc))]

  const ultima = aFechaUTC(data.ultima)
  // Ambas mitades llevan su propia fecha. Antes la de Colombia era solo la
  // hora, así que entre las 00:00 y las 05:00 UTC (cuando en Colombia todavía
  // es el día anterior) el texto quedaba con la fecha de UTC pegada a la hora
  // local: "30/07/2026, 1:00 a. m. UTC (8:00 p. m. en Colombia)" cuando en
  // Colombia eran las 8:00 p. m. del 29. Se pone Colombia primero por ser la
  // hora de quien usa la app.
  const enUTC = ultima.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })
  const enCO = ultima.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' })
  const fuente = vivo ? 'Twelve Data + Capital.com (precio en vivo)' : 'Twelve Data'
  const corte = `Vela H1 más reciente: ${enCO} hora de Colombia (${enUTC} UTC) · fuente: ${fuente}`

  return { monedas, pares, compras, ventas, vigilancia, setups, corte }
}
