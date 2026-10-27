import { useT } from '../lib/i18n'
import TarjetaPlegable from './TarjetaPlegable'
import { TOPE_BARRA_COMPRESION } from '../lib/marketCalc'

// ¿ESTÁ EL PAR APRETADO O SUELTO?
//
// ─────────────────────────────────────────────────────────────────────────
// POR QUÉ EXISTE, Y LO QUE SE ENCONTRÓ AL IR A ESCRIBIRLO
// ─────────────────────────────────────────────────────────────────────────
// Néstor pidió «patrones de gráfico (triángulos, canales, cuñas, Fibonacci)»
// el 2026-10-27. Al buscar en el repositorio antes de construir nada apareció
// que esta app **YA calculaba la compresión** desde meses atrás, la publicaba
// en `barrido.json`… y ningún componente la pintaba. Un dato real llegando a
// la nada, igual que el tick volume durante un día entero.
//
// ⚠️⚠️ Y PEOR: AQUÍ ESE NÚMERO **SÍ DECIDE SEÑALES**. `clasificarRango`
// rechaza una señal de rango cuando la compresión baja de `COMPRESION_MIN`.
// O sea que no es información: es un filtro ENCENDIDO del que no hay ningún
// resultado escrito, aunque haya una fila para medirlo en `backtest.mjs`.
// Esta tarjeta lo rotula así, porque en la app hermana la compresión NO
// decide nada y presentarlas igual afirmaría algo falso en una de las dos.
//
// ⚠️ POR QUÉ IMPORTA DE VERDAD: el stop de esta app sale del ATR
// (`1,5 × ATR`). Un par con el movimiento estrechado tiene el ATR bajo, así
// que el stop sale MÁS CORTO — y el coste de entrar, que es fijo en pips,
// pesa más sobre un stop corto. Aquí eso pesa CUATRO VECES más que en la app
// hermana, y está medido: 2 pips de spread sobre un stop de ~30 son el 7 %
// del riesgo, contra el 1,3 % de un stop de ~155.
//
// ⚠️ Y AQUÍ NO HAY FIBONACCI NI VELAS ESTRECHAS, por un motivo MEDIDO y no
// por comodidad: este barrido no publica el máximo y el mínimo de CADA vela,
// así que no se puede saber cuál de los dos extremos vino DESPUÉS, y sin eso
// los niveles de retroceso se dibujarían al revés. Publicarlos tampoco vale:
// en los 11 cruces los extremos se DERIVAN de los dos pares contra el dólar,
// y eso dio un ATR un 400 % mayor del real (2026-08-09).
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ LO QUE NO HAY QUE ABLANDAR
// ─────────────────────────────────────────────────────────────────────────
//
// 1. **NADA SE PINTA DE VERDE NI DE ROJO.** Que un par esté apretado no es
//    bueno ni malo: depende de qué se vaya a hacer con él. Misma decisión que
//    `Correlacion.jsx`, `Tasas.jsx` y la columna de actividad.
//
// 2. **EL NÚMERO VA SIEMPRE AL LADO DE LA ETIQUETA.** Los cortes son de
//    PRESENTACIÓN y no están medidos (ver `UMBRALES_COMPRESION`): si la
//    palabra fuera lo único visible, un corte a mano se leería como un hecho.
//
// 3. **NINGÚN PATRÓN CON NOMBRE.** Ni triángulo, ni cuña, ni canal. El
//    NFX-LSS ES reconocimiento de patrones y midió −0,14 en H1 y −0,16 en
//    M15, y su barrido de liquidez marcó las señales PEORES.
//
// PRIMO: allá hay Fibonacci y velas estrechas porque su barrido publica los
// extremos de cada vela; aquí no. Y allá la compresión no decide nada.
export default function Compresion({ pares = [] }) {
  const t = useT()

  // Sin pares no se pinta nada. Pasa con un barrido viejo, de antes de que el
  // vigía publicara el campo: una tarjeta vacía se leería como un olvido.
  if (!pares.length) return null

  return (
    <TarjetaPlegable
      titulo={t('compr.titulo', { n: pares.length })}
      desc={t('compr.desc')}
      paraQue={t('compr.paraQue')}
    >
      {/* ⚠️ EL AVISO VA ANTES DE CUALQUIER NÚMERO. Aquí lo caro es leer «muy
          apretado» como «va a estallar hacia arriba»: la compresión no tiene
          dirección ninguna. Mismo criterio que las tasas, el COT y la
          actividad — lo primero que se lee es lo que se recuerda. */}
      <p style={{ ...TEXTO, margin: 0, color: 'var(--amber)' }}>{t('compr.aviso')}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 11 }}>
        {pares.map((p) => (
          <Fila key={p.name} p={p} t={t} />
        ))}
      </div>

      <p style={{ ...TEXTO, margin: '11px 0 0', color: 'var(--text-muted)' }}>{t('compr.pie')}</p>
    </TarjetaPlegable>
  )
}

