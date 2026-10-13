// ¿MUERDE EL LISTÓN DE «APAGAR EL MODO TENDENCIA»? Sin internet.
//
// Correr con: node scripts/prueba-preregistro-modos.mjs
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
// ─────────────────────────────────────────────────────────────────────────
// Un listón que no rechaza nada no es un listón: es un adorno. Y un veredicto
// que CALCULA una función solo vale si esa función de verdad dice que no
// cuando toca — si no, el preregistro da una falsa sensación de rigor, que es
// peor que no tenerlo, porque invita a creerse el resultado.
//
// Así que aquí se le pasan resultados inventados que fallan UN criterio cada
// uno, y se exige que `juzgar()` los rechace por ESE criterio y no por otro.
// Más los bordes exactos, que es donde una comparación mal escrita (`>` en vez
// de `>=`, o al revés) decide un veredicto sin que nadie lo note.
//
// ⚠️ Es la misma forma que `prueba-preregistro-m15.mjs` y la de «comprar la
// caída» en la app hermana. No es copiar por copiar: lo que se comprueba es
// siempre lo mismo —que el listón muerda— y la forma ya está probada.

import { CRITERIOS, MIN_OPS, PREREGISTRO, QUE_HACER, juzgar } from './lib/preregistro-modos.mjs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

let fallos = 0
const comprobar = (que, cond) => {
  console.log(`${cond ? '  OK  ' : '  MAL '} ${que}`)
  if (!cond) fallos++
}

// Un resultado que PASA los cinco, para partir de ahí y romper uno cada vez.
const BUENO = () => ({
  app: { ops: 8000, acierto: 38, por1R: -0.13, mitad1: -0.14, mitad2: -0.12, senalesMes: 40 },
  rango: { ops: 3000, acierto: 52, por1R: -0.1, mitad1: -0.11, mitad2: -0.09, senalesMes: 15 },
  tendencia: { ops: 5000, acierto: 32, por1R: -0.15, mitad1: -0.16, mitad2: -0.14, senalesMes: 25 },
  appSwap: { ops: 8000, acierto: 38, por1R: -0.17, mitad1: 0, mitad2: 0, senalesMes: 40 },
  rangoSwap: { ops: 3000, acierto: 52, por1R: -0.14, mitad1: 0, mitad2: 0, senalesMes: 15 },
  aporteDelMejorPar: 0.25,
})

console.log('\n1. El listón lleva su fecha dentro y dice con qué vara decide')
comprobar(`la fecha es ${PREREGISTRO.fecha}`, PREREGISTRO.fecha === '2026-10-12')
comprobar('decide la vara neutra, no la geometría de la app', PREREGISTRO.vara === 'neutra 1:1')
comprobar('y lo dice explícitamente', PREREGISTRO.geometriaRealEsSoloComprobacion === true)
comprobar('son cinco criterios', CRITERIOS.length === 5)
comprobar('cada criterio sabe juzgar y sabe explicarse', CRITERIOS.every((c) => typeof c.juzga === 'function' && typeof c.explica === 'function'))

console.log('\n2. Un resultado bueno pasa los cinco')
{
  const v = juzgar(BUENO())
  comprobar(`pasa (${v.pasados}/5)`, v.pasa && v.pasados === 5)
}

console.log('\n3. ⚠️ Y cada criterio RECHAZA cuando le toca — por ÉSE y no por otro')
// ⚠️ Esto es lo que de verdad importa: no basta con que falle, tiene que
// fallar por el motivo correcto. Un criterio que rechazara por el motivo
// equivocado dejaría pasar el caso que sí debía cazar.
const ROTOS = [
  ['mejoraTotal', (d) => { d.rango.por1R = d.app.por1R + 0.019 }, 'la mejora se queda por debajo de 0,02'],
  ['mejoraEnLasDosMitades', (d) => { d.rango.mitad2 = d.app.mitad2 - 0.01 }, 'gana en la primera mitad y pierde en la segunda'],
  ['quedanSenalesSuficientes', (d) => { d.rango.senalesMes = 7.9 }, 'la app se quedaría casi muda'],
  ['aguantaElSwap', (d) => { d.rangoSwap.por1R = d.appSwap.por1R - 0.001 }, 'con swap deja de ser mejor'],
  ['noEsUnPar', (d) => { d.aporteDelMejorPar = 0.41 }, 'casi toda la ventaja sale de un par'],
]
for (const [clave, romper, porque] of ROTOS) {
  const d = BUENO()
  romper(d)
  const v = juzgar(d)
  const fallan = v.detalle.filter((x) => !x.pasa).map((x) => x.clave)
  comprobar(`${clave}: rechaza cuando ${porque}`, !v.pasa && fallan.length === 1 && fallan[0] === clave)
}

