// EL LISTÓN PARA LAS VELAS DE 15 MINUTOS — escrito el 2026-09-28, ANTES de
// correr la medición ni una sola vez.
//
// ─────────────────────────────────────────────────────────────────────────
// PARA QUÉ SIRVE ESTO, EN CRISTIANO
// ─────────────────────────────────────────────────────────────────────────
// Es decidir la nota para aprobar ANTES de hacer el examen, no después de ver
// las respuestas.
//
// Si se mide una idea y DESPUÉS se decide qué cuenta como «buena», siempre se
// encuentra una forma de que algo parezca bueno. No hace falta mala intención:
// con veinte números delante, alguno es el mejor de los veinte aunque los
// veinte sirvan para nada — igual que al tirar veinte monedas alguna sale cara
// más veces, sin ser una moneda con suerte.
//
// 📌 Y en este proyecto eso ya costó algo real. El 2026-08-12 se subió el
// filtro del ADX de 20 a 35 porque «acertaba más», mirando el número y
// decidiendo después. El resultado fueron SIETE reportes seguidos sin una sola
// señal. Este archivo existe para que eso no se repita.
//
// ⚠️⚠️ SI UN RESULTADO QUEDA A UN PELO DE PASAR, LA RESPUESTA NO ES AFLOJAR UN
// CRITERIO. Ése es el momento exacto para el que se escribió esto antes.
//
// ─────────────────────────────────────────────────────────────────────────
// QUÉ SE ESTÁ PREGUNTANDO
// ─────────────────────────────────────────────────────────────────────────
// Una sola cosa: **¿el barrido de la app de intradía, con sus ventanas
// medidas con el MISMO RELOJ pero sobre velas de 15 minutos, tiene ventaja?**
//
// No es «¿qué combinación de ventanas mide mejor en M15?». Esa pregunta no se
// hace, y no por pereza: los años 2021-2026 ya se usaron para elegir las
// reglas que la app tiene hoy, así que buscar otra vez en ellos devuelve el
// mejor número por construcción y no porque funcione. Se mide UNA
// configuración, la que sale de escalar por reloj, y se mide una vez.
//
// ⚠️ Las herramientas de información (calendario, tasas, COT, correlación,
// spread del bróker, actividad) NO entran en esta medición, y no es un olvido:
// hoy no apagan ni una señal, así que no hay nada que medir. Para que entraran
// en la decisión pasarían a ser FILTROS, y un filtro va al banco de pruebas
// con su propio listón escrito antes. Van siete familias de filtros medidas en
// este proyecto y las siete fallaron; eso no condena a la octava, pero sí
// significa que ninguna se enciende sin medirla.

export const FECHA_PREREGISTRO = '2026-09-28'

// La vara con la que se mide, y es la de siempre en este proyecto: objetivo y
// stop a la misma distancia (1:1) y el spread por par descontado.
//
// ⚠️ NO se decide con la geometría real de la app. Eso se imprime al lado como
// comprobación, nunca como criterio, y el motivo está medido: con el COT
// (2026-09-14) un filtro salió POSITIVO en las dos mitades con la geometría
// real y NEGATIVO en las dos con la vara neutra, sobre las mismas operaciones
// y los mismos días. Un filtro que sabe hacia dónde va el precio acierta con
// cualquier vara; ése no sabía nada, solo elegía operaciones con buena
// proporción objetivo/riesgo. Decidiendo con la geometría real se habría
// encendido.
export const VARA = 'neutra 1:1, spread por par descontado'

// Cuántas noches de swap tiene que aguantar. Medido sobre las operaciones
// REALES de esta app (Fase 2, 2026-09-02): el 52 % cruzó al menos una noche,
// duración mediana 9 horas y máxima 102. O sea que «se llama intradía» es la
// INTENCIÓN, no lo que pasa. En M15 las operaciones serán más cortas, pero la
// exigencia no se baja por una suposición.
export const SWAP_EXIGIDO = 0.5

// Mínimo de operaciones. Con 300 el margen del peor caso es ±5,7 puntos
// porcentuales (98/√n); por debajo de eso un 48 % y un 54 % son el mismo
// número y no se puede decidir nada. En M15 sobre dos años y medio habrá de
// sobra, así que este criterio no es el que aprieta — está para que nadie
// pueda concluir algo de una muestra corta si un día se mide menos historia.
export const OPS_MINIMAS = 300

// Cuánto puede aportar el par que más aporte. Si una sola pareja de divisas
// pone la mitad de las operaciones, lo medido es esa pareja y no la regla.
export const TOPE_UN_PAR = 0.4

