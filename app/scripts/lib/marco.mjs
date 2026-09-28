// EL MARCO: medir la MISMA app en otra temporalidad, sin tocar la app.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ ESTE ARCHIVO NO FORMA PARTE DE LA APP Y NO PUEDE CAMBIARLA
// ─────────────────────────────────────────────────────────────────────────
// Vive en `scripts/lib/`, o sea en el banco de pruebas. Ni la app ni el vigía
// ni el publicador lo importan: compruébalo con `grep -r marco.mjs src/`.
// Néstor lo pidió con estas palabras — «hagamos las pruebas, pero sin
// cambiarle o quitarle nada a la app» — y tenía razón: medir una idea no
// justifica tocar el archivo que corre de verdad.
//
// La primera versión de esto SÍ tocaba `src/lib/marketCalc.js` para sacarle
// las ventanas a un parámetro. La app habría hecho exactamente lo mismo (los
// valores por omisión eran los de hoy), pero el riesgo no hacía falta.
//
// ─────────────────────────────────────────────────────────────────────────
// CÓMO SE EVITA QUE ESTA COPIA MIENTA
// ─────────────────────────────────────────────────────────────────────────
// Rearmar el barrido aparte tiene un peligro obvio: que se separe del de la
// app y acabe midiendo otra cosa mientras parece medir la app. Dos defensas,
// y las dos importan:
//
// 1. **LAS CUENTAS NO SE COPIAN, SE IMPORTAN.** `emaLast`, `rsi`, `atrWilder`
//    y `adxWilder` salen de `src/lib/marketCalc.js`, igual que `CCY` y
//    `PAIRS`. Si alguien arregla el RSI en la app, esta medición usa el
//    arreglado sin que nadie tenga que acordarse.
//
// 2. **HAY UNA COMPROBACIÓN QUE COMPARA CONTRA LA APP DE VERDAD.**
//    `prueba-m15.mjs` corre `barridoConMarco(..., MARCO_H1)` y el
//    `computarBarrido` real de la app sobre los mismos datos, y exige que
//    salgan IDÉNTICOS campo por campo. O sea que el día que la app cambie,
//    esta copia se pone roja sola en vez de seguir midiendo lo de ayer.
//
// Lo único que se rearma aquí es el montaje: qué ventana se le pasa a cada
// cuenta. Que es justo lo que hay que poder cambiar.

import { CCY, PAIRS, adxWilder, atrWilder, emaLast, rsi } from '../../src/lib/marketCalc.js'

// ──────────────────────────────────────────────────────────────── EL MARCO
//
// Las ventanas de la app, EN VELAS. `MARCO_H1` son exactamente los números que
// `src/lib/marketCalc.js` tiene escritos hoy; la comprobación de arriba es la
// que garantiza que sigan siéndolo.
export const MARCO_H1 = Object.freeze({
  nombre: 'H1',
  // Cuántas velas hay en una hora de reloj. Es el único número del que salen
  // todos los demás al cambiar de temporalidad.
  porHora: 1,
  // Las tres ventanas de la fuerza relativa: 1 h / 4 h / 24 h.
  fuerza: Object.freeze([1, 4, 24]),
  emaRapida: 9,
  emaLenta: 21,
  // El periodo de Wilder para ATR, ADX y RSI.
  periodo: 14,
  // Cuántos cierres se le entregan al RSI. No es su periodo: es cuánta
  // historia necesita para estabilizarse.
  rsiVentana: 60,
  // Soportes y resistencias, y su versión corta (la que ancla el stop).
  extremos: 20,
  extremosCortos: 10,
  // La ventana contra la que se compara el ATR de ahora para ver si el mercado
  // está comprimido.
  compresion: 12,
  // Un "día de trading": el rango del modo rango y la base de los pivotes.
  dia: 24,
})

// Los topes del factor por hora. Están en `src/lib/marketCalc.js` como
// constantes privadas, así que aquí van repetidos — y la comprobación contra
// el barrido real de la app es la que caza que se separen, porque el
// `factorHora` que sale tiene que coincidir.
const PISO_HORA = 0.6
const TOPE_HORA = 1.2

