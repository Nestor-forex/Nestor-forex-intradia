import { PAIR_NAMES, monedasDe } from './pairs.js'

// EL CALENDARIO ECONÓMICO — la parte que solo son cuentas.
//
// Vive en `src/lib/` y no en `scripts/` porque lo necesitan LOS DOS lados: el
// guion de Node que publica el archivo y el navegador que lo pinta. Es el mismo
// motivo por el que `marketCalc.js` está aquí.
//
// ⚠️ CON EXTENSIÓN `.js` en los imports. Vite la resuelve sin ella, Node NO.
// Ya rompió el reporte diario una vez por esto.
//
// ─────────────────────────────────────────────────────────────────────────
// QUÉ ES ESTO Y QUÉ NO ES
// ─────────────────────────────────────────────────────────────────────────
// Es INFORMACIÓN: dice qué va a pasar y a qué hora. **No cambia ni una sola
// señal.** Esa distinción es la que decide si hace falta pasar por el banco de
// pruebas antes de encenderlo, y está escrita en CLAUDE.md: la información
// entra sin medición porque no promete acertar más; un FILTRO («no operar dos
// horas antes de una noticia») cambiaría las señales y NO puede entrar sin
// medirse.
//
// ⚠️ Si algún día alguien quiere que el calendario apague señales, eso es un
// filtro y va al banco de pruebas primero. No se cuela por aquí.

// Las divisas que de verdad importan aquí salen de los pares de la app, no de
// una lista escrita aparte. Si mañana entra un par con SEK, el calendario se
// entera solo; una segunda lista a mano se habría quedado vieja en silencio.
export const DIVISAS = [...new Set(PAIR_NAMES.flatMap(monedasDe))].sort()

// El horizonte que se enseña por defecto. Dos días, no una semana: lo que
// cambia la decisión de HOY es lo de hoy y lo de mañana. La semana entera
// convertiría la tarjeta en una lista que nadie lee.
//
// Son 48 h en las DOS apps, aunque una opere en días y la otra en horas. No es
// pereza: esto no mide cuánto dura una operación, mide hasta dónde se ve venir
// algo. Saber que hay Fed esta noche cambia lo que se hace esta mañana igual
// en las dos — y en Intradía más, porque ahí se entra y se sale antes de que
// el dato llegue.
export const HORAS_VISTA = 48

// ⚠️ LOS NIVELES DE IMPACTO SON CÓDIGOS INTERNOS Y NO SE TRADUCEN.
//
// Es la misma regla que ya rige `dir` ('Compra'/'Venta') y `estado`
// ('abierta'/'cerrada'): el valor guardado es estable y solo cambia cómo se
// muestra. Si se tradujeran, el archivo publicado en español dejaría de
// entenderse desde un teléfono en árabe.
export const ALTO = 'alto'
export const MEDIO = 'medio'
export const BAJO = 'bajo'
export const FERIADO = 'feriado'
export const OTRO = 'otro'

// ⚠️ LO DESCONOCIDO SE QUEDA, NO SE TIRA.
//
// ForexFactory hoy manda High / Medium / Low / Holiday. Si mañana inventa otra
// palabra, ese evento cae en `otro` y SE SIGUE ENSEÑANDO.
//
// Los dos errores no cuestan lo mismo, y por eso la regla no es simétrica:
//
//   enseñar de más  → una línea de ruido en una tarjeta plegable
//   esconder de más → Néstor no se entera de que hay Fed esta noche
//
// Es exactamente la misma forma de razonar que `yaCorrioHoy` en el vigía
// (ante la duda, correr) y que `esSombra` (ante la duda, no avisar): se mira
// cuál de los dos fallos duele y se escribe la condición hacia el otro lado.
export function normalizarImpacto(v) {
  const s = String(v ?? '').trim().toLowerCase()
  if (s === 'high') return ALTO
  if (s === 'medium') return MEDIO
  if (s === 'low') return BAJO
  if (s === 'holiday') return FERIADO
  return OTRO
}

// Convierte un evento crudo del feed al formato corto que se publica.
//
// Las claves van de una letra porque este archivo lo baja cada miembro cada
// vez que abre la app. Con 30 eventos, `title`/`country`/`date` en vez de
// `t`/`c`/`d` son casi un kilobyte de nombres repetidos.
//
// Devuelve `null` si al evento le falta lo mínimo para ser útil. No revienta:
// un feed con una fila rara no puede tumbar el calendario entero.
export function normalizarEvento(crudo) {
  if (!crudo || typeof crudo !== 'object') return null

  const t = String(crudo.title ?? '').trim()
  const c = String(crudo.country ?? '').trim().toUpperCase()
  const d = String(crudo.date ?? '').trim()
  if (!t || !c || !d) return null

  // Se comprueba que la fecha se entienda AQUÍ y no más tarde en el navegador.
  // Una fecha ilegible que llega hasta la pantalla se convierte en un
  // «Invalid Date» delante de Néstor.
  const cuando = new Date(d)
  if (Number.isNaN(cuando.getTime())) return null

  const ev = { t, c, d, i: normalizarImpacto(crudo.impact) }
  // Pronóstico y anterior solo si traen algo: la mitad de los eventos los
  // mandan vacíos y guardar `""` treinta veces es peso por nada.
  const f = String(crudo.forecast ?? '').trim()
  const p = String(crudo.previous ?? '').trim()
  if (f) ev.f = f
  if (p) ev.p = p
  return ev
}

