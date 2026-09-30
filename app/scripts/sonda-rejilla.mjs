// SONDA: ¿la rejilla que usa el BARRIDO de esta app trae horas sin mercado?
//
//     node scripts/sonda-rejilla.mjs
//
// Se lanza a mano desde Actions → «Sonda de la rejilla del barrido».
//
// ─────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE ESTA PREGUNTA
// ─────────────────────────────────────────────────────────────────────────
// La sonda del oro (2026-09-30) pidió 5000 velas de una hora y salió esto:
//
//     `1h`    → 5000 velas en 208,3 días = 24,0 por día
//     `15min` → 5000 velas en  52,1 días = 96,0 por día = 24 horas/día
//
// **24 velas por día de calendario es imposible en un mercado que abre 120 de
// las 168 horas de la semana** (17,1 por día). Ni contando solo días hábiles
// cuadra: 5000 entre los ~148 hábiles darían 33,6, y un día no tiene más de 24.
//
// Y la rejilla es LA MISMA con la que el vigía, el publicador y el reporte
// calculan el barrido: mismos símbolos, mismo intervalo, solo menos velas. Si
// trae horas cerradas, entonces la EMA9, la EMA21, el RSI y el ATR de esta app
// no cubren el tiempo de mercado que se cree.
//
// Eso era una INFERENCIA. Esta sonda la comprueba.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ LO QUE ESTA SONDA NO HACE, Y ES LO QUE MÁS IMPORTA DECIR
// ─────────────────────────────────────────────────────────────────────────
// **No cambia nada.** No escribe un archivo de la app, no toca una señal, no
// escribe en la rama `datos` y no roza el historial. El workflow va con
// `permissions: contents: read`, así que no es que prometa tener cuidado: es
// que no puede escribir aunque quisiera.
//
// Y si la respuesta sale «sí», tampoco cambia nada por sí solo. **Todo lo
// medido de esta app se midió con estos mismos datos** — los −0,13 por unidad
// de riesgo, las 8.000 operaciones, el filtro de RSI en 70, el ADX aflojado a
// 10. Esas mediciones describen lo que la app hace de verdad con los datos que
// de verdad recibe, así que no se caen. Una app con otra rejilla sería OTRA
// app, y habría que medirla desde cero.
//
// Cambiar la rejilla **cambia las señales**, así que va al banco de pruebas con
// su listón escrito antes, como todo lo demás. Van siete familias medidas y
// siete fallando: aquí nada se cambia porque suene mejor.
//
// ─────────────────────────────────────────────────────────────────────────
// CUESTA 1 CRÉDITO DE LOS 800
// ─────────────────────────────────────────────────────────────────────────
// Un solo símbolo, las mismas 300 velas que pide el vigía. No hacen falta los
// siete: la pregunta es sobre la rejilla, que es la misma para todos, y pedir
// siete costaría siete créditos para volver a leer el mismo calendario.

import {
  clasificarHora,
  repartoDeMercado,
  proporcionPlanas,
  recorrido,
  barrasPorDia,
  rejillaRellenada,
} from './lib/sonda-oro.mjs'
import { SYMBOLS, leerLlave } from './lib/velas.mjs'

// Las mismas que pide el vigía, el reporte y el publicador. Ver `velas.mjs`.
const VELAS = 300
// El primero de la lista, para no escribir un símbolo a mano: si algún día la
// lista cambia, esto la sigue.
const SIMBOLO = SYMBOLS[0]
const LIMITE_MS = 60_000

const llave = leerLlave()

console.log('SONDA — ¿la rejilla del barrido trae horas sin mercado?')
console.log(`  símbolo: ${SIMBOLO} · interval=1h · outputsize=${VELAS} (lo mismo que el vigía)`)
console.log('  cuesta 1 crédito. NO escribe nada: el workflow es de solo lectura.')
console.log('')

const url =
  `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(SIMBOLO)}` +
  `&interval=1h&outputsize=${VELAS}&timezone=UTC&apikey=${llave}`

const r = await fetch(url, { signal: AbortSignal.timeout(LIMITE_MS) })
const j = await r.json().catch(() => null)

// Un símbolo fuera del plan no da 403: da 200 con `status: "error"` dentro.
if (!j || j.status === 'error' || !Array.isArray(j.values) || !j.values.length) {
  console.error('')
  console.error(`✗ Twelve Data no devolvió velas de ${SIMBOLO}.`)
  console.error(`  HTTP ${r.status} · code=${j?.code ?? '—'} · ${String(j?.message ?? '(sin mensaje)').slice(0, 300)}`)
  console.error('  Esto NO contesta la pregunta: es «no se pudo mirar», no «no hay horas cerradas».')
  process.exit(1)
}

