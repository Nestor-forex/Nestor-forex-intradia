// Prueba de la tarjeta «lo que señaló la regla en pruebas». Sin internet:
//
//     node scripts/prueba-senales-sombra.mjs
//
// Las formas en que esta pantalla puede MENTIR sin que falle nada, y que esto
// vigila:
//
//   1. **enseñar una señal vieja como si fuera de ahora**. El vigía corre de
//      lunes a viernes y el reloj de GitHub ya le costó horas enteras, así que
//      lo último anotado puede ser de hace días. Por eso se agrupa por la VELA
//      y se enseña su hora, y por eso la palabra «hoy» no aparece en ningún
//      texto;
//   2. **leer el campo de la app hermana**. Aquí las señales traen `vela`
//      ("2026-10-15 22:00:00") y en Swing traen `cierre` ("2026-10-15"). Una
//      copia del archivo de allá leería un campo que aquí no existe y dejaría
//      la tarjeta vacía sin dar ningún error;
//   3. **correr la hora cinco horas**. `new Date("2026-10-15 22:00:00")` la lee
//      como hora LOCAL del teléfono. Si se escribiera a mano en vez de usar
//      `aFechaUTC`, la hora saldría mal y sería perfectamente creíble;
//   4. **esconder una regla que no ha señalado**, que es cómo se fabrica un
//      espejismo: en pantalla quedaría solo lo que parece estar pasando algo;
//   5. **meter una señal sin tasa publicada en uno de los dos montones del
//      carry**, o sea leer un hueco de datos como un hecho sobre el mercado;
//   6. **perder el aviso de que esto NO es lo que la app propone**, que es lo
//      único que separa esta tarjeta de una lista de recomendaciones.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
  REGLAS_SOMBRA,
  hayAlgoQueEnsenar,
  instanteDe,
  senalesDeLaUltimaVela,
  velaDe,
} from '../src/lib/senalesSombra.js'
import { carryDeSenal } from '../src/lib/carrySenal.js'
import { monedasDe } from '../src/lib/pairs.js'
import { UMBRAL_NEUTRO } from '../src/lib/tasas.js'

let fallos = 0
const ok = (bien, que) => {
  console.log(`  ${bien ? 'OK  ' : 'MAL '} ${que}`)
  if (!bien) fallos++
}

const senal = (x) => ({
  id: `${x.par}|${x.lado}|${x.tipo}`,
  vistoEl: `${String(x.vela).slice(0, 10)}T22:23:48.918Z`,
  sombra: true,
  ...x,
})

console.log('\n1. La lista de reglas va A MANO, y aquí solo hay UNA')
{
  ok(Object.isFrozen(REGLAS_SOMBRA), 'está congelada: no se le añade nada en caliente')
  ok(REGLAS_SOMBRA.includes('retroceso'), 'incluye `retroceso`, que es la que el vigía anota aquí')
  // ⚠️ Las tres de Swing están MEDIDAS EN ESTA APP y pierden («comprar la
  // caída», −0,08 plano en los tres tamaños). No están porque no deben estar,
  // y si alguien las añade tiene que venir aquí a borrar esta comprobación.
  for (const r of ['reversion', 'caida', 'lss', 'bollinger']) {
    ok(!REGLAS_SOMBRA.includes(r), `⚠️ NO incluye \`${r}\`: medida aquí y perdiendo`)
  }
  // ⚠️ `tendencia` y `rango` son las dos mitades de la regla de la propia app.
  // Una señal suya marcada como sombra es una señal pausada, no un experimento.
  for (const r of ['tendencia', 'rango']) {
    ok(!REGLAS_SOMBRA.includes(r), `⚠️ NO incluye \`${r}\`: es la regla de la app, no un experimento`)
  }
}

