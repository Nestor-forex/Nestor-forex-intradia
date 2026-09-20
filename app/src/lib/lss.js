// NFX-LSS — Barrido de liquidez confirmado por ruptura de estructura.
//
// Traducción a JavaScript del indicador que Néstor escribió en Pine Script
// para el concurso de TradingView («NestorForex Smart Signal»). Aquí NO se
// dibuja nada: esto solo dice, para una serie de velas, en qué barra habría
// una señal y con qué niveles. Lo visual va aparte, si algún día pasa el
// banco de pruebas.
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO ESTÁ EN JAVASCRIPT Y NO EN PYTHON
// ─────────────────────────────────────────────────────────────────────────
// Néstor lo pidió en Python. Se hizo en JavaScript a propósito: el banco de
// pruebas de este proyecto está en JavaScript, y solo pasando por él se puede
// medir esta regla con la MISMA vara neutra, los MISMOS spreads por par, el
// mismo barrido de swap y el mismo corte en dos mitades que todo lo demás.
// Un número obtenido por otro camino no se podría comparar con nada de lo ya
// medido, que es justo lo que este proyecto lleva meses evitando.
//
// ─────────────────────────────────────────────────────────────────────────
// QUÉ ES, EN TRES PASOS
// ─────────────────────────────────────────────────────────────────────────
//   1. PIVOTE — un máximo (o mínimo) con `swingLen` velas más bajas (o más
//      altas) A CADA LADO. Se confirma `swingLen` velas DESPUÉS de formarse:
//      hay que ver lo que viene detrás para saber que era un pivote.
//   2. BARRIDO — el precio mete la mecha más allá del último pivote y CIERRA
//      de vuelta dentro. La trampa de stops.
//   3. RUPTURA — el cierre rompe el pivote del lado contrario. Si va a favor
//      de la tendencia vigente es BOS; si la gira, CHoCH.
//
// Hay señal solo si 2 y 3 ocurren dentro de una ventana de `sweepWindow`
// velas. Esa exigencia conjunta es lo ÚNICO que no se ha medido nunca en este
// proyecto: el barrido suelto ya se midió cinco veces y pierde en las dos
// apps, y el barrido con RSI y con fuerza relativa también.
//
// ⚠️ ESTO NO ES EL MISMO BARRIDO QUE `perforaExtremo`, y la diferencia es la
// razón de medirlo aparte: aquél perfora **el mínimo de las últimas N velas**
// y éste perfora **el último pivote confirmado**, que puede tener cuarenta
// velas de antigüedad y tiene forma de suelo de verdad. Son parientes, no
// gemelos.

/**
 * El ATR de Wilder de una serie de velas.
 *
 * Existe aquí, y no se reutiliza el de `marketCalc.js`, porque aquél trabaja
 * sobre la forma de datos de la app (por divisa, por fecha) y esto solo sabe
 * de una lista de velas. Es la misma cuenta.
 *
 * Devuelve `null` en las posiciones donde todavía no hay suficientes velas:
 * sin ATR no se puede poner el colchón del stop, y **inventarle un valor sería
 * poner el stop a una distancia que nadie calculó**.
 */
export function atrWilder(velas, periodo) {
  const n = velas.length
  const fuera = new Array(n).fill(null)
  if (n < 2 || periodo < 1) return fuera

  let suma = 0
  for (let i = 1; i < n; i++) {
    const prev = velas[i - 1].c
    const tr = Math.max(velas[i].h - velas[i].l, Math.abs(velas[i].h - prev), Math.abs(velas[i].l - prev))
    if (i <= periodo) {
      suma += tr
      if (i === periodo) fuera[i] = suma / periodo
    } else {
      fuera[i] = (fuera[i - 1] * (periodo - 1) + tr) / periodo
    }
  }
  return fuera
}

/**
 * Los pivotes confirmados de una serie.
 *
 * Devuelve, para cada índice, qué pivote era el ÚLTIMO conocido en ese
 * momento — que no es lo mismo que el último que existe. Un pivote en la
 * barra `p` no se puede usar hasta la barra `p + n`, porque hasta entonces no
 * se sabe que lo era.
 *
 * ⚠️ Respetar ese retraso es lo que impide mirar el futuro. Sin él la regla
 * mediría estupendamente y no se podría operar: en la barra `p` nadie sabe
 * todavía que ahí había un pivote.
 *
 * @param velas  [{ h, l, c }] en orden cronológico
 * @param n      cuántas velas se exigen a cada lado
 * @returns { altos, bajos } — dos arrays del mismo largo que `velas`, con el
 *          valor del último pivote conocido en cada índice (o null).
 */
