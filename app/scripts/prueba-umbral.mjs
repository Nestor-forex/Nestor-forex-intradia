// Que el UMBRAL DE FUERZA viva en un solo sitio, y que el reporte diario diga
// hasta dónde llegó la divergencia y cuánto hacía falta.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ POR QUÉ EXISTE ESTA PRUEBA
// ─────────────────────────────────────────────────────────────────────────
// El 2026-10-12, al ir a añadir la línea del umbral al reporte, apareció que
// el `0.5` que decide TODAS las señales estaba escrito a mano en NUEVE sitios
// en Swing y TRECE en Intradía: el vigía, el reporte, el comparador de reglas y
// cada guion del banco de pruebas llevaban su propia copia.
//
// Nada fallaba. Y ése es el problema: el día que alguien cambiara uno, la app
// diría una cosa, el reporte otra y el banco mediría una tercera, sin un solo
// error por ninguna parte. Es exactamente la familia de las etiquetas «(hoy)»
// que envejecieron solas el 2026-09-05 — un número bien escrito describiendo
// algo distinto de lo que dice describir.
//
// ⚠️ Y el arreglo no es «tener más cuidado»: es que el número viva en
// `marketCalc.js` y quien lo necesite lo IMPORTE, con esta prueba vigilando que
// no vuelva a aparecer escrito a mano.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ Y POR QUÉ LA LÍNEA DEL REPORTE HACE FALTA
// ─────────────────────────────────────────────────────────────────────────
// Porque la escala 0-10 de la fuerza NO sirve para saber si hubo divergencia.
// `esc` normaliza de mínimo a máximo, así que la divisa más débil vale 0 y la
// más fuerte 10 SIEMPRE, por pequeña que sea la diferencia real. Ese mismo día
// me engañó a mí teniendo el código delante: leí «CAD 10,0 · CHF 0,0» en
// Intradía y afirmé que había divergencia de sobra. La mayor de verdad era
// 0,31 contra un umbral de 0,59.
//
// Sin los dos números al lado, un reporte vacío es un HUECO: «el mercado está
// plano» y «la app está atascada» se leen exactamente igual.

import { readFileSync, readdirSync } from 'node:fs'

import { UMBRAL_FUERZA, derivarVista } from '../src/lib/marketCalc.js'

let ok = 0
let mal = 0
const bien = (c, m) => {
  if (c) {
    ok++
    console.log(`  ✓ ${m}`)
  } else {
    mal++
    console.log(`  ✗ ${m}`)
  }
  return c
}
const leer = (r) => readFileSync(new URL(r, import.meta.url), 'utf8')

// ── 1. La constante existe y es un número de verdad ──────────────────────
console.log('\n1. la constante')
bien(Number.isFinite(UMBRAL_FUERZA), `UMBRAL_FUERZA es un número (${UMBRAL_FUERZA})`)
bien(UMBRAL_FUERZA > 0, 'y es mayor que cero — un umbral de 0 dejaría pasar cualquier par')

const calc = leer('../src/lib/marketCalc.js')
bien(/^export const UMBRAL_FUERZA = /m.test(calc), 'se exporta desde marketCalc.js')

// ⚠️ Lo que de verdad cierra el agujero: que el valor por defecto de
// `derivarVista` sea la constante y no otro literal. Si fuera un literal, un
// guion que llamara sin `thr` mediría con un umbral distinto del publicado.
bien(/thr = UMBRAL_FUERZA/.test(calc), '`derivarVista` usa la constante como valor por defecto')
bien(!/thr = 0\.\d/.test(calc), 'y NO un número escrito a mano')

// ── 2. Nadie lo escribe a mano ───────────────────────────────────────────
console.log('\n2. ninguna copia a mano del número')

const guiones = readdirSync(new URL('./', import.meta.url))
  .filter((f) => f.endsWith('.mjs') && !f.startsWith('prueba-'))
  .map((f) => `scripts/${f}`)

