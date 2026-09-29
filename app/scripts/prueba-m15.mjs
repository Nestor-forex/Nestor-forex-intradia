// Prueba del marco y del listón de las velas de 15 minutos. Sin internet:
//
//     node scripts/prueba-m15.mjs
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTAS PRUEBAS Y NO OTRAS
// ─────────────────────────────────────────────────────────────────────────
// Medir la app en otra temporalidad tiene tres formas de salir mal, y NINGUNA
// da un error: las tres devuelven una tabla creíble que mide otra cosa.
//
//   1. QUE LA COPIA SE SEPARE DE LA APP. `scripts/lib/marco.mjs` rearma el
//      barrido para poder cambiarle las ventanas. Si ese montaje no es el
//      mismo que el de la app, la tabla no habla de la app. Es lo que vigila
//      el bloque 1, y es la razón por la que este archivo existe.
//   2. ESCALAR POR VELAS EN VEZ DE POR RELOJ. En M15 una EMA de 9 velas son
//      dos horas y cuarto, no nueve horas. Copiando el 9, M15 y H1 medirían
//      estrategias distintas pareciendo la misma. Bloque 2.
//   3. AGRUPAR M15 EN «HORAS» QUE NO SON HORAS. Si la descarga empieza en una
//      vela de :15, juntar de cuatro en cuatro da bloques de :15 a :15.
//      Bloque 3.
//
// Y una cuarta, del listón: que el veredicto se pueda argumentar. Bloque 5
// comprueba que lo CALCULA una función y que muerde.
//
// ⚠️ Nada de esto toca la app. `src/lib/marketCalc.js` no se modifica; este
// archivo lo IMPORTA para comparar contra él.

import { computarBarrido, derivarVista } from '../src/lib/marketCalc.js'
import { MARCO_H1, MARCO_M15, barridoConMarco, marcoEscalado, reagruparAHoras, reagruparVelas } from './lib/marco.mjs'
import {
  CRITERIOS as CRITERIOS_H4,
  FECHA_PREREGISTRO as FECHA_H4,
  MISMOS_PARAMETROS,
  OPS_MINIMAS as OPS_MIN_H4,
  SEMANAL_SOLO_SI as SEMANAL,
  TOPE_UN_PAR as TOPE_PAR_H4,
  juzgar as juzgarH4,
} from './lib/preregistro-h4.mjs'
import {
  CRITERIOS,
  FECHA_PREREGISTRO,
  OPS_MINIMAS,
  SWAP_EXIGIDO,
  TOPE_UN_PAR,
  juzgar,
} from './lib/preregistro-m15.mjs'

let fallos = 0
const comprobar = (bien, que) => {
  console.log(`  ${bien ? '✓' : '✗'} ${que}`)
  if (!bien) fallos++
}

// --- Un mercado de mentira, pero con la forma del de verdad ---------------
//
// Copiado del de `prueba-barrido-publicado.mjs`, con su lección dentro: el
// primer intento de aquel mercado era una tendencia limpia, daba ADX 100 y
// CERO setups, porque una tendencia sin retrocesos deja el RSI clavado arriba
// y el filtro los rechaza todos — y la prueba pasaba comparando dos listas
// vacías. Por eso cada divisa lleva una onda de periodo medio CON SU PROPIA
// FASE: suben, se devuelven, y no todas a la vez.
//
// Aquí se genera en velas de 15 MINUTOS y las de una hora se obtienen
// reagrupándolas, que es exactamente lo que hará la medición de verdad.
const CCY = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD', 'CAD']
const BASE = { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 150, CHF: 0.88, AUD: 1.52, NZD: 1.64, CAD: 1.36 }
const DERIVA = { USD: 0, EUR: -0.00008, GBP: 0.00006, JPY: 0.024, CHF: 0.00004, AUD: -0.00012, NZD: 0.0001, CAD: -0.00006 }
const FASE = { USD: 0, EUR: 0.7, GBP: 1.9, JPY: 3.1, CHF: 4.4, AUD: 5.2, NZD: 2.5, CAD: 6.0 }

