// La voz de los videos del curso: MUESTRA (2026-11-21). Solo Swing por ahora.
//
// Néstor pidió que la voz diga lo mismo que el rótulo de cada video. Cómo
// funciona, en tres pasos:
//
//   1. `grabar.mjs --textos m0-1 …` graba el video sin voz y apunta en
//      `voz/textos.json` lo que dice cada rótulo, ya preparado para leerse.
//   2. El workflow «Generar la voz de los videos» (GitHub Actions, porque desde
//      las sesiones de programación no se pueden bajar los modelos de voz)
//      convierte cada texto en un audio con Piper, una voz gratis que corre sin
//      internet, y lo guarda en `voz/<voz>/<id>.ogg`.
//   3. `grabar.mjs --voz <voz> m0-1 …` vuelve a grabar: cada rótulo se queda en
//      pantalla al menos lo que dura su audio, y al final la voz se pega al
//      video en el momento en que salió cada rótulo.
//
// ⚠️ LA VOZ DICE LO MISMO QUE EL RÓTULO, NADA MÁS. `paraVoz` solo cambia CÓMO
// se pronuncia (las siglas, los pares, los decimales), nunca qué se dice. Así
// siguen valiendo las reglas de los rótulos: ninguno dice que algo se compre o
// se venda, y todos terminan con el aviso de que no es una señal.
//
// ⚠️ Un rótulo sin audio (porque el texto cambió con los datos del día) se
// queda mudo en vez de leerse con otra voz o inventarse: el script lo avisa.
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const CARPETA_VOZ = fileURLToPath(new URL('./voz/', import.meta.url))
export const TEXTOS = join(CARPETA_VOZ, 'textos.json')
// Pausa después de cada frase antes de cambiar el rótulo, en segundos.
export const PAUSA = 0.6

const DIVISA = {
  EUR: 'euro', USD: 'dólar', GBP: 'libra', JPY: 'yen', CHF: 'franco suizo',
  CAD: 'dólar canadiense', AUD: 'dólar australiano', NZD: 'dólar neozelandés',
}
// Las siglas se deletrean; los nombres en inglés se escriben como suenan.
const PALABRAS = [
  [/\bStop-loss\b/gi, 'stop los'],
  [/\bTake-profit\b/gi, 'téik prófit'],
  [/\bR\/B\b/g, 'riesgo beneficio'],
  [/\bRSI\b/g, 'erre ese i'],
  [/\bATR\b/g, 'a te erre'],
  [/\bEMA\b/g, 'e eme a'],
  [/\bSMA\b/g, 'ese eme a'],
  [/\bCOT\b/g, 'ce o te'],
  [/\bFVG\b/g, 'efe uve ge'],
  [/\bMT5\b/g, 'eme te cinco'],
  [/\bBUY\b/g, 'bai'],
  [/\bSELL\b/g, 'sel'],
  [/\bForex\b/g, 'fórex'],
  [/\bswing\b/gi, 'suing'],
  [/\bspread\b/gi, 'espred'],
  [/\bswap\b/gi, 'suap'],
  [/\bpips?\b/gi, (m) => (m.toLowerCase() === 'pip' ? 'pip' : 'pips')],
]

// Pronunciación «natural» (2026-11-21, segunda muestra de Google): las voces
// Chirp 3 HD leen bien las palabras en inglés del trading, y escritas «como
// suenan» («stop los», «téik prófit», «espred») salían forzadas. Aquí se dejan
// en inglés; las siglas se siguen deletreando y lo demás no cambia.
const NATURAL = {
  'stop los': 'stop loss', 'téik prófit': 'take profit', bai: 'buy', sel: 'sell',
  fórex: 'Forex', suing: 'swing', espred: 'spread', suap: 'swap',
}
export const PRONUNCIACIONES = ['fonetica', 'natural']

