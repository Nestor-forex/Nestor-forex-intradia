import { barWidth, scoreColor } from '../lib/display'

export default function BarraFuerza({ cod, score, compact }) {
  return (
    <div
      className="mono"
      // ⚠️ `ltr` FIJO, y aquí va en el contenedor entero y no en cada trozo:
      // dentro no hay ni una palabra traducida — solo el código de la divisa,
      // que es jerga invariante, y su número. En árabe la raíz se pone en
      // `rtl` y sin esto pasaban dos cosas a la vez: el número se dibujaba al
      // revés y **la barra crecía desde el otro lado**, que es peor, porque
      // una barra que llena hacia la izquierda se lee como lo contrario de lo
      // que dice. Octava vez que este fallo aparece en el proyecto.
      dir="ltr"
      style={{
        display: 'grid',
        gridTemplateColumns: compact ? '42px 1fr 40px' : '44px 1fr 52px',
        alignItems: 'center',
        gap: 10,
        fontSize: 13,
      }}
    >
      <span style={{ fontWeight: 600 }}>{cod}</span>
      <div style={{ height: compact ? 9 : 10, background: 'oklch(0.24 0.015 255)', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 5, width: barWidth(score), background: scoreColor(score) }} />
      </div>
      <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{score.toFixed(1)}</span>
    </div>
  )
}
