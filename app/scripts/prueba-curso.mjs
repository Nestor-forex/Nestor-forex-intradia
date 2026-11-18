// Comprobaciones del curso (2026-11-18), sin internet.
//
//   node scripts/prueba-curso.mjs
//
// GEMELO: el curso, sus lecciones y su pantalla son iguales en las dos apps.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LECCIONES, MAX_HECHAS, MODULOS, PROXIMOS, TODAS, conHecha, leerHechas, modulosTerminados, progresoModulo, siguiente } from '../src/lib/curso.js'
import { OPS_PARA_CREER } from '../src/lib/sombra.js'
import { margen } from '../src/lib/diagnostico.js'
import { calcularLote } from '../src/lib/calc.js'
import { calcularInsignias } from '../src/lib/insignias.js'
import { crearT } from '../src/lib/i18n/crearT.js'
import { IDIOMAS } from '../src/lib/i18n/idiomas.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (r) => readFileSync(join(RAIZ, r), 'utf8')
let mal = 0
function ok(cond, msg) {
  if (!cond) mal++
  console.log(`${cond ? '  ✓' : '  ✗ MAL'} ${msg}`)
}

console.log('\n1. Cada lección tiene todas sus partes')
const TABS = ['barrido', 'analizar', 'diario', 'historial', 'avisos', 'calc']
ok(TODAS.length > 0 && TODAS.every((id) => LECCIONES[id]), 'todas las lecciones de los módulos existen')
ok(Object.keys(LECCIONES).every((id) => TODAS.includes(id)), 'ninguna lección suelta fuera de un módulo')
for (const id of TODAS) {
  const l = LECCIONES[id]
  const partes = typeof l.titulo === 'string' && l.titulo && l.objetivo && l.explicacion?.length && l.ejemplo?.length
  ok(partes, `${id}: título, objetivo, explicación y ejemplo`)
  // ⚠️ La parte que diferencia este curso: no puede faltar nunca.
  ok(Array.isArray(l.noDice) && l.noDice.length > 0, `${id}: lleva «Lo que esto NO te dice»`)
  ok(TABS.includes(l.hazlo?.tab) && l.hazlo.boton && l.hazlo.texto, `${id}: «Hazlo en la app» lleva a una pestaña que existe en las dos apps`)
  ok(l.preguntas?.length === 3, `${id}: tres preguntas`)
  for (const q of l.preguntas || []) {
    ok(Number.isInteger(q.correcta) && q.correcta >= 0 && q.correcta < q.opciones.length && q.porque, `${id}: «${q.p.slice(0, 40)}…» tiene respuesta y su porqué`)
  }
}

console.log('\n2. Ninguna lección dice qué operar, y ninguna nombra al bróker')
const todo = JSON.stringify(LECCIONES)
for (const prohibido of [/\bcompr[aá] (?:ahora|ya|este|el par)/i, /\bvend[eé] (?:ahora|ya|este|el par)/i, /va a subir/i, /va a bajar/i, /\bsubir[aá]\b/i, /\bbajar[aá]\b/i, /garantiz/i]) {
  ok(!prohibido.test(todo), `no dice ${prohibido}`)
}
// El nombre del bróker, en base64 para no escribirlo aquí (igual que las otras pruebas).
const broker = Buffer.from('YXZhdHJhZGU=', 'base64').toString()
ok(!todo.toLowerCase().includes(broker) && !todo.toLowerCase().includes('ava trade'), 'no nombra al bróker del desarrollador')

console.log('\n3. Los números salen del código, no a mano')
const m00 = JSON.stringify(LECCIONES['m0-1']) + JSON.stringify(LECCIONES['m0-2'])
ok(m00.includes(`${OPS_PARA_CREER} operaciones`), 'el listón de la sombra se lee de `sombra.js`')
ok(LECCIONES['m0-2'].ejemplo.some((p) => p.includes(`±${margen(25)}`)), 'el margen de 25 operaciones se calcula con `margen()`')
const es = leer('src/lib/curso/es.js')
ok(/import \{ OPS_PARA_CREER \} from '\.\.\/sombra\.js'/.test(es) && /import \{ margen \} from '\.\.\/diagnostico\.js'/.test(es), 'las lecciones importan el listón y el margen')
// El ejemplo del lote tiene que cuadrar con la calculadora de verdad.
const a = calcularLote({ capital: 1000, riesgoPct: 1, pips: 25, par: 'EUR/USD', tasas: {} })
const b = calcularLote({ capital: 1000, riesgoPct: 1, pips: 50, par: 'EUR/USD', tasas: {} })
const c = calcularLote({ capital: 2000, riesgoPct: 1, pips: 20, par: 'EUR/USD', tasas: {} })
ok(Math.abs(a.lote - 0.04) < 1e-9 && Math.abs(b.lote - 0.02) < 1e-9, 'el ejemplo del lote (0,04 y 0,02) es lo que da la calculadora')
ok(Math.abs(c.lote - 0.1) < 1e-9 && LECCIONES['m2-3'].preguntas[1].opciones[LECCIONES['m2-3'].preguntas[1].correcta] === '0,1', 'la pregunta del lote (0,1) también')

