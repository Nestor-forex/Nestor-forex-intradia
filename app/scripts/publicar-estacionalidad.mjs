// Baja velas y publica `estado/estacionalidad.json`.
//
// Néstor la pidió el 2026-10-26. El porqué y las dos preguntas que mide están
// en la cabecera de `src/lib/estacionalidad.js`.
//
// PRIMO, no gemelo, y las diferencias con el de Swing no son de estilo:
//
//   · aquí hacen falta DOS descargas —velas de 1 hora para el perfil por hora
//     y por día, y velas diarias para los meses— porque 5.000 velas H1 son
//     siete meses y con eso no hay estacionalidad mensual que medir;
//   · hay perfil por HORA, que en Swing no existe porque allí una vela ES un
//     día;
//   · el perfil por día sale de las velas H1 y no de las diarias, porque la
//     pregunta de esta app es «cuánto se mueve una HORA del lunes», no «cuánto
//     se mueve el lunes entero»;
//   · y los cruces NO tienen panel mensual de recorrido. Ver el aviso grande.
//
// ⚠️⚠️ LOS 11 CRUCES SE DERIVAN, Y EN VELAS DIARIAS ESO ES EL FALLO DEL
// 2026-08-09.
//
// Esta app pide 7 símbolos contra el dólar y saca los cruces de ellos. Para el
// CIERRE eso es exacto. Para el MÁXIMO y el MÍNIMO no: hay que combinar el
// máximo de uno con el mínimo del otro, o sea **suponer que los dos extremos
// pasaron en el mismo instante**. En velas de una hora el error es pequeño y la
// app ya lo dice en el pie de su reporte; en velas de un DÍA está medido en un
// **400 % de más** sobre el ATR, que es lo que obligó a Swing a pedir los 14
// pares directos.
//
// Consecuencia, y se publica así a propósito:
//
//   | panel        | de dónde      | pares        | por qué                  |
//   |--------------|---------------|--------------|--------------------------|
//   | hora         | H1            | los 18       | derivar en H1 es pequeño |
//   | día          | H1            | los 18       | ídem                     |
//   | mes, recorrido | diarias     | **solo 7**   | derivar en diarias no    |
//   | mes, dirección | diarias     | los 18       | solo usa CIERRES: exacto |
//
// Un cruce sale sin `mes` y la tarjeta no lo pinta. Publicar ahí un número
// derivado sería enseñar un recorrido inflado con cara de medición.
//
// ⚠️ CUESTA 14 CRÉDITOS AL DÍA: 7 la descarga de H1 y 7 la de diarias. Gasto
// total de Intradía al día: 168 (publicador del barrido) + 168 (vigía) +
// 7 (reporte) + 14 (esto) = **357 de 800** en el techo, y ~127 con la cadencia
// real medida del reloj.
//
// ⚠️ Y HAY QUE ESPERAR ENTRE LAS DOS DESCARGAS. Cada llamada pide los 7
// símbolos de golpe y el plan gratuito da 8 créditos POR MINUTO: las dos
// seguidas son 14 en unos segundos y devuelven 429. No es hipotético — pasó el
// 2026-10-07 con cuatro programas coincidiendo en el mismo minuto, y el que
// murió fue el vigía.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { leerLlave, obtenerVelas } from './lib/velas.mjs'
import { clasificarHora } from './lib/horas-mercado.mjs'
import { PAIR_NAMES, monedasDe } from '../src/lib/pairs.js'
// ⚠️ Las tres fórmulas se IMPORTAN de `marketCalc.js`, donde está escrito el
// convenio y por qué los cruces son una cota superior. Copiarlas aquí sería el
// fallo del umbral de fuerza en nueve sitios.
import { precioDePar, maxDePar, minDePar } from '../src/lib/marketCalc.js'
import {
  MIN_OBS,
  DIAS_HABILES,
  MESES,
  HORAS,
  perfilPor,
  porHoraUTC,
  porDiaSemana,
  porMes,
  direccionPorMes,
  casillaFloja,
} from '../src/lib/estacionalidad.js'

const DESTINO = join(process.env.VIGIA_DATOS || 'datos', 'estado', 'estacionalidad.json')

