// «Laboratorio: prueba tu propia regla» (2026-11-18). Va al final del
// Analizador, plegado.
//
// ⚠️ ES GEMELO: lo mismo en las dos apps. La diferencia (velas diarias o de
// una hora) la pone el archivo de historia de cada app, no este componente.
//
// Lo que no hay que ablandar:
//
// ⚠️ EL AVISO VA ANTES DE CUALQUIER CONTROL: probar muchas variantes sobre los
// mismos datos acaba encontrando una que «gana» por casualidad, y una regla
// que ganó en el pasado no es una señal.
// ⚠️ LA APP NO ELIGE EL LADO: sin COMPRA o VENTA no se prueba nada.
// ⚠️ CADA PRUEBA SE CUENTA y el número se enseña al lado del resultado.
// ⚠️ ANTES DE GUARDAR SE DICE que el desarrollador de la app puede ver las
// reglas guardadas, y la persona decide con una casilla (sin marcar por
// defecto) si le da permiso para copiarlas y probarlas con otras medidas.
// ⚠️ EL SEGUIMIENTO HACIA ADELANTE ES UN SERVICIO APARTE: primero se explica
// qué es, para qué sirve y cómo lo usan los profesionales, y solo después va
// el botón de pedir la activación. Lo activa el administrador.
// ⚠️ EL ACIERTO NO SE PINTA DE COLOR; el resultado en R sí (es dinero).

import { useMemo, useState } from 'react'
import { useIdioma } from '../lib/i18n'
import TarjetaPlegable from './TarjetaPlegable'
import {
  MAX_CONDICIONES,
  MAX_SEGUIDAS,
  OBJETIVOS_RB,
  PRECIO_SEGUIMIENTO_USD,
  REGLA_INICIAL,
  RIESGOS_ATR,
  TIPOS_CONDICION,
  aciertoDeEquilibrio,
  contarPrueba,
  fichaParaGuardar,
  probarRegla,
  resumenAdelante,
} from '../lib/laboratorio'
import { useHistoria } from '../lib/useHistoria'
import { activarSeguimiento, copiarRegla, informarAutor, solicitarSeguimiento, useReglas, useReglasTodas } from '../lib/useReglas'
import { useMembers } from '../lib/useMembers'
import { ADMIN_EMAIL } from '../lib/firebase'
import { APP, clave } from '../lib/identidad'
import { spreadDe } from '../../scripts/lib/costes.mjs'

// Lo que puede salir al guardar; lo demás son errores de la regla (`lab.error`).
const ESTADOS = ['ok', 'sinPermiso', 'error', 'sinNombre']

const TEXTO = { fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }
const ROTULO = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }
const CAJA = { padding: 12, borderRadius: 10, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }

const CONDICION_NUEVA = {
  rsi: { tipo: 'rsi', op: '<=', valor: 30 },
  media: { tipo: 'media', media: 'ema', periodo: 50, lado: 'encima' },
  extremo: { tipo: 'extremo', extremo: 'minimo', n: 10 },
  bollinger: { tipo: 'bollinger', op: '<=', valor: 0 },
}

