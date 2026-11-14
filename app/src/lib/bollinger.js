// Las bandas de Bollinger, y las reglas de entrada que salen de ellas.
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTE ARCHIVO EXISTE
// ─────────────────────────────────────────────────────────────────────────
// De toda la literatura que se revisó el 2026-10-12, Coakley, Marzano y
// Nankervis (2016, *IRFA*) separan las reglas «tradicionales» —medias,
// filtros, canales— de las demás y dicen que **las de banda de Bollinger y
// RSI siguen midiendo bien de forma robusta** en el tramo reciente, cuando
// todo lo demás ya se había muerto.
//
// Esas dos familias son exactamente:
//   · la ÚNICA regla que ha medido positivo en este proyecto (la reversión
//     M2, que es «comprar lo débil **con el RSI estirado**»), y
//   · la única que aquí NO se ha tocado nunca.
//
// Así que esto no es una idea suelta: es la mitad que faltaba de la única
// pista que tienen a la vez la literatura y el banco de pruebas.
//
// ⚠️ NADA DE AQUÍ ENTRA EN LA APP. Es material de medición, como
// `patrones.mjs`. Si mide bien, encenderlo es una decisión aparte con su
// propio PR.

// ─────────────────────────────────────────────────────────────────────────
// LA MATEMÁTICA
// ─────────────────────────────────────────────────────────────────────────

/** El periodo y las desviaciones de la definición estándar de Bollinger. */
export const PERIODO = 20
export const DESVIACIONES = 2

/**
 * Las tres bandas sobre una serie de cierres.
 *
 * ⚠️ MEDIA SIMPLE, NO EXPONENCIAL, y no es un detalle de estilo. Bollinger
 * está DEFINIDO con media simple y desviación típica alrededor de esa misma
 * media. Usar la `e20` que el par ya trae —que es exponencial— daría unas
 * bandas parecidas y que **no son las de Bollinger**, así que el resultado no
 * se podría comparar con la literatura que motiva toda esta medición. Es la
 * misma trampa que el ATR de cierre a cierre del 2026-08-09: un número
 * correcto de una cosa distinta de la que uno cree medir.
 *
 * ⚠️ DESVIACIÓN DE POBLACIÓN (divide entre n), que es la de la definición
 * original. Con n = 20 la diferencia contra la muestral es del 2,6 % en el
 * ancho de la banda; pequeña, pero fijarla es lo que hace la medición
 * repetible.
 *
 * @returns null —NUNCA ceros— cuando no se puede calcular: faltan cierres,
 *          alguno no es un número, o la serie es plana y la desviación sale
 *          cero. Un cero diría «las bandas están pegadas al precio», que es
 *          una afirmación sobre el mercado. Misma decisión que `pearson` en
 *          `correlacion.js` y que `edadEnMinutos` en `frescura.js`.
 */
export function bandas(serie, { periodo = PERIODO, k = DESVIACIONES } = {}) {
  if (!Array.isArray(serie) || serie.length < periodo) return null
  const v = serie.slice(-periodo)
  if (!v.every((x) => typeof x === 'number' && Number.isFinite(x))) return null

  const media = v.reduce((a, b) => a + b, 0) / periodo
  const varianza = v.reduce((a, b) => a + (b - media) ** 2, 0) / periodo
  const sd = Math.sqrt(varianza)
  // Serie plana: las bandas colapsarían sobre la media y «tocar la banda»
  // dejaría de significar nada. No se puede calcular, así que no se calcula.
  if (!(sd > 0)) return null

  return { media, arriba: media + k * sd, abajo: media - k * sd, sd, k }
}

/**
 * Cuánto se ha alejado el CIERRE DE HOY de su media, medido en bandas:
 * −1 es justo la banda de abajo, +1 justo la de arriba, 0 la media.
 *
 * ⚠️ LEE `p.c`, igual que `donde`. La primera versión lo sacaba del último
 * valor de `serie20` y la prueba lo cazó. En producción los dos coinciden
 * —`serie20` son los últimos 20 cierres y `c` es el último—, así que el fallo
 * no habría dado ningún error: habría ordenado por el sitio correcto **por
 * casualidad**, hasta el día que alguien llamara a esto con otra cosa. Dos
 * formas de preguntar «¿dónde está el precio?» que pueden separarse en
 * silencio son exactamente lo que este proyecto lleva meses quitando.
 *
 * @returns null si no se puede calcular. Nunca 0: un 0 diría «está justo en
 *          la media», que es una afirmación.
 */
export function posicionDe(p, opciones = {}) {
  const b = bandas(p?.serie20, opciones)
  if (!b) return null
  const c = p.c
  if (typeof c !== 'number' || !Number.isFinite(c)) return null
  return (c - b.media) / (b.k * b.sd)
}

