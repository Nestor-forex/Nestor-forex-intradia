// Prueba del banco de pruebas. Sin internet y sin claves:
//
//     node scripts/prueba-backtest.mjs
//
// Un backtest que se equivoca no da un error: da un número bonito y falso, y
// un número falso da confianza, que es peor que no tener número.
//
// Lo que de verdad importa aquí es la comprobación 2: que no mire el futuro.

import { generarSenales, VENTANA } from './lib/backtest-nucleo.mjs'
import { GEOMETRIAS, actual, simetrica } from './lib/geometrias.mjs'
import { resolver } from './lib/resolver.mjs'
import { computarBarrido } from '../src/lib/marketCalc.js'

let fallos = 0
const comprobar = (bien, que) => {
  console.log(`  ${bien ? '✓' : '✗'} ${que}`)
  if (!bien) fallos++
}

// --- Un mercado de mentira, pero con forma de mercado -----------------------
//
// Números al azar puros no producirían tendencias y no saldría ninguna señal:
// la prueba pasaría sin haber probado nada. Esto es un paseo aleatorio con
// tramos de tendencia, en velas de una hora.

const CCY = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD']
const HORAS = 700

function mercadoFalso(semilla = 11) {
  // Generador propio y determinista: con Math.random cada corrida daría un
  // resultado distinto y no se podría comparar nada.
  let x = semilla
  const azar = () => {
    x = (x * 1103515245 + 12345) % 2147483648
    return x / 2147483648
  }

  const barras = []
  for (let i = 0; i < HORAS; i++) {
    const d = new Date(Date.UTC(2026, 0, 1, 0) + i * 3600_000)
    barras.push(d.toISOString().slice(0, 19).replace('T', ' '))
  }

  // `rates` guarda unidades de cada divisa por 1 USD, que es lo que espera
  // marketCalc en esta app.
  const nivel = { EUR: 0.92, GBP: 0.79, JPY: 150, CHF: 0.88, AUD: 1.52, NZD: 1.64, CAD: 1.36 }
  const deriva = {}
  CCY.forEach((c) => (deriva[c] = (azar() - 0.5) * 0.0004))

  const rates = {}
  const rangos = {}
  barras.forEach((t, i) => {
    const fila = {}
    const filaRangos = {}
    for (const c of CCY) {
      if (i % 120 === 0) deriva[c] = (azar() - 0.5) * 0.0004
      nivel[c] *= 1 + deriva[c] + (azar() - 0.5) * 0.0015
      fila[c] = nivel[c]
      const mecha = nivel[c] * 0.0012 * azar()
      filaRangos[c] = { h: nivel[c] + mecha, l: nivel[c] - mecha }
    }
    rates[t] = fila
    rangos[t] = filaRangos
  })

  return { barras, rates, rangos }
}

const { barras, rates, rangos } = mercadoFalso()

// --- 1. Produce algo con lo que trabajar -----------------------------------

console.log('\n1. Genera señales sobre un mercado con tendencias')
const senales = generarSenales(barras, rates, rangos)
comprobar(senales.length > 0, `salieron ${senales.length} señales (si fueran 0, la prueba no probaría nada)`)
comprobar(
  senales.every((s) => s.precio > 0 && s.sl > 0 && s.tp > 0 && Number.isFinite(s.rr)),
  'todas traen precio, stop, objetivo y R/B con números de verdad'
)
comprobar(
  senales.every((s) => (s.lado === 'COMPRA' ? s.sl < s.precio && s.tp > s.precio : s.sl > s.precio && s.tp < s.precio)),
  'el stop y el objetivo caen del lado correcto según compra o venta'
)

// --- 2. LA IMPORTANTE: no mira el futuro -----------------------------------
//
// Si al calcular la vela i se colara un precio de la i+1, las señales del
// principio cambiarían al añadir velas posteriores. Se corre el motor sobre
// medio mercado y sobre el mercado entero, y el tramo común tiene que salir
// IDÉNTICO, hasta el último decimal del stop.

console.log('\n2. No mira el futuro (lo que haría falsos todos los números)')
{
  const corte = 550
  const parcial = generarSenales(barras.slice(0, corte), rates, rangos)
  const mismoTramo = senales.filter((s) => barras.indexOf(s.vistoEl) < corte)

  comprobar(parcial.length === mismoTramo.length, `mismo número de señales en el tramo común (${parcial.length})`)
  comprobar(
    parcial.every((a, i) => {
      const b = mismoTramo[i]
      return b && a.id === b.id && a.vistoEl === b.vistoEl && a.precio === b.precio && a.sl === b.sl && a.tp === b.tp
    }),
    'y son idénticas: mismos niveles, con y sin velas posteriores'
  )
}

