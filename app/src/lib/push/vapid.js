// La mitad pública del par de claves VAPID.
//
// Vive sola en este archivo, sin importar nada, para que la usen los dos
// lados sin duplicarla: la app (`lib/push/index.js`, en el navegador) y el
// vigía (`scripts/lib/push-envio.mjs`, en Node). Si estuviera escrita en cada
// uno, tarde o temprano se cambiaría en uno y no en el otro, y los avisos
// dejarían de entregarse sin que nada avise.
//
// Es pública por diseño: el navegador la necesita para comprobar que el aviso
// viene de nosotros. Va en el código y no en un .env porque no cambia entre
// entornos — en un .env, un build sin ese archivo compilaría igual y los
// avisos fallarían en silencio.
//
// La mitad PRIVADA es el secreto `VAPID_PRIVATE_KEY` del repositorio y jamás
// debe aparecer aquí.
//
// ⚠️ Si se regenera el par, TODAS las suscripciones guardadas dejan de servir:
// hay que vaciar la colección `pushSubs` y cada aparato tiene que volver a
// activar los avisos.
export const VAPID_PUBLICA =
  'BMO5gjLRHw8CEc_tb9QUBows358lURnHLhwyixDTxkGOVUw1I3C1wLP21buXCf2Imqp7RavVVF9UrOo0AhOBReM'
