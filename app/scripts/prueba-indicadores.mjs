// Prueba de los indicadores contra valores de referencia. Sin internet:
//
//     node scripts/prueba-indicadores.mjs
//
// POR QUÉ EXISTE ESTE ARCHIVO
// ---------------------------
// El RSI, el ATR, el ADX y las medias son la base de TODO lo demás: de ellos
// salen el stop, el objetivo, la relación riesgo/beneficio y qué pares se
// proponen. Si uno se desvía, no se rompe nada visible — simplemente las
// señales empiezan a estar mal y el historial mide otra cosa. Es el peor tipo
// de error: silencioso y en el sitio donde más duele.
//
// Hasta ahora NADA los comprobaba. Estaban bien, pero por buen trabajo, no por
// protección: cualquiera podía cambiar una línea y romperlos sin que ninguna
// prueba, ni el compilador, ni el revisor de código dijeran una palabra. Con
// dos apps casi gemelas mantenidas a mano, eso es cuestión de tiempo.
//
// DE DÓNDE SALEN LOS NÚMEROS ESPERADOS
// ------------------------------------
// De dos sitios independientes, nunca del propio código:
//
//   1. El juego de cierres es el ejemplo clásico de Welles Wilder ("New
//      Concepts in Technical Trading Systems", 1978), el hombre que inventó el
//      RSI, el ATR y el ADX. Su primer valor de RSI —70,53— es público.
//
//   2. Los demás se calcularon con una implementación aparte, escrita desde la
//      DEFINICIÓN del indicador y no copiada de este código. Que dos
//      implementaciones distintas coincidan hasta el sexto decimal prueba algo;
//      comparar el código consigo mismo no prueba nada.
//
// ⚠️ OJO AL PORTAR ESTE ARCHIVO DESDE O HACIA SWING. El ATR de intradía NO se
// comporta igual: mira solo las últimas 60 velas y, si no le alcanzan para el
// periodo, devuelve un promedio simple en vez de 0. Esas diferencias están
// comprobadas abajo a propósito, para que un port descuidado las cante.

import { emaLast, rsi, atrWilder, adxWilder } from '../src/lib/marketCalc.js'

let fallos = 0
const cerca = (obtenido, esperado, tol, que) => {
  const bien = Math.abs(obtenido - esperado) <= tol
  console.log(`  ${bien ? '✓' : '✗'} ${que}`)
  if (!bien) {
    console.log(`      obtenido ${obtenido}, esperado ${esperado} (tolerancia ${tol})`)
    fallos++
  }
}
const comprobar = (bien, que) => {
  console.log(`  ${bien ? '✓' : '✗'} ${que}`)
  if (!bien) fallos++
}

const CIERRES = [
  44.3389, 44.0902, 44.1497, 43.6124, 44.3278, 44.8264, 45.0955, 45.4245,
  45.8433, 46.0826, 45.8931, 46.0328, 45.614, 46.282, 46.282, 46.0028,
  46.0328, 46.4116, 46.2222, 45.6439, 46.2122, 46.2521, 45.7137, 46.4515,
  45.7835, 45.3548, 44.0288, 44.1783, 44.2181, 44.5672, 43.4205, 42.6628,
  43.1314,
]

// --- 1. RSI ---------------------------------------------------------------

console.log('\n1. RSI(14) contra el ejemplo de Wilder')
{
  cerca(rsi(CIERRES.slice(0, 15)), 70.532789, 1e-5, 'primer valor: 70,53 (el que publica la literatura)')
  cerca(rsi(CIERRES.slice(0, 20)), 57.974856, 1e-5, 'con 20 cierres, ya suavizando')
  cerca(rsi(CIERRES), 37.772952, 1e-5, 'con los 33 cierres')
}

console.log('\n2. El RSI se comporta como debe en los extremos')
{
  cerca(rsi(Array.from({ length: 40 }, (_, i) => 100 + i)), 100, 1e-9, 'un precio que solo sube da 100')
  cerca(rsi(Array.from({ length: 40 }, (_, i) => 100 - i)), 0, 1e-9, 'un precio que solo baja da 0')
  const r = rsi(CIERRES)
  comprobar(r > 0 && r < 100, 'un precio normal cae entre 0 y 100')

  // El filtro de "no perseguir" compara el RSI con 70 y con 30. Si la escala
  // se desviara, ese filtro empezaría a rechazar señales buenas o a dejar
  // pasar las estiradas, y nadie lo notaría desde fuera.
  comprobar(rsi(CIERRES.slice(0, 15)) > 70, 'un tramo alcista claro pasa de 70 (el umbral del filtro)')
  comprobar(rsi(CIERRES) < 70, 'y uno que se dio la vuelta, no')
}

// --- 3. Medias ------------------------------------------------------------

console.log('\n3. Las medias exponenciales (EMA)')
{
  cerca(emaLast(CIERRES, 10), 44.120148, 1e-5, 'EMA(10)')
  cerca(emaLast(CIERRES, 20), 44.636446, 1e-5, 'EMA(20)')
  cerca(emaLast(Array(50).fill(1.2345), 20), 1.2345, 1e-12, 'de un precio constante devuelve ese precio')

  // La app usa EMA9 y EMA21 (no 20/50 como swing) porque son velas de una
  // hora. La corta tiene que reaccionar antes que la larga: si se invirtiera,
  // la app compraría en las caídas.
  const sube = [...Array(40).fill(1.0), ...Array.from({ length: 15 }, (_, i) => 1.0 + (i + 1) * 0.01)]
  comprobar(emaLast(sube, 9) > emaLast(sube, 21), 'la EMA9 reacciona antes que la EMA21 al subir')
  const baja = [...Array(40).fill(1.0), ...Array.from({ length: 15 }, (_, i) => 1.0 - (i + 1) * 0.01)]
  comprobar(emaLast(baja, 9) < emaLast(baja, 21), 'y al bajar, al revés')
}

// --- 4. ATR ---------------------------------------------------------------

console.log('\n4. El ATR de Wilder, sobre casos calculables a mano')
{
  const n = 20
  cerca(
    atrWilder(Array(n).fill(101), Array(n).fill(99), Array(n).fill(100)),
    2.0,
    1e-12,
    'con un rango constante de 2,0 devuelve exactamente 2,0'
  )

  // EL CASO QUE JUSTIFICA USAR WILDER Y NO UNA RESTA DE CIERRES.
  // TR de las 13 primeras = 1 cada una; el de la última = max(1, |120−99,5|,
  // |119−99,5|) = 20,5. ATR = (13·1 + 20,5) / 14.
  const h = [...Array(14).fill(100), 120]
  const l = [...Array(14).fill(99), 119]
  const c = [...Array(14).fill(99.5), 119.5]
  cerca(atrWilder(h, l, c), (13 * 1 + 20.5) / 14, 1e-12, 'cuenta el hueco entre velas, no solo el rango de la hora')

  const m = 30
  const normal = atrWilder(Array(m).fill(101), Array(m).fill(99), Array(m).fill(100))
  const doble = atrWilder(Array(m).fill(102), Array(m).fill(98), Array(m).fill(100))
  cerca(doble / normal, 2, 1e-9, 'el doble de movimiento da el doble de ATR')

  // ⚠️ DIFERENCIA CON SWING, a propósito: aquí, con menos velas que el
  // periodo, se devuelve el promedio simple de lo que haya en vez de 0. Un
  // port que copiara el de swing rompería esto.
  //
  // Con dos velas solo hay un TR: max(102−101, |102−99,5|, |101−99,5|) = 2,5.
  // Manda el hueco desde el cierre anterior (2,5), no el rango de la vela (1)
  // — que es exactamente para lo que sirve el ATR de Wilder.
  cerca(atrWilder([100, 102], [99, 101], [99.5, 101.5]), 2.5, 1e-12, 'con pocas velas devuelve el promedio simple (no 0, como swing)')

  // Y solo mira las últimas 60: lo de más atrás no debe influir.
  const largo = 200
  const conCalmaAntes = atrWilder(
    [...Array(largo).fill(100.1), ...Array(70).fill(102)],
    [...Array(largo).fill(99.9), ...Array(70).fill(98)],
    [...Array(largo).fill(100), ...Array(70).fill(100)]
  )
  const soloElTramo = atrWilder(Array(70).fill(102), Array(70).fill(98), Array(70).fill(100))
  cerca(conCalmaAntes, soloElTramo, 1e-12, 'solo mira las últimas 60 velas: lo anterior no cuenta')
}

