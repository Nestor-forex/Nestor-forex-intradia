// LAS PIEZAS PURAS DE LA SONDA DEL ORO EN VELAS DE UNA HORA.
//
// Sin red y sin estado, para que se puedan comprobar sin gastar un crédito ni
// depender de que Twelve Data esté de buen humor. La sonda de al lado
// (`scripts/sonda-oro-h1.mjs`) hace las llamadas; aquí vive lo que decide qué
// significa cada respuesta.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ POR QUÉ EL VEREDICTO VIVE AQUÍ Y NO DENTRO DEL GUION
// ─────────────────────────────────────────────────────────────────────────
// Porque ya falló una vez por estar dentro. El 2026-09-29, en la sonda de los
// huecos, **el RESUMEN afirmó lo contrario de lo que decía su propio detalle**:
// imprimió «SÍ — sirven: XAU/USD, CL, GOLD» mientras tres pantallas más arriba
// estaba el `meta` que desmentía a dos de los tres. Y el 2026-09-14, en la
// sonda del sentimiento, el informe dijo «no la publican abiertamente»
// **habiendo leído CERO páginas**.
//
// Los dos errores son el mismo: un veredicto escrito a mano, que puede decir
// algo que los datos de al lado no dicen. Aquí lo CALCULA una función, y la
// función tiene comprobaciones que muerden.
//
// 📌 Y la regla que sale de aquellos dos, que es la que gobierna este archivo:
// **«no se pudo mirar» y «no existe» no son lo mismo**, se escriben parecido y
// significan lo contrario. Ante cualquier duda se devuelve lo primero.

// ⚠️ LOS TIPOS QUE SÍ SON ORO, y no es paranoia: está medido.
//
// La sonda del 2026-09-29 pidió `GOLD` y `CL` a Twelve Data y las dos
// contestaron **200 con cinco velas perfectamente válidas** — de una ACCIÓN de
// la bolsa de Nueva York que se llama así por casualidad (42,85 y 86,52).
// `WTI` resultó ser «W&T Offshore Inc.» y `BZ` una empresa china de
// reclutamiento.
//
// Un lector que aceptara «200 con velas» habría publicado «oro: 42,85»: con su
// fecha, su máximo y su mínimo, y completamente falso. **No se caza por el
// código de respuesta — se caza mirando `type`.**
//
// (La lista es la misma que `TIPOS_DE_ORO` en `src/lib/oro.js` de la app de
// swing. Está duplicada a propósito y con su motivo: aquí no existe ese
// archivo. Si el oro acaba entrando en esta app, `oro.js` llega con él y esta
// copia se borra.)
export const TIPOS_DE_ORO = [/precious metal/i, /commodity/i]

export function esOroDeVerdad(meta) {
  const tipo = String(meta?.type ?? '')
  return TIPOS_DE_ORO.some((re) => re.test(tipo))
}

/**
 * ¿Sirve esta respuesta de Twelve Data como fuente de oro en este intervalo?
 *
 * Devuelve `{ sirve, clave, detalle }`, donde `sirve` tiene TRES valores y la
 * diferencia entre dos de ellos es todo el sentido de esta función:
 *
 *   true   → respondió, es oro, y trae velas.
 *   false  → respondió y NO sirve. Es un hallazgo: la puerta está cerrada.
 *   null   → **no se pudo mirar**. No es un hallazgo: no dice nada.
 *
 * ⚠️ `null` NUNCA se puede leer como `false`. «No pude preguntar» y «me dijo
 * que no» son cosas distintas, y confundirlas es lo que hizo que la sonda del
 * sentimiento afirmara que una fuente no publicaba un dato sin haber abierto
 * ni una página.
 */
