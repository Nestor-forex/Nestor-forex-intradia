// EL LISTÓN PARA SUBIR DE TEMPORALIDAD EL NFX-LSS — escrito el 2026-09-29,
// ANTES de correr la medición de H4 ni una sola vez.
//
// ─────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE ESTA PREGUNTA
// ─────────────────────────────────────────────────────────────────────────
// Néstor lo propuso: «ya lo probamos en H1 y no funcionó, pero quiero que
// probemos con temporalidades MÁS ALTAS a ver cómo nos sale».
//
// Y los tres puntos que ya había le daban la razón, en las dos columnas:
//
//   temporalidad        NFX-LSS completo    CONTROL: solo la ruptura
//   15 min (Intradía)        −0,16                  −0,15
//   1 hora (Intradía)        −0,14                  −0,10
//   1 día  (Swing)           −0,08                  +0,02
//
// ⚠️⚠️ PERO ESOS TRES PUNTOS NO SON COMPARABLES ENTRE SÍ, y eso no se dijo
// cuando se midieron. Entre el H1 y el diario cambian CUATRO cosas a la vez:
//
//                        Intradía (M15, H1)      Swing (diario)
//   pares                 7 directos              14
//   pivote                4 velas                 8 velas
//   ventana del barrido   6                       15
//   temporalidad          la que se quería medir   ídem
//
// O sea que «subir la temporalidad mejora» podría ser en realidad «los 14
// pares de Swing con pivote 8 son mejores». No hay forma de separarlo con lo
// que hay.
//
// 📌 POR ESO H4 ES LA MEDICIÓN QUE VALE: sale de REAGRUPAR la descarga de H1
// que el banco ya paga, en la MISMA app, con los MISMOS 7 pares, los MISMOS
// parámetros y los MISMOS días. Lo único que cambia es el tamaño de la vela.
// Cuesta cero créditos y es el único punto que aísla el efecto.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ LA TRAMPA QUE ESTO TIENE QUE DISTINGUIR, Y ES LA RAZÓN DE SER DEL LISTÓN
// ─────────────────────────────────────────────────────────────────────────
// El 2026-09-28, midiendo la app en velas de 15 minutos, salió esto: pierde el
// DOBLE que en velas de una hora **acertando exactamente igual, 49 % en las
// dos**. Con la vara neutra 1:1 eso solo puede significar una cosa — la
// diferencia no estaba en acertar la dirección, estaba en **lo que cuesta
// operar**. Al bajar de temporalidad el stop se encoge y el spread no.
//
// Ese mismo mecanismo, al revés, explicaría el gradiente de arriba SIN que la
// regla acierte ni una vez más: subir de temporalidad agranda el stop, el
// spread pesa menos, y el número mejora. Sería **pagar menos peaje por la
// misma no-ventaja**.
//
// Y se distingue mirando el resultado SIN COSTES:
//
//   · si sin costes también mejora al subir → la regla funciona mejor con
//     velas grandes, y hay algo que perseguir;
//   · si sin costes está plano y solo mejora con costes → es el peaje, y subir
//     más solo lo estira.
//
// Por eso la columna «sin costes» se añadió a las tres tablas del LSS en el
// mismo cambio. Hasta ahora NINGUNA la imprimía — comprobado en el código — así
// que esta distinción no se podía hacer.
export const FECHA_PREREGISTRO = '2026-09-29'

// La vara con la que se decide, la de siempre: objetivo y stop a la misma
// distancia y el spread por par descontado.
export const VARA = 'neutra 1:1, spread por par descontado'

