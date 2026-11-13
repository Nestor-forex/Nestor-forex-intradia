import { useId, useState } from 'react'
import { useT } from '../lib/i18n'

// EL BOTÓN «¿QUÉ SIGNIFICA?» (2026-11-13).
//
// Va debajo de cada noticia del calendario, de cada tasa y de cada fila del
// COT. Cerrado no ocupa más que un botón pequeño, así que el que ya sabe no
// tiene que leer nada de más; abierto despliega la explicación en palabras
// sencillas.
//
// ⚠️ EL AVISO DE QUE NO ES UNA SEÑAL VA DENTRO DE CADA EXPLICACIÓN, AL FINAL.
// Lo pidió Néstor así: «debe haber una aclaratoria escrita de que no es señal y
// la decisión es del suscriptor». Al final y no al principio porque aquí no
// previene de leer mal un número: cierra lo que se acaba de explicar, que es
// cuando la pregunta «¿y entonces qué hago?» aparece sola.
//
// ⚠️ NO LLEVA COLOR DE DINERO. El borde va en el acento de cada app (cian en
// Swing, dorado en Intradía): un botón solo afirma que es un botón.
//
// `sangria` alinea SOLO el botón con el texto de su fila. La explicación
// abierta usa el ancho entero de la tarjeta: con la sangría heredada salía en
// una columna de tres palabras por renglón en un teléfono (se vio en la
// captura, no en las pruebas).
//
// Es GEMELO.
export default function Explica({ children, sangria = 0 }) {
  const t = useT()
  const [abierto, setAbierto] = useState(false)
  const id = useId()

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ marginInlineStart: sangria }}>
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((v) => !v)}
        style={{
          font: 'inherit',
          fontSize: 11.5,
          fontWeight: 600,
          color: 'var(--cta)',
          background: 'transparent',
          border: '1px solid var(--cta)',
          borderRadius: 999,
          padding: '3px 10px',
          cursor: 'pointer',
        }}
      >
        {abierto ? t('explica.cerrar') : t('explica.boton')}
      </button>
      </div>

      {abierto && (
        <div
          id={id}
          style={{
            marginTop: 8,
            padding: '10px 12px',
            borderInlineStart: '3px solid var(--cta)',
            background: 'var(--bg-input)',
            borderRadius: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 12.5,
            lineHeight: 1.55,
            color: 'var(--text-secondary)',
          }}
        >
          {children}
          <p
            style={{
              margin: 0,
              paddingTop: 8,
              borderTop: '1px solid var(--border)',
              fontSize: 11.5,
              color: 'var(--text-muted)',
            }}
          >
            {t('explica.noEsSenal')}
          </p>
        </div>
      )}
    </div>
  )
}
