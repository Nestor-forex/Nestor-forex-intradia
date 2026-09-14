// Genera el reporte diario del barrido intradía (Nestor Forex Intradía) y lo
// deja en DOS sitios: impreso entre marcadores en el log, y —si se le da la
// rama `datos`— publicado en `estado/reporte.json`.
//
// Corre en GitHub Actions (con internet completo) porque el entorno normal
// de la sesión de Claude tiene bloqueado el acceso a api.twelvedata.com.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ POR QUÉ SE PUBLICA A UN ARCHIVO Y NO BASTA CON EL LOG
// ─────────────────────────────────────────────────────────────────────────
// **La API de GitHub Actions va con retraso**, y no un poco: está medido en
// este proyecto el 2026-09-03 (13 minutos) y otra vez el 2026-09-14, donde un
// trabajo que había terminado en 65 segundos siguió devolviendo 404 en los
// logs durante **40 minutos**. Con el estado pasa igual, así que ni el
// `status` ni el 404 distinguen «sigue corriendo» de «todavía no está
// publicado».
//
// El reporte se genera a la hora; lo que llegaba tarde era LEERLO.
//
// `raw.githubusercontent.com` no pasa por esa API: sirve el archivo en cuanto
// el commit está en la rama. Es el mismo camino por el que la app lee
// `barrido.json`, `calendario.json` y `tasas.json`.
//
// ⚠️ ESTO NO AFECTA NI HA AFECTADO A LA APP. La app nunca ha leído logs de
// Actions: lee los archivos de la rama `datos`. El retraso solo estorbaba para
// mandarle el reporte a Néstor por el chat.
//
// ⚠️ `generadoEl` VA DENTRO DEL ARCHIVO, y no es decoración: un archivo que se
// sobrescribe cada día se lee igual de bien estando viejo. Sin esa marca, leer
// el reporte de ayer y presentarlo como el de hoy sería indistinguible de que
// todo fue bien — y eso ya pasó una vez. Quien lo lea tiene que comprobar que
// `generadoEl` empieza por la fecha de hoy en UTC.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { computarBarrido, derivarVista } from '../src/lib/marketCalc.js'
import { limitaciones } from '../src/lib/fakeData.js'
import { leerLlave, obtenerVelas } from './lib/velas.mjs'
import { APP } from '../src/lib/identidad.js'

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
const texto = formatoChat({ fecha, ...vista })

// El log se mantiene tal cual: si un día falla el guardado en la rama `datos`,
// el reporte sigue estando en algún sitio. Los dos caminos son a propósito.
console.log('---REPORTE-INICIO---')
console.log(texto)
console.log('---REPORTE-FIN---')

// Solo cuando alguien pasa la rama `datos`. Sin eso el guion se comporta
// exactamente como antes, que es lo que hace falta para poder lanzarlo a mano
// sin montar nada.
const raizDatos = process.env.VIGIA_DATOS
if (raizDatos) {
  const destino = join(raizDatos, 'estado', 'reporte.json')
  mkdirSync(dirname(destino), { recursive: true })
  writeFileSync(
    destino,
    JSON.stringify(
      {
        app: APP,
        // La fecha tal como sale en el encabezado, para poder comprobar sin
        // volver a formatear nada.
        fecha,
        // ⚠️ Ver la cabecera. Esto es lo que delata un archivo viejo.
        generadoEl: new Date().toISOString(),
        // El corte de los datos (qué vela se usó), que NO es lo mismo que
        // cuándo se generó el reporte. En Intradía esta diferencia importa
        // todavía más: el barrido corre varias veces al día.
        corte: vista.corte,
        texto,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`Publicado en ${destino}`)
}
