// LAS MEDIAS MÓVILES — SIMPLES (SMA) Y EXPONENCIALES (EMA)
//
// Néstor las pidió el 2026-11-15 para el Analizador, «en los periodos que
// correspondan a cada app». Los PERIODOS los decide cada `marketCalc.js`
// (PRIMO): en Swing son días y en Intradía son horas. Aquí solo está la cuenta,
// que es la misma en las dos (GEMELO).
//
// ⚠️ SON INFORMACIÓN, NO UNA SEÑAL. Que el precio esté por encima de una media
// no dice que vaya a seguir subiendo. La única media que DECIDE algo en las apps
// es la de la tendencia de siempre (EMA20/50 en Swing, EMA9/21 en Intradía), y
// eso no cambia aquí.

const num = (x) => typeof x === 'number' && Number.isFinite(x)

/**
 * Cuántas veces el periodo tiene que tener la serie para que la EMA salga bien.
 *
 * La EMA arranca con la media simple de las primeras velas y luego «olvida»
 * poco a poco ese arranque. Con 3 veces el periodo, lo que queda del arranque
 * pesa (1 − 2/(p+1))^(2p) ≈ e⁻⁴ ≈ 2 %: ya es la EMA que daría un gráfico con
 * años de historia. Con menos, sale un número distinto del de TradingView y se
 * leería como el mismo.
 *
 * ⚠️ Por eso la EMA de 200 sale `null` en las dos apps: bajan unas 300 velas
 * (Swing, tras quitar fines de semana, unas 215), y harían falta 600. Se dice
 * en pantalla en vez de enseñar un número que no es.
 */
export const VECES_EMA = 3

/** La media simple de las últimas `p` velas, o null si no hay suficientes. */
export function smaUltima(serie, p) {
  if (!Array.isArray(serie) || !Number.isInteger(p) || p < 1 || serie.length < p) return null
  const v = serie.slice(-p)
  if (!v.every(num)) return null
  return v.reduce((a, b) => a + b, 0) / p
}

/**
 * La EMA de la serie, o null si la serie es demasiado corta para fiarse (ver
 * `VECES_EMA`). Misma fórmula que `emaLast` de las dos apps: arranca en la
 * media simple de las primeras `p` velas.
 */
export function emaUltima(serie, p) {
  if (!Array.isArray(serie) || !Number.isInteger(p) || p < 1 || serie.length < p * VECES_EMA) return null
  if (!serie.every(num)) return null
  const k = 2 / (p + 1)
  let e = serie.slice(0, p).reduce((a, b) => a + b, 0) / p
  for (let i = p; i < serie.length; i++) e = serie[i] * k + e * (1 - k)
  return e
}

/**
 * Todas las medias pedidas, como listas `{ p, v }`. Un periodo que no se puede
 * calcular sale con `v: null` —no desaparece—, para que la pantalla diga por qué
 * falta en vez de esconderlo.
 */
export function mediasDe(serie, periodos) {
  const sma = (periodos?.sma ?? []).map((p) => ({ p, v: smaUltima(serie, p) }))
  const ema = (periodos?.ema ?? []).map((p) => ({ p, v: emaUltima(serie, p) }))
  return { sma, ema }
}
