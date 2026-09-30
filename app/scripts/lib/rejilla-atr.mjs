// EL DIAGNÓSTICO DE LA REJILLA: ¿se derrumba el ATR al abrir la semana?
//
// Las cuentas puras, sin red. El guion de al lado (`medir-rejilla.mjs`) baja
// las velas; aquí vive lo que se calcula con ellas.
//
// ─────────────────────────────────────────────────────────────────────────
// LA PREGUNTA, Y POR QUÉ ES LA BARATA
// ─────────────────────────────────────────────────────────────────────────
// La sonda del 2026-09-30 midió que el 28,7 % de las velas del barrido caen en
// horas sin mercado y que esas horas son **5,2× más estrechas**. De ahí salió
// una inferencia: como el ATR es Wilder de 14 y un fin de semana son ~45 velas
// cerradas seguidas, el lunes de madrugada el ATR estaría calculado casi entero
// sobre horas finas — y el stop es 1,5 × ATR.
//
// **Eso no está medido.** Esto lo mide, y cuesta una sola descarga en vez de la
// medición completa. Si el derrumbe no aparece, no hay nada que perseguir y se
// ahorran los créditos.
//
// ⚠️ Lo que significa cada resultado posible está escrito EN EL PREREGISTRO,
// con fecha anterior a estos números (`QUE_DICE_EL_DIAGNOSTICO`). Sin eso,
// cualquier número se lee como una confirmación de algo.

import { atrWilder } from '../../src/lib/marketCalc.js'
import { clasificarHora } from './sonda-oro.mjs'

// El mismo ATR que usa la app: Wilder sobre 14 velas.
export const PERIODO_ATR = 14

// ⚠️⚠️ LA VENTANA DE 60 VELAS, Y ES UN HALLAZGO QUE CAMBIA LA INFERENCIA.
//
// `atrWilder` de la app no recorre la serie entera: arranca en
// `Math.max(1, n - 60)`, o sea que **siembra el promedio de Wilder con los
// rangos de las últimas 60 velas y nada más**. Lo descubrió la primera
// comprobación de `prueba-rejilla.mjs`, escrita justamente para eso: mi
// reimplementación daba 0,00032607 y la de la app 0,00032576.
//
// 📌 Y esto NO es un detalle de precisión: **hace la inferencia más fuerte, no
// más débil.** El cálculo que le conté a Néstor —«tras 45 velas el peso de lo
// anterior queda en (13/14)^45 ≈ 4 %»— suponía memoria infinita. Con una
// ventana dura de 60 velas, al abrir la semana esas 60 son **casi todas del
// fin de semana** (24 del sábado + 24 del domingo + las últimas del viernes).
// No es que lo de antes pese poco: es que lo de antes ni entra.
//
// ⚠️ Por eso este archivo NO reimplementa el ATR: **llama al de la app**. Una
// reimplementación «equivalente» es una forma de medir otra cosa sin que nada
// falle, y aquí ya pasó en el primer intento.
export const VENTANA_ATR = 60

// Cuántas velas del arranque de semana se miran. El vigía corre al minuto 20 de
// cada hora de lunes a viernes, así que las primeras horas del lunes en UTC son
// horas en las que SÍ trabaja — es justo la ventana que importa.
export const VELAS_DE_ARRANQUE = 6

/**
 * El ATR de Wilder en CADA vela, no solo en la última.
 *
 * Devuelve un array del mismo largo que la entrada, con `null` en las
 * posiciones donde todavía no hay suficientes velas para calcularlo.
 *
 * ⚠️ `null` y no 0 en el calentamiento: un 0 diría «el precio no se movió»,
 * que es una afirmación. Misma decisión que `pearson` y que `proporcionPlanas`.
 */
