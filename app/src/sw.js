// Service worker propio de la app.
//
// Antes esto lo generaba vite-plugin-pwa solo (`generateSW`) y servía nada
// más para que la app abriera sin internet. Ahora lo escribimos nosotros
// (`injectManifest`) porque hace falta una cosa que el generado no sabe
// hacer: recibir avisos push. Todo lo de la caché sigue igual — Workbox
// hace exactamente lo mismo que antes, solo que ahora somos nosotros los
// que lo llamamos.
//
// Ojo: este archivo NO corre dentro de la app. Corre aparte, en segundo
// plano, y sigue vivo aunque la app esté cerrada. Por eso puede hacer sonar
// el celular. No tiene acceso al DOM ni a React.

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

// `registerType: 'autoUpdate'` en vite.config.js espera que la versión nueva
// tome el control sola, sin pedirle nada al usuario. Con injectManifest eso
// hay que decirlo aquí a mano (con generateSW venía puesto).
self.skipWaiting()
clientsClaim()

// Borra las cachés de versiones viejas de la app.
cleanupOutdatedCaches()

// `self.__WB_MANIFEST` lo reemplaza vite-plugin-pwa al compilar por la lista
// real de archivos de la app. Es lo que permite abrirla sin internet.
precacheAndRoute(self.__WB_MANIFEST)

// ---------------------------------------------------------------------------
// Avisos push
// ---------------------------------------------------------------------------

// Lo que manda el vigía (ver app/scripts/lib/push-envio.mjs). Si algún día
// llega un aviso con otro formato — o sin cuerpo — igual mostramos algo:
// el navegador EXIGE mostrar una notificación por cada push recibido
// (`userVisibleOnly: true`), y si no lo hacemos, el navegador muestra su
// propio aviso genérico de "esta app recibió un mensaje en segundo plano"
// y, si se repite, deja de entregarnos avisos.
const RESPALDO = {
  titulo: 'Nestor Forex Intradía',
  cuerpo: 'Hay novedades en el barrido.',
}

self.addEventListener('push', (evento) => {
  let datos = {}
  try {
    datos = evento.data ? evento.data.json() : {}
  } catch {
    // Llegó algo que no es JSON: lo tratamos como texto del cuerpo.
    datos = { cuerpo: evento.data ? evento.data.text() : '' }
  }

  const titulo = datos.titulo || RESPALDO.titulo
  const cuerpo = datos.cuerpo || RESPALDO.cuerpo

  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: cuerpo,
      icon: iconoAbsoluto('pwa-192.png'),
      badge: iconoAbsoluto('pwa-192.png'),
      // `tag` evita que se apilen dos avisos de la misma señal si por lo que
      // sea llega repetida: el segundo reemplaza al primero en vez de sumarse.
      tag: datos.tag || 'nestor-forex',
      // Que vuelva a sonar aunque reemplace a uno anterior con el mismo tag.
      renotify: Boolean(datos.tag),
      timestamp: datos.en ? Date.parse(datos.en) : Date.now(),
      // Se lo pasamos al click de abajo para saber a dónde abrir.
      data: { url: datos.url || './' },
    })
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()

  const destino = new URL(evento.notification.data?.url || './', self.registration.scope).href

  evento.waitUntil(
    (async () => {
      const abiertas = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      // Si la app ya está abierta en alguna pestaña, la traemos al frente y
      // la mandamos a la señal, en vez de abrir una segunda copia.
      for (const cliente of abiertas) {
        if (cliente.url.startsWith(self.registration.scope)) {
          await cliente.focus()
          if ('navigate' in cliente) await cliente.navigate(destino)
          return
        }
      }

      await self.clients.openWindow(destino)
    })()
  )
})

// Los íconos hay que darlos como URL absoluta: el service worker no resuelve
// rutas relativas contra la página, y en producción la app no vive en la raíz
// del dominio sino en /Nestor-forex-intradia/.
function iconoAbsoluto(archivo) {
  return new URL(archivo, self.registration.scope).href
}
