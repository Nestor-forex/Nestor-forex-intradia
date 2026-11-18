// El curso, dentro de la app (punto 8 del plan, 2026-11-18).
//
// Tres pantallas: la lista de módulos, las lecciones de un módulo y una
// lección. Cada lección tiene siempre las mismas partes y en el mismo orden;
// «Lo que esto NO te dice» va siempre.
//
// ⚠️ EL AVISO DE QUE NO ES ASESORÍA VA ANTES DE TODO.
// ⚠️ LAS PREGUNTAS NO TIENEN NOTA: se contestan para comprobar que se entendió,
// y al contestar se ve por qué. La respuesta no va en verde ni en rojo, que en
// esta app significan dinero.
// ⚠️ EL CONTENIDO ESTÁ SOLO EN ESPAÑOL POR AHORA, y en los otros idiomas se dice.

import { useState } from 'react'
import { useIdioma } from '../lib/i18n'
import { LECCIONES, MODULOS, PROXIMOS, moduloDe, progresoModulo, siguiente, texto, TODAS } from '../lib/curso'
import { useCurso } from '../lib/useCurso'

// ⚠️ El contenido está en español aunque la app esté en árabe: va siempre de
// izquierda a derecha y marcado como español, o los puntos saltan al principio
// de la línea. Los rótulos traducidos sí siguen el idioma.
const ES = { dir: 'ltr', lang: 'es' }

const TEXTO = { margin: 0, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }
const TITULO_PARTE = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }

function Parte({ titulo, children, borde }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8, ...(borde ? { borderInlineStart: `3px solid ${borde}`, paddingInlineStart: 10 } : null) }}>
      <div style={TITULO_PARTE}>{titulo}</div>
      {children}
    </section>
  )
}

function Parrafos({ lista }) {
  return (lista || []).map((p, i) => (
    <p key={i} style={TEXTO}>
      {p}
    </p>
  ))
}

function Pregunta({ q, t }) {
  const [elegida, setElegida] = useState(null)
  const ok = elegida === q.correcta
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p style={{ ...TEXTO, color: 'var(--text)', fontWeight: 600 }}>{q.p}</p>
      {q.opciones.map((o, i) => {
        const marcada = elegida === i
        return (
          <button
            key={i}
            type="button"
            onClick={() => setElegida(i)}
            aria-pressed={marcada}
            style={{
              textAlign: 'start',
              minHeight: 40,
              padding: '8px 12px',
              borderRadius: 10,
              border: `1px solid ${marcada ? 'var(--cta)' : 'var(--border-strong)'}`,
              background: marcada ? 'var(--bg-input)' : 'none',
              color: 'var(--text)',
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 13.5,
            }}
          >
            {o}
          </button>
        )
      })}
      {elegida !== null && (
        <p style={{ ...TEXTO, fontSize: 12.5, color: ok ? 'var(--cta)' : 'var(--amber)' }}>
          <strong>{ok ? t('curso.correcto') : t('curso.incorrecto')}</strong> {q.porque}
        </p>
      )}
    </div>
  )
}

function Leccion({ id, hecha, onTerminar, onSiguiente, onIr, t }) {
  const l = LECCIONES[id]
  const [estado, setEstado] = useState(null)
  const sig = siguiente(id)
  const terminar = async () => {
    setEstado('guardando')
    const r = await onTerminar(id)
    setEstado(r?.ok ? null : r?.codigo === 'sinPermiso' ? 'sinPermiso' : 'error')
  }
  return (
    <article {...ES} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{l.titulo}</h2>
      <Parte titulo={t('curso.objetivo')} borde="var(--cta)">
        <p style={{ ...TEXTO, color: 'var(--text)' }}>{texto(l.objetivo)}</p>
      </Parte>
      <Parte titulo={t('curso.explicacion')}>
        <Parrafos lista={l.explicacion} />
      </Parte>
      <Parte titulo={t('curso.ejemplo')}>
        <Parrafos lista={l.ejemplo} />
      </Parte>
      {l.formula && (
        <Parte titulo={t('curso.formula')}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="mono" dir="ltr" style={{ fontSize: 13.5, color: 'var(--text)' }}>
              {l.formula.texto}
            </div>
            <div className="mono" dir="ltr" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {l.formula.conNumeros}
            </div>
          </div>
        </Parte>
      )}
      <Parte titulo={t('curso.noDice')} borde="var(--amber)">
        <Parrafos lista={l.noDice} />
      </Parte>
      <Parte titulo={t('curso.hazlo')}>
        <p style={TEXTO}>{l.hazlo.texto}</p>
        <div>
          <button type="button" className="btn-ghost" onClick={() => onIr(l.hazlo.tab)} style={{ color: 'var(--cta)', borderColor: 'var(--cta)' }}>
            {l.hazlo.boton} →
          </button>
        </div>
      </Parte>
      <Parte titulo={t('curso.preguntas')}>
        {l.preguntas.map((q, i) => (
          <Pregunta key={`${id}-${i}`} q={q} t={t} />
        ))}
      </Parte>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        {hecha ? (
          <p style={{ ...TEXTO, color: 'var(--cta)', fontWeight: 600 }}>✓ {t('curso.terminada')}</p>
        ) : (
          <button
            type="button"
            onClick={terminar}
            disabled={estado === 'guardando'}
            style={{ minHeight: 44, borderRadius: 10, border: 'none', background: 'var(--cta)', color: 'var(--cta-tinta)', fontWeight: 700, font: 'inherit', cursor: 'pointer' }}
          >
            {estado === 'guardando' ? t('curso.guardando') : t('curso.marcar')}
          </button>
        )}
        {(estado === 'sinPermiso' || estado === 'error') && (
          <p style={{ ...TEXTO, fontSize: 12.5, color: 'var(--amber)' }}>{t(estado === 'sinPermiso' ? 'curso.sinPermiso' : 'curso.error')}</p>
        )}
        {sig && (
          <button type="button" className="btn-ghost" onClick={() => onSiguiente(sig)}>
            {t('curso.siguiente')} → {LECCIONES[sig].titulo}
          </button>
        )}
      </div>
    </article>
  )
}

