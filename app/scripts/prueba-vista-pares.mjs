// ¿FILTRA DE VERDAD, Y SOLO LO QUE DEBE? Sin internet.
//
// Correr con: node scripts/prueba-vista-pares.mjs
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
// ─────────────────────────────────────────────────────────────────────────
// La tarjeta «Mis pares» decía desde el primer día que «los avisos y el
// tablero se quedan solo con ésos». Era FALSO: la función que filtraba estaba
// escrita y probada, y no la llamaba nadie. Néstor eligió tres pares, abrió el
// tablero y vio los catorce.
//
// Así que lo que hay que vigilar no es solo que la matemática del filtro esté
// bien —eso era lo único que estaba bien— sino las DOS cosas que fallaron:
//
//   1. que lo que NO debe filtrarse siga entero (el ranking de fuerza, sobre
//      todo: recortado cambiaría de valor y dejaría de medir lo que dice);
//   2. que el filtro ESTÉ ENCHUFADO a la pantalla. Eso lo comprueba el
//      bloque 7 de `prueba-cableado.mjs`, que es quien lee `App.jsx`.

import {
  MODO_MIS,
  MODO_TODOS,
  LISTAS_POR_PAR,
  LISTAS_POR_PAREJA,
  NO_SE_FILTRAN,
  decidirModo,
  filasDeMisPares,
  filtrarMercado,
  parejasDeMisPares,
  paresDeLaLista,
  resumenVista,
} from '../src/lib/vistaPares.js'

let mal = 0
const comprobar = (que, cond) => {
  console.log(`${cond ? '  OK  ' : '  MAL '} ${que}`)
  if (!cond) mal++
}

const par = (name) => ({ name, algo: 1 })
const MERCADO = {
  monedas: [{ c: 'EUR', v: 10 }, { c: 'USD', v: 0 }],
  pares: [par('EUR/USD'), par('GBP/USD'), par('USD/JPY'), par('NZD/CAD')],
  compras: [par('EUR/USD'), par('NZD/CAD')],
  ventas: [par('USD/JPY')],
  vigilancia: [par('GBP/USD')],
  setups: [{ name: 'EUR/USD', lado: 'COMPRA' }, { name: 'NZD/CAD', lado: 'VENTA' }],
  setupsReversion: [{ name: 'USD/JPY', lado: 'COMPRA' }],
  riesgoSenales: [
    { a: 'EUR/USD', b: 'GBP/USD', r: 0.9 },
    { a: 'EUR/USD', b: 'NZD/CAD', r: 0.8 },
  ],
  correlaciones: [{ a: 'EUR/USD', b: 'NZD/CAD', r: 0.8 }],
  compresionPares: [par('EUR/USD'), par('NZD/CAD')],
  umbral: 0.5,
  difMax: 1.2,
  bloqueados: { n: 3, lado: 'VENTA', pares: ['EUR/CAD', 'EUR/NZD', 'NZD/CAD'] },
  corte: '2026-10-31',
  // Lo que trae el hook y no es del mercado: tiene que pasar intacto.
  loading: false,
  error: null,
}

console.log('\n1. La lista se limpia antes de usarse')
comprobar('sin lista → vacía', paresDeLaLista(undefined).length === 0)
comprobar('un número colado no cuenta', paresDeLaLista(['EUR/USD', 7, null]).length === 1)
comprobar('un texto en blanco no cuenta', paresDeLaLista(['EUR/USD', '   ']).length === 1)
comprobar('un par repetido cuenta una vez', paresDeLaLista(['EUR/USD', 'EUR/USD']).length === 1)

console.log('\n2. ⚠️ ANTE LA DUDA SE ENSEÑA TODO — los dos errores no cuestan lo mismo')
comprobar('sin lista → todos', decidirModo(null, []) === MODO_TODOS)
comprobar('sin lista, aunque hubiera elegido «mis» → todos', decidirModo(MODO_MIS, []) === MODO_TODOS)
comprobar('si el teléfono no deja leer → todos', decidirModo(MODO_MIS, ['EUR/USD'], { pudoLeer: false }) === MODO_TODOS)
comprobar('un valor guardado que no se entiende → todos', decidirModo('cualquier cosa', ['EUR/USD']) === MODO_TODOS)
comprobar('guardado «todos» → todos', decidirModo(MODO_TODOS, ['EUR/USD']) === MODO_TODOS)
// ⚠️ LA ÚNICA EXCEPCIÓN, y es deliberada: tener lista y no haber elegido nunca
// NO es duda. Es justo lo que Néstor esperaba que pasara y no pasaba.
comprobar('con lista y sin haber elegido nunca → MIS', decidirModo(null, ['EUR/USD']) === MODO_MIS)
comprobar('guardado «mis» → mis', decidirModo(MODO_MIS, ['EUR/USD']) === MODO_MIS)

console.log('\n3. El filtro de filas')
comprobar('deja solo las elegidas', filasDeMisPares(MERCADO.pares, ['EUR/USD', 'USD/JPY']).length === 2)
comprobar('un par elegido que hoy no existe no inventa filas', filasDeMisPares(MERCADO.pares, ['EUR/XYZ']).length === 0)
comprobar('lo que no es lista se devuelve tal cual', filasDeMisPares(null, ['EUR/USD']) === null)
comprobar('sirve con otro campo', filasDeMisPares([{ par: 'EUR/USD' }], ['EUR/USD'], 'par').length === 1)

