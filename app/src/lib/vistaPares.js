import { clave } from './identidad.js'

// VER TODOS LOS PARES O SOLO LOS MÍOS.
//
// Néstor lo pidió el 2026-10-31, y la frase que manda sobre todo lo demás es
// suya: «hay trader que operan con pocos pares, otros solamente con uno y
// otros con muchos. Las apps deben satisfacer todos los gustos».
//
// ⚠️⚠️ ESTO EXISTE PARA ARREGLAR UNA MENTIRA, no para añadir una comodidad.
// La tarjeta «Mis pares» decía desde el día que se escribió que «los avisos y
// el tablero se quedan solo con ésos», y era FALSO: la función que filtra
// (`soloSeguidos`, en `alertas.js`) estaba escrita y probada, y **no la
// llamaba nadie**. Néstor eligió tres pares, fue al tablero, y los vio los
// catorce. Es la familia de fallo que este proyecto lleva meses coleccionando
// —una etiqueta que describe algo que el código no hace— y la cazó él, no una
// comprobación.
//
// ⚠️ NO CAMBIA NI UNA SEÑAL. Lo que la app calcula y lo que el vigía anota en
// el historial son exactamente los mismos con el filtro puesto o quitado:
// esto solo decide QUÉ FILAS SE PINTAN. Si algún día filtrara el cálculo,
// sería otra app y habría que medirla desde cero.

export const MODO_MIS = 'mis'
export const MODO_TODOS = 'todos'

const CLAVE = clave('vista_pares')

/**
 * Lee del teléfono qué eligió esta persona la última vez.
 *
 * Devuelve `{ valor, pudoLeer }` y no un texto a secas **a propósito**: hay
 * que poder distinguir «nunca ha elegido» de «no se pudo leer», porque las
 * dos cosas se resuelven hacia lados distintos (ver `decidirModo`). En una
 * ventana privada, con las cookies bloqueadas o durante la captura de la
 * miniatura, `localStorage` no devuelve vacío: **revienta**.
 */
export function leerModo() {
  try {
    return { valor: localStorage.getItem(CLAVE), pudoLeer: true }
  } catch {
    return { valor: null, pudoLeer: false }
  }
}

/** Guarda la elección. Si no se puede, no pasa nada: se pierde la preferencia, no el dato. */
export function guardarModo(modo) {
  try {
    localStorage.setItem(CLAVE, modo)
    return true
  } catch {
    return false
  }
}

/**
 * Qué se enseña de verdad, juntando lo guardado con la lista de la persona.
 *
 * ⚠️ LOS DOS ERRORES NO CUESTAN LO MISMO, y por eso la decisión NO es
 * simétrica:
 *
 *   - enseñar de más  → ves pares que no te interesan. Molesta y se ve.
 *   - enseñar de menos → abres la app, ves 3 filas donde había 14 y piensas
 *                        que se rompió. Y si es un día de mercado movido,
 *                        puedes no enterarte de algo por una preferencia que
 *                        pusiste hace meses.
 *
 * Así que **ante la duda se enseña TODO**: sin lista, con un valor guardado
 * que no se entiende, o cuando el teléfono no deja leer. Es la misma forma de
 * escribir que `yaCorrioHoy` (ante la duda, corre) y `esSombra` (ante la duda,
 * no avisa).
 *
 * ⚠️ La única excepción, y es deliberada: **«tengo lista y nunca he elegido»
 * NO es duda.** Alguien que se tomó el trabajo de tocar sus pares ya dijo lo
 * que quiere — es justo lo que Néstor esperaba y no pasó. Ahí se filtra, y el
 * contador («viendo 3 de 14») está siempre en pantalla para que nunca sea un
 * misterio ni cueste más de un toque deshacerlo.
 */
export function decidirModo(guardado, seguimiento, { pudoLeer = true } = {}) {
  const lista = paresDeLaLista(seguimiento)
  if (!lista.length) return MODO_TODOS
  if (!pudoLeer) return MODO_TODOS
  if (guardado === MODO_MIS) return MODO_MIS
  if (guardado === MODO_TODOS) return MODO_TODOS
  if (guardado === null || guardado === undefined) return MODO_MIS
  return MODO_TODOS
}

/** La lista limpia: solo textos, sin repetidos y sin huecos. */
export function paresDeLaLista(seguimiento) {
  if (!Array.isArray(seguimiento)) return []
  const vistos = new Set()
  for (const p of seguimiento) if (typeof p === 'string' && p.trim()) vistos.add(p)
  return [...vistos]
}

/**
 * Deja de una lista solo las filas cuyo par esté elegido.
 *
 * `campo` es el nombre del campo que lleva el par. En este proyecto casi
 * siempre es `name` — en `pares`, en `compras`/`ventas`/`vigilancia` y en los
 * tres tipos de setup— pero las filas de riesgo llevan DOS pares (`a` y `b`),
 * así que ésas tienen su propia función.
 */
export function filasDeMisPares(filas, lista, campo = 'name') {
  if (!Array.isArray(filas)) return filas
  return filas.filter((f) => lista.includes(f?.[campo]))
}

/**
 * Las filas de riesgo entre señales solo valen si se ven LOS DOS pares.
 *
 * ⚠️ Si se dejara una fila con un par que no está en pantalla, diría
 * «GBP/JPY y USD/JPY son la misma apuesta» sobre algo que la persona no está
 * mirando. Un aviso de riesgo que nombra lo que no se ve no es un aviso: es
 * ruido que además contradice la pantalla.
 */
