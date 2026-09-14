// Leer el historial de operaciones que exporta el bróker y convertirlo en
// entradas del Diario.
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ ASÍ Y NO CONECTÁNDOSE AL BRÓKER
// ─────────────────────────────────────────────────────────────────────────
// Los diarios de operaciones que compiten con esta app presumen de conectarse
// a cientos de brókers. Mirando cómo lo hacen de verdad, la mayoría de esa
// gente usa la vía barata: exportar el archivo y subirlo. Tradervue la llama
// "importación estándar" y es la que usa casi todo el mundo; la conexión en
// vivo por API existe pero depende de que cada bróker la ofrezca.
//
// Para esta app la vía del archivo no es solo la barata, es la ÚNICA sensata:
//
//  · No hay servidor. Todo corre en el navegador de cada persona, así que una
//    credencial de bróker viviría dentro de la app y cualquiera podría sacarla
//    del JavaScript descargado. Es exactamente el agujero que ya se cerró dos
//    veces (Capital.com y Twelve Data) y no se va a abrir un tercero, y menos
//    uno que da acceso al dinero de alguien.
//  · Funciona con CUALQUIER bróker de Forex del mundo, porque todos exportan
//    MT4 o MT5. Una API por bróker cubriría unos pocos.
//  · No cuesta nada al mes. Un puente comercial para MetaTrader cobra por cada
//    cuenta conectada, todos los meses, tenga o no operaciones.
//
// Lo que se pierde es que hay que subir el archivo a mano de vez en cuando.
// A cambio, nadie tiene que entregarle a esta app la llave de su cuenta.
//
// ─────────────────────────────────────────────────────────────────────────
// QUÉ FORMATOS ENTIENDE
// ─────────────────────────────────────────────────────────────────────────
//  · MT4  → «Guardar como informe detallado» produce un .htm con una tabla.
//  · MT5  → «Informe» produce .html o .xlsx; el .html se lee aquí.
//  · CSV / TSV de casi cualquier bróker, si trae encabezados.
//
// ⚠️ LAS COLUMNAS SE BUSCAN POR NOMBRE, EN VARIOS IDIOMAS. MetaTrader traduce
// sus informes al idioma de la plataforma, así que el informe de Néstor dice
// «Símbolo» y «Beneficio» donde el manual en inglés dice «Symbol» y «Profit».
// Buscar por posición fija habría funcionado en la máquina de quien lo
// programó y fallado en la suya.

// Sinónimos de cada columna. Todo se compara en minúsculas y sin acentos.
const COLUMNAS = {
  simbolo: ['symbol', 'item', 'simbolo', 'instrumento', 'instrument', 'par', 'pair'],
  tipo: ['type', 'tipo', 'direction', 'direccion', 'side', 'accion', 'action'],
  volumen: ['volume', 'size', 'volumen', 'tamano', 'lots', 'lotes', 'lot', 'cantidad', 'quantity'],
  beneficio: ['profit', 'beneficio', 'ganancia', 'resultado', 'p/l', 'pl', 'pnl', 'net p/l'],
  swap: ['swap', 'rollover', 'financiacion'],
  comision: ['commission', 'comision', 'commissions', 'fee', 'fees'],
  ticket: ['ticket', 'position', 'posicion', 'deal', 'order', 'orden', 'id', 'trade id'],
  apertura: ['open time', 'hora de apertura', 'fecha de apertura', 'open date', 'opened'],
  cierre: ['close time', 'hora de cierre', 'fecha de cierre', 'close date', 'closed'],
  // MT5 pone dos columnas «Time» y dos «Price» (apertura y cierre) con el
  // MISMO nombre. Se resuelve más abajo quedándose con la PRIMERA aparición
  // para apertura y la SEGUNDA para cierre.
  //
  // ⚠️ «Fecha/Hora» va aquí, y hacía falta: es como se llama esa columna en el
  // informe de MT5 en español, y NO coincidía con ninguno de los sinónimos de
  // arriba («fecha/hora» no es «fecha» ni empieza por «fecha »). Sin ella el
  // lector no encontraba ninguna columna de fecha y `fechaDe('')` caía al
  // valor por defecto: **todas las operaciones importadas con la fecha de
  // HOY**. No fallaba nada; simplemente el historial entero quedaba plano en
  // un solo día y el Diario no servía para ver la evolución.
  hora: ['time', 'hora', 'fecha', 'date', 'fecha/hora', 'hora/fecha', 'date/time', 'time/date'],
}

