import { useEffect, useMemo, useRef, useState } from 'react'
import { computarBarrido, derivarVista } from './marketCalc'
import { useCapitalLive } from './useCapitalLive'

const CACHE_KEY = 'nfi_market_cache_v1'
const REFRESH_MS = 15 * 60 * 1000 // refrescar cada 15 min mientras la app está abierta
const SYMBOLS = ['USD/EUR', 'USD/GBP', 'USD/JPY', 'USD/CHF', 'USD/AUD', 'USD/NZD', 'USD/CAD']
const SYM_TO_CCY = { 'USD/EUR': 'EUR', 'USD/GBP': 'GBP', 'USD/JPY': 'JPY', 'USD/CHF': 'CHF', 'USD/AUD': 'AUD', 'USD/NZD': 'NZD', 'USD/CAD': 'CAD' }

const apiKey = import.meta.env.VITE_TWELVEDATA_KEY

function leerCache() {
  const cacheRaw = localStorage.getItem(CACHE_KEY)
  if (!cacheRaw) return null
  try {
    const cache = JSON.parse(cacheRaw)
    if (cache.barras && cache.rates && cache.fetchedAt) return cache
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
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(SYMBOLS.join(','))}&interval=1h&outputsize=100&timezone=UTC&apikey=${apiKey}`
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
    for (const v of bloque.values) mapa.set(v.datetime, parseFloat(v.close))
    porSimbolo[sym] = mapa
  }

  const primero = porSimbolo[SYMBOLS[0]]
  const barras = [...primero.keys()].filter((t) => SYMBOLS.every((sym) => porSimbolo[sym].has(t))).sort()

  if (barras.length < 60) throw new Error('no hay suficientes velas recientes para calcular los indicadores')

  const rates = {}
  for (const t of barras) {
    const fila = {}
    for (const sym of SYMBOLS) fila[SYM_TO_CCY[sym]] = porSimbolo[sym].get(t)
    rates[t] = fila
  }

  return { barras, rates }
}

// Descarga velas frescas, o si falla (sin conexión, cuota agotada) reutiliza
// la última copia guardada marcándola como "stale".
async function obtenerRates() {
  const cache = leerCache()
  try {
    const { barras, rates } = await obtenerVelas()
    const fetchedAt = new Date().toISOString()
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt, barras, rates }))
    return { barras, rates, fetchedAt, stale: false }
  } catch (e) {
    if (cache) return { barras: cache.barras, rates: cache.rates, fetchedAt: cache.fetchedAt, stale: true }
    throw e
  }
}

// Descarga (y refresca cada 15 min) las velas H1 en vivo y calcula el
// barrido intradía. thr = umbral de diferencial para clasificar sesgo,
// topN = setups por lado.
export function useMarketData({ thr = 0.5, topN = 3 } = {}) {
  const sinConfigurar = !apiKey
  const [loading, setLoading] = useState(!sinConfigurar)
  const [error, setError] = useState(null)
  const [crudo, setCrudo] = useState(null) // { barras, rates } tal como llegan de Twelve Data
  const [stale, setStale] = useState(false)
  const [guardadoEl, setGuardadoEl] = useState(null)
  const primeraCarga = useRef(true)
  const { filaViva, actualizadoEl: vivoActualizadoEl, configurado: vivoConfigurado } = useCapitalLive()

  useEffect(() => {
    if (sinConfigurar) return
    let cancelado = false

    const cargar = () => {
      if (primeraCarga.current) setLoading(true)
      obtenerRates()
        .then(({ barras, rates, stale, fetchedAt }) => {
          if (cancelado) return
          setCrudo({ barras, rates })
          setStale(stale)
          setGuardadoEl(fetchedAt)
          setError(null)
        })
        .catch((e) => {
          if (cancelado) return
          setError('No se pudieron obtener los precios en vivo (' + e.message + '). Revisa la conexión y recarga.')
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

  // Si Capital.com trae un precio en vivo más fresco, reemplaza el cierre de
  // la vela más reciente antes de recalcular — así los indicadores reflejan
  // el precio de ahora mismo en vez del último refresco de Twelve Data
  // (hasta 15 min de atraso). Si Capital.com no está configurado o falla,
  // esto no hace nada y queda igual que antes (solo Twelve Data).
  const vivo = Boolean(filaViva)
  const data = useMemo(() => {
    if (!crudo) return null
    if (!filaViva) return computarBarrido(crudo.barras, crudo.rates)
    const ultimaHora = crudo.barras[crudo.barras.length - 1]
    const ratesConVivo = { ...crudo.rates, [ultimaHora]: filaViva }
    return computarBarrido(crudo.barras, ratesConVivo)
  }, [crudo, filaViva])

  const vista = data ? derivarVista(data, { thr, topN, vivo }) : null

  return {
    loading,
    error,
    sinConfigurar,
    stale,
    guardadoEl,
    vivo,
    vivoConfigurado,
    vivoActualizadoEl,
    ultima: data?.ultima ?? null,
    ratesUSD: data?.ratesUSD ?? null,
    monedas: vista?.monedas ?? [],
    pares: vista?.pares ?? [],
    compras: vista?.compras ?? [],
    ventas: vista?.ventas ?? [],
    vigilancia: vista?.vigilancia ?? [],
    setups: vista?.setups ?? [],
    corte: vista?.corte ?? '…',
  }
}
