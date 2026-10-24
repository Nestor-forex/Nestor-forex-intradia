import { useIdioma } from '../lib/i18n'
import TarjetaPlegable from './TarjetaPlegable'
import { useTasas } from '../lib/useTasas'
import { carryDeSenal } from '../lib/carrySenal'
import { hayAlgoQueEnsenar, instanteDe, senalesDeLaUltimaVela } from '../lib/senalesSombra'
import { monedasDe } from '../lib/pairs'

// LO QUE SEÑALÓ LA REGLA QUE CORRE EN PRUEBAS, EN SU ÚLTIMA VELA.
//
// Néstor, el 2026-10-24: «en intradía no veo nada». Tenía razón: el vigía lleva
// 11 señales del retroceso anotadas desde el 3 de septiembre y **no había
// ninguna pantalla que las enseñara**. Solo se veía su porcentaje en el
// Historial, nunca qué par ni hacia dónde.
//
// ⚠️⚠️ LA DECISIÓN QUE SOSTIENE TODA LA TARJETA: ESTO NO SON PROPUESTAS.
//
// Durante meses la decisión fue la contraria —`unir()` deja las filas de sombra
// fuera de la lista principal con un motivo escrito: «se leerían como
// recomendaciones»— y era la correcta mientras nadie las pidiera. Néstor las
// pide, y es su app. Lo que NO se puede es enseñarlas como las de la app.
//
// Por eso:
//   · va en su propia tarjeta, PLEGADA, en el Historial y no en el Barrido;
//   · el aviso va ANTES de cualquier número, igual que en las tasas y en la
//     actividad — aquí lo caro no es leer mal un dato, es creer que esta lista
//     es lo que la app propone;
//   · lleva su etiqueta ámbar, la misma de su porcentaje;
//   · y NO se dice «hoy» en ninguna parte: se enseña la hora de la vela.
//
// ⚠️ LA HORA, QUE AQUÍ ES LA MITAD DEL ASUNTO. En Swing basta la fecha porque
// cada vela es un día. Aquí cada vela es una hora, así que una señal sin su
// hora al lado no dice nada: el retroceso de las 22:00 y el de las 09:00 son
// operaciones distintas en sesiones distintas. Se pinta en la hora de QUIEN
// MIRA (`toLocaleString` sin `timeZone`), porque el suscriptor de Madrid y el
// de Bogotá tienen que ver cada uno la suya.
//
// ⚠️ Y NO SE PINTA NINGÚN NÚMERO EN VERDE NI EN ROJO. Un stop no es malo ni un
// objetivo bueno: son los dos lados de la misma operación. El color aquí
// afirmaría algo que el dato no dice — la regla de siempre, antes de pintar
// algo de color preguntarse qué afirma ese color. (`SetupDetalle` sí los
// colorea, y es la decisión contraria a propósito: allí son los niveles de una
// señal que la app SÍ propone, y el color dice qué significa en plata.)
//
// 📌 Lo que NO se portó de Swing, a propósito: la marca de «geometría vieja».
// Allá existe porque «comprar la caída» se anotó dos meses con la geometría
// equivocada. Aquí el retroceso se anotó siempre con la suya, así que esa marca
// no tendría nada que marcar — y puesta «por si acaso» marcaría en falso, que
// es exactamente el defecto que allá salió mirando la captura.
export default function SenalesSombra({ senales }) {
  const { t, locale } = useIdioma()
  const datos = useTasas()
  const tasas = datos?.tasas

  const grupos = senalesDeLaUltimaVela(senales)

  // Si NINGUNA regla ha señalado nunca, la tarjeta entera sobra: sería un marco
  // vacío. Mismo criterio que la correlación y el calendario. ⚠️ Lo que sí se
  // enseña, una vez que hay algo, es la regla concreta que todavía no ha
  // señalado — ver `senalesSombra.js`.
  if (!hayAlgoQueEnsenar(grupos)) return null

  const total = grupos.reduce((n, g) => n + g.senales.length, 0)

  return (
    <TarjetaPlegable
      titulo={t('sombraSenales.titulo')}
      desc={t('sombraSenales.desc')}
      paraQue={t('sombraSenales.paraQue')}
      avance={t('sombraSenales.avance', { n: total })}
    >
      {/* ⚠️ ANTES DE NINGÚN NÚMERO. */}
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--amber)' }}>
        {t('sombraSenales.aviso')}
      </p>

      {grupos.map((g) => (
        <Grupo key={g.tipo} g={g} t={t} locale={locale} tasas={tasas} />
      ))}

      <p style={{ ...TEXTO, margin: 0 }}>{t('sombraSenales.pieCarry')}</p>
    </TarjetaPlegable>
  )
}

// Cuánto hace de esa vela, con los mismos cortes y las mismas claves que
// `Tasas.jsx`: hasta dos meses en días, hasta dos años en meses, después en
// años. Devuelve '' por debajo de un día — ver el porqué donde se usa.
//
// ⚠️⚠️ EL NÚMERO SE FORMATEA CON EL LOCALE, Y AQUÍ SÍ HACE FALTA. Va pegado a
// una fecha que arma `toLocaleString`, o sea que en árabe sale en cifras
// árabo-índicas. Pasando el número a pelo salía
// «١٥ أكتوبر في ١٠:٠٠ م · قبل 8 يومًا»: dos sistemas de dígitos en el mismo
// renglón, que es el fallo del COT del 2026-09-29 — y lo reintroduje yo.
// Salió MIRANDO la captura; ni el build ni las 44 comprobaciones lo veían.
//
// 📌 Y por eso NO se cambian las claves compartidas: en `Tasas.jsx` el vecino
// es el valor de la tasa, que va en cifras latinas y `mono`, así que allí lo
// correcto es lo contrario. La regla no es «localizar siempre» ni «nunca»: es
// mirar qué más hay en la frase.
function haceCuanto(cuando, t, locale) {
  const dias = Math.floor((Date.now() - cuando.getTime()) / 86400000)
  if (!Number.isFinite(dias) || dias < 1) return ''
  const n = (v) => new Intl.NumberFormat(locale).format(v)
  if (dias < 60) return t('tasas.haceDias', { n: n(dias) })
  if (dias < 730) return t('tasas.haceMeses', { n: n(Math.round(dias / 30.44)) })
  return t('tasas.haceAnios', { n: n(Math.round(dias / 365.25)) })
}

