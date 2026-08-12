// Descarga de velas H1 desde Twelve Data, compartida por los scripts de Node
// (reporte diario y vigía). Antes cada script tenía su propia copia de esto;
// al aparecer el tercero se volvió una sola.
//
// Devuelve la grilla { barras, rates, rangos } que espera marketCalc.js:
// solo las horas que trajeron dato en las 7 divisas, para no dejar huecos si
// alguna cerró antes por feriado local.

import { readFileSync } from 'node:fs'

export const SYMBOLS = ['USD/EUR', 'USD/GBP', 'USD/JPY', 'USD/CHF', 'USD/AUD', 'USD/NZD', 'USD/CAD']
const SYM_TO_CCY = { 'USD/EUR': 'EUR', 'USD/GBP': 'GBP', 'USD/JPY': 'JPY', 'USD/CHF': 'CHF', 'USD/AUD': 'AUD', 'USD/NZD': 'NZD', 'USD/CAD': 'CAD' }

// La llave sale de .env.production, que sí está en el repo (es una llave de
// plan gratuito, no da acceso a nada más que a precios públicos).
export function leerLlave(base = import.meta.url) {
  const env = readFileSync(new URL('../../.env.production', base), 'utf8')
  const m = env.match(/^VITE_TWELVEDATA_KEY=(.+)$/m)
  if (!m || !m[1].trim()) throw new Error('VITE_TWELVEDATA_KEY no está configurada en .env.production')
  return m[1].trim()
}

const esperar = (ms) => new Promise((res) => setTimeout(res, ms))

// El plan gratuito de Twelve Data permite 8 créditos por minuto y cada
// barrido gasta 7. Si dos cosas coinciden en el mismo minuto (el vigía en
// punto y el reporte diario, por ejemplo), la segunda recibe un 429. No es un
// error de verdad: es "espérate al minuto siguiente". Antes eso tumbaba el
// reporte entero, así que ahora se reintenta en vez de rendirse.
async function pedir(url, reintentos = 2) {
  const r = await fetch(url)
  if (r.status === 429 && reintentos > 0) {
    await esperar(65_000)
    return pedir(url, reintentos - 1)
  }
  if (!r.ok) throw new Error('HTTP ' + r.status + (r.status === 429 ? ' (límite de consultas por minuto)' : ''))
  return r
}

// `velas` es cuántas horas se piden. 300 es lo que usan el vigía y el reporte,
// y es lo que ve la app en producción: unos 12 días de mercado.
//
// El banco de pruebas pide muchas más (Twelve Data admite hasta 5000, y cuesta
// los mismos 7 créditos porque se cobra por consulta, no por vela). Con 300
// horas no se puede medir nada: son doce días.
export async function obtenerVelas(apiKey, { minBarras = 60, velas = 300 } = {}) {
  const r = await pedir(
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(SYMBOLS.join(','))}&interval=1h&outputsize=${velas}&timezone=UTC&apikey=${apiKey}`
  )
  const j = await r.json()

  const porSimbolo = {}
  for (const sym of SYMBOLS) {
    const bloque = j[sym]
    if (!bloque || bloque.status === 'error' || !Array.isArray(bloque.values)) {
      throw new Error(`sin datos de ${sym}${bloque?.message ? ' — ' + bloque.message : ''}`)
    }
    const mapa = new Map()
    for (const v of bloque.values) mapa.set(v.datetime, { c: parseFloat(v.close), h: parseFloat(v.high), l: parseFloat(v.low) })
    porSimbolo[sym] = mapa
  }

  const primero = porSimbolo[SYMBOLS[0]]
  const barras = [...primero.keys()].filter((t) => SYMBOLS.every((sym) => porSimbolo[sym].has(t))).sort()
  if (barras.length < minBarras) throw new Error('no hay suficientes velas recientes para calcular los indicadores')

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
