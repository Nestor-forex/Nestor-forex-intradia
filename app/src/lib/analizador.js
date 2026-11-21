// EL ANALIZADOR: el suscriptor elige un par, una dirección y las herramientas
// que quiere ver, y la app le arma UNA tarjeta con la entrada, el stop, el
// objetivo, el pivote, el soporte, la resistencia y el lote ya calculado con su
// perfil de riesgo.
//
// Néstor lo pidió el 2026-11-12 como fase 3 del plan, con estas palabras sobre
// lo que tiene que hacer: «convierte quince herramientas sueltas en una
// respuesta». Es tiempo ahorrado, no una predicción.
//
// ⚠️⚠️ NO ELIGE LA DIRECCIÓN. La elige la persona. Si la eligiera la app sería
// otra señal sin validar, y las que tiene siguen en pruebas: van diez familias
// de filtros medidas y diez que no aportan nada. Aquí la app pone la ARITMÉTICA
// (dónde quedan el stop, el objetivo y el lote para la dirección elegida) y la
// información (qué dicen sus herramientas), nunca la opinión.
//
// ⚠️⚠️ NO HAY NINGÚN NÚMERO NUEVO. Los niveles salen de las mismas cuentas que
// la app ya hace y ya están probadas: la geometría de las señales de cada app,
// la vara simétrica de las reglas en pruebas y los soportes y resistencias del
// barrido. El lote sale de `calcularLote`, el mismo de la calculadora.
//
// ⚠️ DEVUELVE DATOS, NO TEXTO. `armarAnalisis` da un objeto plano que se puede
// pasar por JSON. Es a propósito y viene pedido: Néstor quiere que en la fase 5
// el suscriptor pueda hacer el análisis CON QWEN, y Qwen va a recibir
// exactamente este objeto como «las herramientas de la app». Los números los
// sigue poniendo la app; si los pusiera la IA serían inventados.
//
// ⚠️ AQUÍ NO HAY NI UNA LÍNEA DE REACT NI DE FIREBASE: todo se comprueba sin
// red en `prueba-analizador.mjs`. Lo que cada app sabe de sí misma (qué medias
// usa, de dónde sale su pivote, cuál es su geometría) llega ya resuelto en la
// «ficha» que arma su `marketCalc.js`. Por eso este archivo puede ser GEMELO.

import { calcularLote } from './calc.js'
import { proximos } from './calendario.js'
import { carryDeSenal } from './carrySenal.js'
import { resumir } from './diagnostico.js'

/**
 * Las herramientas que se pueden encender, en el orden en que se pintan.
 *
 * ⚠️ La lista va ESCRITA A MANO. Una herramienta nueva hay que añadirla aquí,
 * a la tarjeta y a los 13 idiomas; `prueba-analizador.mjs` falla si alguna
 * queda sin texto.
 *
 * Una herramienta que la app no puede calcular para ese par (el pivote sin
 * extremos, Bollinger en la app que no lo tiene) no se inventa: sale `null` y
 * la tarjeta dice que no hay dato.
 */
export const HERRAMIENTAS = Object.freeze([
  'niveles', // soporte y resistencia
  'pivote',
  'tendencia',
  'rsi',
  'atr',
  'fuerza',
  'compresion',
  'bollinger',
  'calendario',
  'swap',
  // Las seis que se añadieron el 2026-11-15, a petición de Néstor: «que la
  // tarjeta junte TODAS mis herramientas». Cada una lee un dato que la app YA
  // publica; ninguna calcula un número nuevo ni elige la dirección.
  'spread', // lo que cuesta abrir y la actividad (puente de MT5)
  'cot', // posiciones de los fondos (solo Swing)
  'oro', // el oro y su correlación con el par (solo Swing)
  'correlacion', // pares que se mueven casi igual (solo Swing)
  'estacionalidad', // recorrido típico de hoy y de este mes, y la dirección por mes
  'diario', // las operaciones de la persona en este par
  // El FVG (2026-11-15), a petición de Néstor. Enseña DÓNDE están los huecos
  // que el precio dejó y si siguen vivos; no dice hacia dónde ir. Su medición
  // está en `scripts/medir-fvg.mjs`, con su listón escrito antes.
  'fvg',
  // Las medias móviles simples y exponenciales (2026-11-15). Los periodos los
  // pone cada app: días en Swing, horas en Intradía.
  'medias',
  // Fibonacci (2026-11-15): los niveles del último movimiento de 20 velas.
  'fibonacci',
])

