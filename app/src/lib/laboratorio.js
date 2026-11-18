// El laboratorio: «prueba tu propia regla».
//
// La persona arma una regla con piezas que ya conoce (RSI, medias, Bollinger,
// mínimos y máximos), elige hacia qué lado opera y con qué Stop-loss y
// Take-profit, y la app la prueba sobre las velas guardadas de esta app.
//
// ⚠️ ES GEMELO. Vale igual con velas diarias (Swing) que con velas de una hora
// (Intradía) porque no sabe de cuál se trata: recibe la historia ya armada y
// cuenta en VELAS, nunca en días ni en horas. La pantalla dice cuál es la vela.
//
// Las decisiones que no hay que ablandar:
//
// ⚠️ MISMAS REGLAS QUE EL HISTORIAL DE LA APP. La entrada es al cierre de la
// vela de la señal, esa vela no cuenta, y una vela que toca el Stop-loss y el
// Take-profit a la vez cuenta como PERDIDA (la vela no dice cuál pasó antes).
// Se elige el peor caso a propósito: un banco de pruebas que se equivoca a su
// favor no sirve para decidir si arriesgar dinero.
//
// ⚠️ SE DESCUENTA EL SPREAD. Sin él cualquier regla que entra mucho parece
// mejor de lo que es. No se descuenta el swap (no hay histórico), y la pantalla
// lo dice.
//
// ⚠️ UNA OPERACIÓN POR PAR A LA VEZ. Mientras la anterior siga abierta no se
// abre otra en el mismo par: si no, una condición que se cumple diez velas
// seguidas contaría diez veces la misma apuesta.
//
// ⚠️ NO DA VEREDICTOS. Devuelve números con su margen pegado. No dice «buena»,
// ni «mala», ni «úsala». Y cada prueba se CUENTA: cuantas más variantes se
// prueban sobre los mismos datos, más fácil es encontrar una que gane por
// casualidad (sobreajuste). Ver `contarPrueba`.
//
// ⚠️ LOS INDICADORES SON LOS CLÁSICOS (RSI y ATR de Wilder de 14 velas, medias,
// Bollinger 20 y 2), calculados aquí sobre la serie entera. No son copia
// exacta de los de cada app (el ATR de Intradía, por ejemplo, usa una ventana
// de 60 velas), y no hace falta que lo sean: el laboratorio prueba la regla de
// la persona, no las señales de la app.

import { margen } from './diagnostico.js'

export const MAX_CONDICIONES = 4
export const MIN_VELAS_INDICADOR = 30

export const OPERADORES = Object.freeze(['<=', '>='])

/** Las piezas con las que se arma una regla, con sus valores permitidos. */
export const TIPOS_CONDICION = Object.freeze({
  rsi: { valor: [5, 95] },
  media: { medias: ['ema', 'sma'], periodos: [9, 20, 21, 50, 100, 200], lados: ['encima', 'debajo'] },
  extremo: { extremos: ['minimo', 'maximo'], n: [3, 100] },
  bollinger: { valor: [-0.5, 1.5] },
})

export const RIESGOS_ATR = Object.freeze([1, 1.5, 2])
export const OBJETIVOS_RB = Object.freeze([1, 1.5, 2])

/** Una regla vacía, lista para que la persona la arme. */
export const REGLA_INICIAL = Object.freeze({
  lado: null,
  condiciones: [],
  riesgoATR: 1.5,
  objetivoRB: 1,
})

export const pipDe = (par) => (String(par).includes('JPY') ? 0.01 : 0.0001)

// ── indicadores sobre la serie entera (null donde todavía no hay datos) ──

export function serieRsi(c, p = 14) {
  const out = new Array(c.length).fill(null)
  if (c.length <= p) return out
  let g = 0
  let l = 0
  for (let i = 1; i <= p; i++) {
    const d = c[i] - c[i - 1]
    if (d > 0) g += d
    else l -= d
  }
  g /= p
  l /= p
  out[p] = l === 0 ? 100 : 100 - 100 / (1 + g / l)
  for (let i = p + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1]
    g = (g * (p - 1) + Math.max(d, 0)) / p
    l = (l * (p - 1) + Math.max(-d, 0)) / p
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l)
  }
  return out
}

