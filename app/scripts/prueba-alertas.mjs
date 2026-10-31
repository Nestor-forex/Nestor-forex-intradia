// Comprobaciones de los avisos que programa el usuario. SIN INTERNET y sin
// gastar un crédito.
//
//     node scripts/prueba-alertas.mjs
//
// ⚠️ Lo que se vigila aquí no es que la cuenta esté bien —un `>=` se lee de un
// vistazo— sino las tres formas en que un aviso puede MENTIR:
//
//   · sonar con un precio viejo, diciendo «acaba de tocar» de esta mañana;
//   · sonar sin parar, que enseña a ignorar la alarma;
//   · y confundir «no se sabe» con «no ha llegado», que en pantalla se lee
//     como una afirmación sobre el mercado donde no hay ningún dato.

import {
  EDAD_MAXIMA_PRECIO_MIN,
  LADOS_INDICADOR,
  LADOS_PRECIO,
  MAX_AVISOS,
  MAX_REPETICIONES,
  MINUTOS_ENTRE_REPETICIONES,
  MINUTOS_MAX_RECORDATORIO,
  TIPOS,
  cabeOtro,
  estadoDe,
  mensajeDe,
  pendientes,
  queMandar,
  tocaRepetir,
  valida,
} from '../src/lib/alertas.js'

let mal = 0
const comprobar = (texto, ok) => {
  console.log(`  ${ok ? '✓' : '✗'} ${texto}`)
  if (!ok) mal++
}

const AHORA = new Date('2026-10-30T22:00:00Z')
const hace = (min) => new Date(AHORA.getTime() - min * 60_000).toISOString()

// El dato de un par, con la forma REAL del puente: comprobado contra
// `estado/mt5.json` de producción el 2026-10-30, que trae
// `{ bid, ask, spread, ticks }` por par y un `actualizadoEl` con `+00:00`.
const datoFresco = { bid: 1.11609, ask: 1.11623, precioEl: hace(8), posB: -0.4, rsi: 45, tecnicoEl: hace(60) }

console.log('\n1. El caso normal: toca y suena')
{
  const sube = { par: 'EUR/USD', tipo: 'precio', lado: 'sube', nivel: 1.115, activa: true }
  const r = estadoDe(sube, datoFresco, { ahora: AHORA })
  comprobar('el bid pasó el nivel hacia arriba → dispara', r.estado === 'dispara')
  comprobar('y devuelve el valor que lo disparó', r.valor === 1.11609)

  const lejos = { ...sube, nivel: 1.2 }
  comprobar('todavía no llega → espera, NO «sinDato»', estadoDe(lejos, datoFresco, { ahora: AHORA }).estado === 'espera')

  const baja = { par: 'EUR/USD', tipo: 'precio', lado: 'baja', nivel: 1.12, activa: true }
  comprobar('«avísame si baja a 1.12» con el bid en 1.116 → dispara', estadoDe(baja, datoFresco, { ahora: AHORA }).estado === 'dispara')
  comprobar(
    'y si todavía no ha bajado → espera',
    estadoDe({ ...baja, nivel: 1.1 }, datoFresco, { ahora: AHORA }).estado === 'espera',
  )

  // El borde exacto cuenta como tocado: el nivel que el usuario escribió es el
  // nivel, no «un poco más allá del nivel».
  comprobar(
    'el nivel EXACTO dispara',
    estadoDe({ ...sube, nivel: 1.11609 }, datoFresco, { ahora: AHORA }).estado === 'dispara',
  )
}

