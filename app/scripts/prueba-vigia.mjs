// Prueba de la lógica del vigía: qué cuenta como señal nueva y qué no.
//
// Corre sin internet y sin gastar cuota de Twelve Data, con señales
// inventadas. Es la parte que no se puede comprobar mirando una corrida real
// (si ese día no hay señales, no se prueba nada), y es justo de la que
// dependen los avisos: un fallo aquí significa o avisos repetidos cada hora,
// o ningún aviso nunca.
//
// Correr con: node scripts/prueba-vigia.mjs

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compararConAnterior, escribir, esSombra, idDe, leerEstado, separarSombra } from './lib/vigia-nucleo.mjs'

const dir = mkdtempSync(join(tmpdir(), 'vigia-'))
const ESTADO = join(dir, 'estado/vigia.json')

const setup = (name, lado, tipo = 'tendencia') => ({ name, lado, tipo })
const guardar = (actuales) => escribir(ESTADO, JSON.stringify({ senales: actuales.map((x) => x.id) }, null, 2))

let fallos = 0
const comprobar = (que, condicion) => {
  console.log(`${condicion ? '  OK  ' : '  MAL '} ${que}`)
  if (!condicion) fallos++
}

// ---------------------------------------------------------------- escenarios

console.log('\n1. Primera corrida: todo es nuevo (no hay estado previo)')
const r1 = compararConAnterior([setup('EUR/USD', 'COMPRA'), setup('USD/JPY', 'VENTA')], leerEstado(ESTADO))
comprobar('las 2 señales cuentan como nuevas', r1.nuevas.length === 2)
guardar(r1.actuales)

console.log('\n2. Misma foto una hora después: nada nuevo')
const r2 = compararConAnterior([setup('EUR/USD', 'COMPRA'), setup('USD/JPY', 'VENTA')], leerEstado(ESTADO))
comprobar('sigue habiendo 2 señales activas', r2.actuales.length === 2)
comprobar('ninguna es nueva (no se repite el aviso)', r2.nuevas.length === 0)
guardar(r2.actuales)

console.log('\n3. Aparece una tercera: solo esa es nueva')
const r3 = compararConAnterior(
  [setup('EUR/USD', 'COMPRA'), setup('USD/JPY', 'VENTA'), setup('GBP/CHF', 'COMPRA')],
  leerEstado(ESTADO)
)
comprobar('solo 1 nueva', r3.nuevas.length === 1)
comprobar('y es GBP/CHF', r3.nuevas[0].s.name === 'GBP/CHF')
guardar(r3.actuales)

console.log('\n4. El mismo par cambia de lado: es una señal distinta')
const r4 = compararConAnterior([setup('EUR/USD', 'VENTA')], leerEstado(ESTADO))
comprobar('EUR/USD VENTA cuenta como nueva aunque ya hubo EUR/USD COMPRA', r4.nuevas.length === 1)
guardar(r4.actuales)

console.log('\n5. Una señal desaparece y vuelve: cuenta como nueva otra vez')
guardar(compararConAnterior([], leerEstado(ESTADO)).actuales) // hora sin nada
const r5 = compararConAnterior([setup('EUR/USD', 'VENTA')], leerEstado(ESTADO))
comprobar('es una oportunidad de entrada distinta, así que vuelve a avisar', r5.nuevas.length === 1)

console.log('\n6. El mismo par en modo rango no es el mismo que en tendencia')
const r6 = compararConAnterior([setup('EUR/USD', 'COMPRA', 'tendencia'), setup('EUR/USD', 'COMPRA', 'rango')], { senales: [] })
comprobar('se distinguen por tipo', new Set(r6.actuales.map((x) => x.id)).size === 2)

console.log('\n7. Estado estropeado o inexistente: no tumba el vigía')
comprobar('archivo que no existe → arranca de cero', leerEstado(join(dir, 'no-existe.json')).senales.length === 0)
escribir(join(dir, 'roto.json'), '{esto no es json')
comprobar('archivo corrupto → arranca de cero', leerEstado(join(dir, 'roto.json')).senales.length === 0)

console.log('\n8. Lo que se guarda se vuelve a leer igual')
const guardado = JSON.parse(readFileSync(ESTADO, 'utf8'))
comprobar('el estado en disco tiene los ids esperados', guardado.senales.every((x) => typeof x === 'string'))
comprobar('el id se arma como par|lado|tipo', idDe(setup('EUR/USD', 'COMPRA')) === 'EUR/USD|COMPRA|tendencia')

console.log('\n9. Las señales en sombra se anotan pero NUNCA salen hacia un celular')
{
  // Esta es la promesa de fondo: la señal de retroceso está en pruebas (54%
  // de acierto sobre 50 operaciones, con un margen de ±14 puntos), así que se
  // anota para ir acumulando datos reales pero no se le propone a nadie. Si
  // esto se rompiera no habría ningún síntoma visible: simplemente empezarían
  // a salir avisos de una regla que todavía no sabemos si sirve.
  const nuevas = [
    { id: 'a', s: setup('EUR/USD', 'COMPRA', 'tendencia') },
    { id: 'b', s: setup('GBP/USD', 'VENTA', 'rango') },
    { id: 'c', s: setup('AUD/USD', 'COMPRA', 'retroceso') },
  ]
  const { visibles, sombra } = separarSombra(nuevas)

  comprobar('la de retroceso queda apartada', sombra.length === 1 && sombra[0].id === 'c')
  comprobar('y no aparece entre las que se avisan', visibles.length === 2 && !visibles.some((x) => x.id === 'c'))
  comprobar('tendencia y rango sí se avisan', visibles.map((x) => x.id).join() === 'a,b')
  comprobar('ninguna se pierde por el camino', visibles.length + sombra.length === nuevas.length)

  // Y la marca es por TIPO, no por nombre del par ni por lado: si mañana un
  // retroceso sale en EUR/USD comprando, sigue siendo sombra.
  comprobar('es el tipo lo que manda', esSombra(setup('EUR/USD', 'COMPRA', 'retroceso')) === true)
  comprobar('y un tipo normal no se marca', esSombra(setup('EUR/USD', 'COMPRA', 'tendencia')) === false)
  comprobar('un setup sin tipo no revienta', esSombra({}) === false)
}

console.log(fallos === 0 ? '\nTodas las comprobaciones pasaron.\n' : `\n${fallos} comprobación(es) fallaron.\n`)
process.exit(fallos === 0 ? 0 : 1)
