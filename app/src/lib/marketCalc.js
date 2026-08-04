import { crearT } from './i18n/crearT.js'
import { IDIOMA_BASE, localeDe } from './i18n/idiomas.js'

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
  // Pares de la sesión asiática y de Oceanía: sin ellos la app quedaba casi
  // ciega entre las 00:00 y las 09:00 UTC, que es cuando manda Tokio. No
  // cuestan datos extra — se derivan de los mismos 7 símbolos contra USD.
  ['AUD', 'JPY'],
  ['NZD', 'JPY'],
  ['AUD', 'NZD'],
  ['EUR', 'GBP'],
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

// ATR real de Wilder sobre 14 velas. Antes se usaba un sustituto
// (promedio de |cierre − cierre anterior|) porque solo se guardaba el cierre
// de cada vela; ahora que llegan el máximo y el mínimo se calcula el rango
// verdadero, que incluye el recorrido *dentro* de cada hora:
//   TR = max(máximo − mínimo, |máximo − cierre previo|, |mínimo − cierre previo|)
// El ATR real es bastante mayor que aquel sustituto, y de él dependen el
// stop y el tamaño del objetivo.
function atrWilder(highs, lows, closes, p = 14) {
  const n = closes.length
  const trs = []
  for (let i = Math.max(1, n - 60); i < n; i++) {
    const cp = closes[i - 1]
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - cp), Math.abs(lows[i] - cp)))
  }
  if (trs.length < p) return trs.reduce((a, b) => a + b, 0) / Math.max(1, trs.length)
  let atr = trs.slice(0, p).reduce((a, b) => a + b, 0) / p
  for (let i = p; i < trs.length; i++) atr = (atr * (p - 1) + trs[i]) / p
  return atr
}

