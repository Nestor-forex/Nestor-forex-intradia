// LAS REGLAS QUE CORREN EN LA SOMBRA: cuántas operaciones llevan y cuántas
// hacen falta para que su número signifique algo.
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
// ─────────────────────────────────────────────────────────────────────────
// Néstor lo pidió con sus palabras, y la frase que usó es exactamente lo que
// hay que poner en pantalla:
//
//   > son operaciones en positivo pero que no se pueden tomar como señales
//   > porque no tienen operaciones reales suficientes para creerles
//
// El Historial ya enseñaba esos porcentajes. Lo que NO decía —salvo en la
// ruptura— es que todavía no significan nada. Un número positivo en pantalla,
// sin nada al lado, se lee como una recomendación por el hecho de estar ahí.
//
// ⚠️ Y el aviso no puede ser «no te lo creas», que no dice cuándo sí: tiene que
// ser un NÚMERO. Cuántas lleva, cuántas faltan, y cuánto puede moverse ese
// porcentaje solo por casualidad con las que lleva hoy.

import { margen } from './diagnostico.js'

// Cuántas operaciones reales hacen falta para que un porcentaje signifique
// algo.
//
// ⚠️ ESTE NÚMERO NO ES UN PARÁMETRO DE TRADING, y por eso es el MISMO en las dos
// apps aunque todo lo demás no lo sea. No sale de medir nada del mercado: sale
// de `margen(n)`, que es aritmética. Con 150 operaciones el margen del peor
// caso es de ±8 puntos; con 13 es de ±27, y ahí un 40 % y un 70 % son el mismo
// número. Eso vale igual con velas diarias que con velas de una hora — lo
// único que cambia entre apps es cuánto se tarda en llegar.
//
// Es además el listón que los preregistros de este proyecto vienen usando
// (`preregistro-lss.mjs` en Swing lo pone en 150 y lo deja primero de la lista
// porque es el que no se ablanda). La prueba de Swing compara los dos números y
// falla si se separan; como este archivo es GEMELO y se compara byte a byte,
// esa comprobación cubre también a la app hermana.
export const OPS_PARA_CREER = 150

/**
 * El estado de una regla de la sombra, en números y sin adjetivos.
 *
 * @param {number} ops  operaciones REALES ya resueltas
 * @returns {{ops:number, faltan:number, margen:number, suficiente:boolean}|null}
 */
export function confianza(ops) {
  // ⚠️ Ante la duda no se afirma nada y la pantalla no pinta el aviso. Un
  // `{faltan: 150}` inventado sobre un dato que no existe sería afirmar que la
  // regla no lleva ninguna operación, y eso no se sabe. Misma asimetría que
  // `pearson` devolviendo `null` y que `costeDeLaAntiguedad`.
  if (typeof ops !== 'number' || !Number.isFinite(ops) || ops < 0) return null

  return {
    ops,
    faltan: Math.max(0, OPS_PARA_CREER - ops),
    // El margen del PEOR caso (p = 0,5), igual que en `diagnostico.js`. Un
    // margen afinado a favor propio serviría para presumir, no para decidir
    // sobre dinero.
    margen: margen(ops),
    suficiente: ops >= OPS_PARA_CREER,
  }
}
