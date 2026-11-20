// Comprobaciones del curso (2026-11-18), sin internet.
//
//   node scripts/prueba-curso.mjs
//
// GEMELO: el curso, sus lecciones y su pantalla son iguales en las dos apps.

import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LECCIONES, MAX_HECHAS, MODULOS, PROXIMOS, TODAS, conHecha, leerHechas, modulosTerminados, progresoModulo, siguiente } from '../src/lib/curso.js'
import { OPS_PARA_CREER } from '../src/lib/sombra.js'
import { margen } from '../src/lib/diagnostico.js'
import { calcularLote } from '../src/lib/calc.js'
import { calcularInsignias } from '../src/lib/insignias.js'
import { SUGERIDO, frenoEnDolares, operacionesHastaElFreno } from '../src/lib/perfilRiesgo.js'
import { pipUSD } from '../src/lib/calc.js'
import { crearT } from '../src/lib/i18n/crearT.js'
import { IDIOMAS } from '../src/lib/i18n/idiomas.js'
import { HERRAMIENTAS, herramientasDe } from '../src/lib/curso/herramientas.js'
import { APP } from '../src/lib/identidad.js'

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

// El módulo 3 lee los frenos que propone la app y los calcula con las MISMAS
// funciones que «Tu freno de hoy».
const pe = { capital: 1000, riesgoPct: 1, ...SUGERIDO }
const m32 = LECCIONES['m3-2'].ejemplo.join(' ')
ok(m32.includes(`${frenoEnDolares(pe)} USD`) && m32.includes(`número ${operacionesHastaElFreno(pe)}`), 'el freno del ejemplo sale de `perfilRiesgo.js`')
ok(/import \{ SUGERIDO, frenoEnDolares, operacionesHastaElFreno \} from '\.\.\/perfilRiesgo\.js'/.test(es), 'el módulo 3 importa los frenos, no los escribe')
// El valor del pip del módulo 1 es el de la calculadora.
ok(pipUSD('EUR/USD', {}) === 10 && LECCIONES['m1-2'].ejemplo.some((p) => p.includes('10 USD con un lote entero')), 'el pip de EUR/USD (10 USD por lote) es el de la calculadora')
{
  // Módulo 4: las ventanas, los pesos y el umbral salen de `marketCalc.js` de ESTA app.
  const { VENTANAS_FUERZA, PESOS_FUERZA, UMBRAL_FUERZA } = await import('../src/lib/marketCalc.js')
  const m41 = JSON.stringify(LECCIONES['m4-1'])
  ok(VENTANAS_FUERZA.every((k) => m41.includes(`${k} `)) && PESOS_FUERZA.every((w) => m41.includes(`${Math.round(w * 100)} %`)), 'el módulo 4 lee las ventanas y los pesos de la fuerza de `marketCalc.js`')
  ok(JSON.stringify(LECCIONES['m4-2']).includes(String(UMBRAL_FUERZA).replace('.', ',')), 'y el umbral de fuerza')
  ok(/import \{[^}]*\bPESOS_FUERZA\b[^}]*\bUMBRAL_FUERZA\b[^}]*\bVENTANAS_FUERZA\b[^}]*\} from '\.\.\/marketCalc\.js'/.test(es), 'el módulo 4 los importa, no los escribe')
}
{
  // Módulo 5: las medias, el RSI, el ATR, el Stop-loss y la compresión salen de
  // `marketCalc.js` de ESTA app (velas diarias en swing, de una hora en intradía).
  const MC = await import('../src/lib/marketCalc.js')
  const { APP } = await import('../src/lib/identidad.js')
  const coma = (n) => String(n).replace('.', ',')
  const [c, l] = MC.PERIODOS_MEDIAS.ema
  const m51 = JSON.stringify(LECCIONES['m5-1'])
  ok(m51.includes(`EMA ${c} > EMA ${l}`), `el módulo 5 dice las medias de la tendencia de esta app (EMA ${c} y EMA ${l})`)
  const mc = readFileSync(new URL('../src/lib/marketCalc.js', import.meta.url), 'utf8')
  ok(new RegExp(`const tend = c > e${c} && e${c} > e${l}`).test(mc), 'y son las que la app usa de verdad para decir «Alcista» o «Bajista»')
  ok(m51.includes(MC.TENDENCIA_MIN === 'media' ? 'basta con que el precio' : 'las dos medias tienen que estar en orden'), 'y lo que exige la app para un experimento sale de `TENDENCIA_MIN`')
  const m52 = JSON.stringify(LECCIONES['m5-2'])
  ok(m52.includes(`últimas ${MC.PERIODO_RSI} velas`) && m52.includes(`últimas ${MC.PERIODO_ATR}`), 'el RSI y el ATR dicen cuántas velas miran')
  ok(MC.RSI_MAX == null ? m52.includes('NO decide') : m52.includes(`RSI en ${MC.RSI_MAX} o más`), 'y si el RSI decide algo en esta app sale de `RSI_MAX`')
  const stop = APP === 'swing' ? MC.COJIN_ATR_STOP : MC.ATR_STOP
  ok(Number.isFinite(stop) && m52.includes(`${coma(stop)} × ATR`), `la distancia del Stop-loss (${stop} ATR) se lee de la geometría de la app`)
  const m53 = JSON.stringify(LECCIONES['m5-3'])
  const cortes = MC.UMBRALES_COMPRESION
  ok([cortes.muy, cortes.algo, cortes.ancho].every((x) => m53.includes(coma(x))) && m53.includes(`hace ${MC.VELAS_ATRAS_COMPRESION} velas`), 'la compresión dice los cortes y las velas de esta app')
  ok(APP === 'swing' ? m53.includes('no tiene un modo de rango') : m53.includes(coma(MC.COMPRESION_MIN)) && m53.includes(`${MC.RANGO_MIN_ATR} ATR`), 'y lo del modo rango sale del código de esta app')
}
{
  // Módulo 6: los spreads salen de la MISMA tabla con la que el banco de pruebas
  // descuenta el coste, y la banda del swap de `tasas.js`.
  const { spreadDe } = await import('./lib/costes.mjs')
  const { UMBRAL_NEUTRO } = await import('../src/lib/tasas.js')
  const { aciertoParaEmpatar } = await import('../src/lib/curso/es.js')
  const coma = (n) => String(n).replace('.', ',')
  const m61 = JSON.stringify(LECCIONES['m6-1'])
  ok(m61.includes(`EUR/USD cuesta ${coma(spreadDe('EUR/USD'))} pips`) && m61.includes(`NZD/CHF ${coma(spreadDe('NZD/CHF'))}`), 'el módulo 6 dice el spread de la tabla de costes de esta app')
  const es = readFileSync(new URL('../src/lib/curso/es.js', import.meta.url), 'utf8')
  ok(/import \{ spreadDe \} from '\.\.\/\.\.\/\.\.\/scripts\/lib\/costes\.mjs'/.test(es) && !/SPREAD_PIPS/.test(es), 'y la lección importa `spreadDe` en vez de copiar la tabla')
  ok(JSON.stringify(LECCIONES['m6-2']).includes(`menor de ${coma(UMBRAL_NEUTRO)} puntos`), 'la banda en la que el swap «apenas pesa» sale de `UMBRAL_NEUTRO`')
  ok(Math.abs(aciertoParaEmpatar(0, 30) - 0.5) < 1e-12 && Math.abs(aciertoParaEmpatar(2, 30) - 32 / 60) < 1e-12, 'el acierto para empatar: 50 % sin coste, (1 + coste) ÷ 2 con coste')
  ok(aciertoParaEmpatar(2, 30) > aciertoParaEmpatar(2, 120), 'y con el mismo spread, un Stop-loss corto pide acertar más')
  const m63 = JSON.stringify(LECCIONES['m6-3'])
  ok(m63.includes('53,3 %') && m63.includes('50,8 %'), 'el ejemplo del módulo 6 lleva los números que salen de la cuenta')
}
{
  // Módulo 7: las horas del calendario salen de `calendario.js`, y las fuentes
  // de noticias que nombra la lección son las que de verdad se publican (la
  // lista vive solo en la app de swing, que es la que publica las noticias).
  const { HORAS_VISTA } = await import('../src/lib/calendario.js')
  ok(JSON.stringify(LECCIONES['m7-1']).includes(`próximas ${HORAS_VISTA} horas`), 'el módulo 7 dice cuántas horas enseña el calendario (`HORAS_VISTA`)')
  const es = readFileSync(new URL('../src/lib/curso/es.js', import.meta.url), 'utf8')
  ok(/import \{ HORAS_VISTA \} from '\.\.\/calendario\.js'/.test(es), 'y lo importa en vez de escribirlo')
  const m73 = JSON.stringify(LECCIONES['m7-3'])
  const rutaNoticias = new URL('./lib/noticias.mjs', import.meta.url)
  if (existsSync(rutaNoticias)) {
    const { FUENTES_PUBLICABLES } = await import(rutaNoticias.href)
    const nombres = { fed: 'Reserva Federal', bce: 'Banco Central Europeo', rbnz: 'Banco de la Reserva de Nueva Zelanda', ing: 'ING' }
    ok(FUENTES_PUBLICABLES.length === 4 && m73.includes('Las fuentes son cuatro'), 'la lección dice cuántas fuentes de noticias se publican')
    ok(FUENTES_PUBLICABLES.every((f) => nombres[f.id] && m73.includes(nombres[f.id])), 'y nombra cada una de las que publica `noticias.mjs`')
    const ing = FUENTES_PUBLICABLES.find((f) => f.id === 'ing')
    ok(ing?.soloSiNombraDivisa === true && m73.includes('De ING solo salen las notas que nombran'), 'lo del filtro de ING sale de `soloSiNombraDivisa`')
  } else {
    ok(m73.includes('Las fuentes son cuatro'), 'la lección de noticias está (la lista de fuentes se comprueba en la app de swing)')
  }
  ok(!/se les pidió permiso/.test(m73), 'no afirma que se pidió un permiso que no consta enviado')
}