/**
 * Las herramientas que ESTA app puede ofrecer ahora mismo.
 *
 * ⚠️ Se decide por el DATO, no por el nombre de la app: así este archivo sigue
 * siendo GEMELO. La app de intradía no publica COT, oro ni correlación, y por
 * eso esos botones no le salen — ofrecerlos para que digan siempre «Sin dato»
 * sería prometer algo que no hay.
 *
 * El spread y el diario se ofrecen siempre: si el puente de MT5 está apagado o
 * la persona no ha operado ese par, la tarjeta lo DICE, que también es
 * información.
 */
export function herramientasDisponibles({ fichas = [], cot = null, oro = null, correlaciones, estacionalidad = null } = {}) {
  return HERRAMIENTAS.filter((x) => {
    if (x === 'bollinger') return fichas.some((f) => bollingerDe(f) !== null)
    if (x === 'fibonacci') return fichas.some((f) => f?.fib && typeof f.fib === 'object')
    if (x === 'medias') return fichas.some((f) => Array.isArray(f?.medias?.sma) || Array.isArray(f?.medias?.ema))
    if (x === 'cot') return !!cot?.divisas
    if (x === 'oro') return !!oro?.correl
    if (x === 'correlacion') return Array.isArray(correlaciones)
    if (x === 'estacionalidad') return !!estacionalidad?.pares
    // Hace falta que el barrido publique los extremos de las últimas velas.
    if (x === 'fvg') return fichas.some((f) => Array.isArray(f?.fvg))
    return true
  })
}

/**
 * Cómo se colocan el stop y el objetivo.
 *
 *   · `app`        — la geometría de las señales de ESTA app (en cada app es
 *                    distinta, y está medida por separado);
 *   · `simetrica`  — 1,5 ATR a cada lado: la «vara neutra» con la que se miden
 *                    las reglas en pruebas;
 *   · `estructura` — stop medio ATR por fuera del soporte (o la resistencia) y
 *                    objetivo en el otro extremo del rango de 20 velas.
 */
export const METODOS = Object.freeze(['app', 'simetrica', 'estructura'])

export const LADOS = Object.freeze(['COMPRA', 'VENTA'])

/** Lo que sale encendido la primera vez, antes de que la persona elija. */
export const HERRAMIENTAS_INICIALES = Object.freeze(['niveles', 'pivote', 'tendencia', 'rsi', 'atr', 'fuerza', 'calendario'])

export const MAX_PLANTILLAS = 10
export const MAX_NOMBRE = 30

/**
 * Por debajo de esta relación el objetivo queda MÁS CERCA que el stop: se
 * arriesga más de lo que se busca ganar. No es el 1:1,5 de los avisos al
 * celular, que es un filtro de señales de la app; aquí solo se le dice a la
 * persona lo que su propio nivel implica.
 */
export const RR_AVISO = 1

/** El tamaño de un pip: 0,01 en los pares con yen (2 decimales), 0,0001 en el resto. */
export function tamanoPip(dec) {
  return dec === 2 ? 0.01 : 0.0001
}

const num = (x) => typeof x === 'number' && Number.isFinite(x)

/**
 * Pivote clásico a partir de una vela (máximo, mínimo, cierre).
 *
 * Es la fórmula que la app de intradía ya usaba para sus pivotes de sesión; se
 * movió aquí para que las dos apps la compartan en vez de tener una copia cada
 * una.
 *
 * ⚠️ `null` —nunca un pivote de ceros— si falta un dato o el máximo queda por
 * debajo del mínimo: una vela así está rota, y un pivote calculado sobre ella
 * se leería como un nivel de verdad.
 */
export function pivoteClasico(h, l, c) {
  if (![h, l, c].every(num) || h < l) return null
  const p = (h + l + c) / 3
  return { p, r1: 2 * p - l, s1: 2 * p - h, r2: p + (h - l), s2: p - (h - l) }
}

