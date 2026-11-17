// EL MODO PRÁCTICA (2026-11-16) — el punto 5 del plan de herramientas nuevas.
//
// Una operación de práctica es una operación que NO se hace con dinero: la
// persona la arma en el Analizador (par, dirección, Stop-loss y Take-profit),
// pulsa «Practicar esta operación», y la app la sigue sola con los precios
// reales hasta que toca el Stop-loss o el Take-profit. Sirve para probar una
// forma de operar sin arriesgar nada, y para ver con el tiempo si esa forma
// funciona.
//
// Este archivo tiene las cuentas, sin Firebase ni React: qué es una operación
// de práctica válida y cómo se decide si ganó o perdió. Lo usan la app (para
// enseñarlas) y el programa que las resuelve (`scripts/resolver-practica.mjs`,
// que vive en Swing y corre cada 15 minutos para las dos apps).
//
// ⚠️⚠️ EL RESULTADO LO PONE EL PROGRAMA, NUNCA LA PERSONA. Las reglas de
// Firestore no dejan que el teléfono escriba el resultado, ni que borre una
// operación ya resuelta. Si se pudiera, cualquiera borraría las perdidas y el
// número no diría nada.
//
// ⚠️ LAS MISMAS DECISIONES QUE EL HISTORIAL DE SEÑALES (`resolver.mjs`), para
// que las dos cosas se midan igual:
//   - La vela en la que se entra NO cuenta: se juzga desde la siguiente. El
//     precio de entrada es el del barrido, y no se sabe qué pasó antes de él
//     dentro de esa misma vela.
//   - Si una misma vela toca el Stop-loss y el Take-profit, cuenta como
//     PERDIDA. La vela solo guarda el máximo y el mínimo, no el orden, y se
//     elige el peor caso a propósito: una cuenta que se equivoca a favor de uno
//     mismo no sirve para decidir.
//   - Si el programa no pudo mirar a tiempo y las velas que hacían falta ya no
//     están en el barrido (solo trae las últimas 20), la operación queda
//     CADUCADA en vez de inventar el resultado.

export const LADOS_PRACTICA = Object.freeze(['COMPRA', 'VENTA'])

// Cuántas abiertas a la vez. No es una regla de trading: es para que la lista
// se pueda leer y el programa que las resuelve no tenga que mirar cientos.
export const MAX_ABIERTAS = 20

// Lo que guarda una operación de práctica al crearse. Las reglas de Firestore
// exigen exactamente estos campos (y la nota, que es opcional): si se cambia
// esta lista hay que cambiar también `firestore.rules`, y `prueba-practica.mjs`
// falla si se separan.
export const CAMPOS_CREAR = Object.freeze(['app', 'par', 'lado', 'entrada', 'sl', 'tp', 'vela', 'metodo', 'creado'])
export const CAMPOS_OPCIONALES = Object.freeze(['nota', 'riesgoUsd', 'lote'])
export const NOTA_MAX = 300

// El riesgo en dólares y el lote los saca el Analizador del «perfil de riesgo»
// de la persona (la misma cuenta que la calculadora). Son opcionales: sin
// perfil no hay lote, y la operación se sigue igual, solo que en «R».
// Lo pidió la conversación con la otra IA que Néstor aprobó entera (2026-11-16):
// «la app le muestra el riesgo en dólares (usando su calculadora)».
// Un tope para que nadie escriba un número absurdo desde el teléfono; las reglas
// de Firestore exigen el mismo.
export const RIESGO_USD_MAX = 1_000_000
export const LOTE_MAX = 1000

// Los estados que escribe el programa. Una operación abierta NO lleva `estado`:
// así una ficha recién creada no puede traer un resultado escrito a mano.
export const ESTADOS = Object.freeze(['ganada', 'perdida', 'caducada', 'invalida'])

const num = (x) => typeof x === 'number' && Number.isFinite(x)

/** ¿Los niveles tienen sentido para ese lado? (SL por un lado, TP por el otro.) */
export function nivelesCoherentes(lado, entrada, sl, tp) {
  if (!LADOS_PRACTICA.includes(lado) || ![entrada, sl, tp].every(num)) return false
  return lado === 'COMPRA' ? sl < entrada && entrada < tp : tp < entrada && entrada < sl
}

/**
 * La ficha que se guarda en Firestore, desde el análisis del Analizador.
 * Devuelve `null` si el análisis no da una operación válida: sin niveles no se
 * practica nada.
 *
 * `creado` NO va aquí: lo pone quien guarda, con la hora del servidor (las
 * reglas exigen que sea esa y no la del teléfono, para que nadie la adelante).
 */
