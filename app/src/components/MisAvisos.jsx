import { useEffect, useRef, useState } from 'react'
import { useT } from '../lib/i18n'
import { PAIR_NAMES } from '../lib/pairs'
import { LADOS_INDICADOR, LADOS_PRECIO, MAX_REPETICIONES } from '../lib/alertas'
import { useAvisos } from '../lib/useAvisos'

// MIS AVISOS — la pantalla donde cada persona programa lo suyo.
//
// Néstor la pidió el 2026-10-30: «quiero que la pantalla se convierta en una
// herramienta para que el usuario pueda interactuar en ella según su gusto o
// necesidades», y con dos condiciones que se cumplen: es una **pantalla
// nueva** y **no le quita nada** a lo que ya había. El interruptor de avisos
// de la pestaña Barrido sigue intacto y funcionando igual.
//
// ⚠️⚠️ ESTO NO ES UNA SEÑAL Y NO ACONSEJA NADA. Un aviso dice QUÉ PASÓ
// («EUR/USD tocó 1.1550»), nunca qué hacer. Los niveles los pone la persona;
// la app no sugiere ninguno. Es la misma línea que no cruzan el calendario
// —que no pinta la divisa de rojo— ni la tarjeta del COT.
//
// ⚠️ Y NO CAMBIA NI UNA SEÑAL de ninguna de las dos apps.

const CAJA = {
  padding: 12,
  border: '1px solid var(--border)',
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}
const TEXTO = { fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }
const ETIQUETA = { fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }

// ⚠️ `dir="ltr"` SOLO en lo que no es idioma: un código de par y un número
// sueltos. La regla lleva seis veces mordiendo en este repositorio (el
// gráfico, el clima, la correlación, el calendario, el Diario, el Historial),
// y el error contrario también: forzarle `ltr` a una frase traducida con un
// número dentro parte el número en dos.
const DATO = { fontVariantNumeric: 'tabular-nums' }

