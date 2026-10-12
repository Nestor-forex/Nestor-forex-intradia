// EL PREREGISTRO DE «APAGAR EL MODO TENDENCIA».
//
// ═════════════════════════════════════════════════════════════════════════
// ESCRITO EL 2026-10-12, ANTES DE CORRER NADA.
// ═════════════════════════════════════════════════════════════════════════
//
// ⚠️ SI ESTOS NÚMEROS SE TOCAN DESPUÉS DE VER UN RESULTADO, EL PREREGISTRO NO
// VALE NADA Y ES MEJOR BORRAR EL ARCHIVO QUE DEJARLO MINTIENDO. Mover el listón
// hasta que la propuesta lo pase no es medir: es decidir primero y buscar el
// número después.
//
// ─────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE LA PREGUNTA
// ─────────────────────────────────────────────────────────────────────────
// Del REGISTRO REAL de la app, el 2026-10-12, con la lógica de
// `historialCalc.js` sobre los archivos de la rama `datos`:
//
//   modo rango      39 ops · 54 % ±16 · +353 pips · equilibrio 40 % → encima
//   modo tendencia  40 ops · 20 % ±15 · −985 pips · equilibrio 37 % → debajo
//
//   diferencia 34 puntos · z = +3,32 · p = 0,0009
//
// Los márgenes NO se solapan, que es lo primero que se mira aquí. Y contra el
// backtest de la app (38 %) cada uno se desvía en dirección contraria:
// rango z = +2,04 (p = 0,042), tendencia z = −2,35 (p = 0,019).
//
// ⚠️⚠️ PERO ESO SON 79 OPERACIONES, Y HAY UN SESGO MEDIDO ENCIMA.
//
// El 2026-10-06 se midió que el reloj de GitHub hacía que el vigía mirara solo
// 4,3 de las 24 horas del día, y que eso NO es ruido sino un sesgo con
// dirección: una señal que dura una hora solo queda anotada si el vigía mira
// justo esa hora, y una que dura seis queda anotada casi siempre. O sea que el
// registro real **sobre-representa las señales lentas**. Si los dos modos
// tienen duraciones típicas distintas —y es plausible que sí: el rango busca
// el borde contrario y la tendencia persigue—, ese sesgo los afecta distinto.
//
// Por eso el registro real NO decide. Decide el banco de pruebas, que se baja
// las velas él mismo y no depende de ninguna corrida del vigía.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ LO QUE HACE ESTA MEDICIÓN DISTINTA DE LAS OCHO DE FILTROS
// ─────────────────────────────────────────────────────────────────────────
// Van ocho familias de filtros medidas y ocho fallando (RSI, ADX, confluencia
// de marcos, barrido de liquidez, COT, NFX-LSS, la rejilla de stop y objetivo,
// breakeven). Esto NO es un filtro, y la diferencia es mecánica:
//
// Un filtro sobre las señales de la app **no quita señales: las cambia por
// otras**, porque la app se queda con los N mejores por lado y al rechazar uno
// sube el siguiente del hueco (medido el 2026-08-25). Eso convierte la
// medición en «la app con otras señales» y no en «la app menos las malas».
//
// Aquí no pasa. Los dos modos son LISTAS INDEPENDIENTES en `derivarVista`:
// `rangosRaw` sale de `paresRaw` por su cuenta y `clasificarRango` exige ADX
// por debajo de `ADX_MAX_RANGO`, que es lo contrario de lo que pide una señal
// de tendencia — el propio código dice que «no pueden ser el mismo par a la
// vez». Así que apagar tendencia es una RESTA LIMPIA: las señales de rango son
// exactamente las mismas antes y después.
//
// ⚠️ Eso hay que COMPROBARLO y no suponerlo. `medir-modos.mjs` cuenta las
// señales de rango con y sin el modo tendencia encendido y falla si no
// coinciden una a una. Si algún día dejan de ser independientes, esta medición
// deja de significar lo que dice.
//
// ─────────────────────────────────────────────────────────────────────────
// Y LO QUE ESTA MEDICIÓN **NO** PUEDE CONTESTAR
// ─────────────────────────────────────────────────────────────────────────
// Estos cinco años ya se han mirado muchas veces en este proyecto. Que el
// listón esté escrito antes no los vuelve datos nuevos.
//
// Lo que sí es nuevo: la distinción entre los dos modos **no se inventó mirando
// esta tabla**. Es una decisión de diseño de la app de hace meses, que el vigía
// escribe en cada señal en el momento de anotarla. No es un troceo a
// posteriori como el control de la confluencia o el del barrido de liquidez,
// que se miraron DESPUÉS de ver el resultado.