console.log('\n2. La vela sale de `vela`, NO de `cierre` ni de cuándo corrió el vigía')
{
  ok(
    velaDe({ vela: '2026-10-15 22:00:00', vistoEl: '2026-10-15T22:23:48.918Z' }) === '2026-10-15 22:00:00',
    'manda `vela` sobre `vistoEl`'
  )
  // ⚠️ LA COMPROBACIÓN QUE SEPARA ESTA APP DE SWING. Si alguien copiara el
  // archivo de allá, leería `cierre` y aquí no existe: cero señales y cero
  // errores.
  ok(velaDe({ cierre: '2026-10-15' }) === null, '⚠️ `cierre` (el campo de Swing) NO vale: aquí no existe')
  ok(
    velaDe({ vistoEl: '2026-10-15T22:23:48.918Z' }) === '2026-10-15T22:23:48.918Z',
    'sin `vela` se cae a `vistoEl` (líneas viejas), en vez de descartar la señal'
  )
  ok(velaDe({}) === null, 'sin ninguna de las dos devuelve null')
  ok(velaDe({ vela: 'basura' }) === null, 'con basura dentro devuelve null, no una hora inventada')
}

console.log('\n3. La hora se lee como UTC, no como hora local del teléfono')
{
  // ⚠️ Twelve Data manda "2026-10-15 22:00:00" sin zona. `new Date()` la leería
  // como LOCAL: cinco horas corridas en Colombia, y el renglón saldría
  // perfectamente creíble. Por eso `instanteDe` pasa por `aFechaUTC`.
  const d = instanteDe({ vela: '2026-10-15 22:00:00' })
  ok(d instanceof Date, 'devuelve una fecha de verdad')
  ok(instanteDe({}) === null, 'sin vela devuelve null, nunca una fecha inventada')
  ok(instanteDe({ vela: 'basura' }) === null, 'con basura devuelve null')

  // ⚠️⚠️ ESTO SE COMPRUEBA EN OTRA ZONA HORARIA, Y NO ES UN CAPRICHO.
  //
  // La primera versión de este bloque pedía `d.toISOString() === '…22:00Z'` y
  // **NO MORDÍA**: se le puso el fallo a propósito (`new Date(v)` en vez de
  // `aFechaUTC`) y las 44 comprobaciones siguieron en verde. El motivo es que
  // esta máquina corre en UTC, donde las dos lecturas dan exactamente lo mismo,
  // así que la comprobación no podía distinguirlas NUNCA aquí — y el fallo que
  // vigila solo aparece en el teléfono de quien mira, que no está en UTC.
  //
  // Por eso se lanza un proceso aparte con la zona forzada a la de Néstor. Así
  // muerde en cualquier máquina, corra donde corra.
  const fuera = execFileSync(
    process.execPath,
    [
      '-e',
      `import('${new URL('../src/lib/senalesSombra.js', import.meta.url).href}')
         .then((m) => console.log(m.instanteDe({ vela: '2026-10-15 22:00:00' }).toISOString()))`,
    ],
    { env: { ...process.env, TZ: 'America/Bogota' }, encoding: 'utf8' }
  ).trim()

  ok(
    fuera === '2026-10-15T22:00:00.000Z',
    `⚠️ con la zona en Bogotá, la vela de las 22:00 sigue siendo las 22:00 UTC (salió ${fuera})`
  )

  // Y la prueba de que esa zona de verdad desplaza: leída a pelo allí, la misma
  // cadena da OTRO instante. Si esto dejara de cumplirse, la comprobación de
  // arriba habría vuelto a ser inofensiva y hay que mirar por qué.
  const aPelo = execFileSync(
    process.execPath,
    ['-e', "console.log(new Date('2026-10-15 22:00:00').toISOString())"],
    { env: { ...process.env, TZ: 'America/Bogota' }, encoding: 'utf8' }
  ).trim()

  ok(
    aPelo !== fuera,
    `la zona forzada SÍ desplaza, o sea que lo de arriba comprueba algo (a pelo dio ${aPelo})`
  )
}

