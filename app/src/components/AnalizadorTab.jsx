// EL ANALIZADOR (fase 3 del plan, 2026-11-13). Una pestaña propia, como el
// Diario y los avisos: es una HERRAMIENTA que se usa, no información que se lee.
//
// La persona elige el par, la dirección, cómo poner el stop y qué herramientas
// ver, y la app le arma UNA tarjeta. Las cuentas están en `analizador.js`; aquí
// solo se pinta lo que esa función devuelve.
//
// ⚠️ EL AVISO VA ANTES DE CUALQUIER CONTROL. Aquí lo caro no es leer mal un
// número: es creer que la app eligió la dirección. No la elige, y la pantalla lo
// dice antes de que se toque nada.
//
// ⚠️ LOS NÚMEROS NO SE PINTAN DE VERDE NI DE ROJO, salvo el stop y el objetivo,
// que sí significan algo en plata (la decisión de `SetupDetalle`). La dirección
// tampoco: elegir COMPRA no es «lo bueno».
//
// ⚠️ GEMELO. Lo que es propio de cada app (medias, geometría, pivote) llega ya
// resuelto en las `fichas`; por eso este archivo puede ser el mismo en las dos.

import { useMemo, useState } from 'react'
import { useIdioma } from '../lib/i18n'
import { HERRAMIENTAS, HERRAMIENTAS_INICIALES, LADOS, MAX_NOMBRE, METODOS, RR_AVISO, armarAnalisis, notaDeAnalisis } from '../lib/analizador'
import { leerPerfil } from '../lib/perfilRiesgo'
import { estadoDelDia } from '../lib/guardianRiesgo'
import { monedasDe } from '../lib/pairs'
import { useTasas } from '../lib/useTasas'
import { usePlantillas } from '../lib/usePlantillas'
import { clave } from '../lib/identidad'

const TEXTO = { fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }
const ROTULO = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }
const CLAVE_ULTIMO = clave('analizador_v1')

// La última combinación usada vive en el TELÉFONO: es una conveniencia de quien
// mira, como el idioma. Las plantillas, que son de la persona, van a Firestore.
function leerUltimo() {
  try {
    const x = JSON.parse(localStorage.getItem(CLAVE_ULTIMO) ?? 'null')
    return x && typeof x === 'object' ? x : null
  } catch {
    return null
  }
}
function guardarUltimo(x) {
  try {
    localStorage.setItem(CLAVE_ULTIMO, JSON.stringify(x))
  } catch {
    /* sin almacenamiento: se pierde la comodidad, nada más */
  }
}

const fmt = (x, dec) => (typeof x === 'number' && Number.isFinite(x) ? x.toFixed(dec) : '—')