export function serieAtr(h, l, c, p = 14) {
  const out = new Array(c.length).fill(null)
  if (c.length <= p) return out
  const tr = (i) => Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]))
  let s = 0
  for (let i = 1; i <= p; i++) s += tr(i)
  let atr = s / p
  out[p] = atr
  for (let i = p + 1; i < c.length; i++) {
    atr = (atr * (p - 1) + tr(i)) / p
    out[i] = atr
  }
  return out
}

export function serieSma(c, p) {
  const out = new Array(c.length).fill(null)
  let s = 0
  for (let i = 0; i < c.length; i++) {
    s += c[i]
    if (i >= p) s -= c[i - p]
    if (i >= p - 1) out[i] = s / p
  }
  return out
}

// ⚠️ La EMA arranca en la SMA de sus primeras `p` velas y no se da por buena
// hasta las 3·p (lo mismo que `VECES_EMA` en `medias.js`): antes, lo que queda
// del arranque pesa demasiado y el número no es el de un gráfico con historia.
export function serieEma(c, p) {
  const out = new Array(c.length).fill(null)
  if (c.length < p) return out
  const k = 2 / (p + 1)
  let e = 0
  for (let i = 0; i < p; i++) e += c[i]
  e /= p
  for (let i = p; i < c.length; i++) {
    e = c[i] * k + e * (1 - k)
    if (i >= 3 * p - 1) out[i] = e
  }
  return out
}

/** %B de Bollinger (20, 2): 0 en la banda de abajo, 1 en la de arriba. */
export function seriePercentB(c, p = 20, k = 2) {
  const out = new Array(c.length).fill(null)
  for (let i = p - 1; i < c.length; i++) {
    let s = 0
    for (let j = i - p + 1; j <= i; j++) s += c[j]
    const m = s / p
    let v = 0
    for (let j = i - p + 1; j <= i; j++) v += (c[j] - m) ** 2
    const d = Math.sqrt(v / p)
    if (d > 0) out[i] = (c[i] - (m - k * d)) / (2 * k * d)
  }
  return out
}

// ── validar la regla ──

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const dentro = (v, [a, b]) => num(v) !== null && v >= a && v <= b

/** La condición, limpia, o null si trae algo que no se entiende. */
export function condicionValida(c) {
  if (!c || typeof c !== 'object') return null
  if (c.tipo === 'rsi' || c.tipo === 'bollinger') {
    if (!OPERADORES.includes(c.op) || !dentro(c.valor, TIPOS_CONDICION[c.tipo].valor)) return null
    return { tipo: c.tipo, op: c.op, valor: c.valor }
  }
  if (c.tipo === 'media') {
    const t = TIPOS_CONDICION.media
    if (!t.medias.includes(c.media) || !t.periodos.includes(c.periodo) || !t.lados.includes(c.lado)) return null
    return { tipo: 'media', media: c.media, periodo: c.periodo, lado: c.lado }
  }
  if (c.tipo === 'extremo') {
    const t = TIPOS_CONDICION.extremo
    if (!t.extremos.includes(c.extremo) || !Number.isInteger(c.n) || !dentro(c.n, t.n)) return null
    return { tipo: 'extremo', extremo: c.extremo, n: c.n }
  }
  return null
}

/**
 * La regla lista para probar, o `{ error }` con el motivo. Sin lado no hay
 * regla: la app NO elige la dirección por la persona.
 */
export function reglaValida(r) {
  if (!r || typeof r !== 'object') return { error: 'vacia' }
  if (r.lado !== 'COMPRA' && r.lado !== 'VENTA') return { error: 'sinLado' }
  const cs = Array.isArray(r.condiciones) ? r.condiciones : []
  if (!cs.length) return { error: 'sinCondiciones' }
  if (cs.length > MAX_CONDICIONES) return { error: 'demasiadas' }
  const limpias = cs.map(condicionValida)
  if (limpias.some((c) => c === null)) return { error: 'condicionRara' }
  if (!RIESGOS_ATR.includes(r.riesgoATR) || !OBJETIVOS_RB.includes(r.objetivoRB)) return { error: 'geometria' }
  return { lado: r.lado, condiciones: limpias, riesgoATR: r.riesgoATR, objetivoRB: r.objetivoRB }
}

