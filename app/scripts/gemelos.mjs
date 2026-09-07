// QUÉ ARCHIVOS TIENEN QUE SER IGUALES EN LAS DOS APPS.
//
// ─────────────────────────────────────────────────────────────────────────
// EL PROBLEMA QUE RESUELVE
// ─────────────────────────────────────────────────────────────────────────
// Nestor Forex Swing y Nestor Forex Intradía viven en repositorios separados
// y son casi idénticas por dentro. Eso significa que cada arreglo hay que
// hacerlo DOS VECES, y cuando se olvida una, las dos apps se separan **en
// silencio**: nada falla, nada avisa, y la diferencia solo aparece meses
// después cuando alguien la busca.
//
// Ya pasó de verdad, varias veces:
//
//   · El ícono de arranque de la PWA apuntaba a la raíz del dominio en vez de
//     a la app. Se arregló en una y la otra tenía el mismo error.
//   · La pantalla de detalle de la señal se hizo primero en Intradía y hubo
//     que portarla a mano.
//   · La llave de Twelve Data se sacó de un repositorio y siguió publicada en
//     el otro — y era la MISMA llave, así que no sirvió de nada hasta
//     hacerlo en los dos.
//   · Y hasta un cierre de etiqueta que quedó en otra línea sin ninguna razón,
//     solo porque alguien editó una app y no la otra.
//
// ─────────────────────────────────────────────────────────────────────────
// CÓMO LO RESUELVE
// ─────────────────────────────────────────────────────────────────────────
// `prueba-gemelos.mjs` compara esta lista contra el otro repositorio y falla
// si alguno difiere aunque sea en un carácter.
//
// ⚠️ LA LISTA VA ESCRITA A MANO, Y ESO ES DELIBERADO. Sería más cómodo
// calcularla («todos los que hoy son iguales»), y sería inútil: en cuanto dos
// archivos se separaran, saldrían solos de la lista y la prueba seguiría en
// verde. Una prueba que se adapta a lo que encuentra no comprueba nada.
//
// PARA AÑADIR UN GEMELO: ponlo en la lista y haz que los dos archivos sean
// idénticos. Si no puedes, es que no es un gemelo — va en PRIMOS, con su
// motivo escrito.

// ─────────────────────────────────────────────────────────────────────────
// GEMELOS: idénticos carácter por carácter, en los dos repositorios.
// ─────────────────────────────────────────────────────────────────────────
export const GEMELOS = [
  // El armazón de la app: sesión, miembros, idioma, avisos, calculadora.
  // Nada de esto depende de si se opera en velas de un día o de una hora.
  'src/main.jsx',
  'src/components/Auth.jsx',
  'src/components/AvisosCard.jsx',
  'src/components/BarraFuerza.jsx',
  'src/components/BottomNav.jsx',
  'src/components/CalculadoraTab.jsx',
  'src/components/CargandoApp.jsx',
  'src/components/DiarioTab.jsx',
  'src/components/Glosario.jsx',
  // Leer el informe del broker y meterlo en el Diario. Es identico en las dos
  // apps a proposito: el formato de MT4/MT5 no sabe nada de si se opera en
  // velas de un dia o de una hora, y los pares que cada app acepta se le pasan
  // por parametro (`conocidos`) en vez de estar escritos dentro.
  'src/components/ImportarBroker.jsx',
  'src/lib/importarOperaciones.js',
  'src/components/Header.jsx',
  'src/components/MiembrosTab.jsx',
  'src/components/Pendiente.jsx',
  'src/components/RedDeSeguridad.jsx',
  'src/components/SelectorIdioma.jsx',
  'src/components/Sparkline.jsx',
  'src/lib/authErrors.js',
  'src/lib/calc.js',
  'src/lib/display.js',
  'src/lib/firebase.js',
  'src/lib/format.js',
  'src/lib/i18n/crearT.js',
  'src/lib/i18n/idiomas.js',
  'src/lib/i18n/index.jsx',
  'src/lib/push/index.js',
  'src/lib/push/soporte.js',
  'src/lib/push/vapid.js',
  'src/lib/useAuthUser.js',
  'src/lib/useMembers.js',
  'scripts/lib/firestore-rest.mjs',
  'scripts/prueba-aviso-real.mjs',
  'scripts/prueba-importar.mjs',
  // El barrido de liquidez. Es identico a proposito: el patron —perforar un
  // extremo anterior y cerrar de vuelta dentro— no sabe si la vela es de un
  // dia o de una hora. Lo que SI cambia entre apps es cuantas velas atras se
  // mira, y eso se pasa por parametro desde cada backtest, no se escribe aqui.
  'scripts/lib/patrones.mjs',
  'scripts/prueba-barrido-liquidez.mjs',
  // El comparador de los 13 diccionarios. La memoria daba por hecho que
  // existia y no existia en ninguna de las dos apps: se hizo a mano una vez y
  // no se guardo. Ahora esta, y en las dos.
  'scripts/prueba-idiomas.mjs',
  // La copia de seguridad del historial. Identica a proposito y con mas razon
  // que ninguna: no contiene ni un numero de trading —solo cuenta lineas y
  // avisa si el archivo encogio— y protege el MISMO activo irremplazable en
  // las dos apps. Si un dia divergen, es que alguien arreglo la alarma en una
  // sola, que es exactamente el fallo que la lista de gemelos existe para
  // cazar.
  'scripts/lib/respaldo.mjs',
  'scripts/respaldo-historial.mjs',
  'scripts/prueba-respaldo.mjs',
]

