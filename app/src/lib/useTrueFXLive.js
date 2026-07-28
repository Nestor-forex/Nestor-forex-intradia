// Capa de precio en vivo (TrueFX) que complementa el historial de Twelve Data.
//
// Twelve Data (useMarketData.js) sigue siendo la fuente del historial de
// velas H1 (necesario para EMA/RSI/pivotes) y se refresca cada 15 min.
// TrueFX no da historial gratis, solo el precio del momento — por eso no la
// reemplaza, la complementa: mientras la app está abierta, se pregunta el
// precio en vivo cada pocos segundos y se usa para "adelantar" el cierre de
// la hora en curso, en vez de esperar hasta el próximo refresco de Twelve
// Data. Si TrueFX falla por cualquier razón (sin cuenta configurada, sin
// conexión, formato inesperado), esta capa simplemente no aporta nada y la
// app sigue funcionando solo con Twelve Data — nunca la rompe.

const BASE = 'https://webrates.truefx.com/rates/connect.html'
const POLL_MS = 10 * 1000 // cada 10s mientras la app está abierta

const user = import.meta.env.VITE_TRUEFX_USER
const pass = import.meta.env.VITE_TRUEFX_PASS

// TrueFX cotiza cada par en su convención de mercado estándar (ej. EUR/USD
// = cuántos USD vale 1 EUR). marketCalc.js espera lo contrario: cuántas
// unidades de esa divisa vale 1 USD (mismo formato que Twelve Data). Por
// eso los pares con USD como divisa cotizada (EUR, GBP, AUD, NZD) hay que
// invertirlos (1/precio); los que ya tienen a USD como base (JPY, CHF,
// CAD) se usan tal cual.
const TRUEFX_PAIRS = [
  { sym: 'EUR/USD', ccy: 'EUR', invert: true },
  { sym: 'GBP/USD', ccy: 'GBP', invert: true },
  { sym: 'USD/JPY', ccy: 'JPY', invert: false },
  { sym: 'USD/CHF', ccy: 'CHF', invert: false },
  { sym: 'AUD/USD', ccy: 'AUD', invert: true },
  { sym: 'USD/CAD', ccy: 'CAD', invert: false },
  { sym: 'NZD/USD', ccy: 'NZD', invert: true },
]

function parseCSV(texto) {
  // Cada línea: SIMBOLO,timestampMs,bidGrande,bidPips,offerGrande,offerPips,alto,bajo,apertura
  const precios = {}
  for (const linea of texto.split('\n')) {
    const campos = linea.trim().split(',')
    if (campos.length < 6) continue
    const [sym, , bidGrande, bidPips, offerGrande, offerPips] = campos
    const bid = parseFloat(bidGrande) + parseFloat(bidPips) / 100000
    const offer = parseFloat(offerGrande) + parseFloat(offerPips) / 100000
    if (!Number.isFinite(bid) || !Number.isFinite(offer)) continue
    precios[sym] = (bid + offer) / 2
  }
  return precios
}

// Abre una sesión autenticada en TrueFX y devuelve el id de sesión (texto plano).
async function conectar() {
  const url = `${BASE}?u=${encodeURIComponent(user)}&p=${encodeURIComponent(pass)}&q=nfi&c=${encodeURIComponent(TRUEFX_PAIRS.map((p) => p.sym).join(','))}&f=csv&s=n`
  const r = await fetch(url)
  if (!r.ok) throw new Error('HTTP ' + r.status)
  const id = (await r.text()).trim()
  if (!id) throw new Error('TrueFX no devolvió un id de sesión')
  return id
}

// Pide los precios más recientes de la sesión ya abierta.
async function consultar(sessionId) {
  const r = await fetch(`${BASE}?id=${encodeURIComponent(sessionId)}`)
  if (!r.ok) throw new Error('HTTP ' + r.status)
  return parseCSV(await r.text())
}

// Convierte { 'EUR/USD': precio, ... } (convención TrueFX) a
// { EUR, GBP, JPY, CHF, AUD, NZD, CAD } (convención de la app: unidades de
// esa divisa por 1 USD) — el mismo formato de fila que usa rates[t] en
// marketCalc.js.
function aFilaApp(preciosTrueFX) {
  const fila = {}
  for (const { sym, ccy, invert } of TRUEFX_PAIRS) {
    const p = preciosTrueFX[sym]
    if (!Number.isFinite(p) || p <= 0) continue
    fila[ccy] = invert ? 1 / p : p
  }
  return Object.keys(fila).length === TRUEFX_PAIRS.length ? fila : null
}

// Hook: mantiene una sesión de TrueFX viva mientras el componente está
// montado y expone la fila de precios más reciente (o null si TrueFX no
// está configurado, o si todavía no ha llegado un precio completo de las 7
// divisas). No lanza errores hacia afuera — cualquier falla se ignora y
// simplemente no hay precio en vivo ese ciclo.
import { useEffect, useRef, useState } from 'react'

export function useTrueFXLive() {
  const [filaViva, setFilaViva] = useState(null)
  const [actualizadoEl, setActualizadoEl] = useState(null)
  const sessionRef = useRef(null)
  const ultimaFilaRef = useRef({})

  useEffect(() => {
    if (!user || !pass) return
    let cancelado = false
    let intervalId = null

    const asegurarSesion = async () => {
      if (!sessionRef.current) sessionRef.current = await conectar()
    }

    const ciclo = async () => {
      try {
        await asegurarSesion()
        const precios = await consultar(sessionRef.current)
        ultimaFilaRef.current = { ...ultimaFilaRef.current, ...precios }
        const fila = aFilaApp(ultimaFilaRef.current)
        if (fila && !cancelado) {
          setFilaViva(fila)
          setActualizadoEl(new Date().toISOString())
        }
      } catch {
        // Sesión vencida, sin conexión, credenciales inválidas, etc. — se
        // reintenta desde cero en el próximo ciclo, sin romper la app.
        sessionRef.current = null
      }
    }

    ciclo()
    intervalId = setInterval(ciclo, POLL_MS)
    return () => {
      cancelado = true
      clearInterval(intervalId)
    }
  }, [])

  return { filaViva, actualizadoEl, configurado: Boolean(user && pass) }
}
