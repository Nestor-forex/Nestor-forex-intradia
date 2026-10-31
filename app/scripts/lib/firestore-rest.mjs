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

// Cuánto se espera como mucho a cada petición.
//
// No es una optimización: sin límite, si Google acepta la conexión y luego se
// queda callado, la corrida del vigía se cuelga para siempre. Y como
// `vigia.yml` usa `concurrency` con `cancel-in-progress: false`, una corrida
// colgada haría cola con TODAS las siguientes — el vigía dejaría de vigilar
// sin que nada avise. Diez segundos son de sobra para estas llamadas.
export const MS_LIMITE = 10_000

// Un `fetch` que se rinde en vez de esperar para siempre, y que cuando se
// rinde lo dice con palabras en vez de con un error genérico.
async function pedir(url, opciones, queEs) {
  try {
    return await fetch(url, { ...opciones, signal: AbortSignal.timeout(MS_LIMITE) })
  } catch (e) {
    // `TimeoutError` es el plazo que pusimos; `AbortError` sale si algo más
    // cancela. Los demás errores (DNS, conexión rechazada) pasan tal cual.
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
      throw new Error(`${queEs} no respondió en ${MS_LIMITE / 1000} segundos`)
    }
    throw e
  }
}

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
//
// El ÁMBITO se puede cambiar porque no todo lo que hace falta aquí es leer
// datos: publicar las reglas de seguridad es otra API de Google y pide otro
// permiso. Va como argumento con el valor de siempre por defecto, así que
// quien no lo pase sigue pidiendo exactamente lo de antes — un token pedido
// con más permiso del necesario es permiso regalado.
export async function pedirToken(cuenta, ambito = AMBITO) {
  const ahora = Math.floor(Date.now() / 1000)
  const cabecera = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const cuerpo = base64url(
    JSON.stringify({
      iss: cuenta.client_email,
      scope: ambito,
      aud: URL_TOKEN,
      iat: ahora,
      exp: ahora + 3600,
    })
  )

  const firma = createSign('RSA-SHA256').update(`${cabecera}.${cuerpo}`).sign(cuenta.private_key)
  const jwt = `${cabecera}.${cuerpo}.${base64url(firma)}`

  const r = await pedir(
    URL_TOKEN,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    },
    'Google (autenticación)'
  )

  if (!r.ok) {
    // El cuerpo del error de Google no trae secretos, solo el motivo.
    throw new Error(`No se pudo autenticar contra Google (${r.status}): ${await r.text()}`)
  }
  return (await r.json()).access_token
}

// Firestore devuelve cada campo etiquetado con su tipo
// ({ stringValue: 'x' }). Solo guardamos texto en pushSubs, pero el número y
// el booleano van por si acaso: un campo inesperado no debe reventar el envío.
//
// ⚠️⚠️ LAS LISTAS Y LOS OBJETOS SE AÑADIERON EL 2026-10-31, Y NO ERA UNA
// MEJORA: era un fallo silencioso esperando a ocurrir.
//
// Los avisos que programa cada persona viven en `users/{uid}.avisos`, que es
// una LISTA DE OBJETOS. Antes de esto, ningún `else if` casaba con
// `arrayValue`, así que el campo **no aparecía en el resultado**: no daba
// error, no daba lista vacía — desaparecía. El programa que manda los avisos
// habría leído cero avisos para todo el mundo y habría terminado en verde
// diciendo «nada que mandar», que es indistinguible de que todo va bien.
//
// Es la familia de fallo que este proyecto lleva meses coleccionando, y de la
// peor clase: el silencio que se lee como éxito.
function valorDe(v) {
  if (!v || typeof v !== 'object') return undefined
  // `nullValue` va primero y SÍ devuelve null, no `undefined`: `rearmar`
  // escribe `disparadaEl: null` a propósito para decir «este aviso no ha
  // sonado», y tirar el campo haría que ese «no» no se pudiera distinguir de
  // «nunca se escribió».
  if ('nullValue' in v) return null
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue' in v) return (v.arrayValue?.values || []).map(valorDe)
  if ('mapValue' in v) return planchar(v.mapValue?.fields || {})
  // Un tipo que no conocemos (geoPoint, bytes, referencia) no se inventa.
  return undefined
}