export function juzgarRespuesta({ http, cuerpo, error } = {}) {
  // 1. Ni siquiera se pudo preguntar: red, proxy, tiempo agotado.
  if (error) return { sirve: null, clave: 'no-se-pudo-preguntar', detalle: String(error) }

  // 2. Respondió algo que no es JSON, o nada.
  if (cuerpo == null || typeof cuerpo !== 'object') {
    return { sirve: null, clave: 'cuerpo-ilegible', detalle: `HTTP ${http ?? '—'}, cuerpo no interpretable` }
  }

  // 3. ⚠️ UN SÍMBOLO FUERA DEL PLAN NO DA 403: DA 200 CON `status: "error"`.
  //    Comprobado: `WTI/USD` contesta «This symbol is available starting with
  //    the Grow or Venture plan». Por eso se mira el cuerpo ANTES que el
  //    código de respuesta.
  if (cuerpo.status === 'error') {
    return {
      sirve: false,
      clave: 'la-api-dice-error',
      detalle: `code=${cuerpo.code ?? '—'} · ${String(cuerpo.message ?? '(sin mensaje)').slice(0, 300)}`,
    }
  }

  // 4. Un HTTP que no es 2xx y sin `status: error` dentro: no se entiende qué
  //    pasó, así que no se concluye nada.
  if (typeof http === 'number' && (http < 200 || http >= 300)) {
    return { sirve: null, clave: 'http-raro', detalle: `HTTP ${http} sin un error explicado dentro` }
  }

  // 5. Respondió bien y no trae velas. Eso SÍ es un no.
  if (!Array.isArray(cuerpo.values) || cuerpo.values.length === 0) {
    return { sirve: false, clave: 'sin-velas', detalle: 'respondió sin errores pero con la lista de velas vacía' }
  }

  // 6. Trae velas… ¿de qué? Ver `TIPOS_DE_ORO`.
  if (!esOroDeVerdad(cuerpo.meta)) {
    return {
      sirve: false,
      clave: 'no-es-oro',
      detalle: `type «${cuerpo.meta?.type ?? '(sin type)'}» · base «${cuerpo.meta?.currency_base ?? '?'}»`,
    }
  }

  return {
    sirve: true,
    clave: 'sirve',
    detalle: `${cuerpo.values.length} velas · type «${cuerpo.meta?.type}» · base «${cuerpo.meta?.currency_base ?? '?'}»`,
  }
}

/**
 * Las marcas de tiempo de una respuesta, ordenadas de más vieja a más nueva.
 * Solo las que tienen la forma que Twelve Data promete; una que no se entienda
 * se deja fuera en vez de colarse como texto raro.
 */
export function horasDe(values) {
  if (!Array.isArray(values)) return []
  const out = []
  for (const v of values) {
    const t = String(v?.datetime ?? '')
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t)) out.push(t)
  }
  return out.sort()
}

/**
 * Cuánto se pisan el calendario del oro y el de los pares.
 *
 * ⚠️ ESTO ES LA MITAD DE LA SONDA, y es lo único que no se puede adivinar
 * desde aquí. En velas DIARIAS los dos calendarios casi coinciden y la
 * intersección apenas quita días. En velas de UNA HORA no está nada claro: el
 * oro al contado tiene una parada de mantenimiento todos los días y cierra el
 * viernes antes, y el Forex no cierra igual. Si encima las marcas de tiempo
 * cayeran en minutos distintos, la intersección se quedaría casi vacía y la
 * correlación no podría calcularse sobre nada.
 *
 * ⚠️ Y NO DEVUELVE NINGÚN VEREDICTO: devuelve CUENTAS. Si las horas comunes
 * bastan o no es una decisión, y se toma con estos números delante — no aquí.
 *
 * `porHoraDelDia` es la que dice si lo que falta tiene forma de horario o de
 * avería: si las horas que el oro no tiene se agrupan en una o dos horas del
 * día, es su parada de mantenimiento y es normal. Si están repartidas por
 * todas, el problema es otro.
 */
export function cruzarHoras(horasOro, horasPares) {
  const oro = new Set(horasOro ?? [])
  const pares = new Set(horasPares ?? [])

  const comunes = []
  const soloPares = []
  for (const t of [...pares].sort()) {
    if (oro.has(t)) comunes.push(t)
    else soloPares.push(t)
  }
  const soloOro = [...oro].filter((t) => !pares.has(t)).sort()

  // Cómo se reparten por hora del día las que tienen los pares y el oro no.
  const porHoraDelDia = {}
  for (const t of soloPares) {
    const h = t.slice(11, 13)
    porHoraDelDia[h] = (porHoraDelDia[h] ?? 0) + 1
  }

  return {
    comunes,
    soloPares,
    soloOro,
    porHoraDelDia,
    // En tanto por uno: de las horas que los pares SÍ tienen, cuántas se
    // conservan al cruzar. Es lo que se perdería al correlacionar.
    // `null` —nunca 0 ni 1— si no hay con qué calcularlo: un 0 diría «no se
    // conserva ninguna», que es una afirmación. Misma decisión que `pearson`.
    conservado: pares.size ? comunes.length / pares.size : null,
  }
}