/**
 * ¿Dónde está el cierre de hoy respecto de las bandas?
 *
 * @returns 'ABAJO' | 'ARRIBA' | 'DENTRO', o null si no se puede calcular.
 */
export function donde(p, opciones = {}) {
  const b = bandas(p?.serie20, opciones)
  if (!b) return null
  const c = p.c
  if (typeof c !== 'number' || !Number.isFinite(c)) return null
  if (c <= b.abajo) return 'ABAJO'
  if (c >= b.arriba) return 'ARRIBA'
  return 'DENTRO'
}

// ─────────────────────────────────────────────────────────────────────────
// LAS REGLAS DE ENTRADA
// ─────────────────────────────────────────────────────────────────────────
//
// ⚠️⚠️ LAS DOS SALEN DEL MISMO DISPARO Y OPERAN LADOS CONTRARIOS.
//
// Es exactamente la forma de `perforaExtremo` con su `volver`, y por eso hay
// que tener el mismo cuidado con el nombre: en septiembre unas filas se
// llamaron «rompimiento» cuando lo que medían era «comprar la caída», y la
// tabla parecía decir lo contrario de lo que decía. **Una etiqueta equivocada
// es un error de medición.**
//
// Así que van nombradas por lo que HACEN, no por el indicador:
//
//   · `reversion`  el precio cierra POR DEBAJO de la banda de abajo → COMPRA.
//                  O sea comprar lo que se cayó. Es la lectura clásica de
//                  Bollinger («el precio vuelve a la media») y la que apunta
//                  en la misma dirección que todo lo positivo de este
//                  proyecto.
//
//   · `momento`    el MISMO cierre por debajo de la banda → VENDE. O sea
//                  seguir la caída. Es la otra lectura habitual («salirse de
//                  la banda confirma el movimiento»).
//
// ⚠️ CUÁL ES LA CANDIDATA Y CUÁL EL CONTROL ESTÁ DECIDIDO ANTES DE MEDIR, en
// `preregistro-bollinger.mjs`, con el motivo escrito. Sin eso, medir las dos
// y quedarse con la que gane es elegir a posteriori — que es justo lo que
// este proyecto rechazó con el control de la confluencia y con el del barrido
// de liquidez.

/**
 * @param lectura      'reversion' (comprar el toque de abajo) o 'momento'
 *                     (venderlo). Ver arriba.
 * @param rsiEstirado  además, el RSI en el extremo. Es lo que hace sobrevivir
 *                     a la reversión M2 al swap, y es la combinación que la
 *                     literatura empareja. `null` = sin exigirlo.
 * @param exigirFuerza además, que la fuerza relativa apunte al lado que se
 *                     opera. Se mide aparte para saber si aporta algo ENCIMA
 *                     de Bollinger o si solo quita señales.
 */
export const reglaBollinger =
  ({ lectura = 'reversion', rsiEstirado = null, exigirFuerza = false, ...opciones } = {}) =>
  (p, esc, thr) => {
    const d = donde(p, opciones)
    if (d === null || d === 'DENTRO') return null

    const abajo = d === 'ABAJO'

    // ⚠️⚠️ LAS CONDICIONES DE MÁS MIRAN EL EVENTO, NO EL LADO QUE SE OPERA.
    //
    // Esto lo cazó el humo con un mercado inventado, antes de gastar un
    // crédito, y era un fallo de DISEÑO que dejaba la medición sin control.
    //
    // La primera versión preguntaba «¿el RSI acompaña al LADO?»: para una
    // COMPRA exigía RSI bajo y para una VENTA, alto. Suena razonable y con la
    // lectura de reversión funciona. Pero el control opera el MISMO disparo al
    // revés, así que allí el precio está en la banda de ABAJO —RSI bajo por
    // construcción— y la regla le pedía RSI ALTO para vender. Las dos
    // condiciones se contradecían y **el control daba CERO señales**: no habría
    // habido con qué comparar, y la tabla lo habría enseñado como si la lectura
    // de momento sencillamente no produjera nada.
    //
    // Condicionando el EVENTO, las dos lecturas ven exactamente los mismos días
    // y los mismos pares, y lo único que cambia entre ellas es hacia dónde se
    // opera. Eso es lo que tiene que ser un control.
    if (rsiEstirado !== null) {
      const r = p.rsiV
      if (typeof r !== 'number' || !Number.isFinite(r)) return null
      // Abajo se pide RSI estirado a la baja; arriba, su espejo.
      if (abajo ? r > rsiEstirado : r < 100 - rsiEstirado) return null
    }

    // Igual: la fuerza acompaña al MOVIMIENTO que ya ocurrió (el par se cayó y
    // además su divisa base está débil), no al lado que se acabe operando.
    if (exigirFuerza) {
      if (typeof p.dif !== 'number' || !Number.isFinite(p.dif)) return null
      if (abajo ? p.dif >= -thr : p.dif <= thr) return null
    }

    // Y solo al final el lado, que es lo ÚNICO que separa las dos lecturas.
    return lectura === 'reversion' ? (abajo ? 'COMPRA' : 'VENTA') : abajo ? 'VENTA' : 'COMPRA'
  }

