import { useMemo} from 'react'
import { MINIMO_PARA_ENSEÑAR, diagnostico } from '../lib/diagnostico'
import { useT } from '../lib/i18n'
import TarjetaPlegable from './TarjetaPlegable'

// TUS números, partidos en grupos. Tarjeta plegable en el Diario.
//
// ⚠️⚠️ EL AVISO VA PRIMERO, ANTES DE NINGÚN NÚMERO. Igual que en `Tasas.jsx`,
// en `Cot.jsx` y en la columna de actividad. Aquí lo caro es leer «38 % en
// cruces» sobre veinte operaciones como un diagnóstico sobre uno mismo.
//
// ⚠️ Y CADA PORCENTAJE LLEVA SU MARGEN PEGADO. No es un adorno: con 20
// operaciones el margen es de ±22 puntos, o sea que un 38 % y un 60 % son el
// mismo número. El precedente de este proyecto es el 89 % de Néstor sobre 9
// operaciones, que parecía un resultado y era una moneda.
//
// ⚠️ EL PORCENTAJE NO SE PINTA DE COLOR; el resultado en dinero SÍ. Un
// acierto alto no es «bueno» por sí solo —está medido en esta app que se puede
// acertar el 55 % y perder dinero— así que pintarlo de verde afirmaría algo que
// el número no dice. El neto sí significa algo en plata, y ahí el color es la
// misma decisión que en `SetupDetalle`.
export default function Diagnostico({ trades }) {
  const tr = useT()
  const d = useMemo(() => diagnostico(trades), [trades])

  // Sin operaciones cerradas no hay nada que partir. No se pinta una tarjeta
  // vacía: se lee como que la app está rota. Misma decisión que `Correlacion`.
  if (!d.total.n) return null

  const num = (v) => (
    <span className="mono" dir="ltr">
      {v}
    </span>
  )

  const fila = (etiqueta, g) => (
    <div
      key={g.clave}
      style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 0', borderTop: '1px solid var(--border)' }}
    >
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text-secondary)' }}>{etiqueta}</div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {num(g.n)} {tr('diag.ops')}
      </div>

      {/* El acierto, en color neutro y SIEMPRE con su margen al lado. */}
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', minWidth: 96, textAlign: 'right' }}>
        {g.pct == null ? (
          num('—')
        ) : (
          <>
            {num(g.pct.toFixed(0) + '%')}{' '}
            <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>{num('±' + g.margen)}</span>
          </>
        )}
      </div>

      <div
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          minWidth: 62,
          textAlign: 'right',
          color: g.n === 0 ? 'var(--text-muted)' : g.neto >= 0 ? 'var(--green)' : 'var(--red)',
        }}
      >
        {num(g.n === 0 ? '—' : (g.neto >= 0 ? '+' : '') + g.neto.toFixed(0))}
      </div>
    </div>
  )

  const bloque = (titulo, filas) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-muted)', marginBottom: 2 }}>{titulo}</div>
      {filas}
    </div>
  )

  return (
    <TarjetaPlegable titulo={tr('diag.titulo', { n: d.total.n })} desc={tr('diag.desc')} paraQue={tr('diag.paraQue')}>

        <div>
          {/* ⚠️ PRIMERO, antes de cualquier número. */}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 8 }}>{tr('diag.aviso')}</div>

          {bloque(tr('diag.tipo'), d.tipoDePar.map((g) => fila(tr(g.clave === 'cruces' ? 'diag.cruces' : 'diag.dolar'), g)))}
          {bloque(tr('diag.direccion'), d.direccion.map((g) => fila(tr('direccion.' + g.clave), g)))}

          {/* Los pares solo salen si tienen suficientes operaciones: uno con
              dos ganadas y un 100 % es el que menos dice de todos. */}
          {d.pares.length > 0 && bloque(tr('diag.pares', { n: MINIMO_PARA_ENSEÑAR }), d.pares.map((g) => fila(<span dir="ltr">{g.clave}</span>, g)))}

          {d.lotes && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.5 }}>
              {tr('diag.lote', { min: d.lotes.min, max: d.lotes.max, distintos: d.lotes.distintos })}
            </div>
          )}

          {/* El ± explicado, y debajo la comparación con la moneda.
              ⚠️ EN ESE ORDEN, y no es estético: primero qué es el número, y
              después la imagen que lo hace entender. Al revés, la moneda se
              lee como una curiosidad suelta y nadie la conecta con el ±.
              Néstor lo pidió después de que se lo contara así por el chat —
              y el suscriptor que lo lea mañana no me tiene a mí al lado. */}
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            {tr('diag.pie')}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>{tr('diag.moneda')}</div>
        </div>
    </TarjetaPlegable>
  )
}
