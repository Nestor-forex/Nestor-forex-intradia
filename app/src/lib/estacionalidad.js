// Estacionalidad: cuánto se mueve un par según el calendario, y hacia dónde fue.
//
// Néstor la pidió el 2026-10-26 después de leer en el informe de precios que
// KairosBias ($29/mes) y MarketSentinel la cobran, y que Seasonax vende SOLO
// estacionalidad a 15.000 usuarios por $50-100 al mes. O sea que es una función
// con demanda probada: los operadores la miran para decidir.
//
// ⚠️⚠️ PERO SON DOS PREGUNTAS DISTINTAS CON MUESTRAS COMPLETAMENTE DISTINTAS,
// y no distinguirlas es el error que hace que esta función se venda como si
// dijera algo que no puede decir:
//
//   (a) «¿cuántos OCTUBRES cerraron en verde?»  → 20 años = 20 observaciones
//   (b) «¿cuánto SE MOVIÓ el par en octubre?»   → 20 años × 21 días = ~420
//
// (a) es direccional y es la que venden por ahí. Con 20 observaciones el margen
// del peor caso es ±22 puntos: un 70 % y un 48 % son el mismo número, así que
// NO SE PUEDE DECIDIR CON ELLA. (b) mide recorrido, tiene veinte veces más
// datos y sí se puede leer.
//
// Por eso este archivo las calcula por separado y con el estadístico correcto
// de cada una — ver el aviso grande sobre `margen` más abajo, que es el fallo
// que estuvo a punto de colarse.
//
// ⚠️ TODO LO QUE SE PRESENTA COMO USABLE MIDE CUÁNTO, NUNCA HACIA DÓNDE.
// Es la misma decisión que ya está escrita para la actividad del puente de MT5:
// «no elige el par, ayuda a elegir el MOMENTO del par que ya elegiste por otras
// razones». Un perfil de recorrido dice dónde el mercado está vivo y dónde está
// dormido; no dice si subirá.
//
// ⚠️ Y NO DEVUELVE NINGÚN VEREDICTO. No hay «mejor mes para comprar», ni
// puntuación de estacionalidad, ni forma de ordenar los pares por ella. Eso
// sería un FILTRO —cambiaría lo que la app propone— y los filtros van al banco
// de pruebas con su listón escrito antes: van NUEVE familias medidas y nueve
// fallando. Hay una comprobación dedicada solo a que no aparezca un veredicto,
// para que añadirlo obligue a venir aquí a borrarla a mano.
//
// GEMELO. La matemática es la misma en las dos apps; lo que cambia es QUÉ
// paneles puede enseñar cada una, y eso lo decide el publicador:
//
//   · perfil por HORA        → solo Intradía. En Swing una vela ES un día, así
//                              que no hay horas que perfilar.
//   · perfil por DÍA         → las dos.
//   · recorrido por MES      → las dos.
//   · dirección por MES      → las dos (la débil, con su ±).
//
// ⚠️ LAS VELAS TIENEN QUE LLEGAR YA LIMPIAS, y aquí es donde más muerde el
// problema de la rejilla, porque esto agrupa POR CALENDARIO. 5.000 velas
// diarias crudas traen ~850 de fin de semana con el 27 % del recorrido normal:
// un perfil por día de la semana las sacaría como **sábado y domingo reales**.
// En Swing `obtenerVelas` limpia por defecto desde el 2026-10-06; en Intradía
// el publicador tiene que filtrar las horas cerradas él (el 28,7 % medido),
// porque allí la rejilla limpia midió `noSeMueve` y nunca se aplicó.
//
// Este archivo NO limpia nada: si le llegan velas sucias, las cuenta. Limpiar
// aquí escondería el problema en vez de resolverlo donde se origina, y hay una
// comprobación que enseña qué pasa si se le cuela un fin de semana.

import { margen } from './diagnostico.js'

/**
 * Por debajo de esto una casilla no se puede leer, y se dice.
 *
 * ⚠️ Pero NO se esconde: sale con su `n` y su margen, marcada. Esconder las
 * casillas flojas dejaría en pantalla solo lo que parece significar algo, que
 * es exactamente cómo se fabrica un espejismo — la misma decisión que los
 * grupos con n = 0 de `Diagnostico`.
 */
export const MIN_OBS = 20

/** Las claves de calendario, en UTC. Ver el aviso de `porHoraUTC`. */
export const DIAS_HABILES = Object.freeze([1, 2, 3, 4, 5])
export const MESES = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
export const HORAS = Object.freeze(Array.from({ length: 24 }, (_, h) => h))

