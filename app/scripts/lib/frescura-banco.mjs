// LA APP CON UN BARRIDO VIEJO — el generador de señales con retraso.
//
// El listón, el porqué y qué obliga cada resultado están en
// `preregistro-frescura.mjs`, escrito antes que esto.
//
// ─────────────────────────────────────────────────────────────────────────
// LA IDEA, EN UNA FRASE
// ─────────────────────────────────────────────────────────────────────────
// Entrar AHORA con los niveles de hace k horas. Ni más ni menos.
//
// Es lo que le pasa a quien abre la app con un barrido viejo: ve tres números
// (entrada, stop, objetivo) calculados hace rato, y abre la operación al
// precio que hay en ese momento, porque al de hace tres horas no puede.

import { computarBarrido, derivarVista } from '../../src/lib/marketCalc.js'
import { VENTANA } from './backtest-nucleo.mjs'

/**
 * Las señales que la app habría enseñado con un barrido de `retraso` velas de
 * antigüedad, entradas al precio de la vela actual.
 *
 * Con `retraso: 0` tiene que dar EXACTAMENTE lo mismo que `generarSenales` del
 * banco: es la fila de control y hay una comprobación dedicada a eso. Si se
 * separaran, toda la tabla compararía dos cosas distintas y no se vería.
 *
 * @param {string[]} barras   fechas, en orden
 * @param {object} rates
 * @param {object} rangos
 * @param {{retraso?:number, calentamiento?:number, thr?:number, topN?:number,
 *          geometria:Function, ventana?:number}} opciones
 */
export function senalesConRetraso(barras, rates, rangos, opciones) {
  const {
    retraso = 0,
    thr = 0.5,
    topN = 3,
    geometria,
    ventana = VENTANA,
    // El calentamiento sube con el retraso: con k velas de retraso, la
    // ventana vieja termina k velas antes, así que hace falta esa historia de
    // más. Sin esto, las primeras filas de la tabla se calcularían sobre menos
    // historia que las otras y la comparación no sería entre iguales — que es
    // el fallo que ya mordió en M15 (`ventana` tiene que escalar).
    calentamiento = ventana + retraso,
  } = opciones

  const senales = []
  let previas = new Set()
  // Se cuentan aparte, y las DOS. Contar solo las del stop roto sería quedarse
  // con la mitad que me da la razón.
  let yaRoto = 0
  let yaEnObjetivo = 0
  let sinRiesgoMedible = 0

  for (let i = calentamiento; i < barras.length; i++) {
    // El barrido VIEJO: la ventana termina `retraso` velas antes.
    const finViejo = i - retraso
    const dataVieja = computarBarrido(barras.slice(Math.max(0, finViejo + 1 - ventana), finViejo + 1), rates, rangos)
    const candidatos = derivarVista(dataVieja, { thr, topN }).setups

    // El barrido de AHORA, y solo para una cosa: el precio al que de verdad se
    // puede entrar. No se usa para elegir señales — ésas salen del viejo.
    const dataNueva = computarBarrido(barras.slice(Math.max(0, i + 1 - ventana), i + 1), rates, rangos)
    const precioAhora = new Map(dataNueva.pares.map((p) => [p.name, p.c]))

    const ahora = new Set()
    for (const s of candidatos) {
      const tipo = s.tipo || 'tendencia'
      const id = `${s.name}|${s.lado}|${tipo}`
      ahora.add(id)
      // Una señal que sigue viva seis horas es UNA operación, igual que en el
      // vigía y que en `generarSenales`.
      if (previas.has(id)) continue

      const c = s.crudo
      const compra = s.lado === 'COMPRA'
      // El stop y el objetivo salen del barrido VIEJO: son los números que la
      // pantalla tenía escritos.
      const { sl, tp } = geometria(c, compra)

      const entrada = precioAhora.get(s.name)
      if (!Number.isFinite(entrada)) continue

      const pip = c.dec === 2 ? 0.01 : 0.0001
      const riesgo = Math.abs(entrada - sl)
      const beneficio = Math.abs(tp - entrada)

      // ⚠️⚠️ LAS QUE NACEN FUERA DEL PASILLO: SE CUENTAN Y NO SE PUNTÚAN.
      //
      // Con el barrido viejo, el precio de ahora puede haberse salido ya del
      // pasillo entre el stop y el objetivo: la operación nace perdida (el
      // stop ya está roto) o nace ganada (el objetivo ya se alcanzó).
      //
      // Nadie abre una operación cuyo stop ya está roto —se ve en la pantalla
      // y no se toca—, así que lo honesto NO es puntuarlas como si se hubieran
      // tomado: es decir que **con el barrido viejo esas señales no se pueden
      // usar**. Ése es justamente el coste, y sale en su propia columna.
      //
      // ⚠️ Y SE DESCARTAN LAS DOS PUNTAS, NO UNA. Quitar solo las del stop
      // roto dejaría dentro las que nacen ganadas y el barrido viejo saldría
      // mejor de lo que es — la trampa exacta que este archivo existe para no
      // caer. Son simétricas y se van juntas.
      //
      // Lo que esto arregla además, y lo cazó el humo con mercado inventado:
      // con el precio exactamente en el stop el riesgo es CERO, la división
      // da `NaN`, y el `NaN` se comía la tabla entera. Un número que no existe
      // no puede entrar en un promedio.
      const rotoStop = compra ? entrada <= sl : entrada >= sl
      const pasadoObjetivo = compra ? entrada >= tp : entrada <= tp
      if (rotoStop) yaRoto++
      if (pasadoObjetivo) yaEnObjetivo++
      if (rotoStop || pasadoObjetivo) continue

      // Y aunque siga dentro del pasillo, un riesgo que redondea a menos de un
      // pip no se puede expresar en unidades de riesgo. Se cuenta aparte.
      if (!(riesgo > 0) || Math.round(riesgo / pip) < 1) {
        sinRiesgoMedible++
        continue
      }

      senales.push({
        id,
        vistoEl: barras[i],
        vela: barras[i],
        par: s.name,
        lado: compra ? 'COMPRA' : 'VENTA',
        ladoOriginal: s.lado,
        tipo,
        base: c.b,
        cotizada: c.q,
        // El precio de AHORA, que es al que se entra de verdad.
        precio: entrada,
        sl,
        tp,
        // ⚠️ `rr` se recalcula con la entrada real, no se hereda del barrido
        // viejo. El R/B que la pantalla ENSEÑABA era el viejo; el que se
        // obtiene es éste. La diferencia entre los dos es media medición.
        rr: riesgo > 0 ? beneficio / riesgo : 0,
        rrQueEnsenaba: Math.abs(tp - c.precio) / Math.abs(c.precio - sl),
        pipRiesgo: Math.round(riesgo / pip),
        pipBeneficio: Math.round(beneficio / pip),
        rotoStop,
        pasadoObjetivo,
        rsi: c.rsi,
        adx: c.adx,
        res: c.res,
        sup: c.sup,
      })
    }
    previas = ahora
  }

  return { senales, yaRoto, yaEnObjetivo, sinRiesgoMedible, vistas: senales.length + yaRoto + yaEnObjetivo + sinRiesgoMedible }
}

