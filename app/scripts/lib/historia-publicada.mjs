// La historia de velas que lee el laboratorio «prueba tu propia regla»
// (2026-11-18). Solo Intradía: velas de UNA HORA de los 18 pares.
//
// Sale de la serie larga que el publicador YA se baja para las medias (700
// velas), así que NO CUESTA NI UN CRÉDITO MÁS de Twelve Data.
//
// El formato es el que lee `probarRegla` en `src/lib/laboratorio.js`, el mismo
// en las dos apps:
//
//   { v: 1, vela: '1h', generadoEl, fechas: [...], pares: { 'EUR/USD': { c, h, l } } }
//
// ⚠️ LOS CRUCES SE DERIVAN de los 7 símbolos contra el dólar, igual que en el
// barrido. El cierre sale EXACTO; el máximo y el mínimo, no: combinar el
// máximo de una divisa con el mínimo de la otra supone que pasaron a la misma
// hora (`maxDePar`, `minDePar`), y en velas de una hora eso es una cota.
//
// ⚠️ SE ESCRIBE UNA VEZ AL DÍA, no cada hora (`tocaEscribir`). Pesa unos
// cientos de KB y el publicador corre cada hora: reescribirla 24 veces al día
// llenaría la rama `datos` sin aportar nada a un banco de pruebas.

import { PAIRS, maxDePar, minDePar, precioDePar } from '../../src/lib/marketCalc.js'

const decimales = (par) => (par.includes('JPY') ? 3 : 5)
const redondear = (v, d) => Math.round(v * 10 ** d) / 10 ** d

export function armarHistoria(largo, ahora = new Date()) {
  const fechas = largo?.barras
  const rates = largo?.rates
  const rangos = largo?.rangos
  if (!Array.isArray(fechas) || !fechas.length || !rates || !rangos) return null
  const cierre = (c, t) => (c === 'USD' ? 1 : rates[t]?.[c])
  const alto = (c, t) => (c === 'USD' ? 1 : rangos[t]?.[c]?.h)
  const bajo = (c, t) => (c === 'USD' ? 1 : rangos[t]?.[c]?.l)
  const pares = {}
  for (const [b, q] of PAIRS) {
    const par = `${b}/${q}`
    const d = decimales(par)
    const c = []
    const h = []
    const l = []
    let ok = true
    for (const t of fechas) {
      const vc = precioDePar(cierre(b, t), cierre(q, t))
      const vh = maxDePar(bajo(b, t), alto(q, t))
      const vl = minDePar(alto(b, t), bajo(q, t))
      if (![vc, vh, vl].every(Number.isFinite)) { ok = false; break }
      c.push(redondear(vc, d))
      h.push(redondear(vh, d))
      l.push(redondear(vl, d))
    }
    if (ok) pares[par] = { c, h, l }
  }
  if (!Object.keys(pares).length) return null
  return { v: 1, vela: '1h', generadoEl: ahora.toISOString(), fechas, pares }
}

/**
 * ¿Hay que escribirla? Solo si la que hay es de OTRO día (UTC) o no se puede
 * leer. Ante la duda se escribe: escribir de más cuesta un commit; no escribir
 * deja el laboratorio con velas viejas.
 */
export function tocaEscribir(generadoElAnterior, ahora = new Date()) {
  if (typeof generadoElAnterior !== 'string') return true
  const d = new Date(generadoElAnterior)
  if (Number.isNaN(d.getTime())) return true
  return d.toISOString().slice(0, 10) !== ahora.toISOString().slice(0, 10)
}
