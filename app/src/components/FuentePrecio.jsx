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

const horaDe = (iso, locale, conSegundos = false) => {
  const ms = typeof iso === 'string' ? Date.parse(iso) : NaN
  const opciones = conSegundos ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } : { hour: '2-digit', minute: '2-digit' }
  return Number.isFinite(ms) ? new Date(ms).toLocaleTimeString(locale, opciones) : null
}

/**
 * `fp` es lo que devuelve `fuenteDePrecios`; `actualizadoEl`, la hora de la foto de MT5.
 * `conSegundos`: solo donde la pantalla se redibuja cada segundo (la tabla de
 * precios, el Analizador). En la cabecera se redibuja cada 15 y unos segundos
 * que se quedan quietos dirían algo falso.
 */
export default function FuentePrecio({ fp, actualizadoEl, style, conSegundos = false }) {
  const t = useT()
  const { locale } = useIdioma()
  if (!fp || fp.fuente === 'cargando') return null

  const base = { margin: 0, fontSize: 11.5, lineHeight: 1.5, ...style }
  // Todavía no se sabe si hay precio al segundo: se dice eso y nada más. Ver
  // `fuenteDePrecios`.
  if (fp.fuente === 'conectando') {
    return <p style={{ ...base, color: 'var(--text-muted)' }}>{t('precioF.conectando')}</p>
  }
  if (fp.fuente === 'mt5' && fp.alSegundo) {
    return (
      <p style={{ ...base, color: 'var(--text-secondary)' }}>
        <span style={{ color: 'var(--cta)', fontWeight: 600 }}>● </span>
        {conSegundos
          ? t('precioF.alSegundo', { hora: horaDe(actualizadoEl, locale, true) ?? '—' })
          : t('precioF.alSegundoCabecera')}
      </p>
    )
  }
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
