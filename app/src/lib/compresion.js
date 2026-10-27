// COMPRESIÓN, POSICIÓN EN EL RANGO Y FIBONACCI. La matemática pura.
//
// Corre en Node (el banco de pruebas, el publicador) y en el navegador (la
// tarjeta), así que aquí no hay React, ni `t()`, ni un solo umbral.
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE, y lo que se encontró al ir a escribirlo
// ─────────────────────────────────────────────────────────────────────────
//
// Néstor pidió «patrones de gráfico (triángulos, canales, cuñas, Fibonacci)».
// De esa lista entra lo que se puede MEDIR con máximo, mínimo y cierre sin
// ponerle nombre a un dibujo:
//
//   ✅ la COMPRESIÓN     — cuánto se ha estrechado el movimiento
//   ✅ la POSICIÓN       — dónde está el precio dentro de su propio rango
//   ⚠️ FIBONACCI         — solo como NIVELES del último movimiento
//   ❌ triángulos, cuñas y canales con nombre
//
// El último no entra por un motivo medido, no por gusto: el NFX-LSS ES
// reconocimiento de patrones (pivotes, ruptura de estructura, barrido de
// liquidez) y midió −0,08 en velas diarias, −0,14 en H1 y −0,16 en M15. Y de
// aquella medición salió algo peor para los patrones con nombre: el barrido de
// liquidez marcó las señales PEORES, no las mejores (197 ops a −0,08 con él
// contra 595 a +0,05 sin él). Un nombre como «triángulo ascendente» además
// lleva la dirección DENTRO, que es el error del código de divisa en rojo del
// calendario: afirma hacia dónde va a ir el precio sin que ningún dato lo diga.
//
// ⚠️⚠️ Y AL BUSCARLO EN EL REPOSITORIO APARECIÓ QUE EN INTRADÍA YA EXISTÍA.
// `marketCalc.js` de esa app calcula `compresion` desde hace meses, la publica
// en `barrido.json`… y **ningún componente la pinta**. Es el descuido del tick
// volume otra vez: un dato real llegando a la nada. Peor: allí la compresión
// **YA DECIDE SEÑALES** (`COMPRESION_MIN`, las de rango), así que no es
// información — es un filtro encendido del que no había número escrito.
//
// Por eso la fórmula de aquí es LA MISMA que la que ya corría allí
// (`atrAhora / atrAntes`) y no una nueva. Dos definiciones distintas con el
// mismo nombre serían la etiqueta equivocada de siempre, y esta vez con el
// agravante de que una de las dos ya está moviendo señales de verdad.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ LO QUE NO HAY QUE ABLANDAR
// ─────────────────────────────────────────────────────────────────────────
//
// 1. **NINGÚN UMBRAL VIVE AQUÍ.** Se pasan. Es lo que permite que este archivo
//    sea GEMELO: una compresión de 0,70 no significa lo mismo en velas de un
//    día que en velas de una hora, igual que un ATR del 1,2 % es tormenta en
//    diarias y un terremoto en horarias.
//
// 2. **NI UNA PALABRA «DÍA» NI «HORA».** Se habla de VELAS. Cada frase con
//    «diaria» dentro de un archivo gemelo es una divergencia esperando.
//
// 3. **`null` Y NUNCA 0 NI 1** cuando no se puede calcular. Un 1 diría «el
//    mercado está igual que antes» y un 0 «está parado del todo»: las dos son
//    afirmaciones sobre el mercado. Misma asimetría que `pearson` en
//    `correlacion.js` y que `edadEnMinutos` en `frescura.js`.
//
// 4. **NINGÚN VEREDICTO.** No se devuelve lado, ni dirección, ni «mejor par»,
//    ni puntuación. Fibonacci da niveles y nada más. Si algún día esto decide
//    una señal, es un FILTRO y va al banco de pruebas con su listón escrito
//    antes — van nueve familias medidas y nueve que no pasan.

