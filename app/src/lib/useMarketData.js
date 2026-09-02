import { useEffect, useMemo, useRef, useState } from 'react'
import { computarBarrido, derivarVista } from './marketCalc'
import { useT } from './i18n'

// v2: la caché guardada ahora incluye el máximo y el mínimo de cada vela. Se
// cambia la clave para que una caché vieja (solo cierres) no se lea como si
// tuviera rangos.
const CACHE_KEY = 'nfi_market_cache_v2'
const REFRESH_MS = 15 * 60 * 1000 // refrescar cada 15 min mientras la app está abierta
const SYMBOLS = ['USD/EUR', 'USD/GBP', 'USD/JPY', 'USD/CHF', 'USD/AUD', 'USD/NZD', 'USD/CAD']
const SYM_TO_CCY = { 'USD/EUR': 'EUR', 'USD/GBP': 'GBP', 'USD/JPY': 'JPY', 'USD/CHF': 'CHF', 'USD/AUD': 'AUD', 'USD/NZD': 'NZD', 'USD/CAD': 'CAD' }

const apiKey = import.meta.env.VITE_TWELVEDATA_KEY

function leerCache() {
  const cacheRaw = localStorage.getItem(CACHE_KEY)
  if (!cacheRaw) return null
  try {
    const cache = JSON.parse(cacheRaw)
    if (cache.barras && cache.rates && cache.rangos && cache.fetchedAt) return cache
  } catch {
    // caché corrupta, se ignora
  }
  return null
}

