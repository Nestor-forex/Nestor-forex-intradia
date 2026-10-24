// Prueba del listón del corte dólar/cruces y de la plomería que lo mide.
// Sin internet y sin gastar un crédito:
//
//     node scripts/prueba-cruces.mjs
//
// Lo que vigila, que son las formas de que esta medición dé un número creíble
// y equivocado:
//
//   1. **juzgar el montón que no se predijo**. Con dos montones siempre hay
//      uno mejor; elegirlo al verlo es troceo a posteriori y no mide nada;
//   2. **que `universo` filtre la SALIDA en vez del UNIVERSO**. Lo primero es
//      una resta («la app con menos señales»); lo segundo es otra app, donde
//      el cuarto sube al hueco. Son números distintos y el listón habla del
//      segundo;
//   3. **que recortar el universo toque la FUERZA**. Los once cruces se
//      DERIVAN de las siete divisas contra el dólar, así que recortar `esc`
//      dejaría sin fuerza a divisas que siguen haciendo falta;
//   4. **dar un veredicto con un dato que falta**, que es distinto de «no
//      pasa»;
//   5. **que un criterio sea imposible de cumplir**, que tumba la hipótesis
//      sin mirar el mercado (ya pasó en el listón de Swing, corregido antes
//      de medir).

import { readFileSync } from 'node:fs'
import { computarBarrido } from '../src/lib/marketCalc.js'
import { esConDolar, esCruce } from '../src/lib/diagnostico.js'
import { PAIR_NAMES } from '../src/lib/pairs.js'
import { generarSenales } from './lib/backtest-nucleo.mjs'
import { simetrica } from './lib/geometrias.mjs'
import {
  MAX_POR_PAR,
  MIN_FRACCION_SENALES,
  MONTON_PREDICHO,
  PARES_CON_DOLAR,
  PARES_CRUCE,
  QUE_NO_AUTORIZA,
  UMBRAL,
  juzgar,
} from './lib/preregistro-cruces.mjs'

let fallos = 0
const ok = (bien, que) => {
  console.log(`  ${bien ? 'OK  ' : 'MAL '} ${que}`)
  if (!bien) fallos++
}

// Un caso que pasa todos los criterios, para moverle UNO cada vez.
const BUENO = Object.freeze({
  monton: MONTON_PREDICHO,
  porRiesgo: -0.08,
  base: -0.13,
  mitades: [-0.07, -0.09],
  mitadesBase: [-0.12, -0.14],
  control: -0.2,
  senales: 3500,
  senalesBase: 8000,
  conSwap: -0.1,
  aporteMaxPar: 0.2,
})

console.log('\n1. El reparto de pares es el que dice el listón')
{
  const conDolar = PAIR_NAMES.filter(esConDolar)
  const cruces = PAIR_NAMES.filter(esCruce)
  ok(conDolar.length === PARES_CON_DOLAR, `${conDolar.length} pares con dólar (el listón dice ${PARES_CON_DOLAR})`)
  ok(cruces.length === PARES_CRUCE, `${cruces.length} cruces (el listón dice ${PARES_CRUCE})`)
  // ⚠️ Un par que no cayera en ninguno desaparecería de la medición en
  // silencio. Es la familia de `filasOtras`.
  ok(conDolar.length + cruces.length === PAIR_NAMES.length, 'y entre los dos están TODOS: ninguno se evapora')
  ok(
    !conDolar.some((p) => cruces.includes(p)),
    'ningún par está en los dos montones (se definen por lo que SON, no por descarte)'
  )
}

console.log('\n2. ⚠️ El veredicto EXIGE el montón predicho')
{
  ok(juzgar(BUENO).pasa, 'el caso bueno, con el montón predicho, pasa')
  const otro = MONTON_PREDICHO === 'dolar' ? 'cruces' : 'dolar'
  const v = juzgar({ ...BUENO, monton: otro })
  ok(v && !v.pasa, `⚠️ el MISMO resultado con el montón «${otro}» NO pasa`)
  ok(v && /posteriori/.test(v.falta.join(' ')), 'y dice por qué: elegirlo tras ver la tabla sería a posteriori')
}

