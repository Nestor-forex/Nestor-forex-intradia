// TU propio historial, partido en segmentos. Cuentas puras, sin React.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ LO MÁS IMPORTANTE DE ESTE ARCHIVO: NO DA CONSEJOS
// ─────────────────────────────────────────────────────────────────────────
// Esto cuenta lo que TÚ hiciste y lo parte en grupos. No dice qué hacer, no
// recomienda un lote, no sugiere dejar de operar un par, y NO relaciona nada
// con los experimentos de la app.
//
// El motivo no es timidez, es aritmética: las dos reglas que corren en la
// sombra llevan 12 y 3 operaciones reales. Decirle a alguien «nuestro
// experimento sugiere que hagas X» sería presentar una regla sin probar como
// si fuera un consejo — justo lo que este proyecto lleva meses negándose a
// hacer. Hay una comprobación dedicada a que aquí no aparezca ningún campo de
// veredicto, igual que en `cot.js`, para que añadirlo obligue a venir a
// borrarla a mano.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ Y LO SEGUNDO: CADA PORCENTAJE VA CON SU MARGEN AL LADO
// ─────────────────────────────────────────────────────────────────────────
// Un «38 % de acierto en cruces» sobre 20 operaciones no dice nada, y leído
// solo parece un diagnóstico. El precedente está en este proyecto: Néstor vio
// su Historial en 89 % sobre 9 operaciones, y está medido que con una moneda
// al 55 % sacar 8 o 9 de 9 pasa una de cada 26 veces.
//
// Por eso `margen(n)` acompaña SIEMPRE al porcentaje. Es la mitad del
// intervalo de confianza del 95 % para una proporción, en el peor caso
// (p = 0,5): 1,96 × 0,5 / √n, en puntos porcentuales ≈ 98/√n.
//
//     n = 10  → ±31 puntos   (un 40 % y un 70 % son lo mismo)
//     n = 25  → ±20
//     n = 100 → ±10
//     n = 400 → ±5
//
// ⚠️ Es el peor caso a propósito, como el resolver cuenta como PERDIDA el día
// que toca stop y objetivo: un número que se equivoca a favor propio no sirve
// para decidir sobre dinero.

// ⚠️ Con extensión `.js`: Vite lo resuelve sin ella pero **Node no**, y este
// archivo lo importa `scripts/prueba-diario.mjs`. Ya rompió el reporte diario
// una vez por esto mismo (2026-07-30).
import { monedasDe } from './pairs.js'

// Por debajo de esto el porcentaje no se enseña como número grande: el margen
// se come el dato entero. No es un número redondo por gusto — con 30
// operaciones el margen ya es de ±18 puntos, que sigue siendo enorme.
export const MINIMO_PARA_ENSEÑAR = 8

// ⚠️ Los dos grupos se definen por lo que SON, no por descarte, y en este
// proyecto esa distinción ya ha mordido tres veces (`esSombra`,
// `ventasPausadas`, `esDeLaApp`). Si «con dólar» fuera «todo lo que no es
// cruce», un `par` con basura dentro caería ahí en silencio y ensuciaría el
// grupo sin que nada fallara.
export const esPar = (par) => {
  const m = monedasDe(String(par ?? ''))
  return m.length === 2 && m.every((c) => /^[A-Z]{3}$/.test(c))
}

// Un par es CRUCE si es un par de verdad y ninguna de sus dos divisas es el
// dólar. La mitad de la lista de Swing lo es, y son los que más spread pagan
// (`costes.mjs`), así que separarlos no es una curiosidad: es el corte con más
// probabilidad de enseñar algo.
export const esCruce = (par) => esPar(par) && !monedasDe(par).includes('USD')
export const esConDolar = (par) => esPar(par) && monedasDe(par).includes('USD')

// Media del intervalo de confianza del 95 %, en puntos porcentuales. Ver la
// cabecera. `null` si no hay operaciones: un margen de 0 diría «este número es
// exacto», que es lo contrario de la verdad.
export function margen(n) {
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(98 / Math.sqrt(n))
}

const cerrada = (t) => t && t.estado !== 'abierta' && Number.isFinite(t.pl)

