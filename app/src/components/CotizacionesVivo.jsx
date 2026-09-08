import { useIdioma } from '../lib/i18n'
import { minutosDesde, useMT5Quotes } from '../lib/useMT5Quotes'

// EL SPREAD REAL DEL BRÓKER.
//
// Lo que de verdad cuesta abrir una operación, medido en la cuenta de Néstor
// en AvaTrade. Hasta hoy la app solo tenía una tabla ESTIMADA escrita a mano.
//
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ TRES DECISIONES QUE NO SON ADORNO
// ─────────────────────────────────────────────────────────────────────────
//
// 1. SE DICE DE QUIÉN ES LA CUENTA, SIEMPRE. Es el spread de AvaTrade de
//    Néstor, no el del suscriptor. Alguien con otro bróker verá números que no
//    son los suyos, y tiene derecho a saberlo antes de fiarse. Por eso el
//    rótulo va arriba y no en la letra pequeña, y por eso el propio archivo
//    publicado trae el campo `cuenta` en vez de escribirlo aquí a mano.
//
// 2. SE DICE DE CUÁNDO ES LA FOTO. El puente publica cada 15 minutos y solo
//    mientras el computador de Néstor esté encendido. Un número sin hora al
//    lado se lee como «ahora mismo», y a las nueve de la noche eso sería
//    mentira. Es el mismo criterio del aviso «Sin conexión — mostrando el
//    barrido guardado del [fecha]» que ya existe.
//
// 3. YA NO HAY BOTÓN DE CONECTAR. Antes lo había porque eran 30 peticiones por
//    minuto a un servidor que casi nadie tenía. Ahora es un archivo pequeño
//    cada dos minutos, así que se enseña y ya.

const TEXTO = { margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }
const CABECERA = { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }

export default function CotizacionesVivo() {
  const { t, locale } = useIdioma()
  const { quotes, estado, actualizadoEl, cuenta } = useMT5Quotes()

  const filas = Object.values(quotes)
  const minutos = actualizadoEl ? minutosDesde(actualizadoEl) : null

  return (
    <div className="card">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t('vivo.titulo')}</div>

        {/* De quién es. Arriba, no en la letra pequeña. */}
        <p style={TEXTO}>{t('vivo.desc', { cuenta: cuenta || t('vivo.cuentaGenerica') })}</p>

        {estado === 'cargando' && <p style={TEXTO}>{t('vivo.cargando')}</p>}

        {estado === 'sin-datos' && (
          <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
            <p style={TEXTO}>{t('vivo.sinDatos')}</p>
          </div>
        )}

        {filas.length > 0 && (
          <>
            {/* ⚠️ El aviso de foto vieja va ARRIBA de la tabla, no debajo.
                Debajo se lee después de haber creído los números. */}
            {minutos != null && minutos > 60 && (
              <div
                style={{
                  padding: '10px 12px',
                  border: '1px solid var(--amber)',
                  borderRadius: 6,
                  color: 'var(--amber)',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                {t('vivo.vieja', { h: Math.floor(minutos / 60) })}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '6px 10px', fontSize: 12.5, alignItems: 'center' }}>
              <span style={CABECERA}>{t('vivo.par')}</span>
              <span style={{ ...CABECERA, textAlign: 'right' }}>{t('vivo.bid')}</span>
              <span style={{ ...CABECERA, textAlign: 'right' }}>{t('vivo.ask')}</span>
              <span style={{ ...CABECERA, textAlign: 'right' }}>{t('vivo.spread')}</span>
              {filas.map((q) => (
                <Fila key={q.par} q={q} />
              ))}
            </div>

            <p style={{ ...TEXTO, fontSize: 11.5, color: 'var(--text-muted)' }}>
              {t('vivo.pie', {
                hora: new Date(actualizadoEl).toLocaleString(locale, {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function Fila({ q }) {
  return (
    <>
      {/* `dir="ltr"` fijo en todo: son códigos y números, y en árabe se
          dibujarían al revés. Es el error que ya mordió cuatro veces aquí. */}
      <span className="mono" dir="ltr" style={{ fontWeight: 600 }}>
        {q.par}
      </span>
      <span className="mono" dir="ltr" style={{ textAlign: 'right' }}>
        {q.bid.toFixed(q.dec)}
      </span>
      <span className="mono" dir="ltr" style={{ textAlign: 'right' }}>
        {q.ask.toFixed(q.dec)}
      </span>
      {/* El spread se pinta en ámbar cuando pasa de 3 pips: por encima de ahí
          se come una parte seria de un objetivo corto, y conviene verlo antes
          de entrar, no después. */}
      <span
        className="mono"
        dir="ltr"
        style={{ textAlign: 'right', color: q.spread > 3 ? 'var(--amber)' : 'var(--text-secondary)' }}
      >
        {q.spread.toFixed(1)}
      </span>
    </>
  )
}
