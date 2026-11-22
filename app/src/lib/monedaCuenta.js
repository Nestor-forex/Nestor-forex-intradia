// LA MONEDA DE LA CUENTA DE CADA PERSONA: dólares o euros (2026-11-22).
//
// Néstor lo pidió para los suscriptores cuyo bróker les lleva la cuenta en
// euros: «que tenga la opción de trabajar con esa moneda porque su cuenta en
// el bróker es así». Se elige en «Mi perfil de riesgo» y todo lo que es DINERO
// pasa a esa moneda: el lote y el riesgo, los frenos del día, el Diario, el
// dinero de la práctica y lo que se exporta.
//
// ⚠️ LO QUE NO CAMBIA, y es a propósito: los experimentos, el historial y las
// mediciones se cuentan en pips y en unidades de riesgo (R), que valen lo
// mismo en dólares que en euros. Pasarlos a euros no añadiría nada y obligaría
// a tocar números ya medidos.
//
// ⚠️ PARA AÑADIR OTRA MONEDA (la libra, el yen…) basta con ponerla en
// `MONEDAS_CUENTA` y en `SIMBOLO`, y en la regla de `firestore.rules` que la
// comprueba. La conversión sale de las mismas tasas que ya usa la calculadora.
//
// Gemelo: va igual en las dos apps.

/** Las monedas que se pueden elegir, en el orden en que salen en pantalla. */
export const MONEDAS_CUENTA = Object.freeze(['USD', 'EUR'])

/**
 * La de quien no ha elegido. Todos los perfiles anteriores a esta opción se
 * hicieron en dólares, así que «sin elegir» quiere decir dólares.
 */
export const MONEDA_POR_DEFECTO = 'USD'

const SIMBOLO = Object.freeze({ USD: '$', EUR: '€' })

/** ¿Es una de las monedas que se pueden elegir? */
export const esMonedaCuenta = (m) => MONEDAS_CUENTA.includes(m)

/**
 * La moneda que vale para esa persona. Un valor raro o ausente cae en dólares
 * y NO revienta: un perfil viejo sin el campo tiene que seguir funcionando
 * igual que antes.
 */
export function monedaDe(perfil) {
  const m = perfil?.moneda
  return esMonedaCuenta(m) ? m : MONEDA_POR_DEFECTO
}

/** El símbolo de la moneda ($, €). */
export const simbolo = (moneda) => SIMBOLO[moneda] ?? SIMBOLO[MONEDA_POR_DEFECTO]

/**
 * Un importe con su símbolo delante: `$12.50`, `€12.50`. Con `signo`, lleva
 * `+` o `−` (el signo menos de verdad, no el guion). Sin número, `—`.
 */
export function dinero(n, moneda, { signo = false, decimales = 2 } = {}) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  const s = signo ? (n > 0 ? '+' : n < 0 ? '−' : '') : n < 0 ? '−' : ''
  return `${s}${simbolo(moneda)}${Math.abs(n).toFixed(decimales)}`
}

/**
 * Por cuánto hay que multiplicar un importe en dólares para tenerlo en esa
 * moneda. `tasas[c]` son las unidades de `c` que da un dólar (lo que publica
 * el barrido), así que 10 dólares son `10 × tasas.EUR` euros.
 *
 * `null` si no se puede saber: sin la tasa de esa moneda no se convierte nada,
 * porque un lote calculado con una tasa inventada sería un lote equivocado.
 */
export function factorDesdeDolar(moneda, tasas) {
  if (moneda === 'USD') return 1
  if (!esMonedaCuenta(moneda)) return null
  const r = tasas?.[moneda]
  return typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : null
}
