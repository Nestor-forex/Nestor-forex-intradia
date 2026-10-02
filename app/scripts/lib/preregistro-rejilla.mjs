// EL LISTÓN PARA QUITAR DE LA REJILLA LAS HORAS SIN MERCADO — escrito el
// 2026-09-30, ANTES de correr el diagnóstico ni la medición ni una sola vez.
//
// ─────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE ESTA PREGUNTA
// ─────────────────────────────────────────────────────────────────────────
// La sonda de la rejilla (2026-09-30) midió esto sobre las MISMAS 300 velas
// que pide el vigía:
//
//   horas de MERCADO seguro ......... 198
//   horas de FRONTERA (no cuentan) ... 16
//   horas CERRADAS seguras .......... 86   ← 28,7 %
//
// Sábado entero, domingo de día, viernes de noche. Es un SUELO: son horas que
// ningún horario de verano puede convertir en mercado.
//
// Y las cerradas se mueven MUCHO menos: recorrido mediano 0,000130 contra
// 0,000680 en las de mercado — **5,2 veces más estrechas**.
//
// ⚠️ El ATR de esta app es Wilder de 14 velas y el stop es 1,5 × ATR. Un fin de
// semana son ~45 horas cerradas seguidas, y tras 45 velas el peso de lo
// anterior queda en (13/14)^45 ≈ 4 %. Eso APUNTA a que el lunes de madrugada el
// ATR está calculado casi entero sobre horas finas, y el stop con él.
//
// 📌 «APUNTA» es la palabra exacta: eso es una inferencia de tres hechos
// comprobados más una aritmética de decaimiento. **No está medido.** El paso 1
// de este trabajo es este archivo; el paso 2 es medirlo.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ ESTO NO ES UN FILTRO, Y ES LA DIFERENCIA QUE LO CAMBIA TODO
// ─────────────────────────────────────────────────────────────────────────
// Las siete familias que se midieron y fallaron en este proyecto —RSI, ADX,
// confluencia de marcos, barrido de liquidez, COT— eran **filtros puestos
// ENCIMA de la entrada**: dejaban los datos igual y apagaban señales.
//
// Esto no. Esto cambia **el dato de entrada**, así que cambia la EMA9, la
// EMA21, el RSI, el ATR, el ADX y los pivotes — todo a la vez. No es una regla
// nueva sobre la app: **es la misma app sobre otra serie.**
//
// 📌 Consecuencia que hay que tener clarísima en las dos direcciones:
//
//   · el pesimismo de «aquí los filtros no funcionan» NO aplica. Citar esas
//     siete derrotas para frenar esto sería un argumento mal usado;
//   · y a cambio, la medición es MÁS grande: hay que correr la app entera dos
//     veces y comparar dos apps, no una app con y sin un interruptor.
//
// ⚠️ Y tampoco se puede sostener «hay que quitarlas porque son inventadas».
// La sonda midió que esas velas **NO están planas** (0 % en los dos grupos):
// llevan recorrido real, pequeño pero real. Pueden ser cotizaciones de verdad,
// finas, de fuera de hora. Así que la única razón válida para cambiarlas es que
// MIDAN mejor — que es justo lo que este listón juzga.
export const FECHA_PREREGISTRO = '2026-09-30'

// La vara con la que se decide, la de siempre.
export const VARA = 'neutra 1:1, spread por par descontado'

// Lo medido por la sonda, guardado aquí para que el informe no lo repita de
// memoria y para que se vea con qué se entró a medir.
export const LO_QUE_MIDIO_LA_SONDA = Object.freeze({
  velas: 300,
  mercado: 198,
  frontera: 16,
  cerradas: 86,
  proporcionCerradas: 86 / 300,
  recorridoMedianoMercado: 0.00068,
  recorridoMedianoCerradas: 0.00013,
  vecesMasEstrechas: 0.00068 / 0.00013,
})

