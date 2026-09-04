// Prueba del lector de informes del bróker. Sin internet:
//
//     node scripts/prueba-importar.mjs
//
// LO QUE MÁS IMPORTA AQUÍ, Y POR QUÉ
// ----------------------------------
// Este código toca el dinero que Néstor ve en pantalla. Un error aquí no da un
// mensaje rojo: da un Diario con números creíbles y equivocados, que es mucho
// peor. Las tres trampas que más probable es que muerdan:
//
//  1. EL IDIOMA. MetaTrader traduce sus informes. El de Néstor dice «Símbolo»,
//     «Beneficio» y «Compra»; el manual en inglés dice «Symbol», «Profit» y
//     «Buy». Buscar las columnas por posición fija habría funcionado en la
//     máquina de quien programa y fallado en la suya.
//
//  2. LOS NÚMEROS. «1.234,56» y «1,234.56» son el mismo número escrito por dos
//     configuraciones regionales. Leer uno como el otro cambia el resultado por
//     mil.
//
//  3. LOS DUPLICADOS. Lo natural es exportar el historial ENTERO cada vez. Sin
//     protección, la segunda importación duplica la primera y las estadísticas
//     salen al doble sin que nada avise.

import { leerOperaciones, aNumero, normalizarPar, quitarRepetidas } from '../src/lib/importarOperaciones.js'
import { PAIR_NAMES } from '../src/lib/pairs.js'

let fallos = 0
const comprobar = (bien, que) => {
  console.log(`  ${bien ? '✓' : '✗'} ${que}`)
  if (!bien) fallos++
}

// ------------------------------------------------------------------- números

console.log('\nLeer números escritos como los escribe cada país')
{
  comprobar(aNumero('1234.56') === 1234.56, 'sin separador de miles')
  comprobar(aNumero('1,234.56') === 1234.56, 'coma de miles y punto decimal (inglés)')
  comprobar(aNumero('1.234,56') === 1234.56, 'punto de miles y coma decimal (español)')
  comprobar(aNumero('-25,30') === -25.3, 'negativo con coma decimal')
  comprobar(aNumero('12,5') === 12.5, 'una coma con 1 cifra detrás es decimal')
  comprobar(aNumero('1,234') === 1234, 'una coma con 3 cifras detrás es de miles')
  comprobar(aNumero('(25.30)') === -25.3, 'paréntesis = negativo, como en algunos informes')
  comprobar(aNumero('$ 1 234.56') === 1234.56, 'con símbolo de moneda y espacios')
  comprobar(aNumero('') === null && aNumero('—') === null, 'vacío o guión es null, no 0')
  // Que devuelva null y no 0 importa: 0 es un resultado real (una operación
  // que salió en tablas) y null es "no había dato". Confundirlos metería
  // ceros falsos en las estadísticas.
  comprobar(aNumero('0') === 0, 'pero un cero escrito SÍ es cero')
}

// ------------------------------------------------------------------ símbolos

console.log('\nReconocer el par bajo los sufijos que le pone cada bróker')
{
  comprobar(normalizarPar('EURUSD', PAIR_NAMES) === 'EUR/USD', 'EURUSD')
  comprobar(normalizarPar('EURUSD.m', PAIR_NAMES) === 'EUR/USD', 'EURUSD.m')
  comprobar(normalizarPar('eurusd-pro', PAIR_NAMES) === 'EUR/USD', 'eurusd-pro en minúsculas')
  comprobar(normalizarPar('EUR/USD', PAIR_NAMES) === 'EUR/USD', 'ya con barra')
  comprobar(normalizarPar('GBP/JPY', PAIR_NAMES) === 'GBP/JPY', 'un cruce con yen')
  comprobar(normalizarPar('XAUUSD', PAIR_NAMES) === null, 'el oro se rechaza: la app no lo analiza')
  comprobar(normalizarPar('US30', PAIR_NAMES) === null, 'un índice también')
  comprobar(normalizarPar('', PAIR_NAMES) === null && normalizarPar(null, PAIR_NAMES) === null, 'vacío o nulo')
}