// El mismo marco medido con el MISMO RELOJ en otra temporalidad.
//
// ⚠️⚠️ ESTA ES LA DECISIÓN DE FONDO, Y LA QUE SE PUEDE HACER MAL SIN QUE NADA
// FALLE. Se escala por RELOJ, no por número de velas: en M15 una EMA de 9
// velas son dos horas y cuarto, no nueve horas. Copiando el 9 tal cual, la
// tabla de M15 y la de H1 medirían dos estrategias distintas pareciendo la
// misma — exactamente el error que ya apareció midiendo el NFX-LSS («un pivote
// de 4 velas son cuatro horas en H1 y una hora en M15»).
//
// Así que TODO se multiplica por `porHora`, sin excepciones y sin redondeos a
// gusto: con 4 velas por hora, la EMA de 9 horas pasa a 36 velas y el periodo
// de Wilder de 14 horas pasa a 56.
//
// 📌 Lo único que NO se escala es el perfil por hora del día: eso no es una
// ventana, es un promedio por hora de reloj. En M15 recibe cuatro veces más
// muestras por casilla y, como el resultado es una proporción contra su propio
// promedio, sale comparable.
// ⚠️ Se exige un ENTERO, no se redondea. La primera versión hacía
// `Math.round(porHora)`, y la prueba cazó que eso convertía `0.5` en `1` sin
// decir nada: media vela por hora no es un marco, es un error de quien llama.
// Redondear a gusto lo habría dejado pasar con un marco plausible y equivocado
// — la misma familia de fallo que todo lo demás de este archivo vigila.
export function marcoEscalado(porHora, nombre) {
  if (!Number.isInteger(porHora) || porHora < 1) {
    throw new Error(`marcoEscalado: porHora tiene que ser un entero ≥ 1, llegó ${porHora}`)
  }
  const k = porHora
  return Object.freeze({
    nombre: nombre ?? `×${k}`,
    porHora: k,
    fuerza: Object.freeze(MARCO_H1.fuerza.map((v) => v * k)),
    emaRapida: MARCO_H1.emaRapida * k,
    emaLenta: MARCO_H1.emaLenta * k,
    periodo: MARCO_H1.periodo * k,
    rsiVentana: MARCO_H1.rsiVentana * k,
    extremos: MARCO_H1.extremos * k,
    extremosCortos: MARCO_H1.extremosCortos * k,
    compresion: MARCO_H1.compresion * k,
    dia: MARCO_H1.dia * k,
  })
}

// Velas de 15 minutos: cuatro por hora.
export const MARCO_M15 = marcoEscalado(4, 'M15')

// Copiada de `src/lib/marketCalc.js`, donde es privada. Twelve Data manda la
// hora como "2026-07-30 02:00:00" sin zona, y `new Date()` la leería como hora
// LOCAL del dispositivo — cinco horas corridas en Colombia.
function aFechaUTC(ts) {
  const s = String(ts).trim().replace(' ', 'T')
  if (/(Z|[+-]\d\d:?\d\d)$/.test(s)) return new Date(s)
  return new Date(s.includes('T') ? s + 'Z' : s + 'T00:00:00Z')
}

function calcularPivots(highs, lows, closes, L, dia) {
  const desde = Math.max(0, L - 2 * dia + 1)
  const hasta = Math.max(desde, L - dia)
  const hi = Math.max(...highs.slice(desde, hasta + 1))
  const lo = Math.min(...lows.slice(desde, hasta + 1))
  const cierre = closes[hasta]
  const p = (hi + lo + cierre) / 3
  return { p, r1: 2 * p - lo, s1: 2 * p - hi, r2: p + (hi - lo), s2: p - (hi - lo) }
}

function perfilPorHora(barras, serieHi, serieLo, serie) {
  const suma = Array(24).fill(0)
  const cuenta = Array(24).fill(0)
  for (let i = 0; i < barras.length; i++) {
    const h = aFechaUTC(barras[i]).getUTCHours()
    let rango = 0
    let n = 0
    for (const c of CCY) {
      if (c === 'USD') continue
      const med = serie[c][i]
      if (!(med > 0)) continue
      rango += (serieHi[c][i] - serieLo[c][i]) / med
      n++
    }
    if (!n) continue
    suma[h] += rango / n
    cuenta[h]++
  }
  const medias = suma.map((s, h) => (cuenta[h] ? s / cuenta[h] : 0))
  const validas = medias.filter((m) => m > 0)
  if (!validas.length) return { crudo: Array(24).fill(1), factor: Array(24).fill(1) }
  const global = validas.reduce((a, b) => a + b, 0) / validas.length
  const crudo = medias.map((m) => (m > 0 ? m / global : 1))
  return { crudo, factor: crudo.map((r) => Math.min(TOPE_HORA, Math.max(PISO_HORA, r))) }
}

