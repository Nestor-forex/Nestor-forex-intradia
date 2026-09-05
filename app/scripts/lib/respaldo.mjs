// LA COPIA DE SEGURIDAD DEL HISTORIAL, Y LA ALARMA QUE LA ACOMPAÑA.
//
// ─────────────────────────────────────────────────────────────────────────
// QUÉ SE ESTÁ PROTEGIENDO, QUE NO ES UN ARCHIVO CUALQUIERA
// ─────────────────────────────────────────────────────────────────────────
// `historial/senales.jsonl` y `historial/resultados.jsonl` son LO ÚNICO de
// todo el proyecto que no se puede volver a fabricar. El código se reescribe
// en un día; una señal del 12 de agosto no, porque depende de lo que la app
// dijo ESE DÍA y con los precios de ESE DÍA.
//
// Y es justo lo que hace falta para poder vender: los ~11 meses de historial
// acumulado que dirán si la reversión aguanta en la realidad. Perderlos no
// cuesta un archivo — cuesta el año de espera, y encima antes de terminarlo.
//
// Hasta hoy había UNA sola copia, en la rama `datos`.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ POR QUÉ ESTO NO ES «COPIAR EL ARCHIVO Y YA»
// ─────────────────────────────────────────────────────────────────────────
// El peligro real no es que el archivo desaparezca —eso se nota— sino que se
// ESTROPEE en silencio: que el vigía lo trunque, o que una corrida a medias
// escriba una línea rota. Una copia que reproduce fielmente un archivo
// truncado es PEOR que no tener copia, porque da tranquilidad falsa.
//
// Por eso la copia también compara con la anterior y CHILLA cuando algo
// encoge. Estos archivos solo crecen: el vigía añade líneas al final y no
// borra nunca. Si hay menos que la semana pasada, pasó algo malo, y hay que
// enterarse ese día — no dentro de ocho meses.

// Cuenta las líneas con contenido. Un archivo JSONL termina en salto de
// línea, así que partir por '\n' deja siempre una última vacía que no cuenta.
export function contarLineas(texto) {
  if (!texto) return 0
  return texto.split('\n').filter((l) => l.trim() !== '').length
}

// Además de contarlas, mira que cada línea sea un JSON válido.
//
// Esto vigila el fallo que las cuentas solas no ven: un archivo con el número
// correcto de líneas pero con una a medio escribir. El día que pase, la línea
// rota se lleva por delante todo lo que el lector intente hacer después.
export function revisarJsonl(texto) {
  const lineas = (texto || '').split('\n').filter((l) => l.trim() !== '')
  const rotas = []
  lineas.forEach((l, i) => {
    try {
      JSON.parse(l)
    } catch {
      rotas.push(i + 1)
    }
  })
  return { lineas: lineas.length, rotas }
}

/**
 * Decide si la copia de hoy es sana comparándola con la anterior.
 *
 * `anterior` puede ser `null`: la primera vez no hay con qué comparar, y eso
 * no es una alarma — es el primer día.
 *
 * Devuelve `{ ok, alarmas, notas }`. `ok` en false NO impide guardar la copia
 * (guardar siempre es mejor que no guardar): impide que la corrida termine en
 * verde, para que Néstor reciba el correo de fallo de GitHub.
 */
export function compararConAnterior(actual, anterior) {
  const alarmas = []
  const notas = []

  for (const nombre of ['senales', 'resultados']) {
    const hoy = actual[nombre]
    if (!hoy) {
      alarmas.push(`Falta ${nombre}.jsonl en la rama de datos.`)
      continue
    }

    if (hoy.rotas.length) {
      alarmas.push(
        `${nombre}.jsonl tiene ${hoy.rotas.length} línea(s) que no son JSON válido ` +
          `(la primera, la ${hoy.rotas[0]}).`
      )
    }

    if (hoy.lineas === 0) {
      alarmas.push(`${nombre}.jsonl está vacío.`)
      continue
    }

    const antes = anterior?.[nombre]?.lineas
    if (antes === undefined) {
      notas.push(`${nombre}.jsonl: ${hoy.lineas} líneas (primera copia, nada con que comparar).`)
      continue
    }

    if (hoy.lineas < antes) {
      // ESTA es la comprobación por la que existe el archivo entero.
      alarmas.push(
        `${nombre}.jsonl ENCOGIÓ: ${antes} líneas en la copia anterior y ${hoy.lineas} ahora. ` +
          'Estos archivos solo crecen, así que esto significa que se perdió historial. ' +
          'La copia anterior sigue guardada en la rama `respaldos`: NO la borres.'
      )
    } else if (hoy.lineas === antes) {
      notas.push(`${nombre}.jsonl: ${hoy.lineas} líneas, igual que la copia anterior.`)
    } else {
      notas.push(`${nombre}.jsonl: ${hoy.lineas} líneas (+${hoy.lineas - antes} desde la anterior).`)
    }
  }

  return { ok: alarmas.length === 0, alarmas, notas }
}

// El nombre de la carpeta de cada copia. En orden alfabético queda también en
// orden cronológico, que es lo que permite encontrar la más reciente sin
// guardar un índice aparte — y un índice aparte es justo lo que se desincroniza.
export function carpetaDe(fecha = new Date()) {
  return fecha.toISOString().slice(0, 10)
}

/**
 * De la lista de carpetas ya guardadas, la más reciente.
 *
 * Se ignora cualquier nombre que no sea una fecha, para que un archivo suelto
 * en la raíz de la rama (un README, por ejemplo) no se cuele como si fuera una
 * copia y haga comparar contra nada.
 */
export function masReciente(carpetas) {
  const fechas = carpetas.filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c)).sort()
  return fechas.length ? fechas[fechas.length - 1] : null
}
