import { useEffect } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { conHoy } from './constancia'

/**
 * Apunta el día de hoy en `users/{uid}.diasTablero` cuando la persona abre el
 * tablero completo (`activo`). Una vez al día como mucho: `conHoy` devuelve
 * `null` si hoy ya está o es fin de semana, y entonces no se escribe nada.
 *
 * ⚠️ NO abre su propia escucha: lee del `ficha` que `useAuthUser` ya mantiene
 * vivo. Un fallo al escribir (por ejemplo, mientras las reglas nuevas de
 * Firestore no estén publicadas) no se enseña: lo único que se pierde es un
 * día de una insignia.
 */
export function useConstancia(uid, ficha, activo) {
  const lista = ficha?.diasTablero
  useEffect(() => {
    if (!activo || !db || !uid || !ficha) return
    const nueva = conHoy(lista)
    if (!nueva) return
    updateDoc(doc(db, 'users', uid), { diasTablero: nueva }).catch(() => {})
    // `ficha` entra solo para no escribir antes de que llegue la ficha.
  }, [activo, uid, lista, ficha])
}
