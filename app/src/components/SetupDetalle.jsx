// Pantalla de detalle de un setup: el gráfico de los últimos 20 cierres con los
// niveles encima, la relación riesgo/beneficio dibujada, y el plan en texto.
//
// A propósito NO dibuja velas: la fuente solo entrega el cierre de cada hora,
// sin máximo ni mínimo intrabar, así que unas velas serían inventadas. Por eso
// va una línea con área, igual que Sparkline pero con ejes y niveles.
//
// Tampoco tiene botones de comprar/vender: la app no está conectada a ningún
// bróker y no puede ejecutar nada. La acción real es pasar el setup al Diario.

import { useId, useState } from 'react'
import { useT } from '../lib/i18n'

// Geometría del lienzo. El canal de la derecha queda libre para las pastillas.
const W = 380
const H = 200
const X0 = 8
const X1 = 286
const Y0 = 12
const Y1 = 186
const PILL_W = 82
const PILL_H = 19
const PILL_X = 294

// Separa etiquetas que caerían una encima de otra, conservando el orden de
// arriba a abajo. Sin esto, un stop muy pegado al precio actual (justo lo que
// pasa en los setups buenos) deja las dos pastillas ilegibles.
function acomodar(items, minGap, lo, hi) {
  const orden = [...items].sort((a, b) => a.y - b.y)
  let prev = -Infinity
  for (const it of orden) {
    it.yEtiqueta = Math.max(it.y, prev + minGap)
    prev = it.yEtiqueta
  }
  // Si el empuje hacia abajo se salió del lienzo, se devuelve el exceso hacia arriba.
  const exceso = orden.length ? orden[orden.length - 1].yEtiqueta - hi : 0
  if (exceso > 0) {
    let next = Infinity
    for (const it of [...orden].reverse()) {
      it.yEtiqueta = Math.min(it.yEtiqueta - exceso, next - minGap)
      next = it.yEtiqueta
    }
  }
  for (const it of orden) it.yEtiqueta = Math.max(lo, Math.min(hi, it.yEtiqueta))
  return items
}

