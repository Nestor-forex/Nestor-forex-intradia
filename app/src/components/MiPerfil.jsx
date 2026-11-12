// «Mi perfil de riesgo»: el capital, el riesgo por operación y los dos frenos
// de cada persona. Va arriba de la calculadora, en la pestaña Riesgo.
//
// ⚠️ NO ES UNA TARJETA PLEGABLE, a propósito. Es un formulario que se rellena
// una vez y luego se mira; escondido detrás de un «Ver», quien entra por
// primera vez a la calculadora no sabría que existe y seguiría escribiendo el
// capital a mano cada vez.
//
// ⚠️ EL RESUMEN VA COMO «RÓTULO: NÚMERO», NUNCA COMO FRASE CON EL NÚMERO
// DENTRO. «Paras tras 1 pérdidas» es el fallo de concordancia que ya salió dos
// veces en este repositorio (`sombra.aviso` y «Otras 1 señales»); con el
// número fuera de la frase no hay flexión que romper en ningún idioma.

import { useState } from 'react'
import { useIdioma } from '../lib/i18n'
import { usePerfilRiesgo } from '../lib/usePerfilRiesgo'
import {
  CAMPOS,
  LIMITES,
  NIVELES,
  aNumero,
  frenoEnDolares,
  leerPerfil,
  nivelDe,
  operacionesHastaElFreno,
  valoresIniciales,
} from '../lib/perfilRiesgo'

const TEXTO = { fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }
const ETIQUETA = { fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }
const DATO = { fontVariantNumeric: 'tabular-nums' }

// La clave de texto de cada campo. Se usa en las casillas y en los mensajes
// de error, para que el error nombre la casilla con la misma palabra que la
// persona tiene delante.
const ROTULO = {
  capital: 'perfil.capital',
  riesgoPct: 'perfil.riesgoPct',
  limiteDiarioPct: 'perfil.limiteDiario',
  maxPerdidasSeguidas: 'perfil.maxPerdidas',
}

const dolares = (n) => (typeof n === 'number' && Number.isFinite(n) ? '$' + n.toFixed(2) : '—')

function Nivel({ activo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 10px',
        borderRadius: 999,
        border: `1px solid ${activo ? 'var(--cta)' : 'var(--border)'}`,
        background: activo ? 'var(--cta)' : 'transparent',
        color: activo ? 'var(--cta-tinta)' : 'var(--text-secondary)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

export default function MiPerfil({ uid, ficha }) {
  const { t } = useIdioma()
  const pr = usePerfilRiesgo(uid, ficha)
  const [form, setForm] = useState(() => valoresIniciales(pr.perfil))
  const [resultado, setResultado] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const cambiar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }))
    setResultado(null)
  }

  // Lo que se ve debajo se calcula con lo que está ESCRITO, no con lo
  // guardado: así la persona ve qué significan sus números antes de guardar.
  const escrito = leerPerfil(form)
  const nivel = nivelDe(aNumero(form.riesgoPct, 'riesgoPct'))
  const riesgoUsd =
    escrito.capital !== null && escrito.riesgoPct !== null ? (escrito.capital * escrito.riesgoPct) / 100 : null
  const freno = frenoEnDolares(escrito)
  const hastaFreno = operacionesHastaElFreno(escrito)

  const guardar = async () => {
    setGuardando(true)
    const r = await pr.guardar(form)
    setGuardando(false)
    setResultado(r)
  }

  const mensajeError = (r) => {
    const campo = r.campo ? t(ROTULO[r.campo]) : ''
    if (r.codigo === 'fueraDeRango') return t('perfil.err_fueraDeRango', { campo, min: LIMITES[r.campo].min, max: LIMITES[r.campo].max })
    if (r.codigo === 'falta') return t('perfil.err_falta', { campo })
    return t(`perfil.err_${r.codigo}`)
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 15 }}>{t('perfil.titulo')}</h3>
        <p style={{ ...TEXTO, marginTop: 4 }}>{t('perfil.desc')}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={ETIQUETA}>{t('perfil.nivel')}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(NIVELES).map(([nombre, pct]) => (
            <Nivel key={nombre} activo={nivel === nombre} onClick={() => cambiar('riesgoPct', String(pct))}>
              {t(`perfil.${nombre}`)} · <span dir="ltr" style={DATO}>{pct} %</span>
            </Nivel>
          ))}
          {nivel === 'personalizado' && <Nivel activo>{t('perfil.personalizado')}</Nivel>}
        </div>
      </div>

      {CAMPOS.map((c) => (
        <label key={c} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={ETIQUETA}>{t(ROTULO[c])}</span>
          <input
            className="field"
            type="text"
            inputMode={c === 'maxPerdidasSeguidas' ? 'numeric' : 'decimal'}
            value={form[c]}
            onChange={(e) => cambiar(c, e.target.value)}
          />
        </label>
      ))}

      {/* ⚠️ La letra de máquina de escribir (`mono`) va SOLO en los números, no
          en el bloque entero. Puesta en los rótulos, en árabe estira las
          palabras letra por letra y en español parte «Pérdidas seguidas hasta
          ese freno» en dos renglones. Salió mirando la captura. */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 12px', fontSize: 13, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-input)', alignItems: 'baseline' }}
      >
        <span style={{ color: 'var(--text-muted)' }}>{t('perfil.porOperacion')}</span>
        <span className="mono" dir="ltr" style={DATO}>{dolares(riesgoUsd)}</span>
        <span style={{ color: 'var(--text-muted)' }}>{t('perfil.frenoDia')}</span>
        <span className="mono" dir="ltr" style={DATO}>{dolares(freno)}</span>
        <span style={{ color: 'var(--text-muted)' }}>{t('perfil.hastaFreno')}</span>
        <span className="mono" dir="ltr" style={DATO}>{hastaFreno ?? '—'}</span>
      </div>

      <p style={TEXTO}>{t('perfil.frenosNota')}</p>

      <button type="button" className="btn btn-primary" onClick={guardar} disabled={guardando}>
        {t('perfil.guardar')}
      </button>

      {resultado?.ok && <p style={{ ...TEXTO, color: 'var(--green)' }}>{t('perfil.guardado')}</p>}
      {resultado && !resultado.ok && <p style={{ ...TEXTO, color: 'var(--red)' }}>{mensajeError(resultado)}</p>}
    </div>
  )
}