/**
 * Cómo ordenar los candidatos de Bollinger cuando hay más de los que caben.
 *
 * ⚠️⚠️ ESTO NO ES UN ADORNO: SIN ELLO LA MEDICIÓN ESTARÍA MAL ETIQUETADA.
 *
 * `porReglaPropia` se queda con los N mejores por lado, y su orden por
 * defecto es **la divergencia de fuerza** (`|dif|`), que es el criterio de la
 * APP. Si Bollinger usara ese orden, la fila llamada «Bollinger solo» estaría
 * midiendo «Bollinger, desempatado por fuerza relativa» — otra regla, con otro
 * nombre, y nadie se enteraría.
 *
 * Aquí el orden natural es cuánto se ha salido el precio de su banda, que es
 * lo que el propio indicador dice. Eso deja la etiqueta honesta.
 */
export const ordenPorBollinger =
  (opciones = {}) =>
  (p) => {
    const pos = posicionDe(p, opciones)
    // Un par sin bandas calculables ordena el último en vez de reventar el
    // `sort`. No puede «colarse» por esto: para llegar aquí ya pasó la regla,
    // y la regla devuelve null cuando no hay bandas.
    return pos === null ? 0 : Math.abs(pos)
  }

// ═════════════════════════════════════════════════════════════════════════
// LA VARIANTE QUE CORRE EN LA SOMBRA (desde el 2026-10-13)
// ═════════════════════════════════════════════════════════════════════════
//
// Néstor la pidió al leer la tabla: **«veo que el toque de la banda sola da
// todo en positivo, entonces por qué no la ponemos a prueba a ella sola pero
// que podamos ver sus movimientos y resultados en las apps»**.
//
// Es **el toque de banda a secas**: sin RSI, sin fuerza relativa, lectura de
// reversión. O sea la primera fila de la tabla del 2026-10-13.
//
// ⚠️⚠️ Y HAY QUE DECIR DOS COSAS INCÓMODAS ANTES DE NADA.
//
// **1. Esta variante NO es la que el listón del 2026-10-13 juzgaba.** Aquél
// fijó «con RSI estirado» ANTES de medir, con su motivo escrito, y esa falló.
// Elegir ahora la fila de al lado **es elegir después de ver la tabla**, que es
// lo que este proyecto rechazó con el control de la confluencia y con el del
// barrido de liquidez.
//
// Lo que lo hace legítimo aquí —y solo aquí— es que **no se enciende nada** y
// que el veredicto sale de días que nadie ha mirado todavía. Es exactamente la
// situación del LSS: su variante también salió de mirar una tabla, y por eso su
// `fuenteDelVeredicto` dice `'registro hacia adelante'`. El histórico queda
// guardado como PROMESA a comprobar, nunca como evidencia.
//
// **2. Ya se sabe que es frágil, y el número va escrito aquí para que nadie se
// lleve una sorpresa dentro de cinco meses:**
//
//   · +0,027 por 1R con spread, y gana en las dos mitades (+0,031 / +0,022);
//   · ⚠️ **−0,014 pagando 0,5 pips de swap por noche** — o sea que en una
//     cuenta real, con el peaje completo, YA MIDIÓ NEGATIVO;
//   · ⚠️ y **−0,008 de ventaja contra la reversión M2** (+0,035), que es la
//     regla que ya corre y a la que habría que ganarle para valer la pena.
//
// O sea que el histórico dice «positivo contando solo el spread, negativo
// contando el swap». Si el registro hacia adelante sale negativo, el backtest
// lo había avisado; si sale positivo pese al swap, eso SÍ sería nuevo.
export const PARAMS_SOMBRA = Object.freeze({
  lectura: 'reversion',
  // ⚠️ Los dos en `null`/`false` son la seña de identidad de esta variante, no
  // un valor por defecto que nadie eligió: es «la banda SOLA», que es lo que
  // Néstor pidió y lo que midió +0,027.
  rsiEstirado: null,
  exigirFuerza: false,
  periodo: PERIODO,
  k: DESVIACIONES,
})
