// Prueba del cálculo de si una señal acertó. Sin internet y sin claves:
//
//     node scripts/prueba-resolver.mjs
//
// Es la lógica de la que sale el porcentaje de acierto, o sea el número con
// el que Néstor va a decidir si le confía dinero a la app. Si esto se
// equivoca a favor propio, el número engaña. Por eso hay tantas
// comprobaciones para tan pocas líneas.

import { claveDe, resolver, resumir } from './lib/resolver.mjs'

let fallos = 0
const comprobar = (bien, que) => {
  console.log(`  ${bien ? '✓' : '✗'} ${que}`)
  if (!bien) fallos++
}

// Cuatro velas de mentira, para poder decir exactamente por dónde pasó el
// precio en cada una.
const BARRAS = ['t0', 't1', 't2', 't3']

// `highs`/`lows` van alineados con BARRAS.
const mundo = (highs, lows, { esCruce = false, name = 'EUR/USD' } = {}) => ({
  barras: BARRAS,
  pares: [{ name, highs, lows, esCruce }],
})

const senal = (extra = {}) => ({
  id: 'EUR/USD|COMPRA|tendencia',
  vistoEl: '2026-08-07T10:00:00.000Z',
  vela: 't0',
  par: 'EUR/USD',
  lado: 'COMPRA',
  tipo: 'tendencia',
  precio: 1.08,
  sl: 1.07,
  tp: 1.1,
  rr: 2,
  pipRiesgo: 100,
  pipBeneficio: 200,
  ...extra,
})

console.log('\n1. Una compra que llega al objetivo')
{
  //                        t0     t1     t2(toca 1.10)  t3
  const d = mundo([1.085, 1.09, 1.101, 1.10], [1.079, 1.085, 1.095, 1.099])
  const { resultados, abiertas } = resolver([senal()], d)
  comprobar(resultados.length === 1 && resultados[0].resultado === 'ganada', 'la da por ganada')
  comprobar(resultados[0].pips === 200, 'suma los pips de beneficio (+200)')
  comprobar(resultados[0].velaFinal === 't2', 'dice en qué vela se resolvió')
  comprobar(resultados[0].velasTardadas === 2, 'dice cuántas velas tardó')
  comprobar(abiertas === 0, 'no queda ninguna abierta')
}

console.log('\n2. Una compra que llega al stop')
{
  const d = mundo([1.085, 1.09, 1.09, 1.09], [1.079, 1.069, 1.08, 1.08])
  const { resultados } = resolver([senal()], d)
  comprobar(resultados[0].resultado === 'perdida', 'la da por perdida')
  comprobar(resultados[0].pips === -100, 'resta los pips de riesgo (−100)')
}

console.log('\n3. La misma vela toca el stop Y el objetivo')
{
  // No se puede saber cuál tocó primero: la vela solo guarda máximo y mínimo.
  const d = mundo([1.085, 1.101, 1.09, 1.09], [1.079, 1.069, 1.08, 1.08])
  const { resultados } = resolver([senal()], d)
  comprobar(
    resultados[0].resultado === 'perdida',
    'cuenta como PERDIDA — el historial no debe equivocarse a favor propio'
  )
}

console.log('\n4. Todavía no ha llegado a ninguno de los dos')
{
  const d = mundo([1.085, 1.09, 1.088, 1.09], [1.079, 1.075, 1.078, 1.08])
  const { resultados, abiertas } = resolver([senal()], d)
  comprobar(resultados.length === 0, 'no la juzga todavía')
  comprobar(abiertas === 1, 'la cuenta como abierta')
}

console.log('\n5. La vela en la que apareció no cuenta')
{
  // t0 ya toca el objetivo, pero es la vela de la señal: la entrada es a su
  // cierre, así que lo que pasó ANTES dentro de esa misma vela no vale.
  const d = mundo([1.15, 1.09, 1.088, 1.09], [1.079, 1.085, 1.078, 1.08])
  const { resultados, abiertas } = resolver([senal()], d)
  comprobar(resultados.length === 0 && abiertas === 1, 'no la da por ganada con su propia vela')
}

console.log('\n6. Una venta va al revés')
{
  const v = senal({ id: 'EUR/USD|VENTA|tendencia', lado: 'VENTA', sl: 1.09, tp: 1.06 })
  // Baja hasta 1.059: para una venta, eso es llegar al objetivo.
  const gana = mundo([1.085, 1.08, 1.07, 1.07], [1.079, 1.07, 1.059, 1.065])
  comprobar(resolver([v], gana).resultados[0].resultado === 'ganada', 'bajar al objetivo la gana')

  // Sube hasta 1.091: para una venta, eso es el stop.
  const pierde = mundo([1.085, 1.091, 1.07, 1.07], [1.079, 1.08, 1.06, 1.065])
  comprobar(resolver([v], pierde).resultados[0].resultado === 'perdida', 'subir al stop la pierde')
}

