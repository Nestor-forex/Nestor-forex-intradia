// Dobles para grabar los videos del curso (2026-11-19).
//
// ⚠️ TODO LO DE AQUÍ ES INVENTADO, y los videos lo dicen: un usuario de
// ejemplo con un perfil de 1.000 USD y unas operaciones de muestra en el
// Diario. Nunca operaciones ni datos reales de nadie: el repositorio es
// público. Lo del mercado (barrido, calendario, tasas…) sí es real: lo sirve
// `grabar.mjs` desde los archivos publicados.
import { useState } from 'react'
import { APP } from '../../src/lib/identidad.js'
import { conPlantilla, leerPlantillas, sinPlantilla } from '../../src/lib/analizador.js'
import { leerEstilo } from '../../src/lib/estilo.js'

const hoy = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const params = () => new URLSearchParams(location.search)

export function useAuthUser() {
  const sinPerfil = params().get('perfil') === 'no'
  const perfil = {
    nombre: 'Ejemplo',
    estado: 'aprobado',
    curso: [],
    estilo: 'tendencias',
    ...(sinPerfil ? {} : { perfilRiesgo: { capital: 1000, riesgoPct: 1, limiteDiarioPct: 3, maxPerdidasSeguidas: 3 } }),
    // `?pares=ejemplo`: una lista de pares y dos avisos de MUESTRA, para los
    // videos de «Mis pares» y «Mis avisos». Los avisos son de indicador (RSI y
    // %B) a propósito: un nivel de precio inventado no cuadraría con el
    // precio real del día de la grabación.
    ...(params().get('pares') === 'ejemplo'
      ? {
          seguimiento: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD'],
          avisos: [
            { id: 'a1', par: 'GBP/USD', tipo: 'rsi', lado: 'arriba', nivel: 70, activa: true, creadoEl: new Date().toISOString(), app: APP },
            { id: 'a2', par: 'USD/JPY', tipo: 'banda', lado: 'abajo', nivel: 0, activa: true, creadoEl: new Date().toISOString(), app: APP },
          ],
        }
      : {}),
  }
  return {
    authUser: { uid: 'ejemplo', email: 'ejemplo@ejemplo.com' },
    cargandoAuth: false,
    perfil,
    perfilEstado: 'aprobado',
    esAdmin: false,
    registrar: async () => ({ ok: false }),
    ingresar: async () => ({ ok: false }),
    salir: () => {},
  }
}

