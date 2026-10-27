// Prueba de la compresión, la posición en el rango y Fibonacci. Sin internet.
//
// Correr con: node scripts/prueba-compresion.mjs
//
// ⚠️ ES GEMELA, así que todo lo que hay aquí está escrito como INVARIANTE y no
// como una afirmación sobre una app concreta: ningún umbral, ninguna palabra
// «día» ni «hora». Lo que tiene que ser igual en las dos apps es la fórmula y
// las asimetrías; los umbrales de cada tarjeta los comprueba cada app aparte.

import {
  RATIOS_FIB,
  compresionDe,
  fibonacci,
  mediana,
  nivelDe,
  posicionEnRango,
  velasEstrechas,
} from '../src/lib/compresion.js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

let fallos = 0
const comprobar = (que, cond) => {
  console.log(`${cond ? '  OK  ' : '  MAL '} ${que}`)
  if (!cond) fallos++
}
const aprox = (a, b, eps = 1e-9) => Number.isFinite(a) && Math.abs(a - b) < eps

console.log('\n1. La mediana')
comprobar('impar → el del medio', mediana([3, 1, 2]) === 2)
comprobar('par → el promedio de los dos del medio', mediana([1, 2, 3, 4]) === 2.5)
comprobar('uno solo → él', mediana([7]) === 7)
comprobar('lista vacía → null', mediana([]) === null)
comprobar('no es lista → null', mediana('hola') === null)
comprobar('con basura dentro, la ignora', mediana([1, NaN, 2, null, 3]) === 2)
comprobar('solo basura → null', mediana([NaN, null, undefined]) === null)

console.log('\n2. La compresión: el movimiento de ahora contra el de antes')
comprobar('la mitad de movimiento → 0,5', compresionDe(1, 2) === 0.5)
comprobar('el mismo movimiento → 1', compresionDe(2, 2) === 1)
comprobar('el doble → 2', compresionDe(4, 2) === 2)
comprobar('quieto del todo → 0 (es un dato, no un hueco)', compresionDe(0, 2) === 0)

console.log('\n2b. ⚠️ Lo que no se puede calcular devuelve null, NUNCA 1 NI 0')
// La asimetría de siempre: un 1 afirmaría «el movimiento no ha cambiado» y un
// 0 «está parado». Las dos son afirmaciones sobre el mercado, y no saberlo no
// es ninguna de las dos. Misma decisión que `pearson` y `edadEnMinutos`.
comprobar('divisor cero → null, y NO 1', compresionDe(1, 0) === null)
comprobar('divisor negativo → null', compresionDe(1, -2) === null)
comprobar('divisor NaN → null', compresionDe(1, NaN) === null)
comprobar('divisor undefined → null', compresionDe(1, undefined) === null)
comprobar('numerador NaN → null', compresionDe(NaN, 2) === null)
comprobar('numerador negativo → null', compresionDe(-1, 2) === null)
comprobar('los dos ausentes → null', compresionDe(undefined, undefined) === null)
comprobar('texto → null', compresionDe('1', '2') === null)

console.log('\n3. La etiqueta: devuelve una CLAVE, no un texto')
// Es clave y no frase porque el mismo cálculo lo lee el reporte desde Node,
// donde no hay idioma. Misma decisión que `claveSesionActiva()`.
const U = { muy: 0.7, algo: 0.85, ancho: 1.2 }
comprobar('0,5 → muy', nivelDe(0.5, U) === 'muy')
comprobar('0,8 → algo', nivelDe(0.8, U) === 'algo')
comprobar('1,0 → normal', nivelDe(1.0, U) === 'normal')
comprobar('1,5 → ancho', nivelDe(1.5, U) === 'ancho')
comprobar('justo en el borde de «muy» (0,7) → algo, no muy', nivelDe(0.7, U) === 'algo')
comprobar('justo en el borde de «algo» (0,85) → normal', nivelDe(0.85, U) === 'normal')
comprobar('justo en el borde de «ancho» (1,2) → normal, no ancho', nivelDe(1.2, U) === 'normal')
comprobar('sin compresión → null', nivelDe(null, U) === null)
comprobar('con un umbral que falta → null, no una clave inventada', nivelDe(0.5, { muy: 0.7 }) === null)
comprobar('sin umbrales → null', nivelDe(0.5, {}) === null)

