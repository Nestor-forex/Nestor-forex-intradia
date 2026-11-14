// Comprobaciones del Analizador (fase 3, 2026-11-13). Sin red ni navegador.
//
// GEMELO: el mismo archivo en las dos apps. Lo que difiere entre ellas (sus
// medias, su geometría, su pivote) se comprueba a través de `fichaAnalisis` de
// SU `marketCalc.js`, alimentado con un par que trae los campos de las dos.
//
// Uso: node scripts/prueba-analizador.mjs

import { readFileSync } from 'node:fs'
import {
  HERRAMIENTAS,
  HERRAMIENTAS_INICIALES,
  LADOS,
  MAX_NOMBRE,
  MAX_PLANTILLAS,
  METODOS,
  armarAnalisis,
  conPlantilla,
  correlacionDe,
  cotDe,
  diarioDe,
  estacionalidadHoy,
  fvgDe,
  MAX_FVG,
  bollingerDe,
  mediasParaTarjeta,
  herramientasDisponibles,
  oroDe,
  spreadDe,
  leerPlantillas,
  nivelesDe,
  normalizarPlantilla,
  notaDeAnalisis,
  pivoteClasico,
  sinPlantilla,
  tamanoPip,
} from '../src/lib/analizador.js'
import { calcularLote } from '../src/lib/calc.js'
import { carryDeSenal } from '../src/lib/carrySenal.js'
import { monedasDe } from '../src/lib/pairs.js'
import { fichaAnalisis, nivelesApp, PERIODOS_MEDIAS } from '../src/lib/marketCalc.js'
import { VECES_EMA, emaUltima, mediasDe, smaUltima } from '../src/lib/medias.js'
import es from '../src/lib/i18n/textos/es.js'

let fallos = 0
function comprobar(nombre, ok, detalle = '') {
  if (ok) console.log('  ✓ ' + nombre)
  else {
    fallos++
    console.log('  ✗ ' + nombre + (detalle ? ' — ' + detalle : ''))
  }
}
const cerca = (a, b, eps = 1e-9) => Math.abs(a - b) < eps
const leer = (r) => readFileSync(new URL(r, import.meta.url), 'utf8')
// Sin comentarios, para que explicar algo en una nota no cuente como hacerlo.
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

// Un par con los campos de LAS DOS apps: cada `fichaAnalisis` coge los suyos.
const PAR = {
  name: 'EUR/USD',
  b: 'EUR',
  q: 'USD',
  dec: 4,
  c: 1.1,
  atrAbs: 0.006,
  atrPct: 0.55,
  atrPctH: 0.15,
  rsiV: 48.6,
  tend: 'Alcista',
  e20: 1.098,
  e50: 1.095,
  e9: 1.099,
  e21: 1.097,
  lo10: 1.094,
  hi10: 1.104,
  lo20: 1.09,
  hi20: 1.108,
  compresion: 0.95,
  serie20: Array.from({ length: 20 }, (_, i) => 1.09 + i * 0.0005),
  altos20: Array.from({ length: 20 }, (_, i) => 1.093 + i * 0.0005),
  bajos20: Array.from({ length: 20 }, (_, i) => 1.088 + i * 0.0005),
  pivots: { p: 1.1, r1: 1.105, s1: 1.095, r2: 1.11, s2: 1.09 },
  esCruce: false,
  dif: 0.3,
}
const ESC = { EUR: 7.2, USD: 3.1 }

console.log('\n1. El pivote clásico')
{
  const p = pivoteClasico(1.2, 1.1, 1.15)
  comprobar('P = (H + L + C) / 3', cerca(p.p, (1.2 + 1.1 + 1.15) / 3))
  comprobar('R1 = 2P − L y S1 = 2P − H', cerca(p.r1, 2 * p.p - 1.1) && cerca(p.s1, 2 * p.p - 1.2))
  comprobar('R2 = P + (H − L) y S2 = P − (H − L)', cerca(p.r2, p.p + 0.1) && cerca(p.s2, p.p - 0.1))
  comprobar('con un dato que falta devuelve null, nunca ceros', pivoteClasico(1.2, null, 1.1) === null && pivoteClasico(NaN, 1, 1) === null)
  comprobar('una vela con el máximo por debajo del mínimo está rota → null', pivoteClasico(1.0, 1.1, 1.05) === null)
}

