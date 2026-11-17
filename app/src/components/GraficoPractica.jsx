// La gráfica de una operación de práctica (2026-11-17).
//
// Néstor lo pidió con una foto de la pantalla de detalle de una señal: «esa
// operación sin dinero debe reflejar una gráfica donde el usuario pueda ver
// reflejada su operación con sus parámetros… con todo lo que él indicó
// reflejado en pantalla». Y después: «puede ser una imagen pero que se vea como
// un gráfico lo más real posible. Si el usuario quiere ver dónde están ubicados
// su soporte y resistencia porque lo programó, que lo pueda ver en esa gráfica,
// y así con todo lo que él programe».
//
// Dibuja las últimas velas del par y encima:
//   · lo que eligió para la operación: entrada, Stop-loss y Take-profit, la
//     vela en que entró y, si ya terminó, dónde;
//   · lo que tenía encendido en el Analizador al crearla (soporte y
//     resistencia, pivote, medias, Bollinger, Fibonacci, FVG), tal como estaba
//     ESE momento. Cada familia se puede ocultar con un toque.
//
// ⚠️ USA LAS MISMAS VELAS CON LAS QUE EL PROGRAMA DECIDE (`graficoDePractica`).
// Con otras, la gráfica podría enseñar el precio tocando el Stop-loss en una
// vela que el programa no vio, y la persona creería que el resultado está mal.
//
// ⚠️ VELAS DE VERDAD SOLO SI EL BARRIDO TRAE LA APERTURA (`abiertos20`, desde
// el 2026-11-17). Sin ella se dibujan barras de máximo-mínimo y la apertura NO
// se inventa (ver la cabecera de `SetupDetalle.jsx`).
//
// ⚠️ LAS VELAS NO VAN EN VERDE Y ROJO, a propósito: en esta pantalla el rojo es
// el Stop-loss y el verde el Take-profit (lo que significa en plata). Velas
// verdes y rojas debajo harían que una vela bajista se leyera como «tocó el
// Stop-loss». Van como en muchas plataformas en blanco y negro: la que sube,
// hueca; la que baja, rellena.
//
// GEMELO: la forma del barrido es la misma en las dos apps.

import { useState } from 'react'
import { useT } from '../lib/i18n'

const W = 380
const H = 236
const X0 = 8
const X1 = 278
const Y0 = 14
const Y1 = 222
const PILL_W = 92
const PILL_H = 18
const PILL_X = 284

const ROJO = 'oklch(0.66 0.13 25)'
const VERDE = 'oklch(0.72 0.13 155)'
const BLANCO = 'oklch(0.93 0.005 255)'

// Las familias de marcas, en el orden de los botones, con su color. Ninguno es
// rojo ni verde: esos ya significan pérdida y ganancia en esta gráfica.
const FAMILIAS = [
  { id: 'niveles', tipos: ['sop', 'res'], color: 'oklch(0.76 0.09 235)', clave: 'prac.mNiveles' },
  { id: 'pivote', tipos: ['piv'], color: 'oklch(0.74 0.1 300)', clave: 'prac.mPivote' },
  { id: 'medias', tipos: ['ema', 'sma'], color: 'oklch(0.84 0.1 95)', clave: 'prac.mMedias' },
  { id: 'bollinger', tipos: ['bb'], color: 'oklch(0.74 0.06 200)', clave: 'prac.mBollinger' },
  { id: 'fib', tipos: ['fib'], color: 'oklch(0.78 0.09 340)', clave: 'prac.mFib' },
  { id: 'fvg', tipos: ['fvg'], color: 'oklch(0.7 0.05 260)', clave: 'prac.mFvg' },
]
const familiaDe = (k) => FAMILIAS.find((f) => f.tipos.includes(k))

