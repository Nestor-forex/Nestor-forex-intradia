// ¿Esta señal va A FAVOR o EN CONTRA del diferencial de tasas?
//
// Néstor lo pidió el 2026-10-13: «también quiero ver lo del carry a favor del
// diferencial y en contra». El banco de pruebas de Swing también lo reparte
// —`scripts/lib/carry.mjs`, que solo existe allí— pero aquello mira la serie
// HISTÓRICA del BIS para saber qué tasa regía el día de cada señal. La pantalla
// no tiene esa serie: `estado/tasas.json` trae la tasa VIGENTE de cada divisa y
// nada más.
//
// Así que son dos funciones distintas con entradas distintas, y eso está bien.
// Lo que NO puede haber dos veces es el CONVENIO —el signo y la banda neutra—,
// porque el día que uno de los dos se moviera, la pantalla y la medición
// dirían cosas opuestas sin que fallara nada. Es el fallo del umbral de fuerza
// en nueve sitios (2026-10-12) y el de `ATR_REVERSION` en dos. Por eso aquí no
// se recalcula nada: se llama a `difDePar`, que ya lleva dentro el signo y el
// `UMBRAL_NEUTRO` justificado en `tasas.js`.
//
// ⚠️ ESTO NO ES UN FILTRO, NI UN CONSEJO, NI UN VEREDICTO. No apaga señales,
// no las reordena y no dice cuál operar. Es una etiqueta que describe un
// hecho: hacia qué lado juega el swap en esa operación. Convertirlo en filtro
// exigiría pasar por el banco de pruebas con su listón escrito antes —van
// ocho familias medidas y ocho fallando— y, sobre todo, sigue en pie lo
// escrito en `sonda-tasas.mjs` ANTES de ver ningún dato: **la diferencia de
// tasas NO es el swap**. El margen del bróker no lo publica nadie y es
// asimétrico, así que esto da el SIGNO y el orden de magnitud, nunca el número.
import { difDePar } from './tasas.js'

/**
 * @param senal  algo con `par` y `lado` ('COMPRA' | 'VENTA')
 * @param tasas  el mapa de `estado/tasas.json` ({ USD: { v, f }, … })
 * @param monedasDe  `pairs.js`
 * @returns 'aFavor' | 'enContra' | 'neutro' | null
 *
 * ⚠️ `null` significa «no se sabe» y NUNCA se mezcla con «en contra». Si una
 * señal sin tasa publicada cayera en uno de los dos montones, un hueco de
 * datos se leería como un hecho sobre el mercado. Misma decisión que
 * `repartir()` en el banco con su cubo `sinDato`, y que `pearson` devolviendo
 * `null` en vez de 0.
 */
export function carryDeSenal(senal, tasas, monedasDe) {
  if (!senal?.par || !senal?.lado) return null
  if (!tasas || typeof monedasDe !== 'function') return null

  const { dif, lado } = difDePar(senal.par, tasas, monedasDe)
  // `difDePar` ya devuelve `lado: 'nose'` cuando falta alguna de las dos tasas,
  // y `'neutro'` dentro de la banda. No se re-interpreta el número aquí.
  if (dif === null || lado === 'nose') return null
  if (lado === 'neutro') return 'neutro'

  const compra = senal.lado === 'COMPRA'
  return (lado === 'compra') === compra ? 'aFavor' : 'enContra'
}
