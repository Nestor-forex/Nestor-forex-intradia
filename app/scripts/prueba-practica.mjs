// Comprobaciones del modo práctica (punto 5 del plan, 2026-11-16), sin internet.
//
//   node scripts/prueba-practica.mjs
//
// GEMELO: mira la lógica pura (`src/lib/practica.js`), las reglas de Firestore
// y la pantalla, que son iguales en las dos apps. El programa que las resuelve
// vive solo en Swing y tiene su propia prueba (`prueba-practica-robot.mjs`).

import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CAMPOS_CREAR,
  CAMPOS_OPCIONALES,
  MAX_ABIERTAS,
  NOTA_MAX,
  fichaPractica,
  graficoDePractica,
  LOTE_MAX,
  RIESGO_USD_MAX,
  SPREAD_MAX,
  SWAP_MAX,
  MARCAS_MAX,
  costesPractica,
  limpiarMarcas,
  marcasDeAnalisis,
  HERRAMIENTAS_GRAFICA,
  nochesDeSwap,
  msDeVela,
  nivelesCoherentes,
  rbDe,
  resolverPractica,
  resumenPractica,
  velasDelPar,
} from '../src/lib/practica.js'
import { calcularInsignias } from '../src/lib/insignias.js'
import { EDAD_MAX_MT5_MIN, fichaConPrecioVivo, fuenteDePrecios, precioDeEntrada, velaDeEntradaMt5 } from '../src/lib/precioVivo.js'
import { HORIZONTAL, VERTICAL, leerVista, normalizarVista } from '../src/lib/vistaPantalla.js'

const AQUI = dirname(fileURLToPath(import.meta.url))
const leer = (r) => readFileSync(join(AQUI, '..', r), 'utf8')
let mal = 0
const ok = (cond, msg) => {
  console.log(`${cond ? '  ✓' : '  ✗ MAL'} ${msg}`)
  if (!cond) mal++
}

const DIA = 86_400_000
const HORA = 3_600_000
// Un día de Swing: compra en EUR/USD a 1.1000, SL 1.0950, TP 1.1100 (R/B 1:2).
const OP = { app: 'swing', par: 'EUR/USD', lado: 'COMPRA', entrada: 1.1, sl: 1.095, tp: 1.11, vela: '2026-11-10', metodo: 'app', creado: '2026-11-10T15:00:00Z' }
const FECHAS = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']
const velas = (altos, bajos) => ({ fechas: FECHAS, altos, bajos })

console.log('\n1 · Una operación válida, y las que no lo son')
ok(nivelesCoherentes('COMPRA', 1.1, 1.09, 1.12), 'compra: SL abajo, TP arriba')
ok(nivelesCoherentes('VENTA', 1.1, 1.12, 1.09), 'venta: SL arriba, TP abajo')
ok(!nivelesCoherentes('COMPRA', 1.1, 1.12, 1.09), 'compra con los niveles al revés: no')
ok(!nivelesCoherentes('COMPRA', 1.1, NaN, 1.12), 'un número roto: no')
ok(!nivelesCoherentes('COMPRAR', 1.1, 1.09, 1.12), 'un lado inventado: no')
ok(Math.abs(rbDe(OP) - 2) < 1e-9, 'R/B: 1:2')

const ANALISIS = { par: 'EUR/USD', lado: 'COMPRA', precio: 1.1, niveles: { sl: 1.095, tp: 1.11, rr: 2 } }
const f = fichaPractica({ app: 'swing', analisis: ANALISIS, metodo: 'simetrica', vela: '2026-11-10', nota: '  porque sí  ' })
ok(f && f.entrada === 1.1 && f.sl === 1.095 && f.tp === 1.11 && f.vela === '2026-11-10', 'la ficha sale del análisis, con sus mismos niveles')
ok(f && f.nota === 'porque sí', 'la nota se recorta')
ok(f && !('estado' in f) && !('r' in f) && !('creado' in f), 'la ficha NO trae resultado ni hora: la hora la pone el servidor')
ok(f && Object.keys(f).every((k) => CAMPOS_CREAR.includes(k) || CAMPOS_OPCIONALES.includes(k)), 'solo lleva campos que las reglas aceptan')
ok(fichaPractica({ app: 'swing', analisis: { ...ANALISIS, niveles: null }, vela: 'x' }) === null, 'sin niveles no hay práctica')
ok(fichaPractica({ app: 'swing', analisis: ANALISIS, vela: null }) === null, 'sin la fecha de la vela no hay práctica')
ok(fichaPractica({ app: 'swing', analisis: ANALISIS, vela: 'x', nota: 'a'.repeat(900) }).nota.length === NOTA_MAX, `la nota no pasa de ${NOTA_MAX}`)

