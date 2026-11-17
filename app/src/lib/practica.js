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
export const CAMPOS_OPCIONALES = Object.freeze(['nota', 'riesgoUsd', 'lote', 'fuente', 'spread', 'spreadEl', 'swap', 'swap3', 'marcas'])
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

// ── Lo que cuesta operar de verdad (2026-11-17) ───────────────────────────
// Néstor: «lo del riesgo en dólares en la práctica no quiero que dé cuentas
// hipotéticas… eso contradice nuestra esencia de honestidad. Debe mostrar su
// cuenta con cálculos reales con su descuento».
//
// Así que cada operación guarda, al crearse, el SPREAD y el SWAP de la cuenta
// real del desarrollador (los manda el puente de MT5), y el resultado se
// descuenta con ellos:
//
//   · Si la entrada fue al precio de MT5 (`fuente: 'mt5'`), el spread YA va
//     dentro: se compra al ASK y se vende al BID, y no se resta otra vez.
//   · Si la entrada fue al cierre de Twelve Data, se resta el spread de la
//     última foto de MT5 de ese par, y se dice de qué hora es (`spreadEl`).
//   · El swap se cobra (o se paga) por cada noche que la operación siguió
//     abierta, con el triple el día que dice el bróker (`swap3`).
//
// ⚠️ LO QUE NO SE SABE SE DICE, NO SE INVENTA. Si no hubo foto de MT5 con
// spread, o el puente todavía no manda el swap, la tarjeta dice «sin dato» en
// esa línea y no pone un número de mentira.
//
// Topes para que nadie escriba un número absurdo desde el teléfono; las reglas
// de Firestore exigen los mismos.
export const SPREAD_MAX = 50
export const SWAP_MAX = 50
export const MARCAS_MAX = 40
export const FUENTES = Object.freeze(['mt5', 'twelve'])
// Lo que dura una vela en cada app. Sirve para el reloj de las noches.
export const PERIODO_MS = Object.freeze({ swing: 86_400_000, intradia: 3_600_000 })

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
export function fichaPractica({ app, analisis, metodo, vela, nota, entrada = null, cotizacion = null, fotoEl = null, marcas = null }) {
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

  // De dónde salió el precio de entrada, y lo que cuesta operar.
  op.fuente = entrada && num(entrada.precio) ? 'mt5' : 'twelve'
  const sp = entrada && num(entrada.spread) ? entrada.spread : num(cotizacion?.spread) ? cotizacion.spread : null
  if (num(sp) && sp >= 0 && sp <= SPREAD_MAX) {
    op.spread = Math.round(sp * 100) / 100
    // Con la entrada de Twelve el spread sale de una foto que puede ser vieja:
    // se guarda de cuándo es para decirlo.
    if (op.fuente === 'twelve' && typeof fotoEl === 'string' && fotoEl.length <= 40) op.spreadEl = fotoEl
  }
  const sw = op.lado === 'COMPRA' ? cotizacion?.swapLargo : cotizacion?.swapCorto
  if (num(sw) && Math.abs(sw) <= SWAP_MAX) {
    op.swap = Math.round(sw * 1000) / 1000
    if (Number.isInteger(cotizacion?.swap3) && cotizacion.swap3 >= 0 && cotizacion.swap3 <= 6) op.swap3 = cotizacion.swap3
  }
  const mk = limpiarMarcas(marcas)
  if (mk.length) op.marcas = mk
  return op
}

// ─────────────────────────────────────────────────────────────────────────
// LO QUE LA PERSONA PROGRAMÓ, PARA DIBUJARLO (2026-11-17)
// ─────────────────────────────────────────────────────────────────────────
// Néstor: «si el usuario quiere ver dónde están ubicados su soporte y
// resistencia porque lo programó, que lo pueda ver en esa gráfica, y así con
// todo lo que él programe».
//
// Se guarda una FOTO de las herramientas encendidas en el Analizador en el
// momento de crear la operación: los niveles tal como estaban al entrar. Así la
// gráfica enseña lo que la persona vio para decidir, no lo que dirían hoy.
//
// Cada marca: { k, v, v2?, e? }
//   · k   qué es (ver MARCAS_TIPOS)
//   · v   el precio (en una zona, el borde de arriba)
//   · v2  el borde de abajo, solo en las zonas (FVG)
//   · e   la etiqueta corta que va al lado («EMA 20», «61.8 %», «R1»)

export const MARCAS_TIPOS = Object.freeze(['sop', 'res', 'piv', 'ema', 'sma', 'bb', 'fib', 'fvg'])

/** Las marcas válidas de una lista cualquiera (lo guardado se limpia al leer). */
export function limpiarMarcas(lista) {
  if (!Array.isArray(lista)) return []
  const out = []
  for (const m of lista) {
    if (!m || !MARCAS_TIPOS.includes(m.k) || !num(m.v)) continue
    const x = { k: m.k, v: m.v }
    if (num(m.v2)) x.v2 = m.v2
    if (typeof m.e === 'string' && m.e) x.e = m.e.slice(0, 12)
    out.push(x)
    if (out.length >= MARCAS_MAX) break
  }
  return out
}

