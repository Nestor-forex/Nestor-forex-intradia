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
  OBSERVACIONES,
  UMBRAL_NEUTRO,
  ZONA_DIVISA,
  diasDelDatoMasViejo,
  diasVigente,
  difDePar,
  difsPorPar,
  leerSerieCSV,
  leerTasasCSV,
  partirLineaCSV,
  prepararTasas,
  tasasOrdenadas,
  tendenciasDeSerie,
  ultimoCambio,
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

// ═════════════════════════════════════════════════════════════════════════
// LA TENDENCIA (añadida el 2026-09-29)
// ═════════════════════════════════════════════════════════════════════════
//
// ⚠️ LAS FILAS DE ESTE CSV REPRODUCEN LOS HUECOS REALES DEL BIS, que es el
// fallo que estas comprobaciones existen para cazar. Medido con la sonda el
// 2026-09-29: de 1000 observaciones, Nueva Zelanda trae 283 huecos y Canadá
// 122. Sin quitarlos, Nueva Zelanda salía con 294 «cambios» en vez de 12.
//
// La serie de abajo tiene, a propósito:
//
//   · US  → un cambio limpio, sin huecos:      3.625 → 3.875 el día 17
//   · NZ  → un hueco EN MEDIO de un valor estable: 2.5, (vacío), 2.5 …
//            o sea el caso que inventaba dos cambios que no existen
//   · CH  → el MISMO valor todo el rato (0): no hay tendencia que dar
//   · JP  → dos cambios, para comprobar que se queda con el ÚLTIMO
//   · GB  → un hueco justo ANTES del cambio real, que es el caso más
//            traicionero: la fecha del cambio podría salir mal por un día
const SERIE = [
  CABECERA,
  // Estados Unidos: sube de 3.625 a 3.875, sin huecos.
  'D,US,368,0,,x,4,Fed,, y,2026-09-14,3.625,A,F,',
  'D,US,368,0,,x,4,Fed,, y,2026-09-15,3.625,A,F,',
  'D,US,368,0,,x,4,Fed,, y,2026-09-17,3.875,A,F,',
  'D,US,368,0,,x,4,Fed,, y,2026-09-22,3.875,A,F,',
  // Nueva Zelanda: sube el día 3 y después SOLO HAY HUECOS. Si los huecos se
  // contaran, saldrían dos cambios más y la fecha sería el 18, no el 3.
  'D,NZ,368,0,,x,4,RBNZ,, y,2026-09-01,2.5,A,F,',
  'D,NZ,368,0,,x,4,RBNZ,, y,2026-09-03,2.75,A,F,',
  'D,NZ,368,0,,x,4,RBNZ,, y,2026-09-12,,A,F,',
  'D,NZ,368,0,,x,4,RBNZ,, y,2026-09-18,2.75,A,F,',
  // Suiza: clavada en 0 toda la ventana. `Number('')` también es 0, así que
  // esto además comprueba que un cero de verdad no se confunde con un hueco.
  'D,CH,368,0,,x,4,SNB,, y,2026-09-01,0,A,F,',
  'D,CH,368,0,,x,4,SNB,, y,2026-09-22,0,A,F,',
  // Japón: dos cambios. Tiene que quedarse con el segundo.
  'D,JP,368,0,,x,4,BoJ,, y,2026-06-01,0.5,A,F,',
  'D,JP,368,0,,x,4,BoJ,, y,2026-06-17,0.75,A,F,',
  'D,JP,368,0,,x,4,BoJ,, y,2026-08-10,1,A,F,',
  // Reino Unido: un hueco justo antes del cambio, con una coma dentro de
  // comillas para que las dos trampas del archivo actúen a la vez.
  'D,GB,368,0,,"From 3 Aug 2006 onwards: official bank rate, fixed.",4,BoE,, y,2026-09-10,4,A,F,',
  'D,GB,368,0,,x,4,BoE,, y,2026-09-15,,A,F,',
  'D,GB,368,0,,x,4,BoE,, y,2026-09-16,3.75,A,F,',
].join('\n')

