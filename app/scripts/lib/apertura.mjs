// EL ROMPIMIENTO DEL RANGO DE APERTURA (opening range breakout).
//
// POR QUÉ ESTA REGLA Y NO OTRA
// ----------------------------
// Es la herramienta estándar del intradía en Forex, y la app nunca la ha
// tenido. Lo que la app hace hoy —mirar qué divisa está más fuerte y
// perseguirla— es una idea de swing metida en velas de una hora, y medida
// sobre 35 meses da 46% de acierto: peor que una moneda al aire.
//
// La idea del rompimiento es distinta de raíz. No pregunta "¿qué divisa está
// fuerte?" sino "¿por dónde sale el precio cuando llega el dinero de verdad?".
// Cuando abre Londres o Nueva York entra de golpe el grueso del volumen del
// día; el rango de las primeras horas marca dónde están puestas las órdenes, y
// salirse de él suele arrastrar al precio en esa dirección.
//
// Esto NO es la app. Es una regla nueva que se mide aparte para saber si vale
// la pena antes de tocar nada.
//
// CÓMO FUNCIONA, EN CRISTIANO
// ---------------------------
//   1. Abre la sesión (Londres 07:00 UTC, Nueva York 12:00 UTC).
//   2. Se miran las primeras N horas y se anota el techo y el piso: ese es el
//      rango de apertura.
//   3. Si en las horas siguientes el precio SALE por arriba, se compra. Si sale
//      por abajo, se vende.
//   4. El stop va al otro lado del rango: si el precio se devuelve y lo cruza
//      entero, la ruptura era falsa.
//   5. Una sola operación por par y por sesión: la primera ruptura y ya.
//
// LAS DOS FORMAS DE DECIR "ROMPIÓ", Y POR QUÉ SE MIDEN LAS DOS
// -----------------------------------------------------------
// `modo: 'toque'`  — rompe en cuanto el precio TOCA el borde, aunque después
//                    se devuelva. Se entra en el borde mismo. Es la versión
//                    clásica, la de dejar una orden puesta ahí.
// `modo: 'cierre'` — rompe solo si la vela CIERRA fuera del rango. Se entra a
//                    ese cierre. Es más lenta y entra peor, pero se salta las
//                    salidas en falso que se devuelven dentro de la hora.
//
// Cuál de las dos gana no se puede razonar desde el sillón, así que se miden
// las dos en la misma tanda de datos: no cuesta ni una consulta más.
//
// CÓMO EVITA HACER TRAMPA
// -----------------------
// Para decidir la vela i solo se leen datos de velas ≤ i: el rango sale de las
// primeras horas de la sesión (que ya pasaron) y la ruptura se mira en la vela
// actual. `prueba-apertura.mjs` lo comprueba corriendo sobre medio mercado y
// sobre el mercado entero y exigiendo que el tramo común salga idéntico.
//
// ⚠️ Ojo con el filtro de anchura: NO usa `par.atrAbs`, aunque sería lo cómodo.
// Ese ATR es el del final de toda la serie, o sea que para juzgar una sesión de
// hace dos años estaría mirando la volatilidad de hoy — el futuro. En su lugar
// se calcula la anchura media de las 24 velas ANTERIORES al arranque de la
// sesión, que es información que en ese momento ya existía.
//
// Y cuando una misma vela toca los dos lados del rango, la señal se DESCARTA en
// vez de elegir el lado bonito: la vela solo guarda máximo y mínimo, no el
// orden en que ocurrieron, así que no hay manera honesta de saber cuál se tocó
// primero. Esa misma regla es la que hace que el modo 'toque' se pueda juzgar
// con el resolver de siempre (ver abajo).

import { SESIONES } from '../../src/lib/marketCalc.js'

const aFechaUTC = (s) => new Date(s.replace(' ', 'T') + 'Z')

// Las dos aperturas que mueven el día. Sídney y Tokio quedan fuera a propósito:
// mueven mucho menos volumen y sus rangos son tan estrechos que la ruptura es
// casi siempre ruido.
export const APERTURAS = SESIONES.filter(
  (s) => s.clave === 'sesion.londres' || s.clave === 'sesion.nuevaYork'
).map((s) => ({ clave: s.clave, hora: s.desde }))

// Cuántas velas hacia atrás se miran para saber si el rango es ancho o
// ridículo. 24 = un día entero de velas H1.
const VELAS_VOLATILIDAD = 24

/**
 * @param data          salida de computarBarrido() sobre TODAS las velas. De
 *                      ahí salen `barras` y, por par, `highs`/`lows`/`closes`.
 * @param horasRango    cuántas horas forman el rango de apertura.
 * @param horasVentana  cuántas horas después del rango se acepta la ruptura.
 *                      Pasada esa ventana la sesión ya se movió y entrar tarde
 *                      es perseguir.
 * @param objetivoX     el objetivo, en veces el ancho del rango.
 * @param minAncho      el rango tiene que medir al menos esto en veces la
 *                      anchura media de las 24 velas previas. `null` = sin
 *                      filtro.
 * @param modo          'toque' o 'cierre'. Ver arriba.
 * @param neutra        si true, stop y objetivo a la MISMA distancia. Es la
 *                      vara de medir honesta: así el resultado depende solo de
 *                      acertar la dirección, no de que el objetivo esté cerca.
 *
 * @returns señales en el mismo formato que escribe el vigía, listas para
 *          `resolver.mjs`.
 */
