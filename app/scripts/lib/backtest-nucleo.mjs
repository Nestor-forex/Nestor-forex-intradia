// El motor del banco de pruebas: qué señales habría dado la app cada hora.
//
// Va aparte de `backtest.mjs` para poder comprobarlo sin internet: el script
// de arriba necesita descargar miles de velas reales, y esto se puede
// alimentar con datos de mentira desde `prueba-backtest.mjs`.
//
// DOS COSAS QUE CAMBIAN RESPECTO AL DE SWING
// ------------------------------------------
// 1. La VENTANA. En swing se le entregaban al barrido todos los días desde el
//    principio. Aquí no: se le entregan siempre las últimas VENTANA velas,
//    porque es EXACTAMENTE lo que recibe la app en producción —el vigía pide
//    `outputsize=300` y calcula con eso—. Darle más historia mediría una app
//    que no existe: sus medias y su ADX saldrían de otra base.
//
//    Y de paso lo hace posible: con miles de velas, recalcular el barrido
//    entero desde el principio en cada hora serían mil millones de cuentas.
//
// 2. Intradía tiene setups de RANGO además de los de tendencia, y la fuerza
//    va por horas y no por días. El identificador lleva el tipo, igual que en
//    el vigía, para que una señal de rango y una de tendencia del mismo par no
//    se confundan entre sí.
//
// La regla de oro es la misma: para decidir la vela i solo se entregan velas
// hasta la i. Un indicador no puede ver el futuro porque el futuro no está en
// los datos que recibe.

import { computarBarrido, derivarVista } from '../../src/lib/marketCalc.js'
import { actual } from './geometrias.mjs'

// Cuántas velas ve el barrido cada vez. Es el `outputsize` del vigía: si un
// día se cambia allí, hay que cambiarlo aquí o el banco de pruebas dejaría de
// medir la app de verdad.
export const VENTANA = 300

/**
 * @param geometria       (crudo, compra) → { sl, tp }. Por defecto la de la app.
 * @param invertirVentas  operar al revés lo que el barrido manda vender. Es un
 *                        diagnóstico: una señal que pierde siempre no es una
 *                        señal sin información, es una con el signo cambiado.
 * @returns señales en el mismo formato que escribe el vigía, listas para
 *          `resolver.mjs`.
 */
export function generarSenales(
  barras,
  rates,
  rangos,
  { calentamiento = VENTANA, thr = 0.5, topN = 3, geometria = actual, invertirVentas = false, vista = {} } = {}
) {
  const senales = []
  let previas = new Set()

  for (let i = calentamiento; i < barras.length; i++) {
    // La ventana móvil: las últimas VENTANA velas hasta la i, ni una más.
    const desde = Math.max(0, i + 1 - VENTANA)
    const hasta = barras.slice(desde, i + 1)
    const data = computarBarrido(hasta, rates, rangos)
    // `vista` deja mover los umbrales de la app (ADX, confirmación de 4 horas,
    // compresión) SIN duplicar aquí su lógica de selección. Vacío = la app tal
    // cual.
    const { setups } = derivarVista(data, { thr, topN, ...vista })

    const ahora = new Set()
    for (const s of setups) {
      const tipo = s.tipo || 'tendencia'
      const id = `${s.name}|${s.lado}|${tipo}`
      ahora.add(id)
      // Solo las NUEVAS, igual que el vigía: una señal que sigue viva seis
      // horas es UNA operación, no seis.
      if (previas.has(id)) continue

      const c = s.crudo
      const compra = invertirVentas ? true : s.lado === 'COMPRA'
      const lado = compra ? 'COMPRA' : 'VENTA'

      const { sl, tp } = geometria(c, compra)
      const pip = c.dec === 2 ? 0.01 : 0.0001

      senales.push({
        id,
        vistoEl: barras[i],
        // El vigía de intradía llama `vela` a este campo (el de swing lo llama
        // `cierre`). El resolver acepta los dos, pero aquí se usa el nombre de
        // esta app para que las señales del banco de pruebas y las de verdad
        // sean indistinguibles.
        vela: barras[i],
        par: s.name,
        lado,
        ladoOriginal: s.lado,
        tipo,
        base: c.b,
        cotizada: c.q,
        precio: c.precio,
        sl,
        tp,
        rr: Math.abs(tp - c.precio) / Math.abs(c.precio - sl),
        pipRiesgo: Math.round(Math.abs(c.precio - sl) / pip),
        pipBeneficio: Math.round(Math.abs(tp - c.precio) / pip),
        rsi: c.rsi,
        adx: c.adx,
        res: c.res,
        sup: c.sup,
      })
    }
    previas = ahora
  }

  return senales
}
