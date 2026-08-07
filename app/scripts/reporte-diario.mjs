// Genera el reporte diario del barrido intradía (Nestor Forex Intradía) y lo
// imprime entre marcadores, para que la sesión de Claude que lo lee en los
// logs de GitHub Actions lo pueda extraer sin ambigüedad.
//
// Corre en GitHub Actions (con internet completo) porque el entorno normal
// de la sesión de Claude tiene bloqueado el acceso a api.twelvedata.com.

import { computarBarrido, derivarVista } from '../src/lib/marketCalc.js'
import { limitaciones } from '../src/lib/fakeData.js'
import { leerLlave, obtenerVelas } from './lib/velas.mjs'

const NOMBRE_SESION = {
  'sesion.sidney': 'Sídney',
  'sesion.tokio': 'Tokio',
  'sesion.londres': 'Londres',
  'sesion.nuevaYork': 'Nueva York',
}

function formatoChat({ fecha, monedas, pares, compras, ventas, vigilancia, rangos, setups, corte, sesion }) {
  const li = (xs) => (xs.length ? xs.map((x) => `• *${x.name}* — ${x.razon}`).join('\n') : '_Ninguno ahora._')
  const fuerza = monedas.map((m) => `${m.cod} ${m.score.toFixed(1)}`).join(' · ')

  return `⚡ *Nestor Forex Intradía* — ${fecha}
${corte}

*Sesión abierta:* ${sesion.claves.map((c) => NOMBRE_SESION[c] || c).join(' + ')}${sesion.solape ? ' — solape de máxima liquidez' : ''}

*Fuerza relativa (1h/4h/24h):* ${fuerza}

*Mejores para comprar:*
${li(compras)}

*Mejores para vender:*
${li(ventas)}

*En vigilancia:*
${li(vigilancia)}

*Oportunidades de rango (mercado lateral):*
${rangos.length ? rangos.map((r) => `• *${r.name} ${r.lado}* — ${r.razon}`).join('\n') : '_Ninguna ahora._'}

*Setups del top (con pivotes de sesión):*
${
  setups.length
    ? setups
        .map(
          (s) =>
            `• *${s.name} ${s.lado}${s.tipo === 'rango' ? ' [RANGO]' : ''}* — entrada ${s.entrada.split(' · ')[0]}, SL ${s.sl.split(' (')[0]}, TP ${s.tp} (R/B ${s.rr}) · Pivotes S1 ${s.pivots.s1} / P ${s.pivots.p} / R1 ${s.pivots.r1}`
        )
        .join('\n')
    : '_Sin setups limpios ahora._'
}

_Riesgo: 1-2% del capital por operación. ${limitaciones}_`
}

const apiKey = leerLlave()
const { barras, rates, rangos } = await obtenerVelas(apiKey)
const data = computarBarrido(barras, rates, rangos)
const vista = derivarVista(data, { thr: 0.5, topN: 3 })
const fecha = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

console.log('---REPORTE-INICIO---')
console.log(formatoChat({ fecha, ...vista }))
console.log('---REPORTE-FIN---')
