// EL LISTÓN DEL CORTE DÓLAR / CRUCES EN INTRADÍA.
//
// Escrito el 2026-10-24, ANTES de medir nada en esta app. Ese orden es lo
// único que distingue esto de buscarle una explicación a un número que ya se
// vio.
//
// ═════════════════════════════════════════════════════════════════════════
// ⚠️⚠️ ESTO NO ES EL LISTÓN DE SWING, Y LA DIFERENCIA ES LA QUE DECIDE
// ═════════════════════════════════════════════════════════════════════════
//
// En Swing el corte se encontró MIRANDO los resultados (el 2026-10-21, al
// desglosar Bollinger por divisa) y el listón se escribió después para
// juzgarlo. Aquí la situación es la contraria y mejor: **el corte no se ha
// mirado nunca en esta app.** Lo que hay es una hipótesis traída de la otra,
// y eso permite algo que allá era imposible — fijar la dirección ANTES.
//
// Lo medido en Swing (1.341 días, vara neutra 1:1, spread por par):
//
//                      los 14    con dólar    cruces (CONTROL)
//   la app             −0,040      +0,073          −0,142
//
// ⚠️⚠️ POR ESO LA DIRECCIÓN VA FIJADA AQUÍ Y NO SE ELIGE DESPUÉS.
//
// La tentación es medir los dos montones y quedarse con el que gane. **Eso no
// valdría nada**: con dos montones siempre hay uno mejor, y elegirlo al verlo
// es exactamente el troceo a posteriori que este proyecto rechazó con el
// control de la confluencia (2026-09-04) y con el de «comprar la caída».
//
// Con la dirección escrita antes, la medición contesta una pregunta de verdad:
// **¿se repite en otra app, con otras velas y otros pares, lo que se vio en
// Swing?** Si sale al revés —si aquí la app fuera mejor en los cruces— eso NO
// cuenta como aprobado: sería una hipótesis nueva, y tendría que medirse en
// datos que nadie ha mirado todavía.
export const FECHA_DEL_LISTON = '2026-10-24'

// La hipótesis, fijada antes de medir: la app de Intradía mide MEJOR en los
// pares con dólar que con sus 18, igual que la de Swing.
export const MONTON_PREDICHO = 'dolar'

// ⚠️ Y el motivo por el que esta predicción es FLOJA, dicho antes de verla
// fallar o acertar: **nadie ha explicado POR QUÉ pasa en Swing.** Hay un
// número y no hay mecanismo. Sin mecanismo, predecir la misma dirección en
// otra app es poco más que una moneda al aire — y en este proyecto hay diez
// casos escritos de un mecanismo convincente que resultó falso al medirlo.
//
// Lo que hace que valga la pena medirlo igual es que es GRATIS en datos
// nuevos: el banco ya se baja estas velas, así que la pregunta se contesta con
// 14 créditos y sin inventar nada.
export const HAY_MECANISMO = false

// ⚠️ El veredicto se decide con la VARA NEUTRA 1:1, no con la geometría de la
// app. El motivo está medido: el 2026-09-14 el COT salió positivo en las dos
// mitades con la geometría real y negativo en las dos con la vara neutra, con
// las MISMAS operaciones. Un filtro puede seleccionar operaciones con buena
// proporción objetivo/riesgo sin acertar ni una dirección de más.
export const VARA_QUE_DECIDE = 'neutra 1:1'

