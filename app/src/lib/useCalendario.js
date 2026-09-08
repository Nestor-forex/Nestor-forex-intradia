import { useEffect, useState } from 'react'

import { clave } from './identidad.js'

// Baja el calendario económico que publica `scripts/publicar-calendario.mjs`.
//
// Va en un archivo APARTE del barrido y en su propio hook, a propósito:
//
//  · el barrido lo publica el vigía una vez al día de lunes a viernes; el
//    calendario se publica cada cuatro horas todos los días, porque el feed
//    cubre la semana en curso y cambia de semana el domingo;
//  · y así un calendario que falle no puede dejar sin barrido a nadie. El
//    barrido es la app; el calendario es contexto.
//
// ⚠️ POR QUÉ CADA APP PUBLICA SU PROPIO CALENDARIO, si el contenido es el mismo
// (las 8 divisas son las mismas en las dos): porque si Intradía leyera el
// archivo de Swing, un fallo del workflow de Swing dejaría a Intradía sin
// calendario y nadie sabría por dónde buscar. Bajar el feed no cuesta ni un
// crédito de Twelve Data, así que la independencia sale gratis. Es el mismo
// criterio que con `useMarketData` y `useHistorial`: cada app lee la rama
// `datos` de SU repositorio.
const URL_CALENDARIO =
  'https://raw.githubusercontent.com/Nestor-forex/nestor-forex-intradia/datos/estado/calendario.json'

// Con el prefijo de ESTA app: quien tenga las dos instaladas no debe pisarse la
// caché entre ellas. Ver `identidad.js`.
const CACHE_KEY = clave('calendario_v1')
const LIMITE_MS = 12_000

// ⚠️ ESTE HOOK NUNCA DEVUELVE UN ERROR A LA PANTALLA.
//
// Si el calendario no se puede bajar, se devuelve `null` y la tarjeta
// sencillamente no sale. Es la misma decisión que con `correl` y la CONTRARIA
// a la de `setupsCaida`, y el criterio es el mismo de siempre: aquí una
// ausencia solo cuesta una tarjeta que no se ve; allá se confundiría con «hoy
// no hubo señales» y se perdería historial.
//
// Poner un mensaje de error rojo por un calendario sería peor que no tenerlo:
// asustaría por algo que no impide operar.
export function useCalendario() {
  const [cal, setCal] = useState(null)

  useEffect(() => {
    let cancelado = false

    const leerCache = () => {
      try {
        const guardado = JSON.parse(localStorage.getItem(CACHE_KEY))
        return Array.isArray(guardado?.eventos) ? guardado : null
      } catch {
        return null
      }
    }

    // La caché se pinta ANTES de pedir nada: sin conexión, el calendario
    // guardado sigue sirviendo, y `estaViejo` se encarga de decir de cuándo
    // es. Un calendario de ayer con su fecha a la vista es útil; uno en blanco
    // no dice nada.
    const guardado = leerCache()
    if (guardado) setCal(guardado)

    fetch(URL_CALENDARIO, { signal: AbortSignal.timeout(LIMITE_MS), cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status)
        return r.json()
      })
      .then((json) => {
        if (cancelado) return
        if (!Array.isArray(json?.eventos)) throw new Error('sin eventos')
        setCal(json)
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

  return cal
}
