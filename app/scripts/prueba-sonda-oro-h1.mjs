// Comprobaciones de la sonda del oro en velas de una hora. SIN INTERNET.
//
//     node scripts/prueba-sonda-oro-h1.mjs
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ UNA SONDA LLEVA PRUEBAS
// ─────────────────────────────────────────────────────────────────────────
// Porque lo que puede salir mal aquí no es la llamada —eso falla con un
// mensaje— sino **el veredicto**, que se equivoca en silencio y encima se lee
// como la conclusión. Hay dos casos ya ocurridos en este proyecto:
//
//   · 2026-09-29, sonda de los huecos: el resumen dijo «SÍ — sirven: XAU/USD,
//     CL, GOLD» mientras su propio detalle traía el `meta` que desmentía a dos
//     de los tres.
//   · 2026-09-14, sonda del sentimiento: el informe dijo «no la publican
//     abiertamente» **habiendo leído CERO páginas**.
//
// Las dos veces el fallo fue el mismo: confundir «no se pudo mirar» con «no
// existe». Estas comprobaciones existen para que esa confusión falle aquí y no
// en el log de una corrida que ya gastó los créditos.
//
// Los cuerpos de mentira reproducen la FORMA de lo que Twelve Data devolvió de
// verdad, incluido el 200-con-error-dentro de `WTI/USD` y el 200-con-velas de
// `GOLD`, que es una acción.

import {
  TIPOS_DE_ORO,
  esOroDeVerdad,
  juzgarRespuesta,
  horasDe,
  cruzarHoras,
  barrasPorDia,
  rejillaRellenada,
  clasificarHora,
  repartoDeMercado,
  proporcionPlanas,
  veredicto,
} from './lib/sonda-oro.mjs'

let hechas = 0
let fallos = 0
const ok = (cond, que) => {
  hechas++
  if (cond) return true
  fallos++
  console.error(`  ✗ ${que}`)
  return false
}

const vela = (t) => ({ datetime: t, open: '4150.0', high: '4155.0', low: '4148.0', close: '4152.0' })

