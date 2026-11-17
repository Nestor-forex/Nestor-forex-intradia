import { doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { leerEstilo } from './estilo'

/**
 * El estilo de trading de la persona (`users/{uid}.estilo`) y guardarlo.
 *
 * ⚠️ NO abre su propia escucha: lee del `ficha` que `useAuthUser` ya mantiene
 * vivo, igual que `usePlantillas` y `useAvisos`. Devuelve códigos, nunca
 * frases; `sinPermiso` va aparte porque es lo que pasa mientras las reglas
 * nuevas de Firestore no estén publicadas.
 */
export function useEstilo(uid, ficha) {
  const estilo = leerEstilo(ficha?.estilo)
  const puedoEscribir = Boolean(db && uid)
  return {
    estilo,
    // Hasta que llega la ficha no se sabe si ya contestó: la tarjeta no sale.
    sabido: ficha !== null && ficha !== undefined,
    puedoEscribir,
    async guardar(nuevo) {
      const e = leerEstilo(nuevo)
      if (!e) return { ok: false, codigo: 'noValido' }
      if (!puedoEscribir) return { ok: false, codigo: 'sinSesion' }
      try {
        await updateDoc(doc(db, 'users', uid), { estilo: e })
        return { ok: true }
      } catch (err) {
        return { ok: false, codigo: err?.code === 'permission-denied' ? 'sinPermiso' : 'noSeGuardo' }
      }
    },
  }
}
