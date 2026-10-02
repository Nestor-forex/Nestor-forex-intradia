// PASO 2: ¿se derrumba de verdad el ATR al abrir la semana?
//
//     node scripts/medir-rejilla.mjs
//
// Se lanza a mano desde Actions → «Diagnóstico de la rejilla (ATR por semana)».
//
// ─────────────────────────────────────────────────────────────────────────
// QUÉ CONTESTA, Y POR QUÉ ES EL PASO BARATO
// ─────────────────────────────────────────────────────────────────────────
// La sonda del 2026-09-30 midió que el 28,7 % de las velas del barrido caen en
// horas sin mercado y que son 5,2× más estrechas. De ahí salió una INFERENCIA:
// como el ATR es Wilder de 14 con ventana de 60 velas y un fin de semana son
// ~45 velas cerradas seguidas, al abrir la semana el ATR estaría calculado
// casi entero sobre horas finas — y el stop es 1,5 × ATR.
//
// Esto lo MIDE, con una sola descarga. Si el derrumbe no aparece, la inferencia
// era falsa (la novena de este proyecto) y se ahorran los 28 créditos de la
// medición completa.
//
// ⚠️⚠️ NO CAMBIA NADA. Lee velas, calcula y escribe en el log. No toca un
// archivo de la app, ni una señal, ni la rama `datos`, ni el historial. El
// workflow va con `permissions: contents: read`.
//
// ⚠️ Y lo que significa CADA resultado posible está escrito en
// `lib/preregistro-rejilla.mjs` con fecha 2026-09-30, **antes** de estos
// números. Sin eso, cualquier número se lee como una confirmación de algo.
//
// ─────────────────────────────────────────────────────────────────────────
// CUESTA 7 CRÉDITOS DE LOS 800
// ─────────────────────────────────────────────────────────────────────────
// Una tanda de los 7 símbolos, con `outputsize` al tope. El gasto fijo de esta
// app es 511 al día, así que cabe de sobra y se lanza a mano una vez.
//
// ⚠️ Se piden 5000 velas y no 300: con 300 el tramo son 12,5 días y caben DOS
// arranques de semana. Con 5000 son ~208 días y caben ~30, que es lo que hace
// falta para que una mediana signifique algo.

import {
  DERRUMBE_MINIMO,
  FECHA_PREREGISTRO,
  LO_QUE_MIDIO_LA_SONDA,
  QUE_DICE_EL_DIAGNOSTICO,
  DONDE_SE_COMPRUEBA_EL_MECANISMO,
} from './lib/preregistro-rejilla.mjs'
import {
  CAMBIO_MINIMO_ATR,
  MAYORIA_DIVISAS,
  PROPORCION_MINIMA_AFECTADA,
  TECHO_ESTRUCTURAL_MEDIDO,
  MECANISMO_CANDIDATO,
  QUE_DICE_LA_PREGUNTA_DE_SWING,
} from './lib/preregistro-rejilla.mjs'
import {
  VENTANA_ATR,
  compararRejillas,
  cuantoSubeElATR,
  huecoDeApertura,
  veredictoDiagnostico,
  veredictoPreguntaDeSwing,
} from './lib/rejilla-atr.mjs'
import { SYMBOLS, leerLlave, obtenerVelas } from './lib/velas.mjs'

const VELAS = 5000

console.log('DIAGNÓSTICO DE LA REJILLA — ¿se derrumba el ATR al abrir la semana?')
console.log(`  preregistro del ${FECHA_PREREGISTRO}, escrito ANTES de estos números`)
console.log(`  la sonda midió: ${(100 * LO_QUE_MIDIO_LA_SONDA.proporcionCerradas).toFixed(1)} % de velas en horas cerradas,`)
console.log(`  y ${LO_QUE_MIDIO_LA_SONDA.vecesMasEstrechas.toFixed(1)}× más estrechas que las de mercado`)
console.log(`  el ATR de la app: Wilder de 14 con ventana de ${VENTANA_ATR} velas`)
console.log('  cuesta 7 créditos. NO escribe nada.')
console.log('')

const llave = leerLlave()

