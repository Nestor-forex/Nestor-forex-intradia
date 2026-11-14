// FVG — BRECHA DE VALOR JUSTO (Fair Value Gap)
//
// ─────────────────────────────────────────────────────────────────────────
// QUÉ ES
// ─────────────────────────────────────────────────────────────────────────
// Un hueco que dejan TRES velas seguidas cuando el precio se mueve muy rápido:
//
//   · ALCISTA: el mínimo de la vela 3 queda POR ENCIMA del máximo de la vela 1.
//     Entre los dos hay un tramo de precio por el que nadie negoció.
//   · BAJISTA: el máximo de la vela 3 queda POR DEBAJO del mínimo de la vela 1.
//
// Viene de ICT (Inner Circle Trader), igual que el barrido de liquidez. La
// idea que se vende es que el precio «suele volver a rellenar el hueco» y que,
// cuando vuelve, conviene entrar a favor del movimiento grande que lo dejó.
//
// ⚠️⚠️ ESA ÚLTIMA FRASE ES UNA AFIRMACIÓN SOBRE EL MERCADO, NO UNA DEFINICIÓN.
// Lo que este archivo calcula es el HUECO (geometría pura sobre máximos y
// mínimos). Si conviene operarlo lo dice la medición —`medir-fvg.mjs` con su
// listón escrito antes en `scripts/lib/preregistro-fvg.mjs`—, nunca el nombre.
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ SE PUEDE MEDIR AQUÍ, Y LA OTRA MITAD DE ICT NO
// ─────────────────────────────────────────────────────────────────────────
// Solo hace falta el máximo y el mínimo de cada vela: ni la apertura (que
// Twelve Data no da en Swing) ni volumen. «El algoritmo de los bancos» (IPDA)
// no se puede medir porque no es un dato; esto sí.
//
// ⚠️ Ningún valor de aquí devuelve un LADO para operar salvo `reglaFVG`, que es
// material de medición. La pantalla enseña dónde están los huecos, nunca
// «compra» ni «vende».

const num = (x) => typeof x === 'number' && Number.isFinite(x)

/**
 * Todos los huecos que se cierran (vela 3) entre `desde` y `hasta`, ambos
 * incluidos, en una serie de máximos y mínimos alineados.
 *
 * Cada hueco: { tipo: 'alcista'|'bajista', k, abajo, arriba, tam }
 *   · `k`      índice de la vela 3, la que lo deja confirmado;
 *   · `abajo`  y `arriba` los bordes del tramo vacío (abajo < arriba siempre);
 *   · `tam`    arriba − abajo, en precio.
 *
 * ⚠️ Un hueco de tamaño CERO no es un hueco: «el mínimo de la vela 3 igual al
 * máximo de la vela 1» significa que se negoció justo ahí. Se exige
 * estrictamente mayor.
 *
 * ⚠️ Una vela con un número que no lo es (un `NaN`, un `null`) no forma hueco
 * con nadie. Si sí lo formara, un dato roto dibujaría un hueco inventado.
 */
export function huecosDe(highs, lows, { desde = 2, hasta } = {}) {
  if (!Array.isArray(highs) || !Array.isArray(lows) || highs.length !== lows.length) return []
  const fin = Math.min(hasta ?? highs.length - 1, highs.length - 1)
  const salida = []
  for (let k = Math.max(2, desde); k <= fin; k++) {
    const h1 = highs[k - 2]
    const l1 = lows[k - 2]
    const h3 = highs[k]
    const l3 = lows[k]
    if (![h1, l1, h3, l3].every(num)) continue
    if (l3 > h1) salida.push({ tipo: 'alcista', k, abajo: h1, arriba: l3, tam: l3 - h1 })
    else if (h3 < l1) salida.push({ tipo: 'bajista', k, abajo: h3, arriba: l1, tam: l1 - h3 })
  }
  return salida
}