export function parejasDeMisPares(filas, lista) {
  if (!Array.isArray(filas)) return filas
  return filas.filter((f) => lista.includes(f?.a) && lista.includes(f?.b))
}

// ─────────────────────────────────────────────────────────────────────────
// EL MANIFIESTO: qué se filtra y qué no, escrito A MANO
// ─────────────────────────────────────────────────────────────────────────
//
// ⚠️⚠️ VA A MANO Y NO CALCULADO, por el mismo motivo que la lista de GEMELOS:
// una regla del tipo «filtra todo lo que sea una lista con `name` dentro»
// sería más cómoda y dejaría pasar en silencio el día que alguien añada una
// lista nueva con otra forma. Aquí la pregunta «¿se filtra?» tiene que tener
// una respuesta escrita para CADA cosa que devuelve `derivarVista`, y hay una
// comprobación (`prueba-cableado.mjs`) que falla si aparece una sin clasificar.
//
// La lista es la UNIÓN de las dos apps: una clave que no exista en ésta
// sencillamente no está en el objeto y se salta sola.

/** Listas de filas donde cada fila es UN par, en el campo `name`. */
export const LISTAS_POR_PAR = [
  'pares',
  'compras',
  'ventas',
  'vigilancia',
  'rangos',
  'reversiones',
  'retrocesos',
  'setups',
  'setupsReversion',
  'setupsCaida',
  'setupsBollinger',
]

/** Listas de filas que nombran DOS pares (`a` y `b`): solo valen si se ven los dos. */
export const LISTAS_POR_PAREJA = ['riesgoSenales']

/**
 * Lo que NO se filtra nunca, cada cosa con su motivo escrito.
 *
 * ⚠️ ESTA LISTA ES LA PARTE QUE NO HAY QUE ABLANDAR. Todo lo de aquí describe
 * **el mercado entero**, no «qué mirar hoy». Recortarlo no enseñaría menos:
 * enseñaría otra cosa, con el mismo rótulo. Es el error que este proyecto
 * lleva meses persiguiendo.
 */
export const NO_SE_FILTRAN = {
  monedas:
    'El ranking de fuerza sale de comparar cada divisa contra las otras siete. Recortado dejaría de medir lo que dice medir y los números CAMBIARÍAN de valor.',
  correlaciones: 'Compara unos pares con otros; su gracia es justamente enseñar parejas que no estabas mirando.',
  compresionPares: 'Es una tarjeta de información sobre el mercado, y sus cortes salen de la distribución de TODOS los pares.',
  umbral: 'Es el listón del día para el mercado entero, no para tu lista.',
  difMax: 'Dice hasta dónde llegó la divergencia en TODO el mercado. Recortado diría otra cosa con el mismo nombre.',
  bloqueados: 'Explica por qué hoy no hay señales mirando el mercado entero; va de la mano de `difMax` y se lee con él.',
  corte: 'No es una lista de pares: es la fecha del dato.',
  sesion: 'No es una lista de pares: es la sesión del mercado abierta ahora.',
}

/**
 * La vista del mercado con el filtro puesto.
 *
 * Se filtra lo que es «qué te propone mirar la app hoy» y nada más. Lo que se
 * queda entero, y por qué, está arriba en `NO_SE_FILTRAN`.
 */
export function filtrarMercado(mercado, seguimiento, modo) {
  if (!mercado || modo !== MODO_MIS) return mercado
  const lista = paresDeLaLista(seguimiento)
  if (!lista.length) return mercado

  const vista = { ...mercado }
  for (const k of LISTAS_POR_PAR) if (Array.isArray(mercado[k])) vista[k] = filasDeMisPares(mercado[k], lista)
  for (const k of LISTAS_POR_PAREJA) if (Array.isArray(mercado[k])) vista[k] = parejasDeMisPares(mercado[k], lista)
  return vista
}

/**
 * Lo que hace falta para pintar el control: cuántos se ven, de cuántos, y si
 * la elección dejó a la persona sin ningún par de los que hay hoy.
 *
 * `vacio` existe porque una lista con pares que el barrido de hoy no trae
 * —un par que se quitó de la app, o un archivo viejo— dejaría la pantalla en
 * blanco sin explicación. Con esto se puede avisar en vez de callar.
 */
export function resumenVista(mercado, seguimiento, modo) {
  // ⚠️ El barrido puede no haber llegado todavía, o haber llegado roto. Esto
  // se pinta en CADA repintado de la pantalla, así que reventar aquí deja la
  // app en blanco — y la primera versión reventaba: `filasDeMisPares` devuelve
  // lo que le dan cuando no es una lista, y pedirle `.length` a `undefined`
  // tumba el render entero. Lo cazó la comprobación «sin mercado no revienta».
  const filas = Array.isArray(mercado?.pares) ? mercado.pares : []
  const total = filas.length
  const lista = paresDeLaLista(seguimiento)
  const hayLista = lista.length > 0
  const filtrando = modo === MODO_MIS && hayLista
  const viendo = filtrando ? filasDeMisPares(filas, lista).length : total
  return { hayLista, filtrando, viendo, total, elegidos: lista.length, vacio: filtrando && viendo === 0 && total > 0 }
}
