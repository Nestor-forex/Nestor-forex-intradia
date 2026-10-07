// ¿DE CUÁNDO ES EL BARRIDO QUE ESTÁS VIENDO? — las cuentas puras.
//
// ─────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE, Y EL MOTIVO BUENO ES DE NÉSTOR
// ─────────────────────────────────────────────────────────────────────────
// `barrido.json` lleva `generadoEl` desde siempre y **la app no lo leía**.
// Enseñaba la fecha de la VELA (vía `corte`), que es verdad, pero no cuándo se
// hizo la cuenta.
//
// Yo presenté esto como «sirve para saber si la app está atascada». Néstor
// señaló algo mayor, y es la razón de verdad:
//
//   > sirve para saber si estás decidiendo con el mercado de AHORA o con el de
//   > hace tres horas.
//
// Y no era una preocupación teórica. Medido sobre las dos semanas anteriores al
// reloj externo, los huecos entre publicación y publicación del barrido de
// Intradía: **1,7 h de mediana, 5,8 el p90, 8,3 el mayor, y el 38 % de los
// huecos pasaban de 3 horas**. En Intradía la fuerza se calcula sobre ventanas
// de 1, 4 y 24 horas, así que en tres horas la de 1 h se renovó tres veces: una
// divisa podía pasar de primera a quinta.
//
// La app imprimía la hora de la vela, así que el dato para cazarlo estaba en
// pantalla. Pero obligaba a quien mira a hacer la resta mental («son las 5,
// esto dice las 2, luego llevo tres horas de retraso»). **Un dato correcto que
// exige esa resta es mal diseño, no un descuido del usuario.**
//
// ⚠️ ES INFORMACIÓN, NO UNA ALARMA. No apaga ni cambia ninguna señal. Decir
// «esto es de hace 3 horas» es un hecho; decir «no operes» sería un consejo, y
// eso iría al banco de pruebas como todo lo demás.

// ⚠️ EL UMBRAL NO VIVE AQUÍ, y es a propósito. Cada app publica con una
// cadencia distinta —el vigía de Swing una vez al día, el de Intradía una vez
// por hora— así que «viejo» no significa lo mismo en las dos. Copiar el número
// de la hermana sería traerse una suposición que aquí es falsa, que es la
// lección de `barridoSwap` y del ATR. Lo pasa quien llama, desde su
// `useMarketData.js`, que es PRIMO.

// Margen para el reloj del teléfono de quien mira, que puede ir unos minutos
// adelantado respecto al servidor que generó el archivo. Dentro de ese margen
// se lee como «recién hecho»; más allá, se prefiere no afirmar nada.
const ADELANTO_TOLERADO_MIN = 5

// Cuántos minutos hace que se generó esto. `null` —y nunca 0— cuando no se
// puede saber.
//
// ⚠️ LA ASIMETRÍA DE SIEMPRE: ante cualquier duda devuelve `null`, que la
// pantalla traduce en NO PINTAR NADA. Equivocarse hacia «no digo nada» deja
// las cosas como estaban; equivocarse hacia un «hace 0 h» inventado afirmaría
// que el dato está fresco cuando no se sabe, que es justo lo que esto viene a
// arreglar.
//
// ⚠️ Y el `typeof` no es paranoia: `new Date(null)` NO es una fecha inválida en
// JavaScript, es el 1 de enero de 1970. Sin esa comprobación un archivo sin
// `generadoEl` pintaría «hace 29 millones de minutos» — el mismo fallo que ya
// mordió en `minutosDesde` de `useMT5Quotes`.
export function edadEnMinutos(generadoEl, ahora) {
  if (typeof generadoEl !== 'string') return null
  const t = new Date(generadoEl)
  if (Number.isNaN(t.getTime())) return null

  const min = Math.floor((ahora.getTime() - t.getTime()) / 60000)
  if (min < -ADELANTO_TOLERADO_MIN) return null // el reloj de alguien está mal
  return Math.max(0, min)
}

