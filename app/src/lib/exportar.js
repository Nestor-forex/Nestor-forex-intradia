// Exportar lo que la persona hizo en la app (2026-11-17): los resultados de la
// práctica en una tabla y el análisis del Analizador en un texto.
//
// ⚠️ SIN REACT Y SIN NAVEGADOR en las cuentas: arman texto y nada más, para
// poder probarlas en Node. Solo `descargar` y `compartirODescargar` tocan el
// navegador.
//
// ⚠️ LOS NÚMEROS SE ESCRIBEN CON EL DECIMAL DEL IDIOMA y el separador de la
// tabla sale de ahí. Una hoja de cálculo en español (o en portugués, alemán,
// francés…) lee «1.16290» como ciento dieciséis mil doscientos noventa. Con
// decimal de coma, las columnas van separadas por punto y coma, que es lo que
// esa hoja espera.
//
// ⚠️ LO QUE NO SE SABE VA VACÍO, nunca un 0: un 0 en la columna del swap diría
// «no costó nada», y lo que pasó es que no hubo dato.
//
// ⚠️ EL TEXTO DEL ANÁLISIS TERMINA CON EL AVISO de que no es una señal. Es lo
// que viaja cuando alguien lo reenvía, y fuera de la app nadie lo ve con la
// tarjeta alrededor.

import { costesPractica, monedaDePractica, rbDe } from './practica.js'
import { LOTE_MINIMO } from './calc.js'
import { dinero } from './monedaCuenta.js'

const num = (x) => typeof x === 'number' && Number.isFinite(x)

/** El decimal que usa un idioma: '.' o ','. Ante la duda, el punto. */
export function decimalDe(locale) {
  try {
    const parte = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal')
    return parte?.value === ',' ? ',' : '.'
  } catch {
    return '.'
  }
}

/** Con decimal de coma, la tabla va separada por punto y coma. */
export const separadorDe = (decimal) => (decimal === ',' ? ';' : ',')

/** Un número para la tabla: sin separador de miles y con el decimal pedido. */
export function numeroCsv(x, decimales, decimal = '.') {
  if (!num(x)) return ''
  const s = x.toFixed(decimales)
  return decimal === ',' ? s.replace('.', ',') : s
}

