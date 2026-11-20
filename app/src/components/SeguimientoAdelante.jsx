// «Seguimiento hacia adelante» (2026-11-20). Su propia tarjeta, justo debajo
// del laboratorio, y NO dentro de él.
//
// ⚠️ ES GEMELO: lo mismo en las dos apps.
//
// Néstor (2026-11-20): «quiero que esas dos reglas estén en el mismo lugar
// pero separadas, no una dentro de la otra, para que siempre de un solo
// vistazo se distinga una de la otra y sus características propias dentro de
// cada una». Y: «no entiendo muy bien las activaciones. quiero que sea muy
// fácil». Por eso:
//
// ⚠️ LA TARJETA CERRADA DICE EL ESTADO (sin pedir / pedido / activo) en su
// `avance`: no hay que abrirla para saber en qué paso va uno.
// ⚠️ LA ACTIVACIÓN SON TRES PASOS NUMERADOS, con el que toca marcado: pedir →
// el desarrollador lo activa tras el pago → encender hasta MAX_SEGUIDAS reglas.
// ⚠️ PRIMERO QUÉ ES, PARA QUÉ SIRVE Y LO QUE NO HACE; después el botón.
// ⚠️ EL BOTÓN DE SEGUIR UNA REGLA VIVE AQUÍ, no en «Mis reglas» del
// laboratorio: así lo de pago está en un solo sitio.
// ⚠️ LO ACTIVA SOLO EL ADMINISTRADOR (las reglas de Firestore no dejan a la
// persona escribir `seguimientoActivo`).

import { useState } from 'react'
import { useIdioma } from '../lib/i18n'
import TarjetaPlegable from './TarjetaPlegable'
import { MAX_SEGUIDAS, PRECIO_SEGUIMIENTO_USD, pasoActual, resumenAdelante } from '../lib/laboratorio'
import { activarSeguimiento, solicitarSeguimiento } from '../lib/useReglas'
import { CAJA, ROTULO, TEXTO, colorR, fechaCorta, fmtR } from '../lib/laboratorioVista'

/** Lo que dio la regla con velas nuevas (lo escribe el programa del servidor). */
function Adelante({ r, t, locale }) {
  const desde = fechaCorta(r.seguirDesde, locale)
  const res = resumenAdelante(r.adelante?.ops)
  return (
    <div style={{ ...CAJA, borderColor: 'var(--cta)', gap: 4 }}>
      <span style={ROTULO}>{t('lab.adelanteRes')}</span>
      {desde && <span style={{ ...TEXTO, fontSize: 11.5 }}>{t('lab.seguidaDesde', { fecha: desde })}</span>}
      {res.ops === 0 ? (
        <span style={TEXTO}>{t('lab.adelanteSinOps')}</span>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px', fontSize: 12.5 }}>
          <span style={{ color: 'var(--text-muted)' }}>{t('lab.ops')}</span>
          <span className="mono" dir="ltr">{res.ops}</span>
          <span style={{ color: 'var(--text-muted)' }}>{t('lab.acierto')}</span>
          <span className="mono" dir="ltr">{res.acierto}% ±{res.margen}</span>
          <span style={{ color: 'var(--text-muted)' }}>{t('lab.porR')}</span>
          <span className="mono" dir="ltr" style={{ color: colorR(res.porR) }}>{fmtR(res.porR)}</span>
        </div>
      )}
      {r.adelante?.abiertas > 0 && (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {t('lab.abiertas')}: <bdi className="mono">{r.adelante.abiertas}</bdi>
        </span>
      )}
      {res.ops > 0 && res.ops < 150 && <span style={{ ...TEXTO, fontSize: 11.5, color: 'var(--amber)' }}>{t('lab.pocas', { n: res.ops, margen: res.margen })}</span>}
    </div>
  )
}

function Paso({ n, actual, children }) {
  const hecho = actual > n
  const ahora = actual === n
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span
        aria-hidden="true"
        style={{
          flex: '0 0 26px',
          height: 26,
          borderRadius: 13,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          border: `2px solid ${hecho || ahora ? 'var(--cta)' : 'var(--border)'}`,
          background: hecho ? 'var(--cta)' : 'transparent',
          color: hecho ? 'var(--cta-tinta)' : ahora ? 'var(--cta)' : 'var(--text-muted)',
        }}
      >
        {hecho ? '✓' : n}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0, opacity: hecho || ahora ? 1 : 0.6 }}>{children}</div>
    </div>
  )
}

