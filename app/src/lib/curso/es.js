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
import { margen } from '../diagnostico.js'
import { SUGERIDO, frenoEnDolares, operacionesHastaElFreno } from '../perfilRiesgo.js'
import { PERIODOS_MEDIAS, PERIODO_ATR, PERIODO_RSI, PESOS_FUERZA, RSI_MAX, TENDENCIA_MIN, UMBRALES_COMPRESION, UMBRAL_FUERZA, VELAS_ATRAS_COMPRESION, VENTANAS_FUERZA } from '../marketCalc.js'
// Lo que solo existe en UNA de las dos apps (el modo rango y la distancia del
// Stop-loss) se lee por aquí: un nombre que la otra app no exporta sale
// `undefined` en vez de romper la importación.
import * as MC from '../marketCalc.js'
import { APP } from '../identidad.js'

const L = OPS_PARA_CREER

// El ejemplo del módulo 3 se calcula con las MISMAS funciones que usa «Tu freno
// de hoy», con los frenos que la app propone. Si alguien cambia lo sugerido, la
// lección cambia sola.
const PERFIL_EJEMPLO = Object.freeze({ capital: 1000, riesgoPct: 1, ...SUGERIDO })
const FRENO_USD = frenoEnDolares(PERFIL_EJEMPLO)
const OPS_FRENO = operacionesHastaElFreno(PERFIL_EJEMPLO)
const fmt = (n) => String(n).replace('.', ',')

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
    desc: 'La fuerza de cada divisa, la diferencia que la app mira en cada par, y por qué «10 contra 0» no quiere decir mucha diferencia.',
    lecciones: Object.freeze(['m4-1', 'm4-2', 'm4-3']),
  }),
  Object.freeze({
    id: 'm5',
    n: 5,
    titulo: 'Tendencia y rango',
    desc: 'Las medias móviles, el RSI y el ATR, y cómo se ve un mercado que va de lado: soportes, resistencias y compresión.',
    lecciones: Object.freeze(['m5-1', 'm5-2', 'm5-3']),
  }),
])

