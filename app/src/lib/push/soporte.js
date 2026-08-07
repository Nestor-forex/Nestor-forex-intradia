// ¿Puede este aparato recibir avisos, y si no, por qué no?
//
// La respuesta no es un sí/no: hay un caso intermedio muy común (iPhone con
// la app abierta en Safari en vez de instalada) donde el aparato SÍ puede,
// pero solo después de que la persona instale la app. Ese caso hay que
// explicarlo, no esconderlo detrás de un "no disponible".

// Apple solo entrega avisos push a las apps que están instaladas en la
// pantalla de inicio, no a las abiertas como página en Safari. Es límite de
// Apple, no nuestro: no hay forma de saltárselo. En Android no aplica.
export function esIOS() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  // El iPad moderno miente y dice ser un Mac; se delata por el táctil.
  const iPadDisfrazado = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return /iPad|iPhone|iPod/.test(ua) || iPadDisfrazado
}

// "Instalada" = abierta desde el ícono, no como pestaña del navegador.
export function estaInstalada() {
  if (typeof window === 'undefined') return false
  // `navigator.standalone` es el de Safari; el matchMedia es el estándar.
  return (
    navigator.standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  )
}

// Devuelve por qué no se puede, o null si sí se puede.
//   'no-soportado'      → el navegador no tiene push (nada que hacer)
//   'ios-sin-instalar'  → hay que instalar la app en la pantalla de inicio
export function motivoNoDisponible() {
  if (typeof window === 'undefined') return 'no-soportado'

  const tieneLoBasico =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

  // En iPhone sin instalar, `PushManager` ni siquiera existe, así que este
  // orden importa: primero explicamos el caso que tiene solución.
  if (esIOS() && !estaInstalada()) return 'ios-sin-instalar'
  if (!tieneLoBasico) return 'no-soportado'

  return null
}

// 'granted' | 'denied' | 'default' — o null si el aparato no soporta avisos.
// 'denied' es importante tratarlo aparte: una vez la persona dice que no, el
// navegador NO vuelve a preguntar, y hay que mandarla a los ajustes a mano.
export function permisoActual() {
  if (typeof Notification === 'undefined') return null
  return Notification.permission
}
