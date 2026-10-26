// Qué horas del reloj son mercado de Forex y cuáles no.
//
// ⚠️ ESTE ARCHIVO EXISTE PARA QUE EL CONVENIO NO ESTÉ EN DOS SITIOS.
//
// Vivía dentro de `sonda-oro.mjs`, que es una sonda: un guion de usar una vez
// para ver si una puerta está abierta. El 2026-10-26 lo necesitó también
// `publicar-estacionalidad.mjs`, que es producción y corre todos los días —
// porque un perfil por hora calculado sobre velas de sábado diría que la
// madrugada del sábado es una hora de mercado floja, cuando es que no existe.
//
// Copiarlo habría sido el fallo que este proyecto lleva arreglando: el umbral
// de fuerza estaba en nueve sitios (2026-10-12), `ATR_REVERSION` en dos, y la
// geometría de «comprar la caída» se separó de la que su listón juzgaba. Así
// que se mueve aquí y `sonda-oro.mjs` lo reexporta — el mismo patrón que
// `perforaExtremo`, que vive en `src/lib/marketCalc.js` y `patrones.mjs`
// reexporta.
//
// El reparto medido el 2026-09-30 sobre las 300 velas que pide el vigía: 198
// de mercado, 16 de frontera y **86 cerradas (28,7 %)**, y las cerradas se
// mueven 5,2 veces menos por la mediana. O sea que no es un detalle.

/**
 * ⚠️⚠️ ¿ESTA HORA CAE DENTRO DE LA SEMANA DE MERCADO? Con tres respuestas, no
 * dos, y la del medio es la que hace que esto sea honesto.
 *
 * El Forex abre el domingo por la noche y cierra el viernes por la noche, en
 * horario de Nueva York — o sea que **el borde se mueve una hora con el cambio
 * de hora** (21:00 o 22:00 UTC según la época del año). No hay un instante
 * fijo que se pueda escribir aquí.
 *
 * Así que en vez de fingir precisión se parte en tres:
 *
 *   'cerrado'  → imposible que fuera mercado, con cualquier horario de verano:
 *                sábado de 00:00 a 20:59, domingo de 00:00 a 20:59, y viernes
 *                de 23:00 a 23:59.
 *   'frontera' → las horas donde el cambio de hora decide: viernes 21:00-22:59,
 *                sábado y domingo de 21:00 a 23:59.
 *   'mercado'  → el resto.
 *
 * ⚠️ LA CUENTA QUE DECIDE ES LA DE 'cerrado', y solo ésa. Es un **suelo**: si
 * hay una sola vela ahí, la rejilla trae horas sin mercado, y eso no lo puede
 * explicar ningún horario de verano. Las de 'frontera' se cuentan aparte y NO
 * se suman al hallazgo.
 *
 * 📌 Sin esta separación la sonda diría «hay velas en domingo» y sería
 * engañoso: **el domingo a las 22:00 el mercado SÍ está abierto** — es cuando
 * abre. Llamar cerrado a una hora de mercado sería la etiqueta equivocada de
 * siempre, y en este proyecto eso está escrito como un error de medición.
 */
export function clasificarHora(t) {
  if (typeof t !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t)) return null
  const d = new Date(t.replace(' ', 'T') + 'Z')
  if (!Number.isFinite(d.getTime())) return null

  const dia = d.getUTCDay() // 0 = domingo … 6 = sábado
  const h = d.getUTCHours()

  // Sábado: cerrado todo el día salvo la frontera de la noche.
  if (dia === 6) return h <= 20 ? 'cerrado' : 'frontera'
  // Domingo: cerrado hasta la tarde; la noche es cuando abre (o está a punto).
  if (dia === 0) return h <= 20 ? 'cerrado' : 'frontera'
  // Viernes: cierra por la noche. Las 21 y 22 son frontera; de 23 en adelante,
  // cerrado con cualquier horario.
  if (dia === 5) {
    if (h >= 23) return 'cerrado'
    if (h >= 21) return 'frontera'
  }
  return 'mercado'
}

/**
 * El reparto de una lista de horas entre las tres clases, más el detalle de
 * cuáles son las cerradas (para poder mirarlas con los ojos).
 */
export function repartoDeMercado(horas) {
  const out = { mercado: 0, frontera: 0, cerrado: 0, ilegibles: 0, cerradas: [] }
  for (const t of horas ?? []) {
    const c = clasificarHora(t)
    if (c === null) out.ilegibles++
    else {
      out[c]++
      if (c === 'cerrado') out.cerradas.push(t)
    }
  }
  return out
}