/**
 * Las herramientas del Analizador que se DIBUJAN en la gráfica de la práctica.
 * Al guardar una práctica se calculan todas (las que la app tenga), estén o no
 * encendidas en la tarjeta: la gráfica trae un botón por familia para apagar
 * lo que sobre, y una marca que no se guardó no se puede dibujar después.
 */
export const HERRAMIENTAS_GRAFICA = Object.freeze(['niveles', 'pivote', 'tendencia', 'medias', 'bollinger', 'fibonacci', 'fvg'])

/** Las marcas de un análisis del Analizador (las herramientas que traiga calculadas). */
export function marcasDeAnalisis(a) {
  const h = a?.herramientas
  if (!h) return []
  const m = []
  if (h.niveles) {
    m.push({ k: 'sop', v: h.niveles.sop })
    m.push({ k: 'res', v: h.niveles.res })
  }
  if (h.pivote) {
    for (const [e, v] of [['P', h.pivote.p], ['R1', h.pivote.r1], ['S1', h.pivote.s1], ['R2', h.pivote.r2], ['S2', h.pivote.s2]]) m.push({ k: 'piv', v, e })
  }
  if (h.tendencia?.nombres) {
    m.push({ k: 'ema', v: h.tendencia.corta, e: h.tendencia.nombres.corta })
    m.push({ k: 'ema', v: h.tendencia.larga, e: h.tendencia.nombres.larga })
  }
  if (h.medias) {
    for (const x of h.medias.sma ?? []) m.push({ k: 'sma', v: x.v, e: `SMA ${x.p}` })
    for (const x of h.medias.ema ?? []) m.push({ k: 'ema', v: x.v, e: `EMA ${x.p}` })
  }
  if (h.bollinger) {
    m.push({ k: 'bb', v: h.bollinger.arriba, e: 'BB +2σ' })
    m.push({ k: 'bb', v: h.bollinger.media, e: 'BB 20' })
    m.push({ k: 'bb', v: h.bollinger.abajo, e: 'BB −2σ' })
  }
  if (Array.isArray(h.fibonacci?.niveles)) {
    for (const n of h.fibonacci.niveles) m.push({ k: 'fib', v: n.precio, e: `${(n.ratio * 100).toFixed(1)}%` })
  }
  if (Array.isArray(h.fvg?.huecos)) {
    for (const x of h.fvg.huecos) m.push({ k: 'fvg', v: x.arriba, v2: x.abajo, e: 'FVG' })
  }
  // Las EMA de la tendencia y las de «Medias móviles» pueden repetirse: una vez basta.
  const vistas = new Set()
  return limpiarMarcas(m.filter((x) => {
    const clave = `${x.k}|${x.e ?? ''}|${x.v}`
    if (vistas.has(clave)) return false
    vistas.add(clave)
    return true
  }))
}

// ─────────────────────────────────────────────────────────────────────────
// EL RESULTADO CON SUS DESCUENTOS
// ─────────────────────────────────────────────────────────────────────────

/** El tamaño de un pip del par. */
export const pipDePar = (par) => (String(par).includes('JPY') ? 0.01 : 0.0001)

/**
 * Cuántas noches de swap cuenta una operación entre `desdeMs` y `hastaMs`, con
 * el corte del bróker a las 22:00 UTC, de lunes a viernes, y el TRIPLE el día
 * `swap3` (0 = domingo … 6 = sábado, como lo da MT5).
 *
 * ⚠️ Es una aproximación y se dice: cada bróker corta a su hora (21:00 o 22:00
 * UTC según el horario de verano) y el sábado y el domingo no cobra porque ya
 * cobró el triple entre semana.
 */
