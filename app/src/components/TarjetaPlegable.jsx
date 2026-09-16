import { useId, useState } from 'react'
import { useT } from '../lib/i18n'

// LA TARJETA QUE SE ABRE, Y LA MISMA PARA TODAS.
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE
// ─────────────────────────────────────────────────────────────────────────
// Néstor lo dijo así (2026-09-15): «quiero que todas las pestañas o botones
// que tenemos en las app se distingan y te llamen o atraigan a oprimirlos,
// que se vean a simple vista que hay que tocarlos para ver una información».
//
// Tenía razón y el motivo era medible: había OCHO tarjetas plegables y cada
// una se dibujaba su propia cabecera copiada, todas terminadas en **una
// flechita gris de 12 px en `--text-muted`**. Un triángulo del color del
// texto apagado, en la esquina, no dice «tócame»: dice «adorno». Un operador
// externo que revisó la app con lupa **ni supo que la de mediciones se podía
// abrir** y pidió que «ojalá tuviera profundidad» — cuando ya la tenía.
//
// ⚠️ EL ARREGLO NO ES «HACER LA FLECHA MÁS GRANDE». Es que haya una PALABRA:
// «Ver» / «Cerrar» dentro de una pastilla con borde. Un glifo hay que
// interpretarlo; una palabra dentro de un recuadro es un botón en cualquier
// idioma y a cualquier edad. La flecha se queda al lado porque confirma la
// dirección, pero ya no carga sola con el mensaje.
//
// ─────────────────────────────────────────────────────────────────────────
// LOS TRES RENGLONES, Y POR QUÉ SON TRES
// ─────────────────────────────────────────────────────────────────────────
// También pidió que cada herramienta lleve «los nombres tal cual como se
// conocen en el trading, con abreviatura y nombre completo, pero también con
// lo que las describen». Eso son tres cosas distintas y por eso son tres:
//
//   COT · Commitments of Traders          ← sigla (la que se ve por ahí) + nombre
//   Qué tienen comprado o vendido …       ← qué es, en una línea
//   [ Ver ▾ ]                             ← que se puede abrir
//
// La sigla va en `mono` y en `ltr` fijo: es jerga invariante, como RSI o ATR,
// y en árabe se dibujaría al revés. Es el error que ya mordió seis veces aquí.
//
// ⚠️ LA DESCRIPCIÓN SE VE CON LA TARJETA CERRADA, y eso es lo que de verdad
// cambia. Antes, para saber qué era el COT había que abrirlo; quien no supiera
// qué son esas tres letras no tenía motivo para tocarlas. Ahora el motivo está
// fuera.
// ─────────────────────────────────────────────────────────────────────────
// Y LO DE DENTRO: PARA QUÉ SIRVE (2026-09-16)
// ─────────────────────────────────────────────────────────────────────────
// Néstor volvió a pedirlo, y lo que faltaba era la cuarta cosa: «adentro para
// qué sirve o para qué lo utilizan los traders, en una explicación abreviada
// pero con un mensaje claro preciso y conciso».
//
// La descripción de fuera dice QUÉ ES («Lo que tienen comprado los grandes»).
// Eso no es lo mismo que PARA QUÉ SE USA, y sin la segunda la herramienta se
// entiende y no se sabe qué hacer con ella.
//
// ⚠️ SE ESCRIBEN SIN DIRECCIÓN, TODAS. La tentación al redactar un «para qué
// sirve» es acabar la frase con un consejo («…así sabes cuándo comprar»), y
// eso convertiría en filtro lo que es información — que es justo la línea que
// este proyecto no cruza sin pasar por el banco de pruebas. Varias llevan por
// eso una frase de lo que NO dicen.
//
// ⚠️ Y VA ANTES DEL AVISO ROJO de cada tarjeta, no después, sin romper la
// regla de «el aviso va antes de NINGÚN NÚMERO»: esto no es un número. El
// orden queda: para qué sirve → aviso → datos.
export default function TarjetaPlegable({
  sigla,
  titulo,
  desc,
  // Lo primero que se lee al abrir: para qué se usa esto de verdad.
  paraQue = null,
  // Se pinta SOLO con la tarjeta cerrada: es el adelanto que convence de
  // abrirla (el número de las mediciones, por ejemplo). Opcional a propósito
  // — la mayoría de las tarjetas no tienen nada que adelantar, y rellenarlo
  // por rellenar convertiría el adelanto en ruido y dejaría de leerse.
  avance = null,
  abiertaAlPrincipio = false,
  children,
}) {
  const t = useT()
  const [abierto, setAbierto] = useState(abiertaAlPrincipio)
  const id = useId()

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls={id}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 14px',
          background: 'none',
          border: 'none',
          color: 'var(--text)',
          cursor: 'pointer',
          minHeight: 'var(--tap-min)',
          textAlign: 'start',
        }}
      >
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            {sigla && (
              // `ltr` fijo: COT, RSI, ATR… son jerga invariante, no idioma.
              <span
                className="mono"
                dir="ltr"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '.06em',
                  padding: '1px 5px',
                  borderRadius: 3,
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {sigla}
              </span>
            )}
            <span>{titulo}</span>
          </span>
          {desc && (
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45, fontWeight: 400 }}>
              {desc}
            </span>
          )}
        </span>

        {/* ⚠️ LA PASTILLA CON PALABRA, que es el cambio de verdad. No se
            reduce a la flecha ni cuando hay poco sitio: `flexShrink: 0`.

            ⚠️ VA EN EL VERDE DE LA APP, no en gris (2026-09-16). La primera
            versión la pintaba en `--text-secondary` sobre `--bg-input`, o sea
            gris sobre gris: seguía siendo del color de lo que no se toca, que
            es exactamente de lo que Néstor se quejaba. El verde es el acento
            de la marca (el ícono, la pantalla de carga), y aquí NO afirma nada
            sobre ningún dato — es un control, no un valor. Es la diferencia
            con la regla de «antes de pintar algo de color, preguntarse qué
            afirma ese color»: un botón solo afirma que es un botón. */}
        <span
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 11px',
            borderRadius: 999,
            border: '1px solid var(--green)',
            background: 'color-mix(in oklab, var(--green) 14%, transparent)',
            color: 'var(--green-strong)',
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {abierto ? t('plegable.cerrar') : t('plegable.ver')}
          <span aria-hidden="true" style={{ fontSize: 9 }}>
            {abierto ? '▲' : '▼'}
          </span>
        </span>
      </button>

      {/* El adelanto vive FUERA del botón: puede llevar números con su propia
          dirección, y meterlo dentro de un `button` obligaría a repetir aquí
          las reglas de `ltr` de cada cosa que alguien decida adelantar. */}
      {!abierto && avance && (
        <div style={{ padding: '0 14px 12px', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          {avance}
        </div>
      )}

      {abierto && (
        <div id={id} style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {paraQue && (
            // Bloque propio y no un párrafo más: lo que sigue dentro de cada
            // tarjeta son avisos y tablas, y un renglón suelto arriba se
            // leería como parte del aviso. La raya del costado lo separa sin
            // gritar. Va en `--text-secondary`, no en el verde de la pastilla:
            // esto se lee, no se toca.
            <div
              style={{
                borderInlineStart: '2px solid var(--border-strong)',
                paddingInlineStart: 10,
                fontSize: 12.5,
                color: 'var(--text-secondary)',
                lineHeight: 1.55,
              }}
            >
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase' }}>
                {t('plegable.paraQue')}
              </div>
              {paraQue}
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  )
}