console.log('\n4. ⚠️ Las parejas de riesgo piden LOS DOS pares')
// Una fila que nombra un par que no está en pantalla diría «estas dos son la
// misma apuesta» sobre algo que la persona no está mirando.
comprobar('con los dos dentro → se queda', parejasDeMisPares(MERCADO.riesgoSenales, ['EUR/USD', 'GBP/USD']).length === 1)
comprobar('con solo uno dentro → se va', parejasDeMisPares(MERCADO.riesgoSenales, ['EUR/USD']).length === 0)

console.log('\n5. ⚠️⚠️ LO QUE NO SE FILTRA SIGUE ENTERO')
{
  const v = filtrarMercado(MERCADO, ['EUR/USD'], MODO_MIS)
  comprobar('el ranking de fuerza NO se toca', v.monedas === MERCADO.monedas)
  comprobar('la correlación NO se toca', v.correlaciones === MERCADO.correlaciones)
  comprobar('la compresión NO se toca', v.compresionPares === MERCADO.compresionPares)
  comprobar('el umbral del día NO se toca', v.umbral === MERCADO.umbral)
  comprobar('la divergencia máxima NO se toca', v.difMax === MERCADO.difMax)
  comprobar('los bloqueados NO se tocan', v.bloqueados === MERCADO.bloqueados)
  comprobar('lo que no es del mercado pasa intacto', v.loading === false && v.error === null)
  comprobar('y el original no se modifica', MERCADO.pares.length === 4)
}

console.log('\n6. Lo que SÍ se filtra')
{
  const v = filtrarMercado(MERCADO, ['EUR/USD', 'GBP/USD'], MODO_MIS)
  comprobar('la tabla de pares', v.pares.length === 2)
  comprobar('las compras', v.compras.length === 1 && v.compras[0].name === 'EUR/USD')
  comprobar('las ventas (ninguna queda)', v.ventas.length === 0)
  comprobar('la vigilancia', v.vigilancia.length === 1)
  comprobar('las señales de la app', v.setups.length === 1)
  comprobar('las de reversión (ninguna queda)', v.setupsReversion.length === 0)
  comprobar('las parejas de riesgo', v.riesgoSenales.length === 1)
}

console.log('\n7. Con «todos», o sin lista, no se toca NADA')
comprobar('modo todos → el mismo objeto', filtrarMercado(MERCADO, ['EUR/USD'], MODO_TODOS) === MERCADO)
comprobar('lista vacía → el mismo objeto', filtrarMercado(MERCADO, [], MODO_MIS) === MERCADO)
comprobar('sin mercado no revienta', filtrarMercado(null, ['EUR/USD'], MODO_MIS) === null)

console.log('\n8. ⚠️ Una clave que esta app no tiene se salta sola')
// La lista es la unión de las dos apps. `rangos` solo existe en Intradía y
// `riesgoSenales` solo en Swing: la que falte no puede aparecer inventada.
{
  const v = filtrarMercado({ pares: [par('EUR/USD'), par('GBP/USD')] }, ['EUR/USD'], MODO_MIS)
  comprobar('no aparece una clave que no estaba', !('rangos' in v) && !('setupsBollinger' in v))
  comprobar('y lo que sí estaba se filtró', v.pares.length === 1)
}

console.log('\n9. El contador que se ve siempre en pantalla')
{
  const r = resumenVista(MERCADO, ['EUR/USD', 'GBP/USD'], MODO_MIS)
  comprobar('dice cuántos se ven', r.viendo === 2)
  comprobar('…de cuántos hay', r.total === 4)
  comprobar('…y cuántos eligió', r.elegidos === 2)
  comprobar('sabe que está filtrando', r.filtrando === true)

  const t = resumenVista(MERCADO, ['EUR/USD', 'GBP/USD'], MODO_TODOS)
  comprobar('sin filtrar, el contador dice el total', t.viendo === 4 && t.filtrando === false)
  comprobar('…pero sigue sabiendo que hay lista', t.hayLista === true)

  // ⚠️ Una lista que no coincide con ningún par de hoy dejaría la pantalla en
  // blanco sin explicación. Hay que poder avisar en vez de callar.
  const v = resumenVista(MERCADO, ['EUR/XYZ'], MODO_MIS)
  comprobar('una lista que no casa con nada se marca como vacía', v.vacio === true)
  comprobar('y con pares de verdad no se marca', r.vacio === false)
  comprobar('sin mercado no revienta', resumenVista(null, ['EUR/USD'], MODO_MIS).total === 0)
}

console.log('\n10. ⚠️ EL MANIFIESTO NO PUEDE TENER UNA CLAVE EN DOS SITIOS')
{
  const todas = [...LISTAS_POR_PAR, ...LISTAS_POR_PAREJA, ...Object.keys(NO_SE_FILTRAN)]
  comprobar(`hay un manifiesto de verdad (${todas.length} claves)`, todas.length >= 15)
  comprobar('ninguna clave está clasificada dos veces', new Set(todas).size === todas.length)
  // Un motivo vacío sería una clasificación sin clasificar.
  comprobar(
    'cada cosa que no se filtra tiene su motivo escrito',
    Object.values(NO_SE_FILTRAN).every((m) => typeof m === 'string' && m.length > 30),
  )
  comprobar('el ranking de fuerza está entre las que NO se filtran', 'monedas' in NO_SE_FILTRAN)
}

console.log('')
if (mal) {
  console.log(`✗ ${mal} comprobación(es) MAL.\n`)
  process.exit(1)
}
console.log('✓ todo bien.\n')