// ⚠️ GUARDA: si el recorrido se rompe, esta prueba pasaría en verde sin haber
// mirado ni un archivo. Es el agujero de «una prueba que se adapta a lo que
// encuentra no comprueba nada».
bien(guiones.length >= 8, `se encontraron los guiones de scripts/ (${guiones.length})`)

const usan = guiones.filter((f) => {
  const t = leer(`../${f}`)
  return t.includes('derivarVista(') || t.includes('generarSenales(') || /\bTHR\b/.test(t)
})
bien(usan.length >= 4, `y los que deciden señales (${usan.length})`)

// Lo prohibido: el umbral con un número dentro. Se buscan las DOS formas en
// que estaba escrito —`thr: 0.5` al llamar y `const THR = 0.5` al declarar—
// más cualquier otro decimal, porque el fallo no es el 0,5 concreto: es que el
// número viva fuera de `marketCalc.js`.
const PROHIBIDO = /(\bthr:\s*\d|\bconst THR\s*=\s*\d|\bthr\s*=\s*\d)/
const culpables = usan.filter((f) => PROHIBIDO.test(leer(`../${f}`)))
bien(
  culpables.length === 0,
  culpables.length
    ? `ESCRIBEN EL UMBRAL A MANO: ${culpables.join(', ')} — importa UMBRAL_FUERZA de marketCalc.js`
    : 'ninguno escribe el umbral a mano'
)

// ── 3. La vista dice con qué umbral clasificó y hasta dónde llegó ────────
console.log('\n3. lo que devuelve la vista')

// Un mercado donde NINGÚN par pasa, que es el caso que la línea existe para
// explicar. Con `dif` pequeño no se construye ningún setup, así que basta una
// forma mínima del barrido.
const barridoFlojo = {
  ultima: '2026-10-12',
  horaUltima: 12,
  esc: { USD: 10, EUR: 0 },
  pares: [
    { name: 'EUR/USD', b: 'EUR', q: 'USD', dif: -0.21, tend: 'Rango', rsiV: 50, atrPct: 0.5, atrPctH: 0.5, c: 1.16, dec: 5, serie20: [1, 1.16], pivots: {} },
    { name: 'USD/CHF', b: 'USD', q: 'CHF', dif: 0.31, tend: 'Rango', rsiV: 50, atrPct: 0.5, atrPctH: 0.5, c: 0.83, dec: 5, serie20: [1, 0.83], pivots: {} },
  ],
}
const flojo = derivarVista(barridoFlojo)

bien(flojo.setups.length === 0, 'con divergencia por debajo del umbral no hay ni un setup')
bien(Number.isFinite(flojo.umbral), `la vista dice el umbral con el que clasificó (${flojo.umbral})`)
// ⚠️ Se compara con el MAYOR VALOR ABSOLUTO, no con el mayor `dif`: una
// divergencia de −0,31 pesa lo mismo que una de +0,31, solo cambia el lado.
bien(Math.abs(flojo.difMax - 0.31) < 1e-9, `y hasta dónde llegó la divergencia (${flojo.difMax})`)
bien(flojo.difMax <= flojo.umbral, 'y aquí la divergencia NO llegaba al umbral, que es lo que explica el vacío')

// ⚠️ `null` y NUNCA 0 cuando no hay nada que medir. Un 0 diría «hoy no hubo
// ninguna divergencia», que es una afirmación sobre el mercado; `null` dice «no
// lo sé», y quien lo pinte no pinta nada. Misma asimetría que `pearson`.
const vacio = derivarVista({ ...barridoFlojo, pares: [] })
bien(vacio.difMax === null, 'sin pares devuelve null, no 0')

const roto = derivarVista({ ...barridoFlojo, pares: [{ ...barridoFlojo.pares[0], dif: NaN }] })
bien(roto.difMax === null, 'con un `dif` roto devuelve null, no NaN')

// ── 4. El reporte lo imprime, y se calla si no se puede medir ────────────
console.log('\n4. el reporte diario')

