import { useEffect, useState } from 'react'

import { clave } from './identidad.js'

// LEE `estado/noticias.json`, que publica `publicar-noticias.mjs` (2026-11-13).
//
// ⚠️ Las DOS apps leen el archivo de la rama `datos` de SWING, igual que la
// tarjeta del puente de MT5: las noticias de un banco central son las mismas
// para velas diarias que para velas de una hora, y dos publicadores bajando lo
// mismo serían el doble de peticiones a sitios que piden moderación (el Banco
// de la Reserva de Nueva Zelanda pone un tope por hora). Por eso este archivo
// es GEMELO.
//
// Sin conexión se pinta la copia guardada: cada titular lleva su fecha, así que
// una copia de ayer se lee como de ayer.
const URL_NOTICIAS = 'https://raw.githubusercontent.com/Nestor-forex/Nestor-forex/datos/estado/noticias.json'

const CACHE_KEY = clave('noticias_v1')
const LIMITE_MS = 12_000

export function useNoticias() {
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    let cancelado = false
    try {
      const guardado = JSON.parse(localStorage.getItem(CACHE_KEY))
      if (Array.isArray(guardado?.noticias)) setDatos(guardado)
    } catch {
      // Sin almacenamiento: se sigue sin copia.
    }

    fetch(URL_NOTICIAS, { signal: AbortSignal.timeout(LIMITE_MS), cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status)
        return r.json()
      })
      .then((json) => {
        if (cancelado || !Array.isArray(json?.noticias)) return
        setDatos(json)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(json))
        } catch {
          // Sin espacio o en modo privado: es solo la copia.
        }
      })
      .catch(() => {
        // En silencio: sin archivo, la tarjeta no se pinta.
      })

    return () => {
      cancelado = true
    }
  }, [])

  return datos
}
