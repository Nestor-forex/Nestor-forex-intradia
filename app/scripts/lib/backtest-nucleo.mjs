import { costeEnPips, nochesEntre, NIVELES_SWAP } from './costes.mjs'
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

// Candidatos elegidos por una REGLA PROPIA en vez de por el barrido de la app.
//
// Hace falta para poder medir ideas que la app no puede producir hoy. La
// reversión es el caso: la app exige medias alineadas y precio por fuera —
// condiciones para PERSEGUIR un movimiento— y la reversión quiere justo lo
// contrario, entrar cuando el precio se estiró demasiado. Filtrar las señales
// de la app nunca daría esas entradas, porque la app no las genera.
//
// Se ordena y se corta por topN igual que la app, para que la comparación no
// cambie solo por el número de operaciones.
//
// ⚠️ La regla recibe la HORA de la vela como cuarto argumento. En la app
// hermana de swing no existe ese parámetro y aquí sí, porque es lo propio de
// intradía: la investigación sobre reversión en velas horarias encuentra que
// el efecto cambia mucho según la sesión abierta, así que hay que poder
// medirlo por hora en vez de suponer que da igual.
function porReglaPropia(data, regla, thr, topN) {
  const hora = data.horaUltima
  const salida = []
  for (const lado of ['COMPRA', 'VENTA']) {
    const suyos = data.pares
      .filter((p) => regla(p, data.esc, thr, hora) === lado)
      // Igual que la app: primero los de mayor diferencia de fuerza.
      .sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif))
      .slice(0, topN)

    for (const p of suyos) {
      salida.push({
        name: p.name,
        lado,
        // Solo los campos que necesitan las geometrías y la señal. Se arman a
        // mano y no con `mkSetup` porque `mkSetup` aplica los filtros de la
        // app (ADX, RSI, R/B), que son exactamente los que aquí se quieren
        // evitar: si los aplicara, no se estaría midiendo la regla propia.
        crudo: {
          b: p.b,
          q: p.q,
          dec: p.dec,
          precio: p.c,
          res: p.hi20,
          sup: p.lo20,
          pivote: p.pivots?.p ?? p.hi20,
          atrAbs: p.atrAbs,
          rsi: Math.round(p.rsiV),
          adx: Math.round(p.adx),
          tend: p.tend,
          fuerzaB: data.esc[p.b],
          fuerzaQ: data.esc[p.q],
        },
      })
    }
  }
  return salida
}

/**
 * @param geometria       (crudo, compra) → { sl, tp }. Por defecto la de la app.
 * @param invertirVentas  operar al revés lo que el barrido manda vender. Es un
 *                        diagnóstico: una señal que pierde siempre no es una
 *                        señal sin información, es una con el signo cambiado.
 * @param reglaEntrada    (par, esc, thr, hora) → 'COMPRA' | 'VENTA' | null.
 *                        Sustituye al barrido de la app para poder medir ideas
 *                        que la app no puede producir. Ver `porReglaPropia`.
 * @returns señales en el mismo formato que escribe el vigía, listas para
 *          `resolver.mjs`.
 */