/** Una celda: entre comillas si lleva el separador, comillas o un salto de línea. */
export function celdaCsv(v, sep = ',') {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return s.includes(sep) || s.includes('"') || s.includes('\n') || s.includes('\r') ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * La tabla entera. Empieza con la marca de UTF-8 para que una hoja de cálculo
 * no rompa las tildes, y usa saltos de línea de Windows, que es lo que Excel
 * espera y que las demás leen igual.
 */
export function csvDe(filas, { sep = ',' } = {}) {
  return '﻿' + filas.map((f) => f.map((v) => celdaCsv(v, sep)).join(sep)).join('\r\n') + '\r\n'
}

/** Las columnas de la tabla de práctica, en orden. Los títulos los pone el idioma. */
export const COLUMNAS_PRACTICA = Object.freeze([
  'fecha', 'par', 'lado', 'estado', 'entrada', 'sl', 'tp', 'rb',
  'rBruto', 'spreadR', 'swapR', 'noches', 'rNeto', 'riesgoUsd', 'usdNeto', 'moneda', 'fuente',
])

const fechaDe = (o) => {
  const ms = o?.creado?.toMillis ? o.creado.toMillis() : num(o?.creadoMs) ? o.creadoMs : null
  return ms === null ? '' : new Date(ms).toISOString().slice(0, 16).replace('T', ' ')
}

/**
 * Las filas de la práctica (sin la de títulos). `etiqueta(clave)` traduce el
 * lado y el estado; las fechas van en UTC y en formato AAAA-MM-DD HH:MM, que
 * cualquier hoja ordena bien.
 */
export function filasPractica(ops, { decimal = '.', etiqueta = (x) => x } = {}) {
  const lista = Array.isArray(ops) ? ops.filter(Boolean) : []
  return lista.map((o) => {
    const d = String(o.par).includes('JPY') ? 3 : 5
    const c = costesPractica(o)
    const n = (x, k) => numeroCsv(x, k, decimal)
    return [
      fechaDe(o),
      o.par ?? '',
      etiqueta(o.lado === 'VENTA' ? 'venta' : 'compra'),
      etiqueta(o.estado ? `est_${o.estado}` : 'esperando'),
      n(o.entrada, d),
      n(o.sl, d),
      n(o.tp, d),
      n(rbDe(o), 2),
      n(c ? c.rBruto : null, 2),
      // El spread solo se resta si la entrada fue de Twelve Data; si fue de MT5
      // ya va dentro del precio y la celda queda vacía.
      n(c && !c.spreadIncluido && !c.sinSpread ? -c.spreadR : null, 2),
      n(c && !c.sinSwap ? c.swapR : null, 2),
      c && !c.sinSwap && Number.isInteger(c.noches) ? String(c.noches) : '',
      n(c ? c.rNeto : null, 2),
      n(o.riesgoUsd, 2),
      n(c ? c.usdNeto : null, 2),
      // En qué moneda van las dos columnas de antes (2026-11-22): dólares o
      // euros, la de la cuenta cuando se creó. Vacía si no guardó dinero.
      typeof o.riesgoUsd === 'number' ? monedaDePractica(o) : '',
      o.fuente ?? '',
    ]
  })
}

/** La tabla de la práctica lista para guardar, con su fila de títulos. */
export function csvPractica(ops, { locale = 'es', titulo = (x) => x, etiqueta = (x) => x } = {}) {
  const decimal = decimalDe(locale)
  return csvDe([COLUMNAS_PRACTICA.map(titulo), ...filasPractica(ops, { decimal, etiqueta })], { sep: separadorDe(decimal) })
}

/**
 * El análisis del Analizador en texto, para guardarlo o reenviarlo. Solo lo
 * que la tarjeta dice de la operación (precio, niveles, lote) y las
 * herramientas más leídas. Números con punto y siglas de trading, igual que la
 * nota que va al Diario.
 *
 * Devuelve '' si no hay niveles: sin dirección no hay análisis que exportar.
 */
export function textoAnalisis(a, { t, fecha = '' } = {}) {
  if (!a?.niveles || typeof t !== 'function') return ''
  const f = (x) => (num(x) ? x.toFixed(a.dec) : '—')
  const n = a.niveles
  const L = []
  L.push(`${a.par} · ${t(a.lado === 'VENTA' ? 'prac.venta' : 'prac.compra')}${fecha ? ` · ${fecha}` : ''}`)
  L.push('')
  L.push(`${t('exp.precio')} ${f(a.precio)}`)
  L.push(`Stop-loss ${f(n.sl)} (${Math.round(n.pipRiesgo)} pips)`)
  L.push(`Take-profit ${f(n.tp)} (${Math.round(n.pipBeneficio)} pips)`)
  L.push(`R/B 1:${n.rr.toFixed(2)}`)
  L.push(`${t('exp.metodo')} ${t(`an.metodo.${a.metodo}`)}`)
  if (a.lote) {
    // Por debajo del lote mínimo no se escribe «0.00»: no se puede abrir.
    const lote = a.lote.bajoMinimo ? `< ${LOTE_MINIMO.toFixed(2)}` : a.lote.lote.toFixed(2)
    L.push(`${t('exp.lote')} ${lote} · ${t('exp.riesgo')} ${dinero(a.lote.riesgoUsd, a.lote.moneda)}`)
    if (a.lote.bajoMinimo) L.push(t('calc.bajoMinimo', { minimo: LOTE_MINIMO.toFixed(2), riesgo: dinero(a.lote.riesgoMinimoUsd, a.lote.moneda) }))
  }

  const h = a.herramientas || {}
  const extra = []
  if (h.niveles) extra.push(`${t('exp.soporte')} ${f(h.niveles.sop)} · ${t('exp.resistencia')} ${f(h.niveles.res)}`)
  if (num(h.pivote?.p)) extra.push(`${t('exp.pivote')} ${f(h.pivote.p)}`)
  if (h.tendencia?.tend) extra.push(`${t('exp.tendencia')} ${t(`tend.${h.tendencia.tend}`)}`)
  if (h.rsi) extra.push(`RSI ${h.rsi.v.toFixed(1)}`)
  if (h.atr) extra.push(`ATR ${Math.round(h.atr.pips)} pips`)
  if (h.fuerza) extra.push(`${t('exp.fuerza')} ${h.fuerza.b} ${h.fuerza.vb.toFixed(1)} · ${h.fuerza.q} ${h.fuerza.vq.toFixed(1)}`)
  if (extra.length) {
    L.push('')
    L.push(...extra)
  }
  L.push('')
  L.push(t('exp.avisoAnalisis'))
  return L.join('\n')
}

/** Guarda un texto como archivo. Solo en el navegador. */
export function descargar(contenido, nombre, tipo = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * En el teléfono, abre el menú de compartir (WhatsApp, correo…); donde no lo
 * hay, descarga el archivo. Devuelve 'compartido', 'descargado' o 'cancelado'.
 */
export async function compartirODescargar(texto, nombre) {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: nombre, text: texto })
      return 'compartido'
    } catch (e) {
      // Cerrar el menú no es un fallo: no se descarga nada que no se pidió.
      if (e?.name === 'AbortError') return 'cancelado'
    }
  }
  descargar(texto, nombre)
  return 'descargado'
}
