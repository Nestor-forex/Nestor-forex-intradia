// EL LISTÓN DE LA «ESTRATEGIA FASE 1», ESCRITO ANTES DE MEDIRLA.
//
// Fecha de redacción: 2026-10-07. La primera corrida de `medir-fase1.mjs` es
// posterior a este archivo y el historial de commits lo demuestra.
//
// ─────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE ESTO
// ─────────────────────────────────────────────────────────────────────────
// Néstor pidió el 2026-10-07 parametrizar su forma de operar en reglas fijas y
// después medirlas. La especificación que salió fue ésta:
//
//   · H1 para decidir, H4 de contexto
//   · solo abrir entre las 8:00 y las 12:00 de Nueva York
//   · EMA9 > EMA21 (compra) / al revés (venta)
//   · entrada por RETROCESO: el precio vuelve a la EMA9 y cierra a favor
//   · rechazar si RSI(14) ≥ 70 en compras o ≤ 30 en ventas
//   · stop 1,5 × ATR(14), objetivo 1 × el riesgo
//
// ⚠️⚠️ Y AL IR A CONSTRUIRLO APARECIÓ QUE **LA ENTRADA YA EXISTE Y YA CORRE**.
//
// `clasificarRetroceso` en `src/lib/marketCalc.js` es, línea por línea, los
// puntos 3, 4 y 5 de esa lista: medias ordenadas, precio devuelto a la EMA9,
// sin romper la EMA21, con la fuerza relativa acompañando. Lleva anotándose en
// la sombra desde semanas antes de que se escribiera la especificación, y el
// 2026-09-16 iba **9 operaciones reales, 5 ganadas, +74 pips**.
//
// 📌 Es la quinta vez en este proyecto que se diseña algo que ya estaba
// construido (el puente de MT5, el botón de borrar, la calculadora de
// riesgo…). La regla de siempre: **buscarlo en el repositorio ANTES de
// diseñarlo.** Aquí al menos se encontró antes de escribir código duplicado.
//
// Así que esto NO mide «una estrategia nueva»: mide **las tres cosas que la
// especificación añade** encima de una regla que ya existe. Eso es más honesto
// y mucho más barato — y además es lo único que todavía no tiene número.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ EL ORO NO ENTRA, Y EL MOTIVO ES ESTRUCTURAL, NO DE PRESUPUESTO
// ─────────────────────────────────────────────────────────────────────────
// Néstor puso XAU/USD primero en la lista. **No se puede medir con esta regla**,
// y no es porque falte un crédito de Twelve Data:
//
// La regla decide por `p.dif`, que es **la diferencia de fuerza relativa entre
// las dos divisas del par**. Esa fuerza se calcula sobre las OCHO divisas del
// barrido (USD, EUR, GBP, JPY, CHF, AUD, NZD, CAD). **El oro no es una divisa
// de ese conjunto**, así que `dif` no existe para XAU/USD: no hay «fuerza del
// oro» que restar.
//
// O sea que aplicar la Fase 1 al oro **no es añadir un símbolo**: es inventar
// una medida de fuerza nueva para un activo que no participa en el sistema de
// fuerzas. Eso es un diseño aparte, con su propia medición, y decirlo así es
// más útil que medir el oro con media regla y entregar un número.
//
// 📌 Lo que el oro SÍ tiene hoy es su tarjeta de correlación en Swing, que
// existe justo porque el precio solo no dice nada (2026-09-29).
//
// ─────────────────────────────────────────────────────────────────────────
// LO QUE SE MIDE, ENTONCES
// ─────────────────────────────────────────────────────────────────────────
// Cuatro filas sobre las MISMAS velas y los MISMOS días, más el control:
//
//   0. CONTROL: la app tal cual (lo que Néstor ve hoy)
//   1. el retroceso, tal como corre en la sombra
//   2. + solo en la ventana de Nueva York          ← añade la especificación
//   3. + rechazar RSI extendido                    ← añade la especificación
//   4. las dos cosas = LA FASE 1 COMPLETA
//
// ⚠️ La ventana se mide con `enSolape` (12-16 UTC), que YA existe en
// `backtest.mjs` y es 7-11 de Nueva York en invierno y 8-12 en verano. No se
// escribe una ventana nueva: usar la que ya está medida es lo que permite
// comparar con la fila R4 del 2026-09-05.
//
// ⚠️ **EL H4 DE CONTEXTO NO SE MIDE AQUÍ, y queda dicho por qué.** La
// confluencia de marcos temporales se midió de frente en Swing el 2026-09-04 y
// EMPEORÓ en las tres exigencias, con el dato que lo explica: el marco largo
// coincide con el corto en el 78 % de los casos, así que exigir que coincidan
// no exige nada. Volver a medirlo aquí sin un argumento nuevo sería gastar
// créditos en una casilla que ya tiene respuesta en la app hermana. Si se
// quiere igual, va con su propio listón y diciendo qué cambió.

export const FECHA_REDACCION = '2026-10-07'

