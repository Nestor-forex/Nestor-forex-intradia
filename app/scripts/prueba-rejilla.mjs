// Comprobaciones del diagnóstico de la rejilla y de su listón. SIN INTERNET.
//
//     node scripts/prueba-rejilla.mjs
//
// ─────────────────────────────────────────────────────────────────────────
// LO QUE ESTAS COMPROBACIONES VIGILAN, Y POR QUÉ CADA UNA
// ─────────────────────────────────────────────────────────────────────────
// 1. Que el ATR del diagnóstico sea EL MISMO que el de la app. Si no, el
//    diagnóstico mide otra cosa y su número no dice nada sobre esta app. Es la
//    comprobación más importante del archivo y va primera.
// 2. Que las dos rejillas se lean en las MISMAS FECHAS. La serie limpia va
//    28,7 % «adelantada», así que comparar por índice daría dos números
//    plausibles de dos instantes distintos, sin dar ningún error.
// 3. Que el veredicto distinga «no se derrumba» de «no se pudo mirar».
// 4. Que el listón MUERDA en cada uno de sus siete criterios.
//
// Los mercados de mentira son sintéticos a propósito: hacen falta un caso donde
// el derrumbe EXISTE y otro donde NO, y eso no se consigue con datos reales.

import { atrWilder } from '../src/lib/marketCalc.js'
import { clasificarHora } from './lib/sonda-oro.mjs'
import {
  PERIODO_ATR,
  atrEnCada,
  arranquesDeSemana,
  mediana,
  compararRejillas,
  veredictoDiagnostico,
  cuantil,
  cuantoSubeElATR,
  huecoDeApertura,
  veredictoPreguntaDeSwing,
} from './lib/rejilla-atr.mjs'
import {
  OPS_MINIMAS,
  TOPE_UN_PAR,
  MINIMO_DE_SEÑALES,
  DERRUMBE_MINIMO,
  CRITERIOS,
  QUE_DICE_EL_DIAGNOSTICO,
  FECHA_PREREGISTRO,
  juzgar,
  CAMBIO_MINIMO_ATR,
  MAYORIA_DIVISAS,
  PROPORCION_MINIMA_AFECTADA,
  TECHO_ESTRUCTURAL_MEDIDO,
  MECANISMO_CANDIDATO,
  QUE_DICE_LA_PREGUNTA_DE_SWING,
} from './lib/preregistro-rejilla.mjs'

let hechas = 0
let fallos = 0
const ok = (cond, que) => {
  hechas++
  if (cond) return true
  fallos++
  console.error(`  ✗ ${que}`)
  return false
}

// ── Un mercado de mentira con la rejilla REAL: 24 velas por día, 7 días ──
//
// `anchoCerrado` es lo que separa los dos casos: con 0.2 las horas sin mercado
// son 5× más estrechas (como midió la sonda); con 1 son iguales.
function mercado({ semanas = 12, anchoCerrado = 0.2, desde = Date.UTC(2026, 8, 7) } = {}) {
  const fechas = []
  const highs = []
  const lows = []
  const closes = []
  let precio = 1.1

  // 2026-09-07 es lunes. Se generan TODAS las horas de TODOS los días, que es
  // exactamente lo que devuelve Twelve Data.
  for (let d = 0; d < semanas * 7; d++) {
    for (let h = 0; h < 24; h++) {
      const t = new Date(desde + d * 86_400_000 + h * 3_600_000)
      const dia = t.getUTCDay()
      const hora = t.getUTCHours()
      // Las mismas fronteras que `clasificarHora`.
      const cerrado =
        (dia === 6 && hora <= 20) || (dia === 0 && hora <= 20) || (dia === 5 && hora >= 23)

      const ancho = (cerrado ? anchoCerrado : 1) * 0.0008
      // Un paseo determinista, para que la prueba no dependa del azar.
      const paso = Math.sin((d * 24 + h) / 7) * ancho * 0.5
      precio += paso
      fechas.push(t.toISOString().slice(0, 19).replace('T', ' '))
      highs.push(precio + ancho / 2)
      lows.push(precio - ancho / 2)
      closes.push(precio)
    }
  }
  return { fechas, highs, lows, closes }
}

