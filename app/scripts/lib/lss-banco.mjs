// El NFX-LSS, en el formato que el banco de pruebas de INTRADÍA sabe medir.
//
// PRIMO del de Swing, no gemelo, y por una razón que decide el resultado:
//
// ⚠️⚠️ AQUÍ SOLO SE MIDEN LOS 7 PARES DIRECTOS, NO LOS 18.
//
// Esta app descarga únicamente las siete cotizaciones contra el dólar y DERIVA
// los once cruces combinando dos de ellas. Para el máximo de un cruce hay que
// juntar el máximo de una con el mínimo de la otra, o sea suponer que los dos
// extremos ocurrieron en el mismo instante — y eso ensancha la mecha.
//
// En casi cualquier otra regla ese ensanchamiento es un detalle. Aquí NO: el
// barrido de liquidez se define POR LA MECHA («el precio mete la mecha más
// allá del pivote y cierra dentro»). Con mechas infladas se fabricarían
// barridos que nunca ocurrieron, y el número saldría bonito y falso.
//
// Es el mismo error que en Swing dio un ATR un 400 % más alto de lo real al
// derivar los cruces (2026-08-09). Allí se arregló pidiendo los 14 pares
// directos; aquí no se puede sin gastar créditos, así que se mide lo que es
// exacto y se dice cuánto se mide.

import { senalesLSS } from '../../src/lib/lss.js'

// Los siete que se pueden reconstruir EXACTOS, con el nombre que usa la app y
// si hay que dar la vuelta a la cotización cruda.
//
// ⚠️ Invertir NO aproxima nada: si S = USD/EUR, entonces EUR/USD = 1/S, y el
// máximo de uno es el inverso del MÍNIMO del otro. Es una transformación
// exacta, no una derivación de dos series.
export const DIRECTOS = [
  { par: 'EUR/USD', ccy: 'EUR', invertir: true },
  { par: 'GBP/USD', ccy: 'GBP', invertir: true },
  { par: 'AUD/USD', ccy: 'AUD', invertir: true },
  { par: 'NZD/USD', ccy: 'NZD', invertir: true },
  { par: 'USD/JPY', ccy: 'JPY', invertir: false },
  { par: 'USD/CHF', ccy: 'CHF', invertir: false },
  { par: 'USD/CAD', ccy: 'CAD', invertir: false },
]

/** Las velas exactas de un par directo, en orden. */
export function velasDe(barras, rates, rangos, { ccy, invertir }) {
  return barras.map((t) => {
    const r = rangos[t][ccy]
    const c = rates[t][ccy]
    // Al invertir, el máximo pasa a ser el inverso del mínimo. Confundirlos
    // daría velas con el máximo por debajo del mínimo y todos los barridos
    // saldrían al revés.
    return invertir ? { h: 1 / r.l, l: 1 / r.h, c: 1 / c } : { h: r.h, l: r.l, c }
  })
}

/**
 * Los datos que necesita el resolver, con los 7 pares EXACTOS.
 *
 * Se construye aquí en vez de reutilizar el barrido completo a propósito: el
 * resolver decide ganada o perdida mirando máximos y mínimos, así que si le
 * pasáramos los cruces derivados juzgaría con mechas infladas. Medir con datos
 * exactos y resolver con datos aproximados sería peor que no medir.
 */
export function datosExactos(barras, rates, rangos) {
  return {
    barras,
    pares: DIRECTOS.map((d) => {
      const velas = velasDe(barras, rates, rangos, d)
      return {
        name: d.par,
        dec: d.par.includes('JPY') ? 2 : 4,
        esCruce: false,
        highs: velas.map((v) => v.h),
        lows: velas.map((v) => v.l),
      }
    }),
  }
}

/**
 * Señales NFX-LSS de los 7 pares directos, en formato de banco de pruebas.
 *
 * Los valores por defecto son los que Néstor propuso para intradía: pivote más
 * sensible, ventana más corta y objetivo más ajustado que en swing, porque
 * aquí las operaciones abren y cierran el mismo día.
 */
export function senalesLSSBanco(
  barras,
  rates,
  rangos,
  { swingLen = 4, sweepWindow = 6, rr = 2, exigirSweep = true, calentamiento = 300 } = {}
) {
  const fuera = []

  for (const d of DIRECTOS) {
    const velas = velasDe(barras, rates, rangos, d)
    const [b, q] = d.par.split('/')
    const dec = d.par.includes('JPY') ? 2 : 4
    const pip = dec === 2 ? 0.01 : 0.0001

    for (const s of senalesLSS(velas, { swingLen, sweepWindow, rr, exigirSweep })) {
      if (s.i < calentamiento) continue

      const pipRiesgo = Math.round(Math.abs(s.entrada - s.sl) / pip)
      if (pipRiesgo < 1) continue

      fuera.push({
        // El tipo va DENTRO del identificador: sin eso, una señal del LSS y una
        // de la app en el mismo par, lado y vela compartirían clave y el
        // resolver se comería una de las dos.
        id: `${d.par}|${s.lado}|lss`,
        // ⚠️ AQUÍ EL CAMPO SE LLAMA `vela`, NO `cierre`. El resolver de esta app
        // busca `s.vela`; el de Swing busca `s.cierre`. Es una diferencia real
        // entre las dos y está anotada dentro del propio resolver.
        vela: barras[s.i],
        vistoEl: barras[s.i],
        par: d.par,
        lado: s.lado,
        ladoOriginal: s.lado,
        base: b,
        cotizada: q,
        tipo: 'lss',
        evento: s.evento,
        precio: s.entrada,
        sl: s.sl,
        tp: s.tp,
        rr: Math.abs(s.tp - s.entrada) / Math.abs(s.entrada - s.sl),
        pipRiesgo,
        pipBeneficio: Math.round(Math.abs(s.tp - s.entrada) / pip),
        velasTrasBarrido: s.iSweep >= 0 ? s.i - s.iSweep : null,
      })
    }
  }

  return fuera.sort((a, b2) => (a.vela < b2.vela ? -1 : a.vela > b2.vela ? 1 : 0))
}
