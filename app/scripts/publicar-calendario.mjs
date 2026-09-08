// Baja el calendario económico y lo publica en `estado/calendario.json`.
//
//     node scripts/publicar-calendario.mjs
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ POR QUÉ ESTO NO VA DENTRO DEL VIGÍA
// ─────────────────────────────────────────────────────────────────────────
// Sería más corto meterlo ahí: el vigía ya baja, ya calcula y ya escribe en la
// rama `datos`. Y estaría MAL, por dos razones que no son de gusto.
//
// 1. FRESCURA. El vigía corre a las 15:50 UTC **de lunes a viernes**, y el feed
//    de ForexFactory cubre LA SEMANA EN CURSO. El lunes por la mañana, antes
//    de las 15:50, la última publicación sería la del viernes anterior: o sea
//    la semana PASADA entera, con todo ya ocurrido y nada de lo que viene.
//    Un calendario así no es «un poco viejo» — es falso.
//
// 2. AISLAMIENTO. El vigía escribe el historial, que es lo ÚNICO de este
//    proyecto que no se puede volver a fabricar. Un fallo bajando el
//    calendario no puede tener ni la posibilidad de tocarlo.
//
// ⚠️ NO GASTA NI UN CRÉDITO DE TWELVE DATA. Es otra fuente, gratis y sin
// llave, así que su horario no compite con el del vigía ni con el del reporte.
//
// La fuente se eligió CON LA SONDA (`sonda-calendario.mjs`), no leyendo
// documentación: de las cuatro candidatas, ForexFactory fue la única que
// respondió con eventos de nuestras divisas. Trading Economics contestó 410
// («the guest account has been discontinued») y TradingView 403.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { prepararCalendario, proximos } from '../src/lib/calendario.js'
// El nombre de la app sale de `identidad.js` y no escrito a mano: así este
// guion es idéntico en las dos apps y `prueba-gemelos.mjs` puede vigilarlo.
import { APP } from '../src/lib/identidad.js'

const URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json'

// La misma carpeta que usa el vigía, para que el workflow no tenga que
// inventarse otra convención.
const DESTINO = join(process.env.VIGIA_DATOS || 'datos', 'estado', 'calendario.json')

const LIMITE_MS = 30_000

async function bajar() {
  const r = await fetch(URL, {
    // Sin User-Agent algunos servidores devuelven 403 aunque el feed sea
    // público. Se pone uno honesto: no se disfraza de navegador.
    headers: { 'User-Agent': `NestorForex-${APP}/1.0 (+https://github.com/Nestor-forex)` },
    signal: AbortSignal.timeout(LIMITE_MS),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)

  const datos = await r.json()
  if (!Array.isArray(datos)) throw new Error('la respuesta no es una lista de eventos')
  return datos
}

console.log('Calendario económico — publicador')
console.log(`  fuente: ${URL}`)

const crudo = await bajar()
console.log(`  bajados: ${crudo.length} eventos de todo el mundo`)

const cal = prepararCalendario(crudo)

// ⚠️ SI EL FEED RESPONDE PERO NO TRAE NADA NUESTRO, NO SE PUBLICA.
//
// Escribir un archivo con cero eventos machacaría el bueno del día anterior, y
// en pantalla se vería igual que una semana tranquila. Es el mismo peligro que
// el respaldo del historial vigila: lo grave no es que algo desaparezca —eso
// se nota— sino que encoja en silencio.
//
// Fallar aquí deja el archivo anterior intacto y manda un correo de fallo. Un
// archivo viejo se delata solo en pantalla (`estaViejo`); uno vacío, no.
if (!cal.eventos.length) {
  console.error('')
  console.error('✗ El feed respondió pero no dejó NI UN evento de nuestras 8 divisas.')
  console.error('  Eso no es una semana tranquila: incluso una semana floja trae varios.')
  console.error('  NO se publica nada, para no machacar el archivo bueno de ayer.')
  console.error('  Mirar si ForexFactory cambió los nombres de los campos.')
  process.exit(1)
}

const porImpacto = {}
for (const ev of cal.eventos) porImpacto[ev.i] = (porImpacto[ev.i] || 0) + 1

const texto = JSON.stringify(cal)
mkdirSync(dirname(DESTINO), { recursive: true })
writeFileSync(DESTINO, texto)

console.log(`  nuestros: ${cal.eventos.length} eventos · ${JSON.stringify(porImpacto)}`)
console.log(`  en las próximas 48 h: ${proximos(cal).length}`)
console.log(`  escrito: ${DESTINO} (${(texto.length / 1024).toFixed(1)} KB)`)

// Los tres primeros al log. No es adorno: si un día el calendario enseña algo
// raro, el log de ese día dice qué se publicó exactamente y a qué hora.
for (const ev of proximos(cal).slice(0, 3)) {
  console.log(`    · ${ev.d}  ${ev.c}  [${ev.i}]  ${ev.t}`)
}