// Operaciones de MUESTRA. `?diario=freno` deja el día de hoy con dos pérdidas
// seguidas; `?diario=grupos` llena el Diario para «Tus números por grupos»;
// `?diario=juntas` deja dos abiertas con el euro en común (módulo 8);
// `?diario=chequeo` junta las dos cosas: dos pérdidas hoy y dos abiertas con
// el euro (módulo 9, revisar la tarjeta antes de decidir).
function muestra() {
  const modo = params().get('diario')
  const d = hoy()
  const ahora = Date.now()
  if (modo === 'freno') {
    return [
      { id: 'f2', par: 'GBP/USD', dir: 'Compra', lote: 0.03, pl: -10, estado: 'cerrada', fecha: d, cerradaEl: d, cerradaEnMs: ahora - 3600e3, nota: 'Ejemplo' },
      { id: 'f1', par: 'EUR/USD', dir: 'Venta', lote: 0.04, pl: -10, estado: 'cerrada', fecha: d, cerradaEl: d, cerradaEnMs: ahora - 7200e3, nota: 'Ejemplo' },
    ]
  }
  if (modo === 'chequeo') {
    return [
      { id: 'c4', par: 'EUR/CHF', dir: 'Compra', lote: 0.03, pl: 0, estado: 'abierta', fecha: d, nota: 'Ejemplo' },
      { id: 'c3', par: 'EUR/CAD', dir: 'Compra', lote: 0.03, pl: 0, estado: 'abierta', fecha: d, nota: 'Ejemplo' },
      { id: 'c2', par: 'GBP/USD', dir: 'Compra', lote: 0.03, pl: -10, estado: 'cerrada', fecha: d, cerradaEl: d, cerradaEnMs: ahora - 3600e3, nota: 'Ejemplo' },
      { id: 'c1', par: 'USD/JPY', dir: 'Venta', lote: 0.04, pl: -10, estado: 'cerrada', fecha: d, cerradaEl: d, cerradaEnMs: ahora - 7200e3, nota: 'Ejemplo' },
    ]
  }
  if (modo === 'juntas') {
    // Dos operaciones abiertas que comparten el euro: el aviso de «Riesgo
    // concentrado» del Diario (módulo 8). Ejemplo, no datos de nadie.
    return [
      { id: 'j2', par: 'EUR/CHF', dir: 'Compra', lote: 0.03, pl: 0, estado: 'abierta', fecha: d, nota: 'Ejemplo' },
      { id: 'j1', par: 'EUR/USD', dir: 'Compra', lote: 0.03, pl: 0, estado: 'abierta', fecha: d, nota: 'Ejemplo' },
    ]
  }
  if (modo === 'grupos') {
    const pares = ['EUR/USD', 'USD/JPY', 'EUR/USD', 'GBP/JPY', 'EUR/CHF', 'USD/CAD', 'EUR/USD', 'AUD/USD', 'USD/JPY']
    // 9 operaciones, 7 ganadas: «78 %», que con tan pocas no dice nada.
    const pl = [12, 9, -10, 14, 8, 11, -10, 10, 13]
    return pares.map((par, i) => {
      const f = new Date(ahora - (i + 1) * 86400e3)
      const dia = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
      return { id: `g${i}`, par, dir: i % 3 ? 'Compra' : 'Venta', lote: 0.03, pl: pl[i], estado: 'cerrada', fecha: dia, cerradaEl: dia, cerradaEnMs: f.getTime(), nota: 'Ejemplo' }
    })
  }
  return []
}

export function useTrades() {
  const [trades] = useState(muestra)
  return { trades, cargando: false, guardar: async () => {}, borrar: async () => {}, cerrar: async () => {} }
}

// `?practica=ejemplo`: operaciones de práctica de MUESTRA, ya resueltas, para
// los videos del módulo 10 (leer el resultado en R, el spread y el swap, y el
// ± de pocas operaciones). Cinco resueltas (3 ganadas, 2 perdidas), una
// caducada y una abierta. Los precios son INVENTADOS y el video lo dice: no
// cuadran con el mercado del día de la grabación, y por eso esos videos no
// abren su gráfica.
function practicaEjemplo() {
  const ahora = Date.now()
  const dia = 86400e3
  // La vela en que se resolvió, en el formato de cada app (UTC): el día en
  // Swing, la hora en Intradía.
  const vela = (ms) => {
    const iso = new Date(ms).toISOString()
    return APP === 'swing' ? iso.slice(0, 10) : `${iso.slice(0, 13).replace('T', ' ')}:00:00`
  }
  const op = (id, diasAtras, duracionDias, x) => {
    const creado = ahora - diasAtras * dia
    return { id, app: APP, metodo: 'app', creado: { toMillis: () => creado }, vela: vela(creado), velaResuelta: x.estado === 'ganada' || x.estado === 'perdida' ? vela(creado + duracionDias * dia) : undefined, ...x }
  }
  return [
    op('e7', 0.2, 0, { par: 'USD/CAD', lado: 'COMPRA', entrada: 1.38, sl: 1.376, tp: 1.386, fuente: 'twelve', spread: 1.6 }),
    op('e6', 3, 0, { par: 'NZD/USD', lado: 'VENTA', entrada: 0.592, sl: 0.5955, tp: 0.5865, estado: 'caducada', fuente: 'twelve', spread: 2.1 }),
    op('e5', 5, 1, { par: 'EUR/CHF', lado: 'COMPRA', entrada: 0.935, sl: 0.932, tp: 0.9386, estado: 'ganada', r: 1.2, fuente: 'mt5', spread: 1.8, swap: -0.4, swap3: 3, riesgoUsd: 10, lote: 0.03 }),
    op('e4', 7, 2, { par: 'AUD/USD', lado: 'VENTA', entrada: 0.655, sl: 0.6585, tp: 0.6515, estado: 'perdida', r: -1, fuente: 'twelve', spread: 1.6, swap: -0.3, swap3: 3, riesgoUsd: 10, lote: 0.03 }),
    op('e3', 9, 1, { par: 'USD/JPY', lado: 'COMPRA', entrada: 150, sl: 149.6, tp: 150.4, estado: 'ganada', r: 1, fuente: 'twelve', spread: 1.4, riesgoUsd: 10, lote: 0.04 }),
    op('e2', 11, 1, { par: 'GBP/USD', lado: 'VENTA', entrada: 1.27, sl: 1.274, tp: 1.264, estado: 'perdida', r: -1, fuente: 'mt5', spread: 1.5, swap: 0.2, swap3: 3, riesgoUsd: 10, lote: 0.03 }),
    op('e1', 13, 2, { par: 'EUR/USD', lado: 'COMPRA', entrada: 1.1, sl: 1.097, tp: 1.1045, estado: 'ganada', r: 1.5, fuente: 'twelve', spread: 1.2, swap: -0.6, swap3: 3, riesgoUsd: 10, lote: 0.03 }),
  ]
}

