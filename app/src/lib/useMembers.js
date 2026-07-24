import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

// Lista en vivo de solicitudes/miembros, solo utilizable por el admin
// (las reglas de Firestore igual lo exigen del lado del servidor).
export function useMembers(activo) {
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!activo) return
    setCargando(true)
    const q = query(collection(db, 'users'), orderBy('creado', 'desc'))
    return onSnapshot(
      q,
      (snap) => {
        setUsuarios(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
        setCargando(false)
      },
      () => setCargando(false)
    )
  }, [activo])

  const aprobar = (uid) => updateDoc(doc(db, 'users', uid), { estado: 'aprobado' })
  const retirar = (uid) => deleteDoc(doc(db, 'users', uid))

  return { usuarios, cargando, aprobar, retirar }
}
