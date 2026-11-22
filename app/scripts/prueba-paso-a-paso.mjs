// Comprobaciones del modo «Paso a paso» (2026-11-22), sin internet.
//
//   node scripts/prueba-paso-a-paso.mjs
//
// En las dos apps (gemelo).

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LECCION_DE_PASO, PASOS, abiertasQueComparten, direccionFuerza, noticiasDelPar, paresCon } from '../src/lib/pasoAPaso.js'
import { LECCIONES } from '../src/lib/curso.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (r) => readFileSync(join(RAIZ, r), 'utf8')
let mal = 0
function ok(cond, msg) {
  if (!cond) mal++
  console.log(`${cond ? '  ✓' : '  ✗ MAL'} ${msg}`)
}

console.log('\n1. Los pasos y sus lecciones')
ok(PASOS.length === 9 && PASOS[0] === 'freno' && PASOS.at(-1) === 'decidir', 'nueve pasos, del freno a decidir')
ok(PASOS.every((id) => LECCIONES[LECCION_DE_PASO[id]]), 'cada paso enlaza una lección que existe')

console.log('\n2. Qué dirección va a favor de la fuerza')
const esc = { GBP: 9, JPY: 1, CHF: 8, USD: 2 }
ok(direccionFuerza('GBP/JPY', esc)?.aFavor === 'COMPRA', 'la fuerte va primero → COMPRA a favor')
ok(direccionFuerza('USD/CHF', esc)?.aFavor === 'VENTA' && direccionFuerza('USD/CHF', esc)?.enContra === 'COMPRA', 'la fuerte va segunda → VENTA a favor')
ok(direccionFuerza('GBP/JPY', { GBP: 5, JPY: 5 }) === null && direccionFuerza('GBP/JPY', { GBP: 5 }) === null, 'empate o dato que falta → null, nunca una dirección inventada')

console.log('\n3. Los pares con la fuerte o la débil')
const pares = [
  { name: 'GBP/JPY', b: 'GBP', q: 'JPY', dif: 1.2 },
  { name: 'EUR/USD', b: 'EUR', q: 'USD', dif: -3 },
  { name: 'USD/JPY', b: 'USD', q: 'JPY', dif: 0.4 },
  { name: 'GBP/USD', b: 'GBP', q: 'USD', dif: 2.5 },
]
const r = paresCon(pares, 'GBP', 'JPY')
ok(r.exacto === 'GBP/JPY', 'encuentra el par que junta las dos')
ok(!r.lista.some((p) => p.name === 'EUR/USD'), 'no mete pares sin ninguna de las dos')
ok(r.lista[0].name === 'GBP/USD' && r.lista.at(-1).name === 'USD/JPY', 'ordena por la Dif sin signo, de más a menos')
ok(paresCon(pares, 'EUR', 'JPY').exacto === null, 'si el par no existe, exacto es null')

console.log('\n4. Noticias: «no pude mirar» no es «no hay nada»')
const ahora = new Date('2026-11-20T12:00:00Z')
const cal = {
  eventos: [
    { t: 'CPI y/y', c: 'GBP', d: '2026-11-20T14:00:00Z', i: 'alto' },
    { t: 'Algo', c: 'EUR', d: '2026-11-20T14:00:00Z', i: 'alto' },
    { t: 'Viejo', c: 'JPY', d: '2026-11-19T14:00:00Z', i: 'alto' },
  ],
}
const evs = noticiasDelPar(cal, 'GBP/JPY', ahora)
ok(evs.length === 1 && evs[0].c === 'GBP', 'solo las de las dos divisas y que no han pasado')
ok(noticiasDelPar(null, 'GBP/JPY', ahora) === null && noticiasDelPar({}, 'GBP/JPY', ahora) === null, 'sin calendario → null, no lista vacía')

console.log('\n5. Operaciones abiertas que comparten divisa')
const trades = [
  { id: 1, par: 'EUR/JPY', estado: 'abierta' },
  { id: 2, par: 'GBP/USD', estado: 'cerrada' },
  { id: 3, par: 'AUD/CAD', estado: 'abierta' },
]
ok(abiertasQueComparten(trades, 'GBP/JPY').map((t) => t.id).join() === '1', 'solo las abiertas con una divisa en común')

console.log('\n6. No elige por la persona, y está enchufado')
const comp = leer('src/components/PasoAPaso.jsx')
ok(/useState\(null\)[\s\S]*const \[lado, setLado\] = useState\(null\)/.test(comp), 'la dirección arranca sin elegir')
ok(/const \[par, setPar\] = useState\(null\)/.test(comp), 'el par arranca sin elegir')
const iAviso = comp.indexOf("t('pasos.aviso')")
const iPasos = comp.lastIndexOf('PASOS.map((id, i)')
ok(iAviso > 0 && iPasos > iAviso, 'el aviso va antes de los pasos')
const app = leer('src/App.jsx')
ok(/<EntradaPasoAPaso /.test(app) && /tab === 'pasos' && \(\s*<PasoAPaso/.test(app), 'App.jsx enseña la entrada en el Barrido y el modo')
const an = leer('src/components/AnalizadorTab.jsx')
ok(/parInicial = null, ladoInicial = null/.test(an) && /useState\(parInicial && nombres\.includes\(parInicial\)/.test(an), 'el Analizador acepta el par y la dirección que trae el Paso a paso')
ok(/key=\{inicioAnalizador\?\.n \?\? 0\}/.test(app), 'el Analizador arranca de nuevo cada vez que se llega desde el Paso a paso')

console.log(mal ? `\n✗ ${mal} comprobación(es) fallaron.` : '\n✓ Todo bien.')
process.exit(mal ? 1 : 0)
