import { useT } from '../lib/i18n'
import TarjetaPlegable from './TarjetaPlegable'
import { PAIR_NAMES, monedasDe } from '../lib/pairs'
import { diasDelDatoMasViejo, diasVigente, difsPorPar, tasasOrdenadas } from '../lib/tasas'
import { useTasas } from '../lib/useTasas'

// LO QUE CUESTA MANTENER LA OPERACIÓN ABIERTA (o lo que se cobra por ella).
//
// La tarjeta de arriba, «Lo que cuesta abrir la operación», enseña el spread:
// lo que se paga UNA VEZ, al entrar. Ésta enseña de dónde sale lo que se paga
// (o se cobra) CADA NOCHE que la operación siga abierta. Van juntas a
// propósito: son las dos mitades del peaje.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ LA DECISIÓN QUE NO HAY QUE ABLANDAR NUNCA
// ─────────────────────────────────────────────────────────────────────────
// **ESTO NO ES EL SWAP, Y LA PANTALLA LO DICE ANTES DE ENSEÑAR NINGÚN NÚMERO.**
//
// El banco central pone la tasa de referencia; el bróker le suma un margen que
// NO PUBLICA NADIE y que además es asimétrico. Así que esto da el signo y el
// orden de magnitud, no la cifra que aparecerá en la cuenta.
//
// El aviso va ARRIBA, antes de la tabla, por la misma razón por la que en la
// columna de actividad el «no dice hacia dónde» va antes que lo del volumen:
// **lo primero que se lee es lo que se recuerda**, así que lo primero que se
// dice tiene que ser lo que más caro sale ignorar. Aquí lo caro es creer que
// la diferencia de tasas es lo que el bróker va a cobrar.
//
// ⚠️ Y NADA SE PINTA DE VERDE NI DE ROJO. Que la diferencia favorezca a la
// compra no es «bueno»: depende de hacia dónde vaya a operar quien mira. El
// color afirmaría algo que el dato no dice. Es la misma decisión que en
// `Correlacion.jsx` y la regla general de este proyecto — antes de pintar algo
// de color, preguntarse qué afirma ese color.
//
// ─────────────────────────────────────────────────────────────────────────
// LA TENDENCIA (añadida el 2026-09-29)
// ─────────────────────────────────────────────────────────────────────────
// Néstor lo pidió al ver la tabla de «dónde las apps son ciegas»: la pantalla
// decía «USD 3,875 %» y no decía que venía de 3,625 %. La mitad de lo que dice
// un análisis del mercado es una DIRECCIÓN —«la Fed subiendo», «el Banco de
// Canadá en pausa»—, no un nivel.
//
// ⚠️ LA FLECHA NO SE PINTA DE VERDE NI DE ROJO, igual que el resto de la
// tarjeta. Que una tasa suba no es bueno ni malo: depende de qué divisa se
// compre y cuál se venda. El color afirmaría algo que el dato no dice.
//
// ⚠️ Y SE DICE «VIGENTE DESDE», NUNCA «LO DECIDIERON ESE DÍA». El BIS publica
// filas sin dato (283 de 1000 en Nueva Zelanda), así que un cambio ocurrido
// durante un hueco aparece fechado el primer día publicado después. Lo que la
// serie permite afirmar es desde cuándo la VE en ese nivel, y ni un día más.
//
// ⚠️ UNA DIVISA SIN TENDENCIA NO ENSEÑA NADA, no enseña «en pausa». Suiza lleva
// en 0 % toda la ventana; decir «sin cambios» se leería como una afirmación
// sobre lo que hace su banco central, y lo único que sabemos es que no se movió
// dentro de lo que la app miró. Misma decisión que `pearson` devolviendo `null`.
//
// Va plegada por defecto, como el glosario y la correlación: es contexto, no
// lo primero que se viene a mirar.

const P = { margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }
const PIE = { margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }

// Con signo explícito y una cifra decimal. `−` es el signo menos de verdad
// (U+2212), no un guion: en la tipografía de la app tiene el mismo ancho que
// el `+` y la columna no baila.
const conSigno = (n) => (n > 0 ? '+' : '−') + Math.abs(n).toFixed(2)

// ⚠️ «HACE 466 DÍAS» NO SE LEE, y esto salió MIRANDO la captura, no compilando.
// Las ocho filas reales daban 12, 13, 26, 104, 146, 285, 334 y 466 días: cinco
// de las ocho obligaban a dividir mentalmente por 30 para entender si eso era
// reciente o viejo.
//
// ⚠️ A propósito NO se usa `Intl.RelativeTimeFormat`, que lo haría solo en los
// 13 idiomas. En árabe ese formateador saca cifras árabo-índicas, y esta misma
// frase lleva al lado el valor de la tasa en cifras latinas (viene de
// `toFixed`, igual que la columna de arriba). Serían DOS SISTEMAS DE DÍGITOS EN
// LA MISMA FRASE — exactamente el fallo que ya mordió en el COT el 2026-09-14.
// Con una clave por unidad, cada idioma resuelve su plural y los dígitos no se
// mezclan.
//
// Los cortes: hasta dos meses en días, hasta dos años en meses, después en
// años. Redondeado, porque «hace 15 meses» y «hace 15,3 meses» dicen lo mismo y
// el segundo finge una precisión que la serie no tiene (el BIS publica con
// huecos, así que la fecha del cambio puede estar corrida algún día).
function haceCuanto(dias, t) {
  if (dias < 60) return t('tasas.haceDias', { n: dias })
  if (dias < 730) return t('tasas.haceMeses', { n: Math.round(dias / 30.44) })
  return t('tasas.haceAnios', { n: Math.round(dias / 365.25) })
}

export default function Tasas() {
  const t = useT()
  const datos = useTasas()

  // Sin datos no se pinta NADA — ni título ni «no hay nada». Mismo criterio
  // que la correlación y el calendario: una tarjeta vacía hace pensar que la
  // app está rota.
  const tasas = datos?.tasas
  if (!tasas || !Object.keys(tasas).length) return null

  const filas = difsPorPar(tasas, PAIR_NAMES, monedasDe)
  const sueltas = tasasOrdenadas(tasas)
  const dias = diasDelDatoMasViejo(tasas)

  // ⚠️ Un archivo publicado ANTES del 2026-09-29 no trae `tendencias`. Se
  // aguanta sin reventar y sin dejar una tarjeta a medias: se enseñan los
  // niveles como siempre y la línea de tendencia simplemente no sale. Es la
  // misma decisión que con `correl`, y la CONTRARIA que con `setupsCaida` —
  // allí una lista vacía se confundiría con «hoy no hubo señales» y borraría
  // historial; aquí solo se deja de ver un renglón.
  const tendencias = datos?.tendencias ?? {}
  const hayTendencias = Object.keys(tendencias).length > 0

  return (
    <TarjetaPlegable titulo={t('tasas.titulo')} desc={t('tasas.desc')} paraQue={t('tasas.paraQue')}>
          {/* ⚠️ EL AVISO VA PRIMERO. Ver la cabecera del archivo: no es
              maquetación, es la única forma de que se lea. */}
          <div
            style={{
              padding: '10px 12px',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              fontSize: 12.5,
              lineHeight: 1.55,
              color: 'var(--text-secondary)',
            }}
          >
            {t('tasas.aviso')}
          </div>

          <p style={P}>{t('tasas.intro')}</p>

          {/* ── La diferencia por par ───────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filas.map(({ par, dif, lado }) => (
              <div
                key={par}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  paddingBottom: 8,
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  {/* `dir="ltr"` fijo: es un código, y en árabe se dibujaría
                      al revés. Es el error que ya mordió cuatro veces aquí. */}
                  <div className="mono" dir="ltr" style={{ fontSize: 12.5, fontWeight: 700 }}>
                    {par}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {t(`tasas.lado.${lado}`)}
                  </div>
                </div>
                <div
                  className="mono"
                  dir="ltr"
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                    // Neutro a propósito. Ver la cabecera del archivo.
                    color: 'var(--text-secondary)',
                  }}
                >
                  {conSigno(dif)}
                </div>
              </div>
            ))}
          </div>

          {/* ── Las ocho tasas sueltas ──────────────────────────────── */}
          <div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                marginBottom: 8,
              }}
            >
              {t('tasas.cabeceraSueltas')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sueltas.map(({ divisa, v, f }) => (
                <Suelta key={divisa} divisa={divisa} v={v} f={f} cambio={tendencias[divisa]} t={t} />
              ))}
            </div>
          </div>

          <p style={PIE}>{t('tasas.pie', { dias: dias ?? 0 })}</p>
          {/* Solo se explica la flecha si hay alguna flecha que explicar. */}
          {hayTendencias && <p style={PIE}>{t('tasas.pieTendencia')}</p>}
    </TarjetaPlegable>
  )
}

