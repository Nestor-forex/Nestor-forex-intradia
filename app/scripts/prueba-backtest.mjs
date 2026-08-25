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
  const tend = (l) => l.filter((s) => s.tipo === 'tendencia').length

  // ⚠️ TODO LO DEL ADX SE MIDE CON EL FILTRO DE RSI APAGADO, y no es un
  // capricho. Desde que el RSI filtra (2026-08-25) hay DOS filtros encima de
  // las mismas señales, y en el mercado sintético el del RSI deja casi
  // ninguna: comparar contra `porDefecto` daba "1 vs 1" en todo y las
  // comprobaciones del ADX pasaban a no comprobar nada.
  //
  // Es el MISMO error que este archivo ya advierte más abajo con el ADX
  // gobernando tendencia y rango a la vez: dos cosas moviéndose juntas y un
  // número que parece una respuesta y es un efecto secundario. Para medir un
  // filtro hay que dejar quieto el otro.
  const sinRsi = { rsiMax: null }
  const base = generarSenales(barras, rates, rangos, { vista: sinRsi })
  const sinAdx = generarSenales(barras, rates, rangos, { vista: { ...sinRsi, adxMin: 0 } })
  const conAdxAlto = generarSenales(barras, rates, rangos, { vista: { ...sinRsi, adxMin: 60 } })
  comprobar(tend(sinAdx) > tend(base), `sin ADX salen más señales de tendencia (${tend(sinAdx)} vs ${tend(base)})`)
  comprobar(tend(conAdxAlto) < tend(base), `con ADX 60 salen menos (${tend(conAdxAlto)})`)

  // El umbral de la app está en 20. Estuvo en 35 entre el 2026-08-12 y el
  // 2026-08-17, hasta que medirlo sobre 35 meses mostró que el ADX no cambia
  // nada en ningún valor (46-47% de acierto en todos) y que 35 solo recortaba
  // la mitad de las señales a cambio de nada.
  //
  // Se fija aquí para que nadie lo mueva sin querer: pedir 20 a mano tiene que
  // dar EXACTAMENTE lo mismo que no pedir nada, y pedir 35 tiene que dar menos.
  const conAdx20 = generarSenales(barras, rates, rangos, { vista: { ...sinRsi, adxMin: 20 } })
  const conAdx35 = generarSenales(barras, rates, rangos, { vista: { ...sinRsi, adxMin: 35 } })
  comprobar(tend(conAdx20) === tend(base), `la app usa ADX 20, no otro valor (${tend(conAdx20)} = ${tend(base)})`)
  comprobar(
    tend(conAdx35) < tend(base),
    `y con 35 —el que estuvo puesto cinco días— salían menos (${tend(conAdx35)} vs ${tend(base)})`
  )

  // --- El filtro de "no perseguir" (RSI) ---------------------------------
  //
  // Va APAGADO en la app. Estas comprobaciones fijan las tres cosas que lo
  // hacen medible sin engañarse:
  //
  //   a) apagado = idéntico a no existir (si no, ya habría cambiado la app);
  //   b) es un filtro de verdad: solo QUITA señales, nunca añade;
  //   c) es SIMÉTRICO. Esto es lo que más fácil se rompe: si solo mirase el
  //      RSI alto, filtraría las compras y dejaría intactas las ventas, y el
  //      resultado parecería una mejora del filtro cuando en realidad sería
  //      "la app opera menos compras". El error tiene la misma forma que el
  //      del ADX gobernando dos cosas opuestas.
  const conRsi70 = generarSenales(barras, rates, rangos, { vista: { rsiMax: 70 } })
  const conRsi60 = generarSenales(barras, rates, rangos, { vista: { rsiMax: 60 } })
  const conRsiNulo = generarSenales(barras, rates, rangos, { vista: { rsiMax: null } })
  // El filtro se ENCENDIÓ en 70 el 2026-08-25. Estas dos fijan que sigue ahí:
  // pedir 70 a mano tiene que dar EXACTAMENTE lo mismo que no pedir nada, y
  // apagarlo tiene que AÑADIR señales. Si alguien lo apaga sin querer, salta.
  comprobar(
    tend(conRsi70) === tend(porDefecto),
    `la app usa RSI 70, no otro valor (${tend(conRsi70)} = ${tend(porDefecto)})`
  )
  // Que quite las extendidas y no otras cualesquiera. El margen de un punto es
  // por el redondeo: el filtro compara el RSI con decimales y la señal guarda
  // `Math.round`, así que un 69,6 pasa —correctamente— y queda anotado como 70.
  comprobar(
    porDefecto.filter((x) => x.tipo === 'tendencia' && x.ladoOriginal === 'COMPRA').every((x) => x.rsi <= 70),
    'ninguna compra superviviente entra con el RSI por encima de 70'
  )
  comprobar(
    porDefecto.filter((x) => x.tipo === 'tendencia' && x.ladoOriginal === 'VENTA').every((x) => x.rsi >= 30),
    'ninguna venta superviviente entra con el RSI por debajo de 30'
  )
  comprobar(
    tend(conRsiNulo) > tend(porDefecto),
    `apagarlo añade señales (${tend(conRsiNulo)} vs ${tend(porDefecto)}), como debe hacer un filtro`
  )
  comprobar(tend(conRsi60) <= tend(porDefecto), `y con 60 quita más todavía (${tend(conRsi60)})`)
  {
    // Solo quita, nunca añade: las que quedan tienen que estar TODAS entre las
    // de antes, una por una.
    // ⚠️ ESTO AFIRMABA ALGO FALSO Y PASABA POR CASUALIDAD.
    //
    // Decía "todas las que sobreviven al filtro ya estaban sin él". No es
    // cierto: la app se queda con los `topN` mejores, así que cuando el filtro
    // rechaza un par extendido, el siguiente de la lista SUBE a ese hueco y
    // aparecen señales que sin el filtro no existían.
    //
    // Pasaba porque en este mercado sintético el filtro deja UNA señal, y una
    // señal es subconjunto de casi cualquier cosa. Se destapó al portar la
    // misma prueba a swing, donde el mercado deja bastantes más y falló al
    // primer intento: allí 35 de 77 supervivientes eran promovidas.
    //
    // No es un fallo del filtro —sigues recibiendo sugerencias, solo que no
    // las estiradas—, pero cambia lo que significa la medición: no es "la app
    // menos las malas", es "la app con otras señales". Una prueba en verde
    // afirmando lo contrario es peor que no tenerla.
    const antes = new Set(conRsiNulo.filter((x) => x.tipo === 'tendencia').map((x) => `${x.id}@${x.vistoEl}`))
    const supervivientes = porDefecto.filter((x) => x.tipo === 'tendencia')
    const promovidas = supervivientes.filter((x) => !antes.has(`${x.id}@${x.vistoEl}`)).length
    comprobar(
      supervivientes.length - promovidas > 0,
      `${supervivientes.length - promovidas} supervivientes ya estaban sin el filtro y ${promovidas} entraron promovidas al hueco`
    )
    // La simetría: tiene que recortar los DOS lados, no solo uno.
    const lado = (l, d) => l.filter((x) => x.tipo === 'tendencia' && x.ladoOriginal === d).length
    const quitaC = lado(conRsiNulo, 'COMPRA') - lado(conRsi60, 'COMPRA')
    const quitaV = lado(conRsiNulo, 'VENTA') - lado(conRsi60, 'VENTA')
    comprobar(
      quitaC > 0 && quitaV > 0,
      `recorta los dos lados, no solo uno (${quitaC} compras y ${quitaV} ventas menos)`
    )
  }
  // El filtro de tendencia no puede tocar las de rango, igual que con el ADX.
  comprobar(
    conRsi60.filter((s) => s.tipo === 'rango').length === conRsiNulo.filter((s) => s.tipo === 'rango').length,
    'y no toca las señales de rango'
  )

  // ⚠️ LO IMPORTANTE. El ADX se usa para dos cosas opuestas: las de tendencia
  // lo quieren ALTO y las de rango lo quieren BAJO. Si un solo número mandara
  // en las dos, mover el de tendencia cambiaría también las de rango y la
  // medición estaría midiendo dos cosas a la vez.
  //
  // Eso ya pasó: la primera medición dijo "sin filtro de ADX salen MENOS
  // operaciones", que es imposible para un filtro. Lo que ocurría es que
  // poner el umbral en 0 dejaba a las de rango exigiendo un ADX menor que
  // cero, o sea borrándolas todas. El número parecía una respuesta y era un
  // efecto secundario.
  const rango = (l) => l.filter((s) => s.tipo === 'rango').length
  const soloTendMasDuro = generarSenales(barras, rates, rangos, { vista: { ...sinRsi, adxMin: 45 } })
  comprobar(
    rango(soloTendMasDuro) === rango(porDefecto),
    `subir el ADX de tendencia NO toca las de rango (${rango(soloTendMasDuro)} = ${rango(porDefecto)})`
  )
  comprobar(tend(soloTendMasDuro) < tend(base), 'pero sí quita señales de tendencia, que es lo que se pedía')

  const soloRangoMasAncho = generarSenales(barras, rates, rangos, { vista: { ...sinRsi, adxMaxRango: 45 } })
  comprobar(
    tend(soloRangoMasAncho) === tend(base),
    `y al revés: ampliar el de rango NO toca las de tendencia (${tend(soloRangoMasAncho)} = ${tend(base)})`
  )
  comprobar(rango(soloRangoMasAncho) > rango(base), 'pero sí añade señales de rango')

  // Y el guardián del cambio del 2026-08-12: el umbral de rango se quedó en
  // 20 cuando el de tendencia subió a 35. Si alguien volviera a atarlos (por
  // ejemplo dejando `adxMax = ADX_MIN`), el de rango pasaría a 35 y la app
  // empezaría a llamar "rango" a tendencias arrancando, en silencio y en la
  // dirección contraria a la que se buscaba. Pedir 20 a mano tiene que dar
  // exactamente lo mismo que no pedir nada.
  const rangoEn20 = generarSenales(barras, rates, rangos, { vista: { ...sinRsi, adxMaxRango: 20 } })
  comprobar(
    rango(rangoEn20) === rango(porDefecto),
    `el umbral de rango sigue en 20, no siguió al de tendencia (${rango(rangoEn20)} = ${rango(porDefecto)})`
  )

  // Y quitar de verdad el filtro de tendencia tiene que ANADIR operaciones.
  // Si saliera al reves, es que se estaria colando otro cambio.
  const sinAdxLimpio = generarSenales(barras, rates, rangos, { vista: { ...sinRsi, adxMin: 0 } })
  comprobar(
    sinAdxLimpio.length > porDefecto.length,
    `quitar el filtro de ADX AÑADE operaciones (${sinAdxLimpio.length} vs ${porDefecto.length}), como debe hacer un filtro`
  )
}

