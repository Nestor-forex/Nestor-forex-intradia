// Prueba de las MEDIAS LARGAS (2026-11-14). Sin internet ni créditos:
//
//     node scripts/prueba-medias-largas.mjs
//
// Versión de Intradía (PRIMO de la de Swing): aquí las velas son de una hora,
// las tasas son por divisa contra el dólar y la serie no se limpia de horas
// cerradas. Lo que comprueba es lo mismo: pedir más velas NO cambia el barrido.
//
// Lo que no puede pasar nunca, en este orden de gravedad:
//   1. que al pedir más velas cambie el barrido (ATR, stop, señales): el
//      historial dejaría de describir una sola cosa a mitad de camino;
//   2. que la media larga salga de una serie que termina OTRO día;
//   3. que el vigía o el publicador dejen de pedirla en la misma consulta.

import { readFileSync } from 'node:fs'
import { CCY, PAIRS, cierresLargos, computarBarrido, precioDePar } from "../src/lib/marketCalc.js"
import { VELAS_MEDIAS, recortarUltimas } from './lib/velas.mjs'
import { VECES_EMA } from '../src/lib/medias.js'

let fallos = 0
const comprobar = (bien, que) => {
  console.log(`  ${bien ? '✓' : '✗'} ${que}`)
  if (!bien) fallos++
}

// Un mercado inventado de `n` velas de una hora, determinista: cada divisa con
// una onda propia y un paseo pequeño. `rates[t][ccy]` es el cierre de USD/ccy,
// que es como lo arma `velas.mjs` de esta app.
function mercado(n) {
  const barras = []
  const t0 = Date.UTC(2026, 0, 5)
  for (let i = 0; i < n; i++) barras.push(new Date(t0 + i * 3600_000).toISOString().slice(0, 19).replace('T', ' '))
  const base = { EUR: 0.92, GBP: 0.79, JPY: 150, CHF: 0.88, AUD: 1.52, NZD: 1.64, CAD: 1.36 }
  let semilla = 7
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647 - 0.5)
  const nivel = Object.fromEntries(Object.keys(base).map((c) => [c, 0]))
  const rates = {}
  const rangos = {}
  barras.forEach((t, i) => {
    const fila = {}
    const fr = {}
    for (const [k, c] of Object.keys(base).entries()) {
      nivel[c] += azar() * 0.002
      fila[c] = base[c] * (1 + 0.01 * Math.sin(i / (9 + k * 3) + k) + nivel[c])
      fr[c] = { h: fila[c] * 1.001, l: fila[c] * 0.999 }
    }
    rates[t] = fila
    rangos[t] = fr
  })
  return { barras, rates, rangos }
}

console.log('\n1. Pedir más días NO cambia los últimos 300')
{
  const m = new Map([
    ['2026-01-03', { c: 3 }],
    ['2026-01-01', { c: 1 }],
    ['2026-01-04', { c: 4 }],
    ['2026-01-02', { c: 2 }],
  ])
  const r = recortarUltimas({ 'EUR/USD': m }, 2)
  comprobar(JSON.stringify([...r['EUR/USD'].keys()]) === '["2026-01-03","2026-01-04"]', 'se queda con los N más recientes aunque lleguen desordenados')
  comprobar(r['EUR/USD'].get('2026-01-04').c === 4, 'y con sus valores intactos')
  comprobar(VELAS_MEDIAS >= 200 * VECES_EMA, `${VELAS_MEDIAS} velas ≥ ${200 * VECES_EMA}, las que pide la EMA 200`)
}

console.log('\n2. El barrido sale IDÉNTICO con y sin la serie larga')
{
  const largo = mercado(700)
  const ult = largo.barras.slice(-300)
  const corto = {
    barras: ult,
    rates: Object.fromEntries(ult.map((t) => [t, largo.rates[t]])),
    rangos: Object.fromEntries(ult.map((t) => [t, largo.rangos[t]])),
  }
  const sin = computarBarrido(corto.barras, corto.rates, corto.rangos)
  const con = computarBarrido(corto.barras, corto.rates, corto.rangos, {
    largo: { barras: largo.barras, rates: largo.rates },
  })
  const quitarMedias = (x) => JSON.stringify({ ...x, pares: x.pares.map(({ medias, ...resto }) => resto) })
  comprobar(quitarMedias(sin) === quitarMedias(con), 'todo lo que no son las medias es idéntico (ATR, RSI, EMA de la app, fuerza, extremos…)')
  const ema200 = (b) => b.pares[0].medias.ema.find((e) => e.p === 200)?.v
  comprobar(ema200(sin) === null, 'sin la serie larga la EMA 200 sale vacía (como hasta hoy)')
  comprobar(typeof ema200(con) === 'number', 'con la serie larga la EMA 200 sale con número')
  const sma20 = (b) => b.pares[0].medias.sma.find((e) => e.p === 20)?.v
  comprobar(Math.abs(sma20(sin) - sma20(con)) < 1e-12, 'la SMA 20 da lo mismo por los dos caminos (son los mismos 20 cierres)')
}

console.log('\n3. Una serie larga que termina OTRO día no se usa')
{
  const m = mercado(700)
  const antes = m.barras.slice(0, -1)
  comprobar(cierresLargos({ barras: antes, rates: m.rates }, 'EUR', 'USD', m.barras.at(-1)) === null, 'si acaba una vela antes → null, y se usan los cierres de siempre')
  const s = cierresLargos({ barras: m.barras, rates: m.rates }, 'EUR', 'USD', m.barras.at(-1))
  comprobar(Array.isArray(s) && Math.abs(s.at(-1) - precioDePar(m.rates[m.barras.at(-1)].EUR, 1)) < 1e-12, 'si acaba en la misma vela → la serie larga, con la fórmula del par de la app')
  comprobar(cierresLargos(null, 'EUR', 'USD', m.barras.at(-1)) === null, 'sin serie larga → null')
  const roto = { ...m.rates, [m.barras[5]]: { ...m.rates[m.barras[5]], EUR: NaN } }
  comprobar(cierresLargos({ barras: m.barras, rates: roto }, 'EUR', 'USD', m.barras.at(-1)) === null, 'con un dato roto dentro → null, nunca una media inventada')
  comprobar(CCY.includes('USD'), '(el dólar vale 1 y no viene en las tasas)')
}

console.log('\n4. El vigía y el publicador la piden, en la MISMA consulta')
{
  for (const g of ['vigia.mjs', 'publicar-barrido.mjs']) {
    const s = readFileSync(new URL(`./${g}`, import.meta.url), 'utf8')
    comprobar(/obtenerVelas\(leerLlave\(\), \{ velasLargas: VELAS_MEDIAS \}\)/.test(s), `${g} pide la serie larga`)
    comprobar(/computarBarrido\(barras, rates, rangos, \{ largo \}\)/.test(s), `${g} se la pasa al barrido`)
  }
  const v = readFileSync(new URL('./lib/velas.mjs', import.meta.url), 'utf8')
  comprobar(/recortarUltimas\(porSimbolo, velas\)/.test(v), 'velas.mjs arma el barrido de siempre con las últimas `velas` velas')
}

console.log(fallos ? `\n✗ ${fallos} comprobaciones fallaron\n` : '\n✓ todo bien\n')
process.exit(fallos ? 1 : 0)
