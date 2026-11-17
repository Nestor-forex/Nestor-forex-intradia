// LA ESCUCHA COMPARTIDA DEL PRECIO AL SEGUNDO (2026-11-17).
//
// Sacada de `usePrecioMt5.js` para poder probarla sin navegador ni Firebase
// (`scripts/prueba-escucha-vivo.mjs`). No importa nada: quien la usa le pasa
// las cuatro piezas de fuera.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ EL FALLO QUE LA HIZO NECESARIA
// ─────────────────────────────────────────────────────────────────────────
//
// La primera versión empezaba a escuchar en cuanto la app se abría, con la
// pantalla de entrada todavía delante y SIN SESIÓN. Las reglas solo dejan leer
// `vivo/precios` con sesión, así que Firestore contestaba «sin permiso», la
// escucha se paraba… y nadie la volvía a encender al entrar. Resultado: el
// puente escribía cada segundo y la app seguía enseñando la foto de cada 5
// minutos, sin dar ningún error. Lo vio Néstor el mismo día de encenderlo.
//
// Por eso ahora:
//
// · SIN SESIÓN NO SE ESCUCHA. Ni siquiera se intenta: un intento sin sesión
//   solo sirve para que Firestore diga que no.
// · CADA VEZ QUE CAMBIA LA SESIÓN SE EMPIEZA DE NUEVO. Al entrar, se escucha;
//   al salir, se para.
// · SI FIRESTORE DICE QUE NO, SE PARA y se vuelve a probar al cambiar la
//   sesión o al volver a la app — nunca en bucle, porque cada intento cuenta.
//
// Y lo de antes sigue igual: UNA SOLA escucha aunque la pidan tres pantallas
// (cada cambio que llega es una lectura pagada) y NINGUNA con la app en
// segundo plano.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ «ESPERANDO» (2026-11-17, tarde): que la pantalla no diga una cosa y a los
// dos segundos otra
// ─────────────────────────────────────────────────────────────────────────
//
// Néstor: «al principio dice foto de hace x min pero a los pocos segundos
// cambia y dice precio al segundo… debe aparecer lo que es al instante».
// Mientras la sesión todavía no se sabe, o la primera foto de Firestore no ha
// llegado, la app NO SABE si hay precio al segundo, y enseñaba la foto de
// cada 5 minutos como si eso fuera lo que hay. Ahora `esperando()` lo dice, y
// la pantalla escribe «conectando» en vez de afirmar algo que no sabe.
//
// · Termina con la PRIMERA respuesta de Firestore, buena o mala: con el
//   puente apagado también llega una (la foto vieja), así que la pantalla pasa
//   enseguida a decir lo que de verdad hay.
// · Y con un tope (ESPERA_MAX_MS): sin red Firestore no contesta nunca, y
//   «conectando» para siempre sería otra forma de no decir la verdad.
//
// GEMELO: el puente es uno para las dos apps.

/** Lo máximo que se espera la primera respuesta antes de dejar de decir «conectando». */
export const ESPERA_MAX_MS = 6000

/**
 * @param suscribirDoc    (alDato, alError) => dejar   escucha `vivo/precios`
 * @param suscribirSesion (alCambiar) => dejar         avisa cada vez que cambia la sesión
 * @param haySesion       () => boolean
 * @param visible         () => boolean                 ¿la app está delante?
 * @param programar       (f, ms) => id, y `cancelar(id)`: el reloj (para las pruebas)
 */
export function crearEscuchaVivo({
  suscribirDoc,
  suscribirSesion,
  haySesion,
  visible,
  programar = (f, ms) => setTimeout(f, ms),
  cancelar = (id) => clearTimeout(id),
}) {
  let ultimo = null
  const oyentes = new Set()
  let dejarDoc = null
  let dejarSesion = null
  // Para `esperando()`.
  let sesionResuelta = false
  let recibido = false
  let vencido = false
  let reloj = null

  const avisar = () => {
    for (const f of oyentes) f()
  }

  function esperando() {
    if (!oyentes.size || vencido) return false
    if (!sesionResuelta) return true
    return dejarDoc !== null && !recibido
  }

  // Avisa solo si `esperando()` cambió: así la pantalla se entera en el mismo
  // instante en que deja de esperar.
  function siCambia(antes) {
    if (esperando() !== antes) avisar()
  }

  function empezarEspera() {
    vencido = false
    if (reloj !== null) cancelar(reloj)
    reloj = programar(() => {
      reloj = null
      const antes = esperando()
      vencido = true
      siCambia(antes)
    }, ESPERA_MAX_MS)
  }

  function escuchar() {
    if (dejarDoc || !oyentes.size || !visible() || !haySesion()) return
    recibido = false
    empezarEspera()
    // Cada escucha lleva su ficha. Así un error que llega tarde, de una escucha
    // que ya se cambió por otra, no apaga la nueva; y un error que llega antes
    // de que `suscribirDoc` devuelva no deja una escucha muerta apuntada como
    // viva.
    const ficha = { muerta: false, dejar: null }
    const dejar = suscribirDoc(
      (dato) => {
        if (ficha.muerta) return
        ultimo = dato
        recibido = true
        avisar()
      },
      () => {
        // Sin permiso o sin red: se para. Y ya no se espera nada de ella.
        const antes = esperando()
        ficha.muerta = true
        if (dejarDoc === ficha.dejar) dejarDoc = null
        siCambia(antes)
      },
    )
    ficha.dejar = dejar
    if (!ficha.muerta) dejarDoc = dejar
  }

  function parar() {
    if (dejarDoc) dejarDoc()
    dejarDoc = null
  }

  function alCambiarSesion() {
    const antes = esperando()
    sesionResuelta = true
    parar()
    // Sin sesión, lo que se tenía ya no vale: es de otra persona o de nadie.
    let olvido = false
    if (!haySesion() && ultimo !== null) {
      ultimo = null
      olvido = true
    }
    escuchar()
    if (olvido) avisar()
    else siCambia(antes)
  }

  return {
    ultimo: () => ultimo,
    activo: () => dejarDoc !== null,
    esperando,
    /** Lo que una pantalla que se abre debe suponer ANTES de apuntarse: si ya
     *  hay otras escuchando, lo que ellas saben; si no, que se está esperando. */
    esperandoAlAbrir: () => (oyentes.size ? esperando() : true),
    apuntar(f) {
      oyentes.add(f)
      if (oyentes.size === 1) {
        // Mientras se sabe si hay sesión también se espera, con el mismo tope.
        empezarEspera()
        dejarSesion = suscribirSesion(alCambiarSesion)
      }
      escuchar()
      return () => {
        oyentes.delete(f)
        if (!oyentes.size) {
          parar()
          if (dejarSesion) dejarSesion()
          dejarSesion = null
          if (reloj !== null) cancelar(reloj)
          reloj = null
        }
      }
    },
    alCambiarVisibilidad() {
      const antes = esperando()
      if (visible()) escuchar()
      else parar()
      siCambia(antes)
    },
  }
}
