// LO QUE MIDE EL BANCO DE PRUEBAS, PARA ENSEÑARLO DENTRO DE LA APP.
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO ESTÁ EN LA APP Y NO SOLO EN UN INFORME QUE NADIE VE
// ─────────────────────────────────────────────────────────────────────────
// Swing tenía esta pantalla desde el 2026-09-04 y esta app NO, así que sus
// números vivían únicamente dentro del registro de un workflow de GitHub —
// donde no los ve nadie. Néstor lo preguntó de frente el 2026-09-16 («¿y ese
// banco de pruebas se puede ver en las apps?») y la respuesta honesta era que
// aquí no.
//
// Las apps que presumen de «motor de backtesting» enseñan la HERRAMIENTA de
// medir, no el resultado. Si el número fuera bueno sería lo primero de su
// página. Enseñar el propio número, siendo malo, es lo contrario de lo que
// hace el sector, y es la única forma de que alguien tenga razones para creer
// lo demás.
//
// ⚠️⚠️ TODOS LOS `porRiesgo` DE AQUÍ LLEVAN EL SPREAD YA DESCONTADO.
// Por eso el campo se llama `porRiesgoConSpread` y no `porRiesgo` a secas:
// un nombre corto invita a copiar aquí, algún día, un número de la tabla que
// NO descuenta nada, y nadie se enteraría. Néstor lo pidió con estas palabras
// —«que ya están incluidos los gastos de spread»— y la pantalla lo dice.
//
// 📌 Y no es una precaución teórica. El 2026-09-15 la única fila no negativa
// del informe era el modo rango con +0,02, y esa tabla NO descontaba nada sin
// decirlo. Se estimó a mano que con el spread quedaría en unos −0,04. Al
// medirlo de verdad salió **−0,062**: la estimación era optimista, porque el
// peaje depende de lo ancho que sea el stop de cada regla y las señales de
// rango tienen el stop más estrecho que las de tendencia. Ese error es
// exactamente lo que este nombre largo intenta que no se repita.
//
// ⚠️ ESTOS NÚMEROS SE ESCRIBEN A MANO Y LLEVAN FECHA A PROPÓSITO.
// No hay forma de calcularlos en el navegador: salen de descargar casi 20.000
// velas de una hora y recalcular el barrido vela a vela, que son 43 minutos de
// trabajo en un servidor. Al llevar la fecha dentro, un número viejo se delata
// solo en la pantalla en vez de envejecer en silencio.
//
// 📌 REGLA QUE YA COSTÓ UN DISGUSTO EN SWING: cambiar un umbral de
// `marketCalc.js` obliga a volver a correr el banco de pruebas y actualizar
// este archivo. No es opcional — es la mitad del cambio. Allí se aflojó
// `TENDENCIA_MIN` y esta pantalla siguió enseñando los números de una app que
// ya no existía.
//
// CÓMO SE ACTUALIZAN: Actions → «Banco de pruebas de las reglas» → Run
// workflow. De la tabla «LAS MISMAS, PERO PAGANDO LO QUE CUESTA OPERAR» sale
// la columna «con spread» de las filas neutras; de «AFLOJAR LOS FILTROS · Con
// la geometría REAL de la app» sale la fila «tal cual (hoy)».

export const MEDICION = {
  // Cuándo se corrió el banco de pruebas que dio estos números.
  fecha: '2026-09-16',
  desde: '2023-09-28',
  hasta: '2026-09-16',
  // Velas de una hora que se midieron de verdad (las primeras 300 son la
  // ventana que el barrido necesita para arrancar y no cuentan).
  velas: 19595,

  // La app tal cual, con SU geometría de stop y objetivo. Es lo que Néstor ve
  // en pantalla, medido de verdad y con el spread por par descontado.
  app: {
    operaciones: 7861,
    acierto: 38,
    porRiesgoConSpread: -0.14,
  },

  // La misma app medida con la vara NEUTRA (stop y objetivo a la misma
  // distancia). Sirve para separar «acierta la dirección» de «gana dinero»:
  // con el objetivo más cerca que el stop se puede acertar mucho y perder
  // igual, y esta fila es la que lo desnuda. Fíjate en el contraste: 38 % de
  // acierto con la geometría de la app y 49 % con la vara honesta.
  neutra: {
    operaciones: 7861,
    acierto: 49,
    porRiesgoConSpread: -0.096,
  },

  // ⚠️ LOS DOS MODOS, APARTE Y NUNCA SUMADOS.
  //
  // Néstor los pidió separados al ver que en su Historial real se comportaban
  // distinto, y tenía razón: juntos dan un promedio que no describe a ninguno
  // de los dos. Es la misma razón por la que la sombra nunca se suma a la app.
  tendencia: {
    operaciones: 5622,
    acierto: 48,
    porRiesgoConSpread: -0.109,
  },

  // El menos malo de todo el informe, y aun así pierde. Acierta MÁS que
  // tendencia (51 % contra 48 %) y pierde menos, pero pierde: con la vara 1:1
  // hay que acertar por encima del 50 % solo para empatar, y el spread se
  // lleva más de lo que ese 51 % da.
  rango: {
    operaciones: 2239,
    acierto: 51,
    porRiesgoConSpread: -0.062,
  },

  // La regla que corre en la sombra y que el vigía anota sin proponérsela a
  // nadie. Medida de frente: pierde, y no de poco.
  //
  // ⚠️ NO SE ENCIENDE. El listón estaba escrito antes de medir y aquí no llega
  // ni cerca. Y sus 9 operaciones reales con 56 % de acierto no lo
  // contradicen: con 9 operaciones el margen es de ±33 puntos, o sea que un
  // 56 % y un 44 % son el mismo número.
  retroceso: {
    operaciones: 585,
    acierto: 44,
    porRiesgoConSpread: -0.17,
  },
}
