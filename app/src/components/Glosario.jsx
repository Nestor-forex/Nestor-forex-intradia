import { useState } from 'react'
import { useT } from '../lib/i18n'

export default function Glosario() {
  const t = useT()
  const [abierto, setAbierto] = useState(false)
  const terminos = t('glosario.terminos')

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setAbierto((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 14px',
          background: 'none',
          border: 'none',
          color: 'var(--text)',
          cursor: 'pointer',
          fontSize: 13.5,
          fontWeight: 600,
          minHeight: 44,
        }}
      >
        {t('glosario.titulo')}
        <span style={{ color: 'var(--text-muted)' }}>{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {terminos.map(([term, def]) => (
            <div key={term}>
              <div className="mono" style={{ fontSize: 12.5, fontWeight: 700 }}>
                {term}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{def}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
