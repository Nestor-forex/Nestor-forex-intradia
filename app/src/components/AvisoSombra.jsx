import { useT } from '../lib/i18n'
import { OPS_PARA_CREER, confianza } from '../lib/sombra'

// POR QUÉ ESTE NÚMERO TODAVÍA NO SE PUEDE CREER.
//
// Va debajo del porcentaje de cada regla que corre en la sombra. Lo pidió
// Néstor con estas palabras, y son las que manda:
//
//   > son operaciones en positivo pero que no se pueden tomar como señales
//   > porque no tienen operaciones reales suficientes para creerles
//
// ⚠️⚠️ PERO EL AVISO NO DICE «MIDE EN POSITIVO», Y HAY QUE ENTENDER POR QUÉ.
//
// La primera versión sí lo decía, con esas palabras. Salió al MIRAR LA CAPTURA
// con el historial REAL: justo encima de la frase, la reversión iba al 32 % con
// −519 pips y «comprar la caída» al 10 % con −757. La frase era FALSA en
// pantalla.
//
// Néstor tenía razón sobre el BANCO DE PRUEBAS —ahí la reversión mide +0,05
// sobre cinco años— y el registro real hacia adelante va, por ahora, en contra.
// Eso no es un fallo: es exactamente el motivo por el que estas reglas corren en
// la sombra y no se proponen. El aviso dice lo único que es verdad en los dos
// casos: que todavía no se le puede creer, salga el número como salga. Hay una
// comprobación que falla si alguien vuelve a meterle el signo.
//
// ⚠️ NO DICE «NO TE LO CREAS»: DICE UN NÚMERO. «Lleva 18 de las 150 que hacen
// falta» y «con 18, ese porcentaje puede moverse ±23 puntos solo por
// casualidad». Un aviso sin cifras no dice cuándo SÍ se podrá creer, y
// entonces no es información: es un encogimiento de hombros.
//
// Es el mismo argumento que el `±` del Diario (2026-09-14), aplicado al otro
// extremo de la app: allí sobre las operaciones de Néstor, aquí sobre las de
// las reglas en pruebas.
//
// ⚠️ DESAPARECE SOLO cuando la regla llega al listón. No hay que acordarse de
// quitarlo: el día que una pase de 150 operaciones, su aviso deja de pintarse
// y el número pasa a valer. Que el aviso se quite a mano sería la forma más
// fácil de que se quedara ahí para siempre, o de que se fuera antes de tiempo.
export default function AvisoSombra({ ops }) {
  const t = useT()
  const c = confianza(ops)

  // Sin dato no se afirma nada; con el listón cumplido ya no hace falta avisar.
  if (!c || c.suficiente) return null

  return (
    <p
      style={{
        margin: 0,
        fontSize: 11.5,
        lineHeight: 1.45,
        color: 'var(--amber)',
      }}
    >
      {t('sombra.aviso', { ops: c.ops, meta: OPS_PARA_CREER })}
      {/* El margen solo si hay con qué calcularlo: con 0 operaciones es `null`
          —un ±0 diría «este número es exacto», que es lo contrario— y entonces
          la frase se queda en cuántas faltan. */}
      {c.margen !== null && ` ${t('sombra.margen', { ops: c.ops, m: c.margen })}`}
    </p>
  )
}