export function pivotesConocidos(velas, n) {
  const N = velas.length
  const altos = new Array(N).fill(null)
  const bajos = new Array(N).fill(null)
  if (n < 1 || N === 0) return { altos, bajos }

  let ultAlto = null
  let ultBajo = null

  for (let i = 0; i < N; i++) {
    // ¿Se confirma en ESTA barra un pivote que ocurrió `n` barras atrás?
    const p = i - n
    if (p - n >= 0) {
      let esAlto = true
      let esBajo = true
      for (let k = p - n; k <= p + n; k++) {
        if (k === p) continue
        // Estrictamente mayor/menor que TODAS las de al lado, como
        // `ta.pivothigh`. Con `>=` un tramo plano daría varios pivotes
        // seguidos al mismo precio y el nivel no significaría nada.
        if (velas[k].h >= velas[p].h) esAlto = false
        if (velas[k].l <= velas[p].l) esBajo = false
        if (!esAlto && !esBajo) break
      }
      if (esAlto) ultAlto = velas[p].h
      if (esBajo) ultBajo = velas[p].l
    }
    altos[i] = ultAlto
    bajos[i] = ultBajo
  }

  return { altos, bajos }
}

/**
 * Las señales NFX-LSS de una serie de velas.
 *
 * @param velas   [{ h, l, c }] en orden cronológico
 * @param opciones
 *   swingLen      velas a cada lado para confirmar un pivote
 *   sweepWindow   cuántas velas después del barrido sigue valiendo la ruptura
 *   rr            ratio riesgo:beneficio para el objetivo
 *   exigirSweep   si false, señala solo con la ruptura (más señales, sin filtrar)
 *   slBufferAtr   colchón del stop más allá del punto, en veces el ATR (v1.1)
 *   atrLen        periodo de ese ATR
 * @returns [{ i, lado, evento, entrada, sl, tp, iSweep, iSalida, nivel, huboSweep }]
 */
