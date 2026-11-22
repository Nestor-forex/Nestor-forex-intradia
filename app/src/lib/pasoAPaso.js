// El modo «Paso a paso» (2026-11-22). Lo pidió Néstor: las herramientas en el
// orden en que se usan para armar una operación, para que un principiante no
// tenga que adivinar qué mirar primero.
//
// ⚠️ ORDENA INFORMACIÓN, NO ELIGE NADA. Ni el par ni la dirección: los pasos 2
// y 7 los decide la persona. Las cuentas de aquí son las mismas que ya usan el
// Barrido, el calendario y el Analizador; no hay ningún número nuevo.
//
// ⚠️ ES UN MODO APARTE, a propósito: las pestañas siguen como estaban. Si no
// gusta, se quita la tarjeta de entrada del Barrido y este modo, y la app
// queda como antes (versión anterior: Swing a864b94, Intradía c1866b5).

import { proximos, esRelevante, HORAS_VISTA } from './calendario.js'
import { monedasDe } from './pairs.js'

export const PASOS = Object.freeze(['freno', 'fuerza', 'combinar', 'noticias', 'coste', 'grafico', 'iguales', 'armar', 'decidir'])

// La lección del curso que explica cada paso.
export const LECCION_DE_PASO = Object.freeze({
  freno: 'm3-1',
  fuerza: 'm4-1',
  combinar: 'm4-4',
  noticias: 'm7-1',
  coste: 'm6-1',
  grafico: 'm5-1',
  iguales: 'm8-1',
  armar: 'm9-1',
  decidir: 'm10-1',
})

// Los pares de la app que llevan la fuerte o la débil, de más a menos
// separados por la «Dif». `exacto` es el par que junta las dos, si existe.
export function paresCon(pares, fuerte, debil) {
  const lista = (Array.isArray(pares) ? pares : [])
    .filter((p) => p && Number.isFinite(p.dif) && (p.b === fuerte || p.q === fuerte || p.b === debil || p.q === debil))
    .sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif))
  const exacto = lista.find((p) => (p.b === fuerte && p.q === debil) || (p.b === debil && p.q === fuerte))?.name ?? null
  return { exacto, lista }
}

// Qué dirección va a favor de la fuerza en este par: si la más fuerte de las
// dos va primero, COMPRA; si va segunda, VENTA. `null` si no se sabe (falta la
// fuerza de alguna, o las dos valen lo mismo).
export function direccionFuerza(par, escala) {
  if (typeof par !== 'string' || !par.includes('/')) return null
  const [base, cotiz] = monedasDe(par)
  const fb = escala?.[base]
  const fq = escala?.[cotiz]
  if (!Number.isFinite(fb) || !Number.isFinite(fq) || fb === fq) return null
  const baseFuerte = fb > fq
  return { base, cotiz, baseFuerte, aFavor: baseFuerte ? 'COMPRA' : 'VENTA', enContra: baseFuerte ? 'VENTA' : 'COMPRA' }
}

// Las noticias importantes de las dos divisas del par en las próximas horas.
// `null` si no hay calendario leído: «no pude mirar» no es «no hay nada».
export function noticiasDelPar(cal, par, ahora = new Date(), horas = HORAS_VISTA) {
  if (!cal || !Array.isArray(cal.eventos) || typeof par !== 'string') return null
  const [a, b] = monedasDe(par)
  return proximos(cal, ahora, { horas }).filter((ev) => (ev.c === a || ev.c === b) && esRelevante(ev))
}

// Las operaciones abiertas del Diario que comparten alguna divisa con el par.
export function abiertasQueComparten(trades, par) {
  if (typeof par !== 'string') return []
  const mias = monedasDe(par)
  return (Array.isArray(trades) ? trades : []).filter((t) => t && t.estado === 'abierta' && typeof t.par === 'string' && monedasDe(t.par).some((c) => mias.includes(c)))
}
