// Comprueba el botón «¿Qué significa?» (2026-11-13). Sin internet.
//
// Lo que vigila, en orden de lo que más cuesta si se rompe:
//
//   1. ⚠️ QUE LA EXPLICACIÓN DE UNA NOTICIA NO DIGA NUNCA COMPRA O VENTA. Lo
//      pidió Néstor con esas palabras: debe decir si el dato sale alto o bajo,
//      y nada más. Una frase como «un dato alto suele fortalecer la divisa» es
//      una señal sin medir.
//   2. ⚠️ QUE EL AVISO «ESTO NO ES UNA SEÑAL» SIGA DENTRO DE CADA EXPLICACIÓN.
//   3. Que la comparación previsto/anterior no se invente nada: «<0.1%» no es
//      un número y dos unidades distintas no se comparan.
//   4. Que cada familia que el calendario reconoce tenga su explicación.
//
// Es GEMELO: en Intradía no existe `Cot.jsx`, y la comprobación lo tiene en
// cuenta en vez de fallar.

import { existsSync, readFileSync } from 'node:fs'
import {
  CLAVES_TERMINOS,
  FAMILIAS,
  compararPrevisto,
  explicacionEvento,
  leerValor,
  terminosDe,
} from '../src/lib/explicacion.js'
import * as explicacion from '../src/lib/explicacion.js'
import es from '../src/lib/i18n/textos/es.js'
import en from '../src/lib/i18n/textos/en.js'