export const PREREGISTRO = {
  fecha: '2026-10-12',
  pregunta: '¿Debe la app apagar el modo tendencia y quedarse solo con el modo rango?',
  // Con qué se juzga. La vara neutra, como todo lo demás de este proyecto: con
  // objetivos variables, una opción puede salir mejor por seleccionar
  // operaciones con buena proporción objetivo/riesgo sin acertar ni una
  // dirección de más. Eso ya pasó con el COT el 2026-09-14, donde un filtro
  // medía positivo con la geometría real y negativo con la neutra.
  vara: 'neutra 1:1',
  // La geometría real de la app va como COMPROBACIÓN, nunca como decisión.
  geometriaRealEsSoloComprobacion: true,
}

// ─────────────────────────────────────────────────────────────────────────
// LOS CINCO LISTONES. TIENEN QUE PASAR **TODOS**.
// ─────────────────────────────────────────────────────────────────────────
export const CRITERIOS = [
  {
    clave: 'mejoraTotal',
    titulo: 'el modo rango mide mejor que la app entera, con costes',
    // ⚠️ El umbral no es «mejor que cero»: es mejor que la app DE HOY por un
    // margen que el ruido no explique. Con resultados por operación entre −1 y
    // +1 y unas 8.000 operaciones, el error típico de cada media ronda 0,011,
    // así que una diferencia de 0,02 son ~1,3 errores típicos de la
    // diferencia. Es poco exigente a propósito en el TOTAL, porque lo que de
    // verdad filtra es el criterio de las mitades.
    umbral: 0.02,
    juzga: (d) => d.rango.por1R - d.app.por1R >= 0.02 - 1e-9,
    explica: (d) =>
      `rango ${n3(d.rango.por1R)} contra la app ${n3(d.app.por1R)} → diferencia ${n3(d.rango.por1R - d.app.por1R)} (hace falta +0,020)`,
  },
  {
    clave: 'mejoraEnLasDosMitades',
    titulo: '⚠️ y mejora en LAS DOS mitades del periodo',
    // Éste es el que separa una mejora de un reparto afortunado. El ruido no
    // se repite en las dos mitades; una ventaja real sí. Es el criterio que
    // tumbó al COT, que daba +0,002 en la primera mitad y −0,065 en la
    // segunda — la firma exacta de una moneda al aire.
    juzga: (d) => d.rango.mitad1 > d.app.mitad1 && d.rango.mitad2 > d.app.mitad2,
    explica: (d) =>
      `1ª ${n3(d.rango.mitad1)} vs ${n3(d.app.mitad1)} · 2ª ${n3(d.rango.mitad2)} vs ${n3(d.app.mitad2)}`,
  },
  {
    clave: 'quedanSenalesSuficientes',
    titulo: 'y la app no se queda muda: al menos 8 señales al mes',
    // ⚠️ Un sistema que mide mejor pero habla una vez al mes no es un producto.
    // Y hay precedente: el 2026-09-04 se AFLOJARON dos puertas justamente para
    // que las apps hablaran más, aceptando que el resultado por operación no
    // mejorara. Dar marcha atrás a ciegas sería deshacer esa decisión sin
    // decirlo.
    //
    // El 8 sale de que el rango lleva 39 operaciones reales en ~2 meses, o sea
    // ~19 al mes en el registro (que además va sesgado hacia abajo por el
    // reloj). Se pide menos de la mitad de eso: si el banco dice que el rango
    // solo da 8 señales al mes sobre cinco años, la pregunta ya no es si mide
    // mejor.
    minSenalesMes: 8,
    juzga: (d) => d.rango.senalesMes >= 8,
    explica: (d) => `${d.rango.senalesMes.toFixed(1)} señales/mes (hace falta 8)`,
  },
  {
    clave: 'aguantaElSwap',
    titulo: 'y sigue mejor que la app pagando 0,5 pips de swap por noche',
    // ⚠️ En Intradía esto NO sobra por llamarse Intradía: está medido que el
    // 52 % de sus operaciones reales cruzan al menos una noche (Fase 2,
    // 2026-09-02). Y los dos modos pueden durar cosas distintas, así que el
    // swap podría explicar parte de la diferencia él solo.
    juzga: (d) => d.rangoSwap.por1R > d.appSwap.por1R,
    explica: (d) => `con swap: rango ${n3(d.rangoSwap.por1R)} contra la app ${n3(d.appSwap.por1R)}`,
  },
  {
    clave: 'noEsUnPar',
    titulo: 'y ningún par aporta más del 40 % de la ventaja del rango',
    // Si casi toda la mejora saliera de un par, no sería un efecto del mercado
    // sino ese par en estos cinco años. Mismo criterio que en el preregistro de
    // «comprar la caída».
    maxAporte: 0.4,
    juzga: (d) => d.aporteDelMejorPar <= 0.4 + 1e-9,
    explica: (d) => `el par que más aporta pone el ${(d.aporteDelMejorPar * 100).toFixed(0)} % (máximo 40 %)`,
  },
]

