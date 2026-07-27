// Genera el reporte diario del barrido intradía (Nestor Forex Intradía) y lo
// imprime entre marcadores, para que la sesión de Claude que lo lee en los
// logs de GitHub Actions lo pueda extraer sin ambigüedad.
//
// Corre en GitHub Actions (con internet completo) porque el entorno normal
// de la sesión de Claude tiene bloqueado el acceso a api.twelvedata.com.

import { readFileSync } from 'node:fs'
import { computarBarrido, derivarVista } from '../src/lib/marketCalc.js'
import { limitaciones } from '../src/lib/fakeData.js'

function leerLlave() {
  const env = readFileSync(new URL('../.env.production', import.meta.url), 'utf8')
  const m = env.match(/^VITE_TWELVEDATA_KEY=(.+)$/m)
  if (!m || !m[1].trim()) throw new Error('VITE_TWELVEDATA_KEY no está configurada en .env.production')
  return m[1].trim()
}

const SYMBOLS = ['USD/EUR', 'USD/GBP', 'USD/JPY', 'USD/CHF', 'USD/AUD', 'USD/NZD', 'USD/CAD']
const SYM_TO_CCY = { 'USD/EUR': 'EUR', 'USD/GBP': 'GBP', 'USD/JPY': 'JPY', 'USD/CHF': 'CHF', 'USD/AUD': 'AUD', 'USD/NZD': 'NZD', 'USD/CAD': 'CAD' }

async function obtenerVelas(apiKey) {
  const r = await fetch(
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(SYMBOLS.join(','))}&interval=1h&outputsize=100&apikey=${apiKey}`
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

function formatoChat({ fecha, monedas, pares, compras, ventas, vigilancia, setups, corte }) {
  const li = (xs) => (xs.length ? xs.map((x) => `• *${x.name}* — ${x.razon}`).join('\n') : '_Ninguno ahora._')
  const fuerza = monedas.map((m) => `${m.cod} ${m.score.toFixed(1)}`).join(' · ')

  return `⚡ *Nestor Forex Intradía* — ${fecha}
${corte}

*Fuerza relativa (1h/4h/24h):* ${fuerza}

*Mejores para comprar:*
${li(compras)}

*Mejores para vender:*
${li(ventas)}

*En vigilancia:*
${li(vigilancia)}

*Setups del top (con pivotes de sesión):*
${
  setups.length
    ? setups
        .map(
          (s) =>
            `• *${s.name} ${s.lado}* — entrada ${s.entrada.split(' · ')[0]}, SL ${s.sl.split(' (')[0]}, TP ${s.tp} (R/B ${s.rr}) · Pivotes S1 ${s.pivots.s1} / P ${s.pivots.p} / R1 ${s.pivots.r1}`
        )
        .join('\n')
    : '_Sin setups limpios ahora._'
}

_Riesgo: 1-2% del capital por operación. ${limitaciones}_`
}

const apiKey = leerLlave()
const { barras, rates } = await obtenerVelas(apiKey)
const data = computarBarrido(barras, rates)
const vista = derivarVista(data, { thr: 0.5, topN: 3 })
const fecha = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

console.log('---REPORTE-INICIO---')
console.log(formatoChat({ fecha, ...vista }))
console.log('---REPORTE-FIN---')
