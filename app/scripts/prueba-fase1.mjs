// Prueba del listón de la Fase 1. Sin internet.
//
// Correr con: node scripts/prueba-fase1.mjs

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  juzgar,
  VENTANA_NY,
  MEJORA_MINIMA,
  SENALES_MES_MINIMAS,
  CONCENTRACION_MAXIMA,
  FECHA_REDACCION,
} from './lib/preregistro-fase1.mjs'

let fallos = 0
const comprobar = (que, cond) => {
  console.log(`${cond ? '  OK  ' : '  MAL '} ${que}`)
  if (!cond) fallos++
}

const bueno = () => ({
  app: { porRiesgo: -0.1 },
  retroceso: { porRiesgo: 0.01, senalesMes: 20 },
  ventana: { porRiesgo: 0.02, senalesMes: 10 },
  rsi: { porRiesgo: 0.02, senalesMes: 17 },
  fase1: {
    porRiesgo: 0.05,
    porRiesgo1aMitad: 0.04,
    porRiesgo2aMitad: 0.06,
    ops: 900,
    senalesMes: 12,
    porRiesgoConSwap: 0.03,
  },
  concentracion: 0.25,
})

console.log('\n1. El caso bueno pasa, y los seis criterios muerden')
comprobar('el caso bueno PASA', juzgar(bueno()).pasa === true)

const roto = (f) => {
  const r = bueno()
  f(r)
  return juzgar(r)
}
comprobar('si NO gana con costes → falla', roto((r) => (r.fase1.porRiesgo = -0.01)).pasa === false)
comprobar(
  'si pierde en una mitad → falla',
  roto((r) => (r.fase1.porRiesgo2aMitad = -0.01)).pasa === false
)
comprobar(
  'si las condiciones añadidas no aportan nada → falla',
  roto((r) => (r.retroceso.porRiesgo = 0.045)).pasa === false
)
comprobar('si deja pocas señales → falla', roto((r) => (r.fase1.senalesMes = 4)).pasa === false)
comprobar('si el swap se la come → falla', roto((r) => (r.fase1.porRiesgoConSwap = -0.01)).pasa === false)
comprobar('si un par aporta el 90 % → falla', roto((r) => (r.concentracion = 0.9)).pasa === false)
comprobar('sin concentración medida → falla', roto((r) => (r.concentracion = null)).pasa === false)
comprobar('sin filas que comparar → falla', juzgar({}).pasa === false)

console.log('\n2. ⚠️ Los bordes exactos, para que el umbral signifique lo que dice')
// Justo en el umbral PASA (la mejora es `>= MEJORA_MINIMA`); justo por debajo,
// no. Sin esta pareja, un cambio de `>=` a `>` pasaría inadvertido.
{
  const justo = bueno()
  justo.retroceso.porRiesgo = justo.fase1.porRiesgo - MEJORA_MINIMA
  comprobar(`una mejora de exactamente ${MEJORA_MINIMA} PASA`, juzgar(justo).pasa === true)
  const casi = bueno()
  casi.retroceso.porRiesgo = casi.fase1.porRiesgo - MEJORA_MINIMA + 0.001
  comprobar('una mejora un pelo por debajo NO pasa', juzgar(casi).pasa === false)
}
{
  const justo = bueno()
  justo.fase1.senalesMes = SENALES_MES_MINIMAS
  comprobar(`exactamente ${SENALES_MES_MINIMAS} señales/mes PASA`, juzgar(justo).pasa === true)
}

console.log('\n3. ⚠️ Un CERO exacto no gana: no pasa')
// «No perder» no es «ganar», y con costes ya descontados un 0,000 significa
// que la regla no aporta nada. El criterio dice `> 0` a propósito.
comprobar('porRiesgo = 0 → falla', roto((r) => (r.fase1.porRiesgo = 0)).pasa === false)
comprobar('con swap = 0 → falla', roto((r) => (r.fase1.porRiesgoConSwap = 0)).pasa === false)
comprobar(
  'una mitad en 0 exacto → falla',
  roto((r) => (r.fase1.porRiesgo1aMitad = 0)).pasa === false
)

