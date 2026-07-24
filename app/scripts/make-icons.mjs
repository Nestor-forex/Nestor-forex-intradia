import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

function crc32(buf) {
  let c
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

// Ícono: fondo oscuro + 3 barras ascendientes (motivo de velas/tendencia
// alcista) en el verde de la app. El sistema operativo recorta la forma
// final (círculo, squircle, etc.), así que el contenido se mantiene
// dentro de una "zona segura" central para no quedar cortado.
function makeIcon(size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type RGB
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const bg = [22, 25, 31] // oklch(0.16 0.015 255) aprox.
  const bar = [227, 168, 82] // ámbar oklch(0.75 0.13 85) aprox. — distingue esta app (intradía) de Nestor Forex (verde).

  const safeMargin = size * 0.2
  const safeW = size - safeMargin * 2
  const baseY = size - safeMargin
  const barCount = 3
  const gap = safeW * 0.14
  const barW = (safeW - gap * (barCount - 1)) / barCount
  const heightsRatio = [0.34, 0.62, 0.92]
  const maxBarH = safeW * 0.92

  const bars = heightsRatio.map((h, i) => {
    const x0 = safeMargin + i * (barW + gap)
    const barH = maxBarH * h
    return { x0, x1: x0 + barW, y0: baseY - barH, y1: baseY }
  })

  const raw = Buffer.alloc(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3)
    raw[rowStart] = 0 // filter type none
    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 3
      const enBarra = bars.some((b) => x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1)
      const [r, g, b] = enBarra ? bar : bg
      raw[px] = r
      raw[px + 1] = g
      raw[px + 2] = b
    }
  }
  const idat = deflateSync(raw)
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

writeFileSync(new URL('../public/pwa-192.png', import.meta.url), makeIcon(192))
writeFileSync(new URL('../public/pwa-512.png', import.meta.url), makeIcon(512))
console.log('Iconos PWA generados.')
