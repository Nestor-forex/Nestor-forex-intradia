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
// GEMELO: el puente es uno para las dos apps.

/**
 * @param suscribirDoc    (alDato, alError) => dejar   escucha `vivo/precios`
 * @param suscribirSesion (alCambiar) => dejar         avisa cada vez que cambia la sesión
 * @param haySesion       () => boolean
 * @param visible         () => boolean                 ¿la app está delante?
 */
export function crearEscuchaVivo({ suscribirDoc, suscribirSesion, haySesion, visible }) {
  let ultimo = null
  const oyentes = new Set()
  let dejarDoc = null
  let dejarSesion = null

  const avisar = () => {
    for (const f of oyentes) f()
  }

  function escuchar() {
    if (dejarDoc || !oyentes.size || !visible() || !haySesion()) return
    // Cada escucha lleva su ficha. Así un error que llega tarde, de una escucha
    // que ya se cambió por otra, no apaga la nueva; y un error que llega antes
    // de que `suscribirDoc` devuelva no deja una escucha muerta apuntada como
    // viva.
    const ficha = { muerta: false, dejar: null }
    const dejar = suscribirDoc(
      (dato) => {
        if (ficha.muerta) return
        ultimo = dato
        avisar()
      },
      () => {
        // Sin permiso o sin red: se para.
        ficha.muerta = true
        if (dejarDoc === ficha.dejar) dejarDoc = null
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
    parar()
    // Sin sesión, lo que se tenía ya no vale: es de otra persona o de nadie.
    if (!haySesion() && ultimo !== null) {
      ultimo = null
      avisar()
    }
    escuchar()
  }

  return {
    ultimo: () => ultimo,
    activo: () => dejarDoc !== null,
    apuntar(f) {
      oyentes.add(f)
      if (oyentes.size === 1) dejarSesion = suscribirSesion(alCambiarSesion)
      escuchar()
      return () => {
        oyentes.delete(f)
        if (!oyentes.size) {
          parar()
          if (dejarSesion) dejarSesion()
          dejarSesion = null
        }
      }
    },
    alCambiarVisibilidad() {
      if (visible()) escuchar()
      else parar()
    },
  }
}