console.log('\n2. ⚠️⚠️ UN PRECIO VIEJO NO PUEDE HACER SONAR NADA')
{
  const a = { par: 'EUR/USD', tipo: 'precio', lado: 'sube', nivel: 1.115, activa: true }
  // El puente publica cada 15 minutos. Dentro del límite, suena.
  comprobar(
    `con el precio de hace ${EDAD_MAXIMA_PRECIO_MIN - 1} min todavía suena`,
    estadoDe(a, { ...datoFresco, precioEl: hace(EDAD_MAXIMA_PRECIO_MIN - 1) }, { ahora: AHORA }).estado === 'dispara',
  )
  const viejo = estadoDe(a, { ...datoFresco, precioEl: hace(EDAD_MAXIMA_PRECIO_MIN + 1) }, { ahora: AHORA })
  comprobar(`con el precio de hace ${EDAD_MAXIMA_PRECIO_MIN + 1} min NO suena`, viejo.estado === 'sinDato')
  comprobar('y dice que el puente está apagado, no que no haya llegado', viejo.codigo === 'puenteApagado')
  comprobar('con el PC apagado cinco horas, tampoco', estadoDe(a, { ...datoFresco, precioEl: hace(300) }, { ahora: AHORA }).estado === 'sinDato')

  // ⚠️ `new Date(null)` NO es una fecha inválida en JavaScript: es el 1 de
  // enero de 1970. Sin el `typeof` de `minutosDesde`, un archivo sin
  // `actualizadoEl` daría «hace 29 millones de minutos» — que aquí, por
  // suerte, también corta. Pero un archivo con la fecha ILEGIBLE da `NaN`, y
  // `NaN > 45` es **false**: eso sí habría dejado sonar el aviso.
  comprobar(
    'sin fecha del precio NO suena',
    estadoDe(a, { ...datoFresco, precioEl: undefined }, { ahora: AHORA }).estado === 'sinDato',
  )
  comprobar(
    'con la fecha ILEGIBLE tampoco (y aquí `NaN > 45` es false, así que hace falta el guardia)',
    estadoDe(a, { ...datoFresco, precioEl: 'ayer por la tarde' }, { ahora: AHORA }).estado === 'sinDato',
  )
  comprobar('sin bid no suena', estadoDe(a, { ...datoFresco, bid: undefined }, { ahora: AHORA }).estado === 'sinDato')
  comprobar('con el bid en texto tampoco', estadoDe(a, { ...datoFresco, bid: 'mucho' }, { ahora: AHORA }).estado === 'sinDato')
  comprobar('sin dato ninguno → sinDato', estadoDe(a, null, { ahora: AHORA }).estado === 'sinDato')
  // Y el formato REAL del puente, con `+00:00` en vez de `Z`.
  comprobar(
    'entiende la fecha tal como la escribe el puente (+00:00)',
    estadoDe(a, { ...datoFresco, precioEl: '2026-10-30T21:52:18.345049+00:00' }, { ahora: AHORA }).estado === 'dispara',
  )
}

console.log('\n3. ⚠️ SUENA UNA VEZ Y SE CALLA')
{
  const a = { par: 'EUR/USD', tipo: 'precio', lado: 'sube', nivel: 1.115, activa: true }
  comprobar('antes de sonar, dispara', estadoDe(a, datoFresco, { ahora: AHORA }).estado === 'dispara')
  const yaSono = { ...a, disparadaEl: hace(30) }
  const r = estadoDe(yaSono, datoFresco, { ahora: AHORA })
  comprobar('después de sonar se queda quieto aunque el precio siga ahí', r.estado === 'quieto')
  comprobar('y dice que ya sonó, no que esté apagado', r.codigo === 'yaSono')
  // Apagado por el usuario.
  const r2 = estadoDe({ ...a, activa: false }, datoFresco, { ahora: AHORA })
  comprobar('un aviso apagado no suena', r2.estado === 'quieto' && r2.codigo === 'apagado')
  // ⚠️ Y el orden importa: apagado se comprueba ANTES que «ya sonó», porque un
  // aviso apagado y ya sonado tiene que leerse como apagado.
  comprobar(
    'apagado manda sobre «ya sonó»',
    estadoDe({ ...a, activa: false, disparadaEl: hace(1) }, datoFresco, { ahora: AHORA }).codigo === 'apagado',
  )
}

