// Dobles para grabar los videos del curso (2026-11-19).
//
// ⚠️ TODO LO DE AQUÍ ES INVENTADO, y los videos lo dicen: un usuario de
// ejemplo con un perfil de 1.000 USD y unas operaciones de muestra en el
// Diario. Nunca operaciones ni datos reales de nadie: el repositorio es
// público. Lo del mercado (barrido, calendario, tasas…) sí es real: lo sirve
// `grabar.mjs` desde los archivos publicados.
import { useState } from 'react'
import { APP } from '../../src/lib/identidad.js'

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
// seguidas; `?diario=grupos` llena el Diario para «Tus números por grupos».
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

// La práctica guarda en memoria lo que se crea durante la grabación, para que
// el video enseñe la operación recién creada con los niveles REALES que puso
// la tarjeta del Analizador. Nada se escribe en Firestore.
export function usePractica() {
  const [ops, setOps] = useState([])
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