// Mínimo de operaciones. Quitar el 28,7 % de las velas acorta la serie, así que
// habrá menos señales que hoy y el listón tiene que exigir que queden
// suficientes. Con 150 el margen del peor caso es ±8 puntos.
export const OPS_MINIMAS = 150

// Cuánto puede aportar el par que más aporte.
export const TOPE_UN_PAR = 0.4

// Cuánto puede caer el número de señales al mes. La app tiene que seguir
// HABLANDO: está escrito del 2026-09-04, al aflojar el ADX en esta misma app,
// que lo que se compró fue que la app hable, no que acierte. Una corrección que
// mejore el número dejando la app medio muda no es obviamente mejor, y esa
// decisión no la toma un guion.
export const MINIMO_DE_SEÑALES = 0.8

// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ POR QUÉ ESTE LISTÓN NO EXIGE «GANAR», Y NO ES UN AFLOJE
// ─────────────────────────────────────────────────────────────────────────
// Los otros preregistros de este proyecto («comprar la caída», el LSS, el H4)
// exigen `por 1R > 0`, y con razón: juzgan **reglas nuevas** que se encenderían
// para ganar dinero. Una regla que pierde no es un hallazgo.
//
// Esto es otra cosa: es una **corrección del dato** de una regla que YA corre.
// La app mide −0,13 hoy. Exigir que la corrección la ponga en positivo sería
// exigirle que arregle algo que nunca prometió arreglar — y dejaría la pregunta
// sin respuesta posible, que es la peor forma de escribir un listón.
//
// Lo que se juzga es: **¿la app mide MEJOR sobre horas de mercado de verdad?**
//
// ⚠️ Y lo que este afloje NO compra, dicho aquí para que nadie lo estire:
// pasar el listón **NO enciende nada** y **no hace que la app gane dinero**. Se
// gana un registro hacia adelante en la sombra, exactamente igual que las otras
// tres reglas. Ver `QUE_PASA_SI_PASA` al final.

// ─────────────────────────────────────────────────────────────────────────
// LOS SIETE CRITERIOS. Todos obligatorios.
// ─────────────────────────────────────────────────────────────────────────
export const CRITERIOS = Object.freeze([
  {
    clave: 'ops',
    dice: `al menos ${OPS_MINIMAS} operaciones resueltas con la rejilla limpia`,
    porque: 'quitar el 28,7 % de las velas acorta la serie; sin esto el margen se come la diferencia',
  },
  {
    clave: 'mejora',
    dice: 'por 1R MEJOR que la misma app sobre la rejilla de hoy, mismos días, con costes',
    porque:
      'es la pregunta entera: no si gana, sino si mide mejor sobre horas de mercado de verdad. ' +
      'Ver arriba por qué aquí no se exige ganar',
  },
  {
    clave: 'mitades',
    dice: 'mejor en las DOS mitades del periodo, no solo en el total',
    porque: 'es el criterio que el ADX no pasó y con el que el COT suspendió: una mitad no es una mejora',
  },
  {
    clave: 'noEsSoloPeaje',
    dice: 'la mejora también aparece SIN costes',
    porque:
      'quitar horas finas ENSANCHA el ATR, y con él el stop; el spread es fijo, así que pesa menos ' +
      'y el número mejora SIN que la app apunte mejor. Es el mecanismo medido en M15 el 2026-09-28 ' +
      '(pierde el doble que en H1 acertando exactamente igual) y confirmado en H4 el 2026-09-29. ' +
      'Es el criterio que más probablemente muerda, y por eso existe este archivo',
  },
  {
    clave: 'atrSube',
    dice: 'el ATR SUBE al limpiar la rejilla **donde el mecanismo dice que tiene que subir**: al abrir la semana',
    porque:
      'es la comprobación del MECANISMO. Si el ATR no se mueve, la mejora que aparezca no viene ' +
      'de lo que yo dije que venía — y una mejora sin explicación sobre datos que acabo de cambiar ' +
      'es exactamente la forma de engañarse a uno mismo. Ocho veces ya en este proyecto',
  },
  {
    clave: 'sigueHablando',
    dice: `al menos el ${Math.round(MINIMO_DE_SEÑALES * 100)} % de las señales al mes que hay hoy`,
    porque: 'una app que mide mejor y casi no habla no es obviamente mejor, y eso no lo decide un guion',
  },
  {
    clave: 'concentracion',
    dice: `ningún par aporta más del ${Math.round(TOPE_UN_PAR * 100)} % de las operaciones`,
    porque: 'con 7 pares directos es fácil que uno domine, y entonces lo medido es ese par',
  },
])

