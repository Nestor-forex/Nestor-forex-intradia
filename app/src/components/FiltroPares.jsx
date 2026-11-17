import { useState } from 'react'
import { useT } from '../lib/i18n'
import { MODO_MIS, MODO_TODOS, arranqueCerrado, cerrarArranque, divisasDe, paresConDivisas } from '../lib/vistaPares'

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

// EL ARRANQUE GUIADO — la primera vez, en vez de una lista vacía.
//
// Pregunta qué DIVISAS sigue la persona y le propone sus pares de un toque.
// ⚠️ No propone ningún par por su cuenta: agrupar por divisa es un hecho del
// nombre del par, no una opinión (ver `paresConDivisas` en `vistaPares.js`).
// ⚠️ Se puede cerrar sin elegir nada, y entonces queda la línea de siempre:
// ver los catorce o dieciocho pares es una elección tan válida como filtrar.
function Arranque({ total, pares, onSeguir, onIrAvisos, onCerrar }) {
  const t = useT()
  const divisas = divisasDe(pares)
  const [elegidas, setElegidas] = useState([])
  const [estado, setEstado] = useState(null)
  const propuestos = paresConDivisas(elegidas, pares)

  const alternar = (d) => setElegidas((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d]))
  const seguir = async () => {
    if (!propuestos.length) return
    setEstado('guardando')
    const r = await onSeguir(propuestos)
    // ⚠️ Solo se cierra si se GUARDÓ. Cerrarlo con un fallo dejaría a la
    // persona creyendo que eligió, con la app enseñando todos los pares.
    if (r?.ok) {
      cerrarArranque()
      onCerrar()
    } else setEstado(r?.codigo === 'sinPermiso' ? 'sinPermiso' : 'error')
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--cta)' }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{t('vista.arrTitulo')}</div>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{t('vista.arrDesc', { total })}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {divisas.map((d) => (
          <Pastilla key={d} activo={elegidas.includes(d)} onClick={() => alternar(d)}>
            <span dir="ltr">{d}</span>
          </Pastilla>
        ))}
      </div>
      {propuestos.length > 0 && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {t('vista.arrQuedan', { n: propuestos.length })}{' '}
          <span dir="ltr" className="mono">{propuestos.join(' · ')}</span>
        </p>
      )}
      {estado === 'sinPermiso' && <p style={{ margin: 0, fontSize: 12, color: 'var(--amber)' }}>{t('vista.arrSinPermiso')}</p>}
      {estado === 'error' && <p style={{ margin: 0, fontSize: 12, color: 'var(--amber)' }}>{t('vista.arrError')}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '0 16px', fontSize: 14, opacity: propuestos.length ? 1 : 0.5 }}
          disabled={!propuestos.length || estado === 'guardando'}
          onClick={seguir}
        >
          {t('vista.arrSeguir', { n: propuestos.length })}
        </button>
        {onIrAvisos && (
          <button type="button" className="btn-ghost" onClick={onIrAvisos}>
            {t('vista.arrUnoPorUno')}
          </button>
        )}
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            cerrarArranque()
            onCerrar()
          }}
        >
          {t('vista.arrTodos')}
        </button>
      </div>
      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('vista.arrNota')}</p>
    </div>
  )
}


