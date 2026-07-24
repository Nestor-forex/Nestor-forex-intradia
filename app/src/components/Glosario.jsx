import { useState } from 'react'

const TERMINOS = [
  ['Fuerza relativa', 'Qué tan fuerte o débil está una divisa comparada con las otras 7, promediando su cambio de precio reciente. Más alto = más fuerte.'],
  ['Sesgo', 'La inclinación de un par ahora mismo: si conviene más buscar compras o ventas, según qué divisa está más fuerte.'],
  ['Tendencia', 'Si el precio viene subiendo, bajando, o está lateral (sin dirección clara) en las últimas semanas.'],
  ['RSI', 'Mide si un par está "sobrecomprado" (subió muy rápido, podría corregir) o "sobrevendido" (bajó muy rápido). Va de 0 a 100; por encima de 70 o por debajo de 30 son zonas para vigilar.'],
  ['ATR%', 'Qué tanto se mueve el precio de un par en un día normal, en porcentaje. Sirve para poner un stop-loss con espacio razonable, ni muy ajustado ni muy amplio.'],
  ['EMA20 / EMA50', 'El precio promedio de los últimos 20 o 50 días, dándole más peso a los días recientes. Sirve para ver la dirección general sin el ruido de cada día suelto.'],
  ['R/B (riesgo/beneficio)', 'Cuánto se puede ganar comparado con cuánto se arriesga. Un R/B de 2 significa que la ganancia esperada es el doble de lo que se arriesga.'],
  ['Soporte / Resistencia', 'Niveles de precio donde el par ha tenido dificultad para seguir bajando (soporte) o subiendo (resistencia) en el pasado.'],
  ['Stop-loss', 'El precio donde se cierra la operación automáticamente si va en contra, para limitar la pérdida.'],
  ['Take-profit', 'El precio donde se cierra la operación automáticamente si va a favor, para asegurar la ganancia.'],
  ['Invalidación', 'La señal de que la idea de la operación ya no aplica. Si el precio la toca, lo prudente es salir aunque el stop-loss no se haya activado todavía.'],
]

export default function Glosario() {
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setAbierto((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 14px',
          background: 'none',
          border: 'none',
          color: 'var(--text)',
          cursor: 'pointer',
          fontSize: 13.5,
          fontWeight: 600,
          minHeight: 44,
        }}
      >
        ¿Qué significan estos términos?
        <span style={{ color: 'var(--text-muted)' }}>{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TERMINOS.map(([term, def]) => (
            <div key={term}>
              <div className="mono" style={{ fontSize: 12.5, fontWeight: 700 }}>
                {term}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{def}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
