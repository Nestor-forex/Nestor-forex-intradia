import { useState } from 'react'
import { PAIR_NAMES } from '../lib/pairs'
import { LOTE_MINIMO, calcularLote } from '../lib/calc'
import { useT } from '../lib/i18n'
import { leerPerfil } from '../lib/perfilRiesgo'
import { MONEDAS_CUENTA, dinero } from '../lib/monedaCuenta'
import MiPerfil from './MiPerfil'

export default function CalculadoraTab({ ratesUSD, loadingTasas, errorTasas, uid, ficha }) {
  const t = useT()
  const perfil = leerPerfil(ficha?.perfilRiesgo)

  // ⚠️ `null` = «la persona no ha tocado esta casilla: usa su perfil». En
  // cuanto escribe algo —también si la vacía— manda lo escrito. Así el perfil
  // rellena la calculadora sin que un cambio puntual aquí lo modifique, y sin
  // un efecto que reescriba lo que la persona acaba de borrar.
  const [capitalTxt, setCapital] = useState(null)
  const [riesgoTxt, setRiesgo] = useState(null)
  // La moneda, con la misma idea: la del perfil mientras no se toque.
  const [monedaElegida, setMoneda] = useState(null)
  const moneda = monedaElegida ?? perfil.moneda
  const capital = capitalTxt ?? (perfil.capital !== null ? String(perfil.capital) : '')
  const riesgo = riesgoTxt ?? (perfil.riesgoPct !== null ? String(perfil.riesgoPct) : '')
  const tienePerfil = perfil.capital !== null && perfil.riesgoPct !== null
  const usaPerfil = tienePerfil && capitalTxt === null && riesgoTxt === null && (monedaElegida === null || monedaElegida === perfil.moneda)
  const [pips, setPips] = useState('')
  const [par, setPar] = useState(PAIR_NAMES[0])

  const r = ratesUSD
    ? calcularLote({
        capital: parseFloat(String(capital).replace(',', '.')),
        riesgoPct: parseFloat(String(riesgo).replace(',', '.')),
        pips: parseFloat(pips),
        par,
        tasas: ratesUSD,
        moneda,
      })
    : { ok: false, pip: null }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <MiPerfil uid={uid} ficha={ficha} />

      <h2 style={{ margin: 0, fontSize: 18 }}>{t('calc.titulo')}</h2>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {MONEDAS_CUENTA.map((m) => (
            <button
              key={m}
              type="button"
              className="btn"
              onClick={() => setMoneda(m)}
              style={{ flex: 1, minHeight: 40, fontSize: 13, ...(moneda === m ? { background: 'var(--cta)', color: 'var(--cta-tinta)', borderColor: 'var(--cta)' } : {}) }}
            >
              {t(`perfil.moneda${m}`)}
            </button>
          ))}
        </div>
        <input
          className="field"
          type="number"
          placeholder={t('calc.capital', { moneda })}
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
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {t(usaPerfil ? 'calc.desdePerfil' : tienePerfil ? 'calc.distintoAlPerfil' : 'calc.sinPerfil')}
        </p>
      </div>

      <div className="card mono" style={{ borderColor: 'oklch(0.32 0.05 155)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 14 }}>
        <span style={{ color: 'var(--text-muted)' }}>{t('calc.riesgoUsd', { moneda })}</span>
        <span>{r.ok ? dinero(r.riesgoUsd, moneda) : '—'}</span>
        <span style={{ color: 'var(--text-muted)' }}>{t('calc.valorPip')}</span>
        <span>{r.pip ? dinero(r.pip, moneda) + ' ' + t('calc.porLote') : '—'}</span>
        <span style={{ color: 'var(--text-muted)' }}>{t('calc.loteSugerido')}</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: r.ok && r.bajoMinimo ? 'var(--amber)' : 'var(--green)' }}>
          {r.ok ? (r.bajoMinimo ? `\u2066< ${LOTE_MINIMO.toFixed(2)}\u2069` : r.lote.toFixed(2)) + ' ' + t('calc.lotes') : ratesUSD ? t('calc.completa') : loadingTasas ? t('calc.cargandoTasas') : t('calc.sinTasas')}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>{t('calc.equivale')}</span>
        <span style={{ color: 'var(--text-secondary)' }}>{r.ok ? t('calc.miniMicro', { mini: r.mini.toFixed(1), micro: r.micro.toFixed(0) }) : '—'}</span>
      </div>

      {r.ok && r.bajoMinimo && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--amber)', lineHeight: 1.5 }}>
          {t('calc.bajoMinimo', { minimo: LOTE_MINIMO.toFixed(2), riesgo: dinero(r.riesgoMinimoUsd, moneda) })}
        </p>
      )}

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
