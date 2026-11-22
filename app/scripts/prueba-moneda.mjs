// Comprobaciones de la moneda de la cuenta: dólares o euros (2026-11-22).
//
//   node scripts/prueba-moneda.mjs
//
// Sin internet. En las dos apps (gemelo).

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MONEDAS_CUENTA, MONEDA_POR_DEFECTO, dinero, factorDesdeDolar, monedaDe } from '../src/lib/monedaCuenta.js'
import { calcularLote } from '../src/lib/calc.js'
import { fichaPractica, resumenPractica, monedaDePractica } from '../src/lib/practica.js'
import { COLUMNAS_PRACTICA, filasPractica } from '../src/lib/exportar.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (r) => readFileSync(join(RAIZ, r), 'utf8')
let mal = 0
function ok(cond, msg) {
  if (!cond) mal++
  console.log(`${cond ? '  ✓' : '  ✗ MAL'} ${msg}`)
}

console.log('\n1. Las monedas y el formato')
ok(MONEDAS_CUENTA.join() === 'USD,EUR' && MONEDA_POR_DEFECTO === 'USD', 'dólares y euros, y sin elegir es dólares')
ok(monedaDe({}) === 'USD' && monedaDe({ moneda: 'EUR' }) === 'EUR' && monedaDe({ moneda: 'XYZ' }) === 'USD' && monedaDe(null) === 'USD', 'un perfil viejo o raro cae en dólares sin reventar')
ok(dinero(12.5, 'USD') === '$12.50' && dinero(12.5, 'EUR') === '€12.50', 'cada importe lleva su símbolo')
ok(dinero(-3, 'EUR', { signo: true }) === '−€3.00' && dinero(3, 'USD', { signo: true }) === '+$3.00', 'con signo, el menos de verdad')
ok(dinero(null, 'USD') === '—' && dinero(NaN, 'EUR') === '—', 'sin número, una raya: nunca $0.00')

console.log('\n2. La conversión sale de las tasas del barrido')
const tasas = { EUR: 0.9, JPY: 150, GBP: 0.8 }
ok(factorDesdeDolar('USD', tasas) === 1 && factorDesdeDolar('EUR', tasas) === 0.9, 'un dólar son tasas.EUR euros')
ok(factorDesdeDolar('EUR', {}) === null && factorDesdeDolar('EUR', { EUR: 0 }) === null, 'sin la tasa del euro no se inventa ninguna')

console.log('\n3. El lote en euros')
const base = { capital: 1000, riesgoPct: 1, pips: 25, par: 'EUR/USD', tasas }
const usd = calcularLote({ ...base })
const eur = calcularLote({ ...base, moneda: 'EUR' })
ok(usd.ok && usd.moneda === 'USD' && Math.abs(usd.pip - 10) < 1e-9 && Math.abs(usd.lote - 0.04) < 1e-9, 'en dólares, como siempre: pip de 10 y 0,04 lotes')
ok(eur.ok && eur.moneda === 'EUR' && Math.abs(eur.pip - 9) < 1e-9, 'en euros el pip de EUR/USD vale 10 × 0,9 = 9 euros')
ok(Math.abs(eur.riesgoUsd - 10) < 1e-9, 'el riesgo sale en la moneda del capital: 1 % de 1.000 € son 10 €')
ok(Math.abs(eur.lote - 10 / (25 * 9)) < 1e-9, 'y el lote es 10 ÷ (25 × 9)')
ok(Math.abs(calcularLote({ ...base, par: 'USD/JPY' , moneda: 'EUR' }).pip - (1000 / 150) * 0.9) < 1e-9, 'también en los pares sin dólar al final')
ok(calcularLote({ ...base, moneda: 'EUR', tasas: { JPY: 150 } }).ok === false, 'sin la tasa del euro no hay lote: un lote con una tasa inventada sería falso')

console.log('\n4. La práctica guarda en qué moneda arriesgaba')
const analisis = (moneda) => ({ par: 'EUR/USD', lado: 'COMPRA', precio: 1.1, niveles: { sl: 1.098, tp: 1.104 }, lote: { lote: 0.04, riesgoUsd: 10, moneda } })
const opE = fichaPractica({ app: 'swing', analisis: analisis('EUR'), metodo: 'app', vela: '2026-11-20' })
const opU = fichaPractica({ app: 'swing', analisis: analisis('USD'), metodo: 'app', vela: '2026-11-20' })
ok(opE?.moneda === 'EUR' && opU?.moneda === 'USD', 'cada operación guarda su moneda')
ok(monedaDePractica({ riesgoUsd: 10 }) === 'USD', 'las de antes, sin moneda, eran dólares')
const resueltas = [
  { estado: 'ganada', r: 1, riesgoUsd: 10, moneda: 'EUR', entrada: 1.1, sl: 1.09, tp: 1.11, lado: 'COMPRA', par: 'EUR/USD' },
  { estado: 'perdida', r: -1, riesgoUsd: 10, entrada: 1.1, sl: 1.09, tp: 1.11, lado: 'COMPRA', par: 'EUR/USD' },
]
const rE = resumenPractica(resueltas, 'EUR')
const rU = resumenPractica(resueltas, 'USD')
ok(rE.conDinero === 1 && rU.conDinero === 1, 'el total suma solo las de la moneda que se usa ahora')
ok(rE.resueltas === 2 && rU.resueltas === 2, 'pero el acierto y las R cuentan todas, que no dependen de la moneda')