// --- 3. La ventana móvil ----------------------------------------------------
//
// Es la diferencia de fondo con el banco de pruebas de swing, y si estuviera
// mal mediríamos una app que no existe: el vigía calcula SIEMPRE con las
// últimas 300 velas, así que darle más historia le cambiaría las medias, el
// ADX y los pivotes.

console.log('\n3. El barrido ve siempre la misma ventana que en producción')
{
  // Con más historia por delante, las señales de una vela concreta tienen que
  // salir iguales: lo que hay más allá de la ventana no debe influir.
  const cortas = generarSenales(barras.slice(0, VENTANA + 60), rates, rangos)
  const largas = senales.filter((s) => barras.indexOf(s.vistoEl) < VENTANA + 60)
  comprobar(
    cortas.length === largas.length && cortas.every((a, i) => a.precio === largas[i].precio && a.sl === largas[i].sl),
    'una vela da el mismo resultado con 360 velas detrás que con 700'
  )

  comprobar(
    senales.every((s) => barras.indexOf(s.vistoEl) >= VENTANA),
    'y no se juzga ninguna vela antes de tener la ventana completa'
  )
}

// --- 4. Una señal viva varias horas cuenta UNA vez --------------------------

console.log('\n4. Una señal que dura horas es una operación, no una por hora')
{
  const claves = senales.map((s) => `${s.id}@${s.vistoEl}`)
  comprobar(new Set(claves).size === claves.length, 'no hay dos señales con la misma clave')
  const horas = barras.length - VENTANA
  comprobar(senales.length < horas * 6, `${senales.length} señales en ${horas} horas medidas: no se cuenta cada hora`)
}

// --- 5. Se puede juzgar con el resolver de verdad ---------------------------

console.log('\n5. El resolver las entiende (mismo código que el vigía)')
{
  const completo = computarBarrido(barras, rates, rangos)
  const { resultados } = resolver(senales, completo)

  comprobar(
    resultados.filter((r) => r.resultado === 'caducada').length === 0,
    'ninguna sale "caducada" (en swing ese fallo dejó el historial en cero)'
  )
  const juzgadas = resultados.filter((r) => r.resultado === 'ganada' || r.resultado === 'perdida')
  comprobar(juzgadas.length > 0, `${juzgadas.length} señales llegaron a objetivo o a stop`)
  comprobar(
    juzgadas.every((r) => (r.resultado === 'ganada' ? r.pips > 0 : r.pips < 0)),
    'las ganadas suman pips y las perdidas restan'
  )
}

// --- 6. Las geometrías ------------------------------------------------------

console.log('\n6. Las geometrías cumplen lo que prometen')
{
  const p = { precio: 1.2, atrAbs: 0.001, res: 1.205, sup: 1.19, pivote: 1.202, dec: 4 }

  const c = simetrica(p, true)
  const v = simetrica(p, false)
  comprobar(Math.abs(p.precio - c.sl - (c.tp - p.precio)) < 1e-12, 'la neutra: misma distancia arriba que abajo')
  comprobar(Math.abs(p.precio - c.sl - (v.sl - p.precio)) < 1e-12, 'y la misma comprando que vendiendo')
  comprobar(
    simetrica({ ...p, res: 9, sup: 0.1, pivote: 5 }, true).tp === c.tp,
    'la neutra no mira niveles: solo precio y ATR (si los mirara, volvería el sesgo)'
  )

  // La firma del 1.67: cuando no hay ningún nivel a más de 1 ATR por delante,
  // la app se inventa un objetivo a 2,5 ATR con el stop en 1,5. Fue lo que
  // tuvieron las cinco señales perdedoras del historial real.
  const sinNiveles = { ...p, res: 1.2001, sup: 1.1999, pivote: 1.2 }
  const a = actual(sinNiveles, true)
  const rr = (a.tp - sinNiveles.precio) / (sinNiveles.precio - a.sl)
  comprobar(Math.abs(rr - 2.5 / 1.5) < 1e-9, 'la de la app da R/B 1.67 clavado cuando no hay nivel por delante')

  for (const [nombre, geo] of GEOMETRIAS) {
    const gc = geo(p, true)
    const gv = geo(p, false)
    comprobar(
      gc.sl < p.precio && gc.tp > p.precio && gv.sl > p.precio && gv.tp < p.precio,
      `${nombre.slice(0, 12)}… pone stop y objetivo en el lado correcto`
    )
  }
}

