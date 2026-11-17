// «¿Cómo operas?» (2026-11-17): el arranque por TIPO de trading, además del
// arranque por divisas que ya hace «Mis pares».
//
// ⚠️ NO CAMBIA NINGUNA SEÑAL NI NINGÚN NÚMERO. Lo único que decide el estilo es
// con qué herramientas ARRANCA el Analizador. Todas siguen a un toque, y la
// persona puede encender o apagar las que quiera.
//
// ⚠️ NO DICE QUÉ ESTILO ES MEJOR. Ninguno está medido como «el que gana» y la
// pantalla no lo insinúa: son formas de mirar el mercado, cada una con sus
// herramientas de costumbre.
//
// Se guarda en `users/{uid}.estilo` y lo comparten las dos apps: es la misma
// persona. «Todavía no sé» es una respuesta tan válida como las otras.
//
// ⚠️ AQUÍ NO HAY FIREBASE NI REACT, a propósito: se comprueba sin red.

import { HERRAMIENTAS, HERRAMIENTAS_INICIALES } from './analizador.js'

export const ESTILOS = Object.freeze(['tendencias', 'rangos', 'noticias', 'nose'])

/**
 * Las herramientas de costumbre de cada estilo. Solo información: ninguna de
 * ellas elige la dirección.
 *  - tendencias: hacia dónde va el precio y con cuánta fuerza.
 *  - rangos: dónde suele frenar y rebotar el precio.
 *  - noticias: cuándo hay sacudida y cuánto cuesta estar dentro.
 */
export const HERRAMIENTAS_DE_ESTILO = Object.freeze({
  tendencias: Object.freeze(['tendencia', 'medias', 'fuerza', 'atr', 'niveles', 'calendario']),
  rangos: Object.freeze(['niveles', 'pivote', 'rsi', 'bollinger', 'fibonacci', 'atr', 'calendario']),
  noticias: Object.freeze(['calendario', 'spread', 'atr', 'niveles', 'swap', 'estacionalidad']),
  nose: HERRAMIENTAS_INICIALES,
})

/** El estilo guardado, o `null` si no hay o no es uno de los cuatro. */
export function leerEstilo(x) {
  return ESTILOS.includes(x) ? x : null
}

/**
 * Las herramientas con las que arranca el Analizador para ese estilo, solo las
 * que esta app puede calcular (`disponibles`). Sin estilo, las de siempre.
 */
export function herramientasDeEstilo(estilo, disponibles = HERRAMIENTAS) {
  const base = HERRAMIENTAS_DE_ESTILO[leerEstilo(estilo) ?? 'nose']
  const ok = Array.isArray(disponibles) ? disponibles : HERRAMIENTAS
  return base.filter((h) => HERRAMIENTAS.includes(h) && ok.includes(h))
}