/**
 * El recorrido de una vela, en % de su cierre.
 *
 * Se usa el rango relativo —y no los pips— porque las casillas se comparan
 * entre sí y entre pares: 80 pips en USD/JPY y 80 en EUR/USD no son el mismo
 * movimiento. El % es comparable; los pips no.
 *
 * ⚠️ Devuelve `null`, nunca 0, cuando no se puede calcular. Un 0 diría «esta
 * vela no se movió», que es una afirmación sobre el mercado; `null` dice «no
 * lo sé». Misma asimetría que `pearson`, `difMax` y `edadEnMinutos`.
 */
export function rangoRelativo(h, l, c) {
  if (![h, l, c].every((x) => typeof x === 'number' && Number.isFinite(x))) return null
  if (c <= 0 || h < l) return null
  return ((h - l) / c) * 100
}

/**
 * Agrupar por hora del día, en UTC.
 *
 * ⚠️ EN UTC Y NO EN LA HORA DEL QUE MIRA, y no es un descuido. El mecanismo de
 * la estacionalidad por horas son los solapes de sesión (Tokio, Londres, Nueva
 * York), que están fijos en UTC: si se agrupara en la hora local de cada
 * suscriptor, el solape de Londres con Nueva York saldría en una casilla
 * distinta para el de Madrid y el de Bogotá, cuando es el mismo fenómeno.
 *
 * La pantalla SÍ lo enseña en la hora de quien mira — igual que el calendario.
 * Se agrupa en UTC y se traduce al pintar, nunca al contar.
 */
export const porHoraUTC = (d) => d.getUTCHours()
export const porDiaSemana = (d) => d.getUTCDay()
export const porMes = (d) => d.getUTCMonth()

/**
 * Media, desviación típica y margen del 95 % de una lista de números.
 *
 * ⚠️⚠️ AQUÍ NO SE USA `margen()`, Y ÉSTE ES EL FALLO QUE ESTUVO A PUNTO DE
 * COLARSE — se lo llegué a decir a Néstor en el chat con un número concreto.
 *
 * `margen(n) = 98/√n` es la mitad del intervalo de confianza del 95 % **de una
 * PROPORCIÓN** en el peor caso (p = 0,5), y sale en **puntos porcentuales**.
 * Aplicarlo a una MEDIA es usar una fórmula de otra cosa: el margen de una
 * media es `1,96 · desviación / √n`, y sale en **las unidades del dato**.
 *
 * Con 420 observaciones las dos cuentas dan un número parecido por casualidad
 * (~5), y significan cosas distintas: una es «±5 puntos porcentuales de
 * acierto» y la otra «±5 % del valor del recorrido». Es la familia de siempre
 * de este proyecto —un número bien calculado describiendo otra cosa de la que
 * dice describir— y por eso va con su propia comprobación.
 *
 * `margen()` sí es el correcto para `direccionPorMes`, que cuenta proporciones.
 */
export function resumenNumerico(xs) {
  const v = (Array.isArray(xs) ? xs : []).filter((x) => typeof x === 'number' && Number.isFinite(x))
  const n = v.length
  if (!n) return { n: 0, medio: null, sd: null, margen95: null }

  const medio = v.reduce((a, b) => a + b, 0) / n
  if (n < 2) return { n, medio, sd: null, margen95: null }

  // Varianza muestral (n − 1): con n − 1 no se subestima la dispersión, que es
  // el lado del error que haría parecer el dato más preciso de lo que es.
  const varianza = v.reduce((a, b) => a + (b - medio) ** 2, 0) / (n - 1)
  const sd = Math.sqrt(varianza)
  return { n, medio, sd, margen95: 1.96 * (sd / Math.sqrt(n)) }
}

/**
 * El perfil de recorrido agrupado por una clave de calendario.
 *
 * @param velas  [{ t: Date, h, l, c }] — `t` ya en UTC
 * @param clave  una de `porHoraUTC` / `porDiaSemana` / `porMes`
 * @param cubos  las casillas que SIEMPRE salen, aunque queden vacías
 *
 * Devuelve `{ [casilla]: { n, medio, sd, margen95 } }` con **el n y el margen
 * de ESA casilla**, nunca uno global: un cruce con 8 años de historia no puede
 * enseñar el mismo margen que EUR/USD con 20.
 */