// La señal nueva. Lo que se comprueba aquí no es que acierte —eso lo dice el
// banco de pruebas con velas reales— sino que esté APAGADA y que, al
// encenderla, no se pise con las que ya existen. Si se pisara, los números de
// las tres listas estarían contándose unos a otros.
console.log('\n10. La señal de retroceso está apagada y no se pisa con nada')
{
  // ⚠️ Estas dos corridas van con `thr: 0`, no con el umbral de la app.
  //
  // El motivo, medido: en este mercado de mentira el precio solo está en la
  // franja entre las dos medias el 2,8% de las velas, y la diferencia de
  // fuerza pasa de 0,5 en el 4,4%. Las dos cosas a la vez, con ADX ≥ 35
  // encima, no ocurren ni una vez en 700 horas inventadas — así que la
  // comprobación de abajo saldría en cero por falta de material, no por un
  // fallo. Bajando el umbral de fuerza hay señales que examinar.
  //
  // Lo que se comprueba aquí es el MECANISMO (que esté apagada, que no toque
  // a las demás, que no se pise con ellas, que el stop sea sano); si acierta
  // o no, y cada cuánto aparece en el mercado de verdad, lo dice el banco de
  // pruebas con velas reales. Una prueba sin internet no puede responder eso.
  const SIN_UMBRAL = { thr: 0 }
  const apagada = generarSenales(barras, rates, rangos, SIN_UMBRAL)
  const encendida = generarSenales(barras, rates, rangos, { ...SIN_UMBRAL, vista: { incluirRetrocesos: true } })
  const retro = (l) => l.filter((s) => s.tipo === 'retroceso')

  comprobar(retro(apagada).length === 0, 'apagada por defecto: la app no da ni una')
  comprobar(retro(encendida).length > 0, `encendida sí aparecen (${retro(encendida).length})`)

  // Encenderla no puede cambiar las demás: solo AÑADE una lista.
  const otras = (l) => l.filter((s) => s.tipo !== 'retroceso')
  comprobar(
    otras(encendida).length === apagada.length &&
      otras(encendida).every((s, i) => s.id === apagada[i].id && s.vistoEl === apagada[i].vistoEl),
    'encenderla no toca ni una sola de las señales que ya daba'
  )

  // Y ninguna puede ser a la vez retroceso y otra cosa en el mismo momento:
  // un retroceso exige ADX ≥ 35 y un rango exige ADX < 20; y una de tendencia
  // exige que el precio esté por fuera de la EMA9, que es lo contrario.
  const yaEstaban = new Set(apagada.map((s) => `${s.par}|${s.lado}@${s.vistoEl}`))
  const pisadas = retro(encendida).filter((s) => yaEstaban.has(`${s.par}|${s.lado}@${s.vistoEl}`))
  comprobar(pisadas.length === 0, `ningún retroceso repite par, lado y hora de otra señal (${pisadas.length} choques)`)

  // El stop tiene que quedar al menos a 1 ATR, o la relación riesgo/beneficio
  // saldría inflada por un denominador de mentira — el error que ya nos costó
  // caro en swing.
  const estrechos = retro(encendida).filter((s) => s.pipRiesgo < 1)
  comprobar(estrechos.length === 0, 'ningún retroceso nace con un stop de cero pips')
  comprobar(
    retro(encendida).every((s) => (s.lado === 'COMPRA' ? s.sl < s.precio && s.tp > s.precio : s.sl > s.precio && s.tp < s.precio)),
    'stop y objetivo en el lado que les toca'
  )
}

console.log(fallos ? `\n✗ ${fallos} comprobaciones fallaron\n` : '\n✓ todo bien\n')
process.exit(fallos ? 1 : 0)
