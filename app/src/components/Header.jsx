import { useT } from '../lib/i18n'
import SelectorIdioma from './SelectorIdioma'
import SelectorVista from './SelectorVista'

export default function Header({ nombreApp, saludo, onSalir, onAprender }) {
  const t = useT()

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* El curso (2026-11-18): un botón siempre a mano, en todas las pestañas. */}
        {onAprender && (
          <button
            type="button"
            className="btn-ghost"
            onClick={onAprender}
            aria-label={t('curso.aprender')}
            title={t('curso.aprender')}
            style={{ padding: '0 10px', color: 'var(--cta)', borderColor: 'var(--cta)' }}
          >
            {t('curso.aprender')}
          </button>
        )}
        <SelectorVista />
        <SelectorIdioma compacto />
        <button className="btn-ghost" onClick={onSalir}>
          {t('comun.salir')}
        </button>
      </div>
    </header>
  )
}
