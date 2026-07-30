import { useState } from 'react'
import { PAIR_NAMES } from '../lib/pairs'
import { calcularLote } from '../lib/calc'
import { useT } from '../lib/i18n'

export default function CalculadoraTab({ ratesUSD, loadingTasas, errorTasas }) {
  const t = useT()
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
      <h2 style={{ margin: 0, fontSize: 18 }}>{t('calc.titulo')}</h2>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          className="field"
          type="number"
          placeholder={t('calc.capital')}
          value={capital}
          onChange={(e) => setCapital(e.target.value)}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input className="field" type="number" step="0.5" placeholder={t('calc.riesgoPct')} value={riesgo} onChange={(e) => setRiesgo(e.target.value)} />
          <input className="field" type="number" placeholder={t('calc.stopPips')} value={pips} onChange={(e) => setPips(e.target.value)} />
        </div>
        <select className="field" value={par} onChange={(e) => setPar(e.target.value)}>
          {PAIR_NAMES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="card mono" style={{ borderColor: 'oklch(0.32 0.05 155)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 14 }}>
        <span style={{ color: 'var(--text-muted)' }}>{t('calc.riesgoUsd')}</span>
        <span>{r.ok ? '$' + r.riesgoUsd.toFixed(2) : '—'}</span>
        <span style={{ color: 'var(--text-muted)' }}>{t('calc.valorPip')}</span>
        <span>{r.pip ? '$' + r.pip.toFixed(2) + ' ' + t('calc.porLote') : '—'}</span>
        <span style={{ color: 'var(--text-muted)' }}>{t('calc.loteSugerido')}</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>
          {r.ok ? r.lote.toFixed(2) + ' ' + t('calc.lotes') : ratesUSD ? t('calc.completa') : loadingTasas ? t('calc.cargandoTasas') : t('calc.sinTasas')}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>{t('calc.equivale')}</span>
        <span style={{ color: 'var(--text-secondary)' }}>{r.ok ? t('calc.miniMicro', { mini: r.mini.toFixed(1), micro: r.micro.toFixed(0) }) : '—'}</span>
      </div>

      {errorTasas && !ratesUSD && (
        <div style={{ padding: 12, border: '1px solid oklch(0.62 0.13 25)', borderRadius: 8, color: 'oklch(0.8 0.1 25)', fontSize: 13 }}>
          {t('calc.errorTasa', { causa: errorTasas.includes('conexión') ? t('calc.sinConexion') : t('calc.error') })}
        </div>
      )}

      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {t('calc.pie')}
      </p>
    </div>
  )
}