// -------------------------------------------------------------- informe MT4

// Un informe de MT4 abreviado pero con su forma real: filas de título antes de
// la tabla, la cabecera en inglés, y una fila de «balance» al final que NO es
// una operación.
const MT4 = `<html><body>
<table>
<tr><td colspan="14"><b>Cuenta: 123456</b></td></tr>
<tr><td colspan="14">Informe detallado</td></tr>
<tr align=center bgcolor="#C0C0C0">
  <td>Ticket</td><td>Open Time</td><td>Type</td><td>Size</td><td>Item</td>
  <td>Price</td><td>S / L</td><td>T / P</td><td>Close Time</td><td>Price</td>
  <td>Commission</td><td>Taxes</td><td>Swap</td><td>Profit</td>
</tr>
<tr><td>101</td><td>2026.08.03 09:15:00</td><td>buy</td><td>0.10</td><td>eurusd</td>
    <td>1.1600</td><td>1.1550</td><td>1.1700</td><td>2026.08.05 14:02:00</td><td>1.1680</td>
    <td>-1.20</td><td>0.00</td><td>-2.50</td><td>80.00</td></tr>
<tr><td>102</td><td>2026.08.06 10:00:00</td><td>sell</td><td>0.20</td><td>GBPJPY.m</td>
    <td>195.20</td><td>196.00</td><td>194.00</td><td>2026.08.06 18:30:00</td><td>195.90</td>
    <td>-2.40</td><td>0.00</td><td>0.00</td><td>-140.00</td></tr>
<tr><td>103</td><td>2026.08.07 08:00:00</td><td>buy</td><td>0.05</td><td>XAUUSD</td>
    <td>2400</td><td>2380</td><td>2450</td><td>2026.08.07 19:00:00</td><td>2430</td>
    <td>-0.50</td><td>0.00</td><td>0.00</td><td>150.00</td></tr>
<tr><td>104</td><td>2026.08.08 00:00:00</td><td>balance</td><td></td><td>Deposit</td>
    <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td>500.00</td></tr>
</table></body></html>`

console.log('\nInforme de MT4 en inglés')
{
  const r = leerOperaciones(MT4, PAIR_NAMES)
  comprobar(r.operaciones.length === 2, `salen 2 operaciones aprovechables (${r.operaciones.length})`)

  const [a, b] = r.operaciones
  comprobar(a.par === 'EUR/USD' && a.dir === 'Compra', 'la primera es una compra de EUR/USD')
  comprobar(a.lote === 0.1, 'con su lote de 0.10')
  // 80.00 de beneficio − 2.50 de swap − 1.20 de comisión = 76.30.
  comprobar(a.pl === 76.3, `y el resultado NETO, con swap y comisión: ${a.pl} (no 80)`)
  comprobar(a.fecha === '2026-08-05', 'fechada el día que se CERRÓ, no el que se abrió')
  comprobar(a.estado === 'cerrada', 'y entra como cerrada')

  comprobar(b.par === 'GBP/JPY' && b.dir === 'Venta', 'la segunda es una venta de GBP/JPY (sufijo .m quitado)')
  comprobar(b.pl === -142.4, `perdedora, también neta: ${b.pl}`)

  comprobar(
    !r.operaciones.some((o) => o.par === null),
    'el oro no se coló'
  )
  comprobar(
    r.avisos.some((x) => x.codigo === 'saltadasPorPar' && x.n === 1),
    'y se avisa de que se saltó 1, en vez de tragárselo en silencio'
  )
  comprobar(
    !r.operaciones.some((o) => o.pl === 500),
    'el depósito de 500 no entró como operación ganadora'
  )
}

// -------------------------------------------------------------- informe MT5

