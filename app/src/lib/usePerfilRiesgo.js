// GUARDAR Y LEER EL PERFIL DE RIESGO DE CADA PERSONA
//
// Vive en su ficha de Firestore (`users/{uid}.perfilRiesgo`), al lado de sus
// avisos y su lista de pares. No en el navegador, por dos motivos:
//
//   · así sigue a la persona entre el teléfono y el computador, y entre las
//     DOS apps — las dos comparten la colección `users`, y el capital y el
//     riesgo de alguien no cambian según qué app abra;
//   · y lo van a leer piezas que vienen después (el Analizador y el guardián
//     de riesgo del Diario), que no pueden depender de qué teléfono se usó.
//
// ⚠️ LA REGLA DE FIRESTORE HUBO QUE AMPLIARLA, y va en el mismo cambio: una
// persona solo puede escribir en su ficha los campos de una lista blanca. Se
// añade `perfilRiesgo` y nada más, con sus límites comprobados también allí.
// Mientras esa regla nueva no esté publicada, guardar devuelve `sinPermiso`.

import { doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { leerPerfil, validaPerfil } from './perfilRiesgo'

/**
 * El perfil de riesgo de la persona, más la operación para guardarlo.
 *
 * ⚠️ NO abre su propia escucha de Firestore: lee del `perfil` que
 * `useAuthUser` ya mantiene vivo, igual que `useAvisos`. Dos escuchas del
 * mismo documento podrían ir un instante desfasadas y la pantalla parpadearía.
 *
 * @param uid     quién es
 * @param ficha   su ficha de Firestore, tal como la trae `useAuthUser`
 */
export function usePerfilRiesgo(uid, ficha) {
  const perfil = leerPerfil(ficha?.perfilRiesgo)
  const puedoEscribir = Boolean(db && uid)

  return {
    perfil,
    puedoEscribir,

    /**
     * Guarda lo escrito en el formulario. Devuelve `{ ok }` o
     * `{ ok: false, codigo, campo? }` — códigos, nunca frases.
     */
    async guardar(escrito) {
      const v = validaPerfil(escrito)
      if (!v.ok) return v
      if (!puedoEscribir) return { ok: false, codigo: 'sinSesion' }
      try {
        // ⚠️ Se guarda `v.limpio`, los cuatro números ya comprobados, y nunca
        // el objeto del formulario: lo que la pantalla llevara pegado no
        // acaba en la ficha de nadie. Y la regla rechaza cualquier campo de
        // más, así que con el objeto entero el guardado fallaría.
        await updateDoc(doc(db, 'users', uid), { perfilRiesgo: v.limpio })
        return { ok: true }
      } catch (e) {
        // `permission-denied` tiene su propio código porque es el caso que va
        // a pasar de verdad mientras las reglas nuevas no estén publicadas, y
        // «no se pudo guardar» mandaría a buscar el problema donde no está.
        return { ok: false, codigo: e?.code === 'permission-denied' ? 'sinPermiso' : 'noSeGuardo', error: e }
      }
    },
  }
}