// La ventana de Nueva York, en horas UTC. Es la de `backtest.mjs`.
export const VENTANA_NY = { desde: 12, hasta: 16 }

// Cuánto tiene que mejorar la Fase 1 sobre el retroceso a secas para que
// merezca la pena añadirle condiciones. Mismo umbral que el resto del
// proyecto: por debajo de 0,02 no se distingue de un reparto afortunado.
export const MEJORA_MINIMA = 0.02

// Y cuántas señales al mes tiene que dejar. Una regla que solo habla cuatro
// veces al mes no es una herramienta, y además su número tarda años en
// significar algo: con 150 operaciones hacen falta ~3 años a 4/mes.
export const SENALES_MES_MINIMAS = 8

// Ningún par puede aportar más de esta fracción del resultado.
export const CONCENTRACION_MAXIMA = 0.4

// ─────────────────────────────────────────────────────────────────────────
// ⚠️ SI UN RESULTADO QUEDA A UN PELO, LA RESPUESTA NO ES AFLOJAR UN CRITERIO.
// Ya pasó con el derrumbe del lunes (1,28× contra 1,50 pedido) y con «comprar
// la caída» al perder el criterio del swap. El listón se escribe antes
// exactamente para este momento.
// ─────────────────────────────────────────────────────────────────────────

// `r` = { app, retroceso, ventana, rsi, fase1 }, cada uno con
// { porRiesgo, porRiesgo1aMitad, porRiesgo2aMitad, ops, senalesMes,
//   porRiesgoConSwap } y `concentracion` en la Fase 1.
export function juzgar(r) {
  const fallos = []
  const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null)

  const f = r?.fase1
  const base = r?.retroceso
  if (!f || !base) {
    return { pasa: false, fallos: ['faltan filas que comparar'], mejoraSobreApp: null }
  }

  // 1. Gana dinero con la vara neutra y con costes. Es el criterio de fondo:
  //    todo lo demás es irrelevante si pierde.
  const pr = num(f.porRiesgo)
  if (pr === null || pr <= 0) {
    fallos.push(`no gana con costes (${pr === null ? 'n/d' : pr.toFixed(3)})`)
  }

  // 2. Gana en las DOS mitades. El criterio que tumbó al COT y a la ruptura de
  //    estructura, y el único que distingue una ventaja de un periodo bueno.
  const m1 = num(f.porRiesgo1aMitad)
  const m2 = num(f.porRiesgo2aMitad)
  if (m1 === null || m2 === null) {
    fallos.push('faltan las mitades: sin ellas no se puede juzgar')
  } else if (!(m1 > 0 && m2 > 0)) {
    fallos.push(`no gana en las dos mitades (${m1.toFixed(3)} · ${m2.toFixed(3)})`)
  }

  // 3. ⚠️ LAS CONDICIONES AÑADIDAS TIENEN QUE APORTAR ALGO. Si la Fase 1 mide
  //    igual que el retroceso a secas, lo honesto es quedarse con el retroceso:
  //    menos condiciones, más señales y el mismo número. Es el criterio que
  //    evita añadir ceremonia que no cambia nada — el mismo razonamiento que
  //    cerró el ADX de Intradía (entre 0 y 10 había SEIS señales de diferencia
  //    en cinco años).
  const mejora = pr === null || num(base.porRiesgo) === null ? null : pr - base.porRiesgo
  if (mejora === null || mejora < MEJORA_MINIMA) {
    fallos.push(
      `la ventana y el RSI aportan ${mejora === null ? 'n/d' : mejora.toFixed(3)} sobre el retroceso ` +
        `a secas, y hace falta ${MEJORA_MINIMA}`
    )
  }

  // 4. Deja señales suficientes para que el número llegue a significar algo.
  const sm = num(f.senalesMes)
  if (sm === null || sm < SENALES_MES_MINIMAS) {
    fallos.push(`deja ${sm === null ? 'n/d' : sm.toFixed(1)} señales/mes y hacen falta ${SENALES_MES_MINIMAS}`)
  }

  // 5. Aguanta el swap. El 52 % de las operaciones reales de esta app cruzan al
  //    menos una noche (medido el 2026-09-02), así que no es un detalle.
  const cs = num(f.porRiesgoConSwap)
  if (cs === null || cs <= 0) {
    fallos.push(`pagando swap queda en ${cs === null ? 'n/d' : cs.toFixed(3)}`)
  }

  // 6. No lo aporta un solo par.
  const c = num(r.concentracion)
  if (c === null) {
    fallos.push('no se pudo medir la concentración por par')
  } else if (c > CONCENTRACION_MAXIMA) {
    fallos.push(`un par aporta el ${(100 * c).toFixed(0)} % (máximo ${100 * CONCENTRACION_MAXIMA} %)`)
  }

  const app = num(r.app?.porRiesgo)
  return {
    pasa: fallos.length === 0,
    fallos,
    mejoraSobreApp: pr === null || app === null ? null : pr - app,
  }
}
