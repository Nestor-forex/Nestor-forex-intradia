import { useT } from '../lib/i18n'
import { costeDeLaAntiguedad, describirEdad, edadEnMinutos } from '../lib/frescura'

// DE CUÁNDO ES EL BARRIDO QUE ESTÁS VIENDO.
//
// Un renglón al lado de la fecha de la vela. Las cuentas y el porqué están en
// `lib/frescura.js`; aquí solo se pinta.
//
// ⚠️ ES INFORMACIÓN, NO UNA ALARMA. No apaga ni cambia ninguna señal. Decir
// «esto se calculó hace 3 horas» es un hecho; decir «no operes» sería un
// consejo, y eso iría al banco de pruebas como todo lo demás de este proyecto.
//
// ⚠️ ANTE LA DUDA NO SE PINTA NADA. Si el barrido no trae `generadoEl` —o trae
// algo que no se entiende— `describirEdad` devuelve `null` y aquí no sale ni un
// renglón. Nunca un «hace 0 h» inventado, que afirmaría que el dato está fresco
// justo cuando no se sabe.
//
// ⚠️ EL ÁMBAR SOLO CUANDO DE VERDAD ESTÁ VIEJO, y el umbral lo pone quien
// llama (`useMarketData.js`, que es PRIMO): las dos apps publican con cadencias
// distintas, así que un dato de 3 horas es viejo en Intradía y normal en Swing.
//
// ⚠️ NO LLEVA `dir="ltr"`, a propósito. Es una frase TRADUCIDA con un número
// entero dentro, y un entero suelto dentro de texto árabe se lee bien solo —los
// números son LTR por naturaleza—. Forzarle `ltr` al renglón entero es el fallo
// del calendario, que partía «24.5K» en dos. La regla de la casa: se fija la
// dirección solo de lo que NO es idioma.
export default function Frescura({ generadoEl, horasViejo, costePorAntiguedad, style }) {
  const t = useT()

  const minutos = edadEnMinutos(generadoEl, new Date())
  const edad = describirEdad(minutos, horasViejo)
  if (!edad) return null

  // ⚠️ SOLO SALE DONDE ESTÉ MEDIDO. Sin tabla (Swing hoy) esto es `null` y no
  // se pinta ni un carácter. Ver `costeDeLaAntiguedad` y el comentario de
  // `COSTE_POR_ANTIGUEDAD` en el `useMarketData.js` de cada app.
  const coste = costeDeLaAntiguedad(minutos, costePorAntiguedad)

  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span
        className="mono"
        style={{ fontSize: 11.5, color: edad.viejo ? 'var(--amber)' : 'var(--text-muted)', ...style }}
      >
        {t(`frescura.${edad.clave}`, { n: edad.n })}
      </span>
      {coste && (
        // ⚠️ El texto dice «de las que ves» y NO «pierdes más»: lo medido es
        // que esa parte de las señales ya no se puede tomar, no que la app
        // acierte menos — el acierto no se movió en toda la tabla. Confundir
        // las dos cosas sería la etiqueta equivocada de siempre.
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', ...style }}>
          {t('frescura.coste', { pct: Math.round(coste.pct), horas: coste.horas })}
        </span>
      )}
    </span>
  )
}