console.log('\n2. La ficha de ESTA app')
const ficha = fichaAnalisis(PAR, ESC)
{
  comprobar('lleva precio, ATR, soporte y resistencia', [ficha.precio, ficha.atr, ficha.sop, ficha.res].every(Number.isFinite))
  comprobar('«la de la app» es EXACTAMENTE `nivelesApp` (no una copia)', JSON.stringify(ficha.niveles.app.COMPRA) === JSON.stringify(nivelesApp(PAR, true)) && JSON.stringify(ficha.niveles.app.VENTA) === JSON.stringify(nivelesApp(PAR, false)))
  comprobar('la vara simétrica son 1,5 ATR a cada lado', cerca(ficha.niveles.simetrica.COMPRA.sl, PAR.c - 1.5 * PAR.atrAbs) && cerca(ficha.niveles.simetrica.COMPRA.tp, PAR.c + 1.5 * PAR.atrAbs))
  comprobar('el pivote sale', ficha.pivote && Number.isFinite(ficha.pivote.p))
  comprobar('las medias llevan su nombre', Array.isArray(ficha.emas?.nombres) && ficha.emas.nombres.every((n) => /^EMA\d+$/.test(n)))
  comprobar('la fuerza es la de las dos divisas', ficha.fuerzaB === 7.2 && ficha.fuerzaQ === 3.1)
  comprobar('el RSI va redondeado', ficha.rsi === 49)
  const sinExtremos = fichaAnalisis({ ...PAR, altos20: undefined, bajos20: undefined, pivots: undefined }, ESC)
  comprobar('sin extremos publicados el pivote es null, nunca calculado sobre cierres', sinExtremos.pivote === null)
  comprobar('la ficha pasa por JSON sin perder nada', JSON.stringify(JSON.parse(JSON.stringify(ficha))) === JSON.stringify(ficha))
}

console.log('\n3. Los niveles')
{
  for (const m of METODOS)
    for (const l of LADOS) {
      const n = nivelesDe(ficha, l, m)
      const ok = n && (l === 'COMPRA' ? n.sl < ficha.precio && ficha.precio < n.tp : n.tp < ficha.precio && ficha.precio < n.sl)
      comprobar(`${m} · ${l}: el stop y el objetivo quedan cada uno a su lado del precio`, ok)
    }
  const e = nivelesDe(ficha, 'COMPRA', 'estructura')
  comprobar('estructura de compra: stop medio ATR bajo el soporte, objetivo en la resistencia', cerca(e.sl, ficha.sop - 0.5 * ficha.atr) && cerca(e.tp, ficha.res))
  const enElTecho = { ...ficha, precio: ficha.res }
  comprobar('con el precio en la resistencia, «estructura» NO da una compra (objetivo a cero pips)', nivelesDe(enElTecho, 'COMPRA', 'estructura') === null)
  comprobar('un lado o un método desconocidos → null', nivelesDe(ficha, 'LARGO', 'app') === null && nivelesDe(ficha, 'COMPRA', 'magia') === null)
}

const PERFIL = { capital: 1000, riesgoPct: 1, limiteDiarioPct: 3, maxPerdidasSeguidas: 3 }
const RATES = { USD: 1, EUR: 0.9, GBP: 0.78, JPY: 150, CHF: 0.88, AUD: 1.5, NZD: 1.65, CAD: 1.36 }

console.log('\n4. La tarjeta')
{
  const sinLado = armarAnalisis({ ficha, perfil: PERFIL, ratesUSD: RATES })
  comprobar('sin dirección elegida NO hay niveles: la app no la elige por nadie', sinLado.lado === null && sinLado.niveles === null && sinLado.motivoNiveles === 'sinLado')
  comprobar('…ni lote', sinLado.lote === null && sinLado.motivoLote === 'sinNiveles')

  const a = armarAnalisis({ ficha, lado: 'COMPRA', metodo: 'simetrica', perfil: PERFIL, ratesUSD: RATES })
  const pip = tamanoPip(ficha.dec)
  comprobar('los pips son la distancia en pips (0,0001 aquí)', cerca(a.niveles.pipRiesgo, (1.5 * PAR.atrAbs) / pip, 1e-6))
  comprobar('con la vara simétrica el R/B es 1', cerca(a.niveles.rr, 1, 1e-9))
  const r = calcularLote({ capital: 1000, riesgoPct: 1, pips: a.niveles.pipRiesgo, par: 'EUR/USD', tasas: RATES })
  comprobar('el lote es EXACTAMENTE el de la calculadora', a.lote && cerca(a.lote.lote, r.lote) && cerca(a.lote.riesgoUsd, 10))
  comprobar('en un par con yen el pip es 0,01', tamanoPip(2) === 0.01 && tamanoPip(4) === 0.0001)

  comprobar('sin capital no hay lote, y lo dice con un código', armarAnalisis({ ficha, lado: 'COMPRA', perfil: { capital: null, riesgoPct: 1 }, ratesUSD: RATES }).motivoLote === 'sinPerfil')
  comprobar('basta capital y riesgo: los frenos no hacen falta para el lote', armarAnalisis({ ficha, lado: 'COMPRA', perfil: { capital: 500, riesgoPct: 2 }, ratesUSD: RATES }).lote !== null)
  comprobar('sin tasas no hay lote', armarAnalisis({ ficha, lado: 'COMPRA', perfil: PERFIL, ratesUSD: null }).motivoLote === 'sinTasas')
  comprobar('sin ficha no revienta', armarAnalisis({}).motivo === 'sinFicha')
  comprobar('la tarjeta entera pasa por JSON (es lo que recibirá Qwen en la fase 5)', JSON.stringify(JSON.parse(JSON.stringify(a))) === JSON.stringify(a))
  comprobar('lleva el estado del freno que se le pasa', armarAnalisis({ ficha, lado: 'VENTA', freno: 'freno' }).freno === 'freno')
}