/**
 * Cuántos ATR queda el Stop-loss por fuera del soporte (o la resistencia) en
 * el método `estructura`. Exportado para que el curso lo LEA en vez de
 * escribirlo a mano (módulo 9).
 */
export const COJIN_ESTRUCTURA = 0.5

/** Stop medio ATR por fuera del extremo de 20 velas, objetivo en el contrario. */
export function nivelesEstructura(ficha, compra) {
  const { sop, res, atr } = ficha ?? {}
  if (![sop, res, atr].every(num)) return null
  return compra ? { sl: sop - COJIN_ESTRUCTURA * atr, tp: res } : { sl: res + COJIN_ESTRUCTURA * atr, tp: sop }
}

/**
 * El stop y el objetivo para esa dirección y ese método, o `null`.
 *
 * ⚠️ Comprueba que queden a cada LADO del precio. Un objetivo de compra por
 * debajo de la entrada (pasa con `estructura` si el precio está justo en el
 * máximo de 20 velas) daría una distancia de cero o negativa, un R/B de 0 y un
 * lote infinito. Es mejor decir «con este método no sale» que pintar eso.
 */
export function nivelesDe(ficha, lado, metodo) {
  if (!ficha || !LADOS.includes(lado) || !METODOS.includes(metodo)) return null
  const compra = lado === 'COMPRA'
  const n = metodo === 'estructura' ? nivelesEstructura(ficha, compra) : ficha.niveles?.[metodo]?.[lado]
  if (!n || !num(n.sl) || !num(n.tp) || !num(ficha.precio)) return null
  const ok = compra ? n.sl < ficha.precio && ficha.precio < n.tp : n.tp < ficha.precio && ficha.precio < n.sl
  return ok ? { sl: n.sl, tp: n.tp } : null
}

// ─────────────────────────────────────────────────────────────────────────
// LAS BANDAS DE BOLLINGER Y LAS MEDIAS (2026-11-15)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Las bandas en precio y el %B de verdad.
 *
 * ⚠️⚠️ HASTA HOY LA TARJETA DECÍA «%B» Y ENSEÑABA OTRA COSA. Enseñaba
 * `posicionDe`, que va de −1 (banda de abajo) a +1 (banda de arriba). El %B de
 * Bollinger va de 0 a 1: %B = (precio − banda de abajo) / (arriba − abajo). Un
 * precio en la media salía «0.00» cuando su %B es 0,50. Un número bien calculado
 * con la etiqueta de otro — la familia que este proyecto colecciona.
 *
 * @returns null si no hay bandas (nunca ceros).
 */
export function bollingerDe(ficha) {
  const b = ficha?.bandas
  if (!b || ![b.arriba, b.media, b.abajo].every(num) || !(b.arriba > b.abajo)) return null
  const c = ficha.precio
  const pip = tamanoPip(ficha.dec)
  return {
    pctB: num(c) ? (c - b.abajo) / (b.arriba - b.abajo) : null,
    arriba: b.arriba,
    media: b.media,
    abajo: b.abajo,
    anchoPips: (b.arriba - b.abajo) / pip,
  }
}

/**
 * Las medias de la ficha con dónde queda el precio respecto de cada una.
 * Un periodo sin valor sale con `v: null` (faltan velas), no desaparece.
 *
 * ⚠️ `precio: 'encima' | 'debajo'` es GEOMETRÍA, no una dirección para operar.
 */
export function mediasParaTarjeta(ficha) {
  const m = ficha?.medias
  if (!m || (!Array.isArray(m.sma) && !Array.isArray(m.ema))) return null
  const pip = tamanoPip(ficha.dec)
  const c = ficha.precio
  const una = (x) => {
    const v = num(x?.v) ? x.v : null
    const ok = v !== null && num(c)
    return { p: x?.p, v, pips: ok ? Math.abs(c - v) / pip : null, precio: ok ? (c > v ? 'encima' : c < v ? 'debajo' : 'igual') : null }
  }
  return { sma: (m.sma ?? []).map(una), ema: (m.ema ?? []).map(una) }
}

