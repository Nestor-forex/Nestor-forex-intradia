import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, collectionGroup, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { APP } from './identidad'

// Las reglas del laboratorio (2026-11-18).
//
// Una sola colección (`users/{uid}/reglas`) para las dos apps; aquí se quedan
// solo las de ESTA app, filtradas en el teléfono (son pocas, y una consulta
// con filtro y orden pediría un índice nuevo).
//
// ⚠️ No hay `actualizar`: una regla cambiada es OTRA regla y se guarda aparte.
// Las reglas de Firestore no dejan editarla. Lo único que se puede cambiar es
// encender o apagar su seguimiento hacia adelante (si el servicio está
// activo) y, solo el administrador, el informe al autor.

const ms = (r) => (r.creado?.toMillis ? r.creado.toMillis() : Infinity)

// Devuelve 'ok', 'sinPermiso' (las reglas de Firestore todavía no están
// publicadas) o 'error'.
async function escribir(promesa) {
  try {
    await promesa
    return 'ok'
  } catch (e) {
    return e?.code === 'permission-denied' ? 'sinPermiso' : 'error'
  }
}

async function guardarEn(uid, ficha) {
  if (!uid || !ficha || ficha.error) return 'error'
  try {
    await addDoc(collection(db, 'users', uid, 'reglas'), { ...ficha, creado: serverTimestamp() })
    return 'ok'
  } catch (e) {
    return e?.code === 'permission-denied' ? 'sinPermiso' : 'error'
  }
}

export function useReglas(uid) {
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
      collection(db, 'users', uid, 'reglas'),
      (snap) => {
        setTodas(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setCargando(false)
      },
      () => setCargando(false)
    )
  }, [uid])

  const reglas = useMemo(() => todas.filter((r) => r.app === APP).sort((a, b) => ms(b) - ms(a)), [todas])

  const guardar = (ficha) => guardarEn(uid, ficha)
  const borrar = (id) => deleteDoc(doc(db, 'users', uid, 'reglas', id))
  // Encender pone la fecha del servidor: el seguimiento empieza AHORA y lo
  // de antes no cuenta. Apagar no borra nada; volver a encender empieza de cero.
  const seguir = (id, encender) =>
    escribir(updateDoc(doc(db, 'users', uid, 'reglas', id), encender ? { seguir: true, seguirDesde: serverTimestamp() } : { seguir: false }))

  return { reglas, cargando, guardar, borrar, seguir }
}

/**
 * Las reglas guardadas de TODOS los miembros, para el administrador.
 *
 * ⚠️ Solo se pide si `activo` (o sea si es el administrador): a cualquier otro
 * las reglas de Firestore se lo negarían. Consulta de grupo de colección sin
 * filtro ni orden, que no necesita índice.
 */
export function useReglasTodas(activo) {
  const [reglas, setReglas] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!activo) {
      setReglas([])
      return
    }
    return onSnapshot(
      collectionGroup(db, 'reglas'),
      (snap) => {
        setError(null)
        setReglas(
          snap.docs
            .map((d) => ({ id: d.id, uid: d.ref.parent.parent?.id ?? null, ...d.data() }))
            .sort((a, b) => ms(b) - ms(a))
        )
      },
      (e) => setError(e?.code === 'permission-denied' ? 'sinPermiso' : 'error')
    )
  }, [activo])

  return { reglas, error }
}

/** Guardar en MIS reglas una copia de la regla de otro miembro. */
export function copiarRegla(uidAdmin, regla) {
  const { nombre, app, lado, condiciones, riesgoATR, objetivoRB, probadas, resultado } = regla
  return guardarEn(uidAdmin, {
    nombre: String(nombre ?? '').slice(0, 60) || 'Copia',
    app,
    lado,
    condiciones,
    riesgoATR,
    objetivoRB,
    probadas: Number.isInteger(probadas) && probadas > 0 ? probadas : 1,
    resultado: resultado ?? null,
    copiaDe: String(regla.uid ?? '').slice(0, 128),
    permiteCopia: false,
  })
}

/** Administrador: escribirle al autor qué se logró con su idea. */
export function informarAutor(uidAutor, reglaId, texto, metricas) {
  return escribir(
    updateDoc(doc(db, 'users', uidAutor, 'reglas', reglaId), {
      informe: { texto: String(texto ?? '').slice(0, 2000), metricas: String(metricas ?? '').slice(0, 2000), el: serverTimestamp() },
    })
  )
}

/** La persona pide que le activen el seguimiento hacia adelante. */
export function solicitarSeguimiento(uid) {
  return escribir(updateDoc(doc(db, 'users', uid), { seguimientoSolicitado: serverTimestamp() }))
}

/** Administrador: activar o quitar el servicio de seguimiento a un miembro. */
export function activarSeguimiento(uid, activo) {
  return escribir(updateDoc(doc(db, 'users', uid), { seguimientoActivo: activo === true }))
}
