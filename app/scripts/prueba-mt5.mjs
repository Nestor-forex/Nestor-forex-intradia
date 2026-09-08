// Comprueba que la app entiende lo que publica el puente de MetaTrader 5.
//
//   node scripts/prueba-mt5.mjs
//
// Sin internet y sin que el puente esté encendido: son comprobaciones sobre el
// texto que llega.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ ESTA PRUEBA SE REESCRIBIÓ EL 2026-09-08 Y NO SE BORRÓ NADA POR GUSTO
// ─────────────────────────────────────────────────────────────────────────
// La versión anterior comprobaba que la app aguantara CUALQUIER forma que se
// le ocurriera devolver a un servidor: la lista pelada, dentro de `quotes`,
// dentro de `data`, con las llaves en mayúscula, con los números como texto,
// con sufijos del bróker en el símbolo… Aquella flexibilidad tenía sentido
// mientras el formato lo decidía un servidor de Python escrito aparte.
//
// Ya no hay servidor. El archivo lo escribe `puente-mt5/bridge_mt5.py`, que
// está en ESTE repositorio, así que el formato es UNO y se decide aquí:
//
//     { actualizadoEl, cuenta, pares: { "EUR/USD": { bid, ask, spread, ticks } } }
//
// Aceptar diez formas de un archivo que escribimos nosotros no es robustez: es
// dejar sin comprobar que el puente escriba lo que dice escribir. Y la limpieza
// de sufijos del bróker no se perdió — se hizo en el puente, que es donde está
// el símbolo crudo de MT5.
//
// Lo que SÍ se conserva, porque sigue valiendo igual:
//   · el spread en PIPS y no en puntos,
//   · el pip distinto en los pares con yen,
//   · y que una fila rota no tumbe a las buenas.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ POR QUÉ ESTA PRUEBA NO ES GEMELA DE LA DE SWING
// ─────────────────────────────────────────────────────────────────────────
// La de Swing tiene un bloque 7 que abre `puente-mt5/bridge_mt5.py` y comprueba
// que la lista de símbolos del puente sea exactamente la que usan las DOS apps
// (los 14 de Swing más los 4 que solo usa Intradía). Aquí no puede estar,
// porque el puente vive en un solo sitio: el repositorio de Swing. Un puente,
// una casa, una comprobación — duplicarla aquí sería comprobar un archivo que
// no está.
//
// Si algún día Intradía cambia sus pares, hay que tocar `SYMBOLS` en el puente
// Y la lista escrita a mano de ese bloque 7. `prueba-gemelos.mjs` no lo caza:
// esto es de las pocas cosas del proyecto que dependen de que alguien se
// acuerde, y por eso queda escrito aquí y en `scripts/gemelos.mjs`.

import { minutosDesde, normalizarRespuesta } from '../src/lib/useMT5Quotes.js'

let fallos = 0
const ok = (cond, que) => {
  console.log(`${cond ? '  ok  ' : ' FALLA'} ${que}`)
  if (!cond) fallos++
}
const casi = (a, b, tol = 1e-6) => Math.abs(a - b) < tol

const archivo = (pares, extra = {}) => ({
  actualizadoEl: '2026-09-08T20:00:00.000Z',
  cuenta: 'AvaTrade (cuenta de Néstor)',
  pares,
  ...extra,
})

console.log('\n1. El formato que escribe el puente')
{
  const r = normalizarRespuesta(
    archivo({
      'EUR/USD': { bid: 1.1547, ask: 1.1548, spread: 1.0 },
      'USD/JPY': { bid: 158.92, ask: 158.93, spread: 1.0 },
    }),
  )
  ok(r['EUR/USD']?.bid === 1.1547, 'lee el precio de compra')
  ok(r['USD/JPY']?.ask === 158.93, 'lee el precio de venta')
  ok(Object.keys(r).length === 2, 'y no se inventa pares de más')
}