/**
 * Los niveles de Fibonacci del par, con la distancia del precio a cada uno.
 *
 * @returns null sin datos; `{ sinMovimiento: true }` si el movimiento es
 *          demasiado pequeño (se dice, no se esconde); si no, `{ desde, hasta,
 *          subiendo, niveles: [{ ratio, precio, pips, lado }], cercano }`.
 *
 * ⚠️ `subiendo` describe el movimiento que YA pasó; `lado` es geometría. Nada
 * de esto dice hacia dónde irá el precio.
 */
export function fibDe(ficha) {
  const f = ficha?.fib
  if (!f || typeof f !== 'object') return null
  if (f.sinMovimiento) return { sinMovimiento: true }
  if (!Array.isArray(f.niveles) || !num(f.desde) || !num(f.hasta)) return null
  const pip = tamanoPip(ficha.dec)
  const c = ficha.precio
  const niveles = f.niveles
    .filter((n) => num(n?.precio) && num(n?.ratio))
    .map((n) => ({
      ratio: n.ratio,
      precio: n.precio,
      pips: num(c) ? Math.abs(c - n.precio) / pip : null,
      lado: num(c) ? (n.precio > c ? 'arriba' : n.precio < c ? 'abajo' : 'igual') : null,
    }))
  const conPips = niveles.filter((n) => n.pips !== null)
  const cercano = conPips.length ? conPips.reduce((a, b) => (b.pips < a.pips ? b : a)).ratio : null
  return { desde: f.desde, hasta: f.hasta, subiendo: !!f.subiendo, niveles, cercano }
}

// EL FVG (brecha de valor justo)
// ─────────────────────────────────────────────────────────────────────────

/** Cuántos huecos vivos se enseñan como mucho: los más cercanos al precio. */
export const MAX_FVG = 4

/**
 * Los huecos vivos del par, con su distancia al precio en pips.
 *
 * Cada uno: { tipo, abajo, arriba, estado, velasAtras, dentro, lado, pips }
 *   · `dentro` el precio está ahora mismo dentro del tramo vacío;
 *   · `lado`   'arriba' o 'abajo': dónde queda el hueco respecto del precio;
 *   · `pips`   la distancia al borde más cercano (0 si está dentro).
 *
 * ⚠️ `lado` es GEOMETRÍA, no una dirección para operar: «hay un hueco 30 pips
 * por debajo» no dice «compra» ni «vende».
 *
 * @returns `null` si el barrido no trae extremos («no lo sé»); `{ huecos: [] }`
 *          si los trae y no queda ninguno vivo («miré y no hay»).
 */
export function fvgDe(ficha) {
  if (!ficha || !Array.isArray(ficha.fvg) || !num(ficha.precio)) return null
  const pip = tamanoPip(ficha.dec)
  const c = ficha.precio
  const huecos = ficha.fvg
    .filter((h) => num(h?.abajo) && num(h?.arriba))
    .map((h) => {
      const dentro = c >= h.abajo && c <= h.arriba
      const lado = dentro ? null : h.abajo > c ? 'arriba' : 'abajo'
      const dist = dentro ? 0 : lado === 'arriba' ? h.abajo - c : c - h.arriba
      return { tipo: h.tipo, abajo: h.abajo, arriba: h.arriba, estado: h.estado, velasAtras: h.velasAtras, dentro, lado, pips: dist / pip }
    })
    .sort((a, b) => a.pips - b.pips)
  return { huecos: huecos.slice(0, MAX_FVG), total: huecos.length, cruce: !!ficha.esCruce }
}

// LAS SEIS HERRAMIENTAS DEL 2026-11-15
// ─────────────────────────────────────────────────────────────────────────
// Cada una devuelve un objeto plano o `null`. `null` quiere decir «no lo sé» y
// nunca «es cero»: misma asimetría que `pearson`, `difMax` y `edadEnMinutos`.

