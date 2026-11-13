// Comprobaciones del Analizador (fase 3, 2026-11-13). Sin red ni navegador.
//
// GEMELO: el mismo archivo en las dos apps. Lo que difiere entre ellas (sus
// medias, su geometría, su pivote) se comprueba a través de `fichaAnalisis` de
// SU `marketCalc.js`, alimentado con un par que trae los campos de las dos.
//
// Uso: node scripts/prueba-analizador.mjs

import { readFileSync } from 'node:fs'
import {
  HERRAMIENTAS,
  HERRAMIENTAS_INICIALES,
  LADOS,
  MAX_NOMBRE,
  MAX_PLANTILLAS,
  METODOS,
  armarAnalisis,
  conPlantilla,
  leerPlantillas,
  nivelesDe,
  normalizarPlantilla,
  notaDeAnalisis,
  pivoteClasico,
  sinPlantilla,
  tamanoPip,
} from '../src/lib/analizador.js'
import { calcularLote } from '../src/lib/calc.js'
import { carryDeSenal } from '../src/lib/carrySenal.js'
import { monedasDe } from '../src/lib/pairs.js'
import { fichaAnalisis, nivelesApp } from '../src/lib/marketCalc.js'
import es from '../src/lib/i18n/textos/es.js'

let fallos = 0
function comprobar(nombre, ok, detalle = '') {
  if (ok) console.log('  ✓ ' + nombre)
  else {
    fallos++
    console.log('  ✗ ' + nombre + (detalle ? ' — ' + detalle : ''))
  }
}
const cerca = (a, b, eps = 1e-9) => Math.abs(a - b) < eps
const leer = (r) => readFileSync(new URL(r, import.meta.url), 'utf8')
// Sin comentarios, para que explicar algo en una nota no cuente como hacerlo.
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

// Un par con los campos de LAS DOS apps: cada `fichaAnalisis` coge los suyos.
const PAR = {
  name: 'EUR/USD',
  b: 'EUR',
  q: 'USD',
  dec: 4,
  c: 1.1,
  atrAbs: 0.006,
  atrPct: 0.55,
  atrPctH: 0.15,
  rsiV: 48.6,
  tend: 'Alcista',
  e20: 1.098,
  e50: 1.095,
  e9: 1.099,
  e21: 1.097,
  lo10: 1.094,
  hi10: 1.104,
  lo20: 1.09,
  hi20: 1.108,
  compresion: 0.95,
  serie20: Array.from({ length: 20 }, (_, i) => 1.09 + i * 0.0005),
  altos20: Array.from({ length: 20 }, (_, i) => 1.093 + i * 0.0005),
  bajos20: Array.from({ length: 20 }, (_, i) => 1.088 + i * 0.0005),
  pivots: { p: 1.1, r1: 1.105, s1: 1.095, r2: 1.11, s2: 1.09 },
  esCruce: false,
  dif: 0.3,
}
const ESC = { EUR: 7.2, USD: 3.1 }

console.log('\n1. El pivote clásico')
{
  const p = pivoteClasico(1.2, 1.1, 1.15)
  comprobar('P = (H + L + C) / 3', cerca(p.p, (1.2 + 1.1 + 1.15) / 3))
  comprobar('R1 = 2P − L y S1 = 2P − H', cerca(p.r1, 2 * p.p - 1.1) && cerca(p.s1, 2 * p.p - 1.2))
  comprobar('R2 = P + (H − L) y S2 = P − (H − L)', cerca(p.r2, p.p + 0.1) && cerca(p.s2, p.p - 0.1))
  comprobar('con un dato que falta devuelve null, nunca ceros', pivoteClasico(1.2, null, 1.1) === null && pivoteClasico(NaN, 1, 1) === null)
  comprobar('una vela con el máximo por debajo del mínimo está rota → null', pivoteClasico(1.0, 1.1, 1.05) === null)
}