// El barrido de la app, con las ventanas que se le pasen.
//
// Devuelve la MISMA forma que `computarBarrido`, más `marco`, para que
// `derivarVista` y el resolver funcionen sin enterarse. Con `MARCO_H1` tiene
// que salir idéntico al de la app: eso es lo que comprueba `prueba-m15.mjs`.
export function barridoConMarco(barras, rates, rangos = null, marco = MARCO_H1) {
  const M = marco ?? MARCO_H1
  const serie = {}
  const serieHi = {}
  const serieLo = {}
  CCY.forEach((c) => {
    serie[c] = barras.map((t) => (c === 'USD' ? 1 : rates[t][c]))
    serieHi[c] = barras.map((t, i) => (c === 'USD' ? 1 : (rangos?.[t]?.[c]?.h ?? serie[c][i])))
    serieLo[c] = barras.map((t, i) => (c === 'USD' ? 1 : (rangos?.[t]?.[c]?.l ?? serie[c][i])))
  })
  const L = barras.length - 1
  const px = (b, q, i) => serie[q][i] / serie[b][i]
  const pxHi = (b, q, i) => serieHi[q][i] / serieLo[b][i]
  const pxLo = (b, q, i) => serieLo[q][i] / serieHi[b][i]
  const chg = (b, q, k) => (px(b, q, L) / px(b, q, Math.max(0, L - k)) - 1) * 100

  const raw = {}
  CCY.forEach((b) => {
    let s = 0
    CCY.forEach((q) => {
      // Los PESOS no se escalan —son cuánto importa cada plazo, no un número
      // de velas—; las ventanas sí, y salen del marco.
      if (q !== b) {
        s += 0.2 * chg(b, q, M.fuerza[0]) + 0.4 * chg(b, q, M.fuerza[1]) + 0.4 * chg(b, q, M.fuerza[2])
      }
    })
    raw[b] = s / 7
  })
  const vals = Object.values(raw)
  const mn = Math.min(...vals)
  const mx = Math.max(...vals)
  const esc = {}
  CCY.forEach((c) => (esc[c] = ((raw[c] - mn) / (mx - mn)) * 10))

  const pares = PAIRS.map(([b, q]) => {
    const closes = barras.map((_, i) => px(b, q, i))
    const highs = barras.map((_, i) => pxHi(b, q, i))
    const lows = barras.map((_, i) => pxLo(b, q, i))
    const c = closes[L]
    const e9 = emaLast(closes, M.emaRapida)
    const e21 = emaLast(closes, M.emaLenta)
    const atrAbs = atrWilder(highs, lows, closes, M.periodo)
    const atrPctH = (atrAbs / c) * 100
    const tend = c > e9 && e9 > e21 ? 'Alcista' : c < e9 && e9 < e21 ? 'Bajista' : 'Rango'
    // ⚠️ `serie20` se queda en 20 PUNTOS y NO se escala: es el gráfico del
    // teléfono, o sea cuántos puntos caben en una rayita, no una ventana de
    // mercado. Escalarlo mandaría 80 números para dibujar lo mismo.
    const last20 = closes.slice(-20)
    const adx = adxWilder(highs, lows, closes, M.periodo)
    const atrMedio = atrWilder(
      highs.slice(0, -M.compresion),
      lows.slice(0, -M.compresion),
      closes.slice(0, -M.compresion),
      M.periodo,
    )
    const compresion = atrMedio > 0 ? atrAbs / atrMedio : 1
    return {
      name: b + '/' + q,
      b,
      q,
      c,
      e9,
      e21,
      rsiV: rsi(closes.slice(-M.rsiVentana), M.periodo),
      atrPctH,
      atrAbs,
      tend,
      adx,
      compresion,
      dif: raw[b] - raw[q],
      hi20: Math.max(...highs.slice(-M.extremos)),
      lo20: Math.min(...lows.slice(-M.extremos)),
      hi10: Math.max(...highs.slice(-M.extremosCortos)),
      lo10: Math.min(...lows.slice(-M.extremosCortos)),
      rangoHi: Math.max(...highs.slice(-M.dia)),
      rangoLo: Math.min(...lows.slice(-M.dia)),
      dec: b === 'JPY' || q === 'JPY' ? 2 : 4,
      serie20: last20,
      highs,
      lows,
      closes,
      esCruce: b !== 'USD' && q !== 'USD',
      pivots: calcularPivots(highs, lows, closes, L, M.dia),
    }
  })

  const ratesUSD = { USD: 1 }
  CCY.slice(1).forEach((cc) => (ratesUSD[cc] = rates[barras[L]][cc]))

  const perfil = perfilPorHora(barras, serieHi, serieLo, serie)

  return {
    barras,
    ultima: barras[L],
    // Con qué ventanas se calculó esto. Va dentro para que ninguna tabla ni
    // ningún log pueda decir «la app» sin decir en qué temporalidad: una
    // etiqueta equivocada es un error de medición, y aquí sería el más fácil de
    // cometer, porque H1 y M15 salen de la misma función.
    marco: M.nombre,
    raw,
    esc,
    pares,
    ratesUSD,
    horaUltima: aFechaUTC(barras[L]).getUTCHours(),
    factorHora: perfil.factor,
    factorHoraCrudo: perfil.crudo,
  }
}

