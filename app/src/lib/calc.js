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

export function calcularLote({ capital, riesgoPct, pips, par, tasas }) {
  const pip = pipUSD(par, tasas)
  if (!isFinite(capital) || !isFinite(riesgoPct) || !isFinite(pips) || pips <= 0 || !pip) {
    return { ok: false, pip }
  }
  const riesgoUsd = (capital * riesgoPct) / 100
  const lote = riesgoUsd / (pips * pip)
  return {
    ok: true,
    pip,
    riesgoUsd,
    lote,
    bajoMinimo: lote < LOTE_MINIMO,
    riesgoMinimoUsd: LOTE_MINIMO * pips * pip,
    mini: lote * 10,
    micro: lote * 100,
  }
}
