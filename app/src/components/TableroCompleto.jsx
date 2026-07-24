import { useMemo } from 'react'
import { limitaciones } from '../lib/fakeData'
import { sesgoColor, tendColor, rsiColor, fmtDif } from '../lib/display'
import { fmtFechaHoy, fmtFechaHora, sesionActiva } from '../lib/format'
import { generarReporteMd, descargarMd } from '../lib/reporte'
import BarraFuerza from './BarraFuerza'
import Sparkline from './Sparkline'
import Glosario from './Glosario'

function Chip({ children, color }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: '3px 10px',
        borderRadius: 4,
        color: 'oklch(0.15 0.01 255)',
        background: color,
      }}
    >
      {children}
    </span>
  )
}

function RazonList({ items, emptyText }) {
  if (!items.length) {
    return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{emptyText}</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it) => (
        <div key={it.name} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="mono" style={{ fontWeight: 600 }}>
            {it.name}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{it.razon}</span>
        </div>
      ))}
    </div>
  )
}

export default function TableroCompleto({ onVolver, loading, error, sinConfigurar, stale, guardadoEl, monedas, pares, compras, ventas, vigilancia, setups, corte }) {
  const fecha = useMemo(fmtFechaHoy, [])
  const sesion = useMemo(sesionActiva, [])

  const descargar = () => {
    const md = generarReporteMd({ fecha, sesion, corte, monedas, pares, compras, ventas, vigilancia, setups, limitaciones })
    descargarMd(md, `reporte-forex-${new Date().toISOString().slice(0, 10)}.md`)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <button onClick={onVolver} className="btn-ghost" style={{ padding: '0 12px', minHeight: 36, fontSize: 13, flexShrink: 0 }}>
          ← Volver
        </button>
        <div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Barrido intradía (H1) · Forex
        </div>
      </header>

      <main style={{ flex: 1, padding: '20px 18px 48px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <section>
          <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700 }}>{fecha}</h1>
          <div className="mono" style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div>
              Sesión activa: <span style={{ color: 'var(--text)' }}>{sesion}</span>
            </div>
            <div>{loading ? '…' : corte}</div>
          </div>
        </section>

        <Glosario />

        {sinConfigurar && (
          <div style={{ padding: '14px 18px', border: '1px solid var(--amber)', borderRadius: 6, color: 'var(--amber)', fontSize: 13.5, lineHeight: 1.5 }}>
            Esta copia todavía no tiene configurada la fuente de precios en vivo (Twelve Data). En cuanto se agregue la llave, el
            barrido se calcula solo.
          </div>
        )}

        {stale && (
          <div style={{ padding: '12px 14px', border: '1px solid var(--amber)', borderRadius: 6, color: 'var(--amber)', fontSize: 13, lineHeight: 1.5 }}>
            ⚠ Sin conexión — mostrando el último precio guardado, del {fmtFechaHora(guardadoEl)}.
          </div>
        )}

        {error && (
          <div style={{ padding: '14px 18px', border: '1px solid oklch(0.62 0.13 25)', borderRadius: 6, color: 'oklch(0.8 0.1 25)', fontSize: 14 }}>
            {error}
          </div>
        )}
        {loading && (
          <div className="mono" style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Descargando velas H1 en vivo…
          </div>
        )}

        {!loading && !error && !sinConfigurar && (
        <>
        <section>
          <h2 className="section-title">Fuerza relativa por divisa</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {monedas.map((m) => (
              <BarraFuerza key={m.cod} cod={m.cod} score={m.score} />
            ))}
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Promedio ponderado del cambio % de cada divisa contra las otras 7 (1h 20%, 4h 40%, 24h 40%), reescalado 0-10.
          </p>
        </section>

        <section>
          <h2 className="section-title">Pares — precio, tendencia y filtros</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pares.map((p) => (
              <div key={p.name} className="card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 14 }}>
                    {p.name}
                  </span>
                  <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: sesgoColor(p.sesgo) }}>
                    {p.sesgo}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Sparkline values={p.serie20} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="mono" style={{ fontSize: 16, fontWeight: 700 }}>
                      {p.precio.toFixed(p.dec)}
                    </span>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: p.cambio20 >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {p.cambio20 >= 0 ? '+' : ''}
                      {p.cambio20.toFixed(2)}% · 20h
                    </span>
                  </div>
                </div>
                <div className="mono" style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>
                    Dif <span>{fmtDif(p.dif)}</span>
                  </span>
                  <span style={{ color: tendColor(p.tend) }}>{p.tend}</span>
                  <span style={{ color: rsiColor(p.rsi) }}>RSI {p.rsi}</span>
                  <span>ATR {p.atr.toFixed(2)}% / hora</span>
                </div>
                <div className="mono" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  Pivote {p.pivots.p.toFixed(p.dec)} · S1 {p.pivots.s1.toFixed(p.dec)} · R1 {p.pivots.r1.toFixed(p.dec)}
                </div>
              </div>
            ))}
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            Gráfico y variación (%) sobre las últimas 20 velas H1. ATR: volatilidad proxy cierre-a-cierre por hora. Pivote/S1/R1:
            puntos pivote clásicos calculados con el máximo/mínimo/cierre de las 24 horas previas.
          </p>
        </section>

        <section className="card" style={{ borderColor: 'oklch(0.32 0.05 155)' }}>
          <h2 className="section-title" style={{ color: 'var(--green)', marginBottom: 12 }}>
            Mejores para comprar
          </h2>
          <RazonList items={compras} emptyText="Hoy no hay compras con fuerza y tendencia alineadas — no forzar entradas." />
        </section>

        <section className="card" style={{ borderColor: 'oklch(0.35 0.06 25)' }}>
          <h2 className="section-title" style={{ color: 'var(--red)', marginBottom: 12 }}>
            Mejores para vender
          </h2>
          <RazonList items={ventas} emptyText="Hoy no hay ventas con fuerza y tendencia alineadas — no forzar entradas." />
        </section>

        {vigilancia.length > 0 && (
          <section className="card" style={{ borderColor: 'oklch(0.4 0.06 85)' }}>
            <h2 className="section-title" style={{ color: 'var(--amber)', marginBottom: 12 }}>
              En vigilancia
            </h2>
            <RazonList items={vigilancia} emptyText="" />
          </section>
        )}

        <section>
          <h2 className="section-title">Setups del top</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {setups.map((s) => (
              <div key={s.name + s.lado} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 16 }}>
                    {s.name}
                  </span>
                  <Chip color={s.lado === 'COMPRA' ? 'var(--green)' : 'var(--red)'}>{s.lado}</Chip>
                </div>
                <div className="mono" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Soporte</span>
                  <span>{s.sup}</span>
                  <span style={{ color: 'var(--text-muted)' }}>Resistencia</span>
                  <span>{s.res}</span>
                  <span style={{ color: 'var(--text-muted)' }}>Entrada</span>
                  <span>{s.entrada}</span>
                  <span style={{ color: 'var(--text-muted)' }}>Stop-loss</span>
                  <span>{s.sl}</span>
                  <span style={{ color: 'var(--text-muted)' }}>Take-profit</span>
                  <span>{s.tp}</span>
                  <span style={{ color: 'var(--text-muted)' }}>R/B</span>
                  <span style={{ color: s.rrOk ? 'var(--green)' : 'var(--amber)' }}>{s.rr}</span>
                </div>
                <div className="mono" style={{ marginTop: 10, fontSize: 11.5, color: 'var(--text-muted)' }}>
                  Pivotes de sesión — S2 {s.pivots.s2} · S1 {s.pivots.s1} · P {s.pivots.p} · R1 {s.pivots.r1} · R2 {s.pivots.r2}
                </div>
                <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Invalida: {s.inval}</p>
              </div>
            ))}
          </div>
        </section>
        </>
        )}

        <section style={{ borderTop: '1px solid var(--border)', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <strong style={{ color: 'var(--text)' }}>Riesgo:</strong> 1-2% del capital por operación. Varias posiciones en la misma
              divisa no son operaciones independientes — son una sola apuesta con más tamaño.
            </div>
            <div>
              <strong style={{ color: 'var(--text)' }}>Limitaciones:</strong> {limitaciones}
            </div>
            <div>Análisis educativo, no asesoría financiera personalizada. Operar Forex conlleva riesgo de pérdida.</div>
          </div>
          {!loading && !error && (
            <button
              onClick={descargar}
              className="mono"
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: '10px 18px',
                borderRadius: 6,
                border: '1px solid oklch(0.45 0.05 155)',
                background: 'oklch(0.24 0.03 155)',
                color: 'oklch(0.85 0.08 155)',
                cursor: 'pointer',
              }}
            >
              ↓ Descargar reporte .md
            </button>
          )}
        </section>
      </main>
    </div>
  )
}