/**
 * 5.000 es el máximo por petición de Twelve Data.
 *
 * En H1 son ~7 meses de horas de mercado. En diarias son 5.000 velas DE
 * CALENDARIO, fines de semana incluidos, así que al quitarlos quedan ~3.570
 * sesiones: **~14 años y no 20**. Lo escribí como 20 al diseñarlo y lo destapó
 * el humo.
 *
 * Consecuencia: la dirección por mes sale a ~14 observaciones y su margen es
 * de **±26**, no de ±22.
 *
 * 📌 Y NO merece la pena ir a por los 20 años paginando a 7 créditos por
 * página: pasar de ±26 a ±22 no cambia nada, porque las dos cifras dicen lo
 * mismo — que esa tabla no decide.
 */
export const VELAS = 5000

/** La pausa entre las dos descargas. Ver el aviso de los 8 créditos por minuto. */
export const PAUSA_MS = 65_000

/** Por debajo de esto no se publica. Caza que la API devuelva menos velas de las pedidas. */
export const MIN_BARRAS_H1 = 2000
export const MIN_SESIONES = 1000

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const r4 = (x) => (typeof x === 'number' && Number.isFinite(x) ? Number(x.toFixed(4)) : null)
const casillaPublicable = (c) => ({ n: c.n, medio: r4(c.medio), margen95: r4(c.margen95) })
const mapa = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, casillaPublicable(v)]))

/** ¿El rango de este par es DIRECTO, o se deriva de dos contra el dólar? */
const esDirecto = (par) => monedasDe(par).includes('USD')

const llave = leerLlave()
if (!llave) {
  console.error('✗ falta la llave de Twelve Data (secreto TWELVEDATA_KEY).')
  process.exit(1)
}

// ── 1. Velas de una hora: el perfil por hora y por día ──────────────────────
console.log(`Bajando ${VELAS} velas H1 (7 créditos)…`)
const h1 = await obtenerVelas(llave, { velas: VELAS, intervalo: '1h' })

if (h1.barras.length < MIN_BARRAS_H1) {
  console.error(
    `\n✗ NO SE PUBLICA: solo ${h1.barras.length} velas H1 y el mínimo es ${MIN_BARRAS_H1}.\n` +
      `  Con tan pocas el perfil por hora tendría un puñado de observaciones por casilla\n` +
      `  y en pantalla se vería igual de bien. Mirar si la API devolvió menos de las pedidas.`
  )
  process.exit(1)
}

// ⚠️ SOLO LAS HORAS DE MERCADO. Es lo más importante de este guion.
//
// El 28,7 % de las velas que devuelve la fuente son horas en las que el
// mercado no puede estar abierto —sábado entero, domingo de día, viernes de
// noche— y se mueven 5,2 veces menos (medido el 2026-09-30). Un perfil por
// hora calculado sobre ellas diría que la madrugada del sábado es una hora de
// mercado floja, cuando lo que pasa es que no existe.
//
// Las de FRONTERA (viernes 21-22, sábado y domingo de 21 a 23) también se
// quitan, y aquí la decisión es propia de este panel: en esas horas el cambio
// de hora decide si hubo mercado, así que arrastrarían la media de las casillas
// 21, 22 y 23 sin que sepamos hacia dónde. Para un promedio vale más limpio
// que grande. La sonda las cuenta aparte por el mismo motivo.
const clases = { mercado: 0, frontera: 0, cerrado: 0, ilegibles: 0 }
const barrasDeMercado = h1.barras.filter((t) => {
  const c = clasificarHora(t)
  clases[c === null ? 'ilegibles' : c]++
  return c === 'mercado'
})
console.log(
  `  de ${h1.barras.length} velas H1: ${clases.mercado} de mercado · ` +
    `${clases.frontera} de frontera · ${clases.cerrado} cerradas · ${clases.ilegibles} ilegibles`
)
if (!barrasDeMercado.length) {
  console.error('\n✗ NO SE PUBLICA: ni una vela H1 cayó en hora de mercado. Algo va mal con las fechas.')
  process.exit(1)
}