// --- 7. Invertir las ventas invierte SOLO las ventas ------------------------

console.log('\n7. Invertir las ventas invierte solo las ventas')
{
  const alReves = generarSenales(barras, rates, rangos, { invertirVentas: true })
  comprobar(alReves.length === senales.length, 'salen las mismas señales')
  comprobar(
    alReves.every((a, i) => a.par === senales[i].par && a.vistoEl === senales[i].vistoEl && a.precio === senales[i].precio),
    'mismo par, misma hora y misma entrada, una a una'
  )

  const ventas = senales.filter((s) => s.lado === 'VENTA')
  const invertidas = alReves.filter((s) => s.ladoOriginal === 'VENTA')
  comprobar(ventas.length > 0 && invertidas.length === ventas.length, `hay ventas que invertir (${ventas.length})`)
  comprobar(
    invertidas.every((s) => s.lado === 'COMPRA' && s.sl < s.precio && s.tp > s.precio),
    'todas pasan a COMPRA, con el stop debajo y el objetivo arriba'
  )

  const comprasAntes = senales.filter((s) => s.ladoOriginal === 'COMPRA')
  const comprasDespues = alReves.filter((s) => s.ladoOriginal === 'COMPRA')
  comprobar(
    comprasAntes.length === comprasDespues.length &&
      comprasAntes.every((a, i) => a.sl === comprasDespues[i].sl && a.tp === comprasDespues[i].tp),
    'y las compras de verdad quedan EXACTAMENTE igual'
  )
}

// --- 8. Los datos que usan los desgloses ------------------------------------

console.log('\n8. Cada señal trae lo que hace falta para desglosarla')
{
  comprobar(senales.every((s) => s.par === `${s.base}/${s.cotizada}`), 'las divisas cuadran con el nombre del par')
  comprobar(senales.every((s) => s.tipo === 'tendencia' || s.tipo === 'rango'), 'el tipo es tendencia o rango')
  comprobar(senales.every((s) => Number.isFinite(s.rsi) && s.rsi >= 0 && s.rsi <= 100), 'el RSI está entre 0 y 100')
  comprobar(senales.every((s) => Number.isFinite(s.adx) && s.adx >= 0), 'y el ADX viene con un número válido')
  comprobar(senales.every((s) => s.vela === s.vistoEl), 'el campo `vela` va puesto: es el que lee el resolver aquí')
}

// --- 9. Los umbrales inyectables --------------------------------------------
//
// Para medir "¿era mejor antes del ADX?" hubo que hacer que los umbrales de la
// app se puedan mover desde fuera. El riesgo de eso es cambiar sin querer lo
// que hace la app de verdad, así que lo primero es comprobar que sin pedir
// nada se comporta EXACTAMENTE igual que antes.

console.log('\n9. Mover los umbrales no cambia la app por defecto')
{
  const porDefecto = generarSenales(barras, rates, rangos)
  const vaciaExplicita = generarSenales(barras, rates, rangos, { vista: {} })
  comprobar(
    porDefecto.length === vaciaExplicita.length &&
      porDefecto.every((a, i) => a.id === vaciaExplicita[i].id && a.sl === vaciaExplicita[i].sl),
    'pedir la vista vacía es idéntico a no pedir nada'
  )

  // Bajar el ADX a 0 tiene que AÑADIR señales de tendencia (deja pasar las que
  // hoy se descartan) y subirlo mucho tiene que quitarlas. Si no cambiara
  // nada, el umbral no estaría llegando a la app y la medición del ADX sería
  // un número inventado.
  const sinAdx = generarSenales(barras, rates, rangos, { vista: { adxMin: 0 } })
  const conAdxAlto = generarSenales(barras, rates, rangos, { vista: { adxMin: 60 } })
  const tend = (l) => l.filter((s) => s.tipo === 'tendencia').length
  comprobar(tend(sinAdx) > tend(porDefecto), `sin ADX salen más señales de tendencia (${tend(sinAdx)} vs ${tend(porDefecto)})`)
  comprobar(tend(conAdxAlto) < tend(porDefecto), `con ADX 60 salen menos (${tend(conAdxAlto)})`)

  const sinH4 = generarSenales(barras, rates, rangos, { vista: { exigirH4: false } })
  comprobar(tend(sinH4) >= tend(porDefecto), 'quitar la confirmación de 4 horas no quita señales')
}

console.log(fallos ? `\n✗ ${fallos} comprobaciones fallaron\n` : '\n✓ todo bien\n')
process.exit(fallos ? 1 : 0)
