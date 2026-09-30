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
