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
  // ⚠️ LAS REGLAS DE SEGURIDAD DE FIRESTORE, y son el gemelo más importante
  // de la lista.
  //
  // Hay UN solo proyecto de Firebase y UNAS solas reglas en vigor, pero el
  // archivo está guardado en los dos repositorios para que quien lea
  // cualquiera de los dos vea las reglas completas. Eso es cómodo y es una
  // trampa: el 2026-09-15 se apretó una regla en Swing —la que impedía que un
  // suscriptor se escribiera su propia fecha de vencimiento— y la copia de
  // Intradía se quedó con la versión vieja **diciendo en su propia cabecera
  // que era idéntica**. Quien la leyera creería que rigen unas reglas que ya
  // no rigen.
  //
  // Publicarlas las publica `scripts/publicar-reglas.mjs`, que vive solo en
  // Swing y lee SOLO la copia de Swing. Esta comprobación es lo único que
  // impide que la otra se quede atrás en silencio.
  '../firestore.rules',

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
  // Tus propios numeros partidos en grupos, y el aviso de que no son un
  // consejo. Es identico en las dos apps a proposito: el margen de una
  // proporcion es estadistica, no un umbral de mercado, y los cortes (cruce o
  // par con dolar, compra o venta) los da `pairs.js` de cada app.
  'src/lib/diagnostico.js',
  'src/components/Diagnostico.jsx',
  'scripts/prueba-diario.mjs',

  // Estacionalidad: cuánto se mueve un par según el calendario.
  //
  // GEMELO porque lo que tiene que ser igual en las dos apps es la
  // ESTADÍSTICA, no el mercado: separar el margen de una media del de una
  // proporción, no esconder las casillas flojas y no devolver ningún
  // veredicto. Qué paneles puede enseñar cada app lo decide su publicador,
  // que es PRIMO — en Swing no hay perfil por hora porque una vela ES un día.
  'src/lib/estacionalidad.js',
  'scripts/prueba-estacionalidad.mjs',
  'src/components/Glosario.jsx',
  // Qué es la app y qué NO es: que nada de lo que se ve es una señal para
  // copiar, que son experimentos, qué pasa cuando uno llega a su listón y
  // quién decide. Es gemelo porque NO nombra ninguna regla, ningún par ni
  // ningún umbral: lo que dice vale igual con velas diarias que con velas de
  // una hora. Meter aquí el nombre de un experimento sería crear una
  // divergencia esperando a ocurrir.
  'src/components/QueEsEstaApp.jsx',
  // De cuándo es el barrido que estás viendo. Gemelo el componente Y las
  // cuentas, pero NO el umbral de cuándo se pinta en ámbar: ése vive en
  // `useMarketData.js`, que es PRIMO, porque las dos apps publican con
  // cadencias distintas (Swing una vez al día, Intradía una vez por hora) y un
  // dato de 3 horas es viejo allí y normal acá. Copiar ese número de la hermana
  // sería traerse una suposición falsa, que es la lección de `barridoSwap`.
  'src/components/Frescura.jsx',
  'src/lib/frescura.js',
  'scripts/prueba-frescura.mjs',
  // Que el UMBRAL DE FUERZA viva en un SOLO sitio. Estaba escrito a mano en
  // nueve guiones aquí y trece allá (2026-10-12): el vigía, el reporte y cada
  // guion del banco de pruebas con su propia copia del número que decide TODAS
  // las señales. Nada fallaba, y por eso es gemelo: la disciplina tiene que ser
  // la misma en las dos o la lección se queda en una sola.
  //
  // ⚠️ El VALOR sí difiere en lo que importa y eso NO lo compara este archivo:
  // allá se multiplica por el factor de la hora y aquí no hay horas. La prueba
  // comprueba la disciplina (un solo sitio, nadie lo escribe a mano, la vista
  // dice el que usó); lo del factor lo comprueba cada app por su cuenta.
  'scripts/prueba-umbral.mjs',
  // Por qué el número de una regla de la sombra todavía no se puede creer:
  // cuántas operaciones reales lleva, cuántas faltan y cuánto puede moverse ese
  // porcentaje solo por casualidad. Gemelo el componente Y las cuentas, y el
  // listón de 150 operaciones es el MISMO en las dos a propósito: no es un
  // parámetro de trading, es `margen(n)`, o sea aritmética. Con 150 el margen
  // del peor caso baja de ±10 puntos con velas diarias y con velas de una hora
  // igual; lo único que cambia entre apps es cuánto se tarda en llegar.
  //
  // ⚠️ La PRUEBA no es gemela (ver PRIMOS): mira la pantalla de cada app, y
  // aquí son tres reglas de sombra y allá una.
  'src/components/AvisoSombra.jsx',
  'src/lib/sombra.js',
  // Compresión, posición en el rango y niveles de Fibonacci: la matemática.
  //
  // Es gemela porque DENTRO NO HAY UN SOLO UMBRAL —se pasan todos— y porque no
  // dice «día» ni «hora» en ninguna frase: habla de VELAS. Eso es lo que
  // permite que la misma fórmula sirva con velas diarias y con velas de una
  // hora.
  //
  // ⚠️ Y hacía falta que fuera UNA sola: la app hermana YA calculaba
  // `compresion` desde meses antes (`atrAbs / atrMedio`) y allí ese número
  // **decide señales de rango**. Escribir aquí una definición distinta con el
  // mismo nombre habría sido la etiqueta equivocada de siempre, con el
  // agravante de que una de las dos ya está moviendo señales de verdad.
  //
  // ⚠️ Lo que NO es gemelo son los UMBRALES de la tarjeta (viven en el
  // componente de cada app, que es PRIMO): un cociente de 0,70 no significa lo
  // mismo en velas de un día que en velas de una hora. Misma razón por la que
  // el clima del par nunca se unificó.
  'src/lib/compresion.js',
  'scripts/prueba-compresion.mjs',
  // ¿Esta señal va a favor o en contra del diferencial de tasas? Es gemelo
  // porque NO decide nada propio: llama a `difDePar` de `tasas.js`, que ya es
  // gemelo y lleva dentro el signo y la banda neutra. Lo que no puede haber dos
  // veces es ese CONVENIO: el día que uno de los dos se moviera, la pantalla y
  // la medición dirían cosas opuestas sin que fallara nada — el fallo del
  // umbral de fuerza en nueve sitios (2026-10-12).
  //
  // ⚠️ Y sigue en pie que **la diferencia de tasas NO es el swap**: el margen
  // del bróker no lo publica nadie y es asimétrico. Esto da el lado, no el
  // número. Eso vale igual en las dos apps, así que el archivo entero vale.
  'src/lib/carrySenal.js',
  // La cabecera de TODAS las tarjetas que se abren. Es gemela por el mismo
  // motivo por el que se extrajo: había ocho copias de la misma cabecera y
  // cada una terminaba en una flechita gris que nadie leía como un botón. Si
  // las dos apps volvieran a tener cada una la suya, volverían a separarse —
  // que es exactamente lo que este archivo existe para impedir.
  'src/components/TarjetaPlegable.jsx',
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
  'src/lib/vencimientos.js',
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
  // El calendario economico. Identico a proposito y sin margen de duda: las 8
  // divisas son las mismas en las dos apps, el feed es el mismo, y las
  // divisas se sacan de `pairs.js` de cada app en vez de escribirse aqui.
  //
  // Lo que si podria haber divergido es el filtro de impacto bajo (en velas de
  // una hora esos datos SI mueven algo) y las 48 horas de vista. Se dejo igual
  // en las dos a proposito, con el motivo escrito dentro de `calendario.js`:
  // ninguna de las dos decisiones es de trading —el calendario no apaga ni una
  // senal—, son de que se ENSENA en un telefono.
  'src/lib/calendario.js',
  'src/components/Calendario.jsx',
  'scripts/publicar-calendario.mjs',
  'scripts/prueba-calendario.mjs',
  // Las tasas de referencia de los bancos centrales. Identicos por la misma
  // razon que el calendario: son las MISMAS 8 divisas en las dos apps y la
  // misma fuente (BIS, dataflow WS_CBPOL, en CSV — elegida con la sonda del
  // 2026-09-09, no leyendo documentacion). Los pares de cada app salen de su
  // propio `pairs.js`, asi que el archivo no necesita saber en cual esta.
  //
  // ⚠️ Y NO es un numero de trading disfrazado: `UMBRAL_NEUTRO` no filtra ni
  // una senal, solo decide si la pantalla dice «apenas pesa» en vez de un
  // lado. Sale del margen tipico que el broker suma a la tasa, que es el mismo
  // broker en las dos apps.
  'src/lib/tasas.js',
  'src/components/Tasas.jsx',
  'scripts/publicar-tasas.mjs',
  'scripts/prueba-tasas.mjs',
  // El spread real del broker, via el puente de MetaTrader 5. Identicos porque
  // EL PUENTE ES UNO: `puente-mt5/bridge_mt5.py` vive en el repositorio de
  // Swing y publica los 18 pares (los 14 de Swing mas los 4 que solo usa
  // Intradia) en un solo archivo. Las dos apps leen esa MISMA direccion y cada
  // una filtra sus pares con su propio `PAIR_NAMES`. Dos puentes serian dos
  // programas que Nestor tendria que arrancar cada manana.
  'src/lib/useMT5Quotes.js',
  'src/components/CotizacionesVivo.jsx',
  // El NFX-LSS: el indicador que Nestor escribio en Pine para el concurso de
  // TradingView, traducido a JavaScript. La LOGICA es la misma en las dos apps
  // —pivotes, barrido, ruptura, stop y objetivo— y por eso es gemela; lo que
  // cambia son los NUMEROS (pivote, ventana, objetivo), y esos no viven aqui
  // dentro: se le pasan desde fuera. Es la unica forma de que la matematica
  // sea una sola sin unificar ni un umbral de trading.
  'src/lib/lss.js',
  'scripts/prueba-lss.mjs',
  // Y este mismo archivo. Es el que dice que archivos no pueden separarse, asi
  // que es el ULTIMO que puede permitirse separarse: si un dia se le anade un
  // gemelo en una app y no en la otra, la comprobacion de cada repositorio
  // estaria vigilando una lista distinta y ninguna de las dos lo diria.
  'scripts/gemelos.mjs',
  // Y la comprobación que lee esa lista, por el mismo motivo exacto. Estuvo
  // fuera de las dos listas hasta el 2026-09-21: era idéntica en las dos apps
  // por costumbre, no porque nadie lo exigiera. Si una app le añadiera una
  // comprobación y la otra no, cada repositorio estaría vigilando con un
  // rasero distinto — y el que vigila con el rasero flojo no lo diría.
  //
  // ⚠️ El comodín `scripts/prueba-*.mjs` de PRIMOS también la alcanza. GEMELOS
  // manda: lo que está nombrado a mano gana a lo que cae por un comodín. Es la
  // misma razón por la que la lista va escrita a mano y no calculada.
  'scripts/prueba-gemelos.mjs',
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
  'scripts/medir-compresion.mjs':
    'Las dos apps miden la compresion y NO miden lo mismo, porque la ' +
    'compresion no juega el mismo papel. En Swing es INFORMACION pura: no ' +
    'decide ninguna senal, asi que su guion parte las senales que ya existen ' +
    'en montones (comprimido / medio / expandido) y pregunta si unas miden ' +
    'distinto de otras, con su liston escrito antes. En Intradia la ' +
    'compresion YA DECIDE senales (`COMPRESION_MIN` rechaza las de rango), ' +
    'asi que alli la pregunta util es otra: que VALORES toma de verdad, para ' +
    'saber donde cae ese umbral dentro de la distribucion y si los cortes de ' +
    'la etiqueta estan en su sitio. Desde el 2026-10-30 por la tarde LOS DOS ' +
    'miden tambien la distribucion por par y por vela, que es la poblacion ' +
    'que la tarjeta enseña de verdad; lo que sigue siendo distinto es todo lo ' +
    'demas. Copiar cualquiera de los dos guiones al otro repositorio daria ' +
    'numeros creibles de otra pregunta.',

  'scripts/lib/compresion-dist.mjs':
    'La distribucion de la compresion por par y por vela. La pregunta es la ' +
    'misma en las dos apps y el codigo NO puede serlo, por dos razones ' +
    'medidas. (1) EL LECTOR DE VELAS: aqui devuelve `{ fechas, rates, ' +
    'rangosPar }` con los rangos indexados por NOMBRE DE PAR, porque esta app ' +
    'pide los 14 pares directos; alla devuelve `{ barras, rates, rangos }` por ' +
    'DIVISA y los cruces se derivan. Confundirlos ya costo 7 creditos en ' +
    'produccion el 2026-10-30, y cada prueba exige el contrato de SU lector. ' +
    '(2) LA VENTANA: el `atrWilder` de Swing recorre TODO lo que recibe, asi ' +
    'que hay que darle el mismo tramo que el barrido de produccion (~214 dias ' +
    'de mercado) o el numero sale distinto; el de Intradia tiene ventana DURA ' +
    'de 60 velas, asi que alli da igual. De ahi que aqui exista ' +
    '`ventanaDeProduccion` y alli no.',

  'scripts/prueba-compresion-dist.mjs':
    'La prueba de lo anterior. Comprueba el contrato del lector de SU app ' +
    '(que los nombres que la libreria lee sean los que `velas.mjs` arma, y que ' +
    'NO sean los de la hermana), asi que por construccion no puede ser la ' +
    'misma en las dos. Y aqui lleva una comprobacion que alla no tiene ' +
    'sentido: que con la serie ENTERA el numero CAMBIE, porque si no cambiara ' +
    'la ventana seria decorativa y la fidelidad saldria por casualidad.',

  'scripts/lib/preregistro-cruces.mjs':
    'El liston del corte dolar/cruces. La pregunta es la misma y los listones ' +
    'NO pueden serlo, por donde salio cada uno. En Swing el corte se encontro ' +
    'MIRANDO los resultados (2026-10-21) y el liston se escribio despues para ' +
    'juzgarlo; en Intradia no se ha mirado nunca, asi que alli se puede hacer ' +
    'lo que aqui era imposible: FIJAR LA DIRECCION de antemano, y `juzgar()` ' +
    'se niega a dar por bueno el monton que no se predijo. Ademas el reparto ' +
    'de pares es distinto —7 y 7 aqui, 7 y 11 alla— asi que el criterio de ' +
    'señales va en numero absoluto aqui (derivado de ~36 al mes) y en FRACCION ' +
    'alla; copiar el 15 habria sido traerse una suposicion sobre otra app, que ' +
    'es el fallo de `barridoSwap`. Y alla se añade que la app seguiria ' +
    'perdiendo aunque el corte pasara, porque parte de -0,13 y no de -0,040.',

  'src/lib/senalesSombra.js':
    'Agrupa lo que el vigia ya anoto de las reglas en pruebas. La idea es la ' +
    'misma y el agrupamiento NO puede serlo: en Swing cada vela ES un dia, asi ' +
    'que agrupa por `cierre` ("2026-10-15") y agrupar por dia o por vela es lo ' +
    'mismo. En Intradia cada vela es una HORA y las senales traen `vela` ' +
    '("2026-10-15 22:00:00"): agrupar por dia meteria hasta 24 velas en el ' +
    'mismo monton y perderia justo lo que esa app mide. Copiar el de Swing ' +
    'leeria un campo que alli no existe y dejaria la tarjeta vacia SIN DAR ' +
    'NINGUN ERROR. Ademas Intradia tiene que convertir ese timestamp a UTC a ' +
    'mano (`aFechaUTC`), porque viene sin zona y `new Date()` lo leeria como ' +
    'hora local: cinco horas corridas en Colombia.',

  'src/components/SenalesSombra.jsx':
    'La tarjeta de esas senales. Tres diferencias reales, no de estilo. Una: ' +
    'Swing enseña cuatro reglas de sombra y Intradia UNA (la reversion, ' +
    '«comprar la caida» y la ruptura estan medidas en Intradia y pierden). ' +
    'Dos: alli el grupo lleva solo la fecha y aqui tiene que llevar la HORA, ' +
    'porque el retroceso de las 22:00 y el de las 09:00 son operaciones ' +
    'distintas en sesiones distintas. Tres: la marca de «geometria vieja» solo ' +
    'existe en Swing, donde «comprar la caida» se anoto dos meses con la ' +
    'geometria equivocada; en Intradia marcaria en falso, que es el defecto ' +
    'que alla salio mirando la captura.',

  'scripts/prueba-senales-sombra.mjs':
    'La comprobacion de lo anterior, que por lo de arriba tampoco puede ser ' +
    'gemela. En Intradia vigila ademas dos cosas que en Swing no existen: que ' +
    'NO se lea `cierre` (el campo de la app hermana, que alli no existe), y ' +
    'que la hora se lea como UTC. Esa segunda corre en un proceso aparte con ' +
    'la zona forzada a Bogota, y no por gusto: la primera version la ' +
    'comprobaba en la zona de la maquina —que es UTC— y NO MORDIA, con el ' +
    'fallo puesto a proposito las 44 comprobaciones seguian en verde.',

  'scripts/lib/lss-banco.mjs':
    'El adaptador que lleva las senales del NFX-LSS al banco de pruebas. La ' +
    'logica es gemela; ESTO no puede serlo por dos razones de peso. Primera: ' +
    'cada app guarda las velas distinto —Swing por PAR y ya exactas, Intradia ' +
    'por DIVISA y hay que reconstruir los pares, cuatro de ellos invirtiendo—. ' +
    'Segunda, y es la que decide el numero: Intradia DERIVA los once cruces, y ' +
    'una mecha derivada sale mas ancha de lo real, asi que fabricaria barridos ' +
    'que nunca ocurrieron. Por eso alli se miden solo los 7 pares directos. ' +
    'Ademas el resolver de cada app espera un campo distinto: `cierre` en ' +
    'Swing y `vela` en Intradia.',

  'scripts/prueba-lss-banco.mjs':
    'La comprobacion del adaptador, que por lo de arriba tampoco puede ser ' +
    'gemela. En Intradia prueba ademas algo que en Swing no existe: que al ' +
    'INVERTIR una cotizacion el maximo pase a ser el inverso del minimo. Si ' +
    'eso se confunde, las velas quedan del reves, todos los barridos se ' +
    'detectan al reves y el resultado es basura creible.',

  'src/components/Compresion.jsx':
    'La tarjeta de compresion. Difiere en DOS cosas y las dos son medidas, no ' +
    'de estilo. (1) Aqui lleva Fibonacci y las velas estrechas seguidas; alla ' +
    'NO, porque su barrido no publica el maximo y el minimo de CADA vela y sin ' +
    'eso no se puede saber cual de los dos extremos vino DESPUES — los niveles ' +
    'de retroceso se dibujarian al reves. Y publicarlos tampoco vale: en sus 11 ' +
    'cruces los extremos se DERIVAN de los dos pares contra el dolar, y eso dio ' +
    'un ATR un 400 % mayor del real (2026-08-09). (2) Alla la compresion DECIDE ' +
    'senales de rango (COMPRESION_MIN) y aqui no decide nada, asi que su tarjeta ' +
    'lo rotula y esta no: presentarlas igual afirmaria algo falso en una de las ' +
    'dos. La MATEMATICA si es gemela (src/lib/compresion.js); los UMBRALES de la ' +
    'etiqueta viven en marketCalc.js, que es PRIMO, porque un cociente de 0.90 ' +
    'no significa lo mismo en velas de un dia que en velas de una hora.',

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
    'Cada una lee el barrido de la rama `datos` de SU repositorio. Y desde el ' +
    '2026-10-07 lleva además `HORAS_VIEJO`, el umbral de frescura, que es ' +
    'distinto a propósito: 26 en Swing (vigía diario) y 2 en Intradía (vigía ' +
    'por hora).',
  'scripts/prueba-sombra.mjs':
    'Las cuentas y el componente SÍ son gemelos; la prueba no, porque mira la ' +
    'PANTALLA de cada app: en Swing hay tres reglas en la sombra (reversión, ' +
    'comprar la caída y ruptura de estructura) y en Intradía una (el ' +
    'retroceso). Y solo la de Swing puede comparar el listón de 150 ' +
    'operaciones contra `preregistro-lss.mjs`, que allá existe y acá no; ' +
    'como `sombra.js` es GEMELO, esa comprobación cubre a las dos.',
  'scripts/prueba-cableado.mjs':
    'Comprueba que todo lo que `App.jsx` le pide al hook, el hook lo ' +
    'devuelva, y que lo que `derivarVista` calcula o llegue a la pantalla o ' +
    'esté en una lista con el motivo escrito. El bloque general es idéntico; ' +
    'las claves concretas y la regla de sombra que cada app esconde no lo ' +
    'son, y por eso no puede ser gemelo.',
  'src/lib/useCalendario.js':
    'Mismo motivo: cada app publica y lee SU propio calendario. El contenido ' +
    'es el mismo —las 8 divisas coinciden— pero si Intradía leyera el archivo ' +
    'de Swing, un fallo del workflow de Swing la dejaría sin calendario y ' +
    'nadie sabría por dónde buscar. Bajar el feed no cuesta ni un crédito, ' +
    'así que la independencia sale gratis. Y la clave de la caché lleva el ' +
    'prefijo de cada app (`clave()`).',
  'src/lib/useTasas.js':
    'Mismo motivo que `useCalendario.js`: cada app publica y lee SU propio ' +
    'archivo de tasas. El contenido es idéntico —las 8 divisas son las ' +
    'mismas— pero si Intradía leyera el de Swing, un fallo del workflow de ' +
    'Swing la dejaría sin tasas y nadie sabría dónde buscar. Bajar el CSV del ' +
    'BIS no cuesta ni un crédito de Twelve Data, así que la independencia ' +
    'sale gratis. Y la clave de la caché lleva el prefijo de cada app.',
  'scripts/prueba-mt5.mjs':
    'La de Swing tiene un bloque 7 que abre `puente-mt5/bridge_mt5.py` y ' +
    'comprueba que sus símbolos sean exactamente los que usan las dos apps. ' +
    'Aquí no puede estar: el puente vive en un solo sitio, el repositorio de ' +
    'Swing. ⚠️ Si Intradía cambia sus pares, hay que tocar `SYMBOLS` en el ' +
    'puente Y la lista escrita a mano de ese bloque — esta comprobación no lo ' +
    'caza, y por eso queda dicho aquí.',
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
  'scripts/lib/barrido-publicado.mjs':
    'Cada app publica lo suyo: Intradía manda `horaUltima` y `factorHora` (sin ' +
    'ellos la sesión se calcularía con el reloj del teléfono) y Swing manda ' +
    '`correl`, que la app no puede recalcular con solo 20 cierres. Y las ' +
    'series que se quitan tampoco son las mismas. ⚠️ Swing lo extrajo el ' +
    '2026-09-22: hasta ese día la lógica vivía EN LÍNEA dentro de `vigia.mjs`, ' +
    'o sea sin forma de probarla sin red ni créditos — y por eso llevaba desde ' +
    'el 2026-08-09 publicando sin una sola comprobación mientras la hermana sí ' +
    'la tenía. Un archivo que falta ENTERO en una app no lo caza el detector ' +
    'de duplicados sin clasificar: ése solo mira lo que está en las dos.',
  'scripts/lib/resolver.mjs':
    'Recorre velas de día o de hora, y llama a los campos por su nombre en ' +
    'cada app (`cierre`/`vela`, `diasTardados`/`velasTardadas`).',
  'scripts/lib/geometrias.mjs': 'Las geometrías medidas son distintas en cada app.',
  'scripts/lib/vigia-nucleo.mjs':
    'El identificador de una señal lleva el tipo en Intradía (que tiene modo ' +
    'rango) y no en Swing.',
  'src/components/Estacionalidad.jsx':
    'Intradia tiene panel por HORA y Swing no, porque alli una vela ES un dia. Y los 11 ' +
      'cruces de Intradia salen sin panel mensual de recorrido, asi que su tarjeta ensena ' +
      'dos tramos de datos distintos (7 meses de velas H1 y ~14 anos de diarias) en vez de ' +
      'uno. La matematica, `src/lib/estacionalidad.js`, si es GEMELA.',
  'src/lib/useEstacionalidad.js':
    'Cada app lee SU archivo, igual que `useCalendario`: el contenido no es el mismo, y ' +
      'aunque lo fuera, si una leyera el archivo de la otra un fallo del workflow de la ' +
      'hermana la dejaria sin tarjeta y nadie sabria donde buscar.',
  'scripts/publicar-estacionalidad.mjs':
    'Swing necesita UNA descarga (velas diarias: de ahi salen el perfil por dia y los dos ' +
      'paneles por mes) e Intradia DOS (H1 para hora y dia, diarias para los meses). Ademas ' +
      'Intradia pide 7 simbolos y DERIVA los 11 cruces, asi que sus cruces salen sin panel ' +
      'mensual de recorrido: derivar un maximo y un minimo en velas diarias dio un ATR 400 % ' +
      'mayor del real (2026-08-09). Y en Swing no hay perfil por hora: una vela ES un dia.',
  'scripts/publicar-barrido.mjs':
    'Mismo nombre y mismo trabajo, y todo lo demás distinto. Intradía publica ' +
    'velas de una HORA ya cerradas —que no se mueven— cada hora y por 7 ' +
    'créditos; Swing publica una vela de DÍA que va a medias, dos veces al día ' +
    'y por 14. De ahí salen un comentario de cabecera entero sobre la vela en ' +
    'curso que allá no aplica, y una línea de log que la mide. ⚠️ Y el motivo ' +
    'de NO meterlo en el vigía tampoco es el mismo: allá es no duplicar avisos ' +
    'ni señales dentro de la misma hora; aquí es que `vistoEl` va a DÍA, así ' +
    'que dos corridas del vigía el mismo día partirían el historial en dos ' +
    'mitades que no se podrían comparar entre sí.',
  'scripts/reporte-diario.mjs': 'Cada uno arma el texto de su app.',
  'scripts/lib/lineas-reporte.mjs':
    'Las líneas que explican por qué hay o no hay señales. El texto es de cada app y además dicen cosas distintas: en Swing hay un lado PAUSADO que hay que nombrar y el umbral es fijo; en Intradía el umbral cambia con la hora y el MODO RANGO da señales sin pasar por él, así que ahí la frase habla de «señales de tendencia». Lo que sí es igual, y lo vigila `prueba-umbral.mjs` (GEMELO): ninguna de las dos afirma «no hay señales» sin que se le haya dicho si hay señales.',
  'scripts/lib/push-envio.mjs':
    'Toma el nombre de la app para escribirle solo a los aparatos correctos.',
  'scripts/prueba-*.mjs':
    'Cada prueba comprueba el código de SU app. Portar una prueba entre las ' +
    'dos y que falle suele significar que las apps son distintas ahí, no que ' +
    'el código esté mal.',

  // Los tres de abajo estaban duplicados y no figuraban en NINGUNA de las dos
  // listas (encontrado el 2026-09-21). Los tres difieren por buenas razones,
  // así que su sitio es éste — pero mientras estuvieron fuera, nadie podía
  // saber si esa diferencia era a propósito o un despiste.
  'src/components/Splash.jsx':
    'La portada recorta una zona distinta de la misma ilustración: Swing se ' +
    'queda con el globo y las velas, Intradía con el panel de gráfico y el ' +
    'RSI. Son dos recortes de la misma imagen, no dos versiones de un código.',
  'vite.config.js':
    'El manifest de la PWA: nombre, nombre corto y descripción de CADA app. ' +
    'Y el `base` del que se derivan `start_url` y `scope`, que es el nombre ' +
    'de cada repositorio.',
  'src/lib/push/pausa.js':
    'Por qué están pausadas las ventas. La decisión es la misma; la PRUEBA no: ' +
    'en Swing es el banco sobre 219 días y en Intradía son las 6 señales ' +
    'reales que dio la app. Igualar el texto sería atribuirle a una app la ' +
    'evidencia de la otra.',
}