// ⚠️ A H4 SE LE PASAN LOS MISMOS PARÁMETROS QUE A H1 (pivote 4, ventana 6), no
// los escalados por reloj. Y es deliberado, al revés que en la medición de M15.
//
// El motivo es aritmético, no de gusto: escalar por reloj hacia ARRIBA dividiría
// el pivote entre 4 y daría 1, que no es un pivote —hacen falta velas a los dos
// lados—. Así que «el mismo reloj» no existe en esta dirección.
//
// Y además «los mismos parámetros» es justo lo que significa subir de
// temporalidad en la práctica: alguien coge su indicador tal como lo tiene y lo
// aplica a velas más grandes. Eso es lo que Néstor está preguntando.
//
// 📌 Consecuencia que hay que decir al leer la tabla: en H4 el pivote de 4
// velas son 16 HORAS de mercado y en H1 son 4. No es el mismo patrón visto más
// grande; es un patrón más lento. Decir «mismos parámetros» sin decir esto sería
// una etiqueta equivocada, y aquí eso es un error de medición.
export const MISMOS_PARAMETROS = Object.freeze({ swingLen: 4, sweepWindow: 6 })

// Mínimo de operaciones. H4 tiene la CUARTA PARTE de velas que H1, así que
// tendrá bastante menos señales, y el listón tiene que exigir que queden
// suficientes para decir algo. Con 150 el margen del peor caso es ±8 puntos.
export const OPS_MINIMAS = 150

// Cuánto puede aportar el par que más aporte. Con solo 7 pares directos este
// tope es más fácil de tocar que con 14 o 18, y aun así se mantiene: si uno
// solo pone casi la mitad, lo medido es ese par.
export const TOPE_UN_PAR = 0.4

// ─────────────────────────────────────────────────────────────────────────
// LOS SEIS CRITERIOS. Todos obligatorios.
// ─────────────────────────────────────────────────────────────────────────
export const CRITERIOS = Object.freeze([
  {
    clave: 'ops',
    dice: `al menos ${OPS_MINIMAS} operaciones resueltas`,
    porque: 'H4 tiene la cuarta parte de velas que H1; sin esto el margen se come la diferencia',
  },
  {
    clave: 'gana',
    dice: 'por 1R mayor que cero con los costes puestos',
    porque: 'una regla que pierde no es un hallazgo, por mucho que pierda menos que en H1',
  },
  {
    clave: 'mitades',
    dice: 'gana en las DOS mitades del periodo',
    porque: 'es el criterio que el ADX no pasó: un número bueno en una sola mitad no es una mejora',
  },
  {
    clave: 'mejorQueH1',
    dice: 'mejor que la MISMA regla en H1, mismos pares, mismos días, mismos parámetros',
    porque: 'sin esto no hay gradiente por temporalidad, que es lo que se estaba preguntando',
  },
  {
    clave: 'noEsSoloPeaje',
    dice: 'la mejora sobre H1 también aparece SIN costes',
    porque:
      'si solo aparece con costes, es que el stop más ancho diluye el spread — ' +
      'menos peaje por la misma no-ventaja, exactamente el mecanismo medido en M15 el 2026-09-28',
  },
  {
    clave: 'concentracion',
    dice: `ningún par aporta más del ${Math.round(TOPE_UN_PAR * 100)} % de las operaciones`,
    porque: 'con 7 pares es fácil que uno domine, y entonces lo medido es ese par',
  },
])

// ⚠️ EL VEREDICTO LO CALCULA ESTA FUNCIÓN. No lo argumenta nadie.
//
// `r` tiene que traer:
//   ops            operaciones resueltas en H4
//   porRiesgo      por 1R en H4, con costes
//   mitad1         por 1R de la primera mitad, con costes
//   mitad2         por 1R de la segunda mitad, con costes
//   h1PorRiesgo    por 1R en H1, con costes, mismos días y parámetros
//   sinCostes      por 1R en H4, SIN costes
//   h1SinCostes    por 1R en H1, SIN costes
//   parMayor       proporción (0 a 1) del par que más operaciones aporta
//
// Un campo que falte NO se da por bueno: el criterio falla. Es la asimetría de
// siempre —equivocarse hacia «no pasa» cuesta repetir una medición; hacia
// «pasa», perseguir una regla que no tiene nada.
export function juzgar(r = {}) {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

  const ops = num(r.ops)
  const por = num(r.porRiesgo)
  const m1 = num(r.mitad1)
  const m2 = num(r.mitad2)
  const h1 = num(r.h1PorRiesgo)
  const sin = num(r.sinCostes)
  const h1sin = num(r.h1SinCostes)
  const par = num(r.parMayor)

  const resultados = [
    { clave: 'ops', pasa: ops !== null && ops >= OPS_MINIMAS, valor: ops },
    { clave: 'gana', pasa: por !== null && por > 0, valor: por },
    { clave: 'mitades', pasa: m1 !== null && m2 !== null && m1 > 0 && m2 > 0, valor: [m1, m2] },
    { clave: 'mejorQueH1', pasa: por !== null && h1 !== null && por > h1, valor: [por, h1] },
    { clave: 'noEsSoloPeaje', pasa: sin !== null && h1sin !== null && sin > h1sin, valor: [sin, h1sin] },
    { clave: 'concentracion', pasa: par !== null && par <= TOPE_UN_PAR, valor: par },
  ]

  const fallan = resultados.filter((x) => !x.pasa).map((x) => x.clave)
  return { pasa: fallan.length === 0, fallan, resultados }
}