// Cómo se pronuncia un rótulo. No cambia el contenido, solo la lectura.
export function paraVoz(texto, pron = 'fonetica') {
  if (!PRONUNCIACIONES.includes(pron)) throw new Error(`Pronunciación desconocida: ${pron}`)
  let t = String(texto)
  // Un par de divisas: «EUR/USD» → «euro dólar».
  t = t.replace(/\b([A-Z]{3})\/([A-Z]{3})\b/g, (m, a, b) => (DIVISA[a] && DIVISA[b] ? `${DIVISA[a]} ${DIVISA[b]}` : m))
  for (const [re, por] of PALABRAS) t = t.replace(re, pron === 'natural' && typeof por === 'string' && NATURAL[por] ? NATURAL[por] : por)
  // Una cantidad en dólares: «$10.00» o «10 USD» → «10 dólares».
  t = t.replace(/\$\s?(\d+(?:[.,]\d+)?)/g, '$1 dólares')
  t = t.replace(/(\d)\s?USD\b/g, '$1 dólares')
  // Suelta, la sigla es la moneda: «EUR va primero y USD segundo» → «dólar».
  t = t.replace(/\bUSD\b/g, 'dólar')
  t = t.replace(/\b([A-Z]{3})\b/g, (m) => DIVISA[m] ?? m)
  // Miles con punto (1.000) → sin punto; decimales con punto (0.04) → con coma.
  t = t.replace(/\b(\d{1,3})((?:\.\d{3})+)(?![\d.,])(?=\s+(?:dólares|operaciones|velas|días|horas))/g, (m, a, b) => a + b.replace(/\./g, ''))
  t = t.replace(/(\d)\.(\d)/g, '$1,$2')
  t = t.replace(/(\d),00\b/g, '$1')
  // Una hora: «11:30 p. m.» → «11 y 30 p. m.», «07:00 a. m.» → «7 a. m.»,
  // «21:00 UTC» → «21 horas UTC». Va ANTES de la relación riesgo/beneficio: esa
  // regla se comía las horas y la voz decía «11 a 30» (2026-11-28). Solo con
  // «a. m.», «p. m.» o «UTC» detrás, que es como las escribe la app.
  t = t.replace(/\b(\d{1,2}):(\d{2})(?=\s?(a\.\s?m\.|p\.\s?m\.|UTC\b))/g, (m, h, mm, tras) => {
    const hh = String(Number(h))
    if (mm !== '00') return `${hh} y ${mm}`
    return tras === 'UTC' ? `${hh} horas` : hh
  })
  // Una relación riesgo/beneficio: «1:1,5» → «1 a 1,5». Sin espacio DESPUÉS de
  // los dos puntos (la app lo escribe pegado): «Prueba 1: 114 operaciones» no
  // es una relación y la voz decía «Prueba 1 a 114».
  t = t.replace(/(\d+(?:,\d+)?)\s?:(\d+(?:,\d+)?)/g, '$1 a $2')
  // Una palabra en mayúsculas para resaltarla se lee como palabra, no letra a letra.
  t = t.replace(/\b[A-ZÁÉÍÓÚÑ]{4,}\b/g, (w) => w.toLowerCase())
  t = t.replace(/(\d)\s?%/g, '$1 por ciento')
  // Signos que una voz puede leer mal o saltarse: «±17» y «−0,04» (el menos
  // tipográfico, no el guion).
  t = t.replace(/±\s?/g, 'más o menos ')
  t = t.replace(/−\s?(?=\d)/g, 'menos ')
  t = t.replace(/\s*→\s*/g, ', ')
  t = t.replace(/[«»“”"]/g, '')
  t = t.replace(/…/g, '.')
  t = t.replace(/\s+/g, ' ').trim()
  return t
}

export const idVoz = (textoVoz) => createHash('sha1').update(textoVoz).digest('hex').slice(0, 12)

// Lo que hay que convertir en audio: [{ id, texto }]. Se va sumando.
export async function leerTextos() {
  try { return JSON.parse(await readFile(TEXTOS, 'utf8')) } catch { return [] }
}
export async function apuntarTextos(rotulos) {
  const lista = await leerTextos()
  const hay = new Set(lista.map((x) => x.id))
  for (const r of rotulos) if (!hay.has(r.id)) { lista.push({ id: r.id, texto: r.voz }); hay.add(r.id) }
  await writeFile(TEXTOS, JSON.stringify(lista, null, 1) + '\n')
  return lista.length
}

// Duración en segundos de cada audio de una voz: Map(id → s).
// Se guarda por voz: con cientos de textos, medirlos todos en cada video
// costaba minutos de ffprobe.
const MEDIDAS = new Map()
export function duraciones(voz, lista) {
  if (!MEDIDAS.has(voz)) MEDIDAS.set(voz, new Map())
  const dur = MEDIDAS.get(voz)
  for (const { id } of lista) {
    if (dur.has(id)) continue
    const f = join(CARPETA_VOZ, voz, `${id}.ogg`)
    if (!existsSync(f)) continue
    const s = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())
    if (Number.isFinite(s) && s > 0) dur.set(id, s)
  }
  return dur
}

// Envuelve el rótulo: apunta cuándo sale cada frase y, con voz, deja cada una
// en pantalla al menos lo que dura su audio.
// `pron` tiene que ser la MISMA al apuntar los textos y al grabar con voz:
// el id del audio sale del texto ya preparado.
export function rotuloConVoz(p, ponerTexto, dur = null, pron = 'fonetica') {
  const log = []
  let hasta = 0
  const r = async (texto) => {
    const falta = hasta - Date.now()
    if (falta > 0) await p.waitForTimeout(falta)
    await ponerTexto(texto)
    const t = Date.now()
    const voz = paraVoz(texto, pron)
    const id = idVoz(voz)
    log.push({ t, texto, voz, id })
    const s = dur?.get(id)
    if (s) hasta = t + (s + PAUSA) * 1000
  }
  r.log = log
  r.terminar = async () => {
    const falta = hasta - Date.now()
    if (falta > 0) await p.waitForTimeout(falta)
  }
  return r
}

// Pega los audios al video ya cortado. `corte` = segundos quitados al principio.
export function mezclar({ video, salida, voz, log, t0, corte }) {
  const entradas = []
  const filtros = []
  let n = 0
  for (const x of log) {
    const f = join(CARPETA_VOZ, voz, `${x.id}.ogg`)
    if (!existsSync(f)) { console.log(`  ⚠ sin audio, se queda mudo: «${x.texto}»`); continue }
    const ms = Math.max(0, Math.round(x.t - t0 - corte * 1000))
    entradas.push('-i', f)
    n++
    filtros.push(`[${n}:a]adelay=${ms}|${ms}[a${n}]`)
  }
  if (!n) throw new Error('Ningún rótulo tiene audio: ¿corrió el workflow de la voz?')
  const mezcla = `${filtros.join(';')};${Array.from({ length: n }, (_, i) => `[a${i + 1}]`).join('')}amix=inputs=${n}:normalize=0:dropout_transition=0,apad[voz]`
  const comun = ['-loglevel', 'error', '-y', '-i', video, ...entradas, '-filter_complex', mezcla, '-map', '0:v', '-map', '[voz]', '-shortest']
  const destino = salida
  if (destino.endsWith('.webm')) execFileSync('ffmpeg', [...comun, '-c:v', 'copy', '-c:a', 'libopus', '-b:a', '48k', destino])
  else execFileSync('ffmpeg', [...comun, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', destino])
  return n
}
