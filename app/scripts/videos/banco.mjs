// Utilidades para grabar los videos del curso (2026-11-19).
//
// Sirve el banco construido (`_videos/`) y los datos REALES publicados en la
// rama `datos` (bajados antes a una carpeta con `curl`), sin servidor: todo
// pasa por las rutas de Playwright. Firebase se corta: el usuario es un doble.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { clave } from '../../src/lib/identidad.js'

const DIST = fileURLToPath(new URL('../../_videos/', import.meta.url))
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webm': 'video/webm', '.mp4': 'video/mp4', '.woff2': 'font/woff2' }

export const ANCHO = 390
export const ALTO = 720

export async function abrir(chromium, { datos, video, consulta = '' }) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const opciones = { viewport: { width: ANCHO, height: ALTO } }
  if (video) opciones.recordVideo = { dir: video, size: { width: ANCHO, height: ALTO } }
  const ctx = await b.newContext(opciones)
  // Las claves llevan el prefijo de ESTA app (nfs_ o nfi_): con el de la otra
  // la app arrancaría en inglés y con la tarjeta de primer arranque abierta.
  await ctx.addInitScript((c) => {
    localStorage.setItem(c.idioma, 'es')
    localStorage.setItem(c.vista, 'vertical')
    localStorage.setItem(c.arranque, '1')
  }, { idioma: clave('idioma'), vista: clave('vista'), arranque: clave('arranque_cerrado') })
  // Lo que no es nuestro se corta (fuentes, Firebase). Va PRIMERO: Playwright
  // da prioridad a la última ruta registrada.
  await ctx.route('**/*', (r) => r.abort())
  // Cada app lee archivos de SU rama `datos` y algunos de la de swing (el
  // puente de MT5, las noticias). Se sirven de `<datos>/swing/` y
  // `<datos>/intradia/`, como los baja `bajar()`. La dirección se compara sin
  // mayúsculas: el código escribe el repositorio de las dos formas.
  await ctx.route('https://raw.githubusercontent.com/**', async (r) => {
    const ruta = new URL(r.request().url()).pathname
    const m = ruta.match(/^\/nestor-forex\/(nestor-forex(?:-intradia)?)\/datos\/(.+)$/i)
    if (!m) return r.fulfill({ status: 404, body: '' })
    const repo = m[1].toLowerCase().endsWith('-intradia') ? 'intradia' : 'swing'
    try {
      r.fulfill({ status: 200, body: await readFile(join(datos, repo, m[2])), headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } })
    } catch {
      r.fulfill({ status: 404, body: '' })
    }
  })
  await ctx.route('http://banco.local/**', async (r) => {
    let ruta = new URL(r.request().url()).pathname.replace(/^\//, '') || 'index.html'
    try {
      r.fulfill({ status: 200, body: await readFile(join(DIST, ruta)), headers: { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream' } })
    } catch {
      r.fulfill({ status: 404, body: '' })
    }
  })
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e)))
  await p.goto(`http://banco.local/index.html${consulta}`)
  await p.waitForTimeout(1500)
  return { b, ctx, p, errores }
}

// El rótulo de abajo: el texto que explica el video (no hay voz).
export async function ponerRotulo(p) {
  await p.evaluate(() => {
    const d = document.createElement('div')
    d.id = 'rotulo'
    Object.assign(d.style, { position: 'fixed', left: '12px', right: '12px', bottom: '78px', padding: '12px 14px', borderRadius: '12px', background: 'rgba(10,14,22,0.95)', border: '1px solid #23c4d8', color: '#fff', font: '600 15px/1.4 system-ui, sans-serif', zIndex: 99999, boxShadow: '0 6px 24px rgba(0,0,0,.5)' })
    document.body.appendChild(d)
  })
  return (t) => p.evaluate((x) => { document.getElementById('rotulo').textContent = x }, t)
}

// Resalta un elemento con un marco: sirve para decir «mira aquí».
export async function marcar(p, locator) {
  await locator.evaluate((el) => {
    document.querySelectorAll('[data-marca]').forEach((x) => { x.style.outline = ''; delete x.dataset.marca })
    el.dataset.marca = '1'
    el.style.outline = '3px solid #23c4d8'
    el.style.outlineOffset = '3px'
    el.style.borderRadius = el.style.borderRadius || '8px'
  })
}
export const desmarcar = (p) => p.evaluate(() => document.querySelectorAll('[data-marca]').forEach((x) => { x.style.outline = ''; delete x.dataset.marca }))

export async function llevar(p, locator, margen = 70) {
  await locator.evaluate((el, m) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - m, behavior: 'smooth' }), margen)
  await p.waitForTimeout(700)
}

