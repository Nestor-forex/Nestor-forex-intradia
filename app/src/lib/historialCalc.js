// Las cuentas del historial de señales.
//
// Vive en src/lib (y no en scripts/) porque lo usan los dos lados: el vigía
// para imprimir el resumen en sus registros, y la app para pintarlo en la
// pantalla de Historial. Si estuviera duplicado, un día darían números
// distintos y no sabríamos cuál creer.
//
// Sin React ni nada del navegador, para que Node lo pueda importar igual.

/**
 * Cuenta cuántas señales acertaron y cuántos pips netos dejaron.
 *
 * Devuelve las cuentas DOS veces: `todas` y `exactas`. No es redundancia.
 * En los 7 pares contra el dólar el máximo y el mínimo de cada vela son
 * exactos, pero en los 7 cruces (EUR/CHF, AUD/JPY…) el barrido los deriva de
 * las otras divisas y salen algo MÁS ANCHOS que los reales — así que un
 * objetivo o un stop puede darse por tocado sin haberlo sido.
 *
 * Mezclarlo todo en un solo porcentaje daría un número que nadie sabe cuánto
 * vale. Separarlo deja ver el dato fiable al lado del aproximado.
 *
 * ⚠️ Y aparte va `sombra`: las señales de un tipo que todavía está en pruebas
 * (hoy, las de retroceso). El vigía las anota para ir acumulando operaciones
 * reales, pero la app no las da y nadie recibe aviso de ellas. Por eso NO
 * pueden entrar en `todas`: el porcentaje que mira Néstor estaría contando un
 * tipo de señal que la app ni siquiera le muestra, y dejaría de responder la
 * pregunta que la pantalla dice responder.
 */
export function resumir(resultados) {
  const cuenta = (lista) => {
    const ganadas = lista.filter((r) => r.resultado === 'ganada').length
    const perdidas = lista.filter((r) => r.resultado === 'perdida').length
    const total = ganadas + perdidas
    return {
      ganadas,
      perdidas,
      total,
      // null y no 0 cuando no hay nada: "todavía no se sabe" y "0% de acierto"
      // son cosas muy distintas y la pantalla las muestra distinto.
      acierto: total ? Math.round((ganadas / total) * 100) : null,
      pips: Math.round(lista.reduce((a, r) => a + (r.pips || 0), 0)),
    }
  }

  const todasJuzgadas = (resultados || []).filter(
    (r) => r.resultado === 'ganada' || r.resultado === 'perdida'
  )
  // Las de sombra salen de aquí y no vuelven a entrar en ninguna de las
  // cuentas de abajo. Su sitio es `sombra`, y solo lo lee el vigía.
  const juzgadas = todasJuzgadas.filter((r) => !r.sombra)

  // ⚠️ LOS DOS MODOS DE LA APP, CONTADOS APARTE (2026-09-16).
  //
  // Néstor: «quiero que se vean todos —la app (tendencia), la app (rango),
  // retroceso (en pruebas)— con operaciones, acertadas y pips».
  //
  // Y no es solo comodidad: con los números reales de producción **la app
  // tiene dos comportamientos opuestos escondidos dentro de un promedio**.
  // Tendencia va 6 de 27 con −629 pips; rango va 10 de 24 con +43. Juntos dan
  // un 31 % que no describe a ninguno de los dos. Es la MISMA razón por la que
  // la sombra nunca se suma a la app: un promedio entre cosas distintas no es
  // un resumen, es un número que no significa nada.
  //
  // ⚠️ CADA CUBO SE DEFINE POR LO QUE ES, nunca por descarte. Ese fallo ya
  // mordió cuatro veces en este proyecto (`esSombra`, `ventasPausadas`,
  // `esDeLaApp` y la regla de Firestore): lo que se añada mañana caería dentro
  // en silencio. Si el vigía empieza a anotar un `tipo` nuevo, aparecerá en
  // `todas` y en `otros` — nunca disfrazado de tendencia ni de rango.
  const deTipo = (t) => juzgadas.filter((r) => r.tipo === t)
  const CONOCIDOS = ['tendencia', 'rango']

  return {
    todas: cuenta(juzgadas),
    exactas: cuenta(juzgadas.filter((r) => r.exacto)),
    // Cuántas de las juzgadas son aproximadas, para poder avisar solo cuando
    // de verdad hay alguna.
    aproximadas: juzgadas.filter((r) => !r.exacto).length,
    tendencia: cuenta(deTipo('tendencia')),
    rango: cuenta(deTipo('rango')),
    // El cajón de lo que no encaja. No se pinta si está vacío, pero existe
    // para que un tipo nuevo NO desaparezca de la vista: sumaría en `todas` y
    // no saldría en ningún desglose, que es justo el fallo silencioso de
    // siempre. Aquí entra también el historial viejo sin `tipo`.
    otros: cuenta(juzgadas.filter((r) => !CONOCIDOS.includes(r.tipo))),
    sombra: cuenta(todasJuzgadas.filter((r) => r.sombra)),
  }
}
