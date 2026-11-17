// La gráfica de una operación de práctica (2026-11-17).
//
// Néstor lo pidió con una foto de la pantalla de detalle de una señal: «esa
// operación sin dinero debe reflejar una gráfica donde el usuario pueda ver
// reflejada su operación con sus parámetros… con todo lo que él indicó
// reflejado en pantalla».
//
// Dibuja las últimas velas del par (máximo-mínimo y la línea de cierres, como
// el detalle de la señal), y encima lo que la persona eligió: entrada,
// Stop-loss y Take-profit, la vela en que entró y, si ya terminó, dónde.
//
// ⚠️ USA LAS MISMAS VELAS CON LAS QUE EL PROGRAMA DECIDE (`graficoDePractica`).
// Con otras, la gráfica podría enseñar el precio tocando el Stop-loss en una
// vela que el programa no vio, y la persona creería que el resultado está mal.
//
// ⚠️ NO SON VELAS COMPLETAS: falta la apertura y no se la inventa (ver la
// cabecera de `SetupDetalle.jsx`). Son barras de máximo-mínimo.
//
// ⚠️ EL COLOR VA POR LO QUE SIGNIFICA EN PLATA (rojo el Stop-loss, verde el
// Take-profit), igual que en el detalle de la señal, no por la dirección.
//
// GEMELO: la forma del barrido (`fechas20`, `serie20`, `altos20`, `bajos20`) es
// la misma en las dos apps.

import { useT } from '../lib/i18n'

const W = 380
const H = 196
const X0 = 8
const X1 = 278
const Y0 = 12
const Y1 = 182
const PILL_W = 92
const PILL_H = 18
const PILL_X = 284

const ROJO = 'oklch(0.66 0.13 25)'
const VERDE = 'oklch(0.72 0.13 155)'
const BLANCO = 'oklch(0.93 0.005 255)'

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
  if (!op) return null
  if (!datos) return <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('prac.grafSinDatos')}</p>

  const { fechas, cierres, altos, bajos, iEntrada, iResuelta } = datos
  const n = fechas.length
  const abierta = !op.estado
  const todos = [...altos, ...bajos, op.entrada, op.sl, op.tp]
  const min = Math.min(...todos)
  const max = Math.max(...todos)
  const pad = (max - min) * 0.06 || 0.0001
  const lo = min - pad
  const hi = max + pad
  const y = (v) => Y0 + ((hi - v) / (hi - lo)) * (Y1 - Y0)
  const x = (i) => X0 + (n > 1 ? (i / (n - 1)) * (X1 - X0) : 0)
  const f = (v) => v.toFixed(dec)
  const puntos = cierres.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  const pastillas = acomodar(
    [
      { clave: 'sl', texto: `SL ${f(op.sl)}`, y: y(op.sl), fondo: ROJO, tinta: '#12070a' },
      { clave: 'entrada', texto: `${t('prac.grafEntrada')} ${f(op.entrada)}`, y: y(op.entrada), fondo: BLANCO, tinta: '#12141c' },
      { clave: 'tp', texto: `TP ${f(op.tp)}`, y: y(op.tp), fondo: VERDE, tinta: '#06140d' },
      ...(abierta ? [{ clave: 'ahora', texto: `${t('prac.grafAhora')} ${f(cierres[n - 1])}`, y: y(cierres[n - 1]), fondo: 'var(--bg-input)', tinta: 'var(--text)' }] : []),
    ],
    PILL_H + 3,
    Y0 - 2,
    Y1 - PILL_H + 2
  )

  // Dónde terminó: en el nivel que tocó, sobre la vela en que lo tocó.
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
        <g stroke="var(--border)" strokeWidth="1">
          <line x1={X0} y1={Y0} x2={X1} y2={Y0} />
          <line x1={X0} y1={Y1} x2={X1} y2={Y1} />
        </g>

        {/* zona de pérdida y zona de ganancia, muy suaves: se lee de un
            vistazo cuánto espacio hay hasta cada nivel */}
        <rect x={X0} y={Math.min(y(op.entrada), y(op.sl))} width={X1 - X0} height={Math.abs(y(op.sl) - y(op.entrada))} fill={ROJO} opacity="0.09" />
        <rect x={X0} y={Math.min(y(op.entrada), y(op.tp))} width={X1 - X0} height={Math.abs(y(op.tp) - y(op.entrada))} fill={VERDE} opacity="0.09" />

        {/* las mechas: hasta dónde llegó el precio en cada vela */}
        {cierres.map((_, i) => (
          <line key={i} x1={x(i)} y1={y(altos[i])} x2={x(i)} y2={y(bajos[i])} stroke="var(--text-muted)" strokeWidth="1.2" opacity="0.6" />
        ))}
        <polyline points={puntos} fill="none" stroke="var(--text-secondary)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />

        {/* los tres niveles que eligió la persona */}
        <line x1={X0} y1={y(op.sl)} x2={X1} y2={y(op.sl)} stroke={ROJO} strokeWidth="1.3" strokeDasharray="5 4" />
        <line x1={X0} y1={y(op.tp)} x2={X1} y2={y(op.tp)} stroke={VERDE} strokeWidth="1.3" strokeDasharray="5 4" />
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
      <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {iEntrada >= 0 ? t('prac.grafPie', { n }) : t('prac.grafAntes', { n })}
      </p>
    </div>
  )
}