/**
 * ¿Qué le pasó a un hueco en las velas que van de `k + 1` a `hasta`?
 *
 *   · 'abierto'  ninguna vela ha vuelto a entrar en el tramo vacío;
 *   · 'tocado'   alguna entró, pero sin atravesarlo entero;
 *   · 'relleno'  alguna lo atravesó de borde a borde: ya no queda hueco.
 *
 * ⚠️ «Entrar» se mide con la MECHA, no con el cierre: una vela alcista entra en
 * un hueco alcista en cuanto su mínimo baja del borde de arriba. Es la
 * definición de ICT, y es la conservadora para decir «sigue abierto».
 *
 * @returns el estado y `j`, el índice de la primera vela que lo tocó (o null).
 */
export function estadoDe(hueco, highs, lows, hasta) {
  if (!hueco) return null
  let tocado = null
  const fin = Math.min(hasta ?? highs.length - 1, highs.length - 1)
  for (let j = hueco.k + 1; j <= fin; j++) {
    const h = highs[j]
    const l = lows[j]
    if (!num(h) || !num(l)) continue
    if (hueco.tipo === 'alcista') {
      if (l <= hueco.abajo) return { estado: 'relleno', j: tocado ?? j }
      if (l < hueco.arriba && tocado === null) tocado = j
    } else {
      if (h >= hueco.arriba) return { estado: 'relleno', j: tocado ?? j }
      if (h > hueco.abajo && tocado === null) tocado = j
    }
  }
  return { estado: tocado === null ? 'abierto' : 'tocado', j: tocado }
}

// ═════════════════════════════════════════════════════════════════════════
// LA REGLA DE ENTRADA — MATERIAL DE MEDICIÓN
// ═════════════════════════════════════════════════════════════════════════
//
// La entrada clásica de ICT sobre un FVG: el PRIMER regreso del precio al
// hueco. Un hueco alcista que se dejó en las últimas `ventana` velas, que no
// se había tocado nunca desde que se formó, y que HOY se toca → se compra al
// cierre. Su espejo bajista → se vende.
//
// ⚠️⚠️ LAS DOS LECTURAS SALEN DEL MISMO DISPARO Y OPERAN LADOS CONTRARIOS,
// igual que en Bollinger. Van nombradas por lo que HACEN:
//
//   · `continuacion`  el regreso a un hueco alcista → COMPRA. Es la lectura de
//                     ICT: el hueco hace de soporte y el movimiento grande
//                     sigue.
//   · `contra`        el MISMO regreso → VENDE. O sea apostar a que el precio
//                     atraviesa el hueco. Es el CONTROL.
//
// Cuál es la candidata está decidido ANTES de medir, en
// `scripts/lib/preregistro-fvg.mjs`.
//
// ⚠️ Si HOY el precio cierra atravesando el hueco entero (por debajo del borde
// de abajo de un hueco alcista), no hay señal: el hueco falló el mismo día de
// la prueba, y comprar ahí sería comprar algo que ya se rompió.
//
// ⚠️ Si el mismo día se tocan a la vez un hueco alcista Y uno bajista, no hay
// señal: la regla no puede elegir lado sin inventarse un desempate.

export const VENTANA = 20

/**
 * El hueco que dispara HOY, o null. Mira solo hacia atrás: la vela de hoy es
 * la última de la serie y los huecos tienen que estar formados ANTES de ella.
 *
 * @param highs  máximos hasta hoy (incluido)
 * @param lows   mínimos hasta hoy (incluido)
 * @param c      el cierre de hoy
 * @param atr    el ATR de hoy, para el tamaño mínimo
 */
