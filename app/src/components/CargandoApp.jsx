export default function CargandoApp({ nombreApp }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div className="eyebrow" style={{ fontSize: 11 }}>
          TRADING · FX
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '0.02em' }}>{nombreApp}</h1>
      </div>
      <div className="nf-loading-bars">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}