console.log('\n2. La ficha de ESTA app')
const ficha = fichaAnalisis(PAR, ESC)
{
  comprobar('lleva precio, ATR, soporte y resistencia', [ficha.precio, ficha.atr, ficha.sop, ficha.res].every(Number.isFinite))
  comprobar('«la de la app» es EXACTAMENTE `nivelesApp` (no una copia)', JSON.stringify(ficha.niveles.app.COMPRA) === JSON.stringify(nivelesApp(PAR, true)) && JSON.stringify(ficha.niveles.app.VENTA) === JSON.stringify(nivelesApp(PAR, false)))
  comprobar('la vara simétrica son 1,5 ATR a cada lado', cerca(ficha.niveles.simetrica.COMPRA.sl, PAR.c - 1.5 * PAR.atrAbs) && cerca(ficha.niveles.simetrica.COMPRA.tp, PAR.c + 1.5 * PAR.atrAbs))
  comprobar('el pivote sale', ficha.pivote && Number.isFinite(ficha.pivote.p))
  comprobar('las medias llevan su nombre', Array.isArray(ficha.emas?.nombres) && ficha.emas.nombres.every((n) => /^EMA\d+$/.test(n)))
  comprobar('la fuerza es la de las dos divisas', ficha.fuerzaB === 7.2 && ficha.fuerzaQ === 3.1)
  comprobar('el RSI va redondeado', ficha.rsi === 49)
  const sinExtremos = fichaAnalisis({ ...PAR, altos20: undefined, bajos20: undefined, pivots: undefined }, ESC)
  comprobar('sin extremos publicados el pivote es null, nunca calculado sobre cierres', sinExtremos.pivote === null)
  comprobar('la ficha pasa por JSON sin perder nada', JSON.stringify(JSON.parse(JSON.stringify(ficha))) === JSON.stringify(ficha))
}

console.log('\n3. Los niveles')
{
  for (const m of METODOS)
    for (const l of LADOS) {
      const n = nivelesDe(ficha, l, m)
      const ok = n && (l === 'COMPRA' ? n.sl < ficha.precio && ficha.precio < n.tp : n.tp < ficha.precio && ficha.precio < n.sl)
      comprobar(`${m} · ${l}: el stop y el objetivo quedan cada uno a su lado del precio`, ok)
    }
  const e = nivelesDe(ficha, 'COMPRA', 'estructura')
  comprobar('estructura de compra: stop medio ATR bajo el soporte, objetivo en la resistencia', cerca(e.sl, ficha.sop - 0.5 * ficha.atr) && cerca(e.tp, ficha.res))
  const enElTecho = { ...ficha, precio: ficha.res }
  comprobar('con el precio en la resistencia, «estructura» NO da una compra (objetivo a cero pips)', nivelesDe(enElTecho, 'COMPRA', 'estructura') === null)
  comprobar('un lado o un método desconocidos → null', nivelesDe(ficha, 'LARGO', 'app') === null && nivelesDe(ficha, 'COMPRA', 'magia') === null)
}

const PERFIL = { capital: 1000, riesgoPct: 1, limiteDiarioPct: 3, maxPerdidasSeguidas: 3 }
const RATES = { USD: 1, EUR: 0.9, GBP: 0.78, JPY: 150, CHF: 0.88, AUD: 1.5, NZD: 1.65, CAD: 1.36 }