/**
 * ⚠️ EL VEREDICTO LO CALCULA ESTA FUNCIÓN. No lo argumenta nadie.
 *
 * `r` tiene que traer:
 *   ops            operaciones resueltas con la rejilla limpia
 *   porRiesgo      por 1R con la rejilla limpia, con costes
 *   mitad1/mitad2  por 1R de cada mitad, con costes, rejilla limpia
 *   hoyPorRiesgo   por 1R de la app de HOY, mismos días, con costes
 *   hoyMitad1/2    lo mismo por mitades
 *   sinCostes      por 1R con la rejilla limpia, SIN costes
 *   hoySinCostes   por 1R de la app de hoy, SIN costes
 *   subeEnArranque cuántas veces sube el ATR del ARRANQUE de semana al limpiar
 *                  (no el ATR medio global: ver DONDE_SE_COMPRUEBA_EL_MECANISMO)
 *   senalesMes     señales/mes con la rejilla limpia
 *   hoySenalesMes  señales/mes con la rejilla de hoy
 *   parMayor       proporción (0 a 1) del par que más aporta
 *
 * ⚠️ Un campo que falte NO se da por bueno: el criterio falla. Es la asimetría
 * de siempre — equivocarse hacia «no pasa» cuesta repetir una medición; hacia
 * «pasa», cambiar el corazón de una app por nada.
 */
export function juzgar(r = {}) {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

  const ops = num(r.ops)
  const por = num(r.porRiesgo)
  const m1 = num(r.mitad1)
  const m2 = num(r.mitad2)
  const hoy = num(r.hoyPorRiesgo)
  const hm1 = num(r.hoyMitad1)
  const hm2 = num(r.hoyMitad2)
  const sin = num(r.sinCostes)
  const hoySin = num(r.hoySinCostes)
  const sube = num(r.subeEnArranque)
  const sen = num(r.senalesMes)
  const hoySen = num(r.hoySenalesMes)
  const par = num(r.parMayor)

  const resultados = [
    { clave: 'ops', pasa: ops !== null && ops >= OPS_MINIMAS, valor: ops },
    { clave: 'mejora', pasa: por !== null && hoy !== null && por > hoy, valor: [por, hoy] },
    {
      clave: 'mitades',
      pasa: m1 !== null && m2 !== null && hm1 !== null && hm2 !== null && m1 > hm1 && m2 > hm2,
      valor: [
        [m1, hm1],
        [m2, hm2],
      ],
    },
    { clave: 'noEsSoloPeaje', pasa: sin !== null && hoySin !== null && sin > hoySin, valor: [sin, hoySin] },
    // ⚠️ Se lee `subeEnArranque`, NO el ATR medio global: ver
    // `DONDE_SE_COMPRUEBA_EL_MECANISMO`. El medio global es insensible.
    { clave: 'atrSube', pasa: sube !== null && sube > 1, valor: sube },
    {
      clave: 'sigueHablando',
      pasa: sen !== null && hoySen !== null && hoySen > 0 && sen / hoySen >= MINIMO_DE_SEÑALES,
      valor: sen !== null && hoySen ? sen / hoySen : null,
    },
    { clave: 'concentracion', pasa: par !== null && par <= TOPE_UN_PAR, valor: par },
  ]

  const fallan = resultados.filter((x) => !x.pasa).map((x) => x.clave)
  return { pasa: fallan.length === 0, fallan, resultados }
}