console.log('\n2 · Cómo se decide')
// La vela de entrada (11-10) NO cuenta aunque toque el TP.
let d = resolverPractica(OP, velas([1.102, 1.12, 1.104, 1.105, 1.106], [1.098, 1.099, 1.097, 1.098, 1.099]))
ok(d.cambio && !d.estado && d.revisadoHasta === '2026-11-12', 'la vela de entrada no cuenta; la última va a medias y no se da por revisada')
d = resolverPractica(OP, velas([1.102, 1.105, 1.111, 1.105, 1.106], [1.098, 1.099, 1.097, 1.098, 1.099]))
ok(d.estado === 'ganada' && d.vela === '2026-11-11' && Math.abs(d.r - 2) < 1e-9, 'toca el TP → ganada, +2 R')
d = resolverPractica(OP, velas([1.102, 1.105, 1.104, 1.105, 1.106], [1.098, 1.099, 1.094, 1.098, 1.099]))
ok(d.estado === 'perdida' && d.r === -1, 'toca el SL → perdida, −1 R')
d = resolverPractica(OP, velas([1.102, 1.105, 1.12, 1.105, 1.106], [1.098, 1.099, 1.09, 1.098, 1.099]))
ok(d.estado === 'perdida', '⚠️ la misma vela toca las dos → PERDIDA (el peor caso)')
d = resolverPractica(OP, velas([1.102, 1.105, 1.104, 1.105, 1.12], [1.098, 1.099, 1.097, 1.098, 1.099]))
ok(d.estado === 'ganada' && d.vela === '2026-11-13', 'también se decide en la vela que va a medias, si ya tocó')
const VENTA = { ...OP, lado: 'VENTA', sl: 1.105, tp: 1.09 }
d = resolverPractica(VENTA, velas([1.102, 1.105, 1.104, 1.103, 1.101], [1.098, 1.099, 1.089, 1.098, 1.099]))
ok(d.estado === 'ganada' && Math.abs(d.r - 2) < 1e-9, 'venta: toca el TP por abajo → ganada')
d = resolverPractica(VENTA, velas([1.102, 1.105, 1.106, 1.103, 1.101], [1.098, 1.099, 1.097, 1.098, 1.099]))
ok(d.estado === 'perdida', 'venta: toca el SL por arriba → perdida')

console.log('\n3 · Lo que ya se revisó no se vuelve a mirar')
d = resolverPractica({ ...OP, revisadoHasta: '2026-11-12' }, velas([1.102, 1.105, 1.104, 1.12, 1.106], [1.098, 1.099, 1.097, 1.098, 1.099]))
ok(!d.cambio, 'una vela ya revisada que tocaba el TP no cuenta otra vez (la última sigue a medias)')
d = resolverPractica({ ...OP, revisadoHasta: '2026-11-12' }, velas([1.102, 1.105, 1.104, 1.105, 1.12], [1.098, 1.099, 1.097, 1.098, 1.099]))
ok(d.estado === 'ganada' && d.vela === '2026-11-13', 'se sigue desde donde se quedó')

console.log('\n4 · Lo que no se puede saber NO se inventa')
d = resolverPractica({ ...OP, vela: '2026-11-05', creado: '2026-11-05T15:00:00Z' }, velas([1.2, 1.2, 1.2, 1.2, 1.2], [1.0, 1.0, 1.0, 1.0, 1.0]))
ok(d.estado === 'caducada', 'la vela de entrada ya salió del barrido → caducada, no perdida ni ganada')
d = resolverPractica({ ...OP, vela: '2026-11-14', creado: '2026-11-14T15:00:00Z' }, velas([1.2, 1.2, 1.2, 1.2, 1.2], [1.0, 1.0, 1.0, 1.0, 1.0]))
ok(!d.cambio, 'el barrido va atrasado (la vela de entrada todavía no llega) → esperar')
ok(!resolverPractica(OP, null).cambio, 'sin velas → esperar')
ok(!resolverPractica(OP, { fechas: FECHAS, altos: [1], bajos: [1] }).cambio, 'con listas que no cuadran → esperar')
ok(!resolverPractica({ ...OP, estado: 'ganada' }, velas([1.2, 1.2, 1.2, 1.2, 1.2], [1.0, 1.0, 1.0, 1.0, 1.0])).cambio, 'una ya resuelta no se toca')