// ── 2. Velas diarias: los dos paneles por mes ───────────────────────────────
console.log(`\nEsperando ${PAUSA_MS / 1000} s para no rozar el límite de créditos por minuto…`)
await esperar(PAUSA_MS)
console.log(`Bajando ${VELAS} velas diarias (7 créditos)…`)
const diario = await obtenerVelas(llave, { velas: VELAS, intervalo: '1day' })

if (diario.barras.length < MIN_SESIONES) {
  console.error(
    `\n✗ NO SE PUBLICA: solo ${diario.barras.length} sesiones diarias y el mínimo es ${MIN_SESIONES}.`
  )
  process.exit(1)
}
console.log(`  ${diario.barras.length} sesiones (${diario.barras[0]} → ${diario.barras[diario.barras.length - 1]})`)

// ⚠️ Las velas diarias de la fuente traen sábados y domingos, y esta app NO
// tiene rejilla limpia (su medición salió `noSeMueve`, 7 de 7). Para un panel
// que agrupa por calendario eso sí importa: se quitan aquí.
const sesionesHabiles = diario.barras.filter((t) => {
  const d = new Date(`${t.slice(0, 10)}T00:00:00Z`)
  return d.getUTCDay() >= 1 && d.getUTCDay() <= 5
})
console.log(`  de las cuales ${sesionesHabiles.length} de lunes a viernes (se quitan ${diario.barras.length - sesionesHabiles.length} de fin de semana)`)

// ── 3. Armar el paquete de cada par ─────────────────────────────────────────
// ⚠️ `rangos` va por DIVISA, no por par, y SIN cierre: la app pide 7 símbolos
// contra el dólar y saca los 18 pares de ellos. Los cierres están en `rates`.
// El dólar vale 1 y punto —lo mismo que hace `computarBarrido`—, así que para
// los 7 pares con dólar una de las dos series es constante y el rango sale
// exacto.
const unoSiEsDolar = (fila, ccy, campo) => (ccy === 'USD' ? 1 : fila?.[ccy]?.[campo])
const cierreDe = (rates, t, ccy) => (ccy === 'USD' ? 1 : rates[t][ccy])

function velasDe(barras, rates, rangos, par) {
  const [base, cotizada] = monedasDe(par)
  const out = []
  for (const t of barras) {
    const fila = rangos[t]
    const cB = cierreDe(rates, t, base)
    const cQ = cierreDe(rates, t, cotizada)
    // Si una vela llegara sin máximo/mínimo se cae al cierre, igual que hace
    // `computarBarrido`: eso da una vela de recorrido 0 en vez de romper el
    // perfil entero, y `rangoRelativo` la cuenta como el 0 que es.
    const hB = unoSiEsDolar(fila, base, 'h') ?? cB
    const lB = unoSiEsDolar(fila, base, 'l') ?? cB
    const hQ = unoSiEsDolar(fila, cotizada, 'h') ?? cQ
    const lQ = unoSiEsDolar(fila, cotizada, 'l') ?? cQ
    out.push({
      t: new Date(`${t.replace(' ', 'T')}Z`),
      h: maxDePar(lB, hQ),
      l: minDePar(hB, lQ),
      c: precioDePar(cB, cQ),
    })
  }
  return out
}

const pares = {}
let sinMes = 0
for (const par of PAIR_NAMES) {
  const vh1 = velasDe(barrasDeMercado, h1.rates, h1.rangos, par)
  const vdia = velasDe(sesionesHabiles, diario.rates, diario.rangos, par)
  const directo = esDirecto(par)
  if (!directo) sinMes++

  pares[par] = {
    directo,
    hora: mapa(perfilPor(vh1, porHoraUTC, HORAS)),
    dia: mapa(perfilPor(vh1, porDiaSemana, DIAS_HABILES)),
    // ⚠️ Solo los directos. Ver el aviso de la cabecera: derivar un máximo y un
    // mínimo en velas diarias dio un ATR 400 % mayor del real.
    mes: directo ? mapa(perfilPor(vdia, porMes, MESES)) : null,
    // La dirección sí, en los 18: solo usa CIERRES, y los cierres se derivan
    // exactos.
    mesDir: direccionPorMes(vdia),
  }
}