console.log(`Bajando ${VELAS} velas de una hora de los ${SYMBOLS.length} símbolos…`)
const { barras, rates, rangos } = await obtenerVelas(llave, { velas: VELAS, intervalo: '1h', minBarras: 100 })
console.log(`  ${barras.length} horas con dato en los siete`)
console.log(`  de ${barras[0]} a ${barras[barras.length - 1]}`)
console.log('')

// ⚠️ SE MIDE SOBRE LAS DIVISAS DIRECTAS, no sobre los cruces derivados, y es a
// propósito: `computarBarrido` calcula el ATR de los 7 pares directos sobre
// exactamente estas series. Así el número del diagnóstico ES el ATR de la app
// para esos pares, sin re-derivar nada. Si se derivaran los cruces aquí se
// mediría una cosa parecida pero distinta, que es justo lo que este proyecto
// lleva meses cazando.
const DIVISAS = ['EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD']

const filas = []
for (const ccy of DIVISAS) {
  const closes = barras.map((t) => rates[t]?.[ccy])
  const highs = barras.map((t) => rangos[t]?.[ccy]?.h)
  const lows = barras.map((t) => rangos[t]?.[ccy]?.l)
  const c = compararRejillas(barras, highs, lows, closes)
  if (!c) {
    console.log(`  ⚠️ ${ccy}: no se pudo comparar (faltan velas)`)
    continue
  }
  // ⚠️ LA PREGUNTA DE SWING, que a esta app nunca se le hizo: no «¿se hunde el
  // ATR al abrir la semana?» (eso es lo de arriba) sino «¿cuánto SUBE al quitar
  // las horas cerradas?». Son preguntas distintas y el `noSeMueve` del
  // 2026-09-30 solo contesta la primera.
  const sw = cuantoSubeElATR(barras, highs, lows, closes, { umbral: CAMBIO_MINIMO_ATR })
  const hueco = huecoDeApertura(barras, highs, lows, closes)
  filas.push({ ccy, ...c, sw, hueco })
}

if (!filas.length) {
  console.error('')
  console.error('✗ No se pudo comparar ninguna divisa. Eso NO dice que no haya derrumbe:')
  console.error('  dice que no se pudo mirar. Son cosas distintas.')
  process.exit(1)
}

// ── La tabla ─────────────────────────────────────────────────────────────
const f = (x, d = 6) => (x == null ? '—' : x.toFixed(d))
const v = (x) => (x == null ? '—' : x.toFixed(2) + '×')

console.log('── El ATR al abrir la semana contra el de media semana ──────')
console.log('')
console.log('             ATR arranque   ATR medio sem.   derrumbe   al limpiar   sube')
for (const r of filas) {
  console.log(
    `  ${r.ccy.padEnd(5)} ${f(r.arranqueHoy).padStart(12)} ${f(r.medioHoy).padStart(16)} ` +
      `${v(r.derrumbeHoy).padStart(10)} ${v(r.derrumbeLimpia).padStart(12)} ${v(r.subeEnArranque).padStart(7)}`,
  )
}
console.log('')
console.log(`  velas: ${filas[0].n} en total · ${filas[0].velasQuitadas} quitadas al limpiar`)
console.log(`  arranques de semana mirados: ${filas[0].arranques} · velas de media semana: ${filas[0].medios}`)
console.log('')
console.log('  «derrumbe» = cuántas veces más ancho es el ATR de media semana que el del arranque,')
console.log('               con la rejilla de HOY. Si es 1, no hay derrumbe.')
console.log('  «al limpiar» = lo mismo con las horas cerradas quitadas. Si el arreglo funciona, → 1.')
console.log('  «sube» = cuántas veces sube el ATR del ARRANQUE al limpiar la rejilla.')
console.log('')

// ── El mecanismo, medido donde el preregistro dijo que se mediría ────────
console.log('── El ATR medio GLOBAL, que NO sirve para esto ──────────────')
for (const r of filas) {
  console.log(`  ${r.ccy.padEnd(5)} hoy ${f(r.atrMedioHoy)} · limpia ${f(r.atrMedioLimpia)}`)
}
console.log('')
console.log(`  ⚠️ ${DONDE_SE_COMPRUEBA_EL_MECANISMO}`)
console.log('')

