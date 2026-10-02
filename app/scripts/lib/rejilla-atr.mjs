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

// ─────────────────────────────────────────────────────────────────────────
// LA PREGUNTA DE SWING, QUE AQUÍ NUNCA SE HIZO (añadido 2026-10-01)
// ─────────────────────────────────────────────────────────────────────────
//
// Arriba se contesta «¿se HUNDE el ATR al abrir la semana?» — una pregunta de
// POSICIÓN. Aquí se contesta la de Swing: **«¿cuánto SUBE el ATR al quitar las
// horas cerradas?»** — una pregunta de NIVEL.
//
// ⚠️ No vale el `atrMedioHoy` / `atrMedioLimpia` que ya se imprimía: en este
// mismo repositorio está escrito que esa medida es **insensible a propósito**
// (las horas afectadas son ~5 % del total, y una mediana sobre todo no las ve).
// Y además compara dos MEDIANAS, no la mediana de los COCIENTES — si el ATR
// sube un 20 % en un cuarto de las velas y no se mueve en el resto, las dos
// medianas salen casi iguales.

// Un cuantil, para poder enseñar la DISTRIBUCIÓN del cociente en vez de un
// número solo. `null` cuando no hay datos: nunca 0, que sería afirmar algo.
export function cuantil(xs, q) {
  const v = (xs ?? []).filter(Number.isFinite).sort((a, b) => a - b)
  if (!v.length) return null
  const i = (v.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (i - lo)
}

/**
 * ⚠️⚠️ EL MECANISMO CANDIDATO, MEDIDO Y NO AFIRMADO.
 *
 * Si el ATR no sube al limpiar habiendo quitado un 25,8 % de velas 5,2× más
 * estrechas, hay algo que explicar. La hipótesis es que al limpiar **la primera
 * vela de la semana mide su rango verdadero contra el cierre del VIERNES** en
 * vez de contra el del domingo, o sea que se come el hueco del fin de semana
 * entero — y un rango grande compensa los estrechos que se quitaron.
 *
 * Esto lo mide. Devuelve, para cada arranque de semana, el rango verdadero en
 * las dos rejillas y su cociente.
 *
 * 📌 Va como hipótesis a propósito: en este proyecto hay nueve casos escritos
 * de un mecanismo convincente que resultó falso al medirlo, y uno es el de la
 * pregunta de arriba, de ayer mismo.
 */
export function huecoDeApertura(fechas, highs, lows, closes) {
  const n = Math.min(fechas?.length ?? 0, highs?.length ?? 0, lows?.length ?? 0, closes?.length ?? 0)
  if (n < 3) return null

  // Los índices que sobreviven al limpiar (mercado y frontera), igual que en
  // `compararRejillas`: la frontera se queda.
  const idxLimpia = []
  for (let i = 0; i < n; i++) if (clasificarHora(fechas[i]) !== 'cerrado') idxLimpia.push(i)
  const posEnLimpia = new Map(idxLimpia.map((i, k) => [i, k]))

  // El rango verdadero de la vela i con respecto a un cierre previo dado.
  const rv = (i, cierrePrevio) => {
    const h = highs[i]
    const l = lows[i]
    if (!Number.isFinite(h) || !Number.isFinite(l)) return null
    if (!Number.isFinite(cierrePrevio)) return h - l
    return Math.max(h - l, Math.abs(h - cierrePrevio), Math.abs(l - cierrePrevio))
  }

  const filas = []
  for (const i of arranquesDeSemana(fechas, 1)) {
    const k = posEnLimpia.get(i)
    if (k == null || k === 0 || i === 0) continue
    const rangoHoy = rv(i, closes[i - 1])
    const rangoLimpia = rv(i, closes[idxLimpia[k - 1]])
    if (rangoHoy == null || rangoLimpia == null) continue
    filas.push({
      fecha: fechas[i],
      // ⚠️ Las dos fechas van en la fila a propósito: si un día el cierre
      // previo de la rejilla limpia dejara de ser el del viernes, se vería
      // aquí en vez de quedar escondido dentro de un cociente.
      previoHoy: fechas[i - 1],
      previoLimpia: fechas[idxLimpia[k - 1]],
      rangoHoy,
      rangoLimpia,
      veces: rangoHoy > 0 ? rangoLimpia / rangoHoy : null,
    })
  }
  if (!filas.length) return null
  return {
    arranques: filas.length,
    // ⚠️ EL NÚMERO QUE REFUTA LA HIPÓTESIS, y por eso va antes que el cociente:
    // en cuántos arranques el cierre previo es DISTINTO entre las dos rejillas.
    // Si es 0, no hay ningún hueco que comerse — la frontera que se conserva
    // (domingo 21:00-23:00 UTC) hace de puente y la vela anterior es la misma.
    // Medido en el mercado sintético: 0 de 11.
    conPrevioDistinto: filas.filter((f) => f.previoHoy !== f.previoLimpia).length,
    medianaVeces: mediana(filas.map((f) => f.veces)),
    medianaRangoHoy: mediana(filas.map((f) => f.rangoHoy)),
    medianaRangoLimpia: mediana(filas.map((f) => f.rangoLimpia)),
    filas,
  }
}

/**
 * ⚠️ LA PREGUNTA DE SWING: ¿cuánto sube el ATR al quitar las horas cerradas?
 *
 * Se mide de tres maneras a la vez porque las tres dicen cosas distintas y
 * quedarse con una sola es cómo se fabrica un número que no significa nada:
 *
 *   `medianaDelCociente`  → la mediana del cociente VELA POR VELA. Es la que
 *                           decide: contesta «en una vela cualquiera, ¿cuánto
 *                           sube?».
 *   `cocienteDeMedianas`  → el cociente de las dos medianas, que es lo que se
 *                           imprimía antes. Se enseña para que se vea la
 *                           diferencia, no para decidir con él.
 *   `alFinal`             → en la ÚLTIMA vela, que es la que la app usa de
 *                           verdad para poner el stop de hoy. Es el equivalente
 *                           exacto de lo que midió Swing (`comoQuedaria`).
 *
 * ⚠️ Las dos series se leen en las MISMAS FECHAS, igual que en
 * `compararRejillas`: por índice serían dos instantes distintos y no daría
 * ningún error, daría dos números plausibles de dos momentos que no son el
 * mismo.
 */
export function cuantoSubeElATR(fechas, highs, lows, closes, { atrStop = 1.5, umbral = 0.07 } = {}) {
  const n = Math.min(fechas?.length ?? 0, highs?.length ?? 0, lows?.length ?? 0, closes?.length ?? 0)
  if (n < PERIODO_ATR + 2) return null

  const atrHoy = atrEnCada(highs, lows, closes)

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

  // Solo velas de MERCADO, y solo fechas que las dos rejillas pueden
  // contestar. Preguntar por una hora cerrada no tiene sentido: en la rejilla
  // limpia esa hora no existe.
  const cocientes = []
  const hoyVals = []
  const limpiaVals = []
  for (let i = 0; i < n; i++) {
    if (clasificarHora(fechas[i]) !== 'mercado') continue
    const h = atrHoy[i]
    const l = porFechaLimpia.get(fechas[i])
    if (h == null || l == null || h === 0) continue
    cocientes.push(l / h)
    hoyVals.push(h)
    limpiaVals.push(l)
  }
  if (!cocientes.length) return null

  // ⚠️⚠️ EL ESTADÍSTICO QUE DECIDE: la PROPORCIÓN de velas cuyo ATR cambia más
  // que el peso del spread. NO la mediana.
  //
  // La mediana se escribió primero como «la que decide» y el mercado sintético
  // la desmintió: con el efecto puesto a propósito daba **1,000 exacto** y
  // mientras tanto el 23,9 % de las velas subía más del 7 %. No es un fallo, es
  // aritmética de esta app: `atrWilder` tiene una ventana DURA de 60 velas, así
  // que solo cambian las que tienen horas cerradas dentro de su ventana — el
  // 46,7 % como techo estructural. Más de la mitad no puede cambiar y la
  // mediana se queda clavada en 1.
  //
  // 📌 Y es la diferencia de fondo con Swing: allá `atrWilder` recorre la serie
  // ENTERA, así que quitar velas cambia TODOS los valores. Aquí el efecto es
  // LOCAL. El mismo estadístico no significa lo mismo en las dos apps.

  // El final: la última fecha que las dos rejillas contestan. Es lo que la app
  // usa HOY para poner el stop, y es la medida de Swing.
  let finalHoy = null
  let finalLimpia = null
  for (let i = n - 1; i >= 0; i--) {
    const h = atrHoy[i]
    const l = porFechaLimpia.get(fechas[i])
    if (h != null && l != null && h !== 0) {
      finalHoy = h
      finalLimpia = l
      break
    }
  }

  const medHoy = mediana(hoyVals)
  const medLimpia = mediana(limpiaVals)
  return {
    velas: cocientes.length,
    velasQuitadas: n - idxLimpia.length,
    medianaDelCociente: mediana(cocientes),
    // Lo que decide. `umbral` entra como parámetro para que el listón sea el
    // dueño del número y este archivo solo haga la cuenta.
    proporcionAfectada: cocientes.filter((x) => Math.abs(x - 1) >= umbral).length / cocientes.length,
    afectadas: cocientes.filter((x) => Math.abs(x - 1) >= umbral).length,
    p10: cuantil(cocientes, 0.1),
    p90: cuantil(cocientes, 0.9),
    cocienteDeMedianas: medHoy && medLimpia ? medLimpia / medHoy : null,
    atrFinalHoy: finalHoy,
    atrFinalLimpia: finalLimpia,
    alFinal: finalHoy ? finalLimpia / finalHoy : null,
    // Lo que significa en plata: el stop de esta app ES 1,5 × ATR, así que lo
    // que sube el ATR sube el stop en la misma proporción. Se devuelve en pips
    // relativos para que el informe no tenga que recalcularlo.
    stopFinalHoy: finalHoy == null ? null : atrStop * finalHoy,
    stopFinalLimpia: finalLimpia == null ? null : atrStop * finalLimpia,
  }
}

/**
 * El veredicto de la pregunta de Swing, CALCULADO.
 *
 * ⚠️⚠️ Decide con `proporcionAfectada`, NO con la mediana del cociente ni con
 * el cociente de las medianas. Las dos se devuelven y se imprimen, y las dos
 * son insensibles aquí por la misma razón: la ventana dura de 60 velas hace
 * que el efecto sea LOCAL, así que más de la mitad de las velas de mercado no
 * puede cambiar y cualquier mediana sobre todas se queda en 1. Medido en el
 * mercado sintético, con el efecto puesto a propósito: mediana 1,000 exacto
 * mientras el 23,9 % de las velas subía más del 7 %.
 *
 * 📌 Una medida insensible a lo que quiere medir es peor que ninguna: habría
 * dado «el ATR no sube» con el efecto delante. Ya está escrito en este
 * repositorio para `atrMedioGlobal`, y volvió a pasar.
 *
 * ⚠️ `null` NO es «no sube». Es «no se pudo mirar».
 */
export function veredictoPreguntaDeSwing(r, { proporcionMinima = 0.15 } = {}) {
  if (!r || r.proporcionAfectada == null) return null
  return r.proporcionAfectada >= proporcionMinima ? 'sube' : 'noSube'
}
