// Estado del idioma para la interfaz: lo elige el usuario, se guarda, y se
// aplica al documento (lang y dir) para que el navegador lo trate bien.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { CODIGOS, IDIOMA_BASE, esRTL, localeDe } from './idiomas.js'
import { crearT } from './crearT.js'
import { clave } from '../identidad'

const CLAVE = clave('idioma')

// Primera vez: se usa el idioma del teléfono si lo tenemos traducido. Se mira
// la lista completa de preferencias (no solo la primera), porque mucha gente
// tiene el sistema en un idioma y como segunda opción el suyo.
function idiomaDelDispositivo() {
  const preferidos = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : []
  for (const pref of preferidos) {
    if (!pref) continue
    const corto = String(pref).toLowerCase().split('-')[0]
    if (CODIGOS.includes(corto)) return corto
  }
  return IDIOMA_BASE
}

function idiomaInicial() {
  try {
    const guardado = localStorage.getItem(CLAVE)
    if (guardado && CODIGOS.includes(guardado)) return guardado
  } catch {
    // localStorage bloqueado (modo privado en algunos navegadores): no es
    // motivo para romper la app, solo se pierde la preferencia entre visitas.
  }
  return idiomaDelDispositivo()
}

const Ctx = createContext(null)

export function IdiomaProvider({ children }) {
  const [idioma, setIdiomaState] = useState(idiomaInicial)

  const setIdioma = useCallback((codigo) => {
    if (!CODIGOS.includes(codigo)) return
    setIdiomaState(codigo)
    try {
      localStorage.setItem(CLAVE, codigo)
    } catch {
      // ver nota de arriba
    }
  }, [])

  // El árabe se escribe de derecha a izquierda: con dir="rtl" el navegador
  // voltea solo el orden del texto, los márgenes lógicos y el scroll.
  useEffect(() => {
    const raiz = document.documentElement
    raiz.setAttribute('lang', idioma)
    raiz.setAttribute('dir', esRTL(idioma) ? 'rtl' : 'ltr')
  }, [idioma])

  const valor = useMemo(
    () => ({ idioma, setIdioma, t: crearT(idioma), locale: localeDe(idioma), rtl: esRTL(idioma) }),
    [idioma, setIdioma]
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useIdioma() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useIdioma debe usarse dentro de <IdiomaProvider>')
  return v
}

// Atajo para el caso común: solo traducir.
export function useT() {
  return useIdioma().t
}
