// LAS INSIGNIAS, sin internet ni credenciales.
//
// Correr con: node scripts/prueba-insignias.mjs
//
// Vigila lo único que no se puede romper: que ninguna insignia premie ganar
// dinero o acertar, y que la del freno premie PARAR cuando tu regla lo dice.

import { readFileSync } from 'node:fs'
import { INSIGNIAS, META, calcularInsignias, conseguidas, diaRespetado, diasRespetados } from '../src/lib/insignias.js'
import { leerPerfil } from '../src/lib/perfilRiesgo.js'

let mal = 0
const comprobar = (que, cond) => {
  console.log(`${cond ? '  OK  ' : '  MAL '} ${que}`)
  if (!cond) mal++
}

const PERFIL = { capital: 1000, riesgoPct: 1, limiteDiarioPct: 3, maxPerdidasSeguidas: 3 } // freno del día: 30 $
const op = (dia, pl, ms, extra = {}) => ({ estado: 'cerrada', pl, cerradaEl: dia, cerradaEnMs: ms, fecha: dia, ...extra })
const mapa = (lista) => Object.fromEntries(lista.map((i) => [i.id, i]))

console.log('\n1. Sin nada, ninguna; el freno pide el perfil')
{
  const l = calcularInsignias([], {})
  comprobar('sale una por cada insignia, en orden', l.map((i) => i.id).join() === INSIGNIAS.join())
  comprobar('ninguna conseguida', conseguidas(l) === 0)
  comprobar('el freno avisa de que necesita el perfil', mapa(l).freno.necesitaPerfil === true)
  comprobar('null y basura no revientan', calcularInsignias(null, null).length === INSIGNIAS.length && calcularInsignias([null, 3], 'x').length === INSIGNIAS.length)
}

console.log('\n2. Las de un solo paso')
{
  const m = mapa(calcularInsignias([], { perfilRiesgo: PERFIL, seguimiento: ['EUR/USD'], plantillas: [{}], avisos: [{}] }))
  comprobar('perfil completo', m.perfil.conseguida)
  comprobar('lista de pares', m.lista.conseguida)
  comprobar('plantilla', m.metodo.conseguida)
  comprobar('aviso propio', m.alerta.conseguida)
  comprobar('un perfil a medias no cuenta', !mapa(calcularInsignias([], { perfilRiesgo: { capital: 1000 } })).perfil.conseguida)
}

console.log('\n3. Constancia: el progreso se topa en la meta')
{
  const muchas = Array.from({ length: 15 }, (_, i) => op('2026-11-0' + ((i % 9) + 1), -1, i, { nota: i < 4 ? 'rompió la resistencia' : 'x' }))
  const m = mapa(calcularInsignias(muchas, {}))
  comprobar(`diario: ${META.diario} de ${META.diario} y conseguida`, m.diario.n === META.diario && m.diario.conseguida)
  comprobar('una nota de una letra no es un «por qué»', m.porque.n === 4 && !m.porque.conseguida)
}

console.log('\n4. El freno: parar cuando tu regla lo dice')
{
  const p = leerPerfil(PERFIL)
  comprobar('perder hasta el freno y parar lo respeta', diaRespetado([op('d', -20, 1), op('d', -10, 2)], p))
  comprobar('seguir operando después de tocarlo lo rompe', !diaRespetado([op('d', -20, 1), op('d', -10, 2), op('d', 50, 3)], p))
  comprobar('tres pérdidas seguidas y parar lo respeta', diaRespetado([op('d', -1, 1), op('d', -1, 2), op('d', -1, 3)], p))
  comprobar('una cuarta tras las tres lo rompe', !diaRespetado([op('d', -1, 1), op('d', -1, 2), op('d', -1, 3), op('d', -1, 4)], p))
  comprobar('cuenta el orden de cierre, no el de la lista', !diaRespetado([op('d', 50, 3), op('d', -10, 2), op('d', -20, 1)], p))
  comprobar('un día sin tocarlo también cuenta', diaRespetado([op('d', 5, 1)], p))
  const dias = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map((d, i) => op(d, -1, i))
  comprobar('cinco días respetados la consiguen', mapa(calcularInsignias(dias, { perfilRiesgo: PERFIL })).freno.conseguida)
  comprobar('sin perfil no se cuenta (null, no 0)', diasRespetados(dias, leerPerfil({})) === null)
  comprobar('las abiertas no cuentan', diasRespetados([{ estado: 'abierta', pl: -500, cerradaEl: '2026-11-01' }], p) === 0)
}

console.log('\n5. ⚠️ Ninguna premia ganar dinero')
{
  const base = Array.from({ length: 12 }, (_, i) => ({ dia: `2026-10-${String(10 + i).padStart(2, '0')}`, pl: i % 3 === 0 ? -5 : 7, nota: 'entré por la ruptura del máximo' }))
  const ficha = { perfilRiesgo: PERFIL, seguimiento: ['EUR/USD'] }
  const con = (signo) => calcularInsignias(base.map((b, i) => op(b.dia, signo(b.pl), i, { nota: b.nota })), ficha)
  const ganar = con((x) => Math.abs(x))
  const perder = con((x) => -Math.abs(x))
  const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  comprobar('todas ganadoras o todas perdedoras (dentro del freno) dan las MISMAS insignias', iguales(ganar, perder))
  const enorme = con((x) => x * 1000)
  comprobar('multiplicar el dinero por mil no cambia ninguna salvo, como mucho, el freno',
    iguales(enorme.filter((i) => i.id !== 'freno'), ganar.filter((i) => i.id !== 'freno')))
  const src = readFileSync(new URL('../src/lib/insignias.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '')
  comprobar('el código no mira el acierto ni la suma de ganancias', !/acierto|winrate|ganad|totalPl|sumaPl/i.test(src))
}

console.log('\n6. La pantalla')
{
  const ui = readFileSync(new URL('../src/components/Insignias.jsx', import.meta.url), 'utf8')
  comprobar('lleva su «para qué sirve»', /paraQue=\{tr\('insig\.paraQue'\)\}/.test(ui))
  comprobar('el aviso va antes de la lista', ui.indexOf("tr('insig.aviso')") < ui.indexOf('lista.map'))
  comprobar('ni verde ni rojo: va con el color de la marca', !/--green|--red/.test(ui) && /--cta/.test(ui))
  const diario = readFileSync(new URL('../src/components/DiarioTab.jsx', import.meta.url), 'utf8')
  comprobar('el Diario la enseña con la ficha', /<Insignias trades=\{trades\} ficha=\{ficha\} \/>/.test(diario))
  const es = readFileSync(new URL('../src/lib/i18n/textos/es.js', import.meta.url), 'utf8')
  for (const id of INSIGNIAS) comprobar(`la insignia «${id}» tiene sus dos textos`, es.includes(`${id}T:`) && es.includes(`${id}D:`))
}

if (mal) {
  console.log(`\n✗ ${mal} comprobación(es) MAL.\n`)
  process.exit(1)
}
console.log('\n✓ todo bien.\n')