console.log('\n5. La tabla descargable dice la moneda')
const iM = COLUMNAS_PRACTICA.indexOf('moneda')
ok(iM === COLUMNAS_PRACTICA.indexOf('usdNeto') + 1, 'la columna «moneda» va justo después del dinero')
const filas = filasPractica([...resueltas, { estado: 'ganada', r: 1, entrada: 1.1, sl: 1.09, tp: 1.11, lado: 'COMPRA', par: 'EUR/USD' }])
ok(filas[0][iM] === 'EUR' && filas[1][iM] === 'USD' && filas[2][iM] === '', 'EUR, USD (las de antes) y vacía si no guardó dinero')

console.log('\n6. Los textos llevan la moneda en los 13 idiomas')
const dir = join(RAIZ, 'src/lib/i18n/textos')
for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  const { default: d } = await import(join(dir, f))
  const funcs = [d.diario.pl, d.diario.resultado, d.calc.capital, d.calc.riesgoUsd, d.perfil.capital]
  const conEuro = funcs.every((fn) => typeof fn === 'function' && fn({ moneda: 'EUR' }).includes('EUR') && !fn({ moneda: 'EUR' }).includes('USD'))
  const cerrar = typeof d.diario.promptCerrar === 'function' && d.diario.promptCerrar({ par: 'EUR/USD', moneda: 'EUR' }).includes('EUR')
  const sinDolarFijo = !d.calc.bajoMinimo({ minimo: '0.01', riesgo: '€5.00' }).includes('$')
  const nuevas = ['moneda', 'monedaUSD', 'monedaEUR', 'monedaNota', 'err_monedaRara'].every((k) => typeof d.perfil[k] === 'string' && d.perfil[k].length > 0)
  ok(conEuro && cerrar && sinDolarFijo && nuevas && typeof d.exp.moneda === 'string', `${f}: los rótulos de dinero dicen la moneda elegida`)
}

console.log('\n7. Ninguna pantalla escribe el signo de dólar a mano')
const comps = readdirSync(join(RAIZ, 'src/components')).filter((x) => x.endsWith('.jsx'))
// Tres formas de escribirlo a mano: `'$' + n`, `$${n}` dentro de un texto y
// `$` seguido de `{n}` suelto en el JSX (fuera de las comillas invertidas).
const dolarFijo = (codigo) => {
  const c = codigo.replace(/\/\/.*$/gm, '')
  // `'$' + n` y `$${n}` dentro de un texto.
  if (/['"]\$['"]\s*\+/.test(c) || /\$\$\{/.test(c)) return true
  // En el JSX, un `$` suelto delante de `{n}`: al principio de una línea, o
  // pegado al signo que va antes (`'−'}${n}`, `· ${n}` fuera de un texto).
  // Solo en líneas sin comillas invertidas: dentro de un texto `${…}${…}` es
  // normal y no lleva ningún `$` escrito.
  return c.split('\n').some((l) => !l.includes('`') && (/^\s*\$\{/.test(l) || /'[+−-]'\}\$\{/.test(l)))
}
const conDolar = comps.filter((f) => dolarFijo(leer(`src/components/${f}`)))
ok(conDolar.length === 0, `sin '$' fijo en el dinero: ${conDolar.join(', ') || 'ninguna'}`)
ok(['MiPerfil.jsx', 'CalculadoraTab.jsx', 'GuardianRiesgo.jsx', 'Practica.jsx', 'AnalizadorTab.jsx'].every((f) => /from '\.\.\/lib\/monedaCuenta'/.test(leer(`src/components/${f}`))), 'las cinco pantallas con dinero usan `monedaCuenta`')
ok(/limpio\.moneda/.test(leer('src/lib/perfilRiesgo.js')) && /moneda: m|moneda = monedaDe\(perfil\)/.test(leer('src/lib/analizador.js')), 'el perfil guarda la moneda y el Analizador la usa')

console.log(mal ? `\n✗ ${mal} comprobación(es) fallaron.` : '\n✓ Todo bien.')
process.exit(mal ? 1 : 0)