// 2.400 velas de 15 minutos = 600 horas = 25 días. Hace falta bastante porque
// en M15 la ventana más larga son 240 velas (el RSI) y los pivotes miran 192.
const VELAS_M15 = 2400

function fabricarM15(desdeMinuto = 0) {
  const barras = []
  const rates = {}
  const rangos = {}
  for (let i = 0; i < VELAS_M15; i++) {
    const minutoTotal = desdeMinuto + i * 15
    const dia = 1 + Math.floor(minutoTotal / 1440)
    const hora = Math.floor((minutoTotal % 1440) / 60)
    const min = minutoTotal % 60
    const dd = (n) => String(n).padStart(2, '0')
    const t = `2026-07-${dd(dia)} ${dd(hora)}:${dd(min)}:00`
    barras.push(t)
    const fila = {}
    const filaRangos = {}
    for (const c of CCY) {
      // Las mismas ondas del mercado de una hora, con el índice dividido por 4
      // para que en velas de 15 minutos el mercado tenga la MISMA forma en el
      // reloj. Si no, M15 vería un mercado cuatro veces más rápido y la
      // comparación con H1 no diría nada.
      const j = i / 4
      const v =
        BASE[c] *
        (1 + DERIVA[c] * j + 0.008 * Math.sin(j / 19 + FASE[c]) + 0.0015 * Math.sin(j / 2.7 + FASE[c]))
      fila[c] = v
      filaRangos[c] = { h: v * 1.0012, l: v * 0.9988 }
    }
    rates[t] = fila
    rangos[t] = filaRangos
  }
  return { barras, rates, rangos }
}

const m15 = fabricarM15()
const h1 = reagruparAHoras(m15.barras, m15.rates, m15.rangos)

