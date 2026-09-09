// Comprobaciones de las tasas de los bancos centrales. SIN INTERNET.
//
//     node scripts/prueba-tasas.mjs
//
// El CSV de mentira que se usa aquí NO está inventado de cabeza: son las
// líneas REALES que devolvió la sonda del 2026-09-09, con los campos largos
// recortados pero conservando LO QUE IMPORTA — las comas dentro de comillas,
// que son el error fácil de este archivo.

import {
  DIVISA_ZONA,
  UMBRAL_NEUTRO,
  ZONA_DIVISA,
  diasDelDatoMasViejo,
  difDePar,
  difsPorPar,
  leerTasasCSV,
  partirLineaCSV,
  prepararTasas,
  tasasOrdenadas,
} from '../src/lib/tasas.js'
import { PAIR_NAMES, monedasDe } from '../src/lib/pairs.js'

let hechas = 0
let fallos = 0
const ok = (cond, que) => {
  hechas++
  if (cond) return true
  fallos++
  console.error(`  ✗ ${que}`)
  return false
}

const CABECERA =
  'FREQ,REF_AREA,UNIT_MEASURE,UNIT_MULT,TIME_FORMAT,COMPILATION,DECIMALS,' +
  'SOURCE_REF,SUPP_INFO_BREAKS,TITLE,TIME_PERIOD,OBS_VALUE,OBS_STATUS,OBS_CONF,OBS_PRE_BREAK'

// ⚠️ Las filas de CA y JP llevan comas DENTRO de un campo entrecomillado, tal
// como vienen del BIS de verdad. Si el lector parte por comas a pelo, esas dos
// se descolocan y `OBS_VALUE` sale texto.
const CSV = [
  CABECERA,
  'D,AU,368,0,,From 2 Aug 1990 onwards: cash rate target.,4,Reserve Bank of Australia,, Central bank policy rates - Australia,2026-09-01,3.6,A,F,',
  'D,CA,368,0,,"From 1 Jun 1994 onwards: Central bank target, overnight rate; from 27 Jul 1960: official bank rate.",4,Bank of Canada,, Central bank policy rates - Canada,2026-09-01,2.25,A,F,',
  'D,CH,368,0,,From 13 June 2019 onwards SNB Policy rate.,4,Swiss National Bank,, Central bank policy rates - Switzerland,2026-09-01,0,A,F,',
  'D,GB,368,0,,From 3 Aug 2006 onwards: official bank rate.,4,Bank of England,, Central bank policy rates - United Kingdom,2026-09-01,4,A,F,',
  'D,JP,368,0,,"From 17 Jun 2026 onwards: around 1.00 percent; from 22 Dec 2025: around 0.75 percent.",4,Bank of Japan,, Central bank policy rates - Japan,2026-09-01,1,A,F,',
  'D,NZ,368,0,,From 17 Mar 1999 onwards: official cash rate.,4,Reserve Bank of New Zealand,, Central bank policy rates - New Zealand,2026-09-01,2.75,A,F,',
  'D,US,368,0,,From 19 Dec 1985 onwards: mid-point of the Federal Reserve target rate.,4,US Federal Reserve System,, Central bank policy rates - United States,2026-09-01,3.625,A,F,',
  'D,XM,368,0,,"From 18 Sep 2024 onwards: deposit facility rate, fixed rate.",4,European Central Bank,, Central bank policy rates - Euro area,2026-09-01,2.4,A,F,',
].join('\n')

console.log('1. El partidor de líneas respeta las comillas')
{
  ok(partirLineaCSV('a,b,c').length === 3, 'tres campos simples')
  const p = partirLineaCSV('a,"b,c",d')
  ok(p.length === 3, `«a,"b,c",d» son 3 campos, salieron ${p.length}`)
  ok(p[1] === 'b,c', `el campo entrecomillado conserva su coma: «${p[1]}»`)
  ok(partirLineaCSV('a,,c')[1] === '', 'un campo vacío se conserva como vacío')
  ok(partirLineaCSV('a,b,')[2] === '', 'una línea que termina en coma deja un campo vacío al final')
  ok(partirLineaCSV('a,"b""c",d')[1] === 'b"c', 'dos comillas seguidas son una comilla literal')
}

