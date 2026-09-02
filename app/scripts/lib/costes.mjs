// LO QUE CUESTA OPERAR DE VERDAD.
//
// Hasta ahora el banco de pruebas descontaba 1 pip de spread, igual para los 18
// pares, y nada más. Las dos cosas están mal.
//
// ─────────────────────────────────────────────────────────────────────────
// 1. EL SPREAD NO ES IGUAL EN TODOS LOS PARES
// ─────────────────────────────────────────────────────────────────────────
// EUR/USD es el par más operado del mundo y cuesta menos de 1 pip. NZD/CHF o
// EUR/NZD cuestan tranquilamente 3 o 4. Con un número único los pares caros
// parecen MEJORES de lo que son, y aquí eso pesa el doble que en swing: los
// objetivos de intradía son de decenas de pips, así que un pip de más o de
// menos se lleva un pedazo grande del resultado.
//
// ─────────────────────────────────────────────────────────────────────────
// 2. EL SWAP TAMPOCO SE CONTABA — Y AQUÍ SÍ APLICA
// ─────────────────────────────────────────────────────────────────────────
// Parecía razonable ignorarlo: la app se llama Intradía y su idea es abrir y
// cerrar el mismo día. Pero eso es la INTENCIÓN, no lo que pasa.
//
// Medido sobre las 42 operaciones reales ya resueltas:
//
//     duración mediana ......... 9 horas
//     duración media ........... 17,9 horas
//     la más larga ............. 102 horas (más de cuatro días)
//     cruzaron al menos una noche ... 22 de 42 (52%)
//
// Más de la mitad se quedan abiertas cuando el bróker pasa el corte y cobra
// swap. Ignorarlo era suponer algo que los datos no dicen.
//
// ─────────────────────────────────────────────────────────────────────────
// CÓMO SE CUENTAN LAS NOCHES
// ─────────────────────────────────────────────────────────────────────────
// No por duración: una operación de 6 horas puede cruzar el corte y una de 20
// puede no cruzarlo, según a qué hora se abrió. Se cuentan los cortes REALES
// que hay entre la entrada y la salida (ver `nochesEntre`).
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ EL SWAP VA COMO BARRIDO Y NO COMO UN NÚMERO
// ─────────────────────────────────────────────────────────────────────────
// Podría inventarme una tabla de swaps por par y por dirección y dar un número
// final. Sería más cómodo de leer y sería mentira: depende del diferencial de
// tipos de cada momento y del margen de cada bróker, cambia mes a mes, y no
// tengo su histórico. Se mide a varios niveles y se enseña a partir de cuál
// cambia la conclusión — que es la pregunta que de verdad importa.

// ─────────────────────────────────────────────────────────────────────────
// SPREADS TÍPICOS, EN PIPS
// ─────────────────────────────────────────────────────────────────────────
//
// ⚠️ SON ESTIMACIONES DE BRÓKER MINORISTA, NO LOS DE TU CUENTA. Están en el
// lado alto de lo normal a propósito: si el número final sale bien con costes
// generosos, sale bien de verdad.
//
// PARA AFINARLOS: abre tu plataforma con el mercado abierto, mira el spread de
// cada par y cámbialo aquí. Es el único sitio donde hay que tocarlo.
export const SPREAD_PIPS = {
  // Los mayores: mucho volumen, spread pequeño.
  'EUR/USD': 0.9,
  'GBP/USD': 1.3,
  'USD/JPY': 1.0,
  'USD/CHF': 1.5,
  'USD/CAD': 1.6,
  'AUD/USD': 1.1,
  'NZD/USD': 1.7,
  // Los cruces: sin dólar de por medio, menos volumen y spread bastante mayor.
  // El bróker los arma combinando dos pares, así que se pagan los dos.
  'EUR/CHF': 2.2,
  'EUR/CAD': 2.8,
  'EUR/NZD': 3.5,
  'GBP/CAD': 3.2,
  'GBP/JPY': 2.4,
  'NZD/CHF': 3.6,
  'NZD/CAD': 3.4,
  // Los de la sesión asiática y Oceanía.
  'AUD/JPY': 1.8,
  'NZD/JPY': 2.6,
  'AUD/NZD': 3.0,
  'EUR/GBP': 1.4,
}

// Para un par que no esté en la tabla. Alto a propósito: que un par nuevo se
// mida caro hasta que alguien ponga su número real, y no barato por descuido.
export const SPREAD_POR_DEFECTO = 3.0

export function spreadDe(par) {
  return SPREAD_PIPS[par] ?? SPREAD_POR_DEFECTO
}

// La hora UTC a la que el bróker pasa el corte y cobra el swap. Las 17:00 de
// Nueva York, que en invierno son las 22:00 UTC. Varía una hora con el horario
// de verano; se usa la de invierno, que es la referencia estándar, y esa hora
// de diferencia no cambia ninguna conclusión (lo que cambia el resultado es el
// NIVEL de swap, y por eso se barre).
export const HORA_CORTE_UTC = 22

/**
 * Cuántas veces cruzó el corte de swap una operación.
 *
 * NO se deduce de la duración: una operación de 6 horas abierta a las 20:00
 * cruza el corte, y una de 20 horas abierta a las 23:00 no lo cruza hasta el
 * día siguiente. Hay que mirar las horas de verdad.
 *
 * @param entrada  vela de entrada, 'YYYY-MM-DD HH:MM:SS' en UTC
 * @param salida   vela en la que se resolvió, mismo formato
 */
export function nochesEntre(entrada, salida) {
  if (!entrada || !salida) return 0
  const aFecha = (s) => new Date(String(s).replace(' ', 'T') + 'Z')
  const ini = aFecha(entrada)
  const fin = aFecha(salida)
  if (!(ini instanceof Date) || Number.isNaN(ini.getTime())) return 0
  if (!(fin instanceof Date) || Number.isNaN(fin.getTime())) return 0
  if (fin <= ini) return 0

  // El primer corte DESPUÉS de la entrada. Si se entró justo a la hora del
  // corte, ese ya pasó: cuenta el del día siguiente.
  const corte = new Date(ini)
  corte.setUTCHours(HORA_CORTE_UTC, 0, 0, 0)
  if (corte <= ini) corte.setUTCDate(corte.getUTCDate() + 1)

  let n = 0
  while (corte <= fin) {
    n++
    corte.setUTCDate(corte.getUTCDate() + 1)
  }
  return n
}

// ─────────────────────────────────────────────────────────────────────────
// NIVELES DE SWAP QUE SE MIDEN, EN PIPS POR NOCHE
// ─────────────────────────────────────────────────────────────────────────
//
// El 0 no es realista: sirve de referencia, para ver cuánto se mueve todo lo
// demás respecto a no contar nada (que es lo que se hacía hasta ahora).
//
// Va siempre en positivo —o sea, como COSTE— aunque en la realidad una de las
// dos direcciones a veces COBRA swap. Es la elección incómoda a propósito:
// suponer que siempre se paga es el peor caso, y un número que aguanta el peor
// caso es un número en el que se puede confiar.
export const NIVELES_SWAP = [0, 0.25, 0.5, 1.0, 2.0]

/**
 * Lo que cuesta una operación, en pips.
 *
 * @param par            nombre del par, p. ej. 'EUR/USD'
 * @param noches         cuántas veces cruzó el corte (ver `nochesEntre`)
 * @param swapPipsNoche  a qué nivel de swap se está midiendo
 */
export function costeEnPips(par, noches = 0, swapPipsNoche = 0) {
  return spreadDe(par) + Math.max(0, noches) * swapPipsNoche
}