console.log('\n7. Señales viejas y ya juzgadas')
{
  const d = mundo([1.085, 1.09, 1.101, 1.10], [1.079, 1.085, 1.095, 1.099])

  // Una señal a la que le falta la vela. No debería existir, pero si el vigía
  // cambia de campo o una línea llega a medias, hay que caducarla: dejarla
  // "abierta" para siempre sería un silencio que nadie nota.
  //
  // (Antes aquí iba una etiqueta inventada, 'vela-que-ya-no-descargamos'. El
  // resolver ya no exige que la vela exista en la serie —busca la primera
  // posterior—, así que una etiqueta suelta ya no prueba nada. Lo de estar
  // fuera de la ventana se comprueba con horas reales en el bloque 13.)
  const sinVela = senal({ vela: undefined })
  const r1 = resolver([sinVela], d)
  comprobar(r1.caducadas === 1, 'una señal sin vela se marca caducada')
  comprobar(r1.resultados[0].resultado === 'caducada', 'y no se queda abierta en silencio')

  const r2 = resolver([senal()], d, new Set([claveDe(senal())]))
  comprobar(r2.resultados.length === 0, 'una ya juzgada no se vuelve a juzgar')
}

console.log('\n8. La misma señal en dos momentos son dos operaciones')
{
  const a = senal({ vistoEl: '2026-08-07T10:00:00.000Z' })
  const b = senal({ vistoEl: '2026-08-08T10:00:00.000Z' })
  comprobar(claveDe(a) !== claveDe(b), 'se distinguen por el momento, no solo por el par y lado')
}

console.log('\n9. El resumen separa lo exacto de lo aproximado')
{
  const d1 = mundo([1.085, 1.09, 1.101, 1.10], [1.079, 1.085, 1.095, 1.099])
  const d2 = mundo([1.085, 1.09, 1.09, 1.09], [1.079, 1.069, 1.08, 1.08], {
    esCruce: true,
    name: 'EUR/CHF',
  })

  const ganada = resolver([senal()], d1).resultados[0]
  const perdidaCruce = resolver([senal({ par: 'EUR/CHF' })], d2).resultados[0]

  comprobar(ganada.exacto === true, 'un par contra el dólar se marca exacto')
  comprobar(perdidaCruce.exacto === false, 'un cruce se marca aproximado')

  const r = resumir([ganada, perdidaCruce])
  comprobar(r.todas.total === 2 && r.todas.acierto === 50, 'las cuentas de todas salen bien')
  comprobar(
    r.exactas.total === 1 && r.exactas.acierto === 100,
    'las cuentas fiables van aparte y no se mezclan con las aproximadas'
  )
  comprobar(r.todas.pips === 100, 'los pips netos se suman (+200 −100)')
}

console.log('\n10. Sin nada que juzgar no revienta')
{
  const d = mundo([1.08], [1.08])
  const r = resolver([], d)
  comprobar(r.resultados.length === 0 && r.abiertas === 0, 'lista vacía → nada')
  comprobar(resumir([]).todas.acierto === null, 'sin operaciones el acierto es null, no 0%')
}

// Las señales "en sombra" son de un tipo que todavía está en pruebas: el
// vigía las anota, pero la app no las da y nadie recibe aviso de ellas. Si se
// colaran en el porcentaje, el número que mira Néstor estaría contando
// operaciones que nunca se le propusieron, y encima mezclando una regla sin
// aprobar con la que sí. Es de los errores que no dan ningún síntoma: el
// número sigue saliendo, solo que significa otra cosa.
console.log('\n11. Las señales en sombra no contaminan el porcentaje')
{
  const d = mundo([1.085, 1.09, 1.101, 1.10], [1.079, 1.085, 1.095, 1.099])
  const dosPares = { ...d, pares: [d.pares[0], { ...d.pares[0], name: 'GBP/USD' }] }

  const normal = senal()
  const sombra = { ...senal(), id: 'GBP/USD|COMPRA|retroceso', par: 'GBP/USD', tipo: 'retroceso', sombra: true }
  const { resultados } = resolver([normal, sombra], dosPares)

  comprobar(resultados.length === 2, 'el resolver juzga las dos por igual: la de sombra también se mide')
  comprobar(
    resultados.find((r) => r.par === 'GBP/USD')?.sombra === true,
    'y su resultado se queda marcado como sombra'
  )
  comprobar(
    resultados.find((r) => r.par === 'EUR/USD')?.sombra === undefined,
    'la normal NO queda marcada: el campo solo aparece cuando es verdad'
  )

  const r = resumir(resultados)
  comprobar(r.todas.total === 1, `el porcentaje visible cuenta solo la normal (${r.todas.total} de 2)`)
  comprobar(r.todas.pips === 200, 'los pips visibles tampoco incluyen los de la sombra')
  comprobar(r.sombra.total === 1 && r.sombra.acierto === 100, 'y la de sombra va en su propia casilla')

  // Y el historial ya escrito, de antes de que el campo existiera, tiene que
  // seguir contando igual que siempre.
  comprobar(
    resumir([{ resultado: 'ganada', pips: 10, exacto: true }]).todas.total === 1,
    'una línea vieja, sin el campo, sigue contando'
  )
}


