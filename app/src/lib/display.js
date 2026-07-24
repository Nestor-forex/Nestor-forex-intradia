export function sesgoColor(sesgo) {
  if (sesgo === 'COMPRA') return 'var(--green)'
  if (sesgo === 'VENTA') return 'var(--red)'
  if (sesgo === 'VIGILAR') return 'var(--amber)'
  return 'var(--text-muted)'
}

export function tendColor(tend) {
  if (tend === 'Alcista') return 'var(--green)'
  if (tend === 'Bajista') return 'var(--red)'
  return 'var(--text-muted)'
}

export function rsiColor(rsi) {
  return rsi > 70 || rsi < 30 ? 'var(--amber)' : 'var(--text-secondary)'
}

export function scoreColor(score) {
  if (score >= 6.5) return 'var(--green)'
  if (score <= 3.5) return 'var(--red)'
  return 'var(--gray-mid)'
}

export function barWidth(score) {
  return Math.max(3, score * 10).toFixed(0) + '%'
}

export function fmtDif(dif) {
  return (dif >= 0 ? '+' : '') + dif.toFixed(1)
}
