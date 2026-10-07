// Prueba del contador de las reglas de la sombra. Sin internet.
//
// Correr con: node scripts/prueba-sombra.mjs
//
// ⚠️ ESTE ARCHIVO ES PRIMO, NO GEMELO, y el motivo está escrito en
// `gemelos.mjs`: mira la PANTALLA de esta app, y aquí la regla de la sombra es
// el RETROCESO (una sola) mientras en Swing son tres (reversión, comprar la
// caída y ruptura de estructura). Los dos archivos que de verdad hacen el
// trabajo —`src/lib/sombra.js` y `src/components/AvisoSombra.jsx`— sí son
// GEMELOS y se comparan byte a byte.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { OPS_PARA_CREER, confianza } from '../src/lib/sombra.js'
import { margen } from '../src/lib/diagnostico.js'

let fallos = 0
const comprobar = (que, cond) => {
  console.log(`${cond ? '  OK  ' : '  MAL '} ${que}`)
  if (!cond) fallos++
}

console.log('\n1. El número que hace falta para creerle')
// ⚠️ Aquí NO se puede comparar contra un listón escrito: esta app no tiene un
// preregistro para el retroceso. Lo que impide que el número se separe del de
// Swing es que `sombra.js` es GEMELO —se compara byte a byte en cada push— y
// que allí sí hay una comprobación contra `preregistro-lss.mjs`. Lo que sí se
// puede comprobar aquí es que el número siga siendo el que la aritmética pide:
// que con él el margen del peor caso baje de ±10 puntos.
comprobar(`OPS_PARA_CREER es ${OPS_PARA_CREER}`, OPS_PARA_CREER === 150)
comprobar(`y con él el margen del peor caso baja de ±10 (es ±${margen(OPS_PARA_CREER)})`, margen(OPS_PARA_CREER) < 10)

console.log('\n2. Las cuentas, en el caso normal')
{
  const c = confianza(9)
  comprobar('9 operaciones → faltan 141', c.faltan === OPS_PARA_CREER - 9)
  comprobar(`y el margen es ±${c.margen} puntos`, c.margen === margen(9))
  comprobar('no es suficiente', c.suficiente === false)
}
{
  const c = confianza(OPS_PARA_CREER)
  comprobar(`${OPS_PARA_CREER} operaciones → ya es suficiente`, c.suficiente === true)
  comprobar('y no faltan', c.faltan === 0)
}
comprobar('por encima del listón tampoco faltan (no sale negativo)', confianza(400).faltan === 0)

console.log('\n3. ⚠️ Lo que de verdad hace falta decir: con pocas, el margen tapa el número')
// Es el argumento entero. Con 9 operaciones el margen es tan grande que un 20 %
// y un 85 % son el mismo número, y eso es lo que la pantalla tiene que hacer
// visible en vez de un «no te lo creas» sin cifras.
{
  const pocas = confianza(9).margen
  const bastantes = confianza(OPS_PARA_CREER).margen
  comprobar(`con 9 el margen (±${pocas}) es mayor que con ${OPS_PARA_CREER} (±${bastantes})`, pocas > bastantes)
  comprobar(`y con 9 pasa de ±30 puntos (es ±${pocas})`, pocas > 30)
}

console.log('\n4. ⚠️ Ante la duda NO se afirma nada')
// Un `{faltan: 150}` inventado sobre un dato que no existe afirmaría que la
// regla no lleva ninguna operación, y eso no se sabe. La pantalla no pinta.
comprobar('sin dato → null', confianza(undefined) === null)
comprobar('null → null', confianza(null) === null)
comprobar('texto → null', confianza('9') === null)
comprobar('NaN → null', confianza(NaN) === null)
comprobar('negativo → null', confianza(-3) === null)

console.log('\n5. Cero operaciones SÍ es un dato, y se dice')
// Distinto del caso de arriba: «llevo 0» es información (la regla arrancó y
// todavía no ha resuelto ninguna), «no lo sé» no lo es.
{
  const c = confianza(0)
  comprobar('0 operaciones → no es null', c !== null)
  comprobar('faltan las 150', c.faltan === OPS_PARA_CREER)
  comprobar('y el margen es null, no 0 (un 0 diría «exacto»)', c.margen === null)
}

