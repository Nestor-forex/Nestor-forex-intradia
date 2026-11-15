import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { APP } from '../lib/identidad'
import { useIdioma } from '../lib/i18n'
import { alternar, campoAvisosExp, clavesElegidas } from '../lib/avisosExperimento'
import { OPCIONES, defectoPara } from '../lib/experimentosAviso'

// QUÉ EXPERIMENTOS LE SUENAN A CADA MIEMBRO EN EL CELULAR (2026-11-15).
//
// Primero fue solo para el administrador. El mismo día Néstor lo abrió: «ahora
// sí quiero que la vean todos, no solo el desarrollador». Cada miembro aprobado
// enciende los suyos; el programa que manda los avisos lee la misma ficha con
// la misma cuenta (`clavesElegidas` + `defectoPara`).
//
// ⚠️ Un suscriptor que no toca nada NO recibe ninguno: su defecto es la lista
// vacía. Encenderlo tiene que ser una decisión suya, después de leer el aviso.
//
// GEMELO. Lo que cambia entre apps —qué experimentos hay— vive en
// `experimentosAviso.js`, que es PRIMO y exporta lo mismo en las dos.
//
// ⚠️ ESTO NO SON SEÑALES. La primera línea lo dice antes de cualquier
// interruptor: son experimentos que la app anota para medirlos, y encenderlos
// sirve para seguirlos en demo, no para copiarlos.
//
// ⚠️ Los interruptores NO hacen sonar nada si este aparato no tiene activados
// los avisos (la tarjeta de arriba). Se dice, porque si no, encender uno y no
// recibir nada se lee como que la app está rota.

export default function AvisosExperimentos({ uid, ficha, esAdmin = false }) {
  const { t } = useIdioma()
  const [ocupado, setOcupado] = useState(null)
  const [error, setError] = useState('')

  const elegidas = clavesElegidas(ficha, APP, OPCIONES, defectoPara(esAdmin))

  const alTocar = async (clave) => {
    if (!db || !uid) return
    setOcupado(clave)
    setError('')
    try {
      await updateDoc(doc(db, 'users', uid), { [campoAvisosExp(APP)]: alternar(elegidas, clave) })
    } catch (e) {
      setError(e?.code === 'permission-denied' ? t('avisosExp.sinPermiso') : t('avisosExp.noSeGuardo'))
    }
    setOcupado(null)
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t('avisosExp.titulo')}</div>
        <p style={{ ...TEXTO, color: 'var(--amber)', fontWeight: 600 }}>{t('avisosExp.noSonSenales')}</p>
        <p style={TEXTO}>{t('avisosExp.desc')}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {OPCIONES.map((o) => {
            const encendido = elegidas.includes(o.clave)
            return (
              <button
                key={o.clave}
                type="button"
                role="switch"
                aria-checked={encendido}
                onClick={() => alTocar(o.clave)}
                disabled={ocupado !== null}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  width: '100%',
                  minHeight: 40,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: encendido ? 'var(--bg-input)' : 'transparent',
                  color: 'var(--text)',
                  fontSize: 13,
                  textAlign: 'start',
                  cursor: 'pointer',
                }}
              >
                <span>{t(o.etiqueta)}</span>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: encendido ? 'var(--cta)' : 'transparent',
                    color: encendido ? 'var(--cta-tinta)' : 'var(--text-muted)',
                    border: encendido ? '1px solid var(--cta)' : '1px solid var(--border)',
                  }}
                >
                  {ocupado === o.clave ? '…' : encendido ? t('avisosExp.encendido') : t('avisosExp.apagado')}
                </span>
              </button>
            )
          })}
        </div>

        {error && <p style={{ ...TEXTO, color: 'var(--red)' }}>{error}</p>}
        <p style={{ ...TEXTO, fontSize: 11.5, color: 'var(--text-muted)' }}>{t('avisosExp.nota')}</p>
      </div>
    </div>
  )
}

const TEXTO = {
  margin: 0,
  fontSize: 12.5,
  color: 'var(--text-secondary)',
  lineHeight: 1.55,
}
