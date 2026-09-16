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
          <Resumen resumen={resumen} t={t} />
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
      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text)' }}>
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
        <div className="mono" style={{ fontSize: 13.5, fontWeight: 700 }}>
          {f.par} {t('lado.' + f.lado)}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLOR[estado] }}>
          {t('historial.' + estado)}
          {typeof f.pips === 'number' && (
            <span className="mono" style={{ marginInlineStart: 6 }}>
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

function Aviso({ children, ambar }) {
  return (
    <div className="card" style={ambar ? { borderColor: 'var(--amber)' } : undefined}>
      <p style={{ ...TEXTO, margin: 0 }}>{children}</p>
    </div>
  )
}

const TEXTO = { fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }
