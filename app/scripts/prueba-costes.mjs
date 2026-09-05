// Prueba del modelo de costes. Sin internet:
//
//     node scripts/prueba-costes.mjs
//
// Un error aquí no se ve: el banco de pruebas seguiría imprimiendo una tabla
// con buena pinta, solo que los números estarían mal. Y esos números son los
// que deciden si una regla se enciende o se apaga — o sea, si Néstor le pone
// dinero.
//
// El error más peligroso sería el de SIGNO: que un coste sumara en vez de
// restar. La tabla saldría mejor cuantos más costes se descuentan, que es
// exactamente el autoengaño que este archivo intenta impedir.

import { spreadDe, costeEnPips, nochesEntre, HORA_CORTE_UTC, SPREAD_PIPS, SPREAD_POR_DEFECTO, NIVELES_SWAP } from './lib/costes.mjs'
import { PAIRS } from '../src/lib/marketCalc.js'
import { medir, barridoSwap } from './lib/backtest-nucleo.mjs'

let fallos = 0
const comprobar = (bien, que) => {
  console.log(`  ${bien ? '✓' : '✗'} ${que}`)
  if (!bien) fallos++
}
const cerca = (a, b, tol, que) => comprobar(Math.abs(a - b) <= tol, que)

// --- 1. Todos los pares que la app opera tienen su precio -----------------
//
// Si faltara uno, se mediría con el valor por defecto sin que nadie lo note.

console.log('\n1. Los 18 pares de la app tienen su spread')
{
  const nombres = PAIRS.map(([b, q]) => `${b}/${q}`)
  const faltan = nombres.filter((n) => !(n in SPREAD_PIPS))
  comprobar(faltan.length === 0, faltan.length ? `FALTAN: ${faltan.join(', ')}` : `los ${nombres.length} están en la tabla`)

  const sobran = Object.keys(SPREAD_PIPS).filter((n) => !nombres.includes(n))
  comprobar(sobran.length === 0, sobran.length ? `sobran (ya no se operan): ${sobran.join(', ')}` : 'y no sobra ninguno')
}

// --- 2. Los cruces cuestan más que los mayores ----------------------------
//
// No es un adorno: es la razón de que la tabla exista. Con un spread único los
// cruces salían BARATOS y por tanto mejores de lo que son, y son la mitad de
// la lista.

console.log('\n2. Los cruces cuestan más que los pares con dólar')
{
  const conDolar = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'USD/CAD', 'AUD/USD', 'NZD/USD']
  const cruces = ['EUR/CHF', 'EUR/CAD', 'EUR/NZD', 'GBP/CAD', 'GBP/JPY', 'NZD/CHF', 'NZD/CAD', 'AUD/JPY', 'NZD/JPY', 'AUD/NZD', 'EUR/GBP']
  const medioMayor = conDolar.reduce((a, p) => a + spreadDe(p), 0) / conDolar.length
  const medioCruce = cruces.reduce((a, p) => a + spreadDe(p), 0) / cruces.length
  // Se compara la MEDIA y no el peor contra el mejor: aquí hay cruces muy
  // líquidos (EUR/GBP, AUD/JPY) que cuestan menos que un mayor caro como
  // NZD/USD, y eso es correcto — no todos los cruces son caros.
  comprobar(medioCruce > medioMayor, `de media, los cruces cuestan más (${medioCruce.toFixed(2)}) que los mayores (${medioMayor.toFixed(2)})`)
  comprobar(spreadDe('EUR/USD') === Math.min(...conDolar.map((p) => spreadDe(p))), 'EUR/USD es el más barato, como en el mercado real')
  // ⚠️ Y que usarlo mal REVIENTE en vez de devolver un número creíble. Esta
  // línea existe porque el fallo ocurrió de verdad: al añadir el parámetro
  // `tabla`, un `.map(spreadDe)` empezó a pasarle el índice y EUR/USD pasó a
  // costar 3 pips sin que nada avisara.
  let reventó = false
  try {
    conDolar.map(spreadDe)
  } catch {
    reventó = true
  }
  comprobar(reventó, 'usarlo como `.map(spreadDe)` revienta, no devuelve un número falso')
}