// ═════════════════════════════════════════════════════════════════════════
// ⚠️⚠️ LA TRAMPA QUE HACE QUE ESTO NO SEA UNA RESTA
// ═════════════════════════════════════════════════════════════════════════
//
// La app NO propone todos los pares que pasan el filtro: ordena los 18 por
// divergencia de fuerza y se queda con los **N mejores de compra y N de
// venta** (`topN`). Si se quitan los 11 cruces, los huecos SIGUEN SIENDO LOS
// MISMOS: el que estaba cuarto sube al hueco, y entra en otra hora, a otro
// precio, con su propio resultado.
//
// ⚠️ **Por tanto «la app sin cruces» NO es «la app menos lo malo»: es OTRA app
// con otras operaciones.** Por eso se mide la app ENTERA restringida al
// universo (`universo` en `backtest-nucleo.mjs`), nunca sumando el montón de
// los pares con dólar de la tabla de hoy.
//
// ⚠️ Y AQUÍ EL RECORTE ES MÁS GRANDE QUE EN SWING, que tiene 7 y 7. Esta app
// tiene **7 pares con dólar y 11 cruces**, así que quedarse con los primeros
// quita el **61 %** del universo, no la mitad. Se espera menos señales que
// allá, y por eso el criterio 4 va en fracción y no en un número absoluto
// copiado.
export const PARES_CON_DOLAR = 7
export const PARES_CRUCE = 11

// ⚠️⚠️ Y SI AQUÍ RESULTA SER UNA RESTA LIMPIA, LA MEDICIÓN SIGUE VALIENDO.
//
// Que el cuarto suba al hueco depende de que haya MÁS de `topN` candidatos por
// lado, y los filtros de esta app son más estrictos que los de Swing (ADX,
// RSI). Puede que aquí no pase nunca — un barrido de 54 mercados inventados no
// encontró ni un caso.
//
// Eso NO cambia lo que se mide ni afloja ningún criterio: se mide igual la app
// entera con el universo restringido, que es lo correcto en los dos casos. Lo
// único que cambia es cómo se LEE el resultado, y por eso `medir-cruces.mjs`
// imprime el número en vez de suponerlo:
//
//   · con desplazamiento → la mejora puede venir de las señales que suben;
//   · sin desplazamiento → es «la app menos ese montón», y entonces este
//     listón es más estricto de lo que hacía falta, nunca menos.
export const DESPLAZAMIENTO_ES_EMPIRICO = true

// ─────────────────────────────────────────────────────────────────────────
// LOS CRITERIOS. Todos obligatorios.
// ─────────────────────────────────────────────────────────────────────────

// 1. MEJORA DE VERDAD, medida sobre la app entera restringida al universo.
//
//    El umbral es el mismo 0,02 de Swing y por dos motivos a la vez, no uno:
//    es el ruido (con resultados por operación de −1 a +1 y miles de
//    operaciones, el error típico de cada media ronda 0,01-0,02) y es el
//    mínimo para que signifique algo en plata.
export const UMBRAL = 0.02

// 2. GANA EN LAS DOS MITADES del periodo. Es el criterio que de verdad separa
//    una mejora de un reparto afortunado: el ruido no se repite en las dos
//    mitades. Es el que tumbó al COT (+0,002 y −0,065) y a Bollinger+RSI
//    (+0,071 y −0,026).
export const EXIGE_DOS_MITADES = true

// 3. ⚠️ EL CONTROL TIENE QUE FALLAR. La app con el montón CONTRARIO (los 11
//    cruces) debe salir PEOR que su línea de base. Sin esto no hay forma de
//    distinguir «el corte dice algo» de «partir los pares en dos da uno mejor
//    por azar».
export const EXIGE_CONTROL_PEOR = true

// 4. LA APP SIGUE HABLANDO LO SUFICIENTE.
//
// ⚠️ VA EN FRACCIÓN Y NO EN UN NÚMERO ABSOLUTO, y el motivo es que el número
// de Swing (15 al mes) está derivado de SUS ~36 al mes. Copiarlo aquí sería
// traerse una suposición sobre otra app — el fallo de `barridoSwap`, que ya
// tumbó dos tablas con los créditos gastados.
//
// El número sale de la ESTRUCTURA, no de ningún resultado: los pares con
// dólar son 7 de 18, o sea el **39 %** del universo. En Swing quedó medido que
// las señales escalan aproximadamente con los pares (50 % de los pares → 49 %
// de las señales), así que aquí se espera algo cerca del 39 %. Se pide **30 %**
// como suelo: solo falla si pasa algo que no se espera.
//
// ⚠️ Y queda escrito por qué NO se pide más: el criterio equivalente de Swing
// se escribió primero imposible por construcción (pedía el 70 % cuando la
// aritmética da el 49 %) y hubo que corregirlo antes de medir. Un criterio que
// no puede cumplirse no mide nada: tumba la hipótesis sin mirar el mercado.
export const MIN_FRACCION_SENALES = 0.3

