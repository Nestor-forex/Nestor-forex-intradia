// EL GUARDIÁN DE RIESGO DEL DIARIO: cuánto lleva perdido hoy la persona frente
// a su freno del día, y cuántas pérdidas seguidas lleva hoy frente a su freno
// de pérdidas seguidas. Los dos frenos los puso ella en «Mi perfil de riesgo».
//
// Néstor lo pidió el 2026-11-12 como fase 2 del plan del Analizador.
//
// ⚠️ SOLO AVISA. NUNCA BLOQUEA. La app no está conectada a ningún bróker, así
// que no puede impedir que alguien abra una operación — y fingir que sí sería
// peor que no tener guardián. Lo que hace es poner delante, con números, la
// regla que la propia persona escribió.
//
// ⚠️ NO DECIDE NADA DEL MERCADO. No mira señales, pares ni precios: mira el
// Diario de la persona y su perfil. Ningún número de aquí cambia una señal.
//
// ⚠️ AQUÍ NO HAY NI UNA LÍNEA DE FIREBASE NI DE REACT, a propósito: la cuenta
// tiene que poder comprobarse sin red (`prueba-guardian.mjs`).

import { frenoEnDolares, perfilCompleto } from './perfilRiesgo.js'

/**
 * A partir de qué fracción del freno del día se avisa de que queda poco margen.
 * Dos tercios: con el riesgo típico (1 % por operación y freno del 3 %) eso es
 * justo después de la segunda pérdida, que es cuando todavía sirve avisar.
 */
export const AVISO_CERCA = 2 / 3

const ES_DIA = /^\d{4}-\d{2}-\d{2}$/

/**
 * El día de HOY según el reloj del teléfono de quien mira, como 'AAAA-MM-DD'.
 *
 * ⚠️ LOCAL, NUNCA `toISOString()`. Ése da el día en UTC, y en Colombia a partir
 * de las 7 de la tarde UTC ya es mañana: una pérdida de las 8 de la noche se
 * apuntaría al día siguiente y el freno de hoy no la vería. Pasaba de verdad
 * con la fecha que el Diario guardaba hasta el 2026-11-12.
 */
export function diaLocal(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  if (Number.isNaN(d.getTime())) return null
  const dd = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`
}

/**
 * El día en que se CERRÓ una operación (que es cuando su resultado cuenta).
 *
 * Usa `cerradaEl`, que se guarda desde el 2026-11-12 al cerrar. Las de antes no
 * lo tienen y caen a `fecha`, que en una operación cerrada al crearla o
 * importada del bróker ya es el día de cierre — y en una que se abrió un día y
 * se cerró otro, es el de apertura. Esa imprecisión solo afecta a lo viejo.
 *
 * `null` si no hay ninguna fecha legible: una operación sin día no se cuenta
 * en ningún día, en vez de contarse en uno inventado.
 */
export function diaDeCierre(t) {
  for (const v of [t?.cerradaEl, t?.fecha]) if (typeof v === 'string' && ES_DIA.test(v)) return v
  return null
}

// Orden de cierre, del más reciente al más viejo. `cerradaEnMs` se guarda desde
// el 2026-11-12; para lo viejo se cae al momento en que se apuntó.
function momento(t) {
  if (typeof t?.cerradaEnMs === 'number' && Number.isFinite(t.cerradaEnMs)) return t.cerradaEnMs
  const c = t?.creado
  if (c && typeof c.toMillis === 'function') return c.toMillis()
  if (c && typeof c.seconds === 'number') return c.seconds * 1000
  return 0
}

/**
 * Cómo va el día frente a los dos frenos.
 *
 * @param trades  el Diario entero, tal como lo trae `useTrades`
 * @param perfil  el perfil ya leído con `leerPerfil`
 * @param hoy     'AAAA-MM-DD'; por defecto, el día local del teléfono
 *
 * Devuelve `{ estado: 'sinPerfil' }` si falta el perfil, o:
 *   estado      'ok' | 'cerca' | 'freno'
 *   ops         operaciones cerradas hoy
 *   neto        suma de sus resultados (las ganadas compensan las perdidas)
 *   perdido     lo perdido hoy en neto, nunca negativo
 *   limiteUsd   el freno del día en dólares
 *   margen      lo que falta para el freno del día, nunca negativo
 *   racha       pérdidas seguidas hoy, contando desde la última
 *   maxRacha    el freno de pérdidas seguidas
 *   frenoDia, frenoRacha, cercaDia, cercaRacha
 *
 * ⚠️ SE CUENTA EL NETO DEL DÍA, no la suma de las perdidas. El freno del día
 * es sobre lo que la cuenta ha bajado: si se perdió 100 y se ganó 60, la
 * cuenta bajó 40, no 100.
 *
 * ⚠️ LA RACHA ES SOLO DE HOY. Si contara días anteriores, quien paró ayer tras
 * tres pérdidas vería el freno encendido para siempre hasta que ganara una —
 * y una alarma que no se apaga enseña a ignorarla.
 *
 * ⚠️ UN EMPATE (resultado 0) NI SUMA NI CORTA LA RACHA. No es una pérdida, pero
 * tampoco es la ganancia que la cortaría; equivocarse hacia «avisa» cuesta
 * leer un aviso, y hacia «calla» cuesta justo lo que el freno existe para
 * evitar.
 */
export function estadoDelDia(trades, perfil, hoy = diaLocal()) {
  if (!perfilCompleto(perfil)) return { estado: 'sinPerfil' }

  const deHoy = (Array.isArray(trades) ? trades : [])
    .filter((t) => t && t.estado !== 'abierta' && typeof t.pl === 'number' && Number.isFinite(t.pl) && diaDeCierre(t) === hoy)
    .sort((a, b) => momento(b) - momento(a))

  const neto = deHoy.reduce((a, t) => a + t.pl, 0)
  const perdido = Math.max(0, -neto)
  const limiteUsd = frenoEnDolares(perfil)
  const margen = Math.max(0, limiteUsd - perdido)

  let racha = 0
  for (const t of deHoy) {
    if (t.pl < 0) racha++
    else if (t.pl > 0) break
  }
  const maxRacha = perfil.maxPerdidasSeguidas

  // El pequeño margen evita que una pérdida exactamente igual al freno salga
  // 0,0000001 por debajo y no lo encienda.
  const frenoDia = perdido >= limiteUsd - 1e-9
  const frenoRacha = racha >= maxRacha
  const cercaDia = !frenoDia && perdido > 0 && perdido >= limiteUsd * AVISO_CERCA - 1e-9
  const cercaRacha = !frenoRacha && racha > 0 && racha === maxRacha - 1

  const estado = frenoDia || frenoRacha ? 'freno' : cercaDia || cercaRacha ? 'cerca' : 'ok'
  return { estado, ops: deHoy.length, neto, perdido, limiteUsd, margen, racha, maxRacha, frenoDia, frenoRacha, cercaDia, cercaRacha }
}
