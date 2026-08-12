// Dónde poner el stop y el objetivo. Varias formas, para medirlas.
//
// Portado del banco de pruebas de la app hermana de swing, con lo que cambia
// aquí anotado. Allí midiendo geometrías se descubrió que ninguna propuesta le
// ganaba a la de la app, pero que con una geometría NEUTRA salían a la luz
// cosas que la de la app tapaba. Esa es la que más importa de este archivo.

const atrDe = (c) => c.atrAbs
const acotar = (x, min, max) => Math.min(Math.max(x, min), max)

// La de la app, para tener con qué comparar.
//
// Ojo: aquí NO es la misma fórmula que en swing. Intradía pone el stop a una
// distancia fija en ATR y el objetivo en el primer nivel real que encuentre
// —extremo de 20 velas o pivote de sesión—, y si no hay ninguno a más de 1
// ATR, se inventa uno a 2,5 ATR. Ese último caso es el que deja R/B de 1.67
// clavado, que fue la firma de las cinco señales perdedoras.
const ATR_STOP = 1.5
export function actual(c, compra) {
  const atr = atrDe(c)
  const min = c.precio + (compra ? 1 : -1) * atr
  const niveles = compra ? [c.res, c.pivote].filter((x) => x > min) : [c.sup, c.pivote].filter((x) => x < min)
  const tp = niveles.length
    ? compra
      ? Math.min(...niveles)
      : Math.max(...niveles)
    : c.precio + (compra ? 1 : -1) * 2.5 * atr
  return { sl: compra ? c.precio - ATR_STOP * atr : c.precio + ATR_STOP * atr, tp }
}

// Stop y objetivo a la MISMA distancia, y la misma comprando que vendiendo.
//
// No es para usarla de verdad: es una regla de medir. Con 1 a 1, el resultado
// por unidad de riesgo depende SOLO de cuántas veces se acierta la dirección
// (2 × aciertos − 1). Sin ella, una geometría que pone el stop cerca y el
// objetivo lejos infla el resultado sola y no se puede saber si la señal
// aporta algo.
//
// En swing fue justo esta la que destapó lo importante: con la geometría de la
// app las compras parecían acertar un 58%, y con esta salieron al 50% pelado
// —una moneda al aire—. Lo que sobraba era el maquillaje del objetivo cercano.
export function simetrica(c, compra, { riesgoATR = 1.5 } = {}) {
  const d = riesgoATR * atrDe(c)
  return {
    sl: compra ? c.precio - d : c.precio + d,
    tp: compra ? c.precio + d : c.precio - d,
  }
}

// Objetivo en veces el riesgo, con el stop acotado para que ni lo tumbe el
// ruido ni se coma el presupuesto.
export function porRiesgo(c, compra, { riesgoATR = 1.5, veces = 2 } = {}) {
  const riesgo = acotar(riesgoATR * atrDe(c), 0.8 * atrDe(c), 3 * atrDe(c))
  return {
    sl: compra ? c.precio - riesgo : c.precio + riesgo,
    tp: compra ? c.precio + veces * riesgo : c.precio - veces * riesgo,
  }
}

export const GEOMETRIAS = [
  ['A. La de la app (stop 1,5 ATR / nivel real)', actual],
  ['B. Neutra 1 a 1 (vara de medir)', simetrica],
  ['C. Riesgo 1,5 ATR → objetivo 2×', (c, compra) => porRiesgo(c, compra)],
  ['D. Riesgo 1,5 ATR → objetivo 3×', (c, compra) => porRiesgo(c, compra, { veces: 3 })],
]
