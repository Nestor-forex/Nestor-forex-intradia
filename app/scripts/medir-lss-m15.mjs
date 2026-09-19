// El NFX-LSS medido sobre velas de 15 MINUTOS.
//
// Lo pidió Néstor el 2026-09-18 («agrega M15 como lo recomienda el código no
// importa que cobre créditos»), y la guía de su indicador efectivamente
// recomienda marcos cortos para el barrido de liquidez.
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO ES UN GUION APARTE Y NO UNA SECCIÓN MÁS DE `backtest.mjs`
// ─────────────────────────────────────────────────────────────────────────
// Porque cuesta CRÉDITOS y el banco de pruebas se lanza a menudo. Bajar el
// M15 de tres años son 16 tandas de 7 símbolos = 112 créditos de los 800 del
// día, más los 343 que el proyecto ya gasta solo. Meterlo dentro del banco
// obligaría a pagarlos cada vez que alguien quiere mirar otra cosa.
//
// ⚠️ Y por eso su workflow es SOLO A MANO. No hay cron.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ LO QUE NO SE PUEDE HACER CON ESTA TABLA: COMPARARLA CON LA DE H1
// ─────────────────────────────────────────────────────────────────────────
// Un pivote de 4 velas son CUATRO HORAS en H1 y UNA HORA en M15. La misma
// cifra escrita en la misma casilla significa dos cosas distintas, así que
// poner las dos tablas una al lado de la otra y leer «en M15 sale mejor» sería
// comparar dos reglas diferentes.
//
// Por eso aquí se miden LAS DOS lecturas, y cada fila dice a cuánto tiempo de
// reloj equivale:
//
//   · MISMO NÚMERO DE VELAS que en H1 (pivote 4) → la misma FORMA de la regla,
//     aplicada a un mercado cuatro veces más fino.
//   · MISMO TIEMPO DE RELOJ que en H1 (pivote 16) → la misma pregunta al
//     mercado, contestada con más detalle dentro de cada hora.
//
// Sin esa distinción escrita en la propia tabla, el número se lee mal. Es la
// misma lección que «una etiqueta equivocada es un error de medición».
//
// ⚠️ Solo los 7 pares DIRECTOS, por lo mismo que en el banco: los once cruces
// se derivan, sus mechas salen infladas y el barrido se define POR LA MECHA.
//
// ⚠️ Nada de esto enciende nada. No toca `marketCalc.js`, no cambia ninguna
// señal y no se ve en la app.

import { leerLlave, obtenerVelas } from './lib/velas.mjs'
import { senalesLSSBanco, datosExactos, DIRECTOS } from './lib/lss-banco.mjs'
import { resolver } from './lib/resolver.mjs'
import { medir, barridoSwap } from './lib/backtest-nucleo.mjs'

// 5000 velas de 15 minutos son unos 52 días de mercado. 16 tandas ≈ 2 años y
// medio, que es lo que cabe sin pasarse del cupo diario.
// El workflow puede mandar una cadena vacía (nadie tocó la casilla) o algo que
// no es un número. Cualquiera de las dos cosas cae en 16 en vez de en cero
// tandas, que descargaría nada y daría una tabla vacía sin decir por qué.
const pedidas = Math.floor(Number(process.env.LSS_M15_PAGINAS))
const PAGINAS = Number.isFinite(pedidas) && pedidas >= 1 ? pedidas : 16
const VELAS_TANDA = 5000

// Velas iniciales sin señal. En H1 el banco usa 300 (unos 12 días); aquí 1200
// es el MISMO tiempo de reloj, que es lo que hace justa la comparación.
const CALENTAMIENTO = 1200

const ac = (x) => (x === null ? '  — ' : (x.toFixed(0) + '%').padStart(4))
const pr = (x) => (x === null ? '   —  ' : ((x >= 0 ? '+' : '') + x.toFixed(2)).padStart(6))
const RAYA = '─'.repeat(92)
const CAB = 'qué se midió                       ops   acierto  equil.   por 1R  │  1ª mit  │  2ª mit'

