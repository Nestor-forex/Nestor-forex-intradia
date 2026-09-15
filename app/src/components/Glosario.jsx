import { useT } from '../lib/i18n'
import TarjetaPlegable from './TarjetaPlegable'

export default function Glosario() {
  const t = useT()
  const terminos = t('glosario.terminos')

  return (
    <TarjetaPlegable titulo={t('glosario.titulo')} desc={t('glosario.desc')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {terminos.map(([term, def]) => (
          <div key={term}>
            <div className="mono" dir="ltr" style={{ fontSize: 12.5, fontWeight: 700 }}>
              {term}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{def}</div>
          </div>
        ))}
      </div>
    </TarjetaPlegable>
  )
}
