// ¿Están los avisos al celular en pausa?
//
// Vive aquí, y no dentro del vigía, porque lo necesitan los DOS lados: el
// script que manda los avisos (`scripts/lib/push-envio.mjs`) para no mandar
// nada, y la pantalla del interruptor (`components/AvisosCard.jsx`) para
// decírselo a quien lo active. Si el valor estuviera duplicado, un día
// quedarían en desacuerdo y la app prometería avisos que no llegan nunca.
//
// ────────────────────────────────────────────────────────────────────────
// EN PAUSA DESDE EL 2026-08-12. Decisión de Néstor, con motivo medido.
//
// Aquí la evidencia no es un backtest: son las señales de verdad. Las 6 que
// esta app ha dado desde que existe el historial salieron PERDEDORAS, −180
// pips en total. Y cinco de las seis fueron COMPRA con el RSI entre 77 y 86,
// o sea comprando en el techo de un movimiento ya agotado.
//
// El RSI se calcula y se enseña en pantalla, pero NO filtra nada: nada impide
// que la app diga "compra" con el RSI en 86. Ese es el arreglo pendiente.
//
// Las cinco compartían además R/B exacto de 1.67, que en esta app es la firma
// de "el precio ya rompió todos los niveles de referencia y no queda nada por
// delante": cuando no hay un objetivo real, el código se inventa uno a 2,5 ATR
// y el stop va a 1,5 ATR, así que 2,5/1,5 = 1,67 siempre. El filtro de R/B
// ≥ 1.5 deja pasar ese 1.67 por construcción, o sea que el filtro que debía
// proteger estaba garantizando el paso de justo las peores.
//
// El vigía sigue corriendo y sigue anotando el historial: esos datos son los
// que van a decir si el arreglo funciona. Lo único que se apaga es el aviso.
//
// Para reactivarlos: poner esto en false, y solo DESPUÉS de que las reglas
// nuevas den resultado positivo medido.
// ────────────────────────────────────────────────────────────────────────
export const AVISOS_PAUSADOS = true
