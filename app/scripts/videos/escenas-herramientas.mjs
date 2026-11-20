// Las escenas de los videos de HERRAMIENTAS (2026-11-20). Gemelo.
//
// Néstor: «que los videos de intradía sean lo que corresponde a ella y así
// para swing». Por eso este archivo es el MISMO en las dos apps y se graba en
// cada una: lo que se ve es la app en la que se graba, con sus datos. Lo que
// una herramienta dice distinto en cada app (velas de un día o de una hora) se
// lee de `APP`, nunca se copia de la otra.
//
// Qué herramientas tiene cada app lo dice el catálogo
// (`src/lib/curso/herramientas.js`, gemelo): una escena aquí sin entrada allí,
// o al revés, lo canta `prueba-curso.mjs`.
//
// ⚠️ LAS MISMAS REGLAS QUE LAS LECCIONES: ningún rótulo dice que algo se compre
// o se venda, ni hacia dónde irá el precio; los números se LEEN de la pantalla
// al grabar (si uno no aparece, la escena falla en vez de inventarlo), y todas
// terminan con el aviso de que es formación y no una señal.
import { APP } from '../../src/lib/identidad.js'
import es from '../../src/lib/i18n/textos/es.js'
import { abrirTarjeta, chip, desmarcar, espera, exigir, fila, filaLoc, FIN, irA, llevar, marcar, tarjeta } from './banco.mjs'

const VELA = APP === 'swing' ? 'un día' : 'una hora'
const VELAS = APP === 'swing' ? 'días' : 'horas'

// Abre el Analizador con un par y una dirección, solo para tener la tarjeta.
async function analizador(p, r, { par = 'EUR/USD', conLado = true } = {}) {
  await irA(p, 'Analizar')
  await p.locator('main select.field').first().selectOption(par)
  await espera(p, 0.6)
  if (conLado) {
    await p.locator('main button', { hasText: /^COMPRA$/ }).first().click()
    await espera(p, 0.8)
  }
}

// Enciende una herramienta del Analizador y lleva la pantalla a su fila.
async function verHerramienta(p, nombre, rotulo) {
  await llevar(p, p.getByText(es.an.paso4 || '4 · QUÉ HERRAMIENTAS VER', { exact: false }).first(), 20)
  const b = await chip(p, nombre)
  await marcar(p, b)
  await espera(p, 1.2)
  await desmarcar(p)
  const f = await filaLoc(p, rotulo)
  await llevar(p, f.rotulo, 230)
  return f
}

// Enciende una herramienta que sale como BLOQUE (con su título encima, como
// Fibonacci o el FVG) y devuelve el bloque y su texto.
async function verBloque(p, nombre, titulo = nombre) {
  await llevar(p, p.getByText(es.an.paso4 || '4 · QUÉ HERRAMIENTAS VER', { exact: false }).first(), 20)
  const b = await chip(p, nombre)
  await marcar(p, b)
  await espera(p, 1.2)
  await desmarcar(p)
  const texto = await p.evaluate((tt) => {
    const t = [...document.querySelectorAll('main span')].find((x) => x.children.length === 0 && x.textContent.trim() === tt && !x.closest('button'))
    if (!t) return null
    t.parentElement.dataset.bloque = '1'
    return t.parentElement.innerText
  }, titulo)
  exigir(texto, `el bloque «${titulo}»`)
  const loc = p.locator('[data-bloque]')
  await llevar(p, loc, 150)
  return { loc, texto }
}

