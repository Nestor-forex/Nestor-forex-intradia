import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
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

  // ⚠️ RETIRAR CAMBIA EL ESTADO; NO BORRA LA FICHA. Y no es un detalle:
  //
  // Antes hacía `deleteDoc(users/{uid})`. Firestore **no borra las
  // subcolecciones** al borrar un documento, así que el diario de esa persona
  // (`users/{uid}/trades/*`) seguía existiendo — pero la regla de seguridad
  // exige que la ficha exista y diga «aprobado» para poder leerlo. O sea que
  // el diario no se borraba: **se quedaba encerrado para siempre**, y
  // readmitir a la persona tampoco se lo devolvía.
  //
  // Nadie decidió eso; salió así. Cambiando el estado, la persona ve
  // exactamente lo mismo que antes —la app ya trataba cualquier estado que no
  // fuera 'aprobado' ni 'pendiente' como retirado, y la manda a la pantalla de
  // entrada con su aviso— pero su diario sigue ahí y readmitirla se lo
  // devuelve entero.
  //
  // Las reglas de Firestore NO hubo que tocarlas: el admin ya podía escribir
  // cualquier `estado`. Hay una comprobación en `scripts/prueba-diario.mjs`
  // que falla si alguien devuelve el `deleteDoc`.
  const retirar = (uid) => updateDoc(doc(db, 'users', uid), { estado: 'retirado' })

  return { usuarios, cargando, aprobar, retirar }
}
