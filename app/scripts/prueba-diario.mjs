// Comprobaciones del Diario: el diagnóstico propio y el retiro de miembros.
// SIN INTERNET.
//
//     node scripts/prueba-diario.mjs
//
// Dos cosas que no se parecen en nada pero comparten la misma pregunta: **que
// el historial del usuario no se pierda ni se lea mal.**

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  MINIMO_PARA_ENSEÑAR,
  diagnostico,
  esConDolar,
  esCruce,
  lotes,
  margen,
  porDireccion,
  porPar,
  porTipoDePar,
  resumir,
} from '../src/lib/diagnostico.js'

let hechas = 0
let fallos = 0
const ok = (cond, que) => {
  hechas++
  if (cond) return true
  fallos++
  console.error(`  ✗ ${que}`)
  return false
}

const op = (par, dir, pl, extra = {}) => ({ par, dir, pl, lote: 0.1, estado: 'cerrada', ...extra })

console.log('1. Cruce o par con dólar')
{
  ok(esCruce('EUR/CHF'), 'EUR/CHF es cruce')
  ok(esCruce('GBP/JPY'), 'GBP/JPY es cruce')
  ok(!esCruce('EUR/USD'), 'EUR/USD NO es cruce')
  ok(!esCruce('USD/JPY'), 'USD/JPY NO es cruce — el dólar delante cuenta igual')

  // ⚠️ Lo que no es un par no es NINGUNA de las dos cosas. Si «con dólar»
  // fuera «todo lo que no es cruce», la basura caería ahí en silencio.
  ok(!esCruce(null) && !esConDolar(null), 'null no es ni cruce ni con dólar')
  ok(!esCruce('XAUUSD') && !esConDolar('XAUUSD'), 'un símbolo sin barra no es ninguna de las dos')
  ok(!esCruce('EUR/USD/JPY') && !esConDolar('EUR/USD/JPY'), 'tres partes tampoco')
}

console.log('2. ⚠️ El margen: cada porcentaje tiene que llevarlo al lado')
{
  // Los números de la cabecera, comprobados. Si alguien cambia la fórmula,
  // esto lo canta.
  ok(margen(10) === 31, `con 10 operaciones el margen es ±31 y salió ±${margen(10)}`)
  ok(margen(25) === 20, `con 25 es ±20 y salió ±${margen(25)}`)
  ok(margen(100) === 10, `con 100 es ±10 y salió ±${margen(100)}`)
  ok(margen(400) === 5, `con 400 es ±5 y salió ±${margen(400)}`)

  // ⚠️ Cero operaciones NO es margen cero. Un 0 diría «este número es exacto».
  ok(margen(0) === null, 'con 0 operaciones el margen es null, NO 0')
  ok(margen(-3) === null, 'un número imposible da null')
  ok(margen('muchas') === null, 'texto da null sin reventar')

  // Y el margen SIEMPRE baja al crecer la muestra: si no, no es un margen.
  ok(margen(50) > margen(200), 'más operaciones, menos margen')
}

console.log('3. Resumir cuenta solo las CERRADAS')
{
  const r = resumir([
    op('EUR/USD', 'Compra', 10),
    op('EUR/USD', 'Compra', -5),
    { par: 'GBP/USD', dir: 'Venta', lote: 0.1, estado: 'abierta' },
  ])
  ok(r.n === 2, `dos cerradas de tres, salieron ${r.n}`)
  ok(r.ganadas === 1, 'una ganada')
  ok(Math.abs(r.pct - 50) < 0.001, `50 % y salió ${r.pct}`)
  ok(Math.abs(r.neto - 5) < 0.001, `neto +5 y salió ${r.neto}`)

  // ⚠️ Una abierta NO cuenta como 0. Contarla diría «ni ganó ni perdió»
  // cuando lo que pasa es que todavía no se sabe.
  const soloAbiertas = resumir([{ par: 'EUR/USD', dir: 'Compra', estado: 'abierta' }])
  ok(soloAbiertas.n === 0, 'solo abiertas: n = 0')
  ok(soloAbiertas.pct === null, 'y el porcentaje es null, no 0')
  ok(soloAbiertas.margen === null, 'y el margen también')

  ok(resumir(null).n === 0, 'null no revienta')
  ok(resumir([]).pct === null, 'lista vacía da porcentaje null')

  // Una operación cerrada sin resultado numérico no es cerrada para esto.
  ok(resumir([{ par: 'EUR/USD', dir: 'Compra', estado: 'cerrada' }]).n === 0, 'cerrada sin `pl` no cuenta')
}

console.log('4. Los tres cortes')
{
  const trades = [
    op('EUR/USD', 'Compra', 10),
    op('EUR/USD', 'Venta', -4),
    op('EUR/CHF', 'Compra', -6),
    op('GBP/JPY', 'Venta', 8),
  ]

  const tipo = porTipoDePar(trades)
  const cruces = tipo.find((g) => g.clave === 'cruces')
  const dolar = tipo.find((g) => g.clave === 'dolar')
  ok(cruces.n === 2, `dos cruces, salieron ${cruces.n}`)
  ok(dolar.n === 2, `dos con dólar, salieron ${dolar.n}`)
  ok(cruces.n + dolar.n === 4, 'los dos grupos suman el total: ninguna operación se pierde ni se cuenta dos veces')

  // Y una operación con un `par` que no es un par no entra en ninguno.
  const conBasura = porTipoDePar([...trades, op('LO-QUE-SEA', 'Compra', 99)])
  ok(
    conBasura.find((g) => g.clave === 'cruces').n + conBasura.find((g) => g.clave === 'dolar').n === 4,
    'un par ilegible NO se cuela en ninguno de los dos grupos',
  )

  const dirs = porDireccion(trades)
  ok(dirs.find((g) => g.clave === 'Compra').n === 2, 'dos compras')
  ok(dirs.find((g) => g.clave === 'Venta').n === 2, 'dos ventas')

  // ⚠️ Los grupos vacíos SIGUEN saliendo, con n = 0. Quitarlos dejaría en
  // pantalla solo los que parecen decir algo.
  const soloCompras = porDireccion([op('EUR/USD', 'Compra', 1)])
  ok(soloCompras.length === 2, 'siguen saliendo los dos grupos')
  ok(soloCompras.find((g) => g.clave === 'Venta').n === 0, 'el vacío sale con n = 0, no desaparece')
}