// ─────────────────────────────────────────────────────────────────────────
// EL DIAGNÓSTICO (paso 2), Y QUÉ SIGNIFICA CADA SALIDA
// ─────────────────────────────────────────────────────────────────────────
// Antes de gastar los créditos de la medición completa hay una pregunta más
// barata que decide si vale la pena: **¿se derrumba de verdad el ATR al abrir
// la semana?**
//
// Se escribe aquí lo que significa cada resultado POSIBLE, antes de verlo, que
// es lo único que impide leer cualquier número como una confirmación:
export const QUE_DICE_EL_DIAGNOSTICO = Object.freeze({
  seDerrumba:
    'El ATR al abrir la semana es mucho menor que el de media semana Y sube al limpiar la ' +
    'rejilla. Entonces el mecanismo es el que se describió y la medición completa vale la pena.',
  noSeMueve:
    'El ATR al abrir la semana se parece al de media semana. Entonces mi inferencia era FALSA ' +
    '(la novena) y la medición completa mide algo sin mecanismo detrás: se documenta y se para.',
  seDerrumbaPeroNoSube:
    'Se derrumba, pero limpiar la rejilla no lo sube. Entonces el problema no son las horas ' +
    'cerradas sino otra cosa, y quitarlas no es el arreglo. Se para y se busca qué es.',
})

// ⚠️ El umbral con el que se llama «derrumbe».
//
// ─────────────────────────────────────────────────────────────────────────
// 📌 ESTE NÚMERO SE CORRIGIÓ, Y HAY QUE DECIR CUÁNDO Y POR QUÉ
// ─────────────────────────────────────────────────────────────────────────
// La primera versión decía **2,0**, con este razonamiento: «las horas cerradas
// son 5,2× más estrechas, así que si el ATR del arranque estuviera calculado
// ENTERO sobre ellas sería ~5× menor; pedir la mitad de eso es pedir que el
// efecto exista sin pedir que sea perfecto».
//
// **El razonamiento partía de un modelo falso**, y lo destapó la propia prueba
// antes de medir nada real:
//
//   · `atrWilder` no tiene memoria infinita: usa una ventana DURA de 60 velas;
//   · y las velas de FRONTERA se conservan a propósito, así que el tramo
//     anterior al lunes no es todo fin de semana — lleva horas anchas dentro,
//     y justo al final, que es donde Wilder pesa más.
//
// Con eso, «entero sobre horas cerradas» no ocurre nunca y el 5× no era el
// techo de nada.
//
// ⚠️⚠️ CORREGIR UN UMBRAL DESPUÉS DE VER UN RESULTADO ES LO QUE ESTE PROYECTO
// NO HACE. Así que queda dicho con precisión: **no se ha medido nada real
// todavía.** Lo único que se ha corrido es un mercado SINTÉTICO escrito para
// tener el efecto, y lo que enseñó es que mi medida estaba mal derivada, no
// cuál es el resultado. Si el número real sale por debajo del umbral, **el
// umbral no se vuelve a tocar** — ése es el momento exacto para el que existe
// este archivo.
//
// EL UMBRAL NUEVO SE DERIVA DE LO QUE SIGNIFICA EN PLATA, no de un ratio:
// el stop es 1,5 × ATR, así que un derrumbe de 1,5 es **un stop un 33 % más
// estrecho** al abrir la semana. Sobre los ~30 pips de stop típico de esta app
// son 10 pips menos, contra un spread de ~2. Eso es material y por eso es el
// listón. Por debajo de 1,5 el efecto existe pero no cambia una decisión.
export const DERRUMBE_MINIMO = 1.5