// La práctica guarda en memoria lo que se crea durante la grabación, para que
// el video enseñe la operación recién creada con los niveles REALES que puso
// la tarjeta del Analizador. Nada se escribe en Firestore.
export function usePractica() {
  const [ops, setOps] = useState(() => (params().get('practica') === 'ejemplo' ? practicaEjemplo() : []))
  const crear = async (op) => {
    const ahora = Date.now()
    setOps((x) => [{ ...op, id: `p${x.length + 1}`, creado: { toMillis: () => ahora } }, ...x])
    return 'ok'
  }
  const borrar = async (id) => setOps((x) => x.filter((o) => o.id !== id))
  return { ops, cargando: false, crear, borrar, abiertas: ops.filter((o) => !o.estado).length }
}

export function useMembers() {
  return { usuarios: [], cargando: false, aprobar: async () => {}, retirar: async () => {}, fijarVence: async () => {} }
}

// Las plantillas y el estilo se guardan EN MEMORIA durante la grabación
// (módulo 9): el video enseña cómo se guardan y se aplican sin escribir nada
// en Firestore. `?plantillas=ejemplo` arranca con dos de MUESTRA.
const PLANTILLAS_EJEMPLO = [
  { nombre: 'Mi tendencia', herramientas: ['tendencia', 'medias', 'fuerza', 'atr'], metodo: 'app' },
  { nombre: 'Rangos con RSI', herramientas: ['niveles', 'rsi', 'bollinger', 'atr'], metodo: 'estructura' },
]
export function usePlantillas() {
  const [plantillas, setPl] = useState(() => leerPlantillas(params().get('plantillas') === 'ejemplo' ? PLANTILLAS_EJEMPLO : []))
  return {
    plantillas,
    puedoEscribir: true,
    async guardar(pl) {
      const r = conPlantilla(plantillas, pl)
      if (!r.ok) return r
      setPl(r.lista)
      return { ok: true }
    },
    async borrar(nombre) {
      setPl(sinPlantilla(plantillas, nombre))
      return { ok: true }
    },
  }
}

export function useEstilo(uid, ficha) {
  const [estilo, setEstilo] = useState(() => leerEstilo(ficha?.estilo))
  return {
    estilo,
    sabido: true,
    puedoEscribir: true,
    async guardar(nuevo) {
      const e = leerEstilo(nuevo)
      if (!e) return { ok: false, codigo: 'noValido' }
      setEstilo(e)
      return { ok: true }
    },
  }
}
