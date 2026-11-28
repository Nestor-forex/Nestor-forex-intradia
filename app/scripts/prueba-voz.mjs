// Cómo lee la voz de los videos lo que dice un rótulo (`paraVoz`, voz.mjs).
// Sin internet ni audios: solo el texto. Nació el 2026-11-28, cuando la voz
// decía «11 a 30» por «11:30 p. m.» y «Prueba 1 a 114» por «Prueba 1: 114».
import { paraVoz } from './videos/voz.mjs'

let mal = 0
const ok = (c, que) => { console.log(`${c ? '✓' : '✗ MAL'} ${que}`); if (!c) mal++ }
const v = (t) => paraVoz(t, 'natural')

ok(v('11:30 p. m.: JPY') === '11 y 30 p. m.: yen', 'una hora con minutos no se lee como relación')
ok(v('07:00 a. m.: GBP') === '7 a. m.: libra', 'una hora en punto: sin el cero ni los minutos')
ok(v('el 26 de noviembre de 2026, 21:00 UTC.') === 'el 26 de noviembre de 2026, 21 horas UTC.', 'una hora UTC dice «horas»')
ok(v('Prueba 1: 114 operaciones').startsWith('Prueba 1: 114'), '«Prueba 1: 114» no es una relación riesgo/beneficio')
ok(v('sale 1:6.32.') === 'sale 1 a 6,32.', 'la relación riesgo/beneficio se sigue leyendo «1 a 6,32»')
ok(v('R/B 1:1,5') === 'riesgo beneficio 1 a 1,5', 'y con coma decimal también')
ok(v('EUR/USD a 10 USD') === 'euro dólar a 10 dólares', 'los pares y los dólares, como antes')

if (mal) { console.log(`\n${mal} comprobación(es) fallaron`); process.exit(1) }
console.log('\n✓ la voz lee bien horas, relaciones y pares')
