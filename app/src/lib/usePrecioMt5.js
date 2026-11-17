// EL PRECIO DE MT5, AL SEGUNDO CUANDO SE PUEDE (2026-11-17).
//
// Néstor eligió el precio al segundo con el plan de pago de Firebase. El
// puente de su computador escribe el documento `vivo/precios` de Firestore
// cada segundo (solo si el precio cambió), y esta app lo ESCUCHA en vez de
// bajar un archivo cada dos minutos.
//
// Junta dos fuentes, y la pantalla dice siempre cuál ve:
//
//   1. `vivo/precios` en Firestore — BID y ASK al segundo. Solo mientras el
//      puente NUEVO esté encendido.
//   2. `estado/mt5.json` de la rama `datos` — la foto de cada 5 minutos, que
//      además trae el swap y la actividad. Es lo que ya había (`useMT5Quotes`).
//
// Si la 1 no llega o es vieja, manda la 2; si la 2 también es vieja, quien lo
// pinta pasa a Twelve Data (`fuenteDePrecios`).
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ LAS DECISIONES QUE NO HAY QUE ABLANDAR
// ─────────────────────────────────────────────────────────────────────────
//
// · UNA SOLA ESCUCHA POR APP, aunque la pidan tres pantallas a la vez. Cada
//   cambio del documento que llega a un teléfono es UNA lectura de Firestore,
//   y lo que se paga son lecturas. Por eso la escucha vive fuera de React y
//   cada pantalla solo se apunta a ella.
//
// · CON LA APP EN SEGUNDO PLANO NO SE ESCUCHA. Es dinero y batería gastados
//   en una pantalla que nadie tiene delante. Se vuelve a escuchar al volver.
//
// · CADA PANTALLA ELIGE CADA CUÁNTO SE REDIBUJA (`cadaMs`). La lectura se paga
//   igual, pero redibujar la app entera cada segundo en un teléfono no tiene
//   sentido para una línea que dice de dónde sale el precio. La tabla de
//   precios y el Analizador piden 1 segundo; la cabecera, 15.
//
// · SI FIRESTORE DICE QUE NO (sin permiso, sin red), NO SE REINTENTA EN BUCLE:
//   se deja de escuchar y se prueba otra vez al volver a la app. Mientras
//   tanto manda el archivo, y la pantalla lo dice.
//
// GEMELO: el puente es uno para las dos apps; cada una filtra sus pares.

import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import { PAIR_NAMES } from './pairs.js'
import { normalizarRespuesta, useMT5Quotes } from './useMT5Quotes'
import { combinarConVivo } from './precioVivo'

// ── La escucha compartida ────────────────────────────────────────────────
let ultimo = null
const oyentes = new Set()
let dejarDeEscuchar = null

function avisarATodos() {
  for (const f of oyentes) f()
}

function escuchar() {
  if (dejarDeEscuchar || !db || !oyentes.size) return
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
  dejarDeEscuchar = onSnapshot(
    doc(db, 'vivo', 'precios'),
    (s) => {
      ultimo = s.exists() ? s.data() : null
      avisarATodos()
    },
    () => {
      // Sin permiso o sin red: se para y se reintenta al volver a la app.
      dejarDeEscuchar = null
    },
  )
}

function parar() {
  if (dejarDeEscuchar) dejarDeEscuchar()
  dejarDeEscuchar = null
}

function alCambiarVisibilidad() {
  if (document.visibilityState === 'hidden') parar()
  else escuchar()
}

// ── El hook ──────────────────────────────────────────────────────────────

/**
 * Devuelve lo mismo que `useMT5Quotes` más `alSegundo` (true si el precio que
 * se ve es el de Firestore, de hace menos de EDAD_MAX_VIVO_S segundos).
 */
export function usePrecioMt5({ pares = PAIR_NAMES, cadaMs = 1000 } = {}) {
  const archivo = useMT5Quotes({ pares })
  const [vivo, setVivo] = useState(ultimo)
  // Un reloj que obliga a recalcular la edad aunque no llegue nada: si el
  // puente se apaga no llegan más fotos, y sin esto la app seguiría diciendo
  // «al segundo» con un precio que ya no se mueve.
  const [, setTic] = useState(0)

  useEffect(() => {
    let ultimaVez = 0
    let pendiente = null
    const alLlegar = () => {
      const falta = cadaMs - (Date.now() - ultimaVez)
      if (falta <= 0) {
        ultimaVez = Date.now()
        setVivo(ultimo)
      } else if (!pendiente) {
        pendiente = setTimeout(() => {
          pendiente = null
          ultimaVez = Date.now()
          setVivo(ultimo)
        }, falta)
      }
    }
    oyentes.add(alLlegar)
    if (oyentes.size === 1) document.addEventListener('visibilitychange', alCambiarVisibilidad)
    escuchar()
    const reloj = setInterval(() => setTic((n) => n + 1), 15_000)

    return () => {
      oyentes.delete(alLlegar)
      clearTimeout(pendiente)
      clearInterval(reloj)
      if (!oyentes.size) {
        parar()
        document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      }
    }
  }, [cadaMs])

  const vivoNorm = useMemo(() => {
    if (!vivo) return null
    const todas = normalizarRespuesta(vivo)
    const quotes = {}
    for (const p of pares) if (todas[p]) quotes[p] = todas[p]
    return { quotes, actualizadoEl: typeof vivo.actualizadoEl === 'string' ? vivo.actualizadoEl : null }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `pares` es una lista fija
  }, [vivo])

  return combinarConVivo(archivo, vivoNorm)
}
