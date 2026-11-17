// DE DÓNDE SALE EL PRECIO QUE SE ENSEÑA, y decirlo (2026-11-17).
//
// Néstor vio en Intradía «Vela H1 más reciente: 8:00 p. m.» a las 8:49 y lo
// leyó, con razón, como que el precio llegaba con una hora de atraso: «me
// parece muy mal este error de ofrecer información en tiempo real y no lo
// sea… la idea es que la dé el puente encendido y cuando no lo esté que lo dé
// Twelve Data, pero con la información de qué es y por qué es».
//
// Así queda:
//
//   · PUENTE ENCENDIDO (foto de MT5 de hace poco) → el precio es el de MT5, el
//     de una cuenta real del desarrollador, con la HORA de la foto al lado.
//   · PUENTE APAGADO o foto vieja → el precio es el de Twelve Data (el cierre
//     de la última vela del barrido), y se dice por qué: «el puente está
//     apagado» o «la última foto de MT5 es de hace X», y cada cuánto se
//     actualiza Twelve Data en esta app.
//
// ⚠️⚠️ LO QUE ESTO NO ES, Y LA PANTALLA LO DICE: tiempo real al segundo. El
// puente publica cada pocos minutos en un archivo, y el archivo tarda unos
// minutos más en llegar a los teléfonos. Por eso va siempre la hora de la foto
// y nunca la palabra «ahora» a secas: un precio sin su hora se lee como de
// este instante.
//
// ⚠️ NUNCA SE NOMBRA AL BRÓKER (Néstor, 2026-11-15). Se dice «una cuenta real
// del desarrollador de la app».
//
// GEMELO: el puente es uno para las dos apps; cada una filtra sus pares.

import { minutosDesde } from './useMT5Quotes.js'

/**
 * Hasta cuántos minutos se da por buena una foto de MT5. El puente publica
 * cada 5 minutos y GitHub tarda hasta 5 más en servir el archivo nuevo, así
 * que en un día normal la foto tiene entre 0 y 10 minutos. 20 deja margen para
 * una vuelta perdida sin que se cuele una foto de hace una hora.
 */
export const EDAD_MAX_MT5_MIN = 20

/**
 * Qué fuente manda ahora.
 *
 * @returns {{ fuente: 'mt5'|'twelve'|'cargando', edadMin: number|null,
 *             motivo: 'apagado'|'viejo'|null }}
 *   · `motivo` solo con `twelve`: 'apagado' (no hay foto de MT5 que leer) o
 *     'viejo' (la hay, pero de hace más de EDAD_MAX_MT5_MIN).
 */
export function fuenteDePrecios({ estado, actualizadoEl, ahora = new Date() } = {}) {
  if (estado === 'cargando') return { fuente: 'cargando', edadMin: null, motivo: null }
  const edadMin = minutosDesde(actualizadoEl, ahora)
  if (estado === 'ok' && edadMin !== null && edadMin <= EDAD_MAX_MT5_MIN) return { fuente: 'mt5', edadMin, motivo: null }
  // ⚠️ Una foto «del futuro» (reloj del teléfono atrasado) se acepta como
  // reciente: `minutosDesde` ya la deja en 0.
  if (estado === 'ok' && edadMin !== null) return { fuente: 'twelve', edadMin, motivo: 'viejo' }
  return { fuente: 'twelve', edadMin, motivo: 'apagado' }
}

const num = (x) => typeof x === 'number' && Number.isFinite(x)

/**
 * El precio de ENTRADA de un par según la fuente.
 *
 *  · Con MT5: el que de verdad pagarías. Comprar se hace al ASK y vender al
 *    BID, así que el spread ya va dentro de la entrada — que es justo lo que
 *    pidió Néstor: cuentas reales, con su descuento. Sin lado, el punto medio.
 *  · Sin MT5: `null`. Quien llame usa el precio del barrido (Twelve Data), que
 *    es un cierre sin bid ni ask.
 */
export function precioDeEntrada(q, lado) {
  if (!q || !num(q.bid) || !num(q.ask) || q.ask < q.bid) return null
  if (lado === 'COMPRA') return { precio: q.ask, lado: 'ask', spread: num(q.spread) ? q.spread : null }
  if (lado === 'VENTA') return { precio: q.bid, lado: 'bid', spread: num(q.spread) ? q.spread : null }
  return { precio: (q.bid + q.ask) / 2, lado: 'medio', spread: num(q.spread) ? q.spread : null }
}

/**
 * La ficha del par con el precio de MT5 dentro, para que el Analizador haga sus
 * cuentas (niveles, distancias, %B…) desde el precio de ahora y no desde el
 * cierre de la última vela. Devuelve la ficha tal cual si MT5 no manda.
 */
export function fichaConPrecioVivo(ficha, { fuente, quotes, lado } = {}) {
  if (!ficha || fuente !== 'mt5') return { ficha, entrada: null }
  const entrada = precioDeEntrada(quotes?.[ficha.name], lado)
  if (!entrada) return { ficha, entrada: null }
  return { ficha: { ...ficha, precio: entrada.precio }, entrada }
}

/**
 * La vela en la que cae una entrada de MT5, para el modo práctica.
 *
 *  · Intradía (velas de una hora): la hora en curso en UTC, con el mismo
 *    formato que publica el barrido («2026-11-17 02:00:00»).
 *  · Swing (velas diarias): la última vela del barrido. ⚠️ No se calcula la
 *    fecha de hoy: la vela diaria de la fuente NO cambia de fecha a medianoche
 *    (medido el 2026-11-12: cambia entre las 19:30 y las 20:48 UTC), así que
 *    «hoy en UTC» podría nombrar una vela que no es la del barrido.
 */
export function velaDeEntradaMt5(app, ultima, ahora = new Date()) {
  if (app === 'intradia') {
    const d = new Date(ahora.getTime())
    d.setUTCMinutes(0, 0, 0)
    return d.toISOString().slice(0, 19).replace('T', ' ')
  }
  return typeof ultima === 'string' && ultima ? ultima : null
}