console.log('\n3b. ⚠️⚠️ Y SE NIEGA A JUZGAR SIN DATOS, en vez de dar un falso verde')
// ESTE BLOQUE EXISTE POR UN FALLO REAL, cazado por el humo con un mercado
// inventado antes de gastar un crédito: allí no salía NI UNA señal de rango,
// `medir()` devolvía `null`, el guion lo convertía en 0 con un `?? 0`, y
// «+0,000» le ganaba a «−1,356». O sea que el criterio más importante PASABA
// sobre un grupo vacío.
//
// Es la asimetría de siempre por la puerta de atrás: «no se pudo medir» y
// «midió cero» no son lo mismo, y de los dos errores el caro es confundirlos
// a favor de la propuesta. Misma decisión que `pearson`, `difMax` y
// `veredictoBusqueda`.
{
  const vacio = BUENO()
  vacio.rango = { ops: 0, acierto: null, por1R: null, mitad1: null, mitad2: null, senalesMes: 0 }
  const v = juzgar(vacio)
  comprobar('con el rango vacío NO pasa', !v.pasa)
  comprobar('y lo dice: «no se pudo medir», no «no pasa el listón»', /sin número que juzgar/.test(v.noSePudoMedir))
  comprobar('ningún criterio se da por bueno', v.pasados === 0)

  // ⚠️ El caso exacto del fallo: un cero inventado le ganaría a un negativo.
  const ceroInventado = BUENO()
  ceroInventado.rango = { ops: 0, acierto: null, por1R: 0, mitad1: 0, mitad2: 0, senalesMes: 0 }
  comprobar('⚠️ y un 0 con CERO operaciones tampoco pasa (era el fallo exacto)', !juzgar(ceroInventado).pasa)

  // Pocas operaciones tampoco: un porcentaje sobre 20 no distingue nada.
  const pocas = BUENO()
  pocas.rango.ops = MIN_OPS - 1
  const vp = juzgar(pocas)
  comprobar(`con ${MIN_OPS - 1} operaciones todavía no se juzga`, !vp.pasa && /hacen falta/.test(vp.noSePudoMedir))
  const justas = BUENO()
  justas.rango.ops = MIN_OPS
  comprobar(`y con ${MIN_OPS} exactas SÍ se juzga`, juzgar(justas).pasa)
}

console.log('\n4. ⚠️ Los BORDES exactos, que es donde se decide un veredicto por un decimal')
{
  // Justo en el umbral: pasa. Un pelo por debajo: no.
  const justo = BUENO()
  justo.rango.por1R = justo.app.por1R + 0.02
  comprobar('exactamente +0,020 de mejora SÍ pasa', juzgar(justo).detalle.find((x) => x.clave === 'mejoraTotal').pasa)

  const casi = BUENO()
  casi.rango.por1R = casi.app.por1R + 0.0199
  comprobar('y +0,0199 NO pasa', !juzgar(casi).detalle.find((x) => x.clave === 'mejoraTotal').pasa)

  // 📌 La coma flotante decide veredictos si nadie la mira: en JavaScript
  // `-0.11 - (-0.13)` no da 0.02, da 0.020000000000000004 — y el caso de al
  // lado puede caer del otro lado. Por eso el criterio lleva su tolerancia.
  const flotante = BUENO()
  flotante.app.por1R = -0.13
  flotante.rango.por1R = -0.11
  comprobar('y el caso con resta de coma flotante (−0,11 − (−0,13)) también pasa', juzgar(flotante).detalle.find((x) => x.clave === 'mejoraTotal').pasa)

  const exacto8 = BUENO()
  exacto8.rango.senalesMes = 8
  comprobar('exactamente 8 señales/mes SÍ pasa', juzgar(exacto8).detalle.find((x) => x.clave === 'quedanSenalesSuficientes').pasa)

  const exacto40 = BUENO()
  exacto40.aporteDelMejorPar = 0.4
  comprobar('exactamente el 40 % de un par SÍ pasa', juzgar(exacto40).detalle.find((x) => x.clave === 'noEsUnPar').pasa)

  // Empatar NO es mejorar: el criterio de las mitades pide estrictamente más.
  const empate = BUENO()
  empate.rango.mitad1 = empate.app.mitad1
  comprobar('⚠️ empatar en una mitad NO cuenta como mejorar', !juzgar(empate).detalle.find((x) => x.clave === 'mejoraEnLasDosMitades').pasa)
}

