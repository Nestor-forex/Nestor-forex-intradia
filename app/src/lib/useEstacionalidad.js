import { useEffect, useState } from 'react'

import { clave } from './identidad.js'

// Baja la estacionalidad que publica `scripts/publicar-estacionalidad.mjs`.
//
// PRIMO, no gemelo, y por el mismo motivo que `useCalendario`: cada app
// publica y lee SU archivo. El contenido no es el mismo —aquí hay perfil por
// hora y allá no, y aquí los 11 cruces salen sin panel mensual de recorrido—
// pero aunque lo fuera, si una app leyera el archivo de la otra un fallo del
// workflow de la hermana la dejaría sin tarjeta y nadie sabría dónde buscar.
const URL_DATOS =
  'https://raw.githubusercontent.com/Nestor-forex/Nestor-forex-intradia/datos/estado/estacionalidad.json'

// Con el prefijo de ESTA app: quien tenga las dos instaladas no debe pisarse la
// caché entre ellas. Ver `identidad.js`.
const CACHE_KEY = clave('estacionalidad_v1')
const LIMITE_MS = 12_000

// ⚠️ ESTE HOOK NUNCA DEVUELVE UN ERROR A LA PANTALLA.
//
// Si no se puede bajar, devuelve `null` y la tarjeta sencillamente no sale.
// Misma decisión que `useOro`, `useCot`, `useTasas` y `useCalendario`, y
// CONTRARIA a la de `setupsCaida`: aquí una ausencia solo cuesta una tarjeta
// que no se ve; allá se confundiría con «hoy no hubo señales» y borraría
// historial.
export function useEstacionalidad() {
  const [datos, setDatos] = useState(null)

  useEffect(() => {
    let cancelado = false

    const valido = (j) => j && typeof j === 'object' && j.pares && typeof j.pares === 'object'

    const leerCache = () => {
      try {
        const guardado = JSON.parse(localStorage.getItem(CACHE_KEY))
        return valido(guardado) ? guardado : null
      } catch {
        return null
      }
    }

    // La caché se pinta ANTES de pedir nada. Y como el archivo lleva dentro el
    // tramo de SUS datos (`desde` y `hasta`), una copia vieja se delata sola en
    // pantalla en vez de hacerse pasar por nueva.
    const guardado = leerCache()
    if (guardado) setDatos(guardado)

    fetch(URL_DATOS, { signal: AbortSignal.timeout(LIMITE_MS), cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status)
        return r.json()
      })
      .then((json) => {
        if (cancelado) return
        if (!valido(json)) throw new Error('sin pares')
        setDatos(json)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(json))
        } catch {
          // Sin espacio o en modo privado: da igual, es solo la copia. Y este
          // archivo es el más grande que guarda la app (~20 KB), así que es el
          // primero que puede no caber.
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