export function atrEnCada(highs, lows, closes, p = PERIODO_ATR) {
  const n = Math.min(highs?.length ?? 0, lows?.length ?? 0, closes?.length ?? 0)
  const out = new Array(n).fill(null)

  for (let i = 0; i < n; i++) {
    // Con menos de p+1 velas detrás, `atrWilder` devolvería el promedio de lo
    // que tenga — un número plausible calculado sobre cuatro velas. Aquí eso
    // sería peor que nada, así que se deja `null`: «todavía no se sabe».
    if (i < p) continue
    // ⚠️ `i - VENTANA_ATR`, NO `i + 1 - VENTANA_ATR`, y la diferencia de uno no
    // es cosmética: `atrWilder` necesita el cierre ANTERIOR a la primera vela
    // de su ventana para el primer rango verdadero. Con 60 velas salen 59
    // rangos; con 61 salen los 60 que usa la app. El primer intento daba
    // 0,00032541 contra 0,00032576 — creíble y distinto, y solo lo destapó
    // comparar contra la función de la app en vez de contra mi idea de ella.
    const desde = Math.max(0, i - VENTANA_ATR)
    const v = atrWilder(highs.slice(desde, i + 1), lows.slice(desde, i + 1), closes.slice(desde, i + 1), p)
    out[i] = Number.isFinite(v) ? v : null
  }
  return out
}

/**
 * Los índices donde ARRANCA la semana de mercado: la primera vela de mercado
 * que viene después de un hueco de horas cerradas.
 *
 * ⚠️ No se buscan «los lunes»: se busca **el primer mercado después de un
 * cierre**, que es lo que de verdad importa y lo que no depende de en qué día
 * civil caiga con cada horario de verano. Una vela de frontera no abre semana
 * ni la cierra — no se sabe qué era.
 */
export function arranquesDeSemana(fechas, cuantas = VELAS_DE_ARRANQUE) {
  const out = []
  if (!Array.isArray(fechas)) return out

  let vistoCerrado = false
  let enRacha = 0
  for (let i = 0; i < fechas.length; i++) {
    const c = clasificarHora(fechas[i])
    if (c === 'cerrado') {
      vistoCerrado = true
      enRacha = 0
      continue
    }
    if (c !== 'mercado') continue // frontera: no decide nada
    if (vistoCerrado) {
      out.push(i)
      enRacha = 1
      vistoCerrado = false
      continue
    }
    if (enRacha > 0 && enRacha < cuantas) {
      out.push(i)
      enRacha++
    }
  }
  return out
}

// Mediana, que es la que se compara. La media sola la mueve una vela de
// noticia, y aquí se comparan dos poblaciones enteras.
export function mediana(xs) {
  const v = (xs ?? []).filter(Number.isFinite).sort((a, b) => a - b)
  if (!v.length) return null
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2
}

/**
 * ⚠️⚠️ LA COMPARACIÓN QUE CONTESTA LA PREGUNTA.
 *
 * Calcula el ATR de dos maneras sobre las MISMAS velas de mercado:
 *
 *   `hoy`     → sobre la serie TAL CUAL la recibe la app, horas cerradas
 *               incluidas. Es lo que la app usa de verdad hoy.
 *   `limpia`  → sobre la serie con las horas cerradas QUITADAS.
 *
 * Y las lee en dos sitios:
 *
 *   `arranque` → en las primeras velas de mercado después de un cierre, que es
 *                donde la inferencia dice que se derrumba.
 *   `medio`    → en el resto, que es la referencia.
 *
 * ⚠️ Las dos series se leen en las MISMAS FECHAS. Comparar el ATR de la serie
 * limpia en su índice N contra el de la serie de hoy en SU índice N sería
 * comparar dos instantes distintos —la limpia va 28,7 % «adelantada»— y no
 * daría ningún error: daría dos números plausibles de dos momentos que no son
 * el mismo. Es la misma trampa que las fechas del oro y los pares.
 */
