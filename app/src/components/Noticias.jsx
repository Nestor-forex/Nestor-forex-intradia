import { useIdioma } from '../lib/i18n'
import { useNoticias } from '../lib/useNoticias'
import TarjetaPlegable from './TarjetaPlegable'

// NOTICIAS DE LOS BANCOS CENTRALES Y DE ING (2026-11-13).
//
// Titulares tal cual los publica cada fuente, con su fecha, su enlace y su
// atribución. Solo las fuentes cuyas condiciones de uso lo permiten (ver
// `FUENTES_PUBLICABLES` en `scripts/lib/noticias.mjs`).
//
// ⚠️⚠️ UNA NOTICIA NO ES UNA SEÑAL, Y EL AVISO VA ANTES DE NINGÚN TITULAR. Dice
// qué pasó y cuándo; nunca hacia dónde va el precio. La app no añade nada a lo
// que escribió la fuente: ni color, ni flecha, ni «alcista».
//
// ⚠️ LOS TITULARES VAN EN SU IDIOMA ORIGINAL (inglés casi siempre). Las
// condiciones del BCE y del Banco de Nueva Zelanda piden reproducir sin
// alterar, así que traducirlos sería cambiarlos. Van en `<bdi>` para que en
// árabe no se den la vuelta.
//
// ⚠️ LA ATRIBUCIÓN VA AL PIE, con el texto que cada fuente pide, y sin logos:
// los logos de los bancos centrales no se pueden usar sin permiso.
//
// Es GEMELO.
export default function Noticias() {
  const { t, locale } = useIdioma()
  const datos = useNoticias()
  if (!datos || !Array.isArray(datos.noticias) || !datos.noticias.length) return null

  const nombre = Object.fromEntries((datos.fuentes ?? []).map((f) => [f.id, f.nombre]))
  const conNoticias = (datos.fuentes ?? []).filter((f) => f.n > 0)
  const cuando = (iso) => {
    const d = new Date(iso)
    return Number.isFinite(d.getTime())
      ? d.toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : ''
  }

  return (
    <TarjetaPlegable
      titulo={t('noticias.titulo', { n: datos.noticias.length })}
      desc={t('noticias.desc')}
      paraQue={t('noticias.paraQue')}
    >
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--amber)', lineHeight: 1.55 }}>{t('noticias.aviso')}</p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {datos.noticias.map((n) => (
          <li key={n.u} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              {cuando(n.d)} · {nombre[n.f] ?? n.f}
              {Array.isArray(n.div) && n.div.length > 0 && (
                <>
                  {' · '}
                  <span className="mono" dir="ltr">
                    {n.div.join(' ')}
                  </span>
                </>
              )}
            </span>
            <a
              href={n.u}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text-primary)' }}
            >
              <bdi>{n.t}</bdi>
            </a>
          </li>
        ))}
      </ul>
      <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('noticias.pie')}</p>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }} dir="ltr">
        {conNoticias.map((f) => f.derechos).join(' · ')}
      </p>
    </TarjetaPlegable>
  )
}
