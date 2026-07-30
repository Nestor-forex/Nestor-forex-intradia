import { useT } from '../lib/i18n'

// La etiqueta se guarda como clave, no como texto: así se traduce al vuelo
// cuando cambia el idioma, sin reconstruir la lista.
const ITEMS = [
  { tab: 'barrido', icon: '▦', clave: 'nav.barrido' },
  { tab: 'diario', icon: '≡', clave: 'nav.diario' },
  { tab: 'calc', icon: '%', clave: 'nav.riesgo' },
]

export default function BottomNav({ tab, onTab, esAdmin }) {
  const t = useT()
  const items = esAdmin ? [...ITEMS, { tab: 'admin', icon: '⚙', clave: 'nav.miembros' }] : ITEMS

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        display: 'flex',
        background: 'oklch(0.14 0.015 255)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 10,
      }}
    >
      {items.map((it) => (
        <button
          key={it.tab}
          onClick={() => onTab(it.tab)}
          style={{
            flex: 1,
            minHeight: 60,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            color: tab === it.tab ? 'var(--green)' : 'oklch(0.55 0.02 255)',
            fontSize: 11.5,
            fontWeight: 600,
          }}
        >
          <span className="mono" style={{ fontSize: 17 }}>
            {it.icon}
          </span>
          {t(it.clave)}
        </button>
      ))}
    </nav>
  )
}