// ═════════════════════════════════════════════════════════════════════════
console.log('\n1. LA COPIA NO MIENTE: en H1 da exactamente lo que da la app')
// ═════════════════════════════════════════════════════════════════════════
// Es la comprobación que sostiene todo lo demás. Si esto pasa, la tabla de M15
// habla de la app de Néstor; si no, habla de otra cosa que se le parece.
//
// Y es el guardia que sustituye a haber tocado la app: el día que alguien
// cambie una ventana en `src/lib/marketCalc.js`, esta comprobación se pone
// roja sola en vez de dejar la medición midiendo lo de ayer.
{
  const dela = computarBarrido(h1.barras, h1.rates, h1.rangos)
  const mia = barridoConMarco(h1.barras, h1.rates, h1.rangos, MARCO_H1)

  comprobar(dela.pares.length === mia.pares.length && dela.pares.length === 18,
    `los dos sacan los 18 pares (${dela.pares.length} y ${mia.pares.length})`)

  // Campo por campo, no con JSON.stringify: un `NaN` o un `undefined` se
  // pierden al serializar y la comparación pasaría sin comparar nada.
  const NUMEROS = ['c', 'e9', 'e21', 'rsiV', 'atrPctH', 'atrAbs', 'adx', 'compresion', 'dif',
    'hi20', 'lo20', 'hi10', 'lo10', 'rangoHi', 'rangoLo']
  let distintos = []
  for (let i = 0; i < dela.pares.length; i++) {
    const a = dela.pares[i]
    const b = mia.pares[i]
    if (a.name !== b.name) distintos.push(`${a.name} vs ${b.name} (orden)`)
    for (const k of NUMEROS) {
      const va = a[k]
      const vb = b[k]
      if (!Number.isFinite(va) || !Number.isFinite(vb) || va !== vb) distintos.push(`${a.name}.${k}`)
    }
    for (const k of ['tend', 'dec', 'esCruce']) {
      if (a[k] !== b[k]) distintos.push(`${a.name}.${k}`)
    }
    for (const k of ['p', 'r1', 's1', 'r2', 's2']) {
      if (a.pivots[k] !== b.pivots[k]) distintos.push(`${a.name}.pivots.${k}`)
    }
    if (a.serie20.length !== b.serie20.length || a.serie20.some((v, j) => v !== b.serie20[j])) {
      distintos.push(`${a.name}.serie20`)
    }
    for (const k of ['highs', 'lows', 'closes']) {
      if (a[k].length !== b[k].length || a[k].some((v, j) => v !== b[k][j])) distintos.push(`${a.name}.${k}`)
    }
  }
  comprobar(distintos.length === 0,
    distintos.length === 0
      ? `los 18 pares coinciden en los ${NUMEROS.length + 3} campos, los pivotes y las tres series`
      : `${distintos.length} campos NO coinciden: ${distintos.slice(0, 6).join(', ')}`)

  // La fuerza relativa y el perfil por hora, que son lo de fuera de los pares.
  comprobar(CCY.every((c) => dela.esc[c] === mia.esc[c]), 'la fuerza relativa de las 8 divisas coincide')
  comprobar(CCY.every((c) => dela.raw[c] === mia.raw[c]), 'y la cruda también')
  comprobar(dela.horaUltima === mia.horaUltima, `la hora de la última vela coincide (${mia.horaUltima})`)
  comprobar(
    dela.factorHora.length === 24 && dela.factorHora.every((v, i) => v === mia.factorHora[i]),
    'el factor por hora coincide en las 24 casillas (o sea que los topes 0,6 y 1,2 siguen siendo los mismos)',
  )
  comprobar(
    Object.keys(dela.ratesUSD).every((c) => dela.ratesUSD[c] === mia.ratesUSD[c]),
    'y las cotizaciones contra el dólar',
  )

  // Y lo que de verdad decide: las MISMAS señales.
  const sDela = derivarVista(dela, { thr: 0.5, topN: 3 }).setups.map((s) => `${s.name}|${s.lado}`)
  const sMia = derivarVista(mia, { thr: 0.5, topN: 3 }).setups.map((s) => `${s.name}|${s.lado}`)
  comprobar(sDela.length === sMia.length && sDela.every((v, i) => v === sMia[i]),
    `salen las MISMAS señales (${sDela.length}: ${sDela.join(', ') || 'ninguna'})`)
  // ⚠️ Con cero señales esta comprobación pasaría comparando dos listas
  // vacías, que es el agujero documentado del mercado inventado. Así que se
  // exige que haya algo que comparar.
  comprobar(sDela.length > 0, 'y son más de cero, así que la comparación comprueba algo')

  comprobar(mia.marco === 'H1', `la copia dice en qué marco calculó ("${mia.marco}")`)
  comprobar(dela.marco === undefined, 'y la app NO lleva ese campo: no se le añadió nada')
}

// ═════════════════════════════════════════════════════════════════════════
console.log('\n2. Las ventanas se escalan por RELOJ, no por número de velas')
// ═════════════════════════════════════════════════════════════════════════
{
  comprobar(MARCO_M15.porHora === 4, 'M15 son 4 velas por hora')

  // Los tres que más se prestan a copiarse tal cual.
  comprobar(MARCO_M15.emaRapida === 36, `la EMA de 9 horas son 36 velas en M15 (${MARCO_M15.emaRapida}), no 9`)
  comprobar(MARCO_M15.emaLenta === 84, `la EMA de 21 horas son 84 (${MARCO_M15.emaLenta}), no 21`)
  comprobar(MARCO_M15.periodo === 56, `el periodo de Wilder de 14 horas son 56 (${MARCO_M15.periodo}), no 14`)

  comprobar(MARCO_M15.dia === 96, `un "día" son 96 velas (${MARCO_M15.dia})`)
  comprobar(MARCO_M15.extremos === 80 && MARCO_M15.extremosCortos === 40, 'los extremos, 80 y 40')
  comprobar(MARCO_M15.compresion === 48, 'la compresión, 48')
  comprobar(MARCO_M15.rsiVentana === 240, 'y el RSI recibe 240 cierres')
  comprobar(
    MARCO_M15.fuerza.length === 3 && MARCO_M15.fuerza.every((v, i) => v === MARCO_H1.fuerza[i] * 4),
    `la fuerza sigue midiendo 1 h / 4 h / 24 h (${MARCO_M15.fuerza.join(' · ')} velas)`,
  )

  // Ninguna ventana puede quedarse sin escalar: es el fallo que no da error.
  const CLAVES = ['emaRapida', 'emaLenta', 'periodo', 'rsiVentana', 'extremos', 'extremosCortos', 'compresion', 'dia']
  const sinEscalar = CLAVES.filter((k) => MARCO_M15[k] !== MARCO_H1[k] * 4)
  comprobar(sinEscalar.length === 0,
    sinEscalar.length === 0 ? 'NINGUNA ventana se quedó sin escalar' : `sin escalar: ${sinEscalar.join(', ')}`)

  // Y el marco de H1 no se toca al derivar otro.
  comprobar(MARCO_H1.emaRapida === 9 && MARCO_H1.periodo === 14 && MARCO_H1.dia === 24,
    'y el marco de H1 sigue con los números de la app (9 · 14 · 24)')
  comprobar(Object.isFrozen(MARCO_H1) && Object.isFrozen(MARCO_M15), 'los dos marcos están congelados')

  // Entradas que no valen tienen que romperse, no devolver algo plausible.
  let rompio = 0
  for (const malo of [0, -1, 0.5, NaN, 'cuatro', null, undefined]) {
    try {
      marcoEscalado(malo)
    } catch {
      rompio++
    }
  }
  comprobar(rompio === 7, `las 7 entradas inválidas revientan en vez de inventar un marco (${rompio}/7)`)
}

