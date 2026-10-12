// Que el UMBRAL DE FUERZA viva en un solo sitio, y que el reporte diario diga
// hasta dónde llegó la divergencia y cuánto hacía falta.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ POR QUÉ EXISTE ESTA PRUEBA
// ─────────────────────────────────────────────────────────────────────────
// El 2026-10-12, al ir a añadir la línea del umbral al reporte, apareció que
// el `0.5` que decide TODAS las señales estaba escrito a mano en NUEVE sitios
// en Swing y TRECE en Intradía: el vigía, el reporte, el comparador de reglas y
// cada guion del banco de pruebas llevaban su propia copia.
//
// Nada fallaba. Y ése es el problema: el día que alguien cambiara uno, la app
// diría una cosa, el reporte otra y el banco mediría una tercera, sin un solo
// error por ninguna parte. Es exactamente la familia de las etiquetas «(hoy)»
// que envejecieron solas el 2026-09-05 — un número bien escrito describiendo
// algo distinto de lo que dice describir.
//
// ⚠️ Y el arreglo no es «tener más cuidado»: es que el número viva en
// `marketCalc.js` y quien lo necesite lo IMPORTE, con esta prueba vigilando que
// no vuelva a aparecer escrito a mano.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ Y POR QUÉ LA LÍNEA DEL REPORTE HACE FALTA
// ─────────────────────────────────────────────────────────────────────────
// Porque la escala 0-10 de la fuerza NO sirve para saber si hubo divergencia.
// `esc` normaliza de mínimo a máximo, así que la divisa más débil vale 0 y la
// más fuerte 10 SIEMPRE, por pequeña que sea la diferencia real. Ese mismo día
// me engañó a mí teniendo el código delante: leí «CAD 10,0 · CHF 0,0» en
// Intradía y afirmé que había divergencia de sobra. La mayor de verdad era
// 0,31 contra un umbral de 0,59.
//
// Sin los dos números al lado, un reporte vacío es un HUECO: «el mercado está
// plano» y «la app está atascada» se leen exactamente igual.

import { readFileSync, readdirSync } from 'node:fs'

import { UMBRAL_FUERZA, derivarVista } from '../src/lib/marketCalc.js'

let ok = 0
let mal = 0
const bien = (c, m) => {
  if (c) {
    ok++
    console.log(`  ✓ ${m}`)
  } else {
    mal++
    console.log(`  ✗ ${m}`)
  }
  return c
}
const leer = (r) => readFileSync(new URL(r, import.meta.url), 'utf8')

// ── 1. La constante existe y es un número de verdad ──────────────────────
console.log('\n1. la constante')
bien(Number.isFinite(UMBRAL_FUERZA), `UMBRAL_FUERZA es un número (${UMBRAL_FUERZA})`)
bien(UMBRAL_FUERZA > 0, 'y es mayor que cero — un umbral de 0 dejaría pasar cualquier par')

const calc = leer('../src/lib/marketCalc.js')
bien(/^export const UMBRAL_FUERZA = /m.test(calc), 'se exporta desde marketCalc.js')

// ⚠️ Lo que de verdad cierra el agujero: que el valor por defecto de
// `derivarVista` sea la constante y no otro literal. Si fuera un literal, un
// guion que llamara sin `thr` mediría con un umbral distinto del publicado.
bien(/thr = UMBRAL_FUERZA/.test(calc), '`derivarVista` usa la constante como valor por defecto')
bien(!/thr = 0\.\d/.test(calc), 'y NO un número escrito a mano')

// ── 2. Nadie lo escribe a mano ───────────────────────────────────────────
console.log('\n2. ninguna copia a mano del número')

const guiones = readdirSync(new URL('./', import.meta.url))
  .filter((f) => f.endsWith('.mjs') && !f.startsWith('prueba-'))
  .map((f) => `scripts/${f}`)

// ⚠️ GUARDA: si el recorrido se rompe, esta prueba pasaría en verde sin haber
// mirado ni un archivo. Es el agujero de «una prueba que se adapta a lo que
// encuentra no comprueba nada».
bien(guiones.length >= 8, `se encontraron los guiones de scripts/ (${guiones.length})`)

const usan = guiones.filter((f) => {
  const t = leer(`../${f}`)
  return t.includes('derivarVista(') || t.includes('generarSenales(') || /\bTHR\b/.test(t)
})
bien(usan.length >= 4, `y los que deciden señales (${usan.length})`)

