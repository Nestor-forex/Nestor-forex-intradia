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
    const desde = data.barras.indexOf(s.vela)

    // La vela en la que apareció ya no está entre las que descargamos (solo
    // llegan las últimas 300 horas, ~12 días). No se puede juzgar y no tiene
    // sentido volver a intentarlo cada hora para siempre.
    if (!par || desde === -1) {
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

    for (let i = desde + 1; i < data.barras.length; i++) {
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
      vistoEl: s.vistoEl,
      velaEntrada: s.vela,
      velaFinal,
      resultado: veredicto,
      // Cuántas horas tardó en resolverse. Sirve para saber si los objetivos
      // son realistas o si se quedan colgados días.
      velasTardadas: data.barras.indexOf(velaFinal) - desde,
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
