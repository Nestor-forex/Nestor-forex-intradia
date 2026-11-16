// AVISOS INTELIGENTES (2026-11-16) — el punto 2 del plan de herramientas nuevas.
//
// Néstor aprobó, de un análisis externo, que además de los avisos que cada
// persona programa a mano («precio 1.1550», «RSI 30») la app avise sola de tres
// cosas de CONTEXTO sobre los pares que la persona sigue:
//
//   · noticias   — viene una noticia de impacto alto para una divisa de tus pares;
//   · correlacion — dos pares de tu lista se mueven casi igual (solo Swing la mide);
//   · spread     — el spread de un par tuyo está muy por encima de lo normal.
//
// Este archivo es GEMELO: lo usan la pantalla (los interruptores) y el programa
// que manda los avisos (`scripts/mandar-avisos.mjs`), así que las dos partes leen
// las mismas reglas. Dos copias de «cuándo suena» dejarían interruptores que no
// suenan, que es justo el fallo de `soloSeguidos` del 2026-10-31.
//
// ⚠️⚠️ NINGUNO DICE QUÉ HACER. Un aviso dice QUÉ PASA («viene el dato de empleo
// del dólar en 25 minutos»), nunca «no operes» ni «cierra». Si dijera qué hacer
// sería un filtro, y en estas apps van diez familias de filtros medidas y diez
// que no aportan nada.
//
// ⚠️ ARRANCAN APAGADOS. Cada persona enciende los que quiera. Nadie recibe un
// aviso que no pidió.

export const TIPOS = Object.freeze(['noticias', 'correlacion', 'spread'])

// Cuánto antes se avisa de una noticia. El programa mira cada 15 minutos, así
// que con 30 la noticia se avisa entre 15 y 30 minutos antes: tiempo de mirar,
// no de enterarse tarde. Se avisa UNA vez por noticia.
export const NOTICIA_MIN = 30

// A partir de qué correlación dos pares «se mueven casi igual». Es el mismo
// umbral alto que usa la tarjeta de riesgo entre señales: por debajo, la
// coincidencia es demasiado floja para llamarla «la misma apuesta».
export const CORREL_UMBRAL = 0.8
// Una pareja ya avisada no vuelve a sonar en una semana: la correlación cambia
// despacio y repetirla cada día enseñaría a ignorarla.
export const CORREL_DIAS = 7

// «Muy por encima de lo normal» = el doble de su mediana reciente o más.
export const SPREAD_FACTOR = 2
// Sin suficientes lecturas no hay «normal» con el que comparar. Con menos se
// calla: ante la duda, no suena (un aviso falso de spread enseña a ignorarlos).
export const SPREAD_MIN_LECTURAS = 8

// Las marcas de «ya avisado» se guardan en la ficha de la persona. Se borran
// las de más de 8 días para que la ficha no crezca sin fin.
export const DIAS_GUARDAR_MARCAS = 8

const MS_MIN = 60_000
const MS_DIA = 24 * 60 * MS_MIN

/**
 * Qué tipos tiene encendidos la persona. Lo que no se entiende se ignora:
 * una clave rara simplemente no suena. Sin el campo, ninguno (arrancan apagados).
 */
export function tiposEncendidos(ficha) {
  const lista = Array.isArray(ficha?.avisosInt) ? ficha.avisosInt : []
  return TIPOS.filter((t) => lista.includes(t))
}

/** Las divisas que salen en los pares de la lista: «EUR/USD» aporta EUR y USD. */
export function divisasDeLista(seguimiento) {
  const out = new Set()
  for (const p of Array.isArray(seguimiento) ? seguimiento : []) {
    if (typeof p !== 'string') continue
    for (const d of p.split('/')) if (/^[A-Z]{3}$/.test(d)) out.add(d)
  }
  return [...out]
}

/**
 * Las noticias de impacto ALTO de tus divisas que empiezan en los próximos
 * `NOTICIA_MIN` minutos. Las que ya empezaron no: avisar de algo pasado no sirve.
 */
export function noticiasQueAvisan(eventos, divisas, ahora = new Date(), minutos = NOTICIA_MIN) {
  const mis = new Set(divisas)
  const t0 = ahora.getTime()
  const out = []
  for (const ev of Array.isArray(eventos) ? eventos : []) {
    if (!ev || ev.i !== 'alto' || !mis.has(ev.c)) continue
    const t = new Date(ev.d).getTime()
    if (!Number.isFinite(t)) continue
    const faltan = (t - t0) / MS_MIN
    if (faltan <= 0 || faltan > minutos) continue
    out.push({ tipo: 'noticias', clave: `noticia|${ev.c}|${ev.d}|${ev.t}`, divisa: ev.c, titulo: ev.t, minutos: Math.round(faltan) })
  }
  return out
}

/**
 * Las parejas de TU lista con |correlación| ≥ el umbral. `correl` es el mapa
 * que publica el barrido de Swing: { "EUR/USD|GBP/USD": 0.9, … }.
 * `null` o un número raro se salta: «no se pudo calcular» no es «se parecen».
 */
