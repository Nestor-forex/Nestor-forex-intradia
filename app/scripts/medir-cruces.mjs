// ¿SE REPITE EN INTRADÍA EL CORTE DÓLAR / CRUCES QUE SE VIO EN SWING?
//
// Correr con: Actions → «¿Sirve partir en pares con dólar y cruces?» → Run
// workflow. Cuesta 7 créditos de Twelve Data (una descarga de velas, las
// mismas que el resto del banco).
//
// ⚠️ ESTO NO CAMBIA NADA DE LA APP. Es un diagnóstico: no toca ningún archivo
// de `src/`, el workflow lleva `permissions: contents: read` y el veredicto lo
// CALCULA `juzgar()` en `lib/preregistro-cruces.mjs`, escrito el 2026-10-24
// antes de correr esto ni una vez.
//
// ⚠️⚠️ Y LA DIRECCIÓN VA FIJADA EN EL LISTÓN, no se elige aquí. Se miden los
// dos montones porque uno es el CONTROL del otro, pero solo se juzga el que el
// listón predijo. Quedarse con el que gane al verlo no mediría nada: con dos
// montones siempre hay uno mejor.
//
// El porqué de la pregunta, el listón y lo que autoriza cada veredicto están
// todos ahí dentro. Aquí solo se mide.

import { computarBarrido, UMBRAL_FUERZA } from '../src/lib/marketCalc.js'
import { esConDolar, esCruce } from '../src/lib/diagnostico.js'
import { PAIR_NAMES } from '../src/lib/pairs.js'
import { generarSenales, medir } from './lib/backtest-nucleo.mjs'
import { resolver } from './lib/resolver.mjs'
import { simetrica } from './lib/geometrias.mjs'
import { leerLlave, obtenerVelas } from './lib/velas.mjs'
import {
  FECHA_DEL_LISTON,
  HAY_MECANISMO,
  MONTON_PREDICHO,
  PARES_CON_DOLAR,
  PARES_CRUCE,
  QUE_NO_AUTORIZA,
  QUE_SIGNIFICA,
  SWAP_EXIGIDO,
  VARA_QUE_DECIDE,
  juzgar,
} from './lib/preregistro-cruces.mjs'

const VELAS = 5000
const PAGINAS = Number(process.env.PAGINAS || 4)
// ⚠️ NO se escribe el número: se importa. Copias a mano del umbral que decide
// todas las señales son copias de otra app (2026-10-12).
const THR = UMBRAL_FUERZA
const TOP_N = 3

const n3 = (x) => (x == null ? '   —   ' : ((x >= 0 ? '+' : '') + x.toFixed(3)).padStart(7))

console.log('---CRUCES-INICIO---')
console.log('═'.repeat(96))
console.log('¿SE REPITE AQUÍ EL CORTE DÓLAR / CRUCES DE SWING?')
console.log(`Listón escrito el ${FECHA_DEL_LISTON}, antes de esta corrida. Decide la vara ${VARA_QUE_DECIDE}.`)
console.log('═'.repeat(96))
console.log('')
console.log(`⚠️  La dirección va FIJADA DE ANTEMANO: se juzga «${MONTON_PREDICHO}», que es donde`)
console.log('    la app de Swing midió mejor. El otro montón es el CONTROL. Si gana el')
console.log('    contrario, NO cuenta como aprobado: sería una hipótesis nueva.')
if (!HAY_MECANISMO) {
  console.log('')
  console.log('⚠️  Y la predicción es FLOJA: nadie ha explicado POR QUÉ pasa en Swing.')
  console.log('    Hay un número y no hay mecanismo.')
}
console.log('')

const { barras, rates, rangos } = await obtenerVelas(leerLlave(), { velas: VELAS, paginas: PAGINAS })
const completo = computarBarrido(barras, rates, rangos)
console.log(`${barras.length} velas de una hora · de ${barras[0]} a ${barras[barras.length - 1]}`)

// ⚠️ Se comprueba el reparto de pares en vez de confiar en el listón: si algún
// día la app añadiera o quitara un par, los números del listón (7 y 11)
// dejarían de describir lo que se mide y nadie se enteraría.
const conDolar = PAIR_NAMES.filter(esConDolar)
const cruces = PAIR_NAMES.filter(esCruce)
console.log(`${PAIR_NAMES.length} pares: ${conDolar.length} con dólar · ${cruces.length} cruces`)
if (conDolar.length !== PARES_CON_DOLAR || cruces.length !== PARES_CRUCE) {
  console.log('')
  console.log(`⚠️⚠️ EL REPARTO CAMBIÓ: el listón se escribió con ${PARES_CON_DOLAR} y ${PARES_CRUCE}.`)
  console.log('   Los criterios derivados de esa estructura ya no describen esto. Se para aquí.')
  console.log('---CRUCES-FIN---')
  process.exit(1)
}
// Y que la suma cuadre: un par que no cayera en ninguno de los dos montones
// desaparecería de la medición en silencio. Es la familia de `filasOtras`.
if (conDolar.length + cruces.length !== PAIR_NAMES.length) {
  console.log('')
  console.log('⚠️⚠️ HAY PARES QUE NO CAEN EN NINGÚN MONTÓN. Se para aquí.')
  console.log('---CRUCES-FIN---')
  process.exit(1)
}

// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ SE MIDE LA APP ENTERA CON UN UNIVERSO RESTRINGIDO
// ─────────────────────────────────────────────────────────────────────────
// `universo` filtra QUÉ PARES MIRA la app, no qué señales se cuentan después.
// Con `topN` fijo, quitar pares no quita señales: el que estaba cuarto sube al
// hueco y entra en otra hora, a otro precio. Filtrar la salida mediría «la app
// con menos señales», que es otra pregunta.
function correr(universo = null) {
  const senales = generarSenales(barras, rates, rangos, {
    thr: THR,
    topN: TOP_N,
    geometria: simetrica,
    universo,
  })
  const { resultados } = resolver(senales, completo)
  return { senales, porClave: new Map(resultados.map((x) => [x.clave, x])) }
}

const corte = barras[Math.floor(barras.length / 2)]
const mitad = (senales, cual) => senales.filter((s) => (cual === 1 ? s.vistoEl < corte : s.vistoEl >= corte))

function grupo({ senales, porClave }) {
  const m = (lista, swap = 0) => medir(lista, porClave, { conSpread: true, swapPipsNoche: swap })
  const total = m(senales)
  return {
    senales,
    porClave,
    ops: total.total,
    acierto: total.acierto,
    // ⚠️ `null` y NUNCA 0: «no se pudo medir» y «midió cero» no son lo mismo, y
    // un 0 le ganaría a un negativo en cualquier comparación. `juzgar()` se
    // niega a dar veredicto con esto. Misma decisión que `pearson`.
    por1R: total.porRiesgo,
    mitad1: m(mitad(senales, 1)).porRiesgo,
    mitad2: m(mitad(senales, 2)).porRiesgo,
    swap: m(senales, SWAP_EXIGIDO).porRiesgo,
  }
}

// Suma de R por par, para saber si la mejora se la lleva uno solo. Con 7 pares
// en el montón hay poca holgura: uno que aporte casi todo no es una regla, es
// ese par en ese periodo.
function concentracionDeLaMejora(g) {
  const sumas = PAIR_NAMES.map((par) => {
    const suyas = g.senales.filter((s) => s.par === par || s.name === par)
    if (!suyas.length) return 0
    const r = medir(suyas, g.porClave, { conSpread: true })
    return Number.isFinite(r.porRiesgo) ? suyas.length * r.porRiesgo : 0
  })
  const total = sumas.reduce((a, b) => a + b, 0)
  // Si en conjunto no gana, «¿quién se lleva la mejora?» no tiene respuesta.
  // `null` = no se puede juzgar, nunca «no se concentra».
  if (!(total > 0)) return null
  const mayor = Math.max(...sumas)
  return mayor > 0 ? mayor / total : null
}

const base = grupo(correr(null))
const gDolar = grupo(correr(esConDolar))
const gCruces = grupo(correr(esCruce))

// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ ¿RESTA LIMPIA U OTRA APP? EL NÚMERO QUE DECIDE CÓMO SE LEE LA TABLA
// ─────────────────────────────────────────────────────────────────────────
// En Swing está medido que quitar pares NO quita señales: con `topN` fijo el
// que estaba cuarto sube al hueco. Aquí eso depende de que haya MÁS de `topN`
// candidatos por lado, y los filtros de esta app son más estrictos (ADX,
// RSI). Puede no pasar nunca.
//
// ⚠️ NO SE SUPONE, SE MIDE. Un barrido de 54 mercados inventados no encontró
// ni uno donde apareciera una señal nueva al restringir — eso ya apuntaba a
// que aquí podría ser una resta limpia. El número de verdad es éste, y cambia
// lo que la tabla significa:
//
//   · si hay señales NUEVAS → «la app sin cruces» es OTRA app, y la mejora
//     puede venir de las señales que suben al hueco;
//   · si no las hay → es una resta limpia, y la mejora es exactamente «la app
//     menos ese montón». Más fácil de leer, y entonces el listón es más
//     estricto de lo que hacía falta, no menos.
const claveDe = (s) => `${s.par || s.name}|${s.lado}|${s.vistoEl}`
function desplazamiento(restringido, filtro) {
  const delCompleto = new Set(base.senales.filter((s) => filtro(s.par || s.name)).map(claveDe))
  const nuevas = restringido.senales.filter((s) => !delCompleto.has(claveDe(s))).length
  return { nuevas, antes: delCompleto.size }
}
const despDolar = desplazamiento(gDolar, esConDolar)
const despCruces = desplazamiento(gCruces, esCruce)