function Suelta({ divisa, v, f, cambio, t }) {
  const dias = diasVigente(cambio)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, fontSize: 12.5 }}>
        {/* El código de divisa SÍ va en `ltr` fijo: es un código, no idioma. */}
        <span className="mono" dir="ltr" style={{ fontWeight: 700, minWidth: 30 }}>
          {divisa}
        </span>
        <span
          className="mono"
          dir="ltr"
          style={{ fontVariantNumeric: 'tabular-nums', minWidth: 62, textAlign: 'right' }}
        >
          {v.toFixed(3)} %
        </span>
        {/* ⚠️ LA FECHA DEL DATO, no la de la consulta. El BIS publica con unos
            días de retraso, así que aquí es normal ver una fecha de la semana
            pasada — pero sin enseñarla, ese dato se leería como de hoy.
            (Hasta el 2026-09-29 el motivo escrito aquí era otro: «solo cambia
            el día que se reúne el banco central». La serie del BIS demostró que
            no es eso — el retraso es de publicación—, y el texto de los 13
            idiomas se corrigió con ella.) */}
        <span
          className="mono"
          dir="ltr"
          style={{ color: 'var(--text-muted)', fontSize: 11.5, marginInlineStart: 'auto' }}
        >
          {f}
        </span>
      </div>

      {/* ⚠️ La tendencia, en su propio renglón y solo si existe. Ver la
          cabecera del archivo: sin flecha NO se escribe «sin cambios». */}
      {cambio && dias != null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            marginTop: 2,
            marginInlineStart: 42,
            fontSize: 11.5,
            // Neutro a propósito: subir no es bueno ni malo. Ver la cabecera.
            color: 'var(--text-muted)',
          }}
        >
          {/* La flecha en `ltr` fijo. Aunque ↑ y ↓ no se reflejan, va dentro de
              un renglón que en árabe es `rtl` y así queda pegada al texto que
              le corresponde. */}
          <span className="mono" dir="ltr" style={{ flexShrink: 0 }}>
            {cambio.sentido === 'subio' ? '↑' : '↓'}
          </span>
          {/* ⚠️ `<bdi>` y NO `dir="ltr"` en el renglón entero. Es la lección del
              calendario: forzar `ltr` a una frase que MEZCLA palabra traducida
              con número despegaba el `%` del número y partía «24.5K» en dos.
              Se aísla solo el número y la frase sigue al idioma. */}
          <bdi>
            {t(cambio.sentido === 'subio' ? 'tasas.subio' : 'tasas.bajo', {
              de: cambio.de,
              cuando: haceCuanto(dias, t),
            })}
          </bdi>
        </div>
      )}
    </div>
  )
}