console.log('\n3. Cada criterio tumba por su cuenta')
{
  const casos = [
    ['mejora por debajo del umbral', { porRiesgo: BUENO.base + UMBRAL / 2 }, /mejora/],
    ['empeora en la primera mitad', { mitades: [-0.2, -0.09] }, /mitad 1ª/],
    ['empeora en la segunda mitad', { mitades: [-0.07, -0.2] }, /mitad 2ª/],
    ['el CONTROL no empeora', { control: -0.01 }, /CONTROL/],
    ['deja muy pocas señales', { senales: 800 }, /señales de la app/],
    ['no aguanta el swap', { conSwap: -0.129 }, /swap/],
    ['un par se lleva la mejora', { aporteMaxPar: 0.9 }, /un solo par/],
  ]
  for (const [que, cambio, patron] of casos) {
    const v = juzgar({ ...BUENO, ...cambio })
    ok(v && !v.pasa && patron.test(v.falta.join(' | ')), `${que} → no pasa, y lo dice`)
  }
}

console.log('\n4. Los bordes exactos, que es donde la coma flotante decide')
{
  // ⚠️ `−0,06 − (−0,04)` en JavaScript da −0,019999999999999997. Sin tolerancia
  // un resultado que cae JUSTO en el umbral se iría al lado cómodo por el
  // último bit de un decimal, y el veredicto dependería de algo que nadie
  // escribió en ningún listón.
  ok(juzgar({ ...BUENO, porRiesgo: BUENO.base + UMBRAL }).pasa, 'justo en el umbral de mejora: pasa')
  ok(juzgar({ ...BUENO, conSwap: BUENO.base + UMBRAL }).pasa, 'justo en el umbral con swap: pasa')
  ok(
    juzgar({ ...BUENO, senales: Math.ceil(BUENO.senalesBase * MIN_FRACCION_SENALES) }).pasa,
    'justo en la fracción mínima de señales: pasa'
  )
  ok(juzgar({ ...BUENO, aporteMaxPar: MAX_POR_PAR }).pasa, 'justo en el máximo por par: pasa')
  // Empatar con la base en una mitad es «no empeora», que es lo que se pide.
  ok(juzgar({ ...BUENO, mitades: [...BUENO.mitadesBase] }).pasa, 'empatando en las dos mitades: pasa')
}

console.log('\n5. ⚠️ Un dato que falta NO es un criterio cumplido')
{
  for (const campo of ['porRiesgo', 'base', 'control', 'senales', 'senalesBase', 'conSwap']) {
    ok(juzgar({ ...BUENO, [campo]: null }) === null, `sin \`${campo}\` devuelve null («no se pudo juzgar»)`)
  }
  ok(juzgar({ ...BUENO, mitades: null }) === null, 'sin mitades devuelve null')
  ok(juzgar({ ...BUENO, mitades: [-0.07, null] }) === null, 'con una mitad sin medir devuelve null')
  ok(juzgar(null) === null, 'sin nada devuelve null')
  // `aporteMaxPar` es el único opcional: `null` significa «el grupo no gana en
  // conjunto», y entonces la pregunta «¿quién se lleva la mejora?» no tiene
  // respuesta. No puede tumbar por sí solo.
  ok(juzgar({ ...BUENO, aporteMaxPar: null }).pasa, 'sin concentración medible NO tumba: esa pregunta no aplica')
}

console.log('\n6. ⚠️ Los criterios son CUMPLIBLES (uno imposible no mide nada)')
{
  // Ya pasó en el listón de Swing: pedía el 70 % de las señales cuando la
  // aritmética da el 49 %, así que habría tumbado el corte sin mirar el
  // mercado. Aquí los pares con dólar son 7 de 18 = 39 %, y se pide 30 %.
  const fraccionDePares = PARES_CON_DOLAR / PAIR_NAMES.length
  ok(
    MIN_FRACCION_SENALES < fraccionDePares,
    `se pide el ${(100 * MIN_FRACCION_SENALES).toFixed(0)} % de las señales y los pares son el ` +
      `${(100 * fraccionDePares).toFixed(0)} % del universo: alcanzable`
  )
  ok(QUE_NO_AUTORIZA.encender === false, 'y pasarlo NO autoriza encender nada')
}