// ─────────────────────────────────────────────────────────────────────────
// LOS SEIS CRITERIOS. Todos obligatorios.
// ─────────────────────────────────────────────────────────────────────────
export const CRITERIOS = Object.freeze([
  {
    clave: 'ops',
    dice: `al menos ${OPS_MINIMAS} operaciones resueltas`,
    porque: 'por debajo de eso el margen del peor caso se come la diferencia',
  },
  {
    clave: 'gana',
    dice: 'por 1R mayor que cero con los costes puestos',
    porque: 'una regla que pierde no es un hallazgo, por mucho que pierda menos que otra',
  },
  {
    clave: 'mitades',
    dice: 'gana en las DOS mitades del periodo',
    porque: 'es el criterio que el ADX no pasó: un número bueno en una sola mitad no es una mejora',
  },
  {
    clave: 'mejorQueH1',
    dice: 'mejor que la MISMA app en velas de una hora, sobre el mismo periodo',
    porque: 'si no le gana a lo que ya hay, no es un motivo para cambiar de temporalidad',
  },
  {
    clave: 'swap',
    dice: `sigue ganando pagando ${SWAP_EXIGIDO} pips de swap por noche`,
    porque: 'el 52 % de las operaciones reales de esta app cruzan al menos una noche',
  },
  {
    clave: 'concentracion',
    dice: `ningún par aporta más del ${Math.round(TOPE_UN_PAR * 100)} % de las operaciones`,
    porque: 'si lo pone un solo par, lo medido es ese par y no la regla',
  },
])

// ⚠️ EL VEREDICTO LO CALCULA ESTA FUNCIÓN. No lo argumenta nadie.
//
// `r` es lo medido, y tiene que traer:
//   ops          operaciones resueltas
//   porRiesgo    por 1R con costes, vara neutra
//   mitad1       por 1R de la primera mitad
//   mitad2       por 1R de la segunda mitad
//   conSwap      por 1R pagando SWAP_EXIGIDO por noche
//   h1PorRiesgo  por 1R de la app en H1, mismo periodo y misma vara
//   parMayor     proporción (0 a 1) del par que más operaciones aporta
//
// Un campo que falte NO se da por bueno: el criterio falla. Es la asimetría de
// siempre —`yaCorrioHoy`, `esSombra`, el guardián del calendario—: equivocarse
// hacia «no pasa» cuesta una medición repetida, y hacia «pasa» cuesta
// encender una regla sin probar.
export function juzgar(r = {}) {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

  const ops = num(r.ops)
  const por = num(r.porRiesgo)
  const m1 = num(r.mitad1)
  const m2 = num(r.mitad2)
  const sw = num(r.conSwap)
  const h1 = num(r.h1PorRiesgo)
  const par = num(r.parMayor)

  const resultados = [
    { clave: 'ops', pasa: ops !== null && ops >= OPS_MINIMAS, valor: ops },
    { clave: 'gana', pasa: por !== null && por > 0, valor: por },
    { clave: 'mitades', pasa: m1 !== null && m2 !== null && m1 > 0 && m2 > 0, valor: [m1, m2] },
    { clave: 'mejorQueH1', pasa: por !== null && h1 !== null && por > h1, valor: [por, h1] },
    { clave: 'swap', pasa: sw !== null && sw > 0, valor: sw },
    { clave: 'concentracion', pasa: par !== null && par <= TOPE_UN_PAR, valor: par },
  ]

  const fallan = resultados.filter((x) => !x.pasa).map((x) => x.clave)
  return { pasa: fallan.length === 0, fallan, resultados }
}

// ⚠️⚠️ Y LO QUE PASAR EL LISTÓN **NO** AUTORIZA.
//
// Pasarlo es NECESARIO Y NO SUFICIENTE. Estos años ya se miraron, así que
// aprobar aquí no significa encender nada en la app: significa que la idea se
// gana un registro HACIA ADELANTE en la sombra, anotada sin enseñarse, hasta
// juntar operaciones reales. Es el mismo camino que siguieron la reversión y
// «comprar la caída» en la app hermana, y el que sigue hoy la ruptura de
// estructura.
//
// Y suspender tampoco es una tragedia: es la respuesta a una pregunta que
// llevaba sin contestar, y contestarla cuesta 112 créditos una vez.
export const QUE_PASA_SI_PASA =
  'Registro hacia adelante en la sombra. NO se enciende nada en la app, ' +
  'ni se enseña en ninguna pantalla: una regla sin validar puesta en una ' +
  'pantalla se lee como validada por el hecho de estar ahí.'
