import { useMemo } from 'react'

const W = 400
const CHART_X0 = 40
const CHART_X1 = 328
const PRICE_Y0 = 100 // arriba (precio más alto)
const PRICE_Y1 = 330 // abajo (precio más bajo)
const RSI_Y0 = 350
const RSI_Y1 = 460

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

function generarDatos() {
  const n = 28
  const start = 1.076
  const slope = (1.09 - start) / (n - 1)
  const closes = []
  for (let i = 0; i < n; i++) {
    const base = start + slope * i
    const dip = i < 11 ? Math.sin((i / 10) * Math.PI) * -0.0035 : 0
    const wiggle = Math.sin(i * 1.4) * 0.0012 + Math.sin(i * 0.6 + 1) * 0.0009
    closes.push(base + dip + wiggle)
  }

  const gap = (CHART_X1 - CHART_X0) / n
  const velas = closes.map((c, i) => {
    const prev = i === 0 ? c : closes[i - 1]
    const up = c >= prev
    return { i, c, prev, up, x: CHART_X0 + gap * i + gap / 2 }
  })

  const sma = closes.map((_, i) => {
    const desde = Math.max(0, i - 4)
    const ventana = closes.slice(desde, i + 1)
    return ventana.reduce((a, b) => a + b, 0) / ventana.length
  })

  const bandas = sma.map((v, i) => {
    const ancho = 0.0013 + Math.abs(Math.sin(i * 0.5)) * 0.0009
    return { sup: v + ancho, inf: v - ancho }
  })

  const bandMin = Math.min(...bandas.map((b) => b.inf))
  const bandMax = Math.max(...bandas.map((b) => b.sup))
  const step = 0.002
  const domainMin = Math.floor(bandMin / step) * step
  const domainMax = Math.ceil(bandMax / step) * step
  const precioAY = (p) => PRICE_Y1 - ((p - domainMin) / (domainMax - domainMin)) * (PRICE_Y1 - PRICE_Y0)

  const priceLabels = []
  for (let v = domainMax; v >= domainMin - 1e-9; v -= step) priceLabels.push({ v, y: precioAY(v) })

  const smaPts = sma.map((v, i) => ({ x: velas[i].x, y: precioAY(v) }))
  const bandSupPts = bandas.map((b, i) => ({ x: velas[i].x, y: precioAY(b.sup) }))
  const bandInfPts = bandas.map((b, i) => ({ x: velas[i].x, y: precioAY(b.inf) }))

  const velasDibujo = velas.map((v, i) => {
    const y1 = precioAY(v.c)
    const y2 = precioAY(v.prev)
    const yTop = Math.min(y1, y2)
    const yBot = Math.max(yTop + 3, Math.max(y1, y2))
    const mecha = Math.abs(Math.sin(i * 1.3)) * 9 + 3
    return { ...v, yTop, yBot, wickTop: yTop - mecha * 0.5, wickBot: yBot + mecha * 0.5 }
  })

  const rsi = closes.map((_, i) => {
    const drift = 45 + (i / n) * 22
    return Math.max(22, Math.min(82, drift + Math.sin(i * 0.8) * 10 + Math.sin(i * 0.31 + 2) * 6))
  })
  const rsiAY = (v) => RSI_Y1 - ((v - 10) / (90 - 10)) * (RSI_Y1 - RSI_Y0)
  const rsiPts = rsi.map((v, i) => ({ x: velas[i].x, y: rsiAY(v) }))
  const rsiLabels = [80, 70, 50, 30, 20].map((v) => ({ v, y: rsiAY(v) }))

  const cambioPct = (i) => ((closes[i] - closes[0]) / closes[0]) * 100
  const badgeIdx = [9, 17, 25]
  const badges = badgeIdx.map((i) => ({
    x: velas[i].x,
    y: precioAY(bandas[i].sup) - 14,
    texto: (cambioPct(i) >= 0 ? '+' : '') + cambioPct(i).toFixed(2) + '%',
  }))

  const timeLabels = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00'].map((t, i, arr) => ({
    t,
    x: CHART_X0 + ((CHART_X1 - CHART_X0) * i) / (arr.length - 1),
  }))

  const precioActual = closes.at(-1)
  const cambioActual = cambioPct(n - 1) - cambioPct(n - 2)

  return { velasDibujo, smaPts, bandSupPts, bandInfPts, priceLabels, rsiPts, rsiLabels, badges, timeLabels, precioActual, cambioActual, rsiActual: rsi.at(-1) }
}

function puntos(pts) {
  return pts.map((p) => `${p.x},${p.y}`).join(' ')
}

