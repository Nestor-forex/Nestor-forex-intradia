// Comprobaciones de la página web del curso (curso.html, 2026-11-18), sin internet.
//
//   node scripts/prueba-curso-web.mjs
//
// En las dos apps (gemelo): cada una tiene su página web del curso, con las
// mismas lecciones y el mismo progreso, y cada una con SUS videos.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crearT } from '../src/lib/i18n/crearT.js'
import { IDIOMAS } from '../src/lib/i18n/idiomas.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (r) => readFileSync(join(RAIZ, r), 'utf8')
let mal = 0
function ok(cond, msg) {
  if (!cond) mal++
  console.log(`${cond ? '  ✓' : '  ✗ MAL'} ${msg}`)
}

console.log('\n1. La segunda puerta de entrada existe y se compila')
ok(existsSync(join(RAIZ, 'curso.html')) && /src="\/src\/web\/main-curso\.jsx"/.test(leer('curso.html')), 'curso.html carga main-curso.jsx')
const vite = leer('vite.config.js')
ok(/main: fileURLToPath\(new URL\('\.\/index\.html'/.test(vite) && /curso: fileURLToPath\(new URL\('\.\/curso\.html'/.test(vite), 'vite.config.js compila las dos páginas (sin la app no habría app)')

console.log('\n2. Sin suscripción activa solo se ve la vista previa')
const web = leer('src/web/CursoWeb.jsx')
const iAprobado = web.indexOf("perfilEstado === 'aprobado'")
const iCurso = web.indexOf('<Curso ')
ok(iAprobado > 0 && iCurso > iAprobado && /else if \(aprobado\) \{[\s\S]*?<Curso /.test(web), 'las lecciones solo se pintan con la ficha aprobada')
// Sin suscripción solo se pintan las lecciones de GRATIS, y en modo muestra
// (sin guardar avance: no se le pasa onTerminar).
const leccionesSueltas = [...web.matchAll(/<Leccion\b[\s\S]*?\/>/g)].map((m) => m[0])
ok(leccionesSueltas.length === 1 && /muestra=\{/.test(leccionesSueltas[0]) && !/onTerminar/.test(leccionesSueltas[0]), 'la vista previa solo pinta lecciones en modo muestra, sin guardar avance')
ok(/GRATIS\.includes\(id\)/.test(web), 'y solo las de la lista GRATIS')
const { GRATIS, MODULOS, MODULOS_GRATIS } = await import('../src/lib/curso.js')
const esperadas = MODULOS.flatMap((m) => (MODULOS_GRATIS.includes(m.id) ? m.lecciones : [m.lecciones[0]]))
ok(JSON.stringify(GRATIS) === JSON.stringify(esperadas) && MODULOS_GRATIS.join() === 'm0,m2', `gratis: los módulos 0 y 2 enteros y la primera lección de los demás (${GRATIS.length} de ${MODULOS.flatMap((m) => m.lecciones).length})`)
const curso = leer('src/components/Curso.jsx')
ok(/muestra \? \(\s*<p[^>]*>\{t\('cursoWeb\.muestraFin'\)\}/.test(curso), 'una lección en modo muestra no ofrece «Marcar como terminada»')
const vistas = [...web.matchAll(/'(vista-\d\.png)'/g)].map((m) => m[1])
ok(vistas.length >= 2 && vistas.every((f) => existsSync(join(RAIZ, 'public/curso', f))), `las imágenes de la vista previa existen (${vistas.join(', ')})`)
ok(/t\('curso\.aviso'\)/.test(web), 'la vista previa lleva el aviso de que no es asesoría')

console.log('\n3. Los textos en los 13 idiomas')
const claves = ['eyebrow', 'titulo', 'intro', 'queAprendes', 'vistaPrevia', 'bloqueado', 'entrar', 'pendiente', 'inactiva', 'abrirApp', 'enApp', 'lecciones', 'gratisTitulo', 'gratisDesc', 'gratisModulo', 'unaGratis', 'muestraFin', 'volverGratis']
for (const { codigo } of IDIOMAS) {
  const t = crearT(codigo)
  const faltan = claves.filter((k) => !t(`cursoWeb.${k}`))
  ok(!faltan.length, `${codigo}: todos los textos${faltan.length ? ' (faltan: ' + faltan.join(', ') + ')' : ''}`)
}

console.log(mal ? `\n✗ ${mal} comprobación(es) fallaron.` : '\n✓ Todo bien.')
process.exit(mal ? 1 : 0)
