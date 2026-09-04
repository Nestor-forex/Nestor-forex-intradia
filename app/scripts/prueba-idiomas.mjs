// Compara los 13 diccionarios entre sí. Sin internet:
//
//     node scripts/prueba-idiomas.mjs
//
// POR QUÉ EXISTE
// --------------
// La memoria del proyecto daba por hecho que este comparador existía («hay un
// script que compara los 13 diccionarios entre sí»). No existía: se hizo a
// mano una vez y nunca se guardó. Al añadir el bloque de importación del
// bróker —13 archivos tocados de golpe— quedó claro que hacía falta de verdad.
//
// Y no es paranoia. Cuando se escribieron los 13 idiomas se coló una palabra
// rusa dentro del japonés y un carácter chino dentro del ruso. Eso no lo ve el
// compilador, no lo ve el linter y no lo ve nadie que no lea ese idioma.
//
// QUÉ COMPRUEBA, Y POR QUÉ CADA COSA
// ----------------------------------
//  · MISMAS CLAVES. El español es la fuente de verdad. Una clave que falta en
//    otro idioma cae a español y se ve raro pero funciona; una clave SOBRANTE
//    es código muerto que nadie va a leer nunca.
//  · MISMO TIPO. Si en español una frase es una FUNCIÓN (porque lleva números
//    dentro y cada idioma ordena la frase distinto) y en otro idioma es un
//    texto suelto, la app llamaría a un texto como si fuera función y se
//    rompería la pantalla — solo en ese idioma, que es la peor forma de
//    romperse porque nadie lo prueba.
//  · MISMOS HUECOS. Una función que en español usa `n` y en otro idioma no lo
//    usa da una frase sin el número. Compila, se ve, y está mal.
//  · NADA DE OTRO ALFABETO. El error que ya pasó.

import { readdirSync } from 'node:fs'
import { IDIOMAS } from '../src/lib/i18n/idiomas.js'

let fallos = 0
const comprobar = (bien, que) => {
  if (!bien) {
    console.log(`  ✗ ${que}`)
    fallos++
  }
  return bien
}

const codigos = IDIOMAS.map((i) => i.codigo)
const enDisco = readdirSync(new URL('../src/lib/i18n/textos/', import.meta.url))
  .filter((f) => f.endsWith('.js'))
  .map((f) => f.replace('.js', ''))
  .sort()

console.log('\nLa lista de idiomas y los archivos coinciden')
comprobar(
  JSON.stringify([...codigos].sort()) === JSON.stringify(enDisco),
  `idiomas.js dice [${[...codigos].sort()}] y en disco hay [${enDisco}]`
)
if (!fallos) console.log(`  ✓ ${codigos.length} idiomas`)

const dicc = {}
for (const c of codigos) {
  dicc[c] = (await import(`../src/lib/i18n/textos/${c}.js`)).default
}