// ── probar ──

function indicadoresDe(serie, condiciones) {
  const { c, h, l } = serie
  const ind = { atr: serieAtr(h, l, c) }
  for (const cond of condiciones) {
    if (cond.tipo === 'rsi') ind.rsi ??= serieRsi(c)
    else if (cond.tipo === 'bollinger') ind.pb ??= seriePercentB(c)
    else if (cond.tipo === 'media') {
      const k = `${cond.media}${cond.periodo}`
      ind[k] ??= cond.media === 'ema' ? serieEma(c, cond.periodo) : serieSma(c, cond.periodo)
    }
  }
  return ind
}

// ¿Se cumple la condición en la vela i? null = no se puede saber (faltan
// velas): entonces la regla no dispara, nunca «se cumple por si acaso».
function cumple(cond, i, serie, ind) {
  const { c, h, l } = serie
  if (cond.tipo === 'rsi' || cond.tipo === 'bollinger') {
    const v = (cond.tipo === 'rsi' ? ind.rsi : ind.pb)[i]
    if (v === null) return null
    return cond.op === '<=' ? v <= cond.valor : v >= cond.valor
  }
  if (cond.tipo === 'media') {
    const m = ind[`${cond.media}${cond.periodo}`][i]
    if (m === null) return null
    return cond.lado === 'encima' ? c[i] > m : c[i] < m
  }
  if (cond.tipo === 'extremo') {
    if (i < cond.n) return null
    // El mínimo (o máximo) de la vela de hoy rompe el de las `n` anteriores.
    let ext = cond.extremo === 'minimo' ? Infinity : -Infinity
    for (let j = i - cond.n; j < i; j++) ext = cond.extremo === 'minimo' ? Math.min(ext, l[j]) : Math.max(ext, h[j])
    return cond.extremo === 'minimo' ? l[i] < ext : h[i] > ext
  }
  return null
}

/**
 * Prueba la regla sobre UN par.
 *
 * @param serie  { c, h, l } del par, mismas longitudes, en orden de tiempo
 * @param fechas las fechas de esas velas
 * @param spread spread del par en pips (se resta de cada operación)
 */
export function probarEnPar(regla, par, serie, fechas, spread = 0) {
  const { c, h, l } = serie
  const n = c.length
  if (n < MIN_VELAS_INDICADOR || h.length !== n || l.length !== n) return []
  const ind = indicadoresDe(serie, regla.condiciones)
  const compra = regla.lado === 'COMPRA'
  const pip = pipDe(par)
  const ops = []
  for (let i = MIN_VELAS_INDICADOR; i < n - 1; i++) {
    const atr = ind.atr[i]
    if (!(atr > 0)) continue
    let ok = true
    for (const cond of regla.condiciones) {
      if (cumple(cond, i, serie, ind) !== true) { ok = false; break }
    }
    if (!ok) continue
    const entrada = c[i]
    const riesgo = regla.riesgoATR * atr
    const sl = compra ? entrada - riesgo : entrada + riesgo
    const tp = compra ? entrada + riesgo * regla.objetivoRB : entrada - riesgo * regla.objetivoRB
    let estado = 'abierta'
    let j = i + 1
    for (; j < n; j++) {
      const tocaSl = compra ? l[j] <= sl : h[j] >= sl
      const tocaTp = compra ? h[j] >= tp : l[j] <= tp
      if (tocaSl) { estado = 'perdida'; break } // con los dos a la vez, perdida
      if (tocaTp) { estado = 'ganada'; break }
    }
    const riesgoPips = riesgo / pip
    const costeR = riesgoPips > 0 ? spread / riesgoPips : 0
    const r = estado === 'ganada' ? regla.objetivoRB - costeR : estado === 'perdida' ? -1 - costeR : null
    ops.push({ par, entradaEl: fechas[i], salidaEl: estado === 'abierta' ? null : fechas[j], estado, r, velas: estado === 'abierta' ? null : j - i, riesgoPips })
    if (estado === 'abierta') break
    i = j // una operación por par a la vez
  }
  return ops
}

