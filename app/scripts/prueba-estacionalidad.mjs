// Comprobaciones de `src/lib/estacionalidad.js`. Sin internet y sin créditos.
//
// GEMELO: la matemática es la misma en las dos apps, así que esta prueba
// también. Lo que cambia entre apps es qué paneles enseña cada una, y eso lo
// decide el publicador — que tiene su propia comprobación.
//
// El bloque que más vale es el 2: separa el margen de una MEDIA del margen de
// una PROPORCIÓN. Son dos fórmulas distintas que con ciertos tamaños de
// muestra dan números parecidos, y confundirlas es un error que no da ningún
// síntoma. Me pasó a mí escribiendo esto.

import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import {
  MIN_OBS,
  DIAS_HABILES,
  MESES,
  HORAS,
  rangoRelativo,
  resumenNumerico,
  perfilPor,
  porHoraUTC,
  porDiaSemana,
  porMes,
  direccionPorMes,
  casillaFloja,
  estacionalidadDe,
} from '../src/lib/estacionalidad.js'
import { margen } from '../src/lib/diagnostico.js'

let mal = 0
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`)
  else {
    console.log(`  ✗ MAL — ${msg}`)
    mal++
  }
}
const casi = (a, b, tol, msg) => ok(typeof a === 'number' && Math.abs(a - b) <= tol, `${msg} (salió ${a})`)

// ── Un mercado inventado, determinista ───────────────────────────────────────
//
// ⚠️ Con variación de verdad, no una onda limpia. La lección está escrita en
// `prueba-barrido-publicado`: un mercado liso deja los indicadores clavados y
// las comprobaciones pasan comparando listas vacías. Aquí además hace falta
// DISPERSIÓN, porque el margen de una media sale de ella: con todas las velas
// idénticas el margen sería 0 y el bloque 2 no distinguiría nada.
let semilla = 20261026
const azar = () => {
  semilla = (semilla * 1103515245 + 12345) & 0x7fffffff
  return semilla / 0x7fffffff
}

// 20 años de velas diarias de LUNES A VIERNES (ya limpias, como llegan).
// El miércoles se mueve a propósito el doble, para tener algo que comprobar.
function serieDiaria(anios = 20) {
  const out = []
  let c = 1.1
  const d = new Date(Date.UTC(2006, 0, 2)) // un lunes
  const fin = new Date(Date.UTC(2006 + anios, 0, 2))
  while (d < fin) {
    const dow = d.getUTCDay()
    if (dow >= 1 && dow <= 5) {
      const factor = dow === 3 ? 2 : 1
      const rango = c * (0.004 + azar() * 0.004) * factor
      c = c * (1 + (azar() - 0.5) * 0.008)
      out.push({ t: new Date(d), h: c + rango / 2, l: c - rango / 2, c })
    }
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

// Velas de una hora de SOLO MERCADO, con el solape de Londres-NY moviéndose
// más — que es el mecanismo real de la estacionalidad por horas.
function serieHoraria(dias = 208) {
  const out = []
  let c = 150
  const d = new Date(Date.UTC(2026, 2, 2, 0, 0, 0)) // lunes 00:00 UTC
  for (let i = 0; i < dias * 24; i++) {
    const dow = d.getUTCDay()
    const h = d.getUTCHours()
    const cerrada = dow === 6 || (dow === 0 && h < 22) || (dow === 5 && h >= 22)
    if (!cerrada) {
      const factor = h >= 13 && h <= 16 ? 2.5 : 1
      const rango = c * (0.0008 + azar() * 0.0008) * factor
      c = c * (1 + (azar() - 0.5) * 0.0016)
      out.push({ t: new Date(d), h: c + rango / 2, l: c - rango / 2, c })
    }
    d.setUTCHours(d.getUTCHours() + 1)
  }
  return out
}

const diaria = serieDiaria()
const horaria = serieHoraria()

// ── 1. El recorrido de una vela ──────────────────────────────────────────────
console.log('\n1. rangoRelativo')
casi(rangoRelativo(1.1, 1.0, 1.0), 10, 1e-9, 'rango del 10 % sale 10')
ok(rangoRelativo(1.1, 1.1, 1.1) === 0, 'una vela sin recorrido sí es 0 (el dato existe y vale 0)')
for (const [h, l, c, por] of [
  [NaN, 1, 1, 'NaN'],
  [1.1, 1.0, 0, 'cierre 0'],
  [1.0, 1.1, 1.0, 'máximo por debajo del mínimo'],
  [null, 1, 1, 'null'],
  [undefined, 1, 1, 'undefined'],
  ['1.1', 1.0, 1.0, 'texto'],
]) {
  ok(rangoRelativo(h, l, c) === null, `devuelve null, nunca 0, con ${por}`)
}

// ── 2. ⚠️⚠️ EL MARGEN DE UNA MEDIA NO ES EL DE UNA PROPORCIÓN ───────────────
console.log('\n2. el margen correcto de cada cosa')
{
  // 400 valores que alternan 1 y 3: media 2, desviación ~1.
  const xs = Array.from({ length: 400 }, (_, i) => (i % 2 ? 3 : 1))
  const r = resumenNumerico(xs)
  casi(r.medio, 2, 1e-9, 'la media de 1 y 3 alternados es 2')
  casi(r.sd, 1, 0.01, 'la desviación típica es ~1')
  // 1,96 · 1 / √400 = 0,098
  casi(r.margen95, 0.098, 0.005, 'el margen de la MEDIA es 1,96·sd/√n')

  // Y el de una proporción con el mismo n es 98/√400 = 4,9: CINCUENTA VECES
  // más grande. Si alguien sustituye uno por el otro, esto falla.
  casi(margen(400), 5, 0.5, 'el margen de una PROPORCIÓN con n=400 es ~5 puntos')
  ok(
    r.margen95 < margen(400) / 10,
    'los dos márgenes NO son intercambiables: el de la media es un orden de magnitud menor aquí',
  )

  // Y depende de la dispersión, que es lo que lo distingue de 98/√n: el mismo
  // n con datos más dispersos da un margen más grande.
  const anchos = Array.from({ length: 400 }, (_, i) => (i % 2 ? 12 : -8))
  ok(
    resumenNumerico(anchos).margen95 > r.margen95 * 5,
    'con los mismos n pero más dispersión, el margen de la media CRECE (98/√n no lo haría)',
  )
}
ok(resumenNumerico([]).medio === null, 'sin datos la media es null, nunca 0')
ok(resumenNumerico([5]).margen95 === null, 'con un solo dato no hay margen, y no se inventa uno')
ok(resumenNumerico([1, 'x', null, 3, NaN]).n === 2, 'los valores que no son números finitos se descartan')

// ── 3. El perfil, con el n de CADA casilla ───────────────────────────────────
console.log('\n3. perfilPor')
{
  const porDia = perfilPor(diaria, porDiaSemana, DIAS_HABILES)
  ok(Object.keys(porDia).length === 5, 'salen los cinco días hábiles')
  ok(
    DIAS_HABILES.every((d) => porDia[d].n > 900),
    `cada día tiene más de 900 observaciones (lun ${porDia[1].n})`,
  )
  ok(
    porDia[3].medio > porDia[1].medio * 1.5,
    `el miércoles inventado se mueve mucho más que el lunes (${porDia[3].medio.toFixed(3)} vs ${porDia[1].medio.toFixed(3)})`,
  )
  ok(
    DIAS_HABILES.every((d) => porDia[d].margen95 < porDia[d].medio / 5),
    'con ~1.000 observaciones el margen es pequeño frente a la media',
  )

  const porM = perfilPor(diaria, porMes, MESES)
  ok(Object.keys(porM).length === 12, 'salen los doce meses')
  ok(
    MESES.every((m) => porM[m].n > 300),
    `cada mes tiene más de 300 DÍAS (enero ${porM[0].n}) — no 20`,
  )
}

// ── 4. ⚠️ LA TRAMPA DE LA REJILLA, que aquí es la que más muerde ────────────
console.log('\n4. una vela de fin de semana NO se cuela en un día hábil')
{
  const conFinde = [
    ...diaria.slice(0, 50),
    // sábado y domingo, planos como son las velas de fin de semana de verdad
    { t: new Date(Date.UTC(2006, 0, 7)), h: 1.1001, l: 1.1, c: 1.1 },
    { t: new Date(Date.UTC(2006, 0, 8)), h: 1.1001, l: 1.1, c: 1.1 },
  ]
  const p = perfilPor(conFinde, porDiaSemana, DIAS_HABILES)
  const limpio = perfilPor(diaria.slice(0, 50), porDiaSemana, DIAS_HABILES)
  ok(
    DIAS_HABILES.every((d) => p[d].n === limpio[d].n),
    'las dos velas de fin de semana no suman en ningún día hábil',
  )
  ok(!Object.keys(p).includes('6') && !Object.keys(p).includes('0'), 'no aparecen sábado ni domingo como casillas')
}

// ── 5. La parte DÉBIL: dirección por mes ─────────────────────────────────────
console.log('\n5. direccionPorMes')
{
  const dir = direccionPorMes(diaria)
  ok(Object.keys(dir).length === 12, 'salen los doce meses')
  ok(
    MESES.every((m) => dir[m].n >= 18 && dir[m].n <= 20),
    `cada mes tiene entre 18 y 20 observaciones con 20 años (enero ${dir[0].n})`,
  )
  ok(
    MESES.every((m) => dir[m].margen >= 21 && dir[m].margen <= 24),
    `y por eso su margen es de ±22 puntos (enero ±${dir[0].margen})`,
  )
  ok(
    MESES.every((m) => dir[m].verdes <= dir[m].n),
    'los meses en verde nunca pasan del total',
  )
  ok(dir[0].pct === Math.round((dir[0].verdes / dir[0].n) * 100), 'el porcentaje cuadra con el conteo')

  // El mismo mes medido como RECORRIDO tiene veinte veces más datos. Es la
  // razón de ser de que haya dos paneles.
  const porM = perfilPor(diaria, porMes, MESES)
  ok(
    porM[0].n > dir[0].n * 15,
    `el recorrido de enero sale de ${porM[0].n} días y su dirección de solo ${dir[0].n} meses`,
  )
}
{
  const nada = direccionPorMes([])
  ok(MESES.every((m) => nada[m].pct === null), 'sin datos el porcentaje es null, nunca 0 ni 50')
  ok(MESES.every((m) => nada[m].margen === null), 'y tampoco se inventa un margen')
}
{
  // Un mes a medias no se cuenta. ⚠️ La serie empieza el 10 de enero A
  // PROPÓSITO: así ese enero tiene 15 sesiones, o sea que PASA el guardia de
  // «menos de 10 sesiones no es un mes» y lo único que puede rechazarlo es el
  // recorte del primer y último bloque.
  //
  // La primera versión arrancaba el día 20 (8 sesiones) y entonces lo
  // rechazaba el guardia de las 10: el recorte quedaba sin comprobar, y al
  // romperlo a propósito la prueba seguía en verde. El daño sí se aplicaba —
  // era la prueba la que no distinguía los dos casos.
  const trozo = diaria.filter((v) => {
    const t = v.t
    return t >= new Date(Date.UTC(2010, 0, 10)) && t <= new Date(Date.UTC(2010, 2, 10))
  })
  const sesionesDeEnero = trozo.filter((v) => v.t.getUTCMonth() === 0).length
  ok(sesionesDeEnero >= 10, `el enero a medias trae ${sesionesDeEnero} sesiones, así que pasa el guardia de las 10`)
  const dir = direccionPorMes(trozo)
  ok(dir[0].n === 0, 'y aun así el enero a medias no se cuenta')
  ok(dir[2].n === 0, 'el marzo a medias tampoco')
  ok(dir[1].n === 1, 'y el febrero completo sí')
}

// ── 6. Las horas, en UTC ─────────────────────────────────────────────────────
console.log('\n6. el perfil por hora, agrupado en UTC')
{
  const p = perfilPor(horaria, porHoraUTC, HORAS)
  ok(Object.keys(p).length === 24, 'salen las 24 horas')
  const solape = (p[13].medio + p[14].medio + p[15].medio) / 3
  const madrugada = (p[3].medio + p[4].medio + p[5].medio) / 3
  ok(solape > madrugada * 2, `el solape inventado se mueve más que la madrugada (${solape.toFixed(4)} vs ${madrugada.toFixed(4)})`)
  // 208 días menos los ~58 de fin de semana = ~150. Se comprueba contra la
  // serie y no contra un número escrito a mano, que es lo que me falló al
  // escribirlo: puse «> 150» y salen exactamente 150.
  const diasDeMercado = new Set(horaria.filter((v) => v.t.getUTCHours() === 14).map((v) => v.t.toISOString().slice(0, 10)))
  ok(
    p[14].n === diasDeMercado.size && p[14].n >= 140,
    `la hora 14 sale en todos los días de mercado que la tienen (${p[14].n} de 208 días naturales)`,
  )
  ok(p[14].margen95 < p[14].medio / 4, 'y por eso su margen es chico frente a la media')
}
{
  // ⚠️ Comprobado EN OTRA ZONA HORARIA, y no es paranoia: `getUTCHours` y
  // `getHours` dan lo mismo en esta máquina, que corre en UTC. Es el mismo
  // agujero que ya dejó inofensiva una comprobación de `senalesSombra` el
  // 2026-10-24, y se cazó solo al forzar la zona.
  const url = new URL('../src/lib/estacionalidad.js', import.meta.url).href
  const guion = `
    import('${url}').then((m) => {
      const d = new Date(Date.UTC(2026, 5, 1, 14, 0, 0))
      console.log(m.porHoraUTC(d), new Date(Date.UTC(2026,5,1,14)).getHours())
    })`
  const fuera = execFileSync(process.execPath, ['-e', guion], {
    env: { ...process.env, TZ: 'America/Bogota' },
    encoding: 'utf8',
  }).trim()
  const [utc, local] = fuera.split(/\s+/).map(Number)
  ok(utc === 14, `con la zona en Bogotá, las 14:00 UTC siguen siendo la hora 14 (salió ${utc})`)
  ok(local !== 14, `y la zona forzada de verdad desplaza, si no esto no comprobaría nada (local ${local})`)
}

// ── 7. Las casillas flojas se marcan, no se esconden ────────────────────────
console.log('\n7. casillaFloja')
ok(casillaFloja({ n: MIN_OBS - 1 }), `una casilla con ${MIN_OBS - 1} observaciones se marca como floja`)
ok(!casillaFloja({ n: MIN_OBS }), `con ${MIN_OBS} ya no`)
ok(casillaFloja(null) && casillaFloja({ n: NaN }) && casillaFloja({}), 'y lo que no se puede leer también es flojo')
{
  // Con poca historia las casillas SIGUEN saliendo, con su n.
  const poco = diaria.slice(0, 40)
  const p = perfilPor(poco, porDiaSemana, DIAS_HABILES)
  ok(Object.keys(p).length === 5, 'con solo 40 velas siguen saliendo los cinco días')
  ok(
    DIAS_HABILES.some((d) => casillaFloja(p[d])),
    'y alguna sale marcada como floja en vez de desaparecer',
  )
}

// ── 8. El paquete completo de un par ─────────────────────────────────────────
console.log('\n8. estacionalidadDe')
{
  const swing = estacionalidadDe(diaria)
  ok(swing.hora === null, 'sin `conHoras` no hay perfil por hora — en Swing una vela es un día')
  ok(Object.keys(swing.dia).length === 5 && Object.keys(swing.mes).length === 12, 'día y mes sí salen')
  ok(/^\d{4}-\d{2}-\d{2}$/.test(swing.desde) && swing.desde < swing.hasta, `trae el tramo (${swing.desde} → ${swing.hasta})`)
  ok(swing.obs === diaria.length, 'y cuántas velas lo sostienen')

  const intra = estacionalidadDe(horaria, { conHoras: true })
  ok(intra.hora && Object.keys(intra.hora).length === 24, 'con `conHoras` sí hay perfil por hora')
}
{
  const vacio = estacionalidadDe([])
  ok(vacio.desde === null && vacio.hasta === null, 'sin velas no se inventa un tramo')
  ok(vacio.obs === 0, 'y el conteo es 0')
}

// ── 9. NINGÚN VEREDICTO ──────────────────────────────────────────────────────
console.log('\n9. no da veredictos (y esta comprobación hay que borrarla a mano para añadir uno)')
{
  const fuente = readFileSync(new URL('../src/lib/estacionalidad.js', import.meta.url), 'utf8')
  // Solo el código, sin los comentarios: la cabecera NOMBRA estas palabras a
  // propósito para explicar por qué no están. Es la lección de «contar
  // apariciones no es leer», que en este repositorio ya mordió tres veces.
  const codigo = fuente
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n')
  for (const palabra of ['mejorMes', 'mejor mes', 'recomend', 'sugiere', 'puntuacion', 'puntuación', 'score', 'ranking', 'comprar', 'vender']) {
    ok(!codigo.toLowerCase().includes(palabra.toLowerCase()), `el código no dice «${palabra}»`)
  }
  const exportado = Object.keys(
    await import('../src/lib/estacionalidad.js'),
  )
  ok(
    !exportado.some((k) => /mejor|score|rank|veredicto|lado|señal|senal/i.test(k)),
    `no exporta nada que suene a veredicto (${exportado.length} exportaciones)`,
  )

  // Y el margen se IMPORTA, no se reescribe: el convenio de cómo se calcula no
  // puede estar en dos sitios. Es el fallo del umbral de fuerza en nueve
  // sitios (2026-10-12) y el de `ATR_REVERSION` en dos.
  ok(
    /import\s*\{[^}]*\bmargen\b[^}]*\}\s*from\s*'\.\/diagnostico\.js'/.test(fuente),
    'importa `margen` de `diagnostico.js` en vez de reescribir 98/√n',
  )
  ok(!/98\s*\/\s*Math\.sqrt/.test(fuente), 'y no tiene su propia copia de la fórmula')
}

console.log(mal === 0 ? '\n✅ todo en verde\n' : `\n❌ ${mal} MAL\n`)
process.exit(mal === 0 ? 0 : 1)