// Una serie SIN ninguna hora cerrada: solo lunes-viernes, 24 h. Sirve para
// comprobar el emparejamiento por fecha sin ningún otro efecto encima — si no
// hay nada que quitar, las dos rejillas son la MISMA serie y los dos ATR tienen
// que salir idénticos. Comparar por índice también pasaría este caso, así que
// va junto al de arriba, no en su lugar.
function mercadoSinFinDeSemana(semanas = 12) {
  const fechas = []
  const highs = []
  const lows = []
  const closes = []
  let precio = 1.1
  const desde = Date.UTC(2026, 8, 7)
  for (let d = 0; d < semanas * 7; d++) {
    const t0 = new Date(desde + d * 86_400_000)
    const dia = t0.getUTCDay()
    if (dia === 0 || dia === 6) continue // fuera el fin de semana entero
    for (let h = 0; h < 24; h++) {
      if (dia === 5 && h >= 21) continue // y la noche del viernes
      const t = new Date(desde + d * 86_400_000 + h * 3_600_000)
      const ancho = 0.0008
      precio += Math.sin((d * 24 + h) / 7) * ancho * 0.5
      fechas.push(t.toISOString().slice(0, 19).replace('T', ' '))
      highs.push(precio + ancho / 2)
      lows.push(precio - ancho / 2)
      closes.push(precio)
    }
  }
  return { fechas, highs, lows, closes }
}

// ── 1. El ATR del diagnóstico es EL MISMO que el de la app ──────────────
console.log('1. ¿es el mismo ATR que usa la app?')
{
  const { highs, lows, closes } = mercado({ semanas: 4 })
  const enCada = atrEnCada(highs, lows, closes)
  const ultimo = enCada[enCada.length - 1]
  const deLaApp = atrWilder(highs, lows, closes)

  ok(ultimo != null, 'el diagnóstico calcula un ATR')
  ok(Number.isFinite(deLaApp), 'y la app también, sobre las mismas velas')
  // ⚠️ La comprobación que de verdad importa: los dos números tienen que
  // coincidir. Si no, el diagnóstico mediría un ATR que esta app no usa.
  ok(
    Math.abs(ultimo - deLaApp) < 1e-12,
    `el ATR del diagnóstico coincide con el de la app (${ultimo} vs ${deLaApp})`,
  )
  ok(PERIODO_ATR === 14, 'y el periodo es 14, el de la app')

  // El calentamiento devuelve `null`, nunca 0.
  ok(enCada[0] === null, 'la primera vela no tiene ATR: devuelve null')
  ok(enCada.slice(0, PERIODO_ATR).every((x) => x === null), 'y ninguna del calentamiento lo tiene')
  ok(
    !enCada.slice(0, PERIODO_ATR).some((x) => x === 0),
    'y NINGUNA devuelve 0 — un 0 diría «no se movió», que es una afirmación',
  )

  ok(atrEnCada([], [], []).length === 0, 'sin velas no revienta')
  ok(atrEnCada([1, 2], [1, 2], [1, 2]).every((x) => x === null), 'con dos velas tampoco se puede')
}

// ── 2. Los arranques de semana ──────────────────────────────────────────
console.log('2. ¿dónde arranca la semana de mercado?')
{
  const { fechas } = mercado({ semanas: 4 })
  const arr = arranquesDeSemana(fechas, 6)

  // Cuatro semanas → cuatro huecos de fin de semana dentro del tramo. El
  // primero puede caer antes del primer lunes, así que se acepta 3 o 4 grupos.
  const grupos = arr.length / 6
  ok(Number.isInteger(grupos) || arr.length % 6 === 0, `los arranques vienen en grupos de 6 (${arr.length})`)
  ok(arr.length >= 18 && arr.length <= 24, `y hay 3 o 4 grupos en cuatro semanas (${arr.length})`)

  // ⚠️ Todos tienen que ser horas de MERCADO. Un arranque que cayera en
  // frontera o en cerrado querría decir que la función no entendió la semana.
  const { fechas: f2 } = mercado({ semanas: 4 })
  ok(
    arr.every((i) => {
      const t = new Date(f2[i].replace(' ', 'T') + 'Z')
      const dia = t.getUTCDay()
      const hora = t.getUTCHours()
      const cerrado = (dia === 6 && hora <= 20) || (dia === 0 && hora <= 20) || (dia === 5 && hora >= 23)
      const frontera = (dia === 6 || dia === 0) && hora >= 21
      return !cerrado && !frontera
    }),
    'todos los arranques caen en horas de mercado',
  )

  // Y el primero de cada grupo va justo después del hueco: el índice anterior
  // NO puede ser mercado.
  const primeros = arr.filter((i, k) => k % 6 === 0)
  ok(primeros.length >= 3, 'hay al menos tres primeros de grupo')

  ok(arranquesDeSemana(null).length === 0, 'sin fechas no revienta')
  ok(arranquesDeSemana(['basura']).length === 0, 'y una fecha ilegible no cuenta como arranque')
}

