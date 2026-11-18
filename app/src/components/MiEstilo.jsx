// «¿Cómo operas?» — el arranque por tipo de trading (2026-11-17).
//
// Dos formas:
//  - `tarjeta`: en el Barrido, SIEMPRE a la vista (2026-11-18, pedido de
//    Néstor). Sin estilo elegido sale entera; con estilo, en una línea con el
//    botón «Cambiar», que la abre otra vez con las cuatro opciones.
//  - `linea`: en el Analizador, la misma línea sin marco de tarjeta.
//
// ⚠️ EL AVISO VA ANTES DE LOS BOTONES: esto no cambia ninguna señal, solo con
// qué herramientas arranca el Analizador. Y no dice qué estilo es mejor.

import { useState } from 'react'
import { useT } from '../lib/i18n'
import { ESTILOS } from '../lib/estilo'

const TEXTO = { margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }

// Un botón que se vea botón: relleno del color de la marca, como la pastilla
// «Ver» de las tarjetas plegables. Un enlace subrayado de letra pequeña no
// dice «tócame».
function Pastilla({ onClick, children, hueca }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 32,
        padding: '4px 12px',
        borderRadius: 999,
        border: '1px solid var(--cta)',
        background: hueca ? 'none' : 'var(--cta)',
        color: hueca ? 'var(--cta)' : 'var(--cta-tinta)',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 12.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

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

  // Sin estilo elegido, en el Barrido las opciones se ven sin tener que abrir.
  const verOpciones = abierto || (modo === 'tarjeta' && !estilo)
  const enTarjeta = modo === 'tarjeta'

  const linea = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      <p style={{ ...TEXTO, flex: '1 1 auto' }}>
        {t('estilo.tuEstilo')} <strong style={{ color: 'var(--text)' }}>{estilo ? t(`estilo.${estilo}T`) : t('estilo.sinElegir')}</strong>
      </p>
      {(estilo || !enTarjeta) && (
        <Pastilla hueca={abierto} onClick={() => setAbierto((x) => !x)}>
          {abierto ? t('estilo.cerrar') : t('estilo.cambiar')}
        </Pastilla>
      )}
    </div>
  )

  const opciones = verOpciones && (
    <>
      {/* ⚠️ PRIMERO el aviso, antes de cualquier botón. */}
      <p style={{ ...TEXTO, fontSize: 12, color: 'var(--text-muted)' }}>{t('estilo.aviso')}</p>
      <div style={{ display: 'flex', flexDirection: enTarjeta ? 'column' : 'row', flexWrap: 'wrap', gap: enTarjeta ? 8 : 6 }}>
        {ESTILOS.map((id) => (
          <Opcion key={id} id={id} activo={estilo === id} onClick={() => elegir(id)} t={t} conDesc={enTarjeta} />
        ))}
      </div>
      {fallo}
      <p style={{ ...TEXTO, fontSize: 11.5, color: 'var(--text-muted)' }}>{t('estilo.alCambiar')}</p>
    </>
  )

  if (!enTarjeta) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {linea}
        {opciones}
      </div>
    )
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, border: `1px solid ${estilo ? 'var(--border-strong)' : 'var(--cta)'}` }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{t('estilo.titulo')}</div>
      {estilo && linea}
      {opciones}
      {(!estilo || abierto) && <p style={{ ...TEXTO, fontSize: 11.5, color: 'var(--text-muted)' }}>{t('estilo.nota')}</p>}
    </div>
  )
}
