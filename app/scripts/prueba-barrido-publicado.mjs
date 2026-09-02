// Prueba del archivo que lee la app. Sin internet:
//
//     node scripts/prueba-barrido-publicado.mjs
//
// Esto vigila DOS fallos que no se ven, y los dos son de los que aparecen como
// "la app se ve rara" en el celular de Néstor y no como un error en ningún
// registro:
//
//   1. QUE FALTE UN CAMPO. Si `armarBarrido` deja fuera algo que la app
//      necesita, la pantalla saldrá con huecos, con "undefined" o vacía. El
//      vigía no se entera: él escribió su archivo tan tranquilo.
//
//   2. QUE SE CUELE UNA SERIE LARGA. Son 300 números por par y 18 pares. Un
//      descuido aquí multiplica por cincuenta el tamaño de lo que se baja cada
//      vez que alguien abre la app, y tampoco avisa nadie: simplemente la app
//      tarda mucho más en abrir, sobre todo con datos móviles.
//
// La prueba corre el barrido de verdad sobre un mercado inventado, lo publica,
// lo vuelve a leer como lo leería el navegador (pasando por JSON, que es donde
// se pierden los `undefined` y los `NaN`) y exige que `derivarVista` saque lo
// mismo que sacaría con los datos completos.

import { computarBarrido, derivarVista } from '../src/lib/marketCalc.js'
import { armarBarrido, SERIES_LARGAS } from './lib/barrido-publicado.mjs'

let fallos = 0
const comprobar = (bien, que) => {
  console.log(`  ${bien ? '✓' : '✗'} ${que}`)
  if (!bien) fallos++
}

// --- Un mercado de mentira, pero con la forma del de verdad ---------------
//
// 400 velas de una hora para las 7 divisas contra el dólar. Cada una con su
// propia deriva y su propio vaivén, para que salgan pares con tendencia y
// pares en rango, y así el barrido tenga algo que clasificar.

// ⚠️ ESTE MERCADO COSTÓ VARIOS INTENTOS, Y LA RAZÓN MERECE QUEDAR ESCRITA.
//
// El primero era una tendencia limpia: deriva más un poco de vaivén. Salía un
// ADX de 100 —tendencia perfecta— y CERO setups. El motivo es que una
// tendencia sin retrocesos deja el RSI clavado arriba, y el filtro de RSI de
// la app la rechaza entera. La prueba pasaba comparando dos listas vacías.
//
// Por eso cada divisa lleva ahora una onda de periodo medio Y SU PROPIA FASE:
// suben, se devuelven, y no todas a la vez. Eso es lo que hace que el RSI
// respire y que los pares no se muevan en bloque.
const CCY = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD']
const BASE = { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 150, CHF: 0.88, AUD: 1.52, NZD: 1.64, CAD: 1.36 }
const DERIVA = { USD: 0, EUR: -0.00008, GBP: 0.00006, JPY: 0.024, CHF: 0.00004, AUD: -0.00012, NZD: 0.0001, CAD: -0.00006 }
const FASE = { USD: 0, EUR: 0.7, GBP: 1.9, JPY: 3.1, CHF: 4.4, AUD: 5.2, NZD: 2.5, CAD: 6.0 }

const barras = []
const rates = {}
const rangos = {}
for (let i = 0; i < 400; i++) {
  const t = `2026-07-${String(1 + Math.floor(i / 24)).padStart(2, '0')} ${String(i % 24).padStart(2, '0')}:00:00`
  barras.push(t)
  const fila = {}
  const filaRangos = {}
  for (const c of CCY) {
    // Deriva (la tendencia de fondo) + onda media (los retrocesos, que son lo
    // que hace bajar el RSI) + onda corta (para que el ATR no salga constante,
    // que es cuando las pruebas pasan sin comprobar nada).
    const v =
      BASE[c] *
      (1 + DERIVA[c] * i + 0.008 * Math.sin(i / 19 + FASE[c]) + 0.0015 * Math.sin(i / 2.7 + FASE[c]))
    fila[c] = v
    filaRangos[c] = { h: v * 1.0012, l: v * 0.9988 }
  }
  rates[t] = fila
  rangos[t] = filaRangos
}