let fallos = 0
const ok = (bien, que) => {
  console.log(`  ${bien ? '✓' : '✗'} ${que}`)
  if (!bien) fallos++
}
const leer = (r) => readFileSync(new URL(r, import.meta.url), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

console.log('\n1 · Leer los valores del calendario')
ok(leerValor('0.3%')?.n === 0.3 && leerValor('0.3%')?.unidad === '%', '«0.3%» → 0,3 %')
ok(leerValor('-0.2%')?.n === -0.2, '«-0.2%» → −0,2')
ok(leerValor('24.5K')?.n === 24.5 && leerValor('24.5K')?.unidad === 'K', '«24.5K» → 24,5 K')
ok(leerValor('53.1')?.n === 53.1 && leerValor('53.1')?.unidad === '', '«53.1» → 53,1 sin unidad')
ok(leerValor('<0.1%') === null, '«<0.1%» es una cota, no un número → null')
ok(leerValor('') === null && leerValor(null) === null && leerValor('   ') === null, 'vacío → null, nunca 0')
ok(leerValor('abc') === null, 'texto → null')

console.log('\n2 · Previsto contra anterior: alto, bajo o igual, y nada inventado')
ok(compararPrevisto({ f: '0.3%', p: '0.7%' }) === 'menor', 'el ejemplo de Néstor: 0,3 % contra 0,7 % → más bajo')
ok(compararPrevisto({ f: '1.2%', p: '0.7%' }) === 'mayor', '1,2 % contra 0,7 % → más alto')
ok(compararPrevisto({ f: '0.3%', p: '0.3%' }) === 'igual', 'iguales → igual')
ok(compararPrevisto({ f: '-0.1%', p: '0.2%' }) === 'menor', 'con signo negativo')
ok(compararPrevisto({ f: '0.3%', p: '24K' }) === null, 'unidades distintas NO se comparan')
ok(compararPrevisto({ f: '<0.1%', p: '0.2%' }) === null, 'una cota no se compara')
ok(compararPrevisto({ f: '0.3%' }) === null && compararPrevisto({ p: '0.3%' }) === null, 'sin uno de los dos → null')

console.log('\n3 · Qué se explica de cada noticia')
const ppi = explicacionEvento({ t: 'Core PPI m/m', c: 'USD', d: '2026-11-13T08:30:00-05:00', i: 'alto', f: '0.3%', p: '0.7%' })
ok(ppi?.familia === 'inflacion', 'Core PPI m/m → familia inflación')
ok(JSON.stringify(ppi?.terminos) === JSON.stringify(['core', 'ppi', 'mm']), `términos en orden de lectura → ${JSON.stringify(ppi?.terminos)}`)
ok(ppi?.comparacion === 'menor' && ppi?.previsto === '0.3%' && ppi?.anterior === '0.7%', 'lleva los dos números y la comparación')
ok(JSON.stringify(JSON.parse(JSON.stringify(ppi))) === JSON.stringify(ppi), 'son datos, no texto: pasa por JSON intacto (lo leerá Qwen en la fase 5)')
ok(explicacionEvento({ t: 'Something Nobody Knows', c: 'USD', d: 'x' })?.familia === 'general', 'lo que no reconoce → «general», nunca una familia inventada')
ok(explicacionEvento(null) === null, 'sin evento → null')
ok(terminosDe('GDP q/q') .join() === 'gdp,qq' && terminosDe('Flash Manufacturing PMI').join() === 'pmi,flash', 'detecta GDP, q/q, PMI y Flash')

console.log('\n4 · Cada familia del calendario tiene su explicación')
const familiasCal = [...leer('../src/lib/calendario.js').matchAll(/^\s*\['(\w+)',\s*\//gm)].map((m) => m[1])
ok(familiasCal.length >= 8, `se leyeron las familias de calendario.js (${familiasCal.length}) — si fueran 0 lo de abajo no comprobaría nada`)
const sinExplicar = familiasCal.filter((f) => !FAMILIAS.includes(f))
ok(sinExplicar.length === 0, `todas están en FAMILIAS${sinExplicar.length ? ' → faltan ' + sinExplicar : ''}`)
ok(FAMILIAS.includes('general'), 'y existe «general» para lo que no reconoce')
const textoFam = FAMILIAS.filter((f) => typeof es.explica?.familia?.[f] !== 'string' || !es.explica.familia[f])
ok(textoFam.length === 0, `cada familia tiene texto en es.js${textoFam.length ? ' → faltan ' + textoFam : ''}`)
const textoTer = CLAVES_TERMINOS.filter((k) => typeof es.explica?.termino?.[k] !== 'string')
ok(textoTer.length === 0, `cada término tiene texto en es.js${textoTer.length ? ' → faltan ' + textoTer : ''}`)

console.log('\n5 · ⚠️ La explicación de una noticia NO dice compra ni venta')
{
  const noticia = (d) => [
    ...Object.values(d.explica.familia),
    ...Object.values(d.explica.termino),
    ...Object.values(d.explica.impacto),
    ...Object.values(d.explica.comparacion).map((f) => f({ f: '1', p: '2' })),
    d.explica.ambos({ f: '1', p: '2' }),
    d.explica.soloPrevisto({ f: '1' }),
    d.explica.soloAnterior({ p: '2' }),
    d.explica.sorpresa,
  ]
  // «gerentes de compras» es el nombre del cargo que contesta el PMI, no un
  // lado: se quita antes de buscar, y es la única excepción.
  const malES = noticia(es).filter((s) => /\bcompr|\bvend|alcista|bajista|fortalec|debilit/i.test(s.replace(/gerentes de compras/g, '')))
  ok(malES.length === 0, `español${malES.length ? ' → ' + malES[0].slice(0, 70) : ''}`)
  const malEN = noticia(en).filter((s) => /\bbuy|\bsell|bullish|bearish|strengthen|weaken/i.test(s))
  ok(malEN.length === 0, `inglés${malEN.length ? ' → ' + malEN[0].slice(0, 70) : ''}`)
  // Y el código tampoco relaciona un dato con un lado.
  const codigo = sinComentarios(leer('../src/lib/explicacion.js'))
  ok(!/COMPRA|VENTA|['"]compra['"]|['"]venta['"]/.test(codigo), 'explicacion.js no nombra ningún lado')
  const exportados = Object.keys(explicacion).filter((k) => /senal|compra|venta|direcc|lado/i.test(k))
  ok(exportados.length === 0, `y no exporta nada que suene a señal${exportados.length ? ' → ' + exportados : ''}`)
}

console.log('\n6 · ⚠️ El aviso «no es señal» va en cada explicación')
{
  ok(/no es una señal/i.test(es.explica?.noEsSenal ?? '') && /tuya/.test(es.explica.noEsSenal), 'es.js dice que no es señal y que la decisión es suya')
  const explica = sinComentarios(leer('../src/components/Explica.jsx'))
  ok(/t\('explica\.noEsSenal'\)/.test(explica), 'Explica.jsx pinta el aviso')
  // Que esté DENTRO del bloque que se abre, no como algo opcional.
  ok(!/noEsSenal[^)]*\)\s*\}?\s*\)?\s*:\s*null/.test(explica) && /\{abierto && \(/.test(explica), 'y va siempre que la explicación está abierta')
}

console.log('\n7 · Cableado: las tarjetas usan el botón')
{
  const cal = sinComentarios(leer('../src/components/Calendario.jsx'))
  ok(/import Explica from '\.\/Explica'/.test(cal) && /<ExplicaEvento ev=\{ev\}/.test(cal), 'el calendario pone «¿Qué significa?» en cada noticia')
  ok(/explicacionEvento\(ev\)/.test(cal), 'y la arma con explicacionEvento (no con una copia)')
  const tas = sinComentarios(leer('../src/components/Tasas.jsx'))
  ok(/<ExplicaPar /.test(tas) && (tas.match(/<Explica[\s>]/g) || []).length >= 2, 'las tasas lo ponen en cada par y en cada tasa')
  const rutaCot = new URL('../src/components/Cot.jsx', import.meta.url)
  if (existsSync(rutaCot)) {
    const cot = sinComentarios(readFileSync(rutaCot, 'utf8'))
    ok(/import Explica from '\.\/Explica'/.test(cot) && /<Explica[\s>]/.test(cot), 'el COT lo pone en cada fila')
    ok(typeof es.explica?.cot?.noDice === 'string', 'y el COT tiene sus textos')
  } else {
    console.log('  · esta app no tiene COT')
  }
}

console.log(fallos ? `\n✗ ${fallos} comprobación(es) fallaron` : '\n✓ todo bien')
process.exit(fallos ? 1 : 0)
