// LA DISTRIBUCIÓN DE LA COMPRESIÓN: la parte que se puede comprobar sin red.
//
// ⚠️⚠️ POR QUÉ ESTE ARCHIVO EXISTE, Y NO ES ORGANIZACIÓN
//
// La primera versión de `medir-compresion.mjs` llevaba todo esto dentro y
// FALLÓ EN PRODUCCIÓN gastando 7 créditos, por una razón boba y de la familia
// peor: leía `{ fechas, rangosPar }` del lector de velas, que son los nombres
// de la app HERMANA. Aquí el lector devuelve `{ barras, rates, rangos }`.
//
// Y la prueba de humo NO lo cazó porque el mercado inventado lo había escrito
// yo con los mismos nombres equivocados: el banco confirmaba mi propio error.
// Es «antes de creerse un resultado, comprobar que el banco mide lo que dice
// medir» por su cara más incómoda — aquí el banco y el fallo tenían el mismo
// autor.
//
// Sacar las cuentas aquí permite dos cosas que antes no se podían:
//   · probarlas sin internet y sin gastar un crédito;
//   · y exigir, desde la prueba, que los nombres que este archivo espera sean
//     EXACTAMENTE los que `velas.mjs` devuelve.
//
// ⚠️ NINGÚN UMBRAL VIVE AQUÍ. Se pasan. Es lo mismo que en `compresion.js`, y
// por el mismo motivo: un cociente de 0,90 no significa lo mismo en velas de
// una hora que en velas de un día.

import {
  PAIRS,
  CCY,
  VELAS_ATRAS_COMPRESION,
  atrWilder,
  precioDePar,
  maxDePar,
  minDePar,
} from '../../src/lib/marketCalc.js'
import { compresionDe } from '../../src/lib/compresion.js'

/**
 * Las series de precio por divisa, EXACTAMENTE como las arma `computarBarrido`.
 *
 * ⚠️ Se usan las funciones exportadas (`precioDePar`, `maxDePar`, `minDePar`)
 * en vez de rehacer la aritmética. El máximo de un cruce combina el MÍNIMO de
 * la base con el MÁXIMO de la cotizada, y escribir eso de memoria es
 * literalmente como salió un ATR un 400 % mayor del real el 2026-08-09.
 */
function seriesPorDivisa(barras, rates, rangos) {
  const serie = {}
  const serieHi = {}
  const serieLo = {}
  for (const c of CCY) {
    serie[c] = barras.map((t) => (c === 'USD' ? 1 : rates[t][c]))
    serieHi[c] = barras.map((t, i) => (c === 'USD' ? 1 : (rangos?.[t]?.[c]?.h ?? serie[c][i])))
    serieLo[c] = barras.map((t, i) => (c === 'USD' ? 1 : (rangos?.[t]?.[c]?.l ?? serie[c][i])))
  }
  return { serie, serieHi, serieLo }
}

/**
 * La compresión de un par en la vela `i`, con la serie que llega hasta ahí.
 *
 * 📌 Esto es EXACTAMENTE lo que la app calcula, y no una aproximación: en
 * producción el vigía le pasa a `computarBarrido` las últimas 300 velas, pero
 * `atrWilder` solo mira las últimas 60 de lo que recibe, así que darle la
 * serie entera hasta la vela `i` devuelve el mismo número. Hay una
 * comprobación dedicada a eso, porque era una afirmación en un comentario.
 */
export function compresionEn(highs, lows, closes, i) {
  const h = highs.slice(0, i + 1)
  const l = lows.slice(0, i + 1)
  const c = closes.slice(0, i + 1)
  const atrAhora = atrWilder(h, l, c)
  const atrAntes = atrWilder(
    h.slice(0, -VELAS_ATRAS_COMPRESION),
    l.slice(0, -VELAS_ATRAS_COMPRESION),
    c.slice(0, -VELAS_ATRAS_COMPRESION),
  )
  // ⚠️ Sin el `?? 1` de la app, y a propósito: aquí se quiere la DISTRIBUCIÓN
  // de lo que se puede calcular de verdad. Meter unos a mano crearía un pico
  // falso justo en el valor que más decide.
  return compresionDe(atrAhora, atrAntes)
}

/**
 * La distribución entera: un par, una vela.
 *
 * ⚠️ La unidad de observación es ésa y no «una señal». La tarjeta pone etiqueta
 * a LOS 18 PARES en TODAS las lecturas; una señal es una selección (exige
 * divergencia de fuerza), así que sus percentiles no describirían lo que se ve
 * en pantalla.
 *
 * ⚠️ Recibe el objeto TAL CUAL lo devuelve `obtenerVelas` de ESTA app:
 * `{ barras, rates, rangos }`. Ver la cabecera para saber por qué eso está
 * escrito aquí en vez de darse por sabido.
 */
export function distribucionDeCompresion({ barras, rates, rangos }, { calentamiento = 90 } = {}) {
  if (!Array.isArray(barras) || !barras.length) {
    throw new Error(
      'distribucionDeCompresion: falta `barras`. ¿Se le pasó el objeto de la app hermana ' +
        '(`fechas`/`rangosPar`) en vez del de ésta (`barras`/`rangos`)?',
    )
  }
  const L = barras.length - 1
  const { serie, serieHi, serieLo } = seriesPorDivisa(barras, rates, rangos)

  const porPar = new Map()
  const todas = []
  let posibles = 0

  for (const [b, q] of PAIRS) {
    const closes = barras.map((_, i) => precioDePar(serie[b][i], serie[q][i]))
    const highs = barras.map((_, i) => maxDePar(serieLo[b][i], serieHi[q][i]))
    const lows = barras.map((_, i) => minDePar(serieHi[b][i], serieLo[q][i]))

    const vals = []
    for (let i = calentamiento; i <= L; i++) {
      posibles++
      const x = compresionEn(highs, lows, closes, i)
      if (Number.isFinite(x)) vals.push(x)
    }
    porPar.set(`${b}/${q}`, vals)
    todas.push(...vals)
  }

  return { porPar, todas, posibles }
}

/**
 * Percentiles. Devuelve `null` —y nunca ceros— con la lista vacía: un cero
 * diría «la compresión es cero», que es una afirmación sobre el mercado.
 */
export function percentiles(xs) {
  const v = (xs ?? []).filter(Number.isFinite).sort((a, b) => a - b)
  if (!v.length) return null
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))]
  return {
    n: v.length,
    min: q(0),
    p10: q(0.1),
    p25: q(0.25),
    p50: q(0.5),
    p75: q(0.75),
    p90: q(0.9),
    max: q(1),
  }
}

/** Qué fracción de las observaciones cae por debajo de un umbral, en %. */
export function fraccionBajo(xs, umbral) {
  const v = (xs ?? []).filter(Number.isFinite)
  if (!v.length || !Number.isFinite(umbral)) return null
  return (v.filter((x) => x < umbral).length / v.length) * 100
}
