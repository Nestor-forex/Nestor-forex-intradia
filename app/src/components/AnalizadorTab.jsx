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
import { HERRAMIENTAS, HERRAMIENTAS_INICIALES, LADOS, MAX_NOMBRE, METODOS, RR_AVISO, armarAnalisis, herramientasDisponibles, notaDeAnalisis } from '../lib/analizador'
import { leerPerfil } from '../lib/perfilRiesgo'
import { estadoDelDia } from '../lib/guardianRiesgo'
import { monedasDe } from '../lib/pairs'
import { useTasas } from '../lib/useTasas'
import { useMT5Quotes } from '../lib/useMT5Quotes'
import { fichaConPrecioVivo, fuenteDePrecios, velaDeEntradaMt5 } from '../lib/precioVivo'
import FuentePrecio from './FuentePrecio'
import { useEstacionalidad } from '../lib/useEstacionalidad'
import { usePlantillas } from '../lib/usePlantillas'
import { APP, clave } from '../lib/identidad'
import { MAX_ABIERTAS, fichaPractica, marcasDeAnalisis } from '../lib/practica'

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

// ⚠️ El COT, el oro y la correlación llegan por props porque solo los tiene la
// app de Swing: un archivo GEMELO no puede importar un hook que en la otra app
// no existe. La de intradía no los pasa, y sus botones no salen.
const NOTA = { fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45, margin: 0 }

function Bloque({ titulo, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <span style={ROTULO}>{titulo}</span>
      {children}
    </div>
  )
}

