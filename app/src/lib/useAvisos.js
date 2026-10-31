// GUARDAR Y LEER LOS AVISOS Y LA LISTA DE SEGUIMIENTO DE CADA PERSONA
//
// Viven en la ficha de Firestore de esa persona (`users/{uid}`), al lado de su
// nombre y su estado. No en el navegador, y el motivo no es comodidad:
//
//   · **el programa que manda los avisos al celular corre en un servidor**, no
//     en el teléfono de nadie, así que tiene que poder leer lo que la persona
//     programó. Lo guardado en el navegador no lo ve;
//   · y así los avisos siguen a la persona entre el teléfono y el computador,
//     que es lo que cualquiera espera.
//
// ⚠️ LAS REGLAS DE SEGURIDAD HUBO QUE AMPLIARLAS para esto, y van en el mismo
// cambio: hasta hoy una persona solo podía escribir `nombre` en su propia
// ficha. Esa lista blanca se apretó el 2026-09-15 porque antes cualquiera
// podía regalarse una fecha de vencimiento desde la consola del navegador, así
// que **se añaden solo los dos campos nuevos y nada más**, con un tope de
// tamaño. Ver `firestore.rules`.

import { doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { APP } from './identidad'
import { MAX_AVISOS, cabeOtro, valida } from './alertas'

// Cuántos pares puede seguir una persona. No es un límite de gusto: la lista
// entra en la ficha y la comprueba también la regla de Firestore, así que
// tiene que haber un número y tiene que ser el mismo en los dos sitios.
// 40 son más del doble de los pares que tiene cualquiera de las dos apps.
export const MAX_SEGUIMIENTO = 40

// Un identificador para cada aviso. No hace falta que sea único en el mundo:
// solo dentro de la ficha de una persona, que tiene 20 como mucho.
const nuevoId = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/**
 * Los avisos y el seguimiento de la persona, más las operaciones para
 * cambiarlos.
 *
 * ⚠️ NO abre su propia escucha de Firestore: lee del `perfil` que
 * `useAuthUser` ya mantiene vivo. Abrir una segunda escucha del MISMO
 * documento costaría otra conexión para enterarse de lo mismo, y —peor— las
 * dos podrían ir un instante desfasadas y la pantalla parpadearía entre dos
 * versiones.
 *
 * @param uid     quién es
 * @param perfil  su ficha, tal como la trae `useAuthUser`
 */
export function useAvisos(uid, perfil) {
  // ⚠️ Lo que llega de Firestore puede ser cualquier cosa: un campo que no
  // existe todavía, o basura si alguien escribió a mano. Se normaliza aquí y
  // no en la pantalla, para que la pantalla no tenga que defenderse.
  const avisos = Array.isArray(perfil?.avisos) ? perfil.avisos.filter((a) => a && typeof a === 'object') : []
  const seguimiento = Array.isArray(perfil?.seguimiento) ? perfil.seguimiento.filter((p) => typeof p === 'string') : []

  const puedoEscribir = Boolean(db && uid)
  const guardar = async (campos) => {
    if (!puedoEscribir) return { ok: false, codigo: 'sinSesion' }
    try {
      await updateDoc(doc(db, 'users', uid), campos)
      return { ok: true }
    } catch (e) {
      // ⚠️ Se devuelve un CÓDIGO y el error crudo aparte, nunca una frase: esto
      // lo pinta una pantalla que está en 13 idiomas. Y el caso que de verdad
      // va a pasar es `permission-denied`, cuando las reglas nuevas todavía no
      // se han publicado — merece su propio mensaje, porque «no se pudo
      // guardar» mandaría a buscar el problema donde no está.
      return { ok: false, codigo: e?.code === 'permission-denied' ? 'sinPermiso' : 'noSeGuardo', error: e }
    }
  }

  return {
    avisos,
    seguimiento,
    puedoEscribir,

    /** Añade un aviso. Devuelve el mismo `{ok, codigo}` que `valida`. */
    async anadir(aviso, paresValidos) {
      const v = valida(aviso, { paresValidos })
      if (!v.ok) return v
      if (!cabeOtro(avisos)) return { ok: false, codigo: 'demasiados' }
      const limpio = {
        id: nuevoId(),
        par: aviso.par,
        tipo: aviso.tipo,
        lado: aviso.lado,
        nivel: Number(aviso.nivel),
        activa: true,
        creadoEl: new Date().toISOString(),
        // ⚠️⚠️ DE QUÉ APP SALIÓ, Y SIN ESTO UN AVISO DE RSI NO SE PUEDE JUZGAR.
        //
        // «RSI 30» no significa lo mismo en las dos apps: aquí es el RSI de
        // velas DIARIAS y en la hermana el de velas de UNA HORA. El programa
        // que manda los avisos corre en un solo sitio y lee los dos barridos,
        // así que necesita saber cuál de los dos le toca a cada aviso.
        //
        // Sin este campo tendría que adivinar qué pidió la persona, y adivinar
        // hacia el lado que SUENA es el aviso falso que `alertas.js` evita por
        // todos los demás caminos. Por eso los de indicador sin `app` no
        // disparan — ver `appDe` en `scripts/lib/avisos-usuario.mjs`.
        //
        // Los de PRECIO no lo necesitan (el bid y el ask salen del puente de
        // MT5, que es uno para las dos), pero se guarda igual en todos: un
        // campo que está siempre no deja un caso raro por el que colarse.
        app: APP,
      }
      // ⚠️ Se escribe CAMPO POR CAMPO y no `...aviso`, a propósito. Con el
      // objeto entero, cualquier cosa que la pantalla llevara pegada —un
      // estado de React, un campo de más— acabaría guardada en la ficha de
      // la persona para siempre. Lo que se guarda es lo que está escrito aquí.
      return guardar({ avisos: [...avisos, limpio] })
    },

    /** Lo borra. */
    async borrar(id) {
      return guardar({ avisos: avisos.filter((a) => a.id !== id) })
    },

    /** Lo enciende o lo apaga sin borrarlo. */
    async encender(id, activa) {
      return guardar({ avisos: avisos.map((a) => (a.id === id ? { ...a, activa: Boolean(activa) } : a)) })
    },

    /**
     * Lo vuelve a armar después de que haya sonado.
     *
     * ⚠️ Borra los tres campos del disparo a la vez. Dejar `veces` o
     * `sonadaEl` de un disparo anterior haría que el aviso naciera creyendo
     * que ya había sonado dos veces, y entonces no volvería a recordar nunca.
     */
    async rearmar(id) {
      return guardar({
        avisos: avisos.map((a) =>
          a.id === id ? { ...a, activa: true, disparadaEl: null, sonadaEl: null, veces: 0, vistoEl: null } : a
        ),
      })
    },

    /** Cambia la lista de pares seguidos. Vacía = todos. */
    async seguir(pares) {
      const lista = [...new Set((Array.isArray(pares) ? pares : []).filter((p) => typeof p === 'string'))]
      if (lista.length > MAX_SEGUIMIENTO) return { ok: false, codigo: 'demasiadosPares' }
      return guardar({ seguimiento: lista })
    },

    /**
     * Marca como vistos los avisos que ya sonaron. **Esto es lo que para los
     * recordatorios**, y es la condición que puso Néstor: «si el suscriptor no
     * ha abierto la app para mirarla sonará otra vez».
     *
     * ⚠️ Solo toca los que YA SONARON y NO estaban vistos. Si escribiera
     * siempre, abrir la pantalla costaría una escritura a Firestore cada vez
     * aunque no hubiera nada que marcar.
     */
    async marcarVistos() {
      const hayQue = avisos.some((a) => a.disparadaEl && !a.vistoEl)
      if (!hayQue) return { ok: true, codigo: 'nadaQueMarcar' }
      const ahora = new Date().toISOString()
      return guardar({
        avisos: avisos.map((a) => (a.disparadaEl && !a.vistoEl ? { ...a, vistoEl: ahora } : a)),
      })
    },

    maxAvisos: MAX_AVISOS,
  }
}
