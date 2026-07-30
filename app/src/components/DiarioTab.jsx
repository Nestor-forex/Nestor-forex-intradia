import { useEffect, useMemo, useState } from 'react'
import { PAIR_NAMES, monedasDe } from '../lib/pairs'

const esAbierta = (t) => t.estado === 'abierta'

export default function DiarioTab({ trades, cargando, onGuardar, onBorrar, onCerrar, prellenar, onPrellenado }) {
  const [par, setPar] = useState(PAIR_NAMES[0])
  const [dir, setDir] = useState('Compra')
  const [lote, setLote] = useState('')
  const [pl, setPl] = useState('')
  const [nota, setNota] = useState('')
  const [abierta, setAbierta] = useState(false)

  // Cuando se llega aquí desde el detalle de un setup, el formulario arranca
  // con el par, la dirección y la nota ya puestos. Falta el lote, que depende
  // de cuánto quiera arriesgar Néstor.
  useEffect(() => {
    if (!prellenar) return
    if (PAIR_NAMES.includes(prellenar.par)) setPar(prellenar.par)
    if (prellenar.dir) setDir(prellenar.dir)
    if (prellenar.nota) setNota(prellenar.nota)
    setAbierta(Boolean(prellenar.abierta))
    setPl('')
    onPrellenado?.()
  }, [prellenar, onPrellenado])

  const cerradas = trades.filter((t) => !esAbierta(t))
  const abiertas = trades.filter(esAbierta)
  const wins = cerradas.filter((t) => t.pl > 0).length
  const plTot = cerradas.reduce((a, t) => a + t.pl, 0)
  const statWin = cerradas.length ? ((wins / cerradas.length) * 100).toFixed(0) : '—'
  const statPl = (plTot >= 0 ? '+' : '') + plTot.toFixed(0)

  const avisoRiesgo = useMemo(() => {
    const porMoneda = new Map()
    for (const t of abiertas) {
      for (const m of monedasDe(t.par)) {
        if (!porMoneda.has(m)) porMoneda.set(m, [])
        porMoneda.get(m).push(t)
      }
    }
    const resultado = []
    for (const [moneda, ts] of porMoneda) {
      if (ts.length < 2) continue
      resultado.push({ moneda, pares: [...new Set(ts.map((t) => t.par))] })
    }
    return resultado
  }, [abiertas])

  const guardar = () => {
    const loteNum = parseFloat(lote)
    if (!isFinite(loteNum)) return
    let plNum = 0
    if (!abierta) {
      plNum = parseFloat(pl)
      if (!isFinite(plNum)) return
    }
    onGuardar({ par, dir, lote: loteNum, pl: plNum, nota: nota.trim(), fecha: new Date().toISOString().slice(0, 10), estado: abierta ? 'abierta' : 'cerrada' })
    setLote('')
    setPl('')
    setNota('')
    setAbierta(false)
  }

  const cerrarOperacion = (t) => {
    const entrada = window.prompt(`Resultado final de ${t.par} (USD, usa - para pérdida):`)
    if (entrada === null) return
    const plNum = parseFloat(entrada)
    if (!isFinite(plNum)) return
    onCerrar(t.id, plNum)
  }

  const stat = (valor, label, color) => (
    <div className="card" style={{ textAlign: 'center', padding: 10 }}>
      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color }}>
        {valor}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Diario de operaciones</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {stat(String(trades.length), 'Operaciones', 'var(--text)')}
        {stat(statWin === '—' ? '—' : statWin + '%', '% ganadas', 'var(--text)')}
        {stat(statPl, 'P/L (USD)', plTot >= 0 ? 'var(--green)' : 'var(--red)')}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <select className="field" style={{ minHeight: 46, fontSize: 14 }} value={par} onChange={(e) => setPar(e.target.value)}>
            {PAIR_NAMES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select className="field" style={{ minHeight: 46, fontSize: 14 }} value={dir} onChange={(e) => setDir(e.target.value)}>
            <option>Compra</option>
            <option>Venta</option>
          </select>
          <input
            className="field"
            style={{ minHeight: 46, fontSize: 14 }}
            type="number"
            step="0.01"
            placeholder="Lote (ej. 0.10)"
            value={lote}
            onChange={(e) => setLote(e.target.value)}
          />
          {!abierta && (
            <input
              className="field"
              style={{ minHeight: 46, fontSize: 14 }}
              type="number"
              step="0.01"
              placeholder="Resultado USD (±)"
              value={pl}
              onChange={(e) => setPl(e.target.value)}
            />
          )}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', minHeight: 30 }}>
          <input type="checkbox" checked={abierta} onChange={(e) => setAbierta(e.target.checked)} style={{ width: 18, height: 18 }} />
          Sigue abierta (todavía sin resultado)
        </label>
        <input
          className="field"
          style={{ minHeight: 46, fontSize: 14 }}
          placeholder="Notas (setup, qué aprendiste…)"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
        <button className="btn btn-primary" onClick={guardar}>
          Guardar operación
        </button>
      </div>

      {avisoRiesgo.length > 0 && (
        <div style={{ padding: 12, border: '1px solid oklch(0.4 0.06 85)', borderRadius: 8, background: 'oklch(0.22 0.03 85)' }}>
          <div className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber)', marginBottom: 4 }}>
            ⚠ Riesgo concentrado
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {avisoRiesgo.map(({ moneda, pares }) => (
              <div key={moneda}>
                Tienes {pares.length} operaciones abiertas con <strong style={{ color: 'var(--text)' }}>{moneda}</strong> ({pares.join(', ')}) —
                no son apuestas independientes, es una sola apuesta más grande a esa divisa.
              </div>
            ))}
          </div>
        </div>
      )}

      {cargando && (
        <div className="mono" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Cargando operaciones…
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {trades.map((t) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700 }}>{t.par}</span>
                <span style={{ color: t.dir === 'Compra' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{t.dir}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {t.lote} lote · {t.fecha}
                </span>
                {esAbierta(t) && <span style={{ color: 'var(--amber)', fontWeight: 600 }}>Abierta</span>}
              </div>
              {t.nota && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>{t.nota}</div>}
            </div>
            {esAbierta(t) ? (
              <button
                onClick={() => cerrarOperacion(t)}
                className="mono"
                style={{ minHeight: 36, padding: '0 10px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
              >
                Cerrar
              </button>
            ) : (
              <span className="mono" style={{ fontWeight: 700, fontSize: 14, color: t.pl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {(t.pl >= 0 ? '+' : '') + t.pl.toFixed(2)}
              </span>
            )}
            <button
              onClick={() => onBorrar(t.id)}
              style={{ minWidth: 44, minHeight: 44, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 15 }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {!cargando && trades.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aún no has registrado operaciones.</div>}
    </div>
  )
}
