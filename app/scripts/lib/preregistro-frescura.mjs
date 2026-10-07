// ¿CUÁNTO CUESTA OPERAR CON UN BARRIDO VIEJO? — el listón, escrito ANTES.
//
// ─────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE, Y ES UNA CORRECCIÓN A MÍ
// ─────────────────────────────────────────────────────────────────────────
// El 2026-10-07, al construir la línea de «Generado hace 3 h», escribí que un
// barrido de tres horas te hace decidir con el mercado de hace tres horas, y
// lo presenté como si fuera un hecho medido. Néstor lo paró:
//
//   > Nadie ha comparado «la app con datos de hace 3 horas» contra «la app con
//   > datos frescos». Se podría medir, pero hoy no existe. Cuando digo «es
//   > peor» es razonamiento, no medición.
//
// Tenía razón. Es el patrón que este proyecto lleva meses coleccionando —un
// mecanismo convincente que nadie midió— y van ONCE veces documentadas. La
// diferencia es que esta vez lo cazó él antes de que el número saliera a la
// calle.
//
// Esto lo mide.

export const FECHA_DEL_LISTON = '2026-10-07'

// ─────────────────────────────────────────────────────────────────────────
// QUÉ SE MIDE EXACTAMENTE, Y POR QUÉ ASÍ
// ─────────────────────────────────────────────────────────────────────────
// Lo que le pasa de verdad a quien abre la app con un barrido viejo NO es que
// vea otras señales y ya. Es esto, y tiene dos mitades:
//
//   1. LOS NIVELES SON VIEJOS. La app dice «EUR/USD COMPRA, entrada 1.1585,
//      stop 1.1550, objetivo 1.1620». Esos tres números se calcularon hace k
//      horas.
//   2. PERO SE ENTRA AHORA. Nadie puede comprar al precio de hace tres horas.
//      El stop y el objetivo sí se ponen donde la app dijo, porque son los
//      números que tiene delante.
//
// Así que la medición entra al precio de AHORA con el stop y el objetivo de
// HACE k HORAS. Ésa es la pérdida: no es que la señal sea otra, es que la
// geometría ya no encaja con el precio.
//
// ⚠️ Y arrastra una tercera cosa que sale sola y no hay que añadir a mano: con
// el barrido viejo también se ven señales que ya murieron y NO se ven las que
// nacieron en esas k horas. Eso ya lo produce usar el conjunto de señales de
// i−k; no se modela aparte.
export const COMO_SE_MIDE =
  'entrada al precio de la vela de AHORA; stop y objetivo calculados k velas antes; ' +
  'el conjunto de señales es el que la app habría enseñado hace k velas'

// Los retrasos que se prueban, en velas de una hora.
//
// No son redondos por gusto: salen de los huecos MEDIDOS entre publicación y
// publicación del barrido de Intradía en las dos semanas anteriores al reloj
// externo — 1,7 h de mediana, 5,8 el p90 y 8,3 el mayor.
export const RETRASOS = [0, 1, 2, 3, 6]

// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ LAS DOS CONCLUSIONES POSIBLES, Y LAS DOS OBLIGAN A ALGO
// ─────────────────────────────────────────────────────────────────────────
// Esto es lo que hace que el listón valga: las dos salidas tienen consecuencia
// escrita, así que no se puede leer la tabla y quedarse con la que convenga.
//
// Y conviene ver que la app ya PIERDE con datos frescos (−0,13 por unidad de
// riesgo). Así que esto no mide «cuánto se gana con datos frescos»: mide
// cuánto EMPEORA una cosa que ya está en negativo. Un resultado de «no cambia
// nada» es perfectamente posible y no sería raro.
export const QUE_OBLIGA_CADA_RESULTADO = {
  cuesta:
    'Si a 3 horas el resultado empeora más que el UMBRAL, entonces la frase que ' +
    'escribí era cierta y ahora está medida. El número va a la pantalla al lado ' +
    'de «Generado hace 3 h», para que quien lo lea sepa qué le cuesta.',
  noCuesta:
    '⚠️ Si NO empeora, mi frase era falsa y hay que decirlo donde se dijo. La ' +
    'línea de frescura NO se quita —sigue siendo verdad de cuándo se calculó el ' +
    'dato, y el reloj externo sigue haciendo falta por el HISTORIAL, que es otra ' +
    'cosa— pero deja de venderse como protección y pasa a ser lo que sea que ' +
    'resulte ser. Y en la explicación para suscriptores se cuenta que lo ' +
    'comprobamos y nos desmintió.',
}

