// Lo que señaló la regla que corre en pruebas, en la última vela que señaló.
//
// Néstor lo pidió el 2026-10-24: «en intradía no veo nada». Tenía razón — el
// Historial enseñaba de la sombra solo su PORCENTAJE, así que las 11 señales
// del retroceso que el vigía lleva anotadas desde el 3 de septiembre no se
// podían ver por ninguna parte: ni qué par, ni hacia dónde, ni con qué niveles.
//
// Es el mismo descuido que ya mordió dos veces (`caida` en Swing el
// 2026-09-07, `retroceso` aquí el 2026-09-16 cuando `resumir` devolvía su cubo
// y nadie lo pintaba): **un experimento no termina cuando el vigía lo anota, ni
// cuando tiene su porcentaje — termina cuando se puede VER.**
//
// ⚠️ DE DÓNDE SALEN, y por qué de ahí y no recalculándolas.
//
// Salen de `historial/senales.jsonl`, el archivo que el vigía escribe y que
// esta pantalla YA baja. Cero datos nuevos, cero créditos de Twelve Data y
// cero archivos que publicar.
//
// Pero el motivo de fondo no es el ahorro: recalcularlas en el navegador
// daría **otro** número, porque saldrían del precio de AHORA y no del que
// tenía el par cuando el vigía las anotó. La pantalla y el historial
// discreparían, y el historial es lo único irrecuperable del proyecto. Se lee
// lo ANOTADO.
//
// ⚠️⚠️ AQUÍ SE AGRUPA POR VELA, NO POR DÍA — Y ÉSA ES LA DIFERENCIA CON SWING.
//
// En Swing cada vela ES un día, así que agrupar por día y agrupar por vela son
// lo mismo. Aquí cada vela es una HORA: agrupar por día metería hasta 24 velas
// en el mismo montón y perdería justo lo que esta app mide. La unidad de esta
// app es la vela, así que el grupo es «la última vela en que esa regla
// señaló», con su hora a la vista.
//
// Por eso este archivo es PRIMO y no gemelo del de Swing, y por eso las
// señales de aquí traen `vela` ("2026-10-15 22:00:00") mientras las de allá
// traen `cierre` ("2026-10-15"). Copiar el de Swing habría leído un campo que
// aquí no existe y habría dejado la tarjeta vacía sin dar ningún error.
//
// ⚠️ NO SE DICE «HOY» EN NINGUNA PARTE. Se enseña la fecha y la hora de la
// vela. El vigía corre de lunes a viernes y el reloj de GitHub ya le costó
// horas enteras —medido: cubría 4,3 de las 24 horas del día antes del reloj de
// fuera—, así que lo último anotado puede ser de hace días. Llamarlo «hoy»
// sería afirmar algo que no se ha comprobado; la hora al lado lo dice sin
// afirmar nada.

// ⚠️ `aFechaUTC` se IMPORTA, no se reescribe. Twelve Data manda la hora como
// "2026-10-15 22:00:00", sin zona, y `new Date()` la leería como hora LOCAL
// del teléfono: cinco horas corridas en Colombia. Ese convenio ya vive en
// `marketCalc.js` con su motivo escrito, y tenerlo dos veces es justo el fallo
// del umbral de fuerza en nueve sitios (2026-10-12).
import { aFechaUTC } from './marketCalc.js'

// Las reglas que corren en la sombra, en el orden en que se enseñan.
//
// ⚠️ VA ESCRITA A MANO, como GEMELOS/PRIMOS y por el mismo motivo. Calcularla
// («todos los `tipo` que aparezcan») sería más cómodo y escondería justo lo
// que hay que ver: una regla que el vigía dejara de anotar desaparecería de la
// pantalla sin que nadie lo notara.
//
// ⚠️ AQUÍ SOLO HAY UNA, y no es un recorte: la reversión, «comprar la caída» y
// la ruptura de estructura **están medidas EN ESTA APP y pierden** («comprar la
// caída», −0,08 plano en los tres tamaños). No están porque no deben estar.
//
// ⚠️ Y `'tendencia'` y `'rango'` NO están: son las dos mitades de la regla de
// la propia app. Una señal suya marcada como sombra es una señal pausada, no
// un experimento, y puesta aquí se leería como una regla nueva.
export const REGLAS_SOMBRA = Object.freeze(['retroceso'])

/**
 * La vela de una señal, para agrupar.
 *
 * ⚠️ Se usa `vela` (el timestamp de la VELA que se juzgó) y no `vistoEl` (el
 * instante en que corrió el vigía). Son dos cosas distintas: el vigía puede
 * arrancar a las 22:23 y estar juzgando la vela de las 22:00.
 */
export function velaDe(senal) {
  if (typeof senal?.vela === 'string' && /^\d{4}-\d{2}-\d{2}/.test(senal.vela)) {
    return senal.vela
  }
  // Una señal sin `vela` se cae a `vistoEl` en vez de descartarse: una fila con
  // la hora aproximada se lee; una que no sale, no.
  if (typeof senal?.vistoEl === 'string' && /^\d{4}-\d{2}-\d{2}/.test(senal.vistoEl)) {
    return senal.vistoEl
  }
  return null
}

/**
 * El instante de esa vela, en UTC de verdad, para que la pantalla lo pinte en
 * la hora de quien mira. Devuelve `null` —nunca una fecha inventada— si no se
 * puede leer.
 */
export function instanteDe(senal) {
  const v = velaDe(senal)
  if (!v) return null
  const d = aFechaUTC(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Para cada regla de la sombra, sus señales de la ÚLTIMA vela en que señaló.
 *
 * Devuelve SIEMPRE todas las reglas, también las que no han señalado nunca
 * (`senales: []`, `vela: null`).
 *
 * ⚠️ Eso último es deliberado y es media razón de que esto exista. Esconder una
 * regla sin señales dejaría en pantalla solo lo que parece estar pasando algo,
 * que es cómo se fabrica un espejismo — la misma decisión que los grupos con
 * n = 0 de `Diagnostico`. Y para Néstor, que pidió «no silencio», una regla que
 * dice «todavía nada» informa; una que desaparece, no.
 *
 * @param senales  las líneas crudas de `senales.jsonl`
 * @param reglas   para las pruebas; por defecto `REGLAS_SOMBRA`
 */
export function senalesDeLaUltimaVela(senales, reglas = REGLAS_SOMBRA) {
  const lista = Array.isArray(senales) ? senales : []

  return reglas.map((tipo) => {
    const suyas = lista.filter((s) => s?.tipo === tipo && velaDe(s))
    if (!suyas.length) return { tipo, vela: null, senales: [] }

    // La vela más reciente en que esa regla señaló. Los timestamps son
    // "AAAA-MM-DD HH:MM:SS" con ancho fijo, así que se comparan como texto sin
    // pasar por `Date` — que es donde se cuelan los husos horarios.
    const vela = suyas.reduce((max, s) => {
      const v = velaDe(s)
      return v > max ? v : max
    }, '')

    const deEsaVela = suyas
      .filter((s) => velaDe(s) === vela)
      // Por par, para que el orden no dependa de en qué orden las escribió el
      // vigía: dos cargas de la misma pantalla tienen que dar la misma lista.
      .sort((a, b) => String(a.par).localeCompare(String(b.par)))

    return { tipo, vela, senales: deEsaVela }
  })
}

/**
 * ¿Hay algo que enseñar? Si NINGUNA regla ha señalado nunca, la tarjeta entera
 * sobra: sería un marco vacío.
 */
export function hayAlgoQueEnsenar(grupos) {
  return (grupos || []).some((g) => g?.senales?.length > 0)
}