// --- 3. Un par desconocido se mide CARO, no barato ------------------------

console.log('\n3. Un par que no está en la tabla se mide caro')
{
  const desconocido = spreadDe('XXX/YYY')
  comprobar(desconocido === SPREAD_POR_DEFECTO, `usa el valor por defecto (${SPREAD_POR_DEFECTO})`)
  comprobar(
    desconocido >= Math.max(...Object.values(SPREAD_PIPS)) * 0.8,
    'y ese valor es alto, para que un par nuevo no parezca barato por descuido'
  )
}

// --- 4. El swap se paga POR NOCHE ----------------------------------------

console.log('\n4. El swap se cobra por cada noche abierta')
{
  const par = 'EUR/USD'
  const base = spreadDe(par)
  cerca(costeEnPips(par, 0, 0.5), base, 1e-12, 'sin noches, solo se paga el spread')
  cerca(costeEnPips(par, 1, 0.5), base + 0.5, 1e-12, 'una noche añade un swap')
  cerca(costeEnPips(par, 12, 0.5), base + 6, 1e-12, '12 noches añaden 6 pips')
  cerca(costeEnPips(par, 12, 2.0), base + 24, 1e-12, 'y a 2 pips por noche, 24')

  // La diferencia entre las dos filas de arriba es el motivo de que esto exista:
  // 18 pips de diferencia por operación según el bróker que se use.
  comprobar(
    costeEnPips(par, 12, 2.0) - costeEnPips(par, 12, 0.5) === 18,
    'entre el bróker barato y el caro hay 18 pips por operación'
  )
}

// --- 5. EL ERROR DE SIGNO, que es el que arruinaría todo ------------------
//
// Si un coste restara en vez de sumar, la tabla saldría MEJOR cuantos más
// costes se descuentan. Nadie lo notaría leyendo, porque los números seguirían
// teniendo buena pinta — solo que dirían lo contrario de la verdad.

console.log('\n5. Más costes SIEMPRE es peor, nunca mejor')
{
  const par = 'GBP/JPY'
  let creciente = true
  let anterior = -Infinity
  for (const nivel of NIVELES_SWAP) {
    const c = costeEnPips(par, 10, nivel)
    if (c < anterior) creciente = false
    anterior = c
  }
  comprobar(creciente, `el coste sube en cada nivel de swap: ${NIVELES_SWAP.join(', ')}`)

  let masNoches = true
  anterior = -Infinity
  for (const noches of [0, 1, 5, 20, 60]) {
    const c = costeEnPips(par, noches, 1.0)
    if (c < anterior) masNoches = false
    anterior = c
  }
  comprobar(masNoches, 'y sube también cuantas más noches se aguante la operación')

  comprobar(costeEnPips(par, 0, 0) > 0, 'incluso sin swap se paga algo: el spread nunca es cero')
}

// --- 6. Entradas raras no rompen ni regalan dinero ------------------------

console.log('\n6. Entradas raras no rompen la cuenta')
{
  const par = 'EUR/USD'
  cerca(costeEnPips(par, -5, 1.0), spreadDe(par), 1e-12, 'noches negativas se tratan como cero, no como un descuento')
  cerca(costeEnPips(par), spreadDe(par), 1e-12, 'sin argumentos, solo el spread')
  comprobar(Number.isFinite(costeEnPips('XXX/YYY', 100, 2)), 'un par desconocido con muchas noches sigue dando un número')
}

// --- 7. Los niveles que se miden cubren lo realista ----------------------

console.log('\n7. Los niveles de swap que se barren tienen sentido')
{
  comprobar(NIVELES_SWAP.includes(0), 'incluye el 0, para comparar contra no contar nada')
  comprobar(Math.max(...NIVELES_SWAP) >= 2, 'y llega a 2 pips por noche, el lado caro de lo normal')
  comprobar(
    NIVELES_SWAP.every((n, i) => i === 0 || n > NIVELES_SWAP[i - 1]),
    'y van ordenados de menor a mayor, para que la tabla se lea de corrido'
  )
}


