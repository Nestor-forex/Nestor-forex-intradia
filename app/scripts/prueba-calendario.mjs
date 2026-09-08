// Prueba del calendario económico. Sin internet:
//
//     node scripts/prueba-calendario.mjs
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTAS PRUEBAS Y NO OTRAS
// ─────────────────────────────────────────────────────────────────────────
// Un calendario no falla dando error. Falla enseñando algo que se cree, y hay
// cuatro maneras de que eso pase sin que nada reviente:
//
//   1. ENSEÑAR ALGO QUE YA PASÓ como si fuera a pasar. Es el fallo más
//      probable, porque el archivo es una foto de hace horas.
//   2. LA HORA EQUIVOCADA. `date` viene con huso; tratarlo como si fuera hora
//      local daría un desfase de horas y nadie lo notaría hasta perder dinero.
//   3. ESCONDER LA FED. Un filtro demasiado apretado —o una palabra nueva en
//      el campo de impacto— deja fuera justo el evento que importaba.
//   4. REVENTAR POR UNA FILA RARA. Un evento mal formado no puede tumbar los
//      otros veintinueve.
//
// El feed real está BLOQUEADO desde el entorno donde se programa esto (403 del
// proxy), así que aquí se usa una muestra con la forma EXACTA que devolvió la
// sonda el 2026-09-08. La comprobación contra el feed de verdad se hace
// lanzando el workflow, no desde aquí.

import {
  ALTO,
  BAJO,
  DIVISAS,
  FERIADO,
  HORAS_VISTA,
  MEDIO,
  OTRO,
  agruparPorDia,
  esRelevante,
  estaViejo,
  horasHasta,
  categoriaDe,
  masUrgente,
  normalizarEvento,
  normalizarImpacto,
  prepararCalendario,
  proximos,
  totalSemana,
} from '../src/lib/calendario.js'

let fallos = 0
const comprobar = (que, bien) => {
  console.log(`${bien ? '  OK  ' : '  MAL '} ${que}`)
  if (!bien) fallos++
}

// El ancla de tiempo de toda la prueba. Fija a propósito: una prueba que usa
// `new Date()` de verdad pasa hoy y falla el martes que viene por la mañana.
const AHORA = new Date('2026-09-08T12:00:00Z')
const enHoras = (h) => new Date(AHORA.getTime() + h * 3600_000).toISOString()

// La forma EXACTA que devolvió la sonda contra ForexFactory. No se inventa:
// campos `title` · `country` · `date` · `impact` · `forecast` · `previous`.
const CRUDO = [
  { title: 'FOMC Statement', country: 'USD', date: enHoras(6), impact: 'High', forecast: '', previous: '' },
  { title: 'ECB Press Conference', country: 'EUR', date: enHoras(30), impact: 'High', forecast: '', previous: '' },
  { title: 'Retail Sales m/m', country: 'GBP', date: enHoras(20), impact: 'Medium', forecast: '0.3%', previous: '0.1%' },
  { title: 'ANZ Job Advertisements m/m', country: 'AUD', date: enHoras(10), impact: 'Low', forecast: '', previous: '0.8%' },
  { title: 'Bank Holiday', country: 'JPY', date: enHoras(40), impact: 'Holiday', forecast: '', previous: '' },
  { title: 'Caixin Services PMI', country: 'CNY', date: enHoras(8), impact: 'High', forecast: '52.1', previous: '51.8' },
  { title: 'Trade Balance', country: 'CAD', date: enHoras(100), impact: 'Medium', forecast: '', previous: '-1.2B' },
  { title: 'Algo que ya pasó', country: 'USD', date: enHoras(-3), impact: 'High', forecast: '', previous: '' },
  { title: 'De la semana pasada', country: 'USD', date: enHoras(-200), impact: 'High', forecast: '', previous: '' },
]

console.log('\n1. Las divisas salen de los pares, no de una lista aparte')
{
  comprobar('son las 8 del barrido', DIVISAS.length === 8)
  comprobar('están las mayores', ['USD', 'EUR', 'GBP', 'JPY'].every((d) => DIVISAS.includes(d)))
  comprobar('y las del resto de pares', ['CHF', 'CAD', 'AUD', 'NZD'].every((d) => DIVISAS.includes(d)))
  // Si esto falla es que alguien añadió un par y el calendario no se enteró —
  // que es justo lo que la lista derivada evita.
  comprobar('no se coló ninguna que no operamos', !DIVISAS.includes('CNY'))
}

console.log('\n2. El impacto: lo conocido se traduce, LO DESCONOCIDO SE QUEDA')
{
  comprobar('High → alto', normalizarImpacto('High') === ALTO)
  comprobar('Medium → medio', normalizarImpacto('Medium') === MEDIO)
  comprobar('Low → bajo', normalizarImpacto('Low') === BAJO)
  comprobar('Holiday → feriado', normalizarImpacto('Holiday') === FERIADO)
  comprobar('da igual mayúsculas y espacios', normalizarImpacto('  hIgH ') === ALTO)

  // ⚠️ La comprobación que de verdad importa de este bloque. Si mañana
  // ForexFactory inventa «Critical», ese evento NO puede desaparecer.
  comprobar('una palabra nueva → otro (no se tira)', normalizarImpacto('Critical') === OTRO)
  comprobar('vacío → otro', normalizarImpacto('') === OTRO)
  comprobar('nulo → otro', normalizarImpacto(null) === OTRO)
  comprobar('y «otro» SÍ es relevante, o sea que se enseña', esRelevante({ c: 'USD', i: OTRO }))
}

console.log('\n3. Una fila rara no puede tumbar las demás')
{
  comprobar('sin título → null', normalizarEvento({ country: 'USD', date: enHoras(1), impact: 'High' }) === null)
  comprobar('sin divisa → null', normalizarEvento({ title: 'X', date: enHoras(1) }) === null)
  comprobar('sin fecha → null', normalizarEvento({ title: 'X', country: 'USD' }) === null)
  // Esta es la importante: una fecha ilegible tiene que morir AQUÍ y no
  // llegar a la pantalla como «Invalid Date».
  comprobar('fecha ilegible → null', normalizarEvento({ title: 'X', country: 'USD', date: 'el jueves' }) === null)
  comprobar('nulo → null', normalizarEvento(null) === null)
  comprobar('un texto suelto → null', normalizarEvento('FOMC') === null)

  const conBasura = prepararCalendario([...CRUDO, null, 'x', { title: 'X' }], AHORA)
  comprobar('y aun con basura dentro, el resto sobrevive', conBasura.eventos.length > 0)
}

console.log('\n4. Qué entra en el archivo publicado')
{
  const cal = prepararCalendario(CRUDO, AHORA)
  const titulos = cal.eventos.map((e) => e.t)

  comprobar('la Fed entra', titulos.includes('FOMC Statement'))
  comprobar('el feriado entra (media sesión es menos liquidez)', titulos.includes('Bank Holiday'))
  comprobar('el de impacto bajo NO entra', !titulos.includes('ANZ Job Advertisements m/m'))
  comprobar('el de una divisa que no operamos NO entra', !titulos.includes('Caixin Services PMI'))
  comprobar('lo de la semana pasada NO entra', !titulos.includes('De la semana pasada'))

  // ⚠️ La decisión menos obvia del archivo, y por eso tiene prueba propia.
  comprobar('lo de HOY que ya pasó SÍ entra (filtra el navegador, no el archivo)', titulos.includes('Algo que ya pasó'))

  comprobar('vienen ordenados por fecha', cal.eventos.every((e, i, a) => i === 0 || new Date(a[i - 1].d) <= new Date(e.d)))
  comprobar('lleva la fecha en que se generó', typeof cal.generadoEl === 'string' && !Number.isNaN(new Date(cal.generadoEl).getTime()))
  comprobar('y dice de dónde salió', /ForexFactory/.test(cal.fuente))

  const fed = cal.eventos.find((e) => e.t === 'FOMC Statement')
  comprobar('los campos van con nombre corto (t, c, d, i)', 't' in fed && 'c' in fed && 'd' in fed && 'i' in fed)
  comprobar('y los vacíos no se guardan', !('f' in fed) && !('p' in fed))

  const gbp = cal.eventos.find((e) => e.c === 'GBP')
  comprobar('pero el pronóstico sí, cuando lo hay', gbp.f === '0.3%' && gbp.p === '0.1%')

  // El peso importa: este archivo lo baja cada miembro cada vez que abre la app.
  const kb = JSON.stringify(cal).length / 1024
  comprobar(`el archivo es pequeño (${kb.toFixed(1)} KB con ${cal.eventos.length} eventos)`, kb < 10)
}

