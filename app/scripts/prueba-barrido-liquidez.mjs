// Prueba del barrido de liquidez. Sin internet:
//
//     node scripts/prueba-barrido-liquidez.mjs
//
// QUÉ SE COMPRUEBA Y POR QUÉ IMPORTA
// ----------------------------------
// El barrido de liquidez es un patrón de tres condiciones que se pisan
// fácilmente entre sí: perforar un extremo ANTERIOR, y cerrar de vuelta
// DENTRO. Los tres errores probables no dan ningún mensaje rojo:
//
//  1. INCLUIR EL DÍA DE HOY entre los extremos previos. El mínimo de hoy se
//     compararía consigo mismo y NUNCA daría señal. La tabla saldría con cero
//     operaciones y parecería que "el patrón no ocurre", cuando en realidad no
//     se estaría midiendo nada.
//
//  2. CONFUNDIR EL BARRIDO CON SU CONTROL. Los dos perforan el mismo nivel; solo
//     cambia dónde cierran. Si la condición del cierre estuviera al revés, la
//     tabla mediría el rompimiento creyendo medir el barrido — y el CONTROL,
//     que existe justo para distinguirlos, daría exactamente lo mismo sin que
//     eso significara nada.
//
//  3. NO SER SIMÉTRICO. Si solo mirara el lado de las compras, la tabla
//     parecería una mejora cuando sería "la app opera menos ventas". Es el
//     error del ADX otra vez.
//
// Se prueba con velas escritas A MANO, donde se sabe de antemano la respuesta.
// Un mercado generado al azar aquí no serviría: no se podría afirmar cuál es
// el resultado correcto.

import { barridoDeLiquidez } from './lib/patrones.mjs'

let fallos = 0
const comprobar = (bien, que) => {
  console.log(`  ${bien ? '✓' : '✗'} ${que}`)
  if (!bien) fallos++
}

// Un par de mentira: solo hacen falta las series y el cierre de hoy.
const par = (highs, lows, c) => ({ highs, lows, c })

console.log('\nEl barrido de compra: perfora el suelo y cierra por encima')
{
  // Tres días previos con mínimo en 10. Hoy baja a 9 (perfora) y cierra en 11.
  const p = par([12, 12, 12, 12], [10, 11, 10, 9], 11)
  comprobar(barridoDeLiquidez(p, 3, 'COMPRA'), 'perforó 10, cerró en 11 → SÍ es barrido')

  // Mismo pinchazo pero cierra ABAJO: eso es un rompimiento, no un barrido.
  const roto = par([12, 12, 12, 12], [10, 11, 10, 9], 9.5)
  comprobar(!barridoDeLiquidez(roto, 3, 'COMPRA'), 'si cierra en 9.5 (fuera) NO es barrido')
  comprobar(
    barridoDeLiquidez(roto, 3, 'COMPRA', false),
    '…y ese mismo caso SÍ es el control (cierra fuera, sigue cayendo)'
  )

  // Sin perforar no hay nada, cierre donde cierre.
  const sinTocar = par([12, 12, 12, 12], [10, 11, 10, 10.5], 11)
  comprobar(!barridoDeLiquidez(sinTocar, 3, 'COMPRA'), 'sin perforar no hay barrido')
  comprobar(
    !barridoDeLiquidez(sinTocar, 3, 'COMPRA', false),
    'ni el control: los dos exigen perforar primero'
  )
}

console.log('\nEl barrido de venta es el espejo exacto')
{
  // Tres días previos con máximo en 20. Hoy sube a 21 y cierra en 19.
  const p = par([20, 19, 20, 21], [15, 15, 15, 15], 19)
  comprobar(barridoDeLiquidez(p, 3, 'VENTA'), 'perforó 20 por arriba, cerró en 19 → SÍ')

  const roto = par([20, 19, 20, 21], [15, 15, 15, 15], 20.5)
  comprobar(!barridoDeLiquidez(roto, 3, 'VENTA'), 'si cierra en 20.5 (fuera) NO es barrido')
  comprobar(barridoDeLiquidez(roto, 3, 'VENTA', false), '…y sí es el control')
}

console.log('\nEl nivel sale de los días ANTERIORES, no incluye hoy')
{
  // Éste es el error que dejaría la tabla en cero sin avisar. El mínimo de hoy
  // (9) es el más bajo de toda la serie; si entrara en el cálculo del suelo,
  // "9 < 9" sería falso y no habría señal nunca.
  const p = par([12, 12, 12, 12], [10, 11, 10, 9], 11)
  const suelosPrevios = [10, 11, 10] // los tres de antes de hoy
  comprobar(
    Math.min(...p.lows.slice(-4, -1)) === Math.min(...suelosPrevios),
    'los extremos previos excluyen el día de hoy'
  )
  comprobar(barridoDeLiquidez(p, 3, 'COMPRA'), 'y por eso el patrón sí se detecta')

  // Con la serie justa (n+1 valores) tiene que funcionar igual.
  const justo = par([12, 12], [10, 9], 11)
  comprobar(barridoDeLiquidez(justo, 1, 'COMPRA'), 'con n=1 (el mínimo de AYER) también')
}

console.log('\nSin historia suficiente dice que no, en vez de romperse')
{
  comprobar(barridoDeLiquidez(par([12], [10], 11), 3, 'COMPRA') === false, 'serie más corta que n+1')
  comprobar(barridoDeLiquidez(par([], [], 11), 1, 'COMPRA') === false, 'series vacías')
  comprobar(barridoDeLiquidez({ c: 11 }, 1, 'COMPRA') === false, 'sin series (undefined)')
}

console.log('\nEs simétrico: los dos lados se detectan igual de bien')
{
  // El mismo mercado espejado tiene que dar el mismo número de detecciones por
  // cada lado. Si saliera distinto, la función miraría un lado con más
  // exigencia que el otro.
  const compras = [
    par([12, 12, 12, 12], [10, 11, 10, 9], 11),
    par([20, 20, 20, 20], [18, 19, 18, 17], 19),
  ].filter((p) => barridoDeLiquidez(p, 3, 'COMPRA')).length

  const ventas = [
    par([12, 11, 12, 13], [10, 10, 10, 10], 11),
    par([20, 19, 20, 21], [18, 18, 18, 18], 19),
  ].filter((p) => barridoDeLiquidez(p, 3, 'VENTA')).length

  comprobar(compras === 2 && ventas === 2, `detecta los 2 de compra y los 2 de venta (${compras}/${ventas})`)
}

console.log('\nEl barrido y su control NUNCA son ciertos a la vez')
{
  // Es lo que hace que el control valga: son la misma perforación con
  // desenlaces que se excluyen. Si pudieran coincidir, comparar sus
  // resultados no distinguiría nada.
  const casos = [
    par([12, 12, 12, 12], [10, 11, 10, 9], 11),
    par([12, 12, 12, 12], [10, 11, 10, 9], 9.5),
    par([20, 19, 20, 21], [15, 15, 15, 15], 19),
    par([20, 19, 20, 21], [15, 15, 15, 15], 20.5),
    par([12, 12, 12, 12], [10, 11, 10, 10.5], 11),
  ]
  let choques = 0
  for (const p of casos) {
    for (const lado of ['COMPRA', 'VENTA']) {
      if (barridoDeLiquidez(p, 3, lado, true) && barridoDeLiquidez(p, 3, lado, false)) choques++
    }
  }
  comprobar(choques === 0, 'ningún caso es barrido Y control al mismo tiempo')
}

console.log(fallos ? `\n✗ ${fallos} comprobaciones fallaron\n` : '\n✓ todo bien\n')
process.exit(fallos ? 1 : 0)