// ⚠️ Y POR QUÉ EL MECANISMO **NO** SE COMPRUEBA CON EL ATR MEDIO GLOBAL, que
// es lo que decía la primera versión de este archivo.
//
// Medido en el mercado sintético: el ATR medio global sale **idéntico** en las
// dos rejillas (0,0008000 y 0,0008000). Y no es un fallo — es aritmética: las
// horas que cambian son las del arranque de semana, un 5 % del total, así que
// una mediana sobre todo no las ve.
//
// 📌 Una medida insensible a lo que quiere medir es peor que ninguna: habría
// dado «el ATR no sube» con el efecto delante, y habría parado el trabajo por
// la razón equivocada. El mecanismo se comprueba **donde predice que pasa**.
export const DONDE_SE_COMPRUEBA_EL_MECANISMO =
  'en el ATR del ARRANQUE de semana (subeEnArranque > 1), no en el ATR medio global, ' +
  'que es insensible porque las horas afectadas son ~5 % del total'

// ⚠️⚠️ Y LO QUE PASAR EL LISTÓN **NO** AUTORIZA.
//
// Néstor lo pidió con estas palabras: «sin tocar nada de lo que hemos hecho en
// las apps… pero sin quitar los experimentos, porque creo que vale la pena
// seguir midiendo y tener todo el historial de lo que hemos hecho».
//
// Así que queda escrito: aprobar aquí NO enciende nada, NO cambia el barrido
// que la app publica, NO toca el historial ya acumulado y NO quita ni un
// experimento. Significa que esta versión se gana un **registro hacia adelante
// en la sombra**, anotada al lado de las otras tres sin mezclarse con ellas,
// hasta juntar operaciones reales. Es el mismo camino de la reversión, de
// «comprar la caída» y de la ruptura de estructura.
export const QUE_PASA_SI_PASA =
  'Registro hacia adelante en la sombra, anotado junto a los experimentos que ya corren y ' +
  'SIN quitar ninguno. No se enciende nada, no cambia el barrido publicado y no se enseña en ' +
  'ninguna pantalla: una versión sin validar puesta en una pantalla se lee como validada por ' +
  'el hecho de estar ahí.'

// ─────────────────────────────────────────────────────────────────────────
// LA PREGUNTA DE SWING, QUE A INTRADÍA NUNCA SE LE HIZO (añadido 2026-10-01)
// ─────────────────────────────────────────────────────────────────────────
//
// ⚠️⚠️ Lo de arriba contesta **«¿se HUNDE el ATR al abrir la semana?»**, que es
// una pregunta de POSICIÓN: compara un momento de la serie contra otro. Corrió
// el 2026-09-30 y dijo `noSeMueve` en 7 de 7 (máximo 1,28× contra el 1,50
// pedido), o sea que mi inferencia era falsa — la novena de este proyecto.
//
// En Swing se midió otra cosa: **«¿cuánto SUBE el ATR al quitar las horas
// cerradas?»**, que es una pregunta de NIVEL. Allí salió **+18,5 % de mediana**
// y 12 de 14 pares por encima del umbral.
//
// 📌 **Y a Intradía esa segunda pregunta NO se le hizo.** El `noSeMueve` de
// aquí contesta la primera y nada más. Néstor lo señaló con estas palabras:
// «son preguntas distintas y el "no" de Intradía solo contesta la primera».
// Tenía razón: `atrMedioHoy` contra `atrMedioLimpia` se imprimía en el log
// —±2 %— pero está escrito en este mismo archivo que esa medida es
// **insensible a propósito** y que no sirve para concluir nada. Usarla como
// respuesta sería justo el error que arriba se documenta para evitarlo.
//
// ⚠️ Y hay un segundo motivo para no dar el ±2 % por respuesta: **compara dos
// MEDIANAS, no la mediana de los COCIENTES.** Son cosas distintas: si el ATR
// sube un 20 % en un cuarto de las velas y no se mueve en el resto, las dos
// medianas salen casi iguales.
//
// ⚠️⚠️ PERO LA MEDIANA DE LOS COCIENTES TAMPOCO SIRVE AQUÍ, Y ESO ESTÁ MEDIDO
// ANTES DE CORRER NADA REAL.
//
// Fue lo primero que escribí como «la que decide», y el mercado sintético de
// `prueba-rejilla.mjs` —escrito para TENER el efecto— la desmintió:
//
//     mediana del cociente       1,000 EXACTO
//     p90 del cociente           1,32
//     velas que suben más del 7 %   23,9 %
//
// O sea que con el efecto delante, la mediana dice que no pasa nada. Y no es un
// fallo: es ARITMÉTICA de esta app. `atrWilder` aquí tiene una **ventana dura
// de 60 velas**, así que solo cambian las velas que tienen horas cerradas
// DENTRO de su ventana — medido en el mismo mercado, el **46,7 %** como techo
// estructural. Más de la mitad de las velas de mercado no pueden cambiar, y
// una mediana sobre todas se queda clavada en 1.
//
// 📌 **Y ESTA ES LA DIFERENCIA DE FONDO CON SWING, que es lo que hacía falta
// entender para hacer bien la pregunta:** allá `atrWilder` recorre **la serie
// ENTERA**, así que quitar velas cambia TODOS los valores y una mediana los ve.
// Aquí la ventana corta la memoria a 60 y el efecto es LOCAL. La misma
// pregunta, medida con el mismo estadístico, no significa lo mismo en las dos
// apps — que es la lección de `barridoSwap` por enésima vez.
//
// ⚠️ Corregir una medida tras verla fallar en un mercado SINTÉTICO no es
// corregir un umbral tras ver un resultado: lo sintético enseñó que la medida
// estaba mal elegida, no cuál es la respuesta. Es exactamente lo que ya pasó
// con `atrMedioGlobal` en este mismo archivo, y queda dicho igual.