// Puntos pivote clásicos (P, S1/S2, R1/R2) a partir de las 24 horas previas
// a la vela actual, usadas como aproximación del "día anterior".
// Ahora usan el máximo y el mínimo reales de esas 24 horas (antes eran el
// mayor y el menor de los cierres, que dejaban por fuera las mechas y
// achicaban el rango).
function calcularPivots(highs, lows, closes, L) {
  const desde = Math.max(0, L - 2 * BARRAS_POR_DIA + 1)
  const hasta = Math.max(desde, L - BARRAS_POR_DIA)
  const hi = Math.max(...highs.slice(desde, hasta + 1))
  const lo = Math.min(...lows.slice(desde, hasta + 1))
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
// unidades de esa divisa vale 1 USD en esa hora (cierre de la vela).
// rangos (opcional): { [timestamp]: { EUR: { h, l }, ... } } — máximo y
// mínimo de esa misma vela. Twelve Data ya los mandaba en la misma
// respuesta y se estaban descartando. Si no llegan, todo cae de vuelta al
// comportamiento anterior (máximo = mínimo = cierre).
export function computarBarrido(barras, rates, rangos = null) {
  const serie = {}
  const serieHi = {}
  const serieLo = {}
  CCY.forEach((c) => {
    serie[c] = barras.map((t) => (c === 'USD' ? 1 : rates[t][c]))
    serieHi[c] = barras.map((t, i) => (c === 'USD' ? 1 : (rangos?.[t]?.[c]?.h ?? serie[c][i])))
    serieLo[c] = barras.map((t, i) => (c === 'USD' ? 1 : (rangos?.[t]?.[c]?.l ?? serie[c][i])))
  })
  const L = barras.length - 1
  const px = (b, q, i) => serie[q][i] / serie[b][i]
  // El precio del par es divisa cotizada / divisa base, así que su máximo se
  // da con el máximo de la cotizada contra el mínimo de la base. En los 7
  // pares contra el dólar una de las dos es constante (=1), así que el
  // resultado es exacto; en los cruces (EUR/CHF, AUD/JPY…) es una cota
  // superior del rango real, algo más amplia que la verdadera.
  const pxHi = (b, q, i) => serieHi[q][i] / serieLo[b][i]
  const pxLo = (b, q, i) => serieLo[q][i] / serieHi[b][i]
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
    const highs = barras.map((_, i) => pxHi(b, q, i))
    const lows = barras.map((_, i) => pxLo(b, q, i))
    const c = closes[L]
    const e9 = emaLast(closes, 9)
    const e21 = emaLast(closes, 21)
    const atrAbs = atrWilder(highs, lows, closes)
    const atrPctH = (atrAbs / c) * 100
    const tend = c > e9 && e9 > e21 ? 'Alcista' : c < e9 && e9 < e21 ? 'Bajista' : 'Rango'
    const last20 = closes.slice(-20)
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
      // Soportes y resistencias con los extremos reales de las velas, no con
      // el mayor y el menor de los cierres: es donde el precio realmente
      // llegó y se devolvió.
      hi20: Math.max(...highs.slice(-20)),
      lo20: Math.min(...lows.slice(-20)),
      hi10: Math.max(...highs.slice(-10)),
      lo10: Math.min(...lows.slice(-10)),
      dec: b === 'JPY' || q === 'JPY' ? 2 : 4,
      serie20: last20,
      pivots: calcularPivots(highs, lows, closes, L),
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

const razon = (p, esc, t) => {
  const extra =
    p.rsiV > 70 || p.rsiV < 30
      ? t('calc_barrido.rsiExtendido')
      : p.rsiV >= 40 && p.rsiV <= 60
        ? t('calc_barrido.rsiContinuacion')
        : ''
  return t('calc_barrido.razon', {
    b: p.b,
    fb: esc[p.b].toFixed(1),
    q: p.q,
    fq: esc[p.q].toFixed(1),
    rsi: p.rsiV.toFixed(0),
    extra,
  })
}

// Cuántos ATR se pone el stop desde la entrada. Antes el stop iba al extremo
// de las últimas 10 velas menos ½ ATR, y eso tenía un efecto perverso: en una
// tendencia sana ese extremo queda lejísimos, así que el riesgo se disparaba
// mientras el objetivo seguía a 2 ATR — de ahí que casi todos los setups
// nacieran con relación 1:0.4 … 1:0.8, siempre marcados con aviso. Con el
// stop a 1.5 ATR el riesgo queda proporcional a lo movido que esté el par,
// que es lo que el ATR mide.
const ATR_STOP = 1.5

const mkSetup = (p, lado, esc = {}, t) => {
  const d = p.dec
  const compra = lado === 'COMPRA'
  const sl = compra ? p.c - ATR_STOP * p.atrAbs : p.c + ATR_STOP * p.atrAbs
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
    entrada: t('calc_barrido.entrada', { precio: p.c.toFixed(d), ema: p.e9.toFixed(d) }),
    sl: sl.toFixed(d) + (compra ? t('calc_barrido.slCompra') : t('calc_barrido.slVenta')),
    tp: tp.toFixed(d),
    rr: '1:' + rr.toFixed(1) + (rr < 1.5 ? t('calc_barrido.rbBajo') : ''),
    rrOk: rr >= 1.5,
    pivots: {
      p: p.pivots.p.toFixed(d),
      s1: p.pivots.s1.toFixed(d),
      s2: p.pivots.s2.toFixed(d),
      r1: p.pivots.r1.toFixed(d),
      r2: p.pivots.r2.toFixed(d),
    },
    inval: compra
      ? t('calc_barrido.invalCompra', { sl: sl.toFixed(d), b: p.b })
      : t('calc_barrido.invalVenta', { sl: sl.toFixed(d), q: p.q }),
  }
}

const porDifAbs = (a, b) => Math.abs(b.dif) - Math.abs(a.dif)

// data: salida de computarBarrido(). Devuelve todo ya formateado para las pantallas.
// vivo: si la vela más reciente trae el precio en vivo de TrueFX (en vez de
// solo el último cierre de Twelve Data) — únicamente cambia el texto de "corte".
export function derivarVista(data, { thr = 0.5, topN = 3, vivo = false, t = crearT(IDIOMA_BASE), locale } = {}) {
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

  const compras = comprasRaw.map((p) => ({ name: p.name, razon: razon(p, esc, t) }))
  const ventas = ventasRaw.map((p) => ({ name: p.name, razon: razon(p, esc, t) }))
  const vigilancia = vigilanciaRaw.map((p) => ({
    name: p.name,
    razon: t('calc_barrido.vigilancia', {
      dif: (p.dif >= 0 ? '+' : '') + p.dif.toFixed(1),
      favor: p.dif > 0 ? p.b : p.q,
      tend: t(`tend.${p.tend}`).toLowerCase(),
    }),
  }))

  const setups = [...comprasRaw.slice(0, topN).map((p) => mkSetup(p, 'COMPRA', esc, t)), ...ventasRaw.slice(0, topN).map((p) => mkSetup(p, 'VENTA', esc, t))]

  const ultima = aFechaUTC(data.ultima)
  // Ambas mitades llevan su propia fecha. Antes la de Colombia era solo la
  // hora, así que entre las 00:00 y las 05:00 UTC (cuando en Colombia todavía
  // es el día anterior) el texto quedaba con la fecha de UTC pegada a la hora
  // local: "30/07/2026, 1:00 a. m. UTC (8:00 p. m. en Colombia)" cuando en
  // Colombia eran las 8:00 p. m. del 29. Se pone Colombia primero por ser la
  // hora de quien usa la app.
  const loc = locale || localeDe(IDIOMA_BASE)
  const enUTC = ultima.toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })
  const enCO = ultima.toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' })
  const fuente = vivo ? t('calc_barrido.fuenteVivo') : t('calc_barrido.fuenteCierre')
  const corte = t('calc_barrido.corte', { local: enCO, utc: enUTC, fuente })

  return { monedas, pares, compras, ventas, vigilancia, setups, corte }
}