// ── 3. Mediana ──────────────────────────────────────────────────────────
console.log('3. la mediana')
{
  ok(mediana([3, 1, 2]) === 2, 'con tres valores')
  ok(mediana([4, 1, 2, 3]) === 2.5, 'con cuatro, el promedio de los dos del medio')
  ok(mediana([]) === null, 'sin valores dice «no lo sé», no 0')
  ok(mediana([1, NaN, 3]) === 2, 'y los no finitos no cuentan')
  // Un pico arrastra la media y no la mediana — por eso se usa ésta.
  ok(mediana([1, 2, 3, 4, 1000]) === 3, 'un pico no la arrastra')
}

// ── 4. La comparación de rejillas ───────────────────────────────────────
console.log('4. comparar las dos rejillas')
{
  const m = mercado({ semanas: 12, anchoCerrado: 0.2 })
  const c = compararRejillas(m.fechas, m.highs, m.lows, m.closes)

  ok(c !== null, 'devuelve algo con doce semanas')
  ok(c.velasQuitadas > 0, 'quita velas')
  // 24×7 con las fronteras conservadas: se quitan las cerradas seguras.
  const prop = c.velasQuitadas / c.n
  ok(prop > 0.2 && prop < 0.35, `quita entre el 20 % y el 35 % de las velas (${(100 * prop).toFixed(1)} %)`)
  ok(c.arranques > 0 && c.medios > 0, 'y llena los dos cubos')

  // ⚠️⚠️ LA COMPROBACIÓN CENTRAL: los dos ATR se leen en las MISMAS fechas.
  // Se comprueba por construcción — los cubos solo aceptan fechas que las dos
  // series pueden contestar, así que tienen que medir lo mismo de largo.
  // ⚠️ El emparejamiento por FECHA, comprobado con el caso que lo delataría:
  // si NO hay horas cerradas que quitar, las dos rejillas son la misma serie,
  // así que los dos ATR tienen que salir idénticos. Si se comparara por índice
  // en vez de por fecha, este caso seguiría pasando — pero el de abajo no.
  // ⚠️⚠️ LA COMPROBACIÓN QUE DE VERDAD CAZA EL EMPAREJAMIENTO POR ÍNDICE, y que
  // faltaba: la de abajo (serie sin horas cerradas) NO muerde, porque ahí índice
  // y fecha coinciden. Comprobado rompiéndolo a propósito: pasaba los 67.
  //
  // La serie limpia es un 26 % más corta, así que comparar por índice deja
  // fuera todas las velas del final —`atrLimpia[i]` sale `undefined`— y la
  // COBERTURA se hunde. Medido: 99,0 % por fecha contra 74,0 % por índice.
  const deMercado = m.fechas.filter((f) => clasificarHora(f) === 'mercado').length
  const cobertura = (c.arranques + c.medios) / deMercado
  ok(
    cobertura >= 0.95,
    `se emparejan casi todas las velas de mercado (${(100 * cobertura).toFixed(1)} %) — ` +
      'por índice se hundiría al 74 %',
  )

  const soloHabiles = mercadoSinFinDeSemana(12)
  const ci = compararRejillas(soloHabiles.fechas, soloHabiles.highs, soloHabiles.lows, soloHabiles.closes)
  ok(ci.velasQuitadas === 0, 'en una serie sin horas cerradas no se quita ninguna vela')
  ok(
    Math.abs(ci.medioLimpia - ci.medioHoy) < 1e-12,
    'y entonces los dos ATR son IDÉNTICOS — si se comparara por índice, no lo serían',
  )

  // Con las horas cerradas 5× más estrechas, el derrumbe TIENE que aparecer.
  ok(c.derrumbeHoy != null, 'calcula el derrumbe con la rejilla de hoy')
  ok(c.derrumbeHoy > 1, `y el ATR de media semana es mayor que el del arranque (${c.derrumbeHoy?.toFixed(2)}×)`)
  ok(c.subeEnArranque != null && c.subeEnArranque > 1, 'y limpiar la rejilla SUBE el ATR del arranque')
  // ⚠️ Y AQUÍ EL HALLAZGO QUE CORRIGIÓ EL PREREGISTRO: el ATR medio GLOBAL
  // sale igual en las dos rejillas, porque las horas que cambian son ~5 % del
  // total y una mediana sobre todo no las ve. Se comprueba a propósito, para
  // que nadie vuelva a poner el criterio ahí.
  ok(
    Math.abs(c.atrMedioLimpia - c.atrMedioHoy) < 1e-9,
    'el ATR medio GLOBAL es insensible: por eso el mecanismo no se mide ahí',
  )
  ok(c.subeEnArranque > 1, 'donde SÍ sube es en el arranque de semana, que es donde el mecanismo predice')

  ok(compararRejillas([], [], [], []) === null, 'sin velas devuelve null, no un cero')
}