console.log(`  meta crudo: ${JSON.stringify(j.meta ?? null)}`)

const velas = new Map()
const horas = []
for (const v of j.values) {
  const t = String(v?.datetime ?? '')
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t)) continue
  horas.push(t)
  velas.set(t, { h: Number(v?.high), l: Number(v?.low), c: Number(v?.close) })
}
horas.sort()

console.log(`  velas con marca de tiempo válida: ${horas.length}`)
console.log(`  de ${horas[0]} a ${horas[horas.length - 1]}`)
console.log('')

// ── 1. Cuántas velas por día de calendario ───────────────────────────────
console.log('── Velas por día de calendario ──────────────────────────────')
const bpd = barrasPorDia(horas)
const dias =
  (new Date(horas[horas.length - 1].replace(' ', 'T') + 'Z') - new Date(horas[0].replace(' ', 'T') + 'Z')) / 86_400_000
console.log(`  ${horas.length} velas en ${dias.toFixed(1)} días = ${bpd == null ? '—' : bpd.toFixed(1)} por día`)
console.log('  el mercado abierto (120 h de 168) da 17,1 por día')

// ⚠️ Con 300 velas el tramo son ~12 días, por debajo de las tres semanas que
// `rejillaRellenada` exige para juzgar. Eso NO es un defecto: es el guardia
// funcionando. El veredicto de esta sonda no sale de aquí, sale del reparto de
// abajo, que no depende de la longitud del tramo.
const rej = rejillaRellenada(horas, 1)
console.log(
  rej == null
    ? '  (el tramo es corto para juzgar por esta vía; el veredicto sale del reparto de abajo)'
    : `  veredicto por esta vía: ${rej.rellenada ? 'rejilla rellenada' : 'compatible con solo mercado'}`,
)
console.log('')

// ── 2. El reparto entre mercado, frontera y cerrado ──────────────────────
console.log('── ¿Cuándo caen esas velas? ─────────────────────────────────')
const rep = repartoDeMercado(horas)
console.log(`  horas de MERCADO seguro:  ${rep.mercado}`)
console.log(`  horas de FRONTERA:        ${rep.frontera}   (el cambio de hora decide; NO cuentan)`)
console.log(`  horas CERRADAS seguras:   ${rep.cerrado}   ← la cuenta que decide`)
if (rep.ilegibles) console.log(`  ilegibles: ${rep.ilegibles}`)
console.log('')
console.log('  «Cerrado seguro» = sábado 00:00-20:59, domingo 00:00-20:59, viernes 23:00-23:59.')
console.log('  Son horas que NINGÚN horario de verano puede convertir en mercado.')
console.log('  ⚠️ El domingo a las 22:00 el mercado SÍ abre, así que esas velas van en FRONTERA,')
console.log('     no en cerrado: llamarlas cerradas sería la etiqueta equivocada.')
console.log('')

if (rep.cerrado) {
  const muestra = rep.cerradas.slice(0, 12)
  console.log('  muestra de horas cerradas con vela:')
  for (const t of muestra) {
    const v = velas.get(t)
    const rango = v && Number.isFinite(v.h) && Number.isFinite(v.l) ? (v.h - v.l).toPrecision(3) : '—'
    console.log(`    ${t}  (${['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][new Date(t.replace(' ', 'T') + 'Z').getUTCDay()]})  recorrido ${rango}`)
  }
  if (rep.cerradas.length > 12) console.log(`    …y ${rep.cerradas.length - 12} más`)
  console.log('')
}

// ── 3. ¿Qué traen DENTRO? ────────────────────────────────────────────────
//
// Ésta es la pregunta que la sonda del oro dejó abierta a propósito («que
// estén ahí lo fuerza la aritmética; que sean planas no se ha mirado»). Aquí
// se mira, y por el mismo crédito.
console.log('── ¿Qué traen dentro? ──────────────────────────────────────')
const deMercado = horas.filter((t) => clasificarHora(t) === 'mercado')
const pMercado = proporcionPlanas(deMercado, velas)
const pCerrado = proporcionPlanas(rep.cerradas, velas)

const linea = (etiqueta, p) =>
  console.log(
    `  ${etiqueta.padEnd(22)} ${
      p == null ? '(ninguna que mirar)' : `${p.planas} de ${p.n} planas (${(100 * p.proporcion).toFixed(1)} %)`
    }`,
  )