const n3 = (x) => (x >= 0 ? '+' : '') + x.toFixed(3)

// Cuántas operaciones hacen falta en cada grupo para que su número signifique
// algo. Con 150 el margen del peor caso baja de ±10 puntos; por debajo de eso
// un porcentaje no distingue nada. Es el mismo número que el listón de la
// sombra, y por el mismo motivo: sale de `margen(n) = 98/√n`, que es
// aritmética y no depende de la app.
export const MIN_OPS = 150

/**
 * El veredicto lo CALCULA esto, no lo argumenta nadie.
 *
 * ⚠️⚠️ Y LO PRIMERO QUE HACE ES NEGARSE A JUZGAR SIN DATOS.
 *
 * Esto salió del humo con un mercado inventado, antes de gastar un crédito: en
 * aquel mercado no había NI UNA señal de rango, `medir()` devolvía `null` y el
 * guion lo convertía en 0 con un `?? 0`. Resultado: «+0,000» le ganaba a
 * «−1,356» y el listón daba por bueno el criterio más importante **sobre un
 * grupo vacío**.
 *
 * Es el fallo que este proyecto lleva meses cerrando por el otro lado —
 * `pearson` devolviendo `null` y nunca 0, `difMax` igual, `veredictoBusqueda`
 * diciendo «no se pudo mirar» y nunca «no existe»— y aquí había entrado por la
 * puerta de atrás. «No se pudo medir» y «midió cero» no son lo mismo, y de los
 * dos errores el caro es confundirlos a favor de la propuesta.
 *
 * @param {object} d  los números medidos
 * @returns {{ pasa: boolean, pasados: number, detalle: Array, noSePudoMedir: string }}
 */
export function juzgar(d) {
  // Ante la duda, NO hay veredicto. Nunca «pasa» por falta de datos.
  const faltan = []
  for (const [nombre, g] of [['rango', d.rango], ['la app', d.app]]) {
    if (!g || !Number.isFinite(g.por1R) || !Number.isFinite(g.mitad1) || !Number.isFinite(g.mitad2))
      faltan.push(`${nombre}: sin número que juzgar`)
    else if (g.ops < MIN_OPS) faltan.push(`${nombre}: ${g.ops} operaciones, hacen falta ${MIN_OPS}`)
  }
  if (!Number.isFinite(d.rangoSwap?.por1R) || !Number.isFinite(d.appSwap?.por1R)) faltan.push('falta la fila del swap')

  if (faltan.length) {
    return {
      pasa: false,
      pasados: 0,
      noSePudoMedir: faltan.join(' · '),
      detalle: CRITERIOS.map((c) => ({ clave: c.clave, titulo: c.titulo, pasa: false, explica: 'no se pudo medir' })),
    }
  }

  const detalle = CRITERIOS.map((c) => ({
    clave: c.clave,
    titulo: c.titulo,
    pasa: c.juzga(d),
    explica: c.explica(d),
  }))
  return { pasa: detalle.every((x) => x.pasa), pasados: detalle.filter((x) => x.pasa).length, detalle, noSePudoMedir: '' }
}

// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ LO QUE PASA CON CADA VEREDICTO, ESCRITO ANTES DE VERLO
// ─────────────────────────────────────────────────────────────────────────
export const QUE_HACER = {
  pasa:
    'Se le PROPONE a Néstor apagar el modo tendencia. No se apaga aquí: eso es ' +
    'un PR aparte, con su prueba y su verificación en navegador, y es decisión ' +
    'suya. Y al proponerlo hay que decirle que la app pasa a hablar menos.',
  noPasa:
    'La app se queda EXACTAMENTE como está, con los dos modos. Y el Historial ' +
    'sigue enseñándolos separados, que es lo que ya hace desde el 2026-09-16: ' +
    'el promedio de los dos (37 %) no describe a ninguno.',
}

// ⚠️ Y LO QUE NO AUTORIZA NINGÚN VEREDICTO:
//
// · Apagar el modo RANGO si saliera al revés. Esa es otra pregunta y este
//   listón no la mide: está escrito en una sola dirección a propósito, porque
//   es la que el registro real sugirió. Probar las dos y quedarse con la que
//   gane sería elegir a posteriori.
//
// · Usar el registro real de 79 operaciones como confirmación de lo que salga
//   aquí. Va sesgado por el reloj (medido el 2026-10-06) y es la razón de que
//   esta medición exista, no su respaldo.
//
// · Aflojar un criterio porque el resultado quede «a un pelo». Ése es el
//   momento exacto para el que se escribe el listón antes.