export default function Curso({ uid, ficha, onIr }) {
  const { t, idioma } = useIdioma()
  const curso = useCurso(uid, ficha)
  const [moduloId, setModuloId] = useState(null)
  const [leccionId, setLeccionId] = useState(null)

  const modulo = moduloId ? MODULOS.find((m) => m.id === moduloId) : null
  const volver = () => {
    if (leccionId) setLeccionId(null)
    else setModuloId(null)
  }
  const abrirLeccion = (id) => {
    setModuloId(moduloDe(id)?.id || null)
    setLeccionId(id)
    window.scrollTo?.(0, 0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {(modulo || leccionId) && (
          <button type="button" className="btn-ghost" onClick={volver}>
            ← {t('curso.volver')}
          </button>
        )}
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('curso.titulo')}</h1>
      </div>

      {/* ⚠️ PRIMERO el aviso, antes de cualquier lección. */}
      <p style={{ ...TEXTO, fontSize: 12.5, color: 'var(--text-muted)' }}>{t('curso.aviso')}</p>
      {idioma !== 'es' && <p style={{ ...TEXTO, fontSize: 12.5, color: 'var(--amber)' }}>{t('curso.soloEspanol')}</p>}

      {leccionId ? (
        <Leccion
          key={leccionId}
          id={leccionId}
          hecha={curso.hechas.includes(leccionId)}
          onTerminar={curso.terminar}
          onSiguiente={abrirLeccion}
          onIr={onIr}
          t={t}
        />
      ) : modulo ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{t('curso.modulo', { n: modulo.n })}</div>
          <h2 {...ES} style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{modulo.titulo}</h2>
          <p {...ES} style={TEXTO}>{modulo.desc}</p>
          {modulo.lecciones.map((id, i) => {
            const hecha = curso.hechas.includes(id)
            return (
              <button key={id} type="button" onClick={() => abrirLeccion(id)} className="card" style={{ textAlign: 'start', cursor: 'pointer', color: 'var(--text)', font: 'inherit', display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="mono" style={{ color: hecha ? 'var(--cta)' : 'var(--text-muted)', minWidth: 18 }}>{hecha ? '✓' : i + 1}</span>
                <span {...ES} style={{ fontSize: 14, fontWeight: 600 }}>{LECCIONES[id].titulo}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={TEXTO}>{t('curso.desc')}</p>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            {t('curso.llevas')} <strong className="mono" dir="ltr" style={{ color: 'var(--text)' }}>{curso.hechas.length} / {TODAS.length}</strong>
          </div>
          {[...MODULOS.map((m) => ({ ...m, listo: true })), ...PROXIMOS.map((p) => ({ ...p, listo: false }))]
            .sort((a, b) => a.n - b.n)
            .map((m) =>
              m.listo ? (
                <button key={m.id} type="button" onClick={() => setModuloId(m.id)} className="card" style={{ textAlign: 'start', cursor: 'pointer', color: 'var(--text)', font: 'inherit', display: 'flex', flexDirection: 'column', gap: 4, borderColor: 'var(--cta)' }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                    <span>{t('curso.modulo', { n: m.n })}</span>
                    <span className="mono" dir="ltr">
                      {progresoModulo(curso.hechas, m).n} / {m.lecciones.length}
                    </span>
                  </span>
                  <span {...ES} style={{ fontSize: 15, fontWeight: 700 }}>{m.titulo}</span>
                  <span {...ES} style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{m.desc}</span>
                </button>
              ) : (
                <div key={`p${m.n}`} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4, opacity: 0.6 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                    <span>{t('curso.modulo', { n: m.n })}</span>
                    <span>{t('curso.proximamente')}</span>
                  </span>
                  <span {...ES} style={{ fontSize: 14, fontWeight: 600 }}>{m.titulo}</span>
                </div>
              )
            )}
        </div>
      )}
    </div>
  )
}
