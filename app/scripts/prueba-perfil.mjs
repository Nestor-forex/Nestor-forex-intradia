// Comprobaciones del perfil de riesgo de cada persona. SIN INTERNET y sin
// gastar un crédito.
//
//     node scripts/prueba-perfil.mjs
//
// Lo que se vigila aquí son las tres formas en que el perfil puede MENTIR sin
// dar ningún error:
//
//   · que una casilla vacía se lea como 0 —`Number('')` vale 0— y la
//     calculadora dé un lote de 0 creyendo que la persona tiene 0 dólares;
//   · que la app y las reglas de Firestore admitan límites DISTINTOS: la app
//     dejaría guardar y Firestore rechazaría, o al revés, y quien lo sufra solo
//     vería «no se pudo guardar»;
//   · y que el perfil esté escrito, probado y NO LO USE NADIE — que es lo que
//     pasó con `soloSeguidos` el 2026-10-31, y lo encontró Néstor.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CAMPOS,
  LIMITES,
  NIVELES,
  SUGERIDO,
  aNumero,
  dentro,
  frenoEnDolares,
  leerPerfil,
  nivelDe,
  operacionesHastaElFreno,
  perfilCompleto,
  validaPerfil,
  valoresIniciales,
} from '../src/lib/perfilRiesgo.js'
import es from '../src/lib/i18n/textos/es.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (ruta) => readFileSync(join(RAIZ, ruta), 'utf8')

let mal = 0
const comprobar = (texto, ok) => {
  console.log(`  ${ok ? '✓' : '✗ MAL'}  ${texto}`)
  if (!ok) mal++
}
const titulo = (t) => console.log(`\n${t}`)

const BUENO = { capital: 5000, riesgoPct: 1, limiteDiarioPct: 3, maxPerdidasSeguidas: 3 }

// ─────────────────────────────────────────────────────────────────────────────
titulo('1. Una casilla vacía o rara NO se lee como 0')

comprobar('cadena vacía → null', aNumero('', 'capital') === null)
comprobar('solo espacios → null', aNumero('   ', 'capital') === null)
comprobar('null → null', aNumero(null, 'capital') === null)
comprobar('undefined → null', aNumero(undefined, 'capital') === null)
comprobar('texto → null', aNumero('mil', 'capital') === null)
comprobar('NaN → null', aNumero(NaN, 'capital') === null)
comprobar('Infinity → null', aNumero(Infinity, 'capital') === null)
comprobar('«1,5» con coma decimal → 1,5', aNumero('1,5', 'riesgoPct') === 1.5)
comprobar('«2.5» con punto → 2,5', aNumero('2.5', 'riesgoPct') === 2.5)
comprobar('«5000» → 5000', aNumero('5000', 'capital') === 5000)
comprobar('pérdidas seguidas con decimales → null (es un entero)', aNumero('2.5', 'maxPerdidasSeguidas') === null)
comprobar('pérdidas seguidas entero → 3', aNumero(3, 'maxPerdidasSeguidas') === 3)

// ─────────────────────────────────────────────────────────────────────────────
titulo('2. Lo guardado que no tiene sentido se queda vacío, no se arregla')

const vacio = leerPerfil(undefined)
comprobar('sin perfil → los cuatro en null', CAMPOS.every((c) => vacio[c] === null))
comprobar('una lista en vez de un objeto → los cuatro en null', CAMPOS.every((c) => leerPerfil([1, 2])[c] === null))
comprobar('un perfil bueno se lee entero', CAMPOS.every((c) => leerPerfil(BUENO)[c] === BUENO[c]))
const raro = leerPerfil({ ...BUENO, riesgoPct: 50 })
comprobar('un riesgo del 50 % NO se recorta a 10: se queda en null', raro.riesgoPct === null)
comprobar('…y los demás campos no se pierden por eso', raro.capital === 5000 && raro.limiteDiarioPct === 3)
comprobar('capital 0 → null (0 es una afirmación, no «no lo dijo»)', leerPerfil({ ...BUENO, capital: 0 }).capital === null)
comprobar('perfilCompleto con los cuatro → sí', perfilCompleto(leerPerfil(BUENO)))
comprobar('perfilCompleto con uno raro → no', !perfilCompleto(raro))

// ─────────────────────────────────────────────────────────────────────────────
titulo('3. Antes de guardar se exigen LOS CUATRO, dentro de sus límites')