export default function SeguimientoAdelante({ uid, ficha, reglas, seguir, esAdmin, usuarios, nombreDe }) {
  const { t, locale } = useIdioma()
  const [estadoServicio, setEstadoServicio] = useState(null)
  const activo = ficha?.seguimientoActivo === true
  const solicitadoEl = fechaCorta(ficha?.seguimientoSolicitado, locale)
  const seguidas = reglas.filter((r) => r.seguir === true).length
  const actual = pasoActual({ activo, solicitado: !!solicitadoEl, seguidas })
  const pedidos = esAdmin ? (usuarios ?? []).filter((u) => u.seguimientoSolicitado || u.seguimientoActivo === true) : []

  const pedir = async () => {
    setEstadoServicio('guardando')
    setEstadoServicio(await solicitarSeguimiento(uid))
  }

  const estado = activo
    ? t('lab.estadoActivo', { n: seguidas, max: MAX_SEGUIDAS })
    : solicitadoEl
      ? t('lab.estadoPedido', { fecha: solicitadoEl })
      : t('lab.estadoSinPedir')

  return (
    <TarjetaPlegable
      sigla="FORWARD"
      titulo={t('lab.adelanteTitulo')}
      desc={t('lab.adelanteServicio', { precio: PRECIO_SEGUIMIENTO_USD })}
      paraQue={t('lab.adelantePara')}
      avance={<span style={{ fontSize: 12.5, color: 'var(--cta)', fontWeight: 600 }}>📈 {estado}</span>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={TEXTO}>{t('lab.adelanteQue')}</p>
        <p style={TEXTO}>{t('lab.adelantePros')}</p>
        <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t('lab.adelanteNo')}</p>

        <div style={{ ...CAJA, borderColor: 'var(--cta)', borderWidth: 2, gap: 12 }}>
          <strong style={{ fontSize: 14 }}>{t('lab.pasosTitulo')}</strong>
          <Paso n={1} actual={actual}>
            <span style={TEXTO}>{t('lab.pasoA1')}</span>
            {actual === 1 && (
              <button type="button" className="btn btn-primary" disabled={estadoServicio === 'guardando'} onClick={pedir}>
                {t('lab.adelanteSolicitar')}
              </button>
            )}
            {solicitadoEl && <span style={{ ...TEXTO, fontSize: 11.5 }}>{t('lab.pedidoEl', { fecha: solicitadoEl })}</span>}
            {(estadoServicio === 'sinPermiso' || estadoServicio === 'error') && <span style={{ ...TEXTO, color: 'var(--amber)' }}>{t(`lab.estado.${estadoServicio}`)}</span>}
          </Paso>
          <Paso n={2} actual={actual}>
            <span style={TEXTO}>{t('lab.pasoA2', { precio: PRECIO_SEGUIMIENTO_USD })}</span>
          </Paso>
          <Paso n={3} actual={actual}>
            <span style={TEXTO}>{t('lab.pasoA3', { max: MAX_SEGUIDAS })}</span>
          </Paso>
        </div>

        <div style={CAJA}>
          <span style={ROTULO}>{t('lab.tusReglas')}</span>
          {!reglas.length && <p style={TEXTO}>{t('lab.sinReglasAdel')}</p>}
          {reglas.length > 0 && !activo && <p style={{ ...TEXTO, fontSize: 11.5 }}>{t('lab.bloqueadoHasta')}</p>}
          {reglas.map((r) => (
            <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 13 }}>{r.nombre}</strong>
                {activo && (r.seguir || seguidas < MAX_SEGUIDAS) && (
                  <button
                    type="button"
                    className={r.seguir ? 'btn-ghost' : 'btn btn-primary'}
                    style={{ minHeight: 36, padding: '0 12px' }}
                    onClick={() => seguir(r.id, !r.seguir)}
                  >
                    {r.seguir ? t('lab.dejarBtn') : t('lab.seguirBtn')}
                  </button>
                )}
              </div>
              <span style={{ ...TEXTO, fontSize: 11.5 }}>{t(r.seguir ? 'lab.seEstaSiguiendo' : 'lab.noSeSigue')}</span>
              {(r.seguir || r.adelante) && <Adelante r={r} t={t} locale={locale} />}
            </div>
          ))}
          {activo && seguidas >= MAX_SEGUIDAS && <p style={{ ...TEXTO, fontSize: 11.5 }}>{t('lab.maxSeguidas', { max: MAX_SEGUIDAS })}</p>}
        </div>

        {esAdmin && (
          <div style={CAJA}>
            <span style={ROTULO}>{t('lab.adminSeg')}</span>
            {!pedidos.length && <p style={TEXTO}>{t('lab.adminSegNadie')}</p>}
            {pedidos.map((u) => (
              <div key={u.uid} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span style={TEXTO}>
                  {u.seguimientoActivo === true
                    ? t('lab.adminSegActivo', { quien: nombreDe(u.uid) })
                    : t('lab.adminSegPedido', { quien: nombreDe(u.uid), fecha: fechaCorta(u.seguimientoSolicitado, locale) ?? '—' })}
                </span>
                <button type="button" className="btn-ghost" style={{ minHeight: 36, padding: '0 10px' }} onClick={() => activarSeguimiento(u.uid, u.seguimientoActivo !== true)}>
                  {u.seguimientoActivo === true ? t('lab.desactivar') : t('lab.activar')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </TarjetaPlegable>
  )
}