console.log('\n4. La regla trae las señales de SU última vela, no las de todo el día')
{
  // ⚠️ Lo que esto vigila es justo la diferencia con Swing: allá agrupar por día
  // y por vela es lo mismo; aquí, agrupar por día metería estas tres juntas.
  const lista = [
    senal({ par: 'EUR/USD', lado: 'COMPRA', tipo: 'retroceso', vela: '2026-10-15 09:00:00' }),
    senal({ par: 'USD/JPY', lado: 'VENTA', tipo: 'retroceso', vela: '2026-10-15 22:00:00' }),
    senal({ par: 'AUD/JPY', lado: 'VENTA', tipo: 'retroceso', vela: '2026-10-15 22:00:00' }),
  ]
  const [g] = senalesDeLaUltimaVela(lista)

  ok(g.vela === '2026-10-15 22:00:00', 'se queda con la vela MÁS RECIENTE de esa regla')
  ok(g.senales.length === 2, `solo las de esa vela: 2 (salieron ${g.senales.length})`)
  ok(
    !g.senales.some((s) => s.par === 'EUR/USD'),
    '⚠️ la de las 09:00 NO se cuela: es otra vela y otra sesión, no «el mismo día»'
  )
  ok(
    g.senales[0].par === 'AUD/JPY' && g.senales[1].par === 'USD/JPY',
    'ordenadas por par: dos cargas de la pantalla dan la misma lista'
  )
}

console.log('\n5. Una regla sin señales SIGUE SALIENDO')
{
  const grupos = senalesDeLaUltimaVela([], ['retroceso', 'inventada'])
  ok(grupos.length === 2, 'devuelve todas las reglas pedidas, hayan señalado o no')
  ok(
    grupos.every((g) => g.vela === null && g.senales.length === 0),
    'con vela null y lista vacía, para que la pantalla diga «todavía nada»'
  )

  // ⚠️ Esconderla sería dejar en pantalla solo lo que parece estar pasando
  // algo, que es cómo se fabrica un espejismo. Misma decisión que los grupos
  // con n = 0 de `Diagnostico`.
  const unaSi = [senal({ par: 'EUR/USD', lado: 'COMPRA', tipo: 'retroceso', vela: '2026-10-15 22:00:00' })]
  const mixto = senalesDeLaUltimaVela(unaSi, ['retroceso', 'inventada'])
  ok(mixto.length === 2, 'y con una que sí señaló, la otra NO desaparece')
  ok(mixto[1].senales.length === 0, 'la que no señaló sale vacía, no se omite')
}

console.log('\n6. Sin NINGUNA señal, la tarjeta entera no se pinta')
{
  ok(!hayAlgoQueEnsenar(senalesDeLaUltimaVela([])), 'sin señales no hay nada que enseñar')
  ok(!hayAlgoQueEnsenar(null), 'y con entrada nula tampoco revienta')
  ok(
    hayAlgoQueEnsenar(
      senalesDeLaUltimaVela([senal({ par: 'EUR/USD', lado: 'COMPRA', tipo: 'retroceso', vela: '2026-10-15 22:00:00' })])
    ),
    'con una sola señal, sí se pinta'
  )
}

console.log('\n7. El carry: `null` es «no se sabe» y NUNCA cae en «en contra»')
{
  const tasas = { USD: { v: 3.875, f: '2026-10-01' }, JPY: { v: 1, f: '2026-10-01' } }
  const s = (par, lado) => ({ par, lado })

  // USD paga 3,875 y JPY 1: el diferencial favorece comprar USD/JPY.
  ok(carryDeSenal(s('USD/JPY', 'COMPRA'), tasas, monedasDe) === 'aFavor', 'comprar la divisa que paga más va a favor')
  ok(carryDeSenal(s('USD/JPY', 'VENTA'), tasas, monedasDe) === 'enContra', 'y venderla va en contra')

  // ⚠️ LA QUE IMPORTA. Si una señal sin tasa publicada cayera en un montón, un
  // hueco de datos se leería como un hecho sobre el mercado. Misma decisión que
  // `pearson` devolviendo `null` en vez de 0.
  ok(carryDeSenal(s('EUR/GBP', 'COMPRA'), tasas, monedasDe) === null, '⚠️ sin tasa de las dos divisas → null')
  ok(carryDeSenal(s('USD/JPY', 'COMPRA'), null, monedasDe) === null, 'sin tasas ningunas → null')
  ok(carryDeSenal({}, tasas, monedasDe) === null, 'sin par ni lado → null')

  // La banda neutra NO se recalcula aquí: sale de `tasas.js`, que es el mismo
  // archivo en las dos apps. Tenerla dos veces es el fallo del umbral de fuerza
  // en nueve sitios.
  const casi = { USD: { v: 3, f: 'x' }, JPY: { v: 3 - UMBRAL_NEUTRO / 2, f: 'x' } }
  ok(carryDeSenal(s('USD/JPY', 'COMPRA'), casi, monedasDe) === 'neutro', 'dentro de la banda neutra dice «neutro»')
}