console.log('\n5. ⚠️ El listón está escrito en UNA sola dirección, y lo dice')
// Probar las dos lecturas y quedarse con la que gane es elegir a posteriori:
// es lo que tumbó al COT el 2026-09-14, donde en una mitad ganaba «seguir a
// los fondos» y en la otra «ir en contra» — la firma de una moneda al aire.
{
  const alReves = BUENO()
  // El modo TENDENCIA sale mucho mejor que el rango. Eso NO puede hacer que el
  // listón «pase» diciendo que se apague el rango: no es lo que mide.
  alReves.rango.por1R = -0.2
  alReves.tendencia.por1R = -0.05
  comprobar('si el que sale mejor es el otro modo, el listón NO pasa', !juzgar(alReves).pasa)
}
{
  const FUENTE = readFileSync(fileURLToPath(new URL('./lib/preregistro-modos.mjs', import.meta.url)), 'utf8')
  comprobar('y el archivo dice que apagar el modo RANGO es otra pregunta', /Apagar el modo RANGO si saliera al revés/.test(FUENTE))
  comprobar('y que el registro real NO sirve de confirmación', /no su respaldo/.test(FUENTE))
  comprobar('y que no se afloja un criterio por quedar «a un pelo»', /a un pelo/.test(FUENTE))
}

console.log('\n6. Lo que pasa con cada veredicto está escrito ANTES de verlo')
comprobar('hay texto para `pasa` y para `noPasa`', typeof QUE_HACER.pasa === 'string' && typeof QUE_HACER.noPasa === 'string')
// ⚠️ Pasar el listón NO enciende nada: es una propuesta, y la decisión es de
// Néstor. Si esto dejara de decirlo, un veredicto verde se leería como permiso.
comprobar('⚠️ y `pasa` dice que NO se apaga aquí: es decisión de Néstor', /decisión\s+suya/.test(QUE_HACER.pasa) && /No se apaga aquí/.test(QUE_HACER.pasa))
comprobar('y `noPasa` deja la app exactamente como está', /EXACTAMENTE como está/.test(QUE_HACER.noPasa))

console.log('\n7. ⚠️ La medición comprueba que apagar tendencia es una RESTA LIMPIA')
// Todo el listón se apoya en que los dos modos son listas independientes. Si
// se pisaran, apagar uno cambiaría las señales del otro y la medición sería
// «la app con otras señales» — el problema que tienen los ocho filtros ya
// medidos. El guion tiene que comprobarlo, no suponerlo.
{
  const MED = readFileSync(fileURLToPath(new URL('./medir-modos.mjs', import.meta.url)), 'utf8')
  comprobar('el guion compara las señales de rango con las del resto', /choques/.test(MED))
  comprobar('⚠️ y se PARA si se pisan, en vez de seguir midiendo', /choques\.length > 0[\s\S]{0,400}process\.exit\(1\)/.test(MED))
  comprobar('decide con la vara neutra (`simetrica`)', /correr\(simetrica\)/.test(MED))
  comprobar('y la geometría real va como comprobación, no como decisión', /no decide, ver el preregistro/.test(MED))
  // El cajón de lo desconocido: un `tipo` nuevo no puede desaparecer de la
  // tabla en silencio. Es la pieza que faltó cinco veces en este proyecto.
  comprobar('⚠️ y un `tipo` que nadie ha inventado todavía se nombra en vez de desaparecer', /otrosTipos/.test(MED))
  comprobar('⚠️ y el guion NO inventa ceros: pasa `porRiesgo` tal cual', /por1R: m\.porRiesgo,/.test(MED) && !/porRiesgo \?\? 0/.test(MED))
  comprobar('y se PARA cuando no se pudo medir, sin dar veredicto', /noSePudoMedir[\s\S]{0,400}process\.exit\(1\)/.test(MED))
}

console.log(fallos === 0 ? '\n✓ todo bien.\n' : `\n✗ ${fallos} comprobación(es) fallaron.\n`)
process.exit(fallos === 0 ? 0 : 1)
