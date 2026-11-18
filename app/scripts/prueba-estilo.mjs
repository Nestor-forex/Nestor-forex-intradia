// Comprobaciones de «¿Cómo operas?» (2026-11-17), sin internet.
//
//   node scripts/prueba-estilo.mjs
//
// GEMELO: el estilo, sus herramientas, la tarjeta y la regla de Firestore son
// iguales en las dos apps.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESTILOS, HERRAMIENTAS_DE_ESTILO, herramientasDeEstilo, leerEstilo } from '../src/lib/estilo.js'
import { HERRAMIENTAS, HERRAMIENTAS_INICIALES } from '../src/lib/analizador.js'
import { crearT } from '../src/lib/i18n/crearT.js'
import { IDIOMAS } from '../src/lib/i18n/idiomas.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (r) => readFileSync(join(RAIZ, r), 'utf8')
let mal = 0
function ok(cond, msg) {
  if (!cond) mal++
  console.log(`${cond ? '  ✓' : '  ✗ MAL'} ${msg}`)
}

console.log('\n1. Los estilos y sus herramientas')
ok(ESTILOS.join() === 'tendencias,rangos,noticias,nose', 'cuatro estilos, «todavía no sé» incluido')
for (const e of ESTILOS) {
  const raras = HERRAMIENTAS_DE_ESTILO[e].filter((h) => !HERRAMIENTAS.includes(h))
  ok(HERRAMIENTAS_DE_ESTILO[e].length > 0 && !raras.length, `${e}: solo herramientas que existen${raras.length ? ' (sobran: ' + raras.join(', ') + ')' : ''}`)
}
ok(HERRAMIENTAS_DE_ESTILO.nose.join() === HERRAMIENTAS_INICIALES.join(), '«todavía no sé» arranca con las de siempre')
ok(leerEstilo('rangos') === 'rangos' && leerEstilo('ganador') === null && leerEstilo(undefined) === null, 'un estilo raro se lee como «sin elegir»')
ok(herramientasDeEstilo(null).join() === HERRAMIENTAS_INICIALES.join(), 'sin estilo, las de siempre')
ok(!herramientasDeEstilo('rangos', ['niveles', 'rsi']).includes('bollinger'), 'solo las que esta app puede calcular')
ok(herramientasDeEstilo('rangos', ['niveles', 'rsi']).join() === 'niveles,rsi', 'y en su orden')

console.log('\n2. Los textos en los 13 idiomas')
const claves = ['titulo', 'aviso', 'nota', 'alCambiar', 'tuEstilo', 'sinElegir', 'cambiar', 'cerrar', 'sinPermiso', 'error', ...ESTILOS.flatMap((e) => [`${e}T`, `${e}D`])]
for (const { codigo } of IDIOMAS) {
  const t = crearT(codigo)
  const faltan = claves.filter((k) => !t(`estilo.${k}`))
  ok(!faltan.length, `${codigo}: todas las claves${faltan.length ? ' (faltan: ' + faltan.join(', ') + ')' : ''}`)
}
const es = crearT('es')
const descripciones = ESTILOS.map((e) => es(`estilo.${e}D`)).join(' ')
ok(!/\b(compr[ae]s?|vend[ae]s?|gana|mejor estilo)\b/i.test(descripciones), 'ninguna descripción dice comprar, vender ni que un estilo gana')

console.log('\n3. Enchufado')
const tarjeta = leer('src/components/MiEstilo.jsx')
const iAviso = tarjeta.lastIndexOf("t('estilo.aviso')")
const iBotones = tarjeta.lastIndexOf('ESTILOS.map(')
ok(iAviso > 0 && iBotones > iAviso, 'en la tarjeta, el aviso va ANTES de los botones')
const app = leer('src/App.jsx')
ok(/miEstilo\.sabido && <MiEstilo estilo=\{miEstilo\.estilo\}/.test(app), 'la tarjeta se queda SIEMPRE en el Barrido, con el estilo elegido (2026-11-18)')
ok(!/!miEstilo\.estilo && <MiEstilo/.test(app), 'y ya no desaparece al contestar')
ok(/estilo && linea/.test(tarjeta) && /t\('estilo\.cambiar'\)/.test(tarjeta), 'con estilo elegido, la tarjeta enseña el estilo y el botón «Cambiar»')
ok(!/textDecoration: 'underline'/.test(tarjeta), '«Cambiar» es un botón de verdad, no un enlace subrayado')
const an = leer('src/components/AnalizadorTab.jsx')
ok(/miEstilo\.estilo\s*\?\s*herramientasDeEstilo\(miEstilo\.estilo\)/.test(an), 'el Analizador arranca con las herramientas del estilo si nunca se usó')
ok(/Array\.isArray\(ultimo\?\.herramientas\) && !\(miEstilo\.estilo && ultimo && 'estilo' in ultimo && ultimo\.estilo !== miEstilo\.estilo\)/.test(an), 'lo último que usó manda, salvo que haya cambiado de estilo después')
ok(/herramientas: herr, estilo: miEstilo\.estilo/.test(an) && /recordar\(\{ herramientas: nueva, estilo: e \}\)/.test(an), 'lo último que usó se guarda con el estilo de ese momento')
ok(/onElegido=\{\(e\) => \{\s*const nueva = herramientasDeEstilo\(e, disponibles\)/.test(an), 'al cambiar el estilo en el Analizador se encienden sus herramientas disponibles')
const reglas = leer('../firestore.rules')
ok(/'diasTablero', 'estilo'\]/.test(reglas), 'la regla deja escribir el estilo en la propia ficha')
const enRegla = reglas.match(/estilo in \[([^\]]*)\]/)?.[1]?.match(/'[^']+'/g)?.map((x) => x.slice(1, -1)).join()
ok(enRegla === ESTILOS.join(), `y solo las mismas cuatro palabras que la app${enRegla ? '' : ' (no se encontró la lista)'}`)

console.log(mal ? `\n✗ ${mal} comprobaciones fallaron\n` : '\n✓ todo bien\n')
process.exit(mal ? 1 : 0)
