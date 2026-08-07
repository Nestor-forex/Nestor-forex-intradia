// Acceso a Firestore desde el vigía, que corre en GitHub Actions.
//
// Aquí NO se usa `firebase-admin`. Solo hace falta leer una colección y
// borrar documentos muertos, y el SDK de administrador arrastra decenas de
// megas que habría que instalar 24 veces al día. Con la API REST y un token
// firmado a mano son unas 80 líneas y ninguna dependencia.
//
// La cuenta de servicio se salta las reglas de seguridad de Firestore a
// propósito: es la única forma de que el vigía lea las suscripciones de
// TODOS los usuarios. Por eso su clave es un secreto del repositorio y no
// puede acabar nunca en el código ni en los logs.

import { createSign } from 'node:crypto'

const AMBITO = 'https://www.googleapis.com/auth/datastore'
const URL_TOKEN = 'https://oauth2.googleapis.com/token'

// Lee la cuenta de servicio del entorno. Devuelve null si no está puesta,
// para que el vigía pueda seguir anotando señales aunque los avisos no estén
// configurados todavía.
export function leerCuentaDeServicio(entorno = process.env) {
  const bruto = entorno.FIREBASE_SERVICE_ACCOUNT
  if (!bruto || !bruto.trim()) return null

  let cuenta
  try {
    cuenta = JSON.parse(bruto)
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT no es un JSON válido. ¿Se pegó el archivo completo?')
  }

  for (const campo of ['client_email', 'private_key', 'project_id']) {
    if (!cuenta[campo]) throw new Error(`A FIREBASE_SERVICE_ACCOUNT le falta el campo "${campo}".`)
  }
  return cuenta
}

const base64url = (x) =>
  Buffer.from(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// Un token de acceso dura una hora; el vigía corre y se muere en segundos,
// así que se pide uno nuevo en cada corrida y no hace falta cachearlo.
async function pedirToken(cuenta) {
  const ahora = Math.floor(Date.now() / 1000)
  const cabecera = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const cuerpo = base64url(
    JSON.stringify({
      iss: cuenta.client_email,
      scope: AMBITO,
      aud: URL_TOKEN,
      iat: ahora,
      exp: ahora + 3600,
    })
  )

  const firma = createSign('RSA-SHA256').update(`${cabecera}.${cuerpo}`).sign(cuenta.private_key)
  const jwt = `${cabecera}.${cuerpo}.${base64url(firma)}`

  const r = await fetch(URL_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!r.ok) {
    // El cuerpo del error de Google no trae secretos, solo el motivo.
    throw new Error(`No se pudo autenticar contra Google (${r.status}): ${await r.text()}`)
  }
  return (await r.json()).access_token
}

// Firestore devuelve cada campo etiquetado con su tipo
// ({ stringValue: 'x' }). Solo guardamos texto en pushSubs, pero el número y
// el booleano van por si acaso: un campo inesperado no debe reventar el envío.
function planchar(campos = {}) {
  const salida = {}
  for (const [k, v] of Object.entries(campos)) {
    if ('stringValue' in v) salida[k] = v.stringValue
    else if ('integerValue' in v) salida[k] = Number(v.integerValue)
    else if ('doubleValue' in v) salida[k] = v.doubleValue
    else if ('booleanValue' in v) salida[k] = v.booleanValue
    else if ('timestampValue' in v) salida[k] = v.timestampValue
  }
  return salida
}

export async function abrir(cuenta) {
  const token = await pedirToken(cuenta)
  const base = `https://firestore.googleapis.com/v1/projects/${cuenta.project_id}/databases/(default)/documents`
  const cabeceras = { authorization: `Bearer ${token}` }

  return {
    // Todos los documentos de una colección, paginando hasta el final.
    async listar(coleccion) {
      const documentos = []
      let pagina = ''

      do {
        const url = new URL(`${base}/${coleccion}`)
        url.searchParams.set('pageSize', '300')
        if (pagina) url.searchParams.set('pageToken', pagina)

        const r = await fetch(url, { headers: cabeceras })
        if (!r.ok) throw new Error(`No se pudo leer ${coleccion} (${r.status})`)

        const json = await r.json()
        for (const d of json.documents || []) {
          documentos.push({
            // `name` es la ruta completa; es lo que hace falta para borrarlo.
            ruta: d.name,
            id: d.name.split('/').pop(),
            ...planchar(d.fields),
          })
        }
        pagina = json.nextPageToken || ''
      } while (pagina)

      return documentos
    },

    // Borra un documento por su ruta completa. No revienta si ya no está.
    async borrar(ruta) {
      const r = await fetch(`https://firestore.googleapis.com/v1/${ruta}`, {
        method: 'DELETE',
        headers: cabeceras,
      })
      return r.ok || r.status === 404
    },
  }
}