linea('planas, en mercado:', pMercado)
linea('planas, en cerrado:', pCerrado)
console.log('')
console.log('  Una vela PLANA (máximo = mínimo) sería la firma de un precio repetido:')
console.log('  nadie negoció, así que no hubo recorrido.')
console.log('  ⚠️ Una vela plana NO prueba nada por sí sola — en un mercado muy tranquilo')
console.log('     puede pasar de verdad. Lo que dice algo es la PROPORCIÓN comparada con')
console.log('     las horas de mercado, y por eso van las dos al lado.')
console.log('')

// ── 4. ¿CUÁNTO más estrechas? La pregunta que de verdad decide ───────────
//
// ⚠️⚠️ ESTE BLOQUE SE AÑADIÓ DESPUÉS DE LA PRIMERA CORRIDA, Y POR UN MOTIVO
// QUE CONVIENE LEER.
//
// Yo había diseñado la prueba de las planas esperando que las velas de horas
// cerradas salieran planas —«nadie negoció, luego el precio se repite»—. Salió
// **0 % en las dos**: esas velas llevan recorrido, pequeño pero real. O sea que
// no son un precio repetido, y mi explicación era falsa.
//
// Entonces la pregunta que decide no es «¿son inventadas?» sino **¿cuánto más
// estrechas son?**, porque de ahí sale si el ATR de esta app se queda corto por
// promediar 29 % de horas finas. Eso es un número y es éste.
console.log('── ¿Cuánto más estrechas son? ──────────────────────────────')
const rMercado = recorrido(deMercado, velas)
const rCerrado = recorrido(rep.cerradas, velas)

const fmt = (x) => (x == null ? '—' : x.toPrecision(3))
if (rMercado && rCerrado) {
  console.log(`  recorrido en MERCADO   (${rMercado.n} velas): media ${fmt(rMercado.media)} · mediana ${fmt(rMercado.mediana)}`)
  console.log(`  recorrido en CERRADAS  (${rCerrado.n} velas): media ${fmt(rCerrado.media)} · mediana ${fmt(rCerrado.mediana)}`)
  const vecesMedia = rMercado.media / rCerrado.media
  const vecesMediana = rCerrado.mediana ? rMercado.mediana / rCerrado.mediana : null
  console.log('')
  console.log(`  ⇒ las de mercado se mueven ${vecesMedia.toFixed(1)}× más (por la media)`)
  console.log(`     y ${vecesMediana == null ? '—' : vecesMediana.toFixed(1) + '×'} más (por la mediana)`)
  console.log('')
  console.log('  ⚠️ LO QUE ESTE NÚMERO SIGNIFICA Y LO QUE NO:')
  console.log('     Significa que el ATR, que es un promedio de recorridos, se calcula')
  console.log('     mezclando horas gruesas con horas finas. Cuantas más finas entren,')
  console.log('     más abajo tira el promedio — y del ATR sale el stop.')
  console.log('     NO significa que quitarlas mejore el resultado. Eso cambia las')
  console.log('     señales, y va al banco de pruebas con su listón escrito antes.')
} else {
  console.log('  no hay bastantes velas en los dos grupos para comparar.')
}
console.log('')

// ── El veredicto, calculado ──────────────────────────────────────────────
console.log('════════════════════════════════════════════════════════════')
console.log('  VEREDICTO (calculado, no escrito a mano)')
console.log('════════════════════════════════════════════════════════════')
if (rep.cerrado > 0) {
  console.log('  ⚠️ SÍ: la rejilla del barrido TRAE horas sin mercado.')
  console.log(`     ${rep.cerrado} de ${horas.length} velas caen en horas que no pueden ser mercado.`)
  console.log('')
  console.log('  Lo que esto NO significa:')
  console.log('   · que los números medidos de la app sean falsos. Se midieron con')
  console.log('     estos mismos datos, así que describen lo que la app hace de verdad.')
  console.log('   · que haya que cambiar algo. Cambiar la rejilla cambia las señales,')
  console.log('     así que iría al banco de pruebas con su listón escrito antes.')
  console.log('   · que el historial deje de valer. Registra lo que la app DIJO cada')
  console.log('     día con los precios de ese día, y eso no depende de esto.')
} else {
  console.log('  ✅ NO: no hay ni una vela en horas que no puedan ser mercado.')
  console.log(`     (${rep.frontera} caen en la frontera del cambio de hora, que no decide nada.)`)
  console.log('')
  console.log('  ⚠️ Entonces queda pendiente explicar las 24 velas por día que dio la')
  console.log('     sonda del oro sobre 5000 velas. Un tramo de 300 no lo contradice')
  console.log('     necesariamente: puede que la rejilla larga se rellene y la corta no.')
  console.log('     Eso pediría pedir más velas, y es otra pregunta.')
}