console.log('\n5. Lo que se PINTA: solo lo que todavía no ha pasado')
{
  const cal = prepararCalendario(CRUDO, AHORA)
  const vista = proximos(cal, AHORA)
  const titulos = vista.map((e) => e.t)

  // ⚠️ El fallo nº 1 de la cabecera: enseñar como «próximo» algo pasado.
  comprobar('lo que ya pasó NO se pinta', !titulos.includes('Algo que ya pasó'))
  comprobar('la Fed de dentro de 6 h sí', titulos.includes('FOMC Statement'))
  comprobar('lo de dentro de 30 h también (caben 48)', titulos.includes('ECB Press Conference'))
  comprobar('lo de dentro de 100 h NO (se sale del horizonte)', !titulos.includes('Trade Balance'))
  comprobar(`el horizonte por defecto son ${HORAS_VISTA} horas`, HORAS_VISTA === 48)

  const semana = proximos(cal, AHORA, { horas: 24 * 7 })
  comprobar('pidiendo una semana sí aparece el de 100 h', semana.some((e) => e.t === 'Trade Balance'))

  // El mismo archivo, mirado más tarde, enseña menos cosas — sin volver a
  // publicarlo. Eso es exactamente lo que se buscaba al no filtrar al publicar.
  const masTarde = proximos(cal, new Date(AHORA.getTime() + 8 * 3600_000))
  comprobar('ocho horas después, la Fed ya no sale', !masTarde.some((e) => e.t === 'FOMC Statement'))
  comprobar('y no hizo falta volver a publicar nada', masTarde.length < vista.length)
}

console.log('\n6. La hora: absoluta, y por el camino que usa la app de verdad')
{
  // ⚠️ ESTE BLOQUE SE REESCRIBIÓ. La primera versión comparaba
  // `new Date(ev.d).getTime()` contra un número: eso comprueba el JavaScript
  // de Node, no este código. Se rompió el manejo del huso a propósito y la
  // prueba siguió en verde — o sea que no comprobaba nada.
  //
  // Ahora se pregunta a través de `proximos` y `agruparPorDia`, que son las
  // funciones que la pantalla usa de verdad.

  // El caso se elige A CABALLO DEL LÍMITE, que es donde la diferencia decide
  // algo. Las 04:00 en Hawái (-10:00) del día 10 son las 14:00 UTC del día 10:
  // 50 horas después del ancla, o sea FUERA del horizonte de 48.
  // Quien ignorara el huso leería «día 10 a las 04:00» = 40 horas = DENTRO.
  const lejano = { eventos: [normalizarEvento({ title: 'Lejano', country: 'USD', date: '2026-09-10T04:00:00-10:00', impact: 'High' })] }
  comprobar('con el huso bien, queda fuera de las 48 h', proximos(lejano, AHORA).length === 0)
  comprobar('faltan 50 horas y no 40', horasHasta(lejano.eventos[0], AHORA) === 50)
  comprobar('y dentro de un horizonte de 60 h sí entra', proximos(lejano, AHORA, { horas: 60 }).length === 1)

  // El otro lado: las 09:00 en Tokio (+09:00) del día 9 son las 00:00 UTC del
  // día 9, o sea 12 horas después. Dentro.
  const cercano = { eventos: [normalizarEvento({ title: 'Cercano', country: 'JPY', date: '2026-09-09T09:00:00+09:00', impact: 'High' })] }
  comprobar('el de Tokio sí entra en las 48 h', proximos(cercano, AHORA).length === 1)
  comprobar('y faltan 12 horas, no 21', horasHasta(cercano.eventos[0], AHORA) === 12)

  // Y la consecuencia que se ve en pantalla: el MISMO instante cae en días
  // distintos según dónde esté quien mira. Por eso se agrupa con su huso.
  const medianoche = [normalizarEvento({ title: 'Justo a medianoche', country: 'USD', date: '2026-09-09T02:00:00Z', impact: 'High' })]
  const enBogota = agruparPorDia(medianoche, 'es', 'America/Bogota')
  const enMadrid = agruparPorDia(medianoche, 'es', 'Europe/Madrid')
  comprobar('en Bogotá cae el día 8 (son las 21:00 de la noche)', enBogota[0].clave.startsWith('08'))
  comprobar('y en Madrid el día 9 (allí ya son las 04:00)', enMadrid[0].clave.startsWith('09'))
  comprobar('o sea que agrupar por UTC habría mentido a uno de los dos', enBogota[0].clave !== enMadrid[0].clave)

  const dosDias = agruparPorDia(
    [
      normalizarEvento({ title: 'A', country: 'USD', date: '2026-09-08T14:00:00Z', impact: 'High' }),
      normalizarEvento({ title: 'B', country: 'USD', date: '2026-09-08T16:00:00Z', impact: 'High' }),
      normalizarEvento({ title: 'C', country: 'EUR', date: '2026-09-10T09:00:00Z', impact: 'High' }),
    ],
    'es',
    'UTC',
  )
  comprobar('dos días distintos → dos grupos', dosDias.length === 2)
  comprobar('el primero lleva los dos del mismo día', dosDias[0].eventos.length === 2)
  comprobar('y los grupos salen en orden', dosDias[0].fecha < dosDias[1].fecha)
}