// ─────────────────────────────────────────────────────────────────────────
// PRIMOS: se parecen, pero DEBEN diferir. El motivo va escrito.
// ─────────────────────────────────────────────────────────────────────────
//
// Esta lista no la comprueba nadie: es documentación. Está aquí para que
// nadie «arregle» una diferencia que existe por una buena razón — y para que
// quien vea dos archivos parecidos sepa si la diferencia es intencionada o un
// descuido.
//
// ⚠️ LA REGLA DE ORO DE ESTE PROYECTO: **lo que se mide en una app no vale
// para la otra.** Son casi idénticas por dentro y por eso es facilísimo colar
// un número prestado. El filtro de RSI mejora los resultados en Intradía y los
// empeora en Swing; está medido. Unificar umbrales sería el peor error posible
// aquí.
export const PRIMOS = {
  'src/components/ClimaMercado.jsx':
    'El clima del par (idea tomada de Visual Trader). El DIBUJO es el mismo, ' +
    'pero los umbrales NO pueden serlo: un ATR del 1.2% es tormenta en velas ' +
    'diarias y seria un terremoto en velas de una hora. Por eso vive solo en ' +
    'Swing hasta que se elijan los umbrales de intradia MIRANDO SUS DATOS, no ' +
    'copiando estos. Es la regla de siempre: lo medido en una app no vale en la otra.',

  'src/lib/medicion.js':
    'Los numeros del banco de pruebas que la app ensena en pantalla. Son de ' +
    'ESTA app y de nadie mas: ensenar aqui los de la hermana seria mentir con ' +
    'numeros verdaderos, que es la peor clase de mentira.',

  'src/lib/marketCalc.js':
    'El corazón de cada app. Swing usa EMA20/50 sobre velas diarias; Intradía ' +
    'EMA9/21 sobre velas de una hora, más pivotes de sesión y modo rango. ' +
    'Distintos a propósito y medidos por separado.',
  'src/lib/pairs.js':
    'Intradía opera 18 pares y Swing 14 (Intradía añade AUD/JPY, NZD/JPY, ' +
    'AUD/NZD y EUR/GBP).',
  'src/lib/identidad.js':
    'Justo el archivo que las distingue: nombre, prefijo de almacenamiento y ' +
    'clave de la app para los avisos. Tres líneas, y el resto igual.',
  'src/sw.js':
    'Lleva el nombre visible de la app en el aviso que llega al celular, y la ' +
    'ruta donde está publicada cada una.',
  'src/App.jsx':
    'Cada app tiene sus pestañas y su splash. Comparten casi todo el estado, ' +
    'pero no las pantallas.',
  'src/components/TableroCompleto.jsx':
    'Intradía enseña sesión, pivotes y modo rango; Swing no los tiene.',
  'src/components/BarridoTab.jsx':
    'Mismo motivo: los datos que hay para enseñar no son los mismos.',
  'src/components/SetupDetalle.jsx':
    'Intradía dibuja la línea del pivote; el barrido diario de Swing no lo ' +
    'calcula. Y el pie habla de horas en una y de días en la otra.',
  'src/components/HistorialTab.jsx':
    'En Intradía los cruces se derivan y hay que separar las cuentas fiables ' +
    'de las aproximadas; en Swing los 14 pares se piden directos y esa ' +
    'advertencia sobra.',
  'src/lib/useMarketData.js':
    'Cada una lee el barrido de la rama `datos` de SU repositorio.',
  'src/lib/useHistorial.js': 'Lo mismo: cada una lee su propio historial.',
  'src/lib/useTrades.js':
    'El diario guarda campos algo distintos según el horizonte de la operación.',
  'src/lib/historialCalc.js':
    'Intradía separa exactas de aproximadas por lo de los cruces derivados.',
  'src/lib/reporte.js': 'El .md descargable habla de días o de horas.',
  'src/lib/fakeData.js': 'Datos de mentira, propios de cada app.',
  'src/lib/i18n/textos/*.js':
    'Los 13 diccionarios. Comparten el armazón pero cada app tiene sus ' +
    'pantallas y sus explicaciones. Unos 250 textos cada uno.',
  'scripts/make-icons.mjs':
    'El ícono de Swing es verde y el de Intradía ámbar, para poder ' +
    'distinguirlas en la pantalla de inicio del teléfono.',
  'scripts/vigia.mjs':
    'El de Swing corre una vez al día y publica el barrido; el de Intradía ' +
    'corre cada hora. Y lo que anotan no es lo mismo.',
  'scripts/backtest.mjs':
    'Cada uno mide las reglas de SU app. Nunca deben igualarse: ver la regla ' +
    'de oro de arriba.',
  'scripts/lib/backtest-nucleo.mjs':
    'Intradía cuenta el swap por los cortes reales de las 22:00 UTC (depende ' +
    'de la hora de entrada); en Swing cada vela ES un día y las noches salen ' +
    'solas.',
  'scripts/lib/costes.mjs':
    'Los spreads de los 18 pares de Intradía contra los 14 de Swing, más el ' +
    'conteo de noches que solo existe en Intradía.',
  'scripts/lib/velas.mjs':
    'Una baja velas de un día y la otra de una hora, en tandas distintas.',
  'scripts/lib/resolver.mjs':
    'Recorre velas de día o de hora, y llama a los campos por su nombre en ' +
    'cada app (`cierre`/`vela`, `diasTardados`/`velasTardadas`).',
  'scripts/lib/geometrias.mjs': 'Las geometrías medidas son distintas en cada app.',
  'scripts/lib/vigia-nucleo.mjs':
    'El identificador de una señal lleva el tipo en Intradía (que tiene modo ' +
    'rango) y no en Swing.',
  'scripts/reporte-diario.mjs': 'Cada uno arma el texto de su app.',
  'scripts/lib/push-envio.mjs':
    'Toma el nombre de la app para escribirle solo a los aparatos correctos.',
  'scripts/prueba-*.mjs':
    'Cada prueba comprueba el código de SU app. Portar una prueba entre las ' +
    'dos y que falle suele significar que las apps son distintas ahí, no que ' +
    'el código esté mal.',
}
