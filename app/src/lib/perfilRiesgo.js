// EL PERFIL DE RIESGO DE CADA PERSONA: cuánto capital tiene, cuánto arriesga
// por operación y cuáles son sus dos frenos (pérdida máxima en un día y
// pérdidas seguidas).
//
// Néstor lo pidió el 2026-11-12, como fase 1 de un plan más grande: el
// Analizador calcula el lote con este perfil y el guardián de riesgo del
// Diario lee estos dos frenos. Por eso va primero — los demás lo usan.
//
// ⚠️ AQUÍ NO HAY NI UNA LÍNEA DE FIREBASE, a propósito. Lo que decide si un
// perfil es válido tiene que poder comprobarse sin red y sin navegador, y lo
// usan dos sitios que no pueden discrepar: la PANTALLA (para avisar antes de
// guardar) y las REGLAS DE FIRESTORE (que lo vuelven a comprobar, porque la
// pantalla corre en el teléfono de la persona y se puede saltar). Los límites
// de `LIMITES` están escritos también en `firestore.rules`, y
// `prueba-perfil.mjs` falla si los dos se separan.
//
// ⚠️ NO DECIDE NADA DEL MERCADO. Ningún número de aquí cambia una señal,
// filtra un par ni apaga un aviso. Son las reglas de la persona sobre su
// propio dinero; la app solo las guarda y se las recuerda.

/** Los cuatro campos del perfil, en el orden en que se piden en pantalla. */
export const CAMPOS = Object.freeze(['capital', 'riesgoPct', 'limiteDiarioPct', 'maxPerdidasSeguidas'])

/**
 * Los tres niveles que se ofrecen con un toque, y el riesgo por operación de
 * cada uno. Los dio Néstor tal cual: conservador 1 %, moderado 2 %,
 * agresivo 3 %. Quien quiera otro número lo escribe a mano y queda como
 * «personalizado».
 */
export const NIVELES = Object.freeze({ conservador: 1, moderado: 2, agresivo: 3 })

/**
 * Lo que se propone a quien todavía no tiene perfil. Son SOLO los dos frenos
 * (los mismos 3 % y 3 que traía la propuesta de Néstor): el capital no se
 * propone nunca, porque un número inventado ahí haría que la calculadora
 * diera un lote que no corresponde a la cuenta de nadie.
 */
export const SUGERIDO = Object.freeze({ limiteDiarioPct: 3, maxPerdidasSeguidas: 3 })

/**
 * Lo mínimo y lo máximo que admite cada campo. ⚠️ Están TAMBIÉN en
 * `firestore.rules`: si cambian aquí, hay que cambiarlos allí y volver a
 * publicar las reglas (Actions → «Publicar las reglas de Firestore»).
 *
 * No son números de gusto:
 *   · `riesgoPct` hasta 10 % — por encima ya no es gestión de riesgo, y un
 *     dedo que escribe 20 en vez de 2 tiene que chocar con algo;
 *   · `limiteDiarioPct` desde 0,5 % — más bajo que una sola operación al
 *     riesgo mínimo deja de ser un freno y pasa a ser un error de tecleo;
 *   · `maxPerdidasSeguidas` entero, de 1 a 20.
 */
export const LIMITES = Object.freeze({
  capital: Object.freeze({ min: 1, max: 10_000_000 }),
  riesgoPct: Object.freeze({ min: 0.1, max: 10 }),
  limiteDiarioPct: Object.freeze({ min: 0.5, max: 20 }),
  maxPerdidasSeguidas: Object.freeze({ min: 1, max: 20 }),
})

const ENTEROS = new Set(['maxPerdidasSeguidas'])

/**
 * Convierte lo que haya escrito la persona (o lo que venga guardado) en un
 * número de ese campo, o `null`.
 *
 * ⚠️ `null` y NUNCA 0. `Number('')`, `Number('   ')` y `Number(null)` valen 0
 * en JavaScript, y un capital de 0 o un riesgo de 0 no son «no lo dijo»: son
 * afirmaciones, y la calculadora daría un lote de 0 creyéndolas. Es hermano
 * de `new Date(null) === 1970`, que ya mordió en este proyecto.
 *
 * Acepta la coma como decimal porque en español se escribe así («1,5»).
 */
export function aNumero(valor, campo) {
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return null
  } else if (typeof valor === 'string') {
    const limpio = valor.trim().replace(',', '.')
    if (limpio === '' || !/^-?\d+(\.\d+)?$/.test(limpio)) return null
    valor = Number(limpio)
  } else {
    return null
  }
  if (ENTEROS.has(campo) && !Number.isInteger(valor)) return null
  return valor
}