export function nochesDeSwap(desdeMs, hastaMs, swap3 = 3) {
  if (!num(desdeMs) || !num(hastaMs) || hastaMs <= desdeMs) return 0
  let n = 0
  const d = new Date(desdeMs)
  d.setUTCHours(22, 0, 0, 0)
  if (d.getTime() <= desdeMs) d.setUTCDate(d.getUTCDate() + 1)
  // Tope de un año para no dar vueltas sin fin con datos raros.
  for (let i = 0; i < 400 && d.getTime() <= hastaMs; i++) {
    const dia = d.getUTCDay()
    if (dia >= 1 && dia <= 5) n += dia === swap3 ? 3 : 1
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return n
}

/**
 * El resultado de una operación resuelta con lo que de verdad cuesta operar.
 *
 * Devuelve `null` si no está ganada ni perdida. Si no:
 *   { rBruto, spreadR, spreadIncluido, sinSpread, swapR, sinSwap, noches,
 *     rNeto, usdNeto }
 *
 *   · `spreadR` lo que se lleva el spread, en unidades de riesgo (0 si ya iba
 *     dentro de la entrada de MT5; `null` si no se sabe).
 *   · `swapR`   lo que se cobra (−) o se gana (+) por las noches; `null` si no
 *     se sabe.
 *   · `rNeto`   el resultado menos lo que SÍ se sabe. Si falta un dato, la
 *     tarjeta lo dice al lado (`sinSpread` / `sinSwap`).
 *   · `usdNeto` `rNeto` × lo que se iba a arriesgar; `null` sin riesgo guardado.
 */
export function costesPractica(op) {
  if (!op || (op.estado !== 'ganada' && op.estado !== 'perdida') || !num(op.r)) return null
  const pip = pipDePar(op.par)
  const riesgoPips = num(op.entrada) && num(op.sl) ? Math.abs(op.entrada - op.sl) / pip : null
  if (!num(riesgoPips) || riesgoPips <= 0) return null

  const spreadIncluido = op.fuente === 'mt5'
  let spreadR = null
  if (spreadIncluido) spreadR = 0
  else if (num(op.spread)) spreadR = op.spread / riesgoPips

  let swapR = null
  let noches = null
  const periodo = PERIODO_MS[op.app]
  const desde = msDe(op.creado)
  const velaFin = msDeVela(op.velaResuelta)
  if (num(op.swap) && num(desde) && num(velaFin) && num(periodo)) {
    // Hasta el FINAL de la vela en que se tocó el nivel: no se sabe en qué
    // momento de ella pasó, y se cuenta la noche si la vela la cruzaba.
    noches = nochesDeSwap(desde, velaFin + periodo, Number.isInteger(op.swap3) ? op.swap3 : 3)
    swapR = (op.swap * noches) / riesgoPips
  }

  const rNeto = op.r - (spreadR ?? 0) + (swapR ?? 0)
  return {
    rBruto: op.r,
    spreadR,
    spreadIncluido,
    sinSpread: spreadR === null,
    swapR,
    sinSwap: swapR === null,
    noches,
    rNeto,
    usdNeto: num(op.riesgoUsd) && op.riesgoUsd > 0 ? rNeto * op.riesgoUsd : null,
  }
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
    // ⚠️ Con la entrada de MT5 el precio es el del BRÓKER (el ASK o el BID) y las
    // velas son de Twelve Data: dos fuentes no dan el mismo número al pip. Se
    // deja de margen el spread y 3 pips; con eso un precio de otra hora sigue
    // sin pasar, que es para lo que existe esta comprobación.
    const tol =
      op.fuente === 'mt5' ? ((num(op.spread) ? op.spread : 0) + 3) * pipDePar(op.par) : Math.abs(op.entrada) * 1e-6
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
 * ⚠️ El resultado va en UNIDADES DE RIESGO («R»): ganar 2 R es ganar el doble
 * de lo que se arriesgaba. `sumaR` es el bruto (lo que dicen los niveles) y
 * `sumaNeta` el que descuenta el spread y el swap; los dólares salen del neto.
 */
export function resumenPractica(ops) {
  const lista = Array.isArray(ops) ? ops : []
  const resueltas = lista.filter((o) => o?.estado === 'ganada' || o?.estado === 'perdida')
  const ganadas = resueltas.filter((o) => o.estado === 'ganada').length
  const sumaR = resueltas.reduce((s, o) => s + (num(o.r) ? o.r : 0), 0)
  // ⚠️ El resultado NETO: con el spread y el swap de la cuenta real del
  // desarrollador descontados (ver `costesPractica`). Lo que no se sabe no se
  // inventa: se cuenta cuántas quedaron sin ese dato para decirlo en pantalla.
  const costes = resueltas.map(costesPractica)
  const sumaNeta = costes.reduce((s, c) => s + (c ? c.rNeto : 0), 0)
  const conDinero = costes.filter((c) => c && num(c.usdNeto))
  const dinero = conDinero.reduce((s, c) => s + c.usdNeto, 0)
  return {
    conDinero: conDinero.length,
    dinero: conDinero.length ? dinero : null,
    sumaNeta: resueltas.length ? sumaNeta : null,
    porOperacionNeta: resueltas.length ? sumaNeta / resueltas.length : null,
    sinSpread: costes.filter((c) => c?.sinSpread).length,
    sinSwap: costes.filter((c) => c?.sinSwap).length,
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
  const { serie20: cierres, altos20: altos, bajos20: bajos, abiertos20 } = p
  const ok = (xs) => Array.isArray(xs) && xs.length === n && xs.every(num)
  if (!ok(cierres) || !ok(altos) || !ok(bajos)) return null
  return {
    fechas,
    cierres,
    altos,
    bajos,
    // Las aperturas, para dibujar velas de verdad. ⚠️ Solo si el barrido las
    // publica: sin ellas se dibujan barras de máximo-mínimo y NO se inventa la
    // apertura (ver la cabecera de `SetupDetalle.jsx`).
    abiertos: ok(abiertos20) ? abiertos20 : null,
    marcas: limpiarMarcas(op?.marcas),
    iEntrada: fechas.indexOf(op.vela),
    iResuelta: typeof op.velaResuelta === 'string' ? fechas.indexOf(op.velaResuelta) : -1,
  }
}