const data = computarBarrido(barras, rates, rangos)

console.log('\n1. El barrido de mentira sirve para probar algo')
{
  comprobar(data.pares.length === 18, `salen los 18 pares de la app (${data.pares.length})`)
  const tendencias = new Set(data.pares.map((p) => p.tend))
  comprobar(tendencias.size >= 3, `y no todos hacen lo mismo (${[...tendencias].join(', ')})`)
  // Si el RSI saliera clavado arriba en todos, el filtro los rechazaría a
  // todos y no habría nada que comparar. Fue lo que pasó al primer intento.
  const rsis = data.pares.map((p) => p.rsiV)
  comprobar(
    Math.max(...rsis) - Math.min(...rsis) > 20,
    `el RSI está repartido y no clavado (de ${Math.min(...rsis).toFixed(0)} a ${Math.max(...rsis).toFixed(0)})`
  )
  comprobar(
    data.pares.every((p) => Number.isFinite(p.adx) && Number.isFinite(p.rsiV) && Number.isFinite(p.atrAbs)),
    'todos traen ADX, RSI y ATR con números de verdad'
  )
}

// --- 2. Lo que se publica pesa poco --------------------------------------

console.log('\n2. Lo publicado pesa poco')
const publicado = armarBarrido(data, new Date('2026-07-17T12:00:00Z'))
const texto = JSON.stringify(publicado)
{
  const kb = texto.length / 1024
  console.log(`  · tamaño: ${kb.toFixed(1)} KB`)
  // Con las series dentro pasaría de dos megas. El tope está holgado a
  // propósito: no es para afinar bytes, es para que un descuido grande no
  // pase inadvertido.
  comprobar(kb < 200, `cabe de sobra por debajo de 200 KB (${kb.toFixed(1)})`)

  const conSeries = JSON.stringify({ ...publicado, pares: data.pares }).length / 1024
  comprobar(conSeries > kb * 5, `y con las series dentro pesaría ${(conSeries / kb).toFixed(0)} veces más (${conSeries.toFixed(0)} KB)`)
}

console.log('\n3. Ninguna serie larga se coló')
{
  for (const serie of SERIES_LARGAS) {
    comprobar(!data.pares.some((p) => p[serie] === undefined), `\`${serie}\` sí existe en el barrido completo (si no, esta prueba no probaría nada)`)
    comprobar(publicado.pares.every((p) => p[serie] === undefined), `y \`${serie}\` NO se publica`)
  }

  // La red de verdad: cualquier campo con muchos números, se llame como se
  // llame. `serie20` son 20 y es la que dibuja el gráfico, así que el tope va
  // en 30 — pasa lo legítimo y no pasa una serie de 300.
  const gordos = []
  for (const p of publicado.pares) {
    for (const [campo, valor] of Object.entries(p)) {
      if (Array.isArray(valor) && valor.length > 30) gordos.push(`${p.name}.${campo} (${valor.length})`)
    }
  }
  comprobar(gordos.length === 0, gordos.length ? `SE COLARON series largas: ${gordos.slice(0, 5).join(', ')}` : 'ningún campo publicado trae más de 30 números')
}

// --- 4. LA COMPROBACIÓN QUE IMPORTA --------------------------------------
//
// Que la app, leyendo SOLO el archivo publicado, saque exactamente la misma
// pantalla que sacaría con los datos completos. Se pasa por JSON a propósito:
// es el viaje real, y es donde se pierden los `undefined` y los `NaN`.