console.log('\n5. Las herramientas')
{
  const solo = armarAnalisis({ ficha, lado: 'COMPRA', herramientas: ['rsi', 'atr'] })
  comprobar('solo salen las encendidas', JSON.stringify(Object.keys(solo.herramientas).sort()) === JSON.stringify(['atr', 'rsi']))
  comprobar('una herramienta inventada se ignora', Object.keys(armarAnalisis({ ficha, herramientas: ['magia'] }).herramientas).length === 0)
  const todas = armarAnalisis({ ficha, lado: 'COMPRA', herramientas: HERRAMIENTAS })
  comprobar('el ATR también va en pips', cerca(todas.herramientas.atr.pips, PAR.atrAbs / 0.0001, 1e-6))

  const ahora = new Date('2026-11-13T12:00:00Z')
  const cal = {
    eventos: [
      { t: 'CPI', c: 'USD', d: '2026-11-13T15:30:00Z', i: 'alto' },
      { t: 'GDP', c: 'JPY', d: '2026-11-13T16:00:00Z', i: 'alto' },
      { t: 'ECB', c: 'EUR', d: '2026-11-12T10:00:00Z', i: 'alto' },
    ],
  }
  const conCal = armarAnalisis({ ficha, herramientas: ['calendario'], calendario: cal, ahora })
  comprobar('el calendario solo trae las dos divisas del par, y solo lo que no ha pasado', conCal.herramientas.calendario.length === 1 && conCal.herramientas.calendario[0].c === 'USD')
  comprobar('sin calendario publicado es null; con calendario y nada de estas dos es []', armarAnalisis({ ficha, herramientas: ['calendario'] }).herramientas.calendario === null && armarAnalisis({ ficha, herramientas: ['calendario'], calendario: { eventos: [] }, ahora }).herramientas.calendario.length === 0)

  const tasas = { EUR: { v: 2.0 }, USD: { v: 4.0 } }
  const sw = armarAnalisis({ ficha, lado: 'COMPRA', herramientas: ['swap'], tasas, monedasDe })
  comprobar('el swap es el de `carryDeSenal`, no una cuenta nueva', sw.herramientas.swap === carryDeSenal({ par: 'EUR/USD', lado: 'COMPRA' }, tasas, monedasDe))
  comprobar('sin dirección no hay swap (depende del lado)', armarAnalisis({ ficha, herramientas: ['swap'], tasas, monedasDe }).herramientas.swap === null)
}