// La mediana, no la media: basta una vela de noticias para que la media no
// describa a ninguna. Devuelve `null` con la lista vacía o con basura dentro.
export function mediana(xs) {
  if (!Array.isArray(xs)) return null
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

/**
 * La compresión: el movimiento de AHORA contra el de ANTES.
 *
 * Por debajo de 1 el mercado se ha estrechado; por encima, se ha ensanchado.
 * Es exactamente la fórmula que Intradía ya usaba (`atrAbs / atrMedio`).
 *
 * ⚠️ Devuelve `null`, no 1, cuando el divisor no sirve. Un 1 afirmaría que el
 * movimiento no ha cambiado, y no saberlo no es eso.
 */
export function compresionDe(atrAhora, atrAntes) {
  if (!Number.isFinite(atrAhora) || !Number.isFinite(atrAntes)) return null
  if (!(atrAntes > 0) || !(atrAhora >= 0)) return null
  return atrAhora / atrAntes
}

/**
 * La etiqueta cualitativa. Los umbrales se PASAN (ver la regla 1).
 *
 * Devuelve una CLAVE (`muy`, `algo`, `normal`, `ancho`), nunca un texto: el
 * mismo cálculo lo lee `reporte-diario.mjs` desde Node, donde no hay idioma.
 * Es la misma decisión que `claveSesionActiva()`.
 */
export function nivelDe(compresion, { muy, algo, ancho }) {
  if (!Number.isFinite(compresion)) return null
  if (![muy, algo, ancho].every(Number.isFinite)) return null
  if (compresion < muy) return 'muy'
  if (compresion < algo) return 'algo'
  if (compresion > ancho) return 'ancho'
  return 'normal'
}

/**
 * Dónde está el precio dentro del rango de la ventana: 0 en el suelo, 1 en el
 * techo. Es el mismo concepto que `posicionDe` de `bollinger.js`, pero contra
 * los extremos REALES de las velas en vez de contra una banda estadística.
 *
 * ⚠️ `null` —y nunca 0,5— si el rango no tiene amplitud. Un 0,5 diría «está
 * justo en el medio», que es una afirmación.
 */
export function posicionEnRango(precio, lo, hi) {
  if (![precio, lo, hi].every(Number.isFinite)) return null
  if (!(hi > lo)) return null
  return (precio - lo) / (hi - lo)
}

/**
 * Cuántas velas seguidas, contando desde la ÚLTIMA hacia atrás, tienen un
 * rango por debajo de `fraccion` veces el rango mediano de la ventana.
 *
 * Sirve para lo que la compresión sola no dice: un cociente bajo puede venir de
 * una sola vela quieta, y tres seguidas estrechas son otra cosa.
 *
 * ⚠️ `null` si no se puede medir. Un 0 diría «ninguna vela está estrecha», que
 * es distinto de «no lo sé».
 */
export function velasEstrechas(altos, bajos, fraccion) {
  if (!Array.isArray(altos) || !Array.isArray(bajos)) return null
  if (altos.length !== bajos.length || altos.length < 2) return null
  if (!Number.isFinite(fraccion) || !(fraccion > 0)) return null

  const rangos = altos.map((h, i) => h - bajos[i])
  if (!rangos.every((r) => Number.isFinite(r) && r >= 0)) return null

  const med = mediana(rangos)
  if (!Number.isFinite(med) || !(med > 0)) return null

  let n = 0
  for (let i = rangos.length - 1; i >= 0; i--) {
    if (rangos[i] < med * fraccion) n++
    else break
  }
  return n
}

// Los retrocesos de Fibonacci. Son estos cinco y no otros: es la convención
// que usa todo el mundo, así que cambiarlos rompería el enlace con cualquier
// otra plataforma que Néstor mire. 0,5 no es un número de Fibonacci y va igual
// porque también es convención.
export const RATIOS_FIB = [0.236, 0.382, 0.5, 0.618, 0.786]

/**
 * Los niveles de Fibonacci del ÚLTIMO movimiento de la ventana.
 *
 * El movimiento se define sin opinar: se busca el máximo y el mínimo de la
 * ventana y el que esté MÁS CERCA DEL FINAL es donde termina. Si termina en el
 * máximo, el movimiento fue al alza y los retrocesos bajan desde ahí; si
 * termina en el mínimo, fue a la baja y suben.
 *
 * ⚠️ `null` si el movimiento es más pequeño que `minATR` veces el ATR: con 20
 * velas, dos extremos casi pegados dan niveles separados por décimas de pip,
 * que no son niveles — son ruido con cinco etiquetas encima.
 *
 * ⚠️ NO devuelve dirección, ni objetivo, ni «zona de compra». Son niveles. Lo
 * que el precio haga al llegar es justo lo que nadie ha medido aquí.
 */
export function fibonacci({ altos, bajos, atrAbs, minATR }) {
  if (!Array.isArray(altos) || !Array.isArray(bajos)) return null
  if (altos.length !== bajos.length || altos.length < 2) return null
  if (![atrAbs, minATR].every(Number.isFinite) || !(atrAbs > 0) || !(minATR > 0)) return null
  if (!altos.every(Number.isFinite) || !bajos.every(Number.isFinite)) return null

  let iHi = 0
  let iLo = 0
  for (let i = 1; i < altos.length; i++) {
    if (altos[i] > altos[iHi]) iHi = i
    if (bajos[i] < bajos[iLo]) iLo = i
  }
  const hi = altos[iHi]
  const lo = bajos[iLo]
  const amplitud = hi - lo
  if (!(amplitud >= atrAbs * minATR)) return null

  // Empate (el mismo índice trae el máximo y el mínimo de toda la ventana): no
  // hay un «último» movimiento que distinguir, así que no se inventa uno.
  if (iHi === iLo) return null

  const subiendo = iHi > iLo
  const niveles = RATIOS_FIB.map((r) => ({
    ratio: r,
    precio: subiendo ? hi - amplitud * r : lo + amplitud * r,
  }))
  return { desde: subiendo ? lo : hi, hasta: subiendo ? hi : lo, subiendo, amplitud, niveles }
}