console.log('\n4. La tarjeta')
{
  const sinLado = armarAnalisis({ ficha, perfil: PERFIL, ratesUSD: RATES })
  comprobar('sin dirección elegida NO hay niveles: la app no la elige por nadie', sinLado.lado === null && sinLado.niveles === null && sinLado.motivoNiveles === 'sinLado')
  comprobar('…ni lote', sinLado.lote === null && sinLado.motivoLote === 'sinNiveles')

  const a = armarAnalisis({ ficha, lado: 'COMPRA', metodo: 'simetrica', perfil: PERFIL, ratesUSD: RATES })
  const pip = tamanoPip(ficha.dec)
  comprobar('los pips son la distancia en pips (0,0001 aquí)', cerca(a.niveles.pipRiesgo, (1.5 * PAR.atrAbs) / pip, 1e-6))
  comprobar('con la vara simétrica el R/B es 1', cerca(a.niveles.rr, 1, 1e-9))
  const r = calcularLote({ capital: 1000, riesgoPct: 1, pips: a.niveles.pipRiesgo, par: 'EUR/USD', tasas: RATES })
  comprobar('el lote es EXACTAMENTE el de la calculadora', a.lote && cerca(a.lote.lote, r.lote) && cerca(a.lote.riesgoUsd, 10))
  comprobar('en un par con yen el pip es 0,01', tamanoPip(2) === 0.01 && tamanoPip(4) === 0.0001)

  comprobar('sin capital no hay lote, y lo dice con un código', armarAnalisis({ ficha, lado: 'COMPRA', perfil: { capital: null, riesgoPct: 1 }, ratesUSD: RATES }).motivoLote === 'sinPerfil')
  comprobar('basta capital y riesgo: los frenos no hacen falta para el lote', armarAnalisis({ ficha, lado: 'COMPRA', perfil: { capital: 500, riesgoPct: 2 }, ratesUSD: RATES }).lote !== null)
  comprobar('sin tasas no hay lote', armarAnalisis({ ficha, lado: 'COMPRA', perfil: PERFIL, ratesUSD: null }).motivoLote === 'sinTasas')
  comprobar('sin ficha no revienta', armarAnalisis({}).motivo === 'sinFicha')
  comprobar('la tarjeta entera pasa por JSON (es lo que recibirá Qwen en la fase 5)', JSON.stringify(JSON.parse(JSON.stringify(a))) === JSON.stringify(a))
  comprobar('lleva el estado del freno que se le pasa', armarAnalisis({ ficha, lado: 'VENTA', freno: 'freno' }).freno === 'freno')
}

console.log('\n5. Las herramientas')
{
  const solo = armarAnalisis({ ficha, lado: 'COMPRA', herramientas: ['rsi', 'atr'] })
  comprobar('solo salen las encendidas', JSON.stringify(Object.keys(solo.herramientas).sort()) === JSON.stringify(['atr', 'rsi']))
  comprobar('una herramienta inventada se ignora', Object.keys(armarAnalisis({ ficha, herramientas: ['magia'] }).herramientas).length === 0)
  const todas = armarAnalisis({ ficha, lado: 'COMPRA', herramientas: HERRAMIENTAS })
  comprobar('el ATR también va en pips', cerca(todas.herramientas.atr.pips, PAR.atrAbs / 0.0001, 1e-6))

  const ahora = new Date('2026-11-13T12:00:00Z')
  const cal = {
    eventos: [
      { t: 'CPI', c: 'USD', d: '2026-11-13T15:30:00Z', i: 'alto' },
      { t: 'GDP', c: 'JPY', d: '2026-11-13T16:00:00Z', i: 'alto' },
      { t: 'ECB', c: 'EUR', d: '2026-11-12T10:00:00Z', i: 'alto' },
    ],
  }
  const conCal = armarAnalisis({ ficha, herramientas: ['calendario'], calendario: cal, ahora })
  comprobar('el calendario solo trae las dos divisas del par, y solo lo que no ha pasado', conCal.herramientas.calendario.length === 1 && conCal.herramientas.calendario[0].c === 'USD')
  comprobar('sin calendario publicado es null; con calendario y nada de estas dos es []', armarAnalisis({ ficha, herramientas: ['calendario'] }).herramientas.calendario === null && armarAnalisis({ ficha, herramientas: ['calendario'], calendario: { eventos: [] }, ahora }).herramientas.calendario.length === 0)

  const tasas = { EUR: { v: 2.0 }, USD: { v: 4.0 } }
  const sw = armarAnalisis({ ficha, lado: 'COMPRA', herramientas: ['swap'], tasas, monedasDe })
  comprobar('el swap es el de `carryDeSenal`, no una cuenta nueva', sw.herramientas.swap === carryDeSenal({ par: 'EUR/USD', lado: 'COMPRA' }, tasas, monedasDe))
  comprobar('sin dirección no hay swap (depende del lado)', armarAnalisis({ ficha, herramientas: ['swap'], tasas, monedasDe }).herramientas.swap === null)
}