// ── 5. El veredicto del diagnóstico: los tres casos Y el null ───────────
console.log('5. el veredicto del diagnóstico')
{
  // CASO A: horas cerradas 5× más estrechas → se derrumba y limpiar lo arregla.
  const conDerrumbe = compararRejillas(...Object.values(mercado({ semanas: 12, anchoCerrado: 0.2 })))
  const vA = veredictoDiagnostico(conDerrumbe, { derrumbeMinimo: DERRUMBE_MINIMO })
  ok(vA === 'seDerrumba', `con horas finas de verdad dice «seDerrumba» (dijo «${vA}»)`)

  // CASO B: horas cerradas IGUAL de anchas → no hay nada que arreglar.
  //
  // ⚠️ Éste es el control, y es el que impide que el diagnóstico diga «sí»
  // pase lo que pase. Sin él, cualquier número se leería como confirmación.
  const sinDerrumbe = compararRejillas(...Object.values(mercado({ semanas: 12, anchoCerrado: 1 })))
  const vB = veredictoDiagnostico(sinDerrumbe, { derrumbeMinimo: DERRUMBE_MINIMO })
  ok(vB === 'noSeMueve', `con horas iguales dice «noSeMueve» (dijo «${vB}»)`)

  // CASO C: se derrumba pero limpiar no lo sube.
  const forzado = { derrumbeHoy: 5, subeEnArranque: 1 }
  ok(
    veredictoDiagnostico(forzado, { derrumbeMinimo: DERRUMBE_MINIMO }) === 'seDerrumbaPeroNoSube',
    'si se derrumba y limpiar no lo sube, lo dice',
  )

  // ⚠️ Y EL null: «no se pudo mirar» NO es «no se derrumba».
  ok(veredictoDiagnostico(null) === null, 'sin datos devuelve null')
  ok(veredictoDiagnostico({}) === null, 'y con un objeto vacío también')
  ok(veredictoDiagnostico({ derrumbeHoy: 5 }) === null, 'y si falta la mitad, tampoco concluye')
  for (const v of [veredictoDiagnostico(null), veredictoDiagnostico({})]) {
    ok(v !== 'noSeMueve', '«no se pudo mirar» nunca se convierte en «no se mueve»')
  }

  // Las tres claves que devuelve existen en el preregistro, escritas antes.
  for (const k of ['seDerrumba', 'noSeMueve', 'seDerrumbaPeroNoSube']) {
    ok(typeof QUE_DICE_EL_DIAGNOSTICO[k] === 'string', `el preregistro dice qué significa «${k}»`)
  }
}

