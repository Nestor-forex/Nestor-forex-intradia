// LAS INSIGNIAS (2026-11-16) — el punto 4 del plan de herramientas nuevas.
//
// Néstor aprobó, de un análisis externo, una «gamificación ética»: premiar la
// DISCIPLINA y el APRENDIZAJE, nunca las ganancias. Este archivo decide qué
// insignias tiene cada persona, con lo que la app ya guarda de ella: su Diario
// y su ficha de Firestore (perfil de riesgo, lista de pares, avisos, plantillas).
//
// ⚠️⚠️ NINGUNA INSIGNIA PREMIA GANAR DINERO NI ACERTAR. Ni el resultado total,
// ni el porcentaje de acierto, ni una racha de ganadas. Premiar eso empuja a
// arriesgar más para conseguir la medalla, que es justo lo contrario de lo que
// un principiante necesita. `prueba-insignias.mjs` comprueba que convertir
// todas las pérdidas en ganancias NO cambia ninguna insignia.
//
// ⚠️ LA ÚNICA QUE MIRA RESULTADOS ES LA DEL FRENO, y mira la REGLA, no el
// dinero: premia parar cuando tu propio freno lo dice. Un día de solo ganadas
// también la respeta.
//
// ⚠️ NO SE GUARDA NADA. Se calculan cada vez con los datos de la persona, así
// que no hay nada que se pueda inflar a mano ni que cambiar en las reglas de
// Firestore. Si borras operaciones, la cuenta baja: es lo honesto.
//
// ⚠️ AQUÍ NO HAY FIREBASE NI REACT, a propósito: se comprueba sin red.
//
// La del modo práctica llegó con él (punto 5, 2026-11-16). La del curso llegará
// con el curso (punto 8): no se enseña antes de que exista lo que premia.

import { diaDeCierre } from './guardianRiesgo.js'
import { frenoEnDolares, leerPerfil, perfilCompleto } from './perfilRiesgo.js'
import { resumenPractica } from './practica.js'

// Cuántas veces hace falta para cada una. Están a la vista en la pantalla.
export const META = Object.freeze({
  perfil: 1,
  lista: 1,
  metodo: 1,
  alerta: 1,
  diario: 10,
  porque: 10,
  freno: 5,
  practica: 5,
})

// El orden en que se enseñan: primero lo que se hace en un minuto, después lo
// que pide constancia.
export const INSIGNIAS = Object.freeze(['perfil', 'lista', 'metodo', 'alerta', 'diario', 'porque', 'freno', 'practica'])

// Una nota de menos de esto no es un «por qué» (un punto, una letra).
export const NOTA_MINIMA = 8

const largo = (x) => (Array.isArray(x) ? x.length : 0)

function momento(t) {
  if (typeof t?.cerradaEnMs === 'number' && Number.isFinite(t.cerradaEnMs)) return t.cerradaEnMs
  const c = t?.creado
  if (c && typeof c.toMillis === 'function') return c.toMillis()
  if (c && typeof c.seconds === 'number') return c.seconds * 1000
  return 0
}

const cerradaConResultado = (t) => t && t.estado !== 'abierta' && typeof t.pl === 'number' && Number.isFinite(t.pl)

/**
 * ¿Ese día la persona paró cuando su freno lo dijo?
 *
 * Se recorren las operaciones del día en el orden en que se cerraron. En cuanto
 * se toca un freno (lo perdido en neto llega al freno del día, o las pérdidas
 * seguidas llegan a su máximo), cualquier operación cerrada DESPUÉS rompe la
 * regla. Tocar el freno y parar ahí la respeta: para eso existe.
 *
 * ⚠️ El orden sale de `cerradaEnMs`, que se guarda desde el 2026-11-12. Las
 * operaciones viejas o importadas del bróker caen al momento en que se
 * apuntaron, que puede no ser el orden real: en esos días la cuenta es
 * aproximada.
 */
export function diaRespetado(delDia, perfil) {
  const limite = frenoEnDolares(perfil)
  const max = perfil.maxPerdidasSeguidas
  let neto = 0
  let racha = 0
  let tocado = false
  for (const t of [...delDia].sort((a, b) => momento(a) - momento(b))) {
    if (tocado) return false
    neto += t.pl
    if (t.pl < 0) racha++
    else if (t.pl > 0) racha = 0
    if (-neto >= limite - 1e-9 || racha >= max) tocado = true
  }
  return true
}

/** Días con operaciones cerradas en los que se respetó el freno. */
export function diasRespetados(trades, perfil) {
  if (!perfilCompleto(perfil)) return null
  const porDia = new Map()
  for (const t of Array.isArray(trades) ? trades : []) {
    if (!cerradaConResultado(t)) continue
    const d = diaDeCierre(t)
    if (!d) continue
    if (!porDia.has(d)) porDia.set(d, [])
    porDia.get(d).push(t)
  }
  let n = 0
  for (const delDia of porDia.values()) if (diaRespetado(delDia, perfil)) n++
  return n
}

/**
 * Las insignias de una persona.
 *
 * @param trades  el Diario, tal como lo trae `useTrades`
 * @param ficha   la ficha de Firestore (`users/{uid}`), o lo que haya
 * @param practica  las operaciones del modo práctica de esta app
 *
 * Devuelve una lista en el orden de `INSIGNIAS`, cada una con:
 *   id, n (lo que lleva), meta, conseguida, y `necesitaPerfil` en la del freno
 *   cuando todavía no hay perfil de riesgo con el que contarla.
 */
export function calcularInsignias(trades, ficha, practica = []) {
  const lista = Array.isArray(trades) ? trades.filter(Boolean) : []
  const perfil = leerPerfil(ficha?.perfilRiesgo)
  const conPerfil = perfilCompleto(perfil)
  const respetados = conPerfil ? diasRespetados(lista, perfil) : 0

  const n = {
    perfil: conPerfil ? 1 : 0,
    lista: largo(ficha?.seguimiento) > 0 ? 1 : 0,
    metodo: largo(ficha?.plantillas) > 0 ? 1 : 0,
    alerta: largo(ficha?.avisos) > 0 ? 1 : 0,
    diario: lista.length,
    porque: lista.filter((t) => typeof t.nota === 'string' && t.nota.trim().length >= NOTA_MINIMA).length,
    freno: respetados,
    // ⚠️ Cuentan las TERMINADAS (ganadas o perdidas), y las dos igual: lo que
    // se premia es llegar al final de la práctica, no ganarla.
    // La definición de «terminada» vive en `practica.js`, la misma que cuenta la tarjeta.
    practica: resumenPractica(practica).resueltas,
  }
  return INSIGNIAS.map((id) => {
    const meta = META[id]
    const lleva = Math.min(n[id], meta)
    const out = { id, n: lleva, meta, conseguida: n[id] >= meta }
    if (id === 'freno' && !conPerfil) out.necesitaPerfil = true
    return out
  })
}

/** Cuántas lleva conseguidas, para el título de la tarjeta. */
export const conseguidas = (lista) => lista.filter((i) => i.conseguida).length
