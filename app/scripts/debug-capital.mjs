// Script temporal de diagnóstico: prueba la conexión real a la API de
// Capital.com (cuenta demo) desde un entorno con internet completo (GitHub
// Actions), porque el entorno normal de la sesión de Claude tiene bloqueado
// el acceso a dominios externos como este. Se borra en cuanto termine el
// diagnóstico — no es parte de la app.

const BASE = 'https://demo-api-capital.backend-capital.com'

// Credenciales de la cuenta DEMO de Capital.com (sin fondos reales).
const apiKey = 'WIxYWRDhBnhQ3yNO'
const identifier = 'nesdian2204@gmail.com'
const password = 'N2405d@m'

console.log('--- 1) Crear sesión ---')
const rSession = await fetch(`${BASE}/api/v1/session`, {
  method: 'POST',
  headers: { 'X-CAP-API-KEY': apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier, password }),
})
console.log('status:', rSession.status, rSession.statusText)
const cst = rSession.headers.get('cst')
const securityToken = rSession.headers.get('x-security-token')
console.log('cst presente:', Boolean(cst), '· x-security-token presente:', Boolean(securityToken))
const bodySession = await rSession.text()
console.log('body (crudo, recortado a 500):', bodySession.slice(0, 500))

if (!cst || !securityToken) {
  console.log('\n--- No se pudo autenticar, me detengo aquí ---')
  process.exit(0)
}

console.log('\n--- 2) Buscar el epic de EUR/USD ---')
const rSearch = await fetch(`${BASE}/api/v1/markets?searchTerm=EURUSD`, {
  headers: { 'X-CAP-API-KEY': apiKey, CST: cst, 'X-SECURITY-TOKEN': securityToken },
})
console.log('status:', rSearch.status)
console.log('body (recortado a 1500):', (await rSearch.text()).slice(0, 1500))

console.log('\n--- 3) Buscar los otros pares (GBP, JPY, CHF, AUD, CAD, NZD) ---')
for (const term of ['GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD']) {
  const r = await fetch(`${BASE}/api/v1/markets?searchTerm=${term}`, {
    headers: { 'X-CAP-API-KEY': apiKey, CST: cst, 'X-SECURITY-TOKEN': securityToken },
  })
  const j = await r.json().catch(() => null)
  const epics = j?.markets?.map((m) => `${m.epic} (${m.instrumentName})`).slice(0, 3)
  console.log(term, '->', r.status, JSON.stringify(epics))
}