console.log('\n5b. Las seis herramientas del 2026-11-15')
{
  // ── el spread y la actividad ──
  const mt5 = {
    actualizadoEl: '2026-11-15T12:00:00Z',
    quotes: { 'EUR/USD': { spread: 1.2, ticks: 500 }, 'USD/JPY': { spread: 1.5, ticks: 1000 } },
  }
  const ahora = new Date('2026-11-15T12:30:00Z')
  const sp = spreadDe(mt5, 'EUR/USD', { pipRiesgo: 60 }, ahora)
  comprobar('el spread se compara con el Stop-loss de ESTA tarjeta', cerca(sp.pctStop, 2), String(sp.pctStop))
  comprobar('la actividad va contra el par MÁS ACTIVO de la misma lectura', cerca(sp.actividad, 0.5))
  comprobar('y dice de hace cuántos minutos es la foto', sp.minutos === 30)
  comprobar('sin niveles no hay % del stop (null, no 0)', spreadDe(mt5, 'EUR/USD', null, ahora).pctStop === null)
  comprobar('con el puente apagado es null', spreadDe(null, 'EUR/USD', null) === null && spreadDe({ quotes: {} }, 'EUR/USD', null) === null)
  comprobar('sin ticks la actividad es null, no 0', spreadDe({ quotes: { 'EUR/USD': { spread: 1 } } }, 'EUR/USD', null).actividad === null)

  // ── el COT ──
  const cot = { fecha: '2026-11-03', divisas: { EUR: { f: '2026-11-03', fondosPct: -8.97 }, GBP: { f: '2026-10-27', fondosPct: 10.9 } } }
  const c1 = cotDe(cot, 'EUR', 'GBP')
  comprobar('el COT trae las dos divisas y la fecha del informe MÁS VIEJO', cerca(c1.pctB, -8.97) && cerca(c1.pctQ, 10.9) && c1.fecha === '2026-10-27')
  comprobar('una divisa sin dato es null, no 0', cotDe(cot, 'EUR', 'NZD').pctQ === null)
  comprobar('sin archivo es null', cotDe(null, 'EUR', 'USD') === null)
  comprobar('el COT no devuelve ningún veredicto', !Object.keys(c1).some((k) => /lado|compra|venta|senal|veredicto/i.test(k)))

  // ── el oro ──
  const oro = { fecha: '2026-11-13', cambio20: -0.0294, correl: { 'EUR/USD': { r: 0.48, n: 60 } } }
  const o1 = oroDe(oro, 'EUR/USD')
  comprobar('el oro trae su correlación con el par y su cambio en 20 sesiones', cerca(o1.r, 0.48) && cerca(o1.cambio20, -0.0294) && o1.n === 60)
  comprobar('un par sin correlación da r null, no 0', oroDe(oro, 'GBP/CAD').r === null)

  // ── la correlación ──
  const corr = [
    { a: 'EUR/USD', b: 'GBP/USD', r: 0.83 },
    { a: 'EUR/USD', b: 'USD/CHF', r: -0.88 },
    { a: 'AUD/USD', b: 'NZD/USD', r: 0.9 },
  ]
  const k = correlacionDe(corr, 'EUR/USD')
  comprobar('solo las parejas de ESTE par, ordenadas por tamaño (las negativas cuentan igual)', k.length === 2 && k[0].par === 'USD/CHF' && k[1].par === 'GBP/USD')
  comprobar('con datos y ninguna pareja es [] — y sin datos es null', correlacionDe(corr, 'EUR/CHF').length === 0 && correlacionDe(undefined, 'EUR/USD') === null)

  // ── la estacionalidad ──
  const est = {
    pares: {
      'EUR/USD': {
        dia: { 1: { n: 900, medio: 0.6 }, 2: { n: 900, medio: 0.8 }, 3: { n: 900, medio: 0.7 }, 4: { n: 900, medio: 0.7 }, 5: { n: 900, medio: 0.7 } },
        mes: { 10: { n: 400, medio: 0.77 } },
        mesDir: { 10: { n: 18, verdes: 9, pct: 50, margen: 23 } },
      },
    },
  }
  const martes = new Date('2026-11-17T10:00:00Z') // martes, noviembre
  const e1 = estacionalidadHoy(est, 'EUR/USD', martes)
  comprobar('el día se agrupa en UTC y se compara con la media de los cinco', e1.dia === 2 && cerca(e1.rDia.veces, 0.8 / 0.7))
  comprobar('el mes trae su dirección con su ±', e1.mes === 10 && e1.dir.pct === 50 && e1.dir.margen === 23)
  comprobar('sin la casilla de la hora (Swing) la hora es null', e1.rHora === null)
  comprobar('un sábado no inventa un día', estacionalidadHoy(est, 'EUR/USD', new Date('2026-11-21T10:00:00Z')).rDia === null)
  comprobar('sin datos del par es null', estacionalidadHoy(est, 'GBP/CAD', martes) === null)

  // ── el diario ──
  const trades = [
    { par: 'EUR/USD', estado: 'cerrada', pl: 10 },
    { par: 'EUR/USD', estado: 'cerrada', pl: -4 },
    { par: 'EUR/USD', estado: 'abierta' },
    { par: 'EUR/GBP', estado: 'abierta' },
    { par: 'USD/JPY', estado: 'abierta' },
    { par: 'AUD/NZD', estado: 'abierta' },
  ]
  const d1 = diarioDe(trades, 'EUR/USD', monedasDe)
  comprobar('el diario solo cuenta las CERRADAS de este par', d1.n === 2 && d1.ganadas === 1 && cerca(d1.neto, 6))
  comprobar('…y las abiertas que comparten divisa (EUR o USD), incluida la del propio par', d1.abiertas === 3, String(d1.abiertas))
  comprobar('sin operaciones de este par: n 0 y sin porcentaje', diarioDe([], 'EUR/USD', monedasDe).n === 0 && diarioDe([], 'EUR/USD', monedasDe).pct === null)

  // ── todo junto, y lo que la app ofrece ──
  const a = armarAnalisis({ ficha, lado: 'COMPRA', metodo: 'simetrica', herramientas: HERRAMIENTAS, mt5, cot, oro, correlaciones: corr, estacionalidad: est, trades, monedasDe, ahora: martes })
  comprobar('las seis salen dentro de la tarjeta', ['spread', 'cot', 'oro', 'correlacion', 'estacionalidad', 'diario'].every((x) => x in a.herramientas))
  comprobar('la tarjeta con las seis sigue pasando por JSON intacta', JSON.stringify(JSON.parse(JSON.stringify(a))) === JSON.stringify(a))
  const sinSwing = herramientasDisponibles({ fichas: [ficha] })
  comprobar('sin COT, oro ni correlación (la app de intradía) esos botones NO se ofrecen', !sinSwing.includes('cot') && !sinSwing.includes('oro') && !sinSwing.includes('correlacion'))
  comprobar('el spread y el diario se ofrecen siempre', sinSwing.includes('spread') && sinSwing.includes('diario'))
  const conSwing = herramientasDisponibles({ fichas: [ficha], cot, oro, correlaciones: corr, estacionalidad: est })
  comprobar('con los datos, se ofrecen las seis', ['spread', 'cot', 'oro', 'correlacion', 'estacionalidad', 'diario'].every((x) => conSwing.includes(x)))
}