// --- 8. LA CUENTA QUE PRODUCE TODOS LOS NÚMEROS --------------------------
//
// `medir()` es de donde salen el acierto, los pips y el "por 1R" con los que
// se decide encender o apagar una regla. Hasta ahora vivía dentro de
// backtest.mjs y no se podía probar sin internet: la cuenta que más pesa era
// la única sin comprobar.

console.log('\n8. La cuenta del banco de pruebas aplica bien los costes')
{
  // Una operación ganada y una perdida, con riesgo y beneficio conocidos, para
  // poder calcular a mano lo que tiene que salir.
  const senales = [
    { id: 'A', vistoEl: 't1', par: 'EUR/USD', pipRiesgo: 100, pipBeneficio: 200 },
    { id: 'B', vistoEl: 't2', par: 'EUR/USD', pipRiesgo: 100, pipBeneficio: 200 },
  ]
  // ⚠️ AQUÍ ESTÁ LA DIFERENCIA CON SWING, y es la razón de que esta prueba se
  // adaptara en vez de copiarse. En swing basta con decir "tardó 10 días"
  // porque allí cada vela ES un día. Aquí las noches salen de las HORAS de
  // entrada y salida, así que las operaciones de mentira tienen que traer
  // fechas de verdad o no pagarían ni un swap y la prueba pasaría en falso.
  //
  // Del 10 de agosto a las 08:00 al 20 a las 10:00: los cortes de las 22:00
  // del 10 al 19 → 10 noches, que es lo que se calcula a mano más abajo.
  const entrada = '2026-08-10 08:00:00'
  const porClave = new Map([
    ['A@t1', { resultado: 'ganada', pips: 200, velaEntrada: entrada, velaFinal: '2026-08-20 10:00:00' }],
    ['B@t2', { resultado: 'perdida', pips: -100, velaEntrada: entrada, velaFinal: '2026-08-20 10:00:00' }],
  ])

  // Se comprueba el conteo por separado: si estas dos fechas dejaran de dar 10
  // noches, todas las cuentas de abajo saldrían mal y el mensaje de error no
  // diría por qué.
  comprobar(nochesEntre(entrada, '2026-08-20 10:00:00') === 10, 'las fechas de prueba dan las 10 noches que se calculan a mano')

  const sin = medir(senales, porClave)
  comprobar(sin.total === 2 && sin.ganadas === 1, 'cuenta las dos operaciones, una ganada')
  cerca(sin.acierto, 50, 1e-9, 'el acierto es el 50%')
  // Ganada +2R, perdida −1R → media +0,5R.
  cerca(sin.porRiesgo, 0.5, 1e-9, 'sin costes da +0,5 por unidad de riesgo')
  cerca(sin.pips, 100, 1e-9, 'y +100 pips netos')

  // Con costes: spread de EUR/USD (0,9) + 10 noches × 0,5 = 5,9 pips por
  // operación. Sobre un riesgo de 100 pips eso es 0,059 de cada unidad.
  const con = medir(senales, porClave, { conSpread: true, swapPipsNoche: 0.5 })
  cerca(con.porRiesgo, 0.5 - 0.059, 1e-9, 'con spread y 10 noches de swap baja a +0,441')
  // 100 − 2×5,9 = 88,2, y `medir` devuelve los pips REDONDEADOS a entero (son
  // para leer en una tabla, no para volver a operar con ellos). Por eso se
  // compara con 88 y no con 88,2.
  comprobar(con.pips === Math.round(100 - 2 * 5.9), 'y los pips bajan en el coste de las DOS operaciones')
  comprobar(con.acierto === sin.acierto, 'el acierto NO cambia: los costes no mueven quién ganó')

  // EL ERROR DE SIGNO, otra vez, pero ya en la cuenta final.
  comprobar(con.porRiesgo < sin.porRiesgo, 'contar costes SIEMPRE empeora el resultado, nunca lo mejora')

  // Que el swap dependa de las NOCHES, no de un número plano. Misma entrada,
  // salida el 9 de septiembre: 30 cortes en vez de 10.
  const porClaveLargo = new Map([
    ['A@t1', { resultado: 'ganada', pips: 200, velaEntrada: entrada, velaFinal: '2026-09-09 10:00:00' }],
    ['B@t2', { resultado: 'perdida', pips: -100, velaEntrada: entrada, velaFinal: '2026-09-09 10:00:00' }],
  ])
  const largo = medir(senales, porClaveLargo, { conSpread: true, swapPipsNoche: 0.5 })
  comprobar(largo.porRiesgo < con.porRiesgo, 'aguantar 30 noches cuesta más que aguantar 10')

  // Y que el par importe: el mismo trato en un cruce caro cuesta más.
  const enCruce = senales.map((x) => ({ ...x, par: 'NZD/CHF' }))
  const caro = medir(enCruce, porClave, { conSpread: true, swapPipsNoche: 0.5 })
  comprobar(caro.porRiesgo < con.porRiesgo, 'la misma operación en un cruce caro rinde menos que en EUR/USD')

  // Las que no se resolvieron no cuentan ni a favor ni en contra.
  const conAbierta = medir(
    [...senales, { id: 'C', vistoEl: 't3', par: 'EUR/USD', pipRiesgo: 100, pipBeneficio: 200 }],
    porClave
  )
  comprobar(conAbierta.total === 2 && conAbierta.sinJuzgar === 1, 'una operación sin resolver se aparta, no se cuenta como perdida')
  cerca(conAbierta.porRiesgo, sin.porRiesgo, 1e-9, 'y no mueve el resultado')
}


