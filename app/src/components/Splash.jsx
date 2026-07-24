import { useMemo } from 'react'

const W = 300
const H = 600
const BASE_Y = 520
const TOP_Y = 60

const TICKER_VALORES = ['70.111', '48.991', '31.010', '1.205', '2.87', '65,10', '20.399', '6.93', '139', '3.011', '11.20', '1.63']

const BOLSAS = [
  'NYSE',
  'NASDAQ',
  'LSE · Londres',
  'EURONEXT',
  'DAX · Fráncfort',
  'SIX · Suiza',
  'TSX · Toronto',
  'B3 · São Paulo',
  'BMV · México',
  'JPX · Tokio',
  'SSE · Shanghái',
  'HKEX · Hong Kong',
  'NSE · India',
  'KRX · Corea',
  'ASX · Sídney',
]

function generarEscena() {
  const n = 24
  const precios = []
  let p = 50
  for (let i = 0; i < n; i++) {
    const d = Math.sin(i * 2.7 + 1) * 14 + Math.sin(i * 0.9) * 8
    p = Math.max(6, Math.min(150, p + d))
    precios.push(p)
  }
  const min = Math.min(...precios)
  const max = Math.max(...precios)
  const escala = (v) => BASE_Y - ((v - min) / (max - min)) * (BASE_Y - TOP_Y - 40)

  const gap = W / n
  const velas = precios.map((precio, i) => {
    const prev = i === 0 ? precio : precios[i - 1]
    const y1 = escala(precio)
    const y2 = escala(prev)
    const yTop = Math.min(y1, y2)
    const yBot = Math.max(yTop + 8, Math.max(y1, y2))
    const cx = gap * i + gap / 2
    const mecha = Math.abs(Math.sin(i * 1.3)) * 18 + 6
    return {
      x: cx,
      yTop,
      yBot,
      wickTop: yTop - mecha * 0.4,
      wickBot: yBot + mecha * 0.5,
      up: precio >= prev,
    }
  })

  const lineaBlanca = precios.map((precio, i) => ({ x: gap * i + gap / 2, y: escala(precio) - 4 }))

  const lineaAmbar = precios.map((_, i, arr) => {
    const desde = Math.max(0, i - 3)
    const ventana = arr.slice(desde, i + 1)
    const prom = ventana.reduce((a, b) => a + b, 0) / ventana.length
    return { x: gap * i + gap / 2, y: escala(prom) - 4 }
  })

  const ticker = []
  const cols = 6
  const rows = 6
  let idx = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const jitterX = Math.sin(idx * 3.3 + 1) * 14
      const jitterY = Math.cos(idx * 2.1 + 2) * 16
      ticker.push({
        x: (c + 0.5) * (W / cols) + jitterX,
        y: (r + 0.5) * (340 / rows) + jitterY + 10,
        valor: TICKER_VALORES[idx % TICKER_VALORES.length],
      })
      idx++
    }
  }

  return { velas, lineaBlanca, lineaAmbar, ticker }
}

function puntos(pts) {
  return pts.map((p) => `${p.x},${p.y}`).join(' ')
}

export default function Splash({ nombreApp, onEntrar }) {
  const { velas, lineaBlanca, lineaAmbar, ticker } = useMemo(generarEscena, [])

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(130% 95% at 12% -5%, oklch(0.3 0.1 25 / 0.6), oklch(0.16 0.05 20 / 0.4) 42%, oklch(0.11 0.012 255) 82%)',
        }}
      />

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMax slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.82 }}
      >
        <g fontFamily="'IBM Plex Mono', monospace" fontSize="11" fill="oklch(0.78 0.06 30)" opacity="0.32">
          {ticker.map((t, i) => (
            <text key={i} x={t.x} y={t.y}>
              {t.valor}
            </text>
          ))}
        </g>

        {velas.map((v, i) => (
          <g key={i}>
            <line
              x1={v.x}
              x2={v.x}
              y1={v.wickTop}
              y2={v.wickBot}
              stroke={v.up ? 'oklch(0.62 0.11 155)' : 'oklch(0.58 0.13 25)'}
              strokeWidth="2"
            />
            <rect
              x={v.x - 4.5}
              y={v.yTop}
              width="9"
              height={Math.max(v.yBot - v.yTop, 6)}
              rx="1.5"
              fill={v.up ? 'oklch(0.62 0.11 155)' : 'oklch(0.58 0.13 25)'}
            />
          </g>
        ))}

        <polyline
          points={puntos(lineaAmbar)}
          fill="none"
          stroke="oklch(0.75 0.13 85)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
        <polyline
          points={puntos(lineaBlanca)}
          fill="none"
          stroke="oklch(0.97 0.005 255)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
        {lineaBlanca.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r="2.6" fill="oklch(0.97 0.005 255)" opacity="0.9" />
        ))}
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, oklch(0.13 0.015 255) 0%, oklch(0.13 0.015 255 / 0.35) 40%, oklch(0.13 0.015 255 / 0.92) 78%, oklch(0.13 0.015 255) 100%)',
        }}
      />

      <div
        className="mono"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '18px 24px 0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 14px',
          fontSize: 10.5,
          letterSpacing: '0.05em',
          color: 'var(--text-muted)',
        }}
      >
        {BOLSAS.map((b) => (
          <span key={b}>{b}</span>
        ))}
      </div>

      <div style={{ position: 'relative', padding: '0 28px 56px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="eyebrow">TRADING · FX · INTRADÍA</div>
        <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.05, fontWeight: 700, letterSpacing: '0.02em' }}>{nombreApp}</h1>
        <p style={{ margin: 0, fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          Barrido en vivo (velas de 1 hora), diario de operaciones y gestión de riesgo para abrir y cerrar el mismo día. Acceso
          solo para miembros autorizados.
        </p>
        <button className="btn btn-primary" style={{ marginTop: 12, minHeight: 52, fontSize: 16 }} onClick={onEntrar}>
          Entrar
        </button>
      </div>
    </div>
  )
}