/**
 * Lo que cuesta abrir y la actividad, del puente de MT5.
 *
 * ⚠️ El spread se compara con el Stop-loss de ESTA tarjeta: 2 pips sobre un
 * stop de 120 son el 1,7 % del riesgo; sobre uno de 30, el 7 %. Es lo único que
 * dice si ese coste importa, y sin niveles no se calcula.
 *
 * ⚠️ La actividad va como fracción del par MÁS ACTIVO de la misma lectura,
 * nunca contra días anteriores: el número es de la vela diaria EN CURSO y crece
 * hasta el cierre. Y no es volumen: es cuántas veces cambió el precio en un
 * solo bróker (ver `CotizacionesVivo.jsx`).
 */
export function spreadDe(mt5, par, niveles, ahora = new Date()) {
  const q = mt5?.quotes?.[par]
  if (!q || !num(q.spread)) return null
  const ticks = Object.values(mt5.quotes)
    .map((x) => x?.ticks)
    .filter(num)
  const max = ticks.length ? Math.max(...ticks) : null
  const ms = typeof mt5.actualizadoEl === 'string' ? new Date(mt5.actualizadoEl).getTime() : NaN
  return {
    spread: q.spread,
    pctStop: niveles && num(niveles.pipRiesgo) && niveles.pipRiesgo > 0 ? (q.spread / niveles.pipRiesgo) * 100 : null,
    actividad: num(q.ticks) && num(max) && max > 0 ? q.ticks / max : null,
    minutos: Number.isFinite(ms) ? Math.max(0, Math.round((ahora.getTime() - ms) / 60000)) : null,
  }
}

/**
 * Cómo están posicionados los fondos especulativos en las dos divisas del par,
 * en % del interés abierto, con la fecha de SU informe (llega con 3 a 10 días
 * de retraso y en pantalla tiene que verse).
 *
 * ⚠️ NO DEVUELVE UN VEREDICTO. El COT como filtro se midió DOS veces y no pasó.
 * Aquí es información, igual que en su tarjeta.
 */
export function cotDe(cot, b, q) {
  const d = cot?.divisas
  if (!d) return null
  const lado = (c) => (num(d[c]?.fondosPct) ? { pct: d[c].fondosPct, f: typeof d[c].f === 'string' ? d[c].f : null } : null)
  const vb = lado(b)
  const vq = lado(q)
  if (!vb && !vq) return null
  const fechas = [vb?.f, vq?.f].filter(Boolean).sort()
  return { b, q, pctB: vb?.pct ?? null, pctQ: vq?.pct ?? null, fecha: fechas[0] ?? cot.fecha ?? null }
}

/** El oro: su correlación con este par (60 sesiones) y cuánto se movió en 20 días. */
export function oroDe(oro, par) {
  if (!oro?.correl) return null
  const c = oro.correl[par]
  const r = num(c?.r) ? c.r : null
  const cambio20 = num(oro.cambio20) ? oro.cambio20 : null
  if (r === null && cambio20 === null) return null
  return { r, n: num(c?.n) ? c.n : null, cambio20, fecha: typeof oro.fecha === 'string' ? oro.fecha : null }
}

/**
 * Los pares que se mueven casi igual que éste (|r| ≥ 0,7), ordenados por
 * tamaño. `[]` —y no `null`— cuando hay datos y ninguno pasa: «ninguno va con
 * éste» es un hecho; «no lo sé» es otro.
 */
export function correlacionDe(correlaciones, par) {
  if (!Array.isArray(correlaciones)) return null
  return correlaciones
    .filter((x) => x && (x.a === par || x.b === par) && num(x.r))
    .map((x) => ({ par: x.a === par ? x.b : x.a, r: x.r }))
    .sort((x, y) => Math.abs(y.r) - Math.abs(x.r))
    .slice(0, 5)
}

// El recorrido de una casilla contra la media de su grupo: 1,08 quiere decir
// «se mueve un 8 % más que la media». `null` si falta algo.
function casillaContraMedia(grupo, clave) {
  if (!grupo || typeof grupo !== 'object') return null
  const medios = Object.values(grupo)
    .map((x) => x?.medio)
    .filter(num)
  const c = grupo[clave]
  if (!num(c?.medio) || !medios.length) return null
  const media = medios.reduce((a, x) => a + x, 0) / medios.length
  return media > 0 ? { medio: c.medio, veces: c.medio / media, n: num(c.n) ? c.n : null } : null
}

