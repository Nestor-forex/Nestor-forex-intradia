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
//   noDice[], hazlo{tab, boton, texto}, preguntas[{p, opciones[], correcta, porque}]
//
// `tab` es una pestaña que existe en las DOS apps: barrido, analizar, diario,
// historial, avisos, calc.

import { OPS_PARA_CREER } from '../sombra.js'
import { margen } from '../diagnostico.js'

const L = OPS_PARA_CREER

export const MODULOS = Object.freeze([
  Object.freeze({
    id: 'm0',
    n: 0,
    titulo: 'Qué es y qué no es esta app',
    desc: 'Antes de nada: qué te da la app, qué no te da, y por qué los números chicos no dicen nada.',
    lecciones: Object.freeze(['m0-1', 'm0-2']),
  }),
  Object.freeze({
    id: 'm2',
    n: 2,
    titulo: 'El riesgo primero',
    desc: 'Cuánto arriesgar, dónde va el Stop-loss y cómo sale el lote. Lo que más protege a quien empieza.',
    lecciones: Object.freeze(['m2-1', 'm2-2', 'm2-3']),
  }),
])

// Los que todavía no están escritos. Se enseñan para que se vea el camino,
// marcados «próximamente», y no se pueden abrir.
export const PROXIMOS = Object.freeze([
  { n: 1, titulo: 'El lenguaje del Forex' },
  { n: 3, titulo: 'Tu freno del día' },
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