console.log('\n8. Los textos: el aviso existe, está antes de todo, y no dice «hoy»')
{
  const jsx = readFileSync(new URL('../src/components/SenalesSombra.jsx', import.meta.url), 'utf8')
  const es = readFileSync(new URL('../src/lib/i18n/textos/es.js', import.meta.url), 'utf8')

  const iAviso = jsx.indexOf("t('sombraSenales.aviso')")
  const iGrupos = jsx.indexOf('grupos.map')
  ok(iAviso !== -1, 'la tarjeta pinta el aviso')
  ok(iAviso !== -1 && iGrupos !== -1 && iAviso < iGrupos, '⚠️ y va ANTES de cualquier número')

  ok(/ESTO NO ES LO QUE LA APP PROPONE/.test(es), 'el aviso dice que esto NO es lo que la app propone')
  ok(/EN OBSERVACIÓN/.test(es), 'y que la regla está en observación')

  // ⚠️ Lo último anotado puede ser de hace días. Decir «hoy» sería afirmar algo
  // que no se ha comprobado.
  const bloque = es.slice(es.indexOf('  sombraSenales: {'), es.indexOf('  sombra: {'))
  ok(bloque.length > 200, 'se encontró el bloque de textos (si no, lo de abajo no comprueba nada)')
  ok(!/\bhoy\b/i.test(bloque), '⚠️ la palabra «hoy» NO aparece en ningún texto de la tarjeta')

  // ⚠️ La marca de «geometría vieja» de Swing NO se porta: aquí el retroceso se
  // anotó siempre con su geometría, así que marcaría en falso.
  ok(!/varaVieja/.test(jsx), '⚠️ no se porta la marca de «geometría vieja»: aquí no tendría nada que marcar')

  // Los 13 idiomas, o la tarjeta sale en blanco en el que falte (un `t()` sin
  // clave no da error: no pinta nada).
  const idiomas = ['es', 'en', 'de', 'fr', 'pt', 'it', 'zh', 'ja', 'ru', 'ar', 'tr', 'hi', 'ko']
  let completos = 0
  for (const i of idiomas) {
    const txt = readFileSync(new URL(`../src/lib/i18n/textos/${i}.js`, import.meta.url), 'utf8')
    const tiene =
      /sombraSenales: \{/.test(txt) &&
      /titulo:/.test(txt) &&
      /aviso:/.test(txt) &&
      /sinSenales:/.test(txt) &&
      /pieCarry:/.test(txt) &&
      /aFavor:/.test(txt)
    if (tiene) completos++
    else console.log(`       → falta algo en ${i}`)
  }
  ok(completos === 13, `los 13 idiomas tienen el bloque (${completos}/13)`)
}

console.log('\n9. Está enganchada en el Historial, no en el Barrido')
{
  const tab = readFileSync(new URL('../src/components/HistorialTab.jsx', import.meta.url), 'utf8')
  ok(/import SenalesSombra/.test(tab), 'el Historial la importa')
  ok(/<SenalesSombra senales=\{senales\}/.test(tab), 'y le pasa las señales crudas')
  // ⚠️ Sin destructurar `senales` del hook, la tarjeta recibiría `undefined` y
  // no se pintaría NADA — sin error ninguno. Es el fallo de `useMarketData` del
  // 2026-10-07, que dejó dos tarjetas meses sin verse.
  ok(/const \{[^}]*\bsenales\b[^}]*\} = useHistorial\(\)/.test(tab), '⚠️ y `senales` sale del hook de verdad')

  const barrido = readFileSync(new URL('../src/components/BarridoTab.jsx', import.meta.url), 'utf8')
  ok(!/SenalesSombra/.test(barrido), '⚠️ NO está en el Barrido: ahí va lo que la app propone')
}

console.log(`\n${fallos === 0 ? '✅ Todo bien' : `❌ ${fallos} fallos`}\n`)
process.exit(fallos ? 1 : 0)