export function planchar(campos = {}) {
  const salida = {}
  for (const [k, v] of Object.entries(campos)) {
    const x = valorDe(v)
    // `undefined` es «no supe leerlo»; `null` es un valor de verdad y pasa.
    if (x !== undefined) salida[k] = x
  }
  return salida
}

// El camino de vuelta de `planchar`: de valores normales a los sobres con
// etiqueta de tipo que Firestore exige al escribir.
//
// ⚠️ `integerValue` viaja como TEXTO, no como número — lo pide así la API. Un
// entero mandado como número se rechaza con un error que no dice por qué.
// Y los enteros van antes que los decimales porque `1` mandado como
// `doubleValue` vuelve leído como `1.0`.
// ⚠️ El ORDEN de las ramas no es estético: `Date` y `Array` son objetos, así
// que si la rama genérica de objeto fuera antes, una fecha se guardaría como
// un mapa vacío y una lista como un objeto con claves «0», «1», «2»… En los
// dos casos sin dar ningún error.
function sobreDe(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(sobreDe) } }
  if (typeof v === 'object') return { mapValue: { fields: etiquetar(v) } }
  return { stringValue: String(v) }
}

export function etiquetar(campos = {}) {
  const salida = {}
  for (const [k, v] of Object.entries(campos)) salida[k] = sobreDe(v)
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

        const r = await pedir(url, { headers: cabeceras }, `Firestore (leer ${coleccion})`)
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
    //
    // Tampoco revienta si se acaba el plazo: esto es limpieza, no el trabajo
    // principal. Una suscripción muerta que sobreviva una hora más no le hace
    // daño a nadie; tumbar el envío por no poder borrarla, sí.
    async borrar(ruta) {
      try {
        const r = await pedir(
          `https://firestore.googleapis.com/v1/${ruta}`,
          { method: 'DELETE', headers: cabeceras },
          'Firestore (borrar)'
        )
        return r.ok || r.status === 404
      } catch {
        return false
      }
    },

    // Cambia UNOS CUANTOS campos de un documento, dejando los demás como
    // estaban. Devuelve true solo si Firestore confirmó la escritura.
    //
    // ⚠️ LOS CAMPOS A TOCAR VAN EN LA DIRECCIÓN (`updateMask`), Y NO ES UN
    // DETALLE. Sin esa lista, Firestore entiende «esto es el documento
    // entero» y BORRA todo lo que no venga: el nombre, el correo, la fecha de
    // alta. Un robot que solo quería cerrar una puerta dejaría la ficha
    // vacía, y con el correo fuera ni el administrador sabría de quién era.
    //
    // ⚠️ Y aquí NO se traga el error, al revés que en `borrar`. Allí lo peor
    // que pasa es que una suscripción muerta viva una hora más. Aquí lo que
    // se escribe es quién entra y quién no: si la escritura falla hay que
    // enterarse, no seguir como si nada.
    async actualizar(ruta, campos) {
      const claves = Object.keys(campos ?? {})
      if (!claves.length) return false

      const url = new URL(`https://firestore.googleapis.com/v1/${ruta}`)
      for (const k of claves) url.searchParams.append('updateMask.fieldPaths', k)

      const r = await pedir(
        url,
        {
          method: 'PATCH',
          headers: { ...cabeceras, 'content-type': 'application/json' },
          body: JSON.stringify({ fields: etiquetar(campos) }),
        },
        'Firestore (actualizar)'
      )
      if (!r.ok) throw new Error(`No se pudo actualizar ${ruta} (${r.status}): ${await r.text()}`)
      return true
    },
  }
}
