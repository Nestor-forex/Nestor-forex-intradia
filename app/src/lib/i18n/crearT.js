// Motor de traducción, sin React a propósito: `scripts/reporte-diario.mjs`
// corre en Node y necesita traducir sin montar la interfaz.

import { IDIOMA_BASE } from './idiomas.js'
import es from './textos/es.js'
import en from './textos/en.js'
import de from './textos/de.js'
import fr from './textos/fr.js'
import pt from './textos/pt.js'
import it from './textos/it.js'
import zh from './textos/zh.js'
import ja from './textos/ja.js'
import ru from './textos/ru.js'
import ar from './textos/ar.js'
import tr from './textos/tr.js'
import hi from './textos/hi.js'
import ko from './textos/ko.js'

const DICCIONARIOS = { es, en, de, fr, pt, it, zh, ja, ru, ar, tr, hi, ko }

const buscar = (dic, ruta) => ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dic)

/**
 * Devuelve la función `t` del idioma pedido.
 *
 * Cae al español clave por clave (no diccionario por diccionario), así que un
 * idioma traducido a medias muestra en español solo lo que le falta, en vez de
 * perder todo lo que sí tenía traducido.
 *
 * Si la clave no existe en ningún idioma devuelve la ruta misma: es un error de
 * programación y se ve como tal, en vez de dejar un espacio en blanco que nadie
 * note.
 */
export function crearT(codigo) {
  const dic = DICCIONARIOS[codigo] || DICCIONARIOS[IDIOMA_BASE]
  const base = DICCIONARIOS[IDIOMA_BASE]

  return function t(ruta, params) {
    const valor = buscar(dic, ruta) ?? buscar(base, ruta)
    if (valor == null) return ruta
    return typeof valor === 'function' ? valor(params || {}) : valor
  }
}

export { DICCIONARIOS }
