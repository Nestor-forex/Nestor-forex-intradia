// Formato de fechas. El `locale` llega desde el idioma elegido (ver
// idiomas.js): no basta con traducir las palabras, porque el orden de día y
// mes y el nombre de los meses cambian de un idioma a otro. Si no se pasa
// ninguno, se usa el de Colombia, que es el idioma base de la app.

import { IDIOMA_BASE, localeDe } from './i18n/idiomas.js'

const BASE = localeDe(IDIOMA_BASE)

export function fmtFechaHoy(locale = BASE) {
  const d = new Date()
  const s = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function fmtFecha(iso, locale = BASE) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

// Para timestamps completos (fecha + hora), como el momento del último
// refresco de precios en vivo.
export function fmtFechaHora(iso, locale = BASE) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString(locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

// Devuelve la CLAVE de la sesión, no su texto: quien la muestre la traduce.
// Así esta función sigue sin depender del idioma, que es lo que permite
// usarla igual desde la app y desde el script del reporte.
export function claveSesionActiva() {
  const h = new Date().getUTCHours()
  if (h >= 12 && h < 16) return 'sesion.solape'
  if (h >= 8 && h < 12) return 'sesion.londres'
  if (h >= 16 && h < 21) return 'sesion.nuevaYork'
  return 'sesion.asia'
}
