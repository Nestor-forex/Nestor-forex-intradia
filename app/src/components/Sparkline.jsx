// Mini-gráfico de tendencia (sin ejes ni cuadrícula, a propósito: es un
// vistazo rápido, no un gráfico para analizar en detalle). Verde si el
// precio subió en el periodo mostrado, rojo si bajó.

export default function Sparkline({ values, width = 96, height = 30 }) {
  if (!values || values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const stepX = width / (values.length - 1)
  const up = values.at(-1) >= values[0]

  const points = values.map((v, i) => [i * stepX, height - ((v - min) / range) * height])
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L${width.toFixed(2)},${height} L0,${height} Z`

  const stroke = up ? 'var(--green)' : 'var(--red)'
  const fill = up ? 'oklch(0.72 0.13 155 / 0.14)' : 'oklch(0.66 0.13 25 / 0.14)'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
      <path d={areaPath} fill={fill} stroke="none" />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