console.log('\n4. Los avisos de indicador salen del BARRIDO, con su propia frescura')
{
  const banda = { par: 'EUR/USD', tipo: 'banda', lado: 'abajo', nivel: -1, activa: true }
  comprobar('con el %B en −0,4 todavía no toca la banda', estadoDe(banda, datoFresco, { ahora: AHORA }).estado === 'espera')
  comprobar(
    'con el %B en −1,2 sí',
    estadoDe(banda, { ...datoFresco, posB: -1.2 }, { ahora: AHORA }).estado === 'dispara',
  )
  comprobar(
    'y por arriba igual',
    estadoDe({ ...banda, lado: 'arriba', nivel: 1 }, { ...datoFresco, posB: 1.3 }, { ahora: AHORA }).estado === 'dispara',
  )

  const rsi = { par: 'EUR/USD', tipo: 'rsi', lado: 'abajo', nivel: 30, activa: true }
  comprobar('RSI 45 contra 30 → espera', estadoDe(rsi, datoFresco, { ahora: AHORA }).estado === 'espera')
  comprobar('RSI 28 contra 30 → dispara', estadoDe(rsi, { ...datoFresco, rsi: 28 }, { ahora: AHORA }).estado === 'dispara')

  // ⚠️ SIN BARRIDO NO SE SABE, y eso no es «no ha llegado».
  const sinB = estadoDe(rsi, { ...datoFresco, rsi: undefined }, { ahora: AHORA })
  comprobar('sin RSI en el barrido → sinDato, y lo dice', sinB.estado === 'sinDato' && sinB.codigo === 'sinBarrido')

  // ⚠️⚠️ Y LA FRESCURA DEL BARRIDO LA PONE CADA APP, no este archivo. Swing
  // publica dos veces al día y su límite son 26 horas; Intradía una vez por
  // hora y el suyo son 2. El mismo dato de 3 horas es viejo allí y normal acá.
  const tecnicoDe3h = { ...datoFresco, rsi: 28, tecnicoEl: hace(180) }
  comprobar(
    'con el límite de Swing (26 h), un barrido de 3 h sirve',
    estadoDe(rsi, tecnicoDe3h, { ahora: AHORA, edadMaximaTecnicoMin: 26 * 60 }).estado === 'dispara',
  )
  const conIntradia = estadoDe(rsi, tecnicoDe3h, { ahora: AHORA, edadMaximaTecnicoMin: 120 })
  comprobar('con el de Intradía (2 h), el MISMO dato ya no sirve', conIntradia.estado === 'sinDato')
  comprobar('y dice que el barrido está viejo', conIntradia.codigo === 'barridoViejo')
  // Sin decirle el límite, no se inventa ninguno: es un parámetro de la app.
  comprobar(
    'sin límite dado, no se inventa uno',
    estadoDe(rsi, { ...datoFresco, rsi: 28, tecnicoEl: hace(99999) }, { ahora: AHORA }).estado === 'dispara',
  )
  // ⚠️ Un aviso técnico NO se cae porque el puente esté apagado: su dato es
  // otro. Mezclarlos apagaría la mitad de los avisos por el motivo equivocado.
  comprobar(
    'el puente apagado NO tumba un aviso de RSI',
    estadoDe(rsi, { ...datoFresco, rsi: 28, precioEl: hace(900) }, { ahora: AHORA }).estado === 'dispara',
  )
}

console.log('\n5. ⚠️ UN TIPO QUE NADIE HA INVENTADO TODAVÍA NO SUENA')
{
  // La familia de fallo que en este proyecto ya mordió seis veces: una
  // condición escrita por descarte se traga en silencio lo que venga después.
  const raro = { par: 'EUR/USD', tipo: 'cosaNueva', lado: 'sube', nivel: 1, activa: true }
  comprobar('un tipo desconocido NO dispara', estadoDe(raro, datoFresco, { ahora: AHORA }).estado !== 'dispara')
  comprobar('y lo dice por su nombre', estadoDe(raro, datoFresco, { ahora: AHORA }).codigo === 'tipoDesconocido')
  comprobar('y `valida` lo rechaza al guardarlo', valida(raro).codigo === 'tipoDesconocido')
  comprobar('los tipos están enumerados, no abiertos', TIPOS.length === 3 && Object.isFrozen(TIPOS))
  comprobar('y los lados también', Object.isFrozen(LADOS_PRECIO) && Object.isFrozen(LADOS_INDICADOR))
}