// El umbral, DERIVADO de lo que significa en plata y NO copiado de Swing.
//
// ⚠️⚠️ ALLÁ ES 2 % Y AQUÍ ES 7 %, y la diferencia no es de estilo: es el
// mecanismo que este proyecto ya tiene medido del 2026-09-07.
//
//   ┌──────────┬───────────────┬────────┬──────────────────┐
//   │          │ stop típico   │ spread │ el spread pesa   │
//   ├──────────┼───────────────┼────────┼──────────────────┤
//   │ Swing    │ ~155 pips     │ ~2     │ 1,3 %  → umbral 2 % │
//   │ Intradía │ ~30 pips      │ ~2     │ 6,7 %  → umbral 7 % │
//   └──────────┴───────────────┴────────┴──────────────────┘
//
// El mismo bróker y el mismo spread, cuatro veces más peso. Un cambio en el
// ATR por debajo del spread que se paga por entrar no cambia ninguna decisión,
// porque ya está por debajo del coste — y aquí ese suelo está cuatro veces más
// alto. **Copiar el 2 % de Swing habría sido traerse una suposición sobre el
// mercado que en esta app es falsa**, que es la lección de `barridoSwap` y la
// del filtro de RSI.
//
// ⚠️ **Si el número real sale por debajo, el umbral NO se vuelve a tocar.**
export const CAMBIO_MINIMO_ATR = 0.07

// ⚠️⚠️ EL ESTADÍSTICO QUE DECIDE: **la PROPORCIÓN de velas de mercado cuyo ATR
// cambia más que el peso del spread.** No la mediana (ver arriba).
//
// Por qué éste y no otro: la app puede dar una señal en CUALQUIER hora de
// mercado, y en cada una pone el stop con el ATR de esa hora. Así que lo que
// importa no es «cuánto cambia el ATR típico» sino **en qué fracción de las
// horas en las que la app puede hablar sale el stop desviado más de lo que
// cuesta entrar**.
//
// El número, derivado y no inventado: el techo estructural son las velas con
// horas cerradas dentro de su ventana de 60, medido en **46,7 %**. Se pide
// **15 %**, o sea que el efecto aparezca en al menos un tercio de las velas
// donde la geometría permite que aparezca. Un 15 % es, en horas de mercado,
// aproximadamente **una señal por semana con el stop desviado más que el
// spread** — eso es material; por debajo es un caso de esquina.
//
// ⚠️ **Si el número real sale por debajo, el umbral NO se vuelve a tocar.**
export const PROPORCION_MINIMA_AFECTADA = 0.15
export const TECHO_ESTRUCTURAL_MEDIDO = 0.467

