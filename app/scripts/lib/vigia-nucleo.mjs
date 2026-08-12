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
    return { senales: Array.isArray(e.senales) ? e.senales : [] }
  } catch {
    // Primera corrida, o archivo estropeado: se arranca de cero. Que no haya
    // estado previo no puede tumbar el vigía.
    return { senales: [] }
  }
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
