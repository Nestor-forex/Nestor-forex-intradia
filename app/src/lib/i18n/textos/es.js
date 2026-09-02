// Español — idioma base y única fuente de verdad de las claves.
//
// Si una clave falta en otro idioma, se cae a la de aquí (ver crearT.js), así
// que un idioma a medias degrada a español en vez de romperse.
//
// Términos que NO se traducen en ningún idioma, por ser jerga estándar de
// trading: RSI, ATR, EMA, Stop-loss, Take-profit, Pip, Spread, R/B, Forex.
// La dirección de la operación va como BUY/SELL en todos los idiomas menos el
// español, que conserva COMPRA/VENTA por ser el que Néstor ya usa.
//
// Los valores que se guardan en la base de datos (dir 'Compra'/'Venta',
// estado 'abierta'/'cerrada') NUNCA se traducen: aquí solo se traduce cómo se
// muestran. Si se tradujeran, las operaciones viejas dejarían de coincidir.

export default {
  comun: {
    salir: 'Salir',
    eyebrow: 'TRADING · FX',
    administrador: 'Administrador', idioma: 'Idioma',
  },

  splash: {
    lema: 'Señales de alta precisión.',
    entrar: 'Entrar',
    iniciaSesion: 'Inicia sesión para continuar',
  },

  auth: {
    ingresar: 'Ingresar',
    inscribirse: 'Inscribirse',
    correo: 'Correo',
    clave: 'Clave',
    ingresando: 'Ingresando…',
    nombreCompleto: 'Nombre completo',
    creaClave: 'Crea una clave (mín. 6 caracteres)',
    enviando: 'Enviando…',
    enviarSolicitud: 'Enviar solicitud',
    notaSolicitud: 'Tu solicitud queda pendiente hasta que Néstor la autorice.',
    faltanCampos: 'Completa nombre, correo y clave.',
    faltanCredenciales: 'Escribe tu correo y tu clave.',
  },

  pendiente: {
    titulo: 'Solicitud pendiente',
    mensaje: 'Tu solicitud queda pendiente hasta que Néstor la autorice.',
    nota: 'Esta pantalla se actualiza sola: en cuanto Néstor apruebe tu solicitud, entrarás automáticamente sin tener que hacer nada más.',
    retirado: 'Tu acceso fue retirado. Escríbele a Néstor si crees que es un error.',
  },

  nav: {
    historial: 'Historial',
    barrido: 'Barrido',
    diario: 'Diario',
    riesgo: 'Riesgo',
    miembros: 'Miembros',
  },

  // Valores calculados que se muestran traducidos pero por dentro siguen en
  // español (son la salida de clasificar() y de tend).
  sesgo: {
    COMPRA: 'COMPRA',
    VENTA: 'VENTA',
    VIGILAR: 'VIGILAR',
    '—': '—',
  },
  tend: {
    Alcista: 'Alcista',
    Bajista: 'Bajista',
    Rango: 'Rango',
  },
  lado: {
    COMPRA: 'COMPRA',
    VENTA: 'VENTA',
  },
  direccion: {
    Compra: 'Compra',
    Venta: 'Venta',
  },

  sesion: {
    solape: 'Solape Londres-Nueva York (máxima liquidez)',
    londres: 'Londres',
    nuevaYork: 'Nueva York',
    sidney: 'Sídney',
    tokio: 'Tokio',
    asia: 'Asia / Sídney',
  },

  barrido: {
    titulo: 'Barrido intradía (H1)',
    tituloLargo: 'Barrido intradía (H1) · Forex',
    sinConfigurar: 'Esta copia todavía no tiene configurada la fuente de precios en vivo.',
    sinConfigurarLargo:
      'Esta copia todavía no tiene configurada la fuente de precios en vivo (Twelve Data). En cuanto se agregue la llave, el barrido se calcula solo.',
    sinConexion: ({ fecha }) => `⚠ Sin conexión — mostrando el último precio guardado, del ${fecha}.`,
    descargando: 'Descargando precios…',
    descargandoLargo: 'Descargando velas H1 en vivo…',
    pie: 'Velas de 1 hora, precio en vivo (se actualiza cada 15 min). Análisis educativo, no asesoría financiera.',
    verTablero: 'Ver tablero completo →',
    errorPrecios: ({ detalle }) => `No se pudieron obtener los precios en vivo (${detalle}). Revisa la conexión y recarga.`,
  },

  tablero: {
    volver: '← Volver',
    sesionActiva: 'Sesión activa:',
    fuerzaRelativa: 'Fuerza relativa por divisa',
    pares: 'Pares — precio, tendencia y filtros',
    mejoresComprar: 'Mejores para comprar',
    mejoresVender: 'Mejores para vender',
    enVigilancia: 'En vigilancia',
    rangoTitulo: 'Oportunidades de rango',
    rangoPie: 'Pares sin tendencia pero con techo y piso claros: se compra cerca del piso y se vende cerca del techo, con el stop justo por fuera del rango.',
    factorHora: ({ factor }) => `Umbral de señal ajustado a la actividad de esta hora: ×${factor}`,
    setups: 'Setups del top',
    sinCompras: 'Hoy no hay compras con fuerza y tendencia alineadas — no forzar entradas.',
    sinVentas: 'Hoy no hay ventas con fuerza y tendencia alineadas — no forzar entradas.',
    atrPorHora: ({ v }) => `ATR ${v}% / hora`,
    riesgoTitulo: 'Riesgo:',
    riesgoTexto:
      '1-2% del capital por operación. Varias posiciones en la misma divisa no son operaciones independientes — son una sola apuesta con más tamaño.',
    limitacionesTitulo: 'Limitaciones:',
    limitaciones:
      'Velas de 1 hora con máximo, mínimo y cierre reales: el ATR es un ATR de Wilder verdadero y los puntos pivote usan el máximo y el mínimo reales de las 24 horas previas. En los cruces (los que no llevan dólar) el rango se deriva de los dos pares contra el dólar, así que queda algo más amplio que el real. Sin datos de MT5 no hay tick volume ni spread real del bróker — la liquidez se estima cualitativamente.',
    educativo: 'Análisis educativo, no asesoría financiera personalizada. Operar Forex conlleva riesgo de pérdida.',
    descargarMd: '↓ Descargar reporte .md',
    pieFuerza: 'Promedio ponderado del cambio % de cada divisa contra las otras 7 (1h 20%, 4h 40%, 24h 40%), reescalado 0-10.',
    pieParesGrafico: 'Gráfico y variación (%) sobre las últimas 20 velas H1. ATR: ATR de Wilder (14) sobre el rango real de cada hora. Pivote/S1/R1: puntos pivote clásicos con el máximo, el mínimo y el cierre reales de las 24 horas previas.',
    dif: 'Dif',
    pivoteLinea: ({ p, s1, r1 }) => `Pivote ${p} · S1 ${s1} · R1 ${r1}`,
    sufijoVelas: '20h',
  },

  setup: {
    soporte: 'Soporte',
    resistencia: 'Resistencia',
    entrada: 'Entrada',
    stopLoss: 'Stop-loss',
    takeProfit: 'Take-profit',
    rb: 'R/B',
    invalida: 'Invalida:',
    verDetalle: 'Ver la señal en detalle →',
    pivotes: ({ s2, s1, p, r1, r2 }) => `Pivotes de sesión — S2 ${s2} · S1 ${s1} · P ${p} · R1 ${r1} · R2 ${r2}`,
    badgeRango: 'Rango',
  },

  detalle: {
    encabezado: 'Detalle de la señal',
    volver: '← Volver',
    sinDatos:
      'Este setup viene de un barrido guardado antes de esta versión, así que no trae los datos del gráfico. Recarga la app para verlo completo.',
    pip2: '1 pip = 0.01',
    pip4: '1 pip = 0.0001',
    granularidad: 'vela de 1 hora',
    graficoAria: ({ n, par, precio, sl, tp }) =>
      `Últimos ${n} cierres de ${par}. Precio ahora ${precio}, stop-loss ${sl}, objetivo ${tp}.`,
    hace: ({ n }) => `hace ${n} horas`,
    sinVelas: 'cierres · sin velas',
    ahora: 'ahora',
    riesgoBeneficio: 'Riesgo / beneficio',
    barraAria: ({ pct }) => `El riesgo es ${pct} por ciento de la operación.`,
    riesgoPips: ({ n }) => `Riesgo ${n} pips`,
    beneficioPips: ({ n }) => `Beneficio ${n} pips`,
    rbBajo: 'Por debajo de 1:1.5 — arriesgas casi lo mismo que puedes ganar. Considera saltarte este.',
    escenarioCompra: 'Escenario de compra',
    escenarioVenta: 'Escenario de venta',
    escenarioTexto: ({ fuerte, debil, direccion, accion, precio, tp, ema }) =>
      `${fuerte} es la divisa fuerte del barrido y ${debil} va rezagada, con el par en tendencia ${direccion}. ${accion} de ${precio}, con el objetivo en ${tp}. Mejor entrada en un retroceso hacia la EMA9 (${ema}).`,
    alcista: 'alcista',
    bajista: 'bajista',
    comprarPorEncima: 'Comprar por encima',
    venderPorDebajo: 'Vender por debajo',
    nivelActual: 'actual',
    nivelSesion: 'sesión',
    nivelMax20: 'máx. 20',
    nivelMin20: 'mín. 20',
    pivote: 'Pivote',
    // Rótulos cortos dibujados dentro del gráfico: si son largos se salen.
    etqResistencia: 'RESIST.',
    etqPivote: 'PIVOTE',
    etqSoporte: 'SOPORTE',
    porQue: 'Por qué aparece',
    chipExtendido: ' · extendido',
    chipContinuacion: ' · continuación',
    chipEmas: 'EMA9/21 alineadas',
    seInvalida: ({ cond }) => `Se invalida con un ${cond}`,
    sinInvalidacion: 'Sin condición de invalidación.',
    anotar: 'Anotar en el Diario',
    copiar: 'Copiar niveles',
    copiado: 'Copiado',
    aviso:
      'Los niveles salen del barrido, no de un bróker. La app no ejecuta operaciones: “Anotar en el Diario” solo llena tu registro con estos datos para que después midas el resultado.',
    copiaEntrada: ({ v }) => `Entrada: ${v}`,
    copiaSl: ({ v }) => `Stop-loss: ${v}`,
    copiaTp: ({ v }) => `Take-profit: ${v}`,
    copiaRb: ({ v }) => `Riesgo/beneficio: 1:${v}`,
    copiaPips: ({ riesgo, beneficio }) => `Riesgo ${riesgo} pips · beneficio ${beneficio} pips`,
    notaDiario: ({ niveles }) => `Setup del barrido intradía${niveles}`,
  },

  diario: {
    titulo: 'Diario de operaciones',
    operaciones: 'Operaciones',
    ganadas: '% ganadas',
    pl: 'P/L (USD)',
    lote: 'Lote (ej. 0.10)',
    resultado: 'Resultado USD (±)',
    sigueAbierta: 'Sigue abierta (todavía sin resultado)',
    notas: 'Notas (setup, qué aprendiste…)',
    guardar: 'Guardar operación',
    riesgoConcentrado: '⚠ Riesgo concentrado',
    avisoConcentrado: ({ n, moneda, pares }) =>
      `Tienes ${n} operaciones abiertas con ${moneda} (${pares}) — no son apuestas independientes, es una sola apuesta más grande a esa divisa.`,
    cargando: 'Cargando operaciones…',
    abierta: 'Abierta',
    cerrar: 'Cerrar',
    loteSufijo: 'lote',
    vacio: 'Aún no has registrado operaciones.',
    promptCerrar: ({ par }) => `Resultado final de ${par} (USD, usa - para pérdida):`,
  },

  calc: {
    titulo: 'Calculadora de lote y riesgo',
    capital: 'Capital de la cuenta (USD)',
    riesgoPct: 'Riesgo % (1-2)',
    stopPips: 'Stop en pips',
    riesgoUsd: 'Riesgo USD',
    valorPip: 'Valor del pip',
    porLote: '/ lote',
    loteSugerido: 'Lote sugerido',
    lotes: 'lotes',
    completa: 'Completa los campos',
    cargandoTasas: 'Cargando tasas…',
    sinTasas: 'Sin tasas disponibles',
    equivale: 'Equivale a',
    miniMicro: ({ mini, micro }) => `${mini} mini · ${micro} micro`,
    errorTasa: ({ causa }) =>
      `No se pudo obtener la tasa de cambio (${causa}). Esta calculadora la necesita para convertir el valor del pip a dólares.`,
    sinConexion: 'sin conexión',
    error: 'error',
    pie: 'Valor del pip calculado con la tasa de cambio de referencia más reciente, por lote estándar (100.000 unidades). Verifica el valor exacto con tu bróker: el spread y el apalancamiento cambian el resultado real.',
  },

  miembros: {
    titulo: 'Miembros',
    intro: 'Aprueba las solicitudes para dar acceso, o retira a cualquiera cuando quieras. Los cambios se aplican al instante para todos.',
    cargando: 'Cargando miembros…',
    aprobar: 'Aprobar',
    retirar: 'Retirar',
    confirmarRetiro: ({ nombre }) => `¿Retirar a ${nombre}?`,
    vacio: 'Sin solicitudes todavía. Comparte la app para que se inscriban.',
    estadoAprobado: 'aprobado',
    estadoPendiente: 'pendiente',
  },

  glosario: {
    titulo: '¿Qué significan estos términos?',
    terminos: [
      ['Fuerza relativa', 'Qué tan fuerte o débil está una divisa comparada con las otras 7, promediando su cambio de precio reciente. Más alto = más fuerte.'],
      ['Sesgo', 'La inclinación de un par ahora mismo: si conviene más buscar compras o ventas, según qué divisa está más fuerte.'],
      ['Tendencia', 'Si el precio viene subiendo, bajando, o está lateral (sin dirección clara) en las últimas semanas.'],
      ['RSI', 'Mide si un par está "sobrecomprado" (subió muy rápido, podría corregir) o "sobrevendido" (bajó muy rápido). Va de 0 a 100; por encima de 70 o por debajo de 30 son zonas para vigilar.'],
      ['ATR%', 'Qué tanto se mueve el precio de un par en un día normal, en porcentaje. Sirve para poner un stop-loss con espacio razonable, ni muy ajustado ni muy amplio.'],
      ['EMA20 / EMA50', 'El precio promedio de los últimos 20 o 50 días, dándole más peso a los días recientes. Sirve para ver la dirección general sin el ruido de cada día suelto.'],
      ['R/B (riesgo/beneficio)', 'Cuánto se puede ganar comparado con cuánto se arriesga. Un R/B de 2 significa que la ganancia esperada es el doble de lo que se arriesga.'],
      ['Soporte / Resistencia', 'Niveles de precio donde el par ha tenido dificultad para seguir bajando (soporte) o subiendo (resistencia) en el pasado.'],
      ['Stop-loss', 'El precio donde se cierra la operación automáticamente si va en contra, para limitar la pérdida.'],
      ['Take-profit', 'El precio donde se cierra la operación automáticamente si va a favor, para asegurar la ganancia.'],
      ['Invalidación', 'La señal de que la idea de la operación ya no aplica. Si el precio la toca, lo prudente es salir aunque el stop-loss no se haya activado todavía.'],
    ],
  },

  // Textos que arma marketCalc con los números del barrido metidos dentro.
  calc_barrido: {
    adxOk: ({ adx }) => ` · ADX ${adx}: la tendencia tiene fuerza`,
    vigilanciaAdx: ({ dif, favor, adx, min }) => `Diferencial ${dif} a favor de ${favor} y EMAs alineadas, pero el ADX está en ${adx}: por debajo de ${min} no hay tendencia de verdad, solo chapoteo.`,
    vigilanciaRsi: ({ dif, favor, rsi, minRsi }) => `Diferencial ${dif} a favor de ${favor} y EMAs alineadas, pero el RSI ya está en ${rsi}: por encima de ${minRsi} el movimiento ya se hizo y entrar ahora es perseguirlo.`,
    vigilanciaRsiBajo: ({ dif, favor, rsi, minRsi }) => `Diferencial ${dif} a favor de ${favor} y EMAs alineadas, pero el RSI ya está en ${rsi}: por debajo de ${minRsi} el movimiento ya se hizo y entrar ahora es perseguirlo.`,
    razon: ({ b, fb, q, fq, rsi, extra }) => `${b} (${fb}) vs ${q} (${fq}), EMAs alineadas, RSI ${rsi}${extra}`,
    rsiExtendido: ' — RSI extendido, no perseguir, esperar retroceso',
    rsiContinuacion: ' — RSI en zona de continuación',
    vigilancia: ({ dif, favor, tend }) =>
      `Diferencial ${dif} a favor de ${favor}, pero el par sigue en ${tend} — fuerza sin confirmación técnica todavía.`,
    entrada: ({ precio, ema }) => `${precio} actual · mejor en retroceso a EMA9 (${ema})`,
    slCompra: ' (1.5 × ATR bajo la entrada)',
    slVenta: ' (1.5 × ATR sobre la entrada)',
    rangoCompra: ({ lo, hi, atr, rsi }) => `Lateral entre ${lo} y ${hi} (${atr} ATR de ancho). El precio está pegado al piso con RSI ${rsi}: se compra abajo esperando el rebote hacia el techo.`,
    rangoVenta: ({ lo, hi, atr, rsi }) => `Lateral entre ${lo} y ${hi} (${atr} ATR de ancho). El precio está pegado al techo con RSI ${rsi}: se vende arriba esperando la caída hacia el piso.`,
    retrocesoCompra: ({ b, fb, q, fq, adx, rsi }) =>
      `Tendencia alcista con fuerza (ADX ${adx}) y ${b} (${fb}) por encima de ${q} (${fq}), pero el precio se devolvió hasta la EMA9 con RSI ${rsi}: se entra en el retroceso, no persiguiendo.`,
    retrocesoVenta: ({ b, fb, q, fq, adx, rsi }) =>
      `Tendencia bajista con fuerza (ADX ${adx}) y ${q} (${fq}) por encima de ${b} (${fb}), pero el precio rebotó hasta la EMA9 con RSI ${rsi}: se entra en el rebote, no persiguiendo.`,
    entradaRango: ({ precio, borde }) => `${precio} actual · borde del rango en ${borde}`,
    slRangoCompra: ' (½ ATR bajo el piso del rango)',
    slRangoVenta: ' (½ ATR sobre el techo del rango)',
    invalRangoCompra: ({ borde }) => `cierre horario por debajo de ${borde}: el rango se rompió y esto deja de ser un rebote.`,
    invalRangoVenta: ({ borde }) => `cierre horario por encima de ${borde}: el rango se rompió y esto deja de ser un rebote.`,
    rbBajo: ' ⚠ por debajo de 1:1.5',
    invalCompra: ({ sl, b }) => `cierre horario por debajo de ${sl}, o pérdida de fuerza de ${b} en el ranking.`,
    invalVenta: ({ sl, q }) => `cierre horario por encima de ${sl}, o recuperación de fuerza de ${q}.`,
    corte: ({ local, utc, fuente }) => `Vela H1 más reciente: ${local} hora de Colombia (${utc} UTC) · fuente: ${fuente}`,
    fuenteVivo: 'Twelve Data + Capital.com (precio en vivo)',
    fuenteCierre: 'Twelve Data',
  },

  avisos: {
    // Se le dice al miembro por qué están apagados, en vez de dejar el
    // interruptor puesto y que se quede esperando un aviso que no va a llegar.
    // Sin tecnicismos y sin excusas: se midieron las señales, no funcionaron.
    pausados: 'Avisos en pausa mientras revisamos las señales',
    pausadosPorque:
      'Revisamos todas las señales que esta app ha dado desde que lleva historial y ninguna acertó. Preferimos no avisarte de nada antes que avisarte de algo que te haga perder dinero. La app sigue mostrando el barrido y sigue anotando cada señal para comprobar la corrección; los avisos vuelven cuando los números lo respalden.',
    titulo: 'Avisos al celular',
    desc: 'Te avisamos apenas el vigía detecte una señal nueva, aunque tengas la app cerrada.',
    activar: 'Activar avisos',
    activando: 'Activando…',
    desactivar: 'Desactivar',
    activados: 'Avisos activados en este aparato',
    probar: 'Probar',
    pruebaTitulo: 'Aviso de prueba',
    pruebaCuerpo: 'Si ves esto, los avisos funcionan en este aparato.',
    noSoportado: 'Este navegador no puede recibir avisos. Prueba con Chrome en Android o Safari en iPhone.',
    iosSinInstalar: 'En iPhone y iPad los avisos solo llegan si la app está instalada en la pantalla de inicio. Toca Compartir y luego «Añadir a inicio», y vuelve a abrir la app desde ese ícono.',
    denegado: 'Los avisos están bloqueados para esta app. Hay que volver a permitirlos desde los ajustes del navegador o del celular.',
    fallo: 'No se pudieron activar los avisos. Inténtalo de nuevo.',
    soloEsteAparato: 'Los avisos se activan por aparato: si usas la app en el celular y en el computador, actívalos en cada uno.',
  },

  historial: {
    titulo: 'Historial de señales',
    intro: 'Cada señal que encontró el vigía y qué pasó después.',
    cargando: 'Cargando el historial…',
    error: 'No se pudo cargar el historial. Revisa la conexión.',
    vacio: 'Todavía no hay ninguna señal.',
    vacioLargo: 'El vigía revisa el mercado cada hora y anota aquí lo que encuentra. En cuanto aparezca la primera señal, la verás.',
    acierto: 'Acierto',
    operaciones: 'Operaciones',
    pips: 'Pips netos',
    sinJuzgar: 'Sin juzgar todavía',
    ganada: 'Acertó',
    perdida: 'Falló',
    abierta: 'En curso',
    caducada: 'Sin datos',
    avisoCruces: 'En los cruces (EUR/CHF, AUD/JPY…) el máximo y el mínimo se calculan de forma aproximada, así que su resultado puede ser algo optimista. Abajo van aparte las cuentas de los pares contra el dólar, que sí son exactas.',
    soloExactas: 'Solo pares contra el dólar',
  },

  errores: {
    'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Prueba en "Ingresar".',
    'auth/invalid-email': 'Ese correo no parece válido.',
    'auth/weak-password': 'La clave debe tener al menos 6 caracteres.',
    'auth/missing-password': 'Escribe una clave.',
    'auth/user-not-found': 'Correo o clave incorrectos, o aún no estás inscrito.',
    'auth/wrong-password': 'Correo o clave incorrectos, o aún no estás inscrito.',
    'auth/invalid-credential': 'Correo o clave incorrectos, o aún no estás inscrito.',
    'auth/invalid-login-credentials': 'Correo o clave incorrectos, o aún no estás inscrito.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento y vuelve a intentar.',
    'auth/network-request-failed': 'No hay conexión a internet. Revisa tu señal y vuelve a intentar.',
    generico: 'Algo salió mal. Inténtalo de nuevo.',
  },
}
