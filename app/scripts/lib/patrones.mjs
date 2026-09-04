// Patrones de precio que se calculan con máximo, mínimo y cierre.
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE ARCHIVO EXISTE
// ─────────────────────────────────────────────────────────────────────────
// Vive aparte de `backtest.mjs` por la misma razón que `backtest-nucleo.mjs`:
// aquel necesita descargar miles de velas para arrancar, así que nada de lo
// que esté dentro se puede comprobar sin gastar los créditos del día.
//
// El primer intento SÍ tuvo esta función duplicada —una copia en el script y
// otra en la prueba, con una comprobación que comparaba los dos textos—. Falló
// a la primera, y por un comentario de más en una de las dos. La comprobación
// hacía su trabajo, pero el diseño era malo: mantener dos copias iguales a
// mano es trabajo que la máquina puede evitar. Un solo sitio y se acabó.
//
// ⚠️ NADA DE AQUÍ ENTRA EN LA APP TODAVÍA. Esto es material de medición. Si
// algún patrón mide bien, entonces se decide si pasa a `src/lib/marketCalc.js`
// — y esa es una decisión aparte, con su propia discusión.

/**
 * EL BARRIDO DE LIQUIDEZ.
 *
 * El precio perfora un máximo o un mínimo anterior —donde está acumulada la
 * gente con sus stops— y CIERRA DE VUELTA DENTRO. La idea, que viene de los
 * métodos ICT/SMC, es que ese pinchazo no era el inicio de un movimiento sino
 * la recogida de esos stops, y que el precio suele volverse después.
 *
 * ⚠️ EL NIVEL SALE DE LAS VELAS ANTERIORES, NO INCLUYE LA DE HOY.
 * Es el error que dejaría la tabla en cero sin avisar: el mínimo de hoy es, por
 * definición, candidato a ser el más bajo de la serie, así que incluirlo haría
 * que se comparase consigo mismo y no habría señal NUNCA. La tabla saldría con
 * cero operaciones y parecería que «el patrón no ocurre».
 *
 * @param p       par del barrido: necesita `highs`, `lows` y `c` (cierre de hoy)
 * @param n       cuántas velas atrás está el nivel que se barre
 * @param lado    'COMPRA' (se barre un suelo) o 'VENTA' (se barre un techo)
 * @param volver  true = barrido (cierra DENTRO). false = rompimiento (cierra
 *                FUERA). Son la MISMA perforación con desenlaces opuestos, y
 *                por eso el rompimiento sirve de control: si los dos dan lo
 *                mismo, lo que importa no es volverse sino tocar el nivel, y la
 *                historia de la recogida de stops sobra.
 */
export function barridoDeLiquidez(p, n, lado, volver = true) {
  const H = p.highs
  const L = p.lows
  if (!H || !L || H.length < n + 1) return false
  if (lado === 'COMPRA') {
    const suelo = Math.min(...L.slice(-n - 1, -1))
    const perforo = L.at(-1) < suelo
    return perforo && (volver ? p.c > suelo : p.c < suelo)
  }
  const techo = Math.max(...H.slice(-n - 1, -1))
  const perforo = H.at(-1) > techo
  return perforo && (volver ? p.c < techo : p.c > techo)
}

/**
 * El barrido convertido en regla de entrada para el banco de pruebas.
 *
 * @param exigirFuerza  además, que la fuerza relativa apunte al lado que se
 *                      opera. Es la condición que la app ya usa; se mide aparte
 *                      para saber si aporta algo ENCIMA del barrido o si solo
 *                      quita señales.
 * @param rsiEstirado   además, el RSI en el extremo. Es lo que hace sobrevivir
 *                      a la regla de reversión (la M2), así que si el barrido y
 *                      la reversión son el mismo efecto visto de dos maneras,
 *                      esta combinación debería ser la mejor de la tabla.
 */
export const reglaBarrido =
  (n, { volver = true, exigirFuerza = false, rsiEstirado = false } = {}) =>
  (p, esc, thr) => {
    for (const lado of ['COMPRA', 'VENTA']) {
      if (!barridoDeLiquidez(p, n, lado, volver)) continue
      if (exigirFuerza && (lado === 'COMPRA' ? p.dif <= thr : p.dif >= -thr)) continue
      if (rsiEstirado && (lado === 'COMPRA' ? p.rsiV > 35 : p.rsiV < 65)) continue
      return lado
    }
    return null
  }