console.log('2. Se leen las ocho, y con el valor correcto')
{
  const t = leerTasasCSV(CSV)
  ok(Object.keys(t).length === 8, `salieron ${Object.keys(t).length} divisas, se esperaban 8`)
  ok(t.USD?.v === 3.625, `USD debía ser 3.625 y salió ${t.USD?.v}`)
  ok(t.EUR?.v === 2.4, `EUR (zona XM) debía ser 2.4 y salió ${t.EUR?.v}`)
  ok(t.USD?.f === '2026-09-01', `la fecha del USD debía ser 2026-09-01 y salió ${t.USD?.f}`)

  // ⚠️ ESTAS DOS SON LAS QUE MUERDEN si alguien parte por comas a pelo: sus
  // filas llevan comas dentro de comillas.
  ok(t.CAD?.v === 2.25, `CAD debía ser 2.25 y salió ${t.CAD?.v} (¿se partió por comas a pelo?)`)
  ok(t.JPY?.v === 1, `JPY debía ser 1 y salió ${t.JPY?.v} (¿se partió por comas a pelo?)`)
}

console.log('3. Una tasa de CERO es un dato, no un hueco')
{
  // Suiza estaba justo en 0 el día de la sonda. `Number('')` también es 0, así
  // que el lector tiene que distinguirlos por el TEXTO, no por el número.
  const t = leerTasasCSV(CSV)
  ok('CHF' in t, 'el CHF con tasa 0 tiene que estar presente')
  ok(t.CHF?.v === 0, `el CHF debía valer 0 y salió ${t.CHF?.v}`)

  const sinValor = [CABECERA, 'D,CH,368,0,,x,4,SNB,, x,2026-09-01,,A,F,'].join('\n')
  ok(!('CHF' in leerTasasCSV(sinValor)), 'una fila SIN valor no debe entrar como tasa 0')
}

console.log('4. Lo que no se entiende se salta, sin tirar el resto')
{
  const roto = [
    CABECERA,
    'D,ZZ,368,0,,x,4,y,, z,2026-09-01,9.9,A,F,', // zona que no conocemos
    'D,US,368,0,,x,4,y,, z,no-es-fecha,3.625,A,F,', // fecha ilegible
    'D,GB,368,0,,x,4,y,, z,2026-09-01,cuatro,A,F,', // valor que no es número
    'D,JP,368,0,,x,4,y,, z,2026-09-01,1,A,F,', // ésta sí vale
  ].join('\n')
  const t = leerTasasCSV(roto)
  ok(Object.keys(t).length === 1, `solo debía sobrevivir el JPY, salieron ${Object.keys(t).join(',')}`)
  ok(t.JPY?.v === 1, 'la fila buena sobrevive a las tres rotas')
}

console.log('5. Las columnas se buscan por NOMBRE, no por posición')
{
  // Si el BIS mete una columna nueva delante, buscar por posición daría
  // números equivocados SIN FALLAR, que es lo peor que puede pasar.
  const conColumnaNueva = [
    'NUEVA,' + CABECERA,
    'x,D,US,368,0,,texto,4,y,, z,2026-09-01,3.625,A,F,',
  ].join('\n')
  const t = leerTasasCSV(conColumnaNueva)
  ok(t.USD?.v === 3.625, `con una columna nueva delante el USD debía seguir siendo 3.625 y salió ${t.USD?.v}`)
}

console.log('6. Entradas imposibles no revientan')
{
  for (const malo of [null, undefined, '', '   ', 42, {}, CABECERA]) {
    const t = leerTasasCSV(malo)
    ok(t && typeof t === 'object' && !Object.keys(t).length, `«${String(malo)}» devuelve {} sin reventar`)
  }
}

console.log('7. Se queda la observación MÁS RECIENTE si vienen varias')
{
  const dos = [
    CABECERA,
    'D,US,368,0,,x,4,y,, z,2026-08-01,3.875,A,F,',
    'D,US,368,0,,x,4,y,, z,2026-09-01,3.625,A,F,',
  ].join('\n')
  ok(leerTasasCSV(dos).USD?.v === 3.625, 'gana la fecha más nueva, no la primera fila')

  const alReves = [
    CABECERA,
    'D,US,368,0,,x,4,y,, z,2026-09-01,3.625,A,F,',
    'D,US,368,0,,x,4,y,, z,2026-08-01,3.875,A,F,',
  ].join('\n')
  ok(leerTasasCSV(alReves).USD?.v === 3.625, 'y sigue ganando aunque venga en el otro orden')
}

