import { useState } from 'react'

import { useIdioma } from '../lib/i18n'
import TarjetaPlegable from './TarjetaPlegable'
import { useEstacionalidad } from '../lib/useEstacionalidad'
import { PAIR_NAMES } from '../lib/pairs'
import { HORAS, DIAS_HABILES, MESES, casillaFloja, margenLegible } from '../lib/estacionalidad'

// CUÁNTO SE MUEVE EL PAR SEGÚN EL CALENDARIO.
//
// ⚠️⚠️ LA TARJETA TIENE DOS MITADES Y EL ORDEN NO ES ESTÉTICO.
//
// Arriba lo que SÍ se puede leer: el recorrido por día de la semana y por mes,
// que salen de ~1.000 y ~300 observaciones. Abajo, separada y con su propio
// aviso delante, la tabla de DIRECCIÓN por mes: la que venden los demás, que
// sale de ~14 observaciones y lleva ±26.
//
// Dos avisos, cada uno donde le toca. El de arriba previene de leer el
// recorrido como una dirección; el de abajo, de apoyarse en un número que no
// aguanta su propio margen. Juntarlos en uno dejaría el segundo lejos de la
// tabla que describe.
//
// ⚠️ NADA SE PINTA DE VERDE NI DE ROJO. Que un mes se mueva más no es bueno ni
// malo: depende de hacia dónde vaya a operar quien mira. Misma decisión que en
// `Correlacion.jsx`, `Tasas.jsx` y la columna de actividad — antes de pintar
// algo de color, preguntarse qué afirma ese color.
//
// ⚠️ Y EL ± VA PEGADO A CADA CASILLA, calculado del n de ESA casilla. Es la
// pieza central, igual que en `Diagnostico`: un porcentaje sin su margen al
// lado es el truco más viejo del sector.
//
// PRIMO: aquí HAY perfil por hora y en Swing no, porque allí una vela ES un
// día. La matemática (`src/lib/estacionalidad.js`) sí es GEMELA.
//
// ⚠️ Y los 11 cruces salen SIN panel mensual de recorrido. No es un hueco: esta
// app pide 7 símbolos contra el dólar y deriva los cruces, y derivar un máximo
// y un mínimo en velas diarias dio un ATR 400 % mayor del real (2026-08-09).
// La dirección por mes sí sale en los 18, porque solo usa cierres.
export default function Estacionalidad() {
  const { t, locale } = useIdioma()
  const datos = useEstacionalidad()
  const [par, setPar] = useState(PAIR_NAMES[0])

  // Sin archivo no se pinta nada. Ver `useEstacionalidad`.
  if (!datos?.pares) return null
  const pares = PAIR_NAMES.filter((p) => datos.pares[p])
  if (!pares.length) return null

  const elegido = datos.pares[par] ? par : pares[0]
  const p = datos.pares[elegido]

  return (
    <TarjetaPlegable
      titulo={t('estac.titulo')}
      desc={t('estac.desc')}
      paraQue={t('estac.paraQue')}
    >
      {/* El aviso de la mitad usable: mide cuánto, no hacia dónde. */}
      <p style={{ ...TEXTO, margin: 0, color: 'var(--amber)' }}>{t('estac.aviso')}</p>

      <Selector pares={pares} valor={elegido} onChange={setPar} t={t} />

      {p.hora && (
        <Panel
          titulo={t('estac.porHora')}
          pieClave="estac.pieHora"
          casillas={horasEnLocal(locale).map(({ utc, etiqueta }) => ({
            clave: utc,
            etiqueta,
            c: p.hora[utc],
          }))}
          t={t}
          locale={locale}
        />
      )}

      {p.dia && (
        <Panel
          titulo={t('estac.porDia')}
          pieClave="estac.pieDia"
          casillas={DIAS_HABILES.map((d) => ({ clave: d, etiqueta: nombreDia(locale, d), c: p.dia[d] }))}
          t={t}
          locale={locale}
        />
      )}

      {p.mes && (
        <Panel
          titulo={t('estac.porMes')}
          pieClave="estac.pieMes"
          casillas={MESES.map((m) => ({ clave: m, etiqueta: nombreMes(locale, m), c: p.mes[m] }))}
          t={t}
          locale={locale}
        />
      )}

      {p.mesDir && <Direccion dir={p.mesDir} t={t} locale={locale} />}

      {/* ⚠️ LOS DOS TRAMOS VAN APARTE y no se resumen en uno. El perfil por
          hora cubre ~7 meses de velas H1 y el mensual ~14 años de velas
          diarias: poner «desde 2012» encima del perfil por hora sería falso, y
          un rótulo que describe otra cosa cuenta como error de medición en este
          proyecto. */}
      <p style={{ ...TEXTO, margin: 0, color: 'var(--text-muted)' }}>
        {datos.h1 &&
          t('estac.tramo', {
            desde: String(datos.h1.desde).slice(0, 10),
            hasta: String(datos.h1.hasta).slice(0, 10),
            n: fmt(locale, datos.h1.barras),
          })}
      </p>
      <p style={{ ...TEXTO, margin: 0, color: 'var(--text-muted)' }}>
        {datos.diario &&
          t('estac.tramo', {
            desde: String(datos.diario.desde).slice(0, 10),
            hasta: String(datos.diario.hasta).slice(0, 10),
            n: fmt(locale, datos.diario.sesiones),
          })}
      </p>
    </TarjetaPlegable>
  )
}

