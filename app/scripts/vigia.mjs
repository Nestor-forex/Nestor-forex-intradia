// Vigía por hora del barrido intradía.
//
// Cada hora hace el mismo barrido que el reporte diario, pero en vez de
// imprimirlo y olvidarlo, lo compara con lo que vio la vez anterior y anota
// las señales NUEVAS. Dos motivos:
//
//   1. Es la base de los avisos al celular (fase 3): avisar solo cuando
//      aparece algo que no estaba, no 28 veces al día repitiendo lo mismo.
//   2. El archivo que va dejando ES el historial de señales. Sin eso no hay
//      forma de decir si la app acierta, y sin eso no hay nada que vender.
//
// De paso anota a qué minuto de la hora corrió de verdad. El reloj de GitHub
// Actions es impuntual y necesitamos saber cuánto, con datos, antes de
// decidir si hay que mudar el vigía a otro servicio.
//
// No manda nada a ningún lado todavía: solo escribe archivos e imprime.

import { fileURLToPath } from 'node:url'
import { computarBarrido, derivarVista } from '../src/lib/marketCalc.js'
import { leerLlave, obtenerVelas } from './lib/velas.mjs'
import { compararConAnterior, escribir, leerEstado, leerJsonl } from './lib/vigia-nucleo.mjs'
import { resolver, resumir } from './lib/resolver.mjs'

// Dónde se guardan los datos. En GitHub Actions apunta a la copia de la rama
// `datos`, para no llenar de commits la rama del código. Sin la variable,
// escribe al lado del repo (útil para probar a mano).
const DATOS = process.env.VIGIA_DATOS || fileURLToPath(new URL('../../datos-local', import.meta.url))
const ESTADO = `${DATOS}/estado/vigia.json`
const LOG_SENALES = `${DATOS}/historial/senales.jsonl`
const LOG_CORRIDAS = `${DATOS}/historial/corridas.jsonl`
const LOG_RESULTADOS = `${DATOS}/historial/resultados.jsonl`

const ahora = new Date()
const { barras, rates, rangos } = await obtenerVelas(leerLlave())
const data = computarBarrido(barras, rates, rangos)
const vista = derivarVista(data, { thr: 0.5, topN: 3 })

const { actuales, nuevas } = compararConAnterior(vista.setups, leerEstado(ESTADO))

// Una línea por señal nueva, con los niveles tal como se los daríamos a
// Néstor. Es lo que después se compara contra lo que hizo el precio.
for (const { id, s } of nuevas) {
  const c = s.crudo
  escribir(
    LOG_SENALES,
    JSON.stringify({
      id,
      vistoEl: ahora.toISOString(),
      vela: data.ultima,
      par: s.name,
      lado: s.lado,
      tipo: s.tipo,
      precio: c.precio,
      sl: c.sl,
      tp: c.tp,
      rr: Number(c.rr.toFixed(2)),
      pipRiesgo: Math.round(c.pipRiesgo),
      pipBeneficio: Math.round(c.pipBeneficio),
      rsi: c.rsi,
      atrPct: Number(c.atrPct.toFixed(3)),
      tend: c.tend,
      sesion: vista.sesion.claves,
    }) + '\n',
    true
  )
}

// Una línea por corrida, haya o no señales. `minuto` es lo que mide la
// puntualidad del reloj: el cron pide el minuto 20, así que 20 es puntual y
// 55 son 35 minutos de atraso. Un atraso de más de una hora se nota como una
// hora entera sin ninguna línea.
escribir(
  LOG_CORRIDAS,
  JSON.stringify({
    en: ahora.toISOString(),
    hora: ahora.getUTCHours(),
    minuto: ahora.getUTCMinutes(),
    vela: data.ultima,
    factorHora: Number((vista.sesion.factor ?? 1).toFixed(2)),
    total: actuales.length,
    nuevas: nuevas.length,
    disparo: process.env.GITHUB_EVENT_NAME || 'local',
  }) + '\n',
  true
)

escribir(
  ESTADO,
  JSON.stringify(
    {
      actualizadoEl: ahora.toISOString(),
      vela: data.ultima,
      senales: actuales.map((x) => x.id),
    },
    null,
    2
  ) + '\n'
)

// Juzgar las señales de días anteriores: ¿llegaron a su objetivo o a su stop?
//
// Va DESPUÉS de anotar las nuevas (así una señal recién vista ya entra en la
// cuenta) y ANTES de los avisos, porque esto sí escribe en disco y los avisos
// no. Se recorre todo el historial en cada corrida en vez de llevar una lista
// de pendientes: son unos pocos cientos de líneas y no vale la pena la
// complicación de mantener dos fuentes que puedan desincronizarse.
const yaJuzgadas = new Set(leerJsonl(LOG_RESULTADOS).map((r) => r.clave))
const { resultados, abiertas, caducadas } = resolver(
  leerJsonl(LOG_SENALES),
  data,
  yaJuzgadas
)

for (const r of resultados) escribir(LOG_RESULTADOS, JSON.stringify(r) + '\n', true)

// Avisos al celular. Va al FINAL y aislado a propósito: para cuando llegamos
// aquí, el historial y el estado ya están escritos en disco, así que ni un
// fallo de red ni una clave mal puesta pueden costarnos esos datos —que son
// el trabajo principal del vigía y no se pueden recuperar después—.
//
// El `import` es dinámico por lo mismo: `push-envio.mjs` necesita el paquete
// `web-push` instalado, y si algún día falla la instalación, el vigía tiene
// que seguir anotando igual en vez de morirse antes de empezar.
let avisos = { estado: 'sin-senales-nuevas' }
if (nuevas.length) {
  try {
    const { enviarAvisos } = await import('./lib/push-envio.mjs')
    avisos = await enviarAvisos(nuevas)
  } catch (e) {
    avisos = { estado: 'error', detalle: e.message }
  }
}

console.log('---VIGIA-INICIO---')
console.log(`Corrida: ${ahora.toISOString()} (minuto ${ahora.getUTCMinutes()} de la hora)`)
console.log(`Vela más reciente: ${data.ultima} UTC`)
console.log(`Señales activas: ${actuales.length} · nuevas en esta revisión: ${nuevas.length}`)
if (nuevas.length) {
  for (const { s } of nuevas) {
    console.log(`  • ${s.name} ${s.lado}${s.tipo === 'rango' ? ' [RANGO]' : ''} — entrada ${s.crudo.precio.toFixed(s.crudo.dec)}, SL ${s.sl.split(' (')[0]}, TP ${s.tp} (R/B ${s.rr})`)
  }
} else {
  console.log('  (nada nuevo respecto a la revisión anterior)')
}
const resumen = resumir(leerJsonl(LOG_RESULTADOS))
console.log(
  `Señales juzgadas en esta revisión: ${resultados.length}` +
    ` · siguen abiertas: ${abiertas}` +
    (caducadas ? ` · caducadas: ${caducadas}` : '')
)
if (resumen.todas.total) {
  console.log(
    `Historial: ${resumen.todas.ganadas}/${resumen.todas.total} acertadas` +
      ` (${resumen.todas.acierto}%), ${resumen.todas.pips >= 0 ? '+' : ''}${resumen.todas.pips} pips`
  )
}
console.log(`Avisos al celular: ${JSON.stringify(avisos)}`)
console.log('---VIGIA-FIN---')
