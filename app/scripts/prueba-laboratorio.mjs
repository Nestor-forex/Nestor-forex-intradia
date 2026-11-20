// Comprobaciones del laboratorio «prueba tu propia regla» (2026-11-18), sin
// internet.
//
//   node scripts/prueba-laboratorio.mjs
//
// GEMELO: mira la lógica pura (`src/lib/laboratorio.js`), las reglas de
// Firestore, el hook de las reglas y la pantalla, que son iguales en las dos
// apps. Lo que publica la historia de cada app tiene su propia prueba
// (`prueba-historia-publicada.mjs`).

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  MAX_CONDICIONES,
  MAX_SEGUIDAS,
  PRECIO_SEGUIMIENTO_USD,
  aciertoDeEquilibrio,
  avanzarAdelante,
  claveVela,
  condicionValida,
  contarPrueba,
  fichaParaGuardar,
  probarEnPar,
  probarRegla,
  reglaValida,
  resumenAdelante,
  serieAtr,
  serieEma,
  seriePercentB,
  serieRsi,
  serieSma,
} from '../src/lib/laboratorio.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (r) => readFileSync(join(RAIZ, r), 'utf8')

let fallos = 0
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`)
  if (!cond) fallos++
}

console.log('\n1 · Indicadores')
{
  const sube = Array.from({ length: 40 }, (_, i) => 1 + i * 0.01)
  ok(serieRsi(sube).at(-1) === 100, 'RSI de una serie que solo sube = 100')
  ok(serieRsi(sube)[13] === null && serieRsi(sube)[14] !== null, 'RSI vacío antes de 14 cambios, lleno después')
  ok(Math.abs(serieSma([1, 2, 3, 4], 2)[3] - 3.5) < 1e-12 && serieSma([1, 2, 3, 4], 2)[0] === null, 'SMA de 2 velas')
  const ema = serieEma(sube, 10)
  ok(ema[28] === null && ema[29] !== null, 'la EMA no se da por buena hasta 3 veces su periodo')
  const pb = seriePercentB([...Array(19).fill(1), 1, 1, 1, 1, 2])
  ok(pb.at(-1) > 1, '%B mayor que 1 cuando el precio sale por arriba de la banda')
  ok(serieAtr([2, 2, 2], [1, 1, 1], [1.5, 1.5, 1.5], 2)[2] === 1, 'ATR de velas de rango 1 = 1')
}

console.log('\n2 · La regla se valida, y la app NO elige el lado')
{
  const base = { lado: 'COMPRA', condiciones: [{ tipo: 'rsi', op: '<=', valor: 30 }], riesgoATR: 1.5, objetivoRB: 1 }
  ok(!reglaValida(base).error, 'una regla completa es válida')
  ok(reglaValida({ ...base, lado: null }).error === 'sinLado', 'sin lado → sinLado')
  ok(reglaValida({ ...base, condiciones: [] }).error === 'sinCondiciones', 'sin condiciones → sinCondiciones')
  ok(reglaValida({ ...base, condiciones: Array(MAX_CONDICIONES + 1).fill(base.condiciones[0]) }).error === 'demasiadas', 'más de las permitidas → demasiadas')
  ok(reglaValida({ ...base, riesgoATR: 7 }).error === 'geometria', 'un Stop-loss fuera de las opciones → geometria')
  ok(condicionValida({ tipo: 'rsi', op: '<=', valor: 300 }) === null, 'un RSI fuera de rango se rechaza')
  ok(condicionValida({ tipo: 'rsi', op: '<=', valor: '' }) === null, 'una casilla vacía se rechaza (no vale 0)')
  ok(condicionValida({ tipo: 'loQueVenga' }) === null, 'un tipo desconocido se rechaza')
  ok(condicionValida({ tipo: 'extremo', extremo: 'minimo', n: 2.5 }) === null, 'el número de velas tiene que ser entero')
}

// Una serie a mano: plana, y en la vela 40 el mínimo rompe los 10 anteriores.
function serie({ n = 80, salto = 'tp' } = {}) {
  const c = []
  const h = []
  const l = []
  for (let i = 0; i < n; i++) {
    c.push(1.1)
    h.push(1.101)
    l.push(1.099)
  }
  l[40] = 1.09 // rompe el mínimo: la condición se cumple aquí
  const atr = serieAtr(h, l, c)[40]
  const riesgo = 1.5 * atr
  if (salto === 'tp') h[42] = 1.1 + riesgo * 1.01
  if (salto === 'sl') l[42] = 1.1 - riesgo * 1.01
  if (salto === 'ambos') {
    h[42] = 1.1 + riesgo * 1.01
    l[42] = 1.1 - riesgo * 1.01
  }
  return { c, h, l }
}
const fechas = Array.from({ length: 80 }, (_, i) => `2026-01-${String((i % 28) + 1).padStart(2, '0')}x${i}`)
const REGLA = reglaValida({ lado: 'COMPRA', condiciones: [{ tipo: 'extremo', extremo: 'minimo', n: 10 }], riesgoATR: 1.5, objetivoRB: 1 })

console.log('\n3 · Resolver como el Historial de la app')
{
  const g = probarEnPar(REGLA, 'EUR/USD', serie({ salto: 'tp' }), fechas, 0)
  ok(g.length === 1 && g[0].estado === 'ganada' && g[0].r === 1, 'toca el Take-profit → ganada, +1 R')
  ok(g[0].entradaEl === fechas[40], 'la entrada es la vela de la señal')
  const p = probarEnPar(REGLA, 'EUR/USD', serie({ salto: 'sl' }), fechas, 0)
  ok(p[0]?.estado === 'perdida' && p[0].r === -1, 'toca el Stop-loss → perdida, −1 R')
  const a = probarEnPar(REGLA, 'EUR/USD', serie({ salto: 'ambos' }), fechas, 0)
  ok(a[0]?.estado === 'perdida', 'una vela que toca los dos → PERDIDA (el peor caso)')
  const s = probarEnPar(REGLA, 'EUR/USD', serie({ salto: 'tp' }), fechas, 2)
  ok(s[0].r < 1 && s[0].r > 0, 'el spread se descuenta en R')
  const abierta = probarEnPar(REGLA, 'EUR/USD', serie({ salto: 'nada' }), fechas, 0)
  ok(abierta.length === 1 && abierta[0].estado === 'abierta' && abierta[0].r === null, 'sin tocar nada queda abierta, sin resultado (no 0)')
}

console.log('\n4 · Una operación por par a la vez')
{
  // Una condición que se cumple en TODAS las velas: sin el freno saldría una
  // operación por vela.
  const plano = { c: Array(80).fill(1.1), h: Array(80).fill(1.101), l: Array(80).fill(1.099) }
  const s = plano // nunca toca el Stop-loss ni el Take-profit
  const siempre = reglaValida({ lado: 'COMPRA', condiciones: [{ tipo: 'rsi', op: '>=', valor: 5 }], riesgoATR: 1.5, objetivoRB: 1 })
  const ops = probarEnPar(siempre, 'EUR/USD', s, fechas, 0)
  ok(ops.length === 1, `con la operación abierta no se abre otra (${ops.length})`)
}

console.log('\n5 · El resumen no inventa nada')
{
  const r = probarRegla({ lado: 'COMPRA', condiciones: [{ tipo: 'extremo', extremo: 'minimo', n: 10 }], riesgoATR: 1.5, objetivoRB: 1 }, { fechas, pares: { 'EUR/USD': serie({ salto: 'tp' }) } }, () => 0)
  ok(r.ops === 1 && r.acierto === 100 && r.margen === 98, 'una sola operación: 100 % con un margen de ±98')
  ok(Array.isArray(r.mitades) && r.mitades.length === 2, 'trae las dos mitades del periodo')
  const vacia = probarRegla({ lado: 'COMPRA', condiciones: [{ tipo: 'rsi', op: '<=', valor: 5 }], riesgoATR: 1.5, objetivoRB: 1 }, { fechas, pares: { 'EUR/USD': serie({ salto: 'nada' }) } })
  ok(vacia.ops === 0 && vacia.acierto === null && vacia.porR === null, 'sin operaciones: acierto y resultado null, nunca 0')
  ok(probarRegla(REGLA, null).error === 'sinHistoria', 'sin historia → sinHistoria, no una lista vacía')
  ok(aciertoDeEquilibrio(1) === 50 && aciertoDeEquilibrio(2) === 33, 'el acierto de equilibrio: 50 % a 1:1, 33 % a 1:2')
  ok(contarPrueba(4) === 5 && contarPrueba(undefined) === 1 && contarPrueba(-3) === 1, 'el contador de pruebas')
}

console.log('\n6 · No da veredictos')
{
  const src = leer('src/lib/laboratorio.js').replace(/^\s*\/\/.*$/gm, '')
  for (const p of [/recomend/i, /\bbuena\b/i, /\bmala\b/i, /\búsala\b/i, /veredicto\s*:/i]) ok(!p.test(src), `el código no dice ${p}`)
}

console.log('\n7 · Lo que se guarda cuadra con las reglas de Firestore')
{
  const reglas = leer('../firestore.rules')
  const bloque = reglas.slice(reglas.indexOf('match /reglas/{reglaId}'))
  const lista = (re) => (bloque.match(re)?.[1] ?? '').split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean)
  const obligatorias = lista(/hasAll\(\[([^\]]*)\]\)/)
  const permitidas = lista(/hasOnly\(\[([^\]]*)\]\)/)
  const f = fichaParaGuardar(
    { lado: 'VENTA', condiciones: [{ tipo: 'rsi', op: '>=', valor: 70 }], riesgoATR: 1, objetivoRB: 2 },
    '  Mi regla  ',
    { ops: 10, acierto: 40, porR: 0.12345, desde: 'a', hasta: 'b' },
    7,
    'swing'
  )
  const campos = [...Object.keys(f), 'creado']
  ok(obligatorias.length > 5 && permitidas.length > obligatorias.length, `las listas de las reglas se leyeron (${obligatorias.length} y ${permitidas.length})`)
  ok(campos.every((k) => permitidas.includes(k)), `todo lo que guarda la app está permitido (${campos.filter((k) => !permitidas.includes(k)).join(', ') || 'nada fuera'})`)
  ok(obligatorias.every((k) => campos.includes(k)), 'la app guarda todo lo obligatorio')
  ok(permitidas.includes('copiaDe'), 'la copia del administrador está permitida')
  ok(f.nombre === 'Mi regla' && f.resultado.porR === 0.123, 'el nombre se limpia y el resultado se redondea')
  ok(fichaParaGuardar({ lado: 'VENTA', condiciones: [{ tipo: 'rsi', op: '>=', valor: 70 }], riesgoATR: 1, objetivoRB: 2 }, '  ', null, 1, 'swing').error === 'sinNombre', 'sin nombre no se guarda')
  ok(/match \/\{ruta=\*\*\}\/reglas\/\{reglaId\}\s*\{\s*allow read: if esAdmin\(\);/.test(reglas), 'el administrador lee todas (grupo de colección), y solo lee')
  ok(f.permiteCopia === false, 'sin marcar la casilla NO hay permiso de copia (nunca se supone que sí)')
  ok(permitidas.includes('permiteCopia'), 'el permiso de copia está permitido al guardar')
  const conPermiso = fichaParaGuardar({ lado: 'VENTA', condiciones: [{ tipo: 'rsi', op: '>=', valor: 70 }], riesgoATR: 1, objetivoRB: 2 }, 'x', null, 1, 'swing', true)
  ok(conPermiso.permiteCopia === true, 'marcando la casilla queda el permiso')
  ok(fichaParaGuardar({ lado: 'VENTA', condiciones: [{ tipo: 'rsi', op: '>=', valor: 70 }], riesgoATR: 1, objetivoRB: 2 }, 'x', null, 1, 'swing', 'sí').permiteCopia === false, 'un valor raro no cuenta como permiso')
  // La regla en sí no se edita: el dueño solo enciende/apaga el seguimiento,
  // y el administrador solo escribe el informe.
  const updates = [...bloque.slice(0, bloque.indexOf('\n    }\n')).matchAll(/allow update:[\s\S]*?;/g)].map((m) => m[0])
  ok(updates.length === 2, `hay dos permisos de cambio, y solo dos (${updates.length})`)
  ok(updates.some((u) => /esPropio\(uid\)/.test(u) && /hasOnly\(\['seguir', 'seguirDesde'\]\)/.test(u) && /seguimientoActivo/.test(u)), 'el dueño solo cambia el seguimiento, y solo con el servicio activo')
  ok(updates.some((u) => /esAdmin\(\)/.test(u) && /hasOnly\(\['informe'\]\)/.test(u)), 'el administrador solo escribe el informe')
  ok(updates.every((u) => /request\.time/.test(u)), 'las fechas las pone el servidor')
  const ficha = reglas.slice(reglas.indexOf('match /users/{uid}'), reglas.indexOf('match /trades/'))
  ok(/'seguimientoSolicitado'/.test(ficha) && /seguimientoSolicitado == request\.time/.test(ficha), 'la persona puede pedir el servicio (con la hora del servidor)')
  ok(!/hasOnly\(\[[^\]]*'seguimientoActivo'/.test(ficha), 'activar el servicio NO lo puede hacer la persona: solo el administrador')
}

console.log('\n8 · La pantalla')
{
  const lab = leer('src/components/Laboratorio.jsx')
  const i = (s) => lab.indexOf(s)
  ok(i("t('lab.aviso')") > 0 && i("t('lab.aviso')") < i("t('lab.paso1')"), 'el aviso va ANTES de cualquier control')
  ok(i("t('lab.quienVe')") > 0 && i("t('lab.quienVe')") < i("t('lab.guardar')}"), 'se dice quién puede ver las reglas ANTES del botón de guardar')
  ok(/lab\.contador/.test(lab), 'el contador de pruebas se enseña')
  ok(/aciertoDeEquilibrio/.test(lab), 'el acierto de equilibrio va al lado del acierto')
  ok(/useReglasTodas\(esAdmin/.test(lab), 'las reglas de los miembros se piden solo si es el administrador')
  ok(/import \{ spreadDe \} from '\.\.\/\.\.\/scripts\/lib\/costes\.mjs'/.test(lab), 'el spread sale de la MISMA tabla del banco de pruebas (no una copia)')
  ok(/<Laboratorio\b/.test(leer('src/components/AnalizadorTab.jsx')), 'está enchufado en el Analizador')
  ok(i("t('lab.beneficioTitulo')") > 0 && i("t('lab.beneficioTitulo')") < i("t('lab.paso1')"), 'el beneficio de compartir la idea va destacado arriba')
  ok(i("t('lab.permiso')") > 0 && i("t('lab.permiso')") < i("t('lab.guardar')}"), 'la casilla de permiso va ANTES del botón de guardar')
  ok(/useState\(false\)/.test(lab.slice(lab.indexOf('[permiteCopia'), lab.indexOf('[permiteCopia') + 80)), 'la casilla de permiso arranca SIN marcar')
  ok(/fichaParaGuardar\([^)]*permiteCopia\)/.test(lab), 'el permiso viaja con la regla')
  for (const k of ['adelanteQue', 'adelantePara', 'adelantePros', 'adelanteNo']) {
    ok(i(`t('lab.${k}')`) > 0 && i(`t('lab.${k}')`) < i("t('lab.adelanteSolicitar')"), `«${k}» se explica ANTES del botón de pedir la activación`)
  }
  ok(/PRECIO_SEGUIMIENTO_USD/.test(lab) && !/\b3 USD\b/.test(lab), 'el precio se LEE de una constante, no va escrito a mano')
  ok(/r\.permiteCopia === true && \(/.test(lab), 'el administrador solo puede copiar si el autor dio permiso')
  ok(/servicioActivo && \(r\.seguir \|\| seguidas < MAX_SEGUIDAS\)/.test(lab), 'el botón de seguir solo sale con el servicio activo y sin pasar el límite')
  const hook = leer('src/lib/useHistoria.js')
  ok(/swing:\s*'https:\/\/raw\.githubusercontent\.com\/Nestor-forex\/Nestor-forex\/datos\/estado\/historia\.json'/.test(hook), 'Swing lee su historia')
  ok(/intradia:\s*'https:\/\/raw\.githubusercontent\.com\/Nestor-forex\/Nestor-forex-intradia\/datos\/estado\/historia\.json'/.test(hook), 'Intradía lee la suya')
}

console.log('\n10 · El seguimiento hacia adelante')
{
  ok(MAX_SEGUIDAS === 5 && PRECIO_SEGUIMIENTO_USD === 3, 'hasta 5 reglas seguidas por app, 3 USD al mes')
  ok(claveVela('2026-11-19T15:20:37.105Z', ['2026-11-18']) === '2026-11-19', 'con velas diarias, el día')
  ok(claveVela('2026-11-19T15:20:37.105Z', ['2026-11-18 21:00:00']) === '2026-11-19 15:00:00', 'con velas de una hora, la hora')
  ok(claveVela(null, ['2026-11-18']) === null && claveVela('basura', ['2026-11-18']) === null, 'una fecha que no se entiende es null')
  // La señal está en la vela 40. Si el seguimiento empezó DESPUÉS, no cuenta.
  const h = { fechas, pares: { 'EUR/USD': serie({ salto: 'tp' }) } }
  const antes = avanzarAdelante(REGLA, h, () => 0, null, fechas[39])
  ok(antes.ops.length === 1 && antes.ops[0].e === fechas[40] && antes.ops[0].r === 1, 'una operación que empieza después de activar sí cuenta')
  const despues = avanzarAdelante(REGLA, h, () => 0, null, fechas[40])
  ok(despues.ops.length === 0, 'una operación que empezó ANTES (o en la vela de activar) no cuenta')
  const otraVez = avanzarAdelante(REGLA, h, () => 0, antes, fechas[39])
  ok(otraVez.ops.length === 1, 'pasar dos veces no duplica la operación')
  const reinicio = avanzarAdelante(REGLA, h, () => 0, { desde: 'otro', ops: [{ p: 'EUR/USD', e: 'x', s: 'y', r: -1 }] }, fechas[39])
  ok(reinicio.ops.length === 1 && reinicio.ops[0].r === 1, 'si se volvió a encender (otro inicio), empieza de cero')
  // Lo guardado no se pierde aunque la historia de hoy ya no lo traiga.
  const viejo = { desde: fechas[39], ops: [{ p: 'GBP/USD', e: 'a', s: 'b', r: -1 }] }
  const sigue = avanzarAdelante(REGLA, h, () => 0, viejo, fechas[39])
  ok(sigue.ops.some((o) => o.p === 'GBP/USD'), 'una operación guardada se queda aunque ya no esté en las velas de hoy')
  const abierta = avanzarAdelante(REGLA, { fechas, pares: { 'EUR/USD': serie({ salto: 'nada' }) } }, () => 0, null, fechas[39])
  ok(abierta.ops.length === 0 && abierta.abiertas === 1, 'una abierta no se guarda como cerrada: se cuenta aparte')
  ok(avanzarAdelante(REGLA, null, () => 0, null, 'x').error === 'sinHistoria', 'sin historia no inventa nada')
  const r = resumenAdelante([{ r: 1 }, { r: -1 }, { r: 1 }])
  ok(r.ops === 3 && r.acierto === 67 && r.margen > 0, 'el resumen trae el acierto con su margen')
  ok(resumenAdelante([]).acierto === null && resumenAdelante(undefined).ops === 0, 'sin operaciones: null, nunca 0 %')
}

console.log('\n9 · Los textos existen en los 13 idiomas')
{
  const usadas = [...leer('src/components/Laboratorio.jsx').matchAll(/t\(\s*'(lab\.[\w.]+)'/g)].map((m) => m[1])
  ok(usadas.length > 20, `la pantalla usa ${usadas.length} textos`)
  for (const c of ['es', 'en', 'pt', 'it', 'fr', 'de', 'ru', 'tr', 'zh', 'ja', 'ko', 'hi', 'ar']) {
    const { default: d } = await import(`../src/lib/i18n/textos/${c}.js`)
    const faltan = usadas.filter((k) => k.split('.').reduce((o, p) => o?.[p], d) === undefined)
    ok(!faltan.length, `${c}: ${faltan.length ? 'faltan ' + faltan.join(', ') : 'están todos'}`)
  }
}

console.log('\n10 · El seguimiento hacia adelante se ve sin buscarlo')
{
  // Néstor (2026-11-20): «no veo lo de la regla hacia adelante… ese botón
  // debería estar en el mismo espacio donde está "prueba tu propia regla"».
  // Estaba al FINAL de la tarjeta, detrás del constructor y de «Mis reglas».
  const jsx = leer('src/components/Laboratorio.jsx')
  const boton = jsx.indexOf("t('lab.adelanteSolicitar')")
  const paso1 = jsx.indexOf("t('lab.paso1')")
  ok(boton > 0 && paso1 > 0 && boton < paso1, 'el botón «Solicitar activación» va ANTES del constructor de reglas')
  ok(/avance=\{.*t\('lab\.avance'/.test(jsx), 'la tarjeta cerrada ya dice que existe el servicio (avance)')
  ok(jsx.includes("t('lab.avance', { precio: PRECIO_SEGUIMIENTO_USD })"), 'el precio del aviso se LEE, no se escribe')
}

console.log(fallos ? `\n✗ ${fallos} comprobaciones fallaron` : '\n✓ todo bien')
process.exit(fallos ? 1 : 0)
