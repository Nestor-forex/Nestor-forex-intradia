// Manda un aviso de prueba REAL a todos los aparatos suscritos.
//
// Existe porque el vigía no sirve para comprobar los avisos: solo manda algo
// cuando aparece una señal nueva, y antes de eso descarga los precios de
// Twelve Data, que tiene un límite de consultas por minuto muy justo. Si el
// límite salta, el vigía se cae antes de llegar a los avisos y no aprendemos
// nada sobre ellos.
//
// Esto en cambio no toca la fuente de precios: va directo a Firestore, lee
// las suscripciones y manda un aviso fijo. Comprueba de una vez toda la
// cadena que de otro modo habría que esperar días a que se pruebe sola:
//   · que el secreto FIREBASE_SERVICE_ACCOUNT esté bien pegado
//   · que la cuenta de servicio pueda leer la colección pushSubs
//   · que el secreto VAPID_PRIVATE_KEY case con la clave pública de la app
//   · que el aviso llegue de verdad al celular
//
// Se lanza a mano desde la pestaña Actions de GitHub. No corre solo nunca.

import webpush from 'web-push'
import { VAPID_PUBLICA } from '../src/lib/push/vapid.js'
import { abrir, leerCuentaDeServicio } from './lib/firestore-rest.mjs'
import { APP, COLECCION, MS_POR_AVISO } from './lib/push-envio.mjs'

const fallar = (mensaje) => {
  console.log(`\n❌ ${mensaje}\n`)
  process.exit(1)
}

console.log('--- PRUEBA DE AVISOS ---\n')

// 1. Las claves ---------------------------------------------------------
const privada = (process.env.VAPID_PRIVATE_KEY || '').trim()
if (!privada) fallar('Falta el secreto VAPID_PRIVATE_KEY en el repositorio.')

let cuenta
try {
  cuenta = leerCuentaDeServicio()
} catch (e) {
  fallar(e.message)
}
if (!cuenta) fallar('Falta el secreto FIREBASE_SERVICE_ACCOUNT en el repositorio.')

console.log('1. Claves')
console.log('   ✓ VAPID_PRIVATE_KEY está puesta')
console.log(`   ✓ FIREBASE_SERVICE_ACCOUNT está puesta (proyecto ${cuenta.project_id})`)

// 2. Leer las suscripciones --------------------------------------------
console.log('\n2. Leer las suscripciones de Firestore')
let suscripciones
try {
  const bd = await abrir(cuenta)
  suscripciones = (await bd.listar(COLECCION)).filter((s) => s.app === APP && s.endpoint)
} catch (e) {
  fallar(
    `No se pudieron leer las suscripciones: ${e.message}\n` +
      '   Suele significar que el JSON de la cuenta de servicio quedó mal pegado,\n' +
      '   o que es de otro proyecto de Firebase.'
  )
}

console.log(`   ✓ Firestore respondió. Aparatos suscritos a "${APP}": ${suscripciones.length}`)

if (!suscripciones.length) {
  fallar(
    'No hay ningún aparato suscrito todavía.\n' +
      '   Abre la app INSTALADA (no en el navegador), pestaña Barrido →\n' +
      '   "Avisos al celular" → Activar avisos. Después vuelve a lanzar esto.'
  )
}

// Los idiomas sí se pueden decir: no son credenciales. Las direcciones de
// envío NO se imprimen nunca — con una, cualquiera le manda avisos a ese
// celular, y los registros de Actions son públicos.
const idiomas = suscripciones.map((s) => s.idioma || 'es')
console.log(`   · idiomas de los aparatos: ${[...new Set(idiomas)].join(', ')}`)

// 3. Mandar el aviso ----------------------------------------------------
console.log('\n3. Mandar el aviso de prueba')
webpush.setVapidDetails('mailto:nesdian2204@gmail.com', VAPID_PUBLICA, privada)

const mensaje = JSON.stringify({
  titulo: 'Prueba desde el vigía',
  cuerpo: 'Si ves esto, los avisos funcionan de punta a punta. Ya puedes esperar señales reales.',
  tag: 'prueba-servidor',
  url: './',
  en: new Date().toISOString(),
})

let enviados = 0
const problemas = []

for (const sub of suscripciones) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      mensaje,
      { timeout: MS_POR_AVISO }
    )
    enviados++
  } catch (e) {
    problemas.push(e?.statusCode ?? '?')
  }
}

console.log(`   entregados: ${enviados} de ${suscripciones.length}`)
if (problemas.length) console.log(`   con problema: ${problemas.length} (códigos: ${problemas.join(', ')})`)

// 4. Veredicto ----------------------------------------------------------
console.log('\n--- RESULTADO ---')
if (enviados > 0) {
  console.log('✅ El aviso salió. Mira el celular: te debe haber sonado.')
  console.log('   Si NO sonó pero aquí dice que salió, el problema está en el')
  console.log('   celular (permiso quitado, app desinstalada, modo silencio),')
  console.log('   no en el servidor.')
} else {
  console.log('❌ Ningún aviso pudo entregarse.')
  console.log('   Código 401 o 403 → la clave VAPID privada no case con la pública de la app.')
  console.log('   Código 404 o 410 → la suscripción ya no existe: hay que volver a activarla.')
  process.exit(1)
}