console.log('\n5c. El FVG (brecha de valor justo)')
{
  // La ficha de esta app trae los huecos vivos de sus 20 velas publicadas.
  comprobar('la ficha trae los huecos (lista, aunque esté vacía)', Array.isArray(ficha.fvg))
  const sinExtremos = fichaAnalisis({ ...PAR, altos20: undefined, bajos20: undefined, pivots: undefined }, ESC)
  comprobar('sin extremos publicados los huecos son null («no lo sé»), no []', sinExtremos.fvg === null)

  // Un caso a mano: precio 1.1000, un hueco por encima, uno por debajo y uno
  // que contiene el precio.
  const f = {
    ...ficha,
    precio: 1.1,
    dec: 4,
    fvg: [
      { tipo: 'bajista', abajo: 1.103, arriba: 1.105, estado: 'abierto', velasAtras: 3 },
      { tipo: 'alcista', abajo: 1.095, arriba: 1.098, estado: 'tocado', velasAtras: 7 },
      { tipo: 'alcista', abajo: 1.099, arriba: 1.101, estado: 'abierto', velasAtras: 1 },
    ],
  }
  const r = fvgDe(f)
  comprobar('el que contiene el precio sale DENTRO y a 0 pips, el primero', r.huecos[0].dentro === true && r.huecos[0].pips === 0)
  comprobar('el de abajo: 20 pips por debajo (1.1000 − 1.0980)', r.huecos[1].lado === 'abajo' && cerca(r.huecos[1].pips, 20, 1e-6))
  comprobar('el de arriba: 30 pips por encima (1.1030 − 1.1000)', r.huecos[2].lado === 'arriba' && cerca(r.huecos[2].pips, 30, 1e-6))
  comprobar('van ordenados del más cercano al más lejano', r.huecos.every((x, i) => i === 0 || r.huecos[i - 1].pips <= x.pips))
  const muchos = { ...f, fvg: Array.from({ length: 9 }, (_, i) => ({ tipo: 'alcista', abajo: 1.09 - i * 0.001, arriba: 1.0905 - i * 0.001, estado: 'abierto', velasAtras: i + 1 })) }
  comprobar(`se enseñan como mucho ${MAX_FVG}, y se dice cuántos hay`, fvgDe(muchos).huecos.length === MAX_FVG && fvgDe(muchos).total === 9)
  comprobar('sin huecos vivos → lista vacía, no null', JSON.stringify(fvgDe({ ...f, fvg: [] }).huecos) === '[]')
  comprobar('sin datos → null', fvgDe({ ...f, fvg: null }) === null && fvgDe(null) === null)
  // ⚠️ El lado es GEOMETRÍA, no una dirección: nada dice compra o venta.
  comprobar('lo que devuelve no tiene ningún campo de dirección para operar', !/COMPRA|VENTA|compra|venta/.test(JSON.stringify(r)))

  comprobar('el FVG se ofrece si alguna ficha trae huecos', herramientasDisponibles({ fichas: [f] }).includes('fvg'))
  comprobar('y NO si ninguna los trae (un barrido viejo)', !herramientasDisponibles({ fichas: [{ ...f, fvg: null }] }).includes('fvg'))
  const a = armarAnalisis({ ficha: f, lado: 'COMPRA', herramientas: ['fvg'] })
  comprobar('sale dentro de la tarjeta, y pasa por JSON', 'fvg' in a.herramientas && JSON.stringify(JSON.parse(JSON.stringify(a))) === JSON.stringify(a))
}

