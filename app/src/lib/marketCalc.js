import { crearT } from './i18n/crearT.js'
import { IDIOMA_BASE, localeDe } from './i18n/idiomas.js'

// Cálculos del barrido intradía: mismo motor que Nestor Forex (portado de los
// prototipos originales) pero recalibrado para velas de 1 hora (H1) en vez de
// velas diarias — ventanas más cortas, EMAs más rápidas, y puntos pivote /
// rango de sesión que solo tienen sentido en intradía.

export const CCY = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD']

export const PAIRS = [
  ['EUR', 'USD'],
  ['GBP', 'USD'],
  ['USD', 'JPY'],
  ['USD', 'CHF'],
  ['USD', 'CAD'],
  ['AUD', 'USD'],
  ['NZD', 'USD'],
  ['EUR', 'CHF'],
  ['EUR', 'CAD'],
  ['EUR', 'NZD'],
  ['GBP', 'CAD'],
  ['GBP', 'JPY'],
  ['NZD', 'CHF'],
  ['NZD', 'CAD'],
  // Pares de la sesión asiática y de Oceanía: sin ellos la app quedaba casi
  // ciega entre las 00:00 y las 09:00 UTC, que es cuando manda Tokio. No
  // cuestan datos extra — se derivan de los mismos 7 símbolos contra USD.
  ['AUD', 'JPY'],
  ['NZD', 'JPY'],
  ['AUD', 'NZD'],
  ['EUR', 'GBP'],
]

// Velas H1 por "día de trading intradía": 24 horas.
const BARRAS_POR_DIA = 24

// ------------------------------------------------------------------ sesiones
//
// El mercado de divisas no es uno solo: son cuatro plazas que se van pasando
// el turno. Cada una mueve sobre todo sus propias divisas, y entre ellas hay
// horas muertas y horas de máxima actividad. La app trataba las 3 de la
// madrugada igual que la apertura de Londres, que es como medir a todo el
// mundo con la misma vara.
//
// Horarios en UTC (Londres y Nueva York se corren una hora en su horario de
// verano; se usan los de invierno, que es la referencia estándar).
export const SESIONES = [
  { clave: 'sesion.sidney', desde: 21, hasta: 6, ccy: ['AUD', 'NZD'] },
  { clave: 'sesion.tokio', desde: 0, hasta: 9, ccy: ['JPY', 'AUD', 'NZD'] },
  { clave: 'sesion.londres', desde: 7, hasta: 16, ccy: ['EUR', 'GBP', 'CHF'] },
  { clave: 'sesion.nuevaYork', desde: 12, hasta: 21, ccy: ['USD', 'CAD'] },
]

// Las sesiones abiertas a una hora UTD dada. Sídney cruza la medianoche, de
// ahí las dos formas de comparar.
export function sesionesEnHora(h) {
  return SESIONES.filter((s) => (s.desde <= s.hasta ? h >= s.desde && h < s.hasta : h >= s.desde || h < s.hasta))
}

// Perfil de actividad por hora del día: cuánto se mueve el mercado en cada
// hora, comparado con su propio promedio. Sale de las velas que ya se
// descargaron, así que no cuesta ni una consulta más.
//
// Sirve para que el umbral no sea el mismo a toda hora: a las 3 de la
// madrugada los movimientos son naturalmente pequeños, así que exigir la
// misma diferencia de fuerza que en la apertura de Londres es pedirle al
// mercado algo que a esa hora no pasa casi nunca. Con el factor, el listón
// baja en las horas quietas y sube en las agitadas.
//
// El recorte de abajo (0.6) es el que hace el trabajo bueno: deja que en las
// horas muertas el listón baje lo que haga falta. El de arriba estuvo en 1.6
// y resultó contraproducente: en las horas más movidas ponía el listón hasta
// un 60% más alto justo cuando más oportunidades pasaban. Medido sobre 240
// horas reales (script comparar-reglas.mjs), la franja de las 8:00 a. m. de
// Colombia daba señal el 20% de las veces con 1.6 y el 30% con 1.2, y el
// total de señales sube de 270 a 286 sin dañar ninguna hora quieta.
const PISO_HORA = 0.6
const TOPE_HORA = 1.2

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
  // Se devuelven las dos versiones: la proporción cruda (para poder volver a
  // medir otros topes sin tocar la app) y la recortada, que es la que se usa.
  const crudo = medias.map((m) => (m > 0 ? m / global : 1))
  return { crudo, factor: crudo.map((r) => Math.min(TOPE_HORA, Math.max(PISO_HORA, r))) }
}

const emaLast = (c, p) => {
  const k = 2 / (p + 1)
  let e = c.slice(0, p).reduce((a, b) => a + b) / p
  for (let i = p; i < c.length; i++) e = c[i] * k + e * (1 - k)
  return e
}

const rsi = (c, p = 14) => {
  let g = 0
  let l = 0
  for (let i = 1; i <= p; i++) {
    const d = c[i] - c[i - 1]
    if (d > 0) g += d
    else l -= d
  }
  g /= p
  l /= p
  for (let i = p + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1]
    g = (g * (p - 1) + Math.max(d, 0)) / p
    l = (l * (p - 1) + Math.max(-d, 0)) / p
  }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l)
}

// ATR real de Wilder sobre 14 velas. Antes se usaba un sustituto
// (promedio de |cierre − cierre anterior|) porque solo se guardaba el cierre
// de cada vela; ahora que llegan el máximo y el mínimo se calcula el rango
// verdadero, que incluye el recorrido *dentro* de cada hora:
//   TR = max(máximo − mínimo, |máximo − cierre previo|, |mínimo − cierre previo|)
// El ATR real es bastante mayor que aquel sustituto, y de él dependen el
// stop y el tamaño del objetivo.
function atrWilder(highs, lows, closes, p = 14) {
  const n = closes.length
  const trs = []
  for (let i = Math.max(1, n - 60); i < n; i++) {
    const cp = closes[i - 1]
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - cp), Math.abs(lows[i] - cp)))
  }
  if (trs.length < p) return trs.reduce((a, b) => a + b, 0) / Math.max(1, trs.length)
  let atr = trs.slice(0, p).reduce((a, b) => a + b, 0) / p
  for (let i = p; i < trs.length; i++) atr = (atr * (p - 1) + trs[i]) / p
  return atr
}