// Una rejilla HONESTA: 24 velas de una hora, solo de lunes a viernes, durante
// `semanas` semanas. Arranca el lunes 2026-09-07.
function horasHabiles(semanas) {
  const out = []
  const d = new Date(Date.UTC(2026, 8, 7)) // lunes
  for (let i = 0; i < semanas * 7; i++) {
    if (d.getUTCDay() >= 1 && d.getUTCDay() <= 5) {
      const f = d.toISOString().slice(0, 10)
      for (let h = 0; h < 24; h++) out.push(`${f} ${String(h).padStart(2, '0')}:00:00`)
    }
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

// ── 1. `esOroDeVerdad` ───────────────────────────────────────────────────
console.log('1. ¿es oro de verdad?')
{
  ok(esOroDeVerdad({ type: 'Precious Metal' }), 'Precious Metal es oro')
  ok(esOroDeVerdad({ type: 'precious metal' }), 'y no distingue mayúsculas')
  ok(esOroDeVerdad({ type: 'Commodity' }), 'Commodity también')

  // ⚠️ LOS TRES CASOS REALES DE LA SONDA DEL 2026-09-29. Los tres contestaron
  // 200 con velas válidas y ninguno era lo que decía su nombre.
  ok(!esOroDeVerdad({ type: 'Common Stock' }), 'una acción NO es oro (era `GOLD`, 42,85)')
  ok(!esOroDeVerdad({ type: 'ADR' }), 'un ADR tampoco (era `BZ`, reclutamiento)')
  ok(!esOroDeVerdad({}), 'sin `type` no se da por bueno')
  ok(!esOroDeVerdad(null), 'y un meta nulo tampoco')
  ok(TIPOS_DE_ORO.length >= 2, 'la lista de tipos no se quedó vacía')
}

// ── 2. `juzgarRespuesta`: los tres valores de `sirve` ────────────────────
console.log('2. el juicio de cada respuesta')
{
  const bueno = juzgarRespuesta({
    http: 200,
    cuerpo: { meta: { type: 'Precious Metal', currency_base: 'Gold Spot' }, values: [vela('2026-09-30 14:00:00')] },
  })
  ok(bueno.sirve === true, 'oro con velas → sirve')

  // ⚠️ EL CASO QUE MÁS IMPORTA: 200 con el error DENTRO. Es como Twelve Data
  // dice «este símbolo no está en tu plan» — no con un 403.
  const fueraDePlan = juzgarRespuesta({
    http: 200,
    cuerpo: {
      status: 'error',
      code: 403,
      message: 'This symbol is available starting with the Grow or Venture plan.',
    },
  })
  ok(fueraDePlan.sirve === false, 'un 200 con `status: error` dentro es un NO, no un sí')
  ok(fueraDePlan.clave === 'la-api-dice-error', 'y se nombra por lo que es')

  const acciones = juzgarRespuesta({
    http: 200,
    cuerpo: { meta: { type: 'Common Stock' }, values: [vela('2026-09-30 14:00:00')] },
  })
  ok(acciones.sirve === false, '200 con velas de una ACCIÓN es un NO')
  ok(acciones.clave === 'no-es-oro', 'y dice que el problema es el tipo')
  ok(/Common Stock/.test(acciones.detalle), 'y el detalle nombra el tipo que llegó')

  const vacio = juzgarRespuesta({ http: 200, cuerpo: { meta: { type: 'Precious Metal' }, values: [] } })
  ok(vacio.sirve === false, 'respondió bien y sin velas: es un NO')
  ok(vacio.clave === 'sin-velas', 'con su clave propia')

  // ⚠️⚠️ Y LOS TRES QUE TIENEN QUE DAR `null`, QUE ES EL SENTIDO DE TODO ESTO.
  const caida = juzgarRespuesta({ error: 'fetch failed' })
  ok(caida.sirve === null, 'la red caída NO es un «no»: es «no se pudo mirar»')

  const ilegible = juzgarRespuesta({ http: 200, cuerpo: null })
  ok(ilegible.sirve === null, 'un cuerpo ilegible tampoco es un «no»')

  const raro = juzgarRespuesta({ http: 502, cuerpo: {} })
  ok(raro.sirve === null, 'un 502 sin explicación dentro tampoco es un «no»')

  // Y la comprobación que de verdad muerde: ninguno de los tres puede pasar
  // por `false`. Es el fallo exacto de la sonda del sentimiento.
  for (const r of [caida, ilegible, raro]) {
    ok(r.sirve !== false, `«no se pudo mirar» nunca se convierte en «no» (${r.clave})`)
  }
}

// ── 3. `horasDe` ─────────────────────────────────────────────────────────
console.log('3. las marcas de tiempo')
{
  const h = horasDe([vela('2026-09-30 14:00:00'), vela('2026-09-30 12:00:00'), vela('2026-09-30 13:00:00')])
  ok(h.length === 3, 'las lee todas')
  ok(h[0] === '2026-09-30 12:00:00' && h[2] === '2026-09-30 14:00:00', 'y las ordena de vieja a nueva')

  ok(horasDe([{ datetime: '2026-09-30' }]).length === 0, 'una fecha SIN hora no cuela como vela horaria')
  ok(horasDe([{ datetime: 'ayer' }]).length === 0, 'ni un texto cualquiera')
  ok(horasDe(null).length === 0, 'y un valor nulo no revienta')
}

// ── 4. `cruzarHoras`: las cuentas del calendario ─────────────────────────
console.log('4. el cruce de calendarios')
{
  const pares = ['2026-09-30 12:00:00', '2026-09-30 13:00:00', '2026-09-30 14:00:00']
  const oro = ['2026-09-30 12:00:00', '2026-09-30 14:00:00', '2026-09-29 21:00:00']

  const c = cruzarHoras(oro, pares)
  ok(c.comunes.length === 2, 'cuenta 2 horas comunes')
  ok(c.soloPares.length === 1 && c.soloPares[0] === '2026-09-30 13:00:00', 'y la que solo tienen los pares')
  ok(c.soloOro.length === 1 && c.soloOro[0] === '2026-09-29 21:00:00', 'y la que solo tiene el oro')
  ok(Math.abs(c.conservado - 2 / 3) < 1e-9, 'y qué proporción de las horas de los pares se conserva')

  // La forma de lo que falta: agrupada por hora del día.
  ok(c.porHoraDelDia['13'] === 1, 'agrupa lo que falta por hora del día')

  // ⚠️ `null` y no 0 cuando no hay con qué calcular: un 0 diría «no se
  // conserva ninguna», que es una afirmación. Misma decisión que `pearson`.
  ok(cruzarHoras(oro, []).conservado === null, 'sin horas de los pares dice «no lo sé», no 0')
  ok(cruzarHoras([], pares).conservado === 0, 'pero con oro vacío SÍ se conserva 0: eso está medido')

  // El caso «parada de mantenimiento»: lo que falta se concentra en una hora
  // del día. Es la forma que distingue un horario de una avería.
  const paresSemana = []
  const oroSemana = []
  for (let d = 1; d <= 10; d++) {
    for (let h = 0; h < 24; h++) {
      const t = `2026-09-${String(d).padStart(2, '0')} ${String(h).padStart(2, '0')}:00:00`
      paresSemana.push(t)
      if (h !== 21) oroSemana.push(t) // el oro se para a las 21:00
    }
  }
  const cs = cruzarHoras(oroSemana, paresSemana)
  ok(Object.keys(cs.porHoraDelDia).length === 1, 'una parada diaria afecta a UNA sola hora del día')
  ok(cs.porHoraDelDia['21'] === 10, 'y sale diez veces en diez días')
  ok(Math.abs(cs.conservado - 23 / 24) < 1e-9, 'y se conserva el 23/24 de las horas')

  // El caso «avería»: lo que falta está repartido por todas las horas. La
  // cuenta tiene que distinguirlo del anterior, porque las dos situaciones se
  // ven igual en el total y significan cosas opuestas.
  const oroRoto = paresSemana.filter((_, i) => i % 2 === 0)
  const cr = cruzarHoras(oroRoto, paresSemana)
  ok(Object.keys(cr.porHoraDelDia).length > 5, 'una avería afecta a muchas horas del día, no a una')
}

// ── 4b. `barrasPorDia` y `rejillaRellenada` ──────────────────────────────
//
// ⚠️ ESTE BLOQUE ES LA CORRECCIÓN DE UN AGUJERO DE LA PRIMERA VERSIÓN. La
// primera corrida imprimió «se conserva el 100 % de las horas» y «los dos
// calendarios coinciden enteros» — verdad las dos, y engañoso el conjunto: los
// calendarios coincidían porque Twelve Data sirve los dos en la misma rejilla
// uniforme de 24 velas por día, no porque el oro y el Forex abran igual.
console.log('4b. ¿la rejilla trae horas en las que no se negoció?')
{
  // ⚠️⚠️ ESTE PAR DE COMPROBACIONES DESTAPÓ UN AGUJERO EN LA PROPIA MEDIDA, y
  // por eso se quedan escritas así.
  //
  // Una rejilla HONESTA de lunes a viernes, 24 h cada día, medida sobre SU
  // tramo (lunes 00:00 → viernes 23:00 = 4,96 días) da 24,2 velas por día y se
  // marcaría como rellenada. No estaba mal calculada: estaba mal PREGUNTADA,
  // porque en ese tramo no cabe ningún fin de semana que rebaje la media. De
  // ahí `MIN_DIAS_PARA_JUZGAR`.
  const unaSemana = []
  for (const d of ['07', '08', '09', '10', '11']) {
    // 2026-09-07 es lunes; del 7 al 11, viernes.
    for (let h = 0; h < 24; h++) unaSemana.push(`2026-09-${d} ${String(h).padStart(2, '0')}:00:00`)
  }
  ok(rejillaRellenada(unaSemana, 1) === null, 'un tramo de 5 días NO se juzga: diría 24/día siendo honesto')
  ok(barrasPorDia(unaSemana) > 24, 'y la razón es que en 5 días hábiles salen más de 24 por día')

  // La misma rejilla honesta, pero sobre DOCE semanas: ahí sí aparece el 17,1.
  const habiles = horasHabiles(12)
  const rHabil = rejillaRellenada(habiles, 1)
  ok(rHabil !== null, 'con doce semanas sí se puede juzgar')
  ok(rHabil.rellenada === false, 'y una rejilla de solo días hábiles NO se marca')
  ok(Math.abs(rHabil.porDia - 120 / 7) < 1.5, `sale cerca de 17,1 y sale ${rHabil.porDia.toFixed(1)}`)

  // Una rejilla uniforme 24×7, que es lo que devolvió Twelve Data de verdad.
  const todos = []
  for (let d = 1; d <= 28; d++) {
    for (let h = 0; h < 24; h++) {
      todos.push(`2026-09-${String(d).padStart(2, '0')} ${String(h).padStart(2, '0')}:00:00`)
    }
  }
  const rTodo = rejillaRellenada(todos, 1)
  ok(Math.abs(rTodo.porDia - 24) < 0.05, 'una rejilla 24×7 da 24 velas por día de calendario')
  ok(rTodo.rellenada === true, 'y 24 por día SÍ se marca: el mercado abierto solo da 17,1')
  ok(Math.abs(rTodo.esperadas - 120 / 7) < 1e-9, 'las esperadas son 120 horas de mercado entre 7 días')

  // ⚠️ El caso de `15min`, donde el número esperado es OTRO. Sin pasarle
  // `porHora` una rejilla honesta de 15 minutos se marcaría como rellenada:
  // 4 velas por hora × 17,1 horas = 68,6 por día, que es mucho más que 17,1.
  const quinces = []
  for (const t of habiles) {
    for (const m of ['00', '15', '30', '45']) quinces.push(t.slice(0, 14) + m + ':00')
  }
  ok(rejillaRellenada(quinces, 4).rellenada === false, 'una rejilla honesta de 15min no se marca si se le dice el intervalo')
  ok(rejillaRellenada(quinces, 1).rellenada === true, 'y sin decírselo se marcaría mal: por eso `porHora` existe')

  // Los números REALES de la corrida del 2026-09-30, que son lo que destapó
  // esto. No se inventan: 5000 velas entre esas dos fechas.
  const real1h = 5000 / ((new Date('2026-09-30T20:00:00Z') - new Date('2026-03-06T12:00:00Z')) / 86_400_000)
  ok(real1h > 23.5 && real1h < 24.5, `la corrida real dio ~24 velas/día y da ${real1h.toFixed(1)}`)
  ok(real1h > (120 / 7) * 1.1, 'y eso está por encima de lo que el mercado abierto permite')

  // `null`, nunca 0, cuando no hay con qué.
  ok(barrasPorDia([]) === null, 'sin horas dice «no lo sé», no 0')
  ok(barrasPorDia(['2026-09-07 00:00:00']) === null, 'con una sola hora tampoco se puede')
  ok(rejillaRellenada([]) === null, 'y la rejilla tampoco se juzga sin datos')
}

// ── 4c. `clasificarHora`: las tres clases, y sus bordes ──────────────────
console.log('4c. ¿esta hora puede ser mercado?')
{
  // Mercado seguro: cualquier hora de lunes a jueves, y el viernes de día.
  ok(clasificarHora('2026-09-07 09:00:00') === 'mercado', 'lunes a las 9 es mercado')
  ok(clasificarHora('2026-09-10 23:00:00') === 'mercado', 'jueves a las 23 es mercado')
  ok(clasificarHora('2026-09-11 20:00:00') === 'mercado', 'viernes a las 20 todavía es mercado')

  // ⚠️⚠️ EL CASO QUE HACE FALTA ACERTAR: el domingo por la noche ABRE el
  // mercado. Llamarlo «cerrado» sería la etiqueta equivocada, y en este
  // proyecto eso está escrito como un error de medición.
  ok(clasificarHora('2026-09-13 22:00:00') === 'frontera', 'el domingo a las 22 NO se llama cerrado: abre el mercado')
  ok(clasificarHora('2026-09-13 21:00:00') === 'frontera', 'ni las 21 del domingo, que con el cambio de hora ya abre')
  ok(clasificarHora('2026-09-13 23:00:00') === 'frontera', 'ni las 23')

  // Cerrado seguro: lo que ningún horario de verano puede salvar.
  ok(clasificarHora('2026-09-12 12:00:00') === 'cerrado', 'el sábado al mediodía está cerrado y punto')
  ok(clasificarHora('2026-09-12 00:00:00') === 'cerrado', 'el sábado a medianoche también')
  ok(clasificarHora('2026-09-12 20:00:00') === 'cerrado', 'y el sábado a las 20')
  ok(clasificarHora('2026-09-13 12:00:00') === 'cerrado', 'el domingo al mediodía está cerrado')
  ok(clasificarHora('2026-09-11 23:00:00') === 'cerrado', 'el viernes a las 23 ya cerró con cualquier horario')

  // Y los bordes exactos, uno a uno, que es donde se equivoca cualquiera.
  ok(clasificarHora('2026-09-12 21:00:00') === 'frontera', 'sábado 21:00 es frontera, no cerrado')
  ok(clasificarHora('2026-09-11 21:00:00') === 'frontera', 'viernes 21:00 es frontera (cierra 21 o 22 según la época)')
  ok(clasificarHora('2026-09-11 22:00:00') === 'frontera', 'viernes 22:00 también')

  ok(clasificarHora('mañana') === null, 'un texto cualquiera no se clasifica')
  ok(clasificarHora(null) === null, 'ni un nulo')

  // El reparto, y que las tres cuentas sumen.
  const rep = repartoDeMercado([
    '2026-09-07 09:00:00', // mercado
    '2026-09-12 12:00:00', // cerrado
    '2026-09-13 12:00:00', // cerrado
    '2026-09-13 22:00:00', // frontera
    'basura',
  ])
  ok(rep.mercado === 1 && rep.cerrado === 2 && rep.frontera === 1 && rep.ilegibles === 1, 'el reparto cuadra')
  ok(rep.cerradas.length === 2, 'y guarda las cerradas para poder mirarlas')
  ok(!rep.cerradas.includes('2026-09-13 22:00:00'), 'el domingo a las 22 NO entra en las cerradas')
}

// ── 4d. `proporcionPlanas` ───────────────────────────────────────────────
console.log('4d. ¿las velas están planas?')
{
  const velas = new Map([
    ['a', { h: 10, l: 10 }], // plana
    ['b', { h: 10, l: 9 }],
    ['c', { h: 10, l: 10 }], // plana
    ['d', { h: NaN, l: 1 }], // no se puede mirar: no cuenta
  ])
  const p = proporcionPlanas(['a', 'b', 'c', 'd'], velas)
  ok(p.n === 3, 'solo cuenta las que se pueden mirar')
  ok(p.planas === 2, 'y cuenta bien las planas')
  ok(Math.abs(p.proporcion - 2 / 3) < 1e-9, 'y la proporción sale sobre las mirables')

  // `null` y no 0 cuando no hay nada que mirar: un 0 diría «ninguna está
  // plana», que es una afirmación. Misma decisión que `pearson`.
  ok(proporcionPlanas([], velas) === null, 'sin horas dice «no lo sé», no 0')
  ok(proporcionPlanas(['zzz'], velas) === null, 'y con horas que no están en el mapa tampoco')
  ok(proporcionPlanas(['a'], null) === null, 'y sin mapa de velas tampoco revienta')
}

// ── 5. `veredicto`: calculado, nunca escrito ─────────────────────────────
console.log('5. el veredicto')
{
  const sirve = { sirve: true, clave: 'sirve', detalle: '' }
  const noSirve = { sirve: false, clave: 'la-api-dice-error', detalle: '' }
  const noSeSupo = { sirve: null, clave: 'no-se-pudo-preguntar', detalle: '' }

  const abierta = veredicto({ intervalos: { '1h': sirve, '15min': noSirve }, cruce: { comunes: [1, 2], conservado: 0.9 } })
  ok(abierta.puerta === 'abierta', 'con el 1h sirviendo, la puerta está abierta')
  ok(abierta.sirven.includes('1h'), 'y lista el intervalo que sirve')
  ok(abierta.noSirven.includes('15min'), 'y el que no')
  ok(abierta.cruce !== null, 'y con la puerta abierta el cruce se enseña')

  const cerrada = veredicto({ intervalos: { '1h': noSirve } })
  ok(cerrada.puerta === 'cerrada', 'con el 1h negado, cerrada')

  // ⚠️⚠️ LA COMPROBACIÓN CENTRAL DE ESTE ARCHIVO.
  const ciego = veredicto({ intervalos: { '1h': noSeSupo } })
  ok(ciego.puerta === 'no-se-pudo-mirar', 'sin haber podido mirar, NO se dice «cerrada»')
  ok(ciego.puerta !== 'cerrada', 'y muy concretamente: no se dice «cerrada»')
  ok(ciego.noSeSupo.includes('1h'), 'y se nombra qué quedó sin saber')

  // Un cruce colado cuando la puerta no está abierta no se puede enseñar: se
  // leería como que hay horas usables de algo que no se pudo pedir.
  const ciegoConCruce = veredicto({ intervalos: { '1h': noSeSupo }, cruce: { comunes: [1], conservado: 1 } })
  ok(ciegoConCruce.cruce === null, 'sin puerta abierta no se enseña ningún cruce')

  // ⚠️ Y QUE LA PUERTA ESTÉ ABIERTA NO AUTORIZA NADA. Falta elegir la ventana,
  // que es una medición sobre los datos de ESTA app. Si algún día alguien
  // quiere que la sonda autorice, tiene que venir aquí a borrar esto a mano.
  ok(abierta.autoriza === false, 'ni con todo en verde la sonda autoriza construir')
  ok(cerrada.autoriza === false, 'ni cerrada')
  ok(ciego.autoriza === false, 'ni a ciegas')
}

// ── 6. El intervalo que decide es `1h`, no el primero que sirva ──────────
console.log('6. quién decide la puerta')
{
  // Si `15min` sirviera y `1h` no, la puerta está CERRADA: lo que se preguntó
  // es si se puede pedir el oro en velas de una hora. Quedarse con «alguno
  // sirve» sería el resumen que ignora su propio detalle.
  const v = veredicto({
    intervalos: { '1h': { sirve: false, clave: 'la-api-dice-error' }, '15min': { sirve: true, clave: 'sirve' } },
  })
  ok(v.puerta === 'cerrada', 'si el 15min sirve y el 1h no, la puerta está CERRADA')
  ok(v.sirven.includes('15min'), 'aunque se diga que el 15min sí responde')
}

console.log('')
if (fallos) {
  console.error(`✗ ${fallos} de ${hechas} comprobaciones fallaron.`)
  process.exit(1)
}
console.log(`✓ todo bien (${hechas} comprobaciones).`)