export function compararRejillas(fechas, highs, lows, closes, { cuantas = VELAS_DE_ARRANQUE } = {}) {
  const n = Math.min(fechas?.length ?? 0, highs?.length ?? 0, lows?.length ?? 0, closes?.length ?? 0)
  if (n < PERIODO_ATR + 2) return null

  // 1. El ATR sobre la serie de hoy, indexado por fecha.
  const atrHoy = atrEnCada(highs, lows, closes)
  const porFechaHoy = new Map()
  for (let i = 0; i < n; i++) if (atrHoy[i] != null) porFechaHoy.set(fechas[i], atrHoy[i])

  // 2. La serie limpia: solo mercado y frontera, fuera lo cerrado seguro.
  //
  // ⚠️ La FRONTERA se queda. Son horas donde el cambio de hora decide si hubo
  // mercado, y tirarlas sería afirmar que no lo hubo. Ante la duda se conserva
  // el dato, que es la asimetría de este proyecto: enseñar de más es ruido,
  // esconder de más es perder información.
  const idxLimpia = []
  for (let i = 0; i < n; i++) if (clasificarHora(fechas[i]) !== 'cerrado') idxLimpia.push(i)
  const atrLimpia = atrEnCada(
    idxLimpia.map((i) => highs[i]),
    idxLimpia.map((i) => lows[i]),
    idxLimpia.map((i) => closes[i]),
  )
  const porFechaLimpia = new Map()
  idxLimpia.forEach((i, k) => {
    if (atrLimpia[k] != null) porFechaLimpia.set(fechas[i], atrLimpia[k])
  })

  // 3. Dónde mirar: arranque de semana contra media semana.
  const arranque = new Set(arranquesDeSemana(fechas, cuantas))
  const cubos = {
    arranqueHoy: [],
    arranqueLimpia: [],
    medioHoy: [],
    medioLimpia: [],
  }
  for (let i = 0; i < n; i++) {
    if (clasificarHora(fechas[i]) !== 'mercado') continue
    const h = porFechaHoy.get(fechas[i])
    const l = porFechaLimpia.get(fechas[i])
    if (h == null || l == null) continue // solo fechas que las DOS pueden contestar
    if (arranque.has(i)) {
      cubos.arranqueHoy.push(h)
      cubos.arranqueLimpia.push(l)
    } else {
      cubos.medioHoy.push(h)
      cubos.medioLimpia.push(l)
    }
  }

  const m = {
    arranqueHoy: mediana(cubos.arranqueHoy),
    arranqueLimpia: mediana(cubos.arranqueLimpia),
    medioHoy: mediana(cubos.medioHoy),
    medioLimpia: mediana(cubos.medioLimpia),
  }

  const div = (a, b) => (a != null && b != null && b !== 0 ? a / b : null)

  return {
    n,
    velasLimpias: idxLimpia.length,
    velasQuitadas: n - idxLimpia.length,
    arranques: cubos.arranqueHoy.length,
    medios: cubos.medioHoy.length,
    ...m,
    // ¿Cuántas veces más ancho es el ATR de media semana que el del arranque,
    // con la rejilla de HOY? Es el número que dice si hay derrumbe.
    derrumbeHoy: div(m.medioHoy, m.arranqueHoy),
    // Lo mismo con la rejilla limpia: si el arreglo funciona, esto se acerca a 1.
    derrumbeLimpia: div(m.medioLimpia, m.arranqueLimpia),
    // ¿Sube el ATR del arranque al limpiar? Es la otra mitad de la pregunta.
    subeEnArranque: div(m.arranqueLimpia, m.arranqueHoy),
    // Y el ATR medio global, que es el criterio `atrSube` del preregistro.
    atrMedioHoy: mediana([...cubos.arranqueHoy, ...cubos.medioHoy]),
    atrMedioLimpia: mediana([...cubos.arranqueLimpia, ...cubos.medioLimpia]),
  }
}

/**
 * El veredicto del diagnóstico, CALCULADO. Devuelve una de las tres claves que
 * el preregistro escribió antes de ver números, o `null` si no se pudo mirar.
 *
 * ⚠️ `null` NO es «no se derrumba». Es «no se pudo mirar», y son cosas
 * distintas — la misma asimetría que gobierna `juzgarRespuesta` en la sonda.
 */
export function veredictoDiagnostico(c, { derrumbeMinimo } = {}) {
  if (!c || c.derrumbeHoy == null || c.subeEnArranque == null) return null
  const minimo = typeof derrumbeMinimo === 'number' ? derrumbeMinimo : 2
  if (c.derrumbeHoy < minimo) return 'noSeMueve'
  // Se derrumba. ¿Limpiar la rejilla lo arregla?
  if (c.subeEnArranque <= 1) return 'seDerrumbaPeroNoSube'
  return 'seDerrumba'
}
