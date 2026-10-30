// LOS AVISOS QUE PROGRAMA EL USUARIO
//
// Néstor lo pidió el 2026-10-30 con estas palabras: «quiero que la pantalla se
// convierta en una herramienta para que el usuario pueda interactuar en ella
// según su gusto o necesidades […] el tener la posibilidad de programar
// ciertos parámetros desde mi perspectiva».
//
// Esto es la parte que DECIDE si un aviso suena, y nada más: no pinta, no
// manda nada y no habla con la red. Vive aquí —en `src/lib/`— porque la usan
// las dos puntas: la pantalla, para enseñar en qué estado va cada aviso, y el
// programa que los manda al celular, que corre en Node. Dos copias de esta
// decisión se separarían sin que fallara nada, y entonces la pantalla diría
// una cosa y el celular otra. Es el mismo motivo por el que `perforaExtremo`
// se movió aquí.
//
// ⚠️⚠️ LO QUE ESTO NO ES, Y VA PRIMERO: no es una señal, no dice hacia dónde
// va el precio y no aconseja nada. Un aviso dice QUÉ PASÓ («EUR/USD tocó
// 1.1550»), nunca qué hacer. Es la misma línea que no cruzan el calendario
// —que no pinta la divisa de rojo— ni la tarjeta del COT.
//
// ⚠️ Y NO CAMBIA NI UNA SEÑAL de ninguna de las dos apps. El interruptor de
// avisos que ya existía sigue intacto: esto se suma, no reemplaza.

import { minutosDesde } from './useMT5Quotes.js'

// ─────────────────────────────────────────────────────────────────────────
// LOS LÍMITES, Y DE DÓNDE SALE CADA NÚMERO
// ─────────────────────────────────────────────────────────────────────────

// Cuántos avisos puede tener una persona a la vez.
//
// No es una restricción de gusto: cada aviso se guarda en la ficha de Firestore
// de esa persona y se relee en cada vuelta del programa que los manda, así que
// una lista sin tope convierte un descuido (o un dedo pegado al botón) en un
// documento que no se puede leer. Veinte avisos son más de uno por par.
export const MAX_AVISOS = 20

// ⚠️⚠️ CUÁNTO PUEDE TENER EL PRECIO PARA QUE UN AVISO SUENE, Y ES LA DECISIÓN
// MÁS IMPORTANTE DEL ARCHIVO.
//
// El precio viene del puente de MT5, que publica **cada 15 minutos** y solo
// mientras el computador de Néstor esté encendido. Si está apagado, el último
// precio puede ser de hace horas — y entonces un aviso diría «EUR/USD acaba de
// tocar 1.1550» sobre un precio de esta mañana. Eso no es un aviso tarde: es
// un aviso FALSO, y es lo único que destruye la confianza en un producto así.
//
// 45 minutos son tres vueltas del puente: tolera que se salte un par de ellas
// y corta en seco cuando el puente lleva un rato apagado.
//
// ⚠️ La asimetría, como siempre en este proyecto: no sonar cuesta un aviso que
// se pierde; sonar con un precio que ya no existe cuesta que no se vuelva a
// creer ninguno. Los dos errores no valen lo mismo, así que la condición no
// puede ser simétrica.
export const EDAD_MAXIMA_PRECIO_MIN = 45

// Los tipos que existen. Va ENUMERADO a propósito: un tipo que alguien añada
// mañana y que no esté aquí **no dispara**, en vez de caer en el último `else`
// y sonar por un motivo que nadie programó. Es la familia de fallo que en este
// proyecto ya mordió seis veces (`esSombra`, `ventasPausadas`, `esDeLaApp`,
// `filasOtras`, la regla de Firestore y la geometría de «comprar la caída»).
export const TIPOS = Object.freeze(['precio', 'banda', 'rsi'])

// Los dos sentidos. `sube`/`baja` para el precio, `arriba`/`abajo` para los
// indicadores — se llaman distinto a propósito, porque «el RSI subió a 70» y
// «el precio subió a 1.1550» se leen distinto en pantalla.
export const LADOS_PRECIO = Object.freeze(['sube', 'baja'])
export const LADOS_INDICADOR = Object.freeze(['arriba', 'abajo'])