function Pastilla({ activo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 10px',
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

export default function MisAvisos({ uid, perfil }) {
  const t = useT()
  const a = useAvisos(uid, perfil)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ par: PAIR_NAMES[0], tipo: 'precio', lado: 'sube', nivel: '' })

  // ⚠️ ABRIR ESTA PANTALLA ES LO QUE PARA LOS RECORDATORIOS. Es la condición
  // que puso Néstor: el aviso se repite «si el suscriptor no ha abierto la app
  // para mirarla». Se hace una sola vez por visita —de ahí el `useRef`— porque
  // sin él cada repintado intentaría escribir otra vez en Firestore.
  const yaMarque = useRef(false)
  useEffect(() => {
    if (yaMarque.current) return
    yaMarque.current = true
    a.marcarVistos()
    // Solo al entrar: no depende de que la lista cambie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lados = form.tipo === 'precio' ? LADOS_PRECIO : LADOS_INDICADOR
  const hacer = async (promesa) => {
    const r = await promesa
    setError(r?.ok === false ? r.codigo : null)
    return r
  }

  const anadir = async () => {
    const r = await hacer(a.anadir(form, PAIR_NAMES))
    if (r?.ok) setForm({ ...form, nivel: '' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{t('misAvisos.titulo')}</div>

        {/* ⚠️ EL AVISO VA ANTES DE CUALQUIER CONTROL, no al final. Aquí lo caro
            no es leer mal un número: es creer que esto son señales de la app.
            Mismo criterio que en las tasas, el COT y la actividad. */}
        <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t('misAvisos.aviso')}</p>
        <p style={TEXTO}>{t('misAvisos.desc')}</p>
      </div>

      {/* ───────────────────────── LA LISTA DE SEGUIMIENTO ───────────────── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t('misAvisos.seguimientoTitulo')}</div>
        <p style={TEXTO}>{t('misAvisos.seguimientoDesc')}</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PAIR_NAMES.map((par) => {
            const puesto = a.seguimiento.includes(par)
            return (
              <Pastilla
                key={par}
                activo={puesto}
                onClick={() =>
                  hacer(a.seguir(puesto ? a.seguimiento.filter((p) => p !== par) : [...a.seguimiento, par]))
                }
              >
                <span className="mono" dir="ltr" style={DATO}>
                  {par}
                </span>
              </Pastilla>
            )
          })}
        </div>

        {/* ⚠️ Ninguno elegido NO es «no ver nada»: es ver TODOS. Es el estado
            de quien nunca ha entrado aquí, y si significara lo contrario la
            app aparecería vacía el primer día — indistinguible de rota. */}
        <p style={{ ...TEXTO, color: 'var(--text-muted)' }}>
          {a.seguimiento.length === 0 ? t('misAvisos.seguimientoVacio') : t('misAvisos.seguimientoPie')}
        </p>
      </div>

      {/* ───────────────────────── AÑADIR UN AVISO ───────────────────────── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t('misAvisos.nuevoTitulo')}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={ETIQUETA}>
            {t('misAvisos.campoPar')}
            <select
              value={form.par}
              onChange={(e) => setForm({ ...form, par: e.target.value })}
              style={{ width: '100%', marginTop: 4 }}
            >
              {PAIR_NAMES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label style={ETIQUETA}>
            {t('misAvisos.campoTipo')}
            <select
              value={form.tipo}
              onChange={(e) => {
                const tipo = e.target.value
                // Al cambiar de tipo cambian los lados posibles, así que el
                // lado se repone al primero del tipo nuevo. Sin esto quedaría
                // «precio / arriba», que `valida` rechaza y el usuario no
                // entendería por qué.
                setForm({ ...form, tipo, lado: tipo === 'precio' ? LADOS_PRECIO[0] : LADOS_INDICADOR[0], nivel: '' })
              }}
              style={{ width: '100%', marginTop: 4 }}
            >
              <option value="precio">{t('misAvisos.tipoPrecio')}</option>
              <option value="banda">{t('misAvisos.tipoBanda')}</option>
              <option value="rsi">{t('misAvisos.tipoRsi')}</option>
            </select>
          </label>

          <label style={ETIQUETA}>
            {t('misAvisos.campoLado')}
            <select
              value={form.lado}
              onChange={(e) => setForm({ ...form, lado: e.target.value })}
              style={{ width: '100%', marginTop: 4 }}
            >
              {lados.map((l) => (
                <option key={l} value={l}>
                  {t(`misAvisos.lado_${l}`)}
                </option>
              ))}
            </select>
          </label>

          <label style={ETIQUETA}>
            {t('misAvisos.campoNivel')}
            <input
              type="text"
              inputMode="decimal"
              value={form.nivel}
              onChange={(e) => setForm({ ...form, nivel: e.target.value })}
              placeholder={t(`misAvisos.ejemplo_${form.tipo}`)}
              style={{ width: '100%', marginTop: 4 }}
            />
          </label>

          {/* ⚠️ EL BOTÓN NO SE DESACTIVA NUNCA, y es a propósito. La primera
              versión lo apagaba cuando no se podía guardar, y en la captura
              salía gris y muerto **sin decir por qué** — quien lo viera
              pensaría que la app está rota. Al dejarlo vivo, pulsarlo
              devuelve el motivo escrito justo debajo. Un botón que no hace
              nada es peor que uno que explica qué falta. */}
          <button type="button" className="btn" onClick={anadir}>
            {t('misAvisos.anadir')}
          </button>

          {error && (
            <p style={{ ...TEXTO, color: 'var(--red)' }}>{t(`misAvisos.err_${error}`)}</p>
          )}
        </div>
      </div>

      {/* ───────────────────────── LOS QUE YA TIENE ──────────────────────── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
          {t('misAvisos.listaTitulo', { n: a.avisos.length, max: a.maxAvisos })}
        </div>

        {a.avisos.length === 0 && <p style={TEXTO}>{t('misAvisos.listaVacia')}</p>}

        {a.avisos.map((av) => {
          const sono = Boolean(av.disparadaEl)
          return (
            <div key={av.id} style={CAJA}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span className="mono" dir="ltr" style={{ ...DATO, fontSize: 13.5, fontWeight: 700 }}>
                  {av.par}
                </span>
                <span style={{ fontSize: 12.5 }}>{t(`misAvisos.frase_${av.tipo}_${av.lado}`)}</span>
                <span className="mono" dir="ltr" style={{ ...DATO, fontSize: 13.5, fontWeight: 700 }}>
                  {av.nivel}
                </span>
              </div>

              {/* El estado, en palabras. ⚠️ No se pinta de verde ni de rojo: un
                  aviso que sonó no es «bueno» ni «malo» — solo pasó. Pintar
                  dinero de color está bien; pintar esto afirmaría algo que el
                  dato no dice. */}
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {av.activa === false
                  ? t('misAvisos.estadoApagado')
                  : sono
                    ? t('misAvisos.estadoSono', { veces: Number(av.veces) || 1, max: 1 + MAX_REPETICIONES })
                    : t('misAvisos.estadoEsperando')}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Pastilla activo={av.activa !== false} onClick={() => hacer(a.encender(av.id, av.activa === false))}>
                  {av.activa === false ? t('misAvisos.encender') : t('misAvisos.apagar')}
                </Pastilla>
                {sono && <Pastilla onClick={() => hacer(a.rearmar(av.id))}>{t('misAvisos.rearmar')}</Pastilla>}
                <Pastilla onClick={() => hacer(a.borrar(av.id))}>{t('misAvisos.borrar')}</Pastilla>
              </div>
            </div>
          )
        })}

        <p style={{ ...TEXTO, color: 'var(--text-muted)' }}>{t('misAvisos.pie')}</p>
      </div>
    </div>
  )
}
