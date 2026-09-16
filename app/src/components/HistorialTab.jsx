import { useIdioma } from '../lib/i18n'
import { useHistorial } from '../lib/useHistorial'

// La pantalla que responde la única pregunta que importa: ¿esto acierta?
//
// Los datos salen de la rama `datos` del repositorio, donde el vigía va
// anotando cada señal y, cuando el precio llega al objetivo o al stop, cómo
// terminó. Ver `lib/useHistorial.js`.

const COLOR = {
  ganada: 'var(--green)',
  perdida: 'var(--red)',
  abierta: 'var(--text-muted)',
  caducada: 'var(--text-muted)',
}

export default function HistorialTab() {
  const { t, locale } = useIdioma()
  const { cargando, error, filas, resumen } = useHistorial()

  if (cargando) return <Aviso>{t('historial.cargando')}</Aviso>
  if (error) return <Aviso ambar>{t('historial.error')}</Aviso>

  return (
    <>
      <div>
        <h2 className="section-title" style={{ marginBottom: 4 }}>
          {t('historial.titulo')}
        </h2>
        <p style={{ ...TEXTO, margin: 0 }}>{t('historial.intro')}</p>
      </div>

      {!filas.length ? (
        <div className="card">
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
            {t('historial.vacio')}
          </div>
          <p style={{ ...TEXTO, margin: 0 }}>{t('historial.vacioLargo')}</p>
        </div>
      ) : (
        <>
          {/* ⚠️ EL TÍTULO NO ES UN ADORNO (2026-09-16). Sin él, este
              porcentaje se lee como «el total de todo lo que hay abajo», y no
              lo es: cuenta SOLO lo que la app propuso de verdad. Ya pasó en
              Swing — un lector externo y yo mismo leímos mal la misma captura
              justo por esto. */}
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t('historial.appTitulo')}</div>
          <Resumen resumen={resumen} t={t} />

          {/* ⚠️ EL DESGLOSE POR MODO, QUE NO ES UN ADORNO (2026-09-16).
              Néstor lo pidió, y los números reales de producción dicen por qué
              hacía falta: la app tiene DOS comportamientos opuestos escondidos
              dentro del promedio de arriba — tendencia 6 de 27 con −629 pips,
              rango 10 de 24 con +43. Ese promedio no describe a ninguno.

              ⚠️ Estos dos SÍ suman al número de arriba (son las dos mitades de
              lo mismo), al revés que el retroceso. Por eso van pegados y en
              filas compactas, y la sombra va separada con su raya: la forma
              tiene que decir cuál suma y cuál no. */}
          <Desglose
            filas={[
              ['historial.modoTendencia', resumen.tendencia],
              ['historial.modoRango', resumen.rango],
              // Solo si existe. Es el cajón de un `tipo` que nadie ha visto
              // todavía: mejor que salga raro a que desaparezca en silencio.
              ...(resumen.otros?.total ? [['historial.modoOtros', resumen.otros]] : []),
            ]}
            t={t}
          />

          {/* ⚠️ LO QUE CORRE EN LA SOMBRA, QUE HASTA HOY NO SE VEÍA.
              Néstor: «noté que en Intradía no tengo los experimentos». Tenía
              razón a medias, y la mitad que faltaba es la que importa:

              · La REVERSIÓN y COMPRAR LA CAÍDA no están aquí a propósito —
                están medidas en ESTA app y pierden (la caída, −0,08 plano en
                los tres tamaños). No es un olvido: portarlas sería traer una
                regla que ya se sabe que no funciona con velas de una hora.
              · Pero Intradía SÍ tiene su propio experimento, el RETROCESO, y
                `resumir()` devuelve su cubo desde siempre — **sin que nadie lo
                pintara**. Un experimento acumulando operaciones reales durante
                semanas sin que se pudiera ver ni una. Es exactamente el mismo
                descuido que se arregló en Swing el 2026-09-07 con `filasTodas`.

              ⚠️ Sus números NUNCA se suman a los de arriba. Son reglas
              distintas y un promedio no describiría a ninguna.

              ⚠️ Y solo sale cuando hay algo resuelto que enseñar: un bloque
              permanente en cero se volvería decorado y dejaría de leerse. */}
          {resumen.sombra.total > 0 && (
            <div style={BLOQUE_EXPERIMENTO}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t('historial.sombraTitulo')}</span>
                <Etiqueta>{t('historial.esSombra')}</Etiqueta>
              </div>
              {/* `aproximadas: 0` a propósito: el aviso de los cruces lo pone
                  el bloque de arriba una vez, y repetirlo aquí sería la misma
                  advertencia dos veces en la misma pantalla. */}
              <Resumen resumen={{ todas: resumen.sombra, exactas: resumen.sombra, aproximadas: 0 }} t={t} />
              <p style={{ ...TEXTO, margin: 0 }}>{t('historial.sombraIntro')}</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filas.map((f) => (
              <Fila key={`${f.id}@${f.vistoEl}`} f={f} t={t} locale={locale} />
            ))}
          </div>

          {/* ⚠️⚠️ ESTE PIE NO ES UN ADORNO LEGAL: dice por dónde cojea el
              número que se acaba de leer, y cojea por los DOS lados.

              · OPTIMISTA en los costes. Los pips salen del objetivo y el stop
                que puso la app (`resolver.mjs`: «pips: ganada ? pipBeneficio :
                −pipRiesgo»), sin restar spread ni swap. Y aquí eso pesa MÁS
                que en Swing, con la causa medida el 2026-09-07: el stop típico
                es de ~30 pips contra los ~120 de allá, así que los mismos 2
                pips de spread son el 7 % del riesgo en vez del 1,8 %.
              · PESIMISTA en el orden. Si una misma vela toca el stop y el
                objetivo se cuenta como PERDIDA, porque la vela no guarda cuál
                de los dos pasó primero.

              Portado de Swing el 2026-09-15 con texto propio. Allí es PRIMO, no
              gemelo, justo porque estas dos razones no se escriben igual en las
              dos apps.

              ⚠️ Va DESPUÉS de los números y no antes — al revés que en las
              tasas o el COT. Allí el aviso previene de LEER MAL el dato y lo
              caro es leerlo tarde; esto es la letra pequeña de cómo está
              calculado, y delante de una tabla que todavía no se ha visto no
              orienta a nadie. */}
          <p style={{ ...TEXTO, margin: 0 }}>{t('historial.pie')}</p>
        </>
      )}
    </>
  )
}

