// La línea del reporte que explica POR QUÉ la app propone lo que propone:
// hasta dónde llegó la divergencia de fuerza de esa hora y cuánto hacía falta.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ POR QUÉ ESTO VIVE AQUÍ Y NO DENTRO DE `reporte-diario.mjs`
// ─────────────────────────────────────────────────────────────────────────
// Porque ahí no se podía probar. `reporte-diario.mjs` pide velas a Twelve Data
// en cuanto se importa, así que ninguna comprobación sin internet podía
// llamar a esta función — y el 2026-10-20 eso costó un fallo real que publicó
// una frase falsa en el chat de Néstor (abajo).
//
// Es el mismo motivo por el que `medir()` salió de `backtest.mjs`: de aquí sale
// texto que una persona LEE para decidir, así que tiene que tener pruebas.
//
// ⚠️ PRIMO, no gemelo: cada app redacta su propio texto, y aquí hay dos cosas
// que en Swing no existen —el umbral cambia con la hora y el MODO RANGO da
// señales sin pasar por el umbral—. Lo que SÍ es igual en las dos, y lo vigila
// `prueba-umbral.mjs` (que es GEMELO), es la disciplina: esta frase no afirma
// «no hay señales» sin que se le haya dicho si hay señales.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ EL FALLO DEL 2026-10-20, QUE ES LA RAZÓN DE `haySenales`
// ─────────────────────────────────────────────────────────────────────────
// La primera versión terminaba SIEMPRE en «Por eso no hay señales». El reporte
// de la apertura de Asia salió con esa frase **y con una señal de rango justo
// encima** (USD/CHF VENTA, R/B 1:1.8).
//
// Y no era un descuido de redacción, era un error de diseño: **`clasificarRango`
// NO recibe el umbral** —comprobado en `marketCalc.js`, no supuesto—, así que
// el modo rango puede dar señales un día en que ningún par se acerque al
// umbral de fuerza. O sea que la frase era falsa por construcción en
// exactamente el caso que más se repite en esta app.
//
// 📌 La causa de fondo: esta función **sólo veía `difMax` y `umbral`**, así que
// no tenía con qué saber si había señales y aun así afirmaba que no las había.
// Una función que afirma algo que no puede comprobar lo va a afirmar mal algún
// día. Ahora se le pasa, y si no se le pasa no lo dice.
//
// ⚠️ Y la redacción con señales la pidió Néstor con estas palabras: «ningún par
// llegó al umbral de fuerza, así que NO HAY SEÑALES DE TENDENCIA». Es exacta y
// es lo que hay que decir: el umbral gobierna la tendencia, no el rango.

// ⚠️ EL UMBRAL CAMBIA CON LA HORA, y ésta es la mitad que solo pasa aquí: en el
// solape de Londres con Nueva York sube ~19 % a propósito, porque a esa hora
// todo se separa más. Por eso se enseña el umbral de CADA reporte y no un
// número fijo — en Swing sería siempre el mismo.
//
// ⚠️⚠️ Y NO SE PUEDE DEDUCIR DE LA LÍNEA DE FUERZA QUE ESTÁ ARRIBA. La escala
// 0-10 es una normalización de mínimo a máximo: el más débil vale 0 y el más
// fuerte 10 SIEMPRE, por pequeña que sea la diferencia real. El 2026-10-12 yo
// leí «CAD 10,0 · CHF 0,0» y afirmé que había divergencia de sobra; la mayor
// de verdad era 0,31 contra un umbral de 0,59. La escala es un ORDEN, no una
// magnitud.
//
// Se enseña SIEMPRE, también con señales, y a propósito: si apareciera solo en
// los reportes vacíos, su presencia sería el mensaje y nadie leería los números.
export const lineaUmbral = ({ difMax, umbral, haySenales = false }) => {
  // ⚠️ Ante la duda NO SE ESCRIBE NADA. `difMax` es `null` cuando no se pudo
  // medir, y una línea inventada aquí es peor que ninguna.
  if (!Number.isFinite(difMax) || !Number.isFinite(umbral)) return ''
  const d = difMax.toFixed(2)
  const u = umbral.toFixed(2)
  if (difMax > umbral) {
    return `\n\n_Divergencia: el par más separado iba a ${d} y el umbral de esta hora era ${u}._`
  }
  const hecho = `Ningún par llegó al umbral de fuerza: el más separado iba a ${d} y hacía falta ${u}`
  // Si hay señales y nadie pasó el umbral, esas señales son de MODO RANGO por
  // construcción: el rango no mira el umbral. Decirlo así es lo único exacto.
  return haySenales
    ? `\n\n_${hecho}, así que no hay señales de tendencia — las de arriba son de modo rango._`
    : `\n\n_${hecho}. Por eso la app no propone ninguna señal ahora._`
}
