// Graba los videos del curso (2026-11-19).
//
// Uso (desde app/):
//   1. bajar los datos reales:   node scripts/videos/grabar.mjs --bajar <carpeta>
//   2. construir el banco:       npx vite build --config scripts/videos/vite.config.js
//   3. grabar:                   node scripts/videos/grabar.mjs <carpeta> m0-1 m1-2 …   (sin ids: todos)
//
// Cada video sale en `public/curso/videos/<id>.webm` y `.mp4`. Desde el
// 2026-11-21 llevan voz (Studio-B), que dice lo mismo que el rótulo de abajo:
// ver `voz.mjs` y `--voz`. La app es la de verdad, con los
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
import { MINIMO_PARA_ENSEÑAR, margen } from '../../src/lib/diagnostico.js'
import { aciertoDeEquilibrio } from '../../src/lib/laboratorio.js'
import * as MC from '../../src/lib/marketCalc.js'
import { PERIODOS_MEDIAS, PERIODO_ATR, PERIODO_RSI, RSI_MAX, UMBRAL_FUERZA, VENTANAS_FUERZA } from '../../src/lib/marketCalc.js'
import { APP } from '../../src/lib/identidad.js'
import { HERRAMIENTAS } from '../../src/lib/curso/herramientas.js'
import { apuntarTextos, duraciones, leerTextos, mezclar, rotuloConVoz } from './voz.mjs'

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
  'm8-1': {
    desc: 'Video sin voz: el Diario de un usuario de ejemplo con dos operaciones abiertas que comparten el euro, y la tarjeta de «Riesgo concentrado» que sale sola.',
    consulta: '?diario=juntas',
    async correr(p, r) {
      await irA(p, 'Diario')
      await r('Un usuario de EJEMPLO con dos operaciones abiertas: compra EUR/USD y compra EUR/CHF.')
      await espera(p, 4.6)
      // La tarjeta del aviso no es `.card`: es la caja que envuelve su título.
      const caja = p.getByText(es.diario.riesgoConcentrado, { exact: true }).first().locator('xpath=..')
      await llevar(p, caja, 60)
      const texto = exigir(await caja.innerText().catch(() => null), 'la tarjeta de «Riesgo concentrado»')
      const m = exigir(texto.match(/Tienes (\d+) operaciones abiertas con ([A-Z]{3}) \(([^)]+)\)/), 'el aviso de riesgo concentrado')
      await marcar(p, caja)
      await r(`El Diario lo avisa solo: ${m[1]} operaciones abiertas con ${m[2]} (${m[3]}).`)
      await espera(p, 5)
      await r('No son dos apuestas: es una sola apuesta más grande al euro. Si el euro cae, pierden las dos.')
      await espera(p, 5)
      await desmarcar(p)
      await r('Arriesgando el 1 % en cada una, la idea «el euro sube» tiene en juego el 2 %.')
      await espera(p, 4.6)
      await r('El aviso no dice cuál cerrar ni que estén mal: dice que dependen de lo mismo.')
      await espera(p, 4.4)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'm8-2': APP === 'swing'
    ? {
        desc: 'Video sin voz con los datos reales de ese día. En la app de swing, la tarjeta «Correlación entre pares» del tablero completo.',
        async correr(p, r) {
          await r('La correlación mide cuánto se han movido dos pares al mismo tiempo. Va de −1 a +1.')
          await espera(p, 4.6)
          await abrirTablero(p)
          const t = tarjeta(p, 'Correlación entre pares')
          await llevar(p, t, 20)
          await abrirTarjeta(p, 'Correlación entre pares')
          const dato = await p.evaluate(() => {
            const filas = [...document.querySelectorAll('main .mono')].filter((x) => /^[A-Z]{3}\/[A-Z]{3} · [A-Z]{3}\/[A-Z]{3}$/.test(x.textContent.trim()))
            if (!filas.length) return null
            const leer = (f) => ({ pareja: f.textContent.trim(), r: f.parentElement.parentElement.lastElementChild.textContent.trim(), caja: f.parentElement.parentElement })
            const todas = filas.map(leer)
            const pos = todas[0]
            const neg = todas.find((x) => /^[−-]/.test(x.r))
            pos.caja.dataset.correl = 'pos'
            if (neg) neg.caja.dataset.correl = 'neg'
            return { pos: { pareja: pos.pareja, r: pos.r }, neg: neg ? { pareja: neg.pareja, r: neg.r } : null }
          })
          exigir(dato, 'una pareja en la tarjeta de correlación')
          const f = p.locator('[data-correl="pos"]')
          await llevar(p, f, 240)
          await marcar(p, f)
          await r(`${dato.pos.pareja}: ${dato.pos.r.replace('.', ',')}. Se calcula con los cambios de cada día de las últimas 60 sesiones.`)
          await espera(p, 5.2)
          await desmarcar(p)
          if (dato.neg) {
            const g = p.locator('[data-correl="neg"]')
            await llevar(p, g, 240)
            await marcar(p, g)
            await r(`${dato.neg.pareja}: ${dato.neg.r.replace('.', ',')}. Negativa: uno sube cuando el otro baja. Para el riesgo pesa igual.`)
            await espera(p, 5.2)
            await desmarcar(p)
          }
          await r('Los dos comprados, si van juntos, es una apuesta doble. Uno comprado y otro vendido, se anulan.')
          await espera(p, 5)
          await r('La correlación no dice hacia dónde irá ninguno de los dos.')
          await espera(p, 4)
          await r(FIN)
          await espera(p, 2.8)
        },
      }
    : {
        desc: 'Video sin voz: la pestaña Avisos de la app de intradía, con el aviso «Dos de tus pares se mueven igual», que usa la correlación que mide la app de swing.',
        async correr(p, r) {
          await r('La correlación mide cuánto se han movido dos pares al mismo tiempo. Va de −1 a +1.')
          await espera(p, 4.6)
          await r('Esta app no la calcula: con velas de una hora, 60 velas son solo dos días y medio.')
          await espera(p, 4.8)
          await irA(p, 'Avisos')
          const t = tarjeta(p, es.intel.titulo)
          await llevar(p, t, 20)
          await abrirTarjeta(p, es.intel.titulo)
          const tit = p.getByText(es.intel.correlacionTitulo, { exact: true }).first()
          await llevar(p, tit, 200)
          const caja = tit.locator('xpath=ancestor::*[self::div or self::label][2]')
          const texto = exigir(await caja.innerText().catch(() => null), 'el aviso de correlación')
          const umbral = exigir((texto.match(/correlación de ([\d.,]+)/) || [])[1], 'el umbral del aviso de correlación')
          await marcar(p, caja)
          await r(`El aviso «${es.intel.correlacionTitulo}» salta con una correlación de ${umbral.replace('.', ',')} o más. Lo mide la app de swing con velas diarias.`)
          await espera(p, 5.4)
          await desmarcar(p)
          await r('Los dos comprados, si van juntos, es una apuesta doble. Uno comprado y otro vendido, se anulan.')
          await espera(p, 5)
          await r('La correlación no dice hacia dónde irá ninguno de los dos.')
          await espera(p, 4)
          await r(FIN)
          await espera(p, 2.8)
        },
      },

  'm8-3': {
    desc: APP === 'swing'
      ? 'Video sin voz: el Barrido con los datos reales de ese día. Se señala el dólar en el ranking de fuerza y después la tarjeta del oro, con su número frente a los pares con dólar y frente a los cruces.'
      : 'Video sin voz: el Barrido con los datos reales de ese día. Se señala el dólar en el ranking de fuerza y la lista de pares que lo llevan.',
    async correr(p, r) {
      await r('Siete de los pares que siguen las apps llevan el dólar. Si el dólar se mueve, se mueven todos a la vez.')
      await espera(p, 5)
      const ranking = await rankingFuerza(p)
      const i = ranking.findIndex((x) => x[0] === 'USD')
      exigir(i >= 0 ? ranking[i] : null, 'el dólar en el ranking')
      const fila = p.locator('[data-ranking] > *').nth(i)
      await llevar(p, fila, 160)
      await marcar(p, fila)
      await r(`El dólar hoy: ${ranking[i][1].replace('.', ',')} de 10, el ${i + 1}.º de las 8 divisas.`)
      await espera(p, 4.8)
      await desmarcar(p)
      await r('Comprar EUR/USD y vender USD/CHF son lo mismo: las dos venden dólar. No es repartir el riesgo.')
      await espera(p, 5.2)
      if (APP === 'swing') {
        const t = tarjeta(p, 'Oro')
        await llevar(p, t, 20)
        await abrirTarjeta(p, 'Oro')
        const dato = await p.evaluate(() => {
          const filas = [...document.querySelectorAll('main .mono')].filter((x) => /^[A-Z]{3}\/[A-Z]{3}$/.test(x.textContent.trim()) && x.closest('.card')?.innerText.includes('Cuánto se mueve el oro'))
          if (!filas.length) return null
          const pares = filas.map((f) => f.textContent.trim())
          const conUsd = pares.filter((x) => x.includes('USD')).length
          const caja = filas[0].parentElement.parentElement
          caja.dataset.oro = '1'
          return { n: pares.length, conUsd, par: pares[0], r: caja.lastElementChild?.textContent.trim() }
        })
        if (dato) {
          const f = p.locator('[data-oro]')
          await llevar(p, f, 250)
          await marcar(p, f)
          await r(`El oro suele ir al revés que el dólar. Hoy se mueve más con ${dato.par} (${dato.r.replace('.', ',')}). De los ${dato.n} pares de la lista, ${dato.conUsd} llevan dólar.`)
          await espera(p, 6)
          await desmarcar(p)
        } else {
          const vacio = p.getByText(es.oro.sinCorrel, { exact: true }).first()
          exigir(await vacio.count(), 'el mensaje de la tarjeta del oro sin parejas')
          await llevar(p, vacio, 220)
          await marcar(p, vacio)
          await r('El oro suele ir al revés que el dólar. Pero hoy ningún par pasa de 0,5 con él, y la tarjeta lo dice: eso también es un dato.')
          await espera(p, 5.6)
          await desmarcar(p)
        }
      } else {
        await r('El oro suele ir al revés que el dólar. La tarjeta que lo mide está en la app de swing.')
        await espera(p, 4.8)
      }
      await r('Que el oro baje no dice que el dólar vaya a subir. Es una costumbre, no una ley.')
      await espera(p, 4.4)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  // ─── Módulo 9 ───────────────────────────────────────────────────────────────
  'm9-1': {
    desc: 'Video sin voz: el Analizador con los datos reales de ese día. Se elige un par sin dirección (la tarjeta pide elegirla), después COMPRA y VENTA, y se ve cómo el Stop-loss y el Take-profit se dan la vuelta.',
    async correr(p, r) {
      await analizador(p, r, { conLado: false })
      await r('El Analizador tiene cuatro pasos: el par, tu dirección, cómo poner el Stop-loss y qué herramientas ver.')
      await espera(p, 4.6)
      const sinLado = p.getByText(es.an.motivo.sinLado, { exact: true }).first()
      exigir(await sinLado.count(), 'el aviso de la tarjeta sin dirección')
      await llevar(p, sinLado, 200)
      await marcar(p, sinLado)
      await r(`Con el par elegido y sin dirección, la tarjeta solo dice: «${es.an.motivo.sinLado}»`)
      await espera(p, 4.6)
      await desmarcar(p)
      await r('La dirección no la elige la app, a propósito: sería una señal más, y sus señales todavía son experimentos.')
      await espera(p, 5)
      const niveles = async () => ({
        stop: exigir(await fila(p, es.an.stop), 'el Stop-loss de la tarjeta'),
        tp: exigir(await fila(p, es.an.objetivo), 'el Take-profit de la tarjeta'),
        entrada: exigir(await fila(p, es.an.entrada), 'la entrada de la tarjeta'),
      })
      for (const [lado, texto] of [['COMPRA', (n) => `COMPRA: entrada ${n.entrada}. Stop-loss ${n.stop}, por DEBAJO. Take-profit ${n.tp}, por ENCIMA.`], ['VENTA', (n) => `VENTA: se dan la vuelta. Stop-loss ${n.stop}, por ENCIMA. Take-profit ${n.tp}, por DEBAJO.`]]) {
        await llevar(p, p.getByText(es.an.paso2, { exact: false }).first(), 20)
        const b = p.locator('main button', { hasText: new RegExp(`^${lado}$`) }).first()
        await marcar(p, b)
        await b.click()
        await espera(p, 1)
        await desmarcar(p)
        const fs = await filaLoc(p, es.an.stop)
        await llevar(p, fs.rotulo, 200)
        await marcar(p, fs.rotulo.locator('xpath=..'))
        await r(texto(await niveles()))
        await espera(p, 5.4)
        await desmarcar(p)
        if (lado === 'COMPRA') {
          // El lote se enseña con la primera dirección: con la otra el
          // Stop-loss puede quedar tan lejos que el lote sale por debajo de
          // 0,01 y se lee «0.00», que confunde más de lo que enseña.
          const lote = exigir(await fila(p, es.an.lote), 'el lote de la tarjeta')
          const fl = await filaLoc(p, es.an.lote)
          await marcar(p, fl.valor)
          await r(`El lote sale del perfil de riesgo del usuario de EJEMPLO: ${lote}. Si cambia la distancia del Stop-loss, el lote se ajusta para arriesgar lo mismo.`)
          await espera(p, 5.2)
          await desmarcar(p)
        }
      }
      await r('La tarjeta dice dónde quedan los niveles si eliges esa dirección. No dice si la dirección es buena.')
      await espera(p, 4.8)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'm9-2': {
    desc: 'Video sin voz: el Analizador de un usuario de ejemplo con dos pérdidas hoy y dos operaciones abiertas con el euro. Se arma una tarjeta de EUR/USD con los datos reales de ese día y se revisan las cuatro preguntas: R/B y lote, el freno, el calendario y el Diario.',
    consulta: '?diario=chequeo',
    async correr(p, r) {
      await analizador(p, r)
      await chip(p, es.an.h.calendario)
      await chip(p, es.an.h.diario)
      await espera(p, 0.6)
      await r('Un usuario de EJEMPLO: hoy lleva dos pérdidas y tiene dos operaciones abiertas con el euro. Arma una tarjeta de EUR/USD.')
      await espera(p, 5)
      await r('Antes de decidir, cuatro preguntas. La tarjeta las contesta todas en el mismo sitio.')
      await espera(p, 4.2)
      // 1 · R/B y lote
      const frb = await filaLoc(p, 'R/B')
      await llevar(p, frb.rotulo, 230)
      const rb = exigir(await fila(p, 'R/B'), 'el R/B de la tarjeta').replace(/\s/g, '').replace('.', ',')
      const lote = exigir(await fila(p, es.an.lote), 'el lote de la tarjeta')
      await marcar(p, frb.valor)
      const bajo = await p.getByText(es.an.rrBajo, { exact: true }).count()
      await r(`1 · ¿Cuánto arriesgas y cuánto buscas ganar? R/B ${rb}; lote y riesgo: ${lote}.${bajo ? ' Y la tarjeta avisa en ámbar: arriesgas más de lo que buscas ganar.' : ''}`)
      await espera(p, 5.6)
      await desmarcar(p)
      // 2 · el freno
      const textoFreno = (await p.getByText(es.an.frenoRojo, { exact: true }).count()) ? es.an.frenoRojo : es.an.frenoCerca
      const freno = p.getByText(textoFreno, { exact: true }).first()
      exigir(await freno.count(), 'el aviso del freno en la tarjeta')
      await llevar(p, freno, 200)
      await marcar(p, freno)
      await r(`2 · ¿Cómo va tu día? La tarjeta lo dice: «${textoFreno}»`)
      await espera(p, 5.2)
      await desmarcar(p)
      // 3 · el calendario
      const cal = exigir(await seccionCalendario(p), 'la sección del calendario')
      await llevar(p, cal.loc, 200)
      await marcar(p, cal.loc)
      const sinNoticias = cal.texto.includes(es.an.calendarioVacio)
      const nEv = sinNoticias ? 0 : cal.texto.split('\n').length - 1
      await r(sinNoticias
        ? '3 · ¿Hay noticias de estas dos divisas? Hoy la tarjeta dice que no hay ninguna en las próximas 48 horas.'
        : `3 · ¿Hay noticias de estas dos divisas? La tarjeta enseña ${nEv} en las próximas 48 horas, con su hora.`)
      await espera(p, 5.2)
      await desmarcar(p)
      // 4 · el Diario
      const bloq = exigir(await bloqueDe(p, es.an.h.diario), 'el bloque «Mi diario»')
      await llevar(p, bloq, 200)
      await marcar(p, bloq)
      const abiertas = exigir(await fila(p, es.an.diarioAbiertas), 'las abiertas que comparten divisa')
      exigir(await p.getByText(es.an.diarioMismaApuesta, { exact: true }).count(), 'el aviso de una sola apuesta')
      await r(`4 · ¿Qué tienes ya abierto? ${abiertas} operaciones comparten divisa con ésta: sumarla puede hacer una sola apuesta más grande.`)
      await espera(p, 5.6)
      await desmarcar(p)
      await r('Nada de eso le impide abrirla: la app no bloquea. Le pone delante lo que su propia regla dice.')
      await espera(p, 4.8)
      const prac = p.locator('main button', { hasText: es.an.practicar }).first()
      await llevar(p, prac, 260)
      await marcar(p, p.locator('main button', { hasText: es.an.anotar }).first())
      await r('Si la abre en su bróker, la anota en el Diario. Si quiere probarla sin dinero, la practica: es el módulo siguiente.')
      await espera(p, 5.2)
      await desmarcar(p)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'm9-3': {
    desc: 'Video sin voz: el Analizador de un usuario de ejemplo. Se cambia «¿Cómo operas?» de tendencias a rangos y cambian las herramientas encendidas; después se guarda una plantilla con su nombre y se vuelve a aplicar otra con un toque.',
    consulta: '?plantillas=ejemplo',
    async correr(p, r) {
      await analizador(p, r)
      const paso4 = p.getByText(es.an.paso4, { exact: false }).first()
      await llevar(p, paso4, 20)
      const antes = exigir(await encendidas(p), 'las herramientas encendidas')
      const linea = p.getByText(es.estilo.tuEstilo, { exact: false }).first().locator('xpath=..')
      await marcar(p, linea)
      await r(`«¿Cómo operas?»: este usuario de EJEMPLO sigue tendencias. El Analizador arranca con ${antes.length} herramientas encendidas.`)
      await espera(p, 5)
      const cambiar = p.locator('main button', { hasText: new RegExp(`^${es.estilo.cambiar}$`) }).first()
      await marcar(p, cambiar)
      await cambiar.click()
      await espera(p, 1)
      const rangos = p.locator('main button', { hasText: es.estilo.rangosT }).first()
      await marcar(p, rangos)
      await r(`Lo cambia a «${es.estilo.rangosT}».`)
      await espera(p, 2.6)
      await rangos.click()
      await espera(p, 1.2)
      await desmarcar(p)
      await llevar(p, paso4, 20)
      const despues = exigir(await encendidas(p), 'las herramientas de rangos')
      await r(`Ahora arranca con ${despues.length}: ${despues.join(', ')}. No cambia ninguna señal ni dice qué estilo es mejor.`)
      await espera(p, 6)
      const input = p.getByPlaceholder(es.an.nombrePlantilla).first()
      await llevar(p, input, 220)
      await marcar(p, input)
      await r('Una plantilla guarda las herramientas encendidas y el método del Stop-loss con un nombre.')
      await input.click()
      await input.pressSequentially('Mis rangos', { delay: 140 })
      await espera(p, 1)
      await input.locator('xpath=..').locator('button').first().click()
      await espera(p, 1)
      await desmarcar(p)
      exigir(await p.getByText(es.an.msg.guardada, { exact: true }).count(), 'el mensaje de plantilla guardada')
      const plantillas = p.getByText(es.an.plantillas, { exact: false }).first()
      await llevar(p, plantillas, 120)
      await marcar(p, p.locator('main button', { hasText: /^Mis rangos$/ }).first())
      await r('Guardada: «Mis rangos» ya está en «Mis plantillas», junto a las otras dos de EJEMPLO.')
      await espera(p, 4.8)
      const tend = p.locator('main button', { hasText: /^Mi tendencia$/ }).first()
      await marcar(p, tend)
      await tend.click()
      await espera(p, 1.2)
      await llevar(p, paso4, 20)
      const conPlantilla = exigir(await encendidas(p), 'las herramientas de la plantilla')
      await r(`Un toque en «Mi tendencia» y el Analizador vuelve a quedar como se guardó: ${conPlantilla.join(', ')}.`)
      await espera(p, 5.6)
      await desmarcar(p)
      await r('Analizar siempre con las mismas herramientas no hace ganar: hace que tus números del Diario hablen de una sola forma de operar.')
      await espera(p, 5.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'm10-1': {
    desc: 'Video sin voz: el Analizador con los datos reales de ese día. Se arma una compra, se pulsa «Practicar esta operación (sin dinero)» y se va al Diario: la operación sale en «Modo práctica» como abierta, con sus niveles, y se abre su gráfica.',
    async correr(p, r) {
      await analizador(p, r)
      const entrada = exigir(await fila(p, es.an.entrada), 'la entrada de la tarjeta')
      const stop = exigir(await fila(p, es.an.stop), 'el Stop-loss de la tarjeta')
      const tp = exigir(await fila(p, es.an.objetivo), 'el Take-profit de la tarjeta')
      await r(`Un usuario de EJEMPLO arma una compra de EUR/USD en el Analizador, con los datos reales de ese día: entrada ${entrada}, Stop-loss ${stop}, Take-profit ${tp}.`)
      await espera(p, 5.6)
      const prac = p.locator('main button', { hasText: es.an.practicar }).first()
      exigir(await prac.count(), 'el botón de practicar')
      await llevar(p, prac, 300)
      await marcar(p, prac)
      await r(`En vez de abrirla en su bróker, pulsa «${es.an.practicar}».`)
      await espera(p, 4)
      // Mientras el precio se conecta, el botón espera: no se guarda con un precio que va a cambiar.
      await p.waitForFunction((txt) => { const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.includes(txt)); return b && !b.disabled }, es.an.practicar, { timeout: 20000 })
      await prac.click()
      await espera(p, 1.2)
      await desmarcar(p)
      const ok = p.getByText(es.an.practicaOk, { exact: false }).first()
      exigir(await ok.count(), 'el mensaje de práctica guardada')
      await marcar(p, ok.locator('xpath=..'))
      await r(`La tarjeta lo confirma: «${es.an.practicaOk}»`)
      await espera(p, 4.6)
      await desmarcar(p)
      await p.locator('main button', { hasText: es.an.practicaVer }).first().click()
      await espera(p, 1.4)
      await abrirTarjeta(p, es.prac.titulo)
      const aviso = p.getByText(es.prac.aviso, { exact: true }).first()
      await llevar(p, aviso, 160)
      await marcar(p, aviso)
      await r('En el Diario, «Modo práctica». Primero el aviso: esto no es dinero real ni una señal, y el resultado no se puede cambiar a mano.')
      await espera(p, 5.4)
      await desmarcar(p)
      const filaAb = await filaPractica(p, 'EUR/USD', es.prac.esperando)
      await llevar(p, filaAb.loc, 200)
      await marcar(p, filaAb.loc)
      await r(`Sale en «Abiertas» con sus niveles (${filaAb.niveles}) y dice «${es.prac.esperando}». Desde ahora la app la sigue sola con los precios reales.`)
      await espera(p, 6)
      await desmarcar(p)
      const ver = filaAb.loc.locator('button', { hasText: es.prac.grafVer }).first()
      await ver.click()
      await espera(p, 1.4)
      const sinVelas = await p.getByText(es.prac.grafSinDatos, { exact: true }).count()
      const graf = filaAb.loc.locator('svg').first()
      if (!sinVelas && (await graf.count())) {
        await llevar(p, graf, 160)
        await marcar(p, graf)
        await r('«Ver la gráfica»: las mismas velas con las que la app decide si ganó o perdió, con la entrada, el Stop-loss y el Take-profit encima.')
      } else {
        await r('La gráfica sale en cuanto el barrido publique las velas de nuevo.')
      }
      await espera(p, 5.6)
      await desmarcar(p)
      await r(APP === 'swing'
        ? 'La revisa cada 15 minutos con las velas diarias del barrido, que se publica dos veces al día. Solo cuentan las velas que empiezan después de crearla.'
        : 'La revisa cada 15 minutos con las velas de una hora del barrido. Solo cuentan las velas que empiezan después de crearla.')
      await espera(p, 6)
      await r('Si una misma vela toca el Stop-loss y el Take-profit, cuenta como perdida: la vela no dice cuál pasó primero y se elige el peor caso.')
      await espera(p, 5.6)
      const borrar = filaAb.loc.locator(`button[aria-label="${es.diario.borrar}"]`).first()
      await llevar(p, filaAb.loc, 200)
      await marcar(p, borrar)
      await r('Mientras está abierta se puede borrar. Una vez resuelta, ganada o perdida, ya no: así el acierto de la práctica no miente.')
      await espera(p, 5.6)
      await desmarcar(p)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'm10-2': {
    desc: 'Video sin voz: el «Modo práctica» de un usuario de ejemplo con operaciones ya resueltas (precios inventados). Se lee el resultado en R, el desglose de una ganada —bruto, spread, swap y neto— y el resultado en dinero.',
    consulta: '?practica=ejemplo',
    async correr(p, r) {
      await irA(p, 'Diario')
      await llevar(p, await abrirTarjeta(p, es.prac.titulo), 90)
      await r('El «Modo práctica» de un usuario de EJEMPLO, con operaciones ya resueltas. Los precios son INVENTADOS: no son los del mercado de hoy.')
      await espera(p, 5.4)
      await r('El resultado no va en pips ni en dólares: va en R. 1 R es lo que arriesgaba. Perder es −1 R; ganar, lo que daba su Take-profit.')
      await espera(p, 6)
      const gan = await filaPractica(p, 'EUR/USD', es.prac.est_ganada)
      await llevar(p, gan.loc, 160)
      await marcar(p, gan.loc)
      const d = exigir(gan.desglose, 'el desglose de la operación ganada')
      await r(`Esta compra de EUR/USD ganó. Bruto ${d.bruto}: lo que dicen sus niveles.`)
      await espera(p, 4.8)
      await r(`El spread se lleva ${d.spread} y el swap de ${d.noches} noches, ${d.swap}. Neto: ${d.neto}.`)
      await espera(p, 6)
      await desmarcar(p)
      const per = await filaPractica(p, 'GBP/USD', es.prac.est_perdida)
      await llevar(p, per.loc, 160)
      await marcar(p, per.loc)
      const dp = exigir(per.desglose, 'el desglose de la perdida')
      await r(`Esta perdió: bruto ${dp.bruto}. Su entrada fue con el precio de MT5, así que el spread ya iba dentro: «${es.prac.cIncluido}».`)
      await espera(p, 6.2)
      await desmarcar(p)
      const sin = await filaPractica(p, 'USD/JPY', es.prac.est_ganada)
      await llevar(p, sin.loc, 160)
      await marcar(p, sin.loc)
      exigir(sin.texto.includes(es.prac.cSinDato), 'el «sin dato» del swap')
      await r(`Ésta no guardó su swap: la tarjeta dice «${es.prac.cSinDato}», nunca un número inventado.`)
      await espera(p, 5)
      await desmarcar(p)
      const resultado = exigir(await valorTras(p, es.prac.sumaL), 'el resultado en R')
      const neto = exigir(await valorTras(p, es.prac.netoL), 'el neto en R')
      const dinero = exigir(await valorTras(p, es.prac.dineroL), 'el resultado en dinero')
      const cab = p.getByText(es.prac.netoL, { exact: false }).first().locator('xpath=../..')
      await llevar(p, p.getByText(es.prac.aciertoL, { exact: false }).first(), 200)
      await marcar(p, cab)
      await r(`Arriba, la suma: ${resultado} bruto y ${neto} neto, con el spread y el swap descontados.`)
      await espera(p, 5.4)
      await desmarcar(p)
      await marcar(p, p.getByText(es.prac.dineroL, { exact: false }).first().locator('xpath=..'))
      await r(`En dinero, con lo que iba a arriesgar en cada una: ${dinero}. No es dinero ganado: es lo que habría sido.`)
      await espera(p, 5.6)
      await desmarcar(p)
      await r('El spread y el swap son los de una cuenta real del desarrollador de la app, no los del bróker de cada uno.')
      await espera(p, 5)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'm10-3': {
    desc: 'Video sin voz: el «Modo práctica» de un usuario de ejemplo con cinco operaciones resueltas (precios inventados). Se lee el acierto con su ±, se ve la insignia «Practicas sin dinero» conseguida y el botón para descargar la tabla.',
    consulta: '?practica=ejemplo',
    async correr(p, r) {
      await irA(p, 'Diario')
      await llevar(p, await abrirTarjeta(p, es.prac.titulo), 90)
      const acierto = exigir(await valorTras(p, es.prac.aciertoL), 'el acierto de la práctica')
      const ganadas = exigir(await valorTras(p, es.prac.opsL), 'las ganadas')
      const n = Number(ganadas.split('/')[1])
      exigir(Number.isFinite(n) && n > 0, 'cuántas resueltas')
      const caja = p.getByText(es.prac.aciertoL, { exact: false }).first().locator('xpath=..')
      await llevar(p, caja, 220)
      await marcar(p, caja)
      await r(`Un usuario de EJEMPLO lleva ${n} operaciones de práctica resueltas (precios inventados). Ganadas: ${ganadas}. Acierto: ${acierto}.`)
      await espera(p, 6)
      await r(`El ±${margen(n)} es cuánto puede moverse ese acierto solo por casualidad. Con ${n} operaciones es enorme: todavía no dice nada.`)
      await espera(p, 6)
      await desmarcar(p)
      const cad = await filaPractica(p, 'NZD/USD', es.prac.est_caducada)
      await llevar(p, cad.loc, 180)
      await marcar(p, cad.loc)
      await r(`Una «${es.prac.est_caducada}» no cuenta: la app no pudo mirarla a tiempo y esas velas ya no se ven. Ni ganada ni perdida.`)
      await espera(p, 5.6)
      await desmarcar(p)
      const exp = p.locator('main button', { hasText: es.exp.descargarPractica }).first()
      await llevar(p, exp, 300)
      await marcar(p, exp)
      await r(`«${es.exp.descargarPractica}» baja todas, también la abierta y la caducada, para mirarlas en una hoja de cálculo.`)
      await espera(p, 5.6)
      await desmarcar(p)
      await abrirTarjeta(p, es.insig.titulo)
      const ins = p.getByText(es.insig.practicaT, { exact: true }).first().locator('xpath=../..')
      exigir(await ins.count(), 'la insignia de la práctica')
      await llevar(p, ins, 220)
      await marcar(p, ins)
      await r(`En «${es.insig.titulo}», «${es.insig.practicaT}» ya está conseguida: cuenta las resueltas, ganadas o perdidas igual. Premia probar antes, no ganar.`)
      await espera(p, 6.2)
      await desmarcar(p)
      await r('Practicar sin dinero no es operar con dinero: con dinero la entrada puede salir peor, y se siente distinto. Sirve para probar una forma de operar antes.')
      await espera(p, 6.2)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
  'm11-1': {
    desc: 'Video sin voz: el Analizador con los datos reales de ese día. Se lee el R/B de la tarjeta y se calcula el acierto que haría falta para no perder; después se cambia el método del Stop-loss a la vara neutra y se ve cómo cambia ese número.',
    async correr(p, r) {
      await analizador(p, r)
      await r('Un acierto solo no dice si una forma de operar gana. Depende de cuánto se gana al acertar y cuánto se pierde al fallar.')
      await espera(p, 5.4)
      const leerRb = async () => {
        const t = exigir(await fila(p, 'R/B'), 'el R/B de la tarjeta')
        const m = exigir(t.replace(/\s/g, '').match(/^1:([\d.]+)$/), `un R/B legible («${t}»)`)
        return Number(m[1])
      }
      const rb1 = await leerRb()
      const f1 = await filaLoc(p, 'R/B')
      await llevar(p, f1.rotulo, 230)
      await marcar(p, f1.valor)
      await r(`Esta tarjeta de EUR/USD tiene un R/B de 1:${coma(rb1)}. El acierto que haría falta para no perder: 1 ÷ (1 + ${coma(rb1)}) = ${aciertoDeEquilibrio(rb1)} %.`)
      await espera(p, 6.4)
      await desmarcar(p)
      await llevar(p, p.getByText(es.an.paso3 || '3 ·', { exact: false }).first(), 20)
      const b = await chip(p, es.an.metodo.simetrica)
      await marcar(p, b)
      await r(`Ahora el método «${es.an.metodo.simetrica}»: el Stop-loss y el Take-profit a la misma distancia.`)
      await espera(p, 4.2)
      await desmarcar(p)
      const rb2 = await leerRb()
      const f2 = await filaLoc(p, 'R/B')
      await llevar(p, f2.rotulo, 230)
      await marcar(p, f2.valor)
      await r(`R/B 1:${coma(rb2)}. Ahora hace falta acertar más del ${aciertoDeEquilibrio(rb2)} % para no perder.`)
      await espera(p, 5.4)
      await desmarcar(p)
      await r(rb1 > rb2
        ? `Con el Take-profit más lejos (1:${coma(rb1)}) basta acertar menos, pero también se acierta menos. Ninguna de las dos es «la buena».`
        : `Con el Take-profit más cerca (1:${coma(rb1)}) hace falta acertar más, aunque también se acierta más. Ninguna de las dos es «la buena».`)
      await espera(p, 6.2)
      await r('Un porcentaje de acierto solo dice algo al lado de ese número. Y antes de costes: el spread y el swap lo suben un poco.')
      await espera(p, 5.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'm11-2': {
    desc: 'Video sin voz: «Tus números por grupos» de un usuario de ejemplo (operaciones de muestra) y el Historial con el registro real de ese día. Se comparan dos porcentajes con su ± para ver si se tocan, y se señala cuántas operaciones lleva un experimento de las 150.',
    consulta: '?diario=grupos',
    async correr(p, r) {
      await irA(p, 'Diario')
      await llevar(p, await abrirTarjeta(p, 'Tus números por grupos'), 90)
      await r('«Tus números por grupos» de un usuario de EJEMPLO, con 9 operaciones de muestra.')
      await espera(p, 4.6)
      const dol = await filaGrupo(p, es.diag.dolar)
      const cru = await filaGrupo(p, es.diag.cruces)
      await llevar(p, dol.loc, 220)
      await marcar(p, dol.loc)
      await r(`Pares con dólar: ${dol.pct} % ±${dol.mg}, con ${dol.n} operaciones. Su rango va del ${Math.max(0, dol.pct - dol.mg)} % al ${Math.min(100, dol.pct + dol.mg)} %.`)
      await espera(p, 6)
      await desmarcar(p)
      await marcar(p, cru.loc)
      await r(`Cruces: ${cru.pct} % ±${cru.mg}, con ${cru.n} operaciones. Su rango va del ${Math.max(0, cru.pct - cru.mg)} % al ${Math.min(100, cru.pct + cru.mg)} %.`)
      await espera(p, 6)
      await desmarcar(p)
      const tocan = Math.abs(dol.pct - cru.pct) <= dol.mg + cru.mg
      await r(tocan
        ? `Los dos rangos se tocan: con tan pocas operaciones no se puede decir que en cruces le vaya mejor ni peor.`
        : `Los dos rangos no se tocan: ahí sí son distintos.`)
      await espera(p, 5.4)
      await irA(p, 'Historial')
      const aviso = p.getByText(/Todavía NO se puede tomar como señal: lleva \d+ de las \d+/).first()
      exigir(await aviso.count(), 'el aviso de las operaciones que lleva un experimento')
      const txt = await aviso.innerText()
      const m = exigir(txt.match(/lleva (\d+) de las (\d+)/), 'cuántas lleva y cuántas hacen falta')
      await llevar(p, aviso, 220)
      await marcar(p, aviso)
      await r(`En el Historial, con el registro real de ese día: este experimento lleva ${m[1]} de las ${m[2]} operaciones que hacen falta para creerle.`)
      await espera(p, 6)
      await desmarcar(p)
      await r(`Con ${OPS_PARA_CREER} operaciones el ± baja a ${margen(OPS_PARA_CREER)} puntos. Llegar no lo hace bueno: hace que su número se pueda creer, sea bueno o malo.`)
      await espera(p, 6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'm11-3': {
    desc: 'Video sin voz: el laboratorio de la pestaña Analizar con las velas guardadas de ese día. Se lee el aviso, se prueba una regla, se cambia una condición y se prueba otra vez: el contador de pruebas sube.',
    async correr(p, r) {
      await irA(p, 'Analizar')
      const lab = await abrirTarjeta(p, es.lab.titulo)
      const aviso = p.getByText(es.lab.aviso, { exact: true }).first()
      await llevar(p, lab, 90)
      await marcar(p, aviso)
      await r('El laboratorio prueba una regla sobre las velas del pasado: cómo le habría ido. Primero, el aviso.')
      await espera(p, 5.6)
      await r('Cuantas más variantes pruebes sobre los mismos datos, más fácil que alguna gane solo por casualidad.')
      await espera(p, 5.6)
      await desmarcar(p)
      const caja = p.locator('.card', { hasText: es.lab.paso1 }).last()
      const p1 = caja.getByText(es.lab.paso1, { exact: true }).first()
      await llevar(p, p1, 120)
      const compra = p1.locator('xpath=..').locator('button', { hasText: new RegExp(`^${es.lado.COMPRA}$`) }).first()
      await compra.click()
      await espera(p, 0.6)
      const masRsi = caja.locator('button', { hasText: `+ ${es.lab.tipo.rsi}` }).first()
      await marcar(p, masRsi)
      await r('Una regla de EJEMPLO: comprar cuando el RSI baja de 30, con el Stop-loss y el Take-profit a la misma distancia.')
      await masRsi.click()
      await espera(p, 4.6)
      await desmarcar(p)
      const probar = caja.locator('button', { hasText: es.lab.probar }).first()
      const resultado = async () => ({
        ops: exigir(await fila(p, es.lab.ops), 'las operaciones del resultado'),
        acierto: exigir(await fila(p, es.lab.acierto), 'el acierto del resultado'),
        eq: exigir(await fila(p, es.lab.equilibrio), 'el acierto que hace falta'),
        porR: exigir(await fila(p, es.lab.porR), 'el resultado por operación'),
        pruebas: exigir((await caja.getByText(/Pruebas hechas en este aparato: \d+/).first().innerText()).match(/: (\d+)/), 'el contador')[1],
      })
      await llevar(p, probar, 260)
      await marcar(p, probar)
      await probar.click()
      await espera(p, 1.6)
      await desmarcar(p)
      const a = await resultado()
      const fa = await filaLoc(p, es.lab.acierto)
      await llevar(p, fa.rotulo, 260)
      await marcar(p, fa.rotulo.locator('xpath=..'))
      await r(`Prueba ${a.pruebas}: ${a.ops} operaciones, acierto ${a.acierto}. Hace falta ${a.eq} para no perder.`)
      await espera(p, 6)
      await desmarcar(p)
      const obj = caja.locator('button', { hasText: /^1 : 2$/ }).first()
      await llevar(p, obj, 200)
      await marcar(p, obj)
      await r('Se cambia una sola cosa: el Take-profit a dos veces lo que se arriesga. Y se prueba otra vez.')
      await obj.click()
      await espera(p, 4)
      await desmarcar(p)
      await probar.click()
      await espera(p, 1.6)
      const b = await resultado()
      const fb = await filaLoc(p, es.lab.acierto)
      await llevar(p, fb.rotulo, 260)
      await marcar(p, fb.rotulo.locator('xpath=..'))
      await r(`Prueba ${b.pruebas}: ${b.ops} operaciones, acierto ${b.acierto}. Ahora hace falta ${b.eq}.`)
      await espera(p, 6)
      await desmarcar(p)
      const positivo = (x) => /^\+/.test(x.porR.trim())
      if (positivo(a) && positivo(b)) {
        await r(`Las dos salen en positivo sobre el pasado (${a.porR} y ${b.porR} por operación). Justo ahí es cuando más cuesta no creerle.`)
        await espera(p, 6)
      }
      const cont = caja.getByText(/Pruebas hechas en este aparato: \d+/).first()
      await llevar(p, cont, 260)
      await marcar(p, cont)
      await r(`El contador ya va en ${b.pruebas}. Si después de veinte pruebas una sale muy bien, todavía no hay que creerle.`)
      await espera(p, 6)
      await desmarcar(p)
      await r('Lo único que no tiene esa trampa es seguirla hacia adelante, con días que la regla nunca vio al elegirla.')
      await espera(p, 5.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
  'm12-1': {
    desc: 'Video sin voz: el Diario de un usuario de ejemplo, al que se le sube un informe de EJEMPLO (operaciones inventadas). Se leen las que entrarán, el resultado total con swap y comisión, la línea que se salta y las primeras filas. Se cancela sin guardar.',
    async correr(p, r) {
      await irA(p, 'Diario')
      const caja = p.locator('#importar-broker')
      exigir(await caja.count(), 'la tarjeta de importar')
      await llevar(p, caja, 120)
      await marcar(p, caja)
      await r(`«${es.importar.titulo}»: la app solo lee el archivo que subes. No se conecta a tu bróker ni te pide contraseñas.`)
      await espera(p, 6)
      await desmarcar(p)
      await abrirTarjeta(p, es.importar.titulo)
      await espera(p, 1)
      await caja.locator('input[type=file]').setInputFiles({ name: 'informe-de-ejemplo.csv', mimeType: 'text/csv', buffer: Buffer.from(INFORME_EJEMPLO) })
      await espera(p, 1.2)
      const txt = (await caja.innerText()).replace(/\s+/g, ' ')
      const n = exigir(txt.match(/(\d+) operaciones nuevas entrarán/), 'cuántas entran')[1]
      const total = exigir(txt.match(/con swap y comisión\): ([+−-]?[\d.]+)/), 'el resultado total')[1]
      const eu = exigir(txt.match(/EUR\/USD Compra \S+ ([+−-]?[\d.]+)/), 'la fila de EUR/USD')[1]
      exigir(/Se saltó una operación/.test(txt), 'el aviso de la línea saltada')
      await llevar(p, caja.getByText('informe-de-ejemplo.csv').first(), 100)
      await r(`Un informe de EJEMPLO, con operaciones inventadas: entrarían ${n} operaciones nuevas.`)
      await espera(p, 5)
      const aviso = caja.getByText(/Se saltó una operación/).first()
      await marcar(p, aviso)
      await r('La línea del oro se salta con un aviso: la app no analiza oro, índices ni acciones.')
      await espera(p, 5.4)
      await desmarcar(p)
      const fEu = caja.getByText('EUR/USD', { exact: true }).first().locator('xpath=..')
      await marcar(p, fEu)
      await r(`EUR/USD: en el informe, el precio dio +40.00, el swap −3.20 y la comisión −1.50. Entra ${eu}: el neto.`)
      await espera(p, 6.4)
      await desmarcar(p)
      const fTot = caja.getByText(es.importar.resultadoTotal).first()
      await marcar(p, fTot)
      await r(`Resultado total, con swap y comisión: ${total}. Nada se guarda hasta que lo confirmes.`)
      await espera(p, 6)
      await desmarcar(p)
      const cancelar = caja.getByRole('button', { name: es.importar.cancelar })
      await marcar(p, cancelar)
      await espera(p, 1.4)
      await cancelar.click()
      await desmarcar(p)
      await r('Se cancela: no se guardó nada. Si subes el mismo informe otra vez, las que ya estaban no se repiten.')
      await espera(p, 5.8)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'm12-2': {
    desc: 'Video sin voz: «Tus números por grupos» de un usuario de ejemplo con 20 operaciones de muestra. Se leen los cruces y los pares con dólar con su ±, las compras y las ventas, el par que sale y el rango de lotes.',
    consulta: '?diario=grupos12',
    async correr(p, r) {
      await irA(p, 'Diario')
      await llevar(p, await abrirTarjeta(p, 'Tus números por grupos'), 90)
      await r('«Tus números por grupos» de un usuario de EJEMPLO, con 20 operaciones de muestra.')
      await espera(p, 4.6)
      const cru = await filaGrupo(p, es.diag.cruces)
      const dol = await filaGrupo(p, es.diag.dolar)
      await llevar(p, cru.loc, 220)
      await marcar(p, cru.loc)
      await r(`Cruces: ${cru.n} operaciones, ${cru.pct} % ±${cru.mg}.`)
      await espera(p, 5)
      await desmarcar(p)
      await marcar(p, dol.loc)
      await r(`Pares con dólar: ${dol.n} operaciones, ${dol.pct} % ±${dol.mg}.`)
      await espera(p, 5)
      await desmarcar(p)
      const tocan = Math.abs(dol.pct - cru.pct) <= dol.mg + cru.mg
      await r(tocan
        ? `Los rangos se tocan: con tan pocas operaciones no se puede decir que en cruces te vaya mejor.`
        : `Los rangos no se tocan: ahí sí son distintos.`)
      await espera(p, 5.6)
      const com = await filaGrupo(p, es.direccion.Compra)
      const ven = await filaGrupo(p, es.direccion.Venta)
      await llevar(p, com.loc, 220)
      await marcar(p, com.loc)
      await r(`Compras: ${com.n} operaciones, ${com.pct} % ±${com.mg}. Ventas: ${ven.n}, ${ven.pct} % ±${ven.mg}.`)
      await espera(p, 6)
      await desmarcar(p)
      const par = await filaGrupo(p, 'EUR/USD')
      await llevar(p, par.loc, 220)
      await marcar(p, par.loc)
      await r(`Par por par solo sale EUR/USD, con ${par.n} operaciones. Los demás no llegan a ${MINIMO_PARA_ENSEÑAR}, así que no se enseñan sueltos.`)
      await espera(p, 6.4)
      await desmarcar(p)
      const lote = p.getByText(/^Lot: del /).first()
      exigir(await lote.count(), 'la línea de los lotes')
      await llevar(p, lote, 260)
      await marcar(p, lote)
      await r('Los lotes son contexto: la app no te dice qué lote usar.')
      await espera(p, 5)
      await desmarcar(p)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'm12-3': {
    desc: 'Video sin voz: el Diario de un usuario de ejemplo con 10 operaciones de muestra que aciertan mucho y pierden dinero. Se lee primero el resultado y después el acierto, y luego el ± del grupo en «Tus números por grupos».',
    consulta: '?diario=acierto',
    async correr(p, r) {
      await irA(p, 'Diario')
      const pl = await statDiario(p, es.diario.pl)
      const win = await statDiario(p, es.diario.ganadas)
      await llevar(p, pl.loc, 160)
      await r('El Diario de un usuario de EJEMPLO, con 10 operaciones de muestra.')
      await espera(p, 4.4)
      await marcar(p, pl.loc)
      await r(`Primero el resultado: ${pl.valor} dólares. Es lo que dice si se ganó o se perdió.`)
      await espera(p, 5.6)
      await desmarcar(p)
      await marcar(p, win.loc)
      await r(`Después el acierto: ${win.valor}. Acierta mucho y aun así pierde, porque las pérdidas son más grandes que las ganancias.`)
      await espera(p, 6.6)
      await desmarcar(p)
      await llevar(p, await abrirTarjeta(p, 'Tus números por grupos'), 90)
      const dol = await filaGrupo(p, es.diag.dolar)
      await llevar(p, dol.loc, 220)
      await marcar(p, dol.loc)
      await r(`Y con ${dol.n} operaciones, ese ${dol.pct} % va con ±${dol.mg}: todavía no dice nada de esta forma de operar.`)
      await espera(p, 6.4)
      await desmarcar(p)
      await r('Si partes tus números en muchos grupos, alguno saldrá bien por casualidad. No te quedes con el mejor sin mirar su ±.')
      await espera(p, 6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
}

// Módulo 11. Una fila de «Tus números por grupos»: operaciones, acierto y ±.
async function filaGrupo(p, etiqueta) {
  const res = await p.evaluate((e) => {
    const filaDe = (x) => { let y = x; for (let i = 0; i < 3 && y; i++, y = y.parentElement) if (/\d+ ops/.test(y.textContent)) return y; return null }
    const hoja = [...document.querySelectorAll('main div, main span')].find((x) => x.children.length === 0 && x.textContent.trim() === e && filaDe(x))
    const f = hoja && filaDe(hoja)
    if (!f) return null
    document.querySelectorAll('[data-grupo]').forEach((x) => { if (x.dataset.grupo === e) delete x.dataset.grupo })
    f.dataset.grupo = e
    return f.innerText.replace(/\s+/g, ' ')
  }, etiqueta)
  exigir(res, `la fila «${etiqueta}»`)
  const m = exigir(res.match(/(\d+) ops (\d+)% ±(\d+)/), `ops, acierto y ± en «${res}»`)
  return { loc: p.locator(`[data-grupo="${etiqueta}"]`), n: Number(m[1]), pct: Number(m[2]), mg: Number(m[3]) }
}

// Módulo 12. Un número de arriba del Diario (el resultado o el acierto).
async function statDiario(p, etiqueta) {
  const res = await p.evaluate((e) => {
    const hoja = [...document.querySelectorAll('main div')].find((x) => x.children.length === 0 && x.textContent.trim() === e)
    const f = hoja?.parentElement
    if (!f) return null
    document.querySelectorAll('[data-stat]').forEach((x) => { if (x.dataset.stat === e) delete x.dataset.stat })
    f.dataset.stat = e
    return f.querySelector('.mono')?.textContent.trim() ?? null
  }, etiqueta)
  exigir(res, `el número «${etiqueta}»`)
  return { loc: p.locator(`[data-stat="${etiqueta}"]`), valor: res }
}

// Módulo 12: el informe de EJEMPLO que se sube en el video. Operaciones
// inventadas; la del oro está para enseñar que se salta.
const INFORME_EJEMPLO = [
  'Ticket,Symbol,Type,Volume,Close time,Profit,Swap,Commission',
  '2001,EURUSD,buy,0.03,2026.11.10 15:00,40.00,-3.20,-1.50',
  '2002,USDJPY,sell,0.02,2026.11.11 10:00,-22.00,0.40,-1.00',
  '2003,GBPUSD,buy,0.03,2026.11.12 18:00,18.50,-0.90,-1.50',
  '2004,XAUUSD,buy,0.01,2026.11.13 14:00,55.00,0,-1.00',
].join('\n') + '\n'

// Módulo 10. Una fila del «Modo práctica» por su par y un texto que lleve
// (su estado), con sus niveles y su desglose leídos de la pantalla.
async function filaPractica(p, par, estado) {
  const res = await p.evaluate(([par, estado]) => {
    const filas = [...document.querySelectorAll('main div')].filter((d) => d.style.borderTop && d.textContent.includes(par) && d.textContent.includes(estado))
    const f = filas.find((d) => ![...d.querySelectorAll('div')].some((x) => filas.includes(x)))
    if (!f) return null
    document.querySelectorAll('[data-filaprac]').forEach((x) => delete x.dataset.filaprac)
    f.dataset.filaprac = '1'
    const niv = [...f.querySelectorAll('span.mono')].find((x) => x.textContent.includes('SL'))?.textContent.trim() || null
    const des = [...f.querySelectorAll('div')].find((x) => x.textContent.trim().startsWith('Bruto'))?.innerText.replace(/\s+/g, ' ') || null
    return { niveles: niv, desglose: des, texto: f.innerText }
  }, [par, estado])
  exigir(res, `la fila de práctica ${par} (${estado})`)
  let desglose = null
  if (res.desglose) {
    const m = res.desglose.match(/Bruto ([^·]+R).*?Spread ([^·]+?)(?: \(.*?\))? · Swap ([^·(]+?)(?: \(noches: (\d+)\))? · Neto ([^·]+R)/)
    if (m) desglose = { bruto: m[1].trim(), spread: m[2].trim(), swap: m[3].trim(), noches: m[4] ? Number(m[4]) : null, neto: m[5].trim() }
  }
  return { loc: p.locator('[data-filaprac]'), niveles: exigir(res.niveles, `los niveles de ${par}`), desglose, texto: res.texto }
}

// El valor que va detrás de un rótulo en la misma línea: «Acierto 60% ±44».
async function valorTras(p, rotulo) {
  return p.evaluate((e) => {
    const s = [...document.querySelectorAll('main span, main div')].find((x) => x.firstChild?.nodeType === 3 && x.firstChild.textContent.trim() === e && x.querySelector(':scope > span.mono'))
    return s?.querySelector(':scope > span.mono')?.textContent.trim() || null
  }, rotulo)
}

// Módulo 7: el calendario se graba con la hora de la mañana del día de los
// datos, para que haya noticias por venir. Se elige la primera noticia con
// previsto y anterior del archivo de ESTA app, y el reloj se pone 2 horas antes.
// Módulo 9. Las herramientas encendidas en el paso 4 del Analizador, leídas de
// la pantalla (los botones del estilo y de las plantillas no cuentan).
async function encendidas(p) {
  return p.evaluate((paso) => {
    const t = [...document.querySelectorAll('main span')].find((x) => x.children.length === 0 && x.textContent.trim() === paso)
    const caja = t?.closest('.card')
    if (!caja) return null
    return [...caja.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.textContent.trim())
  }, es.an.paso4)
}

// La sección «Calendario» de la tarjeta: su texto (eventos o «sin noticias»).
async function seccionCalendario(p) {
  const texto = await p.evaluate((rot) => {
    const t = [...document.querySelectorAll('main span')].find((x) => x.children.length === 0 && x.textContent.trim() === rot && !x.closest('button') && x.parentElement?.style.borderTop)
    if (!t) return null
    t.parentElement.dataset.cal = '1'
    return t.parentElement.innerText
  }, es.an.h.calendario)
  return texto ? { texto, loc: p.locator('[data-cal]') } : null
}

// La caja (Bloque) de una herramienta de la tarjeta, por su título.
async function bloqueDe(p, titulo) {
  const ok = await p.evaluate((tt) => {
    const t = [...document.querySelectorAll('main span, main div')].find((x) => x.children.length === 0 && x.textContent.trim() === tt && !x.closest('button'))
    if (!t) return false
    t.parentElement.dataset.bloq = tt
    return true
  }, titulo)
  return ok ? p.locator(`[data-bloq="${titulo}"]`) : null
}

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

// `modo`: null (sin voz, como siempre) · { textos: true } (apunta lo que dice
// cada rótulo para generar la voz) · { voz, salida } (graba con esa voz y deja
// el video con sonido en `salida`). Ver `voz.mjs`.
async function grabar(datos, id, modo = null) {
  const escena = ESCENAS[id] || ESCENAS_HERRAMIENTAS[id]
  if (!escena) throw new Error(`No hay escena «${id}»`)
  const tmp = join(datos, '..', `grabando-${id}`)
  await rm(tmp, { recursive: true, force: true })
  const reloj = escena.reloj ? await escena.reloj(datos) : null
  const { b, ctx, p, errores } = await abrir(chromium, { datos, video: tmp, consulta: escena.consulta || '', reloj })
  // El video empieza a grabarse al abrir la página: es el cero de los audios.
  const t0 = await p.evaluate(() => performance.timeOrigin)
  const dur = modo?.voz ? duraciones(modo.voz, await leerTextos()) : null
  const r = rotuloConVoz(p, await ponerRotulo(p), dur, modo?.pron)
  await escena.correr(p, r, datos)
  await r.terminar()
  await ctx.close()
  await b.close()
  if (errores.length) throw new Error(`${id}: errores en la página: ${errores.join(' · ')}`)
  if (modo?.textos) {
    const n = await apuntarTextos(r.log)
    console.log(`✓ ${id}: ${r.log.length} rótulos apuntados (${n} textos en total)`)
    for (const x of r.log) console.log(`   ${x.id}  ${x.voz}`)
    await rm(tmp, { recursive: true, force: true })
    return
  }
  const [crudo] = (await readdir(tmp)).filter((f) => f.endsWith('.webm'))
  const entrada = join(tmp, crudo)
  // El primer segundo es la app cargando: fuera.
  const CORTE = 1.2
  const corte = ['-ss', String(CORTE)]
  // Con voz y sin --salida, el video con voz SUSTITUYE al de la app.
  const dest = modo?.voz && modo.salida ? join(modo.salida, `${id}-${modo.voz}`) : join(VIDEOS, id)
  const mudo = modo?.voz ? join(tmp, 'mudo') : dest
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...corte, '-i', entrada, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', '-an', `${mudo}.webm`])
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...corte, '-i', entrada, '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', `${mudo}.mp4`])
  if (modo?.voz) {
    for (const ext of ['webm', 'mp4']) mezclar({ video: `${mudo}.${ext}`, salida: `${dest}.${ext}`, voz: modo.voz, log: r.log, t0, corte: CORTE })
  }
  await rm(tmp, { recursive: true, force: true })
  console.log(`✓ ${id}${modo?.voz ? ` con la voz ${modo.voz} → ${dest}.mp4` : ''}`)
}

const args = process.argv.slice(2)
if (args[0] === '--bajar') {
  await bajar(exigir(args[1], 'la carpeta de datos'))
} else if (args[0] === '--descripciones') {
  for (const [id, e] of Object.entries(ESCENAS)) console.log(id, '→', e.desc)
} else {
  // Opciones: --textos (apunta los rótulos para la voz) · --voz <voz> [--salida <carpeta>]
  // (sin --salida, el video con voz sustituye al de public/curso/videos)
  // · --pronunciacion fonetica|natural (la misma al apuntar y al grabar).
  const opc = {}
  const resto = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--textos') opc.textos = true
    else if (args[i] === '--voz') opc.voz = args[++i]
    else if (args[i] === '--salida') opc.salida = args[++i]
    else if (args[i] === '--pronunciacion') opc.pron = args[++i]
    else resto.push(args[i])
  }
  const datos = exigir(resto[0], 'la carpeta de datos (node grabar.mjs <carpeta> [ids])')
  // Sin ids, todas las de ESTA app: las de herramientas que solo existen en la
  // otra (el oro, el COT y la correlación son de swing) se saltan.
  const deEstaApp = HERRAMIENTAS.filter((h) => h.apps.includes(APP)).map((h) => h.id)
  const ids = resto.length > 1 ? resto.slice(1) : [...Object.keys(ESCENAS), ...Object.keys(ESCENAS_HERRAMIENTAS).filter((id) => deEstaApp.includes(id))]
  const modo = opc.textos || opc.voz ? opc : null
  for (const id of ids) await grabar(datos, id, modo)
}

export { ESCENAS }