// ═════════════════════════════════════════════════════════════════════════
console.log('\n3. Reagrupar a horas: POR EL RELOJ, no de cuatro en cuatro')
// ═════════════════════════════════════════════════════════════════════════
{
  comprobar(h1.barras.length === VELAS_M15 / 4, `2.400 velas de 15 min dan ${h1.barras.length} horas`)
  comprobar(h1.barras.every((t) => t.endsWith(':00:00')), 'todas las velas resultantes caen EN PUNTO')

  // El máximo de la hora es el mayor de sus cuatro, el mínimo el menor y el
  // cierre el último. Comprobado sobre la primera hora, a mano.
  const primera = h1.barras[0]
  const cuatro = m15.barras.slice(0, 4)
  const mayor = Math.max(...cuatro.map((t) => m15.rangos[t].EUR.h))
  const menor = Math.min(...cuatro.map((t) => m15.rangos[t].EUR.l))
  comprobar(h1.rangos[primera].EUR.h === mayor, 'el máximo de la hora es el mayor de sus cuatro velas')
  comprobar(h1.rangos[primera].EUR.l === menor, 'y el mínimo, el menor')
  comprobar(h1.rates[primera].EUR === m15.rates[cuatro[3]].EUR, 'y el cierre, el de la ÚLTIMA de las cuatro')

  // ⚠️⚠️ EL CASO QUE DECIDE. Una descarga que empieza a las :15. Agrupar de
  // cuatro en cuatro desde el principio daría bloques de :15 a :15 — «horas»
  // que no son horas, con números perfectamente creíbles. Aquí la primera
  // hora tiene que salir INCOMPLETA (3 velas), no desplazada.
  const torcido = fabricarM15(15)
  const reagrupado = reagruparAHoras(torcido.barras, torcido.rates, torcido.rangos)
  comprobar(torcido.barras[0].endsWith(':15:00'), 'el caso torcido empieza de verdad en :15')
  comprobar(reagrupado.barras.every((t) => t.endsWith(':00:00')),
    'y aun así TODAS las horas resultantes caen en punto')
  comprobar(reagrupado.barras[0] === '2026-07-01 00:00:00',
    `la primera hora es la 00:00 (salió ${reagrupado.barras[0]})`)
  // 2400 velas desde :15 cubren 599 horas completas más dos trozos.
  comprobar(reagrupado.barras.length === 601,
    `y hay una hora más que en el caso alineado, por los dos trozos (${reagrupado.barras.length})`)
  // La prueba de que NO se desplazó: la primera hora solo tiene 3 velas, así
  // que su cierre es el de :45 y no el de la hora siguiente.
  comprobar(reagrupado.rates['2026-07-01 00:00:00'].EUR === torcido.rates['2026-07-01 00:45:00'].EUR,
    'la primera hora cierra en :45 (tenía 3 velas), no se llevó la de la hora siguiente')

  // Una fila con la fecha ilegible se salta, no tumba el reagrupado.
  const conBasura = reagruparAHoras(
    ['no es una fecha', ...m15.barras.slice(0, 4)],
    m15.rates,
    m15.rangos,
  )
  comprobar(conBasura.barras.length === 1, 'una fecha ilegible se salta en vez de reventar')

  // Sin rangos se cae al cierre, igual que hace el barrido.
  const sinRangos = reagruparAHoras(m15.barras.slice(0, 4), m15.rates, null)
  const t0 = sinRangos.barras[0]
  comprobar(
    sinRangos.rangos[t0].EUR.h === Math.max(...m15.barras.slice(0, 4).map((t) => m15.rates[t].EUR)),
    'sin máximos ni mínimos se cae a los cierres, como el barrido',
  )
}

