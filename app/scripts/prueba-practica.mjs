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
  msDeVela,
  nivelesCoherentes,
  rbDe,
  resolverPractica,
  resumenPractica,
  velasDelPar,
} from '../src/lib/practica.js'
import { calcularInsignias } from '../src/lib/insignias.js'

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

console.log(mal ? `\n✗ ${mal} comprobaciones fallaron\n` : '\n✓ todo bien\n')
process.exit(mal ? 1 : 0)