console.log('\n5 · Nadie puede practicar con un precio que ya sabe adónde fue')
d = resolverPractica({ ...OP, creado: '2026-11-20T15:00:00Z' }, velas([1.102, 1.105, 1.104, 1.105, 1.106], [1.098, 1.099, 1.097, 1.098, 1.099]), { periodoMs: DIA })
ok(d.estado === 'invalida' && d.motivo === 'velaVieja', 'una vela de diez días antes de crearla → no válida')
d = resolverPractica({ ...OP, entrada: 1.2, tp: 1.25 }, velas([1.102, 1.105, 1.104, 1.105, 1.106], [1.098, 1.099, 1.097, 1.098, 1.099]), { periodoMs: DIA })
ok(d.estado === 'invalida' && d.motivo === 'fueraDeVela', 'un precio de entrada fuera de la vela → no válida')
d = resolverPractica({ ...OP, sl: 1.11, tp: 1.095 }, velas([1.102, 1.105, 1.104, 1.105, 1.106], [1.098, 1.099, 1.097, 1.098, 1.099]))
ok(d.estado === 'invalida' && d.motivo === 'niveles', 'niveles al revés → no válida')
// Intradía: la vela de entrada es la última hora CERRADA, así que la siguiente
// ya había empezado al crearla. Esa no cuenta.
const H = ['2026-11-10 13:00:00', '2026-11-10 14:00:00', '2026-11-10 15:00:00', '2026-11-10 16:00:00']
const OPH = { ...OP, app: 'intradia', vela: H[0], creado: '2026-11-10T14:40:00Z' }
d = resolverPractica(OPH, { fechas: H, altos: [1.101, 1.12, 1.104, 1.105], bajos: [1.099, 1.099, 1.098, 1.099] }, { periodoMs: HORA })
ok(!d.estado, '⚠️ la hora que ya iba en curso al crearla no cuenta aunque haya tocado el TP')
d = resolverPractica(OPH, { fechas: H, altos: [1.101, 1.104, 1.12, 1.105], bajos: [1.099, 1.099, 1.098, 1.099] }, { periodoMs: HORA })
ok(d.estado === 'ganada' && d.vela === H[2], 'la hora siguiente, que empezó después, sí cuenta')

console.log('\n6 · Las fechas de vela se leen en UTC')
ok(msDeVela('2026-11-10') === Date.parse('2026-11-10T00:00:00Z'), 'Swing: el día, a las 00:00 UTC')
ok(msDeVela('2026-11-10 14:00:00') === Date.parse('2026-11-10T14:00:00Z'), 'Intradía: la hora, en UTC (no la del aparato)')
ok(msDeVela('') === null && msDeVela(null) === null && msDeVela('basura') === null, 'lo que no se entiende es null')
// En Colombia la cuenta tiene que dar lo mismo. En una máquina en UTC no podría
// fallar, así que se repite en un proceso con la zona de Bogotá.
const enBogota = execFileSync(process.execPath, ['-e', `import('${join(AQUI, '..', 'src/lib/practica.js').replaceAll('\\', '/')}').then(m=>console.log(m.msDeVela('2026-11-10 14:00:00')))`], { env: { ...process.env, TZ: 'America/Bogota' } }).toString().trim()
ok(Number(enBogota) === Date.parse('2026-11-10T14:00:00Z'), 'y da lo mismo con el reloj del aparato en Bogotá')

console.log('\n7 · Las velas salen del barrido publicado')
const B = { fechas20: FECHAS, pares: [{ name: 'EUR/USD', altos20: [1, 2, 3, 4, 5], bajos20: [0, 1, 2, 3, 4] }] }
ok(velasDelPar(B, 'EUR/USD')?.altos?.[4] === 5, 'el par y sus máximos')
ok(velasDelPar(B, 'GBP/USD') === null, 'un par que no está → null')
ok(velasDelPar({ pares: B.pares }, 'EUR/USD') === null, 'un barrido viejo sin `fechas20` → null (esperar, no adivinar)')

console.log('\n8 · El resumen solo cuenta ganadas y perdidas')
const R = resumenPractica([{ estado: 'ganada', r: 2 }, { estado: 'perdida', r: -1 }, { estado: 'perdida', r: -1 }, { estado: 'caducada' }, { estado: 'invalida' }, {}])
ok(R.resueltas === 3 && R.ganadas === 1 && R.abiertas === 1 && R.otras === 2, 'caducadas e inválidas aparte; la abierta, aparte')
ok(Math.abs(R.sumaR - 0) < 1e-9 && Math.abs(R.acierto - 100 / 3) < 1e-9, 'acierto 33 %, resultado 0 R: acertar no es ganar')
ok(resumenPractica([]).acierto === null && resumenPractica([]).sumaR === null, 'sin resueltas no hay número (null, no 0)')

