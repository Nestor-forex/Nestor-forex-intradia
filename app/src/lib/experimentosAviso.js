// LOS EXPERIMENTOS DE ESTA APP QUE PUEDEN AVISAR AL CELULAR (Intradía).
//
// PRIMO: la lista es distinta en cada app. Aquí, los dos modos de la app
// (tendencia y rango) y la regla de la sombra (el retroceso). La cuenta de qué
// está activado vive en `avisosExperimento.js`, que es GEMELO.
//
// ⚠️ «Comprar la caída» NO está aquí: midió −0,08 plano con velas de una hora y
// esta app no la anota. Lo que no se anota no puede avisar.
//
// ⚠️ `claveDeSenal` reconoce cada señal por lo que es; lo que no reconoce
// devuelve null y no avisa. Una regla nueva no suena hasta que alguien venga a
// escribirla aquí.

export const OPCIONES = [
  { clave: 'tendencia', etiqueta: 'avisosExp.op.tendencia' },
  { clave: 'rango', etiqueta: 'avisosExp.op.rango' },
  { clave: 'retroceso', etiqueta: 'avisosExp.op.retroceso' },
]

// Lo que vale mientras alguien no ha tocado ningún interruptor: NADA, para
// todos. Antes de los interruptores esta app no le mandaba ningún experimento
// a nadie, y desde el 2026-11-15 los ven todos los miembros: encenderlo tiene
// que ser una decisión de cada uno, leída la advertencia de que no son señales.
export const DEFECTO_ADMIN = []
export const DEFECTO_MIEMBRO = []
export const defectoPara = (esAdmin) => (esAdmin ? DEFECTO_ADMIN : DEFECTO_MIEMBRO)

// Las que son señales DE LA APP (los dos modos). Por aquí solo suenan mientras
// los avisos de la app estén en pausa: si se reactivan, ya le llegan por el
// camino normal y por aquí sonarían dos veces.
export const DE_LA_APP = new Set(['tendencia', 'rango'])

/** A qué interruptor pertenece una señal del vigía, o null si a ninguno. */
export function claveDeSenal(s) {
  if (!s) return null
  if (!s.tipo || s.tipo === 'tendencia') return 'tendencia'
  if (s.tipo === 'rango') return 'rango'
  if (s.tipo === 'retroceso') return 'retroceso'
  return null
}
