export function pipUSD(par, tasas) {
  const [, q] = par.split('/')
  if (q === 'USD') return 10
  const pipQuote = q === 'JPY' ? 1000 : 10
  const r = tasas[q]
  return r ? pipQuote / r : null
}

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
    mini: lote * 10,
    micro: lote * 100,
  }
}
