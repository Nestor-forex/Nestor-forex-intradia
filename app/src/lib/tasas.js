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

// Lo que se publica en `estado/tasas.json`.
export function prepararTasas(csv, ahora = new Date()) {
  return { actualizadoEl: ahora.toISOString(), tasas: leerTasasCSV(csv) }
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
