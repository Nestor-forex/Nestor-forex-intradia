// QUÉ EXPERIMENTOS LE AVISAN AL CELULAR DEL ADMINISTRADOR (2026-11-15)
//
// Néstor lo pidió así:
//
//   > quiero que me pongas opciones en los avisos, es decir, que yo pueda
//   > activar a gusto o preferencia cualquier experimento de las apps […]
//   > activarlas o desactivarlas a mi gusto, pero esto es solo para el
//   > desarrollador por ahora.
//
// Este archivo es la cuenta, y es GEMELO: lo mismo en las dos apps. Lo que cada
// app tiene de propio —qué experimentos existen y cómo se reconoce cada señal—
// vive en `experimentosAviso.js`, que es PRIMO.
//
// ⚠️ LA ELECCIÓN SE GUARDA EN SU FICHA, con un campo POR APP. Las dos apps
// comparten la colección `users`, y «quiero los avisos de la reversión» no
// significa lo mismo con velas diarias que con velas de una hora. Un solo campo
// para las dos haría que activar algo en una lo activara en la otra.
//
// ⚠️ NO HACE FALTA TOCAR LAS REGLAS DE FIRESTORE: el administrador ya puede
// escribir cualquier campo de cualquier ficha (`esAdmin()` en firestore.rules),
// y los suscriptores no ven esta tarjeta ni reciben estos avisos.

/** El nombre del campo de la ficha donde se guarda la elección de esta app. */
export const campoAvisosExp = (app) => `avisosExp_${app}`

/**
 * Las claves que el administrador tiene activadas en esta app.
 *
 * ⚠️ «Nunca eligió» y «lo apagó todo» NO son lo mismo, y por eso:
 *   · si el campo NO existe (o no es una lista), vale `defecto`: lo que la app
 *     mandaba antes de que existieran los interruptores;
 *   · si existe y está vacío, no se manda nada. Apagarlo todo es una elección.
 *
 * Una clave que ya no corresponde a ningún experimento se ignora: si mañana se
 * retira una regla, su interruptor guardado no puede hacer sonar nada.
 */
export function clavesElegidas(ficha, app, opciones, defecto = []) {
  const v = ficha?.[campoAvisosExp(app)]
  if (!Array.isArray(v)) return [...defecto]
  const validas = new Set((opciones || []).map((o) => o.clave))
  return [...new Set(v.filter((c) => typeof c === 'string' && validas.has(c)))]
}

/** La lista con `clave` encendida si estaba apagada, o apagada si estaba encendida. */
export function alternar(lista, clave) {
  const l = Array.isArray(lista) ? lista : []
  return l.includes(clave) ? l.filter((c) => c !== clave) : [...l, clave]
}
