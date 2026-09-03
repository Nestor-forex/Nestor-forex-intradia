import { Component } from 'react'
import { crearT } from '../lib/i18n/crearT.js'
import { IDIOMA_BASE } from '../lib/i18n/idiomas.js'
import { clave } from '../lib/identidad'

// LA RED QUE EVITA LA PANTALLA EN BLANCO.
//
// Si un componente falla al dibujarse —un dato con una forma inesperada, una
// respuesta a medias, un número donde se esperaba texto— React desmonta la app
// entera y el usuario se queda mirando una pantalla blanca, sin mensaje y sin
// nada que hacer. En una app de pago eso es una cancelación: el cliente no
// sabe si se rompió, si perdió su cuenta, o si le van a seguir cobrando.
//
// Esto lo sustituye por una pantalla que dice qué pasó y ofrece recargar.
//
// POR QUÉ ES UNA CLASE Y NO UNA FUNCIÓN
// -------------------------------------
// No es estilo antiguo: React solo permite capturar errores de dibujado con
// `componentDidCatch`/`getDerivedStateFromError`, y esos únicamente existen en
// componentes de clase. No hay equivalente con hooks.
//
// ⚠️ ESTE COMPONENTE NO PUEDE DEPENDER DE NADA QUE PUEDA ESTAR ROTO
// ------------------------------------------------------------------
// Es lo último que queda en pie. Si él mismo fallara, volveríamos a la pantalla
// blanca y encima habríamos añadido código para nada. Por eso:
//
//   · NO usa el contexto de idioma (`useT`). Se salta React y lee el idioma
//     guardado directamente del navegador, porque el contexto es una de las
//     cosas que podrían haber fallado.
//   · TODO lo que hace para traducir va dentro de un try/catch, con un texto
//     de respaldo en español escrito aquí mismo. Si la traducción falla, se ve
//     en español; nunca en blanco.
//   · No pide datos, no toca Firebase y no depende de ninguna pantalla.
//
// QUÉ NO HACE
// -----------
// No intenta recuperarse solo ni reintentar en bucle. Si el error viene de un
// dato guardado, reintentar solo volvería a fallar; que sea la persona quien
// decida recargar es más honesto y evita un ciclo infinito.

// La clave con la que la app guarda el idioma elegido. Está repetida aquí a
// propósito, en vez de importarla: si el módulo de idioma fuera el que falla,
// importar de él traería el problema a la única pantalla que debe sobrevivir.
const CLAVE_IDIOMA = clave('idioma')

// Respaldo del respaldo. Si hasta la traducción falla, se ve esto.
const RESPALDO = {
  titulo: 'La app tuvo un problema',
  cuerpo:
    'Algo falló al mostrar esta pantalla. Tus datos y tus operaciones están a salvo: esto es un problema de visualización, no de tu cuenta.',
  boton: 'Recargar la app',
  detalle: 'Detalle técnico',
}

function textos() {
  try {
    let idioma = IDIOMA_BASE
    try {
      idioma = localStorage.getItem(CLAVE_IDIOMA) || IDIOMA_BASE
    } catch {
      // localStorage bloqueado (modo privado): se queda con el idioma base.
    }
    const t = crearT(idioma)
    const leer = (clave, respaldo) => {
      const v = t(`error.${clave}`)
      // `crearT` devuelve la clave misma cuando no la encuentra. Si eso pasa,
      // vale más el español de aquí que enseñarle "error.titulo" a alguien.
      return typeof v === 'string' && v !== `error.${clave}` ? v : respaldo
    }
    return {
      titulo: leer('titulo', RESPALDO.titulo),
      cuerpo: leer('cuerpo', RESPALDO.cuerpo),
      boton: leer('boton', RESPALDO.boton),
      detalle: leer('detalle', RESPALDO.detalle),
    }
  } catch {
    return RESPALDO
  }
}

export default class RedDeSeguridad extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Queda en la consola del navegador para poder diagnosticarlo si Néstor
    // manda una captura. No se envía a ningún sitio: la app no tiene servidor
    // de errores, y mandarlo a un tercero sería sacar datos sin permiso.
    console.error('[Nestor Forex] fallo al dibujar la pantalla:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    const txt = textos()
    // El mensaje técnico, recortado. Sirve para que Néstor lo lea en una
    // captura; no se le pide a nadie que lo entienda.
    const detalle = String(this.state.error?.message || this.state.error || '').slice(0, 300)

    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 16,
          padding: '32px 24px',
          background: 'var(--bg-page, #0d1117)',
          color: 'var(--text, #e6edf3)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: '0.12em', opacity: 0.6, textTransform: 'uppercase' }}>
          TRADING · FX
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.25 }}>{txt.titulo}</h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, opacity: 0.85, maxWidth: '42ch' }}>{txt.cuerpo}</p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 4,
            alignSelf: 'flex-start',
            padding: '12px 20px',
            fontSize: 15,
            fontWeight: 600,
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            // Verde con letra OSCURA, igual que `.btn-primary` en index.css.
            // El verde de la app es claro: con letra blanca encima no se leería.
            // Se pone en línea en vez de usar la clase para no depender de que
            // la hoja de estilos haya cargado bien.
            background: 'var(--green, #4ade80)',
            color: 'oklch(0.15 0.01 255)',
          }}
        >
          {txt.boton}
        </button>

        {detalle ? (
          <details style={{ marginTop: 8, fontSize: 12, opacity: 0.55 }}>
            <summary style={{ cursor: 'pointer' }}>{txt.detalle}</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 8 }}>{detalle}</pre>
          </details>
        ) : null}
      </div>
    )
  }
}
