// La parte del vigía que decide qué es una señal NUEVA, separada de la
// descarga y de los archivos para poder probarla sin internet ni cuota.
// Es la lógica de la que depende todo lo demás: si esto se equivoca, o te
// llegan avisos repetidos o no te llega ninguno.

import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { dirname } from 'node:path'

// Una señal es la misma si es el mismo par, el mismo lado y el mismo tipo.
// Si desaparece y vuelve más tarde cuenta como nueva a propósito: es una
// oportunidad de entrada distinta, no la misma repetida.
export const idDe = (s) => `${s.name}|${s.lado}|${s.tipo}`

// Tipos de señal que se ANOTAN pero no se enseñan ni se avisan: están en
// pruebas, acumulando operaciones reales hasta tener un número que signifique
// algo. Hoy, las de retroceso (54% de acierto, pero sobre 50 operaciones, con
// un margen de error de ±14 puntos).
//
// Viven aquí y no sueltas en `vigia.mjs` por una razón concreta: son la
// promesa de que una regla sin aprobar no le llega a nadie, y una promesa así
// tiene que poder comprobarse sin internet. Meter el siguiente experimento es
// añadir una palabra a este Set.
export const TIPOS_EN_SOMBRA = new Set(['retroceso'])

export const esSombra = (s) => TIPOS_EN_SOMBRA.has(s?.tipo)

// Parte las señales nuevas en las que pueden salir hacia un celular y las que
// solo se anotan. Devuelve las dos listas en vez de filtrar por dentro para
// que en el vigía se vea, en una línea, que lo que se envía no es lo mismo
// que lo que se guarda.
export function separarSombra(nuevas) {
  return {
    visibles: nuevas.filter(({ s }) => !esSombra(s)),
    sombra: nuevas.filter(({ s }) => esSombra(s)),
  }
}

export function leerEstado(ruta) {
  try {
    const e = JSON.parse(readFileSync(ruta, 'utf8'))
    return {
      senales: Array.isArray(e.senales) ? e.senales : [],
      // Cuándo corrió el vigía por última vez. Lo usa `yaCorrioEstaHora` para
      // que dos relojes no hagan el trabajo dos veces.
      //
      // ⚠️ ESTE CAMPO SE TIRABA. Hasta el 2026-10-06 `leerEstado` se quedaba
      // solo con `senales`, así que el guardián de la hora nunca se habría
      // activado y los dos relojes harían el trabajo dos veces — 329 créditos
      // al día en vez de 168, y en silencio. Es el mismo descuido que ya tuvo
      // Swing y que está anotado en CLAUDE.md con fecha del 2026-09-07.
      actualizadoEl: typeof e.actualizadoEl === 'string' ? e.actualizadoEl : null,
    }
  } catch {
    // Primera corrida, o archivo estropeado: se arranca de cero. Que no haya
    // estado previo no puede tumbar el vigía.
    return { senales: [], actualizadoEl: null }
  }
}

// ────────────────────────────────────────────────────────────────────────
// EL GUARDIÁN DE LA HORA (desde el 2026-10-06)
//
// Desde hoy hay DOS relojes pulsando el mismo botón: el de GitHub (sus 24
// entradas de cron, que disparan casi siempre y llegan horas tarde) y el de
// fuera, en Cloudflare (`reloj-externo/worker.js` del repositorio de Swing, que
// sí es puntual). Sin este guardián el vigía correría hasta 47 veces al día en
// vez de 24: **329 créditos de Twelve Data de los 800 en vez de 168**, y el
// publicador del barrido otros tantos.
//
// 📌 Y conviene tener escrito que esto es un CAMBIO DE OPINIÓN mío. Al poner
// las 24 entradas de cron escribí que un guardián aquí SOBRABA, porque repetir
// una corrida es barato (7 créditos, y `compararConAnterior` descarta las
// señales que ya estaban, así que no se anota nada dos veces). Era cierto **con
// un solo reloj**. Con dos, la cuenta cambia y el guardián hace falta.
//
// ⚠️ ESCRITO POR EL LADO SEGURO, igual que `esSombra` y que el `yaCorrioHoy` de
// Swing. Ante cualquier duda —no hay marca, el archivo está roto, la fecha no
// se entiende, no es texto— devuelve `false`, o sea CORRE:
//
//   · equivocarse hacia CORRER cuesta 7 créditos de los 800 y no cambia el
//     historial;
//   · equivocarse hacia SALTARSE cuesta una hora de historial que no vuelve.
//
// Los dos errores no valen lo mismo, así que la condición no puede ser
// simétrica.
//
// Se compara la HORA en UTC, que es el huso en el que están escritos los crones
// y en el que trabaja el reloj de fuera. Y se compara la hora de RELOJ, no
// «hace menos de 60 minutos»: lo que importa para el historial es cuántas horas
// DISTINTAS se miran al día, que es exactamente lo que mide
// `app/scripts/medir-puntualidad.mjs`.
//
// Recibe la marca de tiempo como texto —y no el objeto de estado entero— para
// que sirva igual al vigía (`estado.actualizadoEl`) y al publicador del barrido
// (`generadoEl` del propio `barrido.json`), que no tiene archivo de estado.
export function yaCorrioEstaHora(marcaISO, ahora) {
  if (typeof marcaISO !== 'string') return false
  const d = new Date(marcaISO)
  if (Number.isNaN(d.getTime())) return false
  return d.toISOString().slice(0, 13) === ahora.toISOString().slice(0, 13)
}

// Devuelve { actuales, nuevas } con los setups de esta revisión y cuáles no
// estaban en la anterior.
export function compararConAnterior(setups, estadoPrevio) {
  const previas = new Set(estadoPrevio.senales || [])
  const actuales = setups.map((s) => ({ id: idDe(s), s }))
  return { actuales, nuevas: actuales.filter((x) => !previas.has(x.id)) }
}

// Lee un archivo de los que se escriben una línea de JSON por vez.
//
// Una línea rota se salta en vez de tumbar la lectura entera: estos archivos
// se escriben añadiendo al final, así que un corte a mitad de escritura
// dejaría la última línea incompleta, y perder el historial completo por eso
// sería absurdo.
export function leerJsonl(ruta) {
  let bruto
  try {
    bruto = readFileSync(ruta, 'utf8')
  } catch {
    return [] // todavía no existe: primera vez
  }

  const salida = []
  for (const linea of bruto.split('\n')) {
    if (!linea.trim()) continue
    try {
      salida.push(JSON.parse(linea))
    } catch {
      // línea a medias, se ignora
    }
  }
  return salida
}

export function escribir(ruta, texto, anexar = false) {
  mkdirSync(dirname(ruta), { recursive: true })
  if (anexar) appendFileSync(ruta, texto)
  else writeFileSync(ruta, texto)
}