// ─────────────────────────────────────────────────────────────────────────
// LA PREGUNTA DE SWING: ¿cuánto SUBE el ATR al quitar las horas cerradas?
// ─────────────────────────────────────────────────────────────────────────
console.log('════════════════════════════════════════════════════════════')
console.log('  LA PREGUNTA DE SWING, que a esta app nunca se le había hecho')
console.log('════════════════════════════════════════════════════════════')
console.log('  Lo de arriba contesta «¿se HUNDE el ATR al abrir la semana?» — una pregunta')
console.log('  de POSICIÓN. Esto contesta la de Swing: «¿cuánto SUBE al quitar las horas')
console.log('  cerradas?» — una pregunta de NIVEL. En Swing salió +18,5 % de mediana.')
console.log('')
console.log('  ⚠️ El umbral aquí es 7 % y allá 2 %, y NO es un descuido: el stop de esta')
console.log('     app es ~30 pips contra los ~155 de Swing, así que los mismos 2 pips de')
console.log('     spread pesan el 6,7 % en vez del 1,3 %. Copiar el 2 % habría sido')
console.log('     traerse una suposición que aquí es falsa.')
console.log('')
console.log('        % de velas   mediana del   p10 … p90    cociente de   al FINAL')
console.log('        AFECTADAS    cociente                   medianas')
for (const r of filas) {
  const w = r.sw
  const pc = w?.proporcionAfectada == null ? '    —' : (100 * w.proporcionAfectada).toFixed(1) + ' %'
  console.log(
    `  ${r.ccy.padEnd(5)} ${pc.padStart(11)}   ${v(w?.medianaDelCociente).padStart(11)}   ` +
      `${v(w?.p10)} … ${v(w?.p90)}   ${v(w?.cocienteDeMedianas).padStart(11)}   ${v(w?.alFinal).padStart(8)}`,
  )
}
console.log('')
console.log('        stop final hoy → limpia   (el stop de esta app ES 1,5 × ATR)')
for (const r of filas) {
  console.log(`  ${r.ccy.padEnd(5)} ${f(r.sw?.stopFinalHoy, 5)} → ${f(r.sw?.stopFinalLimpia, 5)}`)
}
console.log('')
console.log(`  velas comparadas: ${filas[0].sw?.velas ?? '—'} · quitadas al limpiar: ${filas[0].sw?.velasQuitadas ?? '—'}`)
console.log('')
console.log('  ⚠️⚠️ DECIDE LA PRIMERA COLUMNA, NO LA MEDIANA. Y eso no es un gusto: la')
console.log('     mediana se escribió primero como «la que decide» y el mercado sintético —')
console.log('     escrito para TENER el efecto— la desmintió, dando 1,000 EXACTO mientras el')
console.log('     23,9 % de las velas subía más del 7 %.')
console.log('')
console.log('     El motivo es aritmética de esta app: `atrWilder` tiene una ventana DURA de')
console.log(`     60 velas, así que solo cambian las que tienen horas cerradas dentro de su`)
console.log(`     ventana — el ${(100 * TECHO_ESTRUCTURAL_MEDIDO).toFixed(1)} % como techo estructural. Más de la mitad de las velas`)
console.log('     de mercado NO PUEDE cambiar, y una mediana sobre todas se queda clavada.')
console.log('')
console.log('     📌 Y ésa es la diferencia de fondo con Swing: allá `atrWilder` recorre la')
console.log('        serie ENTERA, así que quitar velas cambia TODOS los valores y una')
console.log('        mediana los ve. Aquí el efecto es LOCAL. El mismo estadístico no')
console.log('        significa lo mismo en las dos apps.')
console.log('')
console.log('  «% de velas AFECTADAS» = en qué fracción de las horas de mercado el ATR cambia')
console.log(`     más del ${(100 * CAMBIO_MINIMO_ATR).toFixed(0)} %. La app puede dar señal en cualquiera de esas horas y en cada`)
console.log('     una pone el stop con el ATR de esa hora: es lo que importa.')
console.log('  «al FINAL» = en la última vela. Es el equivalente exacto de lo que midió Swing.')
console.log('')
console.log('  📌 Y lo que YA se sabe de la otra mitad de esta pregunta, de la corrida del')
console.log('     2026-09-30: en el ARRANQUE de semana el ATR sube +9 % (GBP), +11 % (CHF),')
console.log('     +8 % (AUD) y +14 % (NZD), y BAJA en EUR, JPY y CAD. O sea 4 de 7 por encima')
console.log('     del umbral: sin mayoría. Esa columna es `sube` de la tabla de arriba.')
console.log('')

