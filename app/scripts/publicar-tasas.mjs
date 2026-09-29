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
import {
  DIVISA_ZONA,
  OBSERVACIONES,
  diasDelDatoMasViejo,
  diasVigente,
  prepararTasas,
  tasasOrdenadas,
} from '../src/lib/tasas.js'

const ZONAS = Object.values(DIVISA_ZONA).join('+')

// ⚠️ PIDE LA SERIE, NO SOLO EL ÚLTIMO VALOR (cambiado el 2026-09-29).
//
// Hasta esa fecha pedía `lastNObservations=1`, que da el nivel y nada más. Con
// `OBSERVACIONES` viene la serie entera y de ahí sale la TENDENCIA — de dónde
// viene cada tasa y desde cuándo—, que es la mitad de lo que dicen los
// análisis del mercado y la app no enseñaba.
//
// No cuesta un crédito ni un secreto: es el mismo organismo público y la misma
// dirección. Lo único que sube es la descarga: de 5,6 KB a 5,5 MB, 0,7 s,
// medido con la sonda. Y eso lo baja el RUNNER una vez al día, no el teléfono
// de nadie — lo que se publica sigue siendo un archivo pequeño, porque la
// serie se resume aquí y no viaja.
const URL =
  `https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/D.${ZONAS}` +
  `?lastNObservations=${OBSERVACIONES}&format=csv`

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

// Las ocho al log, con su fecha y con de dónde vienen. No es adorno: si un día
// la pantalla enseña algo raro, el log de ese día dice exactamente qué se
// publicó.
for (const t of tasasOrdenadas(datos.tasas)) {
  const c = datos.tendencias?.[t.divisa]
  const flecha = c ? (c.sentido === 'subio' ? '↑' : '↓') : ' '
  const venía = c ? `${flecha} desde ${c.de} % el ${c.desde} (${diasVigente(c)} días)` : '(sin cambio en la ventana)'
  console.log(`    · ${t.divisa}  ${String(t.v).padStart(6)} %   (dato del ${t.f})   ${venía}`)
}

// ⚠️ EL NÚMERO DE ESCALONES VA AL LOG A PROPÓSITO, y no es curiosidad.
//
// Es el delator de que los huecos de la serie se hayan vuelto a colar. El BIS
// publica filas con `OBS_VALUE` vacío —283 de 1000 en Nueva Zelanda— y si algún
// día dejaran de saltarse, cada hueco contaría como dos cambios: Nueva Zelanda
// pasaría de 12 escalones a 294. Un banco central que mueve su tasa 12 veces en
// tres años es plausible; 294 no, y así se ve de un vistazo sin que nadie tenga
// que ir a buscarlo.
const tend = Object.entries(datos.tendencias || {})
if (tend.length) {
  console.log(
    `  cambios dentro de la ventana de ${OBSERVACIONES} observaciones: ` +
      tend.map(([d, c]) => `${d}:${c.escalones}`).join(' · ')
  )
  const sospechoso = tend.filter(([, c]) => c.escalones > 60)
  if (sospechoso.length) {
    console.log('')
    console.log(`⚠ DEMASIADOS CAMBIOS en ${sospechoso.map(([d]) => d).join(', ')}.`)
    console.log('  Un banco central no mueve su tasa decenas de veces en tres años.')
    console.log('  Lo más probable: los huecos de la serie (OBS_VALUE vacío) dejaron de saltarse.')
    console.log('  Ver `leerSerieCSV` en src/lib/tasas.js y su prueba en scripts/prueba-tasas.mjs.')
  }
}

// ⚠️ Un AVISO, no un fallo. Si a una divisa no se le encuentra ningún cambio en
// la ventana, la pantalla simplemente no enseña su tendencia y sigue enseñando
// su nivel. Que salga en el log importa porque la primera explicación posible no
// es «ese banco lleva años quieto» sino «la ventana se quedó corta», y eso se
// arregla subiendo `OBSERVACIONES`.
const sinTendencia = Object.keys(datos.tasas).filter((d) => !datos.tendencias?.[d])
if (sinTendencia.length) {
  console.log('')
  console.log(`⚠ Sin tendencia (ningún cambio en la ventana): ${sinTendencia.join(', ')}`)
  console.log(`  Se publican igual con su nivel. Si se repite, subir OBSERVACIONES (hoy ${OBSERVACIONES}).`)
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
