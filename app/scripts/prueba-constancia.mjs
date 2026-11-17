// Comprobaciones de «Analista constante» (2026-11-17), sin internet.
//
//   node scripts/prueba-constancia.mjs
//
// GEMELO: la cuenta de días, la insignia y la regla de Firestore son iguales
// en las dos apps.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DIAS_GUARDADOS, conHoy, leerDias, mejorRacha } from '../src/lib/constancia.js'
import { calcularInsignias, META } from '../src/lib/insignias.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (r) => readFileSync(join(RAIZ, r), 'utf8')
let mal = 0
function ok(cond, msg) {
  if (!cond) mal++
  console.log(`${cond ? '  ✓' : '  ✗ MAL'} ${msg}`)
}

// 2026-11-16 es lunes.
const SEMANA = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']

console.log('\n1. La lista se limpia')
ok(leerDias(null).length === 0 && leerDias('x').length === 0, 'basura no revienta')
ok(leerDias(['2026-11-17', 'hola', 3, '2026-13-40', '2026-02-30', '2026-11-17']).join() === '2026-11-17', 'solo días que existen, sin repetir')
ok(leerDias(['2026-11-18', '2026-11-16']).join() === '2026-11-16,2026-11-18', 'en orden')
const muchos = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10))
ok(leerDias(muchos).length === DIAS_GUARDADOS && leerDias(muchos).at(-1) === '2026-01-30', `se quedan los últimos ${DIAS_GUARDADOS}`)

console.log('\n2. Apuntar hoy, una vez al día')
ok(conHoy([], '2026-11-17')?.join() === '2026-11-17', 'el primer día se apunta')
ok(conHoy(['2026-11-17'], '2026-11-17') === null, 'si hoy ya estaba, no se escribe nada')
ok(conHoy([], '2026-11-21') === null && conHoy([], '2026-11-22') === null, 'el sábado y el domingo no se apuntan')
ok(conHoy([], 'mañana') === null && conHoy([], null) === null, 'un día ilegible no se apunta')
ok(conHoy(muchos, '2026-11-17').length === DIAS_GUARDADOS, `nunca pasa de ${DIAS_GUARDADOS}, que es lo que deja la regla`)

console.log('\n3. La racha cuenta días HÁBILES seguidos')
ok(mejorRacha(SEMANA) === 5, 'lunes a viernes: 5')
ok(mejorRacha(['2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25']) === 5, 'jueves, viernes, lunes, martes, miércoles: 5 (el fin de semana no corta)')
ok(mejorRacha(['2026-11-16', '2026-11-17', '2026-11-19', '2026-11-20']) === 2, 'saltarse un día hábil corta la racha')
ok(mejorRacha(['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23']) === 2, 'mirar en fin de semana no suma')
ok(mejorRacha([]) === 0 && mejorRacha(null) === 0, 'sin días, cero')
ok(mejorRacha(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-30', '2026-12-01']) === 3, 'se queda con la racha más larga')

console.log('\n4. La insignia')
const ins = (dias) => calcularInsignias([], { diasTablero: dias }).find((i) => i.id === 'constante')
ok(META.constante === 5, 'la meta es 5 días')
ok(ins(SEMANA).conseguida === true && ins(SEMANA).n === 5, '5 días hábiles seguidos: conseguida')
ok(ins(SEMANA.slice(0, 4)).conseguida === false && ins(SEMANA.slice(0, 4)).n === 4, 'con 4 todavía no, y dice cuántos lleva')
ok(ins(undefined).n === 0, 'sin el campo, cero')

console.log('\n5. Enchufado y permitido')
const app = leer('src/App.jsx')
ok(/useConstancia\(authUser\?\.uid, perfil, perfilEstado === 'aprobado' && tab === 'tablero'\)/.test(app), 'se apunta al abrir el tablero completo, solo con la cuenta aprobada')
const hook = leer('src/lib/useConstancia.js')
ok(/conHoy\(/.test(hook) && /diasTablero: nueva/.test(hook), 'el hook escribe la lista que da conHoy, nunca otra cosa')
const reglas = leer('../firestore.rules')
ok(/'avisosInt', 'diasTablero'\]/.test(reglas), 'la regla deja escribir diasTablero en la propia ficha')
ok(new RegExp(`diasTablero\\.size\\(\\) <= ${DIAS_GUARDADOS}`).test(reglas), `y como mucho ${DIAS_GUARDADOS} días, el mismo número que la app`)
const es = leer('src/lib/i18n/textos/es.js')
ok(es.includes('constanteT:') && es.includes('constanteD:'), 'la insignia tiene sus dos textos')

console.log(mal ? `\n✗ ${mal} comprobaciones fallaron\n` : '\n✓ todo bien\n')
process.exit(mal ? 1 : 0)
