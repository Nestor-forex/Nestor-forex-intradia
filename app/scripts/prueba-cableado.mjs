// ¿LLEGA DE VERDAD A LA PANTALLA LO QUE EL HOOK CALCULA? Sin internet.
//
// Correr con: node scripts/prueba-cableado.mjs
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE: DOS TARJETAS LLEVABAN MESES SIN VERSE
// ─────────────────────────────────────────────────────────────────────────
// El 2026-10-07 se encontró que en la APP HERMANA (Swing) las tarjetas
// `Correlacion` y `RiesgoSenales` NO SE VEÍAN. Las dos estaban bien escritas,
// probadas y verificadas en navegador. El fallo era una sola cosa:
//
// ⚠️ Aquí el cableado estaba bien —se comprobó el mismo día, clave por clave—,
// así que esta prueba no arregla nada: existe para que no PASE. A los PRIMOS no
// los vigila nadie y es justo donde se acumulan estas cosas.
//
//   `derivarVista` calculaba `correlaciones` y `riesgoSenales`
//   `App.jsx` pasaba `mercado.correlaciones` y `mercado.riesgoSenales`
//   `useMarketData` NO LAS DEVOLVÍA  ← aquí
//   `TableroCompleto` las recibía con `= []` por defecto
//   y las dos tarjetas devuelven `null` con la lista vacía
//
// ⚠️ NO FALLABA NADA. Ni el build, ni el linter, ni las 31 pruebas. Una tarjeta
// que no se pinta se ve exactamente igual que una tarjeta a la que hoy no le
// salieron datos — que es el estado NORMAL de `RiesgoSenales`.
//
// 📌 Y lo que lo hace peor: las dos se verificaron en Chromium y pasaron. El
// banco aislado monta el componente a mano y le ENTREGA los datos, así que por
// construcción **nunca puede cazar un dato que no llega**. Es el agujero de
// «una prueba que mide lo que dice medir» por una cara nueva: aquí el banco
// medía bien el componente y la app estaba rota por encima de él.
//
// ⚠️ ES PRIMO, no gemelo, y el motivo está a la vista en los bloques 3 y 6: las
// dos apps no devuelven las mismas claves ni esconden la misma regla de sombra.
// La parte que de verdad importa —el bloque 2— sí es idéntica.
//
// ⚠️ Esta prueba lee los archivos COMO TEXTO a propósito. Importar `App.jsx`
// pediría React, un DOM y Firebase; lo que hace falta comprobar no es que la
// app arranque, sino que las dos listas de nombres cuadren. Es la misma técnica
// del bloque 7 de `prueba-mt5.mjs`, que lee `bridge_mt5.py` sin Python.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

let fallos = 0
const comprobar = (que, cond) => {
  console.log(`${cond ? '  OK  ' : '  MAL '} ${que}`)
  if (!cond) fallos++
}

const leer = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

// Las claves del ÚLTIMO objeto que devuelve un archivo.
//
// ⚠️ No se hace con una expresión regular por línea, y el motivo salió al
// estrenar esto: en una app el `return { … }` ocupa veinte líneas y en la
// hermana cabe en una sola. Un lector que contara líneas indentadas devolvía
// CERO claves ahí — y entonces la prueba habría pasado en verde sin haber
// mirado nada, que es el agujero de siempre. Se cuentan llaves y se parte por
// las comas de nivel cero, que funciona con las dos formas.
function clavesDelReturn(codigo) {
  const i = codigo.lastIndexOf('return {')
  if (i === -1) return []

  let prof = 0
  let fin = -1
  for (let k = i + 'return '.length; k < codigo.length; k++) {
    if (codigo[k] === '{') prof++
    else if (codigo[k] === '}' && --prof === 0) {
      fin = k
      break
    }
  }
  if (fin === -1) return []

  const dentro = codigo
    .slice(i + 'return {'.length, fin)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')

  const trozos = []
  let actual = ''
  prof = 0
  for (const ch of dentro) {
    if ('{[('.includes(ch)) prof++
    else if ('}])'.includes(ch)) prof--
    if (ch === ',' && prof === 0) {
      trozos.push(actual)
      actual = ''
    } else actual += ch
  }
  trozos.push(actual)

  return [...new Set(trozos.map((t) => (t.trim().match(/^([a-zA-Z_$][\w$]*)\s*(:|$)/) || [])[1]).filter(Boolean))].sort()
}

const APP = leer('../src/App.jsx')
const HOOK = leer('../src/lib/useMarketData.js')

// Lo que `App.jsx` le pide al hook.
const pedidos = [...new Set([...APP.matchAll(/\bmercado\.([a-zA-Z_$][\w$]*)/g)].map((m) => m[1]))].sort()

// Lo que el hook devuelve.
const devueltos = clavesDelReturn(HOOK)

console.log('\n1. Las dos listas se encontraron de verdad')
// ⚠️ La guarda de siempre: sin esto, un cambio de forma en cualquiera de los
// dos archivos dejaría las listas vacías y la prueba pasaría en verde sin haber
// comprobado nada. Una prueba que se adapta a lo que encuentra no comprueba
// nada.
comprobar(`App.jsx usa varias cosas de \`mercado\` (${pedidos.length})`, pedidos.length >= 10)
comprobar(`el hook devuelve varias claves (${devueltos.length})`, devueltos.length >= 10)
comprobar('entre ellas está `loading`, o sea que se leyó el bloque bueno', devueltos.includes('loading'))