console.log('\n5d. Las bandas de Bollinger y las medias móviles')
{
  // Bollinger: 10 cierres a 100 y 10 a 110 → media 105, desviación 5, bandas 95 y 115.
  const b = bollingerDe({ dec: 2, precio: 105, bandas: { arriba: 115, media: 105, abajo: 95 } })
  comprobar('en la media el %B es 0.50 (NO 0: eso era la posición de −1 a +1)', cerca(b.pctB, 0.5))
  comprobar('en la banda de abajo %B = 0 y en la de arriba %B = 1', cerca(bollingerDe({ dec: 2, precio: 95, bandas: { arriba: 115, media: 105, abajo: 95 } }).pctB, 0) && cerca(bollingerDe({ dec: 2, precio: 115, bandas: { arriba: 115, media: 105, abajo: 95 } }).pctB, 1))
  comprobar('fuera de la banda sale por encima de 1', bollingerDe({ dec: 2, precio: 120, bandas: { arriba: 115, media: 105, abajo: 95 } }).pctB > 1)
  comprobar('el ancho va en pips (20 de precio con 2 decimales = 2000 pips)', cerca(b.anchoPips, 2000))
  comprobar('sin bandas → null, nunca ceros', bollingerDe({ dec: 4, precio: 1 }) === null && bollingerDe({ dec: 4, precio: 1, bandas: { arriba: 1, media: 1, abajo: 1 } }) === null)
  comprobar('la ficha de esta app trae las bandas en precio', ficha.bandas && [ficha.bandas.arriba, ficha.bandas.media, ficha.bandas.abajo].every(Number.isFinite))
  comprobar('la tarjeta cuadra con la ficha: %B = (posición + 1) / 2', cerca(bollingerDe(ficha).pctB, (ficha.bollinger + 1) / 2, 1e-9))

  // Las medias, contra cuentas a mano.
  const serie = Array.from({ length: 30 }, (_, i) => i + 1) // 1..30
  comprobar('SMA 10 de 1..30 = media de 21..30 = 25.5', cerca(smaUltima(serie, 10), 25.5))
  comprobar('SMA con menos velas que el periodo → null', smaUltima(serie, 50) === null)
  comprobar(`EMA con menos de ${VECES_EMA}× el periodo → null (no un número que no es)`, emaUltima(serie, 20) === null && emaUltima(serie, 10) !== null)
  const larga = Array.from({ length: 400 }, () => 7)
  comprobar('EMA de una serie constante = esa constante', cerca(emaUltima(larga, 50), 7))
  const m = mediasDe(larga, { sma: [20, 200], ema: [20, 200] })
  comprobar('un periodo sin velas suficientes sale con v null, NO desaparece', m.ema.length === 2 && m.ema[1].v === null && m.ema[1].p === 200)
  comprobar('esta app tiene sus periodos escritos (SMA y EMA)', Array.isArray(PERIODOS_MEDIAS.sma) && Array.isArray(PERIODOS_MEDIAS.ema) && PERIODOS_MEDIAS.sma.length > 0)

  const t = mediasParaTarjeta({ dec: 4, precio: 1.1, medias: { sma: [{ p: 20, v: 1.099 }], ema: [{ p: 50, v: 1.102 }, { p: 200, v: null }] } })
  comprobar('el precio 10 pips por encima de la SMA 20', t.sma[0].precio === 'encima' && cerca(t.sma[0].pips, 10, 1e-6))
  comprobar('el precio 20 pips por debajo de la EMA 50', t.ema[0].precio === 'debajo' && cerca(t.ema[0].pips, 20, 1e-6))
  comprobar('la que falta sigue en la lista, sin pips', t.ema[1].v === null && t.ema[1].pips === null)
  comprobar('sin medias → null', mediasParaTarjeta({ dec: 4, precio: 1 }) === null)
  comprobar('nada dice compra o venta', !/COMPRA|VENTA/i.test(JSON.stringify(t)))
  comprobar('las medias se ofrecen si alguna ficha las trae', herramientasDisponibles({ fichas: [{ ...ficha, medias: { sma: [], ema: [] } }] }).includes('medias'))
  comprobar('Bollinger se ofrece si alguna ficha trae bandas, y no si ninguna', herramientasDisponibles({ fichas: [ficha] }).includes('bollinger') && !herramientasDisponibles({ fichas: [{ ...ficha, bandas: null }] }).includes('bollinger'))
}

console.log('\n6. Las plantillas')
{
  comprobar('una plantilla sin nombre o sin herramientas no vale', normalizarPlantilla({ nombre: ' ', herramientas: ['rsi'] }) === null && normalizarPlantilla({ nombre: 'x', herramientas: [] }) === null)
  comprobar('las herramientas que no existen se quitan', JSON.stringify(normalizarPlantilla({ nombre: 'x', herramientas: ['rsi', 'magia', 'rsi'] }).herramientas) === '["rsi"]')
  comprobar('un método desconocido cae a «app»', normalizarPlantilla({ nombre: 'x', herramientas: ['rsi'], metodo: 'raro' }).metodo === 'app')
  const muchas = Array.from({ length: 14 }, (_, i) => ({ nombre: 'p' + i, herramientas: ['rsi'] }))
  comprobar(`al leer se quedan como mucho ${MAX_PLANTILLAS}`, leerPlantillas(muchas).length === MAX_PLANTILLAS)
  comprobar('al leer, dos con el mismo nombre (sin distinguir mayúsculas) son una', leerPlantillas([{ nombre: 'A', herramientas: ['rsi'] }, { nombre: 'a', herramientas: ['atr'] }]).length === 1)
  const base = [{ nombre: 'Mañana', herramientas: ['rsi'], metodo: 'app' }]
  const rep = conPlantilla(base, { nombre: 'mañana', herramientas: ['atr'], metodo: 'simetrica' })
  comprobar('guardar con el mismo nombre REEMPLAZA, no duplica', rep.ok && rep.lista.length === 1 && rep.lista[0].metodo === 'simetrica')
  comprobar('guardar una nueva la añade', conPlantilla(base, { nombre: 'Tarde', herramientas: ['atr'] }).lista.length === 2)
  comprobar('la undécima no entra', conPlantilla(muchas.slice(0, 10), { nombre: 'once', herramientas: ['rsi'] }).codigo === 'demasiadas')
  comprobar('los errores son códigos, no frases', conPlantilla(base, { nombre: '' }).codigo === 'sinNombre' && conPlantilla(base, { nombre: 'x'.repeat(MAX_NOMBRE + 1), herramientas: ['rsi'] }).codigo === 'nombreLargo' && conPlantilla(base, { nombre: 'x', herramientas: [] }).codigo === 'sinHerramientas')
  comprobar('borrar quita solo esa', sinPlantilla([...base, { nombre: 'Tarde', herramientas: ['atr'] }], 'MAÑANA').length === 1)

  const reglas = leer('../../firestore.rules')
  const m = reglas.match(/plantillas\.size\(\)\s*<=\s*(\d+)/)
  comprobar('la regla de Firestore deja la MISMA cantidad que la app', m && Number(m[1]) === MAX_PLANTILLAS, m ? m[1] : 'no está')
  const lista = reglas.match(/affectedKeys\(\)\s*\.hasOnly\(\[([^\]]*)\]\)/)
  comprobar('`plantillas` está en la lista blanca de la ficha', Boolean(lista) && /'plantillas'/.test(lista[1]))
}