const rep = leer('./reporte-diario.mjs')
const lineas = leer('./lib/lineas-reporte.mjs')
bien(/lineaUmbral/.test(rep), 'el reporte tiene la línea del umbral')
bien(/\$\{lineaUmbral\(/.test(rep), 'y la pinta de verdad dentro del texto')
bien(/umbral de fuerza/.test(lineas), 'con la frase que explica por qué no hay señales')

// ⚠️ ESTO ES LO QUE EVITA UNA LÍNEA INVENTADA. Sin la guarda, un barrido sin
// datos imprimiría «iba a NaN y hacía falta NaN», que es peor que no decir nada.
bien(/Number\.isFinite\(difMax\)/.test(lineas), 'y se calla cuando `difMax` no se pudo medir')

// Y que no se haya quedado pasando su propia copia del número.
bien(!/derivarVista\([^)]*thr:/.test(rep), 'el reporte ya no pasa su propio umbral a `derivarVista`')

// ── 5. EL REPORTE Y LA APP TIENEN QUE PEDIR LO MISMO ────────────────────
//
// ⚠️⚠️ POR QUÉ: el 2026-10-19 Néstor abrió la app y vio «EUR/CAD COMPRA ·
// EUR/NZD COMPRA · EUR/CHF COMPRA» mientras el reporte de ese mismo día decía
// «sin setups limpios hoy» y yo le decía que esos pares eran para VENDER. Los
// tres eran ciertos de cosas distintas, y el origen era UNA palabra: la app
// llama a `derivarVista` con `incluirReversion: true` desde el 2026-09-05 y el
// reporte la llamaba sin ella.
//
// Nada fallaba — y eso es lo de siempre en este repositorio. Dos salidas del
// mismo proyecto, con los mismos datos del mismo día, describiendo apps
// distintas. Su frase fue «que tú digas una cosa y la app diga otra, eso no
// puede pasar», y tiene razón.
//
// ⚠️ Esto NO compara los textos: compara las OPCIONES con las que cada uno
// pide el cálculo, que es donde nació la divergencia. Si mañana la app
// enciende otra regla, esta prueba exige que el reporte la encienda también o
// que alguien venga aquí a escribir por qué no.
console.log('\n5. el reporte pide el mismo cálculo que la app')

const hook = leer('../src/lib/useMarketData.js')
const opcionesDe = (txt) => {
  const m = txt.match(/derivarVista\(\s*data\s*,\s*\{([^}]*)\}/)
  if (!m) return null
  return new Set(
    m[1]
      .split(',')
      .map((s) => s.split(':')[0].trim())
      .filter((s) => s && s !== 't' && s !== 'topN' && s !== 'thr'),
  )
}
const opApp = opcionesDe(hook)
const opRep = opcionesDe(rep)

// Guarda: si el lector no encuentra las llamadas, esta prueba no comprueba
// nada y tiene que FALLAR en vez de pasar en verde sobre un vacío.
bien(opApp !== null, 'se encontró la llamada de la app (si no, esta prueba no mira nada)')
bien(opRep !== null, 'se encontró la llamada del reporte')

if (opApp && opRep) {
  const faltan = [...opApp].filter((k) => !opRep.has(k))
  bien(
    faltan.length === 0,
    faltan.length
      ? `el reporte NO pasa lo que la app sí: ${faltan.join(', ')} — la app y el reporte describirían apps distintas`
      : 'el reporte pasa todas las opciones de reglas que pasa la app',
  )
  // ⚠️ Y que el reporte la PINTE, no solo que la pida: pedirla y no enseñarla
  // dejaría el mismo hueco con el cálculo correcto detrás.
  //
  // Agnóstico a propósito — este archivo es GEMELO. Swing enciende
  // `incluirReversion` y tiene que pintar su bloque; Intradía hoy no enciende
  // ninguna regla extra y no hay bloque que exigirle. El día que encienda una,
  // esta prueba se la pide sin que nadie venga a tocarla.
  const reglasExtra = [...opApp].filter((k) => /^incluir/.test(k))
  if (reglasExtra.length) {
    bien(true, `la app enciende reglas extra: ${reglasExtra.join(', ')}`)
    bien(/\$\{bloque[A-Z]/.test(rep), 'y el reporte pinta un bloque aparte para ellas')
    bien(
      /EXPERIMENTO|experimento/.test(rep),
      'con el aviso de que es un experimento y no una propuesta de la app',
    )
  } else {
    bien(true, 'esta app no enciende ninguna regla extra: no hay bloque que exigir')
  }
}

// ── 6. NINGÚN PAR QUE PASE EL UMBRAL DESAPARECE EN SILENCIO ─────────────
//
// ⚠️⚠️ EL INVARIANTE, y es lo que de verdad se rompió: un par que pasa el
// umbral de fuerza tiene que salir en ALGUNA lista, o que algo diga por qué
// no sale. Las dos cosas valen; lo que no vale es que desaparezca.
//
// El caso real (Swing, 2026-10-16 y 19): cinco pares pasaron el umbral, los
// cinco clasificaron 'VENTA', y las ventas están pausadas desde el
// 2026-08-12. Caen de `ventas` por la pausa y NO caen en `vigilancia`, que
// solo recoge 'VIGILAR'. Resultado: fuera de las cuatro listas, con el
// reporte diciendo «divergencia 1,32 contra 0,50» justo encima. Se leía como
// «el mercado está plano».
//
// ⚠️ Escrito como invariante Y NO como «comprueba que Swing avisa» a
// propósito: este archivo es GEMELO. Intradía hoy no pausa ningún lado, así
// que allí el par sale en su lista y el invariante se cumple por el otro
// camino. El día que alguien pause algo en cualquiera de las dos, esta misma
// prueba lo exige sin que nadie venga a tocarla.
console.log('\n6. ningún par que pase el umbral desaparece en silencio')

// ⚠️ Este par tiene que clasificar 'VENTA' DE VERDAD, no 'VIGILAR': si solo
// pasara el umbral sin cumplir la tendencia, caería en `vigilancia` y seguiría
// saliendo en el reporte — que es justo el caso que NO hay que avisar. Con
// `TENDENCIA_MIN = 'media'` eso exige `c < e20`, y por eso van los dos campos.
// (La primera versión de esta prueba no los traía y fallaba: el fallo era de la
// prueba, no del código.)
const soloVentas = {
  ...barridoFlojo,
  pares: barridoFlojo.pares.map((p, i) => ({
    ...p,
    dif: i === 0 ? -9 : 0,
    tend: 'Bajista',
    rsiV: 45,
    c: 1.0,
    e20: 1.1,
    e50: 1.12,
    // Los niveles que `mkSetup` necesita para construir la operación. Hacen
    // falta porque la comparación «sin pausar» SÍ llega a armar el setup.
    lo10: 0.95,
    hi10: 1.05,
    lo20: 0.92,
    hi20: 1.08,
    atrAbs: 0.01,
    // ⚠️ Campos que solo pide UNA de las dos apps. Este archivo es GEMELO, así
    // que el mercado de prueba lleva la UNIÓN de lo que necesitan las dos —
    // igual que `barridoFlojo` ya lleva `atrPctH` y `pivots`. Sobran en la otra
    // y no estorban; sin ellos la prueba revienta al portarla.
    adx: 25,
    e9: 1.1,
    e21: 1.12,
    pivots: { p: 1.0, r1: 1.03, r2: 1.06, s1: 0.97, s2: 0.94 },
  })),
}
const v = derivarVista(soloVentas)
const pasanElUmbral = v.pares.filter((p) => Math.abs(p.dif) > v.umbral)
bien(pasanElUmbral.length === 1, `el mercado de prueba deja 1 par por encima del umbral (${pasanElUmbral.length})`)

const enAlgunaLista = (name) =>
  [...v.compras, ...v.ventas, ...v.vigilancia].some((x) => x.name === name) ||
  v.setups.some((s) => s.name === name)
const loExplicaAlgo = (name) => Boolean(v.bloqueados?.pares?.includes(name))

for (const p of pasanElUmbral) {
  bien(
    enAlgunaLista(p.name) || loExplicaAlgo(p.name),
    `${p.name} pasa el umbral y o sale en una lista o algo dice por qué no (sale: ${enAlgunaLista(p.name)} · explicado: ${loExplicaAlgo(p.name)})`,
  )
}

// ⚠️ Y el aviso no puede aparecer «por si acaso»: sin ningún lado apagado no
// hay nada que explicar, y una frase ahí sería una afirmación sobre el mercado
// donde no hay nada que decir. `null` y nunca `{ n: 0 }` — misma asimetría que
// `difMax`. (`?? null` porque en la app que no pausa nada el campo no existe.)
const sinPausa = derivarVista(soloVentas, { incluirVentas: true })
bien((sinPausa.bloqueados ?? null) === null, 'sin ningún lado apagado no se inventa un aviso')
bien((derivarVista({ ...barridoFlojo, pares: [] }).bloqueados ?? null) === null, 'sin pares tampoco')

// Y si ESTA app apaga un lado, el reporte tiene que decirlo. Donde no se apaga
// nada, no hay línea que exigir.
const estaAppApagaUnLado = v.bloqueados !== null && v.bloqueados !== undefined
if (estaAppApagaUnLado) {
  bien(/lineaBloqueados/.test(rep), 'esta app apaga un lado, así que el reporte tiene la línea que lo explica')
  bien(/\$\{lineaBloqueados\(/.test(rep), 'y la pinta de verdad')
  // La frase se mudó al módulo el 2026-10-20 para poder probarla; el bloque 7
  // comprueba lo mismo sobre su SALIDA de verdad, que es más fuerte que buscar
  // la palabra en un archivo.
  bien(/pausad/.test(lineas), 'nombrando que el motivo es una pausa')
} else {
  bien(true, 'esta app no apaga ningún lado: no hay línea que exigir')
}

// ── 7. NINGUNA FRASE AFIRMA «NO HAY SEÑALES» SIN SABER SI LAS HAY ───────
//
// ⚠️⚠️ POR QUÉ: el 2026-10-20 las dos apps publicaron en el chat de Néstor una
// frase falsa. Swing dijo «Por eso no hay señales» en un reporte que traía DOS
// setups (GBP/JPY y GBP/USD COMPRA); Intradía dijo lo mismo con una señal de
// rango en pantalla (USD/CHF VENTA, R/B 1:1.8).
//
// Los números eran verdad las dos veces. Lo falso era la conclusión — *una
// etiqueta equivocada es un error de medición*, que en este archivo ya está
// escrito dos veces.
//
// 📌 Y la causa no era descuido: esas funciones **sólo recibían `difMax` y
// `umbral`**, así que no tenían con qué saber si había señales y aun así
// afirmaban que no las había. Esto comprueba lo único que lo cierra: que la
// afirmación dependa del dato, y que el reporte le pase el dato.
//
// ⚠️ Es GEMELO, así que son INVARIANTES y no el texto de ninguna de las dos:
// cada app redacta como quiera, pero ninguna puede afirmar una ausencia que no
// ha comprobado.
console.log('\n7. ninguna frase afirma una ausencia que no ha comprobado')

const mod = await import('./lib/lineas-reporte.mjs')
// Sin esta guarda el bucle de abajo no entraría nunca y el bloque pasaría en
// verde sin mirar nada — el agujero de siempre.
bien(typeof mod.lineaUmbral === 'function', 'la línea del umbral vive en un módulo que se puede probar')

// ⚠️ LA QUE DE VERDAD IMPORTA: una sola copia. Si el guion se quedara con su
// propia versión, se podría arreglar el módulo y seguir publicando la frase
// mala — es el fallo del umbral en nueve sitios, en pequeño.
bien(
  !/^\s*const lineaUmbral\s*=/m.test(rep),
  'el reporte NO tiene su propia copia de la línea (la importa)',
)
bien(/from '\.\/lib\/lineas-reporte\.mjs'/.test(rep), 'y la importa de ese módulo')

// Y que le PASE el dato: con el módulo bien y la llamada sin el dato, el valor
// por defecto es `false` y la frase mala vuelve.
bien(/haySenales/.test(rep), 'el reporte calcula si hay señales')
bien(/lineaUmbral\(\{[^}]*haySenales/.test(rep), 'y se lo pasa a la línea del umbral')
bien(
  /const haySenales = setups\.length > 0/.test(rep),
  'contándolo de los setups que la propia app propone',
)

// AFIRMA la ausencia sólo cuando no hay nada.
const bajoSin = mod.lineaUmbral({ difMax: 0.2, umbral: 0.5, haySenales: false })
const bajoCon = mod.lineaUmbral({ difMax: 0.2, umbral: 0.5, haySenales: true })
bien(/no propone ninguna señal/.test(bajoSin), 'sin señales dice que la app no propone nada')
bien(!/no propone ninguna señal/.test(bajoCon), 'CON señales NO afirma que no haya ninguna')
// El HECHO sobrevive en los dos casos: lo que se quita es la conclusión, no el
// dato. Si al arreglar la conclusión se perdieran los números, el reporte
// volvería a ser un hueco.
for (const [txt, caso] of [
  [bajoSin, 'sin señales'],
  [bajoCon, 'con señales'],
]) {
  bien(txt.includes('0.20') && txt.includes('0.50'), `los dos números siguen saliendo (${caso})`)
}

// Con divergencia de sobra no se afirma ninguna ausencia, haya señales o no.
for (const hay of [true, false]) {
  const alto = mod.lineaUmbral({ difMax: 1.4, umbral: 0.5, haySenales: hay })
  bien(!/no propone ninguna señal/.test(alto), `con divergencia alta no afirma ausencia (haySenales=${hay})`)
}

// Ante la duda, nada. Misma asimetría que `difMax` y que `pearson`.
bien(mod.lineaUmbral({ difMax: null, umbral: 0.5 }) === '', 'sin `difMax` no escribe nada')
bien(mod.lineaUmbral({ difMax: 0.2, umbral: NaN }) === '', 'sin umbral tampoco')

// Y la otra línea, SOLO donde esta app apaga un lado. Donde no se apaga nada
// no hay nada que exigir — es la misma condición derivada del bloque 6, no un
// «sáltatelo si no está».
if (estaAppApagaUnLado) {
  bien(typeof mod.lineaBloqueados === 'function', 'la línea de los pares pausados también vive en el módulo')
  const blo = { n: 5, pares: ['EUR/CAD', 'EUR/NZD', 'EUR/CHF', 'USD/CAD', 'EUR/USD'] }
  const pausSin = mod.lineaBloqueados({ bloqueados: blo, haySenales: false })
  const pausCon = mod.lineaBloqueados({ bloqueados: blo, haySenales: true })
  bien(/no propone ninguna señal/.test(pausSin), 'sin señales explica que por eso no hay nada')
  bien(!/no propone ninguna señal/.test(pausCon), 'CON señales NO afirma que no haya ninguna')
  // Los cinco pares se nombran en los dos casos: es el dato por el que existe
  // la línea, y el 2026-10-19 su ausencia hizo leer «el mercado está plano».
  for (const [txt, caso] of [
    [pausSin, 'sin señales'],
    [pausCon, 'con señales'],
  ]) {
    bien(blo.pares.every((p) => txt.includes(p)), `nombra los cinco pares (${caso})`)
    bien(/pausad/.test(txt), `y dice que el motivo es una pausa (${caso})`)
  }
  bien(mod.lineaBloqueados({ bloqueados: null }) === '', 'sin pares pausados no escribe nada')
  bien(mod.lineaBloqueados({ bloqueados: { n: 0, pares: [] } }) === '', 'con cero tampoco')
  bien(/lineaBloqueados\(\{[^}]*haySenales/.test(rep), 'y el reporte le pasa si hay señales')
} else {
  bien(true, 'esta app no apaga ningún lado: no hay segunda línea que exigir')
}

console.log('')
console.log(`${ok} bien · ${mal} MAL`)
if (mal) process.exit(1)