console.log('\n6. Los dos textos existen en los 13 idiomas, y son FUNCIONES')
// Un `t()` sin clave NO da error: sale en blanco. Así que una mitad traducida y
// la otra no sería peor que nada — y lo peor es que no se vería compilando.
{
  const idiomas = ['es', 'en', 'de', 'fr', 'pt', 'it', 'zh', 'ja', 'ru', 'ar', 'tr', 'hi', 'ko']
  for (const l of idiomas) {
    const d = (await import(`../src/lib/i18n/textos/${l}.js`)).default
    const a = d?.sombra?.aviso
    const m = d?.sombra?.margen
    const ok =
      typeof a === 'function' &&
      typeof m === 'function' &&
      // ⚠️ Y que USEN los huecos: una frase traducida que se olvide del número
      // deja el aviso sin la única cosa que lo hace útil. Se comprueba con dos
      // valores distintos a propósito, para que no valga con escribirlos a
      // mano dentro del texto.
      String(a({ ops: 9, meta: 150 })).includes('9') &&
      String(a({ ops: 9, meta: 150 })).includes('150') &&
      String(m({ ops: 9, m: 33 })).includes('9') &&
      String(m({ ops: 9, m: 33 })).includes('33')
    comprobar(`${l}: sombra.aviso y sombra.margen, con sus números dentro`, ok)
  }
}

console.log('\n7. ⚠️ NINGUNA regla de la sombra se enseña sin su aviso')
// ─────────────────────────────────────────────────────────────────────────
// La lista de reglas NO va escrita a mano: se saca de la propia pantalla. Así
// una regla de sombra que se añada mañana no puede aparecer en positivo sin el
// aviso al lado. Si se añadiera sin él no fallaría nada: se vería un porcentaje
// bonito y nadie se enteraría.
{
  const PANTALLA = readFileSync(fileURLToPath(new URL('../src/components/HistorialTab.jsx', import.meta.url)), 'utf8')

  comprobar('la pantalla importa `AvisoSombra`', /import AvisoSombra from '\.\/AvisoSombra'/.test(PANTALLA))

  // Los bloques de experimento se pintan con `resumen.<regla>.total > 0`.
  const reglas = [...new Set([...PANTALLA.matchAll(/resumen\.(\w+)\.total > 0/g)].map((m) => m[1]))]
  // La guarda de siempre: sin esto, un cambio de forma en la pantalla dejaría
  // la lista vacía y esta comprobación pasaría en verde sin mirar nada.
  comprobar(`se encontraron las reglas de la sombra de la pantalla (${reglas.join(', ')})`, reglas.length >= 1)

  for (const r of reglas) {
    comprobar(
      `\`${r}\` enseña su número CON el aviso`,
      PANTALLA.includes(`<AvisoSombra ops={resumen.${r}.total} />`)
    )
  }
}

console.log('\n8. ⚠️ El texto del retroceso no escribe el conteo a mano')
// Una frase a mano sobre cuántas operaciones lleva se queda vieja el día que la
// regla llegue a 150, y nadie vendría a quitarla. Ese dato lo dice
// `AvisoSombra`, que lo LEE y desaparece solo. Es la lección de
// `medicion.queSignifica`, que dijo «55 %» durante meses.
{
  const es = (await import('../src/lib/i18n/textos/es.js')).default.historial
  comprobar(
    '`sombraIntro` no afirma a mano cuántas operaciones lleva',
    !/(muy )?pocas operaciones|pocos trades/.test(es.sombraIntro)
  )
  // Y lo que SÍ tiene que seguir diciendo: que no se propone y que no manda
  // avisos. Eso no es un número, no envejece, y es lo que el aviso NO dice.
  comprobar('`sombraIntro` sigue diciendo que NO se propone', /NO se propone/.test(es.sombraIntro))
}

console.log('\n9. ⚠️⚠️ El aviso NO afirma el signo del resultado')
// La primera versión decía «Mide en positivo, pero todavía NO se puede tomar
// como señal». Con el historial REAL delante eso era FALSO: la reversión iba al
// 32 % con −519 pips y «comprar la caída» al 10 % con −757, y la frase se
// pintaba justo encima de esos números.
//
// Néstor tenía razón sobre el BANCO DE PRUEBAS; el registro real hacia adelante
// va en contra, que es por lo que estas reglas están en la sombra. El aviso dice
// lo único cierto en los dos casos. Que no vuelva a afirmar un signo.
{
  const a = (await import('../src/lib/i18n/textos/es.js')).default.sombra.aviso({ ops: 31, meta: 150 })
  const m = (await import('../src/lib/i18n/textos/es.js')).default.sombra.margen({ ops: 31, m: 18 })
  const signo = /positivo|negativo|gana\b|pierde\b|a favor|rentable/i
  comprobar('`sombra.aviso` no dice si el resultado es bueno o malo', !signo.test(a))
  comprobar('`sombra.margen` tampoco', !signo.test(m))
}

console.log(fallos === 0 ? '\n✓ todo bien.\n' : `\n✗ ${fallos} comprobación(es) fallaron.\n`)
process.exit(fallos === 0 ? 0 : 1)
