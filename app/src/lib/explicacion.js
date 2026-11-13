import { categoriaDe } from './calendario.js'

// «¿QUÉ SIGNIFICA?» — LA EXPLICACIÓN AMPLIADA DE CADA NOTICIA (2026-11-13).
//
// Lo pidió Néstor viendo el calendario: «USD Core PPI m/m (Inflación) · Mueve
// mucho · previsto 0.3 % · anterior 0.7 %» está bien para quien sabe, y a un
// principiante no le dice nada. Debajo de cada noticia, de cada tasa y de cada
// fila del COT va ahora un botón que despliega la explicación en palabras
// sencillas.
//
// ⚠️⚠️ SOLO DICE SI ALGO ESTÁ ALTO O BAJO, NUNCA COMPRA O VENTA. Lo pidió él con
// esas palabras: «si sale alto solo debe indicar que está alto o bajo, no debe
// decir compra o venta, de esa manera no estamos dando una señal». Por eso aquí
// no hay ninguna función que relacione un dato con una dirección del precio, y
// hay una comprobación que falla si aparece una (`prueba-explicacion.mjs`).
// Que un dato de inflación alto «suele fortalecer la divisa» es una frase que se
// lee en todas partes, y es exactamente una señal sin medir.
//
// ⚠️ DEVUELVE DATOS, NO TEXTO. La frase la arma la pantalla en el idioma de
// quien mira; y el mismo objeto es lo que el botón «Explícamelo con Qwen» (fase
// 5) le pasará a la IA como contexto. Los números los pone la app.
//
// Es GEMELO: el calendario y las tasas son los mismos en las dos apps.

// Las familias que tienen explicación propia. Son las de `categoriaDe`, más
// `general` para lo que no reconoce: ahí la explicación dice que la app no sabe
// de qué familia es, en vez de inventarse una.
export const FAMILIAS = Object.freeze([
  'tipos',
  'inflacion',
  'empleo',
  'crecimiento',
  'ventas',
  'actividad',
  'comercio',
  'discurso',
  'festivo',
  'general',
])

// Los trozos de jerga que salen en los nombres de ForexFactory, cada uno con su
// explicación. Se detectan en el nombre ORIGINAL (que se conserva en pantalla),
// así que el principiante aprende a leer cualquier otro calendario.
//
// El orden es el de lectura en la pantalla. `core` antes que `cpi`/`ppi`
// porque «Core PPI» se lee en ese orden.
const TERMINOS = [
  ['core', /\bcore\b/i],
  ['cpi', /\bcpi\b/i],
  ['ppi', /\bppi\b/i],
  ['pmi', /\bpmi\b/i],
  ['gdp', /\bgdp\b/i],
  ['flash', /\bflash\b|\bprelim/i],
  ['mm', /\bm\/m\b/i],
  ['qq', /\bq\/q\b/i],
  ['yy', /\by\/y\b/i],
]
export const CLAVES_TERMINOS = Object.freeze(TERMINOS.map(([k]) => k))

export function terminosDe(titulo) {
  const t = String(titulo ?? '')
  return TERMINOS.filter(([, re]) => re.test(t)).map(([k]) => k)
}

// Lee un valor del feed: «0.3%», «-0.2%», «24.5K», «1.2M», «53.1».
//
// ⚠️ DEVUELVE `null` ANTE CUALQUIER COSA RARA, y nunca 0. «<0.1%» es una cota,
// no un número, y compararla daría una frase falsa. `Number('')` vale 0 en
// JavaScript: por eso se comprueba el texto antes de convertirlo.
export function leerValor(s) {
  const m = /^\s*([+\-−]?)(\d+(?:\.\d+)?)\s*(%|K|M|B|T)?\s*$/i.exec(String(s ?? ''))
  if (!m) return null
  const n = Number(m[2]) * (m[1] === '-' || m[1] === '−' ? -1 : 1)
  if (!Number.isFinite(n)) return null
  return { n, unidad: (m[3] ?? '').toUpperCase() }
}

// ¿Lo previsto sale más alto, más bajo o igual que lo anterior?
//
// ⚠️ SOLO SI LOS DOS SE LEEN Y TRAEN LA MISMA UNIDAD. «0.3%» contra «24K» no se
// comparan: decir que uno es mayor sería una afirmación sobre dos cosas
// distintas.
export function compararPrevisto(ev) {
  const f = leerValor(ev?.f)
  const p = leerValor(ev?.p)
  if (!f || !p || f.unidad !== p.unidad) return null
  if (f.n > p.n) return 'mayor'
  if (f.n < p.n) return 'menor'
  return 'igual'
}

// Todo lo que la explicación de una noticia necesita, ya decidido.
export function explicacionEvento(ev) {
  if (!ev || typeof ev !== 'object') return null
  return {
    familia: categoriaDe(ev) ?? 'general',
    terminos: terminosDe(ev.t),
    impacto: ev.i ?? null,
    previsto: ev.f ?? null,
    anterior: ev.p ?? null,
    comparacion: compararPrevisto(ev),
  }
}
