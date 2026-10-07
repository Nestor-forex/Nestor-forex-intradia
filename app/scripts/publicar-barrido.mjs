// Publica el barrido para que lo lea la app. NADA MÁS.
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ ES UN GUION APARTE Y NO UN TROZO DEL VIGÍA
// ─────────────────────────────────────────────────────────────────────────
// El vigía hace tres cosas que NO se pueden repetir a media hora:
//
//   · anota las señales nuevas en el historial,
//   · las juzga contra lo que hizo el precio,
//   · y manda los avisos al celular.
//
// Correrlo más seguido duplicaría las corridas anotadas, podría registrar
// dos veces una señal que parpadea dentro de la misma vela de una hora, y
// haría sonar el celular el doble. El historial es lo único de este proyecto
// que no se puede recuperar si se estropea, así que el vigía se queda
// EXACTAMENTE como está: una vez por hora.
//
// Este guion solo baja las velas, calcula el barrido y lo escribe. Si falla,
// no se pierde nada: la app sigue leyendo el archivo anterior y el vigía
// vuelve a publicarlo en su corrida.
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ CADA 30 MINUTOS Y NO CADA HORA NI CADA 15
// ─────────────────────────────────────────────────────────────────────────
// Antes la app pedía las velas ella misma cada 15 minutos. Al pasar a leer un
// archivo publicado, lo fresco que esté depende de cada cuánto se publique.
//
//   · Cada hora (solo el vigía) sería un retroceso de verdad, y no tanto por
//     los 15 minutos: el reloj de GitHub es impuntual y se le han medido
//     huecos de más de siete horas seguidas. Un solo salto dejaría la app
//     enseñando datos de la mañana por la tarde.
//   · Cada 15 minutos serían 96 corridas × 7 créditos = 672 de los 800 del
//     día. Cabe, pero sin sitio para el reporte diario ni para una corrida a
//     mano del banco de pruebas.
//   · Cada 30 minutos son 48 corridas × 7 = 336, menos de la mitad de la
//     cuota, y le da a cada hora DOS oportunidades de publicarse. Si el reloj
//     de GitHub se salta una, la otra la cubre.
//
// Y lo que de verdad importa no son los 15 minutos: la app calcula sobre velas
// de UNA HORA ya cerradas, y esas no cambian. Lo único que se refresca entre
// medias es el precio de la hora en curso.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { computarBarrido } from '../src/lib/marketCalc.js'
import { leerLlave, obtenerVelas } from './lib/velas.mjs'
import { escribir, yaCorrioEstaHora } from './lib/vigia-nucleo.mjs'
import { armarBarrido } from './lib/barrido-publicado.mjs'

const DATOS = process.env.VIGIA_DATOS || fileURLToPath(new URL('../../datos-local', import.meta.url))
const BARRIDO = `${DATOS}/estado/barrido.json`

const ahora = new Date()

// ⚠️ EL GUARDIÁN DE LA HORA, ANTES DE PEDIR PRECIOS. Desde el 2026-10-06 hay
// DOS relojes pulsando este botón —las 24 entradas de cron de GitHub y el reloj
// de fuera en Cloudflare—, así que sin esto correría hasta 47 veces al día: 329
// créditos de los 800 en vez de 168. El porqué y la asimetría («ante la duda,
// publicar») están en `vigia-nucleo.mjs`.
//
// ⚠️ Aquí la marca de tiempo NO sale de un archivo de estado —este guion no
// tiene— sino del `generadoEl` que el propio barrido publicado lleva dentro.
// Por eso el guardián recibe un texto y no un objeto de estado.
//
// 📌 Y sí, esto deja atrás el diseño de «dos oportunidades por hora» que tenía
// este publicador. Aquellas dos existían para cubrir los saltos del reloj de
// GitHub; lo que cubre un salto ahora es que haya DOS RELOJES independientes, y
// lo que de verdad hacía falta —una publicación por hora, puntual— es
// exactamente lo que queda.
const ultimoGeneradoEl = (() => {
  try {
    return JSON.parse(readFileSync(BARRIDO, 'utf8')).generadoEl
  } catch {
    return null // no hay barrido todavía, o está roto: se publica
  }
})()
if (process.env.SOLO_SI_FALTA_LA_HORA === '1' && yaCorrioEstaHora(ultimoGeneradoEl, ahora)) {
  console.log(`Esta hora ya se publicó (${ultimoGeneradoEl}). Este intento no hace nada.`)
  process.exit(0)
}

const { barras, rates, rangos } = await obtenerVelas(leerLlave())
const data = computarBarrido(barras, rates, rangos)
const barrido = armarBarrido(data, ahora)
const texto = JSON.stringify(barrido) + '\n'

escribir(BARRIDO, texto)

console.log(`Barrido publicado: ${ahora.toISOString()}`)
console.log(`Vela más reciente: ${data.ultima} UTC`)
console.log(`${barrido.pares.length} pares · ${(texto.length / 1024).toFixed(1)} KB`)
