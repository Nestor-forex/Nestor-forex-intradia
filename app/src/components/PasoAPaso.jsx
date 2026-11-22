// «Paso a paso» (2026-11-22): las herramientas de la app en el orden en que se
// usan, de la fuerza de las divisas a una operación armada. Ver
// `lib/pasoAPaso.js` para lo que este modo hace y lo que no.
//
// ⚠️ El aviso va ANTES de cualquier paso: aquí lo caro sería creer que la app
// está eligiendo el par o la dirección.
//
// ⚠️ Los pasos 2 (el par) y 7 (la dirección) los elige la persona. La app solo
// enseña qué dirección va a favor de la fuerza y cuál en contra, con la
// medición de las señales de la app al lado.

import { useMemo, useState } from 'react'
import { useIdioma } from '../lib/i18n'
import { LECCIONES } from '../lib/curso'
import { POR_R_NEUTRA_NUM } from '../lib/curso/es.js'
import { LECCION_DE_PASO, PASOS, abiertasQueComparten, direccionFuerza, noticiasDelPar, paresCon } from '../lib/pasoAPaso'
import { correlacionDe, nivelesDe } from '../lib/analizador'
import { difDePar } from '../lib/tasas'
import { monedasDe } from '../lib/pairs'
import { HORAS_VISTA } from '../lib/calendario'
import { useTasas } from '../lib/useTasas'
import BarraFuerza from './BarraFuerza'
import GuardianRiesgo from './GuardianRiesgo'