console.log('5. ⚠️ Por par se ordena por CANTIDAD, nunca por acierto')
{
  // El par con 2 operaciones ganadas tiene 100 % y es el que menos dice. Si
  // se ordenara por acierto saldría el primero.
  const trades = [
    ...Array.from({ length: 12 }, (_, i) => op('EUR/USD', 'Compra', i % 2 ? 5 : -5)),
    ...Array.from({ length: 9 }, () => op('GBP/USD', 'Compra', 7)),
    op('EUR/CHF', 'Compra', 3),
    op('EUR/CHF', 'Compra', 3),
  ]
  const lista = porPar(trades)
  ok(lista[0].clave === 'EUR/USD', `el de más operaciones va primero y salió ${lista[0]?.clave}`)
  ok(lista[1].clave === 'GBP/USD', 'el segundo también por cantidad')
  ok(lista.every((g) => g.n >= MINIMO_PARA_ENSEÑAR), 'los que no llegan al mínimo no salen')
  ok(!lista.some((g) => g.clave === 'EUR/CHF'), 'EUR/CHF con 2 operaciones y 100 % NO aparece')

  // Y el mínimo se puede subir, por si algún día se decide ser más estricto.
  ok(porPar(trades, 10).length === 1, 'con el mínimo en 10 solo queda uno')
}

console.log('6. El lote es CONTEXTO, no un consejo')
{
  const l = lotes([op('EUR/USD', 'Compra', 1, { lote: 0.05 }), op('EUR/USD', 'Compra', 1, { lote: 0.2 }), op('EUR/USD', 'Compra', 1, { lote: 0.05 })])
  ok(l.min === 0.05, 'el menor')
  ok(l.max === 0.2, 'el mayor')
  ok(l.distintos === 2, 'dos tamaños distintos')
  ok(lotes([]) === null, 'sin operaciones devuelve null, no ceros')
  ok(lotes([op('EUR/USD', 'Compra', 1, { lote: 0 })]) === null, 'un lote de 0 no cuenta')
}

console.log('7. ⚠️⚠️ NADA DE AQUÍ DA UN CONSEJO')
{
  // Es la misma comprobación que vigila `cot.js`: si alguien añade un campo de
  // veredicto, tiene que venir a borrar esto a mano, o sea a propósito.
  const d = diagnostico([op('EUR/USD', 'Compra', 10), op('EUR/CHF', 'Venta', -3)])
  const texto = JSON.stringify(d).toLowerCase()
  for (const palabra of ['sugerencia', 'sugiere', 'consejo', 'recomend', 'deberias', 'deberías', 'experimento', 'accion', 'acción']) {
    ok(!texto.includes(palabra), `el resultado NO contiene «${palabra}»`)
  }
  ok(!('veredicto' in d) && !('lado' in d), 'no hay veredicto ni lado')

  // Y la forma que la pantalla espera.
  ok(Array.isArray(d.tipoDePar) && Array.isArray(d.direccion) && Array.isArray(d.pares), 'las tres listas están')
  ok(d.total.n === 2, 'el total cuadra')
}

console.log('8. ⚠️ El diario NO se puede quedar encerrado al retirar a alguien')
{
  // Esto NO es una prueba de lógica: lee el archivo como texto. El motivo está
  // en el fallo real que arregla.
  //
  // `retirar` hacía `deleteDoc(users/{uid})`. Firestore **no borra las
  // subcolecciones** al borrar un documento, así que `users/{uid}/trades/*`
  // sobrevivía — pero la regla exige que el documento padre exista y diga
  // «aprobado» para poder leerlo. Resultado: el diario no se borraba, se
  // quedaba ENCERRADO, y readmitir a la persona tampoco lo devolvía.
  //
  // Ahora `retirar` cambia el estado. La persona ve lo mismo que antes (la app
  // ya trataba cualquier estado desconocido como «retirado»), su diario sigue
  // ahí, y readmitirla se lo devuelve entero.
  const crudo = readFileSync(fileURLToPath(new URL('../src/lib/useMembers.js', import.meta.url)), 'utf8')

  // ⚠️ SIN LOS COMENTARIOS. La primera versión de esta comprobación falló
  // contra el arreglo correcto, porque el comentario que explica el fallo
  // NOMBRA `deleteDoc`. Una comprobación que se dispara con la explicación de
  // su propio motivo obligaría a no explicarlo.
  const fuente = crudo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  ok(!/deleteDoc/.test(fuente), '⚠️ `useMembers.js` NO usa deleteDoc fuera de comentarios: borrar la ficha encierra el diario')
  ok(/retirar\s*=\s*\(uid\)\s*=>\s*updateDoc/.test(fuente), '`retirar` usa updateDoc')
  ok(/estado:\s*'retirado'/.test(fuente), "y deja el estado en 'retirado'")
}

console.log('')
if (fallos) {
  console.error(`✗ ${fallos} de ${hechas} comprobaciones fallaron.`)
  process.exit(1)
}
console.log(`✓ todo bien (${hechas} comprobaciones).`)
