// El curso (punto 8 del plan, 2026-11-18). Las cuentas, sin React ni Firebase.
//
// ⚠️ LAS LECCIONES VIVEN EN `curso/es.js` COMO DATOS. Se escriben una sola vez
// y se pintan aquí; si algún día la página web enseña el curso, se pinta desde
// los mismos archivos. Nunca dos copias.
//
// ⚠️ POR AHORA SOLO EN ESPAÑOL. La pantalla lo dice en los otros 12 idiomas.
// Los botones y rótulos sí van en los 13 (`curso.*` de los diccionarios).
//
// ⚠️ EL PROGRESO ES UNA LISTA DE LECCIONES TERMINADAS en `users/{uid}.curso`.
// Se guarda lo que se terminó, nunca una nota: el curso no tiene ranking.
//
// Este archivo es GEMELO. Lo que una lección dice distinto en cada app se
// escribe dentro de la lección con `soloSwing`, nunca aquí.

import { MODULOS, LECCIONES, PROXIMOS } from './curso/es.js'
import { APP } from './identidad.js'

export { MODULOS, LECCIONES, PROXIMOS }

// Dónde viven los videos del curso: CADA APP LOS SUYOS (2026-11-20).
//
// Néstor: «que los videos de intradía sean lo que corresponde a ella y así para
// swing». Un video de la app de swing enseñado en la de intradía le mostraría a
// alguien una pantalla que no es la que tiene delante. Así que cada app graba,
// guarda (`public/curso/videos/`) y enseña sus videos, con el mismo nombre de
// archivo en las dos. La dirección es COMPLETA y sale de `APP`: así este
// archivo sigue siendo gemelo.
const PAGINAS = Object.freeze({
  swing: 'https://nestor-forex.github.io/Nestor-forex/',
  intradia: 'https://nestor-forex.github.io/Nestor-forex-intradia/',
})
export const URL_VIDEOS = `${PAGINAS[APP]}curso/videos/`

// Tope de la lista guardada. Lo mismo dice `firestore.rules`.
export const MAX_HECHAS = 100

/** Los ids de todas las lecciones que existen, en orden. */
export const TODAS = Object.freeze(MODULOS.flatMap((m) => m.lecciones))

// Lo que se ve SIN suscripción en la página web del curso (2026-11-22, lo pidió
// Néstor como parte de la presentación): los módulos 0 y 2 enteros, y la
// primera lección de cada uno de los demás. Ahí no se guarda ningún avance.
// ⚠️ Es una puerta, no una caja fuerte: el resto también es público mientras
// los repositorios lo sean.
export const MODULOS_GRATIS = Object.freeze(['m0', 'm2'])
export const GRATIS = Object.freeze(MODULOS.flatMap((m) => (MODULOS_GRATIS.includes(m.id) ? m.lecciones : m.lecciones.slice(0, 1))))

// La lección gratis que va después de ésta, o null si es la última.
export function siguienteGratis(idLeccion) {
  const i = GRATIS.indexOf(idLeccion)
  return i >= 0 && i < GRATIS.length - 1 ? GRATIS[i + 1] : null
}

/**
 * La lista guardada, limpia: solo ids que existen, sin repetir.
 * Un valor raro (no es lista, basura dentro) devuelve [] o lo que se salve:
 * nunca inventa una lección terminada.
 */
export function leerHechas(x) {
  if (!Array.isArray(x)) return []
  const validas = new Set(TODAS)
  const out = []
  for (const id of x) {
    if (typeof id === 'string' && validas.has(id) && !out.includes(id)) out.push(id)
  }
  return out
}

/** La lista con una lección más, sin repetir y sin pasar del tope. */
export function conHecha(hechas, id) {
  const lista = leerHechas(hechas)
  if (!TODAS.includes(id) || lista.includes(id)) return lista
  return [...lista, id].slice(-MAX_HECHAS)
}

export function moduloDe(idLeccion) {
  return MODULOS.find((m) => m.lecciones.includes(idLeccion)) || null
}

/** Cuántas lecciones de un módulo lleva terminadas. */
export function progresoModulo(hechas, modulo) {
  const lista = leerHechas(hechas)
  const total = modulo?.lecciones?.length || 0
  const n = total ? modulo.lecciones.filter((id) => lista.includes(id)).length : 0
  return { n, total, terminado: total > 0 && n === total }
}

/** Cuántos módulos tiene terminados. Lo lee la insignia del curso. */
export function modulosTerminados(hechas) {
  return MODULOS.filter((m) => progresoModulo(hechas, m).terminado).length
}

/** La lección que viene después de ésta, o null si es la última. */
export function siguiente(idLeccion) {
  const i = TODAS.indexOf(idLeccion)
  return i >= 0 && i < TODAS.length - 1 ? TODAS[i + 1] : null
}

/**
 * Un texto de una lección puede ser una cadena o una función del contexto
 * (para leer números del código en vez de escribirlos a mano).
 */
export function texto(x, ctx) {
  return typeof x === 'function' ? x(ctx) : x
}
