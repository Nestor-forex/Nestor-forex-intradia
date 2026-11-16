// «Tus insignias»: las medallas de disciplina y aprendizaje, en el Diario.
//
// ⚠️ EL AVISO VA PRIMERO: ninguna premia ganar dinero. Es lo que distingue esto
// de la gamificación de otras apps, que premia operar más y arriesgar más.
//
// ⚠️ NI VERDE NI ROJO. Una insignia conseguida va con el color de la marca de
// cada app (`--cta`): el verde y el rojo en esta app significan dinero, y una
// medalla verde se leería como «ganaste».
//
// ⚠️ EL PROGRESO VA COMO «x / y», sin palabra entre los números: «1 días» es el
// fallo de concordancia que ya salió tres veces en este repositorio.

import { useMemo } from 'react'
import { useT } from '../lib/i18n'
import { calcularInsignias, conseguidas } from '../lib/insignias'
import TarjetaPlegable from './TarjetaPlegable'

const TEXTO = { fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }

export default function Insignias({ trades, ficha }) {
  const tr = useT()
  const lista = useMemo(() => calcularInsignias(trades, ficha), [trades, ficha])
  const hechas = conseguidas(lista)

  return (
    <TarjetaPlegable
      titulo={tr('insig.titulo')}
      desc={tr('insig.desc')}
      paraQue={tr('insig.paraQue')}
      avance={
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {tr('insig.llevas')}{' '}
          <span className="mono" dir="ltr">
            {hechas} / {lista.length}
          </span>
        </span>
      }
    >
      <div>
        {/* ⚠️ PRIMERO, antes de cualquier insignia. */}
        <div style={{ ...TEXTO, marginTop: 8 }}>{tr('insig.aviso')}</div>

        <div style={{ marginTop: 10 }}>
          {lista.map((i) => (
            <div
              key={i.id}
              style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid var(--border)' }}
            >
              <span
                aria-hidden="true"
                style={{
                  flex: '0 0 auto',
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  border: `2px solid ${i.conseguida ? 'var(--cta)' : 'var(--border)'}`,
                  background: i.conseguida ? 'var(--cta)' : 'transparent',
                  color: i.conseguida ? 'var(--cta-tinta)' : 'var(--text-muted)',
                }}
              >
                {i.conseguida ? '✓' : ''}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, color: i.conseguida ? 'var(--text)' : 'var(--text-secondary)' }}>
                    {tr(`insig.${i.id}T`)}
                  </span>
                  <span className="mono" dir="ltr" style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {i.n} / {i.meta}
                  </span>
                </div>
                <div style={{ ...TEXTO, marginTop: 2 }}>{tr(`insig.${i.id}D`, { meta: i.meta })}</div>
                {i.necesitaPerfil && <div style={{ ...TEXTO, color: 'var(--amber)', marginTop: 2 }}>{tr('insig.necesitaPerfil')}</div>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {tr('insig.pie')}
        </div>
      </div>
    </TarjetaPlegable>
  )
}