// 5. AGUANTA 0,5 PIPS DE SWAP POR NOCHE. Una regla que solo gana con swap cero
//    no gana en una cuenta real.
//
//    ⚠️ Y en ESTA app el swap pesa distinto que en Swing, con la causa medida:
//    aquí el stop típico es de ~30 pips contra los ~120 de allá, así que el
//    mismo coste es el 7 % del riesgo en vez del 1,8 %. Además está medido
//    (Fase 2, 2026-09-02) que el **52 % de sus operaciones reales cruzan al
//    menos una noche**, pese a llamarse Intradía.
export const SWAP_EXIGIDO = 0.5

// 6. ⚠️ NINGÚN PAR APORTA MÁS DEL 40 % DE LA MEJORA. Con solo 7 pares en el
//    montón, uno que se lleve casi todo no es una regla: es ese par en ese
//    periodo.
export const MAX_POR_PAR = 0.4

// ⚠️⚠️ LO QUE ESTE LISTÓN NO AUTORIZA, Y HAY QUE TENERLO ESCRITO ANTES:
//
// 1. **Pasarlo no enciende nada.** Quitar 11 pares cambia qué señales propone
//    la app, así que sería un cambio de la app y no un experimento de sombra:
//    decisión de Néstor, con su propio PR, su prueba y su verificación.
//
// 2. ⚠️ **Y aunque pasara, la app seguiría perdiendo.** Intradía mide −0,13
//    por unidad de riesgo con la vara neutra. Una mejora de 0,02 o de 0,05 la
//    deja en −0,11 o en −0,08: sigue siendo negativo, y «menos malo» no es
//    «bueno». Esto es información sobre dónde funciona peor, no una ruta a la
//    rentabilidad. En Swing la base era −0,040 y el corte la ponía en
//    positivo; aquí ni el mejor caso imaginable hace eso.
//
// 3. **La correlación.** Si la app solo operara pares con dólar, serían 7
//    pares muy correlacionados entre sí — el 2026-09-30 quedó medido que cinco
//    señales con dólar pueden ser una sola apuesta dicha cinco veces. Más
//    rentable por operación y menos diversificado no es automáticamente mejor,
//    y este listón no lo mide.
export const QUE_NO_AUTORIZA = Object.freeze({
  encender: false,
  porque:
    'quitar pares cambia las señales de la app, no es un experimento de sombra; ' +
    'la app seguiria perdiendo aunque el corte pasara (parte de -0,13); ' +
    'y 7 pares con dolar estan muy correlacionados entre si (medido el 2026-09-30)',
})

// ⚠️ Si algún resultado queda A UN PELO de un criterio, la respuesta NO es
// aflojarlo. Éste es el momento exacto para el que se escribe el listón antes.

/**
 * El veredicto se CALCULA. No se argumenta.
 *
 * @param d.monton           qué montón se está juzgando ('dolar' | 'cruces')
 * @param d.porRiesgo        la app restringida a ese montón, vara neutra
 * @param d.base             la app con los 18 pares
 * @param d.mitades          [1ª, 2ª] de la variante
 * @param d.mitadesBase      [1ª, 2ª] de la base
 * @param d.control          la app con el montón CONTRARIO
 * @param d.senales          operaciones de la variante
 * @param d.senalesBase      operaciones de la base, para la fracción
 * @param d.conSwap          la variante pagando SWAP_EXIGIDO
 * @param d.aporteMaxPar     fracción de la mejora que aporta el par que más
 */
