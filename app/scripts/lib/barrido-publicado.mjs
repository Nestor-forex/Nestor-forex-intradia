// EL ARCHIVO QUE LEE LA APP.
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
// ─────────────────────────────────────────────────────────────────────────
// Hasta ahora la app le pedía las velas a Twelve Data DESDE EL NAVEGADOR de
// cada persona. Eso traía dos problemas, y ninguno se arregla con más código
// en el navegador:
//
// 1. LA CLAVE VIAJABA DENTRO DE LA APP. Cualquiera que abriera la página podía
//    sacarla del JavaScript y gastar la cuota. Es el mismo agujero que ya se
//    cerró con las credenciales de Capital.com, por el mismo camino.
//
// 2. EL TECHO DE SUSCRIPTORES. Cada apertura de la app costaba 7 créditos de
//    los 800 diarios del plan gratuito, y se repetían cada 15 minutos mientras
//    la app siguiera abierta. Una sola persona con la app abierta ocho horas
//    gastaba 224 créditos: TRES personas agotaban el día entero. No era un
//    techo de ~20 suscriptores, era bastante peor.
//
// Ahora la consulta la hace el vigía —que corre en GitHub, donde la clave sí
// puede estar guardada— y publica aquí el barrido ya calculado. La app se baja
// este archivo. Da igual si lo abren dos personas o doscientas: el coste en
// créditos no depende de cuánta gente lo lea.
//
// ─────────────────────────────────────────────────────────────────────────
// QUÉ SE PUBLICA Y QUÉ NO
// ─────────────────────────────────────────────────────────────────────────
// Todo lo que trae cada par MENOS las tres series largas. `derivarVista` se
// sigue ejecutando en el navegador y no aquí, porque necesita el idioma de
// cada persona y eso el servidor no lo sabe.
//
// Se quitan por nombre —lista de lo que SALE, no de lo que entra— a propósito.
// Con una lista de lo que entra, el día que `computarBarrido` calcule un campo
// nuevo, la app se quedaría sin él y el fallo aparecería como una pantalla
// rara, no como un error. Así al revés: lo nuevo pasa solo, y de que no se
// cuele otra serie larga se encarga la prueba (`prueba-barrido-publicado.mjs`,
// que falla si algún campo publicado trae más de 30 números).

// ⚠️ Estas tres son 300 números POR PAR, y hay 18 pares. Dejarlas dentro
// llevaría el archivo de unos 30 KB a más de dos megas, y ese peso lo paga
// cada miembro cada vez que abre la app. Solo las necesita el resolver, que
// corre aquí mismo, en el vigía.
export const SERIES_LARGAS = ['highs', 'lows', 'closes']

/**
 * Arma el objeto que se guarda en `estado/barrido.json`.
 *
 * @param data   lo que devuelve `computarBarrido`
 * @param ahora  Date de la corrida, para que el archivo diga cuándo se hizo
 */
export function armarBarrido(data, ahora = new Date()) {
  return {
    generadoEl: ahora.toISOString(),
    ultima: data.ultima,
    raw: data.raw,
    esc: data.esc,
    ratesUSD: data.ratesUSD,
    // Lo propio de intradía, que en swing no hace falta: la hora de la última
    // vela decide qué sesiones están abiertas y con qué umbral se clasifica.
    // Sin estos dos campos la app se caería a la hora del reloj del teléfono,
    // que puede no ser la del dato, y la etiqueta de sesión hablaría de otro
    // momento distinto al del barrido.
    horaUltima: data.horaUltima,
    factorHora: data.factorHora,
    pares: data.pares.map((p) => {
      const salida = {}
      for (const [campo, valor] of Object.entries(p)) {
        if (!SERIES_LARGAS.includes(campo)) salida[campo] = valor
      }
      return salida
    }),
  }
}