const TEXTO = { margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }
const NOTA = { borderInlineStart: '3px solid var(--amber)', paddingInlineStart: 9, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }
const ETQ = { fontSize: 11, fontWeight: 700, letterSpacing: '.05em', color: 'var(--text-muted)', textTransform: 'uppercase' }
const KV = { display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 10px', fontSize: 13 }

function Chip({ activo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mono"
      dir="ltr"
      style={{ minHeight: 34, padding: '0 11px', borderRadius: 17, border: `1px solid ${activo ? 'var(--cta)' : 'var(--border)'}`, background: 'none', color: activo ? 'var(--cta)' : 'var(--text)', fontWeight: activo ? 700 : 500, font: 'inherit', fontSize: 13, cursor: 'pointer' }}
    >
      {children}
    </button>
  )
}

const precio = (x, dec) => (Number.isFinite(x) ? x.toFixed(dec === 2 ? 3 : 5) : '—')

export default function PasoAPaso({ monedas = [], pares = [], fichas = [], cal, trades = [], perfil, correlaciones, quotes, onIr, onAnalizar }) {
  const { t, locale } = useIdioma()
  const tasas = useTasas()
  const [paso, setPaso] = useState(0)
  const [fuerte, setFuerte] = useState(null)
  const [debil, setDebil] = useState(null)
  const [par, setPar] = useState(null)
  const [lado, setLado] = useState(null)
  const [noOpero, setNoOpero] = useState(false)

  const escala = useMemo(() => Object.fromEntries(monedas.map((m) => [m.cod, m.score])), [monedas])
  const f = fuerte ?? monedas[0]?.cod ?? null
  const d = debil ?? monedas[monedas.length - 1]?.cod ?? null
  const combinados = useMemo(() => paresCon(pares, f, d), [pares, f, d])
  const dir = par ? direccionFuerza(par, escala) : null
  const fichaPar = par ? fichas.find((x) => x.name === par) : null
  const total = PASOS.length - 1
  const ir = (n) => {
    setPaso(n)
    window.scrollTo?.(0, 0)
  }
  const porR = Number.isFinite(POR_R_NEUTRA_NUM) ? (POR_R_NEUTRA_NUM < 0 ? '−' : '+') + Math.abs(POR_R_NEUTRA_NUM).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'

  const resumen = (id) => {
    if (id === 'fuerza' && monedas.length) return t('pasos.resFuerza', { f: monedas[0].cod, d: monedas[monedas.length - 1].cod })
    if (id === 'combinar' && par) return t('pasos.resPar', { par })
    if (id === 'armar' && lado) return t('pasos.resLado', { lado: t(`lado.${lado}`) })
    return ''
  }

  const cuerpo = (id) => {
    if (id === 'freno') return <GuardianRiesgo trades={trades} perfil={perfil} onIrAlPerfil={() => onIr('calc')} />

    if (id === 'fuerza')
      return (
        <>
          <p style={TEXTO}>{t('pasos.fuerzaDesc')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {monedas.map((m) => (
              <BarraFuerza key={m.cod} cod={m.cod} score={m.score} compact />
            ))}
          </div>
          <p style={NOTA}>{t('pasos.fuerzaNota')}</p>
        </>
      )

    if (id === 'combinar')
      return (
        <>
          <div style={ETQ}>{t('pasos.tuFuerte')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {monedas.map((m) => (
              <Chip key={m.cod} activo={m.cod === f} onClick={() => { setFuerte(m.cod); setPar(null); setLado(null) }}>{m.cod}</Chip>
            ))}
          </div>
          <div style={ETQ}>{t('pasos.tuDebil')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {monedas.map((m) => (
              <Chip key={m.cod} activo={m.cod === d} onClick={() => { setDebil(m.cod); setPar(null); setLado(null) }}>{m.cod}</Chip>
            ))}
          </div>
          <p style={TEXTO}>{combinados.exacto ? t('pasos.existe', { par: combinados.exacto }) : t('pasos.noExiste', { par: `${f}/${d}` })}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {combinados.lista.slice(0, 6).map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => { setPar(p.name); setLado(null) }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 40, padding: '0 10px', borderRadius: 8, border: `1px solid ${par === p.name ? 'var(--cta)' : 'var(--border)'}`, background: 'none', color: 'var(--text)', font: 'inherit', cursor: 'pointer' }}
              >
                <span className="mono" dir="ltr" style={{ fontWeight: par === p.name ? 700 : 500, color: par === p.name ? 'var(--cta)' : 'var(--text)' }}>{p.name}</span>
                <span className="mono" dir="ltr" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Dif {(p.dif >= 0 ? '+' : '−') + Math.abs(p.dif).toFixed(2)}</span>
              </button>
            ))}
          </div>
          {!par && <p style={{ ...TEXTO, color: 'var(--text-muted)' }}>{t('pasos.eligePar')}</p>}
          {par && dir && (
            <>
              <p style={TEXTO}>{dir.baseFuerte ? t('pasos.primeroFuerte', { par, base: dir.base }) : t('pasos.primeroDebil', { par, base: dir.base })}</p>
              <div style={KV}>
                <span>{t('pasos.aFavor')}</span>
                <span className="mono" dir="ltr">{t(`lado.${dir.aFavor}`)}</span>
                <span>{t('pasos.enContra')}</span>
                <span className="mono" dir="ltr">{t(`lado.${dir.enContra}`)}</span>
              </div>
              <p style={NOTA}>{t('pasos.notaFuerza', { r: porR })}</p>
            </>
          )}
        </>
      )

    if (!par) return <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t('pasos.faltaPar')}</p>

    if (id === 'noticias') {
      const evs = noticiasDelPar(cal, par)
      const [a, b] = monedasDe(par)
      return (
        <>
          {evs === null ? (
            <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t('pasos.calSinDatos')}</p>
          ) : evs.length === 0 ? (
            <p style={TEXTO}>{t('pasos.sinNoticias', { a, b, h: HORAS_VISTA })}</p>
          ) : (
            <>
              <p style={TEXTO}>{t('pasos.conNoticias')}</p>
              {evs.slice(0, 6).map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, alignItems: 'baseline' }}>
                  <span className="mono" dir="ltr" style={{ fontWeight: 700 }}>{ev.c}</span>
                  <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(ev.d).toLocaleString(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <span dir="ltr" lang="en" style={{ color: 'var(--text)' }}>{ev.t}</span>
                </div>
              ))}
            </>
          )}
          <p style={NOTA}>{t('pasos.noticiasNota')}</p>
        </>
      )
    }

    if (id === 'coste') {
      const q = quotes?.[par]
      const sw = tasas?.tasas ? difDePar(par, tasas.tasas, monedasDe) : null
      return (
        <>
          <div style={KV}>
            <span>{t('pasos.spread')}</span>
            <span className="mono" dir="ltr">{Number.isFinite(q?.spread) ? `${q.spread.toFixed(1)} pips` : t('pasos.sinDato')}</span>
            <span>{t('pasos.swap')}</span>
            <span>{sw ? t(`pasos.swapLado.${sw.lado}`) : t('pasos.sinDato')}</span>
          </div>
          <p style={NOTA}>{t('pasos.costeNota')}</p>
        </>
      )
    }

    if (id === 'grafico')
      return fichaPar ? (
        <>
          <div style={KV}>
            <span>{t('pasos.tendencia')}</span>
            <span>{t(`tend.${fichaPar.tend}`)}</span>
            <span>RSI</span>
            <span className="mono" dir="ltr">{fichaPar.rsi ?? '—'}</span>
            <span>ATR</span>
            <span className="mono" dir="ltr">{Number.isFinite(fichaPar.atrPct) ? `${fichaPar.atrPct.toFixed(2)} %` : '—'}</span>
            <span>{t('pasos.soporte')}</span>
            <span className="mono" dir="ltr">{precio(fichaPar.sop, fichaPar.dec)}</span>
            <span>{t('pasos.resistencia')}</span>
            <span className="mono" dir="ltr">{precio(fichaPar.res, fichaPar.dec)}</span>
          </div>
          <p style={NOTA}>{t('pasos.graficoNota')}</p>
          <div>
            <button type="button" className="btn-ghost" onClick={() => onAnalizar(par, null)}>{t('pasos.verAnalizador')} →</button>
          </div>
        </>
      ) : (
        <p style={TEXTO}>{t('pasos.sinDato')}</p>
      )

    if (id === 'iguales') {
      const abiertas = abiertasQueComparten(trades, par)
      const corr = correlacionDe(correlaciones, par)
      return (
        <>
          {abiertas.length === 0 ? (
            <p style={TEXTO}>{t('pasos.igualesNo')}</p>
          ) : (
            <>
              <p style={TEXTO}>{t('pasos.igualesSi')}</p>
              {abiertas.map((x) => (
                <div key={x.id} className="mono" dir="ltr" style={{ fontSize: 13 }}>{x.par} · {t(`lado.${x.dir === 'Venta' ? 'VENTA' : 'COMPRA'}`)}</div>
              ))}
            </>
          )}
          {corr && corr.length > 0 && (
            <>
              <p style={TEXTO}>{t('pasos.correlAlta')}</p>
              {corr.map((c) => (
                <div key={c.par} className="mono" dir="ltr" style={{ fontSize: 13 }}>{c.par} · {(c.r >= 0 ? '+' : '−') + Math.abs(c.r).toFixed(2)}</div>
              ))}
            </>
          )}
          <p style={NOTA}>{t('pasos.igualesNota')}</p>
        </>
      )
    }

    if (id === 'armar') {
      const n = lado && fichaPar ? nivelesDe(fichaPar, lado, 'simetrica') : null
      const pip = fichaPar?.dec === 2 ? 0.01 : 0.0001
      return (
        <>
          <p style={TEXTO}>{t('pasos.eligeLado')}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {['COMPRA', 'VENTA'].map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLado(lado === l ? null : l)}
                style={{ flex: 1, minHeight: 44, borderRadius: 8, border: `${lado === l ? 2 : 1}px solid ${lado === l ? 'var(--cta)' : 'var(--border)'}`, background: 'none', color: lado === l ? 'var(--cta)' : 'var(--text)', fontWeight: 700, font: 'inherit', cursor: 'pointer' }}
              >
                {t(`lado.${l}`)}
              </button>
            ))}
          </div>
          {lado && n && fichaPar && (
            <>
              <div style={KV}>
                <span>{t('pasos.entrada')}</span>
                <span className="mono" dir="ltr">{precio(fichaPar.precio, fichaPar.dec)}</span>
                <span>Stop-loss</span>
                <span className="mono" dir="ltr">{precio(n.sl, fichaPar.dec)} · {Math.round(Math.abs(n.sl - fichaPar.precio) / pip)} pips</span>
                <span>Take-profit</span>
                <span className="mono" dir="ltr">{precio(n.tp, fichaPar.dec)} · {Math.round(Math.abs(n.tp - fichaPar.precio) / pip)} pips</span>
                <span>R/B</span>
                <span className="mono" dir="ltr">1 : {(Math.abs(n.tp - fichaPar.precio) / Math.abs(n.sl - fichaPar.precio)).toFixed(2)}</span>
              </div>
              <p style={{ ...TEXTO, fontSize: 12.5, color: 'var(--text-muted)' }}>{t('pasos.metodoApp')}</p>
            </>
          )}
          {lado && !n && <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t('pasos.sinNiveles')}</p>}
          <p style={NOTA}>{t('pasos.armarNota')}</p>
        </>
      )
    }

    if (id === 'decidir')
      return (
        <>
          <p style={TEXTO}>{t('pasos.decidirIntro')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" disabled={!lado} onClick={() => onAnalizar(par, lado)} style={{ minHeight: 44, padding: '0 14px', borderRadius: 8, border: 'none', background: lado ? 'var(--cta)' : 'var(--bg-input)', color: lado ? 'var(--cta-tinta)' : 'var(--text-muted)', fontWeight: 700, font: 'inherit', cursor: lado ? 'pointer' : 'default' }}>
              {t('pasos.practicarAnotar')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setNoOpero(true)}>{t('pasos.noOpero')}</button>
          </div>
          {!lado && <p style={{ ...TEXTO, fontSize: 12.5, color: 'var(--text-muted)' }}>{t('pasos.faltaLado')}</p>}
          {noOpero && <p style={{ ...TEXTO, color: 'var(--text)', fontWeight: 600 }}>{t('pasos.noOperoHecho')}</p>}
          <p style={NOTA}>{t('pasos.decidirNota')}</p>
        </>
      )
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('pasos.titulo')}</h1>
      <p style={{ ...TEXTO, color: 'var(--text-muted)' }}>
        {t('pasos.desc')} {t('pasos.deTotal', { n: paso, total })}
      </p>
      <div style={{ display: 'flex', gap: 4 }} aria-hidden="true">
        {PASOS.map((id, i) => (
          <span key={id} style={{ flex: 1, height: 6, borderRadius: 3, background: i <= paso ? 'var(--cta)' : 'var(--border)', opacity: i === paso ? 0.6 : 1 }} />
        ))}
      </div>
      {/* ⚠️ PRIMERO el aviso. */}
      <p style={{ margin: 0, border: '1px solid var(--amber)', color: 'var(--amber)', borderRadius: 10, padding: '8px 10px', fontSize: 12.5, lineHeight: 1.5 }}>{t('pasos.aviso')}</p>

      {PASOS.map((id, i) => {
        const abierto = i === paso
        const hecho = i < paso
        const leccion = LECCIONES[LECCION_DE_PASO[id]]
        return (
          <section key={id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, borderColor: abierto ? 'var(--cta)' : 'var(--border)' }}>
            <button type="button" onClick={() => ir(i)} aria-expanded={abierto} style={{ display: 'flex', gap: 10, alignItems: 'center', border: 'none', background: 'none', padding: 0, color: 'var(--text)', font: 'inherit', textAlign: 'start', cursor: 'pointer' }}>
              <span
                className="mono"
                style={{ width: 26, height: 26, borderRadius: 13, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, background: hecho ? 'var(--cta)' : 'none', color: hecho ? 'var(--cta-tinta)' : abierto ? 'var(--cta)' : 'var(--text-muted)', border: hecho ? 'none' : `${abierto ? 2 : 1}px solid ${abierto ? 'var(--cta)' : 'var(--border)'}` }}
              >
                {hecho ? '✓' : i}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 14.5 }}>{t(`pasos.p.${id}`)}</span>
                {!abierto && hecho && resumen(id) && <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{resumen(id)}</span>}
              </span>
            </button>
            {abierto && (
              <>
                {cuerpo(id)}
                {leccion && (
                  <button type="button" onClick={() => onIr('curso')} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--cta)', font: 'inherit', fontSize: 12.5, textAlign: 'start', cursor: 'pointer' }}>
                    📘 {t('pasos.leccion')} <span dir="ltr" lang="es">{leccion.titulo}</span>
                  </button>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <button type="button" className="btn-ghost" disabled={i === 0} onClick={() => ir(i - 1)} style={{ visibility: i === 0 ? 'hidden' : 'visible' }}>
                    ← {t('pasos.atras')}
                  </button>
                  {i < total ? (
                    <button type="button" onClick={() => ir(i + 1)} style={{ minHeight: 44, padding: '0 16px', borderRadius: 8, border: 'none', background: 'var(--cta)', color: 'var(--cta-tinta)', fontWeight: 700, font: 'inherit', cursor: 'pointer' }}>
                      {t('pasos.siguiente')} →
                    </button>
                  ) : (
                    <button type="button" className="btn-ghost" onClick={() => onIr('barrido')}>{t('pasos.volverBarrido')}</button>
                  )}
                </div>
              </>
            )}
          </section>
        )
      })}
    </div>
  )
}

// La tarjeta de entrada, arriba del Barrido. Es lo único que el modo añade a
// las pantallas de siempre: quitándola, la app queda como estaba.
export function EntradaPasoAPaso({ onEmpezar }) {
  const { t } = useIdioma()
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, borderColor: 'var(--cta)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>{t('pasos.entradaTitulo')}</span>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{t('pasos.entradaDesc')}</span>
      </div>
      <button type="button" onClick={onEmpezar} style={{ minHeight: 40, padding: '0 14px', borderRadius: 8, border: 'none', background: 'var(--cta)', color: 'var(--cta-tinta)', fontWeight: 700, font: 'inherit', cursor: 'pointer', flex: 'none' }}>
        {t('pasos.empezar')}
      </button>
    </div>
  )
}
