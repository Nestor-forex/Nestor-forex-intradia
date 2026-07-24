export function fmtFechaHoy() {
  const d = new Date()
  const s = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function fmtFecha(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  const s = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
  return s
}

// Para timestamps completos (fecha + hora), como el momento del último
// refresco de precios en vivo.
export function fmtFechaHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('es-CO', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

export function sesionActiva() {
  const h = new Date().getUTCHours()
  if (h >= 12 && h < 16) return 'Solape Londres-Nueva York (máxima liquidez)'
  if (h >= 8 && h < 12) return 'Londres'
  if (h >= 16 && h < 21) return 'Nueva York'
  return 'Asia / Sídney'
}
