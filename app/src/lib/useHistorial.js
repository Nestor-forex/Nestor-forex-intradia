import { useEffect, useState } from 'react'
import { resumir } from './historialCalc.js'

// De dónde salen los datos del historial.
//
// El vigía los va escribiendo en la rama `datos` del repositorio, y GitHub
// sirve esos archivos tal cual por https. Así que la app los lee directamente
// de ahí: sin base de datos, sin servidor propio y sin costo. El repositorio
// es público, así que no hace falta ninguna clave.
//
// La alternativa habría sido guardarlos en Firestore, pero eso serían miles
// de escrituras al mes para unos archivos que ya existen y que además
// conviene que sean públicos: son la prueba de si la app acierta.
const BASE = 'https://raw.githubusercontent.com/Nestor-forex/Nestor-forex-intradia/datos/historial'

const LIMITE_MS = 15_000

async function bajarJsonl(archivo) {
  const r = await fetch(`${BASE}/${archivo}`, {
    signal: AbortSignal.timeout(LIMITE_MS),
    // GitHub guarda estos archivos en caché unos minutos; con esto al menos
    // no se suma la caché del propio navegador encima.
    cache: 'no-cache',
  })

  // Todavía no existe: es lo normal hasta que aparezca la primera señal.
  if (r.status === 404) return []
  if (!r.ok) throw new Error(`HTTP ${r.status}`)

  const texto = await r.text()
  const salida = []
  for (const linea of texto.split('\n')) {
    if (!linea.trim()) continue
    try {
      salida.push(JSON.parse(linea))
    } catch {
      // Línea a medias (el vigía escribía justo en ese momento): se salta.
    }
  }
  return salida
}

export function useHistorial() {
  const [estado, setEstado] = useState({ cargando: true, error: '', senales: [], resultados: [] })

  useEffect(() => {
    let vivo = true

    Promise.all([bajarJsonl('senales.jsonl'), bajarJsonl('resultados.jsonl')])
      .then(([senales, resultados]) => {
        if (vivo) setEstado({ cargando: false, error: '', senales, resultados })
      })
      .catch((e) => {
        if (vivo) {
          setEstado({
            cargando: false,
            error: e?.name === 'TimeoutError' ? 'tiempo' : e?.message || 'error',
            senales: [],
            resultados: [],
          })
        }
      })

    return () => {
      vivo = false
    }
  }, [])

  return { ...estado, ...unir(estado.senales, estado.resultados) }
}

// Junta cada señal con su resultado, si ya lo tiene, y las ordena de la más
// reciente a la más vieja.
function unir(senales, resultados) {
  const porClave = new Map(resultados.map((r) => [r.clave, r]))

  const filas = senales
    // Las de sombra no se pintan. Son de un tipo que todavía está en pruebas:
    // el vigía las anota para ir acumulando operaciones reales, pero la app no
    // las da y nadie recibió aviso de ellas. Enseñarlas en el historial sería
    // mostrar operaciones que nunca se le propusieron a nadie — y peor, se
    // leerían como recomendaciones. `resumir` ya las deja fuera del
    // porcentaje; esto las deja fuera de la lista.
    .filter((s) => !s.sombra)
    .map((s) => {
      const r = porClave.get(`${s.id}@${s.vistoEl}`)
      return { ...s, resultado: r?.resultado || 'abierta', pips: r?.pips, exacto: r?.exacto }
    })
    .sort((a, b) => (a.vistoEl < b.vistoEl ? 1 : -1))

  return { filas, resumen: resumir(resultados) }
}