function Fila({ p, t }) {
  const apretado = p.nivel === 'muy' || p.nivel === 'algo'

  return (
    <div
      style={{
        padding: '9px 11px',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--bg-card)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        {/* ⚠️ `ltr` fijo en el código del par: es jerga invariante y en árabe
            se dibujaría al revés. La regla de siempre — se fija la dirección
            solo de lo que NO es idioma. */}
        <span className="mono" dir="ltr" style={{ fontWeight: 600, fontSize: 13 }}>
          {p.name}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t(`compr.nivel.${p.nivel}`)}</span>
        {/* El número, SIEMPRE. Ver la regla 2 de la cabecera. */}
        <span className="mono" dir="ltr" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          ×{p.compresion.toFixed(2)}
        </span>
      </div>

      <Barra valor={p.compresion} />

      <div style={{ ...TEXTO, color: 'var(--text-secondary)' }}>
        {t('compr.recorrido', { atr: p.atrPips.toFixed(0) })}
        {Number.isFinite(p.posicion) && ` · ${t('compr.posicion', { pct: Math.round(p.posicion * 100) })}`}
      </div>

      {/* El aviso del stop. Sale solo cuando el par está apretado, porque es
          cuando dice algo: si saliera siempre, dejaría de leerse justo el día
          que importa. Mismo criterio que `RiesgoSenales`. */}
      {apretado && (
        <p style={{ ...TEXTO, margin: 0, color: 'var(--amber)' }}>
          {t('compr.avisoStop')}
          {/* ⚠️ Y SOLO AQUÍ: si el par está en modo rango, este número es el
              que puede haber apagado su señal. Decirlo es la diferencia entre
              informar y presentar un filtro como información. */}
          {p.enRango ? ' ' + t('compr.avisoFiltro') : ''}
        </p>
      )}

    </div>
  )
}

// La barra. ESCALA FIJA y no «el mayor de hoy»: con escala relativa, un día en
// que todos los pares estuvieran normales seguiría enseñando una barra llena.
// Es la misma decisión que en `Cot.jsx` y la contraria a la columna de
// actividad, donde lo que se compara son los pares entre sí.
//
// La marca del 1 (el movimiento normal) SOBRESALE del riel: sin una referencia
// visible, una barra no dice nada — la lección de la barrita de actividad y de
// la marca del cero del COT.
function Barra({ valor }) {
  const frac = Math.max(0, Math.min(1, valor / TOPE_BARRA_COMPRESION))
  const uno = 1 / TOPE_BARRA_COMPRESION
  return (
    <div dir="ltr" style={{ position: 'relative', height: 8, width: '100%' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--bg-input)',
          borderRadius: 4,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${frac * 100}%`,
          // Neutro a propósito: ver la regla 1.
          background: 'var(--text-muted)',
          borderRadius: 4,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${uno * 100}%`,
          top: -2,
          bottom: -2,
          width: 2,
          marginLeft: -1,
          background: 'var(--text-secondary)',
        }}
      />
    </div>
  )
}

const TEXTO = { fontSize: 12, lineHeight: 1.45 }