console.log('17. La serie se lee entera, en orden y sin los huecos del BIS')
{
  const s = leerSerieCSV(SERIE)
  // ⚠️ Las claves son la DIVISA (`USD`), no la zona del BIS (`US`): la
  // traducción la hace `ZONA_DIVISA` dentro del lector. La primera versión de
  // esta línea pedía `s.US` y salió `undefined` — o sea que la comprobación
  // habría pasado en verde si hubiera usado un `?.` más permisivo.
  ok(s.USD?.length === 4, `USD debía traer 4 observaciones y trajo ${s.USD?.length}`)

  // ⚠️ LA QUE MUERDE: la fila vacía de NZ NO puede entrar en la serie.
  ok(s.NZD?.length === 3, `NZD debía traer 3 observaciones (una es hueco) y trajo ${s.NZD?.length}`)
  ok(
    !s.NZD?.some((o) => o.f === '2026-09-12'),
    'el hueco del 12 de septiembre NO debe estar en la serie del NZD',
  )
  ok(s.GBP?.length === 2, `GBP debía traer 2 observaciones (una es hueco) y trajo ${s.GBP?.length}`)

  // El cero SÍ entra: es un dato, no un hueco.
  ok(s.CHF?.length === 2, `CHF debía traer 2 observaciones y trajo ${s.CHF?.length}`)
  ok(s.CHF?.every((o) => o.v === 0), 'los ceros de Suiza entran como ceros de verdad')

  // Ascendente, sin fiarse del orden de la respuesta.
  const f = s.JPY?.map((o) => o.f) ?? []
  ok(
    JSON.stringify(f) === JSON.stringify([...f].sort()),
    `la serie del JPY debía venir de más vieja a más nueva: ${f.join(' ')}`,
  )

  ok(Object.keys(leerSerieCSV('')).length === 0, 'con texto vacío devuelve {} sin reventar')
  ok(Object.keys(leerSerieCSV(null)).length === 0, 'con null devuelve {} sin reventar')
  ok(Object.keys(leerSerieCSV(CABECERA)).length === 0, 'con solo la cabecera devuelve {} sin reventar')
}

console.log('18. El último cambio: de dónde viene, a dónde va y desde cuándo')
{
  const s = leerSerieCSV(SERIE)

  const us = ultimoCambio(s.USD)
  ok(us?.de === 3.625 && us?.a === 3.875, `US debía ir de 3.625 a 3.875 y fue de ${us?.de} a ${us?.a}`)
  ok(us?.sentido === 'subio', `US subió, y salió «${us?.sentido}»`)
  ok(us?.desde === '2026-09-17', `US vigente desde 2026-09-17 y salió ${us?.desde}`)

  // ⚠️⚠️ LA COMPROBACIÓN CENTRAL DE TODO ESTE BLOQUE. Con los huecos contados,
  // el NZD daría 3 escalones y la fecha saldría el 18 de septiembre. La verdad
  // es 1 escalón, el día 3.
  const nz = ultimoCambio(s.NZD)
  ok(nz?.escalones === 1, `el NZD tiene UN cambio real y salieron ${nz?.escalones} (¿se colaron los huecos?)`)
  ok(nz?.desde === '2026-09-03', `el NZD es vigente desde el día 3 y salió ${nz?.desde} (¿un hueco movió la fecha?)`)
  ok(nz?.de === 2.5 && nz?.a === 2.75, `el NZD debía ir de 2.5 a 2.75 y fue de ${nz?.de} a ${nz?.a}`)

  // Igual en el GBP, donde el hueco va justo ANTES del cambio y además la fila
  // lleva una coma dentro de comillas.
  const gb = ultimoCambio(s.GBP)
  ok(gb?.a === 3.75 && gb?.de === 4, `el GBP debía BAJAR de 4 a 3.75 y fue de ${gb?.de} a ${gb?.a}`)
  ok(gb?.sentido === 'bajo', `el GBP bajó, y salió «${gb?.sentido}»`)
  ok(gb?.desde === '2026-09-16', `el GBP es vigente desde el 16 y salió ${gb?.desde}`)

  // Con dos cambios se queda con el ÚLTIMO, no con el primero.
  const jp = ultimoCambio(s.JPY)
  ok(jp?.escalones === 2, `el JPY tiene dos cambios y salieron ${jp?.escalones}`)
  ok(jp?.de === 0.75 && jp?.a === 1, `el JPY debía quedarse con el último (0.75 → 1) y salió ${jp?.de} → ${jp?.a}`)

  // ⚠️ SIN CAMBIO DEVUELVE `null`, NO «sin cambios». Ver el porqué en
  // `ultimoCambio`: decir «está quieta» sería una afirmación sobre el banco
  // central; lo único que sabemos es que no se movió en lo que la app miró.
  ok(ultimoCambio(s.CHF) === null, 'Suiza, clavada en 0, no da tendencia: devuelve null')
  ok(ultimoCambio([]) === null, 'una serie vacía devuelve null')
  ok(ultimoCambio(null) === null, 'con null devuelve null sin reventar')
  ok(ultimoCambio([{ f: '2026-09-01', v: 1 }]) === null, 'con una sola observación devuelve null')
}