// --- 9. CONTAR LAS NOCHES, que es lo propio de intradía -------------------
//
// En swing cada vela ES un día, así que las noches salen solas. Aquí son velas
// de una hora, y cruzar el corte del swap depende de A QUÉ HORA se abrió la
// operación, no de cuánto duró. Una de 6 horas abierta a las 20:00 cruza; una
// de 20 horas abierta a las 23:00 no.
//
// Esto importa de verdad: de las 42 operaciones reales ya resueltas, 22 (52%)
// cruzaron al menos una noche, con una duración máxima de 102 horas. La app se
// llama Intradía pero más de la mitad de sus operaciones duermen abiertas.

console.log('\n9. Las noches se cuentan por el corte real, no por la duración')
{
  const d = (dia, hora) => `2026-08-${String(dia).padStart(2, '0')} ${String(hora).padStart(2, '0')}:00:00`

  comprobar(nochesEntre(d(10, 8), d(10, 16)) === 0, 'una operación dentro del mismo día no cruza ninguna noche')
  comprobar(nochesEntre(d(10, 20), d(11, 2)) === 1, 'pero una de SEIS horas abierta a las 20:00 sí cruza una')
  comprobar(nochesEntre(d(10, 23), d(11, 19)) === 0, 'y una de VEINTE horas abierta a las 23:00 no cruza ninguna')
  comprobar(nochesEntre(d(10, 8), d(13, 8)) === 3, 'tres días seguidos son tres noches')

  // El borde exacto: entrar justo a la hora del corte no cuenta esa noche
  // (ya pasó en el mismo instante de entrar), pero salir justo en el corte sí
  // la cuenta (se pagó). Son las dos mitades de la misma decisión: `corte <=
  // ini` salta el de la entrada y `corte <= fin` incluye el de la salida.
  comprobar(nochesEntre(d(10, HORA_CORTE_UTC), d(11, 10)) === 0, 'entrar justo en el corte no paga ESA noche')
  comprobar(nochesEntre(d(10, HORA_CORTE_UTC), d(12, 10)) === 1, 'pero sí paga la siguiente si aguanta hasta pasarla')
  comprobar(nochesEntre(d(10, 10), d(10, HORA_CORTE_UTC)) === 1, 'salir justo en el corte sí lo paga')

  comprobar(nochesEntre(d(10, 10), d(10, 8)) === 0, 'una salida anterior a la entrada da 0, no un número negativo')
  comprobar(nochesEntre(null, d(10, 8)) === 0, 'sin entrada da 0 en vez de reventar')
  comprobar(nochesEntre(d(10, 8), undefined) === 0, 'sin salida, igual')
  comprobar(nochesEntre('no es una fecha', d(10, 8)) === 0, 'una fecha ilegible da 0')

  // Y que de verdad se traduzca en dinero.
  const barato = costeEnPips('EUR/USD', nochesEntre(d(10, 8), d(10, 16)), 1.0)
  const caro = costeEnPips('EUR/USD', nochesEntre(d(10, 8), d(13, 8)), 1.0)
  comprobar(caro > barato, 'aguantar tres noches cuesta más que cerrar el mismo día')
  cerca(caro - barato, 3, 1e-12, 'exactamente tres pips más, a un pip por noche')
}