export function perfilPor(velas, clave, cubos) {
  const lista = Array.isArray(velas) ? velas : []
  const porCubo = new Map(cubos.map((k) => [k, []]))

  for (const v of lista) {
    if (!(v?.t instanceof Date) || Number.isNaN(v.t.getTime())) continue
    const r = rangoRelativo(v.h, v.l, v.c)
    if (r === null) continue
    const k = clave(v.t)
    // Una clave fuera de los cubos pedidos (sábado en un perfil de días
    // hábiles) NO se mete en otro cubo ni se reparte: se descarta aquí y el
    // publicador es quien tiene que no haberla traído. Ver la cabecera.
    if (porCubo.has(k)) porCubo.get(k).push(r)
  }

  const out = {}
  for (const [k, xs] of porCubo) out[k] = resumenNumerico(xs)
  return out
}

/**
 * La parte DÉBIL: en cuántos de los últimos N eneros, febreros… cerró el par
 * por encima de donde abrió el mes.
 *
 * ⚠️ Esto SÍ es una proporción, así que aquí `margen()` es el estadístico
 * correcto. Y es el que la desarma: con 20 años son 20 observaciones por mes y
 * el margen es ±22 puntos.
 *
 * ⚠️ NO devuelve ni insinúa un lado. Devuelve el porcentaje, el n y el margen,
 * y la pantalla los pinta juntos para que el margen se lea al mismo tiempo que
 * el número. Separarlos sería el truco más viejo del sector: «87 % de acierto»
 * sin decir que son quince operaciones.
 *
 * Un mes se cuenta solo si tiene su primera y su última vela dentro de la
 * serie; un mes a medias (el actual) se descarta, porque «octubre cerró en
 * verde» no se puede decir el día 26.
 */
export function direccionPorMes(velas) {
  const lista = (Array.isArray(velas) ? velas : [])
    .filter((v) => v?.t instanceof Date && !Number.isNaN(v.t.getTime()) && Number.isFinite(v.c))
    .slice()
    .sort((a, b) => a.t - b.t)

  // Agrupar por año-mes conservando el orden.
  const bloques = new Map()
  for (const v of lista) {
    const k = `${v.t.getUTCFullYear()}-${v.t.getUTCMonth()}`
    if (!bloques.has(k)) bloques.set(k, [])
    bloques.get(k).push(v)
  }

  const claves = [...bloques.keys()]
  // El primer y el último bloque están a medias casi seguro (la serie no
  // empieza el día 1 ni acaba el último del mes), así que se tiran los dos.
  const completos = claves.slice(1, Math.max(1, claves.length - 1))

  const cuenta = new Map(MESES.map((m) => [m, { n: 0, verdes: 0 }]))
  for (const k of completos) {
    const bloque = bloques.get(k)
    if (bloque.length < 10) continue // un mes con menos de 10 sesiones no es un mes
    const mes = bloque[0].t.getUTCMonth()
    const c = cuenta.get(mes)
    c.n += 1
    if (bloque[bloque.length - 1].c > bloque[0].c) c.verdes += 1
  }

  const out = {}
  for (const [m, { n, verdes }] of cuenta) {
    out[m] = {
      n,
      verdes,
      // `null` y nunca 0 ni 50 cuando no hay meses: un 50 diría «subió la mitad
      // de las veces», que es una afirmación. Misma decisión que `pearson`.
      pct: n > 0 ? Math.round((verdes / n) * 100) : null,
      margen: margen(n),
    }
  }
  return out
}

/**
 * ¿Se puede leer esta casilla? Para que la pantalla lo marque en vez de
 * esconderla.
 */
export const casillaFloja = (c) => !c || !Number.isFinite(c.n) || c.n < MIN_OBS

/**
 * Todo el paquete de un par, listo para publicar.
 *
 * @param velas       [{ t, h, l, c }] ya limpias
 * @param conHoras    true solo en Intradía
 */
export function estacionalidadDe(velas, { conHoras = false } = {}) {
  const lista = Array.isArray(velas) ? velas : []
  const fechas = lista
    .map((v) => v?.t)
    .filter((t) => t instanceof Date && !Number.isNaN(t.getTime()))
    .sort((a, b) => a - b)

  return {
    obs: lista.length,
    desde: fechas.length ? fechas[0].toISOString().slice(0, 10) : null,
    hasta: fechas.length ? fechas[fechas.length - 1].toISOString().slice(0, 10) : null,
    hora: conHoras ? perfilPor(lista, porHoraUTC, HORAS) : null,
    dia: perfilPor(lista, porDiaSemana, DIAS_HABILES),
    mes: perfilPor(lista, porMes, MESES),
    mesDir: direccionPorMes(lista),
  }
}
