// LAS TASAS DE REFERENCIA DE LOS BANCOS CENTRALES, y la diferencia entre ellas.
//
// La #3 de la fase de información. Las cuentas puras, sin React y sin red, para
// que sirvan igual desde Node (`scripts/publicar-tasas.mjs`) y desde el
// navegador.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ LO MÁS IMPORTANTE DE ESTE ARCHIVO NO ES TÉCNICO
// ─────────────────────────────────────────────────────────────────────────
// **LA DIFERENCIA DE TASAS NO ES EL SWAP.** Es de dónde SALE el swap, que no
// es lo mismo:
//
//   · el banco central pone la tasa de referencia;
//   · el bróker le añade su margen, y ese margen NO LO PUBLICA NADIE;
//   · y el margen es ASIMÉTRICO: en una dirección pagas y en la otra a veces
//     cobras, pero casi nunca cobras tanto como pagarías al revés.
//
// O sea que esto da **el signo y el orden de magnitud**, no el número. Está
// escrito igual dentro de `scripts/sonda-tasas.mjs`, con fecha ANTERIOR a
// haber visto ningún dato — a propósito, para que se note que no es una
// disculpa escrita después de ver una tabla decepcionante.
//
// Por eso la pantalla NUNCA dice «vas a cobrar X». Dice hacia qué lado suele
// jugar, y lo dice con «suele».
//
// ─────────────────────────────────────────────────────────────────────────
// LA FUENTE: BIS, dataflow WS_CBPOL, en CSV
// ─────────────────────────────────────────────────────────────────────────
// Elegida CON LA SONDA del 2026-09-09, no leyendo documentación. De las seis
// direcciones probadas:
//
//   · BIS v2 CSV con las ocho divisas de un golpe → 200, 8 filas, 153 ms ✅
//   · BIS v2 JSON → 406: ese endpoint NO da `jsondata`
//   · BCE → 200, pero solo sirve para el euro
//   · FRED sin llave → 400, «Variable api_key is not set»
//
// Sin llave, gratis y CERO créditos de Twelve Data.

// Las ocho divisas del barrido y su código de zona en el BIS.
//
// ⚠️ `XM` es el ÁREA DEL EURO, no un país: la tasa la pone el BCE para los
// veinte. El BIS no tiene una fila «EUR».
export const ZONA_DIVISA = {
  US: 'USD',
  XM: 'EUR',
  GB: 'GBP',
  JP: 'JPY',
  CH: 'CHF',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
}

export const DIVISA_ZONA = Object.fromEntries(
  Object.entries(ZONA_DIVISA).map(([zona, div]) => [div, zona]),
)

// Por debajo de esta diferencia (en puntos porcentuales) NO se dice nada hacia
// ningún lado.
//
// ⚠️ El número no es estético. El margen que el bróker le suma a la tasa está
// típicamente entre 0,5 y 1,5 puntos anuales, así que una diferencia de dos
// décimas se la come el margen entera y el signo deja de significar nada.
// Decir «juega a favor» con 0,1 de diferencia sería inventarse una precisión
// que el dato no tiene.
export const UMBRAL_NEUTRO = 0.25

// ─────────────────────────────────────────────────────────────────────────
// El CSV del BIS
// ─────────────────────────────────────────────────────────────────────────
//
// ⚠️ NO SE PUEDE PARTIR POR COMAS A PELO, y es el error fácil: dos de las
// quince columnas (`COMPILATION` y `TITLE`) llevan comas DENTRO, entre
// comillas. Una de las filas reales dice:
//
//   "From 1 Jun 1994 onwards: Central bank target, overnight rate; from …"
//
// Partir por comas ahí corre todas las columnas de sitio y `OBS_VALUE` acaba
// siendo un trozo de texto. Peor: no falla, devuelve basura.
export function partirLineaCSV(linea) {
  const campos = []
  let actual = ''
  let dentroDeComillas = false

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]

    if (c === '"') {
      // Dos comillas seguidas dentro de un campo entrecomillado son una
      // comilla literal, no el final del campo.
      if (dentroDeComillas && linea[i + 1] === '"') {
        actual += '"'
        i++
      } else {
        dentroDeComillas = !dentroDeComillas
      }
      continue
    }

    if (c === ',' && !dentroDeComillas) {
      campos.push(actual)
      actual = ''
      continue
    }

    actual += c
  }
  campos.push(actual)
  return campos
}