console.log('\n4. La app ve lo mismo con el archivo que con los datos completos')
{
  const comoLoVeElNavegador = JSON.parse(texto)

  // Se comprueba con DOS configuraciones. La primera es la app tal cual. La
  // segunda abre todos los filtros a propósito: con los umbrales de la app un
  // mercado inventado da uno o dos setups, y con tan pocos la comparación
  // apenas toca código. Aflojando los filtros salen bastantes más y se
  // recorren muchos más caminos — y lo que se está comprobando no es qué
  // señales da la app, sino que el archivo lleva los mismos datos que el
  // barrido completo, así que cuantos más haya, mejor.
  const CONFIGS = [
    ['con los umbrales de la app', { thr: 0.5, topN: 3 }],
    [
      'y con los filtros abiertos, que ejercitan mucho más',
      { thr: 0.2, topN: 5, adxMin: 0, rsiMax: null, adxMaxRango: 100, compresionMin: 0, incluirRetrocesos: true },
    ],
  ]

  for (const [comoSeLlama, opciones] of CONFIGS) {
    const conTodo = derivarVista(data, opciones)
    const conArchivo = derivarVista(comoLoVeElNavegador, opciones)

    comprobar(conArchivo.setups.length > 0, `${comoSeLlama}: salen ${conArchivo.setups.length} setups, más de cero`)
    // Se comparan las vistas ENTERAS, no setup por setup: así, si algún día
    // `derivarVista` devuelve algo nuevo, entra solo en la comparación en vez
    // de quedarse sin comprobar hasta que alguien se acuerde de añadirlo.
    comprobar(
      JSON.stringify(conArchivo) === JSON.stringify(conTodo),
      '  la vista entera sale idéntica, hasta el último decimal'
    )

    // Que no haya quedado ningún hueco donde antes había un número: un
    // `undefined` que se pierde al pasar por JSON no rompe nada, solo deja la
    // pantalla en blanco por ese lado y nadie ve un error.
    const huecos = []
    for (const s of conArchivo.setups) {
      for (const [campo, valor] of Object.entries(s)) {
        if (valor === undefined || (typeof valor === 'number' && !Number.isFinite(valor))) huecos.push(`${s.name}.${campo}`)
      }
    }
    comprobar(huecos.length === 0, huecos.length ? `  hay huecos: ${huecos.slice(0, 5).join(', ')}` : '  ningún setup sale con huecos ni con NaN')
  }
}

// --- 5. Los campos propios de intradía viajan ----------------------------
//
// En swing esto no existe. Aquí, sin `horaUltima` y `factorHora`, la app se
// caería a la hora del reloj del teléfono: la etiqueta de sesión hablaría de
// un momento distinto al del barrido, y el umbral de clasificación sería otro.

console.log('\n5. La hora de la vela viaja en el archivo')
{
  comprobar(Number.isInteger(publicado.horaUltima), `\`horaUltima\` va y es un número (${publicado.horaUltima})`)
  comprobar(Array.isArray(publicado.factorHora) && publicado.factorHora.length === 24, '`factorHora` va con sus 24 horas')
  comprobar(publicado.ultima === data.ultima, 'y la vela más reciente es la misma')

  // Sin ellos, la vista cambiaría. Si esta comprobación no fallara al
  // quitarlos, es que no hacían falta y sobra publicarlos.
  const sinHora = derivarVista({ ...JSON.parse(texto), horaUltima: undefined, factorHora: undefined }, { thr: 0.5, topN: 3 })
  const conHora = derivarVista(JSON.parse(texto), { thr: 0.5, topN: 3 })
  comprobar(
    JSON.stringify(sinHora.sesion) !== JSON.stringify(conHora.sesion),
    'y quitarlos SÍ cambia la sesión — o sea que publicarlos no sobra'
  )
}

console.log('')
console.log(fallos ? `${fallos} comprobación(es) FALLARON` : 'El barrido publicado lleva todo lo que la app necesita, y nada de sobra.')
process.exit(fallos ? 1 : 0)