console.log('\n6. Las plantillas')
{
  comprobar('una plantilla sin nombre o sin herramientas no vale', normalizarPlantilla({ nombre: ' ', herramientas: ['rsi'] }) === null && normalizarPlantilla({ nombre: 'x', herramientas: [] }) === null)
  comprobar('las herramientas que no existen se quitan', JSON.stringify(normalizarPlantilla({ nombre: 'x', herramientas: ['rsi', 'magia', 'rsi'] }).herramientas) === '["rsi"]')
  comprobar('un método desconocido cae a «app»', normalizarPlantilla({ nombre: 'x', herramientas: ['rsi'], metodo: 'raro' }).metodo === 'app')
  const muchas = Array.from({ length: 14 }, (_, i) => ({ nombre: 'p' + i, herramientas: ['rsi'] }))
  comprobar(`al leer se quedan como mucho ${MAX_PLANTILLAS}`, leerPlantillas(muchas).length === MAX_PLANTILLAS)
  comprobar('al leer, dos con el mismo nombre (sin distinguir mayúsculas) son una', leerPlantillas([{ nombre: 'A', herramientas: ['rsi'] }, { nombre: 'a', herramientas: ['atr'] }]).length === 1)
  const base = [{ nombre: 'Mañana', herramientas: ['rsi'], metodo: 'app' }]
  const rep = conPlantilla(base, { nombre: 'mañana', herramientas: ['atr'], metodo: 'simetrica' })
  comprobar('guardar con el mismo nombre REEMPLAZA, no duplica', rep.ok && rep.lista.length === 1 && rep.lista[0].metodo === 'simetrica')
  comprobar('guardar una nueva la añade', conPlantilla(base, { nombre: 'Tarde', herramientas: ['atr'] }).lista.length === 2)
  comprobar('la undécima no entra', conPlantilla(muchas.slice(0, 10), { nombre: 'once', herramientas: ['rsi'] }).codigo === 'demasiadas')
  comprobar('los errores son códigos, no frases', conPlantilla(base, { nombre: '' }).codigo === 'sinNombre' && conPlantilla(base, { nombre: 'x'.repeat(MAX_NOMBRE + 1), herramientas: ['rsi'] }).codigo === 'nombreLargo' && conPlantilla(base, { nombre: 'x', herramientas: [] }).codigo === 'sinHerramientas')
  comprobar('borrar quita solo esa', sinPlantilla([...base, { nombre: 'Tarde', herramientas: ['atr'] }], 'MAÑANA').length === 1)

  const reglas = leer('../../firestore.rules')
  const m = reglas.match(/plantillas\.size\(\)\s*<=\s*(\d+)/)
  comprobar('la regla de Firestore deja la MISMA cantidad que la app', m && Number(m[1]) === MAX_PLANTILLAS, m ? m[1] : 'no está')
  const lista = reglas.match(/affectedKeys\(\)\s*\.hasOnly\(\[([^\]]*)\]\)/)
  comprobar('`plantillas` está en la lista blanca de la ficha', Boolean(lista) && /'plantillas'/.test(lista[1]))
}

console.log('\n7. La nota que va al Diario')
{
  const a = armarAnalisis({ ficha, lado: 'VENTA', metodo: 'simetrica', perfil: PERFIL, ratesUSD: RATES })
  const nota = notaDeAnalisis(a)
  comprobar('lleva entrada, SL, TP y R/B con los decimales del par', /^entrada 1\.1000 · SL 1\.1090 · TP 1\.0910 · R\/B 1:1\.0$/.test(nota), nota)
  comprobar('sin niveles no hay nota', notaDeAnalisis(armarAnalisis({ ficha })) === '')
}