// --- 10. EL BARRIDO DE SWAP -----------------------------------------------
//
// Es la tabla que responde "¿a partir de qué swap cambia la conclusión?". Se
// prueba aquí y no se deja dentro de backtest.mjs por un motivo concreto: la
// primera versión vivía en el script y llamaba mal a una función. El linter no
// lo vio, porque los dos nombres existían, y el script necesita descargar
// miles de velas antes de llegar a esa línea — o sea que el fallo habría
// aparecido con los créditos del día ya gastados.

console.log('\n10. El barrido de swap cuenta bien las noches y el coste')
{
  const senales = [
    // Cierra el mismo día: no cruza ninguna noche.
    { id: 'D', vistoEl: 'u1', par: 'EUR/USD', pipRiesgo: 100, pipBeneficio: 100 },
    // Se queda tres noches abierta.
    { id: 'E', vistoEl: 'u2', par: 'EUR/USD', pipRiesgo: 100, pipBeneficio: 100 },
  ]
  const porClave = new Map([
    ['D@u1', { resultado: 'ganada', pips: 100, velaEntrada: '2026-08-10 08:00:00', velaFinal: '2026-08-10 16:00:00' }],
    ['E@u2', { resultado: 'perdida', pips: -100, velaEntrada: '2026-08-10 08:00:00', velaFinal: '2026-08-13 08:00:00' }],
  ])

  const b = barridoSwap(senales, porClave)
  comprobar(b.total === 2, 'cuenta las dos operaciones resueltas')
  comprobar(b.cruzaron === 1, 'y ve que solo UNA de las dos durmió abierta')
  cerca(b.mediaNoches, 1.5, 1e-12, 'la media de noches es 1,5 (0 y 3)')
  comprobar(b.filas.length === NIVELES_SWAP.length, `saca una fila por cada nivel (${NIVELES_SWAP.length})`)

  // A swap 0 solo se paga el spread: 0,9 en las dos.
  cerca(b.filas[0].costeMedio, 0.9, 1e-12, 'a swap cero, el coste medio es solo el spread')

  // A 1 pip por noche: (0,9 + 0) y (0,9 + 3) → media 2,4.
  const uno = b.filas.find((f) => f.nivel === 1.0)
  cerca(uno.costeMedio, (0.9 + 0.9 + 3) / 2, 1e-12, 'a un pip por noche, la que durmió tres arrastra la media a 2,4')

  // EL ERROR DE SIGNO otra vez, ahora en la tabla entera: subir el swap tiene
  // que empeorar el "por 1R" en todas las filas, sin una sola excepción.
  let empeoraSiempre = true
  for (let i = 1; i < b.filas.length; i++) {
    if (b.filas[i].medicion.porRiesgo > b.filas[i - 1].medicion.porRiesgo) empeoraSiempre = false
    if (b.filas[i].costeMedio < b.filas[i - 1].costeMedio) empeoraSiempre = false
  }
  comprobar(empeoraSiempre, 'y de fila en fila el coste sube y el resultado baja, nunca al revés')

  // El acierto es lo único que NO se mueve: los costes no cambian si el precio
  // llegó al objetivo o al stop.
  comprobar(
    b.filas.every((f) => f.medicion.acierto === b.filas[0].medicion.acierto),
    'el acierto es el mismo en todas las filas, como debe'
  )

  // Una lista sin nada resuelto no debe reventar ni inventar un promedio.
  const vacio = barridoSwap(senales, new Map())
  comprobar(vacio.total === 0 && vacio.mediaNoches === 0, 'sin operaciones resueltas devuelve ceros, no NaN')
  comprobar(vacio.filas.every((f) => Number.isFinite(f.costeMedio)), 'y ningún coste medio sale NaN')
}

