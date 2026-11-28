// Las lecciones del curso, en español (2026-11-18).
//
// ⚠️ REGLAS DE CADA LECCIÓN, y no se ablandan:
//  - nunca dice «compra» ni «vende», ni hacia dónde irá el precio;
//  - siempre lleva «Lo que esto NO te dice»;
//  - los números que salen del código se LEEN de él (el listón, el margen),
//    no se escriben a mano;
//  - un número del backtest y uno del registro real nunca van juntos sin decir
//    de cuál es cada uno;
//  - nunca nombra al bróker del desarrollador.
//
// Forma de una lección:
//   titulo, objetivo, explicacion[], ejemplo[], formula?{texto, conNumeros},
//   noDice[], video?{archivo, desc}, hazlo{tab, boton, texto}, preguntas[{p, opciones[], correcta, porque}]
//
// `video.archivo` es el nombre SIN extensión: hay un .webm y un .mp4. Viven en `public/curso/videos/` de la app de swing y las dos
// apps lo usan desde ahí (`URL_VIDEOS` en `curso.js`). Sin voz por ahora.
//
// `tab` es una pestaña que existe en las DOS apps: barrido, analizar, diario,
// historial, avisos, calc.

import { OPS_PARA_CREER } from '../sombra.js'
import { SUGERIDO, frenoEnDolares, operacionesHastaElFreno } from '../perfilRiesgo.js'
import { PERIODOS_MEDIAS, PERIODO_ATR, PERIODO_RSI, PESOS_FUERZA, RSI_MAX, TENDENCIA_MIN, UMBRALES_COMPRESION, UMBRAL_FUERZA, VELAS_ATRAS_COMPRESION, VENTANAS_FUERZA } from '../marketCalc.js'
// Lo que solo existe en UNA de las dos apps (el modo rango y la distancia del
// Stop-loss) se lee por aquí: un nombre que la otra app no exporta sale
// `undefined` en vez de romper la importación.
import * as MC from '../marketCalc.js'
import { UMBRAL_NEUTRO } from '../tasas.js'
import { spreadDe } from '../../../scripts/lib/costes.mjs'
import { HORAS_VISTA } from '../calendario.js'
import { APP } from '../identidad.js'
import { COJIN_ESTRUCTURA, MAX_PLANTILLAS, RR_AVISO } from '../analizador.js'
import { HERRAMIENTAS_DE_ESTILO } from '../estilo.js'
import { MAX_ABIERTAS, costesPractica } from '../practica.js'
import { aciertoDeEquilibrio } from '../laboratorio.js'
import { leerOperaciones, quitarRepetidas } from '../importarOperaciones.js'
import { MINIMO_PARA_ENSEÑAR, diagnostico, margen, resumir } from '../diagnostico.js'
import { MEDICION } from '../medicion.js'

// La medición de la app con la vara neutra (Stop-loss y Take-profit a la misma
// distancia), que es la que separa «acierta la dirección» de «gana dinero».
// En la app de swing el campo se llama `porRiesgo`; en la de intradía,
// `porRiesgoConSpread`. Las dos llevan el spread descontado.
const NEUTRA = MEDICION.neutra ?? {}
export const POR_R_NEUTRA_NUM = NEUTRA.porRiesgo ?? NEUTRA.porRiesgoConSpread
export const POR_R_NEUTRA = Number.isFinite(POR_R_NEUTRA_NUM)
  ? (POR_R_NEUTRA_NUM < 0 ? '−' : '+') + Math.abs(POR_R_NEUTRA_NUM).toFixed(2).replace('.', ',')
  : 'un resultado negativo'

const L = OPS_PARA_CREER

// El ejemplo del módulo 3 se calcula con las MISMAS funciones que usa «Tu freno
// de hoy», con los frenos que la app propone. Si alguien cambia lo sugerido, la
// lección cambia sola.
const PERFIL_EJEMPLO = Object.freeze({ capital: 1000, riesgoPct: 1, ...SUGERIDO })
const FRENO_USD = frenoEnDolares(PERFIL_EJEMPLO)
const OPS_FRENO = operacionesHastaElFreno(PERFIL_EJEMPLO)
const fmt = (n) => String(n).replace('.', ',')
// m2-3: el ejemplo de «acertaste más y perdiste». Se calcula, no se escribe:
// la prueba comprueba que con este número salen más aciertos que fallos y aun
// así un resultado negativo.
export const ACIERTOS_LOTE = 6

// Módulo 4: la fuerza se calcula con las ventanas y los pesos que usa ESTA app
// (velas diarias en swing, de una hora en intradía). Se leen de `marketCalc.js`.
const VELA = APP === 'swing' ? 'día' : 'hora'
const VELAS = APP === 'swing' ? 'días' : 'horas'
const VENT = VENTANAS_FUERZA.map((k) => `${k} ${k === 1 ? VELA : VELAS}`)
const PCT = PESOS_FUERZA.map((w) => `${Math.round(w * 100)} %`)
const UMBRAL = fmt(UMBRAL_FUERZA)

// Módulo 5: las medias que ESTA app usa para la tendencia, y su RSI y su ATR.
const EMA_C = PERIODOS_MEDIAS.ema[0]
const EMA_L = PERIODOS_MEDIAS.ema[1]
const SWING = APP === 'swing'
const CORTES = UMBRALES_COMPRESION

// Módulo 6: los spreads salen de la MISMA tabla con la que el banco de pruebas
// descuenta el coste (`scripts/lib/costes.mjs`), y la banda del swap de
// `tasas.js`. Si cambian allí, la lección cambia sola.
const SP_MAYOR = spreadDe('EUR/USD')
const SP_CRUCE = spreadDe('NZD/CHF')
const pct1 = (x) => fmt((x * 100).toFixed(1))
// Con stop y objetivo a la misma distancia, un coste c (en fracción del stop)
// se paga al ganar y al perder: p·(1 − c) = (1 − p)·(1 + c) → p = (1 + c) / 2.
export const aciertoParaEmpatar = (spreadPips, stopPips) => (1 + spreadPips / stopPips) / 2
const STOP_SW = 120
const STOP_ID = 30
const SP_EJ = 2

// Módulo 8: la correlación solo la calcula la app de swing (`correlacion.js`
// no existe en intradía, y por eso no se puede importar desde aquí, que es
// gemelo). Los dos números van escritos, y `prueba-curso.mjs` los compara con
// `correlacion.js` donde el archivo existe.
const CORREL_ALTA_TXT = 0.7
const VENTANA_CORREL_TXT = 60

// Módulo 9. Los números del Analizador se LEEN del código: el método «1,5 ATR
// a cada lado» usa `ATR_REVERSION` en swing y `ATR_STOP` en intradía (las dos
// valen 1,5 hoy, y se leen las dos con `MC` porque cada app exporta la suya).
export const ATR_SIMETRICO = MC.ATR_REVERSION ?? MC.ATR_STOP
const N_TENDENCIAS = HERRAMIENTAS_DE_ESTILO.tendencias.length
const N_RANGOS = HERRAMIENTAS_DE_ESTILO.rangos.length

// Módulo 10. ⚠️ El 5 de la insignia va escrito: `insignias.js` importa
// `curso.js`, que importa este archivo, así que importarlo de allí haría un
// círculo. `prueba-curso.mjs` lo compara con `META.practica`.
export const INSIGNIA_PRACTICA_TXT = 5
// El ejemplo del módulo 10 se CALCULA con `costesPractica`, la misma cuenta
// que la tarjeta: una compra de EUR/USD con 30 pips de Stop-loss y 45 de
// Take-profit (1:1,5) que ganó, con la entrada de Twelve Data (spread 1,2
// pips) y 0,6 pips de swap en contra por noche. Abierta un lunes y resuelta en
// la vela del martes: dos noches. Solo es aritmética, no un resultado medido.
export const EJEMPLO_PRACTICA = Object.freeze({
  app: APP, par: 'EUR/USD', lado: 'COMPRA', entrada: 1.1, sl: 1.097, tp: 1.1045,
  estado: 'ganada', r: 1.5, fuente: 'twelve', spread: 1.2, swap: -0.6, swap3: 3, riesgoUsd: 10,
  creado: Date.parse('2026-11-16T10:00:00Z'),
  velaResuelta: APP === 'swing' ? '2026-11-17' : '2026-11-17 23:00:00',
})
const C10 = costesPractica(EJEMPLO_PRACTICA)
const r2 = (x) => fmt(Math.abs(x).toFixed(2))
const MARGEN_5 = margen(INSIGNIA_PRACTICA_TXT)
const REVISA = APP === 'swing'
  ? 'La revisa cada 15 minutos con las velas diarias que publica el barrido de esta app, que se actualiza dos veces al día: una operación puede tardar unas horas en aparecer resuelta aunque ya haya tocado el nivel.'
  : 'La revisa cada 15 minutos con las velas de una hora que publica el barrido de esta app, que se actualiza cada hora.'

// Módulo 11. El acierto que hace falta para no perder sale de
// `aciertoDeEquilibrio` (el mismo que enseña el laboratorio), y el margen de
// `margen()`. Los dos casos con fecha son de esta memoria y lo dicen.
const EQ = (rb) => aciertoDeEquilibrio(rb)
const M25 = margen(25)
const M150 = margen(L)
const solapan = (a, ma, b, mb) => Math.abs(a - b) <= ma + mb

// Módulo 12: los ejemplos se calculan con las MISMAS funciones que usa la app
// al importar del bróker y al partir el Diario en grupos. Son operaciones de
// EJEMPLO, no de nadie.
export const CSV_EJEMPLO = 'Ticket,Symbol,Type,Volume,Close time,Profit,Swap,Commission\n1001,EURUSD,buy,0.03,2026.11.10 15:00,40.00,-3.20,-1.50\n'
const IMP = leerOperaciones(CSV_EJEMPLO, ['EUR/USD']).operaciones[0]
export const IMP_NETO = IMP.pl
export const IMP_REPETIDAS = quitarRepetidas([IMP], [IMP]).length
const din = (n) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n).toFixed(2))

// 20 operaciones de ejemplo: 8 en cruces (5 ganadas) y 12 con dólar (6
// ganadas). Lo que importa es el ± de cada grupo, no los números.
const opEj = (par, dir, pl) => ({ par, dir, pl, lote: 0.03, estado: 'cerrada' })
export const EJEMPLO_GRUPOS = Object.freeze([
  ...['EUR/CHF', 'GBP/JPY', 'EUR/CAD', 'EUR/CHF', 'GBP/JPY', 'EUR/CAD', 'EUR/CHF', 'GBP/JPY'].map((par, i) => opEj(par, i % 2 ? 'Venta' : 'Compra', i < 5 ? 10 : -10)),
  ...['EUR/USD', 'USD/JPY', 'EUR/USD', 'EUR/USD', 'AUD/USD', 'EUR/USD', 'EUR/USD', 'USD/CAD', 'EUR/USD', 'EUR/USD', 'USD/JPY', 'EUR/USD'].map((par, i) => opEj(par, i % 3 ? 'Compra' : 'Venta', i < 6 ? 10 : -10)),
])
const DG = diagnostico(EJEMPLO_GRUPOS)
const G_CRU = DG.tipoDePar.find((g) => g.clave === 'cruces')
const G_DOL = DG.tipoDePar.find((g) => g.clave === 'dolar')
const G_EURUSD = DG.pares.find((g) => g.clave === 'EUR/USD')
const pct0 = (x) => Math.round(x)
export const GRUPOS_SE_TOCAN = Math.abs(pct0(G_CRU.pct) - pct0(G_DOL.pct)) <= G_CRU.margen + G_DOL.margen

// 10 operaciones de ejemplo: 7 ganan poco y 3 pierden mucho.
export const EJEMPLO_ACIERTO = Object.freeze([...Array(7).fill(10), ...Array(3).fill(-30)].map((pl) => opEj('EUR/USD', 'Compra', pl)))
const RA = resumir(EJEMPLO_ACIERTO)

export const MODULOS = Object.freeze([
  Object.freeze({
    id: 'm0',
    n: 0,
    titulo: 'Qué es y qué no es esta app',
    desc: 'Antes de nada: qué te da la app, qué no te da, y por qué los números chicos no dicen nada.',
    lecciones: Object.freeze(['m0-1', 'm0-2']),
  }),
  Object.freeze({
    id: 'm1',
    n: 1,
    titulo: 'El lenguaje del Forex',
    desc: 'Par, pip, lote, spread y apalancamiento: las cinco palabras que salen en todas las pantallas.',
    lecciones: Object.freeze(['m1-1', 'm1-2', 'm1-3']),
  }),
  Object.freeze({
    id: 'm2',
    n: 2,
    titulo: 'El riesgo primero',
    desc: 'Cuánto arriesgar, dónde va el Stop-loss y cómo sale el lote. Lo que más protege a quien empieza.',
    lecciones: Object.freeze(['m2-1', 'm2-2', 'm2-3']),
  }),
  Object.freeze({
    id: 'm3',
    n: 3,
    titulo: 'Tu freno del día',
    desc: 'Por qué los días malos se vuelven peores, y cómo una regla escrita antes te protege de ti mismo.',
    lecciones: Object.freeze(['m3-1', 'm3-2']),
  }),
  Object.freeze({
    id: 'm4',
    n: 4,
    titulo: 'Quién manda hoy',
    desc: 'La fuerza de cada divisa, la diferencia que la app mira en cada par, por qué «10 contra 0» no quiere decir mucha diferencia, y cómo combinar una divisa fuerte con una débil eligiendo tú la dirección.',
    lecciones: Object.freeze(['m4-1', 'm4-2', 'm4-3', 'm4-4']),
  }),
  Object.freeze({
    id: 'm5',
    n: 5,
    titulo: 'Tendencia y rango',
    desc: 'Las medias móviles, el RSI y el ATR, y cómo se ve un mercado que va de lado: soportes, resistencias y compresión.',
    lecciones: Object.freeze(['m5-1', 'm5-2', 'm5-3']),
  }),
  Object.freeze({
    id: 'm6',
    n: 6,
    titulo: 'Lo que cuesta operar',
    desc: 'El spread que pagas al entrar, el swap de cada noche, y por qué el mismo coste pesa mucho más con un Stop-loss corto.',
    lecciones: Object.freeze(['m6-1', 'm6-2', 'm6-3']),
  }),
  Object.freeze({
    id: 'm7',
    n: 7,
    titulo: 'Noticias y bancos centrales',
    desc: 'El calendario económico, lo previsto contra lo anterior, por qué lo que mueve el precio es la sorpresa, y las noticias de los bancos centrales.',
    lecciones: Object.freeze(['m7-1', 'm7-2', 'm7-3']),
  }),
  Object.freeze({
    id: 'm8',
    n: 8,
    titulo: 'Pares que son la misma apuesta',
    desc: 'Cuándo dos operaciones son en realidad una sola, qué mide la correlación entre pares, y por qué tantas operaciones son una apuesta al dólar.',
    lecciones: Object.freeze(['m8-1', 'm8-2', 'm8-3']),
  }),
  Object.freeze({
    id: 'm9',
    n: 9,
    titulo: 'Del análisis a la operación',
    desc: 'Armar una tarjeta en el Analizador con la dirección que eliges tú, revisarla antes de decidir, y guardar tu forma de analizar en plantillas.',
    lecciones: Object.freeze(['m9-1', 'm9-2', 'm9-3']),
  }),
  Object.freeze({
    id: 'm10',
    n: 10,
    titulo: 'Practicar sin dinero',
    desc: 'Crear una operación de práctica desde el Analizador, leer su resultado en R con el spread y el swap descontados, y saber qué demuestra y qué no.',
    lecciones: Object.freeze(['m10-1', 'm10-2', 'm10-3']),
  }),
  Object.freeze({
    id: 'm11',
    n: 11,
    titulo: 'Un número que significa algo',
    desc: 'Por qué acertar no es lo mismo que ganar, cuándo dos porcentajes son distintos de verdad, y por qué un número elegido después de mirar engaña.',
    lecciones: Object.freeze(['m11-1', 'm11-2', 'm11-3']),
  }),
  Object.freeze({
    id: 'm12',
    n: 12,
    titulo: 'Medir tus propios números',
    desc: 'Traer tus operaciones del bróker con el resultado neto, partir tus números en grupos con su margen, y saber qué mirar y qué no concluir de ellos.',
    lecciones: Object.freeze(['m12-1', 'm12-2', 'm12-3']),
  }),
])

// Los que todavía no están escritos. Se enseñan para que se vea el camino,
// marcados «próximamente», y no se pueden abrir.
export const PROXIMOS = Object.freeze([])