export function huecoQueDispara(highs, lows, c, atr, { ventana = VENTANA, minATR = 0 } = {}) {
  if (!Array.isArray(highs) || !Array.isArray(lows) || highs.length < 4) return null
  if (!num(c)) return null
  const L = highs.length - 1
  const hoyH = highs[L]
  const hoyL = lows[L]
  if (!num(hoyH) || !num(hoyL)) return null
  if (minATR > 0 && !num(atr)) return null

  // La vela 3 tiene que ser como muy tarde la de AYER: un hueco que se cierra
  // hoy no puede «volver a tocarse» hoy.
  const candidatos = huecosDe(highs, lows, { desde: L - ventana, hasta: L - 1 })
    .filter((h) => h.tam >= minATR * (atr || 0))
    // Que no se haya tocado NUNCA antes de hoy: el primer regreso.
    .filter((h) => estadoDe(h, highs, lows, L - 1)?.estado === 'abierto')
    .filter((h) =>
      h.tipo === 'alcista'
        ? hoyL < h.arriba && c > h.abajo
        : hoyH > h.abajo && c < h.arriba
    )
  if (!candidatos.length) return null
  const tipos = new Set(candidatos.map((h) => h.tipo))
  if (tipos.size > 1) return null
  // El más reciente: es el que ICT llama «el hueco vigente».
  return candidatos.reduce((a, b) => (b.k > a.k ? b : a))
}

/**
 * La regla, con la firma que espera `generarSenales` (p, esc, thr).
 *
 * ⚠️ NO MIRA LA FUERZA RELATIVA (`thr` se ignora a propósito). El FVG es una
 * idea de precio puro; añadirle el filtro de fuerza sería medir otra regla con
 * el mismo nombre.
 */
export const reglaFVG =
  ({ lectura = 'continuacion', ventana = VENTANA, minATR = 0 } = {}) =>
  (p) => {
    const h = huecoQueDispara(p?.highs, p?.lows, p?.c, p?.atrAbs, { ventana, minATR })
    if (!h) return null
    const aFavor = h.tipo === 'alcista' ? 'COMPRA' : 'VENTA'
    if (lectura === 'continuacion') return aFavor
    return aFavor === 'COMPRA' ? 'VENTA' : 'COMPRA'
  }

/**
 * Cómo ordenar cuando hay más candidatos de los que caben: por el tamaño del
 * hueco medido en ATR. Un hueco grande es un desplazamiento grande, que es lo
 * que la propia idea dice que importa.
 *
 * ⚠️ Sin esto la medición usaría el orden de la APP (divergencia de fuerza) y
 * la fila diría «FVG» midiendo «FVG desempatado por fuerza». Mismo motivo que
 * `ordenPorBollinger`.
 */
export const ordenPorFVG =
  ({ ventana = VENTANA, minATR = 0 } = {}) =>
  (p) => {
    const h = huecoQueDispara(p?.highs, p?.lows, p?.c, p?.atrAbs, { ventana, minATR })
    if (!h || !num(p?.atrAbs) || !(p.atrAbs > 0)) return 0
    return h.tam / p.atrAbs
  }

// ═════════════════════════════════════════════════════════════════════════
// LO QUE ENSEÑA LA PANTALLA (el Analizador)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Los huecos que siguen VIVOS (abiertos o tocados sin rellenar) en una ventana
 * corta de velas, para enseñarlos en el Analizador.
 *
 * @param velaEnCurso  si la última vela va a medias. En Swing sí: el barrido se
 *                     publica a las 11:20 y a las 19:20 UTC, con el día sin
 *                     terminar. Una vela a medias no puede ser la vela 3 de un
 *                     hueco —su mínimo todavía puede bajar y deshacerlo—, pero
 *                     SÍ cuenta para decir si un hueco ya se tocó.
 * @returns lista ordenada del más reciente al más viejo, o null si no hay
 *          datos. ⚠️ `null` = «no lo sé»; `[]` = «miré y no hay ninguno vivo».
 */
export function huecosVivos(highs, lows, { velaEnCurso = false } = {}) {
  if (!Array.isArray(highs) || !Array.isArray(lows) || highs.length < 3 || highs.length !== lows.length) {
    return null
  }
  if (!highs.every(num) || !lows.every(num)) return null
  const L = highs.length - 1
  const hasta = velaEnCurso ? L - 1 : L
  return huecosDe(highs, lows, { hasta })
    .map((h) => ({ ...h, ...estadoDe(h, highs, lows, L) }))
    .filter((h) => h.estado !== 'relleno')
    .map((h) => ({ ...h, velasAtras: L - h.k }))
    .sort((a, b) => b.k - a.k)
}