// Separa etiquetas que caerían una encima de otra, conservando el orden.
function acomodar(items, gap, lo, hi) {
  const orden = [...items].sort((a, b) => a.y - b.y)
  let prev = -Infinity
  for (const it of orden) {
    it.yE = Math.max(it.y, prev + gap)
    prev = it.yE
  }
  const exceso = orden.length ? orden[orden.length - 1].yE - hi : 0
  if (exceso > 0) {
    let next = Infinity
    for (const it of [...orden].reverse()) {
      it.yE = Math.min(it.yE - exceso, next - gap)
      next = it.yE
    }
  }
  for (const it of orden) it.yE = Math.max(lo, Math.min(hi, it.yE))
  return items
}

export default function GraficoPractica({ op, datos, dec = 5 }) {
  const t = useT()
  // Las familias ocultas (todas visibles al abrir: es lo que la persona programó).
  const [ocultas, setOcultas] = useState(() => new Set())
  if (!op) return null
  if (!datos) return <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('prac.grafSinDatos')}</p>

  const { fechas, cierres, altos, bajos, abiertos, iEntrada, iResuelta } = datos
  const marcas = Array.isArray(datos.marcas) ? datos.marcas : []
  const n = fechas.length
  const abierta = !op.estado
  const visibles = marcas.filter((m) => !ocultas.has(familiaDe(m.k)?.id))

  // ⚠️ La escala la deciden las velas y los tres niveles de la operación, NO las
  // marcas: una EMA 200 lejana aplastaría las velas hasta no verse. Una marca
  // que queda fuera se dibuja como flecha en el borde, con su precio.
  const todos = [...altos, ...bajos, op.entrada, op.sl, op.tp]
  const min = Math.min(...todos)
  const max = Math.max(...todos)
  const pad = (max - min) * 0.06 || 0.0001
  const lo = min - pad
  const hi = max + pad
  const y = (v) => Y0 + ((hi - v) / (hi - lo)) * (Y1 - Y0)
  const x = (i) => X0 + 6 + (n > 1 ? (i / (n - 1)) * (X1 - X0 - 12) : 0)
  const ancho = Math.max(2, Math.min(9, ((X1 - X0 - 12) / Math.max(1, n)) * 0.6))
  const f = (v) => v.toFixed(dec)
  const dentro = (v) => v >= lo && v <= hi

  const pastillas = acomodar(
    [
      { clave: 'sl', texto: `SL ${f(op.sl)}`, y: y(op.sl), fondo: ROJO, tinta: '#12070a' },
      { clave: 'entrada', texto: `${t('prac.grafEntrada')} ${f(op.entrada)}`, y: y(op.entrada), fondo: BLANCO, tinta: '#12141c' },
      { clave: 'tp', texto: `TP ${f(op.tp)}`, y: y(op.tp), fondo: VERDE, tinta: '#06140d' },
      ...(abierta ? [{ clave: 'ahora', texto: `${t('prac.grafAhora')} ${f(cierres[n - 1])}`, y: y(cierres[n - 1]), fondo: 'var(--bg-input)', tinta: 'var(--text)' }] : []),
    ],
    PILL_H + 3,
    Y0 - 2,
    Y1 - PILL_H + 2,
  )

  // Las etiquetas de las marcas van a la IZQUIERDA, dentro del gráfico, para no
  // pelear con las pastillas de la operación, que van a la derecha.
  const lineas = visibles.filter((m) => m.k !== 'fvg' && dentro(m.v))
  const etiquetas = acomodar(
    lineas.map((m, i) => ({ i, m, y: y(m.v) - 6 })),
    11,
    Y0,
    Y1 - 10,
  )
  const fuera = visibles.filter((m) => m.k !== 'fvg' && !dentro(m.v))
  const zonas = visibles.filter((m) => m.k === 'fvg' && Number.isFinite(m.v2))
  const familiasConMarcas = FAMILIAS.filter((fa) => marcas.some((m) => fa.tipos.includes(m.k)))

  const nombre = (m) => (m.k === 'sop' ? t('prac.mSop') : m.k === 'res' ? t('prac.mRes') : m.e ?? '')
  const fin = op.estado === 'ganada' ? op.tp : op.estado === 'perdida' ? op.sl : null

  return (
    <div style={{ marginTop: 8 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        // ⚠️ No se voltea en árabe: las coordenadas son números fijos y el texto
        // de las etiquetas se saldría de las pastillas (pasó en el detalle).
        dir="ltr"
        style={{ display: 'block', width: '100%', height: 'auto', direction: 'ltr', background: 'var(--bg-input)', borderRadius: 8 }}
        role="img"
        aria-label={t('prac.grafAria', { par: op.par, entrada: f(op.entrada), sl: f(op.sl), tp: f(op.tp) })}
      >
        {/* la cuadrícula, suave, como en una plataforma */}
        <g stroke="var(--border)" strokeWidth="1" opacity="0.7">
          {[0, 0.25, 0.5, 0.75, 1].map((k) => (
            <line key={k} x1={X0} y1={Y0 + k * (Y1 - Y0)} x2={X1} y2={Y0 + k * (Y1 - Y0)} strokeDasharray={k === 0 || k === 1 ? undefined : '1 4'} />
          ))}
        </g>

        {/* zona de pérdida y zona de ganancia, muy suaves */}
        <rect x={X0} y={Math.min(y(op.entrada), y(op.sl))} width={X1 - X0} height={Math.abs(y(op.sl) - y(op.entrada))} fill={ROJO} opacity="0.08" />
        <rect x={X0} y={Math.min(y(op.entrada), y(op.tp))} width={X1 - X0} height={Math.abs(y(op.tp) - y(op.entrada))} fill={VERDE} opacity="0.08" />

        {/* los huecos (FVG): una franja de borde a borde */}
        {zonas.map((m, i) => {
          const a = Math.min(hi, Math.max(lo, m.v))
          const b = Math.min(hi, Math.max(lo, m.v2))
          if (a === b) return null
          return <rect key={`z${i}`} x={X0} y={y(Math.max(a, b))} width={X1 - X0} height={Math.abs(y(a) - y(b))} fill={familiaDe('fvg').color} opacity="0.16" />
        })}

        {/* las velas */}
        {cierres.map((c, i) => {
          const cx = x(i)
          const mecha = <line x1={cx} y1={y(altos[i])} x2={cx} y2={y(bajos[i])} stroke="var(--text-secondary)" strokeWidth="1.1" />
          if (!abiertos) return <g key={i}>{mecha}</g>
          const o = abiertos[i]
          const sube = c >= o
          const top = y(Math.max(o, c))
          const alto = Math.max(1, Math.abs(y(o) - y(c)))
          return (
            <g key={i}>
              {mecha}
              <rect
                x={cx - ancho / 2}
                y={top}
                width={ancho}
                height={alto}
                fill={sube ? 'var(--bg-input)' : 'var(--text-secondary)'}
                stroke="var(--text-secondary)"
                strokeWidth="1"
              />
            </g>
          )
        })}
        {/* sin aperturas, la línea de cierres ayuda a leer el recorrido */}
        {!abiertos && (
          <polyline
            points={cierres.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
            fill="none"
            stroke="var(--text-secondary)"
            strokeWidth="1.4"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.8"
          />
        )}

        {/* lo que la persona programó en el Analizador */}
        {lineas.map((m, i) => (
          <line key={`l${i}`} x1={X0} y1={y(m.v)} x2={X1} y2={y(m.v)} stroke={familiaDe(m.k).color} strokeWidth="1" strokeDasharray={m.k === 'sop' || m.k === 'res' ? '6 3' : '3 3'} opacity="0.9" />
        ))}
        {etiquetas.map((e) => (
          <text key={`e${e.i}`} x={X0 + 3} y={e.yE + 8} fontSize="8.5" fontFamily="var(--font-mono, monospace)" fill={familiaDe(e.m.k).color} stroke="var(--bg-input)" strokeWidth="3" paintOrder="stroke">
            {nombre(e.m)}
          </text>
        ))}
        {/* las que quedan fuera de la escala: una flecha en el borde, con su precio */}
        {fuera.map((m, i) => {
          const arriba = m.v > hi
          const yy = arriba ? Y0 + 9 + i * 10 : Y1 - 3 - i * 10
          return (
            <text key={`f${i}`} x={X1 - 3} y={yy} textAnchor="end" fontSize="8.5" fontFamily="var(--font-mono, monospace)" fill={familiaDe(m.k).color} stroke="var(--bg-input)" strokeWidth="3" paintOrder="stroke">
              {arriba ? '↑' : '↓'} {nombre(m)} {f(m.v)}
            </text>
          )
        })}

        {/* los tres niveles de la operación */}
        <line x1={X0} y1={y(op.sl)} x2={X1} y2={y(op.sl)} stroke={ROJO} strokeWidth="1.4" strokeDasharray="5 4" />
        <line x1={X0} y1={y(op.tp)} x2={X1} y2={y(op.tp)} stroke={VERDE} strokeWidth="1.4" strokeDasharray="5 4" />
        <line x1={X0} y1={y(op.entrada)} x2={X1} y2={y(op.entrada)} stroke={BLANCO} strokeWidth="1.1" strokeDasharray="2 3" opacity="0.85" />

        {/* la vela en que entró */}
        {iEntrada >= 0 && (
          <g>
            <line x1={x(iEntrada)} y1={Y0} x2={x(iEntrada)} y2={Y1} stroke={BLANCO} strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
            <circle cx={x(iEntrada)} cy={y(op.entrada)} r="3.6" fill={BLANCO} />
          </g>
        )}

        {/* dónde terminó */}
        {fin !== null && iResuelta >= 0 && (
          <g>
            <circle cx={x(iResuelta)} cy={y(fin)} r="4.2" fill={op.estado === 'ganada' ? VERDE : ROJO} />
            <circle cx={x(iResuelta)} cy={y(fin)} r="8" fill="none" stroke={op.estado === 'ganada' ? VERDE : ROJO} strokeWidth="1" opacity="0.5" />
          </g>
        )}

        {abierta && <circle cx={x(n - 1)} cy={y(cierres[n - 1])} r="3.2" fill="var(--text)" />}

        {pastillas.map((p) => (
          <g key={p.clave}>
            <line x1={X1} y1={p.y} x2={PILL_X} y2={p.yE + PILL_H / 2} stroke={p.fondo} strokeWidth="1" opacity="0.6" />
            <rect x={PILL_X} y={p.yE} width={PILL_W} height={PILL_H} rx="5" fill={p.fondo} />
            <text x={PILL_X + PILL_W / 2} y={p.yE + 12.6} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono, monospace)" fontWeight="600" fill={p.tinta}>
              {p.texto}
            </text>
          </g>
        ))}
      </svg>

      {/* Mostrar u ocultar cada herramienta que se programó. */}
      {familiasConMarcas.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {familiasConMarcas.map((fa) => {
            const visible = !ocultas.has(fa.id)
            return (
              <button
                key={fa.id}
                type="button"
                aria-pressed={visible}
                onClick={() =>
                  setOcultas((s0) => {
                    const s1 = new Set(s0)
                    if (s1.has(fa.id)) s1.delete(fa.id)
                    else s1.add(fa.id)
                    return s1
                  })
                }
                style={{
                  minHeight: 30,
                  padding: '0 9px',
                  borderRadius: 999,
                  fontSize: 11.5,
                  cursor: 'pointer',
                  border: `1px solid ${visible ? fa.color : 'var(--border-strong)'}`,
                  background: 'none',
                  color: visible ? fa.color : 'var(--text-muted)',
                  textDecoration: visible ? 'none' : 'line-through',
                }}
              >
                {t(fa.clave)}
              </button>
            )
          })}
        </div>
      )}

      <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {iEntrada >= 0 ? t('prac.grafPie', { n }) : t('prac.grafAntes', { n })}
        {abiertos ? '' : ` ${t('prac.grafSinApertura')}`}
        {familiasConMarcas.length > 0 ? ` ${t('prac.grafMarcas')}` : marcas.length === 0 ? ` ${t('prac.grafSinMarcas')}` : ''}
      </p>
    </div>
  )
}