// Lee el CSV del BIS y devuelve `{ USD: { v, f }, … }` con `v` = tasa y
// `f` = fecha del dato (no la de hoy: ver abajo).
//
// ⚠️ LAS COLUMNAS SE BUSCAN POR NOMBRE, no por posición. El BIS ya cambió de
// v1 a v2 una vez; si mañana añade una columna en medio, buscar por posición
// daría números equivocados sin fallar. Es la misma decisión que se tomó al
// leer los informes del bróker.
//
// ⚠️ Y UNA FILA QUE NO SE ENTIENDE SE SALTA, no rompe el archivo entero. Si el
// BIS deja de publicar una divisa, se pierde esa y las otras siete siguen.
export function leerTasasCSV(texto) {
  if (typeof texto !== 'string' || !texto.trim()) return {}

  const lineas = texto.trim().split(/\r?\n/)
  if (lineas.length < 2) return {}

  const cabecera = partirLineaCSV(lineas[0]).map((s) => s.trim().toUpperCase())
  const iZona = cabecera.indexOf('REF_AREA')
  const iFecha = cabecera.indexOf('TIME_PERIOD')
  const iValor = cabecera.indexOf('OBS_VALUE')
  if (iZona < 0 || iFecha < 0 || iValor < 0) return {}

  const tasas = {}
  for (const linea of lineas.slice(1)) {
    if (!linea.trim()) continue
    const campos = partirLineaCSV(linea)

    const divisa = ZONA_DIVISA[(campos[iZona] || '').trim()]
    if (!divisa) continue

    const fecha = (campos[iFecha] || '').trim()
    const valor = Number((campos[iValor] || '').trim())
    // `Number('')` es 0, y una tasa de 0 es perfectamente real (Suiza estaba
    // justo en 0 el día de la sonda). Por eso se comprueba que el texto NO
    // esté vacío ANTES de mirar el número: si no, una fila sin dato entraría
    // como «tasa cero», que es una afirmación y no un hueco.
    if (!(campos[iValor] || '').trim() || !Number.isFinite(valor)) continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue

    // Si vinieran varias observaciones de la misma zona, se queda la MÁS
    // RECIENTE. Con `lastNObservations=1` no debería pasar, pero el día que
    // alguien cambie ese parámetro no queremos que gane la primera por azar.
    if (!tasas[divisa] || fecha > tasas[divisa].f) tasas[divisa] = { v: valor, f: fecha }
  }
  return tasas
}

// ─────────────────────────────────────────────────────────────────────────
// LA TENDENCIA: no solo el nivel, también de dónde viene
// ─────────────────────────────────────────────────────────────────────────
//
// Añadido el 2026-09-29. Néstor lo pidió al ver la tabla de «dónde las apps son
// ciegas»: la pantalla decía «USD 3,875 %» y no decía que venía de 3,625 %. Y
// la mitad de lo que dicen los análisis del mercado es justo eso — «la Fed
// subiendo», «el Banco de Canadá en pausa»—, que es una DIRECCIÓN, no un nivel.
//
// ⚠️ SALE GRATIS Y SIN FUENTE NUEVA. La misma dirección del BIS acepta
// `lastNObservations=N`: el publicador pasó de pedir 1 observación a pedir
// `OBSERVACIONES`, y con eso la serie entera viene en la misma consulta. Cero
// créditos de Twelve Data, ningún secreto, 0,7 segundos.

// Cuántas observaciones se piden. Elegido CON LA SONDA (`sonda-huecos.mjs`,
// 2026-09-29), no a ojo:
//
//   · 1000 observaciones = 5,5 MB de CSV y 0,7 s. Cubren entre 2,7 y 4 años
//     según la zona, porque la DENSIDAD no es la misma: `US` trae ~30
//     observaciones al mes (días corridos) y `AU` ~21 (días de mercado), así
//     que la misma N llega más atrás en unas que en otras;
//   · y con esa ventana las OCHO tienen al menos 6 cambios reales dentro
//     (Japón 6, Estados Unidos 8, Suiza 10, la zona euro 11, Canadá y Nueva
//     Zelanda 12, Reino Unido 13, Australia 14). O sea que nunca hay que decir
//     «no sé de dónde viene» por falta de ventana.
//
// Con 400 también alcanzaba, pero por poco: Suiza no se había movido desde
// junio de 2025 y quedaba a mitad de ventana. 1000 da margen de sobra y el
// coste es medio segundo más de descarga una vez al día.
export const OBSERVACIONES = 1000

