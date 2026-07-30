import { useEffect, useMemo, useState } from 'react'
import { PAIR_NAMES, monedasDe } from '../lib/pairs'
import { useT } from '../lib/i18n'

const esAbierta = (t) => t.estado === 'abierta'

export default function DiarioTab({ trades, cargando, onGuardar, onBorrar, onCerrar, prellenar, onPrellenado }) {
  const tr = useT()
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
    const entrada = window.prompt(tr('diario.promptCerrar', { par: t.par }))
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
      <h2 style={{ margin: 0, fontSize: 18 }}>{tr('diario.titulo')}</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {stat(String(trades.length), tr('diario.operaciones'), 'var(--text)')}
        {stat(statWin === '—' ? '—' : statWin + '%', tr('diario.ganadas'), 'var(--text)')}
        {stat(statPl, tr('diario.pl'), plTot >= 0 ? 'var(--green)' : 'var(--red)')}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <select className="field" style={{ minHeight: 46, fontSize: 14 }} value={par} onChange={(e) => setPar(e.target.value)}>
            {PAIR_NAMES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <select className="field" style={{ minHeight: 46, fontSize: 14 }} value={dir} onChange={(e) => setDir(e.target.value)}>
            <option value="Compra">{tr('direccion.Compra')}</option>
            <option value="Venta">{tr('direccion.Venta')}</option>
          </select>
          <input
            className="field"
            style={{ minHeight: 46, fontSize: 14 }}
            type="number"
            step="0.01"
            placeholder={tr('diario.lote')}
            value={lote}
            onChange={(e) => setLote(e.target.value)}
          />
          {!abierta && (
            <input
              className="field"
              style={{ minHeight: 46, fontSize: 14 }}
              type="number"
              step="0.01"
              placeholder={tr('diario.resultado')}
              value={pl}
              onChange={(e) => setPl(e.target.value)}
            />
          )}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', minHeight: 30 }}>
          <input type="checkbox" checked={abierta} onChange={(e) => setAbierta(e.target.checked)} style={{ width: 18, height: 18 }} />
          {tr('diario.sigueAbierta')}
        </label>
        <input
          className="field"
          style={{ minHeight: 46, fontSize: 14 }}
          placeholder={tr('diario.notas')}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
        <button className="btn btn-primary" onClick={guardar}>
          {tr('diario.guardar')}
        </button>
      </div>

      {avisoRiesgo.length > 0 && (
        <div style={{ padding: 12, border: '1px solid oklch(0.4 0.06 85)', borderRadius: 8, background: 'oklch(0.22 0.03 85)' }}>
          <div className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber)', marginBottom: 4 }}>
            {tr('diario.riesgoConcentrado')}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {avisoRiesgo.map(({ moneda, pares }) => (
              <div key={moneda}>
                {tr('diario.avisoConcentrado', { n: pares.length, moneda, pares: pares.join(', ') })}
              </div>
            ))}
          </div>
        </div>
      )}

      {cargando && (
        <div className="mono" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {tr('diario.cargando')}
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
                  {t.lote} {tr('diario.loteSufijo')} · {t.fecha}
                </span>
                {esAbierta(t) && <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{tr('diario.abierta')}</span>}
              </div>
              {t.nota && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>{t.nota}</div>}
            </div>
            {esAbierta(t) ? (
              <button
                onClick={() => cerrarOperacion(t)}
                className="mono"
                style={{ minHeight: 36, padding: '0 10px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
              >
                {tr('diario.cerrar')}
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

      {!cargando && trades.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{tr('diario.vacio')}</div>}
    </div>
  )
}
