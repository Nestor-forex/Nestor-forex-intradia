import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { APP } from './identidad'
import { MAX_ABIERTAS } from './practica'

// Las operaciones del modo práctica de la persona, en vivo (2026-11-16).
//
// Una sola colección (`users/{uid}/practica`) para las dos apps, y aquí se
// quedan solo las de ESTA app. Se filtra en el teléfono y no con una consulta
// porque son pocas, y una consulta con filtro y orden pediría un índice nuevo
// en Firebase.
//
// ⚠️ Aquí no se escribe nunca el resultado: lo pone el programa que las
// resuelve, y las reglas de Firestore no dejan que el teléfono lo haga.
export function usePractica(uid) {
  const [todas, setTodas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!uid) {
      setTodas([])
      setCargando(false)
      return
    }
    setCargando(true)
    return onSnapshot(
      collection(db, 'users', uid, 'practica'),
      (snap) => {
        setTodas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setCargando(false)
      },
      () => setCargando(false)
    )
  }, [uid])

  // Las más nuevas primero. Una recién creada todavía no tiene la hora del
  // servidor (llega un instante después): va arriba del todo.
  const ops = useMemo(() => {
    const ms = (o) => (o.creado?.toMillis ? o.creado.toMillis() : Infinity)
    return todas.filter((o) => o.app === APP).sort((a, b) => ms(b) - ms(a))
  }, [todas])

  const abiertas = ops.filter((o) => !o.estado).length

  // Devuelve 'ok', 'lleno' (ya hay MAX_ABIERTAS abiertas), 'sinPermiso' (las
  // reglas todavía no están publicadas) o 'error'.
  const crear = async (op) => {
    if (!uid || !op) return 'error'
    if (abiertas >= MAX_ABIERTAS) return 'lleno'
    try {
      await addDoc(collection(db, 'users', uid, 'practica'), { ...op, creado: serverTimestamp() })
      return 'ok'
    } catch (e) {
      return e?.code === 'permission-denied' ? 'sinPermiso' : 'error'
    }
  }
  const borrar = (id) => deleteDoc(doc(db, 'users', uid, 'practica', id))

  return { ops, cargando, crear, borrar, abiertas }
}