console.log('\n3b. ⚠️ NINGÚN UMBRAL vive dentro del archivo (es lo que lo hace GEMELO)')
const aqui = dirname(fileURLToPath(import.meta.url))
const fuente = readFileSync(join(aqui, '..', 'src', 'lib', 'compresion.js'), 'utf8')
// Se mira el CÓDIGO, no los comentarios: ahí los números son documentación y
// explicarlos es justo lo que hace falta.
const codigo = fuente
  .split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
  .join('\n')
comprobar(
  'ningún valor por defecto de umbral en la firma de `nivelDe`',
  !/muy\s*=\s*[\d.]/.test(codigo) && !/algo\s*=\s*[\d.]/.test(codigo) && !/ancho\s*=\s*[\d.]/.test(codigo),
)
comprobar('ningún `fraccion =` con número', !/fraccion\s*=\s*[\d.]/.test(codigo))
comprobar('ningún `minATR =` con número', !/minATR\s*=\s*[\d.]/.test(codigo))
comprobar('ni la palabra «día» ni «hora» en el código', !/\b(d[ií]a|hora)s?\b/i.test(codigo))
// Los ratios de Fibonacci SÍ van dentro, y es lo correcto: son la convención
// que usa todo el mundo, no un parámetro de esta app. Si se movieran, la
// pantalla dejaría de coincidir con cualquier otra plataforma.
comprobar('los ratios de Fibonacci son los cinco de siempre', RATIOS_FIB.join(',') === '0.236,0.382,0.5,0.618,0.786')

console.log('\n4. La posición dentro del rango')
comprobar('justo en el medio → 0,5', posicionEnRango(5, 0, 10) === 0.5)
comprobar('pegado al suelo → 0', posicionEnRango(0, 0, 10) === 0)
comprobar('pegado al techo → 1', posicionEnRango(10, 0, 10) === 1)
comprobar('por encima del techo → más de 1 (se salió, y eso es un dato)', posicionEnRango(12, 0, 10) === 1.2)
comprobar('por debajo del suelo → negativo', posicionEnRango(-2, 0, 10) === -0.2)

console.log('\n4b. ⚠️ Sin amplitud devuelve null, NUNCA 0,5')
// Un 0,5 diría «está justo en el medio», que es una afirmación. Pasa de verdad
// en un par que no se movió en toda la ventana.
comprobar('techo igual que suelo → null, y NO 0,5', posicionEnRango(5, 5, 5) === null)
comprobar('techo por debajo del suelo → null', posicionEnRango(5, 10, 0) === null)
comprobar('precio ausente → null', posicionEnRango(null, 0, 10) === null)
comprobar('suelo NaN → null', posicionEnRango(5, NaN, 10) === null)

console.log('\n5. Velas estrechas seguidas, contando desde la última')
// Rango mediano 10. Las dos últimas están por debajo de la mitad.
const A1 = [10, 10, 10, 10, 10, 10, 10, 10, 2, 3]
const B1 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
comprobar('dos al final por debajo de la mitad → 2', velasEstrechas(A1, B1, 0.5) === 2)
comprobar('con el umbral en 0,1 ninguna cuenta → 0', velasEstrechas(A1, B1, 0.1) === 0)
const A2 = [10, 10, 10, 10, 10, 10, 2, 3, 10, 10]
comprobar('las estrechas están en medio, no al final → 0', velasEstrechas(A2, B1, 0.5) === 0)
comprobar('la racha se corta en la primera ancha', velasEstrechas([10, 10, 10, 2, 10, 2, 2], [0, 0, 0, 0, 0, 0, 0], 0.5) === 2)

console.log('\n5c. ⚠️ Quien llame tiene que quitar la vela EN CURSO antes')
// Salió mirando la captura: contando la última vela, los CATORCE pares
// decían «lleva 1 vela estrecha». No era el mercado — la última vela del
// barrido es la del día en curso, que va a medias y por eso sale corta casi
// siempre. La función cuenta lo que se le da; el aviso es para quien la usa.
const ULT_CORTA = [10, 10, 10, 10, 10, 10, 10, 10, 10, 2]
comprobar('con la vela a medias dentro, cuenta 1', velasEstrechas(ULT_CORTA, B1, 0.5) === 1)
comprobar('quitándola, cuenta 0 — que es la verdad', velasEstrechas(ULT_CORTA.slice(0, -1), B1.slice(0, -1), 0.5) === 0)

