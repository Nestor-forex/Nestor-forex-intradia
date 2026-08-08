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

  const juzgadas = (resultados || []).filter(
    (r) => r.resultado === 'ganada' || r.resultado === 'perdida'
  )

  return {
    todas: cuenta(juzgadas),
    exactas: cuenta(juzgadas.filter((r) => r.exacto)),
    // Cuántas de las juzgadas son aproximadas, para poder avisar solo cuando
    // de verdad hay alguna.
    aproximadas: juzgadas.filter((r) => !r.exacto).length,
  }
}