console.log('\n8. Los textos')
{
  const an = es.an
  comprobar('existe el bloque `an` y la pestaña', an && typeof es.nav?.analizar === 'string')
  comprobar('cada herramienta tiene su nombre', HERRAMIENTAS.every((h) => typeof an?.h?.[h] === 'string'), HERRAMIENTAS.filter((h) => typeof an?.h?.[h] !== 'string').join(', '))
  comprobar('cada método tiene nombre y descripción', METODOS.every((m) => typeof an?.metodo?.[m] === 'string' && typeof an?.metodoDesc?.[m] === 'string'))
  const motivos = ['sinLado', 'metodoNoSale', 'sinFicha']
  comprobar('cada motivo sin niveles tiene su frase', motivos.every((k) => typeof an?.motivo?.[k] === 'string'))
  comprobar('cada motivo sin lote tiene su frase', ['sinPerfil', 'sinTasas', 'sinNiveles'].every((k) => typeof an?.motivoLote?.[k] === 'string'))
  const codigos = ['guardada', 'sinNombre', 'nombreLargo', 'sinHerramientas', 'demasiadas', 'sinPermiso', 'noSeGuardo', 'sinSesion']
  comprobar('cada código de las plantillas tiene su frase', codigos.every((k) => typeof an?.msg?.[k] === 'string'), codigos.filter((k) => typeof an?.msg?.[k] !== 'string').join(', '))
  comprobar('las tres salidas del swap tienen frase', ['aFavor', 'enContra', 'neutro'].every((k) => typeof an?.swap?.[k] === 'string'))
  comprobar('las herramientas iniciales existen todas', HERRAMIENTAS_INICIALES.every((h) => HERRAMIENTAS.includes(h)))
  comprobar('el aviso dice que la app NO elige la dirección', /NO elige la dirección/.test(an?.aviso ?? ''))
}

console.log('\n9. El cableado')
{
  const app = leer('../src/App.jsx')
  comprobar('App pinta el Analizador en la pestaña «analizar»', /tab === 'analizar'/.test(app) && /<AnalizadorTab/.test(app))
  comprobar('…y le pasa las fichas del hook', /fichas=\{mercado\.fichas\}/.test(app))
  comprobar('el hook devuelve las fichas', /fichas:\s*vista\?\.fichas/.test(leer('../src/lib/useMarketData.js')))
  const mc = sinComentarios(leer('../src/lib/marketCalc.js'))
  comprobar('derivarVista arma las fichas con `fichaAnalisis`', /fichas\s*=\s*paresRaw\.map\(\(p\)\s*=>\s*fichaAnalisis\(p, esc\)\)/.test(mc))
  comprobar('las señales y el Analizador usan la MISMA `nivelesApp`', /nivelesApp\(p, compra\)/.test(mc.slice(mc.indexOf('const mkSetup'))))
  const nav = leer('../src/components/BottomNav.jsx')
  comprobar('la barra de abajo tiene la pestaña', /tab: 'analizar'/.test(nav) && /nav\.analizar/.test(nav))
  const tab = sinComentarios(leer('../src/components/AnalizadorTab.jsx'))
  comprobar('la pantalla arranca SIN dirección elegida', /useState\(null\)\s*\n\s*const \[metodo/.test(tab) || /\[lado, setLado\] = useState\(null\)/.test(tab))
  comprobar('la pantalla usa `armarAnalisis` (no hace sus propias cuentas)', /armarAnalisis\(/.test(tab) && !/atrAbs|lo10|hi10/.test(tab))
  comprobar('la pantalla lee el freno del guardián', /estadoDelDia\(/.test(tab))
  const diario = leer('../src/components/DiarioTab.jsx')
  comprobar('el Diario acepta el lote que llega del Analizador', /prellenar\.lote/.test(diario))
}

console.log(fallos ? `\n✗ ${fallos} comprobación(es) fallaron\n` : '\n✓ todo bien\n')
process.exit(fallos ? 1 : 0)
