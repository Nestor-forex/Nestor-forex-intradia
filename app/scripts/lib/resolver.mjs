// Decide, mirando lo que hizo el precio después, si cada señal acertó.
//
// Sin esto el historial solo dice "apareció esta señal", que no sirve para
// nada: la pregunta que importa es si la app acierta. Aquí es donde se
// responde.
//
// Cómo: se toma la señal con su entrada, su stop y su objetivo, y se recorren
// las velas POSTERIORES a aquella en la que apareció. Gana si el precio llegó
// al objetivo, pierde si llegó al stop, y sigue abierta si todavía no ha
// llegado a ninguno.

// Cuando UNA MISMA vela toca el stop y el objetivo, no hay forma de saber cuál
// tocó primero: la vela solo guarda máximo y mínimo, no el orden en que
// ocurrieron. En ese caso se cuenta como PERDIDA.
//
// Es una decisión deliberada y va en la dirección incómoda a propósito: un
// historial que se equivoca a favor propio no sirve para decidir si arriesgar
// dinero. Más vale que el porcentaje de acierto salga algo peor que el real y
// no al revés.
export const EMPATE_CUENTA_COMO = 'perdida'

// La clave de una señal concreta. No basta el `id` (par|lado|tipo) porque la
// misma combinación reaparece con el tiempo: cada aparición es una operación
// distinta y hay que juzgarla por separado.
export const claveDe = (s) => `${s.id}@${s.vistoEl}`

/**
 * @param senales   líneas ya parseadas de historial/senales.jsonl
 * @param data      lo que devuelve computarBarrido (trae barras y pares)
 * @param resueltas Set con las claves que ya tienen resultado
 * @returns { resultados, abiertas, caducadas }
 */