console.log('\n4. La mejora sobre la app se informa, y no es un criterio')
// A propósito: mejorar sobre algo que pierde no es ganar. Se calcula para
// contarlo, pero el veredicto no lo mira.
{
  const r = bueno()
  const v = juzgar(r)
  comprobar('se informa la mejora sobre la app', Math.abs(v.mejoraSobreApp - 0.15) < 1e-9)
  const sinApp = bueno()
  delete sinApp.app
  comprobar('y sin la fila de la app sigue PASANDO', juzgar(sinApp).pasa === true)
  comprobar('aunque la mejora salga null', juzgar(sinApp).mejoraSobreApp === null)
}

console.log('\n5. Los números del listón son los que el informe promete')
comprobar(`la fecha de redacción está puesta (${FECHA_REDACCION})`, /^\d{4}-\d{2}-\d{2}$/.test(FECHA_REDACCION))
comprobar('la ventana es 12-16 UTC', VENTANA_NY.desde === 12 && VENTANA_NY.hasta === 16)
comprobar('la mejora mínima es 0.02', MEJORA_MINIMA === 0.02)
comprobar('la concentración máxima es el 40 %', CONCENTRACION_MAXIMA === 0.4)

console.log('\n6. ⚠️⚠️ La ventana del guion es la MISMA que la ya medida en backtest.mjs')
// `enSolape` existe en `backtest.mjs` desde el 2026-09-05 y con ella se midió
// la fila R4. Si el guion de la Fase 1 usara otra ventana, las dos tablas no
// se podrían comparar y nadie lo notaría — los dos números seguirían saliendo.
{
  const bt = readFileSync(fileURLToPath(new URL('./backtest.mjs', import.meta.url)), 'utf8')
  const m = /const enSolape = \(h\) => h >= (\d+) && h < (\d+)/.exec(bt)
  comprobar('`enSolape` sigue existiendo en backtest.mjs', m !== null)
  comprobar(
    `y coincide con VENTANA_NY (${VENTANA_NY.desde}-${VENTANA_NY.hasta})`,
    m !== null && Number(m[1]) === VENTANA_NY.desde && Number(m[2]) === VENTANA_NY.hasta
  )
}

console.log('\n7. ⚠️ El preregistro dice por escrito lo que NO mide, y por qué')
// Las dos exclusiones son decisiones, no olvidos, y si alguien las borra hay
// que enterarse: sin ellas este guion parecería medir «la estrategia entera».
{
  const pre = readFileSync(fileURLToPath(new URL('./lib/preregistro-fase1.mjs', import.meta.url)), 'utf8')
  comprobar('explica por qué el ORO no entra', /ORO NO ENTRA/.test(pre) && /no es una divisa/i.test(pre))
  comprobar('explica por qué el H4 no se mide', /H4 DE CONTEXTO NO SE MIDE/.test(pre))
  comprobar(
    'y dice que la entrada YA EXISTE (no es una estrategia nueva)',
    /YA EXISTE Y YA CORRE/.test(pre)
  )
}

console.log('\n8. ⚠️ El guion no reescribe la regla cuatro veces')
// Una copia por fila, con una condición cambiada en cada una, es la forma más
// fácil de que una diga algo distinto de lo que su rótulo promete. Tiene que
// haber UNA regla parametrizada.
{
  const g = readFileSync(fileURLToPath(new URL('./medir-fase1.mjs', import.meta.url)), 'utf8')
  const vecesQueApareceElPatron = (g.match(/p\.e9 > p\.e21 && p\.dif > thr/g) ?? []).length
  comprobar(
    `la condición del retroceso está escrita UNA vez (está ${vecesQueApareceElPatron})`,
    vecesQueApareceElPatron === 1
  )
  comprobar('y la regla se parametriza', /reglaFase1\s*=/.test(g) && /conVentana/.test(g) && /conRSI/.test(g))
}

console.log(fallos === 0 ? '\n✓ todo bien.\n' : `\n✗ ${fallos} comprobación(es) fallaron.\n`)
process.exit(fallos === 0 ? 0 : 1)