// ─────────────────────────────────────────────────── de M15 a H1, sin pedir
//
// Junta velas cortas en velas de una hora: cierre el último, máximo el mayor,
// mínimo el menor. Sirve para una cosa y solo una: comparar la app en M15
// contra la app en H1 **sobre exactamente los mismos días, los mismos pares y
// la misma descarga**. Medir el H1 en otra corrida metería dos diferencias a la
// vez —la temporalidad y el periodo— y entonces la comparación no dice nada.
//
// ⚠️⚠️ SE AGRUPA POR LA HORA DEL RELOJ, NUNCA DE CUATRO EN CUATRO DESDE EL
// PRINCIPIO. Es el fallo que no da ningún error: si la descarga empieza en una
// vela de :15, agrupar a ciegas produce velas que van de :15 a :15 — «horas»
// que no son horas. Los números saldrían perfectamente creíbles midiendo otra
// cosa. Por eso la clave del grupo es el sello de tiempo truncado a la hora, y
// hay una comprobación dedicada solo a esto.
//
// Devuelve lo mismo que `obtenerVelas`: { barras, rates, rangos }.
export function reagruparAHoras(barras, rates, rangos = null) {
  const grupos = new Map()
  for (const t of barras) {
    const d = aFechaUTC(t)
    if (Number.isNaN(d.getTime())) continue
    const dd = (n, a = 2) => String(n).padStart(a, '0')
    const clave =
      `${dd(d.getUTCFullYear(), 4)}-${dd(d.getUTCMonth() + 1)}-${dd(d.getUTCDate())} ` +
      `${dd(d.getUTCHours())}:00:00`
    if (!grupos.has(clave)) grupos.set(clave, [])
    grupos.get(clave).push(t)
  }

  const salidaBarras = [...grupos.keys()].sort()
  const salidaRates = {}
  const salidaRangos = {}

  for (const clave of salidaBarras) {
    const dentro = grupos.get(clave)
    const ultimo = dentro[dentro.length - 1]
    salidaRates[clave] = { ...rates[ultimo] }
    salidaRangos[clave] = {}
    for (const cc of Object.keys(rates[ultimo] ?? {})) {
      let h = -Infinity
      let l = Infinity
      for (const t of dentro) {
        const cierre = rates[t]?.[cc]
        // Sin máximo ni mínimo de esa vela se cae al cierre, que es lo mismo
        // que hace el barrido cuando no le llegan rangos.
        const hh = rangos?.[t]?.[cc]?.h ?? cierre
        const ll = rangos?.[t]?.[cc]?.l ?? cierre
        if (Number.isFinite(hh)) h = Math.max(h, hh)
        if (Number.isFinite(ll)) l = Math.min(l, ll)
      }
      if (Number.isFinite(h) && Number.isFinite(l)) salidaRangos[clave][cc] = { h, l }
    }
  }

  return { barras: salidaBarras, rates: salidaRates, rangos: salidaRangos }
}