export function parejasQueAvisan(correl, seguimiento, umbral = CORREL_UMBRAL) {
  const mis = new Set(Array.isArray(seguimiento) ? seguimiento : [])
  const out = []
  if (!correl || typeof correl !== 'object') return out
  for (const [k, r] of Object.entries(correl)) {
    if (typeof r !== 'number' || !Number.isFinite(r) || Math.abs(r) < umbral) continue
    const [a, b] = k.split('|')
    if (!mis.has(a) || !mis.has(b)) continue
    out.push({ tipo: 'correlacion', clave: `correl|${k}`, a, b, r })
  }
  return out
}

/** La mediana, o `null` si no hay datos. */
export function mediana(xs) {
  const v = (Array.isArray(xs) ? xs : []).filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((p, q) => p - q)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

/**
 * Los pares de tu lista cuyo spread actual es `SPREAD_FACTOR` veces su mediana
 * reciente o más. `actual` = { par: spread }, `historico` = [{ par: spread }, …].
 * Sin `SPREAD_MIN_LECTURAS` lecturas de ese par, se calla.
 */
export function spreadsQueAvisan(actual, historico, seguimiento, hoyISO, factor = SPREAD_FACTOR) {
  const out = []
  if (!actual || typeof actual !== 'object') return out
  for (const par of Array.isArray(seguimiento) ? seguimiento : []) {
    const ahora = actual[par]
    if (typeof ahora !== 'number' || !Number.isFinite(ahora)) continue
    const previas = (Array.isArray(historico) ? historico : []).map((h) => h?.[par])
    const validas = previas.filter((x) => typeof x === 'number' && Number.isFinite(x))
    if (validas.length < SPREAD_MIN_LECTURAS) continue
    const normal = mediana(validas)
    if (!normal || normal <= 0) continue
    if (ahora >= normal * factor) out.push({ tipo: 'spread', clave: `spread|${par}|${hoyISO}`, par, actual: ahora, normal })
  }
  return out
}

/**
 * ¿Ya se avisó esto? `enviados` = { clave: fechaISO }. La correlación caduca a
 * los `CORREL_DIAS`; las noticias y el spread llevan la fecha o el evento
 * dentro de la clave, así que no vuelven a coincidir.
 */
export function yaAvisado(enviados, aviso, ahora = new Date()) {
  const cuando = enviados?.[aviso.clave]
  if (typeof cuando !== 'string') return false
  const t = new Date(cuando).getTime()
  if (!Number.isFinite(t)) return false
  if (aviso.tipo === 'correlacion') return ahora.getTime() - t < CORREL_DIAS * MS_DIA
  return true
}

/** Las marcas que se conservan al escribir: solo las de los últimos días. */
export function podarMarcas(enviados, ahora = new Date()) {
  const out = {}
  for (const [k, v] of Object.entries(enviados || {})) {
    const t = new Date(v).getTime()
    if (Number.isFinite(t) && ahora.getTime() - t < DIAS_GUARDAR_MARCAS * MS_DIA) out[k] = v
  }
  return out
}

/**
 * Todo junto, para UNA persona: qué avisos le tocan en esta vuelta.
 * `contexto` = { eventos, correl, spreadActual, spreadHistorico, hoyISO }.
 * Sin lista de pares no hay «tus pares», así que no suena nada.
 */
export function avisosParaPersona(ficha, contexto, ahora = new Date()) {
  const tipos = tiposEncendidos(ficha)
  const lista = Array.isArray(ficha?.seguimiento) ? ficha.seguimiento.filter((p) => typeof p === 'string') : []
  if (!tipos.length || !lista.length) return []
  const cands = []
  if (tipos.includes('noticias')) cands.push(...noticiasQueAvisan(contexto?.eventos, divisasDeLista(lista), ahora))
  if (tipos.includes('correlacion')) cands.push(...parejasQueAvisan(contexto?.correl, lista))
  if (tipos.includes('spread'))
    cands.push(...spreadsQueAvisan(contexto?.spreadActual, contexto?.spreadHistorico, lista, contexto?.hoyISO))
  return cands.filter((a) => !yaAvisado(ficha?.intelEnviados, a, ahora))
}

/**
 * El texto de la notificación como CLAVE + HUECOS, nunca como frase: el programa
 * que manda corre en Node y no sabe el idioma de nadie. Traduce quien pinta.
 * Los números van redondeados como se leen en pantalla.
 */
export function mensajeInteligente(aviso) {
  if (aviso.tipo === 'noticias')
    return { titulo: ['intel.notiNoticiaTitulo', { divisa: aviso.divisa }], cuerpo: ['intel.notiNoticia', { titulo: aviso.titulo, min: aviso.minutos }] }
  if (aviso.tipo === 'correlacion')
    return { titulo: ['intel.notiCorrelTitulo', {}], cuerpo: ['intel.notiCorrel', { a: aviso.a, b: aviso.b, r: aviso.r.toFixed(2) }] }
  return {
    titulo: ['intel.notiSpreadTitulo', { par: aviso.par }],
    cuerpo: ['intel.notiSpread', { par: aviso.par, actual: aviso.actual.toFixed(1), normal: aviso.normal.toFixed(1) }],
  }
}