const datos = {
  app: 'intradia',
  generadoEl: new Date().toISOString(),
  h1: {
    barras: barrasDeMercado.length,
    desde: barrasDeMercado[0],
    hasta: barrasDeMercado[barrasDeMercado.length - 1],
  },
  // ⚠️ Los dos tramos van aparte y no se resumen en uno. El perfil por hora
  // cubre siete meses y el mensual veinte años: decir «desde 2006» encima del
  // perfil por hora sería falso, y es justo la clase de rótulo equivocado que
  // en este proyecto cuenta como error de medición.
  diario: {
    sesiones: sesionesHabiles.length,
    desde: sesionesHabiles[0],
    hasta: sesionesHabiles[sesionesHabiles.length - 1],
  },
  pares,
}

if (!Object.keys(datos.pares).length) {
  console.error('\n✗ NO SE PUBLICA: no salió ni un par.')
  process.exit(1)
}

const texto = JSON.stringify(datos)
mkdirSync(dirname(DESTINO), { recursive: true })
writeFileSync(DESTINO, texto)

// ── El informe ──────────────────────────────────────────────────────────────
const DIA = { 1: 'lun', 2: 'mar', 3: 'mié', 4: 'jue', 5: 'vie' }
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const pc = (x) => (x == null ? '    —' : `${x.toFixed(3)}%`.padStart(7))

console.log(`\n✓ ${DESTINO} · ${(texto.length / 1024).toFixed(1)} KB`)
console.log(`  ${sinMes} de ${PAIR_NAMES.length} pares son cruces y salen SIN panel mensual de recorrido, a propósito.\n`)

const nombre = pares['EUR/USD'] ? 'EUR/USD' : PAIR_NAMES[0]
const ej = pares[nombre]

console.log(`RECORRIDO POR HORA (${nombre}, en UTC) — cuánto se mueve, no hacia dónde`)
for (const h of HORAS) {
  const c = ej.hora[h]
  console.log(`  ${String(h).padStart(2, '0')}h  ${pc(c.medio)}  ±${pc(c.margen95).trim()}  (n=${c.n})`)
}

console.log(`\nRECORRIDO POR DÍA DE LA SEMANA (${nombre}, por hora de ese día)`)
for (const d of DIAS_HABILES) {
  const c = ej.dia[d]
  console.log(`  ${DIA[d]}  ${pc(c.medio)}  ±${pc(c.margen95).trim()}  (n=${c.n})`)
}

if (ej.mes) {
  console.log(`\nRECORRIDO POR MES (${nombre}, velas diarias)`)
  for (const m of MESES) {
    const c = ej.mes[m]
    console.log(`  ${MES[m]}  ${pc(c.medio)}  ±${pc(c.margen95).trim()}  (n=${c.n})`)
  }
}

console.log(`\n⚠ DIRECCIÓN POR MES (${nombre}) — la parte DÉBIL, y el margen dice por qué`)
for (const m of MESES) {
  const c = ej.mesDir[m]
  const pct = c.pct == null ? '  —' : `${String(c.pct).padStart(3)}%`
  console.log(`  ${MES[m]}  ${pct}${c.margen == null ? '' : ` ±${c.margen}`}  (${c.verdes} de ${c.n} meses)`)
}

const flojas = []
for (const [par, p] of Object.entries(pares)) {
  const cs = [...Object.values(p.hora), ...Object.values(p.dia), ...(p.mes ? Object.values(p.mes) : [])]
  const n = cs.filter(casillaFloja).length
  if (n) flojas.push(`${par}:${n}`)
}
console.log(
  flojas.length
    ? `\n⚠ casillas de recorrido con menos de ${MIN_OBS} observaciones: ${flojas.join(' · ')}`
    : `\n✓ todas las casillas de recorrido pasan de ${MIN_OBS} observaciones`
)

const porDebajo = MESES.filter((m) => (ej.mesDir[m].n || 0) < MIN_OBS).length
console.log(
  `⚠ dirección por mes: ${porDebajo} de 12 meses por debajo de ${MIN_OBS} observaciones. ` +
    `Es lo esperable y es el punto: esa tabla no decide nada.`
)