// Cuántas horas a la semana está abierto el Forex: de domingo 22:00 UTC a
// viernes 22:00 UTC son 120 de las 168 que tiene la semana. Repartido entre los
// siete días del calendario salen **17,1 velas de una hora por día**.
//
// El número está aquí porque es la vara con la que se mide si una rejilla de
// velas es de verdad o está rellenada. No es un umbral que se pueda aflojar:
// es cuánto dura la semana de mercado.
export const HORAS_ABIERTO_SEMANA = 120
export const BARRAS_POR_DIA_ESPERADAS = HORAS_ABIERTO_SEMANA / 7

/**
 * ⚠️⚠️ CUÁNTAS VELAS VIENEN POR DÍA DE CALENDARIO, Y POR QUÉ ESTA FUNCIÓN
 * EXISTE — ES EL AGUJERO QUE LA PRIMERA VERSIÓN DE ESTA SONDA TENÍA.
 *
 * La primera corrida (2026-09-30) imprimió, con razón, «no falta ninguna hora:
 * los dos calendarios coinciden enteros» y «se conserva el 100 % de las horas
 * de los pares». Las dos frases son **literalmente ciertas** y se leen como la
 * mejor noticia posible. Pero el motivo por el que coinciden enteros NO es que
 * el oro y el Forex abran a las mismas horas: es que Twelve Data los sirve a
 * los dos en **la misma rejilla uniforme**.
 *
 * Y eso sale de una sola división que la sonda no hacía:
 *
 *   `1h`    → 5000 velas en 208,3 días =  24,0 por día
 *   `15min` → 5000 velas en  52,1 días =  96,0 por día = 24 horas/día
 *
 * **24 velas por día de calendario es imposible en un mercado que abre 120 de
 * las 168 horas de la semana** (17,1 por día). Ni siquiera cuadra contando solo
 * días hábiles: 5000 entre los ~148 hábiles de ese tramo darían 33,6 por día, y
 * un día no tiene más de 24. O sea que la rejilla trae horas en las que no se
 * negoció nada, y los dos intervalos lo dicen por separado.
 *
 * ⚠️ LO QUE ESTO NO DICE, y no hay que rellenarlo de cabeza: **qué traen
 * dentro** esas velas. Que estén ahí está forzado por la aritmética; que sean
 * planas, repetidas o inventadas no se ha mirado, y suponerlo sería el
 * mecanismo convincente de siempre.
 *
 * 📌 Y la lección, que es la séptima vez en este proyecto: **un resumen puede
 * ser verdad y engañar igual.** Aquí no afirmaba nada falso — le faltaba dar un
 * paso de aritmética, y sin ese paso el que lo lea construye encima de un
 * «100 %» que significa otra cosa.
 *
 * Devuelve `null` —nunca 0— si no hay con qué calcularlo.
 */
export function barrasPorDia(horas) {
  const h = Array.isArray(horas) ? [...horas].sort() : []
  if (h.length < 2) return null
  const ms =
    new Date(h[h.length - 1].replace(' ', 'T') + 'Z').getTime() - new Date(h[0].replace(' ', 'T') + 'Z').getTime()
  if (!Number.isFinite(ms) || ms <= 0) return null
  return h.length / (ms / 86_400_000)
}

