import { useState } from 'react'
import { useT } from '../lib/i18n'
import SelectorIdioma from './SelectorIdioma'

export default function Auth({ nombreApp, onRegistrar, onIngresar }) {
  const t = useT()
  const [modo, setModo] = useState('login')
  const [logEmail, setLogEmail] = useState('')
  const [logClave, setLogClave] = useState('')
  const [regNombre, setRegNombre] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regClave, setRegClave] = useState('')
  const [msg, setMsg] = useState('')
  const [cargando, setCargando] = useState(false)

  const tabStyle = (activo) => ({
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    border: `1px solid ${activo ? 'oklch(0.45 0.05 155)' : 'var(--border-strong)'}`,
    background: activo ? 'oklch(0.24 0.03 155)' : 'var(--bg-input)',
    color: 'var(--text)',
  })

  const cambiarModo = (m) => {
    setModo(m)
    setMsg('')
  }

  const ingresar = async () => {
    setCargando(true)
    setMsg('')
    const r = await onIngresar(logEmail, logClave)
    setCargando(false)
    if (!r.ok) setMsg(r.msg)
  }

  const registrar = async () => {
    setCargando(true)
    setMsg('')
    const r = await onRegistrar(regNombre, regEmail, regClave)
    setCargando(false)
    if (!r.ok) {
      setMsg(r.msg)
      return
    }
    setRegNombre('')
    setRegEmail('')
    setRegClave('')
  }

  return (
    <div style={{ flex: 1, padding: '48px 24px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ fontSize: 11 }}>
            {t('comun.eyebrow')}
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700 }}>{nombreApp}</h1>
        </div>
        <div style={{ marginInlineStart: 'auto' }}>
          <SelectorIdioma compacto />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={tabStyle(modo === 'login')} onClick={() => cambiarModo('login')}>
          {t('auth.ingresar')}
        </button>
        <button style={tabStyle(modo === 'registro')} onClick={() => cambiarModo('registro')}>
          {t('auth.inscribirse')}
        </button>
      </div>

      {modo === 'login' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="field" type="email" placeholder={t('auth.correo')} value={logEmail} onChange={(e) => setLogEmail(e.target.value)} />
          <input className="field" type="password" placeholder={t('auth.clave')} value={logClave} onChange={(e) => setLogClave(e.target.value)} />
          <button className="btn btn-primary" style={{ minHeight: 50, fontSize: 16, opacity: cargando ? 0.7 : 1 }} disabled={cargando} onClick={ingresar}>
            {cargando ? t('auth.ingresando') : t('auth.ingresar')}
          </button>
        </div>
      )}

      {modo === 'registro' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="field" placeholder={t('auth.nombreCompleto')} value={regNombre} onChange={(e) => setRegNombre(e.target.value)} />
          <input className="field" type="email" placeholder={t('auth.correo')} value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
          <input className="field" type="password" placeholder={t('auth.creaClave')} value={regClave} onChange={(e) => setRegClave(e.target.value)} />
          <button className="btn btn-primary" style={{ minHeight: 50, fontSize: 16, opacity: cargando ? 0.7 : 1 }} disabled={cargando} onClick={registrar}>
            {cargando ? t('auth.enviando') : t('auth.enviarSolicitud')}
          </button>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('auth.notaSolicitud')}</p>
        </div>
      )}

      {msg && (
        <div style={{ padding: '12px 14px', borderRadius: 8, border: '1px solid oklch(0.4 0.06 85)', color: 'oklch(0.8 0.1 85)', fontSize: 14, lineHeight: 1.5 }}>
          {msg}
        </div>
      )}
    </div>
  )
}
