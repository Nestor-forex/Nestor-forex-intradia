import { useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

// Diario de operaciones intradía del usuario logueado, sincronizado en vivo
// por Firestore. Usa una colección separada (`trades_intradia`) de la app
// hermana Nestor Forex (`trades`) — mismo proyecto de Firebase y mismas
// cuentas, pero sin mezclar estadísticas de swing con las de intradía.
export function useTrades(uid) {
  const [trades, setTrades] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!uid) {
      setTrades([])
      setCargando(false)
      return
    }
    setCargando(true)
    const q = query(collection(db, 'users', uid, 'trades_intradia'), orderBy('creado', 'desc'))
    return onSnapshot(
      q,
      (snap) => {
        setTrades(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setCargando(false)
      },
      () => setCargando(false)
    )
  }, [uid])

  const guardar = (t) => addDoc(collection(db, 'users', uid, 'trades_intradia'), { ...t, creado: serverTimestamp() })
  const borrar = (id) => deleteDoc(doc(db, 'users', uid, 'trades_intradia', id))
  const cerrar = (id, pl) => updateDoc(doc(db, 'users', uid, 'trades_intradia', id), { estado: 'cerrada', pl })

  return { trades, cargando, guardar, borrar, cerrar }
}