export function resolver(senales, data, resueltas = new Set()) {
  const porNombre = new Map(data.pares.map((p) => [p.name, p]))
  const resultados = []
  let abiertas = 0
  let caducadas = 0

  for (const s of senales) {
    const clave = claveDe(s)
    if (resueltas.has(clave)) continue

    const par = porNombre.get(s.par)

    // DESDE QUÉ VELA SE EMPIEZA A JUZGAR.
    //
    // Lo natural es buscar la vela exacta de la señal y empezar por la
    // siguiente, y eso se intenta primero. Pero EXIGIR la vela exacta es
    // frágil, y en la app hermana de swing costó 8 señales reales:
    //
    // El vigía anota la última vela que traía la descarga de ese momento. Si
    // esa vela después desaparece de la serie —la fuente la consolida, la
    // descarta, o era una vela rara de fin de semana— `indexOf` devuelve -1 y
    // la señal queda marcada "caducada" para siempre. Operaciones que el
    // mercado sí resolvió, tiradas por un detalle de la fuente de datos.
    //
    // Aquí todavía no ha pasado, pero el riesgo es MAYOR que en swing: son
    // velas de una hora, y en 300 horas hay muchos más huecos posibles
    // (feriados locales, horas sin cotización, cortes del proveedor) que en
    // 300 días.
    //
    // Ahora, si la vela exacta no está, se busca LA PRIMERA VELA POSTERIOR.
    // Es lo mismo que se hacía (`desde + 1`), sin depender de que la vela de
    // la señal siga existiendo.
    //
    // ⚠️ Estrictamente POSTERIOR, nunca la de la señal ni una anterior.
    // Empezar antes sería juzgar con precios que ya habían pasado cuando la
    // señal nació: inventaría ganancias que nadie pudo tomar. Por eso `>` y
    // no `>=`.
    const exacta = data.barras.indexOf(s.vela)
    const hallada = exacta !== -1 ? exacta + 1 : data.barras.findIndex((b) => b > s.vela)

    // `findIndex` devuelve -1 en dos situaciones OPUESTAS, y confundirlas
    // rompe el historial en la dirección contraria:
    //
    //   · la señal es MÁS VIEJA que la primera vela → caducada de verdad;
    //   · la señal es MÁS NUEVA que la última → todavía no ha pasado nada,
    //     está ABIERTA. Caducarla la mataría en la misma hora en que nace.
    const masViejaQueLaSerie = data.barras.length > 0 && s.vela < data.barras[0]
    const primeraPosterior = hallada === -1 ? data.barras.length : hallada

    // Y una tercera: una señal SIN vela. No debería existir, pero si se
    // renombra el campo o una línea llega a medias, todas las comparaciones
    // darían false y la señal se quedaría abierta para siempre, sin juzgar y
    // sin avisar. Ese silencio es peor que caducarla porque nadie lo nota.
    const sinVela = !s.vela

    // Caduca solo si de verdad no hay nada que mirar ni lo habrá: el par ya no
    // se sigue, la señal quedó fuera de las 300 horas descargadas, o no dice
    // de qué vela es.
    if (!par || masViejaQueLaSerie || sinVela) {
      caducadas++
      resultados.push({
        clave,
        id: s.id,
        par: s.par,
        lado: s.lado,
        vistoEl: s.vistoEl,
        resultado: 'caducada',
        resueltoEl: new Date().toISOString(),
      })
      continue
    }

    const compra = s.lado === 'COMPRA'
    let veredicto = null
    let velaFinal = null

    for (let i = primeraPosterior; i < data.barras.length; i++) {
      const alto = par.highs[i]
      const bajo = par.lows[i]

      // El stop se comprueba PRIMERO: si ambos caben en la misma vela, manda
      // el peor caso (ver EMPATE_CUENTA_COMO arriba).
      const tocaStop = compra ? bajo <= s.sl : alto >= s.sl
      const tocaObjetivo = compra ? alto >= s.tp : bajo <= s.tp

      if (tocaStop) {
        veredicto = 'perdida'
      } else if (tocaObjetivo) {
        veredicto = 'ganada'
      }

      if (veredicto) {
        velaFinal = data.barras[i]
        break
      }
    }

    // Todavía no ha llegado ni al objetivo ni al stop: sigue viva, se vuelve a
    // mirar en la próxima revisión.
    if (!veredicto) {
      abiertas++
      continue
    }

    resultados.push({
      clave,
      id: s.id,
      par: s.par,
      lado: s.lado,
      tipo: s.tipo,
      // Se arrastra desde la señal para que el resultado se pueda leer solo,
      // sin tener que cruzarlo otra vez con `senales.jsonl` para saber si
      // contaba o no. Solo aparece cuando es verdad, igual que en la señal.
      ...(s.sombra ? { sombra: true } : {}),
      vistoEl: s.vistoEl,
      velaEntrada: s.vela,
      velaFinal,
      resultado: veredicto,
      // Cuántas horas tardó en resolverse. Sirve para saber si los objetivos
      // son realistas o si se quedan colgados días.
      // Se cuenta desde la primera vela mirada, no desde la de la señal:
      // resolverse en la siguiente es 1, y sale igual tanto si la vela de la
      // señal sigue en la serie como si desapareció.
      velasTardadas: data.barras.indexOf(velaFinal) - primeraPosterior + 1,
      // Lo que se habría ganado o perdido, en pips, según los niveles que la
      // app dio en su momento.
      pips: veredicto === 'ganada' ? s.pipBeneficio : -s.pipRiesgo,
      rr: s.rr,
      // ⚠️ En los cruces el máximo y el mínimo de la vela son una cota más
      // ancha que la real, así que un nivel puede darse por tocado sin
      // haberlo sido. Se marca para poder separar las cuentas fiables de las
      // aproximadas en vez de mezclarlas en un solo porcentaje.
      exacto: !par.esCruce,
      resueltoEl: new Date().toISOString(),
    })
  }

  return { resultados, abiertas, caducadas }
}

// Las cuentas viven en src/lib/historialCalc.js porque la app las necesita
// igual para pintar la pantalla de Historial. Se reexporta desde aquí para
// que quien use el resolver no tenga que saber dónde están.
export { resumir } from '../../src/lib/historialCalc.js'
