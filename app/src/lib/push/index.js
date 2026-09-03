// Activar y desactivar los avisos al celular.
//
// Cómo funciona, en corto: el navegador nos da una "suscripción" (una
// dirección secreta hacia ESTE aparato, más dos claves para cifrar). La
// guardamos en Firestore, y el vigía la usa para mandar el aviso cuando ve
// una señal nueva. El aviso no pasa por nuestros servidores: va del vigía
// directo al servidor de Apple o de Google, y de ahí al celular.
//
// Una suscripción es POR APARATO, no por persona: si Néstor activa los avisos
// en el celular y en la tableta, son dos suscripciones distintas de un mismo
// usuario. Por eso la colección es plana y cada documento lleva su `uid`.

import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase.js'
import { motivoNoDisponible } from './soporte.js'
import { VAPID_PUBLICA } from './vapid.js'
import { APP } from '../identidad'

export { VAPID_PUBLICA }

export const COLECCION = 'pushSubs'

// El navegador pide la clave como bytes, no como texto.
function base64UrlABytes(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const relleno = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binario = atob(relleno)
  return Uint8Array.from(binario, (c) => c.charCodeAt(0))
}

function bytesABase64Url(buffer) {
  const bytes = new Uint8Array(buffer)
  let binario = ''
  for (const b of bytes) binario += String.fromCharCode(b)
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// El identificador del documento sale del endpoint, no al azar. Así, si el
// mismo aparato vuelve a activar los avisos, se sobrescribe su documento en
// vez de dejar duplicados que harían sonar el celular dos veces.
async function idDeSuscripcion(endpoint) {
  const datos = new TextEncoder().encode(endpoint)
  const hash = await crypto.subtle.digest('SHA-256', datos)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// `navigator.serviceWorker.ready` se queda esperando para siempre si no hay
// service worker registrado (pasa en desarrollo). Con el plazo, la pantalla
// muestra un error claro en vez de quedarse pensando.
async function registroListo(msLimite = 10_000) {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, rechazar) =>
      setTimeout(() => rechazar(new Error('sw-no-listo')), msLimite)
    ),
  ])
}

// ¿Ya están activados los avisos en ESTE aparato?
export async function suscripcionActual() {
  if (motivoNoDisponible()) return null
  try {
    const registro = await registroListo()
    return await registro.pushManager.getSubscription()
  } catch {
    return null
  }
}

// Activa los avisos. Devuelve { ok: true } o { ok: false, motivo }.
//
// ⚠️ Tiene que llamarse desde un clic de la persona: los navegadores rechazan
// la petición de permiso si no viene de un gesto suyo.
//
// `idioma` se guarda con la suscripción porque el vigía corre en un servidor
// y no tiene forma de saber en qué idioma tiene cada quien la app. Sin esto,
// los avisos llegarían siempre en español.
export async function activar(uid, idioma) {
  const motivo = motivoNoDisponible()
  if (motivo) return { ok: false, motivo }
  if (!db) return { ok: false, motivo: 'sin-firebase' }
  if (!uid) return { ok: false, motivo: 'sin-sesion' }

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return { ok: false, motivo: 'permiso-' + permiso }

  let suscripcion
  try {
    const registro = await registroListo()
    // Si ya había una de antes, la reutilizamos: volver a suscribir con la
    // misma clave devuelve la misma, pero pedirlo explícitamente evita un
    // error si la clave VAPID cambió.
    suscripcion =
      (await registro.pushManager.getSubscription()) ||
      (await registro.pushManager.subscribe({
        // Obligatorio: nos comprometemos a mostrar una notificación visible
        // por cada aviso que recibamos. El service worker lo cumple.
        userVisibleOnly: true,
        applicationServerKey: base64UrlABytes(VAPID_PUBLICA),
      }))
  } catch (e) {
    return { ok: false, motivo: 'fallo-suscripcion', detalle: e?.message }
  }

  try {
    await guardar(uid, suscripcion, idioma)
  } catch (e) {
    // Si no se pudo guardar, deshacemos la suscripción: dejarla viva sin
    // registrar sería un aparato suscrito al que nadie puede escribirle.
    await suscripcion.unsubscribe().catch(() => {})
    return { ok: false, motivo: 'fallo-guardar', detalle: e?.message }
  }

  return { ok: true }
}

// Desactiva los avisos en este aparato y borra su registro.
export async function desactivar(uid) {
  const suscripcion = await suscripcionActual()
  if (!suscripcion) return { ok: true }

  const id = await idDeSuscripcion(suscripcion.endpoint)

  // Primero el navegador: es lo que de verdad detiene los avisos. Si el
  // borrado en Firestore fallara, el vigía se encontraría con un endpoint
  // muerto y lo limpiaría solo en el próximo envío.
  await suscripcion.unsubscribe().catch(() => {})

  if (db && uid) {
    await deleteDoc(doc(db, COLECCION, id)).catch(() => {})
  }

  return { ok: true }
}

async function guardar(uid, suscripcion, idioma) {
  const bruto = suscripcion.toJSON()
  const id = await idDeSuscripcion(suscripcion.endpoint)

  await setDoc(doc(db, COLECCION, id), {
    uid,
    idioma: idioma || 'es',
    endpoint: suscripcion.endpoint,
    // Las dos claves con las que el vigía cifra el aviso. Sin ellas el
    // navegador descarta el mensaje.
    p256dh: bruto.keys?.p256dh || bytesABase64Url(suscripcion.getKey('p256dh')),
    auth: bruto.keys?.auth || bytesABase64Url(suscripcion.getKey('auth')),
    // De qué app viene: los dos repos comparten proyecto de Firebase, así
    // que el vigía de intradía solo debe escribirle a los suyos.
    app: APP,
    creadaEl: serverTimestamp(),
  })
}