console.log('\n5b. ⚠️ Y devuelve null, no 0, cuando no se puede medir')
// Un 0 diría «ninguna vela está estrecha», que es distinto de «no lo sé».
comprobar('listas de distinto largo → null', velasEstrechas([1, 2, 3], [1, 2], 0.5) === null)
comprobar('una sola vela → null', velasEstrechas([1], [0], 0.5) === null)
comprobar('con un NaN dentro → null', velasEstrechas([10, NaN, 10], [0, 0, 0], 0.5) === null)
comprobar('un mínimo por encima del máximo (rango negativo) → null', velasEstrechas([10, 5], [0, 9], 0.5) === null)
comprobar('rango mediano cero → null, no 0', velasEstrechas([5, 5, 5], [5, 5, 5], 0.5) === null)
comprobar('fracción cero → null', velasEstrechas(A1, B1, 0) === null)
comprobar('fracción ausente → null', velasEstrechas(A1, B1, undefined) === null)
comprobar('no son listas → null', velasEstrechas('a', 'b', 0.5) === null)

console.log('\n6. Fibonacci: el último movimiento, SIN opinar sobre la dirección')
// Movimiento al alza: el mínimo está al principio y el máximo al final.
const SUBE = fibonacci({
  altos: [100, 101, 102, 103, 110],
  bajos: [100, 100, 101, 102, 108],
  atrAbs: 1,
  minATR: 2,
})
comprobar('reconoce que el movimiento acaba en el máximo', SUBE?.subiendo === true)
comprobar('el movimiento va del mínimo al máximo', SUBE?.desde === 100 && SUBE?.hasta === 110)
comprobar('amplitud 10', aprox(SUBE?.amplitud, 10))
comprobar('cinco niveles', SUBE?.niveles.length === 5)
comprobar('el 50 % está en 105 (baja desde el máximo)', aprox(SUBE.niveles.find((n) => n.ratio === 0.5).precio, 105))
comprobar('el 23,6 % está en 107,64', aprox(SUBE.niveles.find((n) => n.ratio === 0.236).precio, 107.64))
comprobar('el 78,6 % está en 102,14', aprox(SUBE.niveles.find((n) => n.ratio === 0.786).precio, 102.14))
comprobar('los niveles van de arriba abajo al subir', SUBE.niveles.every((n, i, a) => i === 0 || n.precio < a[i - 1].precio))

// Movimiento a la baja: el máximo está al principio y el mínimo al final.
const BAJA = fibonacci({
  altos: [110, 109, 108, 107, 102],
  bajos: [108, 107, 106, 105, 100],
  atrAbs: 1,
  minATR: 2,
})
comprobar('reconoce que el movimiento acaba en el mínimo', BAJA?.subiendo === false)
comprobar('el movimiento va del máximo al mínimo', BAJA?.desde === 110 && BAJA?.hasta === 100)
comprobar('el 50 % está en 105 (sube desde el mínimo)', aprox(BAJA.niveles.find((n) => n.ratio === 0.5).precio, 105))
comprobar('los niveles van de abajo arriba al bajar', BAJA.niveles.every((n, i, a) => i === 0 || n.precio > a[i - 1].precio))

console.log('\n6b. ⚠️ Un movimiento demasiado pequeño NO da niveles')
// Con pocas velas, dos extremos casi pegados dan cinco niveles separados por
// décimas de pip. Eso no son niveles: es ruido con cinco etiquetas encima.
comprobar(
  'amplitud menor que minATR × ATR → null',
  fibonacci({ altos: [100, 100.5], bajos: [100, 100], atrAbs: 1, minATR: 2 }) === null,
)
comprobar(
  'amplitud justo igual al mínimo → SÍ da niveles (el borde exacto)',
  fibonacci({ altos: [100, 102], bajos: [100, 100], atrAbs: 1, minATR: 2 }) !== null,
)

console.log('\n6c. ⚠️ Y el resto de los casos degenerados')
comprobar('listas de distinto largo → null', fibonacci({ altos: [1, 2], bajos: [1], atrAbs: 1, minATR: 2 }) === null)
comprobar('una sola vela → null', fibonacci({ altos: [1], bajos: [1], atrAbs: 1, minATR: 2 }) === null)
comprobar('ATR cero → null', fibonacci({ altos: [100, 110], bajos: [100, 100], atrAbs: 0, minATR: 2 }) === null)
comprobar('ATR ausente → null', fibonacci({ altos: [100, 110], bajos: [100, 100], atrAbs: null, minATR: 2 }) === null)
comprobar('minATR ausente → null', fibonacci({ altos: [100, 110], bajos: [100, 100], atrAbs: 1 }) === null)
comprobar(
  'con un NaN dentro → null',
  fibonacci({ altos: [100, NaN, 110], bajos: [100, 100, 100], atrAbs: 1, minATR: 2 }) === null,
)
comprobar('sin listas → null', fibonacci({ atrAbs: 1, minATR: 2 }) === null)
// Una sola vela que trae a la vez el máximo y el mínimo de toda la ventana: no
// hay un «último» movimiento que distinguir, así que no se inventa uno.
comprobar(
  'el máximo y el mínimo en la MISMA vela → null, no un movimiento inventado',
  fibonacci({ altos: [100, 120], bajos: [99, 90], atrAbs: 1, minATR: 2 }) === null,
)