export const LECCIONES = Object.freeze({
  'm1-1': {
    titulo: 'Qué es un par de divisas',
    objetivo: 'Leer un par como EUR/USD y saber qué significa que suba o baje.',
    explicacion: [
      'En Forex siempre se cambia una moneda por otra, por eso los precios van de dos en dos. En EUR/USD, el euro va primero (la base) y el dólar segundo (la cotizada).',
      'El precio dice cuántas unidades de la segunda hacen falta para una de la primera. EUR/USD a 1,1600 quiere decir que un euro cuesta 1,16 dólares.',
      'Si EUR/USD sube, el euro se está volviendo más caro frente al dólar. Si baja, más barato. El par no dice cuál de las dos se movió: puede que el euro se haya fortalecido o que el dólar se haya debilitado.',
      'Para saber cuál de las dos se movió, la app compara cada divisa contra todas las demás: es la fuerza relativa del Barrido.',
    ],
    ejemplo: [
      'Las apps siguen pares con las 8 divisas más negociadas: USD, EUR, JPY, GBP, CHF, CAD, AUD y NZD.',
      'Los pares que llevan dólar (EUR/USD, USD/JPY…) se llaman pares mayores. Los que no lo llevan (EUR/CHF, GBP/JPY…) se llaman cruces.',
    ],
    noDice: [
      'Saber leer un par no te dice hacia dónde se va a mover.',
      'Un par que sube no es «bueno» ni uno que baja «malo»: depende de qué lado estés.',
    ],
    video: {
      archivo: 'm1-1',
      desc: 'Video con voz: la fuerza de las 8 divisas en el Barrido, con los datos reales de ese día. Se toma un par de la lista, se dice cuál es la moneda base y cuál la cotizada, y se busca la fuerza de cada una en el ranking.',
    },
    hazlo: {
      tab: 'barrido',
      boton: 'Ir al Barrido',
      texto: 'Mira la fuerza de las 8 divisas. Elige un par de la lista y comprueba qué divisa va primero y cuál segundo.',
    },
    preguntas: [
      {
        p: 'En GBP/JPY, ¿cuál es la base?',
        opciones: ['GBP', 'JPY', 'Ninguna'],
        correcta: 0,
        porque: 'La base es la que va primero: la libra.',
      },
      {
        p: 'Si EUR/USD pasa de 1,1600 a 1,1700, el euro…',
        opciones: ['Se abarató frente al dólar', 'Se encareció frente al dólar', 'No cambió'],
        correcta: 1,
        porque: 'Ahora hace falta más dólares para un euro.',
      },
      {
        p: '¿El par te dice cuál de las dos divisas se movió?',
        opciones: ['Sí, siempre', 'No: para eso sirve comparar cada divisa contra las demás', 'Solo en los cruces'],
        correcta: 1,
        porque: 'El par solo compara dos. La fuerza relativa las compara todas.',
      },
    ],
  },

  'm1-2': {
    titulo: 'El pip y el lote',
    objetivo: 'Saber qué es un pip, qué es un lote y cuánto dinero es un pip según el tamaño.',
    explicacion: [
      'El pip es la unidad en la que se mide cuánto se mueve el precio. En casi todos los pares es la cuarta cifra decimal (0,0001). En los pares con yen japonés es la segunda (0,01).',
      'El lote es el tamaño de la operación. Un lote entero son 100.000 unidades de la moneda base. También existen el minilote (0,1) y el microlote (0,01).',
      'Lo que de verdad importa es cuánto dinero vale un pip con tu lote, porque eso es lo que ganas o pierdes por cada pip que se mueve el precio.',
    ],
    ejemplo: [
      'EUR/USD de 1,1600 a 1,1630 son 30 pips.',
      'USD/JPY de 155,00 a 155,30 también son 30 pips (aquí el pip es 0,01).',
      'En EUR/USD, un pip vale 10 USD con un lote entero, 1 USD con un minilote y 0,10 USD con un microlote.',
      'Así que 30 pips con un microlote son 3 USD; con un lote entero, 300 USD. El mismo movimiento, cien veces más dinero.',
    ],
    formula: {
      texto: 'dinero = pips × valor del pip por lote × lote',
      conNumeros: '30 × 10 × 0,01 = 3 USD',
    },
    noDice: [
      'No te dice qué lote usar: eso sale de tu riesgo y de tu Stop-loss (módulo 2).',
      'En los pares que no terminan en USD, el valor del pip cambia con el precio. La calculadora lo hace sola.',
    ],
    video: {
      archivo: 'm1-2',
      desc: 'Video con voz: la calculadora de la pestaña Riesgo. Con EUR/USD el pip vale 10 USD por lote; al cambiar a USD/JPY el valor del pip cambia, porque depende del precio. Después, el mismo movimiento de 30 pips con un microlote y con un lote entero.',
    },
    hazlo: {
      tab: 'calc',
      boton: 'Ir a Riesgo',
      texto: 'En la calculadora, elige EUR/USD y mira el valor del pip. Cambia a USD/JPY y mira cómo cambia.',
    },
    preguntas: [
      {
        p: 'En EUR/USD, ¿cuántos pips hay de 1,0850 a 1,0870?',
        opciones: ['2', '20', '200'],
        correcta: 1,
        porque: 'Cada 0,0001 es un pip: 0,0020 son 20 pips.',
      },
      {
        p: '¿Cuántas unidades tiene un microlote?',
        opciones: ['100.000', '10.000', '1.000'],
        correcta: 2,
        porque: 'Un microlote es 0,01 lotes: 1.000 unidades.',
      },
      {
        p: 'En EUR/USD, 20 pips con un minilote (0,1) son…',
        opciones: ['2 USD', '20 USD', '200 USD'],
        correcta: 1,
        porque: '20 × 10 × 0,1 = 20 USD.',
      },
    ],
  },

  'm1-3': {
    titulo: 'El spread y el apalancamiento',
    objetivo: 'Entender lo que cuesta entrar y por qué el apalancamiento no cambia tu riesgo, pero sí lo esconde.',
    explicacion: [
      'Cada precio tiene dos caras: el precio al que te venden (ask) y el precio al que te compran (bid). La diferencia es el spread, y lo pagas al abrir cada operación.',
      'Por eso toda operación empieza perdiendo un poco. Cuanto más ancho el spread y más corto el Stop-loss, más pesa ese coste.',
      'El apalancamiento es dinero que el bróker te deja mover sin ponerlo tú. Con 1:100, 1.000 USD te permiten abrir una operación de 100.000.',
      'El apalancamiento no decide cuánto pierdes por pip: eso lo decide el lote. Lo que hace es dejarte abrir lotes mucho más grandes de lo que tu capital aguanta. Ahí está el peligro.',
    ],
    ejemplo: [
      'Un spread de 1,2 pips en EUR/USD con un Stop-loss de 30 pips es el 4 % del riesgo.',
      'El mismo spread con un Stop-loss de 10 pips es el 12 %.',
      'En la app de intradía, con Stop-loss más cortos, el spread pesa unas cuatro veces más que en la de swing. Está medido.',
    ],
    formula: {
      texto: 'peso del spread = spread ÷ pips del Stop-loss',
      conNumeros: '1,2 ÷ 30 = 0,04 → 4 %',
    },
    noDice: [
      'El spread que ves en la app es el de una cuenta real del desarrollador, no el de tu bróker. El tuyo puede ser distinto.',
      'Tener apalancamiento alto no te obliga a usarlo. El riesgo lo controlas con el lote.',
    ],
    video: {
      archivo: 'm1-3',
      desc: 'Video con voz: la tarjeta «Lo que cuesta abrir la operación» del Barrido, con el spread real de una cuenta del desarrollador ese día. Se compara el spread de EUR/USD con el de un cruce y se calcula cuánto pesa sobre un Stop-loss corto y uno largo.',
    },
    hazlo: {
      tab: 'barrido',
      boton: 'Ir al Barrido',
      texto: 'Busca la tarjeta «Lo que cuesta abrir la operación» y compara el spread de EUR/USD con el de un cruce como EUR/NZD.',
    },
    preguntas: [
      {
        p: '¿Qué es el spread?',
        opciones: ['La comisión mensual del bróker', 'La diferencia entre el precio de venta y el de compra', 'Lo que ganas en una operación'],
        correcta: 1,
        porque: 'Es la diferencia entre ask y bid, y se paga al abrir.',
      },
      {
        p: 'Con el mismo spread, ¿cuándo pesa más?',
        opciones: ['Con el Stop-loss lejos', 'Con el Stop-loss cerca', 'Pesa igual siempre'],
        correcta: 1,
        porque: 'Con el Stop-loss cerca, el spread es una parte más grande del riesgo.',
      },
      {
        p: '¿Qué decide cuánto pierdes por cada pip?',
        opciones: ['El apalancamiento', 'El lote', 'El spread'],
        correcta: 1,
        porque: 'El lote. El apalancamiento solo te deja abrir lotes más grandes.',
      },
    ],
  },

  'm3-1': {
    titulo: 'Por qué los días malos se vuelven peores',
    objetivo: 'Reconocer el momento en que una pérdida empuja a la siguiente.',
    explicacion: [
      'Casi nadie pierde la cuenta en una sola operación. Se pierde en un mal día: una pérdida, después otra abierta para recuperar la primera, más grande y con menos análisis.',
      'Cuando ya vas perdiendo, la cabeza busca recuperar, no analizar. Las decisiones salen peores justo cuando más falta hacen buenas.',
      'Por eso la regla de cuándo parar se escribe ANTES, con la cabeza fría, y no en mitad del día.',
    ],
    ejemplo: [
      'Dos formas de cerrar el mismo mal día, con 1.000 USD de capital:',
      'A: pierdes 10, paras. Al día siguiente sigues con 990.',
      'B: pierdes 10, abres otra con el doble para recuperar y pierdes 20, abres otra más con 40 y pierdes. Al día siguiente tienes 930.',
      'B no tuvo peor suerte: tomó más decisiones con la cabeza caliente.',
    ],
    noDice: [
      'Parar no asegura que el día siguiente salga mejor. Lo que sí hace es que un mal día no se coma la cuenta.',
      'No te dice cuál es tu límite: lo decides tú.',
    ],
    video: {
      archivo: 'm3-1',
      desc: 'Video con voz: dos maneras de cerrar el mismo mal día con 1.000 USD, y la pestaña Riesgo con los dos frenos de «Mi perfil de riesgo»: la pérdida máxima del día y las pérdidas seguidas, que se ponen antes, con la cabeza fría.',
    },
    hazlo: {
      tab: 'calc',
      boton: 'Ir a Riesgo',
      texto: 'En «Mi perfil de riesgo», pon tu pérdida máxima del día y cuántas pérdidas seguidas aguantas. Si no sabes qué poner, la app te propone unos valores.',
    },
    preguntas: [
      {
        p: '¿Cuándo es mejor decidir cuándo parar?',
        opciones: ['Cuando vas perdiendo', 'Antes de empezar el día', 'Al final de la semana'],
        correcta: 1,
        porque: 'Con la cabeza fría, antes de que las pérdidas empujen a decidir mal.',
      },
      {
        p: '¿Qué suele pasar después de una pérdida grande?',
        opciones: ['Se opera con más cuidado', 'Se intenta recuperar rápido, con más riesgo', 'No pasa nada'],
        correcta: 1,
        porque: 'Las ganas de recuperar empujan a operaciones más grandes y peor pensadas.',
      },
      {
        p: 'Parar a tiempo…',
        opciones: ['Hace que mañana ganes', 'Evita que un mal día se coma la cuenta', 'Hace que aciertes más'],
        correcta: 1,
        porque: 'No cambia el acierto: limita el daño de los días malos.',
      },
    ],
  },

  'm3-2': {
    titulo: 'El freno: pérdida del día y pérdidas seguidas',
    objetivo: 'Entender los dos frenos de «Mi perfil de riesgo» y cómo los vigila la app.',
    explicacion: [
      'La app te deja poner dos frenos. Uno es la pérdida máxima del día: un porcentaje de tu capital que, si lo pierdes en un día, paras. El otro son las pérdidas seguidas: cuántas operaciones perdidas una detrás de otra aguantas antes de parar.',
      '«Tu freno de hoy», arriba del Diario, va sumando lo que llevas perdido hoy y las pérdidas seguidas. Se pone ámbar cuando te acercas y rojo cuando tocas tu propia regla.',
      'La app no cierra nada ni te bloquea: no está conectada a tu bróker. Solo te lo pone delante, con tus propios números.',
    ],
    ejemplo: [
      `Con 1.000 USD, un riesgo del 1 % por operación y una pérdida máxima del día del ${fmt(SUGERIDO.limiteDiarioPct)} %, tu freno del día son ${fmt(FRENO_USD)} USD.`,
      `Como cada operación arriesga 10 USD, el día se acaba a la operación perdida número ${OPS_FRENO}.`,
      `Y el freno de pérdidas seguidas que la app propone es ${SUGERIDO.maxPerdidasSeguidas}: lo que llegue antes.`,
    ],
    formula: {
      texto: 'operaciones hasta el freno = pérdida máxima del día ÷ riesgo por operación',
      conNumeros: `${fmt(SUGERIDO.limiteDiarioPct)} % ÷ 1 % = ${OPS_FRENO}`,
    },
    noDice: [
      'La app no te impide seguir operando: solo te avisa. La decisión de parar es tuya.',
      'Cuenta solo las operaciones de este Diario. Si operas en las dos apps, cada una lleva su propio freno.',
    ],
    video: {
      archivo: 'm3-2',
      desc: 'Video con voz: «Tu freno de hoy», arriba del Diario, con un usuario de ejemplo que hoy lleva dos operaciones perdidas. La tarjeta suma lo perdido contra el freno del día y las pérdidas seguidas contra su límite, y se pone ámbar cuando queda poco margen.',
    },
    hazlo: {
      tab: 'diario',
      boton: 'Ir al Diario',
      texto: 'Arriba del Diario está «Tu freno de hoy». Si todavía no tienes perfil de riesgo, la tarjeta te lo pide.',
    },
    preguntas: [
      {
        p: 'Con 2.000 USD y una pérdida máxima del día del 3 %, ¿cuál es tu freno?',
        opciones: ['30 USD', '60 USD', '600 USD'],
        correcta: 1,
        porque: '2.000 × 3 % = 60 USD.',
      },
      {
        p: '¿Qué hace la app cuando tocas el freno?',
        opciones: ['Cierra tus operaciones', 'Te avisa en rojo con tu propia regla', 'Bloquea tu cuenta del bróker'],
        correcta: 1,
        porque: 'Solo avisa: no está conectada a ningún bróker.',
      },
      {
        p: 'Con un riesgo del 1 % y un freno del día del 3 %, el día se acaba…',
        opciones: ['A la primera pérdida', 'A la tercera pérdida', 'Nunca'],
        correcta: 1,
        porque: '3 % ÷ 1 % = 3 operaciones perdidas.',
      },
    ],
  },

  'm0-1': {
    titulo: 'Información, no señales',
    objetivo: 'Saber qué te da esta app y qué no, antes de usarla con dinero.',
    explicacion: [
      'Esta app junta en un solo sitio lo que te llevaría una hora de mirar gráficos: qué divisas están fuertes y cuáles débiles, qué noticias vienen, cuánto cuesta abrir una operación y cuánto mantenerla, y qué pares se mueven juntos.',
      'La dirección, el Stop-loss y el Take-profit que ves en algunas pantallas son EXPERIMENTOS: reglas que la app anota cada día y resuelve después con los precios reales, para saber si funcionan.',
      'Están ahí para que veas cómo van, no para que las copies. Mientras un experimento no tenga suficientes operaciones reales, su resultado puede ser pura suerte.',
      'Piénsalo como un mapa del tiempo: te dice si va a llover, pero la decisión de salir con paraguas es tuya.',
    ],
    ejemplo: [
      `Cada experimento tiene que llegar a ${L} operaciones reales antes de que su resultado signifique algo.`,
      'Cuando llega, quien decide es el desarrollador de la app: seguir midiendo, cambiar a otro experimento o, si el resultado es bueno, empezar a darlo como señal. Si el resultado es malo, también se informa.',
    ],
    noDice: [
      'No te dice qué operación abrir ni cuándo.',
      'No te promete que vayas a ganar. Ninguna herramienta puede prometerlo.',
      'No es asesoría financiera: las decisiones y el riesgo son tuyos.',
    ],
    video: {
      archivo: 'm0-1',
      desc: 'Video con voz: el Barrido con los datos reales de ese día. Se abre la tarjeta «Qué es esta app», se lee que nada de lo que se ve es una señal para copiar, y se baja hasta los avisos de los experimentos, que dicen «Esto NO son señales».',
    },
    hazlo: {
      tab: 'barrido',
      boton: 'Ir al Barrido',
      texto: 'Arriba del todo está la tarjeta «Qué es esta app». Ábrela y léela entera: es lo mismo que esta lección, siempre a mano.',
    },
    preguntas: [
      {
        p: 'Ves en la app un par con dirección, Stop-loss y Take-profit. ¿Qué es?',
        opciones: ['Una orden que hay que copiar', 'Un experimento que la app está midiendo', 'Una garantía de ganancia'],
        correcta: 1,
        porque: 'Son experimentos: la app los anota y los resuelve con precios reales para saber si funcionan. No son órdenes para copiar.',
      },
      {
        p: `¿Cuántas operaciones reales necesita un experimento antes de que su resultado signifique algo?`,
        opciones: ['10', `${L}`, '1.000'],
        correcta: 1,
        porque: `${L}. Con menos, un resultado alto y uno bajo pueden ser la misma suerte.`,
      },
      {
        p: '¿Quién toma la decisión de abrir una operación?',
        opciones: ['La app', 'El desarrollador', 'Tú'],
        correcta: 2,
        porque: 'Tú. La app te da información; la decisión y el riesgo son tuyos.',
      },
    ],
  },

  'm0-2': {
    titulo: 'Por qué los números chicos no dicen nada',
    objetivo: 'Entender el ± que va al lado de cada porcentaje y saber cuándo un acierto ya se puede creer.',
    explicacion: [
      'Si tiras una moneda 10 veces y salen 7 caras, no está trucada: eso pasa todo el rato. Si la tiras 400 veces y salen 280, ahí sí pasa algo. Es el mismo 70 %, y significa cosas completamente distintas.',
      'Con las operaciones pasa igual. Por eso la app pone al lado de cada porcentaje un «±»: cuánto puede moverse ese número solo por casualidad.',
      'Con pocas operaciones el ± es enorme. Con muchas, es pequeño.',
    ],
    ejemplo: [
      `Con 9 operaciones, el margen es de ±${margen(9)} puntos.`,
      `Con 25, de ±${margen(25)}.`,
      `Con 100, de ±${margen(100)}.`,
      `Con ${L}, de ±${margen(L)}.`,
      'Un caso real de esta app: el desarrollador vio en su Historial un 89 % de acierto. Eran 9 operaciones. Con una moneda cargada al 55 %, sacar 8 o 9 aciertos de 9 pasa una de cada 26 veces. O sea que ese 89 % no demostraba nada.',
    ],
    formula: {
      texto: 'margen ≈ 98 ÷ √(número de operaciones)',
      conNumeros: `con 25 operaciones: 98 ÷ √25 = 98 ÷ 5 ≈ ${margen(25)} puntos`,
    },
    noDice: [
      'No te dice que un número esté mal calculado: está bien calculado y todavía no significa nada.',
      'No te dice si una regla funciona. Solo te dice cuándo ya se podrá saber.',
      'Es el margen del peor caso, a propósito: si se afinara a favor, serviría para presumir, no para decidir.',
    ],
    video: {
      archivo: 'm0-2',
      desc: 'Video con voz: el Historial con el registro real de ese día. Se señala el ± que va pegado al acierto según cuántas operaciones lleva cada regla, y el aviso de cuántas le faltan al experimento para que su número signifique algo.',
    },
    hazlo: {
      tab: 'diario',
      boton: 'Ir al Diario',
      texto: 'Abre «Tus números por grupos». Mira el ± al lado de cada porcentaje y fíjate cuántas operaciones lleva cada grupo.',
    },
    preguntas: [
      {
        p: 'Una regla lleva 10 operaciones y acierta el 70 %. ¿Qué puedes concluir?',
        opciones: ['Que funciona', 'Que no funciona', 'Todavía nada: con 10 operaciones el margen es enorme'],
        correcta: 2,
        porque: `Con 10 operaciones el margen ronda ±${margen(10)} puntos: un 40 % y un 70 % pueden ser el mismo número.`,
      },
      {
        p: '¿Qué pasa con el ± cuando hay más operaciones?',
        opciones: ['Se hace más pequeño', 'Se hace más grande', 'No cambia'],
        correcta: 0,
        porque: 'Se hace más pequeño: con más datos, la casualidad pesa menos.',
      },
      {
        p: 'El 89 % del desarrollador sobre 9 operaciones…',
        opciones: ['Demostraba que la app funciona', 'No demostraba nada todavía', 'Demostraba que no funciona'],
        correcta: 1,
        porque: 'Con 9 operaciones, un 89 % es compatible con no tener ninguna ventaja.',
      },
    ],
  },

  'm2-1': {
    titulo: 'Arriesgar siempre el mismo porcentaje',
    objetivo: 'Saber por qué se arriesga un porcentaje fijo y pequeño del capital en cada operación.',
    explicacion: [
      'El riesgo de una operación es lo que pierdes si toca el Stop-loss. Quien empieza suele pensar en cuánto puede ganar; quien dura en el mercado piensa primero en cuánto puede perder.',
      'La costumbre más extendida es arriesgar entre el 1 % y el 2 % del capital en cada operación, y que sea siempre el mismo porcentaje.',
      'La razón es que las pérdidas seguidas pasan, aunque lo hagas todo bien. Con un riesgo pequeño aguantas la mala racha; con uno grande, una mala racha te saca del juego.',
      'Y recuperar cuesta más que perder: si pierdes la mitad del capital, para volver al principio tienes que ganar el doble de lo que te quedó.',
    ],
    ejemplo: [
      'Diez pérdidas seguidas, empezando con 1.000 USD:',
      'Arriesgando el 1 % cada vez, te quedan unos 904 USD.',
      'Arriesgando el 2 %, unos 817 USD.',
      'Arriesgando el 10 %, unos 349 USD. Perdiste casi dos tercios.',
      'Y si pierdes el 50 %, para volver a los 1.000 USD necesitas ganar un 100 % sobre lo que te quedó.',
    ],
    formula: {
      texto: 'capital después de n pérdidas = capital × (1 − riesgo)ⁿ',
      conNumeros: '1.000 × (1 − 0,01)¹⁰ = 1.000 × 0,904 ≈ 904 USD',
    },
    noDice: [
      'No te dice que con el 1 % vayas a ganar: solo que una mala racha no te saca del juego.',
      'No es una regla del mercado: es una costumbre de gestión del riesgo. El porcentaje lo decides tú.',
    ],
    video: {
      archivo: 'm2-1',
      desc: 'Video con voz: «Mi perfil de riesgo» de la pestaña Riesgo con un perfil de ejemplo de 1.000 USD. Se cambia el riesgo entre 1 %, 2 % y 3 % y se ve cuánto se arriesga por operación; después, cuánto queda tras diez pérdidas seguidas con cada porcentaje.',
    },
    hazlo: {
      tab: 'calc',
      boton: 'Ir a Riesgo',
      texto: 'Arriba está «Mi perfil de riesgo». Pon tu capital y el porcentaje que quieres arriesgar por operación. La calculadora de debajo lo usará sola.',
    },
    preguntas: [
      {
        p: '¿Qué es el riesgo de una operación?',
        opciones: ['Lo que puedes ganar', 'Lo que pierdes si toca el Stop-loss', 'El precio de entrada'],
        correcta: 1,
        porque: 'Es lo que pierdes si el precio llega al Stop-loss.',
      },
      {
        p: 'Tras diez pérdidas seguidas, ¿quién conserva más capital?',
        opciones: ['Quien arriesga el 1 % cada vez', 'Quien arriesga el 10 % cada vez', 'Los dos igual'],
        correcta: 0,
        porque: 'El 1 % conserva unos 904 de cada 1.000; el 10 %, unos 349.',
      },
      {
        p: 'Si pierdes el 50 % del capital, ¿cuánto tienes que ganar para volver al principio?',
        opciones: ['50 %', '75 %', '100 %'],
        correcta: 2,
        porque: 'Un 100 %: de 500 a 1.000 hay que duplicar lo que queda.',
      },
    ],
  },

  'm2-2': {
    titulo: 'Stop-loss, Take-profit y la relación R/B',
    objetivo: 'Entender qué es la relación riesgo/beneficio y qué acierto hace falta para no perder.',
    explicacion: [
      'El Stop-loss es el precio en el que la operación se cierra perdiendo. El Take-profit es el precio en el que se cierra ganando. Los dos se ponen al abrir, antes de que el mercado te ponga nervioso.',
      'La relación riesgo/beneficio (R/B) compara las dos distancias. 1:2 quiere decir que puedes ganar el doble de lo que arriesgas.',
      'Cuanto más lejos el Take-profit comparado con el Stop-loss, menos veces hace falta acertar para no perder. Pero también llega menos veces.',
    ],
    ejemplo: [
      'Con R/B 1:1, hace falta acertar el 50 % de las veces para quedar igual.',
      'Con 1:1,5, el 40 %.',
      'Con 1:2, el 33 %.',
      'Con 1:0,5 (el objetivo a la mitad que el stop), el 67 %.',
      'Y a eso hay que sumarle el spread y el swap, que se pagan siempre.',
    ],
    formula: {
      texto: 'acierto para no perder = 1 ÷ (1 + R/B)',
      conNumeros: 'con 1:2 → 1 ÷ (1 + 2) = 0,33 → 33 %',
    },
    noDice: [
      'Un R/B alto no hace ganar por sí solo: reparte el resultado entre cuántas veces aciertas y cuánto ganas. Esta app lo midió con doce combinaciones de Stop-loss y Take-profit sobre cinco años, y ninguna convertía una regla perdedora en ganadora.',
      'No te dice dónde poner el Stop-loss: eso sale de cuánto se mueve el par (el ATR) y de tu análisis.',
    ],
    video: {
      archivo: 'm2-2',
      desc: 'Video con voz: el Analizador con los datos reales de ese día. Se elige un par y una dirección cualquiera solo para ver las cuentas, y se prueban los tres métodos de Stop-loss: cambian el Stop-loss, el Take-profit, el R/B y el lote.',
    },
    hazlo: {
      tab: 'analizar',
      boton: 'Ir a Analizar',
      texto: 'Elige un par y una dirección. La tarjeta te enseña el Stop-loss, el Take-profit y su R/B. Prueba los tres métodos de Stop-loss y mira cómo cambia el R/B.',
    },
    preguntas: [
      {
        p: '¿Qué quiere decir un R/B de 1:2?',
        opciones: ['Que arriesgas el doble de lo que puedes ganar', 'Que puedes ganar el doble de lo que arriesgas', 'Que aciertas 2 de cada 3'],
        correcta: 1,
        porque: 'Que la distancia al Take-profit es el doble que la distancia al Stop-loss.',
      },
      {
        p: 'Con R/B 1:1, ¿qué acierto necesitas para quedar igual (sin contar costes)?',
        opciones: ['33 %', '50 %', '67 %'],
        correcta: 1,
        porque: '1 ÷ (1 + 1) = 50 %.',
      },
      {
        p: '¿Un R/B alto hace que una regla gane?',
        opciones: ['Sí, siempre', 'No por sí solo: cambia el acierto que hace falta', 'Solo en intradía'],
        correcta: 1,
        porque: 'Reparte el resultado entre acierto y tamaño de la ganancia, pero no crea una ventaja que no existe.',
      },
    ],
  },

  'm2-3': {
    titulo: 'El lote sale del Stop-loss',
    objetivo: 'Calcular el lote para arriesgar siempre lo mismo, sea el Stop-loss corto o largo.',
    explicacion: [
      'Un lote mal calculado te puede vaciar la cuenta aunque aciertes más de lo que fallas. Un lote bien calculado hace que cada error te cueste exactamente lo que decidiste.',
      'El error más común es usar siempre el mismo lote. Así, una operación con el Stop-loss lejos arriesga mucho más que una con el Stop-loss cerca, sin que te des cuenta.',
      'Lo correcto es al revés: primero decides cuánto arriesgar en dinero (tu porcentaje), después miras a cuántos pips está el Stop-loss, y de ahí sale el lote.',
      'Con el Stop-loss lejos, el lote baja. Con el Stop-loss cerca, sube. Lo que se queda igual es lo que arriesgas.',
      'No tienes que hacer la cuenta a mano: la calculadora (pestaña Riesgo) y la tarjeta del Analizador sacan el lote de tu perfil de riesgo. Esta lección es para que sepas de dónde sale ese número y lo uses tal cual en tu bróker.',
    ],
    ejemplo: [
      'Capital 1.000 USD, riesgo del 1 %: arriesgas 10 USD.',
      'En EUR/USD, un pip vale 10 USD por cada lote entero.',
      'Con el Stop-loss a 25 pips: 10 ÷ (25 × 10) = 0,04 lotes.',
      'Con el Stop-loss a 50 pips: 10 ÷ (50 × 10) = 0,02 lotes.',
      'En los dos casos, si toca el Stop-loss pierdes 10 USD.',
      `Y lo que pasa sin calcularlo: aciertas ${ACIERTOS_LOTE} de 10 ganando 10 USD cada vez, pero las ${10 - ACIERTOS_LOTE} que fallas llevaban un lote tres veces más grande y pierdes 30 USD en cada una. ${ACIERTOS_LOTE} × 10 = +${ACIERTOS_LOTE * 10} USD y ${10 - ACIERTOS_LOTE} × 30 = −${(10 - ACIERTOS_LOTE) * 30} USD: acertaste más veces y perdiste ${(10 - ACIERTOS_LOTE) * 30 - ACIERTOS_LOTE * 10} USD.`,
    ],
    formula: {
      texto: 'lote = dinero que arriesgas ÷ (pips del Stop-loss × valor del pip por lote)',
      conNumeros: '10 ÷ (25 × 10) = 0,04 lotes',
    },
    noDice: [
      'No te dice si la operación es buena: solo que, si sale mal, perderás lo que decidiste.',
      'El valor del pip cambia según el par y según la moneda de tu cuenta. En una cuenta en dólares, en los pares con dólar al final (EUR/USD, GBP/USD…) es 10 USD por lote; en los demás depende del precio. Si tu bróker te lleva la cuenta en euros, elige euros en «Mi perfil de riesgo» y la calculadora lo convierte sola.',
      'No incluye el spread ni el swap.',
    ],
    video: {
      archivo: 'm2-3-lote',
      desc: 'Video con voz: la calculadora con un perfil de 1.000 USD y un 1 % por operación. El Stop-loss pasa de 25 a 50 pips, el lote baja de 0,04 a 0,02 y lo que se arriesga se queda en 10 USD. Después, la misma cuenta en la tarjeta del Analizador, con los datos reales de ese día.',
    },
    hazlo: {
      tab: 'calc',
      boton: 'Ir a Riesgo',
      texto: 'En la calculadora, pon un par y un Stop-loss de 25 pips. Mira el lote. Cambia el Stop-loss a 50 pips y mira cómo baja el lote mientras lo que arriesgas se queda igual. Después, en Analizar, elige un par y una dirección: la tarjeta te da el lote con tu perfil.',
    },
    preguntas: [
      {
        p: 'Si alejas el Stop-loss y quieres arriesgar lo mismo, el lote…',
        opciones: ['Sube', 'Baja', 'Se queda igual'],
        correcta: 1,
        porque: 'Baja: más pips de distancia con el mismo dinero en juego piden un lote más pequeño.',
      },
      {
        p: 'Capital 2.000 USD, riesgo 1 %, Stop-loss a 20 pips en EUR/USD. ¿Qué lote?',
        opciones: ['0,01', '0,1', '1'],
        correcta: 1,
        porque: 'Arriesgas 20 USD: 20 ÷ (20 × 10) = 0,1 lotes.',
      },
      {
        p: '¿Qué va primero?',
        opciones: ['Elegir el lote', 'Decidir cuánto arriesgar y dónde va el Stop-loss', 'Abrir la operación'],
        correcta: 1,
        porque: 'Primero el riesgo y el Stop-loss; el lote sale de ahí.',
      },
    ],
  },
  'm4-1': {
    titulo: 'La fuerza de cada divisa',
    objetivo: 'Entender qué miden las barras de fuerza de las ocho divisas, arriba del Barrido.',
    explicacion: [
      'Un par son dos divisas. Si EUR/USD sube, puede ser porque el euro se fortalece o porque el dólar se debilita: mirando solo ese par no se sabe cuál de las dos fue.',
      'Por eso la app compara cada divisa contra las otras siete a la vez. Una divisa que sube contra casi todas está fuerte; una que baja contra casi todas, débil.',
      'Es como una liga de fútbol: no importa si un equipo le ganó a uno solo, sino cómo le va contra todos los demás.',
    ],
    ejemplo: [
      `En esta app se mira cuánto cambió cada divisa contra cada una de las otras siete en tres plazos: ${VENT.join(', ')}.`,
      `El plazo más corto pesa el ${PCT[0]} y los otros dos el ${PCT[1]} cada uno: así un solo movimiento brusco no decide todo.`,
      'Luego se promedian las siete comparaciones y sale un número por divisa. La lista del Barrido las ordena de la más fuerte a la más débil.',
    ],
    formula: {
      texto: `fuerza = promedio, contra las otras 7 divisas, de (${PCT[0]} × cambio en ${VENT[0]} + ${PCT[1]} × cambio en ${VENT[1]} + ${PCT[2]} × cambio en ${VENT[2]})`,
      conNumeros: `si el euro sube un 0,2 % contra el dólar en el plazo corto y un 1 % en los dos largos: ${fmt(PESOS_FUERZA[0])} × 0,2 + ${fmt(PESOS_FUERZA[1])} × 1 + ${fmt(PESOS_FUERZA[2])} × 1 = ${fmt(+(PESOS_FUERZA[0] * 0.2 + PESOS_FUERZA[1] + PESOS_FUERZA[2]).toFixed(2))} en esa comparación; lo mismo contra las otras seis, y el promedio.`,
    },
    noDice: [
      'No dice que la divisa fuerte vaya a seguir fuerte: mide lo que ya pasó.',
      'No dice qué par abrir ni cuándo.',
      'No es una señal. Es un resumen de cómo se movieron las ocho divisas.',
    ],
    video: {
      archivo: 'm4-1',
      desc: 'Video con voz: el Barrido con los datos reales de ese día. Se señalan las barras de fuerza de las ocho divisas, la más fuerte y la más débil, y se explica que cada una sale de compararla con las otras siete.',
    },
    hazlo: {
      tab: 'barrido',
      boton: 'Ir al Barrido',
      texto: 'Arriba del Barrido están las barras de fuerza de las ocho divisas. Busca la más fuerte y la más débil de hoy.',
    },
    preguntas: [
      {
        p: 'EUR/USD sube. ¿Qué puedes saber solo con eso?',
        opciones: ['Que el euro está fuerte', 'Que el dólar está débil', 'Nada seguro: pudo ser cualquiera de las dos'],
        correcta: 2,
        porque: 'Un par solo no dice cuál de sus dos divisas se movió. Para eso la app compara cada una contra las otras siete.',
      },
      {
        p: '¿Contra cuántas divisas se compara cada una?',
        opciones: ['Contra una', 'Contra las otras siete', 'Contra el oro'],
        correcta: 1,
        porque: 'Contra las otras siete de la app, y se promedia.',
      },
      {
        p: 'Una divisa sale la más fuerte del día. ¿Qué te dice eso de mañana?',
        opciones: ['Que seguirá subiendo', 'Nada: mide lo que ya pasó', 'Que mañana se dará la vuelta'],
        correcta: 1,
        porque: 'La fuerza resume el pasado. No dice hacia dónde irá el precio.',
      },
    ],
  },

  'm4-2': {
    titulo: 'La diferencia que la app mira en cada par',
    objetivo: 'Saber qué es la «Dif» de cada par y por qué la app no mira un par hasta que pasa un umbral.',
    explicacion: [
      'Para un par, lo que cuenta es la diferencia entre la fuerza de sus dos divisas. En el tablero completo sale como «Dif».',
      'Si la Dif es positiva, la primera divisa del par (la base) está más fuerte que la segunda. Si es negativa, al revés.',
      'Con una Dif pequeña, las dos divisas están casi igual de fuertes y el par no tiene a nadie que lo empuje. Por eso la app no mira un par hasta que la diferencia pasa un umbral.',
    ],
    ejemplo: [
      `En esta app el umbral es ${UMBRAL}: un par con Dif +1,2 o −0,9 lo pasa; uno con Dif +0,3 no.`,
      ...(APP === 'swing'
        ? []
        : ['En la app de intradía el umbral sube en las horas de más movimiento (por ejemplo, cuando Londres y Nueva York están abiertas a la vez): a esas horas todo se mueve más, y se pide más diferencia para creerla.']),
      'Si ningún par pasa el umbral, la app no propone nada ese día. No es un fallo: es que ninguna divisa le saca suficiente ventaja a otra.',
    ],
    noDice: [
      'Una Dif grande no dice hacia dónde irá el precio, ni cuándo.',
      'Pasar el umbral es solo la primera condición: la app pide más cosas antes de enseñar un experimento.',
      'Lo que sale de aquí siguen siendo experimentos, no señales para copiar.',
    ],
    video: {
      archivo: 'm4-2',
      desc: 'Video con voz: el tablero completo con los datos reales de ese día. Se señala la «Dif» de un par, se compara con el umbral de la app, y se ve un par que lo pasa y otro que no.',
    },
    hazlo: {
      tab: 'barrido',
      boton: 'Ir al Barrido',
      texto: 'Toca «Ver tablero completo» y busca la «Dif» de cada par. Fíjate cuáles pasan el umbral y cuáles no.',
    },
    preguntas: [
      {
        p: 'Un par tiene Dif +1,5. ¿Qué quiere decir?',
        opciones: ['Que la primera divisa del par está más fuerte que la segunda', 'Que el precio del par tiene que subir', 'Que hay que abrirlo'],
        correcta: 0,
        porque: 'La Dif solo compara la fuerza de las dos divisas. No dice hacia dónde irá el precio.',
      },
      {
        p: `Un par tiene Dif +0,2 y el umbral es ${UMBRAL}. ¿La app lo mira?`,
        opciones: ['Sí', 'No: no pasa el umbral', 'Depende del RSI'],
        correcta: 1,
        porque: `0,2 está por debajo de ${UMBRAL}: las dos divisas están casi igual de fuertes.`,
      },
      {
        p: 'Un día ningún par pasa el umbral. ¿Qué significa?',
        opciones: ['Que la app está rota', 'Que ninguna divisa le saca suficiente ventaja a otra', 'Que hay que bajar el umbral'],
        correcta: 1,
        porque: 'Un día sin señales también es información: el mercado no tiene a nadie claramente por delante.',
      },
    ],
  },

  'm4-3': {
    titulo: 'Por qué «10 contra 0» no es mucha diferencia',
    objetivo: 'No confundir la escala de 0 a 10 de las barras con la diferencia real entre dos divisas.',
    explicacion: [
      'Las barras de fuerza van de 0 a 10. Pero esa escala es un ORDEN: la divisa más fuerte del día vale 10 y la más débil vale 0. Siempre, todos los días.',
      'O sea que «10 contra 0» no quiere decir que haya mucha diferencia. Quiere decir que una es la primera y otra la última, y eso es verdad aunque las ocho estén casi iguales.',
      'Es como la estatura de un grupo de amigos: siempre hay un más alto y un más bajo, aunque se lleven dos centímetros.',
    ],
    ejemplo: [
      'Un caso real, en la app de intradía, el 12 de octubre de 2026: el dólar salía en 10,0 y el franco suizo en 0,0. Parecía la diferencia máxima posible.',
      'Pero la Dif del par más separado de ese momento era 0,31, y ese día a esa hora hacía falta 0,59. Ningún par pasó el umbral y no hubo señales.',
      'La medida de verdad es la Dif del tablero completo, no la escala de 0 a 10.',
    ],
    formula: {
      texto: 'escala = (fuerza de la divisa − la más débil) ÷ (la más fuerte − la más débil) × 10',
      conNumeros: 'la más débil sale siempre (x − x) ÷ (…) × 10 = 0, y la más fuerte siempre 10, sea grande o pequeña la diferencia.',
    },
    noDice: [
      'La escala de 0 a 10 no dice cuánta diferencia hay. Para eso está la Dif.',
      'No dice que haya que operar el par de la más fuerte contra la más débil.',
      'No dice hacia dónde irá ninguna de las dos.',
    ],
    video: {
      archivo: 'm4-3',
      desc: 'Video con voz: las barras de fuerza del Barrido, donde siempre hay un 10 y un 0, y después la «Dif» real del tablero completo, que es la que la app compara con el umbral.',
    },
    hazlo: {
      tab: 'barrido',
      boton: 'Ir al Barrido',
      texto: 'Mira las barras: ¿hay un 10 y un 0? Siempre los hay. Luego abre el tablero completo y compara con la Dif de los pares.',
    },
    preguntas: [
      {
        p: 'En las barras, una divisa sale en 10 y otra en 0. ¿Qué sabes?',
        opciones: ['Que hay una diferencia enorme', 'Solo que una es la primera y otra la última', 'Que hay que operar ese par'],
        correcta: 1,
        porque: 'La escala es un orden: siempre hay un 10 y un 0, aunque la diferencia real sea pequeña.',
      },
      {
        p: '¿Dónde se ve la diferencia real entre las dos divisas de un par?',
        opciones: ['En la escala de 0 a 10', 'En la «Dif» del tablero completo', 'En el RSI'],
        correcta: 1,
        porque: 'La Dif es la resta de las fuerzas sin escalar, y es la que la app compara con el umbral.',
      },
      {
        p: 'El 12 de octubre de 2026 salió «dólar 10,0 y franco 0,0». ¿Hubo señales?',
        opciones: ['Sí, muchas', 'No: la Dif más grande no pasó el umbral', 'Solo en el franco'],
        correcta: 1,
        porque: 'La Dif más grande era 0,31 y hacía falta 0,59. El 10 contra 0 engañaba.',
      },
    ],
  },

  'm4-4': {
    titulo: 'Combinar una divisa fuerte con una débil, y elegir tú la dirección',
    objetivo: 'Saber formar el par con una divisa fuerte y una débil, leer cuál va primero, y entender qué dirección va a favor de la fuerza y cuál en contra.',
    explicacion: [
      'Un par son dos divisas: la primera es la base y la segunda la cotizada. El precio del par dice cuántas unidades de la segunda cuesta una de la primera.',
      'Si la base se fortalece y la cotizada se debilita, las dos empujan el precio del par hacia arriba a la vez. Si pasa al revés, las dos lo empujan hacia abajo. Por eso se busca juntar una fuerte con una débil: es el par donde las dos fuerzas van en el mismo sentido.',
      'El orden importa. Si la fuerte va PRIMERO, comprar el par es ponerse del lado de la fuerte. Si la fuerte va SEGUNDA, ponerse de su lado es vender el par.',
      'No todas las combinaciones existen en la app. Si el par de la más fuerte con la más débil no está, se mira el par más separado que sí está: la «Dif» del tablero completo lo dice.',
      'Y la decisión es tuya. Ir a favor de la fuerza es una forma de operar; ir en contra, esperando que la divisa que más subió se canse, es otra. Ninguna de las dos está validada en esta app, y por eso no te la elige.',
    ],
    ejemplo: [
      'Si la libra es la más fuerte y el yen el más débil, el par es GBP/JPY y la libra va primero: a favor de la fuerza sería COMPRA de GBP/JPY; en contra, VENTA.',
      'Si el franco suizo es el más fuerte y el dólar el más débil, el par es USD/CHF y el franco va SEGUNDO: a favor de la fuerza sería VENTA de USD/CHF, aunque el franco sea el fuerte.',
      `Si la más fuerte es el euro y la más débil el yen, EUR/JPY no está en esta app. Se mira entonces, en el tablero completo, el par con la «Dif» más grande de los que sí están.`,
      `Las señales de esta app siguen justo la idea de ir a favor de la fuerza, y medidas con años de mercado real y con los costes descontados dan ${POR_R_NEUTRA} por cada unidad arriesgada. Por eso esta lección te enseña a leerlo, no a seguirlo sin más.`,
    ],
    formula: {
      texto: 'a favor de la fuerza: si la fuerte es la base → COMPRA del par · si la fuerte es la cotizada → VENTA del par',
      conNumeros: 'libra fuerte y yen débil → GBP/JPY, la libra es la base → a favor de la fuerza, COMPRA. Franco fuerte y dólar débil → USD/CHF, el franco es la cotizada → a favor de la fuerza, VENTA.',
    },
    noDice: [
      'No dice que la divisa fuerte vaya a seguir fuerte: la fuerza mide lo que ya pasó.',
      'No dice que ir a favor de la fuerza sea lo bueno. Medido en esta app, por sí solo pierde.',
      'Antes de decidir faltan la tendencia, las noticias, lo que cuesta la operación y tu riesgo: son los módulos que siguen.',
      'No es una señal. La dirección la eliges tú.',
    ],
    video: {
      archivo: 'm4-4',
      desc: 'Video con voz: el Barrido con los datos reales de ese día. Se leen la divisa más fuerte y la más débil, se busca el par que las junta, se ve cuál va primero y qué dirección va a favor de la fuerza y cuál en contra, y se abre el Analizador, que espera a que la persona elija.',
    },
    hazlo: {
      tab: 'barrido',
      boton: 'Ir al Barrido',
      texto: 'Busca la divisa más fuerte y la más débil de hoy. ¿Existe en la app el par que las junta? ¿Cuál va primero? Di en voz alta qué dirección va a favor de la fuerza.',
    },
    preguntas: [
      {
        p: 'La libra es la más fuerte y el yen el más débil. ¿Qué dirección de GBP/JPY va a favor de la fuerza?',
        opciones: ['COMPRA', 'VENTA', 'Ninguna'],
        correcta: 0,
        porque: 'La libra va primero: comprar GBP/JPY es comprar libras con yenes.',
      },
      {
        p: 'El franco suizo es el más fuerte y el dólar el más débil. ¿Qué dirección de USD/CHF va a favor de la fuerza?',
        opciones: ['COMPRA', 'VENTA', 'Ninguna'],
        correcta: 1,
        porque: 'El franco va segundo: vender USD/CHF es vender dólares para quedarte con francos.',
      },
      {
        p: 'Ir a favor de la fuerza, ¿te asegura algo?',
        opciones: ['Sí, que el par se mueva a tu favor', 'No: es una forma de operar, y medida en esta app por sí sola pierde', 'Solo si la diferencia es de 10 contra 0'],
        correcta: 1,
        porque: 'La fuerza mide el pasado. Por eso hay que mirar lo demás antes de decidir.',
      },
    ],
  },

  'm5-1': {
    titulo: 'Tendencia: el precio y sus medias',
    objetivo: 'Saber qué es una media móvil y cómo decide la app si un par está en tendencia o no.',
    explicacion: [
      'Una media móvil es el precio promedio de las últimas velas. Si el precio está por encima de su media, viene subiendo; si está por debajo, viene bajando.',
      'Hay dos tipos. La SMA (media simple) da el mismo peso a todas las velas. La EMA (media exponencial) da más peso a las más recientes, así que reacciona antes.',
      `La app compara el precio con dos EMA: una rápida de ${EMA_C} velas y una lenta de ${EMA_L}. Aquí cada vela es ${SWING ? 'un día' : 'una hora'}.`,
      `Si el precio está por encima de la EMA ${EMA_C} y la EMA ${EMA_C} por encima de la EMA ${EMA_L}, la app dice «Alcista». Al revés, «Bajista». Si no están en ese orden, «Rango»: no hay una dirección clara.`,
    ],
    ejemplo: [
      TENDENCIA_MIN === 'media'
        ? `En esta app, para que un experimento aparezca basta con que el precio esté del lado correcto de la EMA ${EMA_C}. No espera a que las dos medias se ordenen, porque eso tarda en llegar después de un giro.`
        : `En esta app, para que un experimento de tendencia aparezca, las dos medias tienen que estar en orden: precio por encima de la EMA ${EMA_C} y la EMA ${EMA_C} por encima de la EMA ${EMA_L} (o todo al revés).`,
      `En el Analizador, «Medias móviles» enseña además las SMA ${PERIODOS_MEDIAS.sma.join(', ')} y las EMA ${PERIODOS_MEDIAS.ema.join(', ')}. Son las mismas que verías en un gráfico.`,
      'La EMA 200 puede salir vacía: necesita muchas velas de historia para dar el número correcto, y cuando no las hay la app prefiere no enseñarla a enseñar una cifra a medias.',
    ],
    formula: {
      texto: `Alcista = precio > EMA ${EMA_C} > EMA ${EMA_L} · Bajista = precio < EMA ${EMA_C} < EMA ${EMA_L} · si no, Rango`,
      conNumeros: `precio 1,1650, EMA ${EMA_C} 1,1620 y EMA ${EMA_L} 1,1580: 1,1650 > 1,1620 > 1,1580, así que la app dice «Alcista».`,
    },
    noDice: [
      'Que un par esté «Alcista» no dice que vaya a seguir subiendo: las medias miran hacia atrás.',
      'Las medias llegan tarde a los giros: el precio se da la vuelta primero y las medias lo siguen después.',
      'No es una señal para entrar. Es una forma de resumir hacia dónde se movió el precio.',
    ],
    video: {
      archivo: 'm5-1',
      desc: 'Video con voz: el Analizador con los datos reales de ese día. Se señala la fila «Tendencia» con sus dos EMA y después las medias móviles, y se explica cómo decide la app si un par está en tendencia o en rango.',
    },
    hazlo: {
      tab: 'analizar',
      boton: 'Ir al Analizador',
      texto: 'Elige un par y enciende «Tendencia (EMA)» y «Medias móviles». Mira si el precio está por encima o por debajo de cada media.',
    },
    preguntas: [
      {
        p: '¿En qué se diferencia una EMA de una SMA?',
        opciones: ['La EMA da más peso a las velas recientes', 'La EMA usa más velas', 'Son lo mismo con otro nombre'],
        correcta: 0,
        porque: 'La SMA pesa igual todas las velas; la EMA pesa más las últimas, por eso reacciona antes.',
      },
      {
        p: `Precio por encima de la EMA ${EMA_C}, pero la EMA ${EMA_C} por debajo de la EMA ${EMA_L}. ¿Qué dice la app?`,
        opciones: ['Alcista', 'Bajista', 'Rango: no están en orden'],
        correcta: 2,
        porque: 'Solo es «Alcista» si están las tres en orden: precio, media rápida y media lenta.',
      },
      {
        p: 'Un par sale «Alcista». ¿Qué sabes de mañana?',
        opciones: ['Que seguirá subiendo', 'Nada seguro: las medias miran hacia atrás', 'Que hay que abrirlo'],
        correcta: 1,
        porque: 'La tendencia resume lo que ya pasó. No dice qué va a pasar.',
      },
    ],
  },

  'm5-2': {
    titulo: 'RSI y ATR: cuánto se estiró y cuánto se mueve',
    objetivo: 'Leer el RSI y el ATR, y entender por qué el Stop-loss sale del ATR.',
    explicacion: [
      `El RSI mide si el precio subió o bajó con mucha fuerza en las últimas ${PERIODO_RSI} velas. Va de 0 a 100. Por encima de 70 se suele decir que subió con mucha fuerza; por debajo de 30, que cayó con mucha fuerza.`,
      `El ATR mide cuánto se mueve el par en una vela normal: es el recorrido medio de las últimas ${PERIODO_ATR}. Un par con ATR de 40 pips suele recorrer unos 40 pips en ${SWING ? 'un día' : 'una hora'}.`,
      'Para qué sirve el ATR: un Stop-loss más corto que el movimiento normal del par lo toca el ruido de cualquier día, aunque la idea fuera buena. Por eso la app calcula el Stop-loss con el ATR.',
    ],
    ejemplo: [
      RSI_MAX == null
        ? 'En esta app el RSI se enseña como dato y NO decide qué experimentos aparecen. Se midió si filtrar por RSI mejoraba los resultados, y no los mejoró.'
        : `En esta app el RSI sí cuenta: no aparecen experimentos para comprar con el RSI en ${RSI_MAX} o más, ni para vender con el RSI en ${100 - RSI_MAX} o menos. Se midió y aquí ayudaba algo.`,
      SWING
        ? `Las señales de esta app ponen el Stop-loss por fuera del mínimo de los últimos 10 días (o del máximo, si es venta), con un cojín de ${fmt(MC.COJIN_ATR_STOP)} ATR más.`
        : `Las señales de tendencia de esta app ponen el Stop-loss a ${fmt(MC.ATR_STOP)} ATR del precio.`,
    ],
    formula: SWING
      ? {
          texto: `Stop-loss (compra) = mínimo de 10 días − ${fmt(MC.COJIN_ATR_STOP)} × ATR`,
          conNumeros: `mínimo de 10 días en 1,1500 y ATR de 40 pips: 1,1500 − ${fmt(MC.COJIN_ATR_STOP)} × 0,0040 = ${fmt((1.15 - MC.COJIN_ATR_STOP * 0.004).toFixed(4))}.`,
        }
      : {
          texto: `Stop-loss (compra) = precio − ${fmt(MC.ATR_STOP)} × ATR`,
          conNumeros: `precio 1,1600 y ATR de 20 pips: 1,1600 − ${fmt(MC.ATR_STOP)} × 0,0020 = ${fmt((1.16 - MC.ATR_STOP * 0.002).toFixed(4))}.`,
        },
    noDice: [
      'Un RSI alto no dice que el precio vaya a bajar, ni uno bajo que vaya a subir: puede seguir así varios días.',
      'El ATR no dice hacia dónde irá el precio. Solo cuánto se mueve.',
      'Un Stop-loss bien puesto no hace que la operación gane: solo hace que no la saque el ruido normal del par.',
    ],
    video: {
      archivo: 'm5-2',
      desc: 'Video con voz: el Analizador con los datos reales de ese día. Se señalan el RSI y el ATR de un par, y después el Stop-loss de la tarjeta, que sale del ATR.',
    },
    hazlo: {
      tab: 'analizar',
      boton: 'Ir al Analizador',
      texto: 'Elige un par y una dirección, enciende «RSI» y «ATR», y compara el ATR con la distancia del Stop-loss en pips.',
    },
    preguntas: [
      {
        p: 'Un par tiene el RSI en 78. ¿Qué quiere decir?',
        opciones: ['Que el precio tiene que bajar', 'Que subió con mucha fuerza últimamente', 'Que hay que abrirlo'],
        correcta: 1,
        porque: 'El RSI mide lo que ya pasó. No dice hacia dónde irá el precio.',
      },
      {
        p: '¿Qué mide el ATR?',
        opciones: ['Hacia dónde irá el precio', 'Cuánto se mueve el par en una vela normal', 'Cuántas operaciones ganaste'],
        correcta: 1,
        porque: 'El ATR es el recorrido medio de una vela. No tiene dirección.',
      },
      {
        p: '¿Por qué la app calcula el Stop-loss con el ATR?',
        opciones: ['Para que la operación gane', 'Para que el movimiento normal del par no lo toque', 'Porque lo pide el bróker'],
        correcta: 1,
        porque: 'Un Stop-loss más corto que el movimiento normal lo saca el ruido de cualquier día.',
      },
    ],
  },

  'm5-3': {
    titulo: 'Rango: soportes, resistencias y compresión',
    objetivo: 'Reconocer un mercado que va de lado y leer la compresión sin creer que dice hacia dónde se va a soltar.',
    explicacion: [
      'No siempre hay tendencia. Muchas veces el precio va de lado, rebotando entre un piso y un techo. A eso se le llama rango.',
      'El soporte es el precio más bajo de las últimas 20 velas y la resistencia el más alto. Son los sitios donde el precio frenó antes.',
      `La compresión compara cuánto se mueve el par ahora (su ATR) con cuánto se movía hace ${VELAS_ATRAS_COMPRESION} velas. Por debajo de 1, se mueve menos que antes: está apretado. Por encima de 1, se mueve más.`,
    ],
    ejemplo: [
      `La palabra que sale al lado de la compresión dice qué tan raro es el número para esta app: por debajo de ${fmt(CORTES.muy)} «muy apretado», hasta ${fmt(CORTES.algo)} «algo apretado», por encima de ${fmt(CORTES.ancho)} «más suelto». Esos cortes salen de medir miles de velas de esta app.`,
      SWING
        ? 'Esta app no tiene un modo de rango: sus señales miran la fuerza y la tendencia. El soporte, la resistencia y la compresión se enseñan como datos para tu propio análisis.'
        : `Esta app sí tiene un modo de rango. Solo se activa si el par está en «Rango», la compresión es de ${fmt(MC.COMPRESION_MIN)} o más, el rango mide al menos ${MC.RANGO_MIN_ATR} ATR y el precio está en el ${Math.round(MC.RANGO_BORDE * 100)} % de abajo o de arriba del rango.`,
      'Se midió si la compresión ayuda a elegir mejores operaciones, y no ayudó: los resultados con y sin ese filtro salieron iguales o sin muestra suficiente para decir nada.',
    ],
    formula: {
      texto: `compresión = ATR de ahora ÷ ATR de hace ${VELAS_ATRAS_COMPRESION} velas`,
      conNumeros: 'ATR de ahora 30 pips y ATR de antes 40 pips: 30 ÷ 40 = 0,75. El par se mueve un 25 % menos que antes.',
    },
    noDice: [
      'Que el precio frenara en un soporte no quiere decir que vuelva a frenar ahí.',
      'Que un par esté apretado no dice hacia qué lado se va a soltar, ni cuándo.',
      'Ninguno de estos datos es una señal: te dicen dónde mirar, no qué hacer.',
    ],
    video: {
      archivo: 'm5-3',
      desc: 'Video con voz: el Analizador con los datos reales de ese día. Se señalan el soporte y la resistencia de un par y después su compresión, con la palabra que dice qué tan raro es ese número.',
    },
    hazlo: {
      tab: 'analizar',
      boton: 'Ir al Analizador',
      texto: 'Elige un par, enciende «Soporte y resistencia» y «Compresión», y mira dónde está el precio entre el piso y el techo.',
    },
    preguntas: [
      {
        p: '¿Qué es el soporte en la app?',
        opciones: ['El precio más bajo de las últimas 20 velas', 'El precio al que hay que comprar', 'La media de 20 velas'],
        correcta: 0,
        porque: 'Es el mínimo de las últimas 20 velas: un sitio donde el precio frenó antes.',
      },
      {
        p: 'La compresión sale 0,70. ¿Qué significa?',
        opciones: ['Que el par se mueve menos que antes', 'Que el precio tiene que subir pronto', 'Que el par está barato'],
        correcta: 0,
        porque: 'Por debajo de 1 el par se mueve menos que antes. No dice hacia dónde.',
      },
      {
        p: 'Un par está «muy apretado». ¿Qué sabes de hacia dónde se soltará?',
        opciones: ['Hacia arriba', 'Hacia abajo', 'Nada: la compresión no tiene dirección'],
        correcta: 2,
        porque: 'La compresión mide cuánto se mueve, no hacia dónde.',
      },
    ],
  },
  'm6-1': {
    titulo: 'El spread: lo que pagas al entrar',
    objetivo: 'Saber qué es el spread, por qué toda operación empieza perdiendo un poco y por qué cambia según el par y la hora.',
    explicacion: [
      'Cada par tiene dos precios a la vez: el de venta (BID) y el de compra (ASK). El de compra siempre es un poco más alto. La diferencia entre los dos es el spread, y se mide en pips.',
      'Compras al precio de compra y, para cerrar, vendes al de venta. Por eso toda operación empieza perdiendo el spread: es lo que cobra el bróker por dejarte entrar.',
      'El spread no es fijo. Se estrecha cuando hay mucha gente operando (Londres y Nueva York abiertas a la vez) y se abre de golpe minutos antes y después de una noticia fuerte, de madrugada y los lunes al abrir.',
    ],
    ejemplo: [
      `Los pares con dólar suelen costar menos que los cruces. En la tabla con la que la app descuenta el coste en sus pruebas, EUR/USD cuesta ${fmt(SP_MAYOR)} pips y NZD/CHF ${fmt(SP_CRUCE)}: ${fmt((SP_CRUCE / SP_MAYOR).toFixed(1))} veces más.`,
      'En el Barrido, la tarjeta «Lo que cuesta abrir la operación» enseña el spread real de cada par mientras el puente de MT5 del desarrollador está encendido. Es el de una cuenta real del desarrollador de la app: el de tu bróker puede ser otro.',
    ],
    formula: {
      texto: 'spread = precio de compra (ASK) − precio de venta (BID)',
      conNumeros: `ASK ${fmt((1.16 + SP_MAYOR * 0.0001).toFixed(5))} y BID 1,16000: la diferencia es ${fmt((SP_MAYOR * 0.0001).toFixed(5))}, o sea ${fmt(SP_MAYOR)} pips.`,
    },
    noDice: [
      'Un spread bajo no hace que la operación gane: solo hace que entrar cueste menos.',
      'El spread que enseña la app no es el de tu bróker. Míralo en tu plataforma antes de operar.',
      'Un spread que se abre no dice hacia dónde se va a mover el precio: dice que en ese momento entrar es más caro.',
    ],
    video: {
      archivo: 'm6-1',
      desc: 'Video con voz: el Barrido con los datos reales de ese día. Se señala la tarjeta «Lo que cuesta abrir la operación» y el spread de un par con dólar y el de un cruce.',
    },
    hazlo: {
      tab: 'barrido',
      boton: 'Ir al Barrido',
      texto: 'Busca la tarjeta «Lo que cuesta abrir la operación» y compara el spread de EUR/USD con el de un cruce como EUR/NZD.',
    },
    preguntas: [
      {
        p: 'El precio de compra de un par es 1,16012 y el de venta 1,16000. ¿Cuánto es el spread?',
        opciones: ['1,2 pips', '12 pips', '0,12 pips'],
        correcta: 0,
        porque: 'La diferencia es 0,00012, o sea 1,2 pips.',
      },
      {
        p: '¿Por qué toda operación empieza perdiendo un poco?',
        opciones: ['Porque el bróker cobra el spread al entrar', 'Porque el precio siempre baja al abrir', 'Porque el Stop-loss está mal puesto'],
        correcta: 0,
        porque: 'Compras al precio de compra y cierras al de venta: la diferencia es el spread.',
      },
      {
        p: '¿Cuándo suele abrirse el spread?',
        opciones: ['Cuando hay mucha gente operando', 'Minutos antes y después de una noticia fuerte', 'Nunca cambia'],
        correcta: 1,
        porque: 'Con una noticia fuerte el precio pega saltos y el spread se abre. Con mucha gente, se estrecha.',
      },
    ],
  },

  'm6-2': {
    titulo: 'El swap: lo que cuesta dejarla abierta de noche',
    objetivo: 'Saber qué es el swap, de dónde sale y por qué la diferencia de tasas no es el swap de tu bróker.',
    explicacion: [
      'Si una operación sigue abierta al corte diario del bróker (hacia las 5 de la tarde de Nueva York), pagas o cobras un swap. Se cobra cada noche que siga abierta.',
      'Sale de la diferencia entre las tasas de interés de las dos divisas del par. Comprar la divisa que paga más interés suele cobrar; comprar la que paga menos suele costar.',
      'Pero el bróker le suma su margen, y ese margen no lo publica nadie. Por eso casi siempre se paga más en un sentido de lo que se cobra en el otro, y a veces se paga en los dos.',
      'Un día de la semana el swap cuenta triple, para cubrir el fin de semana. Cuál día lo dice cada bróker.',
    ],
    ejemplo: [
      `En el Barrido, la tarjeta «Tasas de interés y swap» enseña la tasa de cada banco central y hacia qué lado suele jugar el swap en cada par. Si la diferencia es menor de ${fmt(UMBRAL_NEUTRO)} puntos dice «apenas pesa»: el margen del bróker se la come entera.`,
      SWING
        ? 'Las operaciones de esta app duran días, así que el swap se paga muchas noches. En las pruebas de la app se descuenta a varios niveles, porque cada bróker cobra distinto.'
        : 'Esta app es de intradía, pero eso es la intención: medido en septiembre de 2026, la mitad de sus operaciones reales cruzaron al menos una noche y pagaron swap.',
    ],
    formula: {
      texto: 'swap de la operación = swap por noche × noches (la noche triple cuenta 3)',
      conNumeros: '0,5 pips por noche y 5 noches con la triple dentro: 0,5 × (4 + 3) = 3,5 pips.',
    },
    noDice: [
      'La diferencia de tasas no es tu swap: tu bróker le suma su margen. Míralo en tu plataforma.',
      'Un swap a favor no es una razón para abrir una operación: es un coste o un ingreso, no una dirección.',
      'Que una divisa pague más interés no dice que vaya a subir.',
    ],
    video: {
      archivo: 'm6-2',
      desc: 'Video con voz: el Barrido con los datos reales de ese día. Se abre la tarjeta «Tasas de interés y swap» y se señala la diferencia de tasas de un par y hacia qué lado juega el swap.',
    },
    hazlo: {
      tab: 'barrido',
      boton: 'Ir al Barrido',
      texto: 'Abre «Tasas de interés y swap» y busca un par donde el swap «apenas pesa» y otro donde la diferencia sea grande.',
    },
    preguntas: [
      {
        p: '¿Cuándo se paga o se cobra el swap?',
        opciones: ['Al abrir la operación', 'Cada noche que la operación sigue abierta', 'Solo los viernes'],
        correcta: 1,
        porque: 'Se cobra al corte diario del bróker, cada noche que la operación sigue abierta.',
      },
      {
        p: 'La diferencia de tasas de un par es 3 puntos. ¿Es ése tu swap?',
        opciones: ['Sí, exactamente', 'No: el bróker le suma un margen que no publica', 'Sí, pero solo los miércoles'],
        correcta: 1,
        porque: 'La diferencia de tasas da el signo y el tamaño aproximado. El margen del bróker no lo publica nadie.',
      },
      {
        p: 'Un par tiene el swap a favor de la compra. ¿Qué te dice eso sobre si comprarlo?',
        opciones: ['Que hay que comprarlo', 'Nada: es un coste o un ingreso, no una dirección', 'Que el precio tiene que subir'],
        correcta: 1,
        porque: 'El swap dice cuánto cuesta mantenerla abierta, no hacia dónde irá el precio.',
      },
    ],
  },

  'm6-3': {
    titulo: 'Por qué el mismo coste pesa distinto',
    objetivo: 'Entender que el coste importa comparado con el Stop-loss, y por qué con Stop-loss cortos hay que acertar más solo para empatar.',
    explicacion: [
      'El spread se paga en pips, y es el mismo aunque tu Stop-loss sea grande o pequeño. Lo que cambia es cuánto pesa: 2 pips son poco sobre un Stop-loss de 120 y mucho sobre uno de 30.',
      'Como el coste se paga al ganar y al perder, sube el acierto que necesitas solo para quedarte igual. Con Stop-loss y Take-profit a la misma distancia, sin coste bastaría acertar el 50 %; con coste hace falta más.',
      'Por eso el mismo bróker y el mismo spread pesan mucho más en intradía que en swing: los Stop-loss de una hora son mucho más cortos que los de un día.',
    ],
    ejemplo: [
      `Con un spread de ${SP_EJ} pips: sobre un Stop-loss de ${STOP_SW} pips el coste es el ${pct1(SP_EJ / STOP_SW)} % del riesgo y hay que acertar el ${pct1(aciertoParaEmpatar(SP_EJ, STOP_SW))} % para empatar. Sobre uno de ${STOP_ID} pips es el ${pct1(SP_EJ / STOP_ID)} % y hay que acertar el ${pct1(aciertoParaEmpatar(SP_EJ, STOP_ID))} %.`,
      SWING
        ? 'Los Stop-loss de esta app miden el movimiento de días, así que suelen ser varias veces más largos que los de la app de intradía, que miden horas. Por eso aquí el spread pesa poco, y allí el mismo spread pesa unas cuatro veces más.'
        : 'Los Stop-loss de esta app miden el movimiento de horas, así que suelen ser varias veces más cortos que los de la app de swing, que miden días. Por eso aquí el mismo spread pesa unas cuatro veces más.',
      'En el Analizador, la herramienta «Spread y actividad» enseña cuánto es el spread comparado con el Stop-loss de la tarjeta que estás armando.',
    ],
    formula: {
      texto: 'peso del coste = spread ÷ Stop-loss · acierto para empatar (1:1) = (1 + peso) ÷ 2',
      conNumeros: `${SP_EJ} ÷ ${STOP_ID} = ${pct1(SP_EJ / STOP_ID)} %, y (1 + ${fmt((SP_EJ / STOP_ID).toFixed(3))}) ÷ 2 = ${pct1(aciertoParaEmpatar(SP_EJ, STOP_ID))} %.`,
    },
    noDice: [
      'Alejar el Stop-loss para que el coste pese menos no hace ganar: también se pierde más cuando se toca. En la app de swing se probaron doce combinaciones de Stop-loss y Take-profit, y las doce perdieron.',
      'Que el coste pese poco no hace buena una operación: solo hace que entrar no la ponga cuesta arriba.',
      'El peso del coste no dice hacia dónde irá el precio.',
    ],
    video: {
      archivo: 'm6-3',
      desc: 'Video con voz: el Analizador con los datos reales de ese día. Se arma una tarjeta y se señala el spread del par y cuánto pesa comparado con su Stop-loss.',
    },
    hazlo: {
      tab: 'analizar',
      boton: 'Ir al Analizador',
      texto: 'Elige un par y una dirección, enciende «Spread y actividad» y mira qué porcentaje del Stop-loss se lleva el spread.',
    },
    preguntas: [
      {
        p: 'Mismo spread de 2 pips. ¿Dónde pesa más?',
        opciones: ['Con un Stop-loss de 120 pips', 'Con un Stop-loss de 30 pips', 'Pesa igual en los dos'],
        correcta: 1,
        porque: '2 de 30 es mucho más que 2 de 120.',
      },
      {
        p: 'Con Stop-loss y Take-profit a la misma distancia y sin ningún coste, ¿qué acierto hace falta para empatar?',
        opciones: ['El 50 %', 'El 60 %', 'El 33 %'],
        correcta: 0,
        porque: 'Ganas lo mismo que pierdes: la mitad de las veces basta. Con coste, hace falta algo más.',
      },
      {
        p: '¿Alejar el Stop-loss hace que la estrategia gane?',
        opciones: ['Sí, porque el coste pesa menos', 'No: también se pierde más cada vez que se toca', 'Sí, siempre'],
        correcta: 1,
        porque: 'El coste pesa menos, pero cada pérdida es más grande. Se probó en la app de swing y no ayudó.',
      },
    ],
  },
  'm7-1': {
    titulo: 'El calendario: a qué hora puede haber sacudida',
    objetivo: 'Leer el calendario económico y saber para qué lo miran los traders: para elegir la hora, no la dirección.',
    explicacion: [
      'Los países publican datos de su economía en fechas y horas fijas: inflación, empleo, ventas, decisiones de tasas. El calendario económico es la lista de esas publicaciones.',
      `La app enseña las de las próximas ${HORAS_VISTA} horas de las 8 divisas que sigue. Cada una lleva la hora (la de tu teléfono), la divisa, el nombre en inglés tal como sale en cualquier calendario, y entre paréntesis de qué familia es.`,
      'También dice cuánto suele mover el precio: «Mueve mucho» o «Mueve algo». Las que casi no mueven nada no se enseñan, para que no tapen las importantes. Si en esas horas no viene ninguna, la tarjeta lo dice: no desaparece.',
    ],
    ejemplo: [
      'Minutos antes y después de una noticia que «mueve mucho», el precio puede pegar saltos y el spread se abre. Es cuando más caro sale entrar a ciegas.',
      'La tarjeta «Calendario económico» va arriba del todo en el Barrido. En el Analizador, la herramienta «Calendario» enseña solo las noticias de las dos divisas del par que estás mirando.',
    ],
    noDice: [
      'El calendario no dice hacia dónde se va a mover el precio: solo cuándo puede haber sacudida.',
      'No cambia ninguna señal de la app: es información para que elijas la hora.',
      '«Mueve mucho» no quiere decir que esa vez vaya a moverse: quiere decir que suele hacerlo.',
    ],
    video: {
      archivo: 'm7-1',
      desc: 'Video con voz: el Barrido con el calendario real de la mañana del día de la grabación. Se abre la tarjeta «Calendario económico» y se señalan la hora, la divisa y cuánto suele mover una noticia.',
    },
    hazlo: {
      tab: 'barrido',
      boton: 'Ir al Barrido',
      texto: 'Abre «Calendario económico» y busca la próxima noticia que «mueve mucho»: ¿de qué divisa es y a qué hora sale?',
    },
    preguntas: [
      {
        p: '¿Para qué miran los traders el calendario económico?',
        opciones: ['Para saber hacia dónde irá el precio', 'Para saber a qué hora puede haber sacudida', 'Para elegir el lote'],
        correcta: 1,
        porque: 'El calendario dice cuándo, no hacia dónde.',
      },
      {
        p: '¿Qué suele pasar con el spread minutos antes de una noticia que «mueve mucho»?',
        opciones: ['Se abre', 'Se cierra del todo', 'No cambia nunca'],
        correcta: 0,
        porque: 'Con una noticia fuerte el precio pega saltos y el spread se abre.',
      },
      {
        p: 'La hora que enseña el calendario de la app es…',
        opciones: ['La de Nueva York', 'La de tu teléfono', 'La de Londres'],
        correcta: 1,
        porque: 'Cada uno ve su propia hora: un suscriptor en Madrid y otro en Bogotá ven cada uno la suya.',
      },
    ],
  },

  'm7-2': {
    titulo: 'Lo previsto, lo anterior y la sorpresa',
    objetivo: 'Leer «previsto» y «anterior» en una noticia, y entender por qué lo que mueve el precio es la sorpresa.',
    explicacion: [
      'Muchas noticias traen dos números antes de publicarse. «Anterior» es lo que salió la última vez. «Previsto» es lo que esperan los analistas que salga ahora.',
      'Lo que suele mover el precio no es el número en sí, sino la SORPRESA: cuánto se aleja el dato real de lo previsto. Si sale como se esperaba, muchas veces pasa poco, porque el mercado ya lo tenía en cuenta.',
      'Debajo de cada noticia hay un botón «¿Qué significa?». Explica en palabras sencillas de qué familia es (inflación, empleo, tasas…), qué quiere decir la jerga del nombre (Core, m/m, y/y…) y si lo previsto es más alto, más bajo o igual que lo anterior.',
    ],
    ejemplo: [
      'Si se prevé 0,0 % y la vez anterior salió −0,4 %, la app dice que se espera MÁS ALTO que la vez anterior. Eso compara dos números: no dice qué hará el precio.',
      'Los discursos y las actas no traen números: lo que se escucha es si dan pistas sobre las tasas. Por eso pueden mover el precio sin previsto ni anterior.',
    ],
    formula: {
      texto: 'sorpresa = dato real − previsto',
      conNumeros: 'previsto 0,3 % y sale 0,6 %: la sorpresa es +0,3 puntos, o sea salió más alto de lo esperado. Si sale 0,3 %, la sorpresa es cero.',
    },
    noDice: [
      'Que lo previsto sea más alto que lo anterior no dice si el precio subirá o bajará.',
      'Que un dato salga más alto de lo esperado tampoco dice hacia dónde irá el precio: el mercado puede reaccionar de cualquier forma.',
      '«¿Qué significa?» nunca te dirá compra o vende. Explica el dato, no la operación.',
    ],
    video: {
      archivo: 'm7-2',
      desc: 'Video con voz: el calendario real de la mañana del día de la grabación. Se señalan el previsto y el anterior de una noticia y se abre su «¿Qué significa?».',
    },
    hazlo: {
      tab: 'barrido',
      boton: 'Ir al Barrido',
      texto: 'Abre «Calendario económico», busca una noticia con previsto y anterior, y toca «¿Qué significa?».',
    },
    preguntas: [
      {
        p: '¿Qué es el «previsto» de una noticia?',
        opciones: ['Lo que salió la vez anterior', 'Lo que esperan los analistas que salga ahora', 'El dato definitivo'],
        correcta: 1,
        porque: '«Anterior» es lo de la última vez; «previsto» es lo que se espera ahora.',
      },
      {
        p: 'Se prevé 0,3 % y sale exactamente 0,3 %. ¿Cuánto es la sorpresa?',
        opciones: ['0,3', 'Cero', '0,6'],
        correcta: 1,
        porque: 'La sorpresa es el dato real menos lo previsto: 0,3 − 0,3 = 0.',
      },
      {
        p: 'Lo previsto es más alto que lo anterior. ¿Qué te dice sobre el precio?',
        opciones: ['Que el precio tiene que subir', 'Nada sobre hacia dónde irá', 'Que hay que vender'],
        correcta: 1,
        porque: 'Compara dos números. No dice qué hará el precio.',
      },
    ],
  },

  'm7-3': {
    titulo: 'Las noticias de los bancos centrales',
    objetivo: 'Saber qué enseña la tarjeta de noticias, de dónde salen los titulares y por qué solo de esas fuentes.',
    explicacion: [
      'Los bancos centrales deciden las tasas de interés de su divisa, y lo que dicen puede cambiar el día del mercado. La tarjeta «Noticias de los bancos centrales» junta lo último que publicaron, con su fecha.',
      'Las fuentes son cuatro: la Reserva Federal (dólar), el Banco Central Europeo (euro), el Banco de la Reserva de Nueva Zelanda (dólar neozelandés) e ING, un banco que publica análisis. De ING solo salen las notas que nombran alguna de las 8 divisas que sigue la app.',
      'Cada titular lleva delante el código de su divisa, y debajo la fuente y la fecha. Va tal cual lo publica cada fuente y en su idioma: al tocarlo se abre la noticia completa en su página.',
    ],
    ejemplo: [
      'Solo se usan fuentes cuyas condiciones permiten reproducir sus titulares en una app de pago. Otras páginas de noticias muy conocidas lo prohíben sin un permiso por escrito: se les pidió, y mientras no lo den no están.',
      'Los titulares van en inglés porque así los publica cada fuente, y algunas piden no alterarlos. Al tocarlo se abre la noticia completa en la página de la fuente.',
    ],
    noDice: [
      'Una noticia dice qué pasó y cuándo, nunca hacia dónde va el precio.',
      'Que una divisa salga en muchos titulares no quiere decir que vaya a moverse más.',
      'La app no resume ni interpreta los titulares: los enseña tal cual. La decisión de operar es tuya.',
    ],
    video: {
      archivo: 'm7-3',
      desc: 'Video con voz: el Barrido con las noticias reales del día de la grabación. Se abre la tarjeta «Noticias de los bancos centrales» y se señala un titular con su divisa, su fuente y su fecha.',
    },
    hazlo: {
      tab: 'barrido',
      boton: 'Ir al Barrido',
      texto: 'Abre «Noticias de los bancos centrales» y mira de qué divisa y de qué fecha es el titular más reciente.',
    },
    preguntas: [
      {
        p: '¿Qué te dice un titular de un banco central?',
        opciones: ['Qué pasó y cuándo', 'Hacia dónde irá el precio', 'Qué par operar'],
        correcta: 0,
        porque: 'Una noticia dice qué pasó y cuándo. La dirección no.',
      },
      {
        p: '¿Por qué la app no usa cualquier página de noticias?',
        opciones: ['Porque son lentas', 'Porque sus condiciones no permiten reproducir los titulares en una app de pago', 'Porque están en inglés'],
        correcta: 1,
        porque: 'Solo se usan fuentes que lo permiten. A las demás se les pidió permiso por escrito, y mientras no lo den no están.',
      },
      {
        p: '¿Por qué los titulares van en inglés?',
        opciones: ['Porque la app no sabe traducir', 'Porque así los publica cada fuente, y algunas piden no alterarlos', 'Porque es más fácil'],
        correcta: 1,
        porque: 'Van tal cual los publica cada fuente.',
      },
    ],
  },
  'm8-1': {
    titulo: 'Dos operaciones que son una sola',
    objetivo: 'Darte cuenta de cuándo dos operaciones abiertas comparten una divisa y son, en el fondo, la misma apuesta.',
    explicacion: [
      'Cada par lleva dos divisas. Si compras EUR/USD y compras EUR/CHF, en las dos estás comprando euros. No son dos ideas distintas: es una sola idea, el euro, apostada dos veces.',
      'Si el euro cae, las dos operaciones pierden a la vez. Lo que parecía repartir el riesgo en realidad lo junta.',
      'El Diario lo avisa solo: cuando tienes dos o más operaciones abiertas que comparten una divisa, sale una tarjeta de «Riesgo concentrado» que dice cuál es y en qué pares.',
    ],
    ejemplo: [
      'Arriesgas el 1 % en EUR/USD y el 1 % en EUR/CHF, las dos compras. Si el euro se da la vuelta, pierdes las dos: es como haber arriesgado el 2 % en una sola idea.',
      'Compartir divisa no siempre suma: comprar EUR/USD y vender EUR/CHF son lados opuestos con el euro, y una puede tapar a la otra. El aviso del Diario solo mira que la divisa se repita; el lado lo tienes que mirar tú.',
    ],
    formula: {
      texto: 'riesgo de la idea = suma del riesgo de cada operación que apuesta a lo mismo',
      conNumeros: '1 % + 1 % = 2 % del capital en una sola idea (el euro).',
    },
    noDice: [
      'El aviso no dice que alguna de las dos esté mal: dice que dependen de lo mismo.',
      'No dice cuál cerrar. Esa decisión es tuya.',
      'Dos pares que no comparten divisa también pueden moverse juntos: eso es la correlación, la lección siguiente.',
    ],
    video: {
      archivo: 'm8-1',
      desc: 'Video con voz: el Diario de un usuario de ejemplo con dos operaciones abiertas que comparten el euro, y la tarjeta de «Riesgo concentrado» que sale sola.',
    },
    hazlo: {
      tab: 'diario',
      boton: 'Ir al Diario',
      texto: 'Mira tus operaciones abiertas: ¿alguna divisa se repite? Si es así, el Diario te lo dice arriba.',
    },
    preguntas: [
      {
        p: 'Compras EUR/USD y compras EUR/CHF. ¿Qué divisa se repite?',
        opciones: ['El dólar', 'El euro', 'El franco'],
        correcta: 1,
        porque: 'Las dos llevan el euro, y en las dos lo compras.',
      },
      {
        p: 'Arriesgas el 1 % en cada una de esas dos operaciones. ¿Cuánto tienes en juego en la idea «el euro sube»?',
        opciones: ['El 1 %', 'El 2 %', 'Nada'],
        correcta: 1,
        porque: 'Si el euro cae, pierden las dos: 1 % + 1 %.',
      },
      {
        p: '¿Qué dice el aviso de «Riesgo concentrado»?',
        opciones: ['Que cierres una', 'Que esas operaciones dependen de la misma divisa', 'Que van a perder'],
        correcta: 1,
        porque: 'Solo avisa de que no son apuestas independientes. La decisión es tuya.',
      },
    ],
  },

  'm8-2': {
    titulo: 'La correlación: cuánto se mueven juntos',
    objetivo: 'Leer un número de correlación y saber cuándo dos pares, sin compartir divisa, son casi la misma apuesta.',
    explicacion: [
      'La correlación mide cuánto se han movido dos pares al mismo tiempo. Va de −1 a +1. Cerca de +1, suben y bajan juntos; cerca de −1, uno sube cuando el otro baja; cerca de 0, no tienen nada que ver.',
      `Se calcula con los cambios de cada día de las últimas ${VENTANA_CORREL_TXT} sesiones, no con el precio. Con el precio, dos pares que subieron todo el año saldrían parecidos aunque su día a día no se pareciera en nada.`,
      `A partir de ${fmt(CORREL_ALTA_TXT)} (o −${fmt(CORREL_ALTA_TXT)}), para el riesgo cuentan como lo mismo. Y el lado importa: dos pares que van juntos, comprados los dos, son una apuesta doble; uno comprado y otro vendido, se anulan y pagas dos spreads para nada.`,
    ],
    ejemplo: [
      SWING
        ? `En el tablero completo, la tarjeta «Correlación entre pares» enseña los que pasan de ${fmt(CORREL_ALTA_TXT)}. Y si dos experimentos del mismo día son la misma apuesta, una tarjeta lo avisa antes de la lista, teniendo en cuenta el lado de cada uno.`
        : `Esta app no calcula la correlación con sus velas de una hora: ${VENTANA_CORREL_TXT} velas serían dos días y medio, demasiado poco para saber si dos pares se parecen de verdad. La tarjeta «Correlación entre pares» está en la app de swing, y el aviso «Dos de tus pares se mueven igual» de la pestaña Avisos usa esa medida.`,
      'Dos pares pueden moverse casi igual sin repetir ninguna divisa. El aviso del Diario solo mira si una divisa se repite, así que ese caso no lo ve; la correlación sí.',
    ],
    noDice: [
      'Una correlación alta no dice hacia dónde se va a mover ninguno de los dos.',
      'Mide los últimos meses: dos pares que se movieron juntos hasta hoy pueden dejar de hacerlo.',
      'Que se muevan juntos no quiere decir que uno mueva al otro: muchas veces los dos reaccionan a lo mismo.',
    ],
    video: {
      archivo: 'm8-2',
      desc: 'Video sin voz con los datos reales de ese día. En la app de swing, la tarjeta «Correlación entre pares» del tablero completo; en la de intradía, el aviso de correlación de la pestaña Avisos.',
    },
    hazlo: {
      tab: SWING ? 'barrido' : 'avisos',
      boton: SWING ? 'Ir al Barrido' : 'Ir a Avisos',
      texto: SWING
        ? 'Entra en «Ver tablero completo», abre «Correlación entre pares» y busca dos pares que se muevan al revés.'
        : 'En Avisos, mira el aviso «Dos de tus pares se mueven igual» y decide si te sirve encenderlo.',
    },
    preguntas: [
      {
        p: 'Dos pares tienen una correlación de +0,9. ¿Qué quiere decir?',
        opciones: ['Que suelen subir y bajar juntos', 'Que uno sube cuando el otro baja', 'Que no tienen nada que ver'],
        correcta: 0,
        porque: 'Cerca de +1 se mueven juntos; cerca de −1, al revés.',
      },
      {
        p: 'Dos pares van a +0,9 y compras uno y vendes el otro. ¿Qué pasa?',
        opciones: ['Doblas la apuesta', 'Se anulan: pagas dos spreads para nada', 'Nada especial'],
        correcta: 1,
        porque: 'Si se mueven juntos y tomas lados opuestos, lo que gana uno lo pierde el otro.',
      },
      {
        p: '¿Por qué la correlación se calcula con los cambios de cada día y no con el precio?',
        opciones: ['Porque es más rápido', 'Porque con el precio dos pares que subieron todo el año parecerían iguales aunque su día a día no se pareciera', 'Porque lo pide el bróker'],
        correcta: 1,
        porque: 'Lo que importa para el riesgo es si se mueven juntos día a día.',
      },
    ],
  },

  'm8-3': {
    titulo: 'Cinco operaciones, una apuesta al dólar',
    objetivo: 'Ver cuántos pares llevan el dólar, por qué eso junta el riesgo, y qué tiene que ver el oro.',
    explicacion: [
      'De los pares que siguen las apps, los que más se repiten llevan el dólar: EUR/USD, GBP/USD, USD/JPY, USD/CHF, USD/CAD, AUD/USD y NZD/USD. Si el dólar se mueve, todos se mueven a la vez.',
      'Por eso, abrir varias operaciones con el dólar del mismo lado no es repartir el riesgo: es apostar al dólar varias veces. Comprar EUR/USD y vender USD/CHF, por ejemplo, son las dos «vender dólar».',
      'El oro se suele mover al revés que el dólar: cuando el dólar se fortalece, el oro suele bajar, y al revés. Es una costumbre del mercado, no una ley.',
    ],
    ejemplo: [
      'En el Barrido, el ranking de fuerza dice dónde está el dólar comparado con las otras siete divisas. Si está arriba o abajo del todo, es la divisa que más está moviendo los pares que la llevan.',
      SWING
        ? 'En el Barrido, la tarjeta del oro enseña cuánto se ha movido el oro junto a cada par en las últimas 60 sesiones. En la medición del 30 de septiembre de 2026, los pares con dólar salieron con números altos y los cruces casi en cero: lo que seguía el oro era el dólar.'
        : 'La tarjeta del oro está en la app de swing: mide cuánto se ha movido el oro junto a cada par en las últimas 60 sesiones. En la medición del 30 de septiembre de 2026, lo que seguía el oro era el dólar.',
    ],
    noDice: [
      'Que el oro baje no dice que el dólar vaya a subir mañana, ni al revés.',
      'Que el dólar esté arriba en el ranking dice lo que ya pasó, no lo que va a pasar.',
      'Tener varias operaciones con el dólar no está prohibido: solo hay que saber que es una sola apuesta más grande.',
    ],
    video: {
      archivo: 'm8-3',
      desc: SWING
        ? 'Video con voz: el Barrido con los datos reales de ese día. Se señala el dólar en el ranking de fuerza y después la tarjeta del oro, con su número frente a los pares con dólar y frente a los cruces.'
        : 'Video con voz: el Barrido con los datos reales de ese día. Se señala el dólar en el ranking de fuerza y la lista de pares que lo llevan.',
    },
    hazlo: {
      tab: 'barrido',
      boton: 'Ir al Barrido',
      texto: 'Busca el dólar en el ranking de fuerza. Luego cuenta cuántos de tus pares lo llevan.',
    },
    preguntas: [
      {
        p: 'Compras EUR/USD y vendes USD/CHF. ¿Qué estás haciendo con el dólar?',
        opciones: ['Comprarlo dos veces', 'Venderlo dos veces', 'Nada: se anulan'],
        correcta: 1,
        porque: 'En EUR/USD el dólar va segundo: comprar el par es vender dólar. En USD/CHF va primero: vender el par es vender dólar.',
      },
      {
        p: '¿Cómo se suele mover el oro respecto al dólar?',
        opciones: ['Igual que el dólar', 'Al revés que el dólar', 'No tiene relación'],
        correcta: 1,
        porque: 'Suele ir al revés. Es una costumbre medida, no una ley.',
      },
      {
        p: 'Tienes tres operaciones abiertas vendiendo dólar. ¿Cuántas apuestas son?',
        opciones: ['Tres apuestas independientes', 'Una sola apuesta al dólar, más grande', 'Ninguna'],
        correcta: 1,
        porque: 'Si el dólar se da la vuelta, se dan la vuelta las tres.',
      },
    ],
  },

  'm9-1': {
    titulo: 'Armar la tarjeta: la dirección la pones tú',
    objetivo: 'Recorrer los cuatro pasos del Analizador y entender por qué, sin elegir una dirección, la app no calcula nada.',
    explicacion: [
      'El Analizador tiene cuatro pasos: el par, tu dirección (COMPRA o VENTA), cómo poner el Stop-loss y qué herramientas ver. Con eso arma una tarjeta con la entrada, el Stop-loss, el Take-profit, la relación riesgo/beneficio y el lote.',
      'La dirección no la elige la app, a propósito. Mientras no la eliges, la tarjeta solo dice «Elige COMPRA o VENTA para ver los niveles». Si la app la eligiera por ti, sería una señal más, y las señales de esta app todavía son experimentos.',
      `Para el Stop-loss hay tres métodos, y los tres son cuentas que la app ya usa: «La de la app» (la misma de sus señales), «${fmt(ATR_SIMETRICO)} ATR a cada lado» (la vara neutra con la que se miden las reglas en pruebas) y «Soporte y resistencia» (el Stop-loss ${fmt(COJIN_ESTRUCTURA)} ATR por fuera del extremo de las últimas 20 velas y el Take-profit en el otro extremo).`,
    ],
    ejemplo: [
      'Eliges EUR/USD y COMPRA: el Stop-loss queda por debajo del precio y el Take-profit por encima. Cambias a VENTA: se dan la vuelta.',
      'Si con un método los niveles no salen —por ejemplo, el precio está justo en el extremo de las 20 velas—, la tarjeta lo dice y te pide probar otro. No inventa un nivel a cero pips.',
      'El lote sale de tu perfil de riesgo, con la misma cuenta que la calculadora: si cambias de método, cambia la distancia del Stop-loss y el lote se ajusta para arriesgar lo mismo.',
    ],
    formula: {
      texto: 'par + tu dirección + método de Stop-loss + tu perfil = entrada, Stop-loss, Take-profit, R/B y lote',
      conNumeros: 'Sin dirección no hay niveles; sin perfil no hay lote. Las dos cosas las pones tú.',
    },
    noDice: [
      'La tarjeta no dice si la dirección que elegiste es buena: dice dónde quedan los niveles si la eliges.',
      'Ninguno de los tres métodos es «el bueno». Son formas distintas de medir la distancia, y cada una cambia cuánto arriesgas y cuánto buscas ganar.',
      'La app no está conectada a tu bróker: la operación, si decides abrirla, la abres tú.',
    ],
    video: {
      archivo: 'm9-1',
      desc: 'Video con voz: el Analizador con los datos reales de ese día. Se elige un par sin dirección (la tarjeta pide elegirla), después COMPRA y VENTA, y se ve cómo el Stop-loss y el Take-profit se dan la vuelta.',
    },
    hazlo: {
      tab: 'analizar',
      boton: 'Ir al Analizador',
      texto: 'Elige un par y fíjate en lo que dice la tarjeta antes de elegir la dirección. Después elige una y mira dónde quedan los niveles.',
    },
    preguntas: [
      {
        p: 'Abres el Analizador y eliges un par, pero ninguna dirección. ¿Qué enseña la tarjeta?',
        opciones: ['Los niveles de la dirección que la app recomienda', 'Que elijas COMPRA o VENTA para ver los niveles', 'Nada, está rota'],
        correcta: 1,
        porque: 'La app no elige la dirección: sin ella no calcula niveles ni lote.',
      },
      {
        p: '¿Por qué la app no elige la dirección por ti?',
        opciones: ['Porque sería una señal más, y sus señales todavía son experimentos', 'Porque no tiene datos', 'Porque el bróker no lo permite'],
        correcta: 0,
        porque: 'Elegir la dirección sería dar una señal sin validar.',
      },
      {
        p: 'Cambias el método del Stop-loss y la distancia pasa de 30 a 60 pips. ¿Qué pasa con el lote?',
        opciones: ['Se queda igual', 'Baja, para arriesgar lo mismo', 'Sube'],
        correcta: 1,
        porque: 'El lote sale de tu perfil: con el doble de distancia, la mitad de lote arriesga lo mismo.',
      },
    ],
  },

  'm9-2': {
    titulo: 'Revisar la tarjeta antes de decidir',
    objetivo: 'Leer la tarjeta como una lista de comprobación: cuánto arriesgas, tu freno, las noticias y lo que ya tienes abierto.',
    explicacion: [
      'Una vez armada la tarjeta, la decisión es tuya. Lo que la app hace es ponerte delante, en un solo sitio, las preguntas que conviene hacerse antes de abrir una operación.',
      `¿Cuánto arriesgas y cuánto buscas ganar? Si el Take-profit queda más cerca que el Stop-loss (un R/B por debajo de ${fmt(RR_AVISO)}:${fmt(RR_AVISO)}), la tarjeta lo dice en ámbar: arriesgas más de lo que buscas ganar.`,
      '¿Cómo va tu día? Si ya llegaste a tu freno, la tarjeta lo dice en rojo; si te queda poco, en ámbar. Es tu propia regla, la que escribiste con la cabeza fría.',
      '¿Hay noticias de estas dos divisas en las próximas horas? ¿Ya tienes abierta otra operación con una de ellas? Las herramientas «Calendario» y «Mi diario» lo enseñan en la misma tarjeta.',
    ],
    ejemplo: [
      'Un usuario de ejemplo lleva dos pérdidas hoy y tiene dos operaciones abiertas con el euro. Arma una tarjeta de EUR/USD: la tarjeta le recuerda que está cerca de su freno y que sumar ésta puede ser una sola apuesta más grande.',
      'Nada de eso le impide abrirla: la app no bloquea. Le pone delante lo que su propia regla dice.',
      'Cuando decides, hay dos botones al final: «Anotar en el Diario» (si la abres de verdad en tu bróker) y «Practicar esta operación (sin dinero)», que es el módulo siguiente.',
    ],
    formula: {
      texto: 'antes de abrir: R/B · freno del día · noticias de las dos divisas · lo que ya tienes abierto',
      conNumeros: 'Cuatro preguntas, todas en la misma tarjeta. Si una sale en rojo o ámbar, para un momento.',
    },
    noDice: [
      'Que las cuatro preguntas salgan bien no quiere decir que la operación vaya a ganar.',
      'Que una salga mal no la convierte en mala: dice que hay un riesgo que tienes que mirar.',
      'La lista no es una regla de la app: es una forma ordenada de mirar. La decisión sigue siendo tuya.',
    ],
    video: {
      archivo: 'm9-2',
      desc: 'Video con voz: el Analizador de un usuario de ejemplo con dos pérdidas hoy y dos operaciones abiertas con el euro. Se arma una tarjeta de EUR/USD con los datos reales de ese día y se revisan las cuatro preguntas: R/B y lote, el freno, el calendario y el Diario.',
    },
    hazlo: {
      tab: 'analizar',
      boton: 'Ir al Analizador',
      texto: 'Arma una tarjeta, enciende «Calendario» y «Mi diario», y repasa las cuatro preguntas antes de decidir nada.',
    },
    preguntas: [
      {
        p: 'La tarjeta enseña el R/B en ámbar. ¿Qué quiere decir?',
        opciones: ['Que la operación va a perder', 'Que el Take-profit queda más cerca que el Stop-loss: arriesgas más de lo que buscas ganar', 'Que falta el perfil'],
        correcta: 1,
        porque: 'Es un aviso sobre tu propio nivel, no sobre el mercado.',
      },
      {
        p: 'Ya llegaste a tu freno del día y la tarjeta lo dice en rojo. ¿Qué hace la app?',
        opciones: ['Te impide abrir la operación', 'Te recuerda tu propia regla; la decisión es tuya', 'Cierra tus operaciones'],
        correcta: 1,
        porque: 'La app no está conectada al bróker y no bloquea nada: solo avisa.',
      },
      {
        p: 'Tienes dos operaciones abiertas con el euro y armas una tarjeta de EUR/USD. ¿Qué te dice «Mi diario»?',
        opciones: ['Que sumarla puede hacer una sola apuesta más grande', 'Que ésta va a ganar', 'Nada'],
        correcta: 0,
        porque: 'Comparten divisa: es lo que vimos en el módulo 8.',
      },
    ],
  },

  'm9-3': {
    titulo: 'Tu forma de analizar: estilo y plantillas',
    objetivo: 'Usar «¿Cómo operas?» y las plantillas para analizar siempre igual, y saber por qué eso ayuda a medirte.',
    explicacion: [
      `«¿Cómo operas?» elige con qué herramientas arranca el Analizador: quien sigue tendencias empieza con ${N_TENDENCIAS} (tendencia, medias, fuerza, ATR, niveles y calendario); quien opera rangos, con ${N_RANGOS} (niveles, pivote, RSI, Bollinger, Fibonacci, ATR y calendario). No cambia ninguna señal ni dice qué estilo es mejor, y puedes cambiarlo cuando quieras.`,
      `Una plantilla guarda las herramientas encendidas y el método del Stop-loss con un nombre. Puedes tener hasta ${MAX_PLANTILLAS}. Con un toque, el Analizador vuelve a quedar como lo dejaste.`,
      'Para qué sirve: si analizas cada operación con las mismas herramientas, tus números del Diario hablan de una sola forma de operar. Si cada día miras cosas distintas, tus resultados mezclan muchas formas y no te dicen cuál funciona.',
    ],
    ejemplo: [
      'Guardas una plantilla «Mi tendencia» con tendencia, medias y fuerza, y otra «Rangos con RSI» con niveles, RSI y Bollinger. Antes de cada operación tocas la que corresponde y miras siempre lo mismo.',
      'Si apuntas en la nota del Diario con qué plantilla la analizaste, más adelante podrás separar tus resultados por forma de operar.',
    ],
    formula: {
      texto: 'mismo análisis cada vez → tus resultados hablan de una sola forma de operar',
      conNumeros: `Hasta ${MAX_PLANTILLAS} plantillas, cada una con su nombre, sus herramientas y su método.`,
    },
    noDice: [
      'Una plantilla no hace que ganes: hace que lo que mides sea comparable.',
      'Que una herramienta esté en tu plantilla no la convierte en una señal.',
      'El estilo que elijas no está medido como mejor ni peor que los otros.',
    ],
    video: {
      archivo: 'm9-3',
      desc: 'Video con voz: el Analizador de un usuario de ejemplo. Se cambia «¿Cómo operas?» de tendencias a rangos y cambian las herramientas encendidas; después se guarda una plantilla con su nombre y se vuelve a aplicar otra con un toque.',
    },
    hazlo: {
      tab: 'analizar',
      boton: 'Ir al Analizador',
      texto: 'Elige tu estilo en «¿Cómo operas?», ajusta las herramientas a tu gusto y guárdalas como plantilla con un nombre que te diga para qué es.',
    },
    preguntas: [
      {
        p: '¿Qué cambia «¿Cómo operas?»?',
        opciones: ['Las señales de la app', 'Con qué herramientas arranca el Analizador', 'El lote'],
        correcta: 1,
        porque: 'Solo elige las herramientas iniciales. Todas siguen a un toque.',
      },
      {
        p: '¿Qué guarda una plantilla?',
        opciones: ['Las herramientas encendidas y el método del Stop-loss', 'Una operación para copiar', 'Tu perfil de riesgo'],
        correcta: 0,
        porque: 'Es tu forma de analizar, con un nombre.',
      },
      {
        p: '¿Por qué ayuda analizar siempre con las mismas herramientas?',
        opciones: ['Porque así se acierta más', 'Porque así tus resultados hablan de una sola forma de operar y se pueden comparar', 'Porque lo pide el bróker'],
        correcta: 1,
        porque: 'No hace ganar: hace que tus números signifiquen algo.',
      },
    ],
  },

  'm10-1': {
    titulo: 'Crear una operación de práctica',
    objetivo: 'Mandar una tarjeta del Analizador al modo práctica y saber cómo decide la app si ganó o perdió.',
    explicacion: [
      'El modo práctica es operar sin dinero. Armas la tarjeta en el Analizador como siempre —el par, tu dirección, el método del Stop-loss— y en vez de abrirla en tu bróker pulsas «Practicar esta operación (sin dinero)».',
      `Desde ese momento la app la sigue sola con los precios reales. ${REVISA}`,
      'Cómo decide: solo cuentan las velas que EMPIEZAN después de crear la operación, para que nadie pueda practicar con un precio que ya sabe adónde fue. Si una misma vela toca el Stop-loss y el Take-profit, cuenta como perdida: la vela no dice cuál pasó primero y se elige el peor caso.',
      `Puedes tener hasta ${MAX_ABIERTAS} abiertas a la vez. Una abierta se puede borrar; una resuelta no, ni ganada ni perdida: si se pudieran borrar las perdidas, el acierto de la práctica sería inventado.`,
    ],
    ejemplo: [
      'Armas una compra de EUR/USD y pulsas «Practicar esta operación (sin dinero)». En el Diario, en «Modo práctica», aparece como abierta con su entrada, su Stop-loss y su Take-profit, y dice «esperando».',
      'Con «Ver la gráfica» ves las mismas velas con las que la app decide, y encima lo que tenías en el Analizador al crearla.',
      'Cuando el precio toca uno de los dos niveles, pasa sola a «Resueltas» como ganada o perdida. Tú no haces nada.',
    ],
    formula: {
      texto: 'tarjeta del Analizador → «Practicar esta operación (sin dinero)» → la app la sigue sola → ganada o perdida',
      conNumeros: `Hasta ${MAX_ABIERTAS} abiertas. Solo cuentan las velas que empiezan después de crearla; si una vela toca los dos niveles, cuenta como perdida.`,
    },
    noDice: [
      'Que una operación de práctica gane no quiere decir que la misma operación hubiera ganado con dinero: con dinero el precio de entrada puede salir peor.',
      'La práctica no es una señal: la dirección la eliges tú, como en el Analizador.',
      'Que la app la siga sola no quiere decir que la operación sea buena: dice qué pasó, no si había que hacerla.',
    ],
    video: {
      archivo: 'm10-1',
      desc: 'Video con voz: el Analizador con los datos reales de ese día. Se arma una compra, se pulsa «Practicar esta operación (sin dinero)» y se va al Diario: la operación sale en «Modo práctica» como abierta, con sus niveles, y se abre su gráfica.',
    },
    hazlo: {
      tab: 'analizar',
      boton: 'Ir al Analizador',
      texto: 'Arma una tarjeta con la dirección que tú elijas y pulsa «Practicar esta operación (sin dinero)». Después búscala en el Diario, en «Modo práctica».',
    },
    preguntas: [
      {
        p: '¿Desde dónde se crea una operación de práctica?',
        opciones: ['Desde el Barrido', 'Desde la tarjeta del Analizador, con «Practicar esta operación (sin dinero)»', 'Desde el bróker'],
        correcta: 1,
        porque: 'Sale de la misma tarjeta, para que los niveles se calculen en un solo sitio.',
      },
      {
        p: 'Una misma vela toca el Stop-loss y el Take-profit. ¿Cómo cuenta?',
        opciones: ['Como ganada', 'Como perdida, porque la vela no dice cuál pasó primero', 'No cuenta'],
        correcta: 1,
        porque: 'Se elige el peor caso: un número que se equivoca a tu favor no sirve para decidir.',
      },
      {
        p: '¿Se puede borrar una operación de práctica que ya perdió?',
        opciones: ['Sí, cuando quieras', 'No: solo se borran las abiertas, para que el acierto no mienta', 'Solo el primer día'],
        correcta: 1,
        porque: 'Si se pudieran borrar las perdidas, el número de la práctica sería inventado.',
      },
    ],
  },

  'm10-2': {
    titulo: 'El resultado en R, con lo que cuesta de verdad',
    objetivo: 'Leer el resultado de una operación de práctica en R, separar lo bruto de lo neto, y saber de dónde sale el dinero que enseña.',
    explicacion: [
      'El resultado de la práctica no va en pips ni en dólares: va en R. 1 R es lo que arriesgabas. Perder es siempre −1 R; ganar es lo que daba tu Take-profit: con un R/B de 1:1,5, ganar son +1,5 R.',
      'Así se pueden comparar operaciones con Stop-loss distintos: perder 30 pips con un Stop-loss de 30 y perder 120 con uno de 120 son las dos −1 R.',
      'Lo bruto es lo que dicen los niveles. Lo neto le resta lo que cuesta operar: el spread (si la entrada fue con el precio de Twelve Data; con el de MT5 ya va dentro) y el swap de cada noche que la operación siguió abierta, con el corte a las 22:00 UTC de lunes a viernes y el triple un día de la semana.',
      'Si guardaste un perfil de riesgo, la tarjeta pasa lo neto a dinero: cada operación multiplica su R neto por lo que ibas a arriesgar en ella. Lo que no se sabe —una operación sin spread o sin swap guardado— dice «sin dato», nunca un número inventado.',
    ],
    ejemplo: [
      `Una compra de EUR/USD con 30 pips de Stop-loss y 45 de Take-profit gana: bruto +${r2(C10.rBruto)} R.`,
      `El spread era de 1,2 pips sobre un Stop-loss de 30: se lleva ${r2(C10.spreadR)} R. Estuvo abierta ${C10.noches} noches con 0,6 pips de swap en contra cada una: otros ${r2(C10.swapR)} R.`,
      `Neto: +${r2(C10.rNeto)} R. Si ibas a arriesgar 10 dólares, son +${r2(C10.usdNeto)} dólares.`,
    ],
    formula: {
      texto: 'R neto = R bruto − spread (en R) + swap (en R)        dinero = R neto × lo que arriesgabas',
      conNumeros: `+${r2(C10.rBruto)} − ${r2(C10.spreadR)} − ${r2(C10.swapR)} = +${r2(C10.rNeto)} R  →  ×10 dólares = +${r2(C10.usdNeto)} dólares`,
    },
    noDice: [
      'El spread y el swap que se descuentan son los de una cuenta real del desarrollador de la app, no los de tu bróker. Los tuyos pueden ser distintos.',
      'El dinero que enseña no es dinero que hayas ganado o perdido: es lo que habría sido con lo que ibas a arriesgar.',
      'Ni el R ni el neto dicen si la siguiente operación va a ganar.',
    ],
    video: {
      archivo: 'm10-2',
      desc: 'Video con voz: el «Modo práctica» de un usuario de ejemplo con operaciones ya resueltas (precios inventados). Se lee el resultado en R, el desglose de una ganada —bruto, spread, swap y neto— y el resultado en dinero.',
    },
    hazlo: {
      tab: 'diario',
      boton: 'Ir al Diario',
      texto: 'Abre «Modo práctica» y, en una operación resuelta, lee su línea de bruto, spread, swap y neto.',
    },
    preguntas: [
      {
        p: 'Una operación de práctica perdió. ¿Cuánto es en R?',
        opciones: ['Depende de los pips', 'Siempre −1 R', 'Cero'],
        correcta: 1,
        porque: '1 R es lo que arriesgabas, y perder es perder eso.',
      },
      {
        p: 'La entrada fue con el precio de MT5. ¿Se descuenta el spread aparte?',
        opciones: ['Sí', 'No: con el precio de MT5 el spread ya va dentro de la entrada', 'Solo de noche'],
        correcta: 1,
        porque: 'Con MT5 la entrada es el ASK al comprar o el BID al vender, así que el spread ya está pagado.',
      },
      {
        p: 'Una operación no guardó su swap. ¿Qué enseña la tarjeta?',
        opciones: ['Un swap de cero', '«sin dato»', 'Un swap medio'],
        correcta: 1,
        porque: 'Lo que no se sabe no se inventa.',
      },
    ],
  },

  'm10-3': {
    titulo: 'Para qué sirve practicar, y lo que no demuestra',
    objetivo: 'Usar la práctica para probar una forma de operar, y saber cuándo su número empieza a decir algo.',
    explicacion: [
      'La práctica sirve para probar una forma de operar antes de ponerle dinero, que es lo que hacen los traders con experiencia con cualquier idea nueva. Funciona mejor si practicas siempre con la misma plantilla del Analizador: así el resultado habla de una sola forma de operar.',
      `Arriba, la tarjeta enseña tu acierto con su ±, igual que el Diario. Con pocas operaciones ese ± es enorme: con ${INSIGNIA_PRACTICA_TXT} resueltas es de ±${MARGEN_5} puntos. Por eso un 80 % de 5 no se distingue de un 50 %.`,
      `La insignia «Practicas sin dinero» se consigue con ${INSIGNIA_PRACTICA_TXT} operaciones resueltas, ganadas o perdidas igual: premia el hábito de probar antes, no el de ganar.`,
      '«Descargar mis resultados (tabla)» baja todas tus operaciones de práctica —también las abiertas, las caducadas y las que no valieron— para que las mires en una hoja de cálculo. Las celdas vacías son datos que no se saben, no ceros.',
    ],
    ejemplo: [
      `Un usuario de ejemplo lleva ${INSIGNIA_PRACTICA_TXT} operaciones resueltas: 3 ganadas y 2 perdidas, 60 %. Con el ±${MARGEN_5} al lado, ese 60 % puede ser cualquier cosa entre un ${Math.max(0, 60 - MARGEN_5)} % y un ${Math.min(100, 60 + MARGEN_5)} %: todavía no dice nada.`,
      'Su insignia «Practicas sin dinero» ya está conseguida: le da igual que haya ganado o perdido.',
      'Si quiere saber si su forma de operar funciona, tiene que seguir practicando con la misma plantilla hasta que el ± sea pequeño. Eso es el módulo siguiente.',
    ],
    formula: {
      texto: 'acierto ± margen · el margen baja con más operaciones',
      conNumeros: `Con ${INSIGNIA_PRACTICA_TXT} operaciones, ±${MARGEN_5} puntos.`,
    },
    noDice: [
      'Practicar sin dinero no es lo mismo que operar con dinero: con dinero el precio de entrada puede salir peor, el spread de tu bróker puede ser otro, y decidir con tu dinero en juego se siente distinto.',
      'Que la práctica salga bien no quiere decir que tu forma de operar funcione: con pocas operaciones no se distingue de la suerte.',
      'La insignia no dice que operes bien: dice que pruebas antes.',
    ],
    video: {
      archivo: 'm10-3',
      desc: 'Video con voz: el «Modo práctica» de un usuario de ejemplo con cinco operaciones resueltas (precios inventados). Se lee el acierto con su ±, se ve la insignia «Practicas sin dinero» conseguida y el botón para descargar la tabla.',
    },
    hazlo: {
      tab: 'diario',
      boton: 'Ir al Diario',
      texto: 'Mira tu acierto de práctica con su ± y fíjate en cuántas operaciones lleva. Si vas a practicar más, hazlo siempre con la misma plantilla.',
    },
    preguntas: [
      {
        p: `Llevas ${INSIGNIA_PRACTICA_TXT} operaciones de práctica y 4 ganadas: 80 %. ¿Qué dice eso?`,
        opciones: ['Que tu forma de operar funciona', `Casi nada: con ${INSIGNIA_PRACTICA_TXT} el ± es de ${MARGEN_5} puntos`, 'Que ya puedes operar con dinero'],
        correcta: 1,
        porque: 'Con tan pocas operaciones, un 80 % y un 50 % no se distinguen.',
      },
      {
        p: '¿Qué premia la insignia «Practicas sin dinero»?',
        opciones: ['Ganar en la práctica', 'Probar antes: cuenta las resueltas, ganadas o perdidas igual', 'Operar mucho'],
        correcta: 1,
        porque: 'Ninguna insignia premia ganar.',
      },
      {
        p: '¿Por qué conviene practicar siempre con la misma plantilla?',
        opciones: ['Porque así se gana más', 'Porque así el resultado habla de una sola forma de operar', 'Porque lo pide la app'],
        correcta: 1,
        porque: 'Si cada vez miras cosas distintas, el resultado mezcla muchas formas de operar.',
      },
    ],
  },

  'm11-1': {
    titulo: 'Acertar no es lo mismo que ganar',
    objetivo: 'Calcular qué acierto hace falta para no perder con una relación riesgo/beneficio, y leer un porcentaje de acierto al lado de ese número.',
    explicacion: [
      'Un porcentaje de acierto solo no dice si una forma de operar gana o pierde. Depende de cuánto ganas cuando aciertas y cuánto pierdes cuando fallas, o sea de la relación riesgo/beneficio (R/B).',
      `Si arriesgas lo mismo que buscas ganar (1:1), necesitas acertar más del ${EQ(1)} % para no perder. Si buscas ganar 1,5 veces lo que arriesgas, basta pasar del ${EQ(1.5)} %. Con 1:2, del ${EQ(2)} %. Y si arriesgas más de lo que buscas ganar —por ejemplo 1:0,7— necesitas acertar más del ${EQ(0.7)} %.`,
      'Eso es antes de los costes. El spread y el swap suben un poco ese número, como se vio en el módulo 6.',
      'Por eso esta app nunca enseña un acierto solo: en el laboratorio va al lado de «Acierto que hace falta para no perder», y en el Historial va con los pips o las unidades de riesgo.',
    ],
    ejemplo: [
      `Una forma de operar acierta el 55 % con R/B 1:0,7. Parece buena; pero con 1:0,7 hace falta el ${EQ(0.7)} %. Pierde dinero acertando más de la mitad de las veces.`,
      `Otra acierta solo el 40 % con R/B 1:2. Parece mala; pero con 1:2 basta el ${EQ(2)} %. Gana dinero fallando más de la mitad de las veces.`,
      'Un caso real de esta app, medido en 2026 sobre cinco años de velas: las señales de la app de swing acertaban el 56 % y aun así perdían unos 4 centavos por cada dólar arriesgado.',
    ],
    formula: {
      texto: 'acierto para no perder = 1 ÷ (1 + R/B)',
      conNumeros: `con R/B 1:1,5 → 1 ÷ 2,5 = ${EQ(1.5)} %   ·   con 1:0,7 → 1 ÷ 1,7 = ${EQ(0.7)} %`,
    },
    noDice: [
      'Que una forma de operar pase su acierto de equilibrio en el pasado no quiere decir que lo vaya a pasar mañana.',
      'Un R/B alto no es mejor por sí solo: con el Take-profit más lejos se acierta menos.',
      'Esta cuenta no dice hacia dónde irá el precio.',
    ],
    video: {
      archivo: 'm11-1',
      desc: 'Video con voz: el Analizador con los datos reales de ese día. Se lee el R/B de la tarjeta y se calcula el acierto que haría falta para no perder; después se cambia el método del Stop-loss a la vara neutra y se ve cómo cambia ese número.',
    },
    hazlo: {
      tab: 'analizar',
      boton: 'Ir al Analizador',
      texto: 'Arma una tarjeta, mira su R/B y calcula el acierto que haría falta para no perder: 1 ÷ (1 + R/B).',
    },
    preguntas: [
      {
        p: 'Una forma de operar acierta el 60 %. ¿Gana dinero?',
        opciones: ['Sí, siempre', `Depende de su R/B: con 1:0,5 haría falta el ${EQ(0.5)} %`, 'No, nunca'],
        correcta: 1,
        porque: 'El acierto solo no basta: hay que mirarlo al lado del R/B.',
      },
      {
        p: '¿Qué acierto hace falta para no perder con R/B 1:1, antes de costes?',
        opciones: [`Más del ${EQ(1)} %`, 'Más del 70 %', 'Más del 30 %'],
        correcta: 0,
        porque: `1 ÷ (1 + 1) = ${EQ(1)} %.`,
      },
      {
        p: 'Los costes (spread y swap), ¿cómo mueven ese número?',
        opciones: ['Lo bajan', 'Lo suben un poco', 'No lo tocan'],
        correcta: 1,
        porque: 'Cada operación paga algo, así que hace falta acertar algo más.',
      },
    ],
  },

  'm11-2': {
    titulo: 'Cuándo dos números son distintos de verdad',
    objetivo: 'Comparar dos porcentajes con su ± y saber cuándo de verdad dicen cosas distintas.',
    explicacion: [
      'Cada porcentaje de la app va con su ±: cuánto puede moverse solo por casualidad. Para comparar dos, no basta mirar cuál es más alto: hay que mirar si sus márgenes se tocan.',
      'Si el rango de uno (su número menos su ±, hasta su número más su ±) se cruza con el del otro, los dos pueden ser el mismo número por debajo. Con eso no se puede decir que uno sea mejor.',
      `Por eso la app pide ${L} operaciones reales a cada experimento antes de creerle: con ${L}, el ± baja a ${M150} puntos. Con 25 es de ±${M25}.`,
      `En el Historial, debajo de cada experimento, la app dice cuántas lleva de las ${L}. Hasta llegar, su número no se puede tomar como señal, salga como salga.`,
    ],
    ejemplo: [
      `Dos formas de operar, 25 operaciones cada una: una acierta el 60 % (±${M25}) y la otra el 42 % (±${M25}). ${solapan(60, M25, 42, M25) ? 'Los rangos se tocan' : 'Los rangos no se tocan'}: con 25 operaciones no se puede decir que la primera sea mejor.`,
      `Las mismas dos con ${L} operaciones cada una: 60 % ±${M150} y 42 % ±${M150}. ${solapan(60, M150, 42, M150) ? 'Todavía se tocan.' : 'Ya no se tocan: ahí sí son distintas.'}`,
      'En tu Diario pasa igual: si en cruces llevas 2 operaciones y las dos ganaron, ese 100 % va con un ± enorme y no dice nada sobre los cruces.',
    ],
    formula: {
      texto: 'distintos solo si los rangos no se tocan:  |A − B| > ±A + ±B',
      conNumeros: `con 25 operaciones: |60 − 42| = 18 y ±${M25} + ±${M25} = ${2 * M25} → no se puede decir que sean distintos. Con ${L}: 18 contra ${2 * M150} → sí lo son`,
    },
    noDice: [
      'Que dos rangos no se toquen dice que los números son distintos, no por qué.',
      'Que un experimento llegue a 150 operaciones no lo convierte en bueno: solo hace que su número se pueda creer, sea bueno o malo.',
      'El ± habla de casualidad, no de que el mercado vaya a seguir igual.',
    ],
    video: {
      archivo: 'm11-2',
      desc: 'Video con voz: «Tus números por grupos» de un usuario de ejemplo (operaciones de muestra) y el Historial con el registro real de ese día. Se comparan dos porcentajes con su ± para ver si se tocan, y se señala cuántas operaciones lleva un experimento de las 150.',
    },
    hazlo: {
      tab: 'historial',
      boton: 'Ir al Historial',
      texto: 'Toma dos porcentajes del Historial con su ± y comprueba si sus rangos se tocan.',
    },
    preguntas: [
      {
        p: 'Un experimento acierta el 58 % ±20 y otro el 48 % ±20. ¿Es mejor el primero?',
        opciones: ['Sí, claramente', 'No se puede decir: sus rangos se tocan', 'No, es peor'],
        correcta: 1,
        porque: '10 puntos de diferencia con 40 de márgenes sumados no distinguen nada.',
      },
      {
        p: `¿Por qué la app pide ${L} operaciones a cada experimento?`,
        opciones: ['Porque es un número bonito', `Porque con ${L} el ± baja a unos ${M150} puntos`, 'Porque lo pide el bróker'],
        correcta: 1,
        porque: 'Con menos, un número alto y uno bajo pueden ser el mismo.',
      },
      {
        p: `Un experimento llega a ${L} operaciones. ¿Qué quiere decir?`,
        opciones: ['Que ya es una señal buena', 'Que su número ya se puede creer, sea bueno o malo', 'Nada'],
        correcta: 1,
        porque: 'Llegar al listón hace el número creíble, no bueno.',
      },
    ],
  },

  'm11-3': {
    titulo: 'El número que se elige después de mirar',
    objetivo: 'Entender por qué un resultado del pasado elegido entre muchas pruebas engaña, y qué distingue un backtest de un registro hacia adelante.',
    explicacion: [
      'Un backtest es probar una regla sobre el pasado: cómo le habría ido. Es útil, pero tiene una trampa. Si pruebas muchas variantes sobre los mismos datos y te quedas con la que mejor salió, siempre sale alguna que gana, aunque sea por casualidad.',
      'Por eso el laboratorio de la app cuenta cuántas pruebas llevas en tu aparato y te lo recuerda: cuantas más, más fácil que alguna gane solo por suerte.',
      'Lo único que no tiene esa trampa es el registro hacia adelante: anotar la regla y mirar cómo le va con días que nadie había visto al elegirla. Es lo que hacen los experimentos de la app, y el seguimiento hacia adelante del laboratorio.',
      'Por eso un experimento no se da como señal por su backtest, por bueno que sea: hace falta que el registro hacia adelante llegue a las operaciones que pide y diga lo mismo.',
    ],
    ejemplo: [
      'Un caso real de esta app: una regla de la app de swing medía en 2026 un acierto del 54 % sobre cinco años de velas. En su registro real, a mediados de noviembre de 2026, iba por el 42 % con 57 operaciones.',
      'El backtest y la realidad no se habían puesto de acuerdo. Por eso esa regla sigue en pruebas y no se propone a nadie.',
      'Si tú pruebas 20 versiones de una regla en el laboratorio y una sale muy bien, antes de creerle síguela hacia adelante.',
    ],
    formula: {
      texto: 'más variantes probadas sobre los mismos datos → más fácil que una gane por casualidad',
      conNumeros: 'Lo que no engaña: las operaciones nuevas, con días que la regla nunca vio.',
    },
    noDice: [
      'Que un backtest salga mal no prueba que la idea sea mala, y que salga bien no prueba que sea buena.',
      'El registro hacia adelante tampoco promete nada: con pocas operaciones su número todavía no significa nada.',
      'Ninguno de los dos dice qué va a pasar mañana.',
    ],
    video: {
      archivo: 'm11-3',
      desc: 'Video con voz: el laboratorio de la pestaña Analizar con las velas guardadas de ese día. Se lee el aviso, se prueba una regla, se cambia una condición y se prueba otra vez: el contador de pruebas sube.',
    },
    hazlo: {
      tab: 'analizar',
      boton: 'Ir al Analizador',
      texto: 'Abre el laboratorio, prueba una regla y fíjate en el contador de pruebas. Si una versión sale muy bien después de muchas, no te la creas todavía.',
    },
    preguntas: [
      {
        p: 'Pruebas 20 variantes de una regla y una sale muy bien. ¿Qué haces?',
        opciones: ['Usarla ya con dinero', 'Seguirla hacia adelante antes de creerle', 'Borrar las otras 19'],
        correcta: 1,
        porque: 'Con muchas pruebas, siempre sale alguna buena por casualidad.',
      },
      {
        p: '¿Qué es el registro hacia adelante?',
        opciones: ['Probar sobre el pasado', 'Mirar cómo le va a la regla con días que nadie había visto al elegirla', 'Una señal del bróker'],
        correcta: 1,
        porque: 'Es lo único que no se puede ajustar mirando.',
      },
      {
        p: 'Un backtest da 54 % y el registro real va por el 42 %. ¿Qué dice eso?',
        opciones: ['Que hay que creerle al backtest', 'Que todavía no se han puesto de acuerdo y la regla sigue en pruebas', 'Que el registro está mal'],
        correcta: 1,
        porque: 'Hasta que la realidad confirme el backtest, no es una señal.',
      },
    ],
  },
  'm12-1': {
    titulo: 'Traer tus operaciones del bróker',
    objetivo: 'Pasar tu historial de MT4 o MT5 al Diario sin copiarlo a mano, y entender por qué entra el resultado neto.',
    explicacion: [
      'En la pestaña Diario está «Importar operaciones del bróker». Exportas tu historial desde la plataforma (MT4: «Guardar como informe detallado»; MT5: «Informe») o un CSV, lo eliges, y la app lo lee.',
      'La app no se conecta a tu bróker y nunca te pide la contraseña de tu cuenta: solo lee el archivo que tú subes. Así nadie le entrega a la app la llave de su dinero.',
      'Antes de guardar nada te enseña cuántas operaciones entrarán, el resultado total y las cinco primeras, para que compruebes que el par y el resultado se leyeron bien. Nada se guarda hasta que lo confirmas.',
      'Cada operación entra con el resultado NETO: lo que dio el precio, más el swap, más la comisión. Es el único número que dice de verdad si ganaste o perdiste.',
      'Si vuelves a subir el informe entero, las que ya estaban no se repiten: la app las reconoce por el número de operación del bróker. Y lo que no analiza (oro, índices, acciones o pares que no sigue) se salta con un aviso.',
    ],
    ejemplo: [
      'Una línea de un informe de EJEMPLO: EUR/USD, resultado del precio +40,00, swap −3,20, comisión −1,50.',
      `La app la guarda con un resultado de ${din(IMP_NETO)}: lo que de verdad quedó en la cuenta.`,
      `Si subes el mismo informe otra vez, entran ${IMP_REPETIDAS} operaciones nuevas: la que ya estaba no se cuenta dos veces.`,
    ],
    formula: {
      texto: 'resultado neto = resultado del precio + swap + comisión',
      conNumeros: `40,00 + (−3,20) + (−1,50) = ${din(IMP_NETO)}`,
    },
    noDice: [
      'La app lee lo que dice tu informe: si el informe trae un error, entra el error.',
      'Si cerraste una operación por partes, revísala: la app todavía no sabe juntar los cierres parciales.',
      'Importar no juzga tus operaciones: solo las apunta.',
    ],
    video: {
      archivo: 'm12-1',
      desc: 'Video con voz: el Diario de un usuario de ejemplo, al que se le sube un informe de EJEMPLO (operaciones inventadas). Se leen las que entrarán, el resultado total con swap y comisión, la línea que se salta y las primeras filas. Se cancela sin guardar.',
    },
    hazlo: {
      tab: 'diario',
      boton: 'Ir al Diario',
      texto: 'Exporta tu historial desde MT4 o MT5 y súbelo en «Importar operaciones del bróker». Antes de confirmar, mira que el par y el resultado de las primeras estén bien.',
    },
    preguntas: [
      {
        p: '¿Necesita la app la contraseña de tu cuenta del bróker para importar?',
        opciones: ['Sí', 'No: solo lee el archivo que tú subes', 'Solo la primera vez'],
        correcta: 1,
        porque: 'La app nunca se conecta al bróker ni pide credenciales.',
      },
      {
        p: 'Una operación dio +40 por el precio, −3,20 de swap y −1,50 de comisión. ¿Qué entra al Diario?',
        opciones: ['+40,00', `${din(IMP_NETO)}`, '+44,70'],
        correcta: 1,
        porque: 'Entra el neto: precio más swap más comisión.',
      },
      {
        p: 'Subes el mismo informe dos veces. ¿Qué pasa?',
        opciones: ['Todo queda contado dos veces', 'Las que ya estaban no se repiten', 'Se borra lo anterior'],
        correcta: 1,
        porque: 'La app reconoce cada operación por su número en el bróker.',
      },
    ],
  },

  'm12-2': {
    titulo: 'Tus números por grupos',
    objetivo: 'Leer «Tus números por grupos» del Diario y saber qué dice cada grupo con su ±.',
    explicacion: [
      'En el Diario, la tarjeta «Tus números por grupos» parte tus operaciones cerradas de tres formas: cruces contra pares con dólar, compras contra ventas, y par por par.',
      'Cada grupo dice cuántas operaciones tiene, qué porcentaje acertaste y cuánto ganaste o perdiste en total. Y al lado de cada porcentaje va su ±: cuánto puede moverse solo por casualidad.',
      `Par por par solo salen los que tienen ${MINIMO_PARA_ENSEÑAR} operaciones o más, y van ordenados por cuántas operaciones tienen, nunca por acierto: ordenar por acierto pondría arriba un par con dos operaciones ganadas y un 100 % que no dice nada.`,
      'Debajo dice qué lotes usaste, del menor al mayor. Es contexto: la app no te dice qué lote usar.',
      'Los grupos con pocas operaciones también salen. Esconderlos dejaría solo los que parecen decir algo.',
    ],
    ejemplo: [
      `Con 20 operaciones de EJEMPLO: cruces ${pct0(G_CRU.pct)} % ±${G_CRU.margen} (${G_CRU.n} operaciones) y pares con dólar ${pct0(G_DOL.pct)} % ±${G_DOL.margen} (${G_DOL.n}).`,
      `Los rangos van del ${Math.max(0, pct0(G_CRU.pct) - G_CRU.margen)} % al ${Math.min(100, pct0(G_CRU.pct) + G_CRU.margen)} % y del ${Math.max(0, pct0(G_DOL.pct) - G_DOL.margen)} % al ${Math.min(100, pct0(G_DOL.pct) + G_DOL.margen)} %: ${GRUPOS_SE_TOCAN ? 'se tocan, así que no se puede decir que en cruces te vaya mejor.' : 'no se tocan: ahí sí son distintos.'}`,
      G_EURUSD
        ? `Par por par, solo sale EUR/USD, que tiene ${G_EURUSD.n} operaciones. Los demás tienen menos de ${MINIMO_PARA_ENSEÑAR}.`
        : `Par por par no sale ninguno: ninguno llega a ${MINIMO_PARA_ENSEÑAR} operaciones.`,
    ],
    formula: {
      texto: '± ≈ 98 ÷ √(operaciones del grupo)',
      conNumeros: `con ${G_CRU.n} operaciones: ±${G_CRU.margen} · con ${G_DOL.n}: ±${G_DOL.margen} · con 100: ±${margen(100)}`,
    },
    noDice: [
      'Un grupo que va mejor no dice por qué: puede ser el par, la hora, el lote o la casualidad.',
      'No compara tus números con los de la app ni con los experimentos.',
      'No te dice qué dejar de operar.',
    ],
    video: {
      archivo: 'm12-2',
      desc: 'Video con voz: «Tus números por grupos» de un usuario de ejemplo con 20 operaciones de muestra. Se leen los cruces y los pares con dólar con su ±, las compras y las ventas, el par que sale y el rango de lotes.',
    },
    hazlo: {
      tab: 'diario',
      boton: 'Ir al Diario',
      texto: 'Abre «Tus números por grupos» y, para cada grupo, mira primero cuántas operaciones tiene y su ± antes que su porcentaje.',
    },
    preguntas: [
      {
        p: '¿Por qué los pares no se ordenan por acierto?',
        opciones: ['Por estética', 'Porque arriba quedaría un par con muy pocas operaciones y un porcentaje que no dice nada', 'Porque el acierto no se calcula'],
        correcta: 1,
        porque: 'Se ordenan por cuántas operaciones tienen: del que más se puede decir.',
      },
      {
        p: `Cruces ${pct0(G_CRU.pct)} % ±${G_CRU.margen} y pares con dólar ${pct0(G_DOL.pct)} % ±${G_DOL.margen}. ¿Te va mejor en cruces?`,
        opciones: ['Sí', 'No se puede decir: los rangos se tocan', 'No, peor'],
        correcta: 1,
        porque: `${Math.abs(pct0(G_CRU.pct) - pct0(G_DOL.pct))} puntos de diferencia contra ${G_CRU.margen + G_DOL.margen} de márgenes sumados.`,
      },
      {
        p: 'La tarjeta dice que usaste lotes del 0,01 al 0,10. ¿Qué te recomienda?',
        opciones: ['Usar siempre 0,10', 'Nada: es contexto, no un consejo', 'Usar siempre 0,01'],
        correcta: 1,
        porque: 'La app enseña el dato y no dice qué lote usar.',
      },
    ],
  },

  'm12-3': {
    titulo: 'Qué mirar en tus números y qué no concluir',
    objetivo: 'Leer tu Diario en el orden que no engaña y no sacar conclusiones que los números no sostienen.',
    explicacion: [
      'Primero el resultado neto, después el acierto. Acertar mucho y perder dinero es posible si las pérdidas son más grandes que las ganancias (módulo 11).',
      'Después, el número de operaciones y el ± de cada porcentaje. Con pocas operaciones, ninguno de tus porcentajes dice nada todavía, por bueno o malo que se vea.',
      'Cuidado con partir tus números en muchos grupos y quedarte con el mejor: con suficientes grupos siempre sale alguno que va bien solo por casualidad. Es la misma trampa del número elegido después de mirar.',
      'Cada app tiene su propio Diario: lo que anotas en la de swing no cuenta en la de intradía, ni al revés.',
      'Lo que tus números sí sirven para ver es tu forma de operar: si respetas tu freno, si anotas por qué entraste, si el lote se mantiene. Eso no depende de acertar el mercado.',
    ],
    ejemplo: [
      `Un Diario de EJEMPLO con 10 operaciones: 7 ganan 10 dólares y 3 pierden 30. Acierto: ${pct0(RA.pct)} % ±${RA.margen}.`,
      `Resultado neto: ${din(RA.neto)} dólares. Con un ${pct0(RA.pct)} % de acierto, ese Diario pierde dinero.`,
      `Y aunque ganara, con ${RA.n} operaciones el ± es de ${RA.margen} puntos: todavía no se puede decir nada de esa forma de operar.`,
    ],
    formula: {
      texto: 'resultado neto = suma de los resultados netos de cada operación',
      conNumeros: `7 × 10 + 3 × (−30) = ${din(RA.neto)}`,
    },
    noDice: [
      'Que tus números vayan bien no dice que vayan a seguir igual.',
      'Que vayan mal no dice que tu forma de operar no sirva: con pocas operaciones no se distingue de la casualidad.',
      'Ningún número del Diario es una señal para la próxima operación.',
    ],
    video: {
      archivo: 'm12-3',
      desc: 'Video con voz: el Diario de un usuario de ejemplo con 10 operaciones de muestra que aciertan mucho y pierden dinero. Se lee primero el resultado y después el acierto, y luego el ± del grupo en «Tus números por grupos».',
    },
    hazlo: {
      tab: 'diario',
      boton: 'Ir al Diario',
      texto: 'En tu Diario, lee primero el resultado y después el acierto. Si tienes pocas operaciones, apunta el ± antes de sacar ninguna conclusión.',
    },
    preguntas: [
      {
        p: 'Tu Diario acierta el 70 % y el resultado es negativo. ¿Es posible?',
        opciones: ['No', 'Sí, si las pérdidas son más grandes que las ganancias', 'Solo con errores de la app'],
        correcta: 1,
        porque: 'El acierto no dice cuánto se gana ni cuánto se pierde.',
      },
      {
        p: 'Partes tus números en 12 grupos y uno va muy bien. ¿Qué haces?',
        opciones: ['Operar solo ese grupo', 'Desconfiar: con tantos grupos alguno sale bien por casualidad', 'Borrar los otros'],
        correcta: 1,
        porque: 'Es la trampa del número elegido después de mirar.',
      },
      {
        p: '¿Lo que anotas en la app de swing cuenta en la de intradía?',
        opciones: ['Sí', 'No: cada app tiene su propio Diario', 'Solo las ganadas'],
        correcta: 1,
        porque: 'Cada app guarda sus operaciones aparte.',
      },
    ],
  },
})
