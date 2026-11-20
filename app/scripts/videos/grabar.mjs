// Graba los videos del curso (2026-11-19).
//
// Uso (desde app/):
//   1. bajar los datos reales:   node scripts/videos/grabar.mjs --bajar <carpeta>
//   2. construir el banco:       npx vite build --config scripts/videos/vite.config.js
//   3. grabar:                   node scripts/videos/grabar.mjs <carpeta> m0-1 m1-2 …   (sin ids: todos)
//
// Cada video sale en `public/curso/videos/<id>.webm` y `.mp4`, sin voz: el
// texto que explica va en el rótulo de abajo. La app es la de verdad, con los
// datos que publica la rama `datos` ese día; lo único inventado es el usuario
// de ejemplo y sus operaciones (`dobles.js`), y el rótulo lo dice.
//
// ⚠️ LAS MISMAS REGLAS QUE LAS LECCIONES (`src/lib/curso/es.js`): ningún rótulo
// dice que algo se compre o se venda, ni hacia dónde irá el precio, y cada
// video termina con el aviso de que es formación y no una señal.
//
// ⚠️ Los números de los rótulos se LEEN de la pantalla o de los datos al
// grabar, nunca se escriben a mano: el video tiene que decir lo mismo que la
// app enseña en ese momento. Si un número no se encuentra, el guion falla en
// vez de grabar un rótulo inventado.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { execFileSync } from 'node:child_process'
import { readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { abrir, abrirTarjeta, bajar, cajaDe, chip, desmarcar, espera, exigir, fila, filaLoc, FIN, irA, llevar, marcar, ponerRotulo, tarjeta } from './banco.mjs'
import { ESCENAS_HERRAMIENTAS, analizador, verHerramienta } from './escenas-herramientas.mjs'
import es from '../../src/lib/i18n/textos/es.js'
import { OPS_PARA_CREER } from '../../src/lib/sombra.js'
import { margen } from '../../src/lib/diagnostico.js'
import * as MC from '../../src/lib/marketCalc.js'
import { PERIODOS_MEDIAS, PERIODO_ATR, PERIODO_RSI, RSI_MAX, UMBRAL_FUERZA, VENTANAS_FUERZA } from '../../src/lib/marketCalc.js'
import { APP } from '../../src/lib/identidad.js'

const VIDEOS = fileURLToPath(new URL('../../public/curso/videos/', import.meta.url))
const coma = (x) => String(x).replace('.', ',')

// Módulo 4: el ranking de fuerza del Barrido y la «Dif» del tablero completo,
// leídos de la pantalla.
const VELA1 = APP === 'swing' ? 'día' : 'hora'
const VELAN = APP === 'swing' ? 'días' : 'horas'
async function rankingFuerza(p) {
  const ranking = await p.evaluate(() => {
    const caja = [...document.querySelectorAll('main div')].find((d) => d.children.length === 8 && [...d.children].every((c) => /^[A-Z]{3}\s+\d/.test(c.innerText.trim())))
    if (!caja) return null
    caja.dataset.ranking = '1'
    return [...caja.children].map((c) => c.innerText.trim().split(/\s+/))
  })
  exigir(ranking, 'el ranking de fuerza')
  return ranking
}
async function abrirTablero(p) {
  const ver = p.locator('main a', { hasText: 'Ver tablero completo' }).first()
  await llevar(p, ver, 200)
  await ver.click()
  await espera(p, 1.4)
}
// Un par con la Dif más grande y, si lo hay, uno con Dif claramente por debajo
// del umbral. Marca sus tarjetas con `data-dif`.
async function dosDif(p) {
  const d = await p.evaluate((u) => {
    const filas = [...document.querySelectorAll('main span')].filter((s) => /^Dif\s+[+−-]?\d/.test(s.textContent.trim()))
    const datos = filas.map((s) => {
      const txt = s.textContent.trim().replace(/^Dif\s+/, '')
      let caja = s
      while (caja && !caja.querySelector('.mono[dir="ltr"]')?.textContent.match(/^[A-Z]{3}\/[A-Z]{3}$/)) caja = caja.parentElement
      const par = [...(caja?.querySelectorAll('.mono') ?? [])].map((x) => x.textContent.trim()).find((x) => /^[A-Z]{3}\/[A-Z]{3}$/.test(x))
      return { s, caja, par, dif: txt, n: Math.abs(parseFloat(txt.replace('−', '-'))) }
    }).filter((x) => x.par && Number.isFinite(x.n))
    if (!datos.length) return null
    const alto = datos.reduce((a, b) => (b.n > a.n ? b : a))
    const bajo = datos.filter((x) => x.n < u - 0.15).sort((a, b) => a.n - b.n)[0]
    ;(alto.caja ?? alto.s).dataset.dif = 'alto'
    if (bajo) (bajo.caja ?? bajo.s).dataset.dif = 'bajo'
    // ¿Pasa el umbral DE VERDAD? Lo dice la etiqueta de la tarjeta (COMPRA,
    // VENTA o VIGILAR solo salen por encima del umbral). En intradía el umbral
    // sube a algunas horas, así que compararlo con el base podría mentir.
    const pasa = /\b(COMPRA|VENTA|VIGILAR)\b/.test(alto.caja?.innerText ?? '')
    return { alto: { par: alto.par, dif: alto.dif, pasa }, bajo: bajo ? { par: bajo.par, dif: bajo.dif } : null }
  }, UMBRAL_FUERZA)
  exigir(d, 'la «Dif» de los pares en el tablero completo')
  return d
}

const ESCENAS = {
  // ─── Módulo 0 ───────────────────────────────────────────────────────────────
  'm0-1': {
    desc: 'Video sin voz: el Barrido con los datos reales de ese día. Se abre la tarjeta «Qué es esta app», se lee que nada de lo que se ve es una señal para copiar, y se baja hasta los avisos de los experimentos, que dicen «Esto NO son señales».',
    async correr(p, r) {
      await r('Esto es el Barrido, con los datos reales de hoy.')
      await espera(p, 3)
      const t = tarjeta(p, 'Qué es esta app')
      await llevar(p, t)
      await marcar(p, t)
      await r('Arriba está «Qué es esta app». Ábrela una vez y léela entera.')
      await espera(p, 3.2)
      await abrirTarjeta(p, 'Qué es esta app')
      await desmarcar(p)
      await r('Nada de lo que ves aquí es una señal para copiar.')
      await espera(p, 3.4)
      await p.mouse.wheel(0, 260)
      await espera(p, 0.8)
      await r('Las direcciones, Stop-loss y Take-profit que salen son EXPERIMENTOS: la app los anota y los resuelve con precios reales.')
      await espera(p, 4.6)
      await r(`Cada experimento necesita ${OPS_PARA_CREER} operaciones reales antes de que su número signifique algo.`)
      await espera(p, 4)
      const aviso = p.getByText('Esto NO son señales', { exact: false }).first()
      await llevar(p, aviso, 160)
      await marcar(p, aviso)
      await r('Por eso cada experimento lo dice con estas palabras.')
      await espera(p, 3.4)
      await desmarcar(p)
      await r('La app te ahorra tiempo de análisis. La decisión y el riesgo son tuyos.')
      await espera(p, 3.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
  'm0-2': {
    desc: 'Video sin voz: el Historial con el registro real de ese día. Se señala el ± que va pegado al acierto y el aviso de cuántas operaciones lleva el experimento de las que hacen falta para creerle.',
    async correr(p, r) {
      await irA(p, 'Historial')
      await r('El Historial: lo que la app anotó y cómo terminó, con precios reales.')
      await espera(p, 3.4)
      // En intradía el bloque de la app no lleva ±: su muestra ya es grande. El
      // ± sale en el experimento del retroceso, que lleva pocas. El contraste
      // entre las dos es justo la lección.
      const leerBloque = (titulo) => p.evaluate((t) => {
        const h = [...document.querySelectorAll('main *')].find((x) => x.children.length === 0 && x.textContent.trim() === t)
        let caja = h
        while (caja && !(caja.innerText || '').includes('Operaciones')) caja = caja.parentElement
        const txt = (caja?.innerText || '').replace(/\n+/g, ' ')
        const pct = txt.match(/(\d+)%\s*Acierto/)
        const ops = txt.match(/Acierto\s*(\d+)\s*Operaciones/)
        return pct && ops ? { pct: pct[1], ops: Number(ops[1]) } : null
      }, titulo)
      const app = exigir(await leerBloque('Las señales de la app'), 'el bloque de la app')
      const ret = exigir(await leerBloque('Historial del retroceso'), 'el bloque del retroceso')
      const tituloApp = p.getByText('Las señales de la app', { exact: true }).first()
      await llevar(p, tituloApp, 90)
      await marcar(p, tituloApp.locator('xpath=..'))
      await r(`Las señales de la app: ${app.pct} % de acierto sobre ${app.ops} operaciones. Con tantas, puede moverse unos ±${margen(app.ops)} puntos por casualidad.`)
      await espera(p, 5)
      await desmarcar(p)
      const tituloRet = p.getByText('Historial del retroceso', { exact: true }).first()
      await llevar(p, tituloRet, 90)
      await marcar(p, tituloRet.locator('xpath=..'))
      await r(`El experimento del retroceso: ${ret.pct} % sobre ${ret.ops} operaciones. Con tan pocas, el margen es ±${margen(ret.ops)}.`)
      await espera(p, 5)
      await desmarcar(p)
      const aviso = p.getByText('Todavía NO se puede tomar como señal', { exact: false }).first()
      await llevar(p, aviso, 200)
      await marcar(p, aviso)
      await r(`Por eso la app te dice cuántas lleva de las ${OPS_PARA_CREER} que hacen falta para creerle.`)
      await espera(p, 4)
      await desmarcar(p)
      await r(`Con 9 operaciones el margen es ±${margen(9)}. Con 25, ±${margen(25)}. Con ${OPS_PARA_CREER}, ±${margen(OPS_PARA_CREER)}.`)
      await espera(p, 4.4)
      await r('Un número bien calculado puede no significar nada todavía. El ± te dice cuándo ya se le puede creer.')
      await espera(p, 4.2)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  // ─── Módulo 1 ───────────────────────────────────────────────────────────────
  'm1-1': {
    desc: 'Video sin voz: la fuerza de las 8 divisas en el Barrido, con los datos reales de ese día. Se toma un par de la lista, se dice cuál es la moneda base y cuál la cotizada, y se busca la fuerza de cada una en el ranking.',
    async correr(p, r, datos) {
      const b = JSON.parse(await readFile(join(datos, 'intradia', 'estado/barrido.json'), 'utf8'))
      const orden = Object.entries(b.esc).sort((a, z) => z[1] - a[1])
      const [fuerte, debil] = [orden[0], orden[orden.length - 1]]
      const nombres = b.pares.map((x) => x.name)
      let par = nombres.find((n) => n === `${fuerte[0]}/${debil[0]}` || n === `${debil[0]}/${fuerte[0]}`) || nombres[0]
      const [base, cot] = par.split('/')
      const f = (c) => coma(Number(b.esc[c]).toFixed(1))
      await r('En Forex los precios van de dos en dos: se cambia una moneda por otra.')
      await espera(p, 3.6)
      const fila = p.locator('main').getByText(par, { exact: true }).first()
      await llevar(p, fila, 260)
      await marcar(p, fila)
      await r(`${par}: ${base} va primero (la base) y ${cot} segundo (la cotizada).`)
      await espera(p, 3.8)
      await r(`El precio dice cuántos ${cot} cuesta un ${base}. Si sube, el ${base} se encarece frente al ${cot}.`)
      await espera(p, 4.4)
      await r('Pero el par no dice cuál de las dos se movió. Para eso está la fuerza.')
      await espera(p, 3.6)
      const ranking = p.locator('main').getByText(fuerte[0], { exact: true }).first()
      await llevar(p, ranking, 120)
      await marcar(p, ranking.locator('xpath=ancestor::div[count(*)=8][1]'))
      await r('Aquí cada divisa se compara contra las otras 7, de 0 (la más débil) a 10 (la más fuerte).')
      await espera(p, 4.4)
      await r(`Hoy: ${base} ${f(base)} y ${cot} ${f(cot)}. Así se ve cuál de las dos está empujando.`)
      await espera(p, 4.2)
      await desmarcar(p)
      await r('Saber leer un par no dice hacia dónde irá. Solo te dice qué estás mirando.')
      await espera(p, 3.8)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
  'm1-2': {
    desc: 'Video sin voz: la calculadora de la pestaña Riesgo. Con EUR/USD el pip vale 10 USD por lote; al cambiar a USD/JPY el valor del pip cambia, porque depende del precio. Después, el mismo movimiento de 30 pips con un microlote y con un lote entero.',
    async correr(p, r) {
      await irA(p, 'Riesgo')
      const calc = p.getByText('Calculadora de lote y riesgo').first()
      await llevar(p, calc, 20)
      const sel = p.locator('select.field').first()
      await sel.selectOption('EUR/USD')
      await p.getByPlaceholder('Stop en pips').first().fill('30')
      await espera(p, 0.6)
      const valorPip = async () => p.evaluate(() => {
        const e = [...document.querySelectorAll('span')].find((x) => x.textContent.trim() === 'Valor del pip')
        return e?.nextElementSibling?.textContent?.trim()
      })
      await r('El pip es la unidad en que se mide el movimiento. En EUR/USD es la cuarta cifra decimal: 0,0001.')
      await espera(p, 4.4)
      const v1 = exigir(await valorPip(), 'el valor del pip de EUR/USD')
      const fila = p.getByText('Valor del pip', { exact: true }).first()
      await marcar(p, fila.locator('xpath=..'))
      await r(`Con un lote entero (100.000 unidades), cada pip de EUR/USD vale ${v1.replace(' / lote', '')}.`)
      await espera(p, 4)
      await desmarcar(p)
      await marcar(p, sel)
      await r('Ahora cambiamos a USD/JPY, un par con yen…')
      await espera(p, 2)
      await sel.selectOption('USD/JPY')
      await espera(p, 1)
      const v2 = exigir(await valorPip(), 'el valor del pip de USD/JPY')
      await desmarcar(p)
      await marcar(p, fila.locator('xpath=..'))
      await r(`En los pares con yen el pip es la segunda cifra: 0,01. Y aquí vale ${v2.replace(' / lote', '')} por lote, porque depende del precio.`)
      await espera(p, 5)
      await desmarcar(p)
      await r('El lote es el tamaño. 1 lote = 100.000 unidades; 0,1 es un minilote; 0,01 un microlote.')
      await espera(p, 4.4)
      await r('En EUR/USD, 30 pips con un microlote (0,01) son 3 USD. Con un lote entero, 300 USD. El mismo movimiento.')
      await espera(p, 4.8)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
  'm1-3': {
    desc: 'Video sin voz: la tarjeta «Lo que cuesta abrir la operación» del Barrido, con el spread real de una cuenta del desarrollador ese día. Se compara el spread de EUR/USD con el de un cruce y se calcula cuánto pesa sobre un Stop-loss corto y uno largo.',
    async correr(p, r, datos) {
      const m = JSON.parse(await readFile(join(datos, 'swing', 'estado/mt5.json'), 'utf8'))
      const sp = (par) => exigir(m.pares?.[par]?.spread, `el spread de ${par}`)
      const s1 = sp('EUR/USD')
      const s2 = sp('EUR/NZD')
      await r('Cada precio tiene dos caras: a cuánto te venden (ask) y a cuánto te compran (bid).')
      await espera(p, 4)
      const caja = cajaDe(p, 'Lo que cuesta abrir la operación')
      await llevar(p, caja, 20)
      await r('La diferencia es el spread, y se paga al abrir cada operación. Por eso toda operación empieza un poco en contra.')
      await espera(p, 4.6)
      const f1 = caja.getByText('EUR/USD', { exact: true }).first()
      await llevar(p, f1, 220)
      await marcar(p, f1.locator('xpath=following-sibling::*[3]'))
      await r(`En la última foto del bróker, EUR/USD: ${coma(s1)} pips.`)
      await espera(p, 3)
      const f2 = caja.getByText('EUR/NZD', { exact: true }).first()
      await llevar(p, f2, 220)
      await marcar(p, f2.locator('xpath=following-sibling::*[3]'))
      await r(`En EUR/NZD, un cruce: ${coma(s2)} pips.`)
      await espera(p, 3.2)
      await desmarcar(p)
      const pct = (s, sl) => Math.round((s / sl) * 100)
      await r(`Con un Stop-loss de 30 pips, ${coma(s1)} pips de spread son el ${pct(s1, 30)} % del riesgo. Con uno de 10 pips, el ${pct(s1, 10)} %.`)
      await espera(p, 5)
      await r('Ojo: este spread es el de una cuenta real del desarrollador. El de tu bróker puede ser otro.')
      await espera(p, 4)
      await r('El apalancamiento te deja abrir lotes más grandes, pero lo que pierdes por pip lo decide el lote, no el apalancamiento.')
      await espera(p, 5)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  // ─── Módulo 2 ───────────────────────────────────────────────────────────────
  'm2-1': {
    desc: 'Video sin voz: «Mi perfil de riesgo» de la pestaña Riesgo con un perfil de ejemplo de 1.000 USD. Se cambia el riesgo entre 1 %, 2 % y 3 % y se ve cuánto se arriesga por operación; después, cuánto queda tras diez pérdidas seguidas con cada porcentaje.',
    async correr(p, r) {
      await irA(p, 'Riesgo')
      const arriesgo = async () => p.evaluate(() => {
        const e = [...document.querySelectorAll('span')].find((x) => x.textContent.trim() === 'Arriesgas por operación')
        return e?.nextElementSibling?.textContent?.trim()
      })
      await llevar(p, p.getByText('Riesgo por operación', { exact: true }).first(), 80)
      await r('«Mi perfil de riesgo»: un usuario de ejemplo con 1.000 USD.')
      await espera(p, 3.4)
      const filaRiesgo = p.getByText('Arriesgas por operación', { exact: true }).first()
      await marcar(p, filaRiesgo.locator('xpath=..'))
      await r(`Con un 1 % por operación, arriesga ${exigir(await arriesgo(), 'lo que se arriesga')}. Si toca el Stop-loss, pierde eso y nada más.`)
      await espera(p, 4.4)
      await desmarcar(p)
      for (const [boton, pct] of [['Moderado · 2 %', 2], ['Agresivo · 3 %', 3]]) {
        const b = p.getByRole('button', { name: boton })
        await marcar(p, b)
        await b.click()
        await espera(p, 0.8)
        await r(`Con el ${pct} %: ${exigir(await arriesgo(), 'lo que se arriesga')} por operación.`)
        await espera(p, 3)
      }
      await p.getByRole('button', { name: 'Conservador · 1 %' }).click()
      await desmarcar(p)
      await espera(p, 0.5)
      const queda = (pct) => Math.round(1000 * (1 - pct / 100) ** 10)
      await r('Las pérdidas seguidas pasan aunque lo hagas todo bien. Diez seguidas, empezando con 1.000 USD:')
      await espera(p, 4.2)
      await r(`Con el 1 %: te quedan unos ${queda(1)} USD.  Con el 2 %: unos ${queda(2)}.  Con el 10 %: unos ${queda(10)}.`)
      await espera(p, 5)
      await r('Y recuperar cuesta más que perder: si pierdes la mitad, tienes que ganar un 100 % para volver.')
      await espera(p, 4.4)
      await r('Un porcentaje pequeño y siempre el mismo no te hace ganar: hace que una mala racha no te saque del juego.')
      await espera(p, 4.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
  'm2-2': {
    desc: 'Video sin voz: el Analizador con los datos reales de ese día. Se elige un par y una dirección cualquiera solo para ver las cuentas, y se prueban los tres métodos de Stop-loss: cambian el Stop-loss, el Take-profit, el R/B y el lote.',
    async correr(p, r) {
      await irA(p, 'Analizar')
      await r('El Analizador NO elige la dirección: la eliges tú.')
      await espera(p, 3.4)
      await p.locator('main select.field').first().selectOption('EUR/USD')
      await r('Elegimos EUR/USD y una dirección cualquiera, solo para ver las cuentas.')
      await espera(p, 1.6)
      const dir = p.locator('main button', { hasText: /^COMPRA$/ }).first()
      await marcar(p, dir)
      await dir.click()
      await espera(p, 1.4)
      await desmarcar(p)
      const rb = async () => p.evaluate(() => {
        const e = [...document.querySelectorAll('main span, main div')].find((x) => x.textContent.trim() === 'R/B' && x.nextElementSibling)
        const v = e?.nextElementSibling?.textContent?.trim()
        return v && /^1\s*:/.test(v) ? v.replace(/\s/g, '') : null
      })
      const metodos = ['La de la app', '1,5 ATR a cada lado', 'Soporte y resistencia']
      for (const [i, nombre] of metodos.entries()) {
        const b = p.locator('main button', { hasText: nombre }).first()
        await llevar(p, p.getByText('3 · CÓMO PONER EL STOP-LOSS').first(), 20)
        await marcar(p, b)
        await b.click()
        await espera(p, 1)
        await desmarcar(p)
        const tarj = p.locator('main').getByText('R/B', { exact: true }).first()
        if (await tarj.count()) await llevar(p, tarj, 160)
        const v = await rb()
        if (i === 0) {
          await r('El Stop-loss cierra la operación perdiendo; el Take-profit, ganando. Los dos se ponen al abrir.')
          await espera(p, 4.2)
        }
        await r(v ? `Método «${nombre}»: la relación riesgo/beneficio sale ${v.replace('.', ',')}.` : `Método «${nombre}»: con este método, hoy no salen niveles.`)
        await espera(p, 3.8)
      }
      await r('1:2 es poder ganar el doble de lo que arriesgas. Para no perder hace falta acertar 1 ÷ (1 + 2) = 33 % de las veces.')
      await espera(p, 5)
      await r('Con 1:1, el 50 %. Con 1:0,5, el 67 %. Y encima se pagan el spread y el swap.')
      await espera(p, 4.4)
      await r('Un R/B alto no hace ganar solo: llega menos veces. Reparte el resultado, no crea ventaja.')
      await espera(p, 4.4)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'm2-3-lote': {
    desc: 'Video sin voz: la calculadora con un perfil de 1.000 USD y un 1 % por operación. El Stop-loss pasa de 25 a 50 pips, el lote baja a la mitad y lo que se arriesga se queda igual.',
    async correr(p, r) {
      await irA(p, 'Riesgo')
      await llevar(p, p.getByText('Calculadora de lote y riesgo').first(), 20)
      await p.locator('select.field').first().selectOption('EUR/USD')
      const leer = (etq) => p.evaluate((e) => {
        const x = [...document.querySelectorAll('span')].find((y) => y.textContent.trim() === e)
        return x?.nextElementSibling?.textContent?.trim() || null
      }, etq)
      const stop = p.getByPlaceholder('Stop en pips').first()
      await r('Tu perfil: 1.000 USD y 1 % por operación. Arriesgas 10 USD.')
      await espera(p, 3.4)
      await marcar(p, stop)
      await r('Pon el Stop-loss a 25 pips…')
      await stop.click()
      await stop.pressSequentially('25', { delay: 350 })
      await espera(p, 0.8)
      const lote25 = exigir(await leer('Lote sugerido'), 'el lote con 25 pips')
      await r(`Stop-loss a 25 pips → ${lote25}.`)
      await espera(p, 3.4)
      await r('Ahora aleja el Stop-loss a 50 pips…')
      await stop.fill('')
      await stop.pressSequentially('50', { delay: 350 })
      await espera(p, 0.8)
      const lote50 = exigir(await leer('Lote sugerido'), 'el lote con 50 pips')
      const riesgo = exigir(await leer('Riesgo USD'), 'el riesgo en dólares')
      await desmarcar(p)
      await r(`Stop-loss a 50 pips → ${lote50}.`)
      await espera(p, 3.4)
      await r(`El lote cambió. Lo que arriesgas, no: siguen siendo ${riesgo}.`)
      await espera(p, 3.8)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  // ─── Módulo 3 ───────────────────────────────────────────────────────────────
  'm3-1': {
    desc: 'Video sin voz: dos maneras de cerrar el mismo mal día con 1.000 USD, y la pestaña Riesgo con los dos frenos de «Mi perfil de riesgo»: la pérdida máxima del día y las pérdidas seguidas, que se ponen antes, con la cabeza fría.',
    async correr(p, r) {
      await irA(p, 'Riesgo')
      await r('Casi nadie pierde la cuenta en una operación. Se pierde en un mal día.')
      await espera(p, 3.8)
      await r('Dos maneras de cerrar el mismo mal día, con 1.000 USD:')
      await espera(p, 3)
      await r('A: pierdes 10 y paras. Al día siguiente sigues con 990.')
      await espera(p, 3.6)
      await r('B: pierdes 10, abres otra con el doble para recuperar y pierdes 20; otra con 40, y pierdes. Te quedan 930.')
      await espera(p, 5.2)
      await r('B no tuvo peor suerte: tomó más decisiones con la cabeza caliente.')
      await espera(p, 3.8)
      const lim = p.getByLabel('Pérdida máxima en un día (%)').first()
      await llevar(p, lim, 140)
      const caja = lim.locator('xpath=..')
      await marcar(p, caja)
      await r('Por eso la regla de cuándo parar se escribe ANTES. Aquí pones tu pérdida máxima del día…')
      await espera(p, 4.4)
      await desmarcar(p)
      const seg = p.getByLabel('Pérdidas seguidas antes de parar').first()
      await marcar(p, seg.locator('xpath=..'))
      await r('…y cuántas pérdidas seguidas aguantas antes de parar.')
      await espera(p, 3.6)
      await desmarcar(p)
      await r('Si no sabes qué poner, la app te propone unos valores. El límite lo decides tú.')
      await espera(p, 3.8)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
  'm3-2': {
    desc: 'Video sin voz: «Tu freno de hoy», arriba del Diario, con un usuario de ejemplo que hoy lleva dos operaciones perdidas. La tarjeta suma lo perdido contra el freno del día y las pérdidas seguidas contra su límite, y se pone ámbar cuando queda poco margen.',
    consulta: '?diario=freno',
    async correr(p, r) {
      await irA(p, 'Diario')
      await r('El Diario de un usuario de ejemplo que hoy lleva dos operaciones perdidas.')
      await espera(p, 3.6)
      // La tarjeta ya se ve arriba sin mover nada: bajar la escondería bajo la cabecera.
      const caja = cajaDe(p, 'Tu freno de hoy')
      await marcar(p, caja)
      await r('Arriba está «Tu freno de hoy». Lee los dos frenos de «Mi perfil de riesgo».')
      await espera(p, 3.8)
      const leer = (etq) => p.evaluate((e) => {
        const x = [...document.querySelectorAll('span,div')].find((y) => y.textContent.trim() === e)
        return x?.nextElementSibling?.textContent?.trim() || null
      }, etq)
      const perdido = exigir(await leer('Perdido hoy'), 'lo perdido hoy')
      const seguidas = exigir(await leer('Pérdidas seguidas hoy'), 'las pérdidas seguidas')
      await r(`Perdido hoy: ${perdido}. Con 1.000 USD y un freno del día del 3 %, el límite son 30 USD.`)
      await espera(p, 4.6)
      await r(`Pérdidas seguidas hoy: ${seguidas}. El límite que se puso es 3.`)
      await espera(p, 4)
      await r('Por eso está en ámbar: queda poco margen. Al tocar el límite se pone roja.')
      await espera(p, 4)
      await r('Con un riesgo del 1 % y un freno del 3 %, el día se acaba a la tercera pérdida: lo que llegue antes.')
      await espera(p, 4.6)
      await desmarcar(p)
      await r('La app no cierra nada ni te bloquea: no está conectada a tu bróker. Solo te pone tu regla delante.')
      await espera(p, 4.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
  'm4-1': {
    desc: 'Video sin voz: el Barrido con los datos reales de ese día. Se señalan las barras de fuerza de las ocho divisas, la más fuerte y la más débil, y se explica que cada una sale de compararla con las otras siete.',
    async correr(p, r) {
      await r('Un par son dos divisas. Si EUR/USD sube, ¿fue el euro o fue el dólar? El par solo no lo dice.')
      await espera(p, 4.6)
      const ranking = await rankingFuerza(p)
      const caja = p.locator('[data-ranking]')
      await llevar(p, caja, 120)
      await marcar(p, caja)
      await r('Por eso la app compara cada divisa contra las otras siete a la vez. Estas son las barras.')
      await espera(p, 4.2)
      await r(`Se mira cuánto cambió en ${VENTANAS_FUERZA.map((k) => `${k} ${k === 1 ? VELA1 : VELAN}`).join(', ')}, y se promedia contra las siete.`)
      await espera(p, 4.8)
      const [fuerte, debil] = [ranking[0], ranking[ranking.length - 1]]
      await r(`Hoy la más fuerte es ${fuerte[0]} y la más débil ${debil[0]}.`)
      await espera(p, 3.8)
      await desmarcar(p)
      await r('Es un resumen de lo que ya pasó. No dice que la fuerte vaya a seguir fuerte.')
      await espera(p, 4)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
  'm4-2': {
    desc: 'Video sin voz: el tablero completo con los datos reales de ese día. Se señala la «Dif» de un par, se compara con el umbral de la app, y se ve un par que lo pasa y otro que no.',
    async correr(p, r) {
      await r('Para un par lo que cuenta es la DIFERENCIA de fuerza entre sus dos divisas.')
      await espera(p, 4)
      await abrirTablero(p)
      const d = await dosDif(p)
      await r(`Aquí sale como «Dif». La app no mira un par hasta que pasa ${coma(UMBRAL_FUERZA)}${APP === 'swing' ? '' : ' (el umbral base: a las horas de más movimiento sube)'}.`)
      await espera(p, 5)
      const alto = p.locator('[data-dif="alto"]')
      await llevar(p, alto, 160)
      await marcar(p, alto)
      await r(d.alto.pasa ? `${d.alto.par}: Dif ${d.alto.dif}. Una divisa le saca ventaja a la otra: pasa.` : `La más grande de hoy, ${d.alto.par}, va a ${d.alto.dif}: a esta hora no llega. Hoy ningún par pasa.`)
      await espera(p, 4.4)
      await desmarcar(p)
      if (d.bajo) {
        const bajo = p.locator('[data-dif="bajo"]')
        await llevar(p, bajo, 160)
        await marcar(p, bajo)
        await r(`${d.bajo.par}: Dif ${d.bajo.dif}. Las dos están casi igual de fuertes: no pasa.`)
        await espera(p, 4.4)
        await desmarcar(p)
      }
      await r('Pasar el umbral es solo la primera condición. Y una Dif grande no dice hacia dónde irá el precio.')
      await espera(p, 4.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
  'm4-3': {
    desc: 'Video sin voz: las barras de fuerza del Barrido, donde siempre hay un 10 y un 0, y después la «Dif» real del tablero completo, que es la que la app compara con el umbral.',
    async correr(p, r) {
      const ranking = await rankingFuerza(p)
      const caja = p.locator('[data-ranking]')
      await llevar(p, caja, 120)
      await marcar(p, caja)
      const [fuerte, debil] = [ranking[0], ranking[ranking.length - 1]]
      await r(`Arriba: ${fuerte[0]} ${fuerte[1]} y ${debil[0]} ${debil[1]}. ¿Mucha diferencia?`)
      await espera(p, 4)
      exigir(fuerte[1] === '10.0' && debil[1] === '0.0', 'que la escala vaya de 0 a 10')
      await r('No se sabe. La escala es un ORDEN: la más fuerte del día vale 10 y la más débil 0. Siempre.')
      await espera(p, 5)
      await r('Aunque las ocho estén casi iguales, siempre habrá un 10 y un 0.')
      await espera(p, 4)
      await desmarcar(p)
      await abrirTablero(p)
      const d = await dosDif(p)
      const alto = p.locator('[data-dif="alto"]')
      await llevar(p, alto, 160)
      await marcar(p, alto)
      await r(`La medida de verdad es la «Dif». La más grande de hoy: ${d.alto.par}, ${d.alto.dif}.`)
      await espera(p, 4.6)
      await desmarcar(p)
      await r(`Esa es la que la app compara con el umbral (${coma(UMBRAL_FUERZA)}${APP === 'swing' ? '' : ' o más, según la hora'}), no el 10 contra 0.`)
      await espera(p, 4.2)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
  'm5-1': {
    desc: 'Video sin voz: el Analizador con los datos reales de ese día. Se señala la fila «Tendencia» con sus dos EMA y después las medias móviles, y se explica cómo decide la app si un par está en tendencia o en rango.',
    async correr(p, r) {
      const [c, l] = PERIODOS_MEDIAS.ema
      await analizador(p, r)
      await r(`Una media móvil es el precio promedio de las últimas velas. La app mira dos: la EMA ${c} y la EMA ${l}.`)
      await espera(p, 4.6)
      const f = await verHerramienta(p, es.an.h.tendencia, es.an.h.tendencia)
      const v = exigir(await fila(p, es.an.h.tendencia), 'la tendencia')
      await marcar(p, f.valor)
      await r(`EUR/USD, hoy: ${v}.`)
      await espera(p, 4.2)
      await r(`«Alcista» si el precio está por encima de la EMA ${c} y esta por encima de la EMA ${l}. Al revés, «Bajista». Si no, «Rango».`)
      await espera(p, 5.4)
      await desmarcar(p)
      const fm = await verHerramienta(p, es.an.h.medias, 'SMA 20')
      await marcar(p, fm.valor)
      await r(`«Medias móviles» enseña además las SMA ${PERIODOS_MEDIAS.sma.join(', ')} y las EMA ${PERIODOS_MEDIAS.ema.join(', ')}. Aquí cada vela es ${VELA1 === 'día' ? 'un día' : 'una hora'}.`)
      await espera(p, 5)
      await desmarcar(p)
      await r('Las medias miran hacia atrás: llegan tarde a los giros y no dicen qué va a pasar.')
      await espera(p, 4.4)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
  'm5-2': {
    desc: 'Video sin voz: el Analizador con los datos reales de ese día. Se señalan el RSI y el ATR de un par, y después el Stop-loss de la tarjeta, que sale del ATR.',
    async correr(p, r) {
      await analizador(p, r)
      // El rótulo del Stop-loss habla de la geometría de la app: se fija ese método.
      await chip(p, es.an.metodo.app)
      await espera(p, 0.6)
      const f = await verHerramienta(p, es.an.h.rsi, es.an.h.rsi)
      const rsiV = exigir(await fila(p, es.an.h.rsi), 'el RSI')
      await marcar(p, f.valor)
      await r(`RSI de EUR/USD: ${rsiV}. Va de 0 a 100 y mira las últimas ${PERIODO_RSI} velas.`)
      await espera(p, 4.6)
      await r(RSI_MAX == null ? 'En esta app el RSI es un dato: no decide qué experimentos aparecen.' : `En esta app sí cuenta: no salen experimentos para comprar con RSI de ${RSI_MAX} o más, ni para vender con ${100 - RSI_MAX} o menos.`)
      await espera(p, 5)
      await desmarcar(p)
      const fa = await verHerramienta(p, es.an.h.atr, es.an.h.atr)
      const atr = exigir(await fila(p, es.an.h.atr), 'el ATR')
      await marcar(p, fa.valor)
      await r(`ATR: ${atr}. Es lo que suele recorrer el par en ${VELA1 === 'día' ? 'un día' : 'una hora'} (media de ${PERIODO_ATR} velas).`)
      await espera(p, 4.8)
      await desmarcar(p)
      const fs = await filaLoc(p, es.an.stop)
      await llevar(p, fs.rotulo, 200)
      const sl = exigir(await fila(p, es.an.stop), 'el Stop-loss')
      await marcar(p, fs.valor)
      await r(`Stop-loss: ${sl}. ${APP === 'swing' ? `Va por fuera del mínimo de 10 días, con ${coma(MC.COJIN_ATR_STOP)} ATR de cojín` : `Va a ${coma(MC.ATR_STOP)} ATR del precio`}: así el ruido normal no lo toca.`)
      await espera(p, 5.4)
      await desmarcar(p)
      await r('Un RSI alto no dice que vaya a darse la vuelta. Y el ATR no tiene dirección: solo dice cuánto se mueve.')
      await espera(p, 4.8)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
  'm5-3': {
    desc: 'Video sin voz: el Analizador con los datos reales de ese día. Se señalan el soporte y la resistencia de un par y después su compresión, con la palabra que dice qué tan raro es ese número.',
    async correr(p, r) {
      await analizador(p, r)
      await r('No siempre hay tendencia: a veces el precio va de lado, entre un piso y un techo. Eso es un rango.')
      await espera(p, 4.6)
      const f = await verHerramienta(p, es.an.h.niveles, es.an.h.niveles)
      const sr = exigir(await fila(p, es.an.h.niveles), 'el soporte y la resistencia')
      const [sop, res] = sr.split('·').map((x) => x.trim())
      await marcar(p, f.valor)
      await r(`EUR/USD: soporte ${sop} y resistencia ${res}, el mínimo y el máximo de las últimas 20 velas.`)
      await espera(p, 5)
      await desmarcar(p)
      const fc = await verHerramienta(p, es.an.h.compresion, es.an.h.compresion)
      const cv = exigir(await fila(p, es.an.h.compresion), 'la compresión')
      await marcar(p, fc.valor)
      await r(`Compresión: ${cv}. Es el ATR de ahora dividido por el de hace ${MC.VELAS_ATRAS_COMPRESION} velas.`)
      await espera(p, 5)
      await r('Por debajo de 1 se mueve menos que antes: está apretado. La palabra dice qué tan raro es ese número aquí.')
      await espera(p, 5)
      await desmarcar(p)
      await r(APP === 'swing' ? 'Esta app no tiene modo de rango: estos datos son para tu propio análisis.' : `El modo rango de esta app solo actúa con la compresión en ${coma(MC.COMPRESION_MIN)} o más y el precio cerca del piso o del techo.`)
      await espera(p, 4.8)
      await r('Que esté apretado no dice hacia qué lado se va a soltar, ni cuándo.')
      await espera(p, 4)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
  'm6-1': {
    desc: 'Video sin voz: el Barrido con los datos reales de ese día. Se señala la tarjeta «Lo que cuesta abrir la operación» y el spread de un par con dólar y el de un cruce.',
    async correr(p, r) {
      await r('Cada par tiene dos precios: el de venta (BID) y el de compra (ASK). La diferencia es el spread.')
      await espera(p, 4.6)
      const caja = cajaDe(p, 'Lo que cuesta abrir la operación')
      await llevar(p, caja, 20)
      await espera(p, 0.8)
      const mayor = exigir(await filaSpread(p, 'EUR/USD'), 'la fila de EUR/USD (¿puente apagado?)')
      await marcar(p, mayor.loc)
      await r(`EUR/USD: venta ${mayor.bid} y compra ${mayor.ask}. La diferencia, ${mayor.spread} pips, es lo que cuesta entrar.`)
      await espera(p, 5.4)
      await desmarcar(p)
      const cruce = exigir(await filaSpread(p, 'EUR/NZD'), 'la fila de EUR/NZD')
      await marcar(p, cruce.loc)
      await r(`EUR/NZD, un cruce: ${cruce.spread} pips. Los cruces suelen costar más que los pares con dólar.`)
      await espera(p, 5)
      await desmarcar(p)
      await r('Toda operación empieza perdiendo el spread. Y se abre de golpe con las noticias fuertes y de madrugada.')
      await espera(p, 5)
      await r('Son los precios de una cuenta real del desarrollador de la app. Los de tu bróker pueden ser otros.')
      await espera(p, 4.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'm6-2': {
    desc: 'Video sin voz: el Barrido con los datos reales de ese día. Se abre la tarjeta «Tasas de interés y swap» y se señala la diferencia de tasas de un par y hacia qué lado juega el swap.',
    async correr(p, r) {
      await r('Si la operación sigue abierta de noche, se paga o se cobra un swap. Cada noche.')
      await espera(p, 4.4)
      const t = tarjeta(p, es.tasas.titulo)
      await llevar(p, t, 20)
      await abrirTarjeta(p, es.tasas.titulo)
      await r('El swap sale de la diferencia entre las tasas de interés de las dos divisas del par.')
      await espera(p, 4.4)
      const f = exigir(await filaTasa(p), 'la primera fila de «Tasas de interés y swap»')
      await llevar(p, f.loc, 220)
      await marcar(p, f.loc)
      await r(`${f.par}: ${f.dif} puntos al año de diferencia. ${f.lado}.`)
      await espera(p, 5.2)
      await desmarcar(p)
      await r('Pero tu bróker le suma un margen que no publica nadie. La diferencia de tasas NO es tu swap.')
      await espera(p, 5)
      await r('Un día de la semana cuenta triple, por el fin de semana. Cuál día lo dice cada bróker.')
      await espera(p, 4.6)
      await r('Un swap a favor no es una razón para abrir: es un coste o un ingreso, no una dirección.')
      await espera(p, 4.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'm6-3': {
    desc: 'Video sin voz: el Analizador con los datos reales de ese día. Se arma una tarjeta y se señala el spread del par y cuánto pesa comparado con su Stop-loss.',
    async correr(p, r) {
      await analizador(p, r)
      await chip(p, es.an.metodo.app)
      await r('El spread se paga en pips. Lo que importa es cuánto pesa comparado con tu Stop-loss.')
      await espera(p, 4.6)
      const fs = await filaLoc(p, es.an.stop)
      const stop = exigir(await fila(p, es.an.stop), 'el Stop-loss de la tarjeta')
      await llevar(p, fs.rotulo, 200)
      await marcar(p, fs.valor)
      await r(`Stop-loss de esta tarjeta: ${stop}. Es la distancia que arriesgas.`)
      await espera(p, 4.2)
      await desmarcar(p)
      const fp = await verHerramienta(p, es.an.h.spread, 'Spread / Stop-loss')
      const peso = exigir(await fila(p, 'Spread / Stop-loss'), 'el peso del spread (¿puente apagado?)')
      const sp = exigir(await fila(p, 'Spread'), 'el spread del par')
      await marcar(p, fp.valor)
      await r(`Spread ${sp.replace('.', ',')}: se lleva el ${peso.replace('.', ',').replace('%', ' %')} del riesgo de esta operación.`)
      await espera(p, 5)
      await desmarcar(p)
      await r(APP === 'swing'
        ? 'Aquí los Stop-loss miden días: suelen ser varias veces más largos que en la app de intradía, y allí el mismo spread pesa unas cuatro veces más.'
        : 'Aquí los Stop-loss miden horas: suelen ser varias veces más cortos que en la app de swing, y el mismo spread pesa unas cuatro veces más.')
      await espera(p, 5.6)
      await r('Cuanto más pesa el coste, más hay que acertar solo para empatar.')
      await espera(p, 4.2)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
  'm7-1': {
    desc: 'Video sin voz: el Barrido con el calendario real de la mañana del día de la grabación. Se abre la tarjeta «Calendario económico» y se señalan la hora, la divisa y cuánto suele mover una noticia.',
    reloj: relojCalendario,
    async correr(p, r) {
      await r(`Calendario real, con el reloj puesto el ${fechaReloj()}: así se veían las noticias que venían.`)
      await espera(p, 5)
      const t = tarjeta(p, 'Calendario económico')
      await llevar(p, t, 20)
      await abrirTarjeta(p, 'Calendario económico')
      await r('Son las publicaciones de datos económicos de las 8 divisas, en las próximas horas.')
      await espera(p, 4.4)
      const f = exigir(await filaNoticia(p), 'la primera noticia del calendario')
      await llevar(p, f.loc, 200)
      await marcar(p, f.loc)
      const imp = [es.calendario.alto, es.calendario.medio, es.calendario.feriado].find((x) => x && f.linea2.includes(x))
      await r(`${f.hora}: ${f.div}, «${f.titulo}».${imp ? ` Dice «${imp}».` : ''}`)
      await espera(p, 5.4)
      await desmarcar(p)
      await r('La hora es la de tu teléfono. «Mueve mucho» o «Mueve algo» dice cuánto suele sacudir el precio.')
      await espera(p, 5)
      await r('Minutos antes y después de una noticia fuerte el precio pega saltos y el spread se abre.')
      await espera(p, 4.6)
      await r('El calendario dice CUÁNDO puede haber sacudida, no hacia dónde se va a mover el precio.')
      await espera(p, 4.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'm7-2': {
    desc: 'Video sin voz: el calendario real de la mañana del día de la grabación. Se señalan el previsto y el anterior de una noticia y se abre su «¿Qué significa?».',
    reloj: relojCalendario,
    async correr(p, r) {
      await r(`Calendario real, con el reloj puesto el ${fechaReloj()}.`)
      await espera(p, 4)
      await abrirTarjeta(p, 'Calendario económico')
      const f = exigir(await filaNoticia(p, CAL.ev.t), `la noticia «${CAL.ev.t}»`)
      await llevar(p, f.loc, 160)
      const linea = exigir((f.linea2.match(/(previsto[^\n]*)/i) || [])[1], 'el previsto y el anterior')
      await marcar(p, f.loc)
      await r(`${f.div}, «${f.titulo}»: ${linea.replace(/\s+/g, ' ').trim()}.`)
      await espera(p, 5)
      await r('«Anterior» es lo que salió la última vez. «Previsto», lo que esperan los analistas ahora.')
      await espera(p, 5)
      await desmarcar(p)
      const boton = f.loc.locator('button[aria-expanded]', { hasText: es.explica.boton }).first()
      await marcar(p, boton)
      await espera(p, 1)
      await boton.click()
      await desmarcar(p)
      await espera(p, 0.8)
      const caja = f.loc.locator('[id]').last()
      const texto = await caja.innerText()
      const comp = exigir((texto.match(/Se espera que salga (MÁS ALTO|MÁS BAJO|IGUAL)/) || [])[1], 'la comparación de «¿Qué significa?»')
      await llevar(p, caja, 120)
      await marcar(p, caja)
      await r(`«¿Qué significa?» lo dice en palabras sencillas: se espera ${comp.toLowerCase()} que la vez anterior.`)
      await espera(p, 5.2)
      await desmarcar(p)
      await r('Lo que suele mover el precio es la SORPRESA: cuánto se aleja el dato real de lo previsto.')
      await espera(p, 5)
      await r('Que se espere más alto o más bajo no dice hacia dónde irá el precio.')
      await espera(p, 4.2)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'm7-3': {
    desc: 'Video sin voz: el Barrido con las noticias reales del día de la grabación. Se abre la tarjeta «Noticias de los bancos centrales» y se señala un titular con su divisa, su fuente y su fecha.',
    async correr(p, r) {
      await r('Lo último que publicaron la Reserva Federal, el BCE, el Banco de Nueva Zelanda e ING.')
      await espera(p, 4.6)
      const t = tarjeta(p, 'Noticias de los bancos centrales')
      await llevar(p, t, 20)
      await abrirTarjeta(p, 'Noticias de los bancos centrales')
      await r('Primero el aviso: una noticia dice qué pasó y cuándo, nunca hacia dónde va el precio.')
      await espera(p, 4.6)
      const enlace = exigir(await p.locator('main a[target="_blank"]').count(), 'un titular en la tarjeta de noticias') && p.locator('main a[target="_blank"]').first()
      const bloque = enlace.locator('xpath=ancestor::*[self::div or self::li][1]')
      const div = exigir((await bloque.innerText()).match(/\b(USD|EUR|JPY|GBP|CHF|CAD|AUD|NZD)\b/)?.[1], 'la divisa del titular')
      await llevar(p, bloque, 220)
      await marcar(p, bloque)
      await r(`Cada titular lleva delante su divisa (aquí ${div}), y debajo la fuente y la fecha.`)
      await espera(p, 5)
      await desmarcar(p)
      await r('Van tal cual los publica cada fuente, en su idioma. Al tocarlo se abre la noticia completa en su página.')
      await espera(p, 5)
      await r('Solo salen fuentes cuyas condiciones permiten reproducir sus titulares en una app de pago.')
      await espera(p, 4.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
}

// Módulo 7: el calendario se graba con la hora de la mañana del día de los
// datos, para que haya noticias por venir. Se elige la primera noticia con
// previsto y anterior del archivo de ESTA app, y el reloj se pone 2 horas antes.
const CAL = { ev: null, reloj: null }
async function relojCalendario(datos) {
  const cal = JSON.parse(await readFile(join(datos, APP === 'swing' ? 'swing' : 'intradia', 'estado/calendario.json'), 'utf8'))
  const ev = exigir((cal.eventos || []).filter((e) => e.f && e.p).sort((a, b) => new Date(a.d) - new Date(b.d))[0], 'una noticia con previsto y anterior en el calendario')
  const r = new Date(new Date(ev.d).getTime() - 2 * 3600e3)
  r.setUTCMinutes(0, 0, 0)
  CAL.ev = ev
  CAL.reloj = r
  return r
}
const fechaReloj = () => {
  const r = CAL.reloj
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${r.getUTCDate()} de ${meses[r.getUTCMonth()]} de ${r.getUTCFullYear()}, ${String(r.getUTCHours()).padStart(2, '0')}:00 UTC`
}

// Una noticia del calendario, buscada por su nombre o la primera de la lista.
async function filaNoticia(p, titulo = null) {
  const datos = await p.evaluate((titulo) => {
    const caja = [...document.querySelectorAll('.card')].filter((c) => c.textContent.includes('Calendario económico')).pop()
    if (!caja) return null
    const bdis = [...caja.querySelectorAll('bdi')].filter((b) => b.parentElement.tagName === 'SPAN' && b.parentElement.style.flex)
    const b = titulo ? bdis.find((x) => x.textContent.trim() === titulo) : bdis[0]
    if (!b) return null
    const fila = b.parentElement.parentElement.parentElement
    fila.dataset.noticia = '1'
    const [hora, div] = [...b.parentElement.parentElement.children].map((x) => x.textContent.trim())
    const linea2 = fila.children[1]?.innerText || ''
    return { hora, div, titulo: b.textContent.trim(), linea2 }
  }, titulo)
  return datos && { ...datos, loc: p.locator('[data-noticia]') }
}

// Módulo 6: una fila de «Lo que cuesta abrir la operación», leída de la pantalla.
async function filaSpread(p, par) {
  const datos = await p.evaluate((par) => {
    const caja = [...document.querySelectorAll('.card')].filter((c) => c.textContent.includes('Lo que cuesta abrir la operación')).pop()
    if (!caja) return null
    const celdas = [...caja.querySelectorAll('span.mono')]
    const i = celdas.findIndex((s) => s.textContent.trim() === par)
    if (i < 0) return null
    celdas[i + 3].dataset.filaSpread = par
    return { bid: celdas[i + 1].textContent.trim(), ask: celdas[i + 2].textContent.trim(), spread: celdas[i + 3].textContent.trim().replace('.', ',') }
  }, par)
  // Se marca la celda del spread, no la tabla entera.
  return datos && { ...datos, loc: p.locator(`[data-fila-spread="${par}"]`) }
}

// Módulo 6: la primera fila de «Tasas de interés y swap» (la de mayor diferencia).
async function filaTasa(p) {
  const datos = await p.evaluate((titulo) => {
    const caja = [...document.querySelectorAll('.card')].filter((c) => c.textContent.includes(titulo)).pop()
    if (!caja) return null
    const par = [...caja.querySelectorAll('.mono')].find((s) => s.children.length === 0 && /^[A-Z]{3}\/[A-Z]{3}$/.test(s.textContent.trim()))
    if (!par) return null
    // par → su columna (par + lado) → la fila (columna + diferencia).
    const fila = par.parentElement.parentElement
    fila.dataset.filaTasa = '1'
    const texto = fila.innerText
    const dif = (texto.match(/[+−-]\d+(?:\.\d+)?/) || [])[0]
    return { par: par.textContent.trim(), dif: dif ? dif.replace('.', ',') : null, texto }
  }, es.tasas.titulo)
  if (!datos || !datos.dif) return null
  const lado = Object.values(es.tasas.lado).find((l) => datos.texto.includes(l))
  return lado ? { ...datos, lado, loc: p.locator('[data-fila-tasa]') } : null
}

async function grabar(datos, id) {
  const escena = ESCENAS[id] || ESCENAS_HERRAMIENTAS[id]
  if (!escena) throw new Error(`No hay escena «${id}»`)
  const tmp = join(datos, '..', `grabando-${id}`)
  await rm(tmp, { recursive: true, force: true })
  const reloj = escena.reloj ? await escena.reloj(datos) : null
  const { b, ctx, p, errores } = await abrir(chromium, { datos, video: tmp, consulta: escena.consulta || '', reloj })
  const r = await ponerRotulo(p)
  await escena.correr(p, r, datos)
  await ctx.close()
  await b.close()
  if (errores.length) throw new Error(`${id}: errores en la página: ${errores.join(' · ')}`)
  const [crudo] = (await readdir(tmp)).filter((f) => f.endsWith('.webm'))
  const entrada = join(tmp, crudo)
  // El primer segundo es la app cargando: fuera.
  const corte = ['-ss', '1.2']
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...corte, '-i', entrada, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', '-an', join(VIDEOS, `${id}.webm`)])
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...corte, '-i', entrada, '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', join(VIDEOS, `${id}.mp4`)])
  await rm(tmp, { recursive: true, force: true })
  console.log(`✓ ${id}`)
}

const args = process.argv.slice(2)
if (args[0] === '--bajar') {
  await bajar(exigir(args[1], 'la carpeta de datos'))
} else if (args[0] === '--descripciones') {
  for (const [id, e] of Object.entries(ESCENAS)) console.log(id, '→', e.desc)
} else {
  const datos = exigir(args[0], 'la carpeta de datos (node grabar.mjs <carpeta> [ids])')
  const ids = args.length > 1 ? args.slice(1) : [...Object.keys(ESCENAS), ...Object.keys(ESCENAS_HERRAMIENTAS)]
  for (const id of ids) await grabar(datos, id)
}

export { ESCENAS }