export function senalesLSS(
  velas,
  { swingLen = 5, sweepWindow = 10, rr = 2, exigirSweep = true, slBufferAtr = 0, atrLen = 14 } = {}
) {
  const { altos, bajos } = pivotesConocidos(velas, swingLen)
  // Solo se calcula si hace falta: sin colchón no se toca nada y el resultado
  // es idéntico al de antes de la v1.1, que es lo que permite comparar.
  const atr = slBufferAtr > 0 ? atrWilder(velas, atrLen) : null
  const fuera = []
  // TODAS las rupturas, incluidas las que el filtro del barrido descarta como
  // señal. Hacen falta enteras para la salida por estructura: una operación se
  // cierra cuando el mercado rompe en contra, haya o no habido barrido antes
  // de esa ruptura. Es lo que hace el `structureExit` del Pine.
  const rupturas = []

  let tendencia = 'neutral'
  // Dónde ocurrió el último barrido de cada lado, y con qué mínimo/máximo.
  let iSweepBajo = -1
  let iSweepAlto = -1

  for (let i = 1; i < velas.length; i++) {
    const v = velas[i]
    const prev = velas[i - 1]
    const nivelAlto = altos[i]
    const nivelBajo = bajos[i]

    // ── BARRIDO ────────────────────────────────────────────────────────────
    // ⚠️ SIN la casilla de dibujar. En el Pine original esta condición lleva
    // dentro `showLiquidity`, que es una opción VISUAL: al desmarcarla el
    // contador no se reinicia nunca y el indicador deja de dar señales sin
    // decir por qué. Aquí la lógica no depende de si algo se pinta.
    if (nivelBajo !== null && v.l < nivelBajo && v.c > nivelBajo) iSweepBajo = i
    if (nivelAlto !== null && v.h > nivelAlto && v.c < nivelAlto) iSweepAlto = i

    // ── RUPTURA DE ESTRUCTURA ──────────────────────────────────────────────
    // El nivel se congela para las DOS barras. El Pine usa
    // `ta.crossover(close, lastSwingHigh)`, que compara el cierre de ayer
    // contra el nivel de AYER y el de hoy contra el de HOY.
    //
    // 📌 YO DIJE QUE ESO ERA UN FALLO Y ME EQUIVOQUÉ (2026-09-18). Sostuve que
    // si aparecía un pivote más bajo que el precio, el cruce se dispararía sin
    // que el precio subiera. **No puede pasar, y el motivo es estructural:** un
    // pivote en la barra `p` se confirma en `p + n`, y su definición exige que
    // las barras `p+1 … p+n` tengan máximos MÁS BAJOS. La barra `p+n` es una de
    // ellas, así que su cierre está por debajo del nivel que acaba de nacer.
    // El nivel nuevo nunca puede aparecer ya rebasado.
    //
    // Comprobado sobre 108.626 cambios de nivel en mercados al azar: cero
    // casos. Y `prueba-lss.mjs` exige que esta versión y la del Pine den
    // EXACTAMENTE las mismas rupturas.
    //
    // Se deja congelado igual, porque expresa mejor la pregunta que se quiere
    // hacer —«¿el cierre cruzó ESTE nivel?»— y no depende de si el nivel
    // cambió justo en esa barra.
    const rompeArriba = nivelAlto !== null && prev.c <= nivelAlto && v.c > nivelAlto
    const rompeAbajo = nivelBajo !== null && prev.c >= nivelBajo && v.c < nivelBajo

    if (!rompeArriba && !rompeAbajo) continue

    // Se anota ANTES de cualquier filtro, a propósito (ver `rupturas` arriba).
    rupturas.push({ i, arriba: rompeArriba })

    const lado = rompeArriba ? 'COMPRA' : 'VENTA'
    const evento = (rompeArriba ? tendencia === 'bear' : tendencia === 'bull') ? 'CHoCH' : 'BOS'
    tendencia = rompeArriba ? 'bull' : 'bear'

    const iSweep = rompeArriba ? iSweepBajo : iSweepAlto
    if (exigirSweep && (iSweep < 0 || i - iSweep > sweepWindow)) continue

    // ── NIVELES ────────────────────────────────────────────────────────────
    // ⚠️ EL STOP VA EN LA MECHA DEL BARRIDO, no en el pivote. Lo decidió
    // Néstor el 2026-09-18, y coincide con lo que dice su propia guía («en el
    // punto exacto que se barrió»). Su Pine hacía otra cosa: lo ponía en el
    // pivote, que por definición está POR ENCIMA del mínimo de la vela que
    // acaba de barrerlo — o sea, justo donde el mercado demostró hace un
    // momento que va a buscar stops.
    //
    // Sin barrido no hay mecha que usar, así que se cae al pivote. Solo pasa
    // con `exigirSweep: false`, que es la fila de control.
    const entrada = v.c
    let sl = iSweep >= 0 ? (rompeArriba ? velas[iSweep].l : velas[iSweep].h) : rompeArriba ? nivelBajo : nivelAlto
    if (sl === null || sl === undefined) continue

    // ── EL COLCHÓN DEL STOP (v1.1) ─────────────────────────────────────────
    // Néstor lo pidió con este razonamiento, que es bueno: ese punto YA
    // demostró ser alcanzable por el precio —por eso hubo barrido ahí—, así
    // que dejar el stop justo encima invita a que un simple retest lo toque.
    //
    // ⚠️ Pero no es gratis, y conviene tenerlo escrito antes de ver el
    // resultado: separar el stop ensancha el riesgo, así que la MISMA
    // operación ganadora pasa a valer menos veces el riesgo. Cambia las dos
    // cosas a la vez —menos stops tocados y menos premio por cada acierto— y
    // cuál pesa más es justo lo que hay que medir, no suponerlo.
    if (atr) {
      const a = atr[i]
      // Sin ATR no hay colchón que calcular. Se descarta la señal en vez de
      // ponerle un stop a una distancia inventada.
      if (a === null) continue
      sl = rompeArriba ? sl - a * slBufferAtr : sl + a * slBufferAtr
    }

    const riesgo = rompeArriba ? entrada - sl : sl - entrada
    // Un riesgo nulo o negativo significa que el stop quedó del lado
    // equivocado del precio. Pasa, y la operación no existe: se descarta en
    // vez de inventarle una distancia.
    if (!(riesgo > 0)) continue

    fuera.push({
      i,
      lado,
      evento,
      entrada,
      sl,
      tp: rompeArriba ? entrada + riesgo * rr : entrada - riesgo * rr,
      iSweep: exigirSweep ? iSweep : iSweep >= 0 && i - iSweep <= sweepWindow ? iSweep : -1,
      // Si hubo barrido reciente o no. Con `exigirSweep: false` TODAS las
      // señales salen, y esto es lo que permite separarlas después sin volver
      // a correr nada — es el «⚡» del Pine.
      huboSweep: iSweep >= 0 && i - iSweep <= sweepWindow,
      nivel: rompeArriba ? nivelAlto : nivelBajo,
    })
  }

  // ── LA SALIDA POR ESTRUCTURA CONTRARIA (v1.1) ────────────────────────────
  // Para cada señal, en qué vela el mercado rompe estructura EN CONTRA. Es el
  // `structureExit` del Pine, y se calcula aquí porque aquí están todas las
  // rupturas: quien mide no tiene por qué volver a detectarlas.
  //
  // `-1` significa que no llegó a romper en contra dentro de la serie. Quien
  // mida decide qué hacer con eso —dejarla sin juzgar es lo honesto— y NO
  // puede leerse como «no se cerró nunca»: puede ser que la serie se acabó.
  for (const s of fuera) {
    // Para una COMPRA, la contraria es una ruptura hacia ABAJO.
    const contraria = s.lado !== 'COMPRA'
    const r = rupturas.find((x) => x.i > s.i && x.arriba === contraria)
    s.iSalida = r ? r.i : -1
  }

  return fuera
}