// Aplana el diccionario a { 'diario.titulo': valor, … } para poder compararlo
// clave por clave sin recorrer estructuras anidadas en cada comprobación.
function aplanar(obj, prefijo = '', salida = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const clave = prefijo ? `${prefijo}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) aplanar(v, clave, salida)
    else salida[clave] = v
  }
  return salida
}

const base = aplanar(dicc.es)
const clavesBase = Object.keys(base)

console.log(`\nMismas claves que el español (${clavesBase.length})`)
for (const c of codigos) {
  if (c === 'es') continue
  const plano = aplanar(dicc[c])
  const faltan = clavesBase.filter((k) => !(k in plano))
  const sobran = Object.keys(plano).filter((k) => !clavesBase.includes(k))
  const bien =
    comprobar(faltan.length === 0, `${c}: faltan ${faltan.length} claves → ${faltan.slice(0, 4)}`) &&
    comprobar(sobran.length === 0, `${c}: sobran ${sobran.length} claves → ${sobran.slice(0, 4)}`)
  if (bien) console.log(`  ✓ ${c}`)
}

console.log('\nMismo tipo (texto o función) que el español')
for (const c of codigos) {
  if (c === 'es') continue
  const plano = aplanar(dicc[c])
  const malos = clavesBase.filter((k) => k in plano && typeof plano[k] !== typeof base[k])
  if (comprobar(malos.length === 0, `${c}: distinto tipo en ${malos.slice(0, 4)}`)) {
    console.log(`  ✓ ${c}`)
  }
}

console.log('\nLas frases con números usan sus huecos')
{
  // Se llama a cada función con un objeto que devuelve una marca por cada
  // campo pedido, y se exige que la frase resultante las contenga. Así se
  // detecta la traducción que se olvidó de meter el número dentro.
  const huecos = clavesBase.filter((k) => typeof base[k] === 'function')
  const sonda = new Proxy(
    {},
    {
      get: (_, prop) => (prop === Symbol.toPrimitive ? undefined : `«${String(prop)}»`),
      has: () => true,
    }
  )
  for (const c of codigos) {
    const plano = aplanar(dicc[c])
    const mudas = []
    for (const k of huecos) {
      if (typeof plano[k] !== 'function') continue
      let salida
      try {
        salida = String(plano[k](sonda))
      } catch (e) {
        mudas.push(`${k} (falla: ${e.message})`)
        continue
      }
      // La española dice qué huecos debería llevar esta frase.
      const esperados = String(base[k](sonda)).match(/«[^»]+»/g) || []
      const perdidos = esperados.filter((h) => !salida.includes(h))
      if (perdidos.length) mudas.push(`${k} sin ${perdidos.join(', ')}`)
    }
    if (comprobar(mudas.length === 0, `${c}: ${mudas.slice(0, 3).join(' · ')}`)) {
      console.log(`  ✓ ${c} (${huecos.length} frases con números)`)
    }
  }
}

console.log('\nNingún idioma lleva texto de otro alfabeto')
{
  // Los rangos propios de cada escritura. Solo se miran los idiomas con
  // alfabeto propio: entre los latinos no hay forma de distinguir por
  // caracteres, y para eso no sirve una máquina.
  const ESCRITURAS = {
    zh: /[一-鿿㐀-䶿]/,
    ja: /[぀-ヿ一-鿿]/,
    ko: /[가-힯ᄀ-ᇿ]/,
    ru: /[Ѐ-ӿ]/,
    ar: /[؀-ۿ]/,
    hi: /[ऀ-ॿ]/,
  }
  for (const [c, propio] of Object.entries(ESCRITURAS)) {
    const plano = aplanar(dicc[c])
    const intrusos = []
    for (const k of clavesBase) {
      const v = plano[k]
      if (typeof v !== 'string') continue
      for (const [otro, regex] of Object.entries(ESCRITURAS)) {
        if (otro === c) continue
        // El japonés usa kanji, que son caracteres chinos: no es un intruso.
        if (c === 'ja' && otro === 'zh') continue
        if (c === 'zh' && otro === 'ja') {
          // Al revés sí importa: kana en un texto chino no pinta nada.
          if (/[぀-ヿ]/.test(v)) intrusos.push(`${k} (kana)`)
          continue
        }
        if (regex.test(v) && !propio.test(v.replace(regex, ''))) {
          intrusos.push(`${k} (${otro})`)
        } else if (regex.test(v)) {
          intrusos.push(`${k} (${otro} mezclado)`)
        }
      }
    }
    if (comprobar(intrusos.length === 0, `${c}: ${intrusos.slice(0, 4).join(', ')}`)) {
      console.log(`  ✓ ${c}`)
    }
  }
}

console.log('\nNada quedó sin traducir por copia literal del español')
{
  // Un idioma cuyos textos sean IDÉNTICOS al español en casi todo es un
  // archivo que se copió y no se tradujo. Se permite que coincidan unas pocas
  // claves (los términos de trading que a propósito no se traducen, y las
  // palabras que se escriben igual en varios idiomas).
  for (const c of codigos) {
    if (c === 'es') continue
    const plano = aplanar(dicc[c])
    const textos = clavesBase.filter((k) => typeof base[k] === 'string')
    const iguales = textos.filter((k) => plano[k] === base[k])
    const pct = (iguales.length / textos.length) * 100
    if (comprobar(pct < 60, `${c}: ${pct.toFixed(0)}% de los textos son idénticos al español`)) {
      console.log(`  ✓ ${c} (${pct.toFixed(0)}% coincide, normal para jerga de trading)`)
    }
  }
}

console.log(fallos ? `\n✗ ${fallos} comprobaciones fallaron\n` : '\n✓ todo bien\n')
process.exit(fallos ? 1 : 0)