// CAMBIAR MIS PARES — desde el mismo Barrido, sin ir a otra pestaña.
//
// Néstor lo pidió el 2026-11-17: «hay trader que siempre operan con el mismo
// activo… pero hay otros que sí les gusta operar y analizar diferentes divisas
// y pares al día, y mis apps deben proporcionar ese derecho y facilidad».
// Hasta hoy el Barrido solo dejaba pasar de «Mis pares» a «Todos»; para cambiar
// la lista había que ir a «Avisos», y eso se leía como «no cambia nunca».
//
// ⚠️ Guarda en la MISMA lista que «Mis avisos» (`seguir`): dos listas de
// «mis pares» se separarían sin que nada fallara.
// ⚠️ Solo se cierra si se GUARDÓ, igual que el arranque.
function Editor({ pares, seguimiento, onSeguir, onCerrar, onModo }) {
  const t = useT()
  const [elegidos, setElegidos] = useState(() => (Array.isArray(seguimiento) ? seguimiento.filter((p) => pares.includes(p)) : []))
  const [estado, setEstado] = useState(null)
  const alternar = (p) => setElegidos((xs) => (xs.includes(p) ? xs.filter((x) => x !== p) : [...xs, p]))
  const guardar = async (lista) => {
    setEstado('guardando')
    const r = await onSeguir(lista)
    if (r?.ok) {
      // Con lista se ven los suyos; sin lista no hay nada que filtrar.
      onModo?.(lista.length ? MODO_MIS : MODO_TODOS)
      onCerrar()
    } else setEstado(r?.codigo === 'sinPermiso' ? 'sinPermiso' : 'error')
  }
  const ordenados = [...elegidos].sort((a, b) => pares.indexOf(a) - pares.indexOf(b))

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--cta)' }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{t('vista.editTitulo')}</div>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{t('vista.editDesc')}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {pares.map((p) => (
          <Pastilla key={p} activo={elegidos.includes(p)} onClick={() => alternar(p)}>
            <span dir="ltr">{p}</span>
          </Pastilla>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {elegidos.length ? (
          <>
            {t('vista.editElegidos', { n: elegidos.length })}{' '}
            <span dir="ltr" className="mono">{ordenados.join(' · ')}</span>
          </>
        ) : (
          t('vista.editNinguno')
        )}
      </p>
      {estado === 'sinPermiso' && <p style={{ margin: 0, fontSize: 12, color: 'var(--amber)' }}>{t('vista.arrSinPermiso')}</p>}
      {estado === 'error' && <p style={{ margin: 0, fontSize: 12, color: 'var(--amber)' }}>{t('vista.arrError')}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '0 16px', fontSize: 14 }}
          disabled={estado === 'guardando'}
          onClick={() => guardar(ordenados)}
        >
          {elegidos.length ? t('vista.editGuardar', { n: elegidos.length }) : t('vista.editGuardarTodos')}
        </button>
        <button type="button" className="btn-ghost" disabled={estado === 'guardando'} onClick={onCerrar}>
          {t('vista.editCancelar')}
        </button>
      </div>
      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('vista.editNota')}</p>
    </div>
  )
}

export default function FiltroPares({ resumen, modo, onModo, onIrAvisos, pares, onSeguir, seguimiento }) {
  const t = useT()
  const [cerrado, setCerrado] = useState(arranqueCerrado)
  const [editando, setEditando] = useState(false)
  if (!resumen || !resumen.total) return null
  const puedeEditar = onSeguir && Array.isArray(pares) && pares.length > 0

  if (editando && puedeEditar) {
    return <Editor pares={pares} seguimiento={seguimiento} onSeguir={onSeguir} onModo={onModo} onCerrar={() => setEditando(false)} />
  }

  if (!resumen.hayLista && !cerrado && onSeguir && Array.isArray(pares) && pares.length) {
    return <Arranque total={resumen.total} pares={pares} onSeguir={onSeguir} onIrAvisos={onIrAvisos} onCerrar={() => setCerrado(true)} />
  }

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
        {(puedeEditar || onIrAvisos) && (
          <button
            type="button"
            className="btn-ghost"
            style={{ minHeight: 30, padding: '0 12px', fontSize: 12 }}
            onClick={puedeEditar ? () => setEditando(true) : onIrAvisos}
          >
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
      {puedeEditar && (
        <button
          type="button"
          className="btn-ghost"
          style={{ alignSelf: 'flex-start', minHeight: 30, padding: '0 12px', fontSize: 12 }}
          onClick={() => setEditando(true)}
        >
          {t('vista.cambiar')}
        </button>
      )}

      {resumen.vacio && <p style={{ margin: 0, fontSize: 12, color: 'var(--amber)', lineHeight: 1.5 }}>{t('vista.vacio')}</p>}

      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('vista.nota')}</p>
    </div>
  )
}