console.log('\n7. La nota que va al Diario')
{
  const a = armarAnalisis({ ficha, lado: 'VENTA', metodo: 'simetrica', perfil: PERFIL, ratesUSD: RATES })
  const nota = notaDeAnalisis(a)
  comprobar('lleva entrada, SL, TP y R/B con los decimales del par', /^entrada 1\.1000 · SL 1\.1090 · TP 1\.0910 · R\/B 1:1\.0$/.test(nota), nota)
  comprobar('sin niveles no hay nota', notaDeAnalisis(armarAnalisis({ ficha })) === '')
}

console.log('\n8. Los textos')
{
  const an = es.an
  comprobar('existe el bloque `an` y la pestaña', an && typeof es.nav?.analizar === 'string')
  comprobar('cada herramienta tiene su nombre', HERRAMIENTAS.every((h) => typeof an?.h?.[h] === 'string'), HERRAMIENTAS.filter((h) => typeof an?.h?.[h] !== 'string').join(', '))
  comprobar('cada método tiene nombre y descripción', METODOS.every((m) => typeof an?.metodo?.[m] === 'string' && typeof an?.metodoDesc?.[m] === 'string'))
  const motivos = ['sinLado', 'metodoNoSale', 'sinFicha']
  comprobar('cada motivo sin niveles tiene su frase', motivos.every((k) => typeof an?.motivo?.[k] === 'string'))
  comprobar('cada motivo sin lote tiene su frase', ['sinPerfil', 'sinTasas', 'sinNiveles'].every((k) => typeof an?.motivoLote?.[k] === 'string'))
  const codigos = ['guardada', 'sinNombre', 'nombreLargo', 'sinHerramientas', 'demasiadas', 'sinPermiso', 'noSeGuardo', 'sinSesion']
  comprobar('cada código de las plantillas tiene su frase', codigos.every((k) => typeof an?.msg?.[k] === 'string'), codigos.filter((k) => typeof an?.msg?.[k] !== 'string').join(', '))
  comprobar('las tres salidas del swap tienen frase', ['aFavor', 'enContra', 'neutro'].every((k) => typeof an?.swap?.[k] === 'string'))
  comprobar('las herramientas iniciales existen todas', HERRAMIENTAS_INICIALES.every((h) => HERRAMIENTAS.includes(h)))
  comprobar('el aviso dice que la app NO elige la dirección', /NO elige la dirección/.test(an?.aviso ?? ''))
  const nuevas = ['actividad', 'sinPuente', 'spreadNota', 'oroR', 'oro20', 'oroNota', 'correlNinguna', 'correlNota', 'estNota', 'diarioPar', 'diarioSin', 'diarioAbiertas', 'diarioMismaApuesta']
  comprobar('los textos de las seis nuevas existen', nuevas.every((k) => typeof an?.[k] === 'string'), nuevas.filter((k) => typeof an?.[k] !== 'string').join(', '))
  const delBm = ['bandaArriba', 'bandaMedia', 'bandaAbajo', 'bandaAncho', 'bollNota', 'mediaSin', 'mediasNota']
  comprobar('los textos de Bollinger y de las medias existen', delBm.every((k) => typeof an?.[k] === 'string'), delBm.filter((k) => typeof an?.[k] !== 'string').join(', '))
  comprobar('las distancias a las medias son funciones', typeof an?.mediaEncima === 'function' && typeof an?.mediaDebajo === 'function')
  const delFvg = ['fvgNinguno', 'fvgAlcista', 'fvgBajista', 'fvgDentro', 'fvgTocado', 'fvgAbierto', 'fvgVelas', 'fvgNota']
  comprobar('los textos del FVG existen', delFvg.every((k) => typeof an?.[k] === 'string'), delFvg.filter((k) => typeof an?.[k] !== 'string').join(', '))
  comprobar('las distancias del FVG son funciones (llevan el número dentro)', typeof an?.fvgArriba === 'function' && typeof an?.fvgAbajo === 'function')
  comprobar('la nota del FVG dice que no dice hacia dónde irá el precio', /no hacia dónde irá el precio/.test(an?.fvgNota ?? ''))
  const funciones = ['puenteViejo', 'cotNota', 'estHora', 'estDia', 'estMes', 'estDir']
  comprobar('las que llevan un número o un nombre dentro son funciones', funciones.every((k) => typeof an?.[k] === 'function'), funciones.filter((k) => typeof an?.[k] !== 'function').join(', '))
  comprobar('la nota del spread dice de QUIÉN es (no es el tuyo)', /no los de tu bróker/.test(an?.spreadNota ?? ''))
  // ⚠️ Néstor, 2026-11-15: «jamás debe decir cuál es el nombre de mi bróker,
  // no le voy a hacer publicidad». Ningún texto que ve el suscriptor, en
  // ningún idioma, nombra a la empresa. Se mira el diccionario ENTERO.
  const nombres = /avatrade|ava\s*trade/i
  const conNombre = ['es', 'en', 'de', 'fr', 'pt', 'it', 'zh', 'ja', 'ru', 'ar', 'tr', 'hi', 'ko'].filter((l) => nombres.test(leer(`../src/lib/i18n/textos/${l}.js`)))
  comprobar('ningún texto de la app nombra al bróker, en ningún idioma', conNombre.length === 0, conNombre.join(', '))
  comprobar('la nota del COT dice que no da dirección', /No dice hacia dónde/.test(an?.cotNota?.({ fecha: 'x' }) ?? ''))
  comprobar('la nota de la estacionalidad dice que mide cuánto, no hacia dónde', /no hacia dónde/.test(an?.estNota ?? ''))
}