console.log('\n6. `valida` caza lo que un dedo escribe mal')
{
  const ok = { par: 'EUR/USD', tipo: 'precio', lado: 'sube', nivel: 1.155 }
  comprobar('uno bien escrito pasa', valida(ok).ok === true)
  comprobar('sin par → sinPar', valida({ ...ok, par: '' }).codigo === 'sinPar')
  comprobar('un par que la app no tiene → parDesconocido', valida({ ...ok, par: 'EUR/XYZ' }, { paresValidos: ['EUR/USD'] }).codigo === 'parDesconocido')
  comprobar('y con la lista, el bueno pasa', valida(ok, { paresValidos: ['EUR/USD'] }).ok === true)
  comprobar('sin lista de pares no se inventa un rechazo', valida({ ...ok, par: 'EUR/XYZ' }).ok === true)
  comprobar('lado que no existe → ladoDesconocido', valida({ ...ok, lado: 'hacia arriba' }).codigo === 'ladoDesconocido')
  comprobar('⚠️ un lado de indicador en un aviso de precio se rechaza', valida({ ...ok, lado: 'arriba' }).codigo === 'ladoDesconocido')
  comprobar('y al revés también', valida({ ...ok, tipo: 'rsi', lado: 'sube', nivel: 30 }).codigo === 'ladoDesconocido')
  comprobar('nivel en texto → nivelNoEsNumero', valida({ ...ok, nivel: 'mil' }).codigo === 'nivelNoEsNumero')
  comprobar('nivel vacío también', valida({ ...ok, nivel: null }).codigo === 'nivelNoEsNumero')
  comprobar('un precio negativo no existe', valida({ ...ok, nivel: -1 }).codigo === 'precioNoPositivo')
  comprobar('RSI 150 no existe', valida({ ...ok, tipo: 'rsi', lado: 'arriba', nivel: 150 }).codigo === 'rsiFueraDeRango')
  comprobar('RSI 70 sí', valida({ ...ok, tipo: 'rsi', lado: 'arriba', nivel: 70 }).ok === true)
  comprobar('%B de 9 no se ha visto nunca', valida({ ...ok, tipo: 'banda', lado: 'abajo', nivel: -9 }).codigo === 'bandaFueraDeRango')
  comprobar('%B de −1 sí', valida({ ...ok, tipo: 'banda', lado: 'abajo', nivel: -1 }).ok === true)
  comprobar('nada → vacio', valida(null).codigo === 'vacio')

  // ⚠️⚠️ LA TRAMPA QUE ESTA PRUEBA CAZÓ, y es la peor de todo el archivo:
  // **`Number(null)` es 0 en JavaScript**, no `NaN`. Y `Number('')` también.
  // Así que un campo que el usuario dejó EN BLANCO pasaba como un nivel válido
  // de cero, y un aviso de «RSI por arriba de 0» habría SONADO en la primera
  // vuelta — un campo vacío haciendo sonar el celular.
  //
  // 📌 Es la hermana exacta de `new Date(null)`, que no es una fecha inválida
  // sino el 1 de enero de 1970, y que ya mordió en `minutosDesde`.
  const enBlanco = [null, undefined, '', '   ', [], true, {}]
  comprobar(
    'un nivel EN BLANCO se rechaza en las 7 formas en que puede venir',
    enBlanco.every((v) => valida({ ...ok, nivel: v }).codigo === 'nivelNoEsNumero'),
  )
  comprobar(
    '⚠️ y un RSI «por arriba» con el nivel en blanco NO suena (con `Number` habría sonado)',
    estadoDe(
      { par: 'EUR/USD', tipo: 'rsi', lado: 'arriba', nivel: null, activa: true },
      datoFresco,
      { ahora: AHORA },
    ).estado === 'sinDato',
  )
  comprobar(
    'el 0 escrito A PROPÓSITO en un RSI sí es un nivel válido',
    valida({ ...ok, tipo: 'rsi', lado: 'arriba', nivel: 0 }).ok === true,
  )
  // ⚠️ Códigos, no frases: este módulo corre también en Node, donde no hay
  // idioma elegido. Una frase en español aquí sale en español a quien eligió
  // árabe.
  comprobar(
    'los rechazos son CÓDIGOS sin espacios, no frases',
    ['vacio', 'sinPar', 'tipoDesconocido', 'nivelNoEsNumero'].every((c) => !c.includes(' ')),
  )
}