// ═════════════════════════════════════════════════════════════════════════
console.log('\n4. El barrido en M15 produce algo que se pueda medir')
// ═════════════════════════════════════════════════════════════════════════
// Si en M15 saliera vacío o con NaN, la medición devolvería una tabla de ceros
// y habría que creerse que «no hay señales» en vez de que está roto.
{
  const m = barridoConMarco(m15.barras, m15.rates, m15.rangos, MARCO_M15)
  comprobar(m.marco === 'M15', `dice su marco ("${m.marco}")`)
  comprobar(m.pares.length === 18, `saca los 18 pares (${m.pares.length})`)
  comprobar(
    m.pares.every((p) => Number.isFinite(p.adx) && Number.isFinite(p.rsiV) && Number.isFinite(p.atrAbs) && Number.isFinite(p.dif)),
    'todos con ADX, RSI, ATR y fuerza con números de verdad (ni NaN ni undefined)',
  )
  const rsis = m.pares.map((p) => p.rsiV)
  comprobar(Math.max(...rsis) - Math.min(...rsis) > 20,
    `el RSI está repartido y no clavado (de ${Math.min(...rsis).toFixed(0)} a ${Math.max(...rsis).toFixed(0)})`)
  const tend = new Set(m.pares.map((p) => p.tend))
  comprobar(tend.size >= 2, `y no todos hacen lo mismo (${[...tend].join(', ')})`)
  comprobar(m.factorHora.length === 24 && m.factorHora.every((v) => v >= 0.6 && v <= 1.2),
    'el factor por hora sale acotado entre 0,6 y 1,2 también en M15')

  // El ATR de M15 tiene que ser MENOR que el de H1 sobre el mismo mercado:
  // catorce horas de recorrido caben más movimiento que… catorce horas, pero
  // medidas en trozos de 15 minutos el rango de cada vela es más pequeño y el
  // ATR promedia velas. Si saliera igual o mayor, algo se copió sin escalar.
  const enH1 = barridoConMarco(h1.barras, h1.rates, h1.rangos, MARCO_H1)
  const atrM15 = m.pares.find((p) => p.name === 'EUR/USD').atrPctH
  const atrH1 = enH1.pares.find((p) => p.name === 'EUR/USD').atrPctH
  comprobar(atrM15 < atrH1, `el ATR% de M15 es menor que el de H1 (${atrM15.toFixed(3)} < ${atrH1.toFixed(3)})`)
}

