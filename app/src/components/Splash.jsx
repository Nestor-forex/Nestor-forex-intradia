import { useMemo } from 'react'
import { useT } from '../lib/i18n'
import SelectorIdioma from './SelectorIdioma'

const EXCHANGES = [
  ['NYSE', 13.5, 20], // horas UTC, lun-vie
  ['NASDAQ', 13.5, 20],
  ['LSE', 8, 16.5],
  ['TSE', 0, 6],
  ['SSE', 1.5, 7],
  ['EURONEXT', 7, 15.5],
  ['HKEX', 1.5, 8],
]

function bolsaAbierta(horaUTC, diaUTC, [, ini, fin]) {
  if (diaUTC === 0 || diaUTC === 6) return false
  return horaUTC >= ini && horaUTC < fin
}

// Recorte del panel de gráfico dentro de la imagen original (1440x2560):
// solo la parte del gráfico de velas + RSI, sin la fila de bolsas de arriba
// (esta app ya trae su propia fila con estado en vivo) ni la franja
// dorada/título/botón de abajo (esos se hacen con código real para que el
// botón "Entrar" funcione de verdad).
const CROP_TOP = 0.09
const CROP_BOTTOM = 0.515
const IMG_ASPECT = 2560 / 1440
const CROP_HEIGHT_FRAC = CROP_BOTTOM - CROP_TOP
const CONTAINER_ASPECT = `1440 / ${Math.round(1440 * IMG_ASPECT * CROP_HEIGHT_FRAC)}`
const IMG_TOP_PCT = -(CROP_TOP / CROP_HEIGHT_FRAC) * 100

export default function Splash({ nombreApp, onEntrar }) {
  const t = useT()
  const exchangeStatus = useMemo(() => {
    const now = new Date()
    const horaUTC = now.getUTCHours() + now.getUTCMinutes() / 60
    const diaUTC = now.getUTCDay()
    return EXCHANGES.map((e) => ({ nombre: e[0], abierta: bolsaAbierta(horaUTC, diaUTC, e) }))
  }, [])

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#0a0e1a' }}>
      <div
        className="mono"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px 16px',
          padding: '16px 20px 12px',
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(230,235,245,0.85)',
        }}
      >
        {exchangeStatus.map((e) => (
          <span key={e.nombre} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: e.abierta ? '#39d97a' : '#e5484d',
                boxShadow: e.abierta ? '0 0 6px #39d97a' : '0 0 6px #e5484d',
              }}
            />
            {e.nombre}
          </span>
        ))}
      </div>

      <div style={{ padding: '0 16px' }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: CONTAINER_ASPECT, overflow: 'hidden', borderRadius: 12, border: '1.5px solid #2a3350' }}>
          <img
            src={`${import.meta.env.BASE_URL}trading_app_intradia.png`}
            alt=""
            style={{ position: 'absolute', top: `${IMG_TOP_PCT}%`, left: 0, width: '100%', display: 'block' }}
          />
        </div>
      </div>

      <svg viewBox="0 0 400 130" preserveAspectRatio="none" style={{ width: '100%', height: 90, display: 'block', marginTop: 8 }}>
        <defs>
          <linearGradient id="nfi-wave-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3a2f10" />
            <stop offset="35%" stopColor="#d4af37" />
            <stop offset="55%" stopColor="#fdf1c3" />
            <stop offset="75%" stopColor="#b8860b" />
            <stop offset="100%" stopColor="#2a2410" />
          </linearGradient>
          <linearGradient id="nfi-wave-silver" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1c1f2a" />
            <stop offset="45%" stopColor="#aab2c5" />
            <stop offset="60%" stopColor="#f2f4f8" />
            <stop offset="100%" stopColor="#1c1f2a" />
          </linearGradient>
        </defs>
        <rect width="400" height="130" fill="#0a0e1a" />
        <path d="M0,70 C60,20 120,110 200,60 C280,15 340,100 400,55 L400,130 L0,130 Z" fill="url(#nfi-wave-gold)" opacity="0.9" />
        <path d="M0,90 C70,130 150,40 220,85 C300,125 350,50 400,90 L400,130 L0,130 Z" fill="url(#nfi-wave-silver)" opacity="0.55" />
      </svg>

      <div style={{ position: 'relative', padding: '24px 28px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
        <h1
          style={{
            margin: 0,
            fontSize: 34,
            lineHeight: 1.1,
            fontWeight: 800,
            letterSpacing: '0.03em',
            background: 'linear-gradient(180deg, #fff6d5 0%, #e8c15c 30%, #b8860b 55%, #f5deb3 75%, #d4af37 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {nombreApp}
        </h1>
        <div style={{ width: 120, height: 2, background: 'linear-gradient(90deg, transparent, #d4af37, transparent)' }} />
        <p style={{ margin: 0, fontSize: 14.5, color: '#aab2c5' }}>{t('splash.lema')}</p>
        <button className="btn btn-primary" style={{ marginTop: 8, minHeight: 52, fontSize: 16, width: '100%', maxWidth: 320 }} onClick={onEntrar}>
          {t('splash.entrar')}
        </button>
        <p style={{ margin: 0, fontSize: 12.5, color: '#6b7488' }}>{t('splash.iniciaSesion')}</p>
        {/* El selector va también en la portada: es la primera pantalla que ve
            alguien que no ha entrado, y desde aquí no hay otra forma de cambiarlo. */}
        <div style={{ marginTop: 4 }}>
          <SelectorIdioma />
        </div>
      </div>
    </div>
  )
}