export function juzgar(d) {
  const falta = []
  const num = (x) => typeof x === 'number' && Number.isFinite(x)

  // ⚠️ Un dato que falta NO es un criterio cumplido. Devuelve `null` —«no se
  // pudo juzgar»— y nunca «no pasa», que son cosas distintas. Misma asimetría
  // que `pearson` y `difMax`.
  const necesarios = [d?.porRiesgo, d?.base, d?.control, d?.senales, d?.senalesBase, d?.conSwap]
  if (!necesarios.every(num)) return null
  if (!Array.isArray(d.mitades) || !Array.isArray(d.mitadesBase)) return null
  if (!d.mitades.every(num) || !d.mitadesBase.every(num)) return null

  // ⚠️⚠️ LA DIRECCIÓN, PRIMERO Y SIN EXCEPCIÓN. Juzgar el montón que no se
  // predijo sería elegir el ganador después de verlo, que es justo lo que este
  // archivo existe para impedir. No es un criterio más: es la condición de que
  // la medición signifique algo.
  if (d.monton !== MONTON_PREDICHO) {
    return {
      pasa: false,
      falta: [
        `el montón juzgado («${d.monton}») no es el predicho («${MONTON_PREDICHO}»): ` +
          'elegirlo tras ver la tabla sería troceo a posteriori',
      ],
    }
  }

  // ⚠️ La tolerancia de coma flotante no es paranoia: `−0,06 − (−0,04)` en
  // JavaScript da −0,019999999999999997, así que un resultado que cae
  // exactamente en el umbral se iría al lado cómodo por el último bit de un
  // decimal.
  const EPS = 1e-9
  const mejora = d.porRiesgo - d.base
  if (!(mejora >= UMBRAL - EPS)) falta.push(`mejora de ${mejora.toFixed(3)} y hace falta ${UMBRAL}`)

  if (EXIGE_DOS_MITADES) {
    const peores = d.mitades
      .map((m, i) => (m >= d.mitadesBase[i] - EPS ? null : i === 0 ? '1ª' : '2ª'))
      .filter(Boolean)
    if (peores.length) falta.push(`no mejora en la mitad ${peores.join(' ni la ')}`)
  }

  if (EXIGE_CONTROL_PEOR && !(d.control <= d.base + EPS)) {
    falta.push(`el CONTROL (montón contrario) no empeora: ${d.control.toFixed(3)} contra ${d.base.toFixed(3)}`)
  }

  const fraccion = d.senalesBase > 0 ? d.senales / d.senalesBase : 0
  if (!(fraccion >= MIN_FRACCION_SENALES - EPS)) {
    falta.push(
      `deja el ${(100 * fraccion).toFixed(0)} % de las señales de la app y hace falta el ` +
        `${(100 * MIN_FRACCION_SENALES).toFixed(0)} %`
    )
  }

  if (!(d.conSwap >= UMBRAL - EPS + d.base)) {
    falta.push(`pagando ${SWAP_EXIGIDO} de swap la mejora cae a ${(d.conSwap - d.base).toFixed(3)}`)
  }

  if (num(d.aporteMaxPar) && !(d.aporteMaxPar <= MAX_POR_PAR + EPS)) {
    falta.push(`un solo par aporta el ${(100 * d.aporteMaxPar).toFixed(0)} % de la mejora`)
  }

  return { pasa: falta.length === 0, falta }
}

export const QUE_SIGNIFICA = Object.freeze({
  pasa:
    'lo visto en Swing se repite en otra app, con otras velas y otros pares, y sobrevive ' +
    'a su propio control y a las dos mitades. NO se enciende: se le PROPONE a Néstor, con ' +
    'la nota de que la app seguiria perdiendo y de que los 7 pares estan muy correlacionados',
  noPasa:
    'el corte de Swing NO se repite aqui. Eso no lo desmiente alla —son velas distintas y ' +
    'esa es la regla de siempre— pero si deja sin apoyo la idea de que sea algo general ' +
    'del Forex, y la app se queda con sus 18 pares',
})