// ═════════════════════════════════════════════════════════════════════════
console.log('\n5. El listón: lo CALCULA una función, y muerde')
// ═════════════════════════════════════════════════════════════════════════
{
  comprobar(FECHA_PREREGISTRO === '2026-09-28', `lleva la fecha dentro (${FECHA_PREREGISTRO})`)
  comprobar(CRITERIOS.length === 6, `son 6 criterios (${CRITERIOS.length})`)
  comprobar(CRITERIOS.every((c) => c.dice && c.porque), 'y cada uno dice qué exige Y por qué')

  // Un resultado que pasa los seis, con margen.
  const BUENO = {
    ops: 1200, porRiesgo: 0.06, mitad1: 0.05, mitad2: 0.07,
    conSwap: 0.03, h1PorRiesgo: -0.10, parMayor: 0.15,
  }
  comprobar(juzgar(BUENO).pasa === true, 'un resultado bueno pasa los seis')

  // Y ahora uno por criterio, fallando SOLO ése. Es la forma de comprobar que
  // cada criterio está conectado de verdad y no es un adorno.
  const rompiendo = {
    ops: { ops: OPS_MINIMAS - 1 },
    gana: { porRiesgo: -0.01 },
    mitades: { mitad2: -0.01 },
    mejorQueH1: { h1PorRiesgo: 0.07 },
    swap: { conSwap: -0.01 },
    concentracion: { parMayor: TOPE_UN_PAR + 0.01 },
  }
  for (const [clave, cambio] of Object.entries(rompiendo)) {
    const v = juzgar({ ...BUENO, ...cambio })
    comprobar(v.pasa === false && v.fallan.length === 1 && v.fallan[0] === clave,
      `falla SOLO «${clave}» cuando se rompe solo ése (falló: ${v.fallan.join(', ') || 'nada'})`)
  }

  // Los bordes exactos, que es donde un `>` y un `>=` se confunden.
  comprobar(juzgar({ ...BUENO, ops: OPS_MINIMAS }).pasa === true, `con exactamente ${OPS_MINIMAS} operaciones pasa`)
  comprobar(juzgar({ ...BUENO, porRiesgo: 0 }).pasa === false, 'con por 1R exactamente 0 NO pasa (empatar no es ganar)')
  comprobar(juzgar({ ...BUENO, mitad1: 0 }).pasa === false, 'con una mitad en exactamente 0 tampoco')
  comprobar(juzgar({ ...BUENO, parMayor: TOPE_UN_PAR }).pasa === true, `con el par mayor en exactamente ${TOPE_UN_PAR} pasa`)
  comprobar(juzgar({ ...BUENO, h1PorRiesgo: BUENO.porRiesgo }).pasa === false,
    'empatar con H1 NO es mejorar a H1')

  // ⚠️ LA ASIMETRÍA. Un campo que no llegó no se da por bueno: el criterio
  // falla. Equivocarse hacia «no pasa» cuesta repetir una medición; hacia
  // «pasa», encender una regla sin probar.
  comprobar(juzgar({}).pasa === false && juzgar({}).fallan.length === 6,
    'sin ningún dato fallan los SEIS, no pasa ninguno por descarte')
  comprobar(juzgar().pasa === false, 'y sin argumento tampoco pasa')
  for (const campo of ['ops', 'porRiesgo', 'mitad1', 'mitad2', 'conSwap', 'h1PorRiesgo', 'parMayor']) {
    const sin = { ...BUENO }
    delete sin[campo]
    comprobar(juzgar(sin).pasa === false, `sin «${campo}» no puede pasar`)
  }
  // Un NaN o un texto tampoco cuentan como número.
  comprobar(juzgar({ ...BUENO, porRiesgo: NaN }).pasa === false, 'un NaN no cuenta como número')
  comprobar(juzgar({ ...BUENO, ops: '1200' }).pasa === false, 'ni un número escrito como texto')

  comprobar(SWAP_EXIGIDO === 0.5, `el swap exigido es ${SWAP_EXIGIDO} pips por noche`)
}

