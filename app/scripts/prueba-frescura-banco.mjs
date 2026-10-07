// Prueba de la medición del barrido viejo. Sin internet y sin créditos.
//
// Correr con: node scripts/prueba-frescura-banco.mjs

import { desvioDelRB, porcentajes, senalesConRetraso } from './lib/frescura-banco.mjs'
import { generarSenales } from './lib/backtest-nucleo.mjs'
import { actual } from './lib/geometrias.mjs'
import {
  ANTE_LA_DUDA,
  FECHA_DEL_LISTON,
  MIN_OPS,
  RETRASOS,
  UMBRAL,
  UMBRAL_NO_USABLES,
  juzgar,
} from './lib/preregistro-frescura.mjs'

let fallos = 0
const comprobar = (que, cond) => {
  console.log(`${cond ? '  OK  ' : '  MAL '} ${que}`)
  if (!cond) fallos++
}

// ─────────────────────────────────────────────────────────────────────────
// Un mercado inventado con MOVIMIENTO de verdad.
//
// ⚠️ Si el mercado es liso, el precio de ahora y el de hace k velas son casi
// el mismo, el retraso no cambia nada y la prueba pasaría comparando dos
// cosas idénticas sin comprobar nada. Es el fallo que ya mordió en
// `prueba-barrido-publicado.mjs` (una tendencia limpia daba CERO setups) y en
// `prueba-lss.mjs` (un mercado liso daba cero rupturas). Cada divisa lleva su
// onda con su propia fase, más un paseo, para que haya recorrido real.
// ─────────────────────────────────────────────────────────────────────────
const CCY = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD']
const N = 700

function mercado(semilla = 7) {
  let x = semilla
  const aleat = () => {
    x = (x * 1103515245 + 12345) % 2147483648
    return x / 2147483648 - 0.5
  }
  const barras = []
  const rates = {}
  const rangos = {}
  const nivel = {}
  CCY.forEach((c, k) => (nivel[c] = c === 'JPY' ? 150 : 1 + k * 0.03))

  for (let i = 0; i < N; i++) {
    const fecha = new Date(Date.UTC(2026, 0, 1, 0) + i * 3600_000).toISOString().slice(0, 19) + 'Z'
    barras.push(fecha)
    rates[fecha] = {}
    rangos[fecha] = {}
    CCY.forEach((c, k) => {
      if (c === 'USD') {
        rates[fecha].USD = 1
        rangos[fecha].USD = { hi: 1, lo: 1 }
        return
      }
      const onda = Math.sin((i / 37) * Math.PI * 2 + k) * 0.012
      nivel[c] *= 1 + onda * 0.02 + aleat() * 0.004
      const c0 = nivel[c]
      const amp = Math.abs(c0) * 0.0025
      rates[fecha][c] = c0
      rangos[fecha][c] = { hi: c0 + amp, lo: c0 - amp }
    })
  }
  return { barras, rates, rangos }
}

const M = mercado()

console.log('\n1. El listón existe y lleva su fecha dentro')
comprobar(`fecha del listón = ${FECHA_DEL_LISTON}`, FECHA_DEL_LISTON === '2026-10-07')
comprobar('el umbral del contexto sigue siendo el peso del spread (0,07)', UMBRAL === 0.07)
comprobar('y el que DECIDE es la fracción no usable (5 de cada 100)', UMBRAL_NO_USABLES === 5)
comprobar('ante la duda NO se afirma que cuesta', ANTE_LA_DUDA === 'noCuesta')
comprobar('se prueba el retraso de 3 horas, que es el de la frase', RETRASOS.includes(3))
comprobar('y el 0, que es la fila de control', RETRASOS.includes(0))

console.log('\n2. ⚠️ Con retraso 0 tiene que dar LO MISMO que el banco de siempre')
// Es la comprobación que sostiene toda la tabla: si la fila de control no
// reprodujera la app, se estarían comparando dos cosas distintas y la
// diferencia no sería del retraso.
{
  const base = generarSenales(M.barras, M.rates, M.rangos, { geometria: actual, calentamiento: 300 })
  const { senales: cero } = senalesConRetraso(M.barras, M.rates, M.rangos, { retraso: 0, geometria: actual, calentamiento: 300 })
  comprobar(`el banco da señales (${base.length})`, base.length > 0)
  comprobar(`retraso 0 da las mismas (${cero.length})`, cero.length === base.length)
  const mismas =
    base.length === cero.length &&
    base.every((b, i) => b.id === cero[i].id && b.vistoEl === cero[i].vistoEl && Math.abs(b.sl - cero[i].sl) < 1e-12 && Math.abs(b.precio - cero[i].precio) < 1e-12)
  comprobar('y con el mismo par, lado, fecha, entrada y stop', mismas)
}

