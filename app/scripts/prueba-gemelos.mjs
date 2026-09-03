// Comprueba que los archivos gemelos siguen siendo idénticos en las dos apps.
//
//     node scripts/prueba-gemelos.mjs /ruta/al/otro/repo
//
// o, si la otra app está clonada al lado de esta:
//
//     node scripts/prueba-gemelos.mjs
//
// ─────────────────────────────────────────────────────────────────────────
// QUÉ VIGILA, Y POR QUÉ HACE FALTA QUE ALGUIEN LO VIGILE
// ─────────────────────────────────────────────────────────────────────────
// Las dos apps viven en repositorios separados. Cuando una corrección se hace
// en una y se olvida en la otra, no falla nada: las dos siguen compilando,
// las dos siguen publicándose, y la diferencia queda ahí meses. Este es el
// único sitio del proyecto que se entera.
//
// Ver `gemelos.mjs` para la lista y para los casos reales que motivaron esto.

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { GEMELOS, PRIMOS } from './gemelos.mjs'
import { NOMBRE_APP } from '../src/lib/identidad.js'

const aqui = fileURLToPath(new URL('..', import.meta.url)) // .../app/

// Dónde está la otra app.
//
// ⚠️ SI SE PASA UNA RUTA A MANO, SE USA ESA Y NINGUNA OTRA. La primera versión
// de esto la trataba como una candidata más y seguía buscando si no le
// cuadraba — o sea que un robot con la ruta mal escrita habría acabado
// comparando contra otra cosa y pasando en verde. Una prueba que se busca la
// vida cuando le das un dato equivocado es peor que una que falla.
const conRaya = (p) => (p.endsWith('/') ? p : p + '/')
const aMano = process.argv[2] || process.env.OTRA_APP

let otra
if (aMano) {
  otra = conRaya(aMano)
  if (!existsSync(otra + 'src/lib/identidad.js')) {
    console.error(`En "${otra}" no hay ninguna app: falta src/lib/identidad.js`)
    console.error('Se esperaba la carpeta `app/` del otro repositorio.')
    process.exit(2)
  }
} else {
  // Sin ruta, se busca al lado de este repositorio con los nombres conocidos,
  // para que funcione igual desde Swing que desde Intradía sin configurar nada.
  const CANDIDATOS = [
    '../../../nestor-forex-intradia/app/',
    '../../../Nestor-forex/app/',
    '../../../nestor-forex/app/',
    '../../otra/app/',
  ].map((c) => fileURLToPath(new URL(c, import.meta.url)))

  otra = CANDIDATOS.find((c) => existsSync(c + 'src/lib/identidad.js') && c !== aqui)
  if (!otra) {
    console.error('No encontré la otra app. Pásale la ruta:')
    console.error('    node scripts/prueba-gemelos.mjs /ruta/al/otro/repo/app')
    console.error('\nBuscado en:')
    for (const c of CANDIDATOS) console.error('  ·', c)
    process.exit(2)
  }
}

// Que de verdad sea la OTRA y no esta misma clonada: si alguien apunta al
// mismo sitio, todo saldría idéntico y la prueba pasaría sin comprobar nada.
const nombreOtra = readFileSync(otra + 'src/lib/identidad.js', 'utf8').match(/NOMBRE_APP = '(.+)'/)?.[1]
if (!nombreOtra || nombreOtra === NOMBRE_APP) {
  console.error(`La ruta apunta a ESTA misma app (${NOMBRE_APP}), no a la hermana.`)
  console.error('Comparar una app consigo misma siempre pasa y no comprueba nada.')
  process.exit(2)
}

console.log(`Comparando ${NOMBRE_APP} con ${nombreOtra}`)
console.log(`  aquí:  ${aqui}`)
console.log(`  allá:  ${otra}\n`)

let fallos = 0
let faltantes = 0

for (const rel of GEMELOS) {
  const a = aqui + rel
  const b = otra + rel

  if (!existsSync(a)) {
    console.log(`  ✗ ${rel} — NO EXISTE en ${NOMBRE_APP}`)
    faltantes++
    continue
  }
  if (!existsSync(b)) {
    console.log(`  ✗ ${rel} — NO EXISTE en ${nombreOtra}`)
    faltantes++
    continue
  }

  const ta = readFileSync(a, 'utf8')
  const tb = readFileSync(b, 'utf8')
  if (ta === tb) {
    console.log(`  ✓ ${rel}`)
    continue
  }

  fallos++
  // Se enseñan las primeras líneas que difieren, no el diff entero: lo que
  // hace falta es saber DÓNDE mirar, y un diff completo de un archivo grande
  // esconde eso en medio de cien líneas.
  const la = ta.split('\n')
  const lb = tb.split('\n')
  const distintas = []
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) distintas.push(i + 1)
  }
  console.log(`  ✗ ${rel} — ${distintas.length} línea(s) distintas`)
  for (const n of distintas.slice(0, 4)) {
    console.log(`      línea ${n}:`)
    console.log(`        ${NOMBRE_APP}: ${(la[n - 1] ?? '(no existe)').trim().slice(0, 90)}`)
    console.log(`        ${nombreOtra}: ${(lb[n - 1] ?? '(no existe)').trim().slice(0, 90)}`)
  }
  if (distintas.length > 4) console.log(`      … y ${distintas.length - 4} línea(s) más`)
}

// La lista de primos es documentación, pero si nombra un archivo que ya no
// existe, la documentación está mintiendo. Se avisa sin fallar: un primo mal
// listado no rompe nada, solo confunde a quien lo lea.
const primosFantasma = Object.keys(PRIMOS).filter(
  (rel) => !rel.includes('*') && !existsSync(aqui + rel)
)

console.log('')
if (primosFantasma.length) {
  console.log('⚠️  La lista de PRIMOS nombra archivos que ya no existen aquí:')
  for (const p of primosFantasma) console.log(`      ${p}`)
  console.log('    (no es un fallo, pero conviene actualizarla)')
  console.log('')
}

// Un gemelo no puede estar además en primos: diría a la vez «tienen que ser
// iguales» y «tienen que ser distintos».
const enLosDos = GEMELOS.filter((g) => g in PRIMOS)
if (enLosDos.length) {
  console.log(`✗ Estos están en GEMELOS y en PRIMOS a la vez: ${enLosDos.join(', ')}`)
  fallos += enLosDos.length
}

if (fallos || faltantes) {
  console.log(`${fallos + faltantes} problema(s). Las dos apps se separaron.`)
  console.log('')
  console.log('QUÉ HACER: mira las líneas de arriba y decide cuál de las dos versiones')
  console.log('es la buena; después cópiala a la otra app. Si la diferencia es a')
  console.log('propósito, el archivo NO es un gemelo: sácalo de GEMELOS en gemelos.mjs')
  console.log('y ponlo en PRIMOS con el motivo escrito.')
  process.exit(1)
}

console.log(`Los ${GEMELOS.length} archivos gemelos siguen idénticos en las dos apps.`)