export function fichaPractica({ app, analisis, metodo, vela, nota }) {
  const a = analisis
  if (!a?.par || !a?.niveles || !vela) return null
  const op = {
    app,
    par: a.par,
    lado: a.lado,
    entrada: a.precio,
    sl: a.niveles.sl,
    tp: a.niveles.tp,
    vela: String(vela),
    metodo: String(metodo || 'app'),
  }
  if (!nivelesCoherentes(op.lado, op.entrada, op.sl, op.tp)) return null
  const n = typeof nota === 'string' ? nota.trim().slice(0, NOTA_MAX) : ''
  if (n) op.nota = n
  const riesgoUsd = a.lote?.riesgoUsd
  const lote = a.lote?.lote
  if (num(riesgoUsd) && riesgoUsd > 0 && riesgoUsd <= RIESGO_USD_MAX) op.riesgoUsd = Math.round(riesgoUsd * 100) / 100
  if (num(lote) && lote > 0 && lote <= LOTE_MAX) op.lote = Math.round(lote * 100) / 100
  return op
}

/** Cuántas unidades de riesgo vale ganar: la distancia al TP sobre la del SL. */
export function rbDe(op) {
  if (!nivelesCoherentes(op?.lado, op?.entrada, op?.sl, op?.tp)) return null
  return Math.abs(op.tp - op.entrada) / Math.abs(op.entrada - op.sl)
}

/**
 * El momento de una vela, en milisegundos. Swing manda el día (`2026-11-16`) e
 * Intradía la hora (`2026-11-16 14:00:00`), las dos en UTC.
 * ⚠️ Sin la `Z` del final, `Date.parse` leería la hora como LOCAL del aparato,
 * cinco horas corridas en Colombia.
 */