// Cuántas de las 7 divisas tienen que estar de acuerdo. Es la MISMA rejilla
// para las siete: si el efecto es de la rejilla, sale en casi todas.
export const MAYORIA_DIVISAS = 0.7

export const QUE_DICE_LA_PREGUNTA_DE_SWING = Object.freeze({
  sube:
    'Quitar las horas cerradas sube el ATR por encima del peso del spread. Entonces el ' +
    'stop de esta app (1,5 × ATR, o sea el stop ENTERO) está demasiado estrecho, y la ' +
    'medición completa con su propio listón vale la pena — igual que en Swing.',
  noSube:
    'Quitar las horas cerradas NO mueve el ATR por encima del peso del spread. Entonces ' +
    'la respuesta de Intradía a la pregunta de Swing es distinta de la de Swing, y eso ' +
    'NO es una contradicción: son dos rejillas y dos ATR distintos. Lo que hay que ' +
    'explicar entonces es el mecanismo — ver `MECANISMO_CANDIDATO`.',
})

// ⚠️⚠️ EL MECANISMO CANDIDATO, Y YA ESTÁ REFUTADO POR EL MERCADO SINTÉTICO
//
// Quedaba una cosa que explicar y que de entrada parece imposible: **el 25,8 %
// de las velas son 5,2× más estrechas y aun así el ATR apenas se mueve.**
//
// Mi explicación fue: al quitar el fin de semana, la primera vela de la semana
// pasa a medir su rango verdadero contra el cierre del VIERNES en vez de contra
// el del domingo, o sea que **se come el hueco del fin de semana entero**, y un
// rango grande compensa los que faltan.
//
// 📌 **FALSO, y lo dijo la comprobación que escribí para sostenerlo.** En la
// rejilla limpia de esta app **la FRONTERA se conserva** —las horas donde el
// cambio de hora decide si hubo mercado, domingo 21:00-23:00 UTC—, así que la
// vela anterior a la apertura **es la misma en las dos rejillas**. No hay
// ningún hueco del viernes que comerse: la frontera hace de puente.
//
// Es el **décimo** mecanismo convincente de este proyecto que resulta falso al
// medirlo, y van dos en dos días (el anterior fue el derrumbe del lunes).
//
// ✅ **Y la explicación verdadera ya está medida, arriba**: la ventana dura de
// 60 velas. Más de la mitad de las velas de mercado no tienen ninguna hora
// cerrada dentro de su ventana, así que no pueden cambiar — el efecto es LOCAL,
// no global, y por eso una mediana sobre todas se queda en 1.
//
// La medición (`huecoDeApertura`) **se queda** y se sigue imprimiendo: si algún
// día la fuente dejara de emitir las horas de frontera, el puente desaparecería
// y el mecanismo volvería a estar en juego. El informe enseña las dos fechas
// del cierre previo para que eso se vea en vez de quedar escondido.
export const MECANISMO_CANDIDATO =
  'HIPÓTESIS YA REFUTADA en el mercado sintético: al limpiar, la vela anterior a la apertura ' +
  'es LA MISMA en las dos rejillas, porque la frontera (domingo 21:00-23:00 UTC) se conserva y ' +
  'hace de puente. No hay hueco del viernes que comerse. La explicación medida es la ventana ' +
  'dura de 60 velas: el efecto es LOCAL, no global.'
