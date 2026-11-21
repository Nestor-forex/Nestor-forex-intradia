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
ok(!/<Leccion|LECCIONES\[/.test(web), 'la vista previa no pinta ninguna lección por su cuenta')
const vistas = [...web.matchAll(/'(vista-\d\.png)'/g)].map((m) => m[1])
ok(vistas.length >= 2 && vistas.every((f) => existsSync(join(RAIZ, 'public/curso', f))), `las imágenes de la vista previa existen (${vistas.join(', ')})`)
ok(/t\('curso\.aviso'\)/.test(web), 'la vista previa lleva el aviso de que no es asesoría')

console.log('\n3. Los textos en los 13 idiomas')
const claves = ['eyebrow', 'titulo', 'intro', 'queAprendes', 'vistaPrevia', 'bloqueado', 'entrar', 'pendiente', 'inactiva', 'abrirApp', 'enApp', 'lecciones']
for (const { codigo } of IDIOMAS) {
  const t = crearT(codigo)
  const faltan = claves.filter((k) => !t(`cursoWeb.${k}`))
  ok(!faltan.length, `${codigo}: todos los textos${faltan.length ? ' (faltan: ' + faltan.join(', ') + ')' : ''}`)
}

console.log(mal ? `\n✗ ${mal} comprobación(es) fallaron.` : '\n✓ Todo bien.')
process.exit(mal ? 1 : 0)
