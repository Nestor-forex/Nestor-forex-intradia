// Estilos y formatos que comparten las dos tarjetas del laboratorio
// (`Laboratorio.jsx` y `SeguimientoAdelante.jsx`). GEMELO.
//
// Viven aquí y no en un componente para que el linter no avise de que un
// archivo de componentes exporta otras cosas.

export const TEXTO = { fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }
export const ROTULO = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }
export const CAJA = { padding: 12, borderRadius: 10, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }

export const fmtR = (v) => (v === null || v === undefined ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)} R`)
export const colorR = (v) => (v === null || v === undefined ? 'var(--text-secondary)' : v >= 0 ? 'var(--green)' : 'var(--red)')

/** Fecha corta de un Timestamp de Firestore (o null si no hay). */
export function fechaCorta(ts, locale) {
  const d = ts?.toDate ? ts.toDate() : null
  return d ? d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : null
}
