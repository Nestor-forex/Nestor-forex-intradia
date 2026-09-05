// Prueba de la copia de seguridad del historial. Sin internet:
//
//     node scripts/prueba-respaldo.mjs
//
// ⚠️ LO QUE SE COMPRUEBA AQUÍ NO ES QUE LA COPIA SE HAGA — eso se ve a simple
// vista— sino que la ALARMA salte. Una copia de seguridad que copia sin mirar
// es peor que ninguna: reproduce fielmente un archivo estropeado y da
// tranquilidad falsa mientras el historial se pierde.
//
// El archivo protegido es lo único del proyecto que no se puede volver a
// fabricar, así que la alarma es la mitad del trabajo.

import { carpetaDe, compararConAnterior, contarLineas, masReciente, revisarJsonl } from './lib/respaldo.mjs'

let fallos = 0
const comprobar = (bien, que) => {
  console.log(`  ${bien ? '✓' : '✗'} ${que}`)
  if (!bien) fallos++
}

// Un historial de mentira con la forma del de verdad.
const linea = (i) => JSON.stringify({ id: `EUR/USD|COMPRA`, vistoEl: `2026-08-${String(i).padStart(2, '0')}` })
const jsonl = (n) => Array.from({ length: n }, (_, i) => linea(i + 1)).join('\n') + '\n'
const estado = (s, r) => ({ senales: revisarJsonl(jsonl(s)), resultados: revisarJsonl(jsonl(r)) })

console.log('\n1. Contar líneas de un JSONL')
{
  comprobar(contarLineas(jsonl(5)) === 5, 'cinco líneas se cuentan como cinco')
  // El salto final es obligatorio en JSONL: si contara, todo saldría con una de más.
  comprobar(contarLineas('a\nb\n') === 2, 'el salto de línea final NO cuenta como una línea más')
  comprobar(contarLineas('') === 0, 'un archivo vacío da cero')
  comprobar(contarLineas(null) === 0, 'y uno que no existe también da cero, sin reventar')
}

console.log('\n2. Se detecta una línea a medio escribir')
{
  const sano = revisarJsonl(jsonl(3))
  comprobar(sano.lineas === 3 && sano.rotas.length === 0, 'un archivo sano no tiene líneas rotas')

  // El fallo que las cuentas solas NO ven: el número de líneas es correcto y
  // una de ellas está cortada. Pasa cuando una corrida muere a mitad de escribir.
  const roto = revisarJsonl(jsonl(2) + '{"id":"EUR/US\n')
  comprobar(roto.lineas === 3, 'un archivo con una línea cortada sigue teniendo 3 líneas…')
  comprobar(roto.rotas.length === 1 && roto.rotas[0] === 3, '…y se señala cuál es (la 3)')
}

console.log('\n3. LA COMPROBACIÓN QUE JUSTIFICA TODO: si encoge, chilla')
{
  // Estos archivos SOLO crecen: el vigía añade al final y no borra nunca.
  // Menos líneas que la semana pasada significa historial perdido.
  const antes = estado(40, 30)

  const creció = compararConAnterior(estado(44, 37), antes)
  comprobar(creció.ok, 'si creció, no hay alarma')
  comprobar(
    creció.notas.some((n) => n.includes('+4')),
    'y se dice cuánto creció (+4 señales)'
  )

  const igual = compararConAnterior(estado(40, 30), antes)
  comprobar(igual.ok, 'si se quedó igual tampoco hay alarma: hay semanas sin señales nuevas')

  const encogió = compararConAnterior(estado(31, 30), antes)
  comprobar(!encogió.ok, 'SI ENCOGIÓ, ALARMA')
  comprobar(
    encogió.alarmas.some((a) => a.includes('40') && a.includes('31')),
    'y la alarma dice los dos números, para poder juzgar sin abrir nada'
  )
  comprobar(
    encogió.alarmas.some((a) => a.toLowerCase().includes('no la borres')),
    'y avisa de no borrar la copia anterior, que es lo primero que salva'
  )

  // Que encoja UNO solo tiene que bastar. Es el caso más probable: el vigía
  // escribe los dos archivos por separado.
  const soloUno = compararConAnterior({ ...estado(40, 30), resultados: revisarJsonl(jsonl(29)) }, antes)
  comprobar(!soloUno.ok, 'basta con que encoja UNO de los dos archivos')
}

console.log('\n4. Los casos raros no pasan por sanos')
{
  const antes = estado(40, 30)

  comprobar(!compararConAnterior({ senales: revisarJsonl(''), resultados: revisarJsonl(jsonl(30)) }, antes).ok,
    'un archivo vacío es alarma')
  comprobar(!compararConAnterior({ senales: null, resultados: revisarJsonl(jsonl(30)) }, antes).ok,
    'un archivo que no está es alarma')

  const conRota = compararConAnterior(
    { senales: revisarJsonl(jsonl(45) + '{roto\n'), resultados: revisarJsonl(jsonl(30)) },
    antes
  )
  comprobar(!conRota.ok, 'una línea rota es alarma AUNQUE el archivo haya crecido')

  // La primera vez no hay con qué comparar, y eso NO es un fallo. Si lo fuera,
  // la primera corrida saldría en rojo y nadie volvería a mirar las siguientes.
  const primera = compararConAnterior(estado(44, 37), null)
  comprobar(primera.ok, 'la primera copia, sin anterior, no da alarma')
  comprobar(
    primera.notas.some((n) => n.includes('primera copia')),
    'pero se dice que es la primera, para que el verde no engañe'
  )
}

console.log('\n5. Encontrar la copia anterior')
{
  comprobar(masReciente(['2026-08-30', '2026-09-06', '2026-08-02']) === '2026-09-06', 'coge la fecha más alta')
  comprobar(masReciente([]) === null, 'sin ninguna copia devuelve null, no revienta')
  // Un README o cualquier archivo suelto en la raíz de la rama no puede
  // colarse como si fuera una copia: haría comparar contra un directorio vacío
  // y todo saldría «primera copia» para siempre.
  comprobar(masReciente(['INDICE.md', 'notas', '2026-09-06']) === '2026-09-06', 'ignora lo que no sea una fecha')
  comprobar(masReciente(['INDICE.md']) === null, 'y si solo hay basura, dice que no hay ninguna')

  const c = carpetaDe(new Date('2026-09-06T23:30:00Z'))
  comprobar(/^\d{4}-\d{2}-\d{2}$/.test(c), `la carpeta se llama por la fecha (${c})`)
  // Orden alfabético = orden cronológico. De ahí sale poder encontrar la última
  // sin guardar un índice aparte, y un índice aparte es lo que se desincroniza.
  comprobar(
    ['2026-01-02', '2026-01-10', '2026-02-01'].slice().sort().join() === '2026-01-02,2026-01-10,2026-02-01',
    'y ordenar por nombre ordena por fecha'
  )
}

console.log('')
console.log(fallos ? `${fallos} comprobación(es) FALLARON` : 'La copia de seguridad avisa cuando tiene que avisar.')
process.exit(fallos ? 1 : 0)