// ⚠️⚠️ EL TRAMO MÍNIMO PARA PODER JUZGAR, Y NO ES UN NÚMERO DECORATIVO.
//
// Lo destapó una comprobación al escribirla: una rejilla HONESTA de lunes a
// viernes, 24 horas cada día, medida sobre su propio tramo —del lunes 00:00 al
// viernes 23:00, o sea 4,96 días— da **24,2 velas por día** y se marcaría como
// rellenada. Y no estaría mal calculada: estaría mal PREGUNTADA, porque en ese
// tramo no cabe ningún fin de semana que rebaje la media.
//
// La proporción 120/168 solo aparece si el tramo cubre varias semanas enteras.
// Con tres semanas el peso de un fin de semana suelto ya no decide, y con los
// 208 días de la corrida real sobra de largo.
//
// 📌 Vale la pena tenerlo escrito: la medida que destapó el agujero de la sonda
// tenía ella misma un agujero, y salió al probarla, no al usarla.
export const MIN_DIAS_PARA_JUZGAR = 21

/**
 * ¿La rejilla trae más velas por día de calendario de las que el mercado
 * abierto permite? `null` si no se puede saber.
 *
 * ⚠️ Solo tiene sentido para velas de UNA HORA. Con `15min` habría cuatro por
 * hora y el número esperado sería otro, así que se le pasa cuántas velas cabrían
 * en una hora de ese intervalo. Sin ese dato una rejilla honesta de 15 minutos
 * se marcaría siempre, porque 4 × 17,1 = 68,6 es mucho más que 17,1.
 *
 * ⚠️ Y devuelve `null` —no `rellenada: false`— si el tramo es más corto que
 * `MIN_DIAS_PARA_JUZGAR`. «No se puede juzgar» y «está bien» no son lo mismo:
 * es la misma asimetría que gobierna `juzgarRespuesta` en este archivo.
 */
export function rejillaRellenada(horas, porHora = 1) {
  const bpd = barrasPorDia(horas)
  if (bpd == null) return null

  const h = Array.isArray(horas) ? [...horas].sort() : []
  const dias =
    (new Date(h[h.length - 1].replace(' ', 'T') + 'Z').getTime() - new Date(h[0].replace(' ', 'T') + 'Z').getTime()) /
    86_400_000
  if (!Number.isFinite(dias) || dias < MIN_DIAS_PARA_JUZGAR) return null

  const esperadas = BARRAS_POR_DIA_ESPERADAS * porHora
  return {
    porDia: bpd,
    esperadas,
    dias,
    // Un margen del 10 % para no gritar por un festivo o un redondeo. La
    // diferencia que se busca es de 24 contra 17,1, o sea un 40 %.
    rellenada: bpd > esperadas * 1.1,
  }
}

/**
 * ⚠️⚠️ ¿ESTA HORA CAE DENTRO DE LA SEMANA DE MERCADO? Con tres respuestas, no
 * dos, y la del medio es la que hace que esto sea honesto.
 *
 * El Forex abre el domingo por la noche y cierra el viernes por la noche, en
 * horario de Nueva York — o sea que **el borde se mueve una hora con el cambio
 * de hora** (21:00 o 22:00 UTC según la época del año). No hay un instante
 * fijo que se pueda escribir aquí.
 *
 * Así que en vez de fingir precisión se parte en tres:
 *
 *   'cerrado'  → imposible que fuera mercado, con cualquier horario de verano:
 *                sábado de 00:00 a 20:59, domingo de 00:00 a 20:59, y viernes
 *                de 23:00 a 23:59.
 *   'frontera' → las horas donde el cambio de hora decide: viernes 21:00-22:59,
 *                sábado y domingo de 21:00 a 23:59.
 *   'mercado'  → el resto.
 *
 * ⚠️ LA CUENTA QUE DECIDE ES LA DE 'cerrado', y solo ésa. Es un **suelo**: si
 * hay una sola vela ahí, la rejilla trae horas sin mercado, y eso no lo puede
 * explicar ningún horario de verano. Las de 'frontera' se cuentan aparte y NO
 * se suman al hallazgo.
 *
 * 📌 Sin esta separación la sonda diría «hay velas en domingo» y sería
 * engañoso: **el domingo a las 22:00 el mercado SÍ está abierto** — es cuando
 * abre. Llamar cerrado a una hora de mercado sería la etiqueta equivocada de
 * siempre, y en este proyecto eso está escrito como un error de medición.
 */