function Chip({ activo, onClick, children, dir }) {
  return (
    <button
      type="button"
      onClick={onClick}
      dir={dir}
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

function Fila({ rotulo, children }) {
  return (
    <>
      <span style={{ color: 'var(--text-muted)' }}>{rotulo}</span>
      <span style={{ textAlign: 'end' }}>{children}</span>
    </>
  )
}

// Un número suelto: cifras latinas y de izquierda a derecha también en árabe,
// como los precios del resto de la app.
const N = ({ children, color }) => (
  <span className="mono" dir="ltr" style={{ fontVariantNumeric: 'tabular-nums', color }}>
    {children}
  </span>
)

export default function AnalizadorTab({ fichas = [], ratesUSD, uid, ficha, trades = [], cal, onAnotar, onIrAlPerfil }) {
  const { t, locale } = useIdioma()
  const tasasPub = useTasas()
  const { plantillas, guardar, borrar } = usePlantillas(uid, ficha)
  const perfil = useMemo(() => leerPerfil(ficha?.perfilRiesgo), [ficha?.perfilRiesgo])
  const freno = useMemo(() => estadoDelDia(trades, perfil).estado, [trades, perfil])

  const ultimo = useMemo(leerUltimo, [])
  const nombres = fichas.map((f) => f.name)
  const [par, setPar] = useState(ultimo?.par && nombres.includes(ultimo.par) ? ultimo.par : null)
  const [lado, setLado] = useState(null)
  const [metodo, setMetodo] = useState(METODOS.includes(ultimo?.metodo) ? ultimo.metodo : 'app')
  const [herr, setHerr] = useState(
    Array.isArray(ultimo?.herramientas) ? ultimo.herramientas.filter((h) => HERRAMIENTAS.includes(h)) : [...HERRAMIENTAS_INICIALES],
  )
  const [nombrePl, setNombrePl] = useState('')
  const [msgPl, setMsgPl] = useState(null)
  const [porBorrar, setPorBorrar] = useState(null)

  // Solo se ofrecen las herramientas que ESTA app calcula para algún par. La
  // app de intradía no tiene Bollinger: ofrecer el botón para que diga siempre
  // «Sin dato» sería prometer algo que no hay.
  const disponibles = HERRAMIENTAS.filter((x) => x !== 'bollinger' || fichas.some((f) => Number.isFinite(f.bollinger)))

  const parActual = par && nombres.includes(par) ? par : nombres[0] ?? null
  const fichaPar = fichas.find((f) => f.name === parActual) ?? null

  const recordar = (cambios) => guardarUltimo({ par: parActual, metodo, herramientas: herr, ...cambios })
  const elegirPar = (p) => {
    setPar(p)
    recordar({ par: p })
  }
  const elegirMetodo = (m) => {
    setMetodo(m)
    recordar({ metodo: m })
  }
  const alternar = (h) => {
    const nueva = herr.includes(h) ? herr.filter((x) => x !== h) : HERRAMIENTAS.filter((x) => x === h || herr.includes(x))
    setHerr(nueva)
    recordar({ herramientas: nueva })
  }
  const aplicar = (pl) => {
    setHerr(pl.herramientas)
    setMetodo(pl.metodo)
    recordar({ herramientas: pl.herramientas, metodo: pl.metodo })
    setMsgPl(null)
  }

  const a = useMemo(
    () =>
      armarAnalisis({
        ficha: fichaPar,
        lado,
        metodo,
        herramientas: herr,
        perfil,
        ratesUSD,
        calendario: cal,
        tasas: tasasPub?.tasas ?? null,
        monedasDe,
        freno,
      }),
    [fichaPar, lado, metodo, herr, perfil, ratesUSD, cal, tasasPub, freno],
  )

  const guardarPl = async () => {
    const r = await guardar({ nombre: nombrePl, herramientas: herr, metodo })
    setMsgPl(r.ok ? 'guardada' : r.codigo)
    if (r.ok) setNombrePl('')
  }

  if (!fichas.length) {
    return (
      <div className="card" style={{ padding: 14 }}>
        <p style={TEXTO}>{t('an.sinDatos')}</p>
      </div>
    )
  }

  const d = a.dec ?? 4
  const h = a.herramientas ?? {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>{t('an.titulo')}</h2>
      <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t('an.aviso')}</p>

      {/* 1 · par y dirección */}
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={ROTULO}>{t('an.paso1')}</span>
        <select className="field" value={parActual ?? ''} onChange={(e) => elegirPar(e.target.value)} dir="ltr">
          {nombres.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <span style={ROTULO}>{t('an.paso2')}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {LADOS.map((l) => (
            <Chip key={l} activo={lado === l} onClick={() => setLado(lado === l ? null : l)}>
              {t(`lado.${l}`)}
            </Chip>
          ))}
        </div>
      </div>

      {/* 2 · cómo poner el stop */}
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={ROTULO}>{t('an.paso3')}</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {METODOS.map((m) => (
            <Chip key={m} activo={metodo === m} onClick={() => elegirMetodo(m)}>
              {t(`an.metodo.${m}`)}
            </Chip>
          ))}
        </div>
        <p style={TEXTO}>{t(`an.metodoDesc.${metodo}`)}</p>
      </div>

      {/* 3 · herramientas y plantillas */}
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={ROTULO}>{t('an.paso4')}</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {disponibles.map((x) => (
            <Chip key={x} activo={herr.includes(x)} onClick={() => alternar(x)}>
              {t(`an.h.${x}`)}
            </Chip>
          ))}
        </div>

        <span style={{ ...ROTULO, marginTop: 4 }}>{t('an.plantillas')}</span>
        {plantillas.length ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {plantillas.map((pl) => (
              <span key={pl.nombre} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Chip activo={false} onClick={() => aplicar(pl)}>
                  {pl.nombre}
                </Chip>
                <button
                  type="button"
                  onClick={async () => {
                    if (porBorrar !== pl.nombre) return setPorBorrar(pl.nombre)
                    setPorBorrar(null)
                    const r = await borrar(pl.nombre)
                    setMsgPl(r.ok ? null : r.codigo)
                  }}
                  aria-label={t('an.borrarPlantilla')}
                  style={{
                    minHeight: 36,
                    minWidth: 36,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: porBorrar === pl.nombre ? 11.5 : 14,
                    fontWeight: 600,
                    color: porBorrar === pl.nombre ? 'var(--red)' : 'var(--text-muted)',
                  }}
                >
                  {porBorrar === pl.nombre ? t('an.borrarConfirma') : '✕'}
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p style={TEXTO}>{t('an.sinPlantillas')}</p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="field"
            style={{ flex: 1 }}
            maxLength={MAX_NOMBRE}
            placeholder={t('an.nombrePlantilla')}
            value={nombrePl}
            onChange={(e) => setNombrePl(e.target.value)}
          />
          <button className="btn" type="button" style={{ minHeight: 44 }} onClick={guardarPl}>
            {t('an.guardarPlantilla')}
          </button>
        </div>
        {msgPl && (
          <p style={{ ...TEXTO, color: msgPl === 'guardada' ? 'var(--text-secondary)' : 'var(--amber)' }}>{t(`an.msg.${msgPl}`)}</p>
        )}
      </div>

      {/* 4 · la tarjeta */}
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>
            <span dir="ltr">{a.par}</span>
            {a.lado && <> · {t(`lado.${a.lado}`)}</>}
          </span>
          <N>{fmt(a.precio, d)}</N>
        </div>

        {(a.freno === 'freno' || a.freno === 'cerca') && (
          <p style={{ ...TEXTO, color: a.freno === 'freno' ? 'var(--red)' : 'var(--amber)', fontWeight: 600 }}>
            {t(a.freno === 'freno' ? 'an.frenoRojo' : 'an.frenoCerca')}
          </p>
        )}

        {!a.niveles ? (
          <p style={TEXTO}>{t(`an.motivo.${a.motivoNiveles}`)}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 12px', fontSize: 13, alignItems: 'baseline' }}>
            <Fila rotulo={t('an.entrada')}>
              <N>{fmt(a.precio, d)}</N>
            </Fila>
            <Fila rotulo={t('an.stop')}>
              {/* Precio y pips van en UN bloque ltr: sueltos dentro de una fila
                  árabe, el navegador los ponía al revés («(42 pips) 1.1012»).
                  Lo enseñó la captura en árabe, no el build. */}
              <span dir="ltr">
                <N color="var(--red)">{fmt(a.niveles.sl, d)}</N> <N>({a.niveles.pipRiesgo.toFixed(0)} pips)</N>
              </span>
            </Fila>
            <Fila rotulo={t('an.objetivo')}>
              <span dir="ltr">
                <N color="var(--green)">{fmt(a.niveles.tp, d)}</N> <N>({a.niveles.pipBeneficio.toFixed(0)} pips)</N>
              </span>
            </Fila>
            <Fila rotulo="R/B">
              <N color={a.niveles.rr < RR_AVISO ? 'var(--amber)' : undefined}>1 : {a.niveles.rr.toFixed(2)}</N>
            </Fila>
            <Fila rotulo={t('an.lote')}>
              {a.lote ? (
                <N>
                  {a.lote.lote.toFixed(2)} · ${a.lote.riesgoUsd.toFixed(2)}
                </N>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>{t(`an.motivoLote.${a.motivoLote}`)}</span>
              )}
            </Fila>
          </div>
        )}
        {a.niveles && a.niveles.rr < RR_AVISO && <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t('an.rrBajo')}</p>}
        {a.niveles && !a.lote && a.motivoLote === 'sinPerfil' && onIrAlPerfil && (
          <button className="btn" type="button" style={{ minHeight: 44 }} onClick={onIrAlPerfil}>
            {t('an.irPerfil')}
          </button>
        )}

        {/* las herramientas encendidas */}
        {herr.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 12px', fontSize: 13, alignItems: 'baseline', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            {'niveles' in h && (
              <Fila rotulo={t('an.h.niveles')}>
                {h.niveles ? <N>{fmt(h.niveles.sop, d)} · {fmt(h.niveles.res, d)}</N> : t('an.sinDato')}
              </Fila>
            )}
            {'pivote' in h && (
              <Fila rotulo={t('an.h.pivote')}>
                {h.pivote ? (
                  <N>
                    S1 {fmt(h.pivote.s1, d)} · P {fmt(h.pivote.p, d)} · R1 {fmt(h.pivote.r1, d)}
                  </N>
                ) : (
                  t('an.sinDato')
                )}
              </Fila>
            )}
            {'tendencia' in h && (
              <Fila rotulo={t('an.h.tendencia')}>
                {h.tendencia ? (
                  <>
                    {t(`tend.${h.tendencia.tend}`)}{' '}
                    {h.tendencia.nombres && (
                      <N>
                        ({h.tendencia.nombres[0]} {fmt(h.tendencia.corta, d)} · {h.tendencia.nombres[1]} {fmt(h.tendencia.larga, d)})
                      </N>
                    )}
                  </>
                ) : (
                  t('an.sinDato')
                )}
              </Fila>
            )}
            {'rsi' in h && <Fila rotulo={t('an.h.rsi')}>{h.rsi ? <N>{h.rsi.v}</N> : t('an.sinDato')}</Fila>}
            {'atr' in h && (
              <Fila rotulo={t('an.h.atr')}>
                {h.atr ? (
                  <N>
                    {h.atr.pips.toFixed(0)} pips{h.atr.pct !== null ? ` · ${h.atr.pct.toFixed(2)}%` : ''}
                  </N>
                ) : (
                  t('an.sinDato')
                )}
              </Fila>
            )}
            {'fuerza' in h && (
              <Fila rotulo={t('an.h.fuerza')}>
                {h.fuerza ? (
                  <N>
                    {h.fuerza.b} {h.fuerza.vb.toFixed(1)} · {h.fuerza.q} {h.fuerza.vq.toFixed(1)}
                  </N>
                ) : (
                  t('an.sinDato')
                )}
              </Fila>
            )}
            {'compresion' in h && (
              <Fila rotulo={t('an.h.compresion')}>
                {h.compresion ? (
                  <>
                    {h.compresion.nivel && <>{t(`compr.nivel.${h.compresion.nivel}`)} </>}
                    <N>{h.compresion.v.toFixed(2)}</N>
                  </>
                ) : (
                  t('an.sinDato')
                )}
              </Fila>
            )}
            {'bollinger' in h && <Fila rotulo={t('an.h.bollinger')}>{h.bollinger ? <N>{h.bollinger.pctB.toFixed(2)}</N> : t('an.sinDato')}</Fila>}
            {'swap' in h && (
              <Fila rotulo={t('an.h.swap')}>{h.swap ? t(`an.swap.${h.swap}`) : t(a.lado ? 'an.sinDato' : 'an.swapSinLado')}</Fila>
            )}
          </div>
        )}

        {'calendario' in h && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <span style={ROTULO}>{t('an.h.calendario')}</span>
            {h.calendario === null ? (
              <p style={TEXTO}>{t('an.sinCalendario')}</p>
            ) : h.calendario.length === 0 ? (
              <p style={TEXTO}>{t('an.calendarioVacio')}</p>
            ) : (
              h.calendario.slice(0, 6).map((ev, i) => (
                <div key={i} style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                  <span className="mono" dir="ltr" style={{ fontWeight: 600 }}>
                    {ev.c}
                  </span>{' '}
                  <span style={{ color: 'var(--text-muted)' }}>
                    {new Date(ev.d).toLocaleString(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>{' '}
                  · {ev.t}
                  {ev.i === 'alto' && <span style={{ color: 'var(--amber)', fontWeight: 600 }}> · {t('calendario.alto')}</span>}
                </div>
              ))
            )}
          </div>
        )}

        {fichaPar?.esCruce && <p style={{ ...TEXTO, fontSize: 11.5, color: 'var(--text-muted)' }}>{t('an.cruce')}</p>}

        {a.niveles && onAnotar && (
          <button
            className="btn"
            type="button"
            style={{ minHeight: 44 }}
            onClick={() =>
              onAnotar({
                par: a.par,
                dir: a.lado === 'COMPRA' ? 'Compra' : 'Venta',
                nota: t('an.notaDiario', { niveles: notaDeAnalisis(a) }),
                lote: a.lote ? a.lote.lote.toFixed(2) : '',
                abierta: true,
              })
            }
          >
            {t('an.anotar')}
          </button>
        )}
      </div>

      <p style={{ ...TEXTO, fontSize: 11.5, color: 'var(--text-muted)' }}>{t('an.pie')}</p>
    </div>
  )
}
