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
])

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

/** Stop medio ATR por fuera del extremo de 20 velas, objetivo en el contrario. */
export function nivelesEstructura(ficha, compra) {
  const { sop, res, atr } = ficha ?? {}
  if (![sop, res, atr].every(num)) return null
  return compra ? { sl: sop - 0.5 * atr, tp: res } : { sl: res + 0.5 * atr, tp: sop }
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
    if (r.ok) lote = { lote: r.lote, riesgoUsd: r.riesgoUsd, valorPip: r.pip, mini: r.mini, micro: r.micro }
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
  if (si('bollinger')) h.bollinger = num(ficha.bollinger) ? { pctB: ficha.bollinger } : null
  if (si('calendario')) {
    // Solo los eventos de las dos divisas del par. `null` si no hay calendario
    // publicado; `[]` si lo hay y no trae nada para estas dos — son dos cosas
    // distintas y se dicen distinto.
    h.calendario = Array.isArray(calendario?.eventos) ? proximos(calendario, ahora).filter((ev) => ev.c === ficha.b || ev.c === ficha.q) : null
  }
  if (si('swap')) h.swap = tasas && monedasDe && LADOS.includes(lado) ? carryDeSenal({ par: ficha.name, lado }, tasas, monedasDe) : null

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
