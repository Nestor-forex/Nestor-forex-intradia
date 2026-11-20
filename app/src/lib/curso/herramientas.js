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
    video: { archivo: 'h-barrido', desc: 'Video sin voz: el Barrido con los datos reales del día de la grabación. La fuerza de las 8 divisas, de 0 a 10, y la lista de pares con su tendencia y su RSI.' },
    noDice: ['Que una divisa esté fuerte no dice que vaya a seguir fuerte mañana.', 'Si un par lleva una dirección al lado, es la de un experimento que la app mide: no una señal para copiar.'],
    hazlo: { tab: 'barrido', boton: 'Ir al Barrido', texto: 'Mira qué divisa está arriba y cuál abajo, y busca un par que lleve las dos.' },
  },
  {
    id: 'h-analizador',
    apps: ['swing', 'intradia'],
    titulo: 'El Analizador, paso a paso',
    que: 'Junta todas las herramientas para el par y la dirección que TÚ elijas, y te da el Stop-loss, el Take-profit y el lote.',
    video: { archivo: 'h-analizador', desc: 'Video sin voz: los cuatro pasos del Analizador (par, dirección, cómo poner el Stop-loss y qué herramientas ver), con la tarjeta de niveles y el lote del perfil de ejemplo.' },
    noDice: ['No elige la dirección: la eliges tú.', 'Los niveles son cuentas sobre cuánto se mueve el par, no una predicción de que vaya a llegar.'],
    hazlo: { tab: 'analizar', boton: 'Ir a Analizar', texto: 'Elige un par y una dirección, prueba los tres métodos de Stop-loss y mira cómo cambia la tarjeta.' },
  },
  {
    id: 'h-rsi',
    apps: ['swing', 'intradia'],
    titulo: 'RSI: si el precio subió o bajó con mucha fuerza',
    que: 'Un número de 0 a 100 calculado con las últimas 14 velas. Por encima de 70 se suele decir que subió con mucha fuerza; por debajo de 30, que cayó con mucha fuerza.',
    video: { archivo: 'h-rsi', desc: 'Video sin voz: el RSI de un par en el Analizador, con el número del día de la grabación y lo que significa.' },
    noDice: ['Un RSI alto no dice que vaya a bajar, ni uno bajo que vaya a subir: puede seguir así mucho tiempo.'],
    hazlo: { tab: 'analizar', boton: 'Ir a Analizar', texto: 'En el paso 4, enciende «RSI» y mira el número de varios pares.' },
  },
  {
    id: 'h-atr',
    apps: ['swing', 'intradia'],
    titulo: 'ATR: cuánto se mueve el par',
    que: 'Lo que suele recorrer el par en una vela normal. De ahí salen los Stop-loss del Analizador.',
    video: { archivo: 'h-atr', desc: 'Video sin voz: el ATR de un par en el Analizador, en pips y en porcentaje, y por qué un Stop-loss más corto que el ATR lo puede tocar el movimiento normal.' },
    noDice: ['El ATR no dice hacia dónde irá el precio: solo cuánto se mueve.'],
    hazlo: { tab: 'analizar', boton: 'Ir a Analizar', texto: 'Enciende «ATR» y compara un par tranquilo con uno que se mueve mucho.' },
  },
  {
    id: 'h-medias',
    apps: ['swing', 'intradia'],
    titulo: 'Medias móviles (SMA y EMA)',
    que: 'El precio promedio de las últimas velas. La EMA da más peso a las más recientes. Sirven para ver la tendencia de un vistazo.',
    video: { archivo: 'h-medias', desc: 'Video sin voz: las medias móviles de un par en el Analizador, con sus valores del día de la grabación y a qué distancia está el precio de cada una.' },
    noDice: ['Que el precio esté por encima de una media dice lo que ya pasó, no que vaya a seguir subiendo.'],
    hazlo: { tab: 'analizar', boton: 'Ir a Analizar', texto: 'Enciende «Medias móviles» y mira si el precio está por encima o por debajo de cada una.' },
  },
  {
    id: 'h-bollinger',
    apps: ['swing', 'intradia'],
    titulo: 'Bandas de Bollinger y el %B',
    que: 'Una media de 20 velas con una banda arriba y otra abajo. El %B dice dónde está el precio entre las dos: 0 es la de abajo, 1 la de arriba.',
    video: { archivo: 'h-bollinger', desc: 'Video sin voz: las bandas de Bollinger de un par en el Analizador, con sus tres líneas y el %B del día de la grabación.' },
    noDice: ['Que el precio toque una banda no dice que vaya a darse la vuelta.'],
    hazlo: { tab: 'analizar', boton: 'Ir a Analizar', texto: 'Enciende «Bollinger (%B)» y busca un par con el %B cerca de 0 o de 1.' },
  },
  {
    id: 'h-calendario',
    apps: ['swing', 'intradia'],
    titulo: 'El calendario económico',
    que: 'Las noticias que pueden mover el precio en las próximas 48 horas, con su divisa, su hora y cuánto suelen mover.',
    video: { archivo: 'h-calendario', desc: 'Video sin voz: la tarjeta del calendario en el Barrido y el botón «¿Qué significa?», que explica cada noticia en palabras sencillas.' },
    noDice: ['Dice CUÁNDO puede haber sacudida, nunca hacia dónde.'],
    hazlo: { tab: 'barrido', boton: 'Ir al Barrido', texto: 'Abre «Calendario económico» y toca «¿Qué significa?» en una noticia.' },
  },
  {
    id: 'h-tasas',
    apps: ['swing', 'intradia'],
    titulo: 'Tasas de interés y swap',
    que: 'Las tasas de los 8 bancos centrales, y de qué lado suele jugar el swap: lo que se paga o se cobra cada noche que la operación sigue abierta.',
    video: { archivo: 'h-tasas', desc: 'Video sin voz: la tarjeta de tasas en el Barrido, con la diferencia de tasas de cada par y la fecha de cada dato.' },
    noDice: ['La diferencia de tasas no es tu swap: tu bróker le suma un margen que no publica nadie.'],
    hazlo: { tab: 'barrido', boton: 'Ir al Barrido', texto: 'Abre «Tasas de interés y swap» y busca el par con la mayor diferencia.' },
  },
  {
    id: 'h-spread',
    apps: ['swing', 'intradia'],
    titulo: 'Lo que cuesta abrir: spread y actividad',
    que: 'El spread real de cada par y cuántas veces cambió el precio hoy, con los precios de una cuenta real del desarrollador.',
    video: { archivo: 'h-spread', desc: 'Video sin voz: la tarjeta «Lo que cuesta abrir la operación», con el precio de compra y de venta, el spread y la actividad de cada par.' },
    noDice: ['El spread y la actividad son los de una cuenta real del desarrollador: los de tu bróker pueden ser otros.', 'La actividad no es volumen ni dice hacia dónde: dice dónde hay gente ahora mismo.'],
    hazlo: { tab: 'barrido', boton: 'Ir al Barrido', texto: 'Busca «Lo que cuesta abrir la operación» y compara el spread de EUR/USD con el de un cruce.' },
  },
  {
    id: 'h-cot',
    apps: ['swing'],
    titulo: 'El COT: cómo apuestan los fondos grandes',
    que: 'El informe oficial semanal de la CFTC: si los fondos especulativos están comprados o vendidos en cada divisa.',
    video: { archivo: 'h-cot', desc: 'Video sin voz: la tarjeta del COT en el Barrido, con la barra de cada divisa y la fecha del informe.' },
    noDice: ['Que los fondos estén comprados no dice que el precio vaya a subir: esta app lo midió como filtro y no ayudó.', 'Es semanal y llega con varios días de retraso.'],
    hazlo: { tab: 'barrido', boton: 'Ir al Barrido', texto: 'Abre la tarjeta del COT y mira de qué fecha es el informe.' },
  },
])

/** Las herramientas que tiene esta app, en orden. */
export function herramientasDe(app) {
  return HERRAMIENTAS.filter((h) => h.apps.includes(app))
}