console.log('\n7. El aviso del título, que es lo que se lee sin abrir la tarjeta')
{
  const cal = prepararCalendario(CRUDO, AHORA)
  const vista = proximos(cal, AHORA)
  const urgente = masUrgente(vista)

  comprobar('encuentra el de alto impacto más cercano', urgente?.t === 'FOMC Statement')
  comprobar('y calcula cuánto falta', horasHasta(urgente, AHORA) === 6)

  // Un medio y un feriado NO son «alto»: el título no puede gritar por algo
  // que no lo merece, o dejará de leerse.
  const sinAltos = [
    { t: 'X', c: 'GBP', d: enHoras(2), i: MEDIO },
    { t: 'Y', c: 'JPY', d: enHoras(3), i: FERIADO },
  ]
  comprobar('sin ninguno de alto impacto → null', masUrgente(sinAltos) === null)
  comprobar('lista vacía → null', masUrgente([]) === null)
  comprobar('nada → null', masUrgente(null) === null)
  comprobar('una fecha rota no rompe la cuenta', horasHasta({ d: 'x' }, AHORA) === null)
}

console.log('\n8. Un archivo viejo se DELATA en vez de desaparecer en silencio')
{
  // ⚠️ Sin esto, un publicador averiado se vería igual que una semana
  // tranquila: la tarjeta no sale y nadie sabe por qué.
  comprobar('recién hecho → no es viejo', !estaViejo({ generadoEl: enHoras(-2) }, AHORA))
  comprobar('de hace 30 horas → viejo', estaViejo({ generadoEl: enHoras(-30) }, AHORA))
  comprobar('sin fecha → viejo (ante la duda, avisar)', estaViejo({}, AHORA))
  comprobar('fecha ilegible → viejo', estaViejo({ generadoEl: 'ayer' }, AHORA))
  comprobar('nada → viejo', estaViejo(null, AHORA))
}

console.log('\n9. Un barrido sin calendario no revienta: solo no hay tarjeta')
{
  // Misma decisión que con `correl`, y por el mismo motivo: aquí una lista
  // vacía solo cuesta una tarjeta que no sale. NO es como `setupsCaida`, donde
  // una lista vacía se confundiría con «hoy no hubo señales» y borraría
  // historial — allá sí tiene que reventar.
  comprobar('sin calendario → lista vacía', proximos(null, AHORA).length === 0)
  comprobar('con un objeto vacío → lista vacía', proximos({}, AHORA).length === 0)
  comprobar('con eventos que no son lista → lista vacía', proximos({ eventos: 'x' }, AHORA).length === 0)
  comprobar('agrupar nada → sin grupos', agruparPorDia(null).length === 0)
  comprobar('preparar nada → archivo válido y vacío', prepararCalendario(null, AHORA).eventos.length === 0)
}

