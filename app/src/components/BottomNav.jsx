import { useT } from '../lib/i18n'

// La etiqueta se guarda como clave, no como texto: así se traduce al vuelo
// cuando cambia el idioma, sin reconstruir la lista.
const ITEMS = [
  { tab: 'barrido', icon: '▦', clave: 'nav.barrido' },
  { tab: 'diario', icon: '≡', clave: 'nav.diario' },
  { tab: 'historial', icon: '◷', clave: 'nav.historial' },
  { tab: 'calc', icon: '%', clave: 'nav.riesgo' },
  // Los avisos que programa cada persona. Es una pestaña y no otra tarjeta de
  // la pestaña Barrido por la misma razón que lo son el Diario y la
  // calculadora: es una HERRAMIENTA que se usa, no información que se lee. Y
  // la pestaña Barrido ya lleva ocho tarjetas — una novena la enterraría.
  //
  // ⚠️ La etiqueta tiene que ser CORTA en los 13 idiomas: con el admin son
  // seis pestañas en 390 px, o sea 65 px cada una. Hay una comprobación en el
  // navegador de que ninguna se sale.
  { tab: 'avisos', icon: '◔', clave: 'nav.avisos' },
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