/**
 * La estacionalidad de HOY para este par: el recorrido típico de este día de la
 * semana y de este mes (y de esta hora, en la app de intradía), cada uno contra
 * la media de los demás, y cuántos meses como éste cerraron en verde.
 *
 * ⚠️ Se agrupa en UTC, igual que el publicador: los solapes de sesión son fijos
 * en UTC. La pantalla traduce al pintar.
 *
 * ⚠️ El recorrido mide CUÁNTO se mueve, nunca hacia dónde. La dirección por mes
 * va con su ±, y con ~18 meses ese ± ronda los 23 puntos: casi no dice nada, y
 * la tarjeta lo dice.
 */
export function estacionalidadHoy(est, par, ahora = new Date()) {
  const p = est?.pares?.[par]
  if (!p) return null
  const dia = ahora.getUTCDay()
  const mes = ahora.getUTCMonth()
  const hora = ahora.getUTCHours()
  const d = p.mesDir?.[mes]
  return {
    dia,
    mes,
    hora,
    rDia: casillaContraMedia(p.dia, dia),
    rMes: casillaContraMedia(p.mes, mes),
    rHora: casillaContraMedia(p.hora, hora),
    dir: d && num(d.pct) ? { pct: d.pct, margen: num(d.margen) ? d.margen : null, n: num(d.n) ? d.n : null } : null,
  }
}

/**
 * Lo que la persona ya hizo: sus operaciones CERRADAS en este par (con el ±
 * pegado, que con pocas es enorme) y cuántas ABIERTAS comparten una divisa con
 * él — si son varias, es una sola apuesta más grande.
 */
export function diarioDe(trades, par, monedasDeFn) {
  const lista = Array.isArray(trades) ? trades : []
  const r = resumir(lista.filter((t) => t?.par === par))
  const mias = monedasDeFn ? monedasDeFn(par) : []
  const abiertas = lista.filter(
    (t) => t?.estado === 'abierta' && typeof t.par === 'string' && monedasDeFn && monedasDeFn(t.par).some((c) => mias.includes(c)),
  ).length
  return { n: r.n, ganadas: r.ganadas, pct: r.pct, margen: r.margen, neto: r.neto, abiertas }
}

/**
 * La tarjeta entera, como DATOS.
 *
 * @param ficha         la ficha del par (la arma `marketCalc.js` de cada app)
 * @param lado          'COMPRA' | 'VENTA' — lo elige la persona
 * @param metodo        uno de `METODOS`
 * @param herramientas  las que la persona encendió
 * @param perfil        el perfil ya leído con `leerPerfil`
 * @param ratesUSD      las tasas para el valor del pip
 * @param calendario    `estado/calendario.json` (o null)
 * @param tasas         el mapa de `estado/tasas.json` (o null)
 * @param monedasDe     `pairs.js`
 * @param freno         el estado del guardián de riesgo ('ok'|'cerca'|'freno'|…)
 * @param mt5           `{ quotes, actualizadoEl }` del puente de MT5 (o null)
 * @param cot           `estado/cot.json` (o null; la app de intradía no lo tiene)
 * @param oro           `estado/oro.json` (o null; ídem)
 * @param correlaciones la lista de `paresQueVanJuntos` (o undefined; ídem)
 * @param estacionalidad `estado/estacionalidad.json` (o null)
 * @param trades        el diario de la persona
 *
 * Devuelve siempre un objeto. Lo que no se puede calcular va como `null` con su
 * motivo en forma de CÓDIGO, nunca de frase: lo traduce quien pinta, y la fase
 * 5 se lo pasa a Qwen.
 */