console.log('\n3. Con retraso SÍ cambian las entradas, y los niveles NO')
{
  const { senales: tres } = senalesConRetraso(M.barras, M.rates, M.rangos, { retraso: 3, geometria: actual, calentamiento: 300 })
  comprobar(`con 3 de retraso también salen señales (${tres.length})`, tres.length > 0)
  // Si la entrada no se moviera, no se estaría midiendo nada.
  const movidas = tres.filter((s) => Math.abs(s.precio - (s.sl + s.tp) / 2) > 0).length
  comprobar('las entradas existen y son números', tres.every((s) => Number.isFinite(s.precio)) && movidas > 0)
  // El R/B que la pantalla enseñaba y el que se obtiene tienen que diferir en
  // ALGUNA señal, o el retraso sería inofensivo por construcción.
  const difieren = tres.filter((s) => Math.abs(s.rr - s.rrQueEnsenaba) > 1e-9).length
  comprobar(`el R/B enseñado difiere del real en ${difieren} de ${tres.length}`, difieren > 0)
}

console.log('\n4. ⚠️ Las que nacen rotas se CUENTAN, no se tiran')
{
  const r = senalesConRetraso(M.barras, M.rates, M.rangos, { retraso: 6, geometria: actual, calentamiento: 300 })
  const p = porcentajes(r)
  comprobar('devuelve el recuento de las dos clases', p !== null && 'pctRoto' in p && 'pctObjetivo' in p)
  // ⚠️ NO se puntúan (nadie abre una operación con el stop ya roto) pero SÍ
  // se cuentan: el recuento ES el coste, y si no saliera se estaría midiendo
  // «el barrido viejo en los casos en que no estorbó».
  comprobar(`cuenta ${r.yaRoto} con el stop ya roto`, r.yaRoto > 0)
  comprobar(`y ${r.yaEnObjetivo} con el objetivo ya pasado`, r.yaEnObjetivo > 0)
  comprobar('ninguna de las dos clases entra en la lista puntuada', r.senales.every((s) => !s.rotoStop && !s.pasadoObjetivo))
  comprobar('el porcentaje se calcula sobre lo VISTO, no sobre lo puntuado', p.vistas > p.puntuadas)
  comprobar('y las dos puntas se descartan, no solo la que asusta', r.yaEnObjetivo > 0 && r.yaRoto > 0)

  // ⚠️ Y lo que de verdad rompía la tabla: ni un solo riesgo de cero, porque
  // de ahí salía el NaN que se comía el promedio y hacía que el veredicto
  // contestara «noCuesta» sin haber mirado nada.
  comprobar('toda señal puntuada tiene riesgo medible', r.senales.every((s) => s.pipRiesgo >= 1 && Number.isFinite(s.rr)))
}

console.log('\n5. Sin señales no se afirma nada')
comprobar('porcentajes(sin señales) → null, no 0', porcentajes({ senales: [], yaRoto: 0, yaEnObjetivo: 0 }) === null)
comprobar('porcentajes(undefined) → null', porcentajes(undefined) === null)
comprobar('desvioDelRB([]) → null', desvioDelRB([]) === null)

console.log('\n6. El veredicto lo CALCULA juzgar(), sobre la fracción NO USABLE')
{
  const V = MIN_OPS + 10
  const cuesta = juzgar([
    { retraso: 0, vistas: V, pctNoUsables: 0, porRiesgo: -0.13 },
    { retraso: 3, vistas: V, pctNoUsables: 23.4, porRiesgo: -0.11 },
  ])
  comprobar(`23,4 de cada 100 no usables → cuesta (${cuesta.veredicto})`, cuesta.veredicto === 'cuesta')
  comprobar('y dice el número', Math.abs(cuesta.pctNoUsables - 23.4) < 1e-9)

  const no = juzgar([
    { retraso: 0, vistas: V, pctNoUsables: 0, porRiesgo: -0.13 },
    { retraso: 3, vistas: V, pctNoUsables: 1.2, porRiesgo: -0.13 },
  ])
  comprobar(`1,2 de cada 100 → NO cuesta (${no.veredicto})`, no.veredicto === 'noCuesta')

  // ⚠️ El caso que importa de verdad: que el «por 1R» MEJORE con datos viejos
  // NO puede salvar al retraso, porque ese número no decide. Si decidiera, un
  // artefacto de supervivencia bastaría para declarar el retraso inofensivo.
  const mejorR = juzgar([
    { retraso: 0, vistas: V, pctNoUsables: 0, porRiesgo: -0.13 },
    { retraso: 3, vistas: V, pctNoUsables: 30, porRiesgo: +0.21 },
  ])
  comprobar(`aunque el «por 1R» mejore, 30 % no usables → cuesta (${mejorR.veredicto})`, mejorR.veredicto === 'cuesta')
}