console.log('8. La diferencia por par, y hacia qué lado')
{
  const t = leerTasasCSV(CSV)

  // EUR 2,4 − USD 3,625 = −1,225 → el dólar paga más → favorece VENDER EUR/USD.
  const eu = difDePar('EUR/USD', t, monedasDe)
  ok(Math.abs(eu.dif - (2.4 - 3.625)) < 1e-9, `EUR/USD debía dar −1.225 y dio ${eu.dif}`)
  ok(eu.lado === 'venta', `EUR/USD debía salir 'venta' y salió '${eu.lado}'`)

  // USD 3,625 − JPY 1 = +2,625 → favorece COMPRAR USD/JPY.
  const uj = difDePar('USD/JPY', t, monedasDe)
  ok(uj.lado === 'compra', `USD/JPY debía salir 'compra' y salió '${uj.lado}'`)

  // ⚠️ El signo tiene que ser el CONTRARIO al darle la vuelta al par. Si esto
  // falla, `monedasDe` y `difDePar` no están de acuerdo en cuál es la base, y
  // la pantalla diría «compra» donde debería decir «vende».
  const falsas = { AAA: { v: 5, f: '2026-09-01' }, BBB: { v: 1, f: '2026-09-01' } }
  const ab = difDePar('AAA/BBB', falsas, () => ['AAA', 'BBB'])
  const ba = difDePar('BBB/AAA', falsas, () => ['BBB', 'AAA'])
  ok(ab.dif === -ba.dif, `dar la vuelta al par tiene que cambiar el signo: ${ab.dif} vs ${ba.dif}`)
  ok(ab.lado === 'compra' && ba.lado === 'venta', 'y cambiar el lado que recomienda')
}

console.log('9. El umbral neutro: ni «compra» ni «venta» cuando apenas hay diferencia')
{
  const f = '2026-09-01'
  const casi = { A: { v: 2 + UMBRAL_NEUTRO - 0.01, f }, B: { v: 2, f } }
  ok(difDePar('A/B', casi, () => ['A', 'B']).lado === 'neutro', 'justo por debajo del umbral es neutro')

  const justo = { A: { v: 2 + UMBRAL_NEUTRO, f }, B: { v: 2, f } }
  ok(difDePar('A/B', justo, () => ['A', 'B']).lado === 'neutro', 'exactamente en el umbral TAMBIÉN es neutro')

  const pasa = { A: { v: 2 + UMBRAL_NEUTRO + 0.01, f }, B: { v: 2, f } }
  ok(difDePar('A/B', pasa, () => ['A', 'B']).lado === 'compra', 'justo por encima del umbral ya dice compra')

  const iguales = { A: { v: 2, f }, B: { v: 2, f } }
  ok(difDePar('A/B', iguales, () => ['A', 'B']).lado === 'neutro', 'dos tasas iguales son neutro')
}

console.log('10. Si falta una tasa, dice «no lo sé» y NO cero')
{
  const solo = { EUR: { v: 2.4, f: '2026-09-01' } }
  const d = difDePar('EUR/USD', solo, monedasDe)
  ok(d.dif === null, `sin la tasa del USD, dif debe ser null y fue ${d.dif}`)
  ok(d.dif !== 0, 'y NUNCA 0: un 0 diría «las dos pagan lo mismo», que es una afirmación')
  ok(d.lado === 'nose', `el lado debe ser 'nose' y fue '${d.lado}'`)

  // Y esos pares no aparecen en la lista de la pantalla.
  ok(
    difsPorPar(solo, PAIR_NAMES, monedasDe).length === 0,
    'con una sola tasa no se puede calcular ninguna diferencia, así que la lista va vacía',
  )
}

console.log('11. La lista de la pantalla: todos los pares, ordenados por tamaño ABSOLUTO')
{
  const t = leerTasasCSV(CSV)
  const filas = difsPorPar(t, PAIR_NAMES, monedasDe)
  ok(filas.length === PAIR_NAMES.length, `debían salir los ${PAIR_NAMES.length} pares y salieron ${filas.length}`)

  let orden = true
  for (let i = 1; i < filas.length; i++) {
    if (Math.abs(filas[i - 1].dif) < Math.abs(filas[i].dif) - 1e-12) orden = false
  }
  ok(orden, 'la lista va de mayor a menor diferencia ABSOLUTA')

  // ⚠️ POR ABSOLUTO Y NO POR VALOR, y esto hay que comprobarlo con un caso
  // hecho a propósito, no con los datos de arriba.
  //
  // 📌 La primera versión de esta comprobación miraba si entre los cinco
  // primeros de la tabla real había alguno negativo — y FALLÓ, porque con esas
  // ocho tasas los cinco mayores resultaron ser todos positivos. No estaba
  // comprobando el código: estaba comprobando los datos de mentira. Es
  // exactamente «la prueba tiene que medir lo que dice medir».
  //
  // Lo que de verdad hay que exigir es que una diferencia negativa GRANDE gane
  // a una positiva pequeña. Si se ordenara por valor, los pares donde el swap
  // más se paga acabarían al final, que es justo donde no hay que esconderlos.
  const f = '2026-09-01'
  const inventadas = { A: { v: 0, f }, B: { v: 9, f }, C: { v: 1, f }, D: { v: 0, f } }
  const orden2 = difsPorPar(inventadas, ['A/B', 'C/D'], (p) => p.split('/'))
  ok(orden2[0].par === 'A/B', `A/B (−9) tiene que ir antes que C/D (+1), y salió primero ${orden2[0].par}`)
  ok(orden2[0].dif < 0, 'y el primero es efectivamente el negativo')
}