// ── 6. El listón MUERDE en sus siete criterios ──────────────────────────
console.log('6. el listón')
{
  ok(FECHA_PREREGISTRO === '2026-09-30', 'la fecha del preregistro va dentro del archivo')
  ok(CRITERIOS.length === 7, `son siete criterios (${CRITERIOS.length})`)
  ok(
    CRITERIOS.every((c) => c.clave && c.dice && c.porque),
    'y cada uno dice qué exige y POR QUÉ',
  )

  // Un resultado que pasa los siete.
  const bueno = {
    ops: 200,
    porRiesgo: -0.1,
    mitad1: -0.11,
    mitad2: -0.09,
    hoyPorRiesgo: -0.13,
    hoyMitad1: -0.14,
    hoyMitad2: -0.12,
    sinCostes: -0.02,
    hoySinCostes: -0.033,
    subeEnArranque: 1.9,
    senalesMes: 90,
    hoySenalesMes: 100,
    parMayor: 0.2,
  }
  const v = juzgar(bueno)
  ok(v.pasa, `un resultado bueno pasa los siete (fallan: ${v.fallan.join(', ') || 'ninguno'})`)

  // 📌 Y aquí está el afloje explicado en el preregistro, comprobado: el
  // resultado bueno SIGUE SIENDO NEGATIVO (−0,10) y pasa. Lo que se exige es
  // que mejore, no que gane.
  ok(bueno.porRiesgo < 0 && v.pasa, 'pasa aunque el por 1R siga siendo negativo: se exige MEJORAR, no ganar')

  // Ahora cada criterio, roto de uno en uno.
  const rompe = (campos, clave) => {
    const r = juzgar({ ...bueno, ...campos })
    ok(!r.pasa && r.fallan.includes(clave), `falla «${clave}» cuando toca`)
  }
  rompe({ ops: OPS_MINIMAS - 1 }, 'ops')
  rompe({ porRiesgo: -0.13 }, 'mejora') // igual que hoy no es mejor
  rompe({ mitad2: -0.12 }, 'mitades') // igual que hoy en una mitad
  rompe({ sinCostes: -0.033 }, 'noEsSoloPeaje') // sin costes no mejora → es el peaje
  rompe({ subeEnArranque: 1 }, 'atrSube') // limpiar no movió el ATR del arranque
  rompe({ senalesMes: 100 * MINIMO_DE_SEÑALES - 1 }, 'sigueHablando')
  rompe({ parMayor: TOPE_UN_PAR + 0.01 }, 'concentracion')

  // ⚠️ Y un campo que FALTA no se da por bueno.
  for (const clave of [
    'ops',
    'porRiesgo',
    'mitad1',
    'hoyPorRiesgo',
    'sinCostes',
    'hoySinCostes',
    'subeEnArranque',
    'senalesMes',
    'parMayor',
  ]) {
    const sin = { ...bueno }
    delete sin[clave]
    ok(!juzgar(sin).pasa, `sin «${clave}» NO pasa: un campo que falta no se da por bueno`)
  }
  ok(!juzgar({}).pasa, 'y un resultado vacío no pasa nada')
  ok(juzgar({}).fallan.length === 7, 'con nada, fallan los siete')

  // El criterio que más importa, dicho aparte porque es la razón del archivo:
  // una mejora que solo aparece con costes es el peaje, no la app.
  const soloPeaje = { ...bueno, sinCostes: -0.04, hoySinCostes: -0.033 }
  const rp = juzgar(soloPeaje)
  ok(
    !rp.pasa && rp.fallan.includes('noEsSoloPeaje'),
    'una mejora que EMPEORA sin costes se caza: es el stop más ancho diluyendo el spread',
  )
}

