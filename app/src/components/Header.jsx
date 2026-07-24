export default function Header({ nombreApp, saludo, onSalir }) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        background: 'var(--bg-surface)',
        zIndex: 5,
      }}
    >
      <div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{nombreApp}</div>
        <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {saludo}
        </div>
      </div>
      <button className="btn-ghost" onClick={onSalir}>
        Salir
      </button>
    </header>
  )
}