console.log('12. Los dos mapas de zona son inversos exactos')
{
  ok(Object.keys(ZONA_DIVISA).length === 8, 'ocho zonas')
  ok(Object.keys(DIVISA_ZONA).length === 8, 'ocho divisas')
  for (const [zona, div] of Object.entries(ZONA_DIVISA)) {
    ok(DIVISA_ZONA[div] === zona, `${div} tiene que volver a ${zona}`)
  }
  // `XM` es el área del euro, no un país. Si alguien lo «arregla» a `EU` o
  // `DE`, el BIS devuelve siete filas y el publicador se planta.
  ok(ZONA_DIVISA.XM === 'EUR', 'XM es el área del euro')
}

console.log('13. Todas las divisas de los pares de la app están cubiertas')
{
  // Si un día se añade un par con una divisa nueva (SEK, MXN…), esta
  // comprobación avisa ANTES de que la pantalla enseñe filas incompletas.
  const usadas = new Set()
  for (const p of PAIR_NAMES) for (const m of monedasDe(p)) usadas.add(m)
  const sinTasa = [...usadas].filter((m) => !DIVISA_ZONA[m])
  ok(sinTasa.length === 0, `divisas de la app sin tasa que buscar: ${sinTasa.join(', ')}`)
}

console.log('14. La antigüedad del dato')
{
  const t = { USD: { v: 3.625, f: '2026-09-01' }, EUR: { v: 2.4, f: '2026-08-20' } }
  const dias = diasDelDatoMasViejo(t, new Date('2026-09-09T12:00:00Z'))
  ok(dias === 20, `del 20 de agosto al 9 de septiembre son 20 días, salieron ${dias}`)

  ok(diasDelDatoMasViejo({}) === null, 'sin tasas devuelve null, no 0')
  ok(diasDelDatoMasViejo(null) === null, 'con null devuelve null')
  ok(
    diasDelDatoMasViejo({ X: { v: 1, f: 'ayer' } }) === null,
    'con una fecha ilegible devuelve null, no un número inventado',
  )
  // Nunca negativo, aunque el reloj del aparato vaya atrasado.
  ok(
    diasDelDatoMasViejo(t, new Date('2026-08-01T00:00:00Z')) === 0,
    'si la fecha del dato es futura respecto al reloj, sale 0 y no un negativo',
  )
}

console.log('15. Lo que se publica sobrevive al viaje por JSON')
{
  // Es como llega al navegador: texto y vuelta. Si algún campo no fuera
  // serializable, la app lo vería distinto de lo que el publicador escribió.
  const publicado = prepararTasas(CSV, new Date('2026-09-09T02:00:00Z'))
  const releido = JSON.parse(JSON.stringify(publicado))

  ok(releido.actualizadoEl === '2026-09-09T02:00:00.000Z', 'la fecha de publicación sobrevive')
  ok(Object.keys(releido.tasas).length === 8, 'las ocho tasas sobreviven')
  ok(releido.tasas.CHF.v === 0, 'el cero sobrevive como cero')
  ok(
    JSON.stringify(difsPorPar(releido.tasas, PAIR_NAMES, monedasDe)) ===
      JSON.stringify(difsPorPar(publicado.tasas, PAIR_NAMES, monedasDe)),
    'la lista sale idéntica antes y después del viaje por JSON',
  )

  // El archivo tiene que ser DIMINUTO: lo baja cada miembro cada vez que abre
  // la app. Si alguien mete aquí las series completas, esto lo canta.
  const kb = JSON.stringify(publicado).length / 1024
  ok(kb < 2, `el archivo publicado debe pesar menos de 2 KB y pesa ${kb.toFixed(2)} KB`)
}

console.log('16. Las ocho sueltas salen ordenadas de mayor a menor')
{
  const s = tasasOrdenadas(leerTasasCSV(CSV))
  ok(s.length === 8, `ocho filas, salieron ${s.length}`)
  ok(s[0].divisa === 'GBP', `la más alta debía ser el GBP (4 %) y salió ${s[0].divisa}`)
  ok(s[s.length - 1].divisa === 'CHF', `la más baja debía ser el CHF (0 %) y salió ${s[s.length - 1].divisa}`)
  ok(tasasOrdenadas(null).length === 0, 'con null devuelve lista vacía sin reventar')
}

console.log('')
if (fallos) {
  console.error(`✗ ${fallos} de ${hechas} comprobaciones fallaron.`)
  process.exit(1)
}
console.log(`✓ todo bien (${hechas} comprobaciones).`)
