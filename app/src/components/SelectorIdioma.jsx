// Botón de idioma. Por dentro es un <select> nativo y no un menú hecho a mano:
// en el teléfono el nativo abre la rueda del sistema, se maneja con el teclado
// y lo lee bien un lector de pantalla, cosa que un menú propio habría que
// reconstruir entero para igualar.
//
// El <select> va invisible encima del botón para conservar ese comportamiento
// nativo sin heredar la apariencia del sistema, que no combina con la app.

import { IDIOMAS } from '../lib/i18n/idiomas'
import { useIdioma } from '../lib/i18n'

export default function SelectorIdioma({ compacto = false }) {
  const { idioma, setIdioma, t } = useIdioma()
  const actual = IDIOMAS.find((i) => i.codigo === idioma)

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <span
        className="mono"
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          minHeight: 36,
          padding: compacto ? '0 8px' : '0 10px',
          borderRadius: 8,
          border: '1px solid var(--border-strong)',
          background: 'var(--bg-input)',
          color: 'var(--text-secondary)',
          fontSize: 12.5,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: 13 }}>🌐</span>
        {compacto ? idioma.toUpperCase() : actual?.nombre || idioma}
      </span>

      <select
        value={idioma}
        onChange={(e) => setIdioma(e.target.value)}
        aria-label={t('comun.idioma')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          // El color explícito evita que en Safari la lista salga con texto
          // blanco sobre fondo blanco al desplegarse.
          color: '#000',
        }}
      >
        {IDIOMAS.map((i) => (
          <option key={i.codigo} value={i.codigo}>
            {i.nombre}
          </option>
        ))}
      </select>
    </div>
  )
}
