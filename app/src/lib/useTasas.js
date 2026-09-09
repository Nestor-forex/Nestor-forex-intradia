import { useEffect, useState } from 'react'

import { clave } from './identidad.js'

// Baja las tasas de los bancos centrales que publica
// `scripts/publicar-tasas.mjs`.
//
// ⚠️ POR QUÉ CADA APP PUBLICA Y LEE SU PROPIO ARCHIVO, si el contenido es
// idéntico (las 8 divisas son las mismas): por el mismo motivo que con
// `useCalendario`. Si Intradía leyera el archivo de Swing, un fallo del
// workflow de Swing dejaría a Intradía sin tasas y nadie sabría dónde buscar.
// Bajar el CSV del BIS no cuesta ni un crédito de Twelve Data, así que la
// independencia sale gratis.
//
// (El puente de MT5 es la excepción, y por una razón distinta: allí el archivo
// lo escribe un programa que corre en el computador de Néstor, y tener dos
// sería tener que arrancar dos cada mañana.)
const URL_TASAS =
  'https://raw.githubusercontent.com/Nestor-forex/nestor-forex-intradia/datos/estado/tasas.json'

// Con el prefijo de ESTA app: quien tenga las dos instaladas no debe pisarse la
// caché entre ellas. Ver `identidad.js`.
const CACHE_KEY = clave('tasas_v1')
const LIMITE_MS = 12_000

// ⚠️ ESTE HOOK NUNCA DEVUELVE UN ERROR A LA PANTALLA.
//
// Si las tasas no se pueden bajar, devuelve `null` y la tarjeta sencillamente
// no sale. Misma decisión que `useCalendario` y `correl`, y CONTRARIA a la de
// `setupsCaida`: aquí una ausencia solo cuesta una tarjeta que no se ve; allá
// se confundiría con «hoy no hubo señales» y borraría historial.
export function useTasas() {
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    let cancelado = false

    const leerCache = () => {
      try {
        const guardado = JSON.parse(localStorage.getItem(CACHE_KEY))
        return guardado?.tasas && typeof guardado.tasas === 'object' ? guardado : null
      } catch {
        return null
      }
    }

    // La caché se pinta ANTES de pedir nada. Y aquí es más útil que en ningún
    // otro sitio: una tasa de referencia cambia una vez cada varias semanas,
    // así que la copia guardada casi siempre sigue siendo EXACTA, no solo
    // aprovechable. Cada fila enseña su propia fecha de todos modos.
    const guardado = leerCache()
    if (guardado) setDatos(guardado)

    fetch(URL_TASAS, { signal: AbortSignal.timeout(LIMITE_MS), cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status)
        return r.json()
      })
      .then((json) => {
        if (cancelado) return
        if (!json?.tasas || typeof json.tasas !== 'object') throw new Error('sin tasas')
        setDatos(json)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(json))
        } catch {
          // Sin espacio o en modo privado: da igual, es solo la copia.
        }
      })
      .catch(() => {
        // A propósito en silencio. Ver el comentario de arriba.
      })

    return () => {
      cancelado = true
    }
  }, [])

  return datos
}