// Los que todavía no están escritos. Se enseñan para que se vea el camino,
// marcados «próximamente», y no se pueden abrir.
export const PROXIMOS = Object.freeze([
  { n: 6, titulo: 'Lo que cuesta operar' },
  { n: 7, titulo: 'Noticias y bancos centrales' },
  { n: 8, titulo: 'Pares que son la misma apuesta' },
  { n: 9, titulo: 'Del análisis a la operación' },
  { n: 10, titulo: 'Practicar sin dinero' },
  { n: 11, titulo: 'Un número que significa algo' },
  { n: 12, titulo: 'Medir tus propios números' },
])

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
      desc: 'Video sin voz: la fuerza de las 8 divisas en el Barrido, con los datos reales de ese día. Se toma un par de la lista, se dice cuál es la moneda base y cuál la cotizada, y se busca la fuerza de cada una en el ranking.',
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
      desc: 'Video sin voz: la calculadora de la pestaña Riesgo. Con EUR/USD el pip vale 10 USD por lote; al cambiar a USD/JPY el valor del pip cambia, porque depende del precio. Después, el mismo movimiento de 30 pips con un microlote y con un lote entero.',
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
      desc: 'Video sin voz: la tarjeta «Lo que cuesta abrir la operación» del Barrido, con el spread real de una cuenta del desarrollador ese día. Se compara el spread de EUR/USD con el de un cruce y se calcula cuánto pesa sobre un Stop-loss corto y uno largo.',
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
      desc: 'Video sin voz: dos maneras de cerrar el mismo mal día con 1.000 USD, y la pestaña Riesgo con los dos frenos de «Mi perfil de riesgo»: la pérdida máxima del día y las pérdidas seguidas, que se ponen antes, con la cabeza fría.',
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
      desc: 'Video sin voz: «Tu freno de hoy», arriba del Diario, con un usuario de ejemplo que hoy lleva dos operaciones perdidas. La tarjeta suma lo perdido contra el freno del día y las pérdidas seguidas contra su límite, y se pone ámbar cuando queda poco margen.',
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
      desc: 'Video sin voz: el Barrido con los datos reales de ese día. Se abre la tarjeta «Qué es esta app», se lee que nada de lo que se ve es una señal para copiar, y se baja hasta los avisos de los experimentos, que dicen «Esto NO son señales».',
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
      desc: 'Video sin voz: el Historial con el registro real de ese día. Se señala el ± que va pegado al acierto según cuántas operaciones lleva cada regla, y el aviso de cuántas le faltan al experimento para que su número signifique algo.',
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
      desc: 'Video sin voz: «Mi perfil de riesgo» de la pestaña Riesgo con un perfil de ejemplo de 1.000 USD. Se cambia el riesgo entre 1 %, 2 % y 3 % y se ve cuánto se arriesga por operación; después, cuánto queda tras diez pérdidas seguidas con cada porcentaje.',
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
      desc: 'Video sin voz: el Analizador con los datos reales de ese día. Se elige un par y una dirección cualquiera solo para ver las cuentas, y se prueban los tres métodos de Stop-loss: cambian el Stop-loss, el Take-profit, el R/B y el lote.',
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
      'El error más común es usar siempre el mismo lote. Así, una operación con el Stop-loss lejos arriesga mucho más que una con el Stop-loss cerca, sin que te des cuenta.',
      'Lo correcto es al revés: primero decides cuánto arriesgar en dinero (tu porcentaje), después miras a cuántos pips está el Stop-loss, y de ahí sale el lote.',
      'Con el Stop-loss lejos, el lote baja. Con el Stop-loss cerca, sube. Lo que se queda igual es lo que arriesgas.',
    ],
    ejemplo: [
      'Capital 1.000 USD, riesgo del 1 %: arriesgas 10 USD.',
      'En EUR/USD, un pip vale 10 USD por cada lote entero.',
      'Con el Stop-loss a 25 pips: 10 ÷ (25 × 10) = 0,04 lotes.',
      'Con el Stop-loss a 50 pips: 10 ÷ (50 × 10) = 0,02 lotes.',
      'En los dos casos, si toca el Stop-loss pierdes 10 USD.',
    ],
    formula: {
      texto: 'lote = dinero que arriesgas ÷ (pips del Stop-loss × valor del pip por lote)',
      conNumeros: '10 ÷ (25 × 10) = 0,04 lotes',
    },
    noDice: [
      'No te dice si la operación es buena: solo que, si sale mal, perderás lo que decidiste.',
      'El valor del pip cambia según el par. En los pares con dólar al final (EUR/USD, GBP/USD…) es 10 USD por lote; en los demás depende del precio, y la calculadora lo hace sola.',
      'No incluye el spread ni el swap.',
    ],
    video: {
      archivo: 'm2-3-lote',
      desc: 'Video sin voz: la calculadora con un perfil de 1.000 USD y un 1 % por operación. El Stop-loss pasa de 25 a 50 pips, el lote baja de 0,04 a 0,02 y lo que se arriesga se queda en 10 USD.',
    },
    hazlo: {
      tab: 'calc',
      boton: 'Ir a Riesgo',
      texto: 'En la calculadora, pon un par y un Stop-loss de 25 pips. Mira el lote. Cambia el Stop-loss a 50 pips y mira cómo baja el lote mientras el riesgo en dólares se queda igual.',
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
      desc: 'Video sin voz: el Barrido con los datos reales de ese día. Se señalan las barras de fuerza de las ocho divisas, la más fuerte y la más débil, y se explica que cada una sale de compararla con las otras siete.',
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
      desc: 'Video sin voz: el tablero completo con los datos reales de ese día. Se señala la «Dif» de un par, se compara con el umbral de la app, y se ve un par que lo pasa y otro que no.',
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
      desc: 'Video sin voz: las barras de fuerza del Barrido, donde siempre hay un 10 y un 0, y después la «Dif» real del tablero completo, que es la que la app compara con el umbral.',
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
      desc: 'Video sin voz: el Analizador con los datos reales de ese día. Se señala la fila «Tendencia» con sus dos EMA y después las medias móviles, y se explica cómo decide la app si un par está en tendencia o en rango.',
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
      desc: 'Video sin voz: el Analizador con los datos reales de ese día. Se señalan el RSI y el ATR de un par, y después el Stop-loss de la tarjeta, que sale del ATR.',
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
      desc: 'Video sin voz: el Analizador con los datos reales de ese día. Se señalan el soporte y la resistencia de un par y después su compresión, con la palabra que dice qué tan raro es ese número.',
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
})