export const ESCENAS_HERRAMIENTAS = {
  'h-barrido': {
    async correr(p, r) {
      await r('El Barrido: la primera pantalla. Te dice en segundos qué divisas están fuertes y cuáles débiles.')
      await espera(p, 4.2)
      const ranking = await p.evaluate(() => {
        const caja = [...document.querySelectorAll('main div')].find((d) => d.children.length === 8 && [...d.children].every((c) => /^[A-Z]{3}\s+\d/.test(c.innerText.trim())))
        if (!caja) return null
        caja.dataset.ranking = '1'
        return [...caja.children].map((c) => c.innerText.trim().split(/\s+/))
      })
      exigir(ranking, 'el ranking de fuerza')
      const caja = p.locator('[data-ranking]')
      await llevar(p, caja, 120)
      await marcar(p, caja)
      const [fuerte, debil] = [ranking[0], ranking[ranking.length - 1]]
      await r(`Cada divisa se compara contra las otras 7, de 0 a 10. Hoy la más fuerte es ${fuerte[0]} (${fuerte[1]}) y la más débil ${debil[0]} (${debil[1]}).`)
      await espera(p, 5)
      await desmarcar(p)
      await p.mouse.wheel(0, 300)
      await espera(p, 0.9)
      await r('Debajo, cada par con su tendencia y su RSI de hoy.')
      await espera(p, 3.6)
      await r('Si un par lleva una dirección al lado, es la de un experimento que la app mide. No es una señal para copiar.')
      await espera(p, 4.6)
      await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
      await espera(p, 0.8)
      await r(`Arriba siempre dice de cuándo son los datos: aquí cada vela es ${VELA}.`)
      await espera(p, 4)
      await r('El Barrido te dice dónde mirar. Qué hacer con eso lo decides tú.')
      await espera(p, 3.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'h-analizador': {
    async correr(p, r) {
      await irA(p, 'Analizar')
      await r('El Analizador junta todas las herramientas de la app para el par que tú elijas.')
      await espera(p, 4)
      await r('Paso 1: el par.')
      await p.locator('main select.field').first().selectOption('EUR/USD')
      await espera(p, 2)
      const lado = p.locator('main button', { hasText: /^COMPRA$/ }).first()
      await marcar(p, lado)
      await r('Paso 2: la dirección. La eliges TÚ: la app no la elige por ti.')
      await espera(p, 3)
      await lado.click()
      await desmarcar(p)
      await espera(p, 0.8)
      await r('Paso 3: cómo poner el Stop-loss. Hay tres maneras, y la tarjeta cambia con cada una.')
      await espera(p, 4)
      const rb = p.locator('main').getByText('R/B', { exact: true }).first()
      await llevar(p, rb, 200)
      const sl = exigir(await fila(p, es.an.stop), 'el Stop-loss')
      const tp = exigir(await fila(p, es.an.objetivo), 'el Take-profit')
      const rr = exigir(await fila(p, 'R/B'), 'el R/B')
      const lote = exigir(await fila(p, es.an.lote), 'el lote')
      await marcar(p, rb.locator('xpath=..'))
      await r(`Stop-loss ${sl}, Take-profit ${tp}, R/B ${rr}.`)
      await espera(p, 4.2)
      await r(`Y el lote para arriesgar lo que dice tu perfil: ${lote}.`)
      await espera(p, 3.8)
      await desmarcar(p)
      await p.mouse.wheel(0, 380)
      await espera(p, 0.9)
      await r('Paso 4: qué herramientas ver. Cada una sale debajo con su número de hoy.')
      await espera(p, 4)
      await r('Y puedes guardar tus herramientas en una plantilla para la próxima vez.')
      await espera(p, 3.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'h-rsi': {
    async correr(p, r) {
      await analizador(p, r)
      await r('El RSI mide si el precio subió o bajó con mucha fuerza últimamente. Va de 0 a 100.')
      await espera(p, 4.2)
      const f = await verHerramienta(p, es.an.h.rsi, es.an.h.rsi)
      const v = exigir(await fila(p, es.an.h.rsi), 'el RSI')
      await marcar(p, f.valor)
      await r(`EUR/USD, hoy: RSI ${v}. Aquí cada vela es ${VELA} y el RSI usa las últimas 14.`)
      await espera(p, 4.4)
      await desmarcar(p)
      await r('Por encima de 70 se suele decir que subió con mucha fuerza; por debajo de 30, que cayó con mucha fuerza.')
      await espera(p, 4.8)
      await r('Ojo: un RSI alto NO dice que vaya a bajar, ni uno bajo que vaya a subir. Puede seguir así días.')
      await espera(p, 4.6)
      await r('El RSI es un dato para mirar, no una orden: no te dice qué hacer.')
      await espera(p, 3.8)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'h-atr': {
    async correr(p, r) {
      await analizador(p, r)
      await r(`El ATR mide cuánto se mueve el par en una vela normal. Aquí cada vela es ${VELA}.`)
      await espera(p, 4.2)
      const f = await verHerramienta(p, es.an.h.atr, es.an.h.atr)
      const v = exigir(await fila(p, es.an.h.atr), 'el ATR')
      await marcar(p, f.valor)
      await r(`EUR/USD, hoy: ${v}. O sea, eso es lo que suele recorrer en ${VELA}.`)
      await espera(p, 4.4)
      await desmarcar(p)
      await r('Sirve para poner el Stop-loss: uno más corto que el ATR lo puede tocar el movimiento normal del par.')
      await espera(p, 4.8)
      await r('Por eso los métodos de Stop-loss del Analizador salen del ATR.')
      await espera(p, 3.6)
      await r('El ATR no dice hacia dónde irá el precio. Solo cuánto se mueve.')
      await espera(p, 3.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'h-medias': {
    async correr(p, r) {
      await analizador(p, r)
      await r('Las medias móviles: el precio promedio de las últimas velas. Sirven para ver la tendencia de un vistazo.')
      await espera(p, 4.4)
      const f = await verHerramienta(p, es.an.h.medias, 'SMA 20')
      const v = exigir(await fila(p, 'SMA 20'), 'la SMA 20')
      await marcar(p, f.valor)
      await r(`SMA 20 de EUR/USD: ${v}.`)
      await espera(p, 4.2)
      await r(`SMA es la media simple. EMA da más peso a las velas recientes. Aquí 20 velas son 20 ${VELAS}.`)
      await espera(p, 4.6)
      await desmarcar(p)
      await r('Si el precio está por encima de sus medias, viene subiendo; por debajo, viene bajando.')
      await espera(p, 4.2)
      await r('Eso es lo que YA pasó. Que esté por encima no dice que vaya a seguir subiendo.')
      await espera(p, 4)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'h-bollinger': {
    async correr(p, r) {
      await analizador(p, r)
      await r('Las bandas de Bollinger: una media de 20 velas con una banda arriba y otra abajo, a 2 desviaciones.')
      await espera(p, 4.6)
      const f = await verHerramienta(p, es.an.h.bollinger, es.an.bandaArriba)
      const arriba = exigir(await fila(p, es.an.bandaArriba), 'la banda de arriba')
      const abajo = exigir(await fila(p, es.an.bandaAbajo), 'la banda de abajo')
      const pb = exigir(await fila(p, '%B'), 'el %B')
      await marcar(p, f.valor)
      await r(`Hoy: banda de arriba ${arriba}, banda de abajo ${abajo}.`)
      await espera(p, 4)
      await r(`El %B dice dónde está el precio entre las dos: 0 es la de abajo, 1 la de arriba. Hoy: ${pb}.`)
      await espera(p, 4.8)
      await desmarcar(p)
      await r(APP === 'swing' ? 'Que el precio toque una banda NO dice que vaya a darse la vuelta. Esta app lo mide como experimento.' : 'Que el precio toque una banda NO dice que vaya a darse la vuelta. Es un dato para mirar, no una orden.')
      await espera(p, 4.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'h-calendario': {
    async correr(p, r) {
      await r('El calendario económico: las noticias que pueden mover el precio en las próximas 48 horas.')
      await espera(p, 4.4)
      const t = tarjeta(p, 'Calendario económico')
      await llevar(p, t, 20)
      await marcar(p, t)
      await espera(p, 1.2)
      await abrirTarjeta(p, 'Calendario económico')
      await desmarcar(p)
      await r('Cada noticia va con su divisa, su hora (la de tu teléfono) y cuánto suele mover el precio.')
      await espera(p, 4.6)
      const boton = p.getByRole('button', { name: /Qué significa/ }).first()
      if (await boton.count()) {
        await llevar(p, boton, 260)
        await marcar(p, boton)
        await r('Si no entiendes una, toca «¿Qué significa?» y te la explica en palabras sencillas.')
        await espera(p, 3)
        await boton.click()
        await desmarcar(p)
        await espera(p, 0.6)
        await p.mouse.wheel(0, 220)
        await espera(p, 3.4)
      } else {
        await r('Hoy no hay noticias importantes en las próximas 48 horas, y la tarjeta lo dice.')
        await espera(p, 4)
      }
      await r('El calendario dice CUÁNDO puede haber sacudida, nunca hacia dónde.')
      await espera(p, 4)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'h-tasas': {
    async correr(p, r) {
      await r('Las tasas de interés de los 8 bancos centrales, y de qué lado juega el swap.')
      await espera(p, 4.2)
      const t = tarjeta(p, 'Tasas de interés y swap')
      await llevar(p, t, 20)
      await abrirTarjeta(p, 'Tasas de interés y swap')
      await r('El swap es lo que se paga o se cobra cada noche que la operación sigue abierta.')
      await espera(p, 4.4)
      await p.mouse.wheel(0, 320)
      await espera(p, 0.9)
      await r('Sale de la diferencia entre las tasas de las dos divisas del par.')
      await espera(p, 3.8)
      await r('Ojo: la diferencia de tasas NO es tu swap. Tu bróker le suma su margen, y ese margen no lo publica nadie.')
      await espera(p, 5)
      await r('Cada tasa va con la fecha de su dato, que casi nunca es la de hoy: así sabes de cuándo es.')
      await espera(p, 4.2)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'h-spread': {
    async correr(p, r) {
      await r('Lo que cuesta abrir una operación: el spread, con los precios de una cuenta real del desarrollador.')
      await espera(p, 4.4)
      const caja = p.locator('.card', { hasText: 'Lo que cuesta abrir la operación' }).last()
      await llevar(p, caja, 20)
      await r('Para cada par: precio de compra, precio de venta y la diferencia, que es el spread, en pips.')
      await espera(p, 4.6)
      const encab = caja.getByText(es.vivo.actividad, { exact: true }).first()
      if (await encab.count()) {
        await marcar(p, encab)
        await r('La última columna es la ACTIVIDAD: cuántas veces cambió el precio hoy en ese bróker.')
        await espera(p, 4.6)
        await desmarcar(p)
        await r('No es volumen y no dice hacia dónde: dice dónde hay gente ahora mismo.')
        await espera(p, 4.2)
      }
      await r('El spread y la actividad son de una cuenta real del desarrollador. Los de tu bróker pueden ser otros.')
      await espera(p, 4.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'h-noticias': {
    async correr(p, r) {
      await r('Las noticias de los bancos centrales: lo último que publicaron la Fed, el BCE, el Banco de Nueva Zelanda e ING.')
      await espera(p, 4.6)
      const t = tarjeta(p, 'Noticias de los bancos centrales')
      await llevar(p, t, 20)
      await marcar(p, t)
      await espera(p, 1)
      await abrirTarjeta(p, 'Noticias de los bancos centrales')
      await desmarcar(p)
      await r('Primero el aviso: una noticia dice qué pasó y cuándo, nunca hacia dónde va el precio.')
      await espera(p, 4.4)
      const enlace = p.locator('main a[target="_blank"]').first()
      if (await enlace.count()) {
        await llevar(p, enlace, 220)
        await marcar(p, enlace.locator('xpath=ancestor::*[self::div or self::li][1]'))
        await r('Cada titular lleva delante el código de su divisa, y debajo de qué fuente es y de qué fecha.')
        await espera(p, 4.6)
        await desmarcar(p)
        await r('Van tal cual los publica cada fuente, en su idioma. Al tocarlo se abre la noticia completa en su página.')
        await espera(p, 4.6)
      } else {
        await r('Hoy no hay titulares nuevos, y la tarjeta lo dice.')
        await espera(p, 3.6)
      }
      await r('Sirven para saber qué acaba de decir un banco central antes de operar su divisa. Qué hacer con eso lo decides tú.')
      await espera(p, 4.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'h-niveles': {
    async correr(p, r) {
      await analizador(p, r)
      await r(`El soporte y la resistencia: el mínimo y el máximo de las últimas 20 velas. Aquí son 20 ${VELAS}.`)
      await espera(p, 4.6)
      const f = await verHerramienta(p, es.an.h.niveles, es.an.h.niveles)
      const sr = exigir(await fila(p, es.an.h.niveles), 'el soporte y la resistencia')
      const [sop, res] = sr.split('·').map((x) => x.trim())
      await marcar(p, f.valor)
      await r(`EUR/USD: soporte ${sop}, resistencia ${res}.`)
      await espera(p, 4.2)
      await desmarcar(p)
      const b = await chip(p, es.an.h.pivote)
      await marcar(p, b)
      await espera(p, 1.2)
      await desmarcar(p)
      const fp = await filaLoc(p, es.an.h.pivote)
      await llevar(p, fp.rotulo, 230)
      const pv = exigir(await fila(p, es.an.h.pivote), 'el pivote')
      await marcar(p, fp.valor)
      await r(`El pivote sale ${APP === 'swing' ? 'del día anterior' : 'de las 24 horas anteriores'}: ${pv}. S1 es un nivel por debajo y R1 uno por encima.`)
      await espera(p, 5)
      await desmarcar(p)
      await r('Son los sitios donde el precio frenó antes. Que haya frenado ahí NO quiere decir que vuelva a frenar.')
      await espera(p, 4.6)
      await r('Un nivel te dice dónde mirar, no qué hacer cuando el precio llegue.')
      await espera(p, 3.8)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'h-compresion': {
    async correr(p, r) {
      await analizador(p, r)
      await r('La compresión compara cuánto se mueve el par ahora con cuánto se movía antes.')
      await espera(p, 4.2)
      const f = await verHerramienta(p, es.an.h.compresion, es.an.h.compresion)
      const v = exigir(await fila(p, es.an.h.compresion), 'la compresión')
      await marcar(p, f.valor)
      await r(`EUR/USD, hoy: ${v}.`)
      await espera(p, 3.8)
      await desmarcar(p)
      await r('Por debajo de 1, el par se mueve menos que antes: está apretado. Por encima de 1, se mueve más.')
      await espera(p, 4.6)
      await r('La palabra de al lado dice qué tan raro es ese número para este par. El número es el dato.')
      await espera(p, 4.4)
      await r('Que esté apretado NO dice hacia qué lado se va a soltar, ni cuándo.')
      await espera(p, 4)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'h-fibonacci': {
    async correr(p, r) {
      await analizador(p, r)
      await r('Fibonacci: unos niveles que salen del último movimiento de las últimas 20 velas.')
      await espera(p, 4.2)
      const { loc, texto } = await verBloque(p, es.an.h.fibonacci)
      await marcar(p, loc)
      if (texto.includes(es.an.fibChico)) {
        await r('Hoy el movimiento es demasiado pequeño, y la app no dibuja los niveles: no significarían nada.')
        await espera(p, 4.6)
      } else {
        const mov = exigir(texto.match(/(\d[\d.,]*)\s*→\s*(\d[\d.,]*)/), 'el movimiento')
        await r(`El último movimiento fue de ${mov[1]} a ${mov[2]}.`)
        await espera(p, 4)
        await r('Los niveles son el 23,6, 38,2, 50, 61,8 y 78,6 % de ese recorrido, con la distancia del precio a cada uno.')
        await espera(p, 4.8)
        const cerca = await p.evaluate((frase) => {
          const x = [...document.querySelectorAll('[data-bloque] span')].find((s) => s.children.length === 0 && s.textContent.includes(frase))
          if (!x) return null
          const filaV = x.parentElement
          filaV.dataset.cerca = '1'
          return `${filaV.previousElementSibling?.innerText.trim()} → ${filaV.innerText.split('·')[0].trim()}`
        }, es.an.fibCercano)
        if (cerca) {
          await marcar(p, p.locator('[data-cerca]'))
          await r(`El más cercano al precio hoy: ${cerca}.`)
          await espera(p, 4.2)
        }
      }
      await desmarcar(p)
      await r('No hay prueba de que el precio respete estos niveles por sí solo. Son un sitio para mirar, no una orden.')
      await espera(p, 4.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'h-fvg': {
    async correr(p, r) {
      await analizador(p, r)
      await r('El FVG, o brecha de valor justo: un tramo de precio que quedó sin negociar cuando el precio se movió muy rápido.')
      await espera(p, 4.8)
      const { loc, texto } = await verBloque(p, es.an.h.fvg)
      await marcar(p, loc)
      if (texto.includes(es.an.fvgNinguno)) {
        await r('Hoy no queda ningún hueco vivo en las últimas 20 velas de este par, y la app lo dice.')
        await espera(p, 4.4)
      } else {
        const n = (texto.match(new RegExp(`${es.an.fvgAlcista}|${es.an.fvgBajista}`, 'g')) || []).length
        exigir(n || null, 'los huecos')
        await r(`Hoy EUR/USD tiene ${n === 1 ? 'un hueco vivo' : `${n} huecos vivos`}. Cada uno va con sus bordes, la distancia del precio y si ya se tocó.`)
        await espera(p, 5)
      }
      await desmarcar(p)
      await r('Muchos traders esperan que el precio vuelva al hueco. Medido en la app de swing sobre unos 5 años, entrar así NO ganó.')
      await espera(p, 5)
      await r('Por eso aquí solo te dice DÓNDE están los huecos, nunca hacia dónde irá el precio.')
      await espera(p, 4.2)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'h-estacionalidad': {
    async correr(p, r) {
      await analizador(p, r)
      await r('La estacionalidad: cuánto suele moverse el par según el calendario, comparado con su media.')
      await espera(p, 4.4)
      const { loc } = await verBloque(p, es.an.h.estacionalidad)
      const filas = await p.evaluate(() => {
        const leaves = [...document.querySelectorAll('[data-bloque] span, [data-bloque] div')].filter((x) => x.children.length === 0)
        return leaves.filter((x) => x.nextElementSibling).map((x) => [x.textContent.trim(), x.nextElementSibling.innerText.trim()])
      })
      // Los rótulos se arman igual que en la pantalla: con el mes de hoy.
      const nombre = new Date(Date.UTC(2024, new Date().getUTCMonth(), 15)).toLocaleDateString('es', { month: 'long', timeZone: 'UTC' })
      const mes = exigir(filas.find(([k]) => k === es.an.estMes({ mes: nombre })) || null, 'el recorrido del mes')
      const dir = exigir(filas.find(([k]) => k === es.an.estDir({ mes: nombre })) || null, 'la dirección del mes')
      await marcar(p, loc)
      await r(`${mes[0]}: ${mes[1]}. Lo de «×» dice cuántas veces la media: más de 1 es que se mueve más que de costumbre.`)
      await espera(p, 5.2)
      await r(`Y la dirección: ${dir[0]}, ${dir[1]}.`)
      await espera(p, 4.2)
      await desmarcar(p)
      await r('Mira ese ±: sale de muy pocos años. Con un margen así, la dirección casi no dice nada.')
      await espera(p, 4.6)
      await r('Lo que sí dice es cuánto suele moverse. Nunca hacia dónde.')
      await espera(p, 3.8)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'h-pares': {
    consulta: '?pares=ejemplo',
    async correr(p, r) {
      await r('Mis pares: un usuario de ejemplo que solo opera cuatro pares.')
      await espera(p, 3.6)
      const viendo = p.getByText(/^Viendo \d+ de \d+ pares$/).first()
      await llevar(p, viendo, 120)
      await marcar(p, viendo.locator('xpath=..'))
      const v1 = exigir(await viendo.textContent(), 'cuántos pares se ven')
      await r(`Arriba siempre dice cuántos estás viendo: «${v1.trim()}».`)
      await espera(p, 4)
      const todos = p.getByRole('button', { name: /^Todos \(\d+\)$/ }).first()
      await marcar(p, todos)
      await r('Con un toque ves todos los pares…')
      await espera(p, 2.4)
      await todos.click()
      await espera(p, 1.2)
      const v2 = exigir(await p.getByText(/^Viendo \d+ de \d+ pares$/).first().textContent(), 'cuántos pares se ven')
      await r(`…«${v2.trim()}».`)
      await espera(p, 3)
      const mis = p.getByRole('button', { name: /^Mis pares \(\d+\)$/ }).first()
      await marcar(p, mis)
      await r('Y con otro, vuelves a los tuyos.')
      await espera(p, 2.6)
      await mis.click()
      await desmarcar(p)
      await espera(p, 1)
      const cambiar = p.getByRole('button', { name: 'Cambiar mis pares' }).first()
      await marcar(p, cambiar)
      await r('«Cambiar mis pares» abre la lista para poner o quitar pares cuando quieras.')
      await espera(p, 3)
      await cambiar.click()
      await desmarcar(p)
      await espera(p, 3.6)
      await p.getByRole('button', { name: 'Cancelar' }).first().click()
      await espera(p, 0.8)
      const ranking = await p.evaluate(() => {
        const caja = [...document.querySelectorAll('main div')].find((d) => d.children.length === 8 && [...d.children].every((c) => /^[A-Z]{3}\s+\d/.test(c.innerText.trim())))
        if (caja) caja.dataset.ranking = '1'
        return Boolean(caja)
      })
      if (ranking) {
        await llevar(p, p.locator('[data-ranking]'), 140)
        await marcar(p, p.locator('[data-ranking]'))
      }
      await r('Lo que NO se recorta nunca es el ranking de fuerza: compara cada divisa con las otras siete.')
      await espera(p, 4.6)
      await desmarcar(p)
      await r('No te recomienda pares: solo filtra los que tú elegiste.')
      await espera(p, 3.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'h-avisos': {
    consulta: '?pares=ejemplo',
    async correr(p, r) {
      await irA(p, 'Avisos')
      await r('Mis avisos: tú pones el nivel, y la app te avisa al celular cuando el mercado llega ahí.')
      await espera(p, 4.4)
      await r('Primero el aviso: esto NO son señales de la app. Los niveles los pones tú.')
      await espera(p, 4.2)
      const lista = p.getByText(/^Mis avisos \(\d+ de \d+\)$/).first()
      await llevar(p, lista, 90)
      await marcar(p, lista.locator('xpath=..'))
      const t = exigir(await lista.textContent(), 'la lista de avisos')
      const n = exigir(t.match(/\((\d+) de (\d+)\)/), 'cuántos avisos hay')
      await r(`Este usuario de ejemplo tiene ${n[1]} de ${n[2]} posibles. Cada uno se lee como una frase.`)
      await espera(p, 4.6)
      await desmarcar(p)
      const nuevo = p.getByText('Poner un aviso nuevo', { exact: true }).first()
      await llevar(p, nuevo, 90)
      await r('Para poner uno: el par, de qué (precio, RSI o %B), cuándo y el nivel.')
      await espera(p, 3.6)
      // Los campos van dentro de su etiqueta, en este orden: par, de qué,
      // cuándo y nivel.
      const form = nuevo.locator('xpath=..')
      await form.locator('select').nth(0).selectOption('EUR/USD')
      await espera(p, 0.8)
      await form.locator('select').nth(1).selectOption('rsi')
      await espera(p, 0.8)
      await form.locator('select').nth(2).selectOption('arriba')
      await espera(p, 0.8)
      await form.locator('input').first().fill('70')
      await espera(p, 0.6)
      await marcar(p, nuevo.locator('xpath=..'))
      await r('Por ejemplo: «EUR/USD, si el RSI llega o pasa de 70». Y se pulsa «Añadir el aviso».')
      await espera(p, 4.6)
      await desmarcar(p)
      await r('Si no lo ves, se repite a los 15 y a los 30 minutos, y se calla en cuanto abres esta pantalla.')
      await espera(p, 4.6)
      await r('Un aviso te dice qué pasó, nunca qué hacer con ello.')
      await espera(p, 3.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  // Solo swing: el oro y la correlación no existen en la de intradía.
  'h-oro': {
    async correr(p, r) {
      await r('El oro: su precio, y cuánto se ha movido junto a cada uno de tus pares.')
      await espera(p, 4.2)
      const t = tarjeta(p, 'Oro')
      await llevar(p, t, 20)
      await abrirTarjeta(p, 'Oro')
      await r('Primero el aviso: el oro no dice comprar ni vender ningún par.')
      await espera(p, 4)
      const dato = await p.evaluate(() => {
        const u = [...document.querySelectorAll('main span')].find((x) => x.textContent.trim() === 'dólares por onza')
        const precio = u?.previousElementSibling?.textContent.trim() || null
        const fila = [...document.querySelectorAll('main .mono')].find((x) => /^[A-Z]{3}\/[A-Z]{3}$/.test(x.textContent.trim()) && x.closest('.card')?.innerText.includes('Cuánto se mueve el oro'))
        if (!fila) return { precio, par: null }
        const caja = fila.parentElement.parentElement
        caja.dataset.oro = '1'
        return { precio, par: fila.textContent.trim(), r: caja.lastElementChild?.textContent.trim() }
      })
      exigir(dato.precio, 'el precio del oro')
      await llevar(p, p.getByText('dólares por onza', { exact: true }).first(), 220)
      await r(`Hoy: ${dato.precio} dólares la onza.`)
      await espera(p, 3.4)
      if (dato.par) {
        const f = p.locator('[data-oro]')
        await llevar(p, f, 250)
        await marcar(p, f)
        await r(`El par que más se ha movido con él en las últimas 60 sesiones: ${dato.par}, ${dato.r}. Va de −1 a +1.`)
        await espera(p, 5)
        await desmarcar(p)
      } else {
        await r('Hoy ningún par se ha movido de forma parecida al oro, y la tarjeta lo dice.')
        await espera(p, 4)
      }
      await r('Que se muevan juntos no quiere decir que uno mueva al otro. Es un dato del pasado, no una predicción.')
      await espera(p, 4.8)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  'h-correlacion': {
    async correr(p, r) {
      await r('La correlación: qué pares se han movido casi igual en las últimas 60 sesiones.')
      await espera(p, 4.2)
      const ver = p.locator('main a', { hasText: 'Ver tablero completo' }).first()
      await llevar(p, ver, 200)
      await marcar(p, ver)
      await r('Está en el tablero completo.')
      await espera(p, 2.6)
      await ver.click()
      await desmarcar(p)
      await espera(p, 1.4)
      const t = tarjeta(p, 'Correlación entre pares')
      await llevar(p, t, 20)
      await abrirTarjeta(p, 'Correlación entre pares')
      const dato = await p.evaluate(() => {
        const fila = [...document.querySelectorAll('main .mono')].find((x) => /^[A-Z]{3}\/[A-Z]{3} · [A-Z]{3}\/[A-Z]{3}$/.test(x.textContent.trim()))
        if (!fila) return null
        const caja = fila.parentElement.parentElement
        caja.dataset.correl = '1'
        return { pareja: fila.textContent.trim(), r: caja.lastElementChild.textContent.trim(), tipo: fila.nextElementSibling?.textContent.trim() }
      })
      exigir(dato, 'la primera pareja de la correlación')
      const f = p.locator('[data-correl]')
      await llevar(p, f, 240)
      await marcar(p, f)
      await r(`La que más se parece hoy: ${dato.pareja}, ${dato.r} («${dato.tipo}»).`)
      await espera(p, 4.6)
      await desmarcar(p)
      await r('Cerca de +1 se mueven igual; cerca de −1, al revés. Las dos cosas son el mismo riesgo.')
      await espera(p, 4.6)
      await r('Abrir dos pares así a la vez no reparte el riesgo: es la misma apuesta con el doble de tamaño.')
      await espera(p, 4.6)
      await r(FIN)
      await espera(p, 2.8)
    },
  },

  // Solo swing: el COT es semanal y llega con días de retraso.
  'h-cot': {
    async correr(p, r) {
      await r('El COT: cómo están apostando los fondos grandes en cada divisa, según el informe oficial de la CFTC.')
      await espera(p, 4.6)
      const t = tarjeta(p, 'Commitments of Traders')
      await llevar(p, t, 20)
      await abrirTarjeta(p, 'Commitments of Traders')
      // Las barras van debajo de la explicación: hay que bajar hasta ellas
      // antes de hablar de ellas.
      await llevar(p, p.getByText(/^Netos (comprados|vendidos)$/).first(), 200)
      await r('La barra a la derecha: están comprados. A la izquierda: vendidos.')
      await espera(p, 4.4)
      await r('El informe es semanal y llega con varios días de retraso: mira siempre su fecha.')
      await espera(p, 4.2)
      await r('Que los grandes estén comprados NO dice que el precio vaya a subir. Esta app lo midió como filtro y no ayudó.')
      await espera(p, 5)
      await r(FIN)
      await espera(p, 2.8)
    },
  },
}
