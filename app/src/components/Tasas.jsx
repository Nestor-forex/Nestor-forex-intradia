import { useState } from 'react'
import { useT } from '../lib/i18n'
import { PAIR_NAMES, monedasDe } from '../lib/pairs'
import { diasDelDatoMasViejo, difsPorPar, tasasOrdenadas } from '../lib/tasas'
import { useTasas } from '../lib/useTasas'

// LO QUE CUESTA MANTENER LA OPERACIÓN ABIERTA (o lo que se cobra por ella).
//
// La tarjeta de arriba, «Lo que cuesta abrir la operación», enseña el spread:
// lo que se paga UNA VEZ, al entrar. Ésta enseña de dónde sale lo que se paga
// (o se cobra) CADA NOCHE que la operación siga abierta. Van juntas a
// propósito: son las dos mitades del peaje.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️⚠️ LA DECISIÓN QUE NO HAY QUE ABLANDAR NUNCA
// ─────────────────────────────────────────────────────────────────────────
// **ESTO NO ES EL SWAP, Y LA PANTALLA LO DICE ANTES DE ENSEÑAR NINGÚN NÚMERO.**
//
// El banco central pone la tasa de referencia; el bróker le suma un margen que
// NO PUBLICA NADIE y que además es asimétrico. Así que esto da el signo y el
// orden de magnitud, no la cifra que aparecerá en la cuenta.
//
// El aviso va ARRIBA, antes de la tabla, por la misma razón por la que en la
// columna de actividad el «no dice hacia dónde» va antes que lo del volumen:
// **lo primero que se lee es lo que se recuerda**, así que lo primero que se
// dice tiene que ser lo que más caro sale ignorar. Aquí lo caro es creer que
// la diferencia de tasas es lo que el bróker va a cobrar.
//
// ⚠️ Y NADA SE PINTA DE VERDE NI DE ROJO. Que la diferencia favorezca a la
// compra no es «bueno»: depende de hacia dónde vaya a operar quien mira. El
// color afirmaría algo que el dato no dice. Es la misma decisión que en
// `Correlacion.jsx` y la regla general de este proyecto — antes de pintar algo
// de color, preguntarse qué afirma ese color.
//
// Va plegada por defecto, como el glosario y la correlación: es contexto, no
// lo primero que se viene a mirar.

const P = { margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }
const PIE = { margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }

// Con signo explícito y una cifra decimal. `−` es el signo menos de verdad
// (U+2212), no un guion: en la tipografía de la app tiene el mismo ancho que
// el `+` y la columna no baila.
const conSigno = (n) => (n > 0 ? '+' : '−') + Math.abs(n).toFixed(2)

export default function Tasas() {
  const t = useT()
  const [abierto, setAbierto] = useState(false)
  const datos = useTasas()

  // Sin datos no se pinta NADA — ni título ni «no hay nada». Mismo criterio
  // que la correlación y el calendario: una tarjeta vacía hace pensar que la
  // app está rota.
  const tasas = datos?.tasas
  if (!tasas || !Object.keys(tasas).length) return null

  const filas = difsPorPar(tasas, PAIR_NAMES, monedasDe)
  const sueltas = tasasOrdenadas(tasas)
  const dias = diasDelDatoMasViejo(tasas)

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setAbierto((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          background: 'none',
          border: 'none',
          color: 'var(--text)',
          cursor: 'pointer',
          fontSize: 13.5,
          fontWeight: 600,
          minHeight: 44,
          textAlign: 'left',
        }}
      >
        <span>{t('tasas.titulo')}</span>
        <span style={{ color: 'var(--text-muted)' }}>{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ⚠️ EL AVISO VA PRIMERO. Ver la cabecera del archivo: no es
              maquetación, es la única forma de que se lea. */}
          <div
            style={{
              padding: '10px 12px',
              border: '1px solid var(--border-strong)',
              borderRadius: 6,
              fontSize: 12.5,
              lineHeight: 1.55,
              color: 'var(--text-secondary)',
            }}
          >
            {t('tasas.aviso')}
          </div>

          <p style={P}>{t('tasas.intro')}</p>

          {/* ── La diferencia por par ───────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filas.map(({ par, dif, lado }) => (
              <div
                key={par}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  paddingBottom: 8,
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  {/* `dir="ltr"` fijo: es un código, y en árabe se dibujaría
                      al revés. Es el error que ya mordió cuatro veces aquí. */}
                  <div className="mono" dir="ltr" style={{ fontSize: 12.5, fontWeight: 700 }}>
                    {par}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {t(`tasas.lado.${lado}`)}
                  </div>
                </div>
                <div
                  className="mono"
                  dir="ltr"
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                    // Neutro a propósito. Ver la cabecera del archivo.
                    color: 'var(--text-secondary)',
                  }}
                >
                  {conSigno(dif)}
                </div>
              </div>
            ))}
          </div>

          {/* ── Las ocho tasas sueltas ──────────────────────────────── */}
          <div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                marginBottom: 8,
              }}
            >
              {t('tasas.cabeceraSueltas')}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto auto 1fr',
                gap: '6px 12px',
                fontSize: 12.5,
                alignItems: 'baseline',
              }}
            >
              {sueltas.map(({ divisa, v, f }) => (
                <Suelta key={divisa} divisa={divisa} v={v} f={f} />
              ))}
            </div>
          </div>

          <p style={PIE}>{t('tasas.pie', { dias: dias ?? 0 })}</p>
        </div>
      )}
    </div>
  )
}

function Suelta({ divisa, v, f }) {
  return (
    <>
      {/* El código de divisa SÍ va en `ltr` fijo: es un código, no idioma. */}
      <span className="mono" dir="ltr" style={{ fontWeight: 700 }}>
        {divisa}
      </span>
      <span
        className="mono"
        dir="ltr"
        style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
      >
        {v.toFixed(3)} %
      </span>
      {/* ⚠️ LA FECHA DEL DATO, no la de la consulta. Una tasa de referencia
          solo cambia el día que se reúne el banco central, así que aquí es
          normal ver una fecha de hace semanas — pero sin enseñarla, ese dato
          se leería como de hoy. */}
      <span className="mono" dir="ltr" style={{ color: 'var(--text-muted)', fontSize: 11.5 }}>
        {f}
      </span>
    </>
  )
}