// ════════════════════════════════════════════════════════════════════════
console.log('\n6. Reagrupar a MÚLTIPLOS de una hora (H4), para subir de temporalidad')
// ════════════════════════════════════════════════════════════════════════
// Con `horas > 1` la alineación importa igual o más que con 1: las velas de 4
// horas tienen que cortar en 00:00, 04:00, 08:00… del RELOJ, no cuatro horas
// después de donde empezó la descarga. Y es el fallo que no da ningún error.
{
  const h4 = reagruparVelas(h1.barras, h1.rates, h1.rangos, { horas: 4 })
  comprobar(h4.barras.length === Math.ceil(h1.barras.length / 4),
    `${h1.barras.length} velas de una hora dan ${h4.barras.length} de cuatro`)
  comprobar(h4.barras.every((t) => ['00', '04', '08', '12', '16', '20'].includes(t.slice(11, 13))),
    'TODAS las velas de H4 cortan en 00, 04, 08, 12, 16 o 20 — nunca en medio')

  // El máximo del bloque es el mayor de sus cuatro horas y el cierre el de la
  // última. Comprobado a mano sobre el primer bloque completo.
  const cuatro = h1.barras.slice(0, 4)
  comprobar(h4.rangos[h4.barras[0]].EUR.h === Math.max(...cuatro.map((t) => h1.rangos[t].EUR.h)),
    'el máximo de la vela de 4 h es el mayor de sus cuatro horas')
  comprobar(h4.rates[h4.barras[0]].EUR === h1.rates[cuatro[3]].EUR,
    'y el cierre, el de la cuarta hora')

  // ⚠⚠ EL CASO QUE DECIDE: una descarga que NO empieza en un múltiplo de 4.
  // Agrupar de cuatro en cuatro desde el principio daría bloques de 02:00 a
  // 06:00, con números creíbles midiendo otra cosa.
  const desde2 = {
    barras: h1.barras.slice(2),
    rates: h1.rates,
    rangos: h1.rangos,
  }
  comprobar(desde2.barras[0].slice(11, 13) === '02', `el caso torcido empieza a las ${desde2.barras[0].slice(11, 16)}`)
  const torcidoH4 = reagruparVelas(desde2.barras, desde2.rates, desde2.rangos, { horas: 4 })
  comprobar(torcidoH4.barras[0] === '2026-07-01 00:00:00',
    `y aun así el primer bloque es el de las 00:00 (salió ${torcidoH4.barras[0]})`)
  comprobar(torcidoH4.barras.every((t) => ['00', '04', '08', '12', '16', '20'].includes(t.slice(11, 13))),
    'y todos los bloques siguen cortando en el reloj')
  // La prueba de que NO se desplazó: el primer bloque solo tiene 2 horas (02 y
  // 03), así que su cierre es el de las 03:00.
  comprobar(torcidoH4.rates['2026-07-01 00:00:00'].EUR === h1.rates['2026-07-01 03:00:00'].EUR,
    'el primer bloque incompleto cierra en la 03:00, no se llevó la 04:00')

  // Un divisor que NO divide a 24 se rechaza. Con 5 horas el corte se iría
  // desplazando de un día al siguiente y las velas de un lunes no serían
  // comparables con las de un martes — sin que nada fallara.
  let rechazo = 0
  for (const malo of [5, 7, 9, 10, 0, -4, 2.5, NaN, '4', null]) {
    try {
      reagruparVelas(h1.barras, h1.rates, h1.rangos, { horas: malo })
    } catch {
      rechazo++
    }
  }
  comprobar(rechazo === 10, `los 10 valores de horas inválidos revientan (${rechazo}/10)`)
  for (const bueno of [1, 2, 3, 4, 6, 8, 12, 24]) {
    // Los divisores de 24 sí tienen que pasar.
    reagruparVelas(h1.barras.slice(0, 48), h1.rates, h1.rangos, { horas: bueno })
  }
  comprobar(true, 'y los 8 divisores de 24 pasan sin reventar')

  // `reagruparAHoras` sigue siendo el caso de 1 hora, byte a byte.
  const porNombre = reagruparAHoras(m15.barras, m15.rates, m15.rangos)
  const porNumero = reagruparVelas(m15.barras, m15.rates, m15.rangos, { horas: 1 })
  comprobar(porNombre.barras.length === porNumero.barras.length &&
    porNombre.barras.every((t, i) => t === porNumero.barras[i]),
    'reagruparAHoras sigue dando lo mismo que reagruparVelas con horas: 1')
}