// MT5 en ESPAÑOL, con separador decimal de coma y la cabecera traducida. Es el
// caso que de verdad le va a tocar a Néstor.
const MT5_ES = `<html><body><table>
<tr><th colspan="13">Posiciones</th></tr>
<tr><th>Hora</th><th>Posición</th><th>Símbolo</th><th>Tipo</th><th>Volumen</th>
    <th>Precio</th><th>S / L</th><th>T / P</th><th>Hora</th><th>Precio</th>
    <th>Comisión</th><th>Swap</th><th>Beneficio</th></tr>
<tr><td>2026.08.10 07:00:00</td><td>555</td><td>USDJPY</td><td>compra</td><td>0,30</td>
    <td>150,10</td><td>149,50</td><td>151,00</td><td>2026.08.12 12:00:00</td><td>150,80</td>
    <td>-3,60</td><td>-5,20</td><td>1.240,50</td></tr>
<tr><td>2026.08.13 07:00:00</td><td>556</td><td>NZDCAD</td><td>venta</td><td>0,15</td>
    <td>0,8100</td><td>0,8150</td><td>0,8000</td><td>2026.08.14 16:00:00</td><td>0,8130</td>
    <td>-1,80</td><td>0,00</td><td>-45,00</td></tr>
</table></body></html>`

console.log('\nInforme de MT5 en español (columnas y números traducidos)')
{
  const r = leerOperaciones(MT5_ES, PAIR_NAMES)
  comprobar(r.operaciones.length === 2, `salen las 2 operaciones (${r.operaciones.length})`)
  const [a, b] = r.operaciones
  comprobar(a.par === 'USD/JPY' && a.dir === 'Compra', '«compra» se entiende igual que «buy»')
  comprobar(a.lote === 0.3, 'el volumen «0,30» se lee como 0.3, no como 30')
  // 1.240,50 − 5,20 − 3,60 = 1231,70. Si «1.240,50» se leyera al modo inglés
  // saldría 1,24 y el error pasaría desapercibido por ser un número creíble.
  comprobar(a.pl === 1231.7, `y «1.240,50» son mil doscientos, no uno con veinticuatro: ${a.pl}`)
  comprobar(a.fecha === '2026-08-12', 'toma la SEGUNDA columna «Hora», la del cierre')
  comprobar(b.par === 'NZD/CAD' && b.dir === 'Venta' && b.pl === -46.8, 'la venta de NZD/CAD sale neta también')
}

// ---------------------------------------------------------------------- CSV

console.log('\nCSV genérico, con punto y coma y campos entrecomillados')
{
  const csv = [
    'Ticket;Close Time;Symbol;Type;Lots;Commission;Swap;Profit',
    '900;2026-09-01;EURUSD;Buy;0,50;-2,00;-1,00;"120,00"',
    '901;2026-09-02;EURCHF;Sell;0,25;-1,00;0,00;"-30,00"',
  ].join('\n')
  const r = leerOperaciones(csv, PAIR_NAMES)
  comprobar(r.operaciones.length === 2, `lee las 2 filas (${r.operaciones.length})`)
  comprobar(r.operaciones[0].pl === 117, `neto de la primera: ${r.operaciones[0].pl}`)
  comprobar(r.operaciones[1].par === 'EUR/CHF', 'y reconoce el cruce EUR/CHF')
}

console.log('\nCSV separado por comas, para que el separador se deduzca solo')
{
  const csv = [
    'Ticket,Close Time,Symbol,Type,Lots,Profit',
    '910,2026.09.03,GBPUSD,sell,1.00,-55.25',
  ].join('\n')
  const r = leerOperaciones(csv, PAIR_NAMES)
  comprobar(r.operaciones.length === 1 && r.operaciones[0].pl === -55.25, 'una venta de GBP/USD con −55.25')
}

// -------------------------------------------------------------- archivos malos