export function clasificarHora(t) {
  if (typeof t !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t)) return null
  const d = new Date(t.replace(' ', 'T') + 'Z')
  if (!Number.isFinite(d.getTime())) return null

  const dia = d.getUTCDay() // 0 = domingo … 6 = sábado
  const h = d.getUTCHours()

  // Sábado: cerrado todo el día salvo la frontera de la noche.
  if (dia === 6) return h <= 20 ? 'cerrado' : 'frontera'
  // Domingo: cerrado hasta la tarde; la noche es cuando abre (o está a punto).
  if (dia === 0) return h <= 20 ? 'cerrado' : 'frontera'
  // Viernes: cierra por la noche. Las 21 y 22 son frontera; de 23 en adelante,
  // cerrado con cualquier horario.
  if (dia === 5) {
    if (h >= 23) return 'cerrado'
    if (h >= 21) return 'frontera'
  }
  return 'mercado'
}

/**
 * El reparto de una lista de horas entre las tres clases, más el detalle de
 * cuáles son las cerradas (para poder mirarlas con los ojos).
 */
export function repartoDeMercado(horas) {
  const out = { mercado: 0, frontera: 0, cerrado: 0, ilegibles: 0, cerradas: [] }
  for (const t of horas ?? []) {
    const c = clasificarHora(t)
    if (c === null) out.ilegibles++
    else {
      out[c]++
      if (c === 'cerrado') out.cerradas.push(t)
    }
  }
  return out
}

/**
 * ¿Las velas de estas horas están PLANAS (máximo = mínimo)? Una vela plana es
 * la firma de un precio rellenado: nadie negoció, así que no hubo recorrido.
 *
 * @param velas Map de hora → { h, l } (o cualquier objeto con máximo y mínimo)
 *
 * ⚠️ Devuelve `null` —nunca 0— si no hay velas que mirar. Un 0 diría «ninguna
 * está plana», que es una afirmación.
 *
 * ⚠️ Y una vela plana NO prueba por sí sola que sea rellenada: en un mercado
 * muy tranquilo puede pasar de verdad. Lo que dice algo es la PROPORCIÓN
 * comparada con las horas de mercado, y por eso se devuelven las dos.
 */
export function proporcionPlanas(horas, velas) {
  if (!(velas instanceof Map)) return null
  let n = 0
  let planas = 0
  for (const t of horas ?? []) {
    const v = velas.get(t)
    if (!v || !Number.isFinite(v.h) || !Number.isFinite(v.l)) continue
    n++
    if (v.h === v.l) planas++
  }
  if (!n) return null
  return { n, planas, proporcion: planas / n }
}

/**
 * El resumen, CALCULADO a partir de lo que se miró. Nunca escrito a mano.
 *
 * ⚠️ Si alguna de las preguntas quedó en «no se pudo mirar», el resumen lo dice
 * y NO da un sí ni un no. Es la diferencia entre «miré y está cerrado» y «no
 * pude mirar», que es la razón de ser de este archivo.
 */
export function veredicto({ intervalos = {}, cruce = null } = {}) {
  const entradas = Object.entries(intervalos)
  const sirven = entradas.filter(([, v]) => v?.sirve === true).map(([k]) => k)
  const noSirven = entradas.filter(([, v]) => v?.sirve === false).map(([k]) => k)
  const noSeSupo = entradas.filter(([, v]) => v?.sirve !== true && v?.sirve !== false).map(([k]) => k)

  const h1 = intervalos['1h']?.sirve

  let puerta
  if (h1 === true) puerta = 'abierta'
  else if (h1 === false) puerta = 'cerrada'
  else puerta = 'no-se-pudo-mirar'

  return {
    puerta,
    sirven,
    noSirven,
    noSeSupo,
    // Solo tiene sentido hablar del cruce si la puerta de H1 está abierta.
    cruce: puerta === 'abierta' ? cruce : null,
    // ⚠️ Que la puerta esté abierta NO quiere decir que la tarjeta sirva. Eso
    // depende de la ventana, y la ventana es una MEDICIÓN que todavía no se ha
    // hecho. La sonda solo dice si se puede pedir el dato.
    autoriza: false,
  }
}