export function msDeVela(v) {
  if (typeof v !== 'string' || !v) return null
  const iso = v.length === 10 ? `${v}T00:00:00Z` : /[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v.replace(' ', 'T') : `${v.replace(' ', 'T')}Z`
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

function msDe(x) {
  if (num(x)) return x
  if (typeof x === 'string') {
    const ms = Date.parse(x)
    return Number.isFinite(ms) ? ms : null
  }
  if (x && typeof x.toMillis === 'function') return x.toMillis()
  if (x && num(x.seconds)) return x.seconds * 1000
  return null
}

/**
 * Decide qué le pasó a una operación de práctica abierta.
 *
 * @param op     la ficha guardada (con `creado` y, si ya se miró antes,
 *               `revisadoHasta`: la última vela CERRADA que se revisó)
 * @param velas  { fechas, altos, bajos } del barrido de esa app: las últimas
 *               velas del par, en orden. La ÚLTIMA va a medias.
 * @param periodoMs  lo que dura una vela en esa app (un día en Swing, una hora
 *               en Intradía). Solo se usa para no aceptar una entrada con un
 *               precio viejo.
 *
 * Devuelve uno de estos:
 *   { cambio: false }                         nada que escribir
 *   { cambio: true, revisadoHasta }            sigue abierta; se avanzó lo mirado
 *   { cambio: true, estado: 'ganada'|'perdida', vela, r }
 *   { cambio: true, estado: 'caducada' }       faltan velas que ya no se ven
 *   { cambio: true, estado: 'invalida', motivo }
 */
export function resolverPractica(op, velas, { periodoMs } = {}) {
  if (!op || op.estado) return { cambio: false }
  if (!nivelesCoherentes(op.lado, op.entrada, op.sl, op.tp)) return { cambio: true, estado: 'invalida', motivo: 'niveles' }

  const fechas = velas?.fechas
  const altos = velas?.altos
  const bajos = velas?.bajos
  // Sin velas no se decide nada: puede ser que el barrido todavía no las
  // publique. Esperar no cuesta; inventar sí.
  if (!Array.isArray(fechas) || !fechas.length || altos?.length !== fechas.length || bajos?.length !== fechas.length) {
    return { cambio: false }
  }

  // ⚠️ La vela de entrada tiene que ser reciente respecto a cuándo se creó la
  // operación (hora del servidor). Si no, alguien podría practicar con el
  // precio de hace una semana, sabiendo ya lo que pasó después.
  const creadoMs = msDe(op.creado)
  const velaMs = msDeVela(op.vela)
  if (num(periodoMs) && creadoMs !== null && velaMs !== null) {
    if (velaMs < creadoMs - 4 * periodoMs || velaMs > creadoMs + periodoMs) {
      return { cambio: true, estado: 'invalida', motivo: 'velaVieja' }
    }
  }

  // La vela de entrada, si todavía se ve: el precio tiene que haber estado
  // dentro de ella (con un pelo de tolerancia por el redondeo de pantalla).
  const iEntrada = fechas.indexOf(op.vela)
  if (iEntrada >= 0) {
    const tol = Math.abs(op.entrada) * 1e-6
    if (op.entrada > altos[iEntrada] + tol || op.entrada < bajos[iEntrada] - tol) {
      return { cambio: true, estado: 'invalida', motivo: 'fueraDeVela' }
    }
  }

  // Desde dónde hay que mirar. ⚠️ Tiene que verse esa misma vela en el barrido:
  // si ya salió de la ventana no se puede saber si las que vinieron justo
  // después también se perdieron.
  const marca = typeof op.revisadoHasta === 'string' && op.revisadoHasta > op.vela ? op.revisadoHasta : op.vela
  const iMarca = fechas.indexOf(marca)
  if (iMarca < 0) {
    // La marca todavía no ha llegado (el barrido va atrasado): esperar.
    if (marca > fechas[fechas.length - 1]) return { cambio: false }
    return { cambio: true, estado: 'caducada' }
  }

  const compra = op.lado === 'COMPRA'
  const ultima = fechas.length - 1
  for (let j = iMarca + 1; j <= ultima; j++) {
    // ⚠️ Solo cuentan las velas que EMPIEZAN después de crear la operación. El
    // precio de entrada puede tener hasta una vela de antigüedad (en Intradía
    // es el cierre de la última hora cerrada), y sin esto alguien podría ver
    // que la hora en curso ya llegó a un nivel y «practicar» con el precio de
    // antes.
    const inicio = msDeVela(fechas[j])
    if (creadoMs !== null && inicio !== null && inicio < creadoMs) continue
    const tocaSL = compra ? bajos[j] <= op.sl : altos[j] >= op.sl
    const tocaTP = compra ? altos[j] >= op.tp : bajos[j] <= op.tp
    if (tocaSL) return { cambio: true, estado: 'perdida', vela: fechas[j], r: -1 }
    if (tocaTP) return { cambio: true, estado: 'ganada', vela: fechas[j], r: rbDe(op) }
  }

  // Sigue abierta. La última vela va a medias: no se da por revisada.
  const nueva = ultima - 1 > iMarca ? fechas[ultima - 1] : null
  return nueva ? { cambio: true, revisadoHasta: nueva } : { cambio: false }
}

/** Las velas de un par, sacadas del barrido publicado de su app. */
export function velasDelPar(barrido, par) {
  const p = barrido?.pares?.find((x) => x.name === par)
  if (!p || !Array.isArray(barrido?.fechas20)) return null
  return { fechas: barrido.fechas20, altos: p.altos20, bajos: p.bajos20 }
}

/**
 * Los números de las resueltas, para la tarjeta. Solo cuentan ganadas y
 * perdidas: una caducada o una inválida no dice nada de cómo se opera.
 *
 * ⚠️ El resultado va en UNIDADES DE RIESGO («R»), no en dinero: la práctica no
 * tiene lote. Ganar 2 R es ganar el doble de lo que se arriesgaba.
 */
export function resumenPractica(ops) {
  const lista = Array.isArray(ops) ? ops : []
  const resueltas = lista.filter((o) => o?.estado === 'ganada' || o?.estado === 'perdida')
  const ganadas = resueltas.filter((o) => o.estado === 'ganada').length
  const sumaR = resueltas.reduce((s, o) => s + (num(o.r) ? o.r : 0), 0)
  // ⚠️ Los dólares son HIPOTÉTICOS y solo cuentan las que guardaron su riesgo:
  // R × lo que se iba a arriesgar. No descuentan spread ni swap.
  const conDinero = resueltas.filter((o) => num(o.r) && num(o.riesgoUsd) && o.riesgoUsd > 0)
  const dinero = conDinero.reduce((s, o) => s + o.r * o.riesgoUsd, 0)
  return {
    conDinero: conDinero.length,
    dinero: conDinero.length ? dinero : null,
    abiertas: lista.filter((o) => o && !o.estado).length,
    resueltas: resueltas.length,
    ganadas,
    perdidas: resueltas.length - ganadas,
    otras: lista.filter((o) => o?.estado === 'caducada' || o?.estado === 'invalida').length,
    acierto: resueltas.length ? (ganadas / resueltas.length) * 100 : null,
    sumaR: resueltas.length ? sumaR : null,
    porOperacion: resueltas.length ? sumaR / resueltas.length : null,
  }
}

/**
 * Lo que hace falta para dibujar una operación de práctica sobre el gráfico:
 * las últimas velas del par (máximo, mínimo y cierre) y en qué vela se entró y
 * se resolvió, si todavía se ven.
 *
 * ⚠️ El gráfico usa las MISMAS velas con las que el programa decide (las 20
 * del barrido publicado). Si dibujara otras, la gráfica podría enseñar el
 * precio tocando el Stop-loss en una vela que el programa no vio.
 *
 * Devuelve `null` si el barrido no trae las velas con fecha o el par no está.
 * `iEntrada` / `iResuelta` son -1 si esa vela ya salió de las 20 que se ven.
 */
export function graficoDePractica(op, barrido) {
  const p = barrido?.pares?.find((x) => x.name === op?.par)
  const fechas = barrido?.fechas20
  if (!p || !Array.isArray(fechas) || !fechas.length) return null
  const n = fechas.length
  const { serie20: cierres, altos20: altos, bajos20: bajos } = p
  const ok = (xs) => Array.isArray(xs) && xs.length === n && xs.every(num)
  if (!ok(cierres) || !ok(altos) || !ok(bajos)) return null
  return {
    fechas,
    cierres,
    altos,
    bajos,
    iEntrada: fechas.indexOf(op.vela),
    iResuelta: typeof op.velaResuelta === 'string' ? fechas.indexOf(op.velaResuelta) : -1,
  }
}