// ADX de Wilder: mide la FUERZA de la tendencia, no su dirección. Las EMAs
// dicen hacia dónde va el precio; el ADX dice si de verdad va hacia alguna
// parte o solo está chapoteando. Por convención: por debajo de 20 no hay
// tendencia que valga, por encima de 25 la hay y es clara.
function adxWilder(highs, lows, closes, p = 14) {
  const n = closes.length
  const desde = Math.max(1, n - 60)
  const tr = []
  const dmMas = []
  const dmMenos = []
  for (let i = desde; i < n; i++) {
    const subeAlto = highs[i] - highs[i - 1]
    const bajaBajo = lows[i - 1] - lows[i]
    dmMas.push(subeAlto > bajaBajo && subeAlto > 0 ? subeAlto : 0)
    dmMenos.push(bajaBajo > subeAlto && bajaBajo > 0 ? bajaBajo : 0)
    const cp = closes[i - 1]
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - cp), Math.abs(lows[i] - cp)))
  }
  if (tr.length < p * 2) return 0
  const suavizar = (xs) => {
    let s = xs.slice(0, p).reduce((a, b) => a + b, 0)
    const out = [s]
    for (let i = p; i < xs.length; i++) {
      s = s - s / p + xs[i]
      out.push(s)
    }
    return out
  }
  const trS = suavizar(tr)
  const masS = suavizar(dmMas)
  const menosS = suavizar(dmMenos)
  const dx = []
  for (let i = 0; i < trS.length; i++) {
    if (!(trS[i] > 0)) continue
    const di1 = (100 * masS[i]) / trS[i]
    const di2 = (100 * menosS[i]) / trS[i]
    const suma = di1 + di2
    if (suma > 0) dx.push((100 * Math.abs(di1 - di2)) / suma)
  }
  if (dx.length < p) return dx.length ? dx.reduce((a, b) => a + b, 0) / dx.length : 0
  let adx = dx.slice(0, p).reduce((a, b) => a + b, 0) / p
  for (let i = p; i < dx.length; i++) adx = (adx * (p - 1) + dx[i]) / p
  return adx
}

// AQUÍ ESTABA LA CONFIRMACIÓN DE 4 HORAS, y se quitó el 2026-08-12.
//
// La idea era razonable: agrupar las velas de 1 hora de cuatro en cuatro y
// exigir que las 4 horas apuntaran al mismo lado que la hora. El problema no
// fue que estuviera mal, sino que NO HACÍA NADA: el banco de pruebas la midió
// sobre 7 meses de velas reales y el veto no descartó ni una sola señal. Con
// la confirmación y sin ella, la app daba exactamente las mismas operaciones,
// una por una.
//
// La razón es que la condición de tendencia de 1 hora (precio > EMA9 > EMA21)
// y la de 4 horas casi nunca se contradicen: las velas H4 se construyen con
// las mismas velas H1, así que cuando la hora está claramente alineada, las
// 4 horas ya lo están o están en "Rango" — y "Rango" nunca vetaba.
//
// Un filtro que nunca filtra no es prudencia, es código que hay que leer y
// mantener cada vez que alguien toca esta parte, y que hace creer que la app
// tiene una protección que en realidad no tiene. Por eso se fue entero.

// Puntos pivote clásicos (P, S1/S2, R1/R2) a partir de las 24 horas previas
// a la vela actual, usadas como aproximación del "día anterior".
// Ahora usan el máximo y el mínimo reales de esas 24 horas (antes eran el
// mayor y el menor de los cierres, que dejaban por fuera las mechas y
// achicaban el rango).
function calcularPivots(highs, lows, closes, L) {
  const desde = Math.max(0, L - 2 * BARRAS_POR_DIA + 1)
  const hasta = Math.max(desde, L - BARRAS_POR_DIA)
  const hi = Math.max(...highs.slice(desde, hasta + 1))
  const lo = Math.min(...lows.slice(desde, hasta + 1))
  const cierre = closes[hasta]
  const p = (hi + lo + cierre) / 3
  return {
    p,
    r1: 2 * p - lo,
    s1: 2 * p - hi,
    r2: p + (hi - lo),
    s2: p - (hi - lo),
  }
}

// Twelve Data devuelve la hora como "2026-07-30 02:00:00", sin zona. Se le
// pide explícitamente timezone=UTC al API (su valor por omisión es la zona del
// mercado, que venía adelantada varias horas y hacía que el reporte mostrara
// velas "del futuro"). Aun así hay que convertirla a mano: `new Date('2026-07-30
// 02:00:00')` la leería como hora *local* del dispositivo, o sea 5 horas
// corridas en Colombia.
function aFechaUTC(ts) {
  const s = String(ts).trim().replace(' ', 'T')
  if (/(Z|[+-]\d\d:?\d\d)$/.test(s)) return new Date(s)
  return new Date(s.includes('T') ? s + 'Z' : s + 'T00:00:00Z')
}