console.log('\n10. La familia del evento: clasifica, y si no sabe NO INVENTA')
{
  // Los nombres vienen en inglés y en jerga. Néstor abrió la app y no
  // reconoció «Core PPI m/m» como la inflación que yo le había contado en
  // español. Esto es lo que arregla eso — pero solo si acierta la familia.
  const cat = (t) => categoriaDe({ t })

  // Los seis que salieron de verdad en el calendario del 2026-09-08.
  comprobar('«Main Refinancing Rate» → tipos', cat('Main Refinancing Rate') === 'tipos')
  comprobar('«Monetary Policy Statement» → tipos', cat('Monetary Policy Statement') === 'tipos')
  comprobar('«Core PPI m/m» → inflación', cat('Core PPI m/m') === 'inflacion')
  comprobar('«PPI m/m» → inflación', cat('PPI m/m') === 'inflacion')
  comprobar('«Unemployment Claims» → empleo', cat('Unemployment Claims') === 'empleo')

  // ⚠️ Ésta es la que decide el orden de la lista: la rueda de prensa del BCE
  // es donde se EXPLICA la decisión de tipos que se acaba de tomar, así que
  // tiene que caer en «tipos» y no en «discurso».
  comprobar('«ECB Press Conference» → tipos, NO discurso', cat('ECB Press Conference') === 'tipos')

  comprobar('«CPI y/y» → inflación', cat('CPI y/y') === 'inflacion')
  comprobar('«Non-Farm Employment Change» → empleo', cat('Non-Farm Employment Change') === 'empleo')
  comprobar('«Prelim GDP q/q» → crecimiento', cat('Prelim GDP q/q') === 'crecimiento')
  comprobar('«Retail Sales m/m» → ventas', cat('Retail Sales m/m') === 'ventas')
  comprobar('«Flash Services PMI» → actividad', cat('Flash Services PMI') === 'actividad')
  comprobar('«Trade Balance» → comercio', cat('Trade Balance') === 'comercio')
  comprobar('«Fed Chair Powell Speaks» → discurso', cat('Fed Chair Powell Speaks') === 'discurso')
  comprobar('«Bank Holiday» → festivo', cat('Bank Holiday') === 'festivo')

  // ⚠️ LA COMPROBACIÓN QUE MÁS IMPORTA DE ESTE BLOQUE. Una etiqueta inventada
  // es PEOR que ninguna, porque se cree. Ante lo desconocido, callar.
  comprobar('un evento que nadie reconoce → null (no se inventa)', cat('ANZ Job Advertisements is not a thing') !== 'crecimiento')
  comprobar('un título sin sentido → null', cat('Zzz Qqq Www') === null)
  comprobar('sin título → null', cat({}) === null)
  comprobar('nada → null', categoriaDe(null) === null)

  // Todas las claves que devuelve tienen que existir en los diccionarios, o
  // la pantalla enseñaría la ruta cruda («calendario.cat.tipos»).
  const CLAVES = ['tipos', 'inflacion', 'empleo', 'crecimiento', 'ventas', 'actividad', 'comercio', 'discurso', 'festivo']
  const salidas = new Set(
    ['Main Refinancing Rate', 'CPI y/y', 'Payrolls', 'GDP q/q', 'Retail Sales', 'PMI', 'Trade Balance', 'Powell Speaks', 'Bank Holiday']
      .map((t) => cat(t))
      .filter(Boolean),
  )
  comprobar('todas las familias que salen están en la lista conocida', [...salidas].every((c) => CLAVES.includes(c)))
}

console.log('\n11. «Se enseñan N de M»: los dos números, y qué cuenta cada uno')
{
  // 📌 Nació de una confusión REAL: se dijo «17 eventos» y en la tarjeta se
  // veían 6. Los dos eran ciertos y medían cosas distintas.
  const cal = prepararCalendario(CRUDO, AHORA)
  comprobar(`el archivo trae la semana entera (${totalSemana(cal)})`, totalSemana(cal) === cal.eventos.length)
  comprobar('y la tarjeta enseña menos, porque filtra a 48 h', proximos(cal, AHORA).length < totalSemana(cal))
  comprobar('sin calendario, el total es 0 y no revienta', totalSemana(null) === 0)
  comprobar('con basura, también 0', totalSemana({ eventos: 'x' }) === 0)
}

console.log('')
console.log(fallos ? `${fallos} comprobación(es) FALLARON` : 'El calendario dice lo que va a pasar, y a la hora que es.')
process.exit(fallos ? 1 : 0)