// ─────────────────────────────────────────────────────────────────────────
// ¿ESTÁ BIEN ESCRITO EL AVISO?
// ─────────────────────────────────────────────────────────────────────────

/**
 * El nivel que escribió el usuario, o `null` si no escribió nada.
 *
 * ⚠️⚠️ ESTA FUNCIÓN EXISTE POR UNA TRAMPA DE JAVASCRIPT, y la cazó la prueba
 * antes de que llegara a ninguna pantalla: **`Number(null)` es 0**, no `NaN`.
 * Y `Number('')` también. Así que un campo que el usuario dejó VACÍO pasaba
 * como un nivel perfectamente válido de cero, y:
 *
 *   · en un aviso de precio salía «el precio no puede ser negativo», un
 *     mensaje que no tiene nada que ver con lo que pasó;
 *   · y en uno de RSI con el lado «arriba», `rsi >= 0` es **siempre cierto**,
 *     así que el aviso habría SONADO en la primera vuelta. Un campo en blanco
 *     haciendo sonar el celular.
 *
 * 📌 Es la hermana exacta de `new Date(null)`, que no es una fecha inválida
 * sino el 1 de enero de 1970, y que ya mordió en `minutosDesde`. Van dos, y la
 * lección es la misma: en JavaScript, «vacío» se convierte en un número
 * perfectamente creíble.
 */
