import { sesgoColor, tendColor } from '../lib/display'
import { fmtFechaHora } from '../lib/format'
import BarraFuerza from './BarraFuerza'
import { useIdioma } from '../lib/i18n'

export default function BarridoTab({ loading, error, sinConfigurar, stale, guardadoEl, monedas, pares, corte, onVerTablero }) {
  const { t, locale } = useIdioma()
  const paresOrdenados = [...pares].sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('barrido.titulo')}</h2>
        <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
          {corte}
        </span>
      </div>

      {sinConfigurar && (
        <div style={{ padding: 12, border: '1px solid var(--amber)', borderRadius: 8, color: 'var(--amber)', fontSize: 12.5, lineHeight: 1.5 }}>
          {t('barrido.sinConfigurar')}
        </div>
      )}
      {stale && (
        <div style={{ padding: 12, border: '1px solid var(--amber)', borderRadius: 8, color: 'var(--amber)', fontSize: 12.5, lineHeight: 1.5 }}>
          {t('barrido.sinConexion', { fecha: fmtFechaHora(guardadoEl, locale) })}
        </div>
      )}
      {error && (
        <div style={{ padding: 12, border: '1px solid oklch(0.62 0.13 25)', borderRadius: 8, color: 'oklch(0.8 0.1 25)', fontSize: 13 }}>{error}</div>
      )}
      {loading && (
        <div className="mono" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {t('barrido.descargando')}
        </div>
      )}

      {!loading && !error && !sinConfigurar && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {monedas.map((m) => (
              <BarraFuerza key={m.cod} cod={m.cod} score={m.score} compact />
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paresOrdenados.map((p) => (
              <div
                key={p.name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '86px 70px 1fr auto',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--bg-card)',
                  fontSize: 13,
                }}
              >
                <span className="mono" style={{ fontWeight: 600 }}>
                  {p.name}
                </span>
                <span className="mono" style={{ fontWeight: 700, fontSize: 12, color: sesgoColor(p.sesgo) }}>
                  {t(`sesgo.${p.sesgo}`)}
                </span>
                <span style={{ color: tendColor(p.tend) }}>{t(`tend.${p.tend}`)}</span>
                <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                  RSI {p.rsi}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {t('barrido.pie')}{' '}
        <a
          href="#tablero"
          onClick={(e) => {
            e.preventDefault()
            onVerTablero()
          }}
        >
          {t('barrido.verTablero')}
        </a>
      </p>
    </div>
  )
}
