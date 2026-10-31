import { useT } from '../lib/i18n'
import { MODO_MIS, MODO_TODOS } from '../lib/vistaPares'

// VER TODOS LOS PARES O SOLO LOS MÍOS — el control.
//
// Néstor lo pidió así el 2026-10-31: «que el usuario si quiere ver todo el
// barrido lo pueda hacer y si quiere filtrar también, pero que se vea un
// texto que se lo explique, porque sé que hay trader que operan con pocos
// pares, otros solamente con uno y otros con muchos».
//
// ⚠️ EL CONTADOR SE VE SIEMPRE, también sin filtrar. Es lo que impide que
// esto se convierta en un misterio: quien abra la app y vea tres filas lee
// «viendo 3 de 14» justo encima y lo deshace de un toque. Sin él, un filtro
// que alguien puso hace meses se lee como una app rota.
//
// ⚠️ Y LA NOTA DE QUÉ **NO** SE FILTRA NO ES LETRA PEQUEÑA. El ranking de
// fuerza se calcula con las ocho divisas; si se recortara, dejaría de medir
// lo que dice medir. Decirlo en pantalla es lo que distingue «esto no filtra»
// de «esto se nos olvidó filtrar».

function Pastilla({ activo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      style={{
        padding: '5px 12px',
        borderRadius: 999,
        border: `1px solid ${activo ? 'var(--cta)' : 'var(--border)'}`,
        background: activo ? 'var(--cta)' : 'transparent',
        color: activo ? 'var(--cta-tinta)' : 'var(--text-secondary)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

export default function FiltroPares({ resumen, modo, onModo, onIrAvisos }) {
  const t = useT()
  if (!resumen || !resumen.total) return null

  // Sin lista no hay nada que filtrar. Se enseña una sola línea que explica
  // que se puede, porque si no, la pestaña de avisos no se descubre nunca —
  // es el mismo motivo por el que el calendario se mudó de pantalla cuando
  // Néstor preguntó «¿dónde está?».
  if (!resumen.hayLista) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          fontSize: 12,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}
      >
        <span>{t('vista.sinLista', { total: resumen.total })}</span>
        {onIrAvisos && (
          <button type="button" className="btn-ghost" style={{ minHeight: 30, padding: '0 12px', fontSize: 12 }} onClick={onIrAvisos}>
            {t('vista.elegir')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
          {t('vista.viendo', { viendo: resumen.viendo, total: resumen.total })}
        </span>
        <div style={{ display: 'flex', gap: 6, marginInlineStart: 'auto' }}>
          <Pastilla activo={modo === MODO_MIS} onClick={() => onModo(MODO_MIS)}>
            {t('vista.mis', { n: resumen.elegidos })}
          </Pastilla>
          <Pastilla activo={modo === MODO_TODOS} onClick={() => onModo(MODO_TODOS)}>
            {t('vista.todos', { n: resumen.total })}
          </Pastilla>
        </div>
      </div>

      {/* Una lista que no coincide con ningún par del barrido de hoy dejaría
          la pantalla en blanco sin explicación. Pasa con un par que se quitó
          de la app, o con un barrido viejo guardado sin conexión. */}
      {resumen.vacio && <p style={{ margin: 0, fontSize: 12, color: 'var(--amber)', lineHeight: 1.5 }}>{t('vista.vacio')}</p>}

      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('vista.nota')}</p>
    </div>
  )
}