export function generarSenales(
  barras,
  rates,
  rangos,
  {
    calentamiento = VENTANA,
    thr = 0.5,
    topN = 3,
    geometria = actual,
    invertirVentas = false,
    reglaEntrada = null,
    vista = {},
  } = {}
) {
  const senales = []
  let previas = new Set()

  for (let i = calentamiento; i < barras.length; i++) {
    // La ventana móvil: las últimas VENTANA velas hasta la i, ni una más.
    const desde = Math.max(0, i + 1 - VENTANA)
    const hasta = barras.slice(desde, i + 1)
    const data = computarBarrido(hasta, rates, rangos)
    // Sin `reglaEntrada` se mide el barrido de la app tal cual, que es lo que
    // hay que medir por defecto; `vista` deja mover sus umbrales (ADX,
    // compresión) sin duplicar aquí su lógica de selección. Con
    // `reglaEntrada` se mide una idea que la app no da hoy.
    const candidatos = reglaEntrada
      ? porReglaPropia(data, reglaEntrada, thr, topN)
      : derivarVista(data, { thr, topN, ...vista }).setups

    const ahora = new Set()
    for (const s of candidatos) {
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

// Cuenta el resultado de una lista de señales ya resueltas.
//
// Vive aquí y no en backtest.mjs porque de esta función salen TODOS los
// números con los que se decide si una regla se enciende o se apaga. Mientras
// estuvo dentro del script no se podía probar sin internet ni sin gastar
// créditos de la API: la cuenta que más pesa era la única sin comprobar.
// Ahora `prueba-costes.mjs` la mide directamente.
export function medir(senales, porClave, { conSpread = false, swapPipsNoche = 0 } = {}) {
  let ganadas = 0
  let perdidas = 0
  let pips = 0
  // Las que todavía no llegaron ni al stop ni al objetivo. Se cuentan aparte
  // en vez de dejarlas caer en silencio: si un cambio de reglas dejara la
  // mitad de las señales sin resolver, el acierto seguiría saliendo bonito
  // sobre las pocas que sí cerraron y nadie se enteraría del hueco.
  let sinJuzgar = 0
  // Resultado en "veces el riesgo de ESA operación", acumulado una a una. Los
  // pips sueltos no sirven para comparar: 100 pips en GBP/JPY no son 100 en
  // EUR/CHF, y dos geometrías con riesgos distintos no se pueden comparar en
  // pips de ninguna manera.
  let sumaR = 0

  // Para el ACIERTO DE EQUILIBRIO: cuánto hay que acertar SOLO para no perder.
  //
  // ⚠️ ES LA COLUMNA QUE EVITA EL AUTOENGAÑO, y sin ella comparar dos
  // geometrías no significa nada. Con el objetivo cerca del stop se acierta
  // más veces Y hace falta acertar más veces; con el objetivo lejos, menos de
  // las dos. Mirar solo el porcentaje de acierto entre geometrías distintas es
  // comparar con dos varas y creer que son la misma.
  //
  // En Swing esto ya se pagó una vez: en una rejilla de doce geometrías, la de
  // MEJOR acierto (55 %) perdía dinero, porque su equilibrio estaba en 57 %.
  //
  // La cuenta, con `k` = objetivo/riesgo y `c` = coste en veces el riesgo:
  //   g·(k − c) − (1 − g)·(1 + c) = 0   →   g = (1 + c) / (k + 1)
  let sumaK = 0
  let sumaCoste = 0
  // ⚠️ Y SI LA PROPORCIÓN NO ES LA MISMA EN TODAS, EL EQUILIBRIO ES APROXIMADO.
  //
  // La fórmula usa la proporción MEDIA. Eso es exacto cuando todas las
  // operaciones tienen la misma —la vara neutra, «objetivo 2×», «3×»— y solo
  // aproximado cuando cada una tiene la suya, como en la geometría de la app,
  // donde el objetivo es el primer nivel real que aparece.
  //
  // No es teórico: en la corrida del 2026-09-05 la reversión con la geometría
  // de la app salió con acierto 32 % y equilibrio 32 % —empatados— y sin
  // embargo −0,10 por unidad de riesgo. Si fuera exacto, empatar daría CERO.
  // Pasa porque las que ganan no tienen la misma proporción que la media.
  //
  // Por eso se devuelve `equilibrioExacto`: quien pinte la tabla puede marcar
  // las filas donde el número es solo indicativo. En esas, la que decide es
  // `porRiesgo`, no la comparación acierto-contra-equilibrio.
  let kMin = Infinity
  let kMax = -Infinity

  for (const s of senales) {
    const r = porClave.get(`${s.id}@${s.vistoEl}`)
    if (!r || (r.resultado !== 'ganada' && r.resultado !== 'perdida')) {
      sinJuzgar++
      continue
    }
    // Los costes se pagan SIEMPRE, se gane o se pierda, y en veces el riesgo
    // cuestan más cuanto más estrecho sea el stop.
    //
    // Las noches se cuentan por los cortes reales entre la vela de entrada y
    // la de salida, no por la duración: a qué hora se abrió decide si se cruza
    // el corte o no.
    const costePips = conSpread
      ? costeEnPips(s.par, nochesEntre(r.velaEntrada ?? s.vela, r.velaFinal), swapPipsNoche)
      : 0
    const coste = costePips / s.pipRiesgo
    // Se acumulan sobre las MISMAS operaciones que entran en el resultado (las
    // resueltas), no sobre todas las señales: si no, el equilibrio hablaría de
    // un conjunto distinto del que mide `porRiesgo` y no se podrían comparar.
    const k = s.pipBeneficio / s.pipRiesgo
    sumaK += k
    sumaCoste += coste
    if (k < kMin) kMin = k
    if (k > kMax) kMax = k
    if (r.resultado === 'ganada') {
      ganadas++
      sumaR += s.pipBeneficio / s.pipRiesgo - coste
    } else {
      perdidas++
      sumaR -= 1 + coste
    }
    pips += r.pips - costePips
  }

  const total = ganadas + perdidas
  return {
    total,
    ganadas,
    sinJuzgar,
    pips: Math.round(pips),
    acierto: total ? (ganadas / total) * 100 : null,
    porRiesgo: total ? sumaR / total : null,
    // Cuánto habría que acertar para quedar en cero, con estos costes y esta
    // geometría. Si `acierto` no le llega, la regla pierde por mucho que el
    // porcentaje suene bien.
    equilibrio: total ? ((1 + sumaCoste / total) / (sumaK / total + 1)) * 100 : null,
    // true solo si TODAS las operaciones comparten la misma proporción
    // objetivo/riesgo. Si es false, `equilibrio` es indicativo: ver arriba.
    equilibrioExacto: total ? kMax - kMin < 1e-9 : null,
  }
}

/**
 * El barrido de swap: cuántas operaciones duermen abiertas y cuánto cuesta eso
 * a cada nivel de swap.
 *
 * Vive aquí, y no dentro de `backtest.mjs`, por la misma razón que `medir`, y
 * la razón no es teórica: la primera versión de esta cuenta vivía en el script
 * y llamaba a `generarSenales` con los argumentos cambiados. El linter no lo
 * vio —los dos nombres existían— y como el script necesita descargar miles de
 * velas para arrancar, el fallo no habría aparecido hasta después de gastar
 * los créditos de la API. Aquí se prueba con datos de mentira en un segundo.
 *
 * @returns { total, cruzaron, mediaNoches, filas } — `filas` trae una entrada
 *          por nivel de NIVELES_SWAP con su medición y su coste medio en pips.
 */
export function barridoSwap(senales, porClave, niveles = NIVELES_SWAP) {
  const resueltas = []
  for (const s of senales) {
    const r = porClave.get(`${s.id}@${s.vistoEl}`)
    if (!r || (r.resultado !== 'ganada' && r.resultado !== 'perdida')) continue
    resueltas.push({ par: s.par, noches: nochesEntre(r.velaEntrada ?? s.vela, r.velaFinal) })
  }

  const total = resueltas.length
  const cruzaron = resueltas.filter((x) => x.noches > 0).length
  const sumaNoches = resueltas.reduce((a, x) => a + x.noches, 0)

  const filas = niveles.map((nivel) => {
    const sumaCoste = resueltas.reduce((a, x) => a + costeEnPips(x.par, x.noches, nivel), 0)
    return {
      nivel,
      medicion: medir(senales, porClave, { conSpread: true, swapPipsNoche: nivel }),
      costeMedio: total ? sumaCoste / total : 0,
    }
  })

  return { total, cruzaron, mediaNoches: total ? sumaNoches / total : 0, filas }
}