function Rejilla({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 12px', fontSize: 13, alignItems: 'baseline' }}>{children}</div>
}

// El recorrido típico y cuántas veces la media: «0.79% · ×1.08». El «×» no es
// idioma, así que vale igual en los 13.
const recorrido = (c) => (c ? `${c.medio.toFixed(2)}% · ×${c.veces.toFixed(2)}` : '—')

// Los nombres de los días y los meses se los pide al idioma (como la tarjeta
// de estacionalidad): serían 19 claves × 13 idiomas para algo que el navegador
// dice mejor. Se usan fechas en UTC para que el día no se corra de huso.
const nombreDia = (d, locale) => new Date(Date.UTC(2024, 0, 7 + d)).toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' })
const nombreMes = (m, locale) => new Date(Date.UTC(2024, m, 15)).toLocaleDateString(locale, { month: 'long', timeZone: 'UTC' })
// La hora se agrupa en UTC y se enseña en la del teléfono de quien mira.
const horaLocal = (hUTC, locale) => {
  const d = new Date()
  d.setUTCHours(hUTC, 0, 0, 0)
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

export default function AnalizadorTab({ fichas = [], ratesUSD, uid, ficha, trades = [], cal, cot = null, oro = null, correlaciones, onAnotar, onIrAlPerfil, vela = null, onPracticar, onVerPractica }) {
  const { t, locale } = useIdioma()
  const tasasPub = useTasas()
  const mt5 = useMT5Quotes()
  const estacionalidad = useEstacionalidad()
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
  // Lo que pasó al guardar una operación de práctica, atado a ESTA tarjeta:
  // si cambias de par, de dirección o de método, el mensaje se va.
  const firmaPractica = `${par}|${lado}|${metodo}`
  const [practica, setPractica] = useState({ firma: null, estado: null })
  const practicaEstado = practica.firma === firmaPractica ? practica.estado : null
  const setPracticaEstado = (estado) => setPractica({ firma: firmaPractica, estado })

  // Solo se ofrecen las herramientas que ESTA app calcula para algún par. La
  // app de intradía no tiene Bollinger: ofrecer el botón para que diga siempre
  // «Sin dato» sería prometer algo que no hay.
  const disponibles = useMemo(() => herramientasDisponibles({ fichas, cot, oro, correlaciones, estacionalidad }), [fichas, cot, oro, correlaciones, estacionalidad])

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

  // El precio de ahora (2026-11-17): con el puente encendido, la entrada es el
  // ASK para comprar y el BID para vender, como en el bróker de verdad, y todas
  // las cuentas de la tarjeta (niveles, distancias, %B…) salen de ahí. Con el
  // puente apagado, del cierre de Twelve Data, y la tarjeta lo dice.
  const fp = fuenteDePrecios(mt5)
  const { ficha: fichaViva, entrada } = useMemo(
    () => fichaConPrecioVivo(fichaPar, { fuente: fp.fuente, quotes: mt5.quotes, lado }),
    [fichaPar, fp.fuente, mt5.quotes, lado],
  )

  const a = useMemo(
    () =>
      armarAnalisis({
        ficha: fichaViva,
        lado,
        metodo,
        // Solo las que esta app ofrece ahora: una plantilla guardada con el COT
        // no debe sacar «Sin dato» en la app que no lo tiene.
        herramientas: herr.filter((x) => disponibles.includes(x)),
        perfil,
        ratesUSD,
        calendario: cal,
        tasas: tasasPub?.tasas ?? null,
        monedasDe,
        freno,
        mt5,
        cot,
        oro,
        correlaciones,
        estacionalidad,
        trades,
      }),
    [fichaViva, lado, metodo, herr, disponibles, perfil, ratesUSD, cal, tasasPub, freno, mt5, cot, oro, correlaciones, estacionalidad, trades],
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
        {/* De dónde sale ese precio y de qué hora es. */}
        <FuentePrecio fp={fp} actualizadoEl={mt5.actualizadoEl} style={{ marginTop: -6 }} />
        {a.lado && (
          <p style={{ ...TEXTO, fontSize: 11.5, color: 'var(--text-muted)', marginTop: -6 }}>
            {t(entrada ? (entrada.lado === 'ask' ? 'precioF.entradaAsk' : 'precioF.entradaBid') : 'precioF.entradaTwelve')}
          </p>
        )}

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

        {/* las herramientas encendidas que caben en un renglón. Si no hay
            ninguna, la lista no se pinta: una raya sola sobre un hueco vacío
            parecía un fallo (salió mirando la captura). */}
        {['niveles', 'pivote', 'tendencia', 'rsi', 'atr', 'fuerza', 'compresion', 'swap'].some((k) => k in h) && (
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
            {'swap' in h && (
              <Fila rotulo={t('an.h.swap')}>{h.swap ? t(`an.swap.${h.swap}`) : t(a.lado ? 'an.sinDato' : 'an.swapSinLado')}</Fila>
            )}
          </div>
        )}

        {/* Las seis del 2026-11-15. Cada una en su bloque, con su nota: aquí
            la nota no es adorno, es lo que impide leer el número al revés. */}
        {'spread' in h && (
          <Bloque titulo={t('an.h.spread')}>
            {!h.spread ? (
              <p style={TEXTO}>{t('an.sinPuente')}</p>
            ) : (
              <>
                <Rejilla>
                  <Fila rotulo="Spread">
                    <N>{h.spread.spread.toFixed(1)} pips</N>
                  </Fila>
                  {h.spread.pctStop !== null && (
                    <Fila rotulo="Spread / Stop-loss">
                      <N>{h.spread.pctStop.toFixed(1)}%</N>
                    </Fila>
                  )}
                  {h.spread.actividad !== null && (
                    <Fila rotulo={t('an.actividad')}>
                      <N>{(h.spread.actividad * 100).toFixed(0)}%</N>
                    </Fila>
                  )}
                </Rejilla>
                {h.spread.minutos !== null && h.spread.minutos > 120 && (
                  <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t('an.puenteViejo', { tiempo: h.spread.minutos < 120 ? `${h.spread.minutos} min` : `${Math.round(h.spread.minutos / 60)} h` })}</p>
                )}
                <p style={NOTA}>{t('an.spreadNota')}</p>
              </>
            )}
          </Bloque>
        )}

        {'cot' in h && (
          <Bloque titulo={t('an.h.cot')}>
            {!h.cot ? (
              <p style={TEXTO}>{t('an.sinDato')}</p>
            ) : (
              <>
                <Rejilla>
                  {[
                    [h.cot.b, h.cot.pctB],
                    [h.cot.q, h.cot.pctQ],
                  ].map(([c, v]) => (
                    <Fila key={c} rotulo={<span dir="ltr">{c}</span>}>
                      <N>{v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}</N>
                    </Fila>
                  ))}
                </Rejilla>
                <p style={NOTA}>{t('an.cotNota', { fecha: h.cot.fecha ?? '—' })}</p>
              </>
            )}
          </Bloque>
        )}

        {'oro' in h && (
          <Bloque titulo={t('an.h.oro')}>
            {!h.oro ? (
              <p style={TEXTO}>{t('an.sinDato')}</p>
            ) : (
              <>
                <Rejilla>
                  <Fila rotulo={t('an.oroR')}>
                    <N>{h.oro.r === null ? '—' : h.oro.r.toFixed(2)}</N>
                  </Fila>
                  <Fila rotulo={t('an.oro20')}>
                    <N>{h.oro.cambio20 === null ? '—' : `${h.oro.cambio20 > 0 ? '+' : ''}${(h.oro.cambio20 * 100).toFixed(1)}%`}</N>
                  </Fila>
                </Rejilla>
                <p style={NOTA}>{t('an.oroNota')}</p>
              </>
            )}
          </Bloque>
        )}

        {'correlacion' in h && (
          <Bloque titulo={t('an.h.correlacion')}>
            {!h.correlacion ? (
              <p style={TEXTO}>{t('an.sinDato')}</p>
            ) : h.correlacion.length === 0 ? (
              <p style={TEXTO}>{t('an.correlNinguna')}</p>
            ) : (
              <>
                <Rejilla>
                  {h.correlacion.map((x) => (
                    <Fila key={x.par} rotulo={<span dir="ltr">{x.par}</span>}>
                      <N>{`${x.r > 0 ? '+' : ''}${x.r.toFixed(2)}`}</N>
                    </Fila>
                  ))}
                </Rejilla>
                <p style={NOTA}>{t('an.correlNota')}</p>
              </>
            )}
          </Bloque>
        )}

        {'estacionalidad' in h && (
          <Bloque titulo={t('an.h.estacionalidad')}>
            {!h.estacionalidad ? (
              <p style={TEXTO}>{t('an.sinDato')}</p>
            ) : (
              <>
                <Rejilla>
                  {h.estacionalidad.rHora && (
                    <Fila rotulo={t('an.estHora', { hora: horaLocal(h.estacionalidad.hora, locale) })}>
                      <N>{recorrido(h.estacionalidad.rHora)}</N>
                    </Fila>
                  )}
                  {/* En fin de semana no hay casilla: no hubo mercado, así que
                      la fila no sale en vez de enseñar un «—» que parece fallo. */}
                  {h.estacionalidad.rDia && (
                    <Fila rotulo={t('an.estDia', { dia: nombreDia(h.estacionalidad.dia, locale) })}>
                      <N>{recorrido(h.estacionalidad.rDia)}</N>
                    </Fila>
                  )}
                  <Fila rotulo={t('an.estMes', { mes: nombreMes(h.estacionalidad.mes, locale) })}>
                    <N>{recorrido(h.estacionalidad.rMes)}</N>
                  </Fila>
                  <Fila rotulo={t('an.estDir', { mes: nombreMes(h.estacionalidad.mes, locale) })}>
                    <N>{h.estacionalidad.dir ? `${h.estacionalidad.dir.pct}%${h.estacionalidad.dir.margen !== null ? ` ±${h.estacionalidad.dir.margen}` : ''}` : '—'}</N>
                  </Fila>
                </Rejilla>
                <p style={NOTA}>{t('an.estNota')}</p>
              </>
            )}
          </Bloque>
        )}

        {'diario' in h && h.diario && (
          <Bloque titulo={t('an.h.diario')}>
            <Rejilla>
              <Fila rotulo={t('an.diarioPar')}>
                {h.diario.n === 0 ? (
                  <span style={{ color: 'var(--text-muted)' }}>{t('an.diarioSin')}</span>
                ) : (
                  <N color={h.diario.neto > 0 ? 'var(--green)' : h.diario.neto < 0 ? 'var(--red)' : undefined}>
                    {h.diario.n} · {h.diario.pct.toFixed(0)}% ±{h.diario.margen.toFixed(0)} · {h.diario.neto >= 0 ? '+' : '−'}${Math.abs(h.diario.neto).toFixed(2)}
                  </N>
                )}
              </Fila>
              <Fila rotulo={t('an.diarioAbiertas')}>
                <N>{h.diario.abiertas}</N>
              </Fila>
            </Rejilla>
            {h.diario.abiertas > 0 && <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t('an.diarioMismaApuesta')}</p>}
          </Bloque>
        )}

        {/* El FVG. Enseña DÓNDE quedan los huecos, nunca hacia dónde ir: por
            eso ni el tipo ni la distancia van de verde o de rojo. */}
        {'fvg' in h && (
          <Bloque titulo={t('an.h.fvg')}>
            {!h.fvg ? (
              <p style={TEXTO}>{t('an.sinDato')}</p>
            ) : h.fvg.huecos.length === 0 ? (
              <p style={TEXTO}>{t('an.fvgNinguno')}</p>
            ) : (
              h.fvg.huecos.map((x) => (
                <div key={`${x.tipo}-${x.abajo}-${x.arriba}`} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 600 }}>{t(x.tipo === 'alcista' ? 'an.fvgAlcista' : 'an.fvgBajista')}</span>{' '}
                  <N>
                    {fmt(x.abajo, a.dec)}–{fmt(x.arriba, a.dec)}
                  </N>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                    {x.dentro ? t('an.fvgDentro') : t(x.lado === 'arriba' ? 'an.fvgArriba' : 'an.fvgAbajo', { pips: x.pips.toFixed(0) })} ·{' '}
                    {t(x.estado === 'tocado' ? 'an.fvgTocado' : 'an.fvgAbierto')} · {t('an.fvgVelas')}: <N>{x.velasAtras}</N>
                  </div>
                </div>
              ))
            )}
            {h.fvg && <p style={NOTA}>{t('an.fvgNota')}</p>}
          </Bloque>
        )}

        {/* Las bandas de Bollinger en precio y el %B de verdad (de 0 a 1). */}
        {'bollinger' in h && (
          <Bloque titulo={t('an.h.bollinger')}>
            {!h.bollinger ? (
              <p style={TEXTO}>{t('an.sinDato')}</p>
            ) : (
              <>
                <Rejilla>
                  <Fila rotulo={t('an.bandaArriba')}>
                    <N>{fmt(h.bollinger.arriba, a.dec)}</N>
                  </Fila>
                  <Fila rotulo={t('an.bandaMedia')}>
                    <N>{fmt(h.bollinger.media, a.dec)}</N>
                  </Fila>
                  <Fila rotulo={t('an.bandaAbajo')}>
                    <N>{fmt(h.bollinger.abajo, a.dec)}</N>
                  </Fila>
                  <Fila rotulo={<span dir="ltr">%B</span>}>
                    <N>{h.bollinger.pctB === null ? '—' : h.bollinger.pctB.toFixed(2)}</N>
                  </Fila>
                  <Fila rotulo={t('an.bandaAncho')}>
                    <N>{h.bollinger.anchoPips.toFixed(0)} pips</N>
                  </Fila>
                </Rejilla>
                <p style={NOTA}>{t('an.bollNota')}</p>
              </>
            )}
          </Bloque>
        )}

        {/* Las medias móviles. Ningún número de color: estar por encima de una
            media no es «lo bueno». */}
        {'medias' in h && (
          <Bloque titulo={t('an.h.medias')}>
            {!h.medias ? (
              <p style={TEXTO}>{t('an.sinDato')}</p>
            ) : (
              <>
                <Rejilla>
                  {[
                    ['SMA', h.medias.sma],
                    ['EMA', h.medias.ema],
                  ].flatMap(([nombre, lista]) =>
                    lista.map((x) => (
                      <Fila key={nombre + x.p} rotulo={<span dir="ltr">{`${nombre} ${x.p}`}</span>}>
                        {x.v === null ? (
                          <span style={{ color: 'var(--text-muted)' }}>{t('an.mediaSin')}</span>
                        ) : (
                          <>
                            <N>{fmt(x.v, a.dec)}</N>
                            {x.precio && x.precio !== 'igual' && (
                              <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                                {' '}
                                · {t(x.precio === 'encima' ? 'an.mediaEncima' : 'an.mediaDebajo', { pips: x.pips.toFixed(0) })}
                              </span>
                            )}
                          </>
                        )}
                      </Fila>
                    )),
                  )}
                </Rejilla>
                <p style={NOTA}>{t('an.mediasNota')}</p>
              </>
            )}
          </Bloque>
        )}

        {/* Fibonacci: los niveles del último movimiento. Ninguno de color. */}
        {'fibonacci' in h && (
          <Bloque titulo={t('an.h.fibonacci')}>
            {!h.fibonacci ? (
              <p style={TEXTO}>{t('an.sinDato')}</p>
            ) : h.fibonacci.sinMovimiento ? (
              <p style={TEXTO}>{t('an.fibChico')}</p>
            ) : (
              <>
                <p style={TEXTO}>
                  {t(h.fibonacci.subiendo ? 'an.fibSube' : 'an.fibBaja')}{' '}
                  <N>
                    {fmt(h.fibonacci.desde, a.dec)} → {fmt(h.fibonacci.hasta, a.dec)}
                  </N>
                </p>
                <Rejilla>
                  {h.fibonacci.niveles.map((n) => (
                    <Fila key={n.ratio} rotulo={<span dir="ltr">{`${(n.ratio * 100).toFixed(1)} %`}</span>}>
                      <N>{fmt(n.precio, a.dec)}</N>
                      {n.pips !== null && n.lado !== 'igual' && (
                        <span style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
                          {' '}
                          · {t(n.lado === 'arriba' ? 'an.fvgArriba' : 'an.fvgAbajo', { pips: n.pips.toFixed(0) })}
                        </span>
                      )}
                      {n.ratio === h.fibonacci.cercano && <span style={{ fontWeight: 600, fontSize: 11.5 }}> · {t('an.fibCercano')}</span>}
                    </Fila>
                  ))}
                </Rejilla>
              </>
            )}
            {h.fibonacci && <p style={NOTA}>{t('an.fibNota')}</p>}
          </Bloque>
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

        {/* El modo práctica (2026-11-16): la misma operación, sin dinero. La
            sigue sola la app con precios reales. ⚠️ Sale de ESTA tarjeta y de
            ninguna otra parte, para que los niveles se calculen en un solo
            sitio. Sin la fecha de la vela del barrido no se guarda: sin ella no
            se sabría desde cuándo juzgarla. */}
        {a.niveles && onPracticar && vela && (
          <button
            className="btn"
            type="button"
            style={{ minHeight: 44 }}
            disabled={practicaEstado === 'guardando'}
            onClick={async () => {
              const op = fichaPractica({
                app: APP,
                analisis: a,
                metodo,
                vela: entrada ? velaDeEntradaMt5(APP, vela) : vela,
                entrada,
                cotizacion: mt5.quotes?.[a.par] ?? null,
                fotoEl: mt5.actualizadoEl,
                marcas: marcasDeAnalisis(a),
              })
              if (!op) return setPracticaEstado('error')
              setPracticaEstado('guardando')
              setPracticaEstado(await onPracticar(op))
            }}
          >
            {t('an.practicar')}
          </button>
        )}
        {practicaEstado && practicaEstado !== 'guardando' && (
          <p style={{ ...TEXTO, color: practicaEstado === 'ok' ? 'var(--text-secondary)' : 'var(--amber)' }}>
            {practicaEstado === 'ok' && t('an.practicaOk')}
            {practicaEstado === 'lleno' && t('an.practicaLleno', { max: MAX_ABIERTAS })}
            {practicaEstado === 'sinPermiso' && t('an.practicaSinPermiso')}
            {practicaEstado === 'error' && t('an.practicaError')}
            {practicaEstado === 'ok' && onVerPractica && (
              <>
                {' '}
                <button type="button" onClick={onVerPractica} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--cta)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}>
                  {t('an.practicaVer')}
                </button>
              </>
            )}
          </p>
        )}
      </div>

      <p style={{ ...TEXTO, fontSize: 11.5, color: 'var(--text-muted)' }}>{t('an.pie')}</p>
    </div>
  )
}