console.log('\n9 · La insignia premia terminar, no ganar')
const gan = Array.from({ length: 5 }, () => ({ estado: 'ganada', r: 2 }))
const per = Array.from({ length: 5 }, () => ({ estado: 'perdida', r: -1 }))
const ins = (p) => calcularInsignias([], {}, p).find((i) => i.id === 'practica')
ok(ins(gan).conseguida && ins(per).conseguida, '5 ganadas o 5 perdidas dan la misma insignia')
ok(!ins([{}, {}, {}, {}, {}]).conseguida, '5 abiertas todavía no')
ok(!ins([...per.slice(0, 4), { estado: 'caducada' }]).conseguida, 'una caducada no cuenta')

console.log('\n10 · Las reglas de Firestore dicen lo mismo que el código')
const reglas = leer('../firestore.rules')
const bloque = reglas.slice(reglas.indexOf('match /practica/{opId}'), reglas.indexOf('match /practica/{opId}') + 4000)
const lista = (re) => (bloque.match(re)?.[1] || '').match(/'([^']+)'/g)?.map((x) => x.slice(1, -1)) || []
ok(bloque.includes('match /practica/{opId}'), 'hay reglas para `practica`')
ok(JSON.stringify(lista(/hasAll\(\[([^\]]+)\]/)) === JSON.stringify([...CAMPOS_CREAR]), 'los campos obligatorios son los de `CAMPOS_CREAR`')
ok(JSON.stringify(lista(/hasOnly\(\[([^\]]+)\]/)) === JSON.stringify([...CAMPOS_CREAR, ...CAMPOS_OPCIONALES]), 'y no acepta ninguno más')
ok(!/allow (read, )?(write|update)/.test(bloque.slice(0, bloque.indexOf('}\n'))), '⚠️ el teléfono NO puede actualizar: el resultado lo escribe solo el programa')
ok(/allow delete:[\s\S]*?!\('estado' in resource\.data\)/.test(bloque), '⚠️ solo se puede borrar una abierta')
ok(/creado == request\.time/.test(bloque), '⚠️ la hora es la del servidor')
ok(new RegExp(`nota\\.size\\(\\) <= ${NOTA_MAX}`).test(bloque), `la nota, como mucho ${NOTA_MAX} letras en las dos partes`)