// ─────────────────────────────────────────────────────────────────────────
// EL SEMANAL: SOLO SI EL H4 CONFIRMA, Y CON ESTO DICHO POR DELANTE
// ─────────────────────────────────────────────────────────────────────────
// Néstor lo aprobó con esa condición, y va escrita aquí para que el día que se
// retome no haya que reconstruir el argumento.
//
// ⚠️ 1. LOS NÚMEROS NO ALCANZAN. Sobre los cinco años de Swing son unas 287
// velas semanales. Con pivote 8 el arranque se come 17, y saldrían del orden de
// 150 señales sobre 14 pares: margen de ±8 puntos en el mejor caso. Se puede
// medir, pero no puede decidir mucho.
//
// ⚠️⚠️ 2. Y LO QUE DE VERDAD LO DESACONSEJA: EN SEMANAL EL COSTE QUE MANDA YA NO
// ES EL SPREAD, ES EL SWAP. Una operación semanal dura MESES, o sea decenas de
// noches pagando. Y el swap no se puede conocer: depende del diferencial de
// tipos de cada momento y del margen de cada bróker, cambia mes a mes y no hay
// histórico. Por eso el banco lo BARRE a cinco niveles en vez de elegir uno.
//
// O sea que subir a semanal cambiaría un coste medido (el spread, que sí se
// conoce por par) por uno que solo se puede barrer. El número saldría, y su
// barra de error sería más ancha que el efecto que se busca.
//
// 📌 Y hay un precedente exacto en este proyecto: la salida por estructura del
// NFX-LSS v1.1 sostenía las operaciones 52 días de media, y con solo 0,25 pips
// de swap ya caía a −0,15. En semanal eso sería la norma, no la excepción.
export const SEMANAL_SOLO_SI = Object.freeze({
  condicion: 'el H4 pasa el listón de arriba, o al menos confirma el gradiente sin costes',
  advertencia:
    'En semanal manda el SWAP, no el spread: las operaciones duran meses y el swap no se ' +
    'conoce (se barre a cinco niveles). La barra de error sería más ancha que el efecto buscado.',
  velasDisponibles: 287,
  opsEsperadas: 150,
  margenPeorCaso: 8,
})

// ⚠️⚠️ Y LO QUE PASAR EL LISTÓN **NO** AUTORIZA, igual que en los otros
// preregistros de este proyecto.
//
// Estos años ya se miraron. Aprobar aquí NO enciende nada y NO pone nada en
// ninguna pantalla: significa que la idea se gana un registro HACIA ADELANTE en
// la sombra, anotada sin enseñarse, hasta juntar operaciones reales. Es el mismo
// camino de la reversión, de «comprar la caída» y de la ruptura de estructura.
export const QUE_PASA_SI_PASA =
  'Registro hacia adelante en la sombra, en la app que corresponda a esa temporalidad. ' +
  'NO se enciende nada y NO se enseña en ninguna pantalla: una regla sin validar puesta ' +
  'en una pantalla se lee como validada por el hecho de estar ahí.'