console.log('\n10. El acierto de equilibrio: cuánto hay que acertar para no perder')
{
  // ⚠️ ESTA COLUMNA EXISTE PARA EVITAR UN AUTOENGAÑO CONCRETO, y por eso se
  // prueba con casos donde la respuesta se sabe de memoria.
  //
  // Sin ella, comparar dos geometrías por su porcentaje de acierto es comparar
  // con dos varas distintas: acercar el objetivo sube el acierto Y sube el
  // listón. En Swing una geometría con 55 % de acierto perdía dinero porque su
  // equilibrio estaba en 57 %.
  const par = (k) => [
    { id: 'A', vistoEl: 't1', par: 'EUR/USD', pipRiesgo: 100, pipBeneficio: 100 * k },
    { id: 'B', vistoEl: 't2', par: 'EUR/USD', pipRiesgo: 100, pipBeneficio: 100 * k },
  ]
  const res = new Map([
    ['A@t1', { resultado: 'ganada', pips: 0, velaEntrada: '2026-08-10 08:00:00', velaFinal: '2026-08-10 12:00:00' }],
    ['B@t2', { resultado: 'perdida', pips: 0, velaEntrada: '2026-08-10 08:00:00', velaFinal: '2026-08-10 12:00:00' }],
  ])
  const eq = (k) => medir(par(k), res).equilibrio

  // Sin costes, objetivo = riesgo (1:1): hay que ganar la mitad. Es la vara
  // neutra, y su equilibrio del 50 % es lo que la hace una vara honesta.
  comprobar(Math.abs(eq(1) - 50) < 1e-9, `con objetivo 1× el equilibrio es 50 % (${eq(1).toFixed(1)})`)
  // Objetivo al doble del riesgo: basta acertar una de cada tres.
  comprobar(Math.abs(eq(2) - 100 / 3) < 1e-9, `con objetivo 2× baja a 33,3 % (${eq(2).toFixed(1)})`)
  // Objetivo a la mitad: hay que acertar dos de cada tres. Éste es el caso que
  // engaña: sube el acierto y sube más el listón.
  comprobar(Math.abs(eq(0.5) - 200 / 3) < 1e-9, `con objetivo 0,5× sube a 66,7 % (${eq(0.5).toFixed(1)})`)

  // Y tiene que MOVERSE con los costes: pagar spread sube el listón.
  const sin = medir(par(1), res).equilibrio
  const con = medir(par(1), res, { conSpread: true }).equilibrio
  comprobar(con > sin, `pagar costes sube el equilibrio (${sin.toFixed(1)} → ${con.toFixed(1)})`)

  // Sin operaciones resueltas devuelve null, no NaN: una fila vacía no puede
  // enseñar un número inventado.
  comprobar(medir(par(1), new Map()).equilibrio === null, 'sin nada resuelto devuelve null, no NaN')

  // ⚠️ Y QUE AVISE CUANDO EL NÚMERO ES SOLO APROXIMADO.
  //
  // La fórmula usa la proporción MEDIA. Con todas iguales es exacto; con cada
  // operación con la suya —la geometría de la app— deja de serlo. Se vio en la
  // corrida del 2026-09-05: acierto 32 % y equilibrio 32 %, empatados, y aun
  // así −0,10 por unidad de riesgo. Empatar debería dar cero.
  {
    const mismas = medir(par(2), res)
    comprobar(mismas.equilibrioExacto === true, 'con todas iguales, el equilibrio se marca EXACTO')

    const distintas = [
      { id: 'A', vistoEl: 't1', par: 'EUR/USD', pipRiesgo: 100, pipBeneficio: 100 },
      { id: 'B', vistoEl: 't2', par: 'EUR/USD', pipRiesgo: 100, pipBeneficio: 300 },
    ]
    const m = medir(distintas, res)
    comprobar(m.equilibrioExacto === false, 'con proporciones distintas se marca APROXIMADO')
    comprobar(medir(par(1), new Map()).equilibrioExacto === null, 'y sin nada resuelto, ni exacto ni aproximado: null')
  }

  // LA COMPROBACIÓN QUE DE VERDAD IMPORTA: que el equilibrio y el resultado
  // cuenten la misma historia. Si el acierto real iguala al equilibrio, el
  // resultado por unidad de riesgo tiene que ser cero.
  {
    const k = 2
    // Tres operaciones, una ganada: 33,3 % de acierto, justo el equilibrio de
    // un objetivo 2×. El resultado tiene que salir clavado en cero.
    const tres = [
      { id: 'A', vistoEl: 't1', par: 'EUR/USD', pipRiesgo: 100, pipBeneficio: 100 * k },
      { id: 'B', vistoEl: 't2', par: 'EUR/USD', pipRiesgo: 100, pipBeneficio: 100 * k },
      { id: 'C', vistoEl: 't3', par: 'EUR/USD', pipRiesgo: 100, pipBeneficio: 100 * k },
    ]
    const r3 = new Map([
      ['A@t1', { resultado: 'ganada', pips: 0 }],
      ['B@t2', { resultado: 'perdida', pips: 0 }],
      ['C@t3', { resultado: 'perdida', pips: 0 }],
    ])
    const m = medir(tres, r3)
    comprobar(
      Math.abs(m.acierto - m.equilibrio) < 1e-9 && Math.abs(m.porRiesgo) < 1e-9,
      `acertar justo el equilibrio deja el resultado en cero (${m.porRiesgo.toFixed(6)})`
    )
  }
}