const sinAcentos = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

// Filas que NO son operaciones: movimientos de dinero y resúmenes. Si se
// colaran, el Diario mostraría un «depósito» como si fuera una operación
// ganadora de EUR/USD.
const NO_ES_OPERACION = [
  'balance',
  'credit',
  'deposit',
  'withdrawal',
  'deposito',
  'retiro',
  'saldo',
  'credito',
  'correction',
  'correccion',
]

// ------------------------------------------------------------------ formatos

// Saca las filas de un informe HTML de MetaTrader. No usa DOMParser a
// propósito: así esta función se puede probar en Node sin navegador, que es lo
// que permite tener comprobaciones de verdad sobre los formatos raros.
// ⚠️⚠️ LAS CELDAS CON `class="hidden"` SE TIRAN, Y ESTO NO ES UN DETALLE.
//
// El informe de MT5 mete DENTRO de cada fila de posiciones una celda que el
// navegador no enseña, con el identificador interno de la operación:
//
//     <td>buy</td>
//     <td class="hidden" colspan="8">FIX:0:ATG-ImEIk-052516096</td>
//     <td>0.03</td>          ← el volumen de verdad
//
// La cabecera NO tiene esa columna. Contarla corre **todo lo que viene
// después un puesto**, y el desastre es silencioso: el lote sale de un texto
// (0), el resultado en dólares sale de la columna del PRECIO DE CIERRE, y la
// fecha de cierre sale de un precio, que no se entiende y cae a la de hoy.
//
// Pasó de verdad, con el informe real de Néstor: 129 operaciones con fecha de
// hoy y un «resultado total» de +1754,43 que era la SUMA DE LOS PRECIOS DE
// CIERRE. Cada número era plausible y ninguno era verdad — exactamente el
// fallo que este archivo dice en su cabecera que hay que evitar.
const ES_OCULTA = /class\s*=\s*["'][^"']*\bhidden\b/i

function filasDeHtml(texto) {
  const filas = []
  const trs = texto.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []
  for (const tr of trs) {
    const celdas = (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [])
      .filter((c) => !ES_OCULTA.test(c.slice(0, c.indexOf('>') + 1)))
      .map((c) =>
        c
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/\s+/g, ' ')
          .trim()
      )
    if (celdas.length) filas.push(celdas)
  }
  return filas
}

// Separa una línea de CSV respetando las comillas: un campo entrecomillado
// puede llevar comas dentro, y partir por comas a secas lo rompería.
function partirCsv(linea, sep) {
  const campos = []
  let actual = ''
  let entreComillas = false
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i]
    if (ch === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"'
        i++
      } else {
        entreComillas = !entreComillas
      }
    } else if (ch === sep && !entreComillas) {
      campos.push(actual)
      actual = ''
    } else {
      actual += ch
    }
  }
  campos.push(actual)
  return campos.map((c) => c.trim())
}

function filasDeCsv(texto) {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim())
  if (!lineas.length) return []
  // El separador se deduce de la primera línea: se elige el que más veces
  // aparece. Los informes de MT5 en algunos idiomas usan punto y coma porque
  // la coma es el separador decimal.
  const sep = [',', ';', '\t']
    .map((s) => [s, lineas[0].split(s).length])
    .sort((a, b) => b[1] - a[1])[0][0]
  return lineas.map((l) => partirCsv(l, sep))
}

// ------------------------------------------------------------------- números

