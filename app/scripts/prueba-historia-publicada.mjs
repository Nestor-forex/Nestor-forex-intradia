// Comprobaciones de la historia que lee el laboratorio (2026-11-18), sin
// internet ni créditos. Solo Intradía (PRIMO): cada app la publica a su manera.
//
//   node scripts/prueba-historia-publicada.mjs

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { armarHistoria, tocaEscribir } from './lib/historia-publicada.mjs'
import { PAIRS } from '../src/lib/marketCalc.js'
import { probarRegla } from '../src/lib/laboratorio.js'
import { historiaValida } from '../src/lib/useHistoria.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (r) => readFileSync(join(RAIZ, r), 'utf8')
let fallos = 0
const ok = (c, m) => {
  console.log(`${c ? '✓' : '✗'} ${m}`)
  if (!c) fallos++
}

// Un mercado inventado de 700 velas de una hora para los 7 símbolos.
const CCY = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD']
const BASE = { EUR: 0.92, GBP: 0.79, JPY: 150, CHF: 0.88, AUD: 1.52, NZD: 1.66, CAD: 1.37 }
let semilla = 7
const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647)
const barras = []
const rates = {}
const rangos = {}
const nivel = { ...BASE }
for (let i = 0; i < 700; i++) {
  const t = new Date(Date.UTC(2026, 8, 1, i)).toISOString().replace('T', ' ').slice(0, 19)
  barras.push(t)
  rates[t] = {}
  rangos[t] = {}
  for (const c of CCY) {
    nivel[c] *= 1 + (azar() - 0.5) * 0.004
    rates[t][c] = nivel[c]
    rangos[t][c] = { h: nivel[c] * 1.0015, l: nivel[c] * 0.9985 }
  }
}
const largo = { barras, rates, rangos }
const h = armarHistoria(largo, new Date('2026-11-18T12:00:00Z'))

console.log('\n1 · La forma')
ok(h && h.v === 1 && h.vela === '1h', 'versión 1, velas de una hora')
ok(h.fechas.length === 700, 'las 700 velas de la serie larga')
ok(PAIRS.every(([b, q]) => h.pares[`${b}/${q}`]?.c.length === 700), `los ${PAIRS.length} pares`)
ok(Math.abs(h.pares['EUR/USD'].c[0] - 1 / rates[barras[0]].EUR) < 1e-5, 'EUR/USD es el inverso de lo que vale un dólar en euros')
ok(Object.values(h.pares).every((s) => s.h.every((v, i) => v >= s.l[i])), 'el máximo nunca queda por debajo del mínimo')
ok(historiaValida(JSON.parse(JSON.stringify(h))), 'la app la da por buena después de pasar por JSON')
ok(JSON.stringify(h).length / 1024 < 700, `pesa ${(JSON.stringify(h).length / 1024).toFixed(0)} KB`)

console.log('\n2 · Una vez al día')
ok(tocaEscribir(null) && tocaEscribir('basura'), 'sin historia o ilegible: se escribe')
ok(!tocaEscribir('2026-11-18T01:00:00Z', new Date('2026-11-18T20:00:00Z')), 'del mismo día: no se reescribe')
ok(tocaEscribir('2026-11-17T23:00:00Z', new Date('2026-11-18T00:30:00Z')), 'de ayer: se escribe')

console.log('\n3 · Lo que falta no se inventa')
ok(armarHistoria(null) === null && armarHistoria({ barras: [], rates: {}, rangos: {} }) === null, 'sin serie larga no hay historia')

console.log('\n4 · El laboratorio prueba sobre ella')
{
  const r = probarRegla({ lado: 'COMPRA', condiciones: [{ tipo: 'rsi', op: '<=', valor: 35 }], riesgoATR: 1.5, objetivoRB: 1 }, h, () => 2)
  ok(!r.error && r.ops > 0, `una regla sencilla da operaciones (${r.ops})`)
}

console.log('\n5 · El publicador la escribe sin poner en riesgo el barrido')
{
  const v = leer('scripts/publicar-barrido.mjs')
  ok(v.indexOf('escribir(BARRIDO, texto)') < v.indexOf('armarHistoria(largo'), 'después del barrido')
  ok(/try \{\s*const anterior/.test(v), 'dentro de un try')
  ok(/rangos: largo\.rangos/.test(leer('scripts/lib/velas.mjs')), 'la serie larga trae los máximos y mínimos')
}

console.log(fallos ? `\n✗ ${fallos} comprobaciones fallaron` : '\n✓ todo bien')
process.exit(fallos ? 1 : 0)
