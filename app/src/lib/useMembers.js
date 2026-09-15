import { useEffect, useState } from 'react'
import { collection, deleteField, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { esFechaISO } from './vencimientos'

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

  // La fecha hasta la que esa persona tiene acceso, en texto 'AAAA-MM-DD'.
  //
  // De aquí come el robot que cierra puertas cada noche
  // (`scripts/cerrar-vencidos.mjs`). Quitar la fecha —pasando vacío— deja la
  // cuenta SIN vencimiento, o sea abierta indefinidamente: es lo que tienen
  // hoy todos los miembros y lo que hay que dejarle a quien no se cobra.
  //
  // ⚠️ Vale para LAS DOS APPS a la vez: comparten la colección `users`.
  const fijarVence = (uid, fecha) => {
    const limpio = String(fecha ?? '').trim()
    if (!limpio) return updateDoc(doc(db, 'users', uid), { venceEl: deleteField() })
    // Se rechaza aquí y no solo en el robot: una fecha mal escrita que llegue
    // a Firestore deja esa ficha marcada como «ilegible» y sin cerrar hasta
    // que alguien la arregle a mano. Mejor no dejarla entrar.
    if (!esFechaISO(limpio)) throw new Error(`Fecha inválida: ${limpio}`)
    return updateDoc(doc(db, 'users', uid), { venceEl: limpio })
  }

  return { usuarios, cargando, aprobar, retirar, fijarVence }
}