// Cuánto tiene que empeorar para contar como que cuesta algo.
//
// ⚠️ EL NÚMERO NO ES UN GUSTO: es el peaje del spread en esta app. Un cambio
// más pequeño que lo que ya cuesta entrar y salir no se puede separar del
// ruido ni tiene consecuencia práctica — nadie va a dejar de operar por algo
// que pesa menos que su propio spread. En Intradía el stop típico es de ~30
// pips y el spread de ~2, o sea el 7 % del riesgo: 0,07 por unidad de riesgo.
//
// ⚠️ En Swing el mismo umbral sería 0,02 (stop ~155 pips, spread ~2 = 1,3 %).
// Copiarlo de aquí sería traerse una suposición falsa, que es la lección de
// `barridoSwap` y la del ATR. Si algún día se mide allá, se deriva allá.
export const UMBRAL = 0.07

// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ CORRECCIÓN DE MÉTODO, hecha sobre MERCADO SINTÉTICO y antes de los
// datos reales. Qué decide de verdad: la FRACCIÓN NO USABLE.
// ─────────────────────────────────────────────────────────────────────────
// La primera versión de este listón decidía comparando «por 1R» entre la fila
// fresca y la de 3 horas. El humo con mercado inventado lo tumbó, y el motivo
// es de diseño y no de código:
//
//   Las señales que nacen fuera del pasillo (stop ya roto u objetivo ya
//   alcanzado) NO se puntúan, porque nadie las abriría. Pero entonces CADA
//   FILA TIENE UNA POBLACIÓN DISTINTA — a 6 horas sobrevive menos de la mitad
//   de las señales— y comparar la media de dos poblaciones distintas no mide
//   el retraso: mide la diferencia entre quiénes quedaron.
//
// En el humo eso salía de forma escandalosa: las filas con retraso medían
// MEJOR que la fresca. No porque el barrido viejo ayude, sino porque lo que
// sobrevive al descarte es otra cosa.
//
// Así que decide un número que NO tiene ese problema porque no es un promedio
// sobre supervivientes, sino un conteo sobre TODO lo que la app enseñaba:
//
//   **de cada 100 señales que la pantalla mostraba, cuántas ya no se podían
//   tomar cuando las leíste.**
//
// Con el barrido fresco es 0 por construcción, así que cualquier número por
// encima es coste medido y no ruido. El umbral es «más de 1 de cada 20».
//
// ⚠️ Cambiar el criterio DESPUÉS de ver un resultado real sería justo lo que
// un listón escrito antes existe para impedir. Esto no es eso: lo enseñó un
// mercado INVENTADO, que dijo que la medida estaba mal elegida y no cuál es
// la respuesta. Es el mismo caso que `atrMedioGlobal` y la mediana en
// `rejilla-atr.mjs`, y queda escrito aquí para que se pueda juzgar.
export const UMBRAL_NO_USABLES = 5

// El «por 1R» se sigue imprimiendo, y NO decide. Va como contexto, con el
// aviso de que sus filas no son comparables entre sí.
export const POR_1R_NO_DECIDE =
  'las filas de «por 1R» tienen poblaciones distintas (cada retraso descarta ' +
  'otras señales), así que se imprimen como contexto y NO deciden'

// Y la asimetría de siempre: ante la duda, NO se afirma que cuesta.
//
// Equivocarse hacia «cuesta» pondría en pantalla un número inventado que
// asusta — y esta app vende justo lo contrario. Equivocarse hacia «no cuesta»
// deja la línea de frescura como información y nada más, que es de donde
// venimos. Los dos errores no valen lo mismo.
export const ANTE_LA_DUDA = 'noCuesta'

// Número mínimo de operaciones por fila para que la fila diga algo.
//
// Con el margen del peor caso (98/√n), 400 operaciones dan ±5 puntos de
// acierto. Por debajo de 200 la fila se imprime pero NO decide.
export const MIN_OPS = 200

