import { useT } from '../lib/i18n'
import { OPS_PARA_CREER } from '../lib/sombra'
import TarjetaPlegable from './TarjetaPlegable'

// QUÉ ES ESTA APP, Y QUÉ NO ES. La primera tarjeta de la primera pantalla.
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE, con las palabras de Néstor, que son las que mandan
// ─────────────────────────────────────────────────────────────────────────
//
//   > mis apps no venden, por ahora, señales para copiar, y eso quiero que las
//   > apps lo dejen bien claro. las señales que se ven allí sencillamente son
//   > pruebas o experimentos que los usuarios pueden ver que funciona o no
//   > mientras ellas recopilan información […] ellos solo pueden ver cómo
//   > evolucionan esas pruebas pero nunca, jamás deberían verlas como señales
//   > para copiar
//
//   > al llegar a sus 150 operaciones en el tiempo YO decido si seguir midiendo
//   > o cambiar a otros experimentos
//
//   > las apps solo serían como de información necesaria para ahorrar tiempo en
//   > los análisis y tomar decisiones oportunas al momento de operar
//
// Hasta hoy el aviso existía **por regla**: `AvisoSombra` debajo de cada
// porcentaje y `sombraSenales.aviso` encima de la lista. Los dos dicen que esa
// regla concreta no se puede creer todavía. Lo que NO había en ninguna parte es
// lo de arriba: qué es la app ENTERA, qué pasa cuando un experimento termina y
// **quién decide**. Y eso no se puede deducir de los avisos por regla — se
// puede leer un aviso suelto como «esta todavía no, las otras sí».
//
// ⚠️ NO CAMBIA NADA DE CÓMO FUNCIONA LA APP. Lo pidió así («quiero que todo
// esté tal cual como están las apps, solo el aviso»): no toca una señal, ni un
// umbral, ni el aviso al celular. Es texto.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ LO QUE NO HAY QUE ABLANDAR
// ─────────────────────────────────────────────────────────────────────────
//
// 1. **DICE «SI» ALGUNO PASA SU LISTÓN, NUNCA «CUANDO».** Hoy van nueve
//    familias medidas y nueve que no pasan; el registro real hacia adelante va
//    en contra de los backtests (la reversión mide 54 % en cinco años y va al
//    39 % real). Escribir «cuando alguno pase» prometería un resultado que
//    puede no existir, y encima en la pantalla cuyo único argumento es no
//    afirmar más de lo que se puede demostrar.
//
// 2. **EL LISTÓN SE LEE, NO SE ESCRIBE.** El 150 viene de `OPS_PARA_CREER`. Es
//    la lección de `medicion.queSignifica`, que dijo «55 %» durante meses
//    porque el número estaba escrito a mano en los 13 idiomas.
//
// 3. **NO NOMBRA NINGUNA REGLA NI NINGÚN PAR.** Por eso este archivo puede ser
//    GEMELO: lo que dice vale igual con velas diarias que con velas de una
//    hora. Meter aquí el nombre de un experimento, un número de pares o un
//    umbral sería crear una divergencia esperando a ocurrir.
//
// 4. **LA FRASE QUE DECIDE VA EN `avance`, O SEA VISIBLE CON LA TARJETA
//    CERRADA.** Un aviso que solo aparece al abrir una tarjeta plegada no es un
//    aviso: es una nota al pie. Lo demás sí va dentro, porque es la explicación
//    y se lee una vez.
export default function QueEsEstaApp() {
  const t = useT()

  return (
    <TarjetaPlegable
      titulo={t('queEs.titulo')}
      desc={t('queEs.desc')}
      paraQue={t('queEs.paraQue')}
      avance={
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: 'var(--amber)' }}>
          {t('queEs.avance')}
        </p>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <Parrafo>{t('queEs.informacion')}</Parrafo>

        {/* El bloque de los experimentos va destacado: es el que contesta la
            pregunta por la que existe la tarjeta. */}
        <div
          style={{
            borderLeft: '2px solid var(--amber)',
            paddingLeft: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <Parrafo>{t('queEs.experimentos')}</Parrafo>
          <Parrafo>{t('queEs.liston', { meta: OPS_PARA_CREER })}</Parrafo>
          <Parrafo>{t('queEs.quienDecide')}</Parrafo>
        </div>

        <Parrafo>{t('queEs.privilegio')}</Parrafo>
        <Parrafo>{t('queEs.puedeQueNo')}</Parrafo>
        <Parrafo>{t('queEs.riesgo')}</Parrafo>
      </div>
    </TarjetaPlegable>
  )
}

// Sin `dir` fijo a propósito: son frases TRADUCIDAS y los números que llevan
// dentro son enteros sueltos, que en árabe se leen bien solos. Forzarle `ltr`
// al renglón entero es el fallo del calendario, que partía «24.5K» en dos.
function Parrafo({ children }) {
  return (
    <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
      {children}
    </p>
  )
}