export default function SetupDetalle({ setup, corte, onVolver, onAnotar }) {
  const t = useT()
  const [copiado, setCopiado] = useState(false)
  // Id propio del degradado: con un id fijo, dos gráficos en la misma página
  // compartirían la definición y el segundo heredaría el color del primero.
  const gradId = `sd-fill-${useId()}`
  const c = setup?.crudo

  // Sin los datos crudos no hay nada que dibujar (por ejemplo si quedara una
  // versión vieja del barrido en caché).
  if (!c) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Encabezado onVolver={onVolver} t={t} />
        <main style={{ padding: '24px 18px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {t('detalle.sinDatos')}
          </p>
        </main>
      </div>
    )
  }

  const { dec, compra, precio, sl, tp, ema, rr, pipRiesgo, pipBeneficio, sup, res, pivote, serie20, rsi, atrPct, fuerzaB, fuerzaQ, b, q } = c
  const f = (v) => v.toFixed(dec)
  const colorLado = compra ? 'var(--green)' : 'var(--red)'
  const rrOk = rr >= 1.5

  // Dominio vertical: la serie más los niveles, para que ninguno quede fuera.
  const todos = [...serie20, sl, tp, precio, sup, res, pivote]
  const min = Math.min(...todos)
  const max = Math.max(...todos)
  const pad = (max - min) * 0.06 || 0.0001
  const lo = min - pad
  const hi = max + pad
  const y = (v) => Y0 + ((hi - v) / (hi - lo)) * (Y1 - Y0)
  const x = (i) => X0 + (i / (serie20.length - 1)) * (X1 - X0)

  const puntos = serie20.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `M${puntos.split(' ').join(' L')} L${X1},${Y1} L${X0},${Y1} Z`

  // Niveles de dinero: los tres que deciden cuánto ganas o pierdes.
  const pastillas = acomodar(
    [
      { clave: 'sl', etiqueta: 'SL', valor: sl, y: y(sl), fondo: 'oklch(0.66 0.13 25)', texto: '#12070a' },
      { clave: 'ahora', etiqueta: 'AHORA', valor: precio, y: y(precio), fondo: 'oklch(0.93 0.005 255)', texto: '#12141c' },
      { clave: 'tp', etiqueta: 'TP', valor: tp, y: y(tp), fondo: 'oklch(0.72 0.13 155)', texto: '#06140d' },
    ],
    PILL_H + 3,
    Y0 - 2,
    Y1 - PILL_H + 2
  )

  // Niveles de contexto: se dibujan quietos, con la etiqueta a la izquierda.
  const contexto = acomodar(
    [
      { etiqueta: t('detalle.etqResistencia'), valor: res, y: y(res), color: 'oklch(0.6 0.02 255)', trazo: '2 4' },
      { etiqueta: t('detalle.etqPivote'), valor: pivote, y: y(pivote), color: 'var(--accent)', trazo: '5 4' },
      { etiqueta: t('detalle.etqSoporte'), valor: sup, y: y(sup), color: 'oklch(0.6 0.02 255)', trazo: '2 4' },
    ],
    12,
    Y0 + 8,
    Y1 - 2
  )

  const textoNiveles = [
    `${setup.name} — ${t(`lado.${setup.lado}`)}`,
    t('detalle.copiaEntrada', { v: f(precio) }),
    t('detalle.copiaSl', { v: f(sl) }),
    t('detalle.copiaTp', { v: f(tp) }),
    t('detalle.copiaRb', { v: rr.toFixed(1) }),
    t('detalle.copiaPips', { riesgo: Math.round(pipRiesgo), beneficio: Math.round(pipBeneficio) }),
    corte ? `(${corte})` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoNiveles)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles (o navegador viejo): no se pretende que
      // funcionó, se deja el botón como estaba.
    }
  }

  const pctRiesgo = (pipRiesgo / (pipRiesgo + pipBeneficio)) * 100

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Encabezado onVolver={onVolver} t={t} />

      <main style={{ flex: 1, padding: '16px 16px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* --- par y lado --- */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.01em' }}>
              {setup.name}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              {dec === 2 ? t('detalle.pip2') : t('detalle.pip4')} · {t('detalle.granularidad')}
            </div>
          </div>
          <span
            style={{
              marginLeft: 'auto',
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              padding: '5px 10px',
              borderRadius: 999,
              color: colorLado,
              background: compra ? 'oklch(0.72 0.13 155 / 0.18)' : 'oklch(0.66 0.13 25 / 0.18)',
              border: `1px solid ${compra ? 'oklch(0.72 0.13 155 / 0.4)' : 'oklch(0.66 0.13 25 / 0.4)'}`,
            }}
          >
            {t(`lado.${setup.lado}`)}
          </span>
        </div>

        {/* --- gráfico --- */}
        <div className="card" style={{ padding: '10px 6px 6px' }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            // El gráfico NO se voltea en árabe: sus coordenadas son números
            // fijos, y al heredar la dirección del documento el texto de las
            // etiquetas se dibujaba hacia el lado contrario, saliéndose de las
            // pastillas y quedando cortado contra el borde.
            dir="ltr"
            style={{ display: 'block', width: '100%', height: 'auto', direction: 'ltr' }}
            role="img"
            aria-label={t('detalle.graficoAria', { n: serie20.length, par: setup.name, precio: f(precio), sl: f(sl), tp: f(tp) })}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={compra ? 'oklch(0.72 0.13 155 / 0.26)' : 'oklch(0.66 0.13 25 / 0.26)'} />
                <stop offset="100%" stopColor={compra ? 'oklch(0.72 0.13 155 / 0)' : 'oklch(0.66 0.13 25 / 0)'} />
              </linearGradient>
            </defs>

            {/* rejilla mínima: arriba, medio, abajo */}
            <g stroke="var(--border)" strokeWidth="1">
              <line x1={X0} y1={Y0} x2={X1} y2={Y0} />
              <line x1={X0} y1={(Y0 + Y1) / 2} x2={X1} y2={(Y0 + Y1) / 2} />
              <line x1={X0} y1={Y1} x2={X1} y2={Y1} />
            </g>

            {/* contexto: soporte, resistencia, pivote. La etiqueta lleva un
                contorno del color del fondo para que la línea punteada no la
                atraviese, y así la línea puede seguir cruzando todo el ancho. */}
            {contexto.map((n) => (
              <line
                key={n.etiqueta}
                x1={X0}
                y1={n.y}
                x2={X1}
                y2={n.y}
                stroke={n.color}
                strokeWidth="1"
                strokeDasharray={n.trazo}
                opacity="0.8"
              />
            ))}

            {/* precio: área + línea (solo cierres) */}
            <path d={area} fill={`url(#${gradId})`} />
            <polyline
              points={puntos}
              fill="none"
              stroke={compra ? 'oklch(0.72 0.13 155)' : 'oklch(0.66 0.13 25)'}
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* último cierre, enfatizado */}
            <circle cx={X1} cy={y(serie20.at(-1))} r="3.4" fill="var(--text)" />
            <circle cx={X1} cy={y(serie20.at(-1))} r="7" fill="none" stroke="oklch(0.93 0.005 255 / 0.35)" strokeWidth="1" />

            {/* niveles de dinero */}
            {pastillas.map((n) => (
              <g key={n.clave}>
                <line
                  x1={X0}
                  y1={n.y}
                  x2={PILL_X - 2}
                  y2={n.y}
                  stroke={n.fondo}
                  strokeWidth="1"
                  strokeDasharray={n.clave === 'ahora' ? undefined : '4 3'}
                  opacity={n.clave === 'ahora' ? 0.55 : 1}
                />
                <rect x={PILL_X} y={n.yEtiqueta} width={PILL_W} height={PILL_H} rx="4" fill={n.fondo} />
                <text
                  x={PILL_X + 6}
                  y={n.yEtiqueta + 13.5}
                  fontFamily="var(--font-mono)"
                  fontSize="10"
                  fontWeight="600"
                  fill={n.texto}
                >
                  {n.etiqueta} {f(n.valor)}
                </text>
              </g>
            ))}

            {/* Las etiquetas de contexto van al final, encima de todo: si se
                dibujaran junto a sus líneas, las líneas del stop y del objetivo
                (que se pintan después) las atravesarían. */}
            {contexto.map((n) => {
              const txt = `${n.etiqueta} ${f(n.valor)}`
              // Ancho aproximado del texto en mono a 8.5px, más el interletrado.
              const ancho = txt.length * 5.5 + 5
              return (
                <g key={`et-${n.etiqueta}`}>
                  <rect x={X0 + 1} y={n.yEtiqueta - 11} width={ancho} height={11} fill="var(--bg-card)" />
                  <text x={X0 + 3} y={n.yEtiqueta - 3} fontFamily="var(--font-mono)" fontSize="8.5" fill={n.color} letterSpacing="0.06em">
                    {txt}
                  </text>
                </g>
              )
            })}
          </svg>
          <div
            className="mono"
            style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px 0', fontSize: 10, color: 'var(--text-muted)' }}
          >
            <span>{t('detalle.hace', { n: serie20.length })}</span>
            <span>{t('detalle.sinVelas')}</span>
            <span>{t('detalle.ahora')}</span>
          </div>
        </div>

        {/* --- riesgo / beneficio --- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <Rotulo>{t('detalle.riesgoBeneficio')}</Rotulo>
            <span
              className="mono"
              style={{ marginLeft: 'auto', fontSize: 17, fontWeight: 600, color: rrOk ? 'var(--green-strong)' : 'var(--amber)' }}
            >
              1 : {rr.toFixed(1)}
            </span>
          </div>
          <div
            style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', background: 'var(--bg-input)' }}
            role="img"
            aria-label={t('detalle.barraAria', { pct: Math.round(pctRiesgo) })}
          >
            <i style={{ width: `${pctRiesgo}%`, background: 'var(--red)' }} />
            <i style={{ width: `${100 - pctRiesgo}%`, background: rrOk ? 'var(--green)' : 'var(--amber)' }} />
          </div>
          <div className="mono" style={{ display: 'flex', gap: 14, fontSize: 10.5, color: 'var(--text-secondary)' }}>
            <span>{t('detalle.riesgoPips', { n: Math.round(pipRiesgo) })}</span>
            <span>{t('detalle.beneficioPips', { n: Math.round(pipBeneficio) })}</span>
          </div>
          {!rrOk && (
            <div style={{ fontSize: 11.5, color: 'var(--amber)' }}>
              {t('detalle.rbBajo')}
            </div>
          )}
        </div>

        {/* --- escenario --- */}
        <div className="card" style={{ borderLeft: `2px solid ${colorLado}`, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Rotulo>{compra ? t('detalle.escenarioCompra') : t('detalle.escenarioVenta')}</Rotulo>
          <p style={{ margin: 0, fontSize: 13.5 }}>
            {t('detalle.escenarioTexto', {
              fuerte: compra ? b : q,
              debil: compra ? q : b,
              direccion: compra ? t('detalle.alcista') : t('detalle.bajista'),
              accion: compra ? t('detalle.comprarPorEncima') : t('detalle.venderPorDebajo'),
              precio: f(precio),
              tp: f(tp),
              ema: f(ema),
            })}
          </p>
        </div>

        {/* --- niveles --- */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
          <Nivel color="var(--text)" nombre={t('setup.entrada')} valor={f(precio)} nota={t('detalle.nivelActual')} destacado />
          <Nivel color="var(--red)" nombre={t('setup.stopLoss')} valor={f(sl)} nota={`${Math.round(pipRiesgo)} p`} destacado />
          <Nivel color="var(--green)" nombre={t('setup.takeProfit')} valor={f(tp)} nota={`${Math.round(pipBeneficio)} p`} destacado />
          <Nivel color="var(--accent)" nombre={t('detalle.pivote')} valor={f(pivote)} nota={t('detalle.nivelSesion')} />
          <Nivel color="oklch(0.6 0.02 255)" nombre={t('setup.resistencia')} valor={f(res)} nota={t('detalle.nivelMax20')} />
          <Nivel color="oklch(0.6 0.02 255)" nombre={t('setup.soporte')} valor={f(sup)} nota={t('detalle.nivelMin20')} ultimo />
        </div>

        {/* --- por qué --- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Rotulo>{t('detalle.porQue')}</Rotulo>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Number.isFinite(fuerzaB) && Number.isFinite(fuerzaQ) && (
              <Chip>
                {b} <b className="mono">{fuerzaB.toFixed(1)}</b> vs {q} <b className="mono">{fuerzaQ.toFixed(1)}</b>
              </Chip>
            )}
            <Chip>
              RSI <b className="mono">{rsi}</b>
              {rsi > 70 || rsi < 30 ? t('detalle.chipExtendido') : rsi >= 40 && rsi <= 60 ? t('detalle.chipContinuacion') : ''}
            </Chip>
            <Chip>{t('detalle.chipEmas')}</Chip>
            <Chip>
              ATR <b className="mono">{atrPct.toFixed(2)}%</b>
            </Chip>
          </div>
        </div>

        {/* --- invalidación --- */}
        <div
          style={{
            display: 'flex',
            gap: 9,
            padding: '10px 12px',
            borderRadius: 'var(--radius-card)',
            background: 'oklch(0.75 0.13 85 / 0.09)',
            border: '1px solid oklch(0.75 0.13 85 / 0.28)',
            fontSize: 12.5,
          }}
        >
          <span style={{ color: 'var(--amber)', fontWeight: 700, flexShrink: 0 }} aria-hidden="true">
            !
          </span>
          <span>{setup.inval ? t('detalle.seInvalida', { cond: setup.inval }) : t('detalle.sinInvalidacion')}</span>
        </div>

        {/* --- acciones --- */}
        <div style={{ display: 'flex', gap: 9 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => onAnotar?.(setup)}>
            {t('detalle.anotar')}
          </button>
          <button type="button" className="btn" style={{ flex: 1 }} onClick={copiar}>
            {copiado ? t('detalle.copiado') : t('detalle.copiar')}
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {t('detalle.aviso')}
        </p>
      </main>
    </div>
  )
}

function Encabezado({ onVolver, t }) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        padding: '10px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <button onClick={onVolver} className="btn-ghost" style={{ padding: '0 12px', minHeight: 36, fontSize: 13, flexShrink: 0 }}>
        {t('detalle.volver')}
      </button>
      <div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        {t('detalle.encabezado')}
      </div>
    </header>
  )
}

// Rótulo de sección. A propósito NO usa la clase .eyebrow del resto de la app:
// esa es verde, y en esta pantalla el verde ya significa "take-profit" y
// "beneficio". Un rótulo decorativo del mismo color le quitaría fuerza al dato.
function Rotulo({ children }) {
  return (
    <span
      className="mono"
      style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)' }}
    >
      {children}
    </span>
  )
}

function Nivel({ color, nombre, valor, nota, destacado = false, ultimo = false }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        background: destacado ? 'var(--bg-input)' : 'var(--bg-card)',
        borderBottom: ultimo ? 'none' : '1px solid var(--border)',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 7 }}>
        <i style={{ width: 3, height: 15, borderRadius: 2, background: color, flexShrink: 0 }} />
        {nombre}
      </span>
      <span className="mono" style={{ marginLeft: 'auto', fontSize: 14 }}>
        {valor}
      </span>
      <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', minWidth: 52, textAlign: 'right' }}>
        {nota}
      </span>
    </div>
  )
}

function Chip({ children }) {
  return (
    <span
      style={{
        fontSize: 11.5,
        padding: '5px 9px',
        borderRadius: 999,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
      }}
    >
      {children}
    </span>
  )
}
