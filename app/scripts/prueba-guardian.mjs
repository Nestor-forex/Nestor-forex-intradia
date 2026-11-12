// Comprobaciones del guardián de riesgo del Diario. SIN INTERNET.
//
//     node scripts/prueba-guardian.mjs
//
// Lo que se vigila son las formas en que el freno puede MENTIR sin dar error:
//
//   · que una pérdida de las 8 de la noche se apunte al día SIGUIENTE porque
//     el día salió de `toISOString()` (UTC) y no del reloj del teléfono;
//   · que cuente operaciones abiertas, o de otros días, o que sume solo las
//     perdidas cuando el freno es sobre lo que la cuenta bajó en neto;
//   · que una racha de ayer deje el aviso encendido para siempre;
//   · y que esté escrito, probado y no lo enchufe nadie — que es lo que pasó
//     con `soloSeguidos` el 2026-10-31.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { AVISO_CERCA, diaDeCierre, diaLocal, estadoDelDia } from '../src/lib/guardianRiesgo.js'
import es from '../src/lib/i18n/textos/es.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (ruta) => readFileSync(join(RAIZ, ruta), 'utf8')

let mal = 0
const comprobar = (texto, ok) => {
  console.log(`  ${ok ? '✓' : '✗ MAL'}  ${texto}`)
  if (!ok) mal++
}
const titulo = (t) => console.log(`\n${t}`)

const HOY = '2026-11-12'
// Capital 5.000, 1 % por operación → 50; freno del día 3 % → 150; 3 seguidas.
const PERFIL = { capital: 5000, riesgoPct: 1, limiteDiarioPct: 3, maxPerdidasSeguidas: 3 }
let n = 0
const op = (pl, extra = {}) => ({ id: `t${++n}`, estado: 'cerrada', pl, cerradaEl: HOY, cerradaEnMs: 1000 + n, ...extra })

// ─────────────────────────────────────────────────────────────────────────────
titulo('1. El día es el del TELÉFONO, no el de UTC')