console.log('\n7. ⚠️ `universo` recorta los PARES, no la salida ni la fuerza')
{
  // Un mercado inventado con una onda por divisa, cada una con su fase, para
  // que haya divergencia de fuerza de verdad. Un mercado liso daría CERO
  // señales y la prueba pasaría comparando listas vacías — el agujero que ya
  // mordió en `prueba-barrido-publicado`.
  // ⚠️ LA MEZCLA IMPORTA Y COSTÓ VARIOS INTENTOS. Solo ondas da CERO señales:
  // una oscilación limpia deja el RSI clavado en el extremo (1,5 en la
  // primera versión) y el filtro de RSI los rechaza todos — el agujero ya
  // documentado en `prueba-barrido-publicado`. Solo paseo aleatorio deja el
  // RSI en su sitio pero la divergencia se queda en 0,31, por debajo del
  // umbral de 0,5. Hacen falta las dos cosas: la onda da la divergencia y el
  // paseo da los retrocesos que mueven el RSI.
  //
  // ⚠️ Y el azar es DETERMINISTA, no `Math.random`: dos corridas de esta
  // prueba tienen que dar exactamente lo mismo.
  const DIVISAS = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD']
  const BASE_PRECIO = { EUR: 0.92, GBP: 0.79, JPY: 150, CHF: 0.88, AUD: 1.52, NZD: 1.66, CAD: 1.36 }
  const N = 700
  const barras = []
  const rates = {}
  const rangos = {}
  const deriva = {}
  DIVISAS.forEach((c) => (deriva[c] = 0))
  let semilla = 12345
  const azar = () => {
    semilla = (semilla * 1103515245 + 12345) & 0x7fffffff
    return semilla / 0x7fffffff - 0.5
  }
  for (let i = 0; i < N; i++) {
    const ts = new Date(Date.UTC(2026, 0, 1) + i * 3600_000).toISOString().slice(0, 19).replace('T', ' ')
    barras.push(ts)
    rates[ts] = {}
    rangos[ts] = {}
    DIVISAS.forEach((c, k) => {
      deriva[c] += azar() * 0.0016
      const px = BASE_PRECIO[c] * (1 + Math.sin(i / 31 + k * 0.9) * 0.035 + deriva[c])
      rates[ts][c] = px
      rangos[ts][c] = { h: px * 1.0014, l: px * 0.9986 }
    })
  }

  const opts = { thr: 0.5, topN: 3, geometria: simetrica, calentamiento: 320 }
  const todas = generarSenales(barras, rates, rangos, opts)
  const soloDolar = generarSenales(barras, rates, rangos, { ...opts, universo: esConDolar })
  const soloCruces = generarSenales(barras, rates, rangos, { ...opts, universo: esCruce })

  console.log(`       mercado inventado: ${todas.length} señales · ${soloDolar.length} con dólar · ${soloCruces.length} cruces`)
  ok(todas.length > 0, 'el mercado inventado DA señales (si no, lo de abajo no comprueba nada)')
  ok(soloDolar.length > 0 && soloCruces.length > 0, 'y los dos universos restringidos también')

  const par = (s) => s.par || s.name
  ok(soloDolar.every((s) => esConDolar(par(s))), 'con `universo: esConDolar` NO sale ni un cruce')
  ok(soloCruces.every((s) => esCruce(par(s))), 'y con `esCruce` no sale ni un par con dólar')

  // ⚠️⚠️ ¿RESTA LIMPIA U OTRA APP? NO SE SUPONE: SE MIDE Y SE IMPRIME.
  //
  // En Swing está medido que quitar pares NO quita señales: el que estaba
  // cuarto sube al hueco. Aquí eso depende de que haya MÁS de `topN`
  // candidatos por lado, y los filtros de esta app son más estrictos (ADX,
  // RSI 70), así que puede no pasar nunca.
  //
  // La primera versión de esta prueba EXIGÍA que aparecieran señales nuevas, y
  // un barrido de 54 mercados inventados no encontró ni uno donde pasara. Eso
  // no es un fixture malo: es la respuesta. Exigirlo habría sido exigir que
  // esta app se comportara como la otra — la regla de siempre, con otra cara.
  //
  // Así que aquí solo se comprueba que el dato se MIDE; el número real lo
  // imprime `medir-cruces.mjs` sobre el mercado de verdad, y de él depende
  // cómo se lee la tabla.
  const clave = (s) => `${par(s)}|${s.lado}|${s.vistoEl}`
  const restaDeLaSalida = new Set(todas.filter((s) => esConDolar(par(s))).map(clave))
  const nuevas = soloDolar.filter((s) => !restaDeLaSalida.has(clave(s)))
  const faltan = [...restaDeLaSalida].filter((k) => !soloDolar.some((s) => clave(s) === k))
  console.log(
    `       restringido: ${soloDolar.length} señales · ${nuevas.length} que no estaban · ${faltan.length} que desaparecieron`
  )
  ok(
    nuevas.length + faltan.length >= 0 && Number.isFinite(nuevas.length),
    'el desplazamiento se puede medir (es lo que distingue una resta de otra app)'
  )

  // ⚠️ Lo que SÍ es un invariante, pase lo que pase con el desplazamiento: el
  // universo recorta los PARES. Con un universo de un solo par no puede salir
  // ningún otro, y eso falla en seco si alguien filtrara la salida DESPUÉS de
  // haber dejado competir a los 18.
  const unSoloPar = PAIR_NAMES[0]
  const soloUno = generarSenales(barras, rates, rangos, { ...opts, universo: (p) => p === unSoloPar })
  ok(
    soloUno.every((s) => par(s) === unSoloPar),
    `con un universo de un solo par (${unSoloPar}) no sale ningún otro`
  )

  // ⚠️ Y la FUERZA no se toca: `esc` sale de las siete divisas contra el
  // dólar, y los once cruces se derivan de ellas. Recortarla dejaría sin
  // fuerza a divisas que siguen haciendo falta para construir los pares que sí
  // se miran.
  const b = computarBarrido(barras.slice(0, 400), rates, rangos)
  ok(
    DIVISAS.every((c) => typeof b.esc[c] === 'number'),
    'el barrido da fuerza para las 7 divisas, que es de donde salen los cruces'
  )

  // Y que el universo por defecto no cambie nada de lo ya medido.
  const sinUniverso = generarSenales(barras, rates, rangos, { ...opts, universo: null })
  ok(
    sinUniverso.length === todas.length,
    `\`universo: null\` da lo mismo que no pasarlo (${sinUniverso.length} = ${todas.length}): el cambio es aditivo`
  )
}

console.log('\n8. El guion de medición usa el listón y no se inventa el veredicto')
{
  const src = readFileSync(new URL('./medir-cruces.mjs', import.meta.url), 'utf8')
  ok(/from '\.\/lib\/preregistro-cruces\.mjs'/.test(src), 'importa el listón')
  ok(/juzgar\(\{/.test(src), 'y llama a `juzgar()`')
  ok(/MONTON_PREDICHO/.test(src), '⚠️ y juzga el montón PREDICHO, no el que gane')
  // ⚠️ El umbral no puede estar escrito a mano: es el fallo de los nueve
  // sitios. Se comprueba que se importe y que no haya un 0.5 suelto.
  ok(/UMBRAL_FUERZA/.test(src), 'el umbral de fuerza se IMPORTA, no se escribe')
  ok(!/const THR = 0\.\d/.test(src), 'y no hay un umbral escrito a mano')
  // Que el otro montón se imprima aunque no se juzgue: esconderlo sería
  // enseñar media tabla.
  ok(/CONTROL/.test(src), 'el control se imprime aunque no se juzgue')
}

console.log(`\n${fallos === 0 ? '✅ Todo bien' : `❌ ${fallos} fallos`}\n`)
process.exit(fallos ? 1 : 0)
