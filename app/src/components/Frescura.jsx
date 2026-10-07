import { useT } from '../lib/i18n'
import { describirEdad, edadEnMinutos } from '../lib/frescura'

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
export default function Frescura({ generadoEl, horasViejo, style }) {
  const t = useT()

  const edad = describirEdad(edadEnMinutos(generadoEl, new Date()), horasViejo)
  if (!edad) return null

  return (
    <span
      className="mono"
      style={{ fontSize: 11.5, color: edad.viejo ? 'var(--amber)' : 'var(--text-muted)', ...style }}
    >
      {t(`frescura.${edad.clave}`, { n: edad.n })}
    </span>
  )
}
