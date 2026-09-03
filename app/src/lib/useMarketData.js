import { useEffect, useRef, useState } from 'react'
import { derivarVista } from './marketCalc'
import { useT } from './i18n'

// DE DÓNDE SALEN LOS PRECIOS.
//
// Hasta 2026-09-02 la app le pedía las velas a Twelve Data DESDE EL NAVEGADOR
// de cada persona. Ya no. Dos motivos, y ninguno se arreglaba con más código
// aquí dentro:
//
// 1. LA CLAVE VIAJABA DENTRO DE LA APP. Cualquiera que abriera la página podía
//    sacarla del JavaScript descargado y gastar la cuota. Es exactamente el
//    mismo agujero que ya se cerró con las credenciales de Capital.com, y por
//    el mismo camino: si el navegador es quien pregunta, el navegador tiene
//    que llevar la credencial encima.
//
// 2. EL TECHO DE SUSCRIPTORES. Cada apertura costaba 7 créditos de los 800
//    diarios del plan gratuito, y se repetían cada 15 minutos mientras la app
//    siguiera abierta. Una sola persona con la app abierta ocho horas gastaba
//    224 créditos: TRES personas agotaban el día. Y al agotarse, la app no
//    avisa de que se acabó la cuota: simplemente deja de traer precios.
//
// Ahora la consulta la hace el vigía —que corre en GitHub, donde la clave sí
// puede estar guardada— y publica el barrido YA CALCULADO en la rama `datos`.
// Esto se baja ese archivo. Da igual si lo abren dos personas o doscientas: el
// coste en créditos no depende de cuánta gente lo lea.
//
// ⚠️ QUÉ SE PIERDE, HONESTAMENTE: antes el precio de la hora EN CURSO se
// refrescaba cada 15 minutos; ahora depende de cada cuánto se publique, que
// son 30 minutos (`publicar-barrido.mjs` explica por qué 30 y no 15 ni 60).
// Ninguna señal cambia por eso: la app calcula sobre velas de una hora YA
// CERRADAS, y esas no se mueven. Y a cambio, abrir la app ya no puede fallar
// por cuota agotada, que era un fallo mucho peor y bastante más probable.
const URL_BARRIDO =
  'https://raw.githubusercontent.com/Nestor-forex/nestor-forex-intradia/datos/estado/barrido.json'

// v3: antes aquí se guardaban las velas crudas de Twelve Data; ahora se guarda
// el barrido ya calculado, que es otra cosa. Se cambia la clave para que una
// caché vieja no se lea como si fuera de las nuevas.
const CACHE_KEY = 'nfi_market_cache_v3'
const LIMITE_MS = 15_000
// Cada cuánto se vuelve a mirar si hay barrido nuevo mientras la app está
// abierta. Se mantienen los 15 minutos de antes: ahora es un archivo estático
// de 20 KB en vez de siete consultas a una API con cuota, así que mirar
// seguido no le cuesta nada a nadie. Se publica hasta tres veces por hora, así
// que mirar cada 15 minutos garantiza ver lo nuevo casi en cuanto aparece.
const REFRESCO_MS = 15 * 60 * 1000

function leerCache() {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY))
    if (cache?.barrido?.pares?.length && cache.guardadoEl) return cache
  } catch {
    // caché corrupta o bloqueada (modo privado), se ignora
  }
  return null
}

// Baja el barrido publicado. Si no hay internet, reutiliza la última copia
// guardada —aunque sea de días atrás— marcándola como vieja, para que la app
// siga sirviendo de algo sin señal.
async function obtenerBarrido() {
  try {
    const r = await fetch(URL_BARRIDO, {
      signal: AbortSignal.timeout(LIMITE_MS),
      cache: 'no-cache',
    })
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const barrido = await r.json()
    if (!barrido?.pares?.length) throw new Error('barrido vacío')

    const guardadoEl = barrido.generadoEl || new Date().toISOString()
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ guardadoEl, barrido }))
    } catch {
      // Sin espacio o en modo privado: da igual, es solo la copia de respaldo.
    }
    return { barrido, guardadoEl, stale: false }
  } catch (e) {
    const cache = leerCache()
    if (cache) return { barrido: cache.barrido, guardadoEl: cache.guardadoEl, stale: true }
    throw e
  }
}

// Baja (y refresca cada 15 min) el barrido publicado y arma la vista.
// thr = umbral de diferencial para clasificar sesgo, topN = setups por lado.
export function useMarketData({ thr = 0.5, topN = 3 } = {}) {
  const t = useT()
  const [loading, setLoading] = useState(true)
  // Se guarda el error SIN traducir y se traduce al devolverlo: si se guardara
  // ya traducido, al cambiar de idioma el mensaje se quedaría congelado en el
  // idioma anterior hasta la siguiente descarga.
  const [errorCrudo, setErrorCrudo] = useState(null)
  const [data, setData] = useState(null)
  const [stale, setStale] = useState(false)
  const [guardadoEl, setGuardadoEl] = useState(null)
  const primeraCarga = useRef(true)

  useEffect(() => {
    let cancelado = false

    const cargar = () => {
      // Solo la primera vez se enseña la pantalla de carga. En los refrescos
      // de después no: si no, la app parpadearía sola cada 15 minutos delante
      // de quien la esté mirando.
      if (primeraCarga.current) setLoading(true)
      obtenerBarrido()
        .then(({ barrido, guardadoEl, stale }) => {
          if (cancelado) return
          setData(barrido)
          setStale(stale)
          setGuardadoEl(guardadoEl)
          setErrorCrudo(null)
        })
        .catch((e) => {
          if (cancelado) return
          setErrorCrudo(e.message)
        })
        .finally(() => {
          if (!cancelado) {
            setLoading(false)
            primeraCarga.current = false
          }
        })
    }

    cargar()
    const id = setInterval(cargar, REFRESCO_MS)
    return () => {
      cancelado = true
      clearInterval(id)
    }
  }, [])

  // `derivarVista` se sigue ejecutando aquí y no en el vigía porque necesita
  // el idioma de cada persona, y eso el servidor no lo sabe.
  const vista = data ? derivarVista(data, { thr, topN, t }) : null

  return {
    loading,
    error: errorCrudo ? t('barrido.errorPrecios', { detalle: errorCrudo }) : null,
    // Ya no existe el estado "sin configurar": no hace falta ninguna clave en
    // el navegador. Se sigue devolviendo en `false` para no obligar a tocar
    // todas las pantallas que lo leen.
    sinConfigurar: false,
    stale,
    guardadoEl,
    ultima: data?.ultima ?? null,
    ratesUSD: data?.ratesUSD ?? null,
    monedas: vista?.monedas ?? [],
    pares: vista?.pares ?? [],
    compras: vista?.compras ?? [],
    ventas: vista?.ventas ?? [],
    vigilancia: vista?.vigilancia ?? [],
    rangos: vista?.rangos ?? [],
    sesion: vista?.sesion ?? null,
    setups: vista?.setups ?? [],
    corte: vista?.corte ?? '…',
  }
}