// Los videos: cada uno tiene su descripción, y CADA app guarda los suyos
// (2026-11-20): el archivo tiene que existir en este repositorio y pesar poco.
const DIR_VIDEOS = join(RAIZ, 'public/curso/videos')
for (const id of TODAS) {
  const v = LECCIONES[id].video
  if (!v) continue
  ok(typeof v.archivo === 'string' && !/\./.test(v.archivo) && v.desc, `${id}: el video tiene nombre (sin extensión) y descripción`)
  for (const ext of ['webm', 'mp4']) {
    const ruta = join(DIR_VIDEOS, `${v.archivo}.${ext}`)
    ok(existsSync(ruta) && statSync(ruta).size < 3 * 1024 * 1024, `${id}: ${v.archivo}.${ext} existe en ESTA app y pesa menos de 3 MB`)
  }
}
{
  const cj = leer('src/lib/curso.js')
  ok(/swing: 'https:\/\/nestor-forex\.github\.io\/Nestor-forex\/'/.test(cj) && /intradia: 'https:\/\/nestor-forex\.github\.io\/Nestor-forex-intradia\/'/.test(cj), 'cada app tiene la dirección de su propia página')
  ok(/URL_VIDEOS = `\$\{PAGINAS\[APP\]\}curso\/videos\/`/.test(cj), 'los videos se piden a la página de ESTA app, no a la de la otra')
}

