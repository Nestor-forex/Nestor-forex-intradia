// «Analista constante» (2026-11-17): los días en que la persona abrió el
// tablero completo, para la insignia de revisarlo 5 días hábiles seguidos.
//
// ⚠️ SE GUARDA EL DÍA, NO LA INSIGNIA. La insignia se sigue calculando cada vez
// (ver `insignias.js`); lo único que hace falta guardar es la lista de días,
// porque eso no se puede sacar de ningún otro dato. Va en
// `users/{uid}.diasTablero` y la comparten las dos apps: es la misma persona.
//
// ⚠️ LOS FINES DE SEMANA NI CUENTAN NI CORTAN LA RACHA. El Forex cierra el
// sábado; mirar el tablero un sábado no es revisar el mercado, y no mirarlo no
// es dejar de hacerlo. Del viernes se pasa al lunes sin romper nada.
//
// ⚠️ EL DÍA ES EL DEL TELÉFONO (`diaLocal`), igual que el freno del Diario.
//
// ⚠️ AQUÍ NO HAY FIREBASE NI REACT, a propósito: se comprueba sin red.

import { diaLocal } from './guardianRiesgo.js'

/** Cuántos días se guardan. Las reglas de Firestore dejan este máximo. */
export const DIAS_GUARDADOS = 14

const FORMATO = /^\d{4}-\d{2}-\d{2}$/

const msDeDia = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
const diaDeMs = (ms) => new Date(ms).toISOString().slice(0, 10)
const esFinDeSemana = (d) => {
  const s = new Date(msDeDia(d)).getUTCDay()
  return s === 0 || s === 6
}

/** La lista limpia: solo días bien escritos, sin repetir, en orden, los últimos 14. */
export function leerDias(lista) {
  if (!Array.isArray(lista)) return []
  const ok = lista.filter((d) => typeof d === 'string' && FORMATO.test(d) && Number.isFinite(msDeDia(d)) && diaDeMs(msDeDia(d)) === d)
  return [...new Set(ok)].sort().slice(-DIAS_GUARDADOS)
}

/**
 * La lista con el día de hoy añadido, o `null` si no hace falta escribir nada:
 * hoy ya estaba, o es fin de semana. Así se escribe una vez al día como mucho.
 */
export function conHoy(lista, hoy = diaLocal()) {
  if (typeof hoy !== 'string' || !FORMATO.test(hoy) || esFinDeSemana(hoy)) return null
  const dias = leerDias(lista)
  if (dias.includes(hoy)) return null
  return leerDias([...dias, hoy])
}

/** El siguiente día hábil: del viernes, el lunes. */
function siguienteHabil(d) {
  let ms = msDeDia(d) + 86_400_000
  while (esFinDeSemana(diaDeMs(ms))) ms += 86_400_000
  return diaDeMs(ms)
}

/** La racha más larga de días hábiles seguidos que hay en la lista. */
export function mejorRacha(lista) {
  const dias = leerDias(lista).filter((d) => !esFinDeSemana(d))
  let mejor = 0
  let actual = 0
  let previo = null
  for (const d of dias) {
    actual = previo && siguienteHabil(previo) === d ? actual + 1 : 1
    if (actual > mejor) mejor = actual
    previo = d
  }
  return mejor
}
