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
//
// ─────────────────────────────────────────────────────────────────────────
// LA COLUMNA DE ACTIVIDAD (2026-09-09), Y LA ÚNICA FORMA HONESTA DE LEERLA
// ─────────────────────────────────────────────────────────────────────────
// El puente publica `ticks` desde el 2026-09-08 y hasta hoy no lo pintaba
// nadie: un dato real llegando cada 15 minutos a la nada.
//
// Es el `tick_volume` de la vela diaria EN CURSO, o sea **cuántas veces cambió
// el precio hoy, según ESTE bróker**.
//
// ⚠️ NO SE LLAMA «VOLUMEN» EN NINGUNA PARTE DE LA PANTALLA. En Forex no existe
// un volumen real: no hay bolsa central que apunte las operaciones, así que
// nadie tiene el total — ni nosotros ni quien lo venda como volumen. Dos
// brókers dan números distintos para la misma hora, y eso solo puede pasar si
// no es una medición del mercado. El dato no es basura y hay gente con
// experiencia que lo usa sabiendo lo que es; el problema sería el rótulo.
//
// ⚠️ Y SOLO SIRVE PARA COMPARAR PARES ENTRE SÍ, NO DÍAS ENTRE SÍ. Los 18
// números se leen en el MISMO instante del MISMO día con el MISMO bróker, así
// que compararlos unos con otros es legítimo. Compararlos con los de ayer no lo
// sería: el día va a medias y el número crece hasta el cierre. Por eso la barra
// es la proporción respecto al par más activo de ESTA lectura, y no hay ni una
// comparación con nada de antes.
//
// ⚠️ LA BARRA VA EN COLOR NEUTRO. Ni verde ni rojo: mucha actividad no es buena
// ni mala, y el color afirmaría lo contrario. Es la misma decisión que en
// `Correlacion.jsx` — antes de pintar algo de color, preguntarse qué afirma ese
// color.

const TEXTO = { margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }
const CABECERA = { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }

export default function CotizacionesVivo() {
  const { t, locale } = useIdioma()
  const { quotes, estado, actualizadoEl, cuenta } = useMT5Quotes()

  const filas = Object.values(quotes)
  const minutos = actualizadoEl ? minutosDesde(actualizadoEl) : null

  // Si NINGÚN par trae actividad, la columna entera desaparece en vez de dejar
  // una fila de guiones. Pasa con un archivo publicado por un puente viejo, y
  // una columna vacía se lee como que la app está rota. Misma decisión que la
  // tarjeta de correlación cuando el barrido no trae `correl`.
  const ticksValidos = filas.map((q) => q.ticks).filter((n) => Number.isFinite(n))
  const hayTicks = ticksValidos.length > 0
  const maxTicks = hayTicks ? Math.max(...ticksValidos) : 0

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

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: hayTicks ? '1fr auto auto auto auto' : '1fr auto auto auto',
                gap: '6px 10px',
                fontSize: 12.5,
                alignItems: 'center',
              }}
            >
              <span style={CABECERA}>{t('vivo.par')}</span>
              <span style={{ ...CABECERA, textAlign: 'right' }}>{t('vivo.bid')}</span>
              <span style={{ ...CABECERA, textAlign: 'right' }}>{t('vivo.ask')}</span>
              <span style={{ ...CABECERA, textAlign: 'right' }}>{t('vivo.spread')}</span>
              {hayTicks && <span style={{ ...CABECERA, textAlign: 'right' }}>{t('vivo.actividad')}</span>}
              {filas.map((q) => (
                <Fila key={q.par} q={q} hayTicks={hayTicks} maxTicks={maxTicks} />
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

            {/* El rótulo honesto de la actividad va junto a la tabla, no en un
                glosario aparte: quien lee el número tiene que poder leer al
                lado qué es y qué NO es. */}
            {hayTicks && (
              <p style={{ ...TEXTO, fontSize: 11.5, color: 'var(--text-muted)' }}>
                {t('vivo.actividadPie')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Fila({ q, hayTicks, maxTicks }) {
  // La proporción respecto al par MÁS ACTIVO de esta misma lectura. Nunca
  // respecto a un máximo histórico ni a ayer: ver la cabecera del archivo.
  const proporcion = q.ticks != null && maxTicks > 0 ? Math.round((100 * q.ticks) / maxTicks) : 0

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

      {hayTicks && (
        <span dir="ltr" style={{ textAlign: 'right' }}>
          {/* ⚠️ SIN SEPARADOR DE MILES, y lo sacó la revisión en navegador: en
              español el separador es el PUNTO, así que `toLocaleString` pintaba
              «2.926» justo al lado de una columna de precios donde el punto es
              el decimal («1.16290»). Se leía como un precio. Y de paso, en
              árabe salía en cifras árabo-índicas mientras los precios de la
              misma tabla iban en cifras latinas: dos sistemas de dígitos en
              una tabla de números. El entero pelado no tiene ninguno de los
              dos problemas. */}
          <span className="mono" style={{ color: 'var(--text-secondary)' }}>
            {q.ticks == null ? '—' : q.ticks}
          </span>
          {/* La barrita: un riel fino y encima la parte que le toca a este par.
              Crece hacia la IZQUIERDA (`marginLeft: auto`) para quedar pegada al
              número, que va alineado a la derecha.

              ⚠️ EL RIEL SE VE ENTERO Y MIDE SIEMPRE LO MISMO. La primera
              versión lo dejaba del ancho del número y en un color casi
              invisible: solo se veía la parte llena, así que la barra se leía
              como un SUBRAYADO del número en vez de como una proporción. Sin el
              riel completo detrás no hay contra qué comparar, y una barra sin
              referencia no dice nada. */}
          <span
            style={{
              display: 'block',
              width: 38,
              height: 3,
              marginTop: 4,
              marginLeft: 'auto',
              borderRadius: 2,
              background: 'var(--border-strong)',
            }}
          >
            <span
              style={{
                display: 'block',
                height: 3,
                width: `${proporcion}%`,
                marginLeft: 'auto',
                borderRadius: 2,
                background: 'var(--text-muted)',
              }}
            />
          </span>
        </span>
      )}
    </>
  )
}
