// SONDA: ¿se puede pedir el ORO en velas de una hora, y su calendario se cruza
// con el de los pares?
//
//     node scripts/sonda-oro-h1.mjs
//
// Se lanza a mano desde Actions → «Sonda del oro en velas de una hora».
//
// ─────────────────────────────────────────────────────────────────────────
// PARA QUÉ EXISTE, Y QUÉ NO CONTESTA
// ─────────────────────────────────────────────────────────────────────────
// La app de swing enseña el oro con su correlación MEDIDA contra los 14 pares
// (`src/lib/oro.js` allá). Néstor preguntó si eso mismo serviría aquí. Antes
// de escribir una línea de lector hay DOS cosas que no se pueden saber desde
// el computador donde se programa, y ésta es la sonda que las pregunta:
//
//   1. ¿Twelve Data da `XAU/USD` en `1h` con el plan gratuito? La sonda del
//      2026-09-29 comprobó que lo da en `1day` y que es oro de verdad.
//      **A `1h` NUNCA se le ha preguntado.** Y no se supone: `WTI/USD`
//      contesta «This symbol is available starting with the Grow or Venture
//      plan», o sea que en este plan hay símbolos e intervalos cerrados.
//
//   2. ¿Se cruzan los calendarios? En velas diarias el oro y los pares casi
//      coinciden. En velas de una hora el oro al contado tiene su parada de
//      mantenimiento diaria y cierra el viernes antes; el Forex no cierra
//      igual. Si al cruzar las horas quedaran cuatro, no habría correlación
//      que calcular — y eso no se adivina, se cuenta.
//
// ⚠️⚠️ LO QUE ESTA SONDA **NO** CONTESTA, y es la pregunta que de verdad
// decide: **cuál es la ventana correcta.** En swing son 60 sesiones = 60 días
// ≈ 3 meses. Aquí 60 sesiones son 60 HORAS: dos días y medio, que no es una
// relación sino una foto de esta semana. Elegir la ventana de esta app es una
// MEDICIÓN sobre sus propios datos, y por eso `correlacion.js` no existe aquí
// —decidido el 2026-09-08, con motivo escrito— en vez de haberse copiado.
//
// Esta sonda solo dice **si la puerta está abierta**. Que lo esté no autoriza
// a construir nada: `veredicto()` devuelve `autoriza: false` a propósito.
//
// ─────────────────────────────────────────────────────────────────────────
// LO QUE CUESTA: 9 CRÉDITOS DE LOS 800 DEL DÍA
// ─────────────────────────────────────────────────────────────────────────
//   1  el oro en `1h`
//   1  el oro en `15min`
//   7  los 7 símbolos en `1h` (una sola petición, 7 créditos)
//
// El gasto fijo de esta app es 511 al día (48 corridas del publicador × 7 +
// 24 del vigía × 7 + 7 del reporte), así que esto cabe de sobra y se lanza a
// mano una vez.
//
// ⚠️ EL `15min` VA PORQUE PREGUNTAR CUESTA UN CRÉDITO Y NO PREGUNTAR CUESTA
// UNA SEGUNDA SONDA. Pero que responda **no autoriza nada**: está escrito que
// M15 no se toca hasta que la ruptura de estructura pase su registro hacia
// adelante, y gastar créditos en una versión que ya se sabe que pierde es
// tirar créditos. Se pregunta para no volver.
//
// ⚠️ Y LA PAUSA DE 65 s NO ES ADORNO: es aritmética. El plan gratuito da **8
// créditos por minuto**. El oro gasta 2 y los pares 7: 9 en el mismo minuto es
// un 429 seguro. Y un 429 aquí no se vería venir — `obtenerVelas` reintenta,
// así que lo único que pasaría es que la sonda tardara el doble sin decir por
// qué. Es el mismo cálculo que obligó a poner la pausa en el publicador del
// oro de swing.

import { juzgarRespuesta, horasDe, cruzarHoras, veredicto } from './lib/sonda-oro.mjs'
import { SYMBOLS, leerLlave, obtenerVelas } from './lib/velas.mjs'

const SIMBOLO_ORO = 'XAU/USD'
const VELAS = 5000 // el tope de la API; cuesta lo mismo que pedir 5
const LIMITE_MS = 60_000

const llave = leerLlave()

