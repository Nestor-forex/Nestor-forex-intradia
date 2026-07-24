import { useState } from 'react'
import { PAIR_NAMES } from '../lib/pairs'
import { calcularLote } from '../lib/calc'

export default function CalculadoraTab({ ratesUSD, loadingTasas, errorTasas }) {
  const [capital, setCapital] = useState('')
  const [riesgo, setRiesgo] = useState('')
  const [pips, setPips] = useState('')
  const [par, setPar] = useState(PAIR_NAMES[0])

  const r = ratesUSD
    ? calcularLote({
        capital: parseFloat(capital),
        riesgoPct: parseFloat(riesgo),
        pips: parseFloat(pips),
        par,
        tasas: ratesUSD,
      })
    : { ok: false, pip: null }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Calculadora de lote y riesgo</h2>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          className="field"
          type="number"
          placeholder="Capital de la cuenta (USD)"
          value={capital}
          onChange={(e) => setCapital(e.target.value)}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input className="field" type="number" step="0.5" placeholder="Riesgo % (1-2)" value={riesgo} onChange={(e) => setRiesgo(e.target.value)} />
          <input className="field" type="number" placeholder="Stop en pips" value={pips} onChange={(e) => setPips(e.target.value)} />
        </div>
        <select className="field" value={par} onChange={(e) => setPar(e.target.value)}>
          {PAIR_NAMES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="card mono" style={{ borderColor: 'oklch(0.32 0.05 155)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 14 }}>
        <span style={{ color: 'var(--text-muted)' }}>Riesgo USD</span>
        <span>{r.ok ? '$' + r.riesgoUsd.toFixed(2) : '—'}</span>
        <span style={{ color: 'var(--text-muted)' }}>Valor del pip</span>
        <span>{r.pip ? '$' + r.pip.toFixed(2) + ' / lote' : '—'}</span>
        <span style={{ color: 'var(--text-muted)' }}>Lote sugerido</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>
          {r.ok ? r.lote.toFixed(2) + ' lotes' : ratesUSD ? 'Completa los campos' : loadingTasas ? 'Cargando tasas…' : 'Sin tasas disponibles'}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>Equivale a</span>
        <span style={{ color: 'var(--text-secondary)' }}>{r.ok ? `${r.mini.toFixed(1)} mini · ${r.micro.toFixed(0)} micro` : '—'}</span>
      </div>

      {errorTasas && !ratesUSD && (
        <div style={{ padding: 12, border: '1px solid oklch(0.62 0.13 25)', borderRadius: 8, color: 'oklch(0.8 0.1 25)', fontSize: 13 }}>
          No se pudo obtener la tasa de cambio ({errorTasas.includes('conexión') ? 'sin conexión' : 'error'}). Esta calculadora la
          necesita para convertir el valor del pip a dólares.
        </div>
      )}

      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Valor del pip calculado con la tasa de cambio de referencia más reciente, por lote estándar (100.000 unidades). Verifica el
        valor exacto con tu bróker: el spread y el apalancamiento cambian el resultado real.
      </p>
    </div>
  )
}