console.log('\n7. El tope de avisos')
{
  comprobar(`caben ${MAX_AVISOS}`, cabeOtro(new Array(MAX_AVISOS - 1).fill({})) === true)
  comprobar('y el siguiente ya no', cabeOtro(new Array(MAX_AVISOS).fill({})) === false)
  comprobar('sin lista, cabe', cabeOtro(null) === true)
  // Se cuentan TODOS, apagados incluidos: lo que topa es lo que se guarda.
  comprobar(
    'los apagados también cuentan',
    cabeOtro(new Array(MAX_AVISOS).fill({ activa: false })) === false,
  )
}

console.log('\n8. `pendientes` saca solo los que suenan')
{
  const avisos = [
    { par: 'EUR/USD', tipo: 'precio', lado: 'sube', nivel: 1.115, activa: true },
    { par: 'EUR/USD', tipo: 'precio', lado: 'sube', nivel: 9, activa: true }, // lejos
    { par: 'GBP/USD', tipo: 'precio', lado: 'baja', nivel: 1.4, activa: true }, // dispara
    { par: 'USD/JPY', tipo: 'precio', lado: 'baja', nivel: 100, activa: true }, // sin dato
    { par: 'EUR/USD', tipo: 'precio', lado: 'sube', nivel: 1.0, activa: false }, // apagado
  ]
  const datos = {
    'EUR/USD': datoFresco,
    'GBP/USD': { bid: 1.33881, ask: 1.33928, precioEl: hace(5) },
  }
  const p = pendientes(avisos, datos, { ahora: AHORA })
  comprobar(`suenan 2 de 5 (son ${p.length})`, p.length === 2)
  comprobar('y son los que tocaron', p.map((x) => x.aviso.par).join() === 'EUR/USD,GBP/USD')
  comprobar('cada uno trae su estado para poder escribir el mensaje', p[0].estado.valor === 1.11609)
  comprobar('sin avisos, lista vacía', pendientes(null, datos, { ahora: AHORA }).length === 0)
  comprobar('sin datos, no suena ninguno', pendientes(avisos, null, { ahora: AHORA }).length === 0)
  // ⚠️ Un aviso con un par que no está en el puente no revienta: se queda sin
  // dato. El puente vigila 18 pares y las dos apps suman 18, pero si algún día
  // se añade uno a una app y no al puente, la pantalla tiene que decir «sin
  // dato», no caerse.
  comprobar('un par que el puente no trae no revienta', p.every((x) => x.aviso.par !== 'USD/JPY'))
}