console.log('\n7. ⚠️ NINGÚN VEREDICTO. Ni lado, ni dirección, ni puntuación')
// Igual que en `cot.js` y en `estacionalidad.js`: añadir un veredicto obliga a
// venir a borrar esta comprobación a mano, o sea a propósito y no de pasada.
// La diferencia con el resto del proyecto es que aquí la tentación es enorme —
// «triángulo ascendente» lleva la dirección dentro del nombre.
const PROHIBIDAS = /\b(COMPRA|VENTA|comprar|vender|sugiere|recomend|mejor par|ranking|puntuaci[oó]n|alcista|bajista|triangul|tri[áa]ngul|cu[ñn]a)/i
comprobar('la fuente no trae ninguna palabra de veredicto ni de patrón con nombre', !PROHIBIDAS.test(codigo))
comprobar('`fibonacci` no devuelve lado', !('lado' in (SUBE || {})) && !('compra' in (SUBE || {})))
comprobar('ni objetivo', !('tp' in (SUBE || {})) && !('objetivo' in (SUBE || {})))
comprobar('`subiendo` describe el movimiento PASADO, no una predicción', typeof SUBE.subiendo === 'boolean')
comprobar(
  'no se exporta nada que suene a veredicto',
  !/export (function|const) (clasificar|decidir|sugerir|recomendar|lado)/.test(codigo),
)

console.log('\n8. Una ventana real de producción (EUR/USD, 2026-10-27)')
// Los 20 máximos y mínimos tal como viajan en `barrido.json`. Sirve para que
// el cálculo se pruebe contra números de verdad y no solo contra casos
// redondos: un cambio que solo funcione con enteros se vería aquí.
const ALTOS = [
  1.13797, 1.1337, 1.13017, 1.12951, 1.12694, 1.12398, 1.12271, 1.12248, 1.12139, 1.12099,
  1.12086, 1.12048, 1.11985, 1.11955, 1.11937, 1.11895, 1.11874, 1.11853, 1.11842, 1.11811,
]
const BAJOS = [
  1.13227, 1.12159, 1.12423, 1.12351, 1.12004, 1.11891, 1.11834, 1.11777, 1.1171, 1.11652,
  1.11598, 1.1154, 1.11483, 1.1144, 1.11402, 1.11368, 1.11331, 1.11301, 1.1127, 1.1114,
]
comprobar('20 máximos y 20 mínimos', ALTOS.length === 20 && BAJOS.length === 20)
const fibReal = fibonacci({ altos: ALTOS, bajos: BAJOS, atrAbs: 0.005885658575119222, minATR: 2 })
comprobar('da niveles', fibReal !== null)
comprobar('el movimiento va a la BAJA (el mínimo está al final)', fibReal.subiendo === false)
comprobar('arranca en el máximo de la ventana', aprox(fibReal.desde, 1.13797))
comprobar('acaba en el mínimo de la ventana', aprox(fibReal.hasta, 1.1114))
comprobar('los cinco niveles caen DENTRO del movimiento', fibReal.niveles.every((n) => n.precio > 1.1114 && n.precio < 1.13797))
const posReal = posicionEnRango(1.11752, 1.1114, 1.13797)
comprobar('la posición cae entre 0 y 1', posReal > 0 && posReal < 1)
comprobar('y está en la parte baja del rango (el precio viene cayendo)', posReal < 0.5)
const estrechasReal = velasEstrechas(ALTOS, BAJOS, 0.5)
comprobar('las velas estrechas seguidas son un número, no null', Number.isFinite(estrechasReal))

console.log(fallos === 0 ? '\n✓ todo bien.\n' : `\n✗ ${fallos} comprobación(es) fallaron.\n`)
process.exit(fallos === 0 ? 0 : 1)
