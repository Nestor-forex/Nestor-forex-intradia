// Las cuentas de la fecha de vencimiento de una suscripción.
//
// Vive en `src/` porque lo necesitan LAS DOS mitades: la pantalla de Miembros
// (para enseñar cuánto le queda a cada quien y correr la fecha un mes) y el
// robot que cierra puertas, que corre en Node. `scripts/lib/vencimientos.mjs`
// lo reexporta en vez de copiarlo — dos copias de una cuenta de días es la
// forma más fácil de que un día digan cosas distintas.
//
// ⚠️ LAS DOS APPS COMPARTEN LA COLECCIÓN `users` (mismo proyecto de Firebase).
// Una fecha de vencimiento vale para Swing Y para Intradía a la vez; no existe
// «vence solo en una». Por eso este archivo es GEMELO.
//
// Todo va en UTC y en texto 'AAAA-MM-DD' a propósito: así el orden alfabético
// es el orden cronológico, y ningún cambio de hora de verano mueve un día.

// Cuántos días DESPUÉS de la fecha se sigue dejando entrar.
//
// ⚠️ No es generosidad suelta: es la defensa contra el huso horario. El robot
// mira el día en UTC y Néstor y sus suscriptores viven en UTC−5 o UTC−4, así
// que a las 19:00 de Colombia en UTC ya es mañana. Sin margen, alguien con
// fecha del 15 se quedaría fuera a las 7 de la tarde del 15 — habiendo pagado
// ese día. Con un día de margen eso no puede pasar en ningún huso del mundo,
// y el precio es dejar entrar 24 horas de más a quien no renovó.
//
// De los dos errores, ése es el barato: 24 horas de acceso regalado se
// recuperan solas; echar a un cliente que sí pagó se recupera con una
// disculpa, y no siempre.
export const DIAS_GRACIA = 1

// Cuánto dura un ciclo cuando Néstor pulsa «+1 mes».
// 30 días y no «el mismo día del mes que viene»: así todos los ciclos duran
// lo mismo y nadie paga 28 días en febrero y 31 en marzo por el mismo precio.
export const DIAS_CICLO = 30

const ISO = /^\d{4}-\d{2}-\d{2}$/

// Una fecha es válida solo si además de tener la forma EXISTE de verdad.
//
// El `2026-02-31` pasa el patrón y `new Date()` lo traga convirtiéndolo en
// marzo, sin avisar. Por eso se compara la ida con la vuelta: si el texto que
// sale no es el que entró, la fecha no existía.
export function esFechaISO(v) {
  if (typeof v !== 'string' || !ISO.test(v)) return false
  const t = Date.parse(`${v}T00:00:00Z`)
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v
}

// Días enteros de `desde` a `hasta`, las dos en 'AAAA-MM-DD'.
// Positivo si `hasta` es posterior. Devuelve null si alguna no vale.
export function diasEntre(desde, hasta) {
  if (!esFechaISO(desde) || !esFechaISO(hasta)) return null
  const a = Date.parse(`${desde}T00:00:00Z`)
  const b = Date.parse(`${hasta}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

// Cuántos días le quedan a alguien, contando desde `hoy`.
// 0 = vence hoy · negativo = ya venció · null = no se sabe.
export function diasRestantes(venceEl, hoy) {
  return diasEntre(hoy, venceEl)
}

// Correr la fecha de vencimiento un ciclo más.
//
// ⚠️ SE SUMA DESDE LA FECHA QUE YA TENÍA, no desde hoy, mientras no haya
// vencido. Quien paga tres días antes de que se le acabe no puede perder esos
// tres días por ser puntual — eso castigaría justo al buen cliente. Si ya
// venció (o no tenía fecha), el ciclo arranca hoy.
export function extender(venceEl, hoy, dias = DIAS_CICLO) {
  if (!esFechaISO(hoy)) return null
  const desde = esFechaISO(venceEl) && diasEntre(hoy, venceEl) > 0 ? venceEl : hoy
  const t = Date.parse(`${desde}T00:00:00Z`) + dias * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

// El día de hoy en UTC, que es la vara con la que mide el robot.
//
// ⚠️ La pantalla usa ESTA y no la fecha local del teléfono, para que lo que
// Néstor ve («le quedan 3 días») sea exactamente lo que el robot va a
// calcular esta noche. Si cada uno contara con su calendario, la pantalla
// diría 3 y el robot cerraría al día siguiente, o al revés.
export function hoyUTC(ahora = new Date()) {
  return ahora.toISOString().slice(0, 10)
}