/** ¿Está ese número dentro de lo que admite el campo? */
export function dentro(campo, n) {
  const l = LIMITES[campo]
  return Boolean(l) && typeof n === 'number' && n >= l.min && n <= l.max
}

/**
 * Lee el perfil tal como viene de Firestore y devuelve los cuatro campos, cada
 * uno con su número o con `null`.
 *
 * ⚠️ UN CAMPO RARO NO SE ARREGLA: SE QUEDA EN `null`. Si alguien escribió a
 * mano un riesgo del 50 %, la app no lo recorta a 10 —eso sería decidir por
 * él— ni lo usa —eso sería calcular un lote con un dato que no tiene
 * sentido—. Lo deja vacío y la pantalla le pide que lo vuelva a poner.
 */
export function leerPerfil(guardado) {
  const fuente = guardado && typeof guardado === 'object' && !Array.isArray(guardado) ? guardado : {}
  const salida = {}
  for (const c of CAMPOS) {
    const n = aNumero(fuente[c], c)
    salida[c] = dentro(c, n) ? n : null
  }
  return salida
}

/** ¿Tiene la persona los cuatro campos puestos y válidos? */
export function perfilCompleto(perfil) {
  return CAMPOS.every((c) => dentro(c, perfil?.[c]))
}

/**
 * Comprueba lo que la persona escribió en el formulario ANTES de guardarlo.
 *
 * Devuelve `{ ok: true, limpio }` con los cuatro números listos para guardar,
 * o `{ ok: false, codigo, campo }`. Se devuelve un CÓDIGO y nunca una frase
 * porque la pantalla está en 13 idiomas.
 *
 * ⚠️ Exige LOS CUATRO. Un perfil a medias haría que la calculadora usara el
 * capital y no el riesgo, o que el guardián tuviera un freno y no el otro, sin
 * que la persona supiera cuál falta.
 */
export function validaPerfil(escrito) {
  const limpio = {}
  for (const c of CAMPOS) {
    const n = aNumero(escrito?.[c], c)
    if (n === null) return { ok: false, codigo: 'falta', campo: c }
    if (!dentro(c, n)) return { ok: false, codigo: 'fueraDeRango', campo: c }
    limpio[c] = n
  }
  // El freno del día tiene que dejar hacer AL MENOS una operación: si es más
  // bajo que el riesgo de una sola, el guardián avisaría antes de empezar.
  if (limpio.limiteDiarioPct < limpio.riesgoPct) return { ok: false, codigo: 'limiteMenorQueRiesgo', campo: 'limiteDiarioPct' }
  return { ok: true, limpio }
}

/**
 * Qué nivel corresponde a un riesgo: uno de los tres de `NIVELES`, o
 * `'personalizado'` si no coincide exactamente con ninguno, o `null` si no
 * hay riesgo puesto.
 */
export function nivelDe(riesgoPct) {
  if (typeof riesgoPct !== 'number' || !Number.isFinite(riesgoPct)) return null
  for (const [nombre, pct] of Object.entries(NIVELES)) if (pct === riesgoPct) return nombre
  return 'personalizado'
}

/**
 * Cuántas operaciones seguidas, todas perdedoras al riesgo elegido, caben antes
 * de tocar el freno del día. Es la cuenta que ayuda a entender qué significa
 * el freno: con un 1 % por operación y un 3 % al día, el día se acaba a la
 * tercera.
 *
 * `null` si falta alguno de los dos.
 */
export function operacionesHastaElFreno(perfil) {
  const r = perfil?.riesgoPct
  const l = perfil?.limiteDiarioPct
  if (!dentro('riesgoPct', r) || !dentro('limiteDiarioPct', l)) return null
  // El pequeño margen evita que 3 / 1 salga 2,9999… y se cuente como 2.
  return Math.floor(l / r + 1e-9)
}

/** Cuánto dinero es el freno del día, en dólares. `null` si falta algo. */
export function frenoEnDolares(perfil) {
  if (!dentro('capital', perfil?.capital) || !dentro('limiteDiarioPct', perfil?.limiteDiarioPct)) return null
  return (perfil.capital * perfil.limiteDiarioPct) / 100
}

/** Lo que se pone en cada casilla del formulario al abrirlo. */
export function valoresIniciales(perfil) {
  const p = perfil || {}
  const texto = (c, sugerido) => (dentro(c, p[c]) ? String(p[c]) : sugerido === undefined ? '' : String(sugerido))
  return {
    capital: texto('capital'),
    riesgoPct: texto('riesgoPct'),
    limiteDiarioPct: texto('limiteDiarioPct', SUGERIDO.limiteDiarioPct),
    maxPerdidasSeguidas: texto('maxPerdidasSeguidas', SUGERIDO.maxPerdidasSeguidas),
  }
}
