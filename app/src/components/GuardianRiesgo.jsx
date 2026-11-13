// «Tu freno de hoy»: el guardián de riesgo, arriba del Diario.
//
// ⚠️ NO ES UNA TARJETA PLEGABLE, a propósito. Un freno escondido detrás de un
// «Ver» no frena nada: tiene que leerse al entrar al Diario sin tocar nada.
//
// ⚠️ SOLO AVISA. La app no está conectada al bróker y no puede impedir nada; el
// pie lo dice con esas palabras para que nadie crea que está protegido por algo
// que no existe.
//
// ⚠️ EL RESUMEN VA COMO «RÓTULO: NÚMERO» y los dos números como «x / y», sin
// ninguna palabra entre ellos. «Llevas 1 pérdidas seguidas» es el fallo de
// concordancia que ya salió tres veces en este repositorio.
//
// ⚠️ EL ROJO AQUÍ SÍ SIGNIFICA ALGO EN PLATA: es dinero perdido frente a la
// regla de la persona. Es la decisión de `SetupDetalle`, no la de `Correlacion`.

import { useMemo } from 'react'
import { useT } from '../lib/i18n'
import { estadoDelDia } from '../lib/guardianRiesgo'

const TEXTO = { fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }
const dolares = (n) => '$' + n.toFixed(2)
const COLOR = { ok: 'var(--text-muted)', cerca: 'var(--amber)', freno: 'var(--red)' }

export default function GuardianRiesgo({ trades, perfil, onIrAlPerfil }) {
  const tr = useT()
  const e = useMemo(() => estadoDelDia(trades, perfil), [trades, perfil])

  if (e.estado === 'sinPerfil') {
    return (
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{tr('guardian.titulo')}</div>
        <p style={TEXTO}>{tr('guardian.sinPerfil')}</p>
        {onIrAlPerfil && (
          <button className="btn" style={{ minHeight: 44 }} onClick={onIrAlPerfil}>
            {tr('guardian.irPerfil')}
          </button>
        )}
      </div>
    )
  }

  const color = COLOR[e.estado]
  const lleno = e.limiteUsd > 0 ? Math.min(1, e.perdido / e.limiteUsd) : 0

  return (
    <div
      className="card"
      style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, borderColor: e.estado === 'ok' ? undefined : color }}
    >
      <div style={{ fontSize: 14, fontWeight: 600 }}>{tr('guardian.titulo')}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 12px', fontSize: 13, alignItems: 'baseline' }}>
        <span style={{ color: 'var(--text-muted)' }}>{tr('guardian.perdidoHoy')}</span>
        <span className="mono" dir="ltr" style={{ fontVariantNumeric: 'tabular-nums', color: e.frenoDia ? color : 'var(--text)' }}>
          {dolares(e.perdido)} / {dolares(e.limiteUsd)}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>{tr('guardian.seguidas')}</span>
        <span className="mono" dir="ltr" style={{ fontVariantNumeric: 'tabular-nums', color: e.frenoRacha ? color : 'var(--text)' }}>
          {e.racha} / {e.maxRacha}
        </span>
      </div>

      {/* La barra se llena desde el lado donde empieza la lectura: desde la
          izquierda en español y desde la derecha en árabe. No lleva número
          dentro, así que no hay nada que se pueda dibujar al revés. */}
      <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
        <div style={{ width: `${lleno * 100}%`, height: '100%', background: e.estado === 'ok' ? 'var(--text-muted)' : color }} />
      </div>

      {e.estado === 'freno' && (
        <p style={{ ...TEXTO, color, fontWeight: 600 }}>
          {[e.frenoDia && tr('guardian.motivoDia'), e.frenoRacha && tr('guardian.motivoRacha')].filter(Boolean).join(' ')} {tr('guardian.freno')}
        </p>
      )}
      {e.estado === 'cerca' && (
        <p style={{ ...TEXTO, color }}>
          {e.cercaDia && tr('guardian.cercaDia', { margen: dolares(e.margen) })}
          {e.cercaDia && e.cercaRacha && ' '}
          {e.cercaRacha && tr('guardian.cercaRacha')}
        </p>
      )}

      <p style={{ ...TEXTO, fontSize: 11.5, color: 'var(--text-muted)' }}>{tr('guardian.pie')}</p>
    </div>
  )
}