console.log('\n3b. Las herramientas en video: cada app las suyas (2026-11-20)')
{
  const APPS = ['swing', 'intradia']
  ok(HERRAMIENTAS.length > 0 && new Set(HERRAMIENTAS.map((h) => h.id)).size === HERRAMIENTAS.length, 'hay herramientas y ningún id repetido')
  for (const h of HERRAMIENTAS) {
    ok(h.apps.length > 0 && h.apps.every((a) => APPS.includes(a)), `${h.id}: dice en qué apps existe`)
    ok(h.titulo && h.que && h.noDice?.length > 0 && h.video?.archivo && h.video?.desc && TABS.includes(h.hazlo?.tab) && h.hazlo?.boton, `${h.id}: tiene título, qué es, video, «lo que NO te dice» y dónde probarla`)
  }
  for (const id of ['h-cot']) {
    const h = HERRAMIENTAS.find((x) => x.id === id)
    ok(!h || !h.apps.includes('intradia'), `${id} no sale en intradía, que no tiene esa herramienta`)
  }
  const deEsta = herramientasDe(APP)
  ok(deEsta.every((h) => h.apps.includes(APP)), 'esta app solo enseña las herramientas que tiene')
  for (const h of deEsta) {
    for (const ext of ['webm', 'mp4']) {
      const ruta = join(DIR_VIDEOS, `${h.video.archivo}.${ext}`)
      ok(existsSync(ruta) && statSync(ruta).size < 3 * 1024 * 1024, `${h.id}: ${h.video.archivo}.${ext} grabado en ESTA app y pesa menos de 3 MB`)
    }
  }
  // Cada herramienta tiene su escena de grabación, y al revés.
  const escenas = existsSync(join(RAIZ, 'scripts/videos/escenas-herramientas.mjs')) ? leer('scripts/videos/escenas-herramientas.mjs') : ''
  const idsEscenas = [...escenas.matchAll(/^ {2}'(h-[a-z0-9-]+)': \{/gm)].map((m) => m[1])
  ok(idsEscenas.length > 0, 'se leen las escenas de los videos de herramientas')
  ok(HERRAMIENTAS.every((h) => idsEscenas.includes(h.id)) && idsEscenas.every((id) => HERRAMIENTAS.some((h) => h.id === id)), 'cada herramienta tiene su escena y cada escena su herramienta')
  const todoH = JSON.stringify(HERRAMIENTAS) + escenas
  for (const prohibido of [/\bcompr[aá] (?:ahora|ya|este|el par)/i, /\bvend[eé] (?:ahora|ya|este|el par)/i, /va a subir/i, /va a bajar/i, /\bsubir[aá]\b/i, /\bbajar[aá]\b/i, /garantiz/i]) {
    ok(!prohibido.test(todoH), `las herramientas no dicen ${prohibido}`)
  }
  ok(!todoH.toLowerCase().includes(broker) && !todoH.toLowerCase().includes('ava trade'), 'las herramientas no nombran al bróker del desarrollador')
  ok(/FIN\)/.test(escenas) && (escenas.match(/await r\(FIN\)/g) || []).length === idsEscenas.length, 'todas las escenas terminan con el aviso de que no es una señal')
}

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
ok(/hasOnly\(\[[^\]]*'curso'[^\]]*\]\)/.test(reglas), '`curso` está en la lista blanca de la ficha')

