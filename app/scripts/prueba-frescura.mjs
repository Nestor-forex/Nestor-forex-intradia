// Prueba de las cuentas de frescura del barrido. Sin internet y sin cuota.
//
// Correr con: node scripts/prueba-frescura.mjs

import { describirEdad, edadEnMinutos } from '../src/lib/frescura.js'

let fallos = 0
const comprobar = (que, cond) => {
  console.log(`${cond ? '  OK  ' : '  MAL '} ${que}`)
  if (!cond) fallos++
}

const AHORA = new Date('2026-10-07T12:00:00Z')
const hace = (min) => new Date(AHORA.getTime() - min * 60000).toISOString()

console.log('\n1. La edad, en el caso normal')
comprobar('recién generado → 0 min', edadEnMinutos(hace(0), AHORA) === 0)
comprobar('hace 7 minutos → 7', edadEnMinutos(hace(7), AHORA) === 7)
comprobar('hace 3 horas → 180', edadEnMinutos(hace(180), AHORA) === 180)
comprobar('hace 8,3 horas (el peor hueco medido) → 498', edadEnMinutos(hace(498), AHORA) === 498)
comprobar('hace dos días → 2880', edadEnMinutos(hace(2880), AHORA) === 2880)

console.log('\n2. ⚠️ Lo que no se puede saber devuelve null, NUNCA 0')
// La asimetría: `null` hace que la pantalla no pinte nada. Un 0 afirmaría que
// el dato está recién hecho, que es justo lo contrario de lo que esto viene a
// arreglar.
comprobar('sin campo (undefined) → null', edadEnMinutos(undefined, AHORA) === null)
comprobar('⚠️ null → null, y NO 29 millones de minutos', edadEnMinutos(null, AHORA) === null)
comprobar('un número en vez de texto → null', edadEnMinutos(1760000000000, AHORA) === null)
comprobar('un objeto → null', edadEnMinutos({ generadoEl: 'x' }, AHORA) === null)
comprobar('texto ilegible → null', edadEnMinutos('esta mañana', AHORA) === null)
comprobar('cadena vacía → null', edadEnMinutos('', AHORA) === null)

console.log('\n2b. ⚠️ Y el caso de `new Date(null)`, que es el 1 de enero de 1970')
// Sin el `typeof` del código, esto daría ~29.700.000 minutos y la pantalla
// pintaría «generado hace 20.000 días» tan convencida. Ya mordió en
// `minutosDesde` de `useMT5Quotes`, así que tiene comprobación propia.
const sinTypeof = Math.floor((AHORA.getTime() - new Date(null).getTime()) / 60000)
comprobar(`sin el guardia saldrían ${(sinTypeof / 1e6).toFixed(1)} millones de minutos`, sinTypeof > 29e6)
comprobar('con el guardia sale null', edadEnMinutos(null, AHORA) === null)

console.log('\n3. ⚠️ El reloj del teléfono adelantado')
// Si el aparato de quien mira va unos minutos por delante del servidor, la
// resta sale negativa. Un margen pequeño se lee como «recién hecho»; más allá,
// algún reloj está mal y es mejor no afirmar nada.
comprobar('2 minutos en el futuro → 0, no un negativo', edadEnMinutos(hace(-2), AHORA) === 0)
comprobar('5 minutos en el futuro → 0 (el borde cuenta)', edadEnMinutos(hace(-5), AHORA) === 0)
comprobar('⚠️ 60 minutos en el futuro → null, no se afirma nada', edadEnMinutos(hace(-60), AHORA) === null)

console.log('\n4. Cómo se dice, y la unidad que toca')
comprobar('0 min → «hace 1 min», nunca «hace 0»', describirEdad(0, 2).clave === 'generadoMin' && describirEdad(0, 2).n === 1)
comprobar('45 min → 45 min', describirEdad(45, 99).clave === 'generadoMin' && describirEdad(45, 99).n === 45)
comprobar('59 min → sigue en minutos', describirEdad(59, 99).clave === 'generadoMin')
comprobar('60 min → pasa a horas, n=1', describirEdad(60, 99).clave === 'generadoH' && describirEdad(60, 99).n === 1)
comprobar('185 min → 3 h (se redondea hacia abajo)', describirEdad(185, 99).n === 3)
comprobar('47 h → sigue en horas', describirEdad(47 * 60, 999).clave === 'generadoH')
comprobar('48 h → pasa a días, n=2', describirEdad(48 * 60, 999).clave === 'generadoDias' && describirEdad(48 * 60, 999).n === 2)

console.log('\n4b. ⚠️ Redondear hacia ARRIBA por debajo del minuto es el lado seguro')
// Decir «hace 1 min» cuando hace 20 segundos hace que el dato parezca algo más
// VIEJO de lo que es. Al revés —«hace 0»— lo haría parecer más fresco, y esta
// pantalla existe precisamente para que nadie se crea fresco un dato que no lo
// está.
comprobar('nunca sale un n de 0', describirEdad(0, 2).n === 1)

console.log('\n5. Cuándo se pone en ámbar, y que el umbral LO PONE QUIEN LLAMA')
// Las dos apps publican con cadencias distintas (Swing una vez al día,
// Intradía una vez por hora), así que «viejo» no significa lo mismo. Por eso el
// número no vive en el módulo.
comprobar('Intradía (2 h): a 1 h 59 todavía no es viejo', describirEdad(119, 2).viejo === false)
comprobar('Intradía (2 h): a 2 h exactas YA es viejo', describirEdad(120, 2).viejo === true)
comprobar('Swing (26 h): a 25 h no es viejo', describirEdad(25 * 60, 26).viejo === false)
comprobar('Swing (26 h): a 26 h sí', describirEdad(26 * 60, 26).viejo === true)
comprobar(
  '⚠️ el MISMO dato de 3 horas es viejo en Intradía y normal en Swing',
  describirEdad(180, 2).viejo === true && describirEdad(180, 26).viejo === false
)

console.log('\n6. ⚠️ Sin edad no se describe nada — la pantalla no pinta')
comprobar('null → null', describirEdad(null, 2) === null)
comprobar('undefined → null', describirEdad(undefined, 2) === null)
comprobar('sin umbral → se describe igual, pero nunca «viejo»', describirEdad(5000, undefined).viejo === false)

console.log('\n7. De punta a punta, como lo usará la pantalla')
// El caso que motivó todo esto: el barrido de Intradía con 3 horas encima.
{
  const e = describirEdad(edadEnMinutos(hace(180), AHORA), 2)
  comprobar(`3 horas en Intradía → «hace ${e.n} h» y EN ÁMBAR`, e.clave === 'generadoH' && e.n === 3 && e.viejo === true)
}
{
  const e = describirEdad(edadEnMinutos(hace(40), AHORA), 2)
  comprobar(`40 minutos en Intradía → «hace ${e.n} min», normal`, e.clave === 'generadoMin' && e.viejo === false)
}
{
  // Un barrido viejo de verdad, publicado antes de que el campo existiera.
  comprobar('un barrido sin `generadoEl` → no se pinta nada', describirEdad(edadEnMinutos(undefined, AHORA), 2) === null)
}

console.log(fallos === 0 ? '\n✓ todo bien.\n' : `\n✗ ${fallos} comprobación(es) fallaron.\n`)
process.exit(fallos === 0 ? 0 : 1)
