// Baja las tasas de referencia de los bancos centrales y las publica en
// `estado/tasas.json`.
//
//     node scripts/publicar-tasas.mjs
//
// ─────────────────────────────────────────────────────────────────────────
// LA FUENTE SE ELIGIÓ CON LA SONDA, no leyendo documentación
// ─────────────────────────────────────────────────────────────────────────
// `scripts/sonda-tasas.mjs` probó seis direcciones el 2026-09-09 y el
// resultado quedó escrito en CLAUDE.md. La corta:
//
//   · BIS v2 CSV, las ocho divisas de un golpe → 200, 8 filas, 153 ms ✅
//   · BIS v2 JSON → 406, ese endpoint NO da `jsondata`
//   · FRED sin llave → 400, la pide
//
// ⚠️ Escribir el lector «en JSON porque es más cómodo» habría fallado en
// producción sin explicación. Por eso primero la sonda y después esto.
//
// ⚠️ NO GASTA NI UN CRÉDITO DE TWELVE DATA ni necesita ningún secreto: son
// datos públicos de un organismo oficial. Por eso su workflow no lleva `env`.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ POR QUÉ VA APARTE DEL VIGÍA
// ─────────────────────────────────────────────────────────────────────────
// El mismo motivo que el calendario: el vigía escribe el historial, que es lo
// ÚNICO de este proyecto que no se puede volver a fabricar. Un fallo bajando
// tasas no puede tener ni la posibilidad de tocarlo.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { APP } from '../src/lib/identidad.js'
import { DIVISA_ZONA, diasDelDatoMasViejo, prepararTasas, tasasOrdenadas } from '../src/lib/tasas.js'

const ZONAS = Object.values(DIVISA_ZONA).join('+')

const URL =
  `https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/D.${ZONAS}` +
  '?lastNObservations=1&format=csv'

const DESTINO = join(process.env.VIGIA_DATOS || 'datos', 'estado', 'tasas.json')

const LIMITE_MS = 30_000

async function bajar() {
  const r = await fetch(URL, {
    // Sin User-Agent algunos servidores devuelven 403 aunque el dato sea
    // público. Se pone uno honesto: no se disfraza de navegador.
    headers: { 'User-Agent': `NestorForex-${APP}/1.0 (+https://github.com/Nestor-forex)` },
    signal: AbortSignal.timeout(LIMITE_MS),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

console.log('Tasas de los bancos centrales — publicador')
console.log(`  fuente: ${URL}`)

const csv = await bajar()
console.log(`  bajados: ${csv.length} caracteres de CSV`)

const datos = prepararTasas(csv)
const cuantas = Object.keys(datos.tasas).length

// ⚠️ SI FALTA ALGUNA DE LAS OCHO, NO SE PUBLICA NADA.
//
// Es más estricto que el calendario a propósito, y la razón es que aquí una
// ausencia se ve MUCHO peor: la pantalla calcula diferencias entre pares, así
// que si falta el JPY desaparecen de golpe los tres pares con yen y en
// pantalla parece que la app se olvidó de ellos. Con el calendario faltaría
// una línea; aquí faltarían filas enteras sin decir por qué.
//
// Fallar deja el archivo anterior intacto —que sigue siendo válido, porque
// estas tasas cambian una vez cada varias semanas— y manda un correo de fallo.
if (cuantas < 8) {
  const faltan = Object.keys(DIVISA_ZONA).filter((d) => !datos.tasas[d])
  console.error('')
  console.error(`✗ El BIS respondió pero solo trajo ${cuantas} de las 8 divisas.`)
  console.error(`  Faltan: ${faltan.join(', ')}`)
  console.error('  NO se publica nada, para no machacar el archivo bueno anterior.')
  console.error('  Mirar si el BIS cambió los nombres de las columnas o los códigos de zona.')
  console.error('  (La sonda `scripts/sonda-tasas.mjs` enseña la respuesta cruda.)')
  process.exit(1)
}

const texto = JSON.stringify(datos)
mkdirSync(dirname(DESTINO), { recursive: true })
writeFileSync(DESTINO, texto)

console.log(`  escrito: ${DESTINO} (${(texto.length / 1024).toFixed(2)} KB)`)

// Las ocho al log, con su fecha. No es adorno: si un día la pantalla enseña
// algo raro, el log de ese día dice exactamente qué se publicó.
for (const t of tasasOrdenadas(datos.tasas)) {
  console.log(`    · ${t.divisa}  ${String(t.v).padStart(6)} %   (dato del ${t.f})`)
}

const dias = diasDelDatoMasViejo(datos.tasas)
console.log(`  el dato más viejo es de hace ${dias} días.`)

// ⚠️ Un aviso, NO un fallo. Una tasa solo cambia el día que se reúne el banco
// central, así que semanas sin moverse es lo normal. Pero medio año parado
// sería el publicador roto sin que nadie se entere, y eso conviene que salga
// en el log antes de que alguien lo busque.
if (dias != null && dias > 120) {
  console.log('')
  console.log(`⚠ El dato más reciente del BIS tiene ${dias} días. Comprobar que la serie sigue viva.`)
}