function Grupo({ g, t, locale, tasas }) {
  const nombre = ETIQUETA[g.tipo] ? t(ETIQUETA[g.tipo]) : g.tipo
  const cuando = instanteDe(g.senales[0])

  return (
    <div style={BLOQUE}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <Etiqueta>{nombre}</Etiqueta>
        {/* La vela del grupo con su HORA, nunca «hoy». Sin `timeZone`, así que
            sale en la del teléfono de quien mira. Si no se pudo leer el
            timestamp no se pinta nada: una hora inventada sería peor que
            ninguna. */}
        {cuando && (
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            {cuando.toLocaleString(locale, {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {/* ⚠️ Y CUÁNTO HACE DE ESO, que es lo que de verdad hace falta.
                Esta regla señala poco —11 veces en siete semanas—, así que lo
                último anotado puede ser de hace una semana larga. Con la fecha
                sola hay que restar mentalmente para darse cuenta, y «un dato
                correcto que exige esa resta es mal diseño, no un descuido de
                quien mira».

                Se reusan las claves de `Tasas.jsx`, que ya están en los 13
                idiomas con una clave por unidad: inventar unas nuevas para lo
                mismo las dejaría separarse en silencio.

                Por debajo de un día NO se pinta nada: «hace 0 días» no dice
                nada, y a esa distancia la hora de al lado ya se entiende sola.

                `<bdi>` y no `dir="ltr"` en el renglón: es la lección del
                calendario — forzar `ltr` a una frase que mezcla palabra
                traducida con número partía «24.5K» en dos. */}
            {haceCuanto(cuando, t, locale) && <bdi> · {haceCuanto(cuando, t, locale)}</bdi>}
          </span>
        )}
      </div>

      {/* Una regla sin señales SIGUE SALIENDO, con su frase. Esconderla dejaría
          en pantalla solo lo que parece estar pasando algo. */}
      {!g.senales.length ? (
        <p style={{ ...TEXTO, margin: 0 }}>{t('sombraSenales.sinSenales')}</p>
      ) : (
        g.senales.map((s) => <Senal key={`${s.id}@${s.vistoEl}`} s={s} t={t} tasas={tasas} />)
      )}
    </div>
  )
}

function Senal({ s, t, tasas }) {
  const carry = carryDeSenal(s, tasas, monedasDe)

  return (
    <div className="card" style={{ padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        {/* ⚠️ `ltr` fijo: el código de par y BUY/SELL son jerga invariante, no
            idioma. Sin esto, en árabe «EUR/USD BUY» se dibuja al revés. */}
        <span className="mono" dir="ltr" style={{ fontSize: 13.5, fontWeight: 700 }}>
          {s.par} {t('lado.' + s.lado)}
        </span>
        {/* El carry solo sale si se sabe. `null` es «no se sabe» y entonces no
            se pinta nada — nunca «neutro» por descarte, que sería un hueco de
            datos leído como un hecho. */}
        {carry && (
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {t('sombraSenales.carry.' + carry)}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {/* ⚠️ Los rótulos se REUSAN de `setup.*`, que ya existen en los 13
            idiomas y son los que usa la pantalla de detalle. Inventar cuatro
            claves nuevas para lo mismo las dejaría separarse en silencio el día
            que alguien tradujera una y no la otra. */}
        <Nivel t={t} clave="setup.entrada" v={s.precio} />
        <Nivel t={t} clave="setup.stopLoss" v={s.sl} />
        <Nivel t={t} clave="setup.takeProfit" v={s.tp} />
        <Nivel t={t} clave="setup.rb" v={s.rr} rb />
      </div>
    </div>
  )
}

function Nivel({ t, clave, v, rb }) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  // Los precios con 5 cifras y la relación riesgo/beneficio con 2, que es como
  // se leen en el resto de la app.
  const texto = rb ? `1 : ${v.toFixed(2)}` : String(Number(v.toFixed(5)))

  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{t(clave)}</div>
      {/* `ltr` fijo: es un número suelto, no una frase traducida. */}
      <div className="mono" dir="ltr" style={{ fontSize: 12.5, fontWeight: 600 }}>
        {texto}
      </div>
    </div>
  )
}

function Etiqueta({ children }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: '.06em',
        padding: '1px 5px',
        borderRadius: 3,
        color: 'var(--amber)',
        border: '1px solid var(--amber)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

// La etiqueta se REUSA de la que ya existe en el Historial, para que la misma
// regla no tenga dos nombres distintos en la misma pantalla.
const ETIQUETA = {
  retroceso: 'historial.esSombra',
}

const BLOQUE = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingTop: 12,
  borderTop: '1px solid rgba(255,255,255,.10)',
}

const TEXTO = { fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }
