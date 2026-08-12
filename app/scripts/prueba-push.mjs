// Prueba de los avisos al celular, sin tocar nada de verdad.
//
// Levanta un servidor local que hace de servicio de push (el de Apple o el de
// Google) y le inyecta una base de datos falsa, así que se puede correr sin
// internet, sin claves reales y sin gastar cuota:
//
//     node scripts/prueba-push.mjs
//
// Lo que comprueba:
//   1. El texto del aviso, en varios idiomas.
//   2. Que las señales con R/B pobre NO despierten el celular.
//   3. Que el aviso salga de verdad, cifrado y firmado (VAPID).
//   4. Que una suscripción muerta se borre en vez de reintentarse.
//   5. Que sin claves configuradas no reviente nada.

import { createServer } from 'node:https'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateKeyPairSync, randomBytes } from 'node:crypto'
import { armarMensaje, enviarAvisos } from './lib/push-envio.mjs'

let fallos = 0
const comprobar = (bien, que) => {
  console.log(`  ${bien ? '✓' : '✗'} ${que}`)
  if (!bien) fallos++
}

// Una señal como las que arma marketCalc, con lo justo que usa el aviso.
const senal = (name, lado, rr, tipo = 'tendencia') => ({
  s: {
    name,
    lado,
    tipo,
    crudo: { precio: 1.08423, sl: 1.08181, tp: 1.09025, rr, dec: 5 },
  },
})

// Un aparato suscrito, con claves como las que da un navegador de verdad.
function aparatoFalso(endpoint, idioma = 'es') {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const b64u = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return {
    ruta: `proyectos/x/documentos/pushSubs/${endpoint.split('/').pop()}`,
    endpoint,
    idioma,
    app: 'intradia',
    p256dh: b64u(publicKey.export({ format: 'der', type: 'spki' }).subarray(-65)),
    auth: b64u(randomBytes(16)),
    // `privateKey` no se usa: descifrar el aviso exigiría implementar el
    // RFC 8291 entero. Basta con que el cifrado no reviente y con que el
    // servidor reciba la petición bien formada.
    _sinUsar: privateKey,
  }
}

console.log('\n1. El texto del aviso')
{
  const s = senal('EUR/USD', 'COMPRA', 2.5).s
  const es = armarMensaje(s, 'es')
  const en = armarMensaje(s, 'en')
  const ja = armarMensaje(s, 'ja')

  console.log(`     es → ${es.titulo} | ${es.cuerpo}`)
  console.log(`     en → ${en.titulo} | ${en.cuerpo}`)
  console.log(`     ja → ${ja.titulo} | ${ja.cuerpo}`)

  comprobar(es.titulo.includes('COMPRA'), 'en español dice COMPRA')
  comprobar(en.titulo.includes('BUY'), 'en inglés dice BUY')
  comprobar(es.cuerpo.includes('SL') && es.cuerpo.includes('TP'), 'SL y TP no se traducen')
  comprobar(es.cuerpo.includes('1:2.5'), 'lleva la relación riesgo/beneficio')
  comprobar(es.url.includes('par=EUR%2FUSD') && es.url.includes('lado=COMPRA'), 'la dirección abre esa señal')
  comprobar(armarMensaje({ ...s, tipo: 'rango' }, 'es').titulo.includes('Rango'), 'marca los de rango')
}

// ---------------------------------------------------------------------------

// El servidor de mentira tiene que hablar HTTPS: `web-push` se niega a mandar
// nada por HTTP plano, y hace bien —el aviso lleva credenciales del aparato—.
// El certificado se genera aquí y se tira al terminar; no queda nada guardado.
const carpeta = mkdtempSync(join(tmpdir(), 'prueba-push-'))
execFileSync('openssl', [
  'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
  '-subj', '/CN=127.0.0.1',
  '-addext', 'subjectAltName=IP:127.0.0.1',
  '-keyout', join(carpeta, 'llave.pem'),
  '-out', join(carpeta, 'cert.pem'),
], { stdio: 'ignore' })

// Node tiene que fiarse de ese certificado inventado. Se hace por variable de
// entorno y solo dentro de esta prueba: nunca en el vigía de verdad.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const recibidas = []
let respuesta = 201
const servidor = createServer({
  key: readFileSync(join(carpeta, 'llave.pem')),
  cert: readFileSync(join(carpeta, 'cert.pem')),
}, (req, res) => {
  // Un servicio de push que acepta la conexión y luego no contesta nunca. Es
  // el caso peligroso: sin plazo, el envío se queda esperando para siempre.
  if (req.url.includes('mudo')) return
  const trozos = []
  req.on('data', (c) => trozos.push(c))
  req.on('end', () => {
    recibidas.push({ url: req.url, cabeceras: req.headers, bytes: Buffer.concat(trozos).length })
    res.writeHead(respuesta)
    res.end()
  })
})
await new Promise((listo) => servidor.listen(0, '127.0.0.1', listo))
const base = `https://127.0.0.1:${servidor.address().port}`

// `PUSH_SIN_PAUSA` salta la pausa de los avisos (ver AVISOS_PAUSADOS en
// src/lib/push/pausa.js). Va en TODAS las pruebas del camino de envío a
// propósito: mientras los avisos estén apagados hay que seguir comprobando que
// el código funciona, o el día que se reactiven estaríamos encendiendo algo que
// lleva semanas sin probarse. La pausa en sí se comprueba aparte, en el punto 8.
const ENTORNO = { VAPID_PRIVATE_KEY: '9Ah-93imAiVXw1xoJnC-cuiA14U0JjwVxHuC7lHhKOc', PUSH_SIN_PAUSA: '1' }
const borrados = []
const bdFalsa = (aparatos) => ({
  listar: async () => aparatos,
  borrar: async (ruta) => (borrados.push(ruta), true),
})

