// El botón de la vista (punto 11 del plan). Va en la cabecera, al lado del
// idioma, porque es del mismo tipo: una preferencia de quien mira, que vale
// para todas las pestañas.
//
// Un toque cambia de vertical a horizontal y al revés. El nombre del botón
// dice a cuál PASA, no en cuál está: un botón que dice «Vertical» estando ya en
// vertical se lee como un adorno.
//
// ⚠️ La explicación de qué hace (y de que en un PC la pantalla no gira) va en
// el `title` y en la etiqueta para lectores de pantalla, no en un párrafo: la
// cabecera no tiene sitio. La guía de suscriptores lo explica entero.
//
// GEMELO.

import { useEffect, useState } from 'react'
import { useT } from '../lib/i18n'
import { HORIZONTAL, VERTICAL, aplicarVista, guardarVista, intentarGirar, leerVista } from '../lib/vistaPantalla'

export default function SelectorVista() {
  const t = useT()
  const [vista, setVista] = useState(leerVista)

  useEffect(() => {
    aplicarVista(vista)
  }, [vista])

  const otra = vista === HORIZONTAL ? VERTICAL : HORIZONTAL
  const cambiar = () => {
    setVista(otra)
    guardarVista(otra)
    intentarGirar(otra)
  }

  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={cambiar}
      title={t('vistaP.ayuda')}
      aria-label={t(otra === HORIZONTAL ? 'vistaP.aHorizontalLargo' : 'vistaP.aVerticalLargo')}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 10px' }}
    >
      {/* El dibujo del aparato en la posición a la que se pasa. */}
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ flexShrink: 0 }}>
        {otra === HORIZONTAL ? (
          <rect x="1.5" y="4" width="13" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        ) : (
          <rect x="4" y="1.5" width="8" height="13" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        )}
      </svg>
      <span className="nf-vista-txt" style={{ fontSize: 12 }}>{t(otra === HORIZONTAL ? 'vistaP.aHorizontal' : 'vistaP.aVertical')}</span>
    </button>
  )
}
