// QUIÉN ES ESTA APP.
//
// Este es el ÚNICO archivo de `src/` que sabe si esto es Swing o Intradía.
// Todo lo demás que necesite distinguirlas lo importa de aquí.
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
// ─────────────────────────────────────────────────────────────────────────
// Las dos apps son casi idénticas por dentro. Antes de este archivo había
// media docena de sitios donde estaba escrito «swing» o «nfs_» a mano, y eso
// hacía que archivos que deberían ser gemelos exactos no lo fueran. Al no
// serlo, no se podía comprobar por máquina que siguieran iguales, y una
// corrección hecha en una app y olvidada en la otra pasaba inadvertida.
//
// Con la identidad en un solo sitio, esos archivos vuelven a ser idénticos
// carácter por carácter, y `scripts/prueba-gemelos.mjs` puede vigilarlos.
//
// ⚠️ NO METER AQUÍ nada que sea una decisión de trading. Los pares que se
// operan, los umbrales, las medias, la geometría del stop: todo eso es
// distinto en cada app POR BUENAS RAZONES, vive en `marketCalc.js`, y
// mezclarlo aquí invitaría a «igualarlo» algún día. Está medido que lo que
// funciona en una app no funciona en la otra.

// Cómo se identifica esta app frente al vigía y en la colección `pushSubs`
// de Firestore. Los dos repos comparten proyecto de Firebase, así que este
// valor es lo que hace que cada vigía le escriba solo a los aparatos de SU
// app. Cambiarlo dejaría a la gente sin avisos.
export const APP = 'intradia'

// El nombre que se ve en pantalla.
export const NOMBRE_APP = 'NESTOR FOREX INTRADÍA'

// Prefijo de todo lo que se guarda en el teléfono (localStorage).
//
// ⚠️ Tiene que ser DISTINTO al de la app hermana. Si las dos usaran el mismo,
// y alguien tiene las dos instaladas, se pisarían el idioma y la caché entre
// ellas. `nfs` = Nestor Forex Swing, `nfi` = Nestor Forex Intradía.
export const PREFIJO = 'nfi'

/** La clave con la que guardar algo en el teléfono, ya con el prefijo. */
export const clave = (nombre) => `${PREFIJO}_${nombre}`