console.log('\n8b. ⚠️⚠️ SUENA, Y SI NADIE LO VE, RECUERDA DOS VECES MÁS')
{
  // El caso tal como lo conto Nestor: «sono en este momento y si el
  // suscriptor no ha abierto la app para mirarla sonara otra vez a los 15
  // minutos, y si tampoco la ha visto sonara por segunda y ultima vez a los
  // siguientes 15 minutos».
  const base = { par: 'EUR/USD', tipo: 'precio', lado: 'sube', nivel: 1.115, activa: true }

  const recienSonado = { ...base, disparadaEl: hace(0), sonadaEl: hace(0), veces: 1 }
  comprobar('recién sonado, no se repite enseguida', tocaRepetir(recienSonado, { ahora: AHORA }) === false)
  comprobar(
    `a los ${MINUTOS_ENTRE_REPETICIONES - 1} min todavía no`,
    tocaRepetir({ ...base, disparadaEl: hace(14), sonadaEl: hace(14), veces: 1 }, { ahora: AHORA }) === false,
  )
  comprobar(
    `a los ${MINUTOS_ENTRE_REPETICIONES} min sí: primer recordatorio`,
    tocaRepetir({ ...base, disparadaEl: hace(15), sonadaEl: hace(15), veces: 1 }, { ahora: AHORA }) === true,
  )
  comprobar(
    'a los 30 min, con uno ya mandado: segundo recordatorio',
    tocaRepetir({ ...base, disparadaEl: hace(30), sonadaEl: hace(15), veces: 2 }, { ahora: AHORA }) === true,
  )
  // ⚠️ Y SE ACABA. Dos recordatorios y nada más.
  comprobar(
    '⚠️ a los 45 min, con los dos ya mandados, YA NO suena',
    tocaRepetir({ ...base, disparadaEl: hace(45), sonadaEl: hace(15), veces: 3 }, { ahora: AHORA }) === false,
  )
  comprobar(
    'en total suena 3 veces: el aviso y 2 recordatorios',
    1 + MAX_REPETICIONES === 3,
  )

  // ⚠️ LO QUE LOS PARA: que la persona lo haya visto.
  comprobar(
    '⚠️ si abrió la app y lo vio, NO se repite',
    tocaRepetir({ ...base, disparadaEl: hace(15), sonadaEl: hace(15), veces: 1, vistoEl: hace(2) }, { ahora: AHORA }) === false,
  )
  comprobar(
    'y si lo apagó, tampoco',
    tocaRepetir({ ...base, activa: false, disparadaEl: hace(15), sonadaEl: hace(15), veces: 1 }, { ahora: AHORA }) === false,
  )

  // ⚠️⚠️ EL TECHO, que es lo que impide que esto se vuelva un aviso falso. Un
  // programa caído un día entero despertaria y mandaria «recordatorio» de un
  // precio de ayer.
  comprobar(
    `⚠️ pasados ${MINUTOS_MAX_RECORDATORIO} min del primero, ya no se recuerda nada`,
    tocaRepetir({ ...base, disparadaEl: hace(MINUTOS_MAX_RECORDATORIO + 1), sonadaEl: hace(20), veces: 1 }, { ahora: AHORA }) === false,
  )
  comprobar(
    'un día entero después, desde luego que no',
    tocaRepetir({ ...base, disparadaEl: hace(1440), sonadaEl: hace(1440), veces: 1 }, { ahora: AHORA }) === false,
  )

  // ⚠️ ANTE LA DUDA NO SE REPITE, al revés que `yaCorrioHoy`: aquí el error
  // barato es callarse, porque una alarma que suena sin motivo ensena a
  // ignorar todas las demas.
  comprobar('sin `disparadaEl` no hay nada que recordar', tocaRepetir({ ...base }, { ahora: AHORA }) === false)
  comprobar(
    'con la fecha ilegible, no se repite',
    tocaRepetir({ ...base, disparadaEl: 'ayer', sonadaEl: 'ayer', veces: 1 }, { ahora: AHORA }) === false,
  )
  comprobar(
    'con el contador en basura se trata como si ya hubiera sonado una vez',
    tocaRepetir({ ...base, disparadaEl: hace(15), sonadaEl: hace(15), veces: 'muchas' }, { ahora: AHORA }) === true,
  )
  comprobar('sin aviso ninguno, false', tocaRepetir(null, { ahora: AHORA }) === false)

  // `queMandar` junta las dos cosas y dice cuál es cuál.
  const datos = { 'EUR/USD': datoFresco }
  const lista = queMandar(
    [
      { ...base }, // nuevo: dispara
      { ...base, nivel: 1.116, disparadaEl: hace(15), sonadaEl: hace(15), veces: 1 }, // recordatorio
      { ...base, nivel: 1.117, disparadaEl: hace(15), sonadaEl: hace(15), veces: 1, vistoEl: hace(1) }, // visto
    ],
    datos,
    { ahora: AHORA },
  )
  comprobar(`manda 2 de 3 (son ${lista.length})`, lista.length === 2)
  comprobar('y distingue el nuevo del recordatorio', lista.map((x) => x.motivo).sort().join() === 'nuevo,recordatorio')
  // ⚠️ El recordatorio NO vuelve a mirar el precio: lleva el del original.
  comprobar(
    'el recordatorio no trae un estado nuevo del precio',
    lista.find((x) => x.motivo === 'recordatorio').estado === null,
  )
}