console.log('')
console.log('7. LA PREGUNTA DE SWING: ¿cuánto SUBE el ATR al quitar las horas cerradas?')
{
  // ⚠️ Esta pregunta NO es la de los bloques 4 y 5. Allí se compara un momento
  // de la serie contra otro (POSICIÓN); aquí, la misma serie con y sin las
  // horas cerradas (NIVEL). El `noSeMueve` del 2026-09-30 solo contesta la
  // primera, y usar su respuesta para la segunda sería el error que este
  // repositorio lleva meses documentando.
  const m = mercado()
  const r = cuantoSubeElATR(m.fechas, m.highs, m.lows, m.closes, { umbral: CAMBIO_MINIMO_ATR })
  ok(r !== null, 'con una serie completa devuelve algo')
  ok(r.velas > 100, `compara muchas velas de mercado (${r.velas})`)
  ok(r.velasQuitadas > 0, `y quita las cerradas (${r.velasQuitadas})`)

  // ⚠️⚠️ LA COMPROBACIÓN CENTRAL DE ESTE BLOQUE, Y ES LA QUE ME CORRIGIÓ A MÍ.
  //
  // En este mercado las horas cerradas son 5× más estrechas, o sea que el
  // efecto está puesto a propósito. Y la MEDIANA del cociente sale **1,000
  // exacto**: con el efecto delante, dice que no pasa nada.
  //
  // No es un fallo del código: `atrWilder` de esta app tiene una ventana DURA
  // de 60 velas, así que solo cambian las velas con horas cerradas dentro de su
  // ventana. Más de la mitad no puede cambiar y la mediana se queda clavada.
  //
  // 📌 Esta comprobación existe para que nadie vuelva a elegir la mediana como
  // la que decide. Si algún día sale distinta de 1, el motivo hay que
  // entenderlo antes de celebrarlo.
  ok(
    Math.abs(r.medianaDelCociente - 1) < 1e-9,
    `la MEDIANA del cociente sale 1 pese al efecto (${r.medianaDelCociente?.toFixed(4)}) — por eso NO decide`,
  )
  ok(r.p90 > 1.07, `pero el p90 sí lo ve (${r.p90?.toFixed(3)})`)
  ok(r.proporcionAfectada > 0.15, `y la PROPORCIÓN afectada también (${(100 * r.proporcionAfectada).toFixed(1)} %)`)
  ok(r.afectadas > 0 && r.afectadas < r.velas, 'la proporción no es ni 0 ni todo')
  ok(r.p10 != null && r.p90 != null && r.p10 <= r.medianaDelCociente && r.medianaDelCociente <= r.p90,
    'los cuantiles encierran a la mediana')
  ok(r.alFinal != null, 'y se mide también en la ÚLTIMA vela, que es la que la app usa hoy')
  // El stop de esta app ES 1,5 × ATR, así que sube en la misma proporción.
  ok(
    Math.abs(r.stopFinalLimpia / r.stopFinalHoy - r.alFinal) < 1e-9,
    'el stop sube exactamente lo que sube el ATR (aquí el ATR ES el stop entero)',
  )
  // El umbral entra como parámetro: el dueño del número es el listón.
  const rAlto = cuantoSubeElATR(m.fechas, m.highs, m.lows, m.closes, { umbral: 0.95 })
  ok(rAlto.proporcionAfectada < r.proporcionAfectada, 'con un umbral más alto hay menos velas afectadas')

  // Sin nada que quitar, las dos rejillas son la MISMA serie: el cociente es 1
  // exacto en TODAS las velas. Si saliera otra cosa, el emparejamiento por
  // fecha estaría mal.
  const limpio = mercadoSinFinDeSemana()
  const r2 = cuantoSubeElATR(limpio.fechas, limpio.highs, limpio.lows, limpio.closes, { umbral: CAMBIO_MINIMO_ATR })
  ok(r2 !== null, 'con una serie ya limpia también devuelve algo')
  ok(r2.velasQuitadas === 0, 'no hay nada que quitar')
  ok(r2.proporcionAfectada === 0, 'y entonces NINGUNA vela está afectada')
  ok(Math.abs(r2.p90 - 1) < 1e-12, 'ni el p90 se mueve')
  ok(veredictoPreguntaDeSwing(r2, { proporcionMinima: PROPORCION_MINIMA_AFECTADA }) === 'noSube',
    'una serie sin horas cerradas da «noSube»')
  ok(veredictoPreguntaDeSwing(r, { proporcionMinima: PROPORCION_MINIMA_AFECTADA }) === 'sube',
    'y una con horas cerradas 5× más estrechas da «sube»')

  // ⚠️ «No se pudo mirar» NO es «no sube».
  ok(veredictoPreguntaDeSwing(null) === null, 'sin datos devuelve null, no «noSube»')
  ok(veredictoPreguntaDeSwing({}) === null, 'sin la proporción afectada, null')
  // ⚠️ Y un objeto con la MEDIANA pero sin la proporción tampoco decide: es el
  // caso que habría dejado volver al estadístico equivocado por la puerta de
  // atrás.
  ok(veredictoPreguntaDeSwing({ medianaDelCociente: 1.5 }) === null, 'con la mediana sola NO decide')
  ok(cuantoSubeElATR([], [], [], []) === null, 'una serie vacía devuelve null y no revienta')

  // El umbral se DERIVA, no se copia de Swing.
  ok(CAMBIO_MINIMO_ATR === 0.07, 'el umbral de esta app es 7 %, no el 2 % de Swing')
  ok(PROPORCION_MINIMA_AFECTADA === 0.15, 'y hace falta que afecte al 15 % de las velas')
  ok(TECHO_ESTRUCTURAL_MEDIDO > PROPORCION_MINIMA_AFECTADA,
    'el umbral está por debajo del techo estructural medido (si no, sería imposible de pasar)')
  ok(MAYORIA_DIVISAS === 0.7, 'y mayoría de divisas: es la misma rejilla para las siete')
  for (const k of ['sube', 'noSube']) {
    ok(typeof QUE_DICE_LA_PREGUNTA_DE_SWING[k] === 'string' && QUE_DICE_LA_PREGUNTA_DE_SWING[k].length > 40,
      `«${k}» está escrito ANTES de los números`)
  }
}

