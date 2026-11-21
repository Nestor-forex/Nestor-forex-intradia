// La página web del curso (2026-11-18). Lo pidió Néstor: en la web da una
// sensación más académica y se lee mejor en computador; en las apps es la
// ventaja de tenerlo siempre a mano.
//
// ⚠️ SIN SUSCRIPCIÓN ACTIVA SOLO SE VE LA VISTA PREVIA: el temario (títulos),
// unas pocas imágenes y la invitación a entrar. Las lecciones solo se pintan
// con la ficha en `aprobado` (o el administrador).
//
// ⚠️ Esto es una PUERTA, no una caja fuerte: mientras los repositorios sean
// públicos, el texto de las lecciones se puede leer en GitHub. Está escrito en
// CLAUDE.md para que nadie lo venda como contenido protegido.

import { useState } from 'react'
import Auth from '../components/Auth'
import Curso from '../components/Curso'
import SelectorIdioma from '../components/SelectorIdioma'
import { useT } from '../lib/i18n'
import { useAuthUser } from '../lib/useAuthUser'
import { firebaseListo } from '../lib/firebase'
import { MODULOS, PROXIMOS } from '../lib/curso'
import { PRECIO_SEGUIMIENTO_USD } from '../lib/laboratorio'
import { NOMBRE_APP } from '../lib/identidad'

const BASE = import.meta.env.BASE_URL
// Capturas reales de lecciones, en `public/curso/`. Son la vista previa: se
// enseñan a propósito, el resto no.
const VISTAS = Object.freeze(['vista-1.png', 'vista-2.png', 'vista-3.png'])
const ES = { dir: 'ltr', lang: 'es' }
const ANCHO = { maxWidth: 1120, margin: '0 auto', padding: '24px 20px 64px', width: '100%', boxSizing: 'border-box' }

function Cabecera({ t, onSalir }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div className="eyebrow" style={{ fontSize: 11 }}>{t('cursoWeb.eyebrow')}</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 700 }}>{t('cursoWeb.titulo')}</h1>
        {/* Cada app tiene su página del curso con SUS videos (2026-11-21): el
            nombre dice cuál es. Es un nombre propio y no se traduce. */}
        <div dir="ltr" style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: 'var(--cta)' }}>{NOMBRE_APP}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <a className="btn-ghost" href={BASE} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>{t('cursoWeb.abrirApp')}</a>
        {onSalir && <button type="button" className="btn-ghost" onClick={onSalir}>{t('comun.salir')}</button>}
        <SelectorIdioma compacto />
      </div>
    </header>
  )
}

// Lo que la suscripción trae además del curso (2026-11-19). Lo pidió Néstor:
// que los suscriptores se enteren de que tienen ese beneficio. Usa los MISMOS
// textos que el laboratorio de las apps, para que la web y la app no digan
// cosas distintas, y el precio se lee de la misma constante.
function Beneficios({ t }) {
  const P = { margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>{t('cursoWeb.beneficios')}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, borderColor: 'var(--cta)', borderWidth: 2 }}>
          <strong style={{ fontSize: 16 }}>🧪 {t('lab.titulo')}</strong>
          <p style={P}>{t('lab.paraQue')}</p>
          <strong style={{ fontSize: 15 }}>💡 {t('lab.beneficioTitulo')}</strong>
          <p style={P}>{t('lab.beneficio')}</p>
          <p style={{ ...P, fontWeight: 600 }}>🎲 {t('lab.azar')}</p>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, borderColor: 'var(--cta)', borderWidth: 2 }}>
          <strong style={{ fontSize: 16 }}>📈 {t('lab.adelanteTitulo')}</strong>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cta)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{t('lab.adelanteServicio', { precio: PRECIO_SEGUIMIENTO_USD })}</span>
          <p style={P}>{t('lab.adelanteQue')}</p>
          <p style={P}>{t('lab.adelantePara')}</p>
          <p style={P}>{t('lab.adelantePros')}</p>
          <p style={{ ...P, color: 'var(--amber)' }}>{t('lab.adelanteNo')}</p>
        </div>
      </div>
    </section>
  )
}

function VistaPrevia({ t, estado, auth }) {
  const temario = [...MODULOS.map((m) => ({ ...m, listo: true })), ...PROXIMOS.map((p) => ({ ...p, listo: false }))].sort((a, b) => a.n - b.n)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: 760 }}>{t('cursoWeb.intro')}</p>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{t('curso.aviso')}</p>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderColor: 'var(--cta)', maxWidth: 520 }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
          {estado === 'pendiente' ? t('cursoWeb.pendiente') : estado === 'retirado' ? t('cursoWeb.inactiva') : t('cursoWeb.bloqueado')}
        </p>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)' }}>{t('cursoWeb.enApp')}</p>
        {auth}
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('cursoWeb.vistaPrevia')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {VISTAS.map((f) => (
            <img key={f} src={`${BASE}curso/${f}`} alt="" loading="lazy" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--border)', display: 'block' }} />
          ))}
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('cursoWeb.queAprendes')}</h2>
        <ol style={{ margin: 0, paddingInlineStart: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {temario.map((m) => (
            <li key={m.id || `p${m.n}`} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4, opacity: m.listo ? 1 : 0.6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                🔒 {t('curso.modulo', { n: m.n })} · {m.listo ? <>{t('cursoWeb.lecciones')} <span className="mono" dir="ltr">{m.lecciones.length}</span></> : t('curso.proximamente')}
              </span>
              <span {...ES} style={{ fontSize: 15, fontWeight: 700 }}>{m.titulo}</span>
              {m.listo && <span {...ES} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{m.desc}</span>}
            </li>
          ))}
        </ol>
      </section>

      <Beneficios t={t} />
    </div>
  )
}

export default function CursoWeb() {
  const t = useT()
  const { authUser, cargandoAuth, perfil, perfilEstado, registrar, ingresar, salir } = useAuthUser()
  const [verEntrar, setVerEntrar] = useState(false)

  if (!firebaseListo) return <div style={ANCHO}>…</div>

  const aprobado = authUser && perfilEstado === 'aprobado'
  let contenido
  if (cargandoAuth || (authUser && perfilEstado === 'cargando')) {
    contenido = <p style={{ color: 'var(--text-muted)' }}>…</p>
  } else if (aprobado) {
    // El botón «Hazlo en la app» lleva a la app: la herramienta vive allí.
    contenido = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <Curso uid={authUser.uid} ficha={perfil} web onIr={() => window.open(BASE, '_blank', 'noopener')} />
        <Beneficios t={t} />
      </div>
    )
  } else {
    const auth = !authUser ? (
      verEntrar ? (
        <Auth nombreApp={t('cursoWeb.titulo')} onRegistrar={registrar} onIngresar={ingresar} />
      ) : (
        <div>
          <button type="button" onClick={() => setVerEntrar(true)} style={{ minHeight: 44, padding: '0 18px', borderRadius: 10, border: 'none', background: 'var(--cta)', color: 'var(--cta-tinta)', fontWeight: 700, font: 'inherit', cursor: 'pointer' }}>
            {t('cursoWeb.entrar')}
          </button>
        </div>
      )
    ) : null
    contenido = <VistaPrevia t={t} estado={authUser ? perfilEstado : null} auth={auth} />
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text)' }}>
      <div style={{ ...ANCHO, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Cabecera t={t} onSalir={authUser ? salir : null} />
        {contenido}
      </div>
    </div>
  )
}