console.log('\n2. ⚠️ TODO lo que la app pide, el hook lo devuelve')
const faltan = pedidos.filter((p) => !devueltos.includes(p))
comprobar(
  faltan.length === 0 ? 'ninguna clave se queda por el camino' : `FALTAN en useMarketData: ${faltan.join(', ')}`,
  faltan.length === 0
)

console.log('\n3. Las dos propias de esta app, con nombre')
// ⚠️ Aquí NO están `correlaciones` ni `riesgoSenales`, que son las dos que
// estaban rotas en Swing: la correlación no existe en esta app, y a propósito
// —su ventana de 60 sesiones son 60 HORAS, o sea dos días y medio, que no es
// una relación sino una foto de esta semana (decidido el 2026-09-08)—. Se
// nombran en su lugar las dos que solo esta app tiene.
comprobar('`rangos` llega a la pantalla (el modo rango es propio de esta app)', devueltos.includes('rangos'))
comprobar('`sesion` llega a la pantalla (Asia/Londres/NY)', devueltos.includes('sesion'))

console.log('\n4. Y lo que el hook devuelve de más, para que se vea')
// ⚠️ Esto NO falla, y es a propósito. Una clave que el hook devuelve y la app
// no usa puede ser perfectamente legítima (la usa otro componente, o se dejó
// para la pantalla siguiente). Lo que no puede pasar es lo contrario.
const sobran = devueltos.filter((d) => !pedidos.includes(d))
if (sobran.length) console.log(`       (devueltas y no usadas en App.jsx: ${sobran.join(', ')})`)

console.log('\n5. La frescura del barrido, que es de lo que salió todo esto')
comprobar('el hook devuelve `generadoEl`', devueltos.includes('generadoEl'))
comprobar('el hook devuelve `horasViejo`', devueltos.includes('horasViejo'))
comprobar('`horasViejo` sale de una constante con su porqué escrito', /HORAS_VIEJO\s*=\s*\d+/.test(HOOK))
// ⚠️ El umbral NO puede vivir en `frescura.js`, que es GEMELO: cada app publica
// con una cadencia distinta y copiar el número de la hermana sería traerse una
// suposición falsa. Ver la cabecera de `frescura.js`.
comprobar('`frescura.js` NO lleva el umbral dentro', !/HORAS_VIEJO/.test(leer('../src/lib/frescura.js')))

console.log('\n6. ⚠️ Lo que `derivarVista` calcula y el hook deja fuera, CON EL MOTIVO')
// ─────────────────────────────────────────────────────────────────────────
// Esta es la comprobación que de verdad habría cazado el fallo, porque mira la
// RAÍZ y no el síntoma: `derivarVista` calculaba `correlaciones` y el hook la
// tiraba. Nadie lo decidió — se quedó así.
//
// ⚠️ Y NO vale exigir que se pase TODO. Hay cosas que el hook deja fuera a
// propósito, y una de ellas es una regla de la SOMBRA: pasarla a la pantalla la
// encendería sin que nadie lo hubiera decidido, que es exactamente el fallo
// grave del 2026-09-07 («esSombra»). Así que la lista va ESCRITA A MANO con el
// motivo de cada una, igual que PRIMOS en `gemelos.mjs`: lo que no esté en
// ninguna de las dos listas es un descuido y falla.
const NO_SE_PASAN = {
  retrocesos:
    '⚠️ REGLA EN LA SOMBRA (el retroceso). No se enseña en ninguna pantalla hasta que pase su listón: pasarla al hook la encendería de hecho. Sus NÚMEROS sí se ven, en el Historial, que los lee del historial publicado y no de aquí.',
}

const calculados = clavesDelReturn(leer('../src/lib/marketCalc.js'))

comprobar(`se encontró lo que devuelve \`derivarVista\` (${calculados.length})`, calculados.length >= 8)
const perdidos = calculados.filter((c) => !devueltos.includes(c) && !(c in NO_SE_PASAN))
comprobar(
  perdidos.length === 0
    ? 'todo lo calculado o llega a la app, o está en la lista con su motivo'
    : `SE PIERDEN sin motivo escrito: ${perdidos.join(', ')}`,
  perdidos.length === 0
)
// Y al revés: una excusa que ya no corresponde a nada tiene que irse, o la
// lista acabaría siendo un cajón de nombres muertos que no protegen nada.
const excusasMuertas = Object.keys(NO_SE_PASAN).filter((k) => !calculados.includes(k))
comprobar(
  excusasMuertas.length === 0 ? 'ningún motivo escrito sobra' : `motivos de algo que ya no existe: ${excusasMuertas.join(', ')}`,
  excusasMuertas.length === 0
)
for (const [k, porque] of Object.entries(NO_SE_PASAN)) console.log(`       fuera a propósito · ${k}: ${porque}`)

console.log(fallos === 0 ? '\n✓ todo bien.\n' : `\n✗ ${fallos} comprobación(es) fallaron.\n`)
process.exit(fallos === 0 ? 0 : 1)