// barras: array de timestamps ISO (UTC) ascendentes, uno por vela H1.
// rates: { [timestamp]: { EUR, GBP, JPY, CHF, AUD, NZD, CAD } } — cuántas
// unidades de esa divisa vale 1 USD en esa hora (cierre de la vela).
// rangos (opcional): { [timestamp]: { EUR: { h, l }, ... } } — máximo y
// mínimo de esa misma vela. Twelve Data ya los mandaba en la misma
// respuesta y se estaban descartando. Si no llegan, todo cae de vuelta al
// comportamiento anterior (máximo = mínimo = cierre).
export function computarBarrido(barras, rates, rangos = null) {
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
  // El precio del par es divisa cotizada / divisa base, así que su máximo se
  // da con el máximo de la cotizada contra el mínimo de la base. En los 7
  // pares contra el dólar una de las dos es constante (=1), así que el
  // resultado es exacto; en los cruces (EUR/CHF, AUD/JPY…) es una cota
  // superior del rango real, algo más amplia que la verdadera.
  const pxHi = (b, q, i) => serieHi[q][i] / serieLo[b][i]
  const pxLo = (b, q, i) => serieLo[q][i] / serieHi[b][i]
  const chg = (b, q, k) => (px(b, q, L) / px(b, q, Math.max(0, L - k)) - 1) * 100

  const raw = {}
  CCY.forEach((b) => {
    let s = 0
    CCY.forEach((q) => {
      // Ventanas cortas de intradía: 1h / 4h / 24h (en vez de 1d / 5d / 20d).
      if (q !== b) s += 0.2 * chg(b, q, 1) + 0.4 * chg(b, q, 4) + 0.4 * chg(b, q, 24)
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
    const e9 = emaLast(closes, 9)
    const e21 = emaLast(closes, 21)
    const atrAbs = atrWilder(highs, lows, closes)
    const atrPctH = (atrAbs / c) * 100
    const tend = c > e9 && e9 > e21 ? 'Alcista' : c < e9 && e9 < e21 ? 'Bajista' : 'Rango'
    const last20 = closes.slice(-20)

    // Fuerza de la tendencia (ADX).
    const adx = adxWilder(highs, lows, closes)
    // Compresión: el ATR de ahora contra su propio promedio reciente. Muy por
    // debajo de 1 significa que el mercado lleva rato quieto — suele ser la
    // antesala de un estallido, no un lateral tranquilo para operar rebotes.
    const atrMedio = atrWilder(highs.slice(0, -12), lows.slice(0, -12), closes.slice(0, -12))
    const compresion = atrMedio > 0 ? atrAbs / atrMedio : 1
    return {
      name: b + '/' + q,
      b,
      q,
      c,
      e9,
      e21,
      rsiV: rsi(closes.slice(-60)),
      atrPctH,
      atrAbs,
      tend,
      adx,
      compresion,
      dif: raw[b] - raw[q],
      // Soportes y resistencias con los extremos reales de las velas, no con
      // el mayor y el menor de los cierres: es donde el precio realmente
      // llegó y se devolvió.
      hi20: Math.max(...highs.slice(-20)),
      lo20: Math.min(...lows.slice(-20)),
      hi10: Math.max(...highs.slice(-10)),
      lo10: Math.min(...lows.slice(-10)),
      // Techo y piso del último día completo (24 velas H1). Es el rango con el
      // que trabaja el modo rango: más largo que las 20 velas de los soportes
      // para que un lateral de verdad se note, y no una pausa de dos horas.
      rangoHi: Math.max(...highs.slice(-BARRAS_POR_DIA)),
      rangoLo: Math.min(...lows.slice(-BARRAS_POR_DIA)),
      dec: b === 'JPY' || q === 'JPY' ? 2 : 4,
      serie20: last20,
      // Las series completas de máximos y mínimos, alineadas con `barras`.
      // Las usa `scripts/lib/resolver.mjs` para saber si una señal llegó a su
      // objetivo o a su stop: hace falta el recorrido entero, no solo el
      // último valor. Se exponen desde aquí en vez de recalcularlas fuera
      // para que no puedan quedar desalineadas con lo que ve el barrido.
      //
      // ⚠️ En los 7 pares contra el dólar son exactos (una de las dos divisas
      // es constante). En los 7 cruces son una cota algo MÁS ANCHA que el
      // rango real, así que un nivel puede darse por tocado sin haberlo sido.
      // `esCruce` lo marca para que quien los use lo diga.
      highs,
      lows,
      // Los cierres, por el mismo motivo y con la misma advertencia: quien
      // necesite el recorrido entero —el rompimiento de apertura entra al
      // cierre de la vela que rompe— tiene que leerlo de aquí y no
      // recalcularlo por su cuenta, o acabaría desalineado con lo que ve el
      // barrido.
      closes,
      esCruce: b !== 'USD' && q !== 'USD',
      pivots: calcularPivots(highs, lows, closes, L),
    }
  })

  const ratesUSD = { USD: 1 }
  CCY.slice(1).forEach((c) => (ratesUSD[c] = rates[barras[L]][c]))

  const perfil = perfilPorHora(barras, serieHi, serieLo, serie)

  return {
    barras,
    ultima: barras[L],
    raw,
    esc,
    pares,
    ratesUSD,
    horaUltima: aFechaUTC(barras[L]).getUTCHours(),
    factorHora: perfil.factor,
    // Sin recortar. No lo usa la app: sirve para que el script de medición
    // pueda simular otros topes sin tener que tocar este archivo.
    factorHoraCrudo: perfil.crudo,
  }
}

// ADX mínimo para dar una señal de TENDENCIA.
//
// HISTORIA DE ESTE NÚMERO, PORQUE ES UNA LECCIÓN CARA
//
// Nació en 20, el valor de manual. El 2026-08-12 lo subí a 35 porque el banco
// de pruebas, sobre 7 meses, decía que pasaba de −0,12 a −0,06 por unidad de
// riesgo. El 2026-08-17 se volvió a medir sobre 35 MESES y el resultado fue:
//
//     sin filtro   47% de acierto   −0,12        ADX ≥ 30   46%   −0,14
//     ADX ≥ 20     46%              −0,12        ADX ≥ 35   46%   −0,13
//     ADX ≥ 25     46%              −0,13        ADX ≥ 40   46%   −0,14
//
// El ADX NO HACE NADA. Ni en 20, ni en 35, ni en 40: el acierto es 46-47% en
// todos y el resultado es el mismo. Aquella mejora de 7 meses era ruido de una
// ventana corta, y yo la presenté como un hallazgo.
//
// Se vuelve a 20 —no porque 20 sea bueno, sino porque 35 recortaba la MITAD de
// las señales a cambio de nada—. Con todos los números iguales, gana el umbral
// que deja más información a la vista: 103 señales al mes contra 207.
//
// LA LECCIÓN, que vale más que el número: una mejora medida sobre una ventana
// corta no es una mejora. Antes de mover una constante por un resultado, hay
// que verla aguantar en dos mitades del tiempo o en varios años. Esto costó
// cinco días de señales recortadas a la mitad para nada.
const ADX_MIN = 20

// ⚠️ EL DE RANGO ES OTRO NÚMERO, Y ES A PROPÓSITO.
//
// El ADX se usa para dos cosas opuestas: una señal de tendencia lo quiere
// ALTO (que la tendencia empuje) y una de rango lo quiere BAJO (que no haya
// tendencia que se le atraviese). Antes los dos salían de la misma constante,
// y eso hacía que subir el listón de tendencia AFLOJARA sin querer el de
// rango: pasar de 20 a 35 habría dejado entrar como "rango" todo lo que
// tuviera ADX entre 20 y 35, que es justamente una tendencia arrancando.
//
// Habría sido un cambio silencioso, en la dirección contraria a la que se
// pretendía, y en la parte de la app que nadie estaba tocando. Por eso el de
// rango se queda en 20, que es donde estaba y donde se midió.
const ADX_MAX_RANGO = 20

// Una señal de tendencia necesita dos cosas:
//   · diferencia de fuerza suficiente (lo de siempre),
//   · EMAs alineadas Y ADX por encima de ADX_MIN — que la tendencia empuje.
// Si la fuerza está pero falta lo segundo, no se descarta: baja a VIGILAR,
// que es información útil ("está por darse, pero todavía no").
// El umbral es un parámetro y no una constante fija para que el banco de
// pruebas pueda medir otros valores SIN duplicar aquí la lógica de selección.
// Si la copiara, un día las dos versiones dirían cosas distintas y no
// sabríamos cuál creer. El valor por defecto es el que usa la app.
// EL FILTRO DE "NO PERSEGUIR", APAGADO POR AHORA.
//
// `null` = apagado, y la app se comporta EXACTAMENTE igual que sin este
// código. Con un número N, una COMPRA se rechaza si el RSI ya está en N o más,
// y una VENTA si está en 100−N o menos: o sea, no se entra cuando el
// movimiento ya se hizo.
//
// De dónde sale la idea, y por qué no basta con que salga tres veces:
//
//   · Historial real, 37 operaciones (2026-08-24): entrando con RSI ≥70 o ≤30
//     el acierto fue 12% (−0,74 por 1R); entrando entre 30 y 70, 50% (+0,22).
//   · La medición sobre 3 años apuntó igual al trocear por RSI.
//   · El historial viejo de 11 operaciones, también.
//
// PERO las tres son TROCEOS A POSTERIORI: partir los resultados después de
// verlos. Con suficientes cortes siempre aparece uno que separa las buenas de
// las malas en los datos que ya tienes y no sirve para nada después. Por eso
// esto se escribe como filtro de verdad —que rechaza la señal, no que la borra
// al final— y se mide con un barrido de umbrales y en las dos mitades del
// tiempo por separado. Si solo funciona justo en 70, es casualidad.
//
// ENCENDIDO EN 70 el 2026-08-25, después de medirlo de frente sobre 35 meses:
//
//     sin filtro   46% de acierto   −0,12 por 1R   (208 señales/mes)
//     RSI ≥ 75     47%              −0,11          (195)
//     RSI ≥ 70     47%              −0,10          (141)   ← las dos mitades: −0,10 y −0,11
//     RSI ≥ 65     46%              −0,12          (69)
//     RSI ≥ 60     44%              −0,17          (17)
//
// Se elige 70 porque pasa las tres pruebas que el ADX no pasó: la curva es
// SUAVE (mejora de 80 a 75 a 70 y luego empeora, no es un pico aislado en un
// número exacto), aguanta en las DOS mitades del tiempo por separado, y deja
// 141 señales al mes, así que no enmudece la app.
//
// ⚠️ PERO EL EFECTO ES PEQUEÑO, y esto hay que leerlo entero antes de
// contárselo a nadie. Los troceos a posteriori decían 12% de acierto contra
// 50% —38 puntos—. Medido de frente sobre 7.340 operaciones son 46% contra
// 47%: UN punto. Aquel 12% salía de 17 operaciones, donde un 12% y un 45% son
// la misma moneda.
//
// Esto NO convierte la app en ganadora. La deja perdiendo −0,10 por unidad de
// riesgo en vez de −0,12. Se enciende porque es mejor que lo de antes y no
// cuesta nada, no porque resuelva el problema.
const RSI_MAX = 70

const clasificar = (p, thr, { adxMin = ADX_MIN, rsiMax = RSI_MAX } = {}) => {
  const fuerte = p.adx >= adxMin
  // "Extendido" es simétrico: comprar con el RSI arriba y vender con el RSI
  // abajo son el mismo error visto en el espejo.
  const estirado = rsiMax !== null && (p.dif > 0 ? p.rsiV >= rsiMax : p.rsiV <= 100 - rsiMax)
  if (p.dif > thr && p.tend === 'Alcista' && fuerte && !estirado) return 'COMPRA'
  if (p.dif < -thr && p.tend === 'Bajista' && fuerte && !estirado) return 'VENTA'
  if (Math.abs(p.dif) > thr) return 'VIGILAR'
  return '—'
}

// Por qué un par con fuerza se quedó en vigilancia. Sirve para que el texto
// diga algo concreto en vez de repetir siempre lo mismo.
// Los umbrales se reciben para que digan la verdad cuando el banco de pruebas
// los mueve. Con la constante escrita a mano, el texto explicaría un rechazo
// que no fue el que ocurrió.
const motivoVigilar = (p, thr, { adxMin = ADX_MIN, rsiMax = RSI_MAX } = {}) => {
  if (Math.abs(p.dif) <= thr) return null
  const lado = p.dif > 0 ? 'Alcista' : 'Bajista'
  if (p.tend !== lado) return 'tend'
  if (p.adx < adxMin) return 'adx'
  // El mismo orden que en `clasificar`: si aquello rechazó por RSI, esto tiene
  // que decir RSI y no otra cosa.
  if (rsiMax !== null && (p.dif > 0 ? p.rsiV >= rsiMax : p.rsiV <= 100 - rsiMax)) return 'rsi'
  return 'tend'
}

// ---------------------------------------------------------------- modo rango
//
// Hasta ahora la app solo sabía operar tendencia: si el par estaba lateral,
// callaba. Y el mercado está lateral buena parte del tiempo — de ahí los
// reportes intradía que salían completamente vacíos varios días seguidos.
//
// El modo rango opera lo contrario: dentro de un lateral con techo y piso
// claros, se compra cerca del piso y se vende cerca del techo. Las
// condiciones son deliberadamente estrictas, porque un rango mal identificado
// es una tendencia a la que uno se le atraviesa:
//
//   1. El par NO puede estar en tendencia (precio y EMAs sin alinear).
//   2. El rango del último día tiene que medir al menos 3 ATR: si es más
//      angosto no hay recorrido que valga la pena y el stop no cabe.
//   3. El precio tiene que estar en el 30% de abajo (compra) o de arriba
//      (venta) del rango; en la mitad del medio no hay nada que hacer.
//   4. El RSI tiene que acompañar: no se compra un piso con el RSI todavía
//      alto ni se vende un techo con el RSI ya hundido.
const RANGO_MIN_ATR = 3
const RANGO_BORDE = 0.3
// Por debajo de este cociente el mercado lleva rato apretándose: es la
// antesala típica de una ruptura, no un lateral tranquilo donde operar
// rebotes. Vender el techo justo antes de que estalle es la peor operación
// posible, así que en compresión el modo rango se calla.
const COMPRESION_MIN = 0.75

// ⚠️ `adxMax` es SUYO y no el de las señales de tendencia. Desde que el de
// tendencia subió a 35, ya ni siquiera valen lo mismo: este se quedó en 20
// (ver `ADX_MAX_RANGO`). Aparte de eso, al MEDIR hay que poder moverlos por
// separado. Si no, subir el listón a las de tendencia le abre la puerta a
// muchas más de rango sin querer, y el resultado mezcla dos cambios.
//
// Eso pasó de verdad: la primera medición del ADX daba "sin filtro salen
// MENOS operaciones", que no tiene sentido para un filtro. El motivo era que
// poner el umbral en 0 dejaba a las de rango exigiendo un ADX menor que cero,
// o sea borrándolas todas.
const clasificarRango = (p, { adxMax = ADX_MAX_RANGO, compresionMin = COMPRESION_MIN } = {}) => {
  if (p.tend !== 'Rango') return null
  // Un ADX alto con las EMAs sin alinear es una tendencia arrancando, no un
  // rango: tampoco es sitio para operar rebotes.
  if (p.adx >= adxMax) return null
  if (p.compresion < compresionMin) return null
  const amplitud = p.rangoHi - p.rangoLo
  if (!(amplitud > 0) || amplitud < RANGO_MIN_ATR * p.atrAbs) return null
  const pos = (p.c - p.rangoLo) / amplitud
  if (pos <= RANGO_BORDE && p.rsiV <= 50) return 'COMPRA'
  if (pos >= 1 - RANGO_BORDE && p.rsiV >= 50) return 'VENTA'
  return null
}

const razonRango = (p, t) => {
  const d = p.dec
  const amplitud = p.rangoHi - p.rangoLo
  return t(clasificarRango(p) === 'COMPRA' ? 'calc_barrido.rangoCompra' : 'calc_barrido.rangoVenta', {
    lo: p.rangoLo.toFixed(d),
    hi: p.rangoHi.toFixed(d),
    atr: (amplitud / p.atrAbs).toFixed(1),
    rsi: p.rsiV.toFixed(0),
  })
}

// ------------------------------------------------------- entrar en retroceso
//
// EL HUECO QUE LA APP NUNCA HA PODIDO OPERAR.
//
// Hasta hoy la app solo sabía dos cosas: hay tendencia (y entonces entra) o no
// la hay (y entonces mira si es un rango). Entre las dos no queda sitio para
// lo más clásico del oficio: hay tendencia fuerte, el precio se devolvió un
// poco, y se entra AHÍ en vez de perseguirlo estirado.
//
// No es que se midiera y saliera mal: es que no se podía dar. Para llamar
// "Alcista" a un par, `tend` exige precio > EMA9 > EMA21, o sea que el precio
// ya se fue arriba. En cuanto el precio se devuelve a la EMA9, el par pasa a
// "Rango" — y el modo rango exige ADX bajo, así que también lo rechaza. El
// resultado medido: CERO operaciones de este tipo en 7 meses. Un hueco, no un
// veredicto.
//
// Importa porque lo medido apunta justo ahí: troceando por RSI, entrar cuando
// el precio ya se retrocedió salía mejor que entrar estirado, y salía en los
// DOS lados por separado (comprando y vendiendo), que es lo que lo hace
// creíble y no una casualidad de un lado.
//
// Las condiciones, y por qué cada una:
//   1. Las medias siguen ordenadas (EMA9 > EMA21 al comprar). Es la tendencia,
//      y a diferencia de `tend` NO mira dónde está el precio ahora mismo.
//   2. ADX por encima del umbral: la tendencia empuja de verdad.
//   3. El precio se devolvió hasta la EMA9 o más abajo. Esto es el retroceso.
//   4. Pero NO ha roto la EMA21. Si la rompe ya no es un retroceso, es una
//      vuelta, y entrar ahí es ponerse delante del cambio de tendencia.
//   5. La fuerza relativa acompaña, igual que en el resto de la app.
//
// ⚠️ ARRANCA APAGADO (`incluirRetrocesos`). Está sin medir, y la regla de esta
// casa es que ninguna señal llega a Néstor antes de tener su número. El banco
// de pruebas lo enciende; la app no. Si mide bien, se enciende aquí en una
// línea; si mide mal, se borra y quedó el porqué escrito.
const clasificarRetroceso = (p, thr, { adxMin = ADX_MIN } = {}) => {
  if (p.adx < adxMin) return null
  if (p.e9 > p.e21 && p.dif > thr && p.c <= p.e9 && p.c > p.e21) return 'COMPRA'
  if (p.e9 < p.e21 && p.dif < -thr && p.c >= p.e9 && p.c < p.e21) return 'VENTA'
  return null
}

const razonRetroceso = (p, esc, t) => {
  const compra = p.e9 > p.e21
  return t(compra ? 'calc_barrido.retrocesoCompra' : 'calc_barrido.retrocesoVenta', {
    b: p.b,
    fb: esc[p.b].toFixed(1),
    q: p.q,
    fq: esc[p.q].toFixed(1),
    adx: p.adx.toFixed(0),
    rsi: p.rsiV.toFixed(0),
  })
}

// El stop va al otro lado de la EMA21, que es lo que define que el retroceso
// siga siendo un retroceso. Con un mínimo de 1 ATR de distancia: si el precio
// está pegadito a la EMA21, un stop a dos pips sería ruido puro y además
// inflaría la relación riesgo/beneficio con un denominador falso — el mismo
// error que ya nos costó caro en la app de swing.
const nivelesRetroceso = (p, compra) => {
  const sl = compra
    ? Math.min(p.e21 - 0.5 * p.atrAbs, p.c - p.atrAbs)
    : Math.max(p.e21 + 0.5 * p.atrAbs, p.c + p.atrAbs)
  return { sl, tp: objetivo(p, compra) }
}

const razon = (p, esc, t) => {
  const extra =
    p.rsiV > 70 || p.rsiV < 30
      ? t('calc_barrido.rsiExtendido')
      : p.rsiV >= 40 && p.rsiV <= 60
        ? t('calc_barrido.rsiContinuacion')
        : ''
  return t('calc_barrido.razon', {
    b: p.b,
    fb: esc[p.b].toFixed(1),
    q: p.q,
    fq: esc[p.q].toFixed(1),
    rsi: p.rsiV.toFixed(0),
    extra: t('calc_barrido.adxOk', { adx: p.adx.toFixed(0) }) + extra,
  })
}

// Cuántos ATR se pone el stop desde la entrada. Antes el stop iba al extremo
// de las últimas 10 velas menos ½ ATR, y eso tenía un efecto perverso: en una
// tendencia sana ese extremo queda lejísimos, así que el riesgo se disparaba
// mientras el objetivo seguía a 2 ATR — de ahí que casi todos los setups
// nacieran con relación 1:0.4 … 1:0.8, siempre marcados con aviso. Con el
// stop a 1.5 ATR el riesgo queda proporcional a lo movido que esté el par,
// que es lo que el ATR mide.
const ATR_STOP = 1.5

// El objetivo es el primer obstáculo real que el precio se va a encontrar:
// el extremo de las últimas 20 velas o los pivotes de sesión, el que quede
// más cerca — siempre que esté al menos a 1 ATR, para no proponer objetivos
// pegados a la entrada. Si no hay ninguno a esa distancia (precio en tierra
// de nadie), se usan 2.5 ATR.
//
// Antes el objetivo era el extremo de 20 velas o 2 ATR, el que quedara más
// lejos. Con el ATR real —tres veces mayor que el sustituto anterior— los
// 2 ATR ganaban siempre, así que TODAS las señales salían con la misma
// relación 1:1.3 y el aviso de "por debajo de 1:1.5" se disparaba en el
// 100% de los casos: un número constante no informa nada. Tomando el nivel
// más cercano, la relación vuelve a depender de cuánto recorrido real tiene
// cada par, que es lo que hay que mirar antes de entrar.
const objetivo = (p, compra) => {
  const min = p.c + (compra ? 1 : -1) * p.atrAbs
  const niveles = compra
    ? [p.hi20, p.pivots.r1, p.pivots.r2].filter((x) => x > min)
    : [p.lo20, p.pivots.s1, p.pivots.s2].filter((x) => x < min)
  if (!niveles.length) return p.c + (compra ? 1 : -1) * 2.5 * p.atrAbs
  return compra ? Math.min(...niveles) : Math.max(...niveles)
}

// En un rango el stop y el objetivo no salen del ATR sino del propio rango:
// el stop va medio ATR por fuera del borde (si el precio lo rompe, ya no era
// un rango y la idea murió) y el objetivo al otro lado, dejando un 20% de
// margen porque el precio suele darse la vuelta antes de tocar el extremo
// exacto.
const nivelesRango = (p, compra) => {
  const amplitud = p.rangoHi - p.rangoLo
  return compra
    ? { sl: p.rangoLo - 0.5 * p.atrAbs, tp: p.rangoHi - 0.2 * amplitud }
    : { sl: p.rangoHi + 0.5 * p.atrAbs, tp: p.rangoLo + 0.2 * amplitud }
}

const mkSetup = (p, lado, esc = {}, t, tipo = 'tendencia') => {
  const d = p.dec
  const compra = lado === 'COMPRA'
  const esRango = tipo === 'rango'
  const { sl, tp } = esRango
    ? nivelesRango(p, compra)
    : tipo === 'retroceso'
      ? nivelesRetroceso(p, compra)
      : { sl: compra ? p.c - ATR_STOP * p.atrAbs : p.c + ATR_STOP * p.atrAbs, tp: objetivo(p, compra) }
  const rr = Math.abs(tp - p.c) / Math.abs(p.c - sl)
  return {
    name: p.name,
    lado,
    tipo,
    // Los campos de abajo son texto ya armado, que es lo que consumen el
    // tablero y el reporte .md. `crudo` lleva los mismos datos sin formatear,
    // para la pantalla de detalle, que necesita dibujarlos y no solo leerlos.
    crudo: {
      b: p.b,
      q: p.q,
      dec: d,
      compra,
      precio: p.c,
      sl,
      tp,
      ema: p.e9,
      rr,
      // Distancias al stop y al objetivo, en pips (JPY cotiza a 2 decimales,
      // así que ahí un pip es 0.01 y no 0.0001).
      pipRiesgo: Math.abs(p.c - sl) / (d === 2 ? 0.01 : 0.0001),
      pipBeneficio: Math.abs(tp - p.c) / (d === 2 ? 0.01 : 0.0001),
      sup: p.lo20,
      res: p.hi20,
      // No los usa ninguna pantalla: los necesita
      // `scripts/lib/backtest-nucleo.mjs` para poder calcular geometrías de
      // stop y objetivo distintas a la de aquí y compararlas con datos reales.
      // Exponerlos evita que el banco de pruebas los recalcule por su cuenta y
      // acabe midiendo números que no son los que ve la app.
      atrAbs: p.atrAbs,
      adx: p.adx,
      pivote: p.pivots.p,
      serie20: p.serie20,
      rsi: Math.round(p.rsiV),
      atrPct: p.atrPctH,
      tend: p.tend,
      fuerzaB: esc[p.b],
      fuerzaQ: esc[p.q],
      tipo,
      rangoLo: p.rangoLo,
      rangoHi: p.rangoHi,
    },
    sup: (esRango ? p.rangoLo : p.lo20).toFixed(d),
    res: (esRango ? p.rangoHi : p.hi20).toFixed(d),
    entrada: esRango
      ? t('calc_barrido.entradaRango', {
          precio: p.c.toFixed(d),
          borde: (compra ? p.rangoLo : p.rangoHi).toFixed(d),
        })
      : t('calc_barrido.entrada', { precio: p.c.toFixed(d), ema: p.e9.toFixed(d) }),
    sl:
      sl.toFixed(d) +
      (esRango
        ? compra
          ? t('calc_barrido.slRangoCompra')
          : t('calc_barrido.slRangoVenta')
        : compra
          ? t('calc_barrido.slCompra')
          : t('calc_barrido.slVenta')),
    tp: tp.toFixed(d),
    rr: '1:' + rr.toFixed(1) + (rr < 1.5 ? t('calc_barrido.rbBajo') : ''),
    rrOk: rr >= 1.5,
    pivots: {
      p: p.pivots.p.toFixed(d),
      s1: p.pivots.s1.toFixed(d),
      s2: p.pivots.s2.toFixed(d),
      r1: p.pivots.r1.toFixed(d),
      r2: p.pivots.r2.toFixed(d),
    },
    inval: esRango
      ? t(compra ? 'calc_barrido.invalRangoCompra' : 'calc_barrido.invalRangoVenta', {
          borde: (compra ? p.rangoLo : p.rangoHi).toFixed(d),
        })
      : compra
        ? t('calc_barrido.invalCompra', { sl: sl.toFixed(d), b: p.b })
        : t('calc_barrido.invalVenta', { sl: sl.toFixed(d), q: p.q }),
  }
}

const porDifAbs = (a, b) => Math.abs(b.dif) - Math.abs(a.dif)

// data: salida de computarBarrido(). Devuelve todo ya formateado para las pantallas.
//
// Aquí había un parámetro `vivo` que solo cambiaba la etiqueta de la fuente
// cuando el precio venía de Capital.com. Esa capa se quitó (ver el comentario
// largo en useMarketData.js: obligaba a publicar una contraseña en el
// navegador), así que la fuente es siempre la misma y el parámetro sobraba.
/**
 * @param adxMin       ADX mínimo para dar señal de TENDENCIA (la app: 35).
 * @param adxMaxRango  ADX máximo para dar señal de RANGO (la app: 20). Va
 *                     aparte del anterior: moverlos juntos mezcla dos cambios
 *                     y el resultado no dice nada (ver `clasificarRango`).
 * @param compresionMin compresión mínima para las señales de rango.
 * @param rsiMax       filtro de "no perseguir": rechaza la COMPRA si el RSI ya
 *                     está en `rsiMax` o más, y la VENTA si está en
 *                     `100 - rsiMax` o menos. `undefined`/`null` = apagado, que
 *                     es como corre la app hoy (ver `RSI_MAX`).
 * @param incluirRetrocesos enciende el tipo de señal "entrar en retroceso"
 *                     (ver `clasificarRetroceso`). APAGADO por defecto: está
 *                     sin medir, y aquí no sale nada a la calle sin su número.
 *                     Lo enciende el banco de pruebas, no la app.
 *
 * Los primeros existen para poder MEDIR la app con otros valores sin copiar
 * aquí la lógica de selección. Sin tocarlos, se comporta exactamente igual.
 */
export function derivarVista(
  data,
  {
    thr = 0.5,
    topN = 3,
    t = crearT(IDIOMA_BASE),
    locale,
    adxMin,
    adxMaxRango,
    compresionMin,
    rsiMax,
    incluirRetrocesos = false,
  } = {}
) {
  const cls = (p) => clasificar(p, thr, { adxMin, rsiMax })
  // Ojo: `adxMaxRango`, no `adxMin`. Son dos umbrales distintos y con valores
  // distintos — ver el comentario de `clasificarRango`.
  const clsRango = (p) => clasificarRango(p, { adxMax: adxMaxRango, compresionMin })
  const { esc, pares: paresRaw } = data

  // Sesiones abiertas y umbral ajustado a la hora. Se usa la hora de la
  // última vela, no la del reloj del teléfono: así el barrido y su etiqueta
  // hablan del mismo momento aunque el dato venga con retraso.
  const hora = data.horaUltima ?? new Date().getUTCHours()
  const factor = data.factorHora?.[hora] ?? 1
  const abiertas = sesionesEnHora(hora)
  const ccyFoco = [...new Set(abiertas.flatMap((s) => s.ccy))]
  const sesion = {
    claves: abiertas.map((s) => s.clave),
    ccyFoco,
    factor,
    // El solape de Londres con Nueva York es la franja de más movimiento del
    // día, y vale la pena decirlo aparte.
    solape: abiertas.some((s) => s.clave === 'sesion.londres') && abiertas.some((s) => s.clave === 'sesion.nuevaYork'),
  }
  thr = thr * factor

  const monedas = Object.keys(esc)
    .sort((a, b) => esc[b] - esc[a])
    .map((cod) => ({ cod, score: esc[cod] }))

  const pares = paresRaw.map((p) => ({
    name: p.name,
    b: p.b,
    q: p.q,
    dif: p.dif,
    sesgo: cls(p),
    tend: p.tend,
    rsi: Math.round(p.rsiV),
    atr: p.atrPctH,
    precio: p.c,
    dec: p.dec,
    serie20: p.serie20,
    cambio20: ((p.serie20.at(-1) - p.serie20[0]) / p.serie20[0]) * 100,
    pivots: p.pivots,
    // Oportunidad de rango, aparte del sesgo de tendencia: un par puede no
    // tener sesgo (está lateral) y aun así ser operable dentro de su rango.
    rango: clsRango(p),
    // Si alguna de las dos divisas del par pertenece a una sesión abierta.
    enSesion: ccyFoco.includes(p.b) || ccyFoco.includes(p.q),
  }))

  // Entre dos candidatos igual de buenos, primero el de la sesión abierta:
  // es el que de verdad se está moviendo a esta hora.
  const enFoco = (p) => (ccyFoco.includes(p.b) || ccyFoco.includes(p.q) ? 1 : 0)
  const cands = [...paresRaw].sort((a, b) => enFoco(b) - enFoco(a) || porDifAbs(a, b))
  const comprasRaw = cands.filter((p) => cls(p) === 'COMPRA').slice(0, 5)
  const ventasRaw = cands.filter((p) => cls(p) === 'VENTA').slice(0, 5)
  const vigilanciaRaw = cands.filter((p) => cls(p) === 'VIGILAR').slice(0, 4)

  const compras = comprasRaw.map((p) => ({ name: p.name, razon: razon(p, esc, t) }))
  const ventas = ventasRaw.map((p) => ({ name: p.name, razon: razon(p, esc, t) }))
  const vigilancia = vigilanciaRaw.map((p) => {
    const motivo = motivoVigilar(p, thr, { adxMin, rsiMax })
    // En una COMPRA el filtro rechaza con el RSI POR ENCIMA del umbral (70);
    // en una VENTA, por debajo del umbral espejo (100 - 70 = 30). Son dos
    // frases distintas: decir "por encima de 70" junto a un RSI de 12 —que es
    // lo que salía— no tiene sentido para quien lo lee.
    const rsiAlto = p.dif > 0
    const umbralRsi = rsiMax ?? RSI_MAX
    const datos = {
      dif: (p.dif >= 0 ? '+' : '') + p.dif.toFixed(1),
      favor: p.dif > 0 ? p.b : p.q,
      tend: t(`tend.${p.tend}`).toLowerCase(),
      adx: p.adx.toFixed(0),
      // El RSI del par. Faltaba, y el texto de `vigilanciaRsi` lo pide: sin
      // él salía la palabra "undefined" donde debía ir el número.
      rsi: p.rsiV.toFixed(0),
      // El umbral viaja al texto en vez de estar escrito dentro de cada
      // idioma: si algún día vuelve a moverse, no hay que acordarse de
      // corregir 13 archivos (y de que uno se quede con el número viejo).
      min: adxMin ?? ADX_MIN,
      // El umbral del RSI viaja igual que el del ADX y por la misma razón: si
      // algún día se mueve, no hay que acordarse de corregir 13 archivos. Va
      // el que de verdad se aplicó, no siempre el de la compra.
      minRsi: umbralRsi === null ? null : rsiAlto ? umbralRsi : 100 - umbralRsi,
    }
    const clave =
      motivo === 'adx'
        ? 'calc_barrido.vigilanciaAdx'
        : motivo === 'rsi'
          ? rsiAlto
            ? 'calc_barrido.vigilanciaRsi'
            : 'calc_barrido.vigilanciaRsiBajo'
          : 'calc_barrido.vigilancia'
    return { name: p.name, razon: t(clave, datos) }
  })

  // Rangos: se ordenan por qué tan pegado al borde está el precio (entre más
  // cerca del extremo, mejor la entrada) y se limitan a 4 para no llenar la
  // pantalla de oportunidades mediocres.
  const rangosRaw = paresRaw
    .filter((p) => clsRango(p))
    .map((p) => {
      const amplitud = p.rangoHi - p.rangoLo
      const pos = (p.c - p.rangoLo) / amplitud
      return { p, distanciaBorde: Math.min(pos, 1 - pos) }
    })
    .sort((a, b) => a.distanciaBorde - b.distanciaBorde)
    .slice(0, 4)
    .map((x) => x.p)

  const rangos = rangosRaw.map((p) => ({ name: p.name, lado: clsRango(p), razon: razonRango(p, t) }))

  // Retrocesos. Apagado por defecto: sin `incluirRetrocesos` esta lista queda
  // vacía y la app se comporta exactamente como antes de que existiera.
  //
  // No hace falta comprobar que no se pisen con las otras dos listas: un
  // retroceso exige ADX ≥ 35 y un rango exige ADX < 20, así que no pueden ser
  // el mismo par a la vez; y una señal de tendencia exige que el precio esté
  // por fuera de la EMA9, que es justo lo contrario de lo que pide esta. Se
  // ordenan por diferencia de fuerza, igual que las compras y las ventas.
  const clsRetroceso = (p) => (incluirRetrocesos ? clasificarRetroceso(p, thr, { adxMin }) : null)
  const retrocesosRaw = incluirRetrocesos ? cands.filter((p) => clsRetroceso(p)).slice(0, topN) : []
  const retrocesos = retrocesosRaw.map((p) => ({
    name: p.name,
    lado: clsRetroceso(p),
    razon: razonRetroceso(p, esc, t),
  }))

  const setups = [
    ...comprasRaw.slice(0, topN).map((p) => mkSetup(p, 'COMPRA', esc, t)),
    ...ventasRaw.slice(0, topN).map((p) => mkSetup(p, 'VENTA', esc, t)),
    ...rangosRaw.map((p) => mkSetup(p, clsRango(p), esc, t, 'rango')),
    ...retrocesosRaw.map((p) => mkSetup(p, clsRetroceso(p), esc, t, 'retroceso')),
  ]

  const ultima = aFechaUTC(data.ultima)
  // Ambas mitades llevan su propia fecha. Antes la de Colombia era solo la
  // hora, así que entre las 00:00 y las 05:00 UTC (cuando en Colombia todavía
  // es el día anterior) el texto quedaba con la fecha de UTC pegada a la hora
  // local: "30/07/2026, 1:00 a. m. UTC (8:00 p. m. en Colombia)" cuando en
  // Colombia eran las 8:00 p. m. del 29. Se pone Colombia primero por ser la
  // hora de quien usa la app.
  const loc = locale || localeDe(IDIOMA_BASE)
  const enUTC = ultima.toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })
  const enCO = ultima.toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' })
  const fuente = t('calc_barrido.fuenteCierre')
  const corte = t('calc_barrido.corte', { local: enCO, utc: enUTC, fuente })

  return { monedas, pares, compras, ventas, vigilancia, rangos, retrocesos, setups, corte, sesion }
}