function Chip({ activo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      style={{
        minHeight: 36,
        padding: '6px 12px',
        borderRadius: 18,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        border: `1px solid ${activo ? 'var(--cta)' : 'var(--border)'}`,
        background: activo ? 'var(--cta)' : 'transparent',
        color: activo ? 'var(--cta-tinta)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  )
}

const leerProbadas = () => {
  try {
    const n = Number(localStorage.getItem(clave('lab_probadas')))
    return Number.isInteger(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

const fmtR = (v) => (v === null || v === undefined ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)} R`)
const colorR = (v) => (v === null || v === undefined ? 'var(--text-secondary)' : v >= 0 ? 'var(--green)' : 'var(--red)')

/** Fecha corta de un Timestamp de Firestore (o null si no hay). */
function fechaCorta(ts, locale) {
  const d = ts?.toDate ? ts.toDate() : null
  return d ? d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : null
}

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

/** El informe que el desarrollador le manda al autor. */
function Informe({ informe, t }) {
  return (
    <div style={{ ...CAJA, borderColor: 'var(--cta)', borderWidth: 2, gap: 4 }}>
      <strong style={{ fontSize: 13 }}>📩 {t('lab.informeTitulo')}</strong>
      <p style={{ ...TEXTO, whiteSpace: 'pre-wrap' }}>{informe.texto}</p>
      {informe.metricas && (
        <>
          <span style={ROTULO}>{t('lab.informeMetricas')}</span>
          <p style={{ ...TEXTO, whiteSpace: 'pre-wrap' }}>{informe.metricas}</p>
        </>
      )}
      <p style={{ ...TEXTO, fontSize: 11.5, color: 'var(--amber)' }}>{t('lab.informeAviso')}</p>
    </div>
  )
}

/** Administrador: escribirle el resultado al autor de una regla. */
function FormInforme({ r, t }) {
  const [texto, setTexto] = useState('')
  const [metricas, setMetricas] = useState('')
  const [estado, setEstado] = useState(null)
  const enviar = async () => {
    if (!texto.trim()) return
    setEstado('guardando')
    setEstado(await informarAutor(r.uid, r.id, texto.trim(), metricas.trim()))
  }
  return (
    <details>
      <summary style={{ ...TEXTO, cursor: 'pointer', fontWeight: 600 }}>{t('lab.informar')}</summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
        <textarea className="field" rows={3} maxLength={2000} placeholder={t('lab.informeTexto')} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <textarea className="field" rows={3} maxLength={2000} placeholder={t('lab.informeMedidas')} value={metricas} onChange={(e) => setMetricas(e.target.value)} />
        <button type="button" className="btn-ghost" style={{ minHeight: 40 }} disabled={!texto.trim() || estado === 'guardando'} onClick={enviar}>
          {t('lab.enviar')}
        </button>
        {estado === 'ok' && <span style={TEXTO}>{t('lab.informeEnviado')}</span>}
        {(estado === 'sinPermiso' || estado === 'error') && <span style={{ ...TEXTO, color: 'var(--amber)' }}>{t(`lab.estado.${estado}`)}</span>}
      </div>
    </details>
  )
}

/** La condición en una frase corta, en el idioma de quien mira. */
function textoCondicion(c, t) {
  if (c.tipo === 'rsi') return t('lab.txtRsi', { op: c.op === '<=' ? '≤' : '≥', valor: c.valor })
  if (c.tipo === 'bollinger') return t('lab.txtBoll', { op: c.op === '<=' ? '≤' : '≥', valor: c.valor })
  if (c.tipo === 'media') return t(`lab.txtMedia.${c.lado}`, { media: c.media.toUpperCase(), periodo: c.periodo })
  if (c.tipo === 'extremo') return t(`lab.txtExtremo.${c.extremo}`, { n: c.n })
  return '?'
}

function EditorCondicion({ c, onCambio, onQuitar, t }) {
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : v)
  const sel = (valor, opciones, campo) => (
    <select className="field" style={{ width: 'auto', minHeight: 36 }} value={valor} onChange={(e) => onCambio({ ...c, [campo]: num(e.target.value) })}>
      {opciones.map(([v, txt]) => (
        <option key={v} value={v}>{txt}</option>
      ))}
    </select>
  )
  const entrada = (valor, campo, paso) => (
    <input
      className="field"
      type="number"
      step={paso}
      style={{ width: 80, minHeight: 36 }}
      dir="ltr"
      value={valor}
      onChange={(e) => onCambio({ ...c, [campo]: e.target.value === '' ? '' : Number(e.target.value) })}
    />
  )
  const ops = [['<=', '≤'], ['>=', '≥']]
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t(`lab.tipo.${c.tipo}`)}</span>
      {(c.tipo === 'rsi' || c.tipo === 'bollinger') && (
        <>
          {sel(c.op, ops, 'op')}
          {entrada(c.valor, 'valor', c.tipo === 'rsi' ? 1 : 0.05)}
        </>
      )}
      {c.tipo === 'media' && (
        <>
          {sel(c.lado, TIPOS_CONDICION.media.lados.map((l) => [l, t(`lab.lado.${l}`)]), 'lado')}
          {sel(c.media, TIPOS_CONDICION.media.medias.map((m) => [m, m.toUpperCase()]), 'media')}
          {sel(c.periodo, TIPOS_CONDICION.media.periodos.map((p) => [p, String(p)]), 'periodo')}
        </>
      )}
      {c.tipo === 'extremo' && (
        <>
          {sel(c.extremo, TIPOS_CONDICION.extremo.extremos.map((x) => [x, t(`lab.extremo.${x}`)]), 'extremo')}
          {entrada(c.n, 'n', 1)}
          <span style={TEXTO}>{t('lab.velas')}</span>
        </>
      )}
      <button type="button" className="btn-ghost" style={{ minHeight: 36, padding: '0 10px' }} onClick={onQuitar} aria-label={t('lab.quitar')}>
        ✕
      </button>
    </div>
  )
}

function Resumen({ r, t, objetivoRB, locale }) {
  const eq = aciertoDeEquilibrio(objetivoRB)
  const fecha = (f) => {
    const d = new Date(String(f).replace(' ', 'T') + (String(f).length > 10 ? 'Z' : 'T00:00:00Z'))
    return Number.isNaN(d.getTime()) ? f : d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  }
  return (
    <div style={CAJA}>
      <span style={ROTULO}>{t('lab.resultado')}</span>
      <p style={TEXTO}>{t('lab.periodo', { desde: fecha(r.desde), hasta: fecha(r.hasta), velas: r.velas })}</p>
      {r.ops === 0 ? (
        <p style={TEXTO}>{t('lab.sinOps')}</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>{t('lab.ops')}</span>
          <span className="mono" dir="ltr">{r.ops}</span>
          <span style={{ color: 'var(--text-muted)' }}>{t('lab.acierto')}</span>
          <span className="mono" dir="ltr">{r.acierto}% ±{r.margen}</span>
          <span style={{ color: 'var(--text-muted)' }}>{t('lab.equilibrio')}</span>
          <span className="mono" dir="ltr">{eq}%</span>
          <span style={{ color: 'var(--text-muted)' }}>{t('lab.porR')}</span>
          <span className="mono" dir="ltr" style={{ color: colorR(r.porR) }}>{fmtR(r.porR)}</span>
          <span style={{ color: 'var(--text-muted)' }}>{t('lab.totalR')}</span>
          <span className="mono" dir="ltr" style={{ color: colorR(r.totalR) }}>{fmtR(r.totalR)}</span>
          {r.mitades.map((m, i) => (
            <span key={i} style={{ display: 'contents' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t(i === 0 ? 'lab.mitad1' : 'lab.mitad2')}</span>
              <span className="mono" dir="ltr" style={{ color: colorR(m.porR) }}>
                {m.ops ? `${fmtR(m.porR)} · ${m.ops}` : '—'}
              </span>
            </span>
          ))}
          {r.abiertas > 0 && (
            <>
              <span style={{ color: 'var(--text-muted)' }}>{t('lab.abiertas')}</span>
              <span className="mono" dir="ltr">{r.abiertas}</span>
            </>
          )}
        </div>
      )}
      {r.ops > 0 && r.ops < 150 && <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t('lab.pocas', { n: r.ops, margen: r.margen })}</p>}
      {r.ops > 0 && (
        <details>
          <summary style={{ ...TEXTO, cursor: 'pointer' }}>{t('lab.porPar')}</summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '4px 10px', fontSize: 12, marginTop: 6 }}>
            {r.porPar.filter((p) => p.ops > 0).map((p) => (
              <span key={p.par} style={{ display: 'contents' }}>
                <span className="mono" dir="ltr">{p.par}</span>
                <span className="mono" dir="ltr" style={{ color: 'var(--text-muted)' }}>{p.ops} · {p.acierto}%</span>
                <span className="mono" dir="ltr" style={{ color: colorR(p.porR) }}>{fmtR(p.porR)}</span>
              </span>
            ))}
          </div>
        </details>
      )}
      <p style={{ ...TEXTO, fontSize: 11.5, color: 'var(--text-muted)' }}>{t('lab.pieResultado')}</p>
    </div>
  )
}

export default function Laboratorio({ uid, ficha }) {
  const { t, locale } = useIdioma()
  // Se baja la historia (y las reglas de los miembros) solo cuando la
  // persona toca la tarjeta: no hace falta para el resto del Analizador.
  const [tocado, setTocado] = useState(false)
  const abierto = tocado
  const { historia, cargando, fallo } = useHistoria(abierto)
  const { reglas, guardar, borrar, seguir } = useReglas(uid)
  const servicioActivo = ficha?.seguimientoActivo === true
  const solicitadoEl = fechaCorta(ficha?.seguimientoSolicitado, locale)
  const esAdmin = !!ADMIN_EMAIL && String(ficha?.email ?? '').toLowerCase() === ADMIN_EMAIL
  const todas = useReglasTodas(esAdmin && abierto)
  const { usuarios } = useMembers(esAdmin && abierto)

  const [regla, setReglaCruda] = useState({ ...REGLA_INICIAL, condiciones: [] })
  const [resultado, setResultado] = useState(null)
  const [probadas, setProbadas] = useState(leerProbadas)
  const [nombre, setNombre] = useState('')
  const [estadoGuardar, setEstadoGuardar] = useState(null)
  const [aBorrar, setABorrar] = useState(null)
  const [permiteCopia, setPermiteCopia] = useState(false)
  const [estadoServicio, setEstadoServicio] = useState(null)

  // Cambiar la regla deja el resultado viejo sin sentido: se quita.
  const setRegla = (siguiente) => {
    setReglaCruda(siguiente)
    setResultado(null)
  }

  const nombreDe = useMemo(() => {
    const m = new Map((usuarios ?? []).map((u) => [u.uid, u.nombre || u.email || u.uid]))
    return (id) => m.get(id) ?? String(id ?? '').slice(0, 6)
  }, [usuarios])

  const cambiar = (parche) => setRegla((r) => ({ ...r, ...parche }))
  const anadir = (tipo) => regla.condiciones.length < MAX_CONDICIONES && cambiar({ condiciones: [...regla.condiciones, { ...CONDICION_NUEVA[tipo] }] })

  const probar = () => {
    const r = probarRegla(regla, historia, spreadDe)
    setResultado(r)
    if (!r.error) {
      const n = contarPrueba(probadas)
      setProbadas(n)
      try {
        localStorage.setItem(clave('lab_probadas'), String(n))
      } catch {
        // sin almacenamiento la cuenta vive solo mientras la pantalla esté abierta
      }
    }
  }

  const cargar = (r) => {
    setRegla({ lado: r.lado, condiciones: (r.condiciones ?? []).map((c) => ({ ...c })), riesgoATR: r.riesgoATR, objetivoRB: r.objetivoRB })
    setNombre(r.nombre ?? '')
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  const alGuardar = async () => {
    const f = fichaParaGuardar(regla, nombre, resultado, probadas, APP, permiteCopia)
    if (f.error) return setEstadoGuardar(f.error)
    setEstadoGuardar('guardando')
    setEstadoGuardar(await guardar(f))
  }

  const deEstaApp = (todas.reglas ?? []).filter((r) => r.app === APP && r.uid !== uid)
  const seguidas = reglas.filter((r) => r.seguir === true).length
  const pedidos = esAdmin ? (usuarios ?? []).filter((u) => u.seguimientoSolicitado || u.seguimientoActivo === true) : []

  const pedir = async () => {
    setEstadoServicio('guardando')
    setEstadoServicio(await solicitarSeguimiento(uid))
  }

  return (
    <div onClickCapture={() => !tocado && setTocado(true)}>
      <TarjetaPlegable
        sigla="LAB"
        titulo={t('lab.titulo')}
        desc={t('lab.desc')}
        paraQue={t('lab.paraQue')}
        avance={<span style={{ fontSize: 12.5, color: 'var(--cta)', fontWeight: 600 }}>📈 {t('lab.avance', { precio: PRECIO_SEGUIMIENTO_USD })}</span>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t('lab.aviso')}</p>

          {/* El beneficio, destacado: la persona tiene que enterarse de que existe. */}
          <div style={{ ...CAJA, borderColor: 'var(--cta)', borderWidth: 2 }}>
            <strong style={{ fontSize: 14 }}>💡 {t('lab.beneficioTitulo')}</strong>
            <p style={TEXTO}>{t('lab.beneficio')}</p>
          </div>

          {/* Seguimiento hacia adelante: primero qué es, después el botón. Va ARRIBA,
              junto al beneficio, y no al final (Néstor, 2026-11-20: «no lo veo»):
              detrás del constructor y de «Mis reglas» nadie lo encontraba. */}
          <div style={{ ...CAJA, borderColor: 'var(--cta)', borderWidth: 2 }}>
            <strong style={{ fontSize: 14 }}>📈 {t('lab.adelanteTitulo')}</strong>
            <span style={{ ...ROTULO, color: 'var(--cta)' }}>{t('lab.adelanteServicio', { precio: PRECIO_SEGUIMIENTO_USD })}</span>
            <p style={TEXTO}>{t('lab.adelanteQue')}</p>
            <p style={TEXTO}>{t('lab.adelantePara')}</p>
            <p style={TEXTO}>{t('lab.adelantePros')}</p>
            <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t('lab.adelanteNo')}</p>
            {servicioActivo ? (
              <p style={{ ...TEXTO, fontWeight: 600 }}>{t('lab.adelanteActivo', { max: MAX_SEGUIDAS })}</p>
            ) : solicitadoEl ? (
              <p style={{ ...TEXTO, fontWeight: 600 }}>{t('lab.adelanteSolicitado', { fecha: solicitadoEl })}</p>
            ) : (
              <button type="button" className="btn btn-primary" disabled={estadoServicio === 'guardando'} onClick={pedir}>
                {t('lab.adelanteSolicitar')}
              </button>
            )}
            {(estadoServicio === 'sinPermiso' || estadoServicio === 'error') && <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t(`lab.estado.${estadoServicio}`)}</p>}
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

          {cargando && <p style={TEXTO}>{t('lab.cargando')}</p>}
          {fallo && <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t('lab.fallo', { motivo: fallo })}</p>}

          {/* 1 · lado */}
          <div style={CAJA}>
            <span style={ROTULO}>{t('lab.paso1')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {['COMPRA', 'VENTA'].map((l) => (
                <Chip key={l} activo={regla.lado === l} onClick={() => cambiar({ lado: regla.lado === l ? null : l })}>
                  {t(`lado.${l}`)}
                </Chip>
              ))}
            </div>
          </div>

          {/* 2 · condiciones */}
          <div style={CAJA}>
            <span style={ROTULO}>{t('lab.paso2', { max: MAX_CONDICIONES })}</span>
            {regla.condiciones.map((c, i) => (
              <EditorCondicion
                key={i}
                c={c}
                t={t}
                onCambio={(nueva) => cambiar({ condiciones: regla.condiciones.map((x, j) => (j === i ? nueva : x)) })}
                onQuitar={() => cambiar({ condiciones: regla.condiciones.filter((_, j) => j !== i) })}
              />
            ))}
            {regla.condiciones.length < MAX_CONDICIONES && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.keys(CONDICION_NUEVA).map((tipo) => (
                  <button key={tipo} type="button" className="btn-ghost" style={{ minHeight: 36, padding: '0 10px', fontSize: 12.5 }} onClick={() => anadir(tipo)}>
                    + {t(`lab.tipo.${tipo}`)}
                  </button>
                ))}
              </div>
            )}
            <p style={{ ...TEXTO, fontSize: 11.5 }}>{t('lab.todasJuntas')}</p>
          </div>

          {/* 3 · stop y objetivo */}
          <div style={CAJA}>
            <span style={ROTULO}>{t('lab.paso3')}</span>
            <span style={TEXTO}>{t('lab.riesgo')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {RIESGOS_ATR.map((v) => (
                <Chip key={v} activo={regla.riesgoATR === v} onClick={() => cambiar({ riesgoATR: v })}>
                  <span dir="ltr">{v} ATR</span>
                </Chip>
              ))}
            </div>
            <span style={TEXTO}>{t('lab.objetivo')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {OBJETIVOS_RB.map((v) => (
                <Chip key={v} activo={regla.objetivoRB === v} onClick={() => cambiar({ objetivoRB: v })}>
                  <span dir="ltr">1 : {v}</span>
                </Chip>
              ))}
            </div>
          </div>

          <button type="button" className="btn btn-primary" disabled={!historia} onClick={probar}>
            {t('lab.probar')}
          </button>
          {resultado?.error && <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t(`lab.error.${resultado.error}`)}</p>}
          <p style={{ ...TEXTO, fontSize: 11.5, color: probadas > 10 ? 'var(--amber)' : 'var(--text-muted)' }}>
            {t('lab.contador', { n: probadas })}
          </p>

          {resultado && !resultado.error && <Resumen r={resultado} t={t} objetivoRB={regla.objetivoRB} locale={locale} />}

          {/* 4 · guardar */}
          <div style={CAJA}>
            <span style={ROTULO}>{t('lab.guardarTitulo')}</span>
            <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t('lab.quienVe')}</p>
            <input className="field" maxLength={60} placeholder={t('lab.nombre')} value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={permiteCopia} onChange={(e) => setPermiteCopia(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
              <span style={TEXTO}>{t('lab.permiso')}</span>
            </label>
            <button type="button" className="btn-ghost" style={{ minHeight: 44 }} onClick={alGuardar}>
              {t('lab.guardar')}
            </button>
            {estadoGuardar && estadoGuardar !== 'guardando' && (
              <p style={TEXTO}>{t(ESTADOS.includes(estadoGuardar) ? `lab.estado.${estadoGuardar}` : `lab.error.${estadoGuardar}`)}</p>
            )}
          </div>

          {reglas.length > 0 && (
            <div style={CAJA}>
              <span style={ROTULO}>{t('lab.misReglas')}</span>
              {reglas.map((r) => (
                <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                  <strong style={{ fontSize: 13 }}>{r.nombre}{r.copiaDe ? ` · ${t('lab.copia')}` : ''}</strong>
                  <span style={TEXTO}>
                    {t(`lado.${r.lado}`)} · {(r.condiciones ?? []).map((c) => textoCondicion(c, t)).join(' + ')}
                  </span>
                  {r.resultado && (
                    <span className="mono" dir="ltr" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {r.resultado.ops} · {r.resultado.acierto ?? '—'}% · {fmtR(r.resultado.porR)}
                    </span>
                  )}
                  {!r.copiaDe && <span style={{ ...TEXTO, fontSize: 11.5 }}>{t(r.permiteCopia ? 'lab.conPermiso' : 'lab.sinPermisoCopia')}</span>}
                  {r.informe?.texto && <Informe informe={r.informe} t={t} />}
                  {(r.seguir || r.adelante) && <Adelante r={r} t={t} locale={locale} />}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" className="btn-ghost" style={{ minHeight: 36, padding: '0 10px' }} onClick={() => cargar(r)}>
                      {t('lab.cargar')}
                    </button>
                    {servicioActivo && (r.seguir || seguidas < MAX_SEGUIDAS) && (
                      <button type="button" className="btn-ghost" style={{ minHeight: 36, padding: '0 10px', borderColor: 'var(--cta)' }} onClick={() => seguir(r.id, !r.seguir)}>
                        {r.seguir ? t('lab.dejarBtn') : t('lab.seguirBtn')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ minHeight: 36, padding: '0 10px', color: aBorrar === r.id ? 'var(--red)' : undefined }}
                      onClick={() => (aBorrar === r.id ? (borrar(r.id), setABorrar(null)) : setABorrar(r.id))}
                    >
                      {aBorrar === r.id ? t('lab.confirmarBorrar') : t('lab.borrar')}
                    </button>
                  </div>
                </div>
              ))}
              {servicioActivo && seguidas >= MAX_SEGUIDAS && <p style={{ ...TEXTO, fontSize: 11.5 }}>{t('lab.maxSeguidas', { max: MAX_SEGUIDAS })}</p>}
            </div>
          )}

          {esAdmin && (
            <div style={CAJA}>
              <span style={ROTULO}>{t('lab.deMiembros')}</span>
              <p style={{ ...TEXTO, fontSize: 11.5 }}>{t('lab.deMiembrosDesc')}</p>
              {todas.error && <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t(`lab.estado.${todas.error}`)}</p>}
              {!todas.error && !deEstaApp.length && <p style={TEXTO}>{t('lab.ningunaDeMiembros')}</p>}
              {deEstaApp.map((r) => (
                <div key={`${r.uid}-${r.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                  <strong style={{ fontSize: 13 }}>{r.nombre}</strong>
                  <span style={{ ...TEXTO, fontSize: 11.5 }}>{t('lab.autor', { quien: nombreDe(r.uid), n: r.probadas ?? 1 })}</span>
                  <span style={TEXTO}>
                    {t(`lado.${r.lado}`)} · {(r.condiciones ?? []).map((c) => textoCondicion(c, t)).join(' + ')}
                  </span>
                  {r.resultado && (
                    <span className="mono" dir="ltr" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {r.resultado.ops} · {r.resultado.acierto ?? '—'}% · {fmtR(r.resultado.porR)}
                    </span>
                  )}
                  <span style={{ ...TEXTO, fontSize: 11.5 }}>{t(r.permiteCopia === true ? 'lab.conPermiso' : 'lab.sinPermisoCopia')}</span>
                  {r.informe?.texto && <span style={{ ...TEXTO, fontSize: 11.5 }}>📩 {t('lab.informeEnviado')}</span>}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn-ghost" style={{ minHeight: 36, padding: '0 10px' }} onClick={() => cargar(r)}>
                      {t('lab.cargar')}
                    </button>
                    {r.permiteCopia === true && (
                      <button type="button" className="btn-ghost" style={{ minHeight: 36, padding: '0 10px' }} onClick={async () => setEstadoGuardar(await copiarRegla(uid, r))}>
                        {t('lab.guardarCopia')}
                      </button>
                    )}
                  </div>
                  {r.permiteCopia === true ? <FormInforme r={r} t={t} /> : <span style={{ ...TEXTO, fontSize: 11.5 }}>{t('lab.copiaSinPermiso')}</span>}
                </div>
              ))}
            </div>
          )}

          <p style={{ ...TEXTO, fontSize: 11.5, color: 'var(--text-muted)' }}>{t('lab.pie')}</p>
        </div>
      </TarjetaPlegable>
    </div>
  )
}