// Convierte a número el formato que venga: «1 234,56», «1,234.56», «-25.30»,
// «(25.30)» —los paréntesis son negativos en algunos informes— y con símbolo
// de moneda pegado.
export function aNumero(txt) {
  if (typeof txt === 'number') return txt
  if (!txt) return null
  let s = String(txt).trim()
  if (!s) return null
  const negativoPorParentesis = /^\(.*\)$/.test(s)
  s = s.replace(/[()]/g, '').replace(/[^\d,.\-+]/g, '')
  if (!s || !/\d/.test(s)) return null

  const ultimaComa = s.lastIndexOf(',')
  const ultimoPunto = s.lastIndexOf('.')
  if (ultimaComa > -1 && ultimoPunto > -1) {
    // El que va MÁS A LA DERECHA es el decimal; el otro separa miles.
    if (ultimaComa > ultimoPunto) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (ultimaComa > -1) {
    // Una sola coma: decimal si deja 1 o 2 cifras detrás («1,5» / «12,50»),
    // separador de miles si deja exactamente 3 («1,234»). Con 3 es ambiguo de
    // verdad —«1,234» puede ser mil doscientos treinta y cuatro o uno coma
    // doscientos treinta y cuatro— y se elige miles, que es lo habitual en un
    // informe de bróker en inglés.
    const detras = s.length - ultimaComa - 1
    s = detras === 3 ? s.replace(/,/g, '') : s.replace(',', '.')
  }
  const n = Number(s)
  if (!isFinite(n)) return null
  return negativoPorParentesis ? -Math.abs(n) : n
}

// ------------------------------------------------------------------- símbolos

// «EURUSD.m», «eurusd-pro», «EUR/USD», «EURUSD_raw» → 'EUR/USD'.
// Devuelve null si no es un par que esta app conozca, para no meter en el
// Diario oro, índices o acciones, que la app no sabe analizar.
export function normalizarPar(simbolo, conocidos) {
  if (!simbolo) return null
  const limpio = String(simbolo)
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
  if (limpio.length < 6) return null
  // Los sufijos del bróker («.m», «pro», «raw») van al final, así que las seis
  // primeras letras son el par. Al revés no: «MEURUSD» no existe.
  const candidato = `${limpio.slice(0, 3)}/${limpio.slice(3, 6)}`
  return conocidos.includes(candidato) ? candidato : null
}

// ------------------------------------------------------------------ la lectura

/**
 * @param texto     contenido del archivo tal cual.
 * @param conocidos pares que la app sabe analizar (PAIR_NAMES).
 * @returns { operaciones, avisos, leidas } — `operaciones` con la misma forma
 *          que las que guarda el Diario a mano, más `ticket` y `origen`.
 *
 *          `avisos` dice lo que se descartó y por qué: un import silencioso
 *          que se come la mitad de las filas es peor que uno que falla,
 *          porque nadie se entera.
 *
 *          ⚠️ Los avisos salen como { codigo, n }, NO como frases hechas. Esta
 *          función corre también en Node (las pruebas) y no sabe el idioma de
 *          quien la usa; devolver texto en español dejaría estos mensajes sin
 *          traducir en una app que está en trece idiomas. Traduce quien pinta.
 */
export function leerOperaciones(texto, conocidos) {
  const avisos = []
  if (!texto || !texto.trim()) return { operaciones: [], avisos: [{ codigo: 'vacio' }], leidas: 0 }

  const esHtml = /<\s*table/i.test(texto) || /<\s*tr[\s>]/i.test(texto)
  const filas = esHtml ? filasDeHtml(texto) : filasDeCsv(texto)
  if (!filas.length) {
    return { operaciones: [], avisos: [{ codigo: 'sinTabla' }], leidas: 0 }
  }

  // ⚠️⚠️ UN INFORME DE MT5 TRAE CUATRO TABLAS, NO UNA, Y CADA UNA CON SUS
  // PROPIAS COLUMNAS: Posiciones, Órdenes, Transacciones y Órdenes activas.
  //
  // Antes esto se aprendía las columnas de la PRIMERA y las usaba para todas.
  // Las otras tres se leían con el plano equivocado, y encima la misma
  // operación entraba tres veces bajo tres formas distintas. En el informe real
  // de Néstor: 36 posiciones cerradas de verdad y 129 filas a punto de
  // guardarse, contando órdenes, transacciones y hasta una orden PENDIENTE que
  // nunca se ejecutó.
  //
  // Ahora se localizan todas las cabeceras y se importa de UNA SOLA tabla: la
  // que de verdad son operaciones cerradas. Ver `elegirTabla`.
  const tablas = []
  for (let i = 0; i < filas.length; i++) {
    const t = mapear(filas[i])
    if (t && t.mapa.simbolo !== undefined && t.mapa.tipo !== undefined) {
      if (tablas.length) tablas[tablas.length - 1].fin = i
      tablas.push({ cabecera: i, fin: filas.length, ...t })
    }
  }
  if (!tablas.length) {
    return { operaciones: [], avisos: [{ codigo: 'sinColumnas' }], leidas: 0 }
  }

  const elegida = elegirTabla(tablas)
  const mapa = elegida.mapa
  if (mapa.beneficio === undefined) {
    avisos.push({ codigo: 'sinResultado' })
  }

  // Filas con pinta de operación que quedan FUERA de la tabla elegida. Se
  // cuentan para decirlo: saltarse tres tablas en silencio es justo el import
  // callado que la cabecera de este archivo dice que es peor que uno que falla.
  let deOtrasTablas = 0
  for (const t of tablas) {
    if (t === elegida) continue
    for (let i = t.cabecera + 1; i < t.fin; i++) {
      const v = sinAcentos(filas[i][t.mapa.tipo] ?? '')
      if (v && !COLUMNAS.tipo.includes(v) && /^(buy|compra|long|larga|sell|venta|short|corta)/.test(v)) deOtrasTablas++
    }
  }

  const operaciones = []
  let descartadasPorPar = 0
  let descartadasPorTipo = 0
  let leidas = 0

  for (let i = elegida.cabecera + 1; i < elegida.fin; i++) {
    const fila = filas[i]
    const celda = (k) => (mapa[k] === undefined ? '' : (fila[mapa[k]] ?? ''))

    const tipoCrudo = sinAcentos(celda('tipo'))
    if (!tipoCrudo) continue
    // Otra fila de encabezados (MT5 repite la cabecera en cada sección) o una
    // fila de totales: no es una operación y no cuenta como descartada.
    if (COLUMNAS.tipo.includes(tipoCrudo)) continue
    if (NO_ES_OPERACION.some((x) => tipoCrudo.includes(x))) continue

    leidas++

    const compra = /^(buy|compra|long|larga)/.test(tipoCrudo)
    const venta = /^(sell|venta|short|corta)/.test(tipoCrudo)
    if (!compra && !venta) {
      descartadasPorTipo++
      continue
    }

    const par = normalizarPar(celda('simbolo'), conocidos)
    if (!par) {
      descartadasPorPar++
      continue
    }

    // El resultado NETO: lo que de verdad entró o salió de la cuenta. El
    // beneficio a secas ignora el swap y la comisión, y son justo los costes
    // que este proyecto lleva meses midiendo para no engañarse. Enseñarlos
    // aquí sin descontar sería contarse el cuento en la propia app.
    const bruto = aNumero(celda('beneficio')) ?? 0
    const swap = aNumero(celda('swap')) ?? 0
    const comision = aNumero(celda('comision')) ?? 0
    const neto = bruto + swap + comision

    const fecha = fechaDe(celda('cierre') || celda('apertura') || celda('hora'))
    const ticket = celda('ticket').trim()

    operaciones.push({
      par,
      dir: compra ? 'Compra' : 'Venta',
      lote: aNumero(celda('volumen')) ?? 0,
      pl: Math.round(neto * 100) / 100,
      fecha,
      estado: 'cerrada',
      // La nota SÍ va en texto y no traducida: se guarda en la base de datos
      // y se queda ahí para siempre. Si se tradujera al idioma de quien
      // importa, la misma operación diría cosas distintas según quién la
      // subiera, y al cambiar de idioma las viejas quedarían descolgadas. Es
      // la misma razón por la que `dir` sigue siendo 'Compra'/'Venta'.
      nota:
        swap || comision
          ? `MT4/MT5 · bruto ${bruto.toFixed(2)} · swap ${swap.toFixed(2)} · com. ${comision.toFixed(2)}`
          : 'MT4/MT5',
      // Para no duplicar si se sube dos veces el mismo informe, que es lo que
      // va a pasar: lo normal es exportar el historial completo cada vez.
      ticket: ticket || `${par}|${compra ? 'C' : 'V'}|${fecha}|${neto}`,
      origen: 'broker',
    })
  }

  if (descartadasPorPar) {
    avisos.push({ codigo: 'saltadasPorPar', n: descartadasPorPar, pares: conocidos.length })
  }
  if (descartadasPorTipo) avisos.push({ codigo: 'saltadasPorTipo', n: descartadasPorTipo })
  if (deOtrasTablas) avisos.push({ codigo: 'otrasTablas', n: deOtrasTablas })
  if (!operaciones.length && leidas) avisos.push({ codigo: 'nadaAprovechable' })

  return { operaciones, avisos, leidas }
}

/**
 * De todas las tablas del archivo, ¿cuál son las operaciones CERRADAS?
 *
 * Se puntúa, no se adivina por el título: los títulos están traducidos y
 * cambian entre MT4 y MT5, pero la FORMA de la tabla no.
 *
 *  · +2 si tiene columna de resultado. Sin ella no es una operación cerrada:
 *    así se caen «Órdenes» y «Órdenes activas», que solo dicen qué se pidió.
 *  · +1 si tiene DOS columnas de hora. Una operación cerrada tiene apertura y
 *    cierre; la tabla de «Transacciones» de MT5 tiene una sola, porque cada
 *    fila es media operación (la entrada o la salida). Importar esa tabla
 *    contaría cada operación dos veces, una de ellas con resultado 0.
 *
 * En un CSV normal, que trae una sola tabla, esto no hace nada: gana la única
 * que hay. A igualdad de puntos gana la PRIMERA, que en MT4 y MT5 es siempre
 * la de posiciones cerradas.
 */
function elegirTabla(tablas) {
  const punto = (t) => (t.mapa.beneficio !== undefined ? 2 : 0) + (t.nHoras >= 2 ? 1 : 0)
  let mejor = tablas[0]
  for (const t of tablas) if (punto(t) > punto(mejor)) mejor = t
  return mejor
}

// Empareja los encabezados con las columnas que hacen falta. Devuelve también
// cuántas columnas de hora tiene la tabla, que es lo que distingue una
// operación cerrada (apertura y cierre) de media operación (ver `elegirTabla`).
function mapear(fila) {
  if (!fila || fila.length < 3) return null
  const mapa = {}
  let nHoras = 0
  fila.forEach((celda, i) => {
    // Los espacios alrededor de la barra se quitan: MetaTrader escribe «S / L»
    // y «Fecha/Hora» sin criterio fijo, y son la misma clase de encabezado.
    const txt = sinAcentos(celda).replace(/\s*\/\s*/g, '/')
    if (!txt) return
    for (const [clave, nombres] of Object.entries(COLUMNAS)) {
      // Coincidencia exacta primero y "empieza por" después: «Profit» y
      // «Profit/Loss» son la misma columna, pero «Open Price» NO es «Price».
      if (nombres.includes(txt) || nombres.some((n) => txt === n || txt.startsWith(n + ' '))) {
        if (clave === 'hora' || clave === 'apertura' || clave === 'cierre') nHoras++
        // MT5 repite «Time» y «Price» para apertura y cierre. La PRIMERA es la
        // apertura y la SEGUNDA el cierre; para el Diario interesa la de
        // cierre, así que la repetición pisa a la anterior a propósito.
        if (mapa[clave] === undefined || clave === 'hora') mapa[clave] = i
        return
      }
    }
  })
  return Object.keys(mapa).length ? { mapa, nHoras } : null
}

// Deja la fecha en 'AAAA-MM-DD', que es como la guarda el Diario. Acepta
// «2026.09.04 13:45:00» (MetaTrader), «2026-09-04 13:45» y «04/09/2026».
function fechaDe(txt) {
  const hoy = () => new Date().toISOString().slice(0, 10)
  if (!txt) return hoy()
  const s = String(txt).trim()
  let m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  // Día primero. Se asume día/mes (formato europeo, que es el de MetaTrader en
  // español); con día ≤ 12 es ambiguo y no hay forma de saberlo desde el
  // archivo, así que se elige el formato del informe, no el de EE. UU.
  m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return hoy()
}

/**
 * Quita las que ya están en el Diario. Se compara por `ticket`, que es el
 * número que le pone el bróker a cada operación y no se repite.
 *
 * Hace falta porque lo natural es exportar el historial ENTERO cada vez: sin
 * esto, la segunda importación duplicaría todo lo de la primera y las
 * estadísticas del Diario quedarían al doble sin que nada avisara.
 */
export function quitarRepetidas(nuevas, yaGuardadas) {
  const vistos = new Set(yaGuardadas.map((t) => t.ticket).filter(Boolean))
  const salida = []
  for (const op of nuevas) {
    if (vistos.has(op.ticket)) continue
    vistos.add(op.ticket)
    salida.push(op)
  }
  return salida
}