// --- 13. La vela de la señal desapareció de la serie -----------------------
//
// El fallo que en la app hermana de swing costó 8 señales reales: su vigía
// anotó una vela de domingo que la fuente después quitó, `indexOf` dio -1 y
// esas operaciones quedaron marcadas "caducada" para siempre pese a que el
// mercado sí las había resuelto.
//
// Aquí todavía no ha pasado, pero el riesgo es MAYOR: son velas de una hora,
// y en 300 horas hay muchos más huecos posibles que en 300 días.

console.log('\n13. Si la vela exacta de la señal ya no está, se juzga igual')
{
  const conBarras = (barras, highs, lows) => ({
    barras,
    pares: [{ name: 'EUR/USD', highs, lows, esCruce: false }],
  })
  // La hora de la señal (12:00) falta en la serie: hueco del proveedor.
  const horas = ['2026-08-10 11:00:00', '2026-08-10 13:00:00', '2026-08-10 14:00:00', '2026-08-10 15:00:00']
  const s = senal({ vela: '2026-08-10 12:00:00' })

  const r = resolver([s], conBarras(horas, [1.08, 1.09, 1.11, 1.12], [1.075, 1.085, 1.09, 1.10]))
  comprobar(r.resultados.length === 1, 'la juzga en vez de darla por perdida para siempre')
  comprobar(r.resultados[0]?.resultado === 'ganada', 'y el veredicto es el correcto (ganada)')
  comprobar(r.caducadas === 0, 'ya no la marca caducada')

  // ⚠️ Lo que NO puede pasar: mirar velas ANTERIORES a la señal. Si el
  // objetivo solo se tocó a las 11:00 —una hora antes de que la señal
  // naciera— no es una ganancia, es una vela del pasado.
  const soloAntes = resolver(
    [senal({ vela: '2026-08-10 12:00:00' })],
    conBarras(horas, [1.11, 1.09, 1.09, 1.09], [1.08, 1.085, 1.085, 1.085])
  )
  comprobar(
    soloAntes.resultados.length === 0 && soloAntes.abiertas === 1,
    'NO cuenta como ganada un objetivo tocado antes de que la señal existiera'
  )
}

// --- 14. Una señal más nueva que la última vela sigue ABIERTA --------------

console.log('\n14. Una señal más nueva que la última vela queda abierta, no caducada')
{
  const corto = {
    barras: ['2026-08-10 11:00:00', '2026-08-10 12:00:00'],
    pares: [{ name: 'EUR/USD', highs: [1.09, 1.09], lows: [1.085, 1.085], esCruce: false }],
  }
  const r = resolver([senal({ vela: '2026-08-10 13:00:00' })], corto)
  comprobar(r.abiertas === 1, 'la cuenta como abierta')
  comprobar(r.caducadas === 0, 'y NO la da por caducada')
  comprobar(r.resultados.length === 0, 'no escribe ningún veredicto todavía')
}

// --- 15. Lo verdaderamente viejo sí caduca --------------------------------

console.log('\n15. Una señal anterior a todas las velas sí caduca')
{
  const r = resolver([senal({ vela: '2026-07-01 10:00:00' })], {
    barras: ['2026-08-10 11:00:00', '2026-08-10 12:00:00'],
    pares: [{ name: 'EUR/USD', highs: [1.2, 1.2], lows: [1.0, 1.0], esCruce: false }],
  })
  comprobar(r.caducadas === 1, 'la marca caducada')
  comprobar(
    r.resultados[0]?.resultado === 'caducada',
    'y no se inventa un veredicto con velas que no le corresponden'
  )
}

console.log(fallos ? `\n✗ ${fallos} comprobaciones fallaron\n` : '\n✓ todo bien\n')
process.exit(fallos ? 1 : 0)