// --- 5. ADX ---------------------------------------------------------------
//
// El ADX mide la FUERZA de la tendencia, no su dirección. La app lo usa para
// separar "va hacia algún lado" de "está chapoteando": por encima de 35 da
// señal de tendencia, por debajo de 20 la considera rango. Si la escala se
// desviara, esos dos umbrales dejarían de significar lo que dicen.

console.log('\n5. El ADX distingue tendencia de chapoteo')
{
  const alcista = (n = 80) => {
    const h = [], l = [], c = []
    for (let i = 0; i < n; i++) {
      const base = 100 + i * 0.5
      h.push(base + 0.6); l.push(base - 0.3); c.push(base + 0.2)
    }
    return { h, l, c }
  }
  const lateral = (n = 80) => {
    const h = [], l = [], c = []
    for (let i = 0; i < n; i++) {
      const base = 100 + (i % 2 ? 1 : -1) * 0.4
      h.push(base + 0.5); l.push(base - 0.5); c.push(base)
    }
    return { h, l, c }
  }

  const a = alcista()
  const s = lateral()
  cerca(adxWilder(a.h, a.l, a.c), 100, 1e-4, 'una tendencia limpia da 100')
  cerca(adxWilder(s.h, s.l, s.c), 3.687277, 1e-4, 'un mercado en sierra da 3,7')

  // Lo que de verdad importa para la app: que los dos umbrales caigan del lado
  // correcto. Si esto fallara, la app confundiría tendencia con rango.
  comprobar(adxWilder(a.h, a.l, a.c) > 35, 'la tendencia pasa el umbral de señal (35)')
  comprobar(adxWilder(s.h, s.l, s.c) < 20, 'el chapoteo queda por debajo del umbral de rango (20)')

  const adx = adxWilder(a.h, a.l, a.c)
  comprobar(adx >= 0 && adx <= 100, 'siempre cae entre 0 y 100')
  comprobar(adxWilder([1, 2, 3], [0, 1, 2], [0.5, 1.5, 2.5]) === 0, 'sin velas suficientes devuelve 0 en vez de un número inventado')

  // LA REGLA DE DOMINANCIA DE WILDER, que las series de arriba NO ponen a
  // prueba.
  //
  // En el ADX, el movimiento de un lado solo cuenta si SUPERA al del otro
  // (`subeAlto > bajaBajo`). En una tendencia limpia eso se cumple siempre,
  // así que quitar la regla no cambiaría nada y la prueba pasaría igual —
  // se comprobó, y en efecto no lo cazaba.
  //
  // Donde la regla decide es en las velas ENVOLVENTES: el máximo sube y el
  // mínimo baja a la vez. Esta serie las mete cada tres velas, y ahí quitar
  // la dominancia hunde el ADX de 63,9 a 4,8 — de "tendencia clarísima" a
  // "puro chapoteo". Sin este caso, ese error pasaría desapercibido.
  const mixta = (n = 80) => {
    const h = [], l = [], c = []
    let base = 100
    for (let i = 0; i < n; i++) {
      if (i % 3 === 0) {
        h.push(base + 1.5); l.push(base - 1.8); c.push(base - 0.2); base -= 0.15
      } else {
        base += 0.35; h.push(base + 0.4); l.push(base - 0.2); c.push(base + 0.1)
      }
    }
    return { h, l, c }
  }
  const m = mixta()
  cerca(adxWilder(m.h, m.l, m.c), 63.873801, 1e-4, 'con velas envolventes aplica la regla de dominancia de Wilder')
}

// --- 6. Nada guarda estado -----------------------------------------------

console.log('\n6. Llamarlos dos veces da lo mismo')
{
  comprobar(rsi(CIERRES) === rsi(CIERRES), 'el RSI no guarda estado')
  comprobar(emaLast(CIERRES, 21) === emaLast(CIERRES, 21), 'la EMA tampoco')
  const h = Array(20).fill(101), l = Array(20).fill(99), c = Array(20).fill(100)
  comprobar(atrWilder(h, l, c) === atrWilder(h, l, c), 'el ATR tampoco')
  comprobar(adxWilder(h, l, c) === adxWilder(h, l, c), 'el ADX tampoco')
}

console.log('')
console.log(fallos ? `${fallos} comprobación(es) FALLARON` : 'Los indicadores coinciden con la referencia.')
process.exit(fallos ? 1 : 0)