console.log('\nArchivos que no sirven: fallan claro, no en silencio')
{
  const vacio = leerOperaciones('', PAIR_NAMES)
  comprobar(vacio.operaciones.length === 0 && vacio.avisos.length > 0, 'archivo vacío avisa')

  const basura = leerOperaciones('esto no es un informe de nada', PAIR_NAMES)
  comprobar(basura.operaciones.length === 0 && basura.avisos.length > 0, 'texto cualquiera avisa')
  comprobar(
    basura.avisos.some((x) => x.codigo === 'sinColumnas'),
    'y el aviso dice QUÉ falta, no solo que falló'
  )

  const sinBeneficio = leerOperaciones(
    'Symbol,Type,Lots\nEURUSD,buy,0.10',
    PAIR_NAMES
  )
  comprobar(
    sinBeneficio.operaciones.length === 1 && sinBeneficio.operaciones[0].pl === 0,
    'sin columna de resultado la operación entra con 0…'
  )
  comprobar(
    sinBeneficio.avisos.some((x) => x.codigo === 'sinResultado'),
    '…pero avisando de que ese 0 no es un resultado real'
  )
}

// ------------------------------------------------------------------ duplicados

console.log('\nSubir dos veces el mismo informe no duplica nada')
{
  const primera = leerOperaciones(MT4, PAIR_NAMES).operaciones
  const guardadas = quitarRepetidas(primera, [])
  comprobar(guardadas.length === 2, 'la primera vez entran las 2')

  const segunda = leerOperaciones(MT4, PAIR_NAMES).operaciones
  const nuevas = quitarRepetidas(segunda, guardadas)
  comprobar(nuevas.length === 0, 'la segunda vez no entra ninguna')

  // Y un informe que trae lo de antes MÁS una nueva: tiene que entrar solo la
  // nueva. Es el caso real, porque MetaTrader exporta el historial completo.
  const conUnaMas = MT4.replace(
    '</table>',
    `<tr><td>105</td><td>2026.08.20 09:00:00</td><td>sell</td><td>0.10</td><td>NZDCHF</td>
     <td>0.52</td><td>0.53</td><td>0.51</td><td>2026.08.21 09:00:00</td><td>0.515</td>
     <td>-1.00</td><td>0.00</td><td>0.00</td><td>45.00</td></tr></table>`
  )
  const terceras = quitarRepetidas(leerOperaciones(conUnaMas, PAIR_NAMES).operaciones, guardadas)
  comprobar(terceras.length === 1 && terceras[0].par === 'NZD/CHF', 'y de un informe ampliado entra solo la nueva')
}

console.log('\nLos avisos salen como códigos, no como frases en español')
{
  // Si volvieran a ser frases, quedarían sin traducir en una app de 13
  // idiomas y nadie se daría cuenta hasta que alguien la abriera en otro.
  const todos = [
    ...leerOperaciones('', PAIR_NAMES).avisos,
    ...leerOperaciones('no soy un informe', PAIR_NAMES).avisos,
    ...leerOperaciones(MT4, PAIR_NAMES).avisos,
  ]
  comprobar(todos.length > 0, `salen ${todos.length} avisos entre los tres casos`)
  comprobar(
    todos.every((a) => a && typeof a === 'object' && typeof a.codigo === 'string'),
    'y todos son { codigo, … }, ninguno un texto suelto'
  )
}

console.log('\nEl mismo archivo leído dos veces da exactamente lo mismo')
{
  // Suena obvio y no lo es: si el lector dependiera del orden de un Set o de
  // la fecha de hoy en algún camino, dos lecturas seguidas podrían diferir y
  // el borrado de duplicados dejaría de funcionar.
  const a = JSON.stringify(leerOperaciones(MT5_ES, PAIR_NAMES).operaciones)
  const b = JSON.stringify(leerOperaciones(MT5_ES, PAIR_NAMES).operaciones)
  comprobar(a === b, 'lectura determinista')
}

console.log(fallos ? `\n✗ ${fallos} comprobaciones fallaron\n` : '\n✓ todo bien\n')
process.exit(fallos ? 1 : 0)
