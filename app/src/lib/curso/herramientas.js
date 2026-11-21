// Las herramientas de la app, una por una y en video (2026-11-20). Gemelo.
//
// Néstor: «un video por cada cosa que se debe explicar de las herramientas…
// ejemplos de cómo usarlas», y «que los videos de intradía sean lo que
// corresponde a ella y así para swing». Por eso:
//  - cada herramienta dice en qué apps existe (`apps`): el COT, el oro y la
//    correlación solo están en la de swing, y la pantalla de intradía no los
//    enseña;
//  - cada app graba y guarda SU video con el mismo nombre de archivo
//    (`URL_VIDEOS` de `curso.js` apunta a la página de la app que lo enseña);
//  - el texto vale para las dos: lo que cambia entre ellas (velas de un día o
//    de una hora) lo dice el video, que se graba en cada una.
//
// ⚠️ LAS MISMAS REGLAS QUE LAS LECCIONES: nunca «compra» ni «vende», nunca
// hacia dónde irá el precio, y siempre «Lo que esto NO te dice».
//
// La escena que graba cada video vive en `scripts/videos/escenas-herramientas.mjs`
// con el mismo id. `prueba-curso.mjs` exige que las dos listas coincidan y que
// el archivo de cada herramienta de ESTA app exista.

export const HERRAMIENTAS = Object.freeze([
  {
    id: 'h-barrido',
    apps: ['swing', 'intradia'],
    titulo: 'El Barrido: qué divisas están fuertes y cuáles débiles',
    que: 'La primera pantalla. Compara las 8 divisas entre sí y pone cada par con su tendencia y su RSI.',
    video: { archivo: 'h-barrido', desc: 'Video con voz: el Barrido con los datos reales del día de la grabación. La fuerza de las 8 divisas, de 0 a 10, y la lista de pares con su tendencia y su RSI.' },
    noDice: ['Que una divisa esté fuerte no dice que vaya a seguir fuerte mañana.', 'Si un par lleva una dirección al lado, es la de un experimento que la app mide: no una señal para copiar.'],
    hazlo: { tab: 'barrido', boton: 'Ir al Barrido', texto: 'Mira qué divisa está arriba y cuál abajo, y busca un par que lleve las dos.' },
  },
  {
    id: 'h-analizador',
    apps: ['swing', 'intradia'],
    titulo: 'El Analizador, paso a paso',
    que: 'Junta todas las herramientas para el par y la dirección que TÚ elijas, y te da el Stop-loss, el Take-profit y el lote.',
    video: { archivo: 'h-analizador', desc: 'Video con voz: los cuatro pasos del Analizador (par, dirección, cómo poner el Stop-loss y qué herramientas ver), con la tarjeta de niveles y el lote del perfil de ejemplo.' },
    noDice: ['No elige la dirección: la eliges tú.', 'Los niveles son cuentas sobre cuánto se mueve el par, no una predicción de que vaya a llegar.'],
    hazlo: { tab: 'analizar', boton: 'Ir a Analizar', texto: 'Elige un par y una dirección, prueba los tres métodos de Stop-loss y mira cómo cambia la tarjeta.' },
  },
  {
    id: 'h-rsi',
    apps: ['swing', 'intradia'],
    titulo: 'RSI: si el precio subió o bajó con mucha fuerza',
    que: 'Un número de 0 a 100 calculado con las últimas 14 velas. Por encima de 70 se suele decir que subió con mucha fuerza; por debajo de 30, que cayó con mucha fuerza.',
    video: { archivo: 'h-rsi', desc: 'Video con voz: el RSI de un par en el Analizador, con el número del día de la grabación y lo que significa.' },
    noDice: ['Un RSI alto no dice que vaya a bajar, ni uno bajo que vaya a subir: puede seguir así mucho tiempo.'],
    hazlo: { tab: 'analizar', boton: 'Ir a Analizar', texto: 'En el paso 4, enciende «RSI» y mira el número de varios pares.' },
  },
  {
    id: 'h-atr',
    apps: ['swing', 'intradia'],
    titulo: 'ATR: cuánto se mueve el par',
    que: 'Lo que suele recorrer el par en una vela normal. De ahí salen los Stop-loss del Analizador.',
    video: { archivo: 'h-atr', desc: 'Video con voz: el ATR de un par en el Analizador, en pips y en porcentaje, y por qué un Stop-loss más corto que el ATR lo puede tocar el movimiento normal.' },
    noDice: ['El ATR no dice hacia dónde irá el precio: solo cuánto se mueve.'],
    hazlo: { tab: 'analizar', boton: 'Ir a Analizar', texto: 'Enciende «ATR» y compara un par tranquilo con uno que se mueve mucho.' },
  },
  {
    id: 'h-medias',
    apps: ['swing', 'intradia'],
    titulo: 'Medias móviles (SMA y EMA)',
    que: 'El precio promedio de las últimas velas. La EMA da más peso a las más recientes. Sirven para ver la tendencia de un vistazo.',
    video: { archivo: 'h-medias', desc: 'Video con voz: las medias móviles de un par en el Analizador, con sus valores del día de la grabación y a qué distancia está el precio de cada una.' },
    noDice: ['Que el precio esté por encima de una media dice lo que ya pasó, no que vaya a seguir subiendo.'],
    hazlo: { tab: 'analizar', boton: 'Ir a Analizar', texto: 'Enciende «Medias móviles» y mira si el precio está por encima o por debajo de cada una.' },
  },
  {
    id: 'h-bollinger',
    apps: ['swing', 'intradia'],
    titulo: 'Bandas de Bollinger y el %B',
    que: 'Una media de 20 velas con una banda arriba y otra abajo. El %B dice dónde está el precio entre las dos: 0 es la de abajo, 1 la de arriba.',
    video: { archivo: 'h-bollinger', desc: 'Video con voz: las bandas de Bollinger de un par en el Analizador, con sus tres líneas y el %B del día de la grabación.' },
    noDice: ['Que el precio toque una banda no dice que vaya a darse la vuelta.'],
    hazlo: { tab: 'analizar', boton: 'Ir a Analizar', texto: 'Enciende «Bollinger (%B)» y busca un par con el %B cerca de 0 o de 1.' },
  },
  {
    id: 'h-calendario',
    apps: ['swing', 'intradia'],
    titulo: 'El calendario económico',
    que: 'Las noticias que pueden mover el precio en las próximas 48 horas, con su divisa, su hora y cuánto suelen mover.',
    video: { archivo: 'h-calendario', desc: 'Video con voz: la tarjeta del calendario en el Barrido y el botón «¿Qué significa?», que explica cada noticia en palabras sencillas.' },
    noDice: ['Dice CUÁNDO puede haber sacudida, nunca hacia dónde.'],
    hazlo: { tab: 'barrido', boton: 'Ir al Barrido', texto: 'Abre «Calendario económico» y toca «¿Qué significa?» en una noticia.' },
  },
  {
    id: 'h-tasas',
    apps: ['swing', 'intradia'],
    titulo: 'Tasas de interés y swap',
    que: 'Las tasas de los 8 bancos centrales, y de qué lado suele jugar el swap: lo que se paga o se cobra cada noche que la operación sigue abierta.',
    video: { archivo: 'h-tasas', desc: 'Video con voz: la tarjeta de tasas en el Barrido, con la diferencia de tasas de cada par y la fecha de cada dato.' },
    noDice: ['La diferencia de tasas no es tu swap: tu bróker le suma un margen que no publica nadie.'],
    hazlo: { tab: 'barrido', boton: 'Ir al Barrido', texto: 'Abre «Tasas de interés y swap» y busca el par con la mayor diferencia.' },
  },
  {
    id: 'h-spread',
    apps: ['swing', 'intradia'],
    titulo: 'Lo que cuesta abrir: spread y actividad',
    que: 'El spread real de cada par y cuántas veces cambió el precio hoy, con los precios de una cuenta real del desarrollador.',
    video: { archivo: 'h-spread', desc: 'Video con voz: la tarjeta «Lo que cuesta abrir la operación», con el precio de compra y de venta, el spread y la actividad de cada par.' },
    noDice: ['El spread y la actividad son los de una cuenta real del desarrollador: los de tu bróker pueden ser otros.', 'La actividad no es volumen ni dice hacia dónde: dice dónde hay gente ahora mismo.'],
    hazlo: { tab: 'barrido', boton: 'Ir al Barrido', texto: 'Busca «Lo que cuesta abrir la operación» y compara el spread de EUR/USD con el de un cruce.' },
  },
  {
    id: 'h-noticias',
    apps: ['swing', 'intradia'],
    titulo: 'Noticias de los bancos centrales',
    que: 'Lo último que publicaron la Fed, el BCE, el Banco de Nueva Zelanda e ING, con la divisa de cada noticia delante y su fecha.',
    video: { archivo: 'h-noticias', desc: 'Video con voz: la tarjeta de noticias en el Barrido, con la divisa de cada titular, su fuente y su fecha, y el enlace para leerla en la página original.' },
    noDice: ['Una noticia dice qué pasó y cuándo, nunca hacia dónde irá el precio.', 'Los titulares van tal cual los publica cada fuente, en su idioma.'],
    hazlo: { tab: 'barrido', boton: 'Ir al Barrido', texto: 'Abre «Noticias de los bancos centrales» y mira qué divisa lleva la noticia más reciente.' },
  },
  {
    id: 'h-niveles',
    apps: ['swing', 'intradia'],
    titulo: 'Soporte, resistencia y pivote',
    que: 'El soporte y la resistencia son el mínimo y el máximo de las últimas 20 velas. El pivote sale del máximo, el mínimo y el cierre del día anterior (en la app de intradía, de las 24 horas anteriores), con un nivel por debajo (S1) y otro por encima (R1).',
    video: { archivo: 'h-niveles', desc: 'Video con voz: el soporte, la resistencia y el pivote de un par en el Analizador, con sus niveles del día de la grabación y a qué distancia está el precio.' },
    noDice: ['Que el precio haya frenado ahí antes no quiere decir que vuelva a frenar.', 'Un nivel dice dónde mirar, no qué hacer cuando el precio llegue.'],
    hazlo: { tab: 'analizar', boton: 'Ir a Analizar', texto: 'Enciende «Soporte y resistencia» y «Pivote» y mira a cuál de los niveles está más cerca el precio.' },
  },
  {
    id: 'h-compresion',
    apps: ['swing', 'intradia'],
    titulo: 'Compresión: si el par se ha calmado',
    que: 'Compara cuánto se mueve el par ahora con cuánto se movía antes. Por debajo de 1 se mueve menos que antes; por encima de 1, más.',
    video: { archivo: 'h-compresion', desc: 'Video con voz: la compresión de un par en el Analizador, con su número del día de la grabación y la palabra que lo acompaña.' },
    noDice: ['Que un par esté apretado no dice hacia qué lado se va a soltar, ni cuándo.', 'Medida en la app de swing, partir las señales por la compresión no distinguió nada.'],
    hazlo: { tab: 'analizar', boton: 'Ir a Analizar', texto: 'Enciende «Compresión» y compara varios pares: busca uno por debajo de 1 y otro por encima.' },
  },
  {
    id: 'h-fibonacci',
    apps: ['swing', 'intradia'],
    titulo: 'Fibonacci: los niveles del último movimiento',
    que: 'Toma el último movimiento de las últimas 20 velas y marca el 23,6, 38,2, 50, 61,8 y 78,6 % de su recorrido, con la distancia del precio a cada uno.',
    video: { archivo: 'h-fibonacci', desc: 'Video con voz: los niveles de Fibonacci de un par en el Analizador, el movimiento del que salen y cuál queda más cerca del precio.' },
    noDice: ['No hay prueba de que el precio respete estos niveles por sí solo.', 'Si el movimiento es muy pequeño, la app no dibuja los niveles: no significarían nada.'],
    hazlo: { tab: 'analizar', boton: 'Ir a Analizar', texto: 'Enciende «Fibonacci» y mira cuál es el nivel más cercano al precio.' },
  },
  {
    id: 'h-fvg',
    apps: ['swing', 'intradia'],
    titulo: 'FVG: los huecos que dejó el precio',
    que: 'Un FVG (brecha de valor justo) es un tramo de precio que quedó sin negociar cuando el precio se movió muy rápido entre tres velas. La app enseña los que siguen vivos en las últimas 20 velas.',
    video: { archivo: 'h-fvg', desc: 'Video con voz: los huecos (FVG) de un par en el Analizador, con sus bordes, la distancia del precio y si ya se tocaron.' },
    noDice: ['Medido en la app de swing sobre unos 5 años, entrar cuando el precio vuelve al hueco NO ganó.', 'Dice dónde están los huecos, no hacia dónde irá el precio.'],
    hazlo: { tab: 'analizar', boton: 'Ir a Analizar', texto: 'Enciende «FVG» y mira si el precio está dentro de algún hueco o lejos de todos.' },
  },
  {
    id: 'h-estacionalidad',
    apps: ['swing', 'intradia'],
    titulo: 'Estacionalidad: cuánto suele moverse según el calendario',
    que: 'Cuánto suele moverse el par en este mes y en este día de la semana (y a esta hora, en la app de intradía), comparado con su media. Y cuántos meses como éste cerraron en verde, con su margen.',
    video: { archivo: 'h-estacionalidad', desc: 'Video con voz: la estacionalidad de un par en el Analizador, con el recorrido típico de hoy y de este mes, y la dirección por mes con su margen.' },
    noDice: ['Mide cuánto se mueve, no hacia dónde.', 'La dirección por mes sale de muy pocos años: con un margen tan grande casi no dice nada.'],
    hazlo: { tab: 'analizar', boton: 'Ir a Analizar', texto: 'Enciende «Estacionalidad» y mira el margen que lleva la dirección del mes.' },
  },
  {
    id: 'h-pares',
    apps: ['swing', 'intradia'],
    titulo: 'Mis pares: ver solo los tuyos o verlos todos',
    que: 'Eliges los pares que operas y el Barrido se queda con ésos. Con un toque vuelves a ver todos. Arriba siempre dice cuántos estás viendo.',
    video: { archivo: 'h-pares', desc: 'Video con voz: un usuario de ejemplo con cuatro pares elegidos pasa del Barrido completo a ver solo los suyos, y abre «Cambiar mis pares».' },
    noDice: ['No recomienda pares: solo filtra los que tú elegiste.', 'El ranking de fuerza de las divisas no se recorta nunca, porque compara cada divisa con las otras siete.'],
    hazlo: { tab: 'barrido', boton: 'Ir al Barrido', texto: 'Toca «Elegir mis pares» y quédate con los que operas de verdad.' },
  },
  {
    id: 'h-avisos',
    apps: ['swing', 'intradia'],
    titulo: 'Mis avisos: que el mercado te llame a ti',
    que: 'Programas tus propios avisos de precio, RSI o %B en tus pares, y te llega una notificación al celular cuando pasa lo que pediste. Hasta veinte.',
    video: { archivo: 'h-avisos', desc: 'Video con voz: la pestaña Avisos con dos avisos de ejemplo, y cómo se arma uno nuevo eligiendo el par, de qué, cuándo y el nivel.' },
    noDice: ['No son señales: los niveles los pones tú y la app no sugiere ninguno.', 'Un aviso dice qué pasó, nunca qué hacer con ello.'],
    hazlo: { tab: 'avisos', boton: 'Ir a Avisos', texto: 'Pon un aviso de RSI en un par que sigas, por ejemplo «si llega o pasa de 70».' },
  },
  {
    id: 'h-oro',
    apps: ['swing'],
    titulo: 'El oro y cuánto se mueve con tus pares',
    que: 'El precio del oro, cuánto cambió en un día y en 20, y cuánto se ha movido junto a cada par en las últimas 60 sesiones, de −1 a +1.',
    video: { archivo: 'h-oro', desc: 'Video con voz: la tarjeta del oro en el Barrido, con su precio y el par que más se ha movido con él.' },
    noDice: ['El oro no dice comprar ni vender ningún par.', 'Que dos cosas se muevan juntas no quiere decir que una mueva a la otra.'],
    hazlo: { tab: 'barrido', boton: 'Ir al Barrido', texto: 'Abre la tarjeta del oro y mira qué par se ha movido más con él.' },
  },
  {
    id: 'h-correlacion',
    apps: ['swing'],
    titulo: 'Correlación: pares que se mueven casi igual',
    que: 'Los pares que se han movido casi igual (o al revés) en las últimas 60 sesiones. Sirve para no abrir dos veces la misma apuesta sin darte cuenta.',
    video: { archivo: 'h-correlacion', desc: 'Video con voz: la tarjeta de correlación del tablero completo, con la pareja de pares que más se parece y lo que significa el signo.' },
    noDice: ['No dice qué par operar: dice cuáles son, en el fondo, la misma apuesta.', 'Es lo que pasó en las últimas 60 sesiones; puede cambiar.'],
    hazlo: { tab: 'barrido', boton: 'Ir al Barrido', texto: 'Entra al tablero completo, abre «Correlación entre pares» y mira si dos de tus pares están en la lista.' },
  },
  {
    id: 'h-practica',
    apps: ['swing', 'intradia'],
    titulo: 'Modo práctica: operar sin dinero',
    que: 'Desde el Analizador guardas una operación de práctica con sus niveles, y la app la sigue sola con precios reales hasta que toca el Stop-loss o el Take-profit. El resultado no se puede cambiar a mano.',
    video: { archivo: 'h-practica', desc: 'Video con voz: una operación de práctica creada desde el Analizador con los niveles del día de la grabación, y cómo aparece en el Diario con su gráfica.' },
    noDice: ['No es dinero real ni una señal: es tu idea, medida con precios reales.', 'Unas pocas operaciones de práctica no dicen si tu forma de operar funciona: el margen es enorme.'],
    hazlo: { tab: 'analizar', boton: 'Ir a Analizar', texto: 'Elige un par y una dirección, y pulsa «Practicar esta operación (sin dinero)».' },
  },
  {
    id: 'h-laboratorio',
    apps: ['swing', 'intradia'],
    titulo: 'Laboratorio: prueba tu propia regla',
    que: 'Armas una regla (lado, hasta 4 condiciones, Stop-loss y Take-profit) y la app cuenta cómo le habría ido sobre las velas guardadas, con el spread descontado y las dos mitades del periodo por separado.',
    video: { archivo: 'h-laboratorio', desc: 'Video con voz: una regla de ejemplo en el laboratorio (comprar con el RSI por debajo de 30), su resultado con el margen, y el acierto que hace falta para no perder.' },
    noDice: ['Que una regla haya ganado en el pasado no quiere decir que vaya a ganar mañana.', 'Cuantas más variantes pruebes sobre las mismas velas, más fácil es encontrar una que gane por casualidad: por eso la app cuenta tus pruebas.'],
    hazlo: { tab: 'analizar', boton: 'Ir a Analizar', texto: 'Abre «Laboratorio: prueba tu propia regla» al final del Analizador y prueba la regla del video.' },
  },
  {
    id: 'h-importar',
    apps: ['swing', 'intradia'],
    titulo: 'Importar tus operaciones del bróker',
    que: 'Subes el informe de MT4 o MT5 (o un CSV) y tus operaciones entran al Diario con el resultado neto, ya con el swap y la comisión descontados. Nada se guarda hasta que lo confirmas.',
    video: { archivo: 'h-importar', desc: 'Video con voz: un archivo de ejemplo inventado subido a «Importar operaciones del bróker», con las operaciones que entrarían, su resultado neto y lo que se salta.' },
    noDice: ['El archivo del video es inventado: con el tuyo verás tus propias operaciones.', 'Importar no juzga tus operaciones: solo las apunta por ti.'],
    hazlo: { tab: 'diario', boton: 'Ir al Diario', texto: 'Exporta tu historial desde MT4 o MT5 y súbelo en «Importar operaciones del bróker».' },
  },
  {
    id: 'h-cot',
    apps: ['swing'],
    titulo: 'El COT: cómo apuestan los fondos grandes',
    que: 'El informe oficial semanal de la CFTC: si los fondos especulativos están comprados o vendidos en cada divisa.',
    video: { archivo: 'h-cot', desc: 'Video con voz: la tarjeta del COT en el Barrido, con la barra de cada divisa y la fecha del informe.' },
    noDice: ['Que los fondos estén comprados no dice que el precio vaya a subir: esta app lo midió como filtro y no ayudó.', 'Es semanal y llega con varios días de retraso.'],
    hazlo: { tab: 'barrido', boton: 'Ir al Barrido', texto: 'Abre la tarjeta del COT y mira de qué fecha es el informe.' },
  },
])

/** Las herramientas que tiene esta app, en orden. */
export function herramientasDe(app) {
  return HERRAMIENTAS.filter((h) => h.apps.includes(app))
}
