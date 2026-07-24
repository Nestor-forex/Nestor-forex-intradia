export default function Pendiente({ nombreApp, mensaje, onSalir }) {
  return (
    <div style={{ flex: 1, padding: '48px 24px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div className="eyebrow" style={{ fontSize: 11 }}>
          TRADING · FX
        </div>
        <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700 }}>{nombreApp}</h1>
      </div>

      <div className="card" style={{ marginTop: 12, borderColor: 'oklch(0.4 0.06 85)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--amber)' }}>Solicitud pendiente</div>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{mensaje}</p>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Esta pantalla se actualiza sola: en cuanto Néstor apruebe tu solicitud, entrarás automáticamente sin tener que hacer nada
        más.
      </p>

      <button className="btn-ghost" style={{ marginTop: 'auto' }} onClick={onSalir}>
        Salir
      </button>
    </div>
  )
}