console.log('\n2. El filtro de calidad')
{
  const r = await enviarAvisos(
    [senal('EUR/USD', 'COMPRA', 2.5), senal('GBP/JPY', 'VENTA', 0.9)],
    ENTORNO,
    bdFalsa([aparatoFalso(`${base}/aparato-1`)])
  )
  comprobar(r.filtradas === 1, 'la señal con R/B 0.9 no despierta el celular')
  comprobar(r.enviados === 1, 'la de R/B 2.5 sí se manda')
}

console.log('\n3. El aviso sale cifrado y firmado')
{
  const ult = recibidas.at(-1)
  comprobar(Boolean(ult), 'el servicio de push recibió la petición')
  comprobar(ult?.cabeceras?.authorization?.startsWith('vapid '), 'va firmada con VAPID')
  comprobar(ult?.cabeceras?.['content-encoding'] === 'aes128gcm', 'va cifrada (aes128gcm)')
  comprobar(ult?.bytes > 0, 'lleva contenido')
  comprobar(Boolean(ult?.cabeceras?.ttl), 'lleva TTL')
}

console.log('\n4. Las suscripciones muertas se borran')
{
  respuesta = 410 // "esta suscripción ya no existe"
  recibidas.length = 0
  const r = await enviarAvisos(
    [senal('EUR/USD', 'COMPRA', 2.5), senal('USD/JPY', 'VENTA', 3.0)],
    ENTORNO,
    bdFalsa([aparatoFalso(`${base}/aparato-muerto`)])
  )
  comprobar(r.limpiadas === 1, 'se borró la suscripción muerta')
  comprobar(recibidas.length === 1, 'no se insistió con la segunda señal en un aparato muerto')
  comprobar(borrados.length === 1, 'el borrado llegó a la base de datos')
  respuesta = 201
}

console.log('\n5. Un servicio que no contesta no cuelga el envío')
{
  const arranque = Date.now()
  const r = await enviarAvisos(
    [senal('EUR/USD', 'COMPRA', 2.5)],
    { ...ENTORNO, PUSH_MS_POR_AVISO: 1200 },
    bdFalsa([aparatoFalso(`${base}/mudo`)])
  )
  const tardo = Date.now() - arranque

  comprobar(tardo < 5000, `se rindió solo (tardó ${tardo} ms, no se colgó)`)
  comprobar(tardo >= 1000, 'esperó lo que se le dijo antes de rendirse')
  comprobar(r.fallidos === 1, 'lo cuenta como no entregado')
  comprobar(r.limpiadas === 0, 'NO lo da por muerto: callarse no es lo mismo que no existir')
}

console.log('\n6. El presupuesto total corta y lo dice')
{
  const r = await enviarAvisos(
    [senal('EUR/USD', 'COMPRA', 2.5), senal('USD/JPY', 'VENTA', 3.0)],
    { ...ENTORNO, PUSH_MS_POR_AVISO: 800, PUSH_MS_PRESUPUESTO: 1200 },
    bdFalsa([aparatoFalso(`${base}/mudo`), aparatoFalso(`${base}/mudo-2`), aparatoFalso(`${base}/mudo-3`)])
  )
  // 3 aparatos × 2 señales = 6 avisos, a 800 ms cada uno son 4,8 s: no caben
  // en 1,2 s de presupuesto, así que algunos tienen que quedar sin intentar.
  comprobar(r.sinTiempo > 0, `avisa de los que no le dio tiempo (${r.sinTiempo})`)
  comprobar(
    r.enviados + r.fallidos + r.sinTiempo === 6,
    'las cuentas cuadran: enviados + fallidos + sin tiempo = todos'
  )
}

console.log('\n7. Sin configurar, no revienta')
{
  const r = await enviarAvisos([senal('EUR/USD', 'COMPRA', 2.5)], { PUSH_SIN_PAUSA: '1' })
  comprobar(r.estado === 'sin-configurar', 'avisa que faltan las claves en vez de fallar')

  const vacio = await enviarAvisos([], ENTORNO, bdFalsa([]))
  comprobar(vacio.estado === 'nada-que-enviar', 'sin señales nuevas no hace nada')
}

// La pausa es lo único que hoy separa a un miembro de recibir un aviso que
// —medido— le haría perder dinero: las 6 señales que esta app ha dado en su
// historial salieron todas perdedoras. Si alguien rompiera la pausa sin querer
// al tocar esta función, esto salta.
console.log('\n8. Los avisos están en pausa y no se escapa ninguno')
{
  const conTodo = await enviarAvisos(
    [senal('EUR/USD', 'COMPRA', 2.5)],
    { VAPID_PRIVATE_KEY: '9Ah-93imAiVXw1xoJnC-cuiA14U0JjwVxHuC7lHhKOc' },
    bdFalsa([aparatoFalso(`${base}/aparato-en-pausa`)])
  )
  comprobar(conTodo.estado === 'en-pausa', 'con claves, suscriptor y señal buena, NO manda: dice "en-pausa"')
  comprobar(conTodo.candidatas === 1, 'y deja constancia de cuántas se habrían mandado')

  const antes = borrados.length
  comprobar(antes === borrados.length, 'en pausa no toca Firestore para nada')
}

servidor.close()
rmSync(carpeta, { recursive: true, force: true })
console.log(fallos ? `\n✗ ${fallos} comprobaciones fallaron\n` : '\n✓ todo bien\n')
process.exit(fallos ? 1 : 0)
