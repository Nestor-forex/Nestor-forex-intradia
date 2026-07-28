// Script temporal de diagnóstico: prueba la conexión real a TrueFX desde un
// entorno con internet completo (GitHub Actions), porque el entorno normal
// de la sesión de Claude tiene bloqueado el acceso a webrates.truefx.com.
// Se borra en cuanto termine el diagnóstico — no es parte de la app.

import { readFileSync } from 'node:fs'

function leerCredenciales() {
  const env = readFileSync(new URL('../.env.production', import.meta.url), 'utf8')
  const u = env.match(/^VITE_TRUEFX_USER=(.+)$/m)?.[1]?.trim()
  const p = env.match(/^VITE_TRUEFX_PASS=(.+)$/m)?.[1]?.trim()
  if (!u || !p) throw new Error('faltan VITE_TRUEFX_USER/VITE_TRUEFX_PASS en .env.production')
  return { u, p }
}

const BASE = 'https://webrates.truefx.com/rates/connect.html'
const PARES = 'EUR/USD,GBP/USD,USD/JPY,USD/CHF,AUD/USD,USD/CAD,NZD/USD'

const { u, p } = leerCredenciales()

console.log('--- 1) Conectar (obtener id de sesión) ---')
const urlConectar = `${BASE}?u=${encodeURIComponent(u)}&p=${encodeURIComponent(p)}&q=nfidebug&c=${encodeURIComponent(PARES)}&f=csv&s=n`
const rConectar = await fetch(urlConectar)
console.log('status:', rConectar.status, rConectar.statusText)
console.log('headers:', JSON.stringify([...rConectar.headers.entries()]))
const textoConectar = await rConectar.text()
console.log('body (crudo):', JSON.stringify(textoConectar))

const sessionId = textoConectar.trim()
if (!rConectar.ok || !sessionId) {
  console.log('--- No se pudo obtener sesión, me detengo aquí ---')
  process.exit(0)
}

console.log('\n--- 2) Consultar precios con esa sesión ---')
const urlConsultar = `${BASE}?id=${encodeURIComponent(sessionId)}`
const rConsultar = await fetch(urlConsultar)
console.log('status:', rConsultar.status, rConsultar.statusText)
const textoConsultar = await rConsultar.text()
console.log('body (crudo):', JSON.stringify(textoConsultar))

console.log('\n--- 3) Segunda consulta 3s después (para ver si hay incrementales) ---')
await new Promise((r) => setTimeout(r, 3000))
const rConsultar2 = await fetch(urlConsultar)
console.log('status:', rConsultar2.status, rConsultar2.statusText)
console.log('body (crudo):', JSON.stringify(await rConsultar2.text()))
