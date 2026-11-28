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
ok(/import \{ OPS_PARA_CREER \} from '\.\.\/sombra\.js'/.test(es) && /import \{[^}]*\bmargen\b[^}]*\} from '\.\.\/diagnostico\.js'/.test(es), 'las lecciones importan el listón y el margen')
// El ejemplo del lote tiene que cuadrar con la calculadora de verdad.
const a = calcularLote({ capital: 1000, riesgoPct: 1, pips: 25, par: 'EUR/USD', tasas: {} })
const b = calcularLote({ capital: 1000, riesgoPct: 1, pips: 50, par: 'EUR/USD', tasas: {} })
const c = calcularLote({ capital: 2000, riesgoPct: 1, pips: 20, par: 'EUR/USD', tasas: {} })
ok(Math.abs(a.lote - 0.04) < 1e-9 && Math.abs(b.lote - 0.02) < 1e-9, 'el ejemplo del lote (0,04 y 0,02) es lo que da la calculadora')
ok(Math.abs(c.lote - 0.1) < 1e-9 && LECCIONES['m2-3'].preguntas[1].opciones[LECCIONES['m2-3'].preguntas[1].correcta] === '0,1', 'la pregunta del lote (0,1) también')
// «Acertaste más y perdiste»: tiene que ser verdad con el número que se enseña.
{
  const { ACIERTOS_LOTE: k } = await import('../src/lib/curso/es.js')
  const neto = k * 10 - (10 - k) * 30
  const texto = LECCIONES['m2-3'].ejemplo.at(-1)
  ok(k > 10 - k && neto < 0 && texto.includes(`perdiste ${-neto} USD`), `el ejemplo del lote mal calculado: ${k} aciertos de 10 y aun así −${-neto} USD`)
  ok(LECCIONES['m2-3'].explicacion[0].startsWith('Un lote mal calculado te puede vaciar la cuenta aunque aciertes más de lo que fallas.'), 'la lección abre con la frase acordada')
}

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
  // m4-4: los pares del ejemplo existen en las dos apps, el que se pone como
  // «no está» de verdad no está, y la medición de la vara neutra se LEE.
  {
    const m44 = JSON.stringify(LECCIONES['m4-4'])
    const { PAIR_NAMES } = await import('../src/lib/pairs.js')
    const { POR_R_NEUTRA, POR_R_NEUTRA_NUM } = await import('../src/lib/curso/es.js')
    ok(['GBP/JPY', 'USD/CHF'].every((x) => PAIR_NAMES.includes(x)), 'm4-4: GBP/JPY y USD/CHF están en esta app')
    ok(!PAIR_NAMES.includes('EUR/JPY') && m44.includes('EUR/JPY no está en esta app'), 'm4-4: EUR/JPY de verdad no está')
    ok(Number.isFinite(POR_R_NEUTRA_NUM) && m44.includes(POR_R_NEUTRA), `m4-4: dice la medición de la vara neutra de medicion.js (${POR_R_NEUTRA})`)
  }
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
  // Los correos de permiso los envió Néstor (2026-11-20) y nadie ha respondido:
  // la lección puede decir que se pidió, pero no que se concedió.
  ok(!/(concedi|dieron|aceptaron) (el )?permiso/.test(m73), 'no afirma que alguna página de noticias haya dado permiso')
}
{
  // Módulo 8: la correlación solo existe en la app de swing. Donde existe
  // `correlacion.js`, los dos números de la lección tienen que ser los suyos.
  const m82 = JSON.stringify(LECCIONES['m8-2'])
  const coma = (n) => String(n).replace('.', ',')
  const rutaCorrel = new URL('../src/lib/correlacion.js', import.meta.url)
  if (existsSync(rutaCorrel)) {
    const { CORREL_ALTA, VENTANA_CORREL } = await import(rutaCorrel.href)
    ok(m82.includes(`últimas ${VENTANA_CORREL} sesiones`) && m82.includes(`A partir de ${coma(CORREL_ALTA)}`), 'el módulo 8 usa la ventana y el umbral de `correlacion.js`')
  } else {
    ok(m82.includes('no calcula la correlación'), 'en esta app la lección dice que la correlación está en la app de swing')
  }
  ok(/'juntas'/.test(readFileSync(new URL('./videos/dobles.js', import.meta.url), 'utf8')), 'el banco de grabación tiene las operaciones de ejemplo que comparten divisa')
}
{
  // Módulo 9: los números del Analizador salen del código. El método simétrico
  // usa `ATR_REVERSION` en swing y `ATR_STOP` en intradía.
  const MC = await import('../src/lib/marketCalc.js')
  const AN = await import('../src/lib/analizador.js')
  const { HERRAMIENTAS_DE_ESTILO } = await import('../src/lib/estilo.js')
  const ES = await import('../src/lib/curso/es.js')
  const coma = (n) => String(n).replace('.', ',')
  const atr = MC.ATR_REVERSION ?? MC.ATR_STOP
  const m91 = JSON.stringify(LECCIONES['m9-1'])
  const m92 = JSON.stringify(LECCIONES['m9-2'])
  const m93 = JSON.stringify(LECCIONES['m9-3'])
  ok(typeof atr === 'number' && ES.ATR_SIMETRICO === atr, 'el ATR del método simétrico es el que usa esta app')
  ok(m91.includes(`«${coma(atr)} ATR a cada lado»`) && m91.includes(`${coma(AN.COJIN_ESTRUCTURA)} ATR por fuera`), 'el módulo 9 lee los dos métodos de ATR del código')
  ok(/COJIN_ESTRUCTURA \* atr/.test(leer('src/lib/analizador.js')), '`nivelesEstructura` usa `COJIN_ESTRUCTURA` (no un 0,5 escrito aparte)')
  const tEs = (await import('../src/lib/i18n/textos/es.js')).default
  ok(tEs.an.metodo.simetrica === `${coma(atr)} ATR a cada lado`, 'el botón del método dice el mismo ATR que la lección')
  ok(m92.includes(`${coma(AN.RR_AVISO)}:${coma(AN.RR_AVISO)}`), 'el aviso del R/B sale de `RR_AVISO`')
  ok(m93.includes(`hasta ${AN.MAX_PLANTILLAS}`) && m93.includes(`empieza con ${HERRAMIENTAS_DE_ESTILO.tendencias.length}`) && m93.includes(`con ${HERRAMIENTAS_DE_ESTILO.rangos.length}`), 'las plantillas y los estilos salen de `analizador.js` y `estilo.js`')
  for (const h of ['calendario', 'diario']) ok(m92.includes(`«${tEs.an.h[h]}»`), `la lección nombra la herramienta «${tEs.an.h[h]}» como sale en la pantalla`)
  ok(m91.includes(tEs.an.motivo.sinLado.replace(/\.$/, '')), 'la lección cita lo que dice la tarjeta sin dirección')
  const dob = readFileSync(new URL('./videos/dobles.js', import.meta.url), 'utf8')
  ok(/'chequeo'/.test(dob) && /export function usePlantillas/.test(dob) && /export function useEstilo/.test(dob), 'el banco de grabación tiene el diario de chequeo y guarda plantillas y estilo en memoria')
}
{
  // Módulo 10: el modo práctica. Los números salen de `practica.js` y el
  // ejemplo de dinero se calcula con `costesPractica`, la cuenta de la tarjeta.
  const PR = await import('../src/lib/practica.js')
  const { META } = await import('../src/lib/insignias.js')
  const { margen } = await import('../src/lib/diagnostico.js')
  const ES = await import('../src/lib/curso/es.js')
  const tEs = (await import('../src/lib/i18n/textos/es.js')).default
  const coma2 = (x) => Math.abs(x).toFixed(2).replace('.', ',')
  const m101 = JSON.stringify(LECCIONES['m10-1'])
  const m102 = JSON.stringify(LECCIONES['m10-2'])
  const m103 = JSON.stringify(LECCIONES['m10-3'])
  ok(m101.includes(`hasta ${PR.MAX_ABIERTAS} abiertas`), 'el módulo 10 dice el tope de abiertas de `practica.js`')
  ok(m101.includes(`«${tEs.an.practicar}»`), 'la lección nombra el botón como sale en el Analizador')
  ok(ES.INSIGNIA_PRACTICA_TXT === META.practica, 'las operaciones de la insignia son las de `insignias.js`')
  ok(m103.includes(`±${margen(META.practica)} puntos`), 'el ± del módulo 10 sale de `margen()`')
  const c = PR.costesPractica(ES.EJEMPLO_PRACTICA)
  ok(c && c.noches === 2 && !c.sinSpread && !c.sinSwap, 'el ejemplo de la práctica tiene spread, swap y dos noches en esta app')
  ok([c.rBruto, c.spreadR, c.swapR, c.rNeto, c.usdNeto].every((x) => m102.includes(coma2(x))), 'el ejemplo de dinero sale de `costesPractica`')
  ok(m102.includes(`${c.noches} noches`), 'el ejemplo dice las noches que cuenta `nochesDeSwap`')
  const dob = readFileSync(new URL('./videos/dobles.js', import.meta.url), 'utf8')
  ok(/'ejemplo' \? practicaEjemplo\(\)/.test(dob), 'el banco de grabación tiene operaciones de práctica de ejemplo')
}
{
  // Módulo 11: el acierto de equilibrio sale de `aciertoDeEquilibrio` (el del
  // laboratorio), el margen de `margen()` y el listón de `OPS_PARA_CREER`.
  const { aciertoDeEquilibrio } = await import('../src/lib/laboratorio.js')
  const { margen } = await import('../src/lib/diagnostico.js')
  const { OPS_PARA_CREER } = await import('../src/lib/sombra.js')
  const tEs = (await import('../src/lib/i18n/textos/es.js')).default
  const m111 = JSON.stringify(LECCIONES['m11-1'])
  const m112 = JSON.stringify(LECCIONES['m11-2'])
  const m113 = JSON.stringify(LECCIONES['m11-3'])
  ok([1, 1.5, 2, 0.7].every((rb) => m111.includes(`${aciertoDeEquilibrio(rb)} %`)), 'el módulo 11 lee el acierto de equilibrio de `aciertoDeEquilibrio`')
  ok(aciertoDeEquilibrio(1) === 50 && aciertoDeEquilibrio(2) === 33, 'la cuenta del equilibrio es 1 ÷ (1 + R/B)')
  ok(m111.includes(`«${tEs.lab.equilibrio}»`), 'la lección nombra la fila del laboratorio como sale en pantalla')
  ok(m112.includes(`${OPS_PARA_CREER} operaciones`) && m112.includes(`±${margen(25)}`) && m112.includes(`baja a ${margen(OPS_PARA_CREER)} puntos`), 'el módulo 11 usa el listón y el margen del código')
  // El ejemplo de los rangos tiene que decir lo que la cuenta dice: con 25 se
  // tocan, con 150 no.
  ok(Math.abs(60 - 42) <= 2 * margen(25) && Math.abs(60 - 42) > 2 * margen(OPS_PARA_CREER), 'el ejemplo de los rangos cambia de veredicto entre 25 y 150 operaciones')
  ok(m112.includes('Los rangos se tocan') && m112.includes('Ya no se tocan'), 'la lección dice los dos veredictos')
  ok(/hacia adelante/.test(m113) && /cuenta cuántas pruebas/.test(m113), 'el módulo 11 explica el registro hacia adelante y el contador del laboratorio')
}
{
  // Módulo 12: el neto sale de `leerOperaciones` (la misma lectura que la
  // importación), las repetidas de `quitarRepetidas`, y los grupos y su ± de
  // `diagnostico.js`. Todo sobre operaciones de EJEMPLO.
  const es12 = await import('../src/lib/curso/es.js')
  const { leerOperaciones, quitarRepetidas } = await import('../src/lib/importarOperaciones.js')
  const D = await import('../src/lib/diagnostico.js')
  const tEs = (await import('../src/lib/i18n/textos/es.js')).default
  const m121 = JSON.stringify(LECCIONES['m12-1'])
  const m122 = JSON.stringify(LECCIONES['m12-2'])
  const m123 = JSON.stringify(LECCIONES['m12-3'])
  const op = leerOperaciones(es12.CSV_EJEMPLO, ['EUR/USD']).operaciones[0]
  ok(op && Math.abs(op.pl - (40 - 3.2 - 1.5)) < 1e-9 && es12.IMP_NETO === op.pl, 'el neto del ejemplo es precio + swap + comisión, leído por la importación de verdad')
  ok(m121.includes('+35,30') && quitarRepetidas([op], [op]).length === 0 && m121.includes('entran 0 operaciones nuevas'), 'la lección dice el neto y que no se repite al volver a subir')
  ok(m121.includes(`«${tEs.importar.titulo}»`), 'la lección nombra la tarjeta como sale en pantalla')
  ok(/cierres parciales/.test(m121) && /nunca te pide la contraseña/.test(m121), 'la lección dice lo que todavía no hace y que no pide credenciales')
  const dg = D.diagnostico(es12.EJEMPLO_GRUPOS)
  const cru = dg.tipoDePar.find((g) => g.clave === 'cruces')
  const dol = dg.tipoDePar.find((g) => g.clave === 'dolar')
  ok(cru.n === 8 && dol.n === 12 && m122.includes(`±${cru.margen}`) && m122.includes(`±${dol.margen}`), 'el ejemplo de grupos usa el ± de `margen()`')
  ok(es12.GRUPOS_SE_TOCAN === true && m122.includes('se tocan'), 'el veredicto de los rangos sale de la cuenta')
  ok(m122.includes(`«${tEs.diag.titulo({ n: 0 }).replace(/ \(0\)$/, '')}»`) && m122.includes(`${D.MINIMO_PARA_ENSEÑAR} operaciones o más`), 'la lección nombra la tarjeta y lee el mínimo por par del código')
  ok(dg.pares.length === 1 && dg.pares[0].clave === 'EUR/USD' && m122.includes('solo sale EUR/USD'), 'par por par sale solo el que llega al mínimo')
  const ra = D.resumir(es12.EJEMPLO_ACIERTO)
  ok(ra.pct === 70 && ra.neto === -20 && m123.includes('70 % ±31') && m123.includes('−20,00'), 'el ejemplo de acierto alto y neto negativo sale de `resumir`')
  ok(/cada app tiene su propio Diario/i.test(m123), 'la lección dice que cada app tiene su Diario')
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