// Trae las últimas ~100 velas H1 de las 7 divisas contra USD, en una sola
// consulta batch a Twelve Data, y arma la grilla { timestamp: { EUR, GBP, ... } }
// que espera marketCalc.js — alineando solo las horas que trajeron dato en
// las 7 divisas (evita huecos si alguna par cerró antes por feriado local).
async function obtenerVelas() {
  const r = await fetch(
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(SYMBOLS.join(','))}&interval=1h&outputsize=300&timezone=UTC&apikey=${apiKey}`
  )
  if (!r.ok) throw new Error('HTTP ' + r.status)
  const j = await r.json()

  const porSimbolo = {}
  for (const sym of SYMBOLS) {
    const bloque = j[sym]
    if (!bloque || bloque.status === 'error' || !Array.isArray(bloque.values)) {
      throw new Error(`sin datos de ${sym}${bloque?.message ? ' — ' + bloque.message : ''}`)
    }
    const mapa = new Map()
    // La misma respuesta trae apertura, máximo, mínimo y cierre; antes solo
    // se guardaba el cierre y se descartaba el resto. Sin máximo y mínimo no
    // hay ATR real ni pivotes reales, y ambos ya venían pagados en la
    // consulta: aprovecharlos no cuesta ni una llamada más.
    for (const v of bloque.values) mapa.set(v.datetime, { c: parseFloat(v.close), h: parseFloat(v.high), l: parseFloat(v.low) })
    porSimbolo[sym] = mapa
  }

  const primero = porSimbolo[SYMBOLS[0]]
  const barras = [...primero.keys()].filter((t) => SYMBOLS.every((sym) => porSimbolo[sym].has(t))).sort()

  if (barras.length < 60) throw new Error('no hay suficientes velas recientes para calcular los indicadores')

  const rates = {}
  const rangos = {}
  for (const t of barras) {
    const fila = {}
    const filaRangos = {}
    for (const sym of SYMBOLS) {
      const v = porSimbolo[sym].get(t)
      const ccy = SYM_TO_CCY[sym]
      fila[ccy] = v.c
      // Si alguna vela llegara sin máximo/mínimo, se usa el cierre para esa
      // hora en vez de romper todo el barrido.
      filaRangos[ccy] = { h: Number.isFinite(v.h) ? v.h : v.c, l: Number.isFinite(v.l) ? v.l : v.c }
    }
    rates[t] = fila
    rangos[t] = filaRangos
  }

  return { barras, rates, rangos }
}

// Descarga velas frescas, o si falla (sin conexión, cuota agotada) reutiliza
// la última copia guardada marcándola como "stale".
async function obtenerRates() {
  const cache = leerCache()
  try {
    const { barras, rates, rangos } = await obtenerVelas()
    const fetchedAt = new Date().toISOString()
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt, barras, rates, rangos }))
    return { barras, rates, rangos, fetchedAt, stale: false }
  } catch (e) {
    if (cache) return { barras: cache.barras, rates: cache.rates, rangos: cache.rangos, fetchedAt: cache.fetchedAt, stale: true }
    throw e
  }
}

// Descarga (y refresca cada 15 min) las velas H1 en vivo y calcula el
// barrido intradía. thr = umbral de diferencial para clasificar sesgo,
// topN = setups por lado.
export function useMarketData({ thr = 0.5, topN = 3 } = {}) {
  const t = useT()
  const sinConfigurar = !apiKey
  const [loading, setLoading] = useState(!sinConfigurar)
  // Se guarda el error SIN traducir y se traduce al devolverlo: si se
  // guardara ya traducido, al cambiar de idioma el mensaje se quedaría
  // congelado en el idioma anterior hasta la siguiente descarga.
  const [errorCrudo, setErrorCrudo] = useState(null)
  const [crudo, setCrudo] = useState(null) // { barras, rates } tal como llegan de Twelve Data
  const [stale, setStale] = useState(false)
  const [guardadoEl, setGuardadoEl] = useState(null)
  const primeraCarga = useRef(true)

  useEffect(() => {
    if (sinConfigurar) return
    let cancelado = false

    const cargar = () => {
      if (primeraCarga.current) setLoading(true)
      obtenerRates()
        .then(({ barras, rates, rangos, stale, fetchedAt }) => {
          if (cancelado) return
          setCrudo({ barras, rates, rangos })
          setStale(stale)
          setGuardadoEl(fetchedAt)
          setErrorCrudo(null)
        })
        .catch((e) => {
          if (cancelado) return
          setErrorCrudo(e.message)
        })
        .finally(() => {
          if (!cancelado) {
            setLoading(false)
            primeraCarga.current = false
          }
        })
    }

    cargar()
    const id = setInterval(cargar, REFRESH_MS)
    return () => {
      cancelado = true
      clearInterval(id)
    }
  }, [sinConfigurar])

  // ⚠️ AQUÍ HABÍA UNA CAPA DE PRECIO EN VIVO DE CAPITAL.COM, Y SE QUITÓ.
  //
  // Preguntaba el precio del momento cada 10 segundos y con él "adelantaba" el
  // cierre de la hora en curso, para no esperar al refresco de Twelve Data.
  // La idea era buena; el precio que se pagaba por ella, no.
  //
  // Para autenticarse hacían falta tres cosas —clave de API, usuario y
  // CONTRASEÑA— y como el navegador es quien preguntaba, las tres viajaban
  // dentro del JavaScript que descarga cualquiera que abra la app. Se comprobó
  // buscándolas en el archivo publicado: estaban ahí, en texto claro, y la
  // clave tenía permiso de "leer y operar", no solo de leer.
  //
  // La cuenta era demo y no había dinero en juego, así que el daño posible era
  // limitado. Lo que no era limitado era el hábito: el mismo camino con una
  // cuenta real habría publicado unas credenciales reales.
  //
  // NO se sustituye por otra cosa. Un precio al segundo necesita un servidor
  // encendido todo el rato que guarde la credencial, y este proyecto no tiene
  // ninguno: solo robots que corren a ratos. Cualquier apaño que deje la clave
  // en el navegador es el mismo agujero con otro nombre.
  //
  // Qué se pierde en la práctica: la app calcula sobre velas de una hora YA
  // CERRADAS, y esas no cambian. Lo único que se pierde es que el precio de la
  // hora en curso se refresca cada 15 minutos en vez de cada 10 segundos.
  // Ninguna señal cambia por eso.
  const data = useMemo(
    () => (crudo ? computarBarrido(crudo.barras, crudo.rates, crudo.rangos) : null),
    [crudo]
  )

  const vista = data ? derivarVista(data, { thr, topN, t }) : null

  return {
    loading,
    error: errorCrudo ? t('barrido.errorPrecios', { detalle: errorCrudo }) : null,
    sinConfigurar,
    stale,
    guardadoEl,
    ultima: data?.ultima ?? null,
    ratesUSD: data?.ratesUSD ?? null,
    monedas: vista?.monedas ?? [],
    pares: vista?.pares ?? [],
    compras: vista?.compras ?? [],
    ventas: vista?.ventas ?? [],
    vigilancia: vista?.vigilancia ?? [],
    rangos: vista?.rangos ?? [],
    sesion: vista?.sesion ?? null,
    setups: vista?.setups ?? [],
    corte: vista?.corte ?? '…',
  }
}