export function nivelDe(valor) {
  if (valor === null || valor === undefined) return null
  // Un `true` se convierte en 1 y un array vacío en 0, así que solo se aceptan
  // las dos formas en que un nivel puede llegar de verdad.
  if (typeof valor !== 'number' && typeof valor !== 'string') return null
  // ⚠️ Y EL `trim` NO SOBRA: `Number('   ')` **también es 0**. Un campo con
  // solo espacios dentro —lo que deja una barra espaciadora pulsada sin
  // querer— pasaba como un nivel de cero. Lo cazó la prueba de las siete
  // formas en que un campo puede venir en blanco.
  if (typeof valor === 'string' && !valor.trim()) return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

/**
 * Comprueba que un aviso tiene sentido ANTES de guardarlo.
 *
 * ⚠️ Devuelve un CÓDIGO, no una frase en español. Esta función corre también
 * en Node, donde no hay idioma elegido; traduce quien pinta. Es exactamente la
 * decisión del lector de informes del bróker, y existe porque un mensaje en
 * español colado en un módulo compartido sale en español a un suscriptor que
 * eligió árabe.
 *
 * @returns {{ ok: boolean, codigo?: string }}
 */
export function valida(aviso, { paresValidos = null } = {}) {
  if (!aviso || typeof aviso !== 'object') return { ok: false, codigo: 'vacio' }
  if (typeof aviso.par !== 'string' || !aviso.par.trim()) return { ok: false, codigo: 'sinPar' }
  if (Array.isArray(paresValidos) && paresValidos.length && !paresValidos.includes(aviso.par)) {
    return { ok: false, codigo: 'parDesconocido' }
  }
  if (!TIPOS.includes(aviso.tipo)) return { ok: false, codigo: 'tipoDesconocido' }

  const lados = aviso.tipo === 'precio' ? LADOS_PRECIO : LADOS_INDICADOR
  if (!lados.includes(aviso.lado)) return { ok: false, codigo: 'ladoDesconocido' }

  const n = nivelDe(aviso.nivel)
  if (n === null) return { ok: false, codigo: 'nivelNoEsNumero' }

  // Los rangos plausibles de cada tipo. No es paranoia: un dedo que escribe
  // «11550» en vez de «1.1550» crearía un aviso que no puede sonar nunca, y el
  // usuario se quedaría esperando sin saber por qué. Mejor decirlo al guardar.
  if (aviso.tipo === 'precio' && n <= 0) return { ok: false, codigo: 'precioNoPositivo' }
  // El RSI va de 0 a 100 por construcción.
  if (aviso.tipo === 'rsi' && (n < 0 || n > 100)) return { ok: false, codigo: 'rsiFueraDeRango' }
  // El %B es 0 en la media y ±1 en los bordes de la banda. Más allá de ±3 es
  // un precio que no se ha visto nunca, así que el aviso no sonaría jamás.
  if (aviso.tipo === 'banda' && Math.abs(n) > 3) return { ok: false, codigo: 'bandaFueraDeRango' }

  return { ok: true }
}

/**
 * ¿Cabe otro aviso más?
 *
 * Se cuentan TODOS, encendidos y apagados: lo que topa es lo que se guarda en
 * la ficha, no lo que está activo.
 */
export function cabeOtro(avisos) {
  return (Array.isArray(avisos) ? avisos.length : 0) < MAX_AVISOS
}

// ─────────────────────────────────────────────────────────────────────────
// ¿SUENA O NO?
// ─────────────────────────────────────────────────────────────────────────

/**
 * En qué estado está un aviso ahora mismo.
 *
 * ⚠️⚠️ DEVUELVE UN ESTADO DE CUATRO VALORES Y NO UN `true`/`false`, y el
 * motivo es el de siempre en este repositorio: «no dispara» y «no se sabe» son
 * cosas distintas y se escriben igual. Un booleano las junta, y entonces el
 * puente apagado se lee en pantalla como «el precio no ha llegado» — que es
 * una afirmación sobre el mercado donde no hay ningún dato. Misma decisión que
 * `pearson` devolviendo `null` en vez de 0.
 *
 *   'dispara'  → el aviso tiene que sonar ahora
 *   'espera'   → hay dato y la condición todavía no se cumple
 *   'sinDato'  → no se puede saber (sin precio, o el puente lleva rato apagado)
 *   'quieto'   → apagado por el usuario, o ya sonó
 *
 * @param aviso  lo que el usuario programó
 * @param dato   { bid, ask, precioEl, posB, rsi, tecnicoEl } de ESE par
 * @param opciones.edadMaximaTecnicoMin  ⚠️ lo pone cada app: el barrido de
 *   Swing se publica dos veces al día y el de Intradía una vez por hora, así
 *   que «viejo» no significa lo mismo en las dos. Copiar ese número de la app
 *   hermana sería traerse una suposición que aquí es falsa — la lección de
 *   `barridoSwap`. Este archivo es GEMELO justo porque no lo decide.
 */
export function estadoDe(aviso, dato, { ahora = new Date(), edadMaximaTecnicoMin = null } = {}) {
  if (!aviso || aviso.activa === false) return { estado: 'quieto', codigo: 'apagado' }
  // ⚠️ SUENA UNA VEZ Y SE CALLA. Sin esto, un precio oscilando alrededor del
  // nivel haría sonar el celular cada 15 minutos, y una alarma que suena sin
  // parar enseña a ignorarla — que es justo lo que este proyecto ya escribió
  // del rojo permanente de la herramienta de puntualidad. Se vuelve a armar a
  // mano, desde la pantalla.
  if (aviso.disparadaEl) return { estado: 'quieto', codigo: 'yaSono' }

  if (!TIPOS.includes(aviso.tipo)) return { estado: 'sinDato', codigo: 'tipoDesconocido' }
  if (!dato || typeof dato !== 'object') return { estado: 'sinDato', codigo: 'sinPrecio' }

  // ⚠️ `nivelDe` y no `Number`: con un campo vacío, `Number(null)` da 0 y un
  // aviso de «RSI por arriba de 0» SONARÍA en la primera vuelta. Ver el
  // comentario de esa función.
  const nivel = nivelDe(aviso.nivel)
  if (nivel === null) return { estado: 'sinDato', codigo: 'nivelNoEsNumero' }

  if (aviso.tipo === 'precio') {
    // ⚠️ SE COMPARA CONTRA EL **BID**, Y HAY QUE DECIRLO EN PANTALLA.
    //
    // El bróker da dos precios: el bid (al que te compran) y el ask (al que te
    // venden), y el ask siempre está más arriba. El gráfico que mira cualquiera
    // dibuja el bid, así que comparar contra el bid es lo que hace que el aviso
    // coincida con lo que el usuario ve. Pero NO es lo que pagaría al entrar:
    // para comprar paga el ask, que está el spread más arriba. El mensaje lleva
    // los dos números por eso.
    const bid = Number(dato.bid)
    if (!Number.isFinite(bid)) return { estado: 'sinDato', codigo: 'sinPrecio' }

    const edad = minutosDesde(dato.precioEl, ahora)
    // `null` es «no se sabe de cuándo es», y eso NO autoriza a sonar.
    if (edad === null || edad > EDAD_MAXIMA_PRECIO_MIN) {
      return { estado: 'sinDato', codigo: 'puenteApagado', edad }
    }

    const toca = aviso.lado === 'sube' ? bid >= nivel : bid <= nivel
    return toca
      ? { estado: 'dispara', codigo: 'precioToco', valor: bid, edad }
      : { estado: 'espera', valor: bid, edad }
  }

  // Los dos de indicador salen del BARRIDO, no del puente, así que su frescura
  // es otra y se mide aparte. Un aviso de RSI no puede ser más fresco que el
  // barrido del que sale, y mezclarlos haría que un aviso técnico pareciera
  // tan reciente como uno de precio.
  const valor = aviso.tipo === 'banda' ? Number(dato.posB) : Number(dato.rsi)
  if (!Number.isFinite(valor)) return { estado: 'sinDato', codigo: 'sinBarrido' }

  if (edadMaximaTecnicoMin != null) {
    const edad = minutosDesde(dato.tecnicoEl, ahora)
    if (edad === null || edad > edadMaximaTecnicoMin) {
      return { estado: 'sinDato', codigo: 'barridoViejo', edad }
    }
  }

  const toca = aviso.lado === 'arriba' ? valor >= nivel : valor <= nivel
  return toca
    ? { estado: 'dispara', codigo: aviso.tipo === 'banda' ? 'bandaToco' : 'rsiToco', valor }
    : { estado: 'espera', valor }
}

/**
 * De una lista de avisos, los que tienen que sonar AHORA.
 *
 * Devuelve `{ aviso, estado }` para que quien manda el mensaje tenga el valor
 * y la edad delante y pueda escribirlos en el texto.
 */
export function pendientes(avisos, datosPorPar, opciones = {}) {
  if (!Array.isArray(avisos)) return []
  const salida = []
  for (const aviso of avisos) {
    const st = estadoDe(aviso, datosPorPar?.[aviso?.par], opciones)
    if (st.estado === 'dispara') salida.push({ aviso, estado: st })
  }
  return salida
}

/**
 * El texto del aviso, como CLAVE y HUECOS — nunca como una frase.
 *
 * ⚠️ Quien manda el aviso corre en Node y no sabe el idioma del suscriptor.
 * Traduce quien pinta, con el idioma que esa persona guardó. Mismo patrón que
 * los avisos del lector de informes del bróker.
 *
 * ⚠️ Y el mensaje lleva **la hora a la que se tomó el precio**, nunca «ahora
 * mismo». El precio puede ser de hace veinte minutos y decir «ahora» sería
 * mentir sobre lo único que importa en un aviso.
 */
export function mensajeDe(aviso, estado, dato) {
  const base = { par: aviso.par, nivel: nivelDe(aviso.nivel) }
  if (aviso.tipo === 'precio') {
    return {
      clave: aviso.lado === 'sube' ? 'avisos.msgSubio' : 'avisos.msgBajo',
      params: { ...base, bid: Number(dato?.bid), ask: Number(dato?.ask), minutos: estado?.edad ?? null },
    }
  }
  if (aviso.tipo === 'banda') {
    return { clave: aviso.lado === 'arriba' ? 'avisos.msgBandaArriba' : 'avisos.msgBandaAbajo', params: { ...base, valor: estado?.valor } }
  }
  return { clave: aviso.lado === 'arriba' ? 'avisos.msgRsiArriba' : 'avisos.msgRsiAbajo', params: { ...base, valor: estado?.valor } }
}

// ─────────────────────────────────────────────────────────────────────────
// LA LISTA DE SEGUIMIENTO
// ─────────────────────────────────────────────────────────────────────────

/**
 * Deja solo los pares que la persona eligió seguir.
 *
 * ⚠️ UNA LISTA VACÍA DEVUELVE TODO, no nada. Es el valor por defecto de quien
 * nunca ha entrado a la pantalla, y si devolviera una lista vacía la app
 * aparecería en blanco el primer día — indistinguible de estar rota. Ante la
 * duda, enseñar de más: lo contrario esconde la app entera.
 */
export function soloSeguidos(items, seguimiento, dameElPar = (x) => x?.par) {
  if (!Array.isArray(items)) return []
  if (!Array.isArray(seguimiento) || !seguimiento.length) return items
  return items.filter((x) => seguimiento.includes(dameElPar(x)))
}
