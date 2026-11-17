// La vista de la pantalla: VERTICAL (una columna, como un teléfono) u
// HORIZONTAL (aprovecha el ancho de un PC, una laptop o una tableta acostada).
// Punto 11 del plan; lo pidió Néstor el 2026-11-16 y lo recordó el 2026-11-17:
// «que el usuario tenga la opción de poner la pantalla en vertical y
// horizontal en su PC, laptop, tableta».
//
// ⚠️ LO QUE SE PUEDE Y LO QUE NO, dicho sin adornos, porque la pantalla lo
// cuenta así:
//
//  · En un PC o una laptop la pantalla NO gira. Lo que cambia es cómo se
//    acomoda la app: en horizontal las tarjetas se reparten en columnas en vez
//    de ir una debajo de otra en una tira de 430 px.
//  · En un teléfono o una tableta, girar el aparato lo decide el aparato. Si la
//    app está INSTALADA y el sistema lo permite (Android), la app intenta girar
//    la pantalla sola (`screen.orientation.lock`). Si no lo permite —iPhone,
//    iPad, el navegador sin instalar— no pasa nada malo: solo cambia el
//    acomodo, y basta girar el aparato a mano.
//
// ⚠️ ANTE LA DUDA, VERTICAL. Es como la app ha funcionado siempre: un valor
// guardado raro o un teléfono que no deja leer no pueden dejar a nadie con una
// pantalla que no conoce.
//
// GEMELO: el acomodo es el mismo en las dos apps. La clave se guarda con el
// prefijo de cada una (`nfs_vista` / `nfi_vista`) por `clave()`.

import { clave } from './identidad.js'

export const VERTICAL = 'vertical'
export const HORIZONTAL = 'horizontal'
export const VISTAS = [VERTICAL, HORIZONTAL]
export const VISTA_DEFECTO = VERTICAL

const CLAVE = clave('vista')

/** Lo guardado, o vertical si no hay nada o no se entiende. */
export function normalizarVista(v) {
  return VISTAS.includes(v) ? v : VISTA_DEFECTO
}

export function leerVista(almacen = globalThis.localStorage) {
  try {
    return normalizarVista(almacen?.getItem(CLAVE))
  } catch {
    return VISTA_DEFECTO
  }
}

export function guardarVista(v, almacen = globalThis.localStorage) {
  try {
    almacen?.setItem(CLAVE, normalizarVista(v))
  } catch {
    /* sin almacenamiento: dura lo que dure la pestaña */
  }
}

/** Pone la vista en la raíz del documento: el CSS hace el resto. */
export function aplicarVista(v, doc = globalThis.document) {
  if (!doc?.documentElement) return
  doc.documentElement.dataset.vista = normalizarVista(v)
}

/**
 * Intenta girar la pantalla. Devuelve 'girada' | 'noSePuede'.
 * ⚠️ Nunca lanza: en la mayoría de aparatos el navegador lo rechaza (iPhone,
 * escritorio, app sin instalar), y eso es lo normal, no un fallo.
 */
export async function intentarGirar(v, pantalla = globalThis.screen) {
  const o = pantalla?.orientation
  if (!o || typeof o.lock !== 'function') return 'noSePuede'
  try {
    await o.lock(normalizarVista(v) === HORIZONTAL ? 'landscape' : 'portrait')
    return 'girada'
  } catch {
    return 'noSePuede'
  }
}