// Cómo se dice esa edad, y si ya es vieja.
//
// Devuelve la CLAVE del idioma y el número, no el texto: cada idioma ordena la
// frase distinto y varias de estas llevan el número dentro, así que en los
// diccionarios son funciones y no concatenaciones.
//
// ⚠️ A PROPÓSITO NO SE USA `Intl.RelativeTimeFormat`, que haría esto solo en
// los 13 idiomas. En árabe saca cifras árabo-índicas, y esta frase va al lado
// de la hora de la vela, que es una cadena ISO en cifras latinas: saldrían dos
// sistemas de dígitos en el mismo renglón. Es el fallo exacto que ya mordió en
// el COT y en el oro.
//
// ⚠️ Por debajo de un minuto se dice «hace 1 min» y no «hace 0». Redondear
// hacia ARRIBA es el lado seguro: hace que el dato parezca algo más viejo de lo
// que es, nunca más fresco.
export function describirEdad(minutos, horasViejo) {
  if (minutos === null || minutos === undefined) return null

  const viejo = typeof horasViejo === 'number' && minutos >= horasViejo * 60

  if (minutos < 60) return { clave: 'generadoMin', n: Math.max(1, minutos), viejo }
  if (minutos < 48 * 60) return { clave: 'generadoH', n: Math.floor(minutos / 60), viejo }
  return { clave: 'generadoDias', n: Math.floor(minutos / (60 * 24)), viejo }
}

// ─────────────────────────────────────────────────────────────────────────
// CUÁNTO CUESTA ESA ANTIGÜEDAD — pero solo donde esté MEDIDO
// ─────────────────────────────────────────────────────────────────────────
// El 2026-10-07 se midió en Intradía, sobre 19.899 velas de una hora (tres
// años), cuántas de las señales que la app enseñaba YA NO SE PODÍAN TOMAR
// cuando el barrido tenía k horas: o el precio ya se había pasado del stop, o
// ya había llegado al objetivo.
//
// ⚠️⚠️ LA TABLA NO VIVE AQUÍ, Y ÉSA ES LA DECISIÓN.
//
// Este archivo es GEMELO: lo que se escriba aquí sale en las DOS apps. Y la
// medición es de INTRADÍA — en Swing una vela es un día y el retraso
// equivalente es otra pregunta, con otro umbral, que NO se ha medido.
//
// Así que la tabla la pasa quien llama, desde su `useMarketData.js`, que es
// PRIMO. Swing pasa `null` y entonces aquí no se afirma nada: ni número, ni
// renglón. Es la misma asimetría que `HORAS_VIEJO` y la misma lección de
// `barridoSwap` — un número medido en una app no vale en la otra.
//
// ⚠️ Y ante la duda NO se afirma. Sin tabla, con una tabla rara, o con una
// antigüedad por debajo del primer punto medido, devuelve `null`. Inventar un
// porcentaje en una app cuyo argumento entero es no afirmar más de lo que se
// puede demostrar sería exactamente lo contrario de lo que esto viene a hacer.

/**
 * Qué parte de las señales enseñadas ya no se puede tomar, a esta antigüedad.
 *
 * @param {number|null} minutos   lo que devuelve `edadEnMinutos`
 * @param {{horas:number, pct:number}[]|null} tabla  puntos MEDIDOS, de menor a mayor
 * @returns {{pct:number, horas:number}|null}
 */
export function costeDeLaAntiguedad(minutos, tabla) {
  if (typeof minutos !== 'number' || !Number.isFinite(minutos)) return null
  if (!Array.isArray(tabla) || !tabla.length) return null

  const horas = minutos / 60
  // Se coge el MAYOR punto medido que no pase de la antigüedad actual: así el
  // número que sale siempre es uno que se midió, nunca uno interpolado.
  //
  // ⚠️ Interpolar sería inventar. Entre el punto de 3 h y el de 6 h no hay
  // medición, y una recta entre dos puntos no es un dato: es un dibujo.
  let elegido = null
  for (const p of tabla) {
    if (!Number.isFinite(p?.horas) || !Number.isFinite(p?.pct)) return null
    if (horas >= p.horas && p.pct > 0) elegido = p
  }
  return elegido ? { pct: elegido.pct, horas: elegido.horas } : null
}
