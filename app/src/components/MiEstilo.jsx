// «¿Cómo operas?» — el arranque por tipo de trading (2026-11-17).
//
// Dos formas:
//  - `tarjeta`: en el Barrido, la primera vez (mientras no haya respondido).
//  - `linea`: en el Analizador, para ver y cambiar el estilo cuando quiera.
//
// ⚠️ EL AVISO VA ANTES DE LOS BOTONES: esto no cambia ninguna señal, solo con
// qué herramientas arranca el Analizador. Y no dice qué estilo es mejor.

import { useState } from 'react'
import { useT } from '../lib/i18n'
import { ESTILOS } from '../lib/estilo'

const TEXTO = { margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }

function Opcion({ id, activo, onClick, t, conDesc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      style={{
        textAlign: 'start',
        minHeight: 44,
        padding: '8px 12px',
        borderRadius: 10,
        border: `1px solid ${activo ? 'var(--cta)' : 'var(--border-strong)'}`,
        background: activo ? 'var(--cta)' : 'none',
        color: activo ? 'var(--cta-tinta)' : 'var(--text)',
        cursor: 'pointer',
        font: 'inherit',
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t(`estilo.${id}T`)}</div>
      {conDesc && <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2, lineHeight: 1.45 }}>{t(`estilo.${id}D`)}</div>}
    </button>
  )
}

export default function MiEstilo({ estilo, guardar, modo = 'tarjeta', onElegido }) {
  const t = useT()
  const [estado, setEstado] = useState(null)
  const [abierto, setAbierto] = useState(false)

  const elegir = async (id) => {
    setEstado('guardando')
    const r = await guardar(id)
    if (r?.ok) {
      setEstado(null)
      setAbierto(false)
      onElegido?.(id)
    } else setEstado(r?.codigo === 'sinPermiso' ? 'sinPermiso' : 'error')
  }
  const fallo = estado === 'sinPermiso' || estado === 'error' ? <p style={{ ...TEXTO, fontSize: 12, color: 'var(--amber)' }}>{t(estado === 'sinPermiso' ? 'estilo.sinPermiso' : 'estilo.error')}</p> : null

  if (modo === 'linea') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={TEXTO}>
          {t('estilo.tuEstilo')} <strong>{estilo ? t(`estilo.${estilo}T`) : t('estilo.sinElegir')}</strong>{' '}
          <button type="button" onClick={() => setAbierto((x) => !x)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--cta)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}>
            {abierto ? t('estilo.cerrar') : t('estilo.cambiar')}
          </button>
        </p>
        {abierto && (
          <>
            <p style={{ ...TEXTO, fontSize: 12, color: 'var(--text-muted)' }}>{t('estilo.aviso')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ESTILOS.map((id) => (
                <Opcion key={id} id={id} activo={estilo === id} onClick={() => elegir(id)} t={t} conDesc={false} />
              ))}
            </div>
            {fallo}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--cta)' }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{t('estilo.titulo')}</div>
      {/* ⚠️ PRIMERO el aviso, antes de cualquier botón. */}
      <p style={TEXTO}>{t('estilo.aviso')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ESTILOS.map((id) => (
          <Opcion key={id} id={id} activo={estilo === id} onClick={() => elegir(id)} t={t} conDesc />
        ))}
      </div>
      {fallo}
      <p style={{ ...TEXTO, fontSize: 11.5, color: 'var(--text-muted)' }}>{t('estilo.nota')}</p>
    </div>
  )
}
