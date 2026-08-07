// Manda los avisos al celular cuando el vigía ve una señal nueva.
//
// El aviso NO pasa por ningún servidor nuestro: va de GitHub Actions directo
// al servicio de push de Apple o de Google, cifrado con las claves que dio el
// navegador de cada persona. Nosotros no podemos leerlo ni ellos tampoco.
//
// Nada de lo que hay aquí puede tumbar al vigía: si los avisos fallan, su
// trabajo principal —anotar el historial de señales— ya está hecho. Por eso
// el que llama envuelve todo esto en un try y sigue.

import webpush from 'web-push'
import { crearT } from '../../src/lib/i18n/crearT.js'
import { VAPID_PUBLICA } from '../../src/lib/push/vapid.js'
import { abrir, leerCuentaDeServicio } from './firestore-rest.mjs'

export const COLECCION = 'pushSubs'

// De qué app son las suscripciones que nos tocan. Los dos repos comparten
// proyecto de Firebase, así que el vigía de intradía no debe escribirle a los
// aparatos suscritos a la app de swing.
export const APP = 'intradia'

// Por debajo de esta relación riesgo/beneficio no se avisa. No es que la
// señal sea inválida: es que no vale la pena que suene el celular por ella.
// La app ya marca en ámbar todo lo que baje de 1:1.5, así que este número
// dice lo mismo que la pantalla de detalle.
export const RB_MINIMO = Number(process.env.PUSH_RB_MINIMO || 1.5)

// Los servicios de push contestan esto cuando la suscripción ya no sirve
// (la persona desinstaló la app, borró los datos del navegador, etc.).
const MUERTA = new Set([404, 410])

// Arma el aviso en el idioma de quien lo va a recibir. Los términos de
// trading (SL, TP, R/B) no se traducen, igual que en el resto de la app.
export function armarMensaje(senal, idioma) {
  const t = crearT(idioma)
  const c = senal.crudo
  const rango = senal.tipo === 'rango' ? ` · ${t('setup.badgeRango')}` : ''

  return {
    titulo: `${senal.name} ${t('lado.' + senal.lado)}${rango}`,
    cuerpo:
      `${t('setup.entrada')} ${c.precio.toFixed(c.dec)} · ` +
      `SL ${c.sl.toFixed(c.dec)} · TP ${c.tp.toFixed(c.dec)} · ` +
      `${t('setup.rb')} 1:${c.rr.toFixed(1)}`,
    // Mismo identificador que usa el vigía para decidir qué es nuevo: si por
    // lo que sea llegara repetido, el segundo reemplaza al primero.
    tag: `${senal.name}|${senal.lado}|${senal.tipo}`,
    // Abre la app directo en el detalle de esa señal.
    url: `./?par=${encodeURIComponent(senal.name)}&lado=${encodeURIComponent(senal.lado)}`,
    en: new Date().toISOString(),
  }
}

/**
 * Envía un aviso por cada señal nueva a cada aparato suscrito.
 *
 * Devuelve un resumen con números, nunca con direcciones de envío: esas son
 * credenciales y no deben acabar en los logs de GitHub, que son públicos.
 *
 * `bdInyectada` existe solo para `scripts/prueba-push.mjs`: permite probar
 * todo el camino —filtro, idiomas, cifrado, envío y limpieza— sin tocar el
 * Firestore de verdad. En producción va siempre en null.
 */
export async function enviarAvisos(nuevas, entorno = process.env, bdInyectada = null) {
  const dignas = nuevas.filter(({ s }) => s.crudo && s.crudo.rr >= RB_MINIMO)
  if (!dignas.length) {
    return { estado: 'nada-que-enviar', candidatas: nuevas.length, filtradas: nuevas.length }
  }

  const cuenta = bdInyectada ? {} : leerCuentaDeServicio(entorno)
  const privada = (entorno.VAPID_PRIVATE_KEY || '').trim()

  if (!cuenta || !privada) {
    return { estado: 'sin-configurar', candidatas: dignas.length }
  }

  webpush.setVapidDetails(
    `mailto:${entorno.VAPID_CONTACTO || 'nesdian2204@gmail.com'}`,
    VAPID_PUBLICA,
    privada
  )

  const bd = bdInyectada || (await abrir(cuenta))
  const suscripciones = (await bd.listar(COLECCION)).filter((s) => s.app === APP && s.endpoint)

  if (!suscripciones.length) {
    return { estado: 'sin-suscriptores', candidatas: dignas.length }
  }

  let enviados = 0
  let fallidos = 0
  const muertas = new Set()

  for (const sub of suscripciones) {
    // Si el aparato ya se dio por muerto en la primera señal, no insistimos
    // con las demás.
    if (muertas.has(sub.ruta)) continue

    for (const { s } of dignas) {
      const mensaje = armarMensaje(s, sub.idioma || 'es')
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(mensaje)
        )
        enviados++
      } catch (e) {
        if (MUERTA.has(e?.statusCode)) {
          muertas.add(sub.ruta)
          break
        }
        fallidos++
        // Se dice el código, no el error entero: algunos servicios devuelven
        // la dirección de envío dentro del mensaje de error.
        console.log(`  aviso no entregado (código ${e?.statusCode ?? '?'})`)
      }
    }
  }

  // Las suscripciones muertas se borran para que no se acumulen y para no
  // gastar tiempo en ellas cada hora.
  let limpiadas = 0
  for (const ruta of muertas) {
    if (await bd.borrar(ruta)) limpiadas++
  }

  return {
    estado: 'enviado',
    candidatas: dignas.length,
    filtradas: nuevas.length - dignas.length,
    suscripciones: suscripciones.length,
    enviados,
    fallidos,
    limpiadas,
  }
}
