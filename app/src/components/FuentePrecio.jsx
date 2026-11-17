// La línea que dice de DÓNDE sale el precio que se ve y DE QUÉ HORA es.
// Ver la cabecera de `lib/precioVivo.js`.
//
// Va debajo del título del barrido, en el tablero completo y en el Analizador:
// los tres sitios donde se lee un precio.
//
// ⚠️ Con el puente apagado NO es un error, y no va en rojo: el precio de Twelve
// Data es real, solo que más espaciado. Va en ámbar porque dice «esto no es lo
// más reciente que podría ser», que es lo que el ámbar significa en la app.
//
// GEMELO.

import { useT, useIdioma } from '../lib/i18n'
import { APP } from '../lib/identidad'

const horaDe = (iso, locale) => {
  const ms = typeof iso === 'string' ? Date.parse(iso) : NaN
  return Number.isFinite(ms) ? new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : null
}

/** `fp` es lo que devuelve `fuenteDePrecios`; `actualizadoEl`, la hora de la foto de MT5. */
export default function FuentePrecio({ fp, actualizadoEl, style }) {
  const t = useT()
  const { locale } = useIdioma()
  if (!fp || fp.fuente === 'cargando') return null

  const base = { margin: 0, fontSize: 11.5, lineHeight: 1.5, ...style }
  if (fp.fuente === 'mt5') {
    return (
      <p style={{ ...base, color: 'var(--text-secondary)' }}>
        <span style={{ color: 'var(--cta)', fontWeight: 600 }}>● </span>
        {t('precioF.mt5', { hora: horaDe(actualizadoEl, locale) ?? '—', min: fp.edadMin ?? 0 })}
      </p>
    )
  }
  const motivo = fp.motivo === 'viejo' ? t('precioF.viejo', { hora: horaDe(actualizadoEl, locale) ?? '—' }) : t('precioF.apagado')
  return (
    <p style={{ ...base, color: 'var(--amber)' }}>
      {t(`precioF.twelve_${APP}`)} {motivo}
    </p>
  )
}
