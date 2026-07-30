import { useT } from '../lib/i18n'
import SelectorIdioma from './SelectorIdioma'

export default function Pendiente({ nombreApp, onSalir }) {
  const t = useT()

  return (
    <div style={{ flex: 1, padding: '48px 24px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ fontSize: 11 }}>
            {t('comun.eyebrow')}
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700 }}>{nombreApp}</h1>
        </div>
        <div style={{ marginInlineStart: 'auto' }}>
          <SelectorIdioma compacto />
        </div>
      </div>

      <div className="card" style={{ marginTop: 12, borderColor: 'oklch(0.4 0.06 85)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--amber)' }}>{t('pendiente.titulo')}</div>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{t('pendiente.mensaje')}</p>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('pendiente.nota')}</p>

      <button className="btn-ghost" style={{ marginTop: 'auto' }} onClick={onSalir}>
        {t('comun.salir')}
      </button>
    </div>
  )
}