// Lo prohibido: el umbral con un número dentro. Se buscan las DOS formas en
// que estaba escrito —`thr: 0.5` al llamar y `const THR = 0.5` al declarar—
// más cualquier otro decimal, porque el fallo no es el 0,5 concreto: es que el
// número viva fuera de `marketCalc.js`.
const PROHIBIDO = /(\bthr:\s*\d|\bconst THR\s*=\s*\d|\bthr\s*=\s*\d)/
const culpables = usan.filter((f) => PROHIBIDO.test(leer(`../${f}`)))
bien(
  culpables.length === 0,
  culpables.length
    ? `ESCRIBEN EL UMBRAL A MANO: ${culpables.join(', ')} — importa UMBRAL_FUERZA de marketCalc.js`
    : 'ninguno escribe el umbral a mano'
)

// ── 3. La vista dice con qué umbral clasificó y hasta dónde llegó ────────
console.log('\n3. lo que devuelve la vista')

// Un mercado donde NINGÚN par pasa, que es el caso que la línea existe para
// explicar. Con `dif` pequeño no se construye ningún setup, así que basta una
// forma mínima del barrido.
const barridoFlojo = {
  ultima: '2026-10-12',
  horaUltima: 12,
  esc: { USD: 10, EUR: 0 },
  pares: [
    { name: 'EUR/USD', b: 'EUR', q: 'USD', dif: -0.21, tend: 'Rango', rsiV: 50, atrPct: 0.5, atrPctH: 0.5, c: 1.16, dec: 5, serie20: [1, 1.16], pivots: {} },
    { name: 'USD/CHF', b: 'USD', q: 'CHF', dif: 0.31, tend: 'Rango', rsiV: 50, atrPct: 0.5, atrPctH: 0.5, c: 0.83, dec: 5, serie20: [1, 0.83], pivots: {} },
  ],
}
const flojo = derivarVista(barridoFlojo)

bien(flojo.setups.length === 0, 'con divergencia por debajo del umbral no hay ni un setup')
bien(Number.isFinite(flojo.umbral), `la vista dice el umbral con el que clasificó (${flojo.umbral})`)
// ⚠️ Se compara con el MAYOR VALOR ABSOLUTO, no con el mayor `dif`: una
// divergencia de −0,31 pesa lo mismo que una de +0,31, solo cambia el lado.
bien(Math.abs(flojo.difMax - 0.31) < 1e-9, `y hasta dónde llegó la divergencia (${flojo.difMax})`)
bien(flojo.difMax <= flojo.umbral, 'y aquí la divergencia NO llegaba al umbral, que es lo que explica el vacío')

// ⚠️ `null` y NUNCA 0 cuando no hay nada que medir. Un 0 diría «hoy no hubo
// ninguna divergencia», que es una afirmación sobre el mercado; `null` dice «no
// lo sé», y quien lo pinte no pinta nada. Misma asimetría que `pearson`.
const vacio = derivarVista({ ...barridoFlojo, pares: [] })
bien(vacio.difMax === null, 'sin pares devuelve null, no 0')

const roto = derivarVista({ ...barridoFlojo, pares: [{ ...barridoFlojo.pares[0], dif: NaN }] })
bien(roto.difMax === null, 'con un `dif` roto devuelve null, no NaN')

// ── 4. El reporte lo imprime, y se calla si no se puede medir ────────────
console.log('\n4. el reporte diario')

const rep = leer('./reporte-diario.mjs')
bien(/lineaUmbral/.test(rep), 'el reporte tiene la línea del umbral')
bien(/\$\{lineaUmbral\(/.test(rep), 'y la pinta de verdad dentro del texto')
bien(/umbral de fuerza/.test(rep), 'con la frase que explica por qué no hay señales')

// ⚠️ ESTO ES LO QUE EVITA UNA LÍNEA INVENTADA. Sin la guarda, un barrido sin
// datos imprimiría «iba a NaN y hacía falta NaN», que es peor que no decir nada.
bien(/Number\.isFinite\(difMax\)/.test(rep), 'y se calla cuando `difMax` no se pudo medir')

// Y que no se haya quedado pasando su propia copia del número.
bien(!/derivarVista\([^)]*thr:/.test(rep), 'el reporte ya no pasa su propio umbral a `derivarVista`')

console.log('')
console.log(`${ok} bien · ${mal} MAL`)
if (mal) process.exit(1)