console.log('\n11. Se puede medir con OTRA tabla de spreads sin tocar la oficial')
{
  // ⚠️ El fallo que esto vigila es SILENCIOSO: si `tablaSpread` se ignorara,
  // las dos columnas saldrían idénticas y parecería que «el bróker da igual».
  // Esa es exactamente la conclusión falsa más cómoda de creer.
  const caros = { 'EUR/USD': 20 }
  const senales = [
    { id: 'A', vistoEl: 't1', par: 'EUR/USD', pipRiesgo: 100, pipBeneficio: 100 },
    { id: 'B', vistoEl: 't2', par: 'EUR/USD', pipRiesgo: 100, pipBeneficio: 100 },
  ]
  const res = new Map([
    ['A@t1', { resultado: 'ganada', pips: 100 }],
    ['B@t2', { resultado: 'perdida', pips: -100 }],
  ])
  const normal = medir(senales, res, { conSpread: true })
  const caro = medir(senales, res, { conSpread: true, tablaSpread: caros })
  comprobar(caro.porRiesgo < normal.porRiesgo, `una tabla más cara da PEOR resultado (${normal.porRiesgo.toFixed(3)} → ${caro.porRiesgo.toFixed(3)})`)

  // Con 20 pips sobre un riesgo de 100, el coste es 0,2 por operación. Se paga
  // se gane o se pierda, así que el resultado baja exactamente 0,2.
  comprobar(
    Math.abs(caro.porRiesgo - (0 - 0.2)) < 1e-9,
    `y la cuenta cuadra a mano: 20 pips sobre 100 de riesgo = −0,200 (${caro.porRiesgo.toFixed(3)})`
  )

  // Un par que no esté en la tabla nueva cae al valor por defecto, no revienta
  // ni se cuela gratis.
  const otro = medir(
    [{ id: 'C', vistoEl: 't3', par: 'XXX/YYY', pipRiesgo: 100, pipBeneficio: 100 }],
    new Map([['C@t3', { resultado: 'ganada', pips: 100 }]]),
    { conSpread: true, tablaSpread: caros }
  )
  comprobar(Number.isFinite(otro.porRiesgo), 'un par ausente de la tabla usa el valor por defecto, no NaN')

  // Y sin pasar nada, manda la tabla oficial: el ensayo no puede contaminar
  // las mediciones de verdad.
  comprobar(
    medir(senales, res, { conSpread: true }).porRiesgo === normal.porRiesgo,
    'sin pasar tabla, manda la oficial'
  )
}

console.log('')
console.log(fallos ? `${fallos} comprobación(es) FALLARON` : 'El modelo de costes se comporta como debe.')
process.exit(fallos ? 1 : 0)