const v = validaPerfil({ capital: '5000', riesgoPct: '1', limiteDiarioPct: '3', maxPerdidasSeguidas: '3' })
comprobar('lo escrito en texto se valida y sale en números', v.ok && v.limpio.capital === 5000 && v.limpio.riesgoPct === 1)
comprobar('lo limpio lleva exactamente los cuatro campos', v.ok && Object.keys(v.limpio).sort().join() === [...CAMPOS].sort().join())
const sinCapital = validaPerfil({ ...BUENO, capital: '' })
comprobar('sin capital → «falta», nombrando el campo', !sinCapital.ok && sinCapital.codigo === 'falta' && sinCapital.campo === 'capital')
const fuera = validaPerfil({ ...BUENO, riesgoPct: 20 })
comprobar('riesgo del 20 % → «fueraDeRango»', !fuera.ok && fuera.codigo === 'fueraDeRango' && fuera.campo === 'riesgoPct')
const bajo = validaPerfil({ ...BUENO, riesgoPct: 2, limiteDiarioPct: 1 })
comprobar('freno del día menor que una operación → rechazado', !bajo.ok && bajo.codigo === 'limiteMenorQueRiesgo')
comprobar('freno igual a una operación → vale (deja hacer una)', validaPerfil({ ...BUENO, riesgoPct: 2, limiteDiarioPct: 2 }).ok)
for (const c of CAMPOS) {
  comprobar(`${c}: el mínimo exacto vale`, dentro(c, LIMITES[c].min))
  comprobar(`${c}: el máximo exacto vale`, dentro(c, LIMITES[c].max))
}

// ─────────────────────────────────────────────────────────────────────────────
titulo('4. Los niveles y las cuentas del resumen')

comprobar('1 % → conservador', nivelDe(1) === 'conservador')
comprobar('2 % → moderado', nivelDe(2) === 'moderado')
comprobar('3 % → agresivo', nivelDe(3) === 'agresivo')
comprobar('1,5 % → personalizado', nivelDe(1.5) === 'personalizado')
comprobar('sin riesgo → null, no «conservador»', nivelDe(null) === null)
comprobar('los niveles son los que dio Néstor (1, 2, 3)', NIVELES.conservador === 1 && NIVELES.moderado === 2 && NIVELES.agresivo === 3)
comprobar('1 % y freno 3 % → el día se acaba a la 3.ª pérdida', operacionesHastaElFreno(BUENO) === 3)
comprobar('2 % y freno 3 % → a la 1.ª', operacionesHastaElFreno({ ...BUENO, riesgoPct: 2 }) === 1)
// 0,7 / 0,1 vale 6,999999999999999 en JavaScript. Sin el margen saldría 6.
comprobar('0,1 % y freno 0,7 % → 7, no 6 (coma flotante)', operacionesHastaElFreno({ ...BUENO, riesgoPct: 0.1, limiteDiarioPct: 0.7 }) === 7)
comprobar('sin riesgo → null', operacionesHastaElFreno({ ...BUENO, riesgoPct: null }) === null)
comprobar('freno de 3 % sobre 5000 → 150 USD', frenoEnDolares(BUENO) === 150)
const ini = valoresIniciales(leerPerfil(undefined))
comprobar('sin perfil: el capital sale VACÍO, nunca inventado', ini.capital === '')
comprobar('sin perfil: el riesgo sale vacío', ini.riesgoPct === '')
comprobar('sin perfil: se proponen los dos frenos sugeridos', ini.limiteDiarioPct === String(SUGERIDO.limiteDiarioPct) && ini.maxPerdidasSeguidas === String(SUGERIDO.maxPerdidasSeguidas))
comprobar('con perfil: salen sus números', valoresIniciales(leerPerfil(BUENO)).capital === '5000')

// ─────────────────────────────────────────────────────────────────────────────
titulo('5. Las reglas de Firestore admiten LO MISMO que la app')

