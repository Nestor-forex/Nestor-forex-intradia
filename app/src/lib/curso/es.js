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

const L = OPS_PARA_CREER

// El ejemplo del módulo 3 se calcula con las MISMAS funciones que usa «Tu freno
// de hoy», con los frenos que la app propone. Si alguien cambia lo sugerido, la
// lección cambia sola.
const PERFIL_EJEMPLO = Object.freeze({ capital: 1000, riesgoPct: 1, ...SUGERIDO })
const FRENO_USD = frenoEnDolares(PERFIL_EJEMPLO)
const OPS_FRENO = operacionesHastaElFreno(PERFIL_EJEMPLO)
const fmt = (n) => String(n).replace('.', ',')

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
])

// Los que todavía no están escritos. Se enseñan para que se vea el camino,
// marcados «próximamente», y no se pueden abrir.
export const PROXIMOS = Object.freeze([
  { n: 4, titulo: 'Quién manda hoy' },
  { n: 5, titulo: 'Tendencia y rango' },
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
      desc: 'Video sin voz, de 33 segundos: la fuerza de las 8 divisas en el Barrido, con los datos reales de ese día. Se toma un par de la lista, se dice cuál es la moneda base y cuál la cotizada, y se busca la fuerza de cada una en el ranking.',
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
      desc: 'Video sin voz, de 32 segundos: la calculadora de la pestaña Riesgo. Con EUR/USD el pip vale 10 USD por lote; al cambiar a USD/JPY el valor del pip cambia, porque depende del precio. Después, el mismo movimiento de 30 pips con un microlote y con un lote entero.',
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
      desc: 'Video sin voz, de 35 segundos: la tarjeta «Lo que cuesta abrir la operación» del Barrido, con el spread real de una cuenta del desarrollador ese día. Se compara el spread de EUR/USD con el de un cruce y se calcula cuánto pesa sobre un Stop-loss corto y uno largo.',
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
      desc: 'Video sin voz, de 37 segundos: dos maneras de cerrar el mismo mal día con 1.000 USD, y la pestaña Riesgo con los dos frenos de «Mi perfil de riesgo»: la pérdida máxima del día y las pérdidas seguidas, que se ponen antes, con la cabeza fría.',
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
      desc: 'Video sin voz, de 34 segundos: «Tu freno de hoy», arriba del Diario, con un usuario de ejemplo que hoy lleva dos operaciones perdidas. La tarjeta suma lo perdido contra el freno del día y las pérdidas seguidas contra su límite, y se pone ámbar cuando queda poco margen.',
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
      desc: 'Video sin voz, de 32 segundos: el Barrido con los datos reales de ese día. Se abre la tarjeta «Qué es esta app», se lee que nada de lo que se ve es una señal para copiar, y se baja hasta los avisos de los experimentos, que dicen «Esto NO son señales».',
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
      desc: 'Video sin voz, de 31 segundos: el Historial con el registro real de ese día. Se señala el ± que va pegado al acierto y el aviso de cuántas operaciones lleva el experimento de las que hacen falta para creerle.',
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
      desc: 'Video sin voz, de 40 segundos: «Mi perfil de riesgo» de la pestaña Riesgo con un perfil de ejemplo de 1.000 USD. Se cambia el riesgo entre 1 %, 2 % y 3 % y se ve cuánto se arriesga por operación; después, cuánto queda tras diez pérdidas seguidas con cada porcentaje.',
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
      desc: 'Video sin voz, de 49 segundos: el Analizador con los datos reales de ese día. Se elige un par y una dirección cualquiera solo para ver las cuentas, y se prueban los tres métodos de Stop-loss: cambian el Stop-loss, el Take-profit, el R/B y el lote.',
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
      desc: 'Video sin voz, de 20 segundos: la calculadora con un perfil de 1.000 USD y un 1 % por operación. El Stop-loss pasa de 25 a 50 pips, el lote baja de 0,04 a 0,02 y lo que se arriesga se queda en 10 USD.',
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
})