console.log('SONDA — el oro en velas de una hora')
console.log(`  símbolo: ${SIMBOLO_ORO} · outputsize=${VELAS} (el tope de la API)`)
console.log('  cuesta 9 créditos de los 800 del día. Ver la cabecera.')
console.log('')

// ── 1. El oro, en los dos intervalos ─────────────────────────────────────
const intervalos = {}
const cuerpos = {}

for (const intervalo of ['1h', '15min']) {
  const url =
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(SIMBOLO_ORO)}` +
    `&interval=${encodeURIComponent(intervalo)}&outputsize=${VELAS}&timezone=UTC&apikey=${llave}`

  console.log(`── ${SIMBOLO_ORO} en «${intervalo}» ──────────────────────────────`)
  let http = null
  let cuerpo = null
  let error = null
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(LIMITE_MS) })
    http = r.status
    cuerpo = await r.json().catch(() => null)
  } catch (e) {
    error = e?.message ?? e
  }

  const j = juzgarRespuesta({ http, cuerpo, error })
  intervalos[intervalo] = j
  cuerpos[intervalo] = cuerpo

  console.log(`  HTTP ${http ?? '—'} · veredicto: ${j.clave}`)
  console.log(`  ${j.detalle}`)

  // ⚠️ EL `meta` ENTERO Y SIN FILTRAR. La sonda del COT se equivocó en tres de
  // ocho nombres de contrato por leer una lista que un filtro mío había
  // recortado: `PARECE_DIVISA` pedía «DOLLAR INDEX» y el contrato vivo se
  // llamaba «USD INDEX», así que el filtro escondía justo lo que se buscaba.
  // Aquí se imprime todo y que decida quien lea.
  console.log(`  meta crudo: ${JSON.stringify(cuerpo?.meta ?? null)}`)

  const horas = horasDe(cuerpo?.values)
  if (horas.length) {
    console.log(`  velas con marca de tiempo válida: ${horas.length}`)
    console.log(`  de ${horas[0]} a ${horas[horas.length - 1]}`)
    const dias = (new Date(horas[horas.length - 1].replace(' ', 'T') + 'Z') - new Date(horas[0].replace(' ', 'T') + 'Z')) / 86_400_000
    console.log(`  o sea ${dias.toFixed(1)} días de calendario hacia atrás`)
    console.log(`  primera vela cruda: ${JSON.stringify(cuerpo.values[cuerpo.values.length - 1])}`)
  }
  console.log('')
}

// Si el oro en H1 no se pudo pedir, los 7 créditos de los pares no comprarían
// nada: no habría con qué cruzar. Mejor no gastarlos.
if (intervalos['1h']?.sirve !== true) {
  console.log('── Los pares ────────────────────────────────────────────────')
  console.log('  NO se piden: sin el oro en 1h no hay calendario que cruzar,')
  console.log('  así que serían 7 créditos a cambio de nada.')
  console.log('')
  imprimirVeredicto(veredicto({ intervalos, cruce: null }))
  process.exit(0)
}

// ── 2. Los 7 símbolos, para cruzar el calendario ─────────────────────────
console.log('  esperando 65 s: el plan gratuito da 8 créditos por minuto y ya van 2…')
await new Promise((res) => setTimeout(res, 65_000))

console.log('── Los 7 símbolos en «1h» ───────────────────────────────────')
// Se nombran en el log a propósito: esta app pide 7 SÍMBOLOS y DERIVA los 11
// cruces, así que el calendario contra el que se cruza el oro es el de estos
// siete y no el de los 18 pares. (Derivar cierres es exacto; el problema de
// derivar era con los máximos y mínimos, que la correlación no usa.)
console.log(`  son ${SYMBOLS.length}: ${SYMBOLS.join(', ')}`)
let barras = null
try {
  const r = await obtenerVelas(llave, { velas: VELAS, intervalo: '1h', minBarras: 1 })
  barras = r.barras
  console.log(`  horas con dato en LOS SIETE: ${barras.length}`)
  console.log(`  de ${barras[0]} a ${barras[barras.length - 1]}`)
} catch (e) {
  // ⚠️ No se concluye nada de un fallo aquí: es «no se pudo mirar», no «no se
  // cruzan». Ver la cabecera de `lib/sonda-oro.mjs`.
  console.log(`  ✗ no se pudieron bajar: ${e?.message ?? e}`)
  console.log('  Eso NO dice que los calendarios no se crucen: dice que no se pudo mirar.')
  console.log('')
  imprimirVeredicto(veredicto({ intervalos, cruce: null }))
  process.exit(0)
}
console.log('')

// ── 3. El cruce, que es la mitad que no se podía adivinar ────────────────
console.log('── El cruce de calendarios ──────────────────────────────────')
const cruce = cruzarHoras(horasDe(cuerpos['1h']?.values), barras)

console.log(`  horas que tienen los pares:            ${barras.length}`)
console.log(`  horas que tiene el oro:                ${horasDe(cuerpos['1h']?.values).length}`)
console.log(`  horas COMUNES (las usables):           ${cruce.comunes.length}`)
console.log(`  horas de los pares que el oro no tiene: ${cruce.soloPares.length}`)
console.log(`  horas del oro que los pares no tienen:  ${cruce.soloOro.length}`)
console.log(
  `  se conserva el ${cruce.conservado == null ? '—' : (100 * cruce.conservado).toFixed(1) + ' %'} de las horas de los pares`,
)
if (cruce.comunes.length) {
  console.log(`  rango común: de ${cruce.comunes[0]} a ${cruce.comunes[cruce.comunes.length - 1]}`)
}
console.log('')

// La forma de lo que falta: ¿horario o avería? Ver `cruzarHoras`.
const porHora = Object.entries(cruce.porHoraDelDia).sort((a, b) => b[1] - a[1])
if (porHora.length) {
  console.log('  las horas que faltan, repartidas por hora del día (UTC):')
  for (const [h, n] of porHora.slice(0, 8)) console.log(`    ${h}:00 → ${n}`)
  if (porHora.length > 8) console.log(`    …y ${porHora.length - 8} horas más del día con menos`)
  console.log('')
  console.log(`  ${porHora.length} horas distintas del día están afectadas.`)
  console.log('  Si son una o dos, es la parada de mantenimiento del oro y es normal.')
  console.log('  Si están repartidas por casi todas, lo que falla es otra cosa.')
} else {
  console.log('  no falta ninguna hora: los dos calendarios coinciden enteros.')
}
console.log('')

imprimirVeredicto(veredicto({ intervalos, cruce }))

// ⚠️ EL RESUMEN LO CALCULA `veredicto()` Y AQUÍ SOLO SE IMPRIME.
//
// No es manía: el 2026-09-29 el resumen de una sonda mía afirmó «SÍ — sirven:
// XAU/USD, CL, GOLD» mientras su propio detalle, tres pantallas más arriba,
// desmentía a dos de los tres. Un resumen que ignora lo que el detalle ya sabe
// es peor que no tener resumen, porque se lee como la conclusión.
function imprimirVeredicto(v) {
  console.log('════════════════════════════════════════════════════════════')
  console.log('  VEREDICTO (calculado, no escrito a mano)')
  console.log('════════════════════════════════════════════════════════════')

  const comoSeLee = {
    abierta: '✅ SÍ se puede pedir el oro en velas de una hora.',
    cerrada: '❌ NO se puede: respondió y dijo que no.',
    'no-se-pudo-mirar': '⚠️ NO SE PUDO MIRAR. Esto NO es un «no».',
  }
  console.log(`  ${comoSeLee[v.puerta]}`)
  console.log('')
  console.log(`  intervalos que sirven:        ${v.sirven.join(', ') || '(ninguno)'}`)
  console.log(`  intervalos que NO sirven:     ${v.noSirven.join(', ') || '(ninguno)'}`)
  console.log(`  intervalos que no se supieron: ${v.noSeSupo.join(', ') || '(ninguno)'}`)

  if (v.cruce) {
    const pct = v.cruce.conservado == null ? '—' : (100 * v.cruce.conservado).toFixed(1) + ' %'
    console.log('')
    console.log(`  horas usables tras cruzar: ${v.cruce.comunes.length} (${pct} de las de los pares)`)
  }

  console.log('')
  console.log('  ⚠️ Y LO QUE ESTO NO AUTORIZA:')
  console.log('     Que la puerta esté abierta no dice que la tarjeta sirva aquí.')
  console.log('     Falta elegir la VENTANA, y eso es una medición sobre los datos')
  console.log('     de esta app, no un número que se copie de swing: allá 60')
  console.log('     sesiones son 60 días; aquí serían 60 horas, dos días y medio.')
  console.log(`     autoriza construir: ${v.autoriza}`)
}