/**
 * Lo que de verdad se lee de un vistazo: de cada 100 señales, cuántas llegaban
 * con el stop ya roto y cuántas con el objetivo ya pasado.
 *
 * ⚠️ Devuelve `null` —y nunca 0— sin señales. Un 0 diría «ninguna llegaba
 * rota», que es una afirmación; sin datos no se afirma nada. Misma asimetría
 * que `pearson` en `correlacion.js`.
 */
export function porcentajes(r) {
  const { senales, yaRoto = 0, yaEnObjetivo = 0, sinRiesgoMedible = 0 } = r || {}
  if (!senales) return null
  // ⚠️ El denominador es TODO lo que la app enseñaba, no solo lo que se pudo
  // puntuar. Dividir entre las puntuadas daría porcentajes crecientes sobre
  // una base que encoge, y a 6 horas eso infla el número sin que nada haya
  // empeorado. Si no se vio nada, no se afirma nada.
  const vistas = senales.length + yaRoto + yaEnObjetivo + sinRiesgoMedible
  if (!vistas) return null
  return {
    puntuadas: senales.length,
    vistas,
    pctRoto: (100 * yaRoto) / vistas,
    pctObjetivo: (100 * yaEnObjetivo) / vistas,
    pctNoUsables: (100 * (yaRoto + yaEnObjetivo + sinRiesgoMedible)) / vistas,
  }
}

/**
 * Cuánto se desvía el R/B que la pantalla ENSEÑABA del que de verdad se
 * obtiene al entrar ahora. Mediana, para que cuatro señales con el stop casi
 * pegado no se lleven el número.
 *
 * Es el dato más honesto de toda la medición: no depende de si la app acierta,
 * solo de si lo que enseña sigue siendo cierto cuando lo lees.
 */
export function desvioDelRB(senales) {
  const difs = senales
    .filter((s) => Number.isFinite(s.rr) && Number.isFinite(s.rrQueEnsenaba) && s.rrQueEnsenaba > 0)
    .map((s) => s.rr - s.rrQueEnsenaba)
    .sort((a, b) => a - b)
  if (!difs.length) return null
  const m = Math.floor(difs.length / 2)
  // Con un número PAR se toma el de ARRIBA de los dos del medio, igual que en
  // `puntualidad.mjs`: equivocarse hacia «se desvía más» cuesta mirar un log,
  // y hacia «se desvía menos» cuesta justo lo que esto viene a cazar.
  return difs.length % 2 ? difs[m] : difs[m]
}