const reglas = leer('../firestore.rules')
const hasOnly = reglas.match(/affectedKeys\(\)\s*\.hasOnly\(\[([^\]]*)\]\)/)
comprobar('la lista blanca de la ficha incluye perfilRiesgo', Boolean(hasOnly) && /'perfilRiesgo'/.test(hasOnly[1]))
comprobar('…y la regla lo valida al escribir', /perfilRiesgoValido\(request\.resource\.data\.perfilRiesgo\)/.test(reglas))
const fn = reglas.match(/function perfilRiesgoValido\(p\)\s*\{([\s\S]*?)\n\s*\}/)
comprobar('existe la función perfilRiesgoValido', Boolean(fn))
const cuerpo = fn ? fn[1] : ''
const listaReglas = (m) => (m ? m[1].split(',').map((s) => s.trim().replace(/'/g, '')).sort().join() : '')
comprobar('exige los cuatro campos y ni uno más (hasOnly)', listaReglas(cuerpo.match(/hasOnly\(\[([^\]]*)\]\)/)) === [...CAMPOS].sort().join())
comprobar('exige los cuatro campos y ni uno menos (hasAll)', listaReglas(cuerpo.match(/hasAll\(\[([^\]]*)\]\)/)) === [...CAMPOS].sort().join())
for (const c of CAMPOS) {
  const m = cuerpo.match(new RegExp(`p\\.${c} >= ([\\d.]+) && p\\.${c} <= ([\\d.]+)`))
  comprobar(
    `${c}: los límites de las reglas (${m ? m[1] + '–' + m[2] : 'no encontrados'}) son los de la app (${LIMITES[c].min}–${LIMITES[c].max})`,
    Boolean(m) && Number(m[1]) === LIMITES[c].min && Number(m[2]) === LIMITES[c].max
  )
}
comprobar('pérdidas seguidas se exige entero en las reglas', /p\.maxPerdidasSeguidas is int/.test(cuerpo))

// ─────────────────────────────────────────────────────────────────────────────
titulo('6. El perfil está ENCHUFADO, no solo escrito')

const calc = leer('src/components/CalculadoraTab.jsx')
comprobar('la calculadora pinta la tarjeta del perfil', /import MiPerfil from '\.\/MiPerfil'/.test(calc) && /<MiPerfil /.test(calc))
comprobar('la calculadora lee el perfil para rellenar capital y riesgo', /leerPerfil\(ficha\?\.perfilRiesgo\)/.test(calc) && /perfil\.capital/.test(calc) && /perfil\.riesgoPct/.test(calc))
const app = leer('src/App.jsx')
const usoCalc = app.match(/<CalculadoraTab[\s\S]*?\/>/)
comprobar('App le pasa la ficha de la persona a la calculadora', Boolean(usoCalc) && /ficha=\{perfil\}/.test(usoCalc[0]) && /uid=\{authUser\.uid\}/.test(usoCalc[0]))
const hook = leer('src/lib/usePerfilRiesgo.js')
comprobar('se guarda lo VALIDADO, nunca el formulario entero', /perfilRiesgo: v\.limpio/.test(hook))
comprobar('la lógica del perfil no importa Firebase (se prueba sin red)', !/firebase/.test(leer('src/lib/perfilRiesgo.js').replace(/\/\/.*$/gm, '')))

// ─────────────────────────────────────────────────────────────────────────────
titulo('7. Ningún texto que use la tarjeta falta en el diccionario')

// Un `t()` de una clave que no existe NO da error: sale en blanco.
const tarjeta = leer('src/components/MiPerfil.jsx')
const usadas = [...tarjeta.matchAll(/t\('(perfil\.[a-zA-Z_]+)'/g)].map((m) => m[1])
const dinamicas = [
  ...Object.keys(NIVELES).map((n) => `perfil.${n}`),
  'perfil.personalizado',
  ...['falta', 'fueraDeRango', 'limiteMenorQueRiesgo', 'sinPermiso', 'noSeGuardo', 'sinSesion'].map((c) => `perfil.err_${c}`),
]
comprobar('se encontraron claves en la tarjeta (si no, esto no comprobaría nada)', usadas.length >= 10)
for (const k of [...new Set([...usadas, ...dinamicas])]) {
  const [a, b] = k.split('.')
  comprobar(`es.js tiene ${k}`, es[a]?.[b] !== undefined)
}
for (const k of ['desdePerfil', 'distintoAlPerfil', 'sinPerfil']) comprobar(`es.js tiene calc.${k}`, typeof es.calc?.[k] === 'string')
comprobar('los errores con campo son funciones (llevan el nombre dentro)', typeof es.perfil?.err_falta === 'function' && typeof es.perfil?.err_fueraDeRango === 'function')

console.log(mal ? `\n✗ ${mal} comprobación(es) MAL` : '\n✓ todo bien')
process.exit(mal ? 1 : 0)
