import { useState } from 'react'
import { useT } from '../lib/i18n'
import TarjetaPlegable from './TarjetaPlegable'
import { NOTICIA_MIN, CORREL_UMBRAL, SPREAD_FACTOR, TIPOS, tiposEncendidos } from '../lib/avisosInteligentes'

// AVISOS INTELIGENTES — los interruptores. Las reglas de cuándo suena cada uno
// están en `avisosInteligentes.js` (GEMELO, el mismo que usa el programa que
// manda los avisos), y los números del texto se LEEN de ahí: escritos a mano
// envejecerían solos el día que alguien moviera un umbral.
//
// ⚠️ EL AVISO DE QUE NO SON SEÑALES VA ANTES DE LOS INTERRUPTORES, como en el
// resto de la pestaña.
// ⚠️ ARRANCAN APAGADOS: nadie recibe algo que no encendió.
// ⚠️ Sin lista de pares no hay «tus pares»: se dice en vez de dejar un
// interruptor encendido que nunca va a sonar.

const TEXTO = { margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }

export default function AvisosInteligentes({ perfil, seguimiento, onElegir }) {
  const t = useT()
  const encendidos = tiposEncendidos(perfil)
  const [ocupado, setOcupado] = useState(false)
  const sinLista = !Array.isArray(seguimiento) || seguimiento.length === 0

  const alternar = async (tipo) => {
    setOcupado(true)
    await onElegir(encendidos.includes(tipo) ? encendidos.filter((x) => x !== tipo) : [...encendidos, tipo])
    setOcupado(false)
  }

  const params = { min: NOTICIA_MIN, r: CORREL_UMBRAL, x: SPREAD_FACTOR }

  return (
    <TarjetaPlegable
      titulo={t('intel.titulo')}
      desc={t('intel.desc')}
      paraQue={t('intel.paraQue')}
      avance={encendidos.length ? t('intel.encendidos', { n: encendidos.length }) : null}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t('intel.aviso')}</p>
        {sinLista && <p style={{ ...TEXTO, color: 'var(--amber)' }}>{t('intel.sinLista')}</p>}
        {TIPOS.map((tipo) => {
          const on = encendidos.includes(tipo)
          return (
            <label key={tipo} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={on} disabled={ocupado} onChange={() => alternar(tipo)} style={{ marginTop: 3 }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t(`intel.${tipo}Titulo`)}</span>
                <span style={TEXTO}>{t(`intel.${tipo}Desc`, params)}</span>
              </span>
            </label>
          )
        })}
        <p style={{ ...TEXTO, color: 'var(--text-muted)', fontSize: 11.5 }}>{t('intel.pie')}</p>
      </div>
    </TarjetaPlegable>
  )
}