console.log('\n7. La pantalla y el botón')
const pantalla = leer('src/components/Curso.jsx')
ok(pantalla.indexOf("t('curso.aviso')") > 0 && pantalla.indexOf("t('curso.aviso')") < pantalla.indexOf('<Leccion'), 'el aviso va antes de la lección')
ok(pantalla.includes("t('curso.noDice')") && pantalla.includes("t('curso.soloEspanol')"), '«Lo que esto NO te dice» y el aviso de idioma están en la pantalla')
ok(!/var\(--green\)|var\(--red\)/.test(pantalla), 'las respuestas no van en verde ni en rojo (en esta app son dinero)')
ok(/onAprender=/.test(leer('src/App.jsx')) && /onAprender/.test(leer('src/components/Header.jsx')), 'el botón del curso está en la cabecera')
ok(/tab === 'curso' && <Curso/.test(leer('src/App.jsx')), 'y abre la pantalla del curso')

console.log('\n8. Los textos en los 13 idiomas')
const claves = ['video', 'empezar', 'aprender', 'titulo', 'desc', 'aviso', 'soloEspanol', 'llevas', 'proximamente', 'volver', 'objetivo', 'explicacion', 'ejemplo', 'formula', 'noDice', 'hazlo', 'preguntas', 'correcto', 'incorrecto', 'marcar', 'terminada', 'guardando', 'siguiente', 'sinPermiso', 'error']
for (const { codigo } of IDIOMAS) {
  const t = crearT(codigo)
  const faltan = claves.filter((k) => !t(`curso.${k}`))
  ok(!faltan.length && t('curso.modulo', { n: 3 }).includes('3') && t('insig.cursoT') && t('insig.cursoD', { meta: 1 }).includes('1'), `${codigo}: todos los textos${faltan.length ? ' (faltan: ' + faltan.join(', ') + ')' : ''}`)
}

console.log(mal ? `\n✗ ${mal} comprobación(es) fallaron.` : '\n✓ Todo bien.')
process.exit(mal ? 1 : 0)