console.log('\n2. El spread va en PIPS, no en los «puntos» de MT5')
{
  // ⚠️ MT5 reporta el spread en «puntos», que en un bróker de 5 dígitos son
  // DIEZ VECES un pip. Mezclar las dos unidades haría que 1,2 pips se vieran
  // como 12 — y 12 pips es un spread de bróker abusivo, así que el error no
  // parecería un error: parecería un bróker malo.
  const r = normalizarRespuesta(archivo({ 'EUR/USD': { bid: 1.1547, ask: 1.15482, spread: 12 } }))
  ok(casi(r['EUR/USD'].spread, 1.2), 'sale 1.2 pips aunque el archivo dijera 12')

  const jpy = normalizarRespuesta(archivo({ 'USD/JPY': { bid: 158.92, ask: 158.933 } }))
  ok(casi(jpy['USD/JPY'].spread, 1.3), 'en los pares con yen el pip es 0.01')

  ok(r['EUR/USD'].dec === 5 && jpy['USD/JPY'].dec === 3, 'decimales: 5 normal, 3 con yen')

  // Si algún día el puente dejara de mandar bid/ask y solo mandara `spread`,
  // ese par se descarta: sin los dos precios no se puede comprobar el número,
  // y un spread sin nada con qué contrastarlo es justo lo que no queremos.
  const soloSpread = normalizarRespuesta(archivo({ 'EUR/USD': { spread: 1.2 } }))
  ok(Object.keys(soloSpread).length === 0, 'sin bid ni ask se descarta el par')
}

console.log('\n3. El tick volume: se lee, y se sabe cuándo NO está')
{
  const con = normalizarRespuesta(archivo({ 'EUR/USD': { bid: 1.1547, ask: 1.1548, ticks: 48213 } }))
  ok(con['EUR/USD'].ticks === 48213, 'se lee cuando viene')

  // ⚠️ `null` y no 0. Un 0 diría «no se movió el precio en todo el día», que
  // es falso y encima es un dato que alguien podría usar. «No lo sé» y «no
  // pasó nada» no son lo mismo — la misma regla que en la correlación.
  const sin = normalizarRespuesta(archivo({ 'EUR/USD': { bid: 1.1547, ask: 1.1548 } }))
  ok(sin['EUR/USD'].ticks === null, 'cuando no viene → null, NUNCA 0')
}

console.log('\n4. Basura: nunca revienta, solo ignora lo que no sirve')
{
  ok(Object.keys(normalizarRespuesta(null)).length === 0, 'nada')
  ok(Object.keys(normalizarRespuesta({})).length === 0, 'objeto vacío')
  ok(Object.keys(normalizarRespuesta('no soy json')).length === 0, 'texto suelto')
  ok(Object.keys(normalizarRespuesta({ pares: 'x' })).length === 0, '`pares` que no es un objeto')
  ok(Object.keys(normalizarRespuesta(archivo({ 'EUR/USD': null }))).length === 0, 'un par nulo')
  ok(
    Object.keys(normalizarRespuesta(archivo({ 'EUR/USD': { bid: 'x', ask: 'y' } }))).length === 0,
    'precios que no son números',
  )

  const mezcla = normalizarRespuesta(
    archivo({
      'EUR/USD': { bid: 1.1547, ask: 1.1548 },
      'ROTO': { bid: 'x' },
      'USD/JPY': { bid: 158.92, ask: 158.93 },
    }),
  )
  ok(Object.keys(mezcla).length === 2, 'una fila rota no tumba a las buenas')
}

console.log('\n5. Cuándo se tomó la foto')
{
  // Sin esto un número viejo se lee como «ahora mismo». El puente solo publica
  // mientras el computador de Néstor está encendido, así que fuera de su
  // horario lo normal es que la foto tenga horas.
  const ahora = new Date('2026-09-08T20:00:00Z')
  ok(minutosDesde('2026-09-08T19:30:00Z', ahora) === 30, 'media hora → 30 minutos')
  ok(minutosDesde('2026-09-08T20:00:00Z', ahora) === 0, 'recién tomada → 0')
  // Un reloj adelantado no puede dar minutos negativos: se leería como
  // «dentro de -5 minutos», que no significa nada.
  ok(minutosDesde('2026-09-08T20:05:00Z', ahora) === 0, 'del futuro → 0, nunca negativo')
  ok(minutosDesde('ayer', ahora) === null, 'fecha ilegible → null')
  ok(minutosDesde(null, ahora) === null, 'sin fecha → null')
}

console.log('\n6. De quién es la cuenta: el archivo lo dice, la app no lo supone')
{
  // ⚠️ Es el spread de la cuenta de Néstor en AvaTrade, NO el del suscriptor.
  // El dato viaja DENTRO del archivo para que la pantalla no tenga que
  // acordarse, y para que el día que el puente lo publique otra persona el
  // rótulo cambie solo.
  const cal = archivo({ 'EUR/USD': { bid: 1.1547, ask: 1.1548 } })
  ok(typeof cal.cuenta === 'string' && cal.cuenta.length > 0, 'el archivo trae `cuenta`')
}

console.log(fallos ? `\n${fallos} comprobación(es) fallaron.` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