// ⚠️ Los números dentro de frases traducidas se formatean con el locale, y los
// de las columnas de datos NO. Es la regla que ya mordió cinco veces en este
// repositorio: en árabe `toLocaleString` saca cifras árabo-índicas, así que un
// número a pelo al lado de una fecha localizada deja dos sistemas de dígitos en
// el mismo renglón (el fallo del COT del 2026-09-29). En una columna `mono` con
// `dir="ltr"` lo correcto es lo contrario.
const fmt = (locale, n) => new Intl.NumberFormat(locale).format(n)

// 📌 LOS NOMBRES DE LOS DÍAS Y LOS MESES NO VAN AL DICCIONARIO, y no es pereza:
// se los pide al idioma con `Intl`. Serían 17 claves × 13 idiomas = 221
// traducciones para algo que el navegador ya sabe decir mejor que nosotros, y
// que además respeta las mayúsculas y las abreviaturas de cada lengua.
//
// Es la decisión contraria a la de los términos de trading (RSI, ATR, BUY), que
// SÍ van invariantes a propósito: aquellos son jerga y éstos son idioma.
//
// La fecha base es un domingo (2026-11-01), así que sumarle el número del día
// de la semana cae justo en ese día.
const DOMINGO_BASE = Date.UTC(2026, 10, 1)
const nombreDia = (locale, dow) =>
  new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(DOMINGO_BASE + dow * 86400000),
  )
// ⚠️ LAS HORAS SE AGRUPAN EN UTC Y SE ENSEÑAN EN LA HORA DE QUIEN MIRA, y el
// panel se ORDENA por la hora local: el mecanismo de la estacionalidad por
// horas son los solapes de sesión, que están fijos en UTC, pero al suscriptor
// de Bogotá le sirve verlo en su reloj. Agrupar en local habría puesto el
// solape de Londres-Nueva York en una casilla distinta para cada país, cuando
// es el mismo fenómeno.
//
// 📌 El desplazamiento se calcula con la fecha de HOY, así que en los países con
// cambio de hora la etiqueta sigue al horario vigente — que es el que el lector
// tiene en su reloj ahora mismo.
//
// La hora NO lleva `dir="ltr"`: la arma `toLocaleTimeString`, que en árabe saca
// «١٠ م» con sus cifras y su marcador. Forzarle `ltr` sería enmendarle la plana
// al formateador — la lección del calendario del 2026-09-08.
function horasEnLocal(locale) {
  const hoy = new Date()
  const fmtHora = new Intl.DateTimeFormat(locale, { hour: 'numeric' })
  return HORAS.map((utc) => {
    const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate(), utc))
    return { utc, local: d.getHours(), etiqueta: fmtHora.format(d) }
  }).sort((a, b) => a.local - b.local)
}

const nombreMes = (locale, mes) =>
  new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, mes, 15)),
  )