console.log('\n4. El progreso')
ok(leerHechas(null).length === 0 && leerHechas('x').length === 0, 'un valor raro no inventa lecciones terminadas')
ok(leerHechas(['m0-1', 'm0-1', 'inventada', 3]).join() === 'm0-1', 'sin repetidas ni lecciones que no existen')
ok(conHecha([], 'm0-1').join() === 'm0-1' && conHecha(['m0-1'], 'm0-1').length === 1, 'marcar dos veces no la repite')
ok(conHecha([], 'inventada').length === 0, 'una lección que no existe no se marca')
const m0 = MODULOS.find((m) => m.id === 'm0')
ok(progresoModulo(['m0-1'], m0).n === 1 && !progresoModulo(['m0-1'], m0).terminado, 'medio módulo no está terminado')
ok(progresoModulo(m0.lecciones, m0).terminado && modulosTerminados(m0.lecciones) === 1, 'todas sus lecciones lo terminan')
ok(siguiente(TODAS[0]) === TODAS[1] && siguiente(TODAS.at(-1)) === null, 'la siguiente lección, y la última no tiene')
ok(MODULOS.every((m) => !PROXIMOS.some((p) => p.n === m.n)), 'un módulo hecho no sale también como «próximamente»')

console.log('\n5. La insignia premia terminar, no acertar')
const sin = calcularInsignias([], { curso: [] }).find((i) => i.id === 'curso')
const con = calcularInsignias([], { curso: m0.lecciones }).find((i) => i.id === 'curso')
ok(sin && !sin.conseguida && con && con.conseguida, 'terminar un módulo da la insignia')
ok(!/correcta|acert|nota/.test(leer('src/lib/useCurso.js')), 'lo que se guarda no lleva respuestas ni nota')

console.log('\n6. El tope de la lista es el mismo en la app y en las reglas')
const reglas = leer('../firestore.rules')
const m = reglas.match(/request\.resource\.data\.curso\.size\(\) <= (\d+)/)
ok(m && Number(m[1]) === MAX_HECHAS, `firestore.rules deja ${m?.[1]} y la app guarda hasta ${MAX_HECHAS}`)
ok(/'curso'\]\)/.test(reglas), '`curso` está en la lista blanca de la ficha')

console.log('\n7. La pantalla y el botón')
const pantalla = leer('src/components/Curso.jsx')
ok(pantalla.indexOf("t('curso.aviso')") > 0 && pantalla.indexOf("t('curso.aviso')") < pantalla.indexOf('<Leccion'), 'el aviso va antes de la lección')
ok(pantalla.includes("t('curso.noDice')") && pantalla.includes("t('curso.soloEspanol')"), '«Lo que esto NO te dice» y el aviso de idioma están en la pantalla')
ok(!/var\(--green\)|var\(--red\)/.test(pantalla), 'las respuestas no van en verde ni en rojo (en esta app son dinero)')
ok(/onAprender=/.test(leer('src/App.jsx')) && /onAprender/.test(leer('src/components/Header.jsx')), 'el botón del curso está en la cabecera')
ok(/tab === 'curso' && <Curso/.test(leer('src/App.jsx')), 'y abre la pantalla del curso')

console.log('\n8. Los textos en los 13 idiomas')
const claves = ['aprender', 'titulo', 'desc', 'aviso', 'soloEspanol', 'llevas', 'proximamente', 'volver', 'objetivo', 'explicacion', 'ejemplo', 'formula', 'noDice', 'hazlo', 'preguntas', 'correcto', 'incorrecto', 'marcar', 'terminada', 'guardando', 'siguiente', 'sinPermiso', 'error']
for (const { codigo } of IDIOMAS) {
  const t = crearT(codigo)
  const faltan = claves.filter((k) => !t(`curso.${k}`))
  ok(!faltan.length && t('curso.modulo', { n: 3 }).includes('3') && t('insig.cursoT') && t('insig.cursoD', { meta: 1 }).includes('1'), `${codigo}: todos los textos${faltan.length ? ' (faltan: ' + faltan.join(', ') + ')' : ''}`)
}

console.log(mal ? `\n✗ ${mal} comprobación(es) fallaron.` : '\n✓ Todo bien.')
process.exit(mal ? 1 : 0)
