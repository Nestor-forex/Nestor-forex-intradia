// Guarda una copia fechada del historial y avisa si algo encogió.
//
// Corre solo los domingos (ver .github/workflows/respaldo-historial.yml) y se
// puede lanzar a mano desde Actions. Sin internet ni créditos de API: solo
// copia archivos que ya están en el disco del trabajo.
//
// Se le pasan dos carpetas por variable de entorno:
//   RESPALDO_DATOS     la rama `datos` ya descargada  (de donde se lee)
//   RESPALDO_DESTINO   la rama `respaldos` ya descargada (donde se escribe)
//
// ⚠️ NO BORRA COPIAS VIEJAS, y es a propósito. Sería fácil añadir «deja solo
// las últimas doce», y sería justo la clase de código que un día borra lo que
// hacía falta. Son 25 KB por copia de texto casi idéntico, que git comprime
// hasta casi nada: en tres años no llega a molestar. La lógica de borrado es
// lo último que uno quiere cerca de su único activo irremplazable.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { carpetaDe, compararConAnterior, masReciente, revisarJsonl } from './lib/respaldo.mjs'

const DATOS = process.env.RESPALDO_DATOS || fileURLToPath(new URL('../../datos-local', import.meta.url))
const DESTINO = process.env.RESPALDO_DESTINO || fileURLToPath(new URL('../../respaldos-local', import.meta.url))

const ARCHIVOS = ['senales', 'resultados']

const leer = (ruta) => (existsSync(ruta) ? readFileSync(ruta, 'utf8') : null)

// --- Lo que hay hoy en la rama `datos` -------------------------------------

const actual = {}
const crudo = {}
for (const nombre of ARCHIVOS) {
  const texto = leer(`${DATOS}/historial/${nombre}.jsonl`)
  crudo[nombre] = texto
  actual[nombre] = texto === null ? null : revisarJsonl(texto)
}

// --- La copia anterior, para comparar --------------------------------------

const carpetas = existsSync(DESTINO)
  ? readdirSync(DESTINO, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  : []

const previa = masReciente(carpetas)
let anterior = null
if (previa) {
  anterior = {}
  for (const nombre of ARCHIVOS) {
    const texto = leer(`${DESTINO}/${previa}/${nombre}.jsonl`)
    anterior[nombre] = texto === null ? null : revisarJsonl(texto)
  }
}

const { ok, alarmas, notas } = compararConAnterior(actual, anterior)

// --- Guardar ---------------------------------------------------------------
//
// Se guarda AUNQUE haya alarmas. Una copia de un archivo sospechoso sigue
// siendo mejor que ninguna, y las copias anteriores no se tocan: si esta sale
// mal, la buena sigue ahí al lado.

const hoy = carpetaDe()
const carpeta = `${DESTINO}/${hoy}`
mkdirSync(carpeta, { recursive: true })

for (const nombre of ARCHIVOS) {
  if (crudo[nombre] === null) continue
  const destino = `${carpeta}/${nombre}.jsonl`
  writeFileSync(destino, crudo[nombre])

  // Releer lo escrito y contar otra vez. No es paranoia gratuita: escribir un
  // archivo puede fallar a medias (disco lleno) sin lanzar error, y una copia
  // truncada que nadie comprueba es exactamente el fallo que esto previene.
  const vuelta = revisarJsonl(readFileSync(destino, 'utf8'))
  if (vuelta.lineas !== actual[nombre].lineas) {
    alarmas.push(
      `La copia de ${nombre}.jsonl salió con ${vuelta.lineas} líneas y el original tiene ` +
        `${actual[nombre].lineas}. No se escribió entera.`
    )
  }
}

// --- El índice, para que se pueda leer sin saber de programación -----------

const indice = [
  '# Copias de seguridad del historial',
  '',
  'Cada carpeta es una copia fechada de `historial/senales.jsonl` y',
  '`historial/resultados.jsonl` de la rama `datos`.',
  '',
  '**Estos archivos no se pueden volver a fabricar.** Dependen de lo que la app',
  'dijo cada día concreto. No borres carpetas viejas.',
  '',
  '| copia | señales | resultados |',
  '|---|---:|---:|',
  ...[...new Set([...carpetas, hoy])]
    .filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c))
    .sort()
    .reverse()
    .map((c) => {
      const n = (f) => {
        const t = leer(`${DESTINO}/${c}/${f}.jsonl`)
        return t === null ? '—' : revisarJsonl(t).lineas
      }
      return `| ${c} | ${n('senales')} | ${n('resultados')} |`
    }),
  '',
].join('\n')
writeFileSync(`${DESTINO}/INDICE.md`, indice)

// --- Contarlo ---------------------------------------------------------------

console.log(`Copia guardada en respaldos/${hoy}`)
if (previa) console.log(`Comparada con la anterior, del ${previa}.`)
else console.log('Es la primera copia: no hay con qué comparar.')
console.log('')
for (const n of notas) console.log(`  · ${n}`)

if (!ok) {
  console.log('')
  console.log('⚠️  ALGO NO CUADRA:')
  for (const a of alarmas) console.log(`  ✗ ${a}`)
  console.log('')
  console.log('La copia de hoy SÍ se guardó, y las anteriores siguen intactas.')
  console.log('Mira la rama `respaldos` antes de tocar nada en `datos`.')
  process.exit(1)
}

console.log('')
console.log('El historial está sano y respaldado.')