// Baja los archivos publicados de las DOS ramas `datos` (cada app lee alguno
// de la otra). Lo que no exista en una rama se salta: no todas publican todo.
export async function bajar(carpeta) {
  const RAMAS = { swing: 'Nestor-forex', intradia: 'Nestor-forex-intradia' }
  const archivos = ['barrido', 'calendario', 'cot', 'oro', 'tasas', 'mt5', 'noticias', 'estacionalidad', 'historia'].map((f) => `estado/${f}.json`)
  archivos.push('historial/senales.jsonl', 'historial/resultados.jsonl')
  for (const [nombre, repo] of Object.entries(RAMAS)) {
    for (const a of archivos) {
      const res = await fetch(`https://raw.githubusercontent.com/Nestor-forex/${repo}/datos/${a}`)
      if (!res.ok) { console.log(`  (no hay ${nombre}/${a})`); continue }
      const destino = join(carpeta, nombre, a)
      await mkdir(dirname(destino), { recursive: true })
      await writeFile(destino, Buffer.from(await res.arrayBuffer()))
      console.log('  bajado', `${nombre}/${a}`)
    }
  }
}

// ─── Ayudas de las escenas (las usan `grabar.mjs` y `escenas-herramientas.mjs`) ───

export const FIN = 'Esto es formación, no una señal. La decisión es tuya.'
export const espera = (p, s) => p.waitForTimeout(s * 1000)

// Un número que no se encuentra en la pantalla PARA la grabación: un rótulo
// inventado sería peor que no tener video.
export function exigir(v, que) {
  if (v === null || v === undefined || v === '' || Number.isNaN(v)) throw new Error(`No encontré ${que} en la pantalla: no grabo un rótulo inventado.`)
  return v
}

export async function irA(p, pestaña) {
  await p.locator('nav button', { hasText: pestaña }).first().click()
  await espera(p, 1.2)
  await p.evaluate(() => window.scrollTo(0, 0))
}

// Una tarjeta plegable por su título, y abrirla si está cerrada.
export const tarjeta = (p, titulo) => p.locator('button[aria-expanded]', { hasText: titulo }).first()
export async function abrirTarjeta(p, titulo) {
  const b = tarjeta(p, titulo)
  if ((await b.getAttribute('aria-expanded')) !== 'true') await b.click()
  await espera(p, 0.6)
  return b
}

// La caja que envuelve un título: el antepasado más cercano con clase `card`.
export const cajaDe = (p, texto) => p.locator('.card', { hasText: texto }).last()

// El valor de una fila «rótulo · valor» (Analizador, calculadora, perfil…).
export const fila = (p, rotulo) =>
  p.evaluate((e) => {
    // El rótulo puede venir envuelto (el %B va en su propio <span dir="ltr">):
    // se busca la hoja y, si no tiene hermano, el de su caja.
    const hojas = [...document.querySelectorAll('main span, main div')].filter((y) => y.children.length === 0 && y.textContent.trim() === e)
    for (const x of hojas) {
      const v = x.nextElementSibling || x.parentElement?.nextElementSibling
      if (v) return v.textContent.trim().replace(/\s+/g, ' ')
    }
    return null
  }, rotulo)

// Enciende un botón de los que se encienden y apagan (aria-pressed), si estaba apagado.
export async function chip(p, nombre) {
  const b = p.locator('main button[aria-pressed]', { hasText: nombre }).first()
  if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click()
  return b
}

// La fila «rótulo · valor» como localizador, para llevar la pantalla hasta
// ella y marcarla. Se salta los botones: el botón «RSI» del paso 4 se llama
// igual que la fila del RSI de la tarjeta.
export async function filaLoc(p, rotulo) {
  const id = await p.evaluate((e) => {
    const hojas = [...document.querySelectorAll('main span, main div')].filter((y) => y.children.length === 0 && y.textContent.trim() === e && !y.closest('button'))
    for (const x of hojas) {
      const v = x.nextElementSibling ? x : x.parentElement?.nextElementSibling ? x.parentElement : null
      if (v) {
        const marca = `f${Math.random().toString(36).slice(2, 8)}`
        v.dataset.fila = marca
        v.nextElementSibling.dataset.fila = `${marca}v`
        return marca
      }
    }
    return null
  }, rotulo)
  if (!id) throw new Error(`No encontré la fila «${rotulo}» en la pantalla.`)
  return { rotulo: p.locator(`[data-fila="${id}"]`), valor: p.locator(`[data-fila="${id}v"]`) }
}
