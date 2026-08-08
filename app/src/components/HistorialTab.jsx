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
