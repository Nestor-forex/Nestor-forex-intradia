import { MONEDA_POR_DEFECTO, factorDesdeDolar } from './monedaCuenta.js'

export function pipUSD(par, tasas) {
  const [, q] = par.split('/')
  if (q === 'USD') return 10
  const pipQuote = q === 'JPY' ? 1000 : 10
  const r = tasas[q]
  return r ? pipQuote / r : null
}

/**
 * El lote más pequeño que suele dejar abrir un bróker: 0,01 (un microlote).
 *
 * ⚠️ Con un Stop-loss muy lejano, el lote que arriesga lo pedido sale por
 * debajo de esto, y redondeado a dos decimales se leía «0.00 · $10.00»: un
 * lote que no se puede abrir junto a un riesgo que no se puede cumplir. Por
 * eso `calcularLote` dice `bajoMinimo` y cuánto se arriesgaría con 0,01.
 */
export const LOTE_MINIMO = 0.01

/**
 * El lote que arriesga lo pedido.
 *
 * `moneda` es la de la cuenta de la persona (dólares o euros, ver
 * `monedaCuenta.js`). El capital va en esa moneda, y el valor del pip se pasa
 * a ella con las mismas tasas: así el riesgo y el lote salen en la moneda en
 * que su bróker le lleva la cuenta.
 *
 * ⚠️ Los nombres `riesgoUsd` y `riesgoMinimoUsd` se quedan por compatibilidad
 * (la práctica guarda `riesgoUsd` en Firestore), pero desde el 2026-11-22 van
 * EN LA MONEDA DE LA CUENTA, que se devuelve en `moneda`.
 */
export function calcularLote({ capital, riesgoPct, pips, par, tasas, moneda = MONEDA_POR_DEFECTO }) {
  const pipDolar = pipUSD(par, tasas)
  const factor = factorDesdeDolar(moneda, tasas)
  const pip = pipDolar && factor ? pipDolar * factor : null
  if (!isFinite(capital) || !isFinite(riesgoPct) || !isFinite(pips) || pips <= 0 || !pip) {
    return { ok: false, pip, moneda }
  }
  const riesgoUsd = (capital * riesgoPct) / 100
  const lote = riesgoUsd / (pips * pip)
  return {
    ok: true,
    moneda,
    pip,
    riesgoUsd,
    lote,
    bajoMinimo: lote < LOTE_MINIMO,
    riesgoMinimoUsd: LOTE_MINIMO * pips * pip,
    mini: lote * 10,
    micro: lote * 100,
  }
}
