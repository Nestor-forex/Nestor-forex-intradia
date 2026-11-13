import { doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { conPlantilla, leerPlantillas, sinPlantilla } from './analizador'

/**
 * Las plantillas del Analizador de la persona, más guardar y borrar.
 *
 * ⚠️ NO abre su propia escucha de Firestore: lee del `ficha` que
 * `useAuthUser` ya mantiene vivo, igual que `usePerfilRiesgo` y `useAvisos`.
 *
 * ⚠️ Guarda la lista ENTERA ya limpia (`conPlantilla` / `sinPlantilla`), nunca
 * lo que traiga la pantalla: una plantilla con una herramienta que no existe o
 * un nombre de 200 letras no llega a la ficha de nadie.
 *
 * Devuelve códigos, nunca frases. `sinPermiso` va aparte porque es lo que
 * pasa de verdad mientras las reglas nuevas de Firestore no estén publicadas,
 * y «no se pudo guardar» mandaría a buscar el problema donde no está.
 */
export function usePlantillas(uid, ficha) {
  const plantillas = leerPlantillas(ficha?.plantillas)
  const puedoEscribir = Boolean(db && uid)

  const escribir = async (lista) => {
    if (!puedoEscribir) return { ok: false, codigo: 'sinSesion' }
    try {
      await updateDoc(doc(db, 'users', uid), { plantillas: lista })
      return { ok: true }
    } catch (e) {
      return { ok: false, codigo: e?.code === 'permission-denied' ? 'sinPermiso' : 'noSeGuardo', error: e }
    }
  }

  return {
    plantillas,
    puedoEscribir,
    async guardar(plantilla) {
      const r = conPlantilla(plantillas, plantilla)
      return r.ok ? escribir(r.lista) : r
    },
    async borrar(nombre) {
      return escribir(sinPlantilla(plantillas, nombre))
    },
  }
}