console.log('')
console.log(
  `desplazamiento · con dólar: ${despDolar.nuevas} señales nuevas de ${gDolar.ops} ` +
    `(la app completa daba ${despDolar.antes} en esos pares)`
)
console.log(
  `               · cruces:    ${despCruces.nuevas} señales nuevas de ${gCruces.ops} ` +
    `(la app completa daba ${despCruces.antes} en esos pares)`
)
console.log(
  despDolar.nuevas === 0 && despCruces.nuevas === 0
    ? '   → es una RESTA LIMPIA en esta app: nadie sube al hueco. La tabla se lee tal cual.'
    : '   → NO es una resta: al quitar pares, otros suben al hueco y entran en otra hora.'
)

console.log('')
console.log(
  `${'universo'.padEnd(24)} ${'ops'.padStart(6)}  ${'acierto'.padStart(7)}  ${'por 1R'.padStart(7)}  ` +
    `${'1ª mit'.padStart(7)}  ${'2ª mit'.padStart(7)}  ${'+swap'.padStart(7)}`
)
console.log('─'.repeat(96))
for (const [etiq, g] of [
  [`los ${PAIR_NAMES.length} (la app)`, base],
  [`solo con dólar (${conDolar.length})`, gDolar],
  [`solo cruces (${cruces.length})`, gCruces],
]) {
  const pct = g.acierto == null ? '    — ' : `${g.acierto.toFixed(0)} %`.padStart(7)
  console.log(
    `${etiq.padEnd(24)} ${String(g.ops).padStart(6)}  ${pct}  ${n3(g.por1R)}  ` +
      `${n3(g.mitad1)}  ${n3(g.mitad2)}  ${n3(g.swap)}`
  )
}
console.log('─'.repeat(96))

// ─────────────────────────────────────────────────────────────────────────
// EL VEREDICTO, CALCULADO
// ─────────────────────────────────────────────────────────────────────────
const juzgado = MONTON_PREDICHO === 'dolar' ? gDolar : gCruces
const control = MONTON_PREDICHO === 'dolar' ? gCruces : gDolar

const v = juzgar({
  monton: MONTON_PREDICHO,
  porRiesgo: juzgado.por1R,
  base: base.por1R,
  mitades: [juzgado.mitad1, juzgado.mitad2],
  mitadesBase: [base.mitad1, base.mitad2],
  control: control.por1R,
  senales: juzgado.ops,
  senalesBase: base.ops,
  conSwap: juzgado.swap,
  aporteMaxPar: concentracionDeLaMejora(juzgado),
})

console.log('')
if (v === null) {
  // ⚠️ «No se pudo juzgar» NO es «no pasa». Un dato que falta deja la pregunta
  // abierta, no contestada.
  console.log('⚠️  NO SE PUDO JUZGAR: falta algún número (algún grupo quedó sin operaciones).')
  console.log('    Eso NO quiere decir que no pase: quiere decir que no se sabe.')
} else if (v.pasa) {
  console.log(`✅ PASA EL LISTÓN — la app solo con pares con ${MONTON_PREDICHO === 'dolar' ? 'dólar' : 'cruce'}`)
  console.log(`   ${QUE_SIGNIFICA.pasa}`)
} else {
  console.log(`❌ NO PASA — la app solo con pares con ${MONTON_PREDICHO === 'dolar' ? 'dólar' : 'cruce'}`)
  for (const f of v.falta) console.log(`   · ${f}`)
  console.log('')
  console.log(`   ${QUE_SIGNIFICA.noPasa}`)
}

// Y el otro montón se IMPRIME aunque no se juzgue, porque esconderlo sería
// enseñar solo la mitad del dato. Lo que no se hace es ascenderlo a candidato.
console.log('')
console.log(
  `Para referencia, el CONTROL (${MONTON_PREDICHO === 'dolar' ? 'cruces' : 'con dólar'}): ` +
    `${n3(control.por1R)} contra ${n3(base.por1R)} de la app entera.`
)
if (control.por1R != null && base.por1R != null && control.por1R > base.por1R) {
  console.log('')
  console.log('⚠️⚠️ EL CONTROL SALIÓ MEJOR QUE LA BASE, o sea al revés que en Swing.')
  console.log('    Eso NO lo asciende a candidato: se diseñó como control y se miró')
  console.log('    después de la tabla, que es el troceo a posteriori que este proyecto')
  console.log('    lleva meses rechazando. Si se persigue, va con una medición PROPIA y')
  console.log('    diseñada de antemano.')
}

console.log('')
console.log(`⚠️  Lo que esto NO autoriza: ${QUE_NO_AUTORIZA.porque}`)
console.log('---CRUCES-FIN---')