const vs = filas.map((r) => ({ ccy: r.ccy, v: veredictoPreguntaDeSwing(r.sw, { proporcionMinima: PROPORCION_MINIMA_AFECTADA }) }))
const cuentaSw = {}
for (const { v: k } of vs) cuentaSw[k ?? 'noSePudoMirar'] = (cuentaSw[k ?? 'noSePudoMirar'] ?? 0) + 1
for (const { ccy, v: k } of vs) console.log(`  ${ccy.padEnd(5)} ${k ?? 'noSePudoMirar'}`)
console.log('')
const mayoriaSw = Math.ceil(filas.length * MAYORIA_DIVISAS)
const conjuntoSw =
  (cuentaSw.sube ?? 0) >= mayoriaSw ? 'sube' : (cuentaSw.noSube ?? 0) >= mayoriaSw ? 'noSube' : 'mezclado'
console.log(
  `  umbrales del preregistro: ${(100 * CAMBIO_MINIMO_ATR).toFixed(0)} % de cambio en el ATR, en al menos el ` +
    `${(100 * PROPORCION_MINIMA_AFECTADA).toFixed(0)} % de las velas · mayoría exigida: ${mayoriaSw} de ${filas.length}`,
)
console.log('')
console.log(`  ►► ${conjuntoSw.toUpperCase()}`)
if (QUE_DICE_LA_PREGUNTA_DE_SWING[conjuntoSw]) {
  for (const linea of QUE_DICE_LA_PREGUNTA_DE_SWING[conjuntoSw].match(/.{1,74}(\s|$)/g) ?? []) {
    console.log(`     ${linea.trim()}`)
  }
} else {
  console.log('     No hay mayoría en ninguna dirección. Es la MISMA rejilla para las siete,')
  console.log('     así que un efecto que dependa de la divisa apunta a otra causa.')
}
console.log('')

// ── El mecanismo candidato, medido — y REFUTADO ──────────────────────────
console.log('── ¿Por qué el ATR apenas se mueve habiendo quitado un 25,8 % de velas? ──')
console.log('')
console.log('  Mi explicación era: al limpiar, la primera vela de la semana mide su rango')
console.log('  contra el cierre del VIERNES y se come el hueco del fin de semana.')
console.log('')
console.log('  ⚠️⚠️ ES FALSA:')
for (const linea of MECANISMO_CANDIDATO.match(/.{1,72}(\s|$)/g) ?? []) console.log(`     ${linea.trim()}`)
console.log('')
console.log('        arranques   con el previo DISTINTO   rango 1ª vela   al limpiar   veces')
for (const r of filas) {
  const h = r.hueco
  console.log(
    `  ${r.ccy.padEnd(5)} ${String(h?.arranques ?? '—').padStart(9)}   ` +
      `${String(h?.conPrevioDistinto ?? '—').padStart(22)}   ` +
      `${f(h?.medianaRangoHoy).padStart(13)}   ${f(h?.medianaRangoLimpia).padStart(10)}   ${v(h?.medianaVeces).padStart(6)}`,
  )
}
console.log('')
const unHueco = filas.find((r) => r.hueco?.filas?.length)?.hueco
if (unHueco) {
  const ej = unHueco.filas[unHueco.filas.length - 1]
  console.log('  Un arranque de ejemplo, con las dos fechas a la vista:')
  console.log(`    vela ${ej.fecha}`)
  console.log(`      cierre previo con la rejilla de HOY:   ${ej.previoHoy}`)
  console.log(`      cierre previo con la rejilla LIMPIA:   ${ej.previoLimpia}`)
  console.log(`      rango verdadero: ${f(ej.rangoHoy)} → ${f(ej.rangoLimpia)}  (${v(ej.veces)})`)
}
console.log('')
console.log('  ⚠️ Si la columna «con el previo DISTINTO» sale en 0, la hipótesis está')
console.log('     refutada con datos reales igual que con el mercado sintético: la vela')
console.log('     anterior a la apertura es la MISMA en las dos rejillas porque la frontera')
console.log('     (domingo 21:00-23:00 UTC) se conserva y hace de puente.')
console.log('')
console.log('     Y si sale distinta de 0, entonces la fuente ha dejado de emitir esas horas')
console.log('     y el mecanismo vuelve a estar en juego. Por eso la medición se queda y por')
console.log('     eso se imprimen las DOS fechas: para que eso se vea en vez de quedar')
console.log('     escondido dentro de un cociente.')
console.log('')
console.log('  📌 Décimo mecanismo convincente de este proyecto que resulta falso al medirlo,')
console.log('     y el segundo en dos días. La explicación verdadera es la ventana dura de 60')
console.log('     velas, que ya está medida arriba.')
console.log('')