// ════════════════════════════════════════════════════════════════════════
console.log('\n7. El listón del H4: lo CALCULA una función, y muerde')
// ════════════════════════════════════════════════════════════════════════
{
  comprobar(FECHA_H4 === '2026-09-29', `lleva la fecha dentro (${FECHA_H4})`)
  comprobar(CRITERIOS_H4.length === 6, `son 6 criterios (${CRITERIOS_H4.length})`)
  comprobar(CRITERIOS_H4.every((c) => c.dice && c.porque), 'y cada uno dice qué exige Y por qué')
  comprobar(MISMOS_PARAMETROS.swingLen === 4 && MISMOS_PARAMETROS.sweepWindow === 6,
    'a H4 se le pasan los mismos parámetros que a H1 (pivote 4, ventana 6)')

  const BUENO = {
    ops: 400, porRiesgo: 0.04, mitad1: 0.03, mitad2: 0.05,
    h1PorRiesgo: -0.14, sinCostes: 0.02, h1SinCostes: -0.01, parMayor: 0.2,
  }
  comprobar(juzgarH4(BUENO).pasa === true, 'un resultado bueno pasa los seis')

  const rompiendo = {
    ops: { ops: OPS_MIN_H4 - 1 },
    gana: { porRiesgo: -0.01 },
    mitades: { mitad2: -0.01 },
    mejorQueH1: { h1PorRiesgo: 0.05 },
    noEsSoloPeaje: { sinCostes: -0.02 },
    concentracion: { parMayor: TOPE_PAR_H4 + 0.01 },
  }
  for (const [clave, cambio] of Object.entries(rompiendo)) {
    const v = juzgarH4({ ...BUENO, ...cambio })
    comprobar(v.pasa === false && v.fallan.length === 1 && v.fallan[0] === clave,
      `falla SOLO «${clave}» cuando se rompe solo ése (falló: ${v.fallan.join(', ') || 'nada'})`)
  }

  // ⚠⚠ EL CRITERIO QUE DA SENTIDO A TODO ESTO, con el caso exacto que viene a
  // cazar: H4 le gana a H1 con costes pero NO sin costes. O sea que la mejora
  // entera es el stop más ancho diluyendo el spread — menos peaje por la misma
  // no-ventaja. Es el mecanismo medido en M15 el 2026-09-28, al revés.
  const soloPeaje = { ...BUENO, porRiesgo: 0.04, h1PorRiesgo: -0.14, sinCostes: -0.03, h1SinCostes: -0.01 }
  const vp = juzgarH4(soloPeaje)
  comprobar(vp.pasa === false && vp.fallan.includes('noEsSoloPeaje'),
    'si la mejora es SOLO por el peaje, NO pasa — aunque gane en todo lo demás')

  // Los bordes exactos.
  comprobar(juzgarH4({ ...BUENO, ops: OPS_MIN_H4 }).pasa === true, `con exactamente ${OPS_MIN_H4} operaciones pasa`)
  comprobar(juzgarH4({ ...BUENO, porRiesgo: 0 }).pasa === false, 'con por 1R exactamente 0 NO pasa')
  comprobar(juzgarH4({ ...BUENO, sinCostes: BUENO.h1SinCostes }).pasa === false,
    'empatar con H1 sin costes NO es mejorar sin costes')
  comprobar(juzgarH4({ ...BUENO, parMayor: TOPE_PAR_H4 }).pasa === true, `con el par mayor en ${TOPE_PAR_H4} pasa`)

  // La asimetría: un campo que falta no se da por bueno.
  comprobar(juzgarH4({}).pasa === false && juzgarH4({}).fallan.length === 6,
    'sin ningún dato fallan los SEIS')
  for (const campo of Object.keys(BUENO)) {
    const sin = { ...BUENO }
    delete sin[campo]
    comprobar(juzgarH4(sin).pasa === false, `sin «${campo}» no puede pasar`)
  }

  // Y la advertencia del semanal, que Néstor pidió por delante.
  comprobar(/SWAP/.test(SEMANAL.advertencia), 'la nota del semanal avisa del SWAP antes que nada')
  comprobar(SEMANAL.condicion.includes('H4'), 'y dice que solo se hace si el H4 confirma')
}

console.log('')
console.log(fallos ? `${fallos} comprobación(es) FALLARON` : 'El marco mide la app de verdad, y el listón muerde.')
process.exit(fallos ? 1 : 0)
