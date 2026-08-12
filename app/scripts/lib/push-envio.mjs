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
// Los avisos están apagados a propósito; el porqué, con los números que lo
// justifican, está en ese archivo. Se comparte con la pantalla del interruptor
// para que la app no prometa avisos que no van a llegar.
import { AVISOS_PAUSADOS } from '../../src/lib/push/pausa.js'
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

// Cuánto se espera como mucho a CADA aviso. Como el presupuesto de abajo, se
// lee en cada llamada para que la prueba pueda bajarlo y no tardar diez
// segundos en comprobar que el corte funciona.
export const MS_POR_AVISO = 10_000

// Y cuánto puede durar el envío ENTERO.
//
// El límite por aviso no basta: cada aparato y cada señal son una petición
// aparte. Veinte aparatos con tres señales son sesenta peticiones, y si todas
// se fueran al límite la corrida duraría diez minutos. Como `vigia.yml` usa
// `concurrency` con `cancel-in-progress: false`, esa corrida haría cola con
// las siguientes y el vigía dejaría de vigilar.
//
// Al agotarse el presupuesto se deja de mandar y se anota cuántos quedaron
// sin avisar. Es la decisión correcta: perder unos avisos de esta hora es
// mucho menos grave que atascar todas las horas siguientes, y el vigía vuelve
// a intentarlo con las señales que sigan activas.
//
// Se lee en cada llamada, no al cargar el archivo, para que la prueba pueda
// bajarlo y comprobar que el corte funciona de verdad.
export const MS_PRESUPUESTO = 60_000

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
  // Lo PRIMERO, antes de leer credenciales o tocar Firestore: en pausa no se
  // manda nada y no hace falta nada. Se devuelve un estado con nombre propio
  // para que en el registro del vigía se vea que fue una decisión y no un
  // fallo silencioso. Ver el comentario de AVISOS_PAUSADOS en push/pausa.js.
  //
  // `PUSH_SIN_PAUSA` lo usa solo `prueba-push.mjs`, para poder seguir
  // comprobando el camino real de envío (cifrado, idiomas, cortes por tiempo,
  // limpieza de suscripciones muertas) mientras dura la pausa. Si esas
  // comprobaciones se apagaran ahora, al reactivar los avisos estaríamos
  // encendiendo código que lleva semanas sin probarse.
  if (AVISOS_PAUSADOS && entorno.PUSH_SIN_PAUSA !== '1') {
    return { estado: 'en-pausa', candidatas: nuevas.length, motivo: 'reglas en revisión tras medir las señales' }
  }

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
  let sinTiempo = 0
  const muertas = new Set()

  // A partir de aquí se corta, mande lo que se haya mandado.
  const seAcaba = Date.now() + Number(entorno.PUSH_MS_PRESUPUESTO || MS_PRESUPUESTO)
  const msPorAviso = Number(entorno.PUSH_MS_POR_AVISO || MS_POR_AVISO)

  for (const sub of suscripciones) {
    // Si el aparato ya se dio por muerto en la primera señal, no insistimos
    // con las demás.
    if (muertas.has(sub.ruta)) continue

    // Se sigue recorriendo (en vez de cortar) para poder contar exactamente
    // cuántos avisos quedaron sin intentar.
    if (Date.now() > seAcaba) {
      sinTiempo += dignas.length
      continue
    }

    for (const { s } of dignas) {
      if (Date.now() > seAcaba) {
        sinTiempo++
        continue
      }

      const mensaje = armarMensaje(s, sub.idioma || 'es')
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(mensaje),
          { timeout: msPorAviso }
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
    // Solo aparece si se acabó el tiempo, para que no sea un fallo silencioso:
    // si sale seguido, es que hay demasiados aparatos para el presupuesto.
    ...(sinTiempo ? { sinTiempo } : {}),
  }
}
