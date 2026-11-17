// Comprueba la escucha compartida del precio al segundo (`src/lib/escuchaVivo.js`)
// sin navegador ni Firebase: se le dan piezas de mentira.
//
// La comprobación que importa es la 1: el fallo del 2026-11-17 fue que la app
// empezaba a escuchar SIN SESIÓN, Firestore decía «sin permiso» y al entrar
// nadie volvía a encender la escucha. El puente escribía cada segundo y la app
// enseñaba la foto de cada 5 minutos, sin un solo error.
//
// GEMELO.

import { crearEscuchaVivo } from '../src/lib/escuchaVivo.js'

let fallos = 0
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗ MAL'}  ${msg}`)
  if (!cond) fallos++
}

// Un Firebase de mentira: Firestore dice «sin permiso» si no hay sesión, igual
// que las reglas de `vivo/precios`.
function montaje() {
  const m = { sesion: false, visible: true, abiertas: 0, intentos: 0, alSesion: null, escuchas: [] }
  m.e = crearEscuchaVivo({
    suscribirDoc: (alDato, alError) => {
      m.intentos++
      const esc = { alDato, alError, viva: true }
      m.escuchas.push(esc)
      if (!m.sesion) {
        esc.viva = false
        alError({ code: 'permission-denied' }) // síncrono, el peor caso
        return () => {}
      }
      m.abiertas++
      return () => {
        if (esc.viva) m.abiertas--
        esc.viva = false
      }
    },
    suscribirSesion: (f) => {
      m.alSesion = f
      return () => {
        m.alSesion = null
      }
    },
    haySesion: () => m.sesion,
    visible: () => m.visible,
  })
  m.entrar = () => {
    m.sesion = true
    m.alSesion?.()
  }
  m.salir = () => {
    m.sesion = false
    m.alSesion?.()
  }
  m.llega = (dato) => {
    for (const s of m.escuchas) if (s.viva) s.alDato(dato)
  }
  return m
}

// 1 ── EL FALLO: la app se abre sin sesión y la persona entra después ─────
{
  const m = montaje()
  let avisos = 0
  m.e.apuntar(() => avisos++)
  ok(m.intentos === 0, 'sin sesión NO se intenta escuchar (solo serviría para que Firestore diga que no)')
  ok(!m.e.activo(), 'sin sesión no hay escucha activa')
  m.entrar()
  ok(m.abiertas === 1 && m.e.activo(), 'al entrar, la escucha se enciende SOLA')
  m.llega({ actualizadoEl: 'x', pares: {} })
  ok(avisos === 1 && m.e.ultimo()?.actualizadoEl === 'x', 'y el precio llega a la pantalla')
}

// 2 ── Un «sin permiso» no deja una escucha muerta apuntada como viva ─────
for (const sincrono of [false, true]) {
  let errorDe = null
  const e = crearEscuchaVivo({
    suscribirDoc: (alDato, alError) => {
      errorDe = alError
      if (sincrono) alError({ code: 'permission-denied' }) // antes de devolver
      return () => {}
    },
    suscribirSesion: () => () => {},
    haySesion: () => true,
    visible: () => true,
  })
  e.apuntar(() => {})
  if (!sincrono) {
    ok(e.activo(), 'con sesión se escucha')
    errorDe({ code: 'permission-denied' })
  }
  ok(!e.activo(), `tras un error ${sincrono ? 'síncrono' : 'asíncrono'} la escucha deja de contar como activa`)
}

// 3 ── Tras un error, al cambiar la sesión se vuelve a intentar ──────────
{
  let alErr = null
  let sesionCb = null
  let intentos = 0
  const e = crearEscuchaVivo({
    suscribirDoc: (alDato, alError) => {
      intentos++
      alErr = alError
      return () => {}
    },
    suscribirSesion: (f) => {
      sesionCb = f
      return () => {}
    },
    haySesion: () => true,
    visible: () => true,
  })
  e.apuntar(() => {})
  alErr({ code: 'permission-denied' })
  ok(!e.activo() && intentos === 1, 'un «sin permiso» para la escucha')
  sesionCb()
  ok(e.activo() && intentos === 2, 'y al cambiar la sesión se vuelve a encender')
}

// 4 ── Una sola escucha aunque la pidan tres pantallas ───────────────────
{
  const m = montaje()
  m.sesion = true
  const d1 = m.e.apuntar(() => {})
  const d2 = m.e.apuntar(() => {})
  const d3 = m.e.apuntar(() => {})
  ok(m.abiertas === 1, 'tres pantallas, UNA escucha (cada cambio es una lectura pagada)')
  d1()
  d2()
  ok(m.abiertas === 1, 'mientras quede una pantalla, se sigue escuchando')
  d3()
  ok(m.abiertas === 0 && m.alSesion === null, 'sin pantallas se deja de escuchar el precio y la sesión')
}

// 5 ── Con la app en segundo plano no se escucha ────────────────────────
{
  const m = montaje()
  m.sesion = true
  m.e.apuntar(() => {})
  m.visible = false
  m.e.alCambiarVisibilidad()
  ok(m.abiertas === 0, 'app escondida: se para')
  m.visible = true
  m.e.alCambiarVisibilidad()
  ok(m.abiertas === 1, 'al volver: se escucha otra vez')
}

// 6 ── Al salir se para y se olvida el último precio ────────────────────
{
  const m = montaje()
  let avisos = 0
  m.e.apuntar(() => avisos++)
  m.entrar()
  m.llega({ actualizadoEl: 'y' })
  m.salir()
  ok(m.abiertas === 0, 'al salir de la cuenta se deja de escuchar')
  ok(m.e.ultimo() === null && avisos === 2, 'y el último precio se olvida (y se avisa a la pantalla)')
}

// 7 ── Un dato tardío de una escucha vieja no pisa nada ─────────────────
{
  const llamadas = []
  const e = crearEscuchaVivo({
    suscribirDoc: (alDato, alError) => {
      llamadas.push({ alDato, alError })
      return () => {}
    },
    suscribirSesion: () => () => {},
    haySesion: () => true,
    visible: () => true,
  })
  e.apuntar(() => {})
  llamadas[0].alError({})
  e.alCambiarVisibilidad() // se vuelve a abrir
  llamadas[0].alDato({ actualizadoEl: 'vieja' })
  ok(e.ultimo() === null, 'un dato que llega de una escucha ya muerta se ignora')
  llamadas[0].alError({})
  ok(e.activo(), 'y un error tardío de la vieja no apaga la nueva')
}

// 8 ── El hook usa esta escucha y le da la sesión de Firebase ───────────
{
  const fs = await import('node:fs')
  const hook = fs.readFileSync(new URL('../src/lib/usePrecioMt5.js', import.meta.url), 'utf8')
  ok(/crearEscuchaVivo\(/.test(hook), 'usePrecioMt5 usa crearEscuchaVivo (no una escucha propia)')
  ok(/onAuthStateChanged/.test(hook), 'y le pasa los cambios de sesión de Firebase')
  ok(/currentUser/.test(hook), 'y sabe si hay sesión antes de escuchar')
  ok(!/let dejarDeEscuchar/.test(hook), 'la escucha vieja (sin sesión) ya no existe')
}

console.log(fallos ? `\n${fallos} comprobación(es) MAL` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
