import { doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { conHecha, leerHechas } from './curso'

/**
 * El progreso del curso (`users/{uid}.curso`, la lista de lecciones terminadas)
 * y guardarlo.
 *
 * ⚠️ NO abre su propia escucha: lee del `ficha` que `useAuthUser` ya mantiene
 * vivo, igual que `useEstilo`. Devuelve códigos, nunca frases; `sinPermiso` va
 * aparte porque es lo que pasa mientras las reglas nuevas de Firestore no estén
 * publicadas.
 */
export function useCurso(uid, ficha) {
  const hechas = leerHechas(ficha?.curso)
  const puedoEscribir = Boolean(db && uid)
  return {
    hechas,
    puedoEscribir,
    async terminar(id) {
      const nueva = conHecha(hechas, id)
      if (nueva.length === hechas.length) return { ok: true }
      if (!puedoEscribir) return { ok: false, codigo: 'sinSesion' }
      try {
        await updateDoc(doc(db, 'users', uid), { curso: nueva })
        return { ok: true }
      } catch (err) {
        return { ok: false, codigo: err?.code === 'permission-denied' ? 'sinPermiso' : 'noSeGuardo' }
      }
    },
  }
}