console.log('8. los cuantiles')
{
  ok(cuantil([1, 2, 3, 4, 5], 0.5) === 3, 'la mediana sale bien')
  ok(cuantil([1, 2, 3, 4, 5], 0) === 1, 'el mínimo también')
  ok(cuantil([1, 2, 3, 4, 5], 1) === 5, 'y el máximo')
  ok(Math.abs(cuantil([0, 10], 0.1) - 1) < 1e-12, 'interpola entre dos valores')
  // `null` y no 0: un 0 diría «el valor es cero», que es una afirmación.
  ok(cuantil([], 0.5) === null, 'sin datos devuelve null, no 0')
  ok(cuantil(undefined, 0.5) === null, 'sin array, null')
  ok(cuantil([1, NaN, 3], 0.5) === 2, 'los no finitos no cuentan')
}

console.log('')
console.log('9. EL MECANISMO CANDIDATO, medido — y REFUTADO')
{
  // Mi explicación de por qué el ATR apenas se mueve habiendo quitado un
  // 25,8 % de velas 5× más estrechas: al limpiar, la primera vela de la semana
  // mediría su rango contra el cierre del VIERNES y se comería el hueco del
  // fin de semana.
  //
  // ⚠️⚠️ ES FALSA, y la desmiente esta misma comprobación: en la rejilla limpia
  // de esta app **la FRONTERA se conserva** (domingo 21:00-23:00 UTC), así que
  // la vela anterior a la apertura es LA MISMA en las dos rejillas. No hay
  // ningún hueco que comerse. Décimo mecanismo convincente de este proyecto
  // que resulta falso al medirlo, y el segundo en dos días.
  const m = mercado()
  const h = huecoDeApertura(m.fechas, m.highs, m.lows, m.closes)
  ok(h !== null, 'devuelve algo con una serie completa')
  ok(h.arranques > 5, `mira varios arranques de semana (${h.arranques})`)
  ok(
    h.conPrevioDistinto === 0,
    `en NINGÚN arranque cambia el cierre previo (${h.conPrevioDistinto} de ${h.arranques}) — la frontera hace de puente`,
  )
  ok(Math.abs(h.medianaVeces - 1) < 1e-9, 'y por eso el rango de la primera vela es el MISMO en las dos rejillas')
  // La pieza que mantiene esto verificable: las dos fechas van en cada fila.
  ok(h.filas.every((f) => f.previoHoy && f.previoLimpia), 'cada fila lleva las DOS fechas del cierre previo')
  ok(huecoDeApertura([], [], [], []) === null, 'una serie vacía devuelve null')
  // ⚠️ Y que el listón no ascienda la hipótesis a resultado. Si alguien la
  // sube, esta comprobación falla y hay que venir a borrarla a mano.
  ok(/REFUTADA/.test(MECANISMO_CANDIDATO), 'el listón dice que la hipótesis está REFUTADA, no pendiente')
  ok(/ventana dura de 60/.test(MECANISMO_CANDIDATO), 'y nombra la explicación que SÍ está medida')
}

console.log('')
if (fallos) {
  console.error(`✗ ${fallos} de ${hechas} comprobaciones fallaron.`)
  process.exit(1)
}
console.log(`✓ todo bien (${hechas} comprobaciones).`)