export function armarAnalisis({
  ficha,
  lado,
  metodo = 'app',
  herramientas = HERRAMIENTAS_INICIALES,
  perfil,
  ratesUSD,
  calendario,
  tasas,
  monedasDe,
  freno = null,
  mt5 = null,
  cot = null,
  oro = null,
  correlaciones,
  estacionalidad = null,
  trades = [],
  ahora = new Date(),
} = {}) {
  if (!ficha) return { par: null, motivo: 'sinFicha' }
  const pip = tamanoPip(ficha.dec)
  const encendidas = new Set(Array.isArray(herramientas) ? herramientas.filter((h) => HERRAMIENTAS.includes(h)) : [])

  // ── Los niveles y el lote ────────────────────────────────────────────────
  let niveles = null
  let motivoNiveles = null
  if (!LADOS.includes(lado)) motivoNiveles = 'sinLado'
  else {
    const n = nivelesDe(ficha, lado, metodo)
    if (!n) motivoNiveles = 'metodoNoSale'
    else {
      const pipRiesgo = Math.abs(ficha.precio - n.sl) / pip
      const pipBeneficio = Math.abs(n.tp - ficha.precio) / pip
      niveles = { ...n, pipRiesgo, pipBeneficio, rr: pipBeneficio / pipRiesgo }
    }
  }

  let lote = null
  let motivoLote = null
  if (!niveles) motivoLote = 'sinNiveles'
  // Basta el capital y el riesgo por operación: los dos frenos no hacen falta
  // para el lote, y exigirlos dejaría sin lote a quien solo llenó lo primero.
  else if (!(num(perfil?.capital) && num(perfil?.riesgoPct))) motivoLote = 'sinPerfil'
  else if (!ratesUSD) motivoLote = 'sinTasas'
  else {
    const r = calcularLote({ capital: perfil.capital, riesgoPct: perfil.riesgoPct, pips: niveles.pipRiesgo, par: ficha.name, tasas: ratesUSD })
    if (r.ok) lote = { lote: r.lote, riesgoUsd: r.riesgoUsd, valorPip: r.pip, mini: r.mini, micro: r.micro, bajoMinimo: r.bajoMinimo, riesgoMinimoUsd: r.riesgoMinimoUsd }
    else motivoLote = 'sinTasas'
  }

  // ── Las herramientas, solo las encendidas ───────────────────────────────
  const h = {}
  const si = (k) => encendidas.has(k)
  if (si('niveles')) h.niveles = num(ficha.sop) && num(ficha.res) ? { sop: ficha.sop, res: ficha.res } : null
  if (si('pivote')) h.pivote = ficha.pivote ?? null
  if (si('tendencia'))
    h.tendencia = ficha.tend ? { tend: ficha.tend, corta: ficha.emas?.corta ?? null, larga: ficha.emas?.larga ?? null, nombres: ficha.emas?.nombres ?? null } : null
  if (si('rsi')) h.rsi = num(ficha.rsi) ? { v: ficha.rsi } : null
  if (si('atr')) h.atr = num(ficha.atr) ? { abs: ficha.atr, pct: num(ficha.atrPct) ? ficha.atrPct : null, pips: ficha.atr / pip } : null
  if (si('fuerza')) h.fuerza = num(ficha.fuerzaB) && num(ficha.fuerzaQ) ? { b: ficha.b, q: ficha.q, vb: ficha.fuerzaB, vq: ficha.fuerzaQ } : null
  if (si('compresion')) h.compresion = num(ficha.compresion) ? { v: ficha.compresion, nivel: ficha.nivelCompresion ?? null } : null
  if (si('bollinger')) h.bollinger = bollingerDe(ficha)
  if (si('calendario')) {
    // Solo los eventos de las dos divisas del par. `null` si no hay calendario
    // publicado; `[]` si lo hay y no trae nada para estas dos — son dos cosas
    // distintas y se dicen distinto.
    h.calendario = Array.isArray(calendario?.eventos) ? proximos(calendario, ahora).filter((ev) => ev.c === ficha.b || ev.c === ficha.q) : null
  }
  if (si('swap')) h.swap = tasas && monedasDe && LADOS.includes(lado) ? carryDeSenal({ par: ficha.name, lado }, tasas, monedasDe) : null
  if (si('spread')) h.spread = spreadDe(mt5, ficha.name, niveles, ahora)
  if (si('cot')) h.cot = cotDe(cot, ficha.b, ficha.q)
  if (si('oro')) h.oro = oroDe(oro, ficha.name)
  if (si('correlacion')) h.correlacion = correlacionDe(correlaciones, ficha.name)
  if (si('estacionalidad')) h.estacionalidad = estacionalidadHoy(estacionalidad, ficha.name, ahora)
  if (si('diario')) h.diario = diarioDe(trades, ficha.name, monedasDe)
  if (si('fvg')) h.fvg = fvgDe(ficha)
  if (si('medias')) h.medias = mediasParaTarjeta(ficha)
  if (si('fibonacci')) h.fibonacci = fibDe(ficha)

  return {
    par: ficha.name,
    b: ficha.b,
    q: ficha.q,
    dec: ficha.dec,
    lado: LADOS.includes(lado) ? lado : null,
    metodo,
    precio: ficha.precio,
    niveles,
    motivoNiveles,
    lote,
    motivoLote,
    herramientas: h,
    freno,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// LAS PLANTILLAS: qué herramientas y qué método, con un nombre
// ─────────────────────────────────────────────────────────────────────────
// Se guardan en `users/{uid}.plantillas`. La regla de Firestore solo deja una
// lista de 10 como mucho; lo de dentro lo limpia `normalizarPlantilla` al
// leer, así que una plantilla rara no rompe la pantalla de nadie.

/**
 * Una plantilla limpia o `null`. Las herramientas que no existen se quitan (una
 * que se retire mañana no deja plantillas rotas), y un método desconocido cae a
 * `app`, que es lo que la app sabe medir.
 */
export function normalizarPlantilla(x) {
  if (!x || typeof x !== 'object') return null
  const nombre = typeof x.nombre === 'string' ? x.nombre.trim() : ''
  if (!nombre || nombre.length > MAX_NOMBRE) return null
  const herramientas = Array.isArray(x.herramientas) ? [...new Set(x.herramientas.filter((h) => HERRAMIENTAS.includes(h)))] : []
  if (!herramientas.length) return null
  const metodo = METODOS.includes(x.metodo) ? x.metodo : 'app'
  return { nombre, herramientas, metodo }
}

export function leerPlantillas(lista) {
  if (!Array.isArray(lista)) return []
  const vistas = new Set()
  const out = []
  for (const x of lista) {
    const p = normalizarPlantilla(x)
    if (!p || vistas.has(p.nombre.toLowerCase())) continue
    vistas.add(p.nombre.toLowerCase())
    out.push(p)
    if (out.length >= MAX_PLANTILLAS) break
  }
  return out
}

/**
 * La lista con esta plantilla añadida, o reemplazando a la que se llame igual
 * (sin distinguir mayúsculas). Devuelve `{ ok, lista }` o `{ ok: false, codigo }`.
 */
export function conPlantilla(lista, nueva) {
  const nombre = typeof nueva?.nombre === 'string' ? nueva.nombre.trim() : ''
  if (!nombre) return { ok: false, codigo: 'sinNombre' }
  if (nombre.length > MAX_NOMBRE) return { ok: false, codigo: 'nombreLargo' }
  const p = normalizarPlantilla({ ...nueva, nombre })
  if (!p) return { ok: false, codigo: 'sinHerramientas' }
  const actuales = leerPlantillas(lista)
  const i = actuales.findIndex((x) => x.nombre.toLowerCase() === nombre.toLowerCase())
  if (i >= 0) return { ok: true, lista: actuales.map((x, j) => (j === i ? p : x)) }
  if (actuales.length >= MAX_PLANTILLAS) return { ok: false, codigo: 'demasiadas' }
  return { ok: true, lista: [...actuales, p] }
}

export function sinPlantilla(lista, nombre) {
  const n = String(nombre ?? '').toLowerCase()
  return leerPlantillas(lista).filter((x) => x.nombre.toLowerCase() !== n)
}

/**
 * La nota que se lleva al Diario con «Anotar en el Diario». Números con punto y
 * siglas de trading, que no se traducen (igual que la de las señales).
 */
export function notaDeAnalisis(a) {
  if (!a?.niveles) return ''
  const f = (x) => x.toFixed(a.dec)
  return `entrada ${f(a.precio)} · SL ${f(a.niveles.sl)} · TP ${f(a.niveles.tp)} · R/B 1:${a.niveles.rr.toFixed(1)}`
}