// ⚠️⚠️ EL BIS PUBLICA FILAS CON `OBS_VALUE` VACÍO, Y ESTO ES LO QUE MÁS
// IMPORTA DE ESTE BLOQUE.
//
// Son días sin dato, y no son pocos: de 1000 observaciones, Nueva Zelanda trae
// 283 huecos y Canadá 122 (medido el 2026-09-29). Si no se quitan ANTES de
// buscar los escalones, cada hueco se lee como DOS cambios de tasa:
//
//     2026-09-07: 2.75  →  2026-09-12: (vacío)  →  2026-09-14: 2.75
//
// Contando así, Nueva Zelanda salía con **294 cambios** en vez de 12. Y el daño
// no sería un número raro en un log: la pantalla habría dicho «vigente desde el
// 14 de septiembre» por un hueco en la serie, cuando esa tasa lleva ahí desde
// el 3 de septiembre. Un dato correcto sobre algo distinto de lo que uno cree
// estar midiendo — la misma familia que el ATR de cierre a cierre.
//
// `leerTasasCSV` ya los salta (comprueba que el texto no esté vacío antes de
// mirar el número), así que aquí se hace igual y por el mismo motivo.
export function leerSerieCSV(texto) {
  if (typeof texto !== 'string' || !texto.trim()) return {}

  const lineas = texto.trim().split(/\r?\n/)
  if (lineas.length < 2) return {}

  const cabecera = partirLineaCSV(lineas[0]).map((s) => s.trim().toUpperCase())
  const iZona = cabecera.indexOf('REF_AREA')
  const iFecha = cabecera.indexOf('TIME_PERIOD')
  const iValor = cabecera.indexOf('OBS_VALUE')
  if (iZona < 0 || iFecha < 0 || iValor < 0) return {}

  const series = {}
  for (const linea of lineas.slice(1)) {
    if (!linea.trim()) continue
    const campos = partirLineaCSV(linea)

    const divisa = ZONA_DIVISA[(campos[iZona] || '').trim()]
    if (!divisa) continue

    const fecha = (campos[iFecha] || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue

    // Ver el bloque de arriba: el hueco se salta, no entra como 0 ni como
    // cambio.
    const cruda = (campos[iValor] || '').trim()
    if (!cruda) continue
    const valor = Number(cruda)
    if (!Number.isFinite(valor)) continue

    ;(series[divisa] ||= []).push({ f: fecha, v: valor })
  }

  // De más vieja a más nueva, y una fecha repetida se queda con la última
  // leída. El orden no se hereda de la respuesta: es la misma decisión que en
  // `leerTasasCSV` y `leerFilas`.
  for (const divisa of Object.keys(series)) {
    series[divisa].sort((a, b) => (a.f < b.f ? -1 : a.f > b.f ? 1 : 0))
    series[divisa] = series[divisa].filter((r, i, arr) => i === arr.length - 1 || arr[i + 1].f !== r.f)
  }
  return series
}

// El último ESCALÓN real de una serie: de qué valor venía, a cuál está, y desde
// cuándo.
//
// ⚠️ `sentido` es `'subio'` o `'bajo'` y nada más. NO hay `'pausa'`, `'plana'`
// ni nada que se parezca a un veredicto sobre lo que el banco central va a
// hacer: eso sería una opinión disfrazada de dato, y aquí solo se lee una serie.
//
// ⚠️ Y SI NO HAY DOS VALORES DISTINTOS EN LA VENTANA, DEVUELVE `null`. No
// devuelve «sin cambios», porque eso se leería como «esta tasa está quieta» —
// una afirmación sobre el banco central— cuando lo único que sabemos es que no
// se movió dentro de lo que la app miró. «No lo sé» y «no cambió» no son lo
// mismo, la misma decisión que `pearson` en `correlacion.js`.
export function ultimoCambio(serie) {
  if (!Array.isArray(serie) || serie.length < 2) return null

  // Los escalones: cada punto en que el valor cambia respecto al anterior.
  let anterior = null
  let cambio = null
  let escalones = 0
  for (const o of serie) {
    if (anterior !== null && o.v !== anterior.v) {
      escalones++
      cambio = { de: anterior.v, a: o.v, f: o.f }
    }
    anterior = o
  }
  if (!cambio) return null

  return {
    ...cambio,
    sentido: cambio.a > cambio.de ? 'subio' : 'bajo',
    // Cuántas veces se movió dentro de la ventana. No va a la pantalla: sirve
    // para que el log del publicador delate el día que los huecos se vuelvan a
    // colar (12 cambios es plausible en tres años; 294 no).
    escalones,
    // Desde cuándo está el valor actual, en días. ⚠️ Se dice «vigente desde» y
    // NUNCA «lo decidieron ese día»: con huecos en la serie, el cambio puede
    // haber ocurrido durante un hueco y aparecer fechado en el primer día
    // publicado después. La serie dice desde cuándo LA VE así, y eso es lo que
    // se puede afirmar.
    desde: cambio.f,
  }
}

// Las ocho tendencias, para publicarlas. Una divisa sin cambio en la ventana
// simplemente NO aparece — igual que una tasa que falta no entra como 0.
export function tendenciasDeSerie(series) {
  const out = {}
  for (const [divisa, serie] of Object.entries(series || {})) {
    const c = ultimoCambio(serie)
    if (c) out[divisa] = c
  }
  return out
}

// ¿Cuántos días lleva vigente el valor actual? `null` si no se sabe.
export function diasVigente(cambio, ahora = new Date()) {
  const f = cambio?.desde
  if (typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return null
  const ms = ahora.getTime() - new Date(f + 'T00:00:00Z').getTime()
  if (!Number.isFinite(ms)) return null
  return Math.max(0, Math.floor(ms / 86_400_000))
}

// Lo que se publica en `estado/tasas.json`.
//
// ⚠️ CAMBIO ADITIVO: `tasas` sigue siendo exactamente lo que era, así que un
// lector viejo no nota nada. `tendencias` se añade al lado, y la pantalla tiene
// que aguantar que NO esté — un archivo publicado antes del 2026-09-29 no lo
// trae, y una tarjeta que reventara por eso dejaría sin tasas a quien abriera
// la app antes de la primera corrida nueva.
export function prepararTasas(csv, ahora = new Date()) {
  return {
    actualizadoEl: ahora.toISOString(),
    tasas: leerTasasCSV(csv),
    tendencias: tendenciasDeSerie(leerSerieCSV(csv)),
  }
}

// ─────────────────────────────────────────────────────────────────────────
// La diferencia por par
// ─────────────────────────────────────────────────────────────────────────
//
// Para EUR/USD: tasa del EUR menos tasa del USD. Si sale positivo, la divisa
// de la izquierda paga más, y **la que compras es la de la izquierda**, así
// que el swap suele jugar a favor de comprar.
//
// ⚠️ «SUELE». Ver la cabecera del archivo: el margen del bróker puede darle la
// vuelta al signo en los casos ajustados, y por eso existe `UMBRAL_NEUTRO`.
//
// Devuelve `null` en `dif` cuando falta alguna de las dos tasas — nunca 0.
// Un 0 diría «las dos pagan lo mismo», que es una afirmación; «no lo sé» y
// «no hay diferencia» no son lo mismo. Es la misma decisión que en
// `correlacion.js` con `pearson`.
export function difDePar(par, tasas, monedasDe) {
  const [base, cotiz] = monedasDe(par)
  const a = tasas?.[base]
  const b = tasas?.[cotiz]
  if (!a || !b) return { par, base, cotiz, dif: null, lado: 'nose' }

  const dif = a.v - b.v
  const lado = dif > UMBRAL_NEUTRO ? 'compra' : dif < -UMBRAL_NEUTRO ? 'venta' : 'neutro'
  return { par, base, cotiz, tasaBase: a.v, tasaCotiz: b.v, dif, lado }
}

// La lista para la pantalla, ordenada por diferencia ABSOLUTA de mayor a menor:
// arriba los pares donde el swap más pesa, sea en la dirección que sea.
//
// ⚠️ Por valor absoluto y no por valor, igual que en la correlación. Un −3,0 y
// un +3,0 pesan lo mismo en la cuenta de quien opera; solo cambia hacia qué
// lado. Ordenar por valor dejaría los más caros de mantener al final de todo.
export function difsPorPar(tasas, pares, monedasDe) {
  if (!tasas || !Array.isArray(pares)) return []
  return pares
    .map((p) => difDePar(p, tasas, monedasDe))
    .filter((d) => d.dif != null)
    .sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif))
}