function Resumen({ resumen, t }) {
  const { todas, exactas, aproximadas } = resumen

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, textAlign: 'center' }}>
        <Dato
          valor={todas.acierto === null ? '—' : `${todas.acierto}%`}
          etiqueta={t('historial.acierto')}
        />
        <Dato valor={todas.total || '—'} etiqueta={t('historial.operaciones')} />
        <Dato
          valor={todas.total ? `${todas.pips >= 0 ? '+' : ''}${todas.pips}` : '—'}
          etiqueta={t('historial.pips')}
          color={todas.total ? (todas.pips >= 0 ? 'var(--green)' : 'var(--red)') : undefined}
        />
      </div>

      {!todas.total && <p style={{ ...TEXTO, margin: 0 }}>{t('historial.sinJuzgar')}</p>}

      {/* El aviso solo aparece si de verdad hay algún cruce contado: si todas
          las operaciones son de pares contra el dólar, las cuentas son
          exactas y sacar la advertencia solo confundiría. */}
      {aproximadas > 0 && (
        <>
          <p style={{ ...TEXTO, margin: 0, fontSize: 11.5 }}>{t('historial.avisoCruces')}</p>
          {exactas.total > 0 && (
            <div style={{ ...TEXTO, margin: 0, fontWeight: 600 }}>
              {t('historial.soloExactas')}: {exactas.acierto}% ({exactas.ganadas}/{exactas.total})
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Dato({ valor, etiqueta, color }) {
  return (
    <div style={{ flex: 1 }}>
      <div className="mono" dir="ltr" style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text)' }}>
        {valor}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{etiqueta}</div>
    </div>
  )
}

function Fila({ f, t, locale }) {
  const estado = f.resultado
  const fecha = new Date(f.vistoEl).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div className="mono" dir="ltr" style={{ fontSize: 13.5, fontWeight: 700 }}>
          {f.par} {t('lado.' + f.lado)}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLOR[estado] }}>
          {t('historial.' + estado)}
          {typeof f.pips === 'number' && (
            <span className="mono" dir="ltr" style={{ marginInlineStart: 6 }}>
              {f.pips >= 0 ? '+' : ''}
              {f.pips}
            </span>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
        {fecha} · R/B 1:{f.rr}
        {/* Se marca la operación concreta, no solo el resumen: si alguien
            mira una fila suelta también tiene que saber si es aproximada. */}
        {f.exacto === false && ' ·  ~'}
      </div>
    </div>
  )
}

// Las dos mitades de la app, una línea cada una: operaciones, acertadas y
// pips. Compacto a propósito — son partes del número de arriba, no bloques
// independientes, y darles el mismo tamaño que aquél haría pensar que son
// tres reglas distintas.
//
// ⚠️ El acierto NO se pinta de color y los pips SÍ, que es la regla de toda la
// app: está medido aquí mismo que se puede acertar más y perder dinero, así
// que pintar el porcentaje de verde afirmaría algo que el número no dice. El
// dinero sí significa algo en plata.
//
// ⚠️ Un grupo con CERO operaciones se sigue enseñando. Esconderlo dejaría en
// pantalla solo lo que parece significar algo, que es cómo se fabrica un
// espejismo — la misma decisión que en `Diagnostico`.
function Desglose({ filas, t }) {
  return (
    <div className="card" style={{ padding: '4px 12px' }}>
      {filas.map(([clave, c]) => (
        <div
          key={clave}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            padding: '8px 0',
            borderTop: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: 12.5, flex: 1, minWidth: 0 }}>{t(clave)}</span>
          {/* ⚠️ El total NO se repite: «6/27» ya lleva las 27 operaciones
              dentro. La primera versión ponía «27 ops» al lado y el mismo
              número salía dos veces en la misma fila — se vio en la captura,
              no compilando. */}
          <span className="mono" dir="ltr" style={{ fontSize: 12.5, fontWeight: 700, minWidth: 96, textAlign: 'end' }}>
            {c.acierto === null ? `0 ${t('historial.ops')}` : `${c.ganadas}/${c.total} · ${c.acierto}%`}
          </span>
          <span
            className="mono"
            dir="ltr"
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              minWidth: 46,
              textAlign: 'end',
              color: !c.total ? 'var(--text-muted)' : c.pips >= 0 ? 'var(--green)' : 'var(--red)',
            }}
          >
            {c.total ? `${c.pips >= 0 ? '+' : ''}${c.pips}` : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

// La etiqueta ámbar que marca un experimento. Ámbar y no verde ni rojo: no
// dice si va bien o mal, dice «esto está en pruebas».
function Etiqueta({ children }) {
  return (
    <span
      className="mono"
      dir="ltr"
      style={{
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: '.06em',
        padding: '1px 5px',
        borderRadius: 3,
        color: 'var(--amber)',
        border: '1px solid var(--amber)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

// ⚠️ La raya de arriba separa el experimento de los números de la app. Sin
// algo que los separe se leen como una lista corrida y deja de verse de quién
// es cada número — que es el único error grave posible en esta pantalla.
const BLOQUE_EXPERIMENTO = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  paddingTop: 14,
  borderTop: '1px solid rgba(255,255,255,.10)',
}

function Aviso({ children, ambar }) {
  return (
    <div className="card" style={ambar ? { borderColor: 'var(--amber)' } : undefined}>
      <p style={{ ...TEXTO, margin: 0 }}>{children}</p>
    </div>
  )
}

const TEXTO = { fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }
