// Capa de precio en vivo (Capital.com) que complementa el historial de
// Twelve Data.
//
// Twelve Data (useMarketData.js) sigue siendo la fuente del historial de
// velas H1 (necesario para EMA/RSI/pivotes) y se refresca cada 15 min.
// Capital.com no da historial gratis por REST, solo el precio del momento —
// por eso no la reemplaza, la complementa: mientras la app está abierta, se
// pregunta el precio en vivo cada pocos segundos y se usa para "adelantar"
// el cierre de la hora en curso, en vez de esperar hasta el próximo
// refresco de Twelve Data. Si Capital.com falla por cualquier razón (sin
// cuenta configurada, sin conexión, sesión vencida sin poder renovarse),
// esta capa simplemente no aporta nada y la app sigue funcionando solo con
// Twelve Data — nunca la rompe.
//
// (Probamos antes con TrueFX y su API de precios en vivo resultó ser de
// pago pese a la documentación vieja que la describía como gratis — ver
// CLAUDE.md. Capital.com sí está confirmado gratis con cuenta demo.)

import { useEffect, useRef, useState } from 'react'

const BASE = 'https://demo-api-capital.backend-capital.com'
const POLL_MS = 10 * 1000 // cada 10s mientras la app está abierta

const apiKey = import.meta.env.VITE_CAPITAL_API_KEY
const identifier = import.meta.env.VITE_CAPITAL_IDENTIFIER
const password = import.meta.env.VITE_CAPITAL_PASSWORD

// Capital.com cotiza cada par en su convención de mercado estándar (ej.
// EURUSD = cuántos USD vale 1 EUR). marketCalc.js espera lo contrario:
// cuántas unidades de esa divisa vale 1 USD (mismo formato que Twelve
// Data). Por eso los pares con USD como divisa cotizada (EUR, GBP, AUD,
// NZD) hay que invertirlos (1/precio); los que ya tienen a USD como base
// (JPY, CHF, CAD) se usan tal cual.
const CAPITAL_PAIRS = [
  { epic: 'EURUSD', ccy: 'EUR', invert: true },
  { epic: 'GBPUSD', ccy: 'GBP', invert: true },
  { epic: 'USDJPY', ccy: 'JPY', invert: false },
  { epic: 'USDCHF', ccy: 'CHF', invert: false },
  { epic: 'AUDUSD', ccy: 'AUD', invert: true },
  { epic: 'USDCAD', ccy: 'CAD', invert: false },
  { epic: 'NZDUSD', ccy: 'NZD', invert: true },
]

// Abre una sesión autenticada y devuelve los tokens que hay que reenviar
// en cada consulta posterior (duran ~10 min, se renuevan solos si expiran).
async function autenticar() {
  const r = await fetch(`${BASE}/api/v1/session`, {
    method: 'POST',
    headers: { 'X-CAP-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  })
  const cst = r.headers.get('cst')
  const securityToken = r.headers.get('x-security-token')
  if (!r.ok || !cst || !securityToken) throw new Error('HTTP ' + r.status)
  return { cst, securityToken }
}

// Pide los 7 precios de una sola vez con la sesión ya abierta.
async function consultarPrecios({ cst, securityToken }) {
  const epics = CAPITAL_PAIRS.map((p) => p.epic).join(',')
  const r = await fetch(`${BASE}/api/v1/markets?epics=${epics}`, {
    headers: { 'X-CAP-API-KEY': apiKey, CST: cst, 'X-SECURITY-TOKEN': securityToken },
  })
  if (!r.ok) throw new Error('HTTP ' + r.status)
  const j = await r.json()
  const precios = {}
  for (const m of j.marketDetails ?? []) {
    const bid = m?.snapshot?.bid
    const offer = m?.snapshot?.offer
    if (Number.isFinite(bid) && Number.isFinite(offer)) precios[m.instrument.epic] = (bid + offer) / 2
  }
  return precios
}

// Convierte { EURUSD: precio, ... } (convención Capital.com) a
// { EUR, GBP, JPY, CHF, AUD, NZD, CAD } (convención de la app: unidades de
// esa divisa por 1 USD) — el mismo formato de fila que usa rates[t] en
// marketCalc.js.
function aFilaApp(precios) {
  const fila = {}
  for (const { epic, ccy, invert } of CAPITAL_PAIRS) {
    const p = precios[epic]
    if (!Number.isFinite(p) || p <= 0) continue
    fila[ccy] = invert ? 1 / p : p
  }
  return Object.keys(fila).length === CAPITAL_PAIRS.length ? fila : null
}

// Hook: mantiene una sesión de Capital.com viva mientras el componente
// está montado y expone la fila de precios más reciente (o null si
// Capital.com no está configurado, o si todavía no ha llegado un precio
// completo de las 7 divisas). No lanza errores hacia afuera — cualquier
// falla se ignora y simplemente no hay precio en vivo ese ciclo.
export function useCapitalLive() {
  const [filaViva, setFilaViva] = useState(null)
  const [actualizadoEl, setActualizadoEl] = useState(null)
  const sesionRef = useRef(null)

  useEffect(() => {
    if (!apiKey || !identifier || !password) return
    let cancelado = false
    let intervalId = null

    const ciclo = async () => {
      try {
        if (!sesionRef.current) sesionRef.current = await autenticar()
        const precios = await consultarPrecios(sesionRef.current)
        const fila = aFilaApp(precios)
        if (fila && !cancelado) {
          setFilaViva(fila)
          setActualizadoEl(new Date().toISOString())
        }
      } catch {
        // Sesión vencida, sin conexión, credenciales inválidas, etc. — se
        // reintenta desde cero en el próximo ciclo, sin romper la app.
        sesionRef.current = null
      }
    }

    ciclo()
    intervalId = setInterval(ciclo, POLL_MS)
    return () => {
      cancelado = true
      clearInterval(intervalId)
    }
  }, [])

  return { filaViva, actualizadoEl, configurado: Boolean(apiKey && identifier && password) }
}