comprobar('diaLocal da AAAA-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(diaLocal()))
const tarde = new Date(2026, 10, 12, 20, 30) // 12 nov, 20:30 hora local
comprobar('a las 20:30 locales sigue siendo el día 12', diaLocal(tarde) === '2026-11-12')
comprobar('una fecha ilegible → null, no un día inventado', diaLocal('nada') === null)

// ⚠️ La comprobación de arriba NO PUEDE MORDER si esta máquina corre en UTC:
// allí la hora local y la de UTC son la misma, y `toISOString` daría también
// el 12. Es el agujero que ya tuvo la prueba de la hora de Intradía el
// 2026-10-24. Por eso se repite en un proceso aparte con la zona de Bogotá, y
// se exige además que esa zona de verdad desplace (si no, volvería a ser
// inofensiva).
const enBogota = execFileSync(
  process.execPath,
  [
    '--input-type=module',
    '-e',
    `import { diaLocal } from ${JSON.stringify(new URL('../src/lib/guardianRiesgo.js', import.meta.url).href)}
     const d = new Date(2026, 10, 12, 20, 30)
     console.log(JSON.stringify({ local: diaLocal(d), utc: d.toISOString().slice(0, 10) }))`,
  ],
  { env: { ...process.env, TZ: 'America/Bogota' }, encoding: 'utf8' },
)
const b = JSON.parse(enBogota)
comprobar('en Bogotá, a las 20:30 la zona de verdad desplaza (UTC ya es el 13)', b.utc === '2026-11-13')
comprobar('en Bogotá, a las 20:30 diaLocal sigue diciendo el 12', b.local === '2026-11-12')
comprobar('diaDeCierre prefiere cerradaEl', diaDeCierre({ cerradaEl: '2026-11-12', fecha: '2026-11-10' }) === '2026-11-12')
comprobar('diaDeCierre cae a fecha si no hay cerradaEl (lo viejo)', diaDeCierre({ fecha: '2026-11-10' }) === '2026-11-10')
comprobar('sin ninguna fecha legible → null', diaDeCierre({ fecha: 'ayer' }) === null && diaDeCierre({}) === null)

// El mismo error, en el código que GUARDA: si alguien vuelve a `toISOString`,
// la cuenta de arriba seguiría bien y el Diario guardaría el día equivocado.
const diario = leer('src/components/DiarioTab.jsx')
comprobar('el Diario NO guarda la fecha con toISOString', !/toISOString\(\)\.slice\(0,\s*10\)/.test(diario))
comprobar('el Diario guarda el día con diaLocal', /fecha:\s*hoy/.test(diario) && /const hoy = diaLocal\(\)/.test(diario))
comprobar('una operación apuntada ya cerrada lleva su día de cierre', /cerradaEl:\s*hoy/.test(diario) && /cerradaEnMs:\s*Date\.now\(\)/.test(diario))
const trades = leer('src/lib/useTrades.js')
comprobar('cerrar una operación guarda cerradaEl y cerradaEnMs', /cerrar[\s\S]{0,200}cerradaEl:\s*diaLocal\(\)[\s\S]{0,60}cerradaEnMs:\s*Date\.now\(\)/.test(trades))

// ─────────────────────────────────────────────────────────────────────────────
titulo('2. Qué cuenta y qué no')

comprobar('sin perfil → sinPerfil', estadoDelDia([op(-100)], {}, HOY).estado === 'sinPerfil')
comprobar('perfil a medias → sinPerfil', estadoDelDia([op(-100)], { ...PERFIL, maxPerdidasSeguidas: null }, HOY).estado === 'sinPerfil')

const vacio = estadoDelDia([], PERFIL, HOY)
comprobar('sin operaciones: ok, 0 perdido, freno de 150', vacio.estado === 'ok' && vacio.perdido === 0 && vacio.limiteUsd === 150 && vacio.margen === 150)

const mezcla = estadoDelDia(
  [op(-100), op(60), op(-500, { estado: 'abierta' }), op(-500, { cerradaEl: '2026-11-11' }), op(-500, { cerradaEl: undefined, fecha: '2026-11-11' })],
  PERFIL,
  HOY,
)
comprobar('las abiertas y las de otros días NO cuentan', mezcla.ops === 2)
comprobar('cuenta el NETO: −100 + 60 → 40 perdidos, no 100', mezcla.neto === -40 && mezcla.perdido === 40)
comprobar('un día en positivo no deja «perdido» negativo', estadoDelDia([op(80)], PERFIL, HOY).perdido === 0)
comprobar('un resultado no numérico se ignora, no rompe la cuenta', estadoDelDia([op('x'), op(-20)], PERFIL, HOY).perdido === 20)

// ─────────────────────────────────────────────────────────────────────────────
titulo('3. El freno del día, en sus bordes')

comprobar('149 perdidos: no hay freno', !estadoDelDia([op(-149)], PERFIL, HOY).frenoDia)
comprobar('150 justos (el freno): freno encendido', estadoDelDia([op(-150)], PERFIL, HOY).estado === 'freno')
comprobar('0,1 + 0,2 de coma flotante no deja el borde por debajo', estadoDelDia([op(-100.1), op(-49.9)], PERFIL, HOY).frenoDia)
const casi = estadoDelDia([op(-100)], PERFIL, HOY)
comprobar(`a 2/3 del freno (100 de 150): «cerca», margen 50`, AVISO_CERCA === 2 / 3 && casi.estado === 'cerca' && casi.cercaDia && casi.margen === 50)
comprobar('por debajo de 2/3: ok', estadoDelDia([op(-99)], PERFIL, HOY).estado === 'ok')

// ─────────────────────────────────────────────────────────────────────────────
titulo('4. Las pérdidas seguidas: solo de hoy, desde la última')

const tres = estadoDelDia([op(-10), op(-10), op(-10)], PERFIL, HOY)
comprobar('tres pérdidas seguidas → freno de racha', tres.racha === 3 && tres.frenoRacha && tres.estado === 'freno')
comprobar('dos seguidas → «cerca», a una del límite', estadoDelDia([op(-10), op(-10)], PERFIL, HOY).cercaRacha)
// Orden por momento de cierre: la última es la ganada, así que la racha es 0.
const corta = estadoDelDia([op(-10), op(-10), op(30)], PERFIL, HOY)
comprobar('una ganada DESPUÉS corta la racha', corta.racha === 0)
const desorden = [op(30, { cerradaEnMs: 1 }), op(-10, { cerradaEnMs: 5 }), op(-10, { cerradaEnMs: 9 })]
comprobar('se ordena por el momento de cierre, no por el orden de la lista', estadoDelDia(desorden, PERFIL, HOY).racha === 2)
comprobar('un empate ni suma ni corta', estadoDelDia([op(-10, { cerradaEnMs: 1 }), op(0, { cerradaEnMs: 2 }), op(-10, { cerradaEnMs: 3 })], PERFIL, HOY).racha === 2)
const ayer = [op(-10, { cerradaEl: '2026-11-11' }), op(-10, { cerradaEl: '2026-11-11' }), op(-10, { cerradaEl: '2026-11-11' })]
comprobar('la racha de AYER no enciende el freno de hoy', estadoDelDia(ayer, PERFIL, HOY).racha === 0)
const viejas = [{ estado: 'cerrada', pl: -10, fecha: HOY, creado: { seconds: 1 } }, { estado: 'cerrada', pl: 20, fecha: HOY, creado: { toMillis: () => 9000 } }]
comprobar('lo viejo sin cerradaEnMs se ordena por cuándo se apuntó', estadoDelDia(viejas, PERFIL, HOY).racha === 0)
comprobar('con límite de 1, la primera pérdida ya es freno', estadoDelDia([op(-1)], { ...PERFIL, maxPerdidasSeguidas: 1 }, HOY).estado === 'freno')

// ─────────────────────────────────────────────────────────────────────────────
titulo('5. Solo avisa: no hay nada que bloquee')

const guardianJsx = leer('src/components/GuardianRiesgo.jsx')
comprobar('la tarjeta no desactiva ningún botón ni formulario', !/disabled/.test(guardianJsx) && !/disabled=\{[^}]*freno/.test(diario))
comprobar('el pie dice que no bloquea nada', /no bloquea nada/.test(es.guardian?.pie || ''))

// ─────────────────────────────────────────────────────────────────────────────
titulo('6. Está enchufado (si no, es soloSeguidos otra vez)')

comprobar('el Diario pinta el guardián', /<GuardianRiesgo\b[^>]*trades=\{trades\}/.test(diario))
comprobar('el Diario le pasa el perfil leído con leerPerfil', /leerPerfil\(perfilRiesgo\)/.test(diario) && /perfil=\{perfilGuardado\}/.test(diario))
const app = leer('src/App.jsx')
comprobar('App le pasa al Diario el perfil de la ficha', /perfilRiesgo=\{perfil\?\.perfilRiesgo\}/.test(app))
comprobar('App le da al Diario el camino a la pestaña del perfil', /onIrAlPerfil=\{\(\) => setTab\('calc'\)\}/.test(app))
comprobar('la lógica no lleva Firebase ni React', !/firebase|react/i.test(leer('src/lib/guardianRiesgo.js').replace(/\/\/.*$/gm, '')))

// ─────────────────────────────────────────────────────────────────────────────
titulo('7. Los textos existen')

const usadas = [...guardianJsx.matchAll(/tr\('(guardian\.[a-zA-Z]+)'/g)].map((m) => m[1])
comprobar('se encontraron claves en la tarjeta (si no, esto no comprobaría nada)', usadas.length >= 8)
for (const k of [...new Set(usadas)]) {
  const [, b] = k.split('.')
  comprobar(`es.js tiene ${k}`, es.guardian?.[b] !== undefined)
}
comprobar('cercaDia es función (lleva el margen dentro)', typeof es.guardian?.cercaDia === 'function' && es.guardian.cercaDia({ margen: '$50.00' }).includes('$50.00'))

console.log(mal ? `\n✗ ${mal} comprobación(es) MAL` : '\n✓ todo bien')
process.exit(mal ? 1 : 0)