console.log('\n9. El mensaje va como CLAVE y HUECOS, nunca como frase')
{
  const a = { par: 'EUR/USD', tipo: 'precio', lado: 'sube', nivel: 1.115 }
  const st = estadoDe({ ...a, activa: true }, datoFresco, { ahora: AHORA })
  const m = mensajeDe(a, st, datoFresco)
  comprobar('la clave es de i18n', m.clave === 'misAvisos.msgSubio')
  comprobar('lleva el par y el nivel', m.params.par === 'EUR/USD' && m.params.nivel === 1.115)
  // ⚠️ Lleva los DOS precios: el bid es el que el usuario ve en el gráfico y el
  // ask es el que pagaría al comprar. Enseñar solo uno esconde el spread.
  comprobar('lleva bid Y ask', m.params.bid === 1.11609 && m.params.ask === 1.11623)
  // ⚠️ Y LA EDAD DEL PRECIO. Un aviso que no diga de cuándo es el precio se
  // lee como «ahora mismo», y puede ser de hace veinte minutos.
  comprobar('y los minutos que tenía el precio', m.params.minutos === 8)
  comprobar('el mensaje NO trae ninguna frase en español', !JSON.stringify(m).includes('tocó'))

  comprobar('bajar tiene su propia clave', mensajeDe({ ...a, lado: 'baja' }, st, datoFresco).clave === 'misAvisos.msgBajo')
  const banda = { par: 'EUR/USD', tipo: 'banda', lado: 'abajo', nivel: -1 }
  comprobar('la banda también', mensajeDe(banda, { valor: -1.2 }, datoFresco).clave === 'misAvisos.msgBandaAbajo')
  comprobar('y el RSI', mensajeDe({ ...banda, tipo: 'rsi', lado: 'arriba', nivel: 70 }, { valor: 72 }, datoFresco).clave === 'misAvisos.msgRsiArriba')
  // ⚠️ Ninguna clave puede sugerir qué hacer. Un aviso informa; no aconseja.
  const todas = [
    mensajeDe(a, st, datoFresco).clave,
    mensajeDe({ ...a, lado: 'baja' }, st, datoFresco).clave,
    mensajeDe(banda, { valor: -1.2 }, datoFresco).clave,
    mensajeDe({ ...banda, lado: 'arriba', nivel: 1 }, { valor: 1.2 }, datoFresco).clave,
    mensajeDe({ ...banda, tipo: 'rsi', lado: 'abajo', nivel: 30 }, { valor: 28 }, datoFresco).clave,
    mensajeDe({ ...banda, tipo: 'rsi', lado: 'arriba', nivel: 70 }, { valor: 72 }, datoFresco).clave,
  ]
  comprobar(
    'ninguna clave dice comprar, vender ni recomendar',
    !todas.some((c) => /compra|venta|vender|recomend|sugier|entra|señal/i.test(c)),
  )
  comprobar('y son seis claves distintas', new Set(todas).size === 6)
}

console.log('')
if (mal) {
  console.log(`✗ ${mal} comprobación(es) MAL.\n`)
  process.exit(1)
}
console.log('✓ Todo bien.\n')
