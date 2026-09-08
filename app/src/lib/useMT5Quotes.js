import { useEffect, useState } from 'react'
// Con extensión `.js`: Vite lo resuelve sin ella, pero Node no, y
// `scripts/prueba-mt5.mjs` importa este archivo desde Node.
import { PAIR_NAMES } from './pairs.js'

// EL SPREAD REAL DEL BRÓKER, vía el puente de MetaTrader 5.
//
// Esto es información que la app NUNCA tuvo: el barrido trabaja con velas
// (máximo, mínimo y cierre), y ahí no está lo que de verdad cuesta abrir una
// operación. El spread sale de la diferencia entre el precio al que te compran
// y el precio al que te venden, y eso solo lo sabe el bróker.
//
// ⚠️ EL PUENTE ES UNO Y SIRVE A LAS DOS APPS. Publica los 18 pares (los 14 de
// Swing más los 4 que solo usa Intradía) en la rama `datos` del repositorio de
// Swing, que es donde vive `puente-mt5/bridge_mt5.py`. Por eso esta dirección
// es la MISMA en las dos apps —y este archivo es gemelo exacto—: cada una
// filtra sus pares con su propio `PAIR_NAMES`. Dos puentes serían dos
// programas que Néstor tendría que arrancar cada mañana.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ CAMBIÓ DE RAÍZ EL 2026-09-08, Y CONVIENE ENTENDER POR QUÉ
// ─────────────────────────────────────────────────────────────────────────
// La versión anterior pedía `GET {VITE_API_URL}/quotes` a un servidor. Nunca
// funcionó en producción, y no por un descuido:
//
//  · `VITE_API_URL` valía `http://127.0.0.1:8000`, que es «este mismo
//    aparato» — o sea el teléfono de quien abre la app, donde no hay nada.
//  · Y aunque hubiera apuntado a un servidor de verdad con `http://`, el
//    navegador lo habría BLOQUEADO: una página servida por HTTPS no puede
//    llamar a una dirección sin cifrar. Se llama bloqueo de contenido mixto y
//    no se puede desactivar desde la página.
//
// Ahora el puente **publica** en la rama `datos` y la app **lee un archivo**,
// exactamente igual que con el barrido. Sin servidor: no hay contraseñas que
// guardar, ni puertos que abrir, ni un servicio que pagar y vigilar.
const URL_MT5 =
  'https://raw.githubusercontent.com/Nestor-forex/Nestor-forex/datos/estado/mt5.json'

// Cada dos minutos. El puente publica cada quince, así que pedirlo más a
// menudo sería gastar batería para releer lo mismo.
const CADA_MS = 120_000
const LIMITE_MS = 12_000

const pipDe = (par) => (par.includes('JPY') ? 0.01 : 0.0001)

// El puente ya manda el spread calculado, pero se vuelve a sacar del bid y el
// ask cuando se puede.
//
// No es desconfianza: es que así **una sola línea de este proyecto** decide
// qué es un pip. Si el día de mañana se cambia el criterio para algún par, se
// cambia aquí y no hay que acordarse de que había otro número viajando dentro
// del archivo.
export function normalizarRespuesta(json) {
  const pares = json?.pares
  if (!pares || typeof pares !== 'object') return {}

  const salida = {}
  for (const [par, v] of Object.entries(pares)) {
    if (!v || typeof v !== 'object') continue

    const bid = Number(v.bid)
    const ask = Number(v.ask)
    if (!Number.isFinite(bid) || !Number.isFinite(ask)) continue

    const calculado = (ask - bid) / pipDe(par)
    salida[par] = {
      par,
      bid,
      ask,
      spread: Number.isFinite(calculado) ? calculado : Number(v.spread),
      // Cuántas veces cambió el precio hoy, según ESTE bróker.
      // ⚠️ NO es volumen real. En Forex no existe: no hay bolsa central que lo
      // apunte, así que nadie tiene el total, ni nosotros ni quien lo venda
      // como «volumen». Quien lo pinte tiene que rotularlo por lo que es.
      ticks: Number.isFinite(Number(v.ticks)) ? Number(v.ticks) : null,
      dec: par.includes('JPY') ? 3 : 5,
    }
  }
  return salida
}

// ¿Hace cuánto se tomó esta foto, en minutos? `null` si no se sabe.
//
// ⚠️ El `typeof` no sobra, y lo cazó la prueba: `new Date(null)` NO es una
// fecha inválida en JavaScript — es el 1 de enero de 1970. Sin esta línea, un
// archivo sin `actualizadoEl` no daba «no lo sé» sino «hace 29 millones de
// minutos», que en pantalla sale como un aviso de foto vieja perfectamente
// convincente y completamente inventado.
export function minutosDesde(iso, ahora = new Date()) {
  if (typeof iso !== 'string') return null
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return null
  return Math.max(0, Math.round((ahora.getTime() - ms) / 60_000))
}

// Devuelve los precios del bróker y en qué estado está el puente.
//
//   estado: 'cargando' | 'ok' | 'sin-datos'
//   quotes: { 'EUR/USD': { bid, ask, spread, ticks, dec }, … }
//   cuenta: de quién es esta cuenta, para poder rotularlo en pantalla
//
// ⚠️ NO HAY ESTADO DE ERROR, y es a propósito. Si el archivo no se puede bajar
// se queda en 'sin-datos', que es lo mismo que ve alguien cuyo puente está
// apagado — y esa es la situación normal, no una avería. Un mensaje rojo por
// esto asustaría por algo que no impide operar.
export function useMT5Quotes({ pares = PAIR_NAMES, activo = true } = {}) {
  const [quotes, setQuotes] = useState({})
  const [estado, setEstado] = useState('cargando')
  const [actualizadoEl, setActualizadoEl] = useState(null)
  const [cuenta, setCuenta] = useState(null)

  useEffect(() => {
    if (!activo) return
    let cancelado = false

    const pedir = async () => {
      // Con la app en segundo plano no se pide nada: es batería y datos
      // gastados mirando una pantalla que nadie tiene delante.
      if (document.visibilityState === 'hidden') return
      try {
        const r = await fetch(URL_MT5, { signal: AbortSignal.timeout(LIMITE_MS), cache: 'no-cache' })
        if (!r.ok) throw new Error('HTTP ' + r.status)
        const json = await r.json()
        if (cancelado) return

        const todas = normalizarRespuesta(json)
        const filtradas = {}
        for (const p of pares) if (todas[p]) filtradas[p] = todas[p]

        setQuotes(filtradas)
        setActualizadoEl(json?.actualizadoEl ?? null)
        setCuenta(typeof json?.cuenta === 'string' ? json.cuenta : null)
        setEstado(Object.keys(filtradas).length ? 'ok' : 'sin-datos')
      } catch {
        if (!cancelado) setEstado((e) => (e === 'ok' ? 'ok' : 'sin-datos'))
      }
    }

    pedir()
    const temporizador = setInterval(pedir, CADA_MS)
    // Al volver a la app se pide de inmediato en vez de esperar dos minutos.
    document.addEventListener('visibilitychange', pedir)

    return () => {
      cancelado = true
      clearInterval(temporizador)
      document.removeEventListener('visibilitychange', pedir)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `pares` es una lista fija; compararla por identidad reiniciaría el sondeo en cada render
  }, [activo])

  return { quotes, estado, actualizadoEl, cuenta }
}