export function senalesApertura(
  data,
  { horasRango = 2, horasVentana = 4, objetivoX = 1, minAncho = null, modo = 'cierre', neutra = false } = {}
) {
  const { barras, pares } = data
  const senales = []

  // La hora UTC y el día de cada vela, calculados una vez y no dentro del bucle
  // de cada par: son 14 pares por decenas de miles de velas.
  const horaDe = barras.map((b) => aFechaUTC(b).getUTCHours())
  const diaDe = barras.map((b) => b.slice(0, 10))

  // Dónde arranca cada sesión. Se recorre el tiempo una sola vez.
  const arranques = []
  for (let i = 0; i < barras.length; i++) {
    const ap = APERTURAS.find((a) => a.hora === horaDe[i])
    if (ap) arranques.push({ i, ap })
  }

  for (const par of pares) {
    const { name, highs, lows, closes, dec } = par
    const pip = dec === 2 ? 0.01 : 0.0001

    for (const { i, ap } of arranques) {
      const finRango = i + horasRango
      // El bloque entero (rango + ventana) tiene que caber en los datos.
      if (finRango + horasVentana > barras.length) break
      // Todas las velas del rango tienen que ser del mismo día. Si no, hubo un
      // hueco —fin de semana o feriado— y el "rango de apertura" sería un
      // invento hecho con dos días distintos.
      if (diaDe[finRango - 1] !== diaDe[i]) continue

      let techo = -Infinity
      let piso = Infinity
      for (let k = i; k < finRango; k++) {
        if (highs[k] > techo) techo = highs[k]
        if (lows[k] < piso) piso = lows[k]
      }
      const ancho = techo - piso
      if (!(ancho > 0)) continue

      // El filtro de anchura, solo con velas anteriores al arranque.
      if (minAncho !== null) {
        if (i < VELAS_VOLATILIDAD) continue
        let suma = 0
        for (let k = i - VELAS_VOLATILIDAD; k < i; k++) suma += highs[k] - lows[k]
        const media = suma / VELAS_VOLATILIDAD
        if (media > 0 && ancho < minAncho * media) continue
      }

      // La ruptura: la primera vela de la ventana que se salga del rango.
      for (let k = finRango; k < finRango + horasVentana; k++) {
        if (diaDe[k] !== diaDe[i]) break // se acabó el día

        let compra
        let entrada
        if (modo === 'cierre') {
          // Con el cierre no hay ambigüedad posible: una vela cierra en un
          // sitio y solo en uno.
          if (closes[k] > techo) compra = true
          else if (closes[k] < piso) compra = false
          else continue
          entrada = closes[k]
        } else {
          const arriba = highs[k] >= techo
          const abajo = lows[k] <= piso
          if (!arriba && !abajo) continue
          // Los dos lados en la misma vela: no se puede saber cuál fue primero.
          // Se descarta la sesión entera para este par en vez de inventar.
          //
          // Y esto es además lo que hace honesto medir el modo 'toque' con el
          // resolver de siempre. El resolver juzga desde la vela SIGUIENTE a la
          // de entrada, así que lo que pase dentro de la propia vela k no se
          // mira. Como el stop está justo en el borde contrario, la única forma
          // de que k tocara el stop es que tocara los dos lados — y ese caso se
          // descarta aquí. Lo que sí puede perderse es que k llegara al
          // objetivo: eso sería una GANANCIA no contada, que va en contra
          // nuestra y no a favor.
          if (arriba && abajo) break
          compra = arriba
          entrada = compra ? techo : piso
        }

        const sl = neutra
          ? compra
            ? entrada - ancho
            : entrada + ancho
          : compra
            ? piso
            : techo
        const tp = compra ? entrada + objetivoX * ancho : entrada - objetivoX * ancho

        // Con entrada al cierre, el precio puede haberse ido tan lejos que el
        // stop del otro borde queda a una distancia absurda, o incluso que la
        // entrada ya esté pasada del objetivo. Se descarta en vez de anotar una
        // operación imposible.
        if (!(Math.abs(entrada - sl) > 0) || !(Math.abs(tp - entrada) > 0)) break
        if (compra ? tp <= entrada || sl >= entrada : tp >= entrada || sl <= entrada) break

        const lado = compra ? 'COMPRA' : 'VENTA'
        senales.push({
          id: `${name}|${lado}|apertura`,
          vistoEl: barras[k],
          vela: barras[k],
          par: name,
          lado,
          tipo: 'apertura',
          sesion: ap.clave,
          precio: entrada,
          sl,
          tp,
          rr: Math.abs(tp - entrada) / Math.abs(entrada - sl),
          pipRiesgo: Math.max(1, Math.round(Math.abs(entrada - sl) / pip)),
          pipBeneficio: Math.max(1, Math.round(Math.abs(tp - entrada) / pip)),
          anchoPips: Math.round(ancho / pip),
        })
        break // una sola operación por par y sesión
      }
    }
  }

  // Ordenadas por hora, como las escribiría el vigía.
  return senales.sort((a, b) => (a.vistoEl < b.vistoEl ? -1 : a.vistoEl > b.vistoEl ? 1 : 0))
}
