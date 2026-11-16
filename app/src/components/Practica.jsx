// «Modo práctica»: las operaciones sin dinero que la app sigue sola, en el
// Diario (punto 5 del plan, 2026-11-16).
//
// ⚠️ EL AVISO VA PRIMERO: esto no es dinero ni una señal. El resultado lo pone
// el programa con precios reales, y la persona no lo puede cambiar.
//
// ⚠️ LAS OPERACIONES SE CREAN EN EL ANALIZADOR, no aquí. Allí ya están el par,
// la dirección, el Stop-loss y el Take-profit con sus cuentas; un formulario
// aparte sería una segunda forma de calcular los niveles que se separaría de la
// primera.
//
// ⚠️ EL ACIERTO NO SE PINTA DE COLOR Y EL RESULTADO SÍ, igual que en «Tus
// números» del Diario: está medido en esta app que se puede acertar más de la
// mitad de las veces y perder.

import { useMemo, useState } from 'react'
import { useT, useIdioma } from '../lib/i18n'
import { APP } from '../lib/identidad'
import { margen } from '../lib/diagnostico'
import { rbDe, resumenPractica } from '../lib/practica'
import TarjetaPlegable from './TarjetaPlegable'

const TEXTO = { fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }
const decDe = (par) => (String(par).includes('JPY') ? 3 : 5)
const fmtR = (r) => `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(2)} R`
const colorR = (r) => (r > 0 ? 'var(--green)' : r < 0 ? 'var(--red)' : 'var(--text-secondary)')

export default function Practica({ ops = [], onBorrar, onIrAnalizar }) {
  const tr = useT()
  const { locale } = useIdioma()
  const res = useMemo(() => resumenPractica(ops), [ops])
  const [porBorrar, setPorBorrar] = useState(null)
  const abiertas = ops.filter((o) => !o.estado)
  const cerradas = ops.filter((o) => o.estado)
  const m = margen(res.resueltas)

  const niveles = (o) => {
    const d = decDe(o.par)
    const rb = rbDe(o)
    return (
      <span className="mono" dir="ltr" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
        {o.entrada.toFixed(d)} · SL {o.sl.toFixed(d)} · TP {o.tp.toFixed(d)}
        {rb !== null ? ` · 1:${rb.toFixed(2)}` : ''}
      </span>
    )
  }
  const cuando = (o) => {
    const ms = o.creado?.toMillis ? o.creado.toMillis() : null
    return ms ? new Date(ms).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) : '…'
  }

  return (
    <TarjetaPlegable
      titulo={tr('prac.titulo')}
      desc={tr('prac.desc')}
      paraQue={tr('prac.paraQue')}
      avance={
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {tr('prac.abiertasL')}{' '}
          <span className="mono" dir="ltr">
            {res.abiertas}
          </span>
          {' · '}
          {tr('prac.resueltasL')}{' '}
          <span className="mono" dir="ltr">
            {res.resueltas}
          </span>
        </span>
      }
    >
      <div>
        {/* ⚠️ PRIMERO, antes de cualquier número. */}
        <div style={{ ...TEXTO, marginTop: 8, color: 'var(--amber)' }}>{tr('prac.aviso')}</div>

        {!ops.length && (
          <div style={{ marginTop: 10 }}>
            <div style={TEXTO}>{tr('prac.vacio')}</div>
            {onIrAnalizar && (
              <button className="btn" type="button" style={{ minHeight: 44, marginTop: 8 }} onClick={onIrAnalizar}>
                {tr('prac.irAnalizar')}
              </button>
            )}
          </div>
        )}

        {res.resueltas > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 10, fontSize: 12.5 }}>
            <span>
              {tr('prac.aciertoL')}{' '}
              <span className="mono" dir="ltr" style={{ fontWeight: 600 }}>
                {Math.round(res.acierto)}%{m !== null ? ` ±${m}` : ''}
              </span>
            </span>
            <span>
              {tr('prac.opsL')}{' '}
              <span className="mono" dir="ltr" style={{ fontWeight: 600 }}>
                {res.ganadas} / {res.resueltas}
              </span>
            </span>
            <span>
              {tr('prac.sumaL')}{' '}
              <span className="mono" dir="ltr" style={{ fontWeight: 600, color: colorR(res.sumaR) }}>
                {fmtR(res.sumaR)}
              </span>
            </span>
            <span>
              {tr('prac.porOpL')}{' '}
              <span className="mono" dir="ltr" style={{ fontWeight: 600, color: colorR(res.porOperacion) }}>
                {fmtR(res.porOperacion)}
              </span>
            </span>
          </div>
        )}
        {res.resueltas > 0 && <div style={{ ...TEXTO, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>{tr('prac.margen')}</div>}

        {abiertas.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{tr('prac.abiertasT')}</div>
            {abiertas.map((o) => (
              <div key={o.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}>
                    <span className="mono" dir="ltr" style={{ fontWeight: 600 }}>
                      {o.par}
                    </span>{' '}
                    {tr(o.lado === 'COMPRA' ? 'prac.compra' : 'prac.venta')}
                    <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}> · {tr('prac.esperando')}</span>
                  </div>
                  <div>{niveles(o)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cuando(o)}</div>
                </div>
                {porBorrar === o.id ? (
                  <button
                    onClick={() => {
                      onBorrar?.(o.id)
                      setPorBorrar(null)
                    }}
                    style={{ minHeight: 44, padding: '0 10px', borderRadius: 8, border: '1px solid var(--red)', background: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    {tr('diario.borrarSeguro')}
                  </button>
                ) : (
                  <button
                    onClick={() => setPorBorrar(o.id)}
                    aria-label={tr('diario.borrar')}
                    style={{ minWidth: 44, minHeight: 44, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 15 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <div style={{ ...TEXTO, fontSize: 11.5, color: 'var(--text-muted)' }}>{tr('prac.soloAbiertas')}</div>
          </div>
        )}

        {cerradas.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{tr('prac.resueltasT')}</div>
            {cerradas.map((o) => (
              <div key={o.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ flex: 1, fontSize: 13 }}>
                    <span className="mono" dir="ltr" style={{ fontWeight: 600 }}>
                      {o.par}
                    </span>{' '}
                    {tr(o.lado === 'COMPRA' ? 'prac.compra' : 'prac.venta')} · {tr(`prac.est_${o.estado}`)}
                  </span>
                  {typeof o.r === 'number' && (
                    <span className="mono" dir="ltr" style={{ fontSize: 13, fontWeight: 600, color: colorR(o.r) }}>
                      {fmtR(o.r)}
                    </span>
                  )}
                </div>
                <div>{niveles(o)}</div>
                {o.estado === 'caducada' && <div style={{ ...TEXTO, fontSize: 11.5 }}>{tr('prac.caducadaD')}</div>}
                {o.estado === 'invalida' && <div style={{ ...TEXTO, fontSize: 11.5 }}>{tr(`prac.motivo_${o.motivo || 'niveles'}`)}</div>}
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {tr('prac.comoSeDecide')}
          {APP === 'intradia' && <> {tr('prac.cruces')}</>}
        </div>
      </div>
    </TarjetaPlegable>
  )
}