// ─────────────────────────────────────────────────────────────────────────
// QUÉ ES ESTE EVENTO, EN CRISTIANO
// ─────────────────────────────────────────────────────────────────────────
// ForexFactory manda los nombres **en inglés y en jerga**: «Core PPI m/m»,
// «Main Refinancing Rate». Néstor lo vio en la app y no reconoció lo mismo que
// yo le había contado en español, y con razón: un principiante lee eso y no
// aprende nada.
//
// ⚠️ NO SE TRADUCE EL NOMBRE, SE CLASIFICA. Traducir cientos de títulos
// distintos obligaría a inventar, y el día que ForexFactory publique uno nuevo
// saldría mal traducido sin que nadie se entere. Clasificar por familia es
// poco y es verdad: «Core PPI m/m» ES inflación, se llame como se llame.
//
// ⚠️ Y SI NO SE RECONOCE, NO SE DICE NADA. Devuelve `null` y la pantalla
// enseña solo el nombre original. Nunca una etiqueta a medias: una categoría
// equivocada es peor que ninguna, porque se cree.
//
// El orden importa: se mira de lo más específico a lo más general. «ECB Press
// Conference» tiene que caer en «decisión de tipos» y no en «discurso», porque
// es donde se explica la decisión que se acaba de tomar.
const CATEGORIAS = [
  ['tipos', /rate statement|monetary policy|refinancing rate|cash rate|official bank rate|fomc|interest rate|rate decision|press conference|deposit facility/i],
  ['inflacion', /\bcpi\b|\bppi\b|inflation|price index|deflator/i],
  ['empleo', /employment|unemployment|payroll|jobless|claims|job\b|labour|labor/i],
  ['crecimiento', /\bgdp\b|gross domestic/i],
  ['ventas', /retail sales/i],
  ['actividad', /\bpmi\b|sentiment|confidence|ifo|zew|industrial production|factory orders/i],
  ['comercio', /trade balance|current account|exports|imports/i],
  ['discurso', /speaks|testimony|speech|minutes/i],
  ['festivo', /holiday/i],
]

export function categoriaDe(ev) {
  const t = String(ev?.t ?? '')
  if (!t) return null
  for (const [clave, patron] of CATEGORIAS) if (patron.test(t)) return clave
  return null
}

// ¿Este evento le interesa a esta app?
//
// Dos condiciones, y el orden importa poco pero la razón de cada una sí:
//
//   1. La divisa tiene que ser una de las nuestras. El feed trae CNY, BRL y
//      demás, y ninguno de los pares que opera esta app los toca. `DIVISAS`
//      sale de `pairs.js`, así que la lista se ajusta sola a cada app.
//   2. Se cae SOLO el impacto bajo. Son la mayoría de los 80 eventos de la
//      semana; dejarlos dentro escondería los dos que sí importan debajo de
//      treinta que no.
//
// ⚠️ La condición 2 es la MISMA en las dos apps, y es deliberado aunque se
// pueda discutir. En velas de una hora un dato de impacto bajo sí puede mover
// algo, así que la tentación es dejarlos en Intradía. Pero el motivo para
// quitarlos no es que no muevan el precio: es que en un teléfono treinta
// líneas de ruido tapan las dos que importan, y eso vale igual en las dos
// apps. Si algún día se quiere probar lo contrario, se cambia esta línea —
// pero es una decisión de qué se ENSEÑA, no un filtro de señales: el
// calendario no apaga ni una.
export function esRelevante(ev) {
  return !!ev && DIVISAS.includes(ev.c) && ev.i !== BAJO
}