/**
 * El veredicto, CALCULADO y no argumentado.
 *
 * @param {{retraso:number, ops:number, porRiesgo:number}[]} filas
 * @returns {{veredicto:'cuesta'|'noCuesta'|'noSePudoMirar', porque:string,
 *            base:number|null, aTresHoras:number|null, dano:number|null}}
 */
export function juzgar(filas) {
  const base = filas.find((f) => f.retraso === 0)
  const tres = filas.find((f) => f.retraso === 3)

  // ⚠️ Sin las dos filas no hay veredicto, y «no se pudo mirar» NO es «no
  // cuesta». Es el agujero de `veredictoBusqueda` del 2026-09-14, donde un
  // informe mío afirmó «no la publican» habiendo leído cero páginas.
  if (!base || !tres) {
    return { veredicto: 'noSePudoMirar', porque: 'falta la fila de 0 o la de 3 horas', pctNoUsables: null, dano: null }
  }

  // ⚠️ UN NÚMERO QUE NO ES UN NÚMERO NO ES «NO CUESTA». El humo sacó un `NaN`
  // y este veredicto contestó «noCuesta» tan tranquilo, porque `NaN > algo` es
  // false y la comparación caía sola al lado tranquilizador.
  if (!Number.isFinite(tres.pctNoUsables) || !Number.isFinite(tres.vistas)) {
    return { veredicto: 'noSePudoMirar', porque: 'la fila de 3 horas no trae un recuento utilizable', pctNoUsables: null, dano: null }
  }

  if (tres.vistas < MIN_OPS) {
    return {
      veredicto: 'noSePudoMirar',
      porque: `solo ${tres.vistas} señales vistas, menos de ${MIN_OPS}`,
      pctNoUsables: tres.pctNoUsables,
      dano: null,
    }
  }

  // Con el barrido fresco tiene que ser 0: es la comprobación de que la fila
  // de control reproduce la app. Si no lo fuera, algo está mal arriba.
  if (Number.isFinite(base.pctNoUsables) && base.pctNoUsables > 0.01) {
    return {
      veredicto: 'noSePudoMirar',
      porque: `la fila fresca descarta un ${base.pctNoUsables.toFixed(1)} % y debería descartar 0: la fila de control no reproduce la app`,
      pctNoUsables: tres.pctNoUsables,
      dano: null,
    }
  }

  // Tolerancia hacia ARRIBA: el empate cae en «no cuesta», que es lo que dice
  // ANTE_LA_DUDA. La escribí al revés la primera vez y la prueba del borde lo
  // cazó — empujar el empate hacia la conclusión alarmante es justo lo que
  // esta medición existe para no hacer.
  const cuesta = tres.pctNoUsables > UMBRAL_NO_USABLES + 1e-9

  return {
    veredicto: cuesta ? 'cuesta' : 'noCuesta',
    porque: cuesta
      ? `con 3 horas de retraso, ${tres.pctNoUsables.toFixed(1)} de cada 100 señales ya no se podían tomar (umbral ${UMBRAL_NO_USABLES})`
      : `con 3 horas de retraso solo ${tres.pctNoUsables.toFixed(1)} de cada 100 señales dejaban de poder tomarse, por debajo del umbral de ${UMBRAL_NO_USABLES}`,
    pctNoUsables: tres.pctNoUsables,
    dano: Number.isFinite(base.porRiesgo) && Number.isFinite(tres.porRiesgo) ? base.porRiesgo - tres.porRiesgo : null,
  }
}

// ⚠️ LO QUE ESTA MEDICIÓN NO CONTESTA, dicho antes de verla:
//
//  · NO dice si la app gana. Ya está medido que pierde (−0,13 con la vara
//    neutra). Esto compara dos formas de perder.
//  · NO justifica apagar ni encender ninguna señal. Es información sobre el
//    DATO, no un filtro. Si alguien quisiera «no operar con un barrido de más
//    de k horas», eso sí es un filtro y va al banco con su propio listón.
//  · NO vale para Swing. Allí una vela es un día y el equivalente sería «el
//    barrido de ayer», que es otra pregunta con otro umbral.
export const LO_QUE_NO_CONTESTA = [
  'si la app gana (ya está medido que no)',
  'si conviene apagar señales por barrido viejo (eso sería un filtro)',
  'nada sobre Swing (allí el retraso equivalente es de un día entero)',
]