export default function Splash({ nombreApp, onEntrar }) {
  const datos = useMemo(generarDatos, [])
  const exchangeStatus = useMemo(() => {
    const now = new Date()
    const horaUTC = now.getUTCHours() + now.getUTCMinutes() / 60
    const diaUTC = now.getUTCDay()
    return EXCHANGES.map((e) => ({ nombre: e[0], abierta: bolsaAbierta(horaUTC, diaUTC, e) }))
  }, [])

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#0a0e1a' }}>
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
        <svg viewBox={`0 0 ${W} 480`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="nfi-panel-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0d1424" />
              <stop offset="100%" stopColor="#080b14" />
            </linearGradient>
          </defs>
          <rect x="8" y="8" width={W - 16} height="464" rx="12" fill="url(#nfi-panel-bg)" stroke="#2a3350" strokeWidth="1.5" />

          {/* grilla */}
          {datos.priceLabels.map((p, i) => (
            <line key={i} x1={CHART_X0} x2={CHART_X1} y1={p.y} y2={p.y} stroke="#1c2438" strokeWidth="1" />
          ))}

          {/* caja de info */}
          <rect x="20" y="20" width="150" height="68" rx="8" fill="#101a30" stroke="#26314d" />
          <text x="30" y="38" fill="#fff" fontSize="14" fontWeight="700" fontFamily="'IBM Plex Mono', monospace">
            EUR/USD
          </text>
          <rect x="96" y="27" width="30" height="14" rx="3" fill="#1c5cff" opacity="0.85" />
          <text x="101" y="37.5" fill="#dbe6ff" fontSize="9" fontFamily="'IBM Plex Mono', monospace">
            15m
          </text>
          <text x="131" y="38" fill="#39d97a" fontSize="12">
            ▲
          </text>
          <text x="30" y="60" fill="#39d97a" fontSize="21" fontWeight="700" fontFamily="'IBM Plex Mono', monospace">
            {datos.precioActual.toFixed(4)}
          </text>
          <text x="30" y="80" fill="#39d97a" fontSize="12.5" fontFamily="'IBM Plex Mono', monospace">
            {(datos.cambioActual >= 0 ? '+' : '') + datos.cambioActual.toFixed(2)}%
          </text>

          {/* bandas */}
          <polyline points={puntos(datos.bandSupPts)} fill="none" stroke="#c9a227" strokeWidth="1.5" opacity="0.75" />
          <polyline points={puntos(datos.bandInfPts)} fill="none" stroke="#c9a227" strokeWidth="1.5" opacity="0.75" />
          <polyline points={puntos(datos.smaPts)} fill="none" stroke="#f2f5fa" strokeWidth="1.5" opacity="0.85" />

          {/* velas */}
          {datos.velasDibujo.map((v, i) => (
            <g key={i}>
              <line x1={v.x} x2={v.x} y1={v.wickTop} y2={v.wickBot} stroke={v.up ? '#2fbf6e' : '#e5484d'} strokeWidth="1.4" />
              <rect x={v.x - 3.4} y={v.yTop} width="6.8" height={Math.max(v.yBot - v.yTop, 3)} fill={v.up ? '#2fbf6e' : '#e5484d'} rx="1" />
            </g>
          ))}

          {/* badges de % */}
          {datos.badges.map((b, i) => (
            <text key={i} x={b.x} y={b.y} fill="#39d97a" fontSize="12" fontWeight="700" textAnchor="middle" fontFamily="'IBM Plex Mono', monospace">
              {b.texto} ▲
            </text>
          ))}

          {/* eje de precio */}
          {datos.priceLabels.map((p, i) => (
            <text key={i} x={CHART_X1 + 8} y={p.y + 4} fill="#8a93ab" fontSize="10" fontFamily="'IBM Plex Mono', monospace">
              {p.v.toFixed(4)}
            </text>
          ))}

          {/* separador */}
          <line x1={CHART_X0 - 12} x2={CHART_X1 + 12} y1="340" y2="340" stroke="#1c2438" strokeWidth="1.5" />

          {/* RSI */}
          <text x="30" y="345" fill="#5b8def" fontSize="11.5" fontWeight="700" fontFamily="'IBM Plex Mono', monospace">
            RSI (14)
          </text>
          <text x="95" y="345" fill="#8a93ab" fontSize="11.5" fontFamily="'IBM Plex Mono', monospace">
            {datos.rsiActual.toFixed(2)}
          </text>
          <line x1={CHART_X0} x2={CHART_X1} y1={datos.rsiLabels[1].y} y2={datos.rsiLabels[1].y} stroke="#3a4568" strokeWidth="1" strokeDasharray="3 3" />
          <line x1={CHART_X0} x2={CHART_X1} y1={datos.rsiLabels[3].y} y2={datos.rsiLabels[3].y} stroke="#3a4568" strokeWidth="1" strokeDasharray="3 3" />
          <polyline points={puntos(datos.rsiPts)} fill="none" stroke="#5b8def" strokeWidth="1.6" />
          {datos.rsiLabels.map((r, i) => (
            <text key={i} x={CHART_X1 + 8} y={r.y + 4} fill="#8a93ab" fontSize="10" fontFamily="'IBM Plex Mono', monospace">
              {r.v}
            </text>
          ))}

          {/* eje de tiempo */}
          {datos.timeLabels.map((t, i) => (
            <text key={i} x={t.x} y="472" fill="#8a93ab" fontSize="10.5" textAnchor="middle" fontFamily="'IBM Plex Mono', monospace">
              {t.t}
            </text>
          ))}
        </svg>
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

      <div style={{ position: 'relative', padding: '10px 28px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', flex: 1, justifyContent: 'flex-end' }}>
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
        <p style={{ margin: 0, fontSize: 14.5, color: '#aab2c5' }}>Señales de alta precisión.</p>
        <button className="btn btn-primary" style={{ marginTop: 8, minHeight: 52, fontSize: 16, width: '100%', maxWidth: 320 }} onClick={onEntrar}>
          Entrar
        </button>
        <p style={{ margin: 0, fontSize: 12.5, color: '#6b7488' }}>Inicia sesión para continuar</p>
      </div>
    </div>
  )
}