console.log('19. Las tendencias, y los días que lleva vigente')
{
  const t = tendenciasDeSerie(leerSerieCSV(SERIE))
  ok(!('CHF' in t), 'una divisa sin cambio NO aparece en las tendencias (no entra como «plana»)')
  ok(Object.keys(t).length === 4, `debían salir cuatro tendencias (US, NZ, GB, JP) y salieron ${Object.keys(t).length}`)

  const dias = diasVigente(t.USD, new Date('2026-09-29T00:00:00Z'))
  ok(dias === 12, `del 17 al 29 de septiembre son 12 días y salieron ${dias}`)
  ok(diasVigente(null) === null, 'sin cambio no hay días: null, no 0')
  ok(diasVigente({ desde: 'mañana' }) === null, 'una fecha ilegible devuelve null, no 0')
  ok(Object.keys(tendenciasDeSerie(null)).length === 0, 'con null devuelve {} sin reventar')
}

console.log('20. La ventana pedida alcanza, y el archivo publicado sigue siendo diminuto')
{
  // ⚠️ El número sale de la sonda del 2026-09-29, no de a ojo: con 1000
  // observaciones las OCHO zonas tienen al menos 6 cambios reales dentro
  // (Japón 6, EE. UU. 8, Suiza 10, zona euro 11, Canadá y NZ 12, R. Unido 13,
  // Australia 14). Con 400 alcanzaba por poco — Suiza quedaba a mitad de
  // ventana—, así que bajarlo es estrechar el margen sin ganar nada.
  ok(OBSERVACIONES >= 1000, `OBSERVACIONES no debería bajar de 1000 y vale ${OBSERVACIONES}`)

  const publicado = prepararTasas(SERIE, new Date('2026-09-29T02:00:00Z'))
  ok(Object.keys(publicado.tendencias).length === 4, 'el publicado trae las tendencias')

  // ⚠️ CAMBIO ADITIVO: `tasas` tiene que seguir saliendo exactamente igual que
  // antes de que existieran las tendencias. Un lector viejo no debe notar nada.
  ok(
    JSON.stringify(publicado.tasas) === JSON.stringify(leerTasasCSV(SERIE)),
    '`tasas` sale idéntico a lo que `leerTasasCSV` daba por su cuenta',
  )

  // Y sobrevive el viaje por JSON, que es como llega al navegador.
  const releido = JSON.parse(JSON.stringify(publicado))
  ok(releido.tendencias.USD.de === 3.625, 'la tendencia sobrevive el viaje por JSON')
  ok(releido.tendencias.USD.sentido === 'subio', 'y el sentido también')

  // ⚠️ EL ARCHIVO LO BAJA CADA MIEMBRO CADA VEZ QUE ABRE LA APP. Los 5,5 MB de
  // CSV los baja el runner una vez al día; lo que viaja al teléfono es esto. Si
  // alguien mete aquí las series completas, esta comprobación lo canta.
  const completo = prepararTasas(CSV, new Date('2026-09-09T02:00:00Z'))
  const kb = JSON.stringify(completo).length / 1024
  ok(kb < 2, `el archivo publicado debe pesar menos de 2 KB y pesa ${kb.toFixed(2)} KB`)
}

console.log('')
if (fallos) {
  console.error(`✗ ${fallos} de ${hechas} comprobaciones fallaron.`)
  process.exit(1)
}
console.log(`✓ todo bien (${hechas} comprobaciones).`)