console.log('\n9. El cableado')
{
  const app = leer('../src/App.jsx')
  comprobar('App pinta el Analizador en la pestaña «analizar»', /tab === 'analizar'/.test(app) && /<AnalizadorTab/.test(app))
  comprobar('…y le pasa las fichas del hook', /fichas=\{mercado\.fichas\}/.test(app))
  comprobar('el hook devuelve las fichas', /fichas:\s*vista\?\.fichas/.test(leer('../src/lib/useMarketData.js')))
  const mc = sinComentarios(leer('../src/lib/marketCalc.js'))
  comprobar('derivarVista arma las fichas con `fichaAnalisis`', /fichas\s*=\s*paresRaw\.map\(\(p\)\s*=>\s*fichaAnalisis\(p, esc\)\)/.test(mc))
  comprobar('las señales y el Analizador usan la MISMA `nivelesApp`', /nivelesApp\(p, compra\)/.test(mc.slice(mc.indexOf('const mkSetup'))))
  const nav = leer('../src/components/BottomNav.jsx')
  comprobar('la barra de abajo tiene la pestaña', /tab: 'analizar'/.test(nav) && /nav\.analizar/.test(nav))
  const tab = sinComentarios(leer('../src/components/AnalizadorTab.jsx'))
  comprobar('la pantalla arranca SIN dirección elegida', /useState\(null\)\s*\n\s*const \[metodo/.test(tab) || /\[lado, setLado\] = useState\(null\)/.test(tab))
  comprobar('la pantalla usa `armarAnalisis` (no hace sus propias cuentas)', /armarAnalisis\(/.test(tab) && !/atrAbs|lo10|hi10/.test(tab))
  comprobar('la pantalla lee el freno del guardián', /estadoDelDia\(/.test(tab))
  comprobar('la pantalla decide qué ofrecer con `herramientasDisponibles`', /herramientasDisponibles\(/.test(tab))
  // GEMELO: no puede importar un hook que en la otra app no existe. El COT y
  // el oro le llegan por props desde el App.jsx de Swing.
  comprobar('la pantalla NO importa useCot ni useOro (solo existen en Swing)', !/useCot|useOro/.test(tab))
  comprobar('la pantalla le pasa a `armarAnalisis` solo las herramientas disponibles', /herramientas:\s*herr\.filter\(\(x\)\s*=>\s*disponibles\.includes\(x\)\)/.test(tab))
  const diario = leer('../src/components/DiarioTab.jsx')
  comprobar('el Diario acepta el lote que llega del Analizador', /prellenar\.lote/.test(diario))
}

console.log(fallos ? `\n✗ ${fallos} comprobación(es) fallaron\n` : '\n✓ todo bien\n')
process.exit(fallos ? 1 : 0)