async function main() {
  console.log('')
  console.log('EL NFX-LSS SOBRE VELAS DE 15 MINUTOS')
  console.log(RAYA)
  console.log(`Bajando ${PAGINAS} tandas de ${VELAS_TANDA} velas M15 de ${DIRECTOS.length} símbolos.`)
  console.log(`Cuesta ${PAGINAS * 7} créditos de Twelve Data y tarda ~${PAGINAS} minutos`)
  console.log('(el plan gratuito da 8 créditos por minuto, así que hay una pausa entre tandas).')

  const t0 = Date.now()
  const { barras, rates, rangos } = await obtenerVelas(leerLlave(import.meta.url), {
    intervalo: '15min',
    velas: VELAS_TANDA,
    paginas: PAGINAS,
    minBarras: CALENTAMIENTO + 500,
  })
  console.log(`\n✓ ${barras.length} velas M15, de ${barras[0]} a ${barras[barras.length - 1]}`)
  console.log(`  (${((Date.now() - t0) / 60000).toFixed(1)} minutos de descarga)`)

  const corte = barras[Math.floor((CALENTAMIENTO + barras.length) / 2)]
  const datos = datosExactos(barras, rates, rangos)

  const correr = (op) => {
    const senales = senalesLSSBanco(barras, rates, rangos, { calentamiento: CALENTAMIENTO, ...op })
    const { resultados } = resolver(senales, datos)
    return { senales, porClave: new Map(resultados.map((r) => [r.clave, r])) }
  }

  const linea = (nombre, r, filtro = null) => {
    const ss = filtro ? r.senales.filter(filtro) : r.senales
    const m = medir(ss, r.porClave, { conSpread: true })
    const m1 = medir(ss.filter((x) => x.vela < corte), r.porClave, { conSpread: true })
    const m2 = medir(ss.filter((x) => x.vela >= corte), r.porClave, { conSpread: true })
    const eq = m.equilibrio === null ? '  — ' : `${m.equilibrio.toFixed(0).padStart(3)}%`
    console.log(
      `${nombre.padEnd(34)} ${String(m.total).padStart(5)}   ${ac(m.acierto)}  ${eq}  ${pr(m.porRiesgo)}  │ ` +
        `${String(m1.total).padStart(4)} ${pr(m1.porRiesgo)} │ ${String(m2.total).padStart(4)} ${pr(m2.porRiesgo)}`
    )
  }

  // Los mismos que en H1, para que la FORMA de la regla sea idéntica.
  const IGUAL_VELAS = { swingLen: 4, sweepWindow: 6 }
  // Y los que ocupan el mismo tiempo de reloj: 4 velas de H1 son 16 de M15.
  const IGUAL_RELOJ = { swingLen: 16, sweepWindow: 24 }

  console.log('')
  console.log('⚠️ Todas las filas llevan el spread por par descontado.')
  console.log(`⚠️ Solo los ${DIRECTOS.length} pares DIRECTOS: en los cruces la mecha se deriva.`)
  console.log(`Las dos mitades se parten en ${corte}.`)

  console.log('')
  console.log('1) CON LA VARA NEUTRA 1:1 — ésta es la que decide')
  console.log('⚠️ NO comparar estas cifras con la tabla de H1 sin leer la nota de')
  console.log('   abajo: «pivote 4» no significa lo mismo en los dos sitios.')
  console.log(CAB)
  console.log(RAYA)

  const mismaForma = correr({ ...IGUAL_VELAS, rr: 1 })
  console.log('· MISMO NÚMERO DE VELAS que en H1 (pivote 4 = 1 hora de reloj)')
  linea('  NFX-LSS tal como lo propuso', mismaForma)
  linea('    solo las COMPRA', mismaForma, (x) => x.lado === 'COMPRA')
  linea('    solo las VENTA', mismaForma, (x) => x.lado === 'VENTA')
  linea('    solo los CHoCH (giro)', mismaForma, (x) => x.evento === 'CHoCH')
  linea('    solo los BOS (continuación)', mismaForma, (x) => x.evento === 'BOS')

  const mismoReloj = correr({ ...IGUAL_RELOJ, rr: 1 })
  console.log('· MISMO TIEMPO DE RELOJ que en H1 (pivote 16 = 4 horas)')
  linea('  NFX-LSS, pivote 16 / ventana 24', mismoReloj)
  linea('    solo las COMPRA', mismoReloj, (x) => x.lado === 'COMPRA')
  linea('    solo las VENTA', mismoReloj, (x) => x.lado === 'VENTA')
  linea('    solo los CHoCH (giro)', mismoReloj, (x) => x.evento === 'CHoCH')
  linea('    solo los BOS (continuación)', mismoReloj, (x) => x.evento === 'BOS')

  console.log(RAYA)
  console.log('⚠️ NO hay fila «la app» aquí: la app trabaja con velas de una hora,')
  console.log('   así que sobre M15 no existe. Su número está en el banco normal.')

  console.log('')
  console.log('2) ¿EL BARRIDO APORTA ALGO? (vara neutra)')
  console.log('Si exigir el barrido no mejora nada, el indicador es una ruptura de')
  console.log('estructura con pasos de más. En H1 y en Swing no aportaba.')
  console.log(CAB)
  console.log(RAYA)
  linea('con barrido, pivote 4', mismaForma)
  linea('CONTROL: solo la ruptura, pivote 4', correr({ ...IGUAL_VELAS, rr: 1, exigirSweep: false }))
  linea('con barrido, pivote 16', mismoReloj)
  linea('CONTROL: solo la ruptura, pivote 16', correr({ ...IGUAL_RELOJ, rr: 1, exigirSweep: false }))

  console.log('')
  console.log('3) LOS VECINOS DE CADA PARÁMETRO (vara neutra)')
  console.log('Si solo funciona un valor y los de al lado se caen, está ajustado a')
  console.log('estas velas y no sirve fuera.')
  console.log(CAB)
  console.log(RAYA)
  console.log('· Sensibilidad del pivote (ventana 6)')
  for (const k of [3, 4, 6, 8, 12, 16, 24]) {
    const reloj = (k * 15) / 60
    linea(`  pivote ${String(k).padStart(2)}  (${reloj < 1 ? `${k * 15} min` : `${reloj} h`})`, correr({ sweepWindow: 6, rr: 1, swingLen: k }))
  }
  console.log('· Ventana entre el barrido y la ruptura (pivote 4)')
  for (const w of [3, 6, 12, 24, 48]) {
    const reloj = (w * 15) / 60
    linea(`  ventana ${String(w).padStart(2)}  (${reloj < 1 ? `${w * 15} min` : `${reloj} h`})`, correr({ swingLen: 4, rr: 1, sweepWindow: w }))
  }

  console.log('')
  console.log('4) DÓNDE PONER EL OBJETIVO (pivote 4)')
  console.log('⚠️ Aquí el acierto NO se puede comparar entre filas: cada ratio tiene')
  console.log('   su propia vara. Mirar «equil.» y «por 1R», no el acierto.')
  console.log(CAB)
  console.log(RAYA)
  for (const r of [1, 1.5, 2, 3]) {
    linea(`  objetivo ${r}× el riesgo`, correr({ ...IGUAL_VELAS, rr: r }))
  }

  console.log('')
  console.log('5) PAGANDO LAS NOCHES (vara neutra, pivote 4)')
  console.log('⚠️ En M15 las operaciones son más cortas, pero el swap NO se deduce')
  console.log('   de la duración: se cuenta por los cortes reales de las 22:00 UTC.')
  {
    const b = barridoSwap(mismaForma.senales, mismaForma.porClave)
    if (!b.total) {
      console.log('  (sin operaciones resueltas)')
    } else {
      // ⚠️ `barridoSwap` NO devuelve lo mismo en las dos apps, y por escribir
      // aquí los nombres de Swing (`mediana`, `media`) esta tabla reventó en
      // su primera corrida — después de gastar los 112 créditos.
      //
      // El motivo es real y no un capricho: en Swing cada vela ES un día, así
      // que las noches salen de cuánto duró la operación. Aquí NO — una de 6
      // horas abierta a las 20:00 cruza el corte y una de 20 horas abierta a
      // las 23:00 no cruza ninguno. Por eso allá informa de la DURACIÓN y aquí
      // de cuántas cruzaron y cuántas noches de media.
      console.log(
        `  ${b.total} ops · ${b.cruzaron} cruzaron alguna noche ` +
          `(${Math.round((b.cruzaron / b.total) * 100)} %), ${b.mediaNoches.toFixed(2)} noches de media`
      )
      console.log('     swap/noche      acierto   por 1R   coste medio')
      const sinNada = medir(mismaForma.senales, mismaForma.porClave)
      console.log(`     sin costes      ${ac(sinNada.acierto)}   ${pr(sinNada.porRiesgo)}         —`)
      for (const { nivel, medicion: m, costeMedio } of b.filas) {
        const etiqueta = nivel === 0 ? 'solo spread' : `+ ${nivel.toFixed(2)} pips`
        console.log(`     ${etiqueta.padEnd(15)} ${ac(m.acierto)}   ${pr(m.porRiesgo)}   ${costeMedio.toFixed(1)} pips`)
      }
    }
  }

  console.log('')
  console.log(RAYA)
  console.log('CÓMO LEER ESTO, EN UNA LÍNEA')
  console.log('Lo que decide es «por 1R» de la vara neutra, y que las DOS mitades')
  console.log('vayan en el mismo sentido. Un número bueno en una mitad y malo en la')
  console.log('otra es ruido, no una regla.')
  console.log(RAYA)
  console.log('')
}

main().catch((e) => {
  console.error('\n✗ ' + (e?.message || e))
  process.exit(1)
})
