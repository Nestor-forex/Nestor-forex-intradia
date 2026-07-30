import { useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { ADMIN_EMAIL, auth, db, firebaseListo } from './firebase'
import { mensajeError } from './authErrors'
import { useT } from './i18n'

// Sesión (Firebase Auth) + perfil (Firestore) del usuario actual, en vivo.
// perfilEstado: 'sin-sesion' | 'cargando' | 'pendiente' | 'aprobado' | 'retirado'
export function useAuthUser() {
  const t = useT()
  const [authUser, setAuthUser] = useState(null)
  const [cargandoAuth, setCargandoAuth] = useState(true)
  const [perfil, setPerfil] = useState(null)
  const [perfilCargado, setPerfilCargado] = useState(false)

  useEffect(() => {
    if (!firebaseListo) {
      setCargandoAuth(false)
      return
    }
    return onAuthStateChanged(auth, (u) => {
      setAuthUser(u)
      setCargandoAuth(false)
      setPerfilCargado(false)
      if (!u) setPerfil(null)
    })
  }, [])

  useEffect(() => {
    if (!authUser) return
    const ref = doc(db, 'users', authUser.uid)
    return onSnapshot(
      ref,
      (snap) => {
        setPerfil(snap.exists() ? snap.data() : null)
        setPerfilCargado(true)
      },
      () => {
        setPerfil(null)
        setPerfilCargado(true)
      }
    )
  }, [authUser])

  const esAdmin = Boolean(authUser && ADMIN_EMAIL && (authUser.email || '').toLowerCase() === ADMIN_EMAIL)

  let perfilEstado = 'sin-sesion'
  if (authUser) {
    if (esAdmin) perfilEstado = 'aprobado'
    else if (!perfilCargado) perfilEstado = 'cargando'
    else if (!perfil) perfilEstado = 'retirado'
    else if (perfil.estado === 'aprobado') perfilEstado = 'aprobado'
    else if (perfil.estado === 'pendiente') perfilEstado = 'pendiente'
    else perfilEstado = 'retirado'
  }

  const registrar = async (nombre, email, clave) => {
    const correo = (email || '').trim().toLowerCase()
    if (!nombre?.trim() || !correo || !clave) return { ok: false, msg: t('auth.faltanCampos') }
    try {
      const cred = await createUserWithEmailAndPassword(auth, correo, clave)
      await setDoc(doc(db, 'users', cred.user.uid), {
        nombre: nombre.trim(),
        email: correo,
        estado: 'pendiente',
        creado: serverTimestamp(),
      })
      // El propio correo del administrador queda aprobado de una vez: nadie
      // más puede aprobarlo, y las reglas de Firestore sí lo permiten porque
      // ese correo coincide con ADMIN_EMAIL.
      if (correo === ADMIN_EMAIL) {
        await updateDoc(doc(db, 'users', cred.user.uid), { estado: 'aprobado' })
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, msg: mensajeError(e, t) }
    }
  }

  const ingresar = async (email, clave) => {
    const correo = (email || '').trim().toLowerCase()
    if (!correo || !clave) return { ok: false, msg: t('auth.faltanCredenciales') }
    try {
      await signInWithEmailAndPassword(auth, correo, clave)
      return { ok: true }
    } catch (e) {
      return { ok: false, msg: mensajeError(e, t) }
    }
  }

  const salir = () => signOut(auth)

  return { authUser, cargandoAuth, perfil, perfilEstado, esAdmin, registrar, ingresar, salir }
}