// Resume una lista de operaciones YA CERRADAS.
//
// ⚠️ Solo cerradas, igual que las estadísticas que el Diario ya enseña: una
// operación abierta no tiene resultado, y contarla como 0 la haría parecer
// «ni ganada ni perdida» cuando lo que pasa es que todavía no se sabe.
export function resumir(trades) {
  const lista = (Array.isArray(trades) ? trades : []).filter(cerrada)
  const n = lista.length
  if (!n) return { n: 0, ganadas: 0, pct: null, margen: null, neto: 0 }

  const ganadas = lista.filter((t) => t.pl > 0).length
  return {
    n,
    ganadas,
    pct: (ganadas / n) * 100,
    margen: margen(n),
    neto: lista.reduce((a, t) => a + t.pl, 0),
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Los cortes
// ─────────────────────────────────────────────────────────────────────────
//
// Tres, y ninguno inventado: son los que el propio Diario ya distingue.
//
//   · tipo de par  — cruce contra par con dólar (spread muy distinto)
//   · dirección    — compra contra venta
//   · par          — los que tengan suficientes operaciones
//
// ⚠️ Cada grupo se devuelve con su `n` SIEMPRE, incluso cuando es minúsculo.
// Esconder los grupos pequeños dejaría en pantalla solo los que parecen
// significar algo, que es exactamente cómo se fabrica un espejismo.
export function porTipoDePar(trades) {
  const lista = (Array.isArray(trades) ? trades : []).filter(cerrada)
  return [
    { clave: 'cruces', ...resumir(lista.filter((t) => esCruce(t.par))) },
    { clave: 'dolar', ...resumir(lista.filter((t) => esConDolar(t.par))) },
  ]
}

export function porDireccion(trades) {
  const lista = (Array.isArray(trades) ? trades : []).filter(cerrada)
  return [
    { clave: 'Compra', ...resumir(lista.filter((t) => t.dir === 'Compra')) },
    { clave: 'Venta', ...resumir(lista.filter((t) => t.dir === 'Venta')) },
  ]
}

// Ordenados por número de operaciones, que es el orden en el que conviene
// mirarlos: el par con más historial es del que más se puede decir.
//
// ⚠️ NO se ordena por acierto. Ordenar por acierto pone arriba al par con dos
// operaciones ganadas y un 100 %, que es justo el que menos dice.
export function porPar(trades, minimo = MINIMO_PARA_ENSEÑAR) {
  const lista = (Array.isArray(trades) ? trades : []).filter(cerrada)
  const pares = [...new Set(lista.map((t) => t.par))]
  return pares
    .map((par) => ({ clave: par, ...resumir(lista.filter((t) => t.par === par)) }))
    .filter((g) => g.n >= minimo)
    .sort((a, b) => b.n - a.n)
}

// ─────────────────────────────────────────────────────────────────────────
// El tamaño del lote
// ─────────────────────────────────────────────────────────────────────────
//
// No es un segmento: es CONTEXTO. Se enseña el menor, el mayor y cuántos
// tamaños distintos se han usado, y nada más.
//
// ⚠️ A propósito NO se dice «usa lote fijo». Que operar con lote variable sea
// peor **no está medido aquí**, y es de las cosas que suenan tan razonables
// que se dan por ciertas sin comprobarlas. Enseñar el dato deja que quien
// mira saque su conclusión; afirmarlo sería inventar una medición.
export function lotes(trades) {
  const vals = (Array.isArray(trades) ? trades : [])
    .filter(cerrada)
    .map((t) => t.lote)
    .filter((v) => Number.isFinite(v) && v > 0)
  if (!vals.length) return null
  return {
    n: vals.length,
    min: Math.min(...vals),
    max: Math.max(...vals),
    distintos: new Set(vals).size,
  }
}

// Todo junto, que es lo que pinta la pantalla.
export function diagnostico(trades, minimoPorPar = MINIMO_PARA_ENSEÑAR) {
  return {
    total: resumir(trades),
    tipoDePar: porTipoDePar(trades),
    direccion: porDireccion(trades),
    pares: porPar(trades, minimoPorPar),
    lotes: lotes(trades),
  }
}