function Selector({ pares, valor, onChange, t }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{t('estac.par')}</span>
      <select
        id="estac-par"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="mono"
        dir="ltr"
        style={{
          fontSize: 12.5,
          padding: '3px 6px',
          borderRadius: 3,
          background: 'var(--bg-input)',
          color: 'var(--text-primary)',
          border: '1px solid rgba(255,255,255,.15)',
        }}
      >
        {pares.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * Un panel de recorrido: barras proporcionales al mayor de ESTE panel.
 *
 * ⚠️ La escala es relativa al panel, no absoluta, y a propósito: lo que se
 * compara aquí es un día contra otro día del mismo par. Una escala fija
 * dejaría todas las barras cortas en los pares tranquilos y no diría nada —
 * la decisión contraria a la del COT, donde la escala SÍ es fija porque lo que
 * se compara es contra el posicionamiento histórico y no contra los vecinos.
 */
function Panel({ titulo, pieClave, casillas, t, locale }) {
  const max = Math.max(...casillas.map(({ c }) => (Number.isFinite(c?.medio) ? c.medio : 0)), 0)

  // ⚠️ EL PIE LEE EL n REAL, no lo lleva escrito a mano. La primera versión
  // decía «cada día sale de unas 1.000 velas» y en producción son ~700: 5.000
  // velas de calendario quedan en ~3.570 sesiones al quitar los fines de
  // semana, repartidas entre cinco días. Salió MIRANDO LA CAPTURA, que es lo
  // único que lo veía — ni el build, ni el lint, ni las 86 comprobaciones.
  //
  // Es la familia de siempre en este repositorio: un número bien calculado que
  // describe otra cosa de la que dice describir, y el arreglo es el mismo que
  // con las etiquetas «(hoy)» del banco de pruebas y con `medicion.queSignifica`
  // — que el texto LEA el número en vez de repetirlo.
  const ns = casillas.map(({ c }) => c?.n).filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b)
  const tipico = ns.length ? ns[Math.floor(ns.length / 2)] : 0

  return (
    <div style={BLOQUE}>
      <div style={{ fontSize: 12, fontWeight: 600 }}>{titulo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {casillas.map(({ clave, etiqueta, c }) => (
          <Fila key={clave} etiqueta={etiqueta} c={c} max={max} t={t} locale={locale} />
        ))}
      </div>
      <p style={{ ...TEXTO, margin: 0, color: 'var(--text-muted)' }}>
        {t(pieClave, { n: fmt(locale, tipico) })}
      </p>
    </div>
  )
}

function Fila({ etiqueta, c, max, t, locale }) {
  const hay = Number.isFinite(c?.medio)
  const floja = casillaFloja(c)
  const ancho = hay && max > 0 ? Math.max(2, Math.round((c.medio / max) * 100)) : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* La etiqueta es idioma (lunes, enero): NO lleva `ltr`. */}
      <span style={{ fontSize: 11.5, width: 74, flexShrink: 0, color: 'var(--text-secondary)' }}>
        {etiqueta}
      </span>

      {/* El riel entero se ve siempre. Sin él solo se vería la parte llena, y
          una barra sin referencia no dice nada — la lección de la barrita de
          actividad del 2026-09-09. */}
      <div style={{ width: 54, height: 7, flexShrink: 0, borderRadius: 2, background: 'var(--bg-input)', overflow: 'hidden' }}>
        <div
          style={{
            width: `${ancho}%`,
            height: '100%',
            // Color NEUTRO. Ver el aviso de la cabecera.
            background: 'var(--text-secondary)',
            opacity: floja ? 0.35 : 0.8,
          }}
        />
      </div>

      {/* Dato puro: `mono` y `ltr` fijo. */}
      <span className="mono" dir="ltr" style={{ fontSize: 12, fontWeight: 600, minWidth: 0 }}>
        {hay ? `${c.medio.toFixed(2)}%` : '—'}
      </span>
      {hay && Number.isFinite(c.margen95) && (
        <span className="mono" dir="ltr" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
          ±{margenLegible(c.margen95)}
        </span>
      )}

      {/* Una casilla floja se MARCA, no se esconde. */}
      {floja && (
        <span style={{ fontSize: 10, color: 'var(--amber)' }}>
          {t('estac.pocosDatos', { n: fmt(locale, c?.n ?? 0) })}
        </span>
      )}
    </div>
  )
}

/**
 * La mitad DÉBIL, separada y con su aviso delante.
 *
 * ⚠️ El porcentaje y su margen van en el MISMO renglón y al mismo tamaño.
 * Separarlos —o poner el margen en letra pequeña debajo— sería volver al truco
 * que esta tarjeta existe para no hacer.
 */
function Direccion({ dir, t, locale }) {
  return (
    <div style={{ ...BLOQUE, borderTop: '1px solid var(--amber)' }}>
      <div style={{ fontSize: 12, fontWeight: 600 }}>{t('estac.direccion')}</div>
      {/* ⚠️ ANTES de la tabla, no después. */}
      <p style={{ ...TEXTO, margin: 0, color: 'var(--amber)' }}>{t('estac.avisoDireccion')}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {MESES.map((m) => {
          const c = dir[m]
          const hay = Number.isFinite(c?.pct)
          return (
            <div key={m} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 11.5, width: 74, flexShrink: 0, color: 'var(--text-secondary)' }}>
                {nombreMes(locale, m)}
              </span>
              <span className="mono" dir="ltr" style={{ fontSize: 12, fontWeight: 600 }}>
                {hay ? `${c.pct}%` : '—'}
              </span>
              {hay && Number.isFinite(c.margen) && (
                <span className="mono" dir="ltr" style={{ fontSize: 12, color: 'var(--amber)' }}>
                  ±{c.margen}
                </span>
              )}
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                {t('estac.deMeses', { verdes: fmt(locale, c?.verdes ?? 0), n: fmt(locale, c?.n ?? 0) })}
              </span>
            </div>
          )
        })}
      </div>

      <p style={{ ...TEXTO, margin: 0, color: 'var(--text-muted)' }}>{t('estac.pieDireccion')}</p>
    </div>
  )
}

const BLOQUE = {
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  paddingTop: 12,
  borderTop: '1px solid rgba(255,255,255,.10)',
}

const TEXTO = { fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-secondary)' }
