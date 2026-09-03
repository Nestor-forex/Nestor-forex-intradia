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

// DE DÓNDE SALE LA LLAVE. **Ya NO está en el repositorio.**
//
// Vive en el secreto `TWELVEDATA_KEY` del repositorio, que solo ven los
// workflows de GitHub Actions.
//
// Antes estaba escrita en `.env.production`, y no por descuido: mientras la
// app le pedía los precios a Twelve Data desde el navegador, TENÍA que estar
// ahí, porque de ese archivo la toma Vite al compilar. O sea que la llave iba
// dentro del JavaScript que se descarga cualquiera que abra la página.
//
// Desde que la app lee el barrido ya publicado (ver `barrido-publicado.mjs`),
// la llave solo la necesitan estos guiones, que corren en GitHub. El
// 2026-09-03 se creó el secreto y se borró la línea del archivo, EN ESE ORDEN
// —al revés se habrían quedado sin precios el vigía y el reporte diario—.
//
// ⚠️ SI SE AÑADE UN WORKFLOW NUEVO que llame a estos guiones, hay que pasarle
// el secreto:
//
//     env:
//       TWELVEDATA_KEY: ${{ secrets.TWELVEDATA_KEY }}
//
// Sin eso falla, y falla bien: con el mensaje de abajo, no en silencio. Pasó
// de verdad con `comparar-reglas.yml`, que se quedó sin el secreto al hacer
// este cambio y se descubrió revisando los workflows uno por uno.
//
// El respaldo a `.env.production` se conserva para poder probar en el
// computador de alguien sin tener que tocar código: quien quiera, escribe ahí
// su propia llave y NO la sube.
export function leerLlave(base = import.meta.url) {
  const delEntorno = process.env.TWELVEDATA_KEY
  if (delEntorno && delEntorno.trim()) return delEntorno.trim()

  const env = readFileSync(new URL('../../.env.production', base), 'utf8')
  const m = env.match(/^VITE_TWELVEDATA_KEY=(.+)$/m)
  if (!m || !m[1].trim()) {
    throw new Error(
      'No hay llave de Twelve Data. En GitHub Actions: falta pasarle al paso ' +
        '`env: TWELVEDATA_KEY: ${{ secrets.TWELVEDATA_KEY }}`. En un computador: ' +
        'exporta TWELVEDATA_KEY o pon VITE_TWELVEDATA_KEY en app/.env.production ' +
        '(sin subirla al repositorio).'
    )
  }
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
/**
 * @param velas   cuántas horas se piden POR TANDA. El tope de la API son 5000.
 * @param paginas cuántas tandas encadenadas hacia atrás. Ver abajo.
 *
 * EL LÍMITE QUE OBLIGA A PAGINAR
 * ------------------------------
 * Twelve Data devuelve como máximo 5000 velas por consulta. En velas DIARIAS
 * eso son casi 20 años y no hay problema (por eso la app de swing pide y ya).
 * En velas de UNA HORA, 5000 son unos 7 meses — y 7 meses son un solo humor
 * de mercado, que es justo lo que no sirve para decidir nada.
 *
 * Para ir más atrás hay que encadenar consultas: se pide una tanda, se mira
 * cuál fue la vela más vieja que llegó, y se vuelve a pedir terminando justo
 * antes de esa. Así hacia atrás tantas veces como `paginas`.
 *
 * CUESTA CRÉDITOS, PERO POCOS
 * Cada tanda son 7 créditos (uno por símbolo) del cupo de 800 diarios, y el
 * plan gratuito permite 8 por minuto — así que entre tanda y tanda hay que
 * esperar. 4 tandas ≈ 28 créditos y unos 4 minutos: 28 meses de historia por
 * el precio de nada. Con `paginas = 1` se comporta EXACTAMENTE como antes,
 * que es lo que usan el vigía y el reporte diario.
 */
export async function obtenerVelas(apiKey, { minBarras = 60, velas = 300, paginas = 1 } = {}) {
  const porSimbolo = {}
  for (const sym of SYMBOLS) porSimbolo[sym] = new Map()

  let hasta = null // null = "desde ahora"; después, la vela más vieja que ya tenemos
  for (let p = 0; p < paginas; p++) {
    // El plan gratuito da 8 créditos por minuto y cada tanda gasta 7: sin esta
    // pausa la segunda tanda recibiría 429 siempre. Se espera ANTES de pedir,
    // no después, para no dejar un minuto muerto al final.
    if (p > 0) await esperar(65_000)

    const r = await pedir(
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(SYMBOLS.join(','))}` +
        `&interval=1h&outputsize=${velas}&timezone=UTC` +
        (hasta ? `&end_date=${encodeURIComponent(hasta)}` : '') +
        `&apikey=${apiKey}`
    )
    const j = await r.json()

    let masVieja = null
    for (const sym of SYMBOLS) {
      const bloque = j[sym]
      if (!bloque || bloque.status === 'error' || !Array.isArray(bloque.values)) {
        // En la primera tanda es un error de verdad. En las siguientes puede
        // ser simplemente que ya no hay más historia hacia atrás, y eso no
        // debe tirar abajo lo que ya se bajó.
        if (p === 0) throw new Error(`sin datos de ${sym}${bloque?.message ? ' — ' + bloque.message : ''}`)
        continue
      }
      for (const v of bloque.values) {
        porSimbolo[sym].set(v.datetime, { c: parseFloat(v.close), h: parseFloat(v.high), l: parseFloat(v.low) })
        if (!masVieja || v.datetime < masVieja) masVieja = v.datetime
      }
    }

    // Si una tanda no trajo nada nuevo, no hay más historia: seguir pidiendo
    // solo gastaría créditos.
    if (!masVieja || masVieja === hasta) break
    hasta = masVieja
  }

  for (const sym of SYMBOLS) {
    if (!porSimbolo[sym].size) throw new Error(`sin datos de ${sym}`)
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
