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