/** Resume una lista de operaciones. `null` donde no hay con qué contar. */
export function resumirOps(ops) {
  const cerradas = ops.filter((o) => o.estado !== 'abierta')
  const ganadas = cerradas.filter((o) => o.estado === 'ganada').length
  const n = cerradas.length
  const suma = cerradas.reduce((s, o) => s + o.r, 0)
  return {
    ops: n,
    abiertas: ops.length - n,
    ganadas,
    perdidas: n - ganadas,
    acierto: n ? Math.round((ganadas / n) * 100) : null,
    margen: margen(n),
    porR: n ? suma / n : null,
    totalR: n ? suma : null,
  }
}

/**
 * Prueba la regla en todos los pares de la historia.
 *
 * @param historia { fechas, pares: { [par]: { c, h, l } } }
 * @param spreadDe función par → pips
 * @returns { ...resumen, mitades:[a,b], porPar:[...], desde, hasta, velas }
 *          o `{ error }`.
 */
export function probarRegla(reglaCruda, historia, spreadDe = () => 0) {
  const regla = reglaValida(reglaCruda)
  if (regla.error) return regla
  const fechas = historia?.fechas
  const pares = historia?.pares
  if (!Array.isArray(fechas) || !fechas.length || !pares || typeof pares !== 'object') return { error: 'sinHistoria' }
  const todas = []
  const porPar = []
  for (const [par, serie] of Object.entries(pares)) {
    if (!serie || !Array.isArray(serie.c)) continue
    const sp = Number(spreadDe(par)) || 0
    const ops = probarEnPar(regla, par, serie, fechas.slice(fechas.length - serie.c.length), sp)
    todas.push(...ops)
    porPar.push({ par, ...resumirOps(ops) })
  }
  // Las mitades se parten por la fecha del medio del periodo, no por número
  // de operaciones: así se ve si la regla aguanta en los dos tramos de tiempo.
  const corte = fechas[Math.floor(fechas.length / 2)]
  const a = todas.filter((o) => o.entradaEl < corte)
  const b = todas.filter((o) => o.entradaEl >= corte)
  porPar.sort((x, y) => y.ops - x.ops || x.par.localeCompare(y.par))
  return {
    ...resumirOps(todas),
    mitades: [resumirOps(a), resumirOps(b)],
    corte,
    porPar,
    desde: fechas[0],
    hasta: fechas[fechas.length - 1],
    velas: fechas.length,
  }
}

/**
 * El punto de equilibrio: el acierto que hace falta para no perder, antes de
 * costes, con ese objetivo. Va al lado del acierto para que nadie lea un 55 %
 * con el objetivo a 1:0,5 como «gana».
 */
export const aciertoDeEquilibrio = (objetivoRB) => Math.round((1 / (1 + objetivoRB)) * 100)

/**
 * Cuenta una prueba. Se guarda la cuenta, no las reglas probadas: lo que
 * importa es cuántas variantes se probaron sobre los mismos datos, porque con
 * muchas siempre sale alguna que «gana» por casualidad.
 */
export function contarPrueba(antes) {
  const n = Number.isInteger(antes) && antes >= 0 ? antes : 0
  return n + 1
}

/** Lo que se guarda en Firestore: la regla limpia y un resumen corto. */
export function fichaParaGuardar(reglaCruda, nombre, resultado, probadas, app) {
  const regla = reglaValida(reglaCruda)
  if (regla.error) return regla
  const limpio = String(nombre ?? '').trim().slice(0, 60)
  if (!limpio) return { error: 'sinNombre' }
  const res = resultado && !resultado.error
    ? {
        ops: resultado.ops,
        acierto: resultado.acierto,
        porR: resultado.porR === null ? null : Math.round(resultado.porR * 1000) / 1000,
        desde: resultado.desde,
        hasta: resultado.hasta,
      }
    : null
  return {
    nombre: limpio,
    app,
    ...regla,
    probadas: Number.isInteger(probadas) && probadas > 0 ? Math.min(probadas, 100000) : 1,
    resultado: res,
  }
}