// Las ocho tasas sueltas, de mayor a menor, para enseñarlas tal cual.
export function tasasOrdenadas(tasas) {
  if (!tasas) return []
  return Object.entries(tasas)
    .map(([divisa, t]) => ({ divisa, ...t }))
    .sort((a, b) => b.v - a.v)
}

// ¿De cuándo es el dato más viejo de la tabla, en días?
//
// ⚠️ ESTO HACE FALTA Y NO ES PARANOIA. Una tasa de referencia solo cambia el
// día que se reúne el banco central, así que el archivo publicado hoy trae
// fechas de hace días o semanas — eso es NORMAL. Lo que no sería normal es que
// llevara meses parado porque el publicador se rompió y nadie se enteró.
//
// Devuelve `null` si no hay ninguna fecha legible: «no lo sé» otra vez, no 0.
export function diasDelDatoMasViejo(tasas, ahora = new Date()) {
  const fechas = Object.values(tasas || {})
    .map((t) => t?.f)
    .filter((f) => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f))
  if (!fechas.length) return null

  const masVieja = fechas.sort()[0]
  const ms = ahora.getTime() - new Date(masVieja + 'T00:00:00Z').getTime()
  if (!Number.isFinite(ms)) return null
  return Math.max(0, Math.floor(ms / 86_400_000))
}