// Arma el archivo que se publica.
//
// ⚠️ AQUÍ NO SE FILTRA POR «FUTURO», Y ES A PROPÓSITO.
//
// El archivo es una foto: se publica cada pocas horas y se lee durante horas.
// Si se quitaran aquí los eventos ya pasados, uno que ocurriera veinte minutos
// después de publicar seguiría enseñándose como «próximo» hasta la siguiente
// publicación. Quien tiene el reloj bueno es el navegador de quien mira, así
// que se publica la semana y el filtro de «lo que todavía no ha pasado» se
// hace al pintar (`proximos`).
//
// Lo único que se recorta es lo de días ANTERIORES a hoy, que ya no vuelve a
// ser útil por mucho que pase el tiempo.
export function prepararCalendario(lista, ahora = new Date()) {
  const desde = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()))

  const eventos = (Array.isArray(lista) ? lista : [])
    .map(normalizarEvento)
    .filter((ev) => esRelevante(ev) && new Date(ev.d) >= desde)
    .sort((a, b) => new Date(a.d) - new Date(b.d))

  return {
    generadoEl: ahora.toISOString(),
    fuente: 'ForexFactory (FairEconomy)',
    eventos,
  }
}

// Los eventos que todavía no han pasado, dentro del horizonte.
//
// ⚠️ Se compara en tiempo ABSOLUTO. `d` viene en ISO con huso horario
// (`2026-09-06T21:30:00-04:00`), así que `new Date()` lo entiende solo y la
// comparación sale bien tanto en Colombia como en España. Eso no es un detalle:
// un calendario que enseña la hora equivocada es peor que no tener calendario,
// porque se cree.
export function proximos(cal, ahora = new Date(), { horas = HORAS_VISTA } = {}) {
  const lista = Array.isArray(cal?.eventos) ? cal.eventos : []
  const hasta = ahora.getTime() + horas * 3600_000
  return lista.filter((ev) => {
    const ms = new Date(ev.d).getTime()
    return Number.isFinite(ms) && ms >= ahora.getTime() && ms <= hasta
  })
}

// El evento de alto impacto más cercano, o `null`.
//
// Sirve para el TÍTULO de la tarjeta: la tarjeta va plegada, así que si el
// aviso solo estuviera dentro, habría que abrirla para enterarse — y nadie
// abre una tarjeta plegada para ver si hay algo que no sabe que hay.
export function masUrgente(eventos) {
  return (Array.isArray(eventos) ? eventos : []).find((ev) => ev.i === ALTO) ?? null
}

// Cuántas horas faltan, redondeado hacia abajo. Para el título.
export function horasHasta(ev, ahora = new Date()) {
  const ms = new Date(ev?.d).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.max(0, Math.floor((ms - ahora.getTime()) / 3600_000))
}

// Agrupa por día CIVIL del que mira, no por día UTC.
//
// Un evento de las 21:30 en Nueva York cae en el día siguiente en UTC. Si se
// agrupara por UTC, a Néstor le saldría bajo «mañana» algo que para él es
// esta noche. La clave sale de `toLocaleDateString` con el huso del aparato,
// que es justo lo que hay que respetar.
//
// `zona` existe SOLO para poder probarlo: sin ella habría que cambiarle el
// huso a la máquina entera para comprobar que un evento cae en el día
// correcto, y una prueba que no se puede escribir acaba no escribiéndose.
// En la app se deja sin poner, que es lo que hace que use el del teléfono.
export function agruparPorDia(eventos, locale = 'es', zona = undefined) {
  const grupos = []
  const porClave = new Map()
  for (const ev of Array.isArray(eventos) ? eventos : []) {
    const fecha = new Date(ev.d)
    if (Number.isNaN(fecha.getTime())) continue
    const clave = fecha.toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: zona,
    })
    if (!porClave.has(clave)) {
      const grupo = { clave, fecha, eventos: [] }
      porClave.set(clave, grupo)
      grupos.push(grupo)
    }
    porClave.get(clave).eventos.push(ev)
  }
  return grupos
}

// Cuántos eventos trae el archivo en total (toda la semana), para poder decir
// en pantalla «se enseñan 6 de los 17 de esta semana».
//
// 📌 Existe por una confusión REAL: se le dijo a Néstor «17 eventos» y él veía
// 6 en la tarjeta. Los dos números eran ciertos y medían cosas distintas — y
// eso, sin decirlo al lado, se lee como que la app se equivoca.
export function totalSemana(cal) {
  return Array.isArray(cal?.eventos) ? cal.eventos.length : 0
}

// ¿La foto es vieja?
//
// Sin esto, un publicador averiado se vería igual que una semana tranquila:
// la tarjeta desaparecería y nadie sabría por qué. Con esto, la tarjeta puede
// decir de cuándo es el dato — el mismo criterio del aviso «Sin conexión —
// mostrando el barrido guardado del [fecha]» que ya existe.
export function estaViejo(cal, ahora = new Date(), horas = 24) {
  const ms = new Date(cal?.generadoEl).getTime()
  if (!Number.isFinite(ms)) return true
  return ahora.getTime() - ms > horas * 3600_000
}
