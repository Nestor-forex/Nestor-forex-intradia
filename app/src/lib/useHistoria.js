import { useEffect, useState } from 'react'
import { APP } from './identidad.js'

// Las velas guardadas con las que el laboratorio prueba las reglas
// (2026-11-18). Cada app lee SU archivo: velas diarias en Swing, de una hora
// en Intradía. Lo publica una vez al día el programa de cada app.
//
// ⚠️ Se baja SOLO cuando la persona abre el laboratorio (`activo`): pesa unos
// cientos de KB y no tiene sentido que lo baje todo el que abre la app.
//
// Devuelve { historia, cargando, fallo }. Sin archivo, `historia` es null y
// `fallo` dice qué pasó — nunca una historia vacía, que se leería como «esta
// regla no dispara nunca».

const URLS = {
  swing: 'https://raw.githubusercontent.com/Nestor-forex/Nestor-forex/datos/estado/historia.json',
  intradia: 'https://raw.githubusercontent.com/Nestor-forex/Nestor-forex-intradia/datos/estado/historia.json',
}

export const URL_HISTORIA = URLS[APP]

export function historiaValida(h) {
  if (!h || typeof h !== 'object' || !Array.isArray(h.fechas) || h.fechas.length < 30) return false
  if (!h.pares || typeof h.pares !== 'object') return false
  return Object.values(h.pares).some((s) => s && Array.isArray(s.c) && s.c.length >= 30)
}

export function useHistoria(activo) {
  const [estado, setEstado] = useState({ historia: null, cargando: false, fallo: null })

  useEffect(() => {
    if (!activo || estado.historia) return
    let vivo = true
    setEstado((e) => ({ ...e, cargando: true, fallo: null }))
    fetch(URL_HISTORIA, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw Object.assign(new Error('http'), { codigo: r.status })
        return r.json()
      })
      .then((h) => {
        if (!vivo) return
        if (!historiaValida(h)) throw Object.assign(new Error('formato'), { tipo: 'formato' })
        setEstado({ historia: h, cargando: false, fallo: null })
      })
      .catch((e) => {
        if (!vivo) return
        const fallo = e?.codigo ? `http ${e.codigo}` : e?.tipo === 'formato' ? 'formato' : 'conexion'
        setEstado({ historia: null, cargando: false, fallo })
      })
    return () => {
      vivo = false
    }
  }, [activo, estado.historia])

  return estado
}