console.log('\n11 · La pantalla')
const tarjeta = leer('src/components/Practica.jsx')
const an = leer('src/components/AnalizadorTab.jsx')
const diario = leer('src/components/DiarioTab.jsx')
const es = leer('src/lib/i18n/textos/es.js')
ok(tarjeta.indexOf("tr('prac.aviso')") > 0 && tarjeta.indexOf("tr('prac.aviso')") < tarjeta.indexOf('res.resueltas > 0'), 'el aviso va ANTES de cualquier número')
ok(/<Practica /.test(diario), 'la tarjeta está enchufada en el Diario')
ok(/fichaPractica\(/.test(an) && /onPracticar\(op\)/.test(an), 'el Analizador crea la ficha con `fichaPractica` y la guarda')
ok(!/estado:|\br:/.test(an.slice(an.indexOf('fichaPractica('), an.indexOf('fichaPractica(') + 400)), 'el Analizador no escribe ningún resultado')
ok(new RegExp(`MAX_ABIERTAS`).test(an) && MAX_ABIERTAS === 20, `como mucho ${MAX_ABIERTAS} abiertas`)
for (const k of ['titulo', 'desc', 'paraQue', 'aviso', 'comoSeDecide', 'caducadaD', 'motivo_velaVieja', 'motivo_fueraDeVela', 'motivo_niveles']) {
  ok(new RegExp(`\\n  prac: \\{[\\s\\S]*?\\n    ${k}:`).test(es), `existe prac.${k}`)
}
ok(/\n    practicar:/.test(es) && /\n    practicaT:/.test(es), 'existen el botón y la insignia')
ok(!/compra|vende|comprar|vender/i.test(es.slice(es.indexOf('\n  prac: {'), es.indexOf('\n  },', es.indexOf('\n  prac: {'))).replace(/compra: "COMPRA"/, '').replace(/venta: "VENTA"/, '')), 'ningún texto dice compra o vende')

console.log('\n12 · El riesgo en dólares (del perfil) y la gráfica')
{
  const an = { par: 'EUR/USD', lado: 'COMPRA', precio: 1.1, niveles: { sl: 1.095, tp: 1.11 } }
  const con = fichaPractica({ app: 'swing', analisis: { ...an, lote: { lote: 0.234, riesgoUsd: 25.004 } }, metodo: 'app', vela: '2026-11-10' })
  ok(con.riesgoUsd === 25 && con.lote === 0.23, 'guarda el riesgo en dólares y el lote del Analizador, redondeados')
  const sin = fichaPractica({ app: 'swing', analisis: an, metodo: 'app', vela: '2026-11-10' })
  ok(!('riesgoUsd' in sin) && !('lote' in sin), 'sin perfil no inventa dinero: la operación se sigue igual, en R')
  const raro = fichaPractica({ app: 'swing', analisis: { ...an, lote: { lote: LOTE_MAX * 2, riesgoUsd: -5 } }, metodo: 'app', vela: '2026-11-10' })
  ok(!('riesgoUsd' in raro) && !('lote' in raro), 'un número raro no se guarda')
  // Con la entrada de MT5 el spread ya va dentro y no hay swap guardado: el
  // neto es el bruto, y el dinero R × lo arriesgado.
  const base = { par: 'EUR/USD', app: 'swing', fuente: 'mt5', entrada: 1.1, sl: 1.099, tp: 1.102 }
  const r = resumenPractica([
    { ...base, estado: 'ganada', r: 2, riesgoUsd: 10 },
    { ...base, estado: 'perdida', r: -1, riesgoUsd: 20 },
    { ...base, estado: 'perdida', r: -1 },
  ])
  ok(r.dinero === 0 && r.conDinero === 2 && r.resueltas === 3, 'el dinero sale del neto × lo arriesgado, y solo de las que lo guardaron')
  ok(resumenPractica([{ ...base, estado: 'ganada', r: 1 }]).dinero === null, 'sin ninguna con dinero dice «no lo sé» (null), no 0')
  ok(new RegExp(`riesgoUsd <= ${RIESGO_USD_MAX}`).test(bloque) && new RegExp(`lote <= ${LOTE_MAX}`).test(bloque), 'las reglas ponen los mismos topes que el código')

  const F = ['a', 'b', 'c', 'd']
  const barrido = { fechas20: F, pares: [{ name: 'EUR/USD', serie20: [1, 2, 3, 4], altos20: [2, 3, 4, 5], bajos20: [0, 1, 2, 3] }] }
  const g = graficoDePractica({ par: 'EUR/USD', vela: 'b', velaResuelta: 'd' }, barrido)
  ok(g && g.iEntrada === 1 && g.iResuelta === 3 && g.cierres.length === 4, 'la gráfica usa las MISMAS velas del barrido con que se decide')
  ok(graficoDePractica({ par: 'EUR/USD', vela: 'zz' }, barrido).iEntrada === -1, 'una entrada que ya salió de las velas no se dibuja en otro sitio')
  ok(graficoDePractica({ par: 'EUR/USD', vela: 'b' }, { pares: barrido.pares }) === null, 'sin fechas no hay gráfica (no se inventan)')
  ok(graficoDePractica({ par: 'EUR/USD', vela: 'b' }, { fechas20: F, pares: [{ name: 'EUR/USD', serie20: [1, 2, 3, NaN], altos20: [2, 3, 4, 5], bajos20: [0, 1, 2, 3] }] }) === null, 'con un dato roto no dibuja nada (una mecha de altura cero sería falsa)')
  const graf = leer('src/components/GraficoPractica.jsx')
  ok(/<GraficoPractica /.test(tarjeta) && /graficoDePractica\(/.test(tarjeta), 'la tarjeta dibuja la gráfica con `graficoDePractica`')
  ok(/velas=\{velasPractica\}/.test(diario), 'el Diario le pasa las velas a la tarjeta')
  ok(/dir="ltr"/.test(graf), 'la gráfica no se voltea en árabe')
  for (const k of ['grafVer', 'grafOcultar', 'grafPie', 'grafAntes', 'grafSinDatos', 'dineroL', 'dineroNota', 'riesgoL']) {
    ok(new RegExp(`\\n  prac: \\{[\\s\\S]*?\\n    ${k}:`).test(es), `existe prac.${k}`)
  }
}

console.log('\n13 · Lo que cuesta operar de verdad: spread y swap (2026-11-17)')
{
  const op = { par: 'EUR/USD', app: 'intradia', lado: 'COMPRA', entrada: 1.1, sl: 1.099, tp: 1.102, estado: 'ganada', r: 2, riesgoUsd: 50 }
  // 10 pips de riesgo. Twelve: se resta el spread (1 pip = 0,1 R).
  const c1 = costesPractica({ ...op, fuente: 'twelve', spread: 1 })
  ok(Math.abs(c1.spreadR - 0.1) < 1e-9 && Math.abs(c1.rNeto - 1.9) < 1e-9, 'con la entrada de Twelve se resta el spread (1 pip de 10 = 0,1 R)')
  ok(Math.abs(c1.usdNeto - 95) < 1e-9, 'y el dinero es el neto × lo arriesgado (1,9 × 50 = 95)')
  ok(c1.sinSwap === true && c1.swapR === null, 'sin swap guardado lo dice («sin dato») y no inventa un número')
  const c2 = costesPractica({ ...op, fuente: 'mt5', spread: 1 })
  ok(c2.spreadR === 0 && c2.spreadIncluido && c2.rNeto === 2, 'con la entrada de MT5 el spread YA va dentro (ASK/BID): no se resta dos veces')
  ok(costesPractica({ ...op, fuente: 'twelve' }).sinSpread === true, 'sin spread guardado lo dice, no pone 0')
  // Swap: −0,5 pips por noche; creada un lunes 10:00 UTC, resuelta en la vela del martes 09:00.
  const creado = Date.parse('2026-11-16T10:00:00Z')
  const c3 = costesPractica({ ...op, fuente: 'mt5', swap: -0.5, swap3: 3, creado, velaResuelta: '2026-11-17 09:00:00' })
  ok(c3.noches === 1 && Math.abs(c3.swapR - -0.05) < 1e-9 && Math.abs(c3.rNeto - 1.95) < 1e-9, 'una noche de swap (−0,5 pips de 10 = −0,05 R)')
  ok(nochesDeSwap(Date.parse('2026-11-18T10:00:00Z'), Date.parse('2026-11-19T10:00:00Z'), 3) === 3, 'el miércoles cobra el TRIPLE (swap3 = 3)')
  ok(nochesDeSwap(Date.parse('2026-11-20T23:00:00Z'), Date.parse('2026-11-22T23:00:00Z'), 3) === 0, 'sábado y domingo no cobran')
  ok(nochesDeSwap(Date.parse('2026-11-16T23:00:00Z'), Date.parse('2026-11-16T23:30:00Z'), 3) === 0, 'sin cruzar las 22:00 UTC no hay noche')
  ok(costesPractica({ ...op, estado: 'caducada' }) === null, 'una caducada no tiene resultado que descontar')

  // La ficha guarda la fuente, el spread y el swap del lado que toca.
  const an = { par: 'EUR/USD', lado: 'VENTA', precio: 1.1, niveles: { sl: 1.101, tp: 1.098 }, herramientas: {} }
  const cot = { bid: 1.1, ask: 1.1001, spread: 1, swapLargo: -0.6, swapCorto: 0.2, swap3: 3 }
  const fm = fichaPractica({ app: 'intradia', analisis: an, metodo: 'app', vela: '2026-11-17 02:00:00', entrada: precioDeEntrada(cot, 'VENTA'), cotizacion: cot })
  ok(fm.fuente === 'mt5' && fm.spread === 1 && fm.swap === 0.2 && fm.swap3 === 3 && !('spreadEl' in fm), 'con MT5 guarda fuente, spread y el swap CORTO para una venta')
  const ft = fichaPractica({ app: 'intradia', analisis: an, metodo: 'app', vela: '2026-11-17 02:00:00', cotizacion: cot, fotoEl: '2026-11-16T23:49:28Z' })
  ok(ft.fuente === 'twelve' && ft.spread === 1 && ft.spreadEl === '2026-11-16T23:49:28Z', 'con Twelve guarda el spread de la foto y DE CUÁNDO es')
  const fr = fichaPractica({ app: 'intradia', analisis: an, metodo: 'app', vela: 'x', cotizacion: { spread: SPREAD_MAX * 2, swapCorto: SWAP_MAX * 3 } })
  ok(!('spread' in fr) && !('swap' in fr), 'un spread o un swap absurdo no se guardan')

  // Las reglas ponen los mismos topes y dejan los campos nuevos.
  const reglas = leer('../firestore.rules')
  ok(new RegExp(`spread <= ${SPREAD_MAX}`).test(reglas) && new RegExp(`swap <= ${SWAP_MAX}`).test(reglas) && new RegExp(`marcas.size\\(\\) <= ${MARCAS_MAX}`).test(reglas), 'las reglas ponen los mismos topes de spread, swap y marcas')

  // La tolerancia de la entrada de MT5 contra las velas de Twelve.
  const velas = { fechas: ['2026-11-17 02:00:00', '2026-11-17 03:00:00'], altos: [1.1003, 1.1005], bajos: [1.0995, 1.0990] }
  const creadoM = Date.parse('2026-11-17T02:30:00Z')
  const mt5op = { app: 'intradia', par: 'EUR/USD', lado: 'COMPRA', entrada: 1.10045, sl: 1.099, tp: 1.103, vela: '2026-11-17 02:00:00', creado: creadoM, fuente: 'mt5', spread: 1 }
  ok(resolverPractica(mt5op, velas, { periodoMs: 3_600_000 }).estado !== 'invalida', 'una entrada de MT5 1,5 pips por fuera de la vela de Twelve se acepta (fuentes distintas)')
  ok(resolverPractica({ ...mt5op, entrada: 1.102 }, velas, { periodoMs: 3_600_000 }).motivo === 'fueraDeVela', 'pero 17 pips por fuera no: eso es un precio de otra hora')
  ok(resolverPractica({ ...mt5op, fuente: 'twelve' }, velas, { periodoMs: 3_600_000 }).motivo === 'fueraDeVela', 'con Twelve la tolerancia sigue siendo la de siempre')
}

console.log('\n14 · Lo que la persona programó, en la gráfica')
{
  const a = {
    herramientas: {
      niveles: { sop: 1.09, res: 1.11 },
      pivote: { p: 1.1, r1: 1.105, s1: 1.095, r2: 1.11, s2: 1.09 },
      tendencia: { corta: 1.101, larga: 1.099, nombres: { corta: 'EMA 20', larga: 'EMA 50' } },
      medias: { sma: [{ p: 20, v: 1.1 }], ema: [{ p: 20, v: 1.101 }, { p: 200, v: null }] },
      bollinger: { arriba: 1.12, media: 1.1, abajo: 1.08 },
      fibonacci: { niveles: [{ ratio: 0.618, precio: 1.097 }] },
      fvg: { huecos: [{ arriba: 1.104, abajo: 1.103 }] },
    },
  }
  const m = marcasDeAnalisis(a)
  ok(m.some((x) => x.k === 'sop' && x.v === 1.09) && m.some((x) => x.k === 'res' && x.v === 1.11), 'guarda el soporte y la resistencia')
  ok(m.filter((x) => x.k === 'piv').length === 5, 'guarda el pivote y sus cuatro niveles')
  ok(m.filter((x) => x.k === 'ema' && x.e === 'EMA 20').length === 1, 'la EMA 20 de la tendencia y la de «Medias» no se repiten')
  ok(!m.some((x) => x.v === null), 'una media sin valor (faltan velas) no se guarda como 0')
  ok(m.some((x) => x.k === 'fvg' && x.v === 1.104 && x.v2 === 1.103), 'un FVG se guarda como zona, con sus dos bordes')
  ok(m.some((x) => x.k === 'fib' && x.e === '61.8%'), 'Fibonacci con su porcentaje')
  ok(marcasDeAnalisis({ herramientas: {} }).length === 0, 'sin herramientas encendidas no se guarda nada')
  ok(limpiarMarcas([{ k: 'raro', v: 1 }, { k: 'sop', v: 'x' }, { k: 'sop', v: 1 }]).length === 1, 'lo guardado se limpia al leer: un tipo desconocido o un precio roto no se dibujan')
  ok(limpiarMarcas(Array.from({ length: 99 }, () => ({ k: 'sop', v: 1 }))).length === MARCAS_MAX, `como mucho ${MARCAS_MAX} marcas`)
  const F = ['a', 'b']
  const g = graficoDePractica({ par: 'X', vela: 'a', marcas: m }, { fechas20: F, pares: [{ name: 'X', serie20: [1, 2], altos20: [2, 3], bajos20: [0, 1], abiertos20: [0.5, 1.5] }] })
  ok(g.abiertos && g.abiertos.length === 2 && g.marcas.length === m.length, 'con aperturas la gráfica tiene velas completas y las marcas')
  const g2 = graficoDePractica({ par: 'X', vela: 'a' }, { fechas20: F, pares: [{ name: 'X', serie20: [1, 2], altos20: [2, 3], bajos20: [0, 1], abiertos20: [0.5, NaN] }] })
  ok(g2.abiertos === null, 'con una apertura rota NO se inventa: se dibujan barras de máximo-mínimo')
  const graf = leer('src/components/GraficoPractica.jsx')
  ok(!/var\(--green\)|var\(--red\)/.test(graf), 'las velas no van en verde y rojo (esos colores son el Take-profit y el Stop-loss)')
}

console.log('\n15 · El precio con su fuente y la vista (2026-11-17)')
{
  const ahora = new Date('2026-11-17T03:00:00Z')
  ok(fuenteDePrecios({ estado: 'ok', actualizadoEl: '2026-11-17T02:55:00Z', ahora }).fuente === 'mt5', 'con una foto de MT5 de hace 5 min manda MT5')
  const viejo = fuenteDePrecios({ estado: 'ok', actualizadoEl: '2026-11-16T23:49:00Z', ahora })
  ok(viejo.fuente === 'twelve' && viejo.motivo === 'viejo', `con una foto de hace horas manda Twelve y dice por qué («viejo»; más de ${EDAD_MAX_MT5_MIN} min)`)
  ok(fuenteDePrecios({ estado: 'sin-datos', ahora }).motivo === 'apagado', 'sin foto: Twelve, «el puente está apagado»')
  ok(fuenteDePrecios({ estado: 'ok', actualizadoEl: null, ahora }).fuente === 'twelve', 'una foto sin hora NO se da por reciente')
  const q = { bid: 1.1, ask: 1.1002, spread: 2 }
  ok(precioDeEntrada(q, 'COMPRA').precio === 1.1002 && precioDeEntrada(q, 'VENTA').precio === 1.1, 'comprar al ASK y vender al BID')
  ok(precioDeEntrada({ bid: 1.2, ask: 1.1 }, 'COMPRA') === null, 'un ASK por debajo del BID es un dato roto: no se usa')
  const ficha = { name: 'EUR/USD', precio: 1.09 }
  ok(fichaConPrecioVivo(ficha, { fuente: 'mt5', quotes: { 'EUR/USD': q }, lado: 'COMPRA' }).ficha.precio === 1.1002, 'el Analizador calcula desde el precio de MT5')
  ok(fichaConPrecioVivo(ficha, { fuente: 'twelve', quotes: { 'EUR/USD': q }, lado: 'COMPRA' }).ficha === ficha, 'con el puente apagado, desde el cierre de Twelve, tal cual')
  ok(velaDeEntradaMt5('intradia', 'x', new Date('2026-11-17T02:37:12Z')) === '2026-11-17 02:00:00', 'Intradía: la vela de la hora en curso, con el formato del barrido')
  ok(velaDeEntradaMt5('swing', '2026-11-18', ahora) === '2026-11-18', 'Swing: la última vela del barrido (la fecha de la vela diaria no cambia a medianoche)')
  ok(normalizarVista('raro') === VERTICAL && normalizarVista(HORIZONTAL) === HORIZONTAL, 'la vista: ante la duda, vertical')
  ok(leerVista({ getItem: () => { throw new Error('bloqueado') } }) === VERTICAL, 'si el teléfono no deja leer, vertical')
  const fuente = leer('src/components/FuentePrecio.jsx')
  // El nombre del bróker va CODIFICADO: este archivo también es público.
  const suyo = new RegExp(Buffer.from('YXZhXHMqdHJhZGV8YXZhLXJlYWw=', 'base64').toString('utf8'), 'i')
  ok(!suyo.test(fuente + es), 'nunca se nombra al bróker')
  const barrido = leer('src/components/BarridoTab.jsx')
  ok(/<FuentePrecio /.test(barrido) && /<FuentePrecio /.test(an), 'el barrido y el Analizador dicen de dónde sale el precio')
  ok(/fichaConPrecioVivo\(/.test(an) && /cotizacion:/.test(an) && /marcas: marcasDeAnalisis\(/.test(an), 'el Analizador usa el precio de MT5 y guarda costes y marcas en la práctica')
  // ⚠️ 2026-11-17: la gráfica salía «muy sencilla» porque solo guardaba lo que
  // estaba encendido. Ahora se guardan TODAS las que se dibujan.
  ok(/marcas: marcasDeAnalisis\(analizarCon\(HERRAMIENTAS_GRAFICA/.test(an), 'la práctica guarda TODAS las herramientas que se dibujan, no solo las encendidas')
  ok(!/marcas: marcasDeAnalisis\(a\)/.test(an), 'y ya no solo las de la tarjeta')
  const fuenteMarcas = leer('src/lib/practica.js').match(/export function marcasDeAnalisis[\s\S]*?\n}\n/)?.[0] ?? ''
  const familias = [...fuenteMarcas.matchAll(/h\.(\w+)/g)].map((x) => x[1])
  const sinLista = [...new Set(familias)].filter((x) => !HERRAMIENTAS_GRAFICA.includes(x))
  ok(familias.length > 0 && sinLista.length === 0, `toda herramienta que marcasDeAnalisis dibuja está en HERRAMIENTAS_GRAFICA${sinLista.length ? ' (faltan: ' + sinLista.join(', ') + ')' : ''}`)
  const sumaMax = 2 + 5 + 2 + 7 + 3 + 5 + 4
  ok(sumaMax <= MARCAS_MAX, `con todas encendidas caben (${sumaMax} de ${MARCAS_MAX})`)
}

console.log(mal ? `\n✗ ${mal} comprobaciones fallaron\n` : '\n✓ todo bien\n')
process.exit(mal ? 1 : 0)