// ── El veredicto, calculado ──────────────────────────────────────────────
const veredictos = filas.map((r) => ({ ccy: r.ccy, v: veredictoDiagnostico(r, { derrumbeMinimo: DERRUMBE_MINIMO }) }))
const cuenta = {}
for (const { v: k } of veredictos) cuenta[k ?? 'noSePudoMirar'] = (cuenta[k ?? 'noSePudoMirar'] ?? 0) + 1

console.log('════════════════════════════════════════════════════════════')
console.log('  VEREDICTO (calculado, no escrito a mano)')
console.log('════════════════════════════════════════════════════════════')
console.log(`  umbral de derrumbe del preregistro: ${DERRUMBE_MINIMO.toFixed(2)}×`)
console.log('')
for (const { ccy, v: k } of veredictos) console.log(`  ${ccy.padEnd(5)} ${k ?? 'noSePudoMirar'}`)
console.log('')
for (const [k, n] of Object.entries(cuenta).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(2)} de ${filas.length} → ${k}`)
}
console.log('')

// ⚠️ EL VEREDICTO CONJUNTO PIDE MAYORÍA, y el número va escrito: si el efecto
// es de la rejilla, tiene que aparecer en casi todas las divisas — es la misma
// rejilla para las siete. Que salga en dos y no en cinco sería un efecto de
// esas dos divisas, no de la rejilla.
const MAYORIA = Math.ceil(filas.length * 0.7)
const conDerrumbe = cuenta.seDerrumba ?? 0
const conjunto =
  conDerrumbe >= MAYORIA ? 'seDerrumba' : (cuenta.noSeMueve ?? 0) >= MAYORIA ? 'noSeMueve' : 'mezclado'

console.log(`  MAYORÍA exigida: ${MAYORIA} de ${filas.length} (es la MISMA rejilla para las siete)`)
console.log('')
if (conjunto === 'seDerrumba') {
  console.log('  ⚠️ SE DERRUMBA.')
  console.log(`     ${QUE_DICE_EL_DIAGNOSTICO.seDerrumba}`)
  console.log('')
  console.log('     → El paso 3 (la medición completa, 28 créditos) vale la pena.')
} else if (conjunto === 'noSeMueve') {
  console.log('  ✅ NO SE MUEVE — y eso quiere decir que mi inferencia era FALSA.')
  console.log(`     ${QUE_DICE_EL_DIAGNOSTICO.noSeMueve}`)
  console.log('')
  console.log('     → El paso 3 NO se hace. Se documenta y se para.')
} else {
  console.log('  ⚠️ MEZCLADO: no hay mayoría en ninguna dirección.')
  console.log('     Si fuera la rejilla, el efecto tendría que aparecer en casi todas las')
  console.log('     divisas — es la misma rejilla para las siete. Que dependa de la divisa')
  console.log('     apunta a otra causa, y el paso 3 mediría algo sin mecanismo detrás.')
  console.log('')
  console.log('     → El paso 3 NO se hace sin entender antes de qué depende.')
}
console.log('')
console.log('  ⚠️ Y LO QUE ESTO NO AUTORIZA: nada. Este paso no cambia el barrido, no')
console.log('     toca el historial y no quita ningún experimento. Solo dice si merece')
console.log('     la pena gastar los 28 créditos del paso 3.')