console.log('\n6b. El borde exacto, que es donde la coma flotante decide')
{
  const V = MIN_OPS + 10
  const justo = juzgar([
    { retraso: 0, vistas: V, pctNoUsables: 0, porRiesgo: -0.13 },
    { retraso: 3, vistas: V, pctNoUsables: UMBRAL_NO_USABLES, porRiesgo: -0.13 },
  ])
  comprobar(`exactamente ${UMBRAL_NO_USABLES} % → NO cuesta (${justo.veredicto})`, justo.veredicto === 'noCuesta')
  const pasado = juzgar([
    { retraso: 0, vistas: V, pctNoUsables: 0, porRiesgo: -0.13 },
    { retraso: 3, vistas: V, pctNoUsables: UMBRAL_NO_USABLES + 0.01, porRiesgo: -0.13 },
  ])
  comprobar('un pelo por encima → cuesta', pasado.veredicto === 'cuesta')
}

console.log('\n6c. ⚠️ Un NaN NO puede leerse como «no cuesta»')
{
  const V = MIN_OPS + 10
  const conNaN = juzgar([
    { retraso: 0, vistas: V, pctNoUsables: 0, porRiesgo: -0.13 },
    { retraso: 3, vistas: V, pctNoUsables: NaN, porRiesgo: -0.13 },
  ])
  comprobar(`NaN en la fila de 3 h → noSePudoMirar (${conNaN.veredicto})`, conNaN.veredicto === 'noSePudoMirar')
}

console.log('\n7. ⚠️ «No se pudo mirar» NUNCA es «no cuesta»')
{
  const V = MIN_OPS + 10
  comprobar('sin la fila de 3 h → noSePudoMirar', juzgar([{ retraso: 0, vistas: V, pctNoUsables: 0 }]).veredicto === 'noSePudoMirar')
  comprobar('sin la de control → noSePudoMirar', juzgar([{ retraso: 3, vistas: V, pctNoUsables: 9 }]).veredicto === 'noSePudoMirar')
  const pocas = juzgar([
    { retraso: 0, vistas: 10, pctNoUsables: 0 },
    { retraso: 3, vistas: 10, pctNoUsables: 90 },
  ])
  comprobar(`con 10 señales → noSePudoMirar aunque el 90 % no sirva (${pocas.veredicto})`, pocas.veredicto === 'noSePudoMirar')

  // ⚠️ Y la guarda que vigila a la propia medición: si la fila FRESCA
  // descartara señales, la fila de control no estaría reproduciendo la app y
  // toda la tabla compararía otra cosa.
  const controlRoto = juzgar([
    { retraso: 0, vistas: V, pctNoUsables: 4 },
    { retraso: 3, vistas: V, pctNoUsables: 20 },
  ])
  comprobar(`si la fila fresca descarta algo → noSePudoMirar (${controlRoto.veredicto})`, controlRoto.veredicto === 'noSePudoMirar')
}

console.log('\n8. El calentamiento sube con el retraso')
// Sin esto, la fila de 6 horas se calcularía sobre menos historia que la de 0
// y la comparación no sería entre iguales. Es el fallo del M15 con `ventana`.
{
  const a = senalesConRetraso(M.barras, M.rates, M.rangos, { retraso: 0, geometria: actual, ventana: 300 })
  const b = senalesConRetraso(M.barras, M.rates, M.rangos, { retraso: 6, geometria: actual, ventana: 300 })
  const primeraA = a.senales[0]?.vistoEl
  const primeraB = b.senales[0]?.vistoEl
  comprobar(`la de 6 h no empieza antes que la de 0 (${primeraA} vs ${primeraB})`, !primeraB || !primeraA || primeraB >= primeraA)
}

console.log(fallos === 0 ? '\n✓ todo bien.\n' : `\n✗ ${fallos} comprobación(es) fallaron.\n`)
process.exit(fallos === 0 ? 0 : 1)
