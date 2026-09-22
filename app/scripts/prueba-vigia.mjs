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

console.log('\n10. Todo lo que una señal CALCULA, o se anota o está decidido que no')
{
  // ⚠️⚠️ ESTE BLOQUE NO ARREGLA NINGÚN FALLO DE HOY. ES UNA TRAMPA PUESTA
  // PARA LA REGLA QUE VENGA MAÑANA, y el motivo está medido en la app hermana.
  //
  // En Swing, la regla de ruptura de estructura calculaba `huboSweep` en cada
  // señal —el dato por el que esa regla existe— y el vigía lo TIRABA: la línea
  // que escribe en `senales.jsonl` ENUMERA sus campos, y ése no estaba en la
  // lista. No falló nada. Se descubrió de casualidad, el 2026-09-22, por una
  // pregunta de Néstor.
  //
  // Aquí HOY no se pierde nada: se comprobó campo por campo. La única regla en
  // sombra de esta app —el retroceso— sale del mismo molde (`mkSetup`) que
  // todas las demás, así que no calcula ni un dato propio que se pueda caer.
  //
  // Lo que esto vigila es el DÍA EN QUE ESO CAMBIE. Si alguien enciende aquí
  // una regla nueva que calcule algo suyo, este bloque falla y obliga a
  // decidir a mano: o se anota en el historial, o se apunta abajo por qué no.
  // Las dos respuestas valen; lo que no vale es que nadie se entere.
  //
  // 📌 Por qué importa más que un cubo mal repartido: un resumen equivocado se
  // arregla releyendo el archivo. Un campo que NO SE ESCRIBIÓ no se recupera
  // nunca — el historial es lo único de este proyecto que no se puede volver a
  // fabricar.

  // ⚠️ ESCRITA A MANO, y con el motivo de cada una. Calcularla («las que hoy
  // no se escriben») la dejaría inútil: un campo nuevo entraría solo en la
  // lista y la prueba seguiría en verde. Es la misma regla que la lista de
  // GEMELOS — una comprobación que se adapta a lo que encuentra no comprueba
  // nada.
  const NO_VAN_AL_HISTORIAL = {
    b: 'la divisa base; ya está dentro de `par`',
    q: 'la divisa cotizada; ya está dentro de `par`',
    dec: 'cuántos decimales pinta la pantalla. Formato, no dato de mercado',
    compra: 'el lado; se anota aparte en `lado`',
    tipo: 'se anota aparte, desde `s.tipo`, no desde `crudo`',
    ema: 'la EMA9 del momento. Se puede recalcular de las velas; el historial guarda la DECISIÓN, no el gráfico',
    sup: 'soporte del momento, recalculable igual que la EMA',
    res: 'resistencia del momento, ídem',
    pivote: 'el pivote de sesión, ídem',
    rangoLo: 'borde bajo del rango; solo existe en el modo rango y se recalcula',
    rangoHi: 'borde alto del rango; ídem',
    atrAbs: 'el ATR en precio. `pipRiesgo` y `pipBeneficio`, que sí se anotan, ya salen de él',
    adx: 'la fuerza de la tendencia. NO se anota porque su umbral se aflojó a 10 el 2026-09-04 y hoy no decide casi nada; si algún día vuelve a decidir, hay que anotarlo',
    fuerzaB: 'la fuerza relativa de la divisa base ese momento; el barrido publicado ya la lleva',
    fuerzaQ: 'la de la cotizada; ídem',
    serie20: 'los últimos 20 cierres. Son VEINTE NÚMEROS POR SEÑAL: anotarlos multiplicaría el historial por diez a cambio de nada que no esté en las velas',
  }

  const marketCalc = readFileSync(new URL('../src/lib/marketCalc.js', import.meta.url), 'utf8')
  const vigia = readFileSync(new URL('./vigia.mjs', import.meta.url), 'utf8')

  // Los campos que `mkSetup` mete en `crudo`, leídos del propio archivo.
  const abre = marketCalc.indexOf('crudo: {')
  let cierra = -1
  if (abre >= 0) {
    let hondo = 0
    for (let k = abre + 'crudo: '.length; k < marketCalc.length; k++) {
      if (marketCalc[k] === '{') hondo++
      else if (marketCalc[k] === '}' && --hondo === 0) {
        cierra = k
        break
      }
    }
  }
  const enCrudo =
    cierra > 0
      ? [...new Set([...marketCalc.slice(abre, cierra).matchAll(/^\s{6}(\w+)\s*[:,]/gm)].map((m) => m[1]))]
      : []

  // Y los que el vigía escribe de verdad en la línea del historial.
  const desde = vigia.indexOf('LOG_SENALES')
  const hasta = vigia.indexOf("+ '\\n'", desde)
  const seEscriben =
    desde >= 0 && hasta > desde
      ? new Set([...vigia.slice(desde, hasta).matchAll(/\bc\.(\w+)/g)].map((m) => m[1]))
      : new Set()

  // ⚠️ GUARDA. Si algún día se reescribe `mkSetup` o el vigía y estos recortes
  // dejan de encontrar nada, la prueba tiene que FALLAR, no quedarse en verde
  // sin haber mirado un solo campo. Es el agujero que este repo ya documenta
  // tres veces.
  comprobar(`se leyeron los campos de \`crudo\` (${enCrudo.length})`, enCrudo.length >= 15)
  comprobar(`y los que el vigía escribe (${seEscriben.size})`, seEscriben.size >= 5)

  const huerfanos = enCrudo.filter((k) => !seEscriben.has(k) && !(k in NO_VAN_AL_HISTORIAL))
  comprobar(
    huerfanos.length
      ? `⚠️ SE CALCULAN Y NO SE ANOTAN, sin que nadie lo haya decidido: ${huerfanos.join(', ')}` +
          ' — o se escriben en la línea de `senales.jsonl` del vigía, o se apuntan en' +
          ' `NO_VAN_AL_HISTORIAL` con el motivo. Ver la cabecera de este bloque.'
      : 'ningún campo se calcula y se tira en silencio',
    huerfanos.length === 0
  )

  // Y al revés: una excusa apuntada para un campo que ya no existe es basura
  // que confunde al siguiente que lea la lista.
  const sobran = Object.keys(NO_VAN_AL_HISTORIAL).filter((k) => !enCrudo.includes(k))
  comprobar(
    sobran.length ? `la lista de excusas nombra campos que ya no existen: ${sobran.join(', ')}` : 'la lista de excusas no tiene sobras',
    sobran.length === 0
  )
}

console.log(fallos === 0 ? '\nTodas las comprobaciones pasaron.\n' : `\n${fallos} comprobación(es) fallaron.\n`)
process.exit(fallos === 0 ? 0 : 1)
