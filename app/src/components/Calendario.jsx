import { useState } from 'react'
import { useIdioma } from '../lib/i18n'
import {
  ALTO,
  FERIADO,
  MEDIO,
  agruparPorDia,
  categoriaDe,
  estaViejo,
  horasHasta,
  masUrgente,
  proximos,
  totalSemana,
} from '../lib/calendario'

// EL CALENDARIO ECONÓMICO.
//
// Contesta una pregunta que la app no sabía contestar: **¿va a pasar algo hoy
// que mueva el precio?** Un barrido perfecto no sirve de nada si hay Fed en
// tres horas y nadie lo sabía.
//
// ⚠️ ES INFORMACIÓN, NO UN FILTRO. No apaga ni una señal, no cambia el stop y
// no toca el objetivo. Si algún día alguien quiere que sí, eso es otra cosa y
// tiene que pasar por el banco de pruebas antes. Ver `lib/calendario.js`.
//
// ─────────────────────────────────────────────────────────────────────────
// LO QUE SE REHÍZO TRAS VERLO NÉSTOR (2026-09-08), Y POR QUÉ
// ─────────────────────────────────────────────────────────────────────────
// La primera versión se publicó, él la abrió y no la entendió. Tres cosas
// concretas, y las tres eran culpa del diseño y no suya:
//
// 1. ⚠️ EL CÓDIGO DE DIVISA IBA PINTADO DE ROJO O ÁMBAR según el impacto. Él
//    lo leyó como que «el USD está mal», que es exactamente lo que NO dice el
//    dato: el calendario no sabe hacia dónde se va a mover el precio. Ahora el
//    código va en color neutro y el impacto se dice **con una palabra** en su
//    propia pastilla. El color acompaña a la palabra; nunca la sustituye.
//
// 2. ⚠️ LOS NOMBRES VIENEN EN INGLÉS Y EN JERGA («Core PPI m/m»). Debajo va
//    ahora, en el idioma de quien mira, DE QUÉ FAMILIA es: inflación, empleo,
//    tipos de interés… Ver `categoriaDe`: clasifica, no traduce, y si no
//    reconoce el evento no dice nada en vez de inventarse una etiqueta.
//
// 3. ⚠️ EL TÍTULO DECÍA «Qué se publica hoy y mañana», que no dice para qué
//    sirve. Ahora dice que son noticias que PUEDEN mover el precio — «pueden»
//    y no «mueven», porque prometer el movimiento sería lo de siempre.
//
// Y en el pie se dice cuántos se enseñan de cuántos hay en la semana: ver el
// comentario de `totalSemana`, que nació de una confusión real.

// El color va con la PALABRA, nunca solo. Y va sobre el impacto, no sobre la
// divisa: rojo aquí significa «esto salta mucho», no «esto va a bajar».
const IMPACTO = {
  [ALTO]: { color: 'oklch(0.7 0.16 25)', clave: 'calendario.alto' },
  [MEDIO]: { color: 'var(--amber)', clave: 'calendario.medio' },
  [FERIADO]: { color: 'var(--text-muted)', clave: 'calendario.festivo' },
}

export default function Calendario({ cal, ahora = new Date() }) {
  const { t, locale } = useIdioma()
  const [abierto, setAbierto] = useState(false)

  const eventos = proximos(cal, ahora)

  // Sin nada que enseñar no se pinta NADA — ni el título, ni un «no hay
  // eventos». Misma decisión que en la tarjeta de correlación: un barrido de
  // antes de que esto existiera no puede dejar una tarjeta huérfana que haga
  // pensar que la app está rota.
  if (!eventos.length) return null

  const urgente = masUrgente(eventos)
  const horas = urgente ? horasHasta(urgente, ahora) : null
  const viejo = estaViejo(cal, ahora)

  const hora = (iso) =>
    new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setAbierto((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          background: 'none',
          border: 'none',
          color: 'var(--text)',
          cursor: 'pointer',
          fontSize: 13.5,
          fontWeight: 600,
          minHeight: 44,
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <span>{t('calendario.titulo', { n: eventos.length })}</span>
          {/* El aviso, visible SIN abrir. Solo aparece si de verdad viene algo
              de alto impacto: si saltara por cualquier cosa, dejaría de
              leerse a la semana. */}
          {urgente && (
            <span style={{ fontSize: 11.5, fontWeight: 500, color: IMPACTO[ALTO].color }}>
              {t('calendario.aviso', { h: horas, div: urgente.c })}
            </span>
          )}
        </span>
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {t('calendario.intro')}
          </p>

          {/* Un archivo viejo se DELATA. Sin esto, un publicador averiado se
              vería igual que una semana tranquila y nadie sabría por qué. Es
              el mismo criterio del aviso «Sin conexión — mostrando el barrido
              guardado del [fecha]» que ya existe. */}
          {viejo && (
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
              {t('calendario.viejo')}
            </div>
          )}

          {agruparPorDia(eventos, locale).map((grupo) => (
            <div key={grupo.clave} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                {grupo.fecha.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>

              {grupo.eventos.map((ev) => {
                const imp = IMPACTO[ev.i]
                const cat = categoriaDe(ev)
                return (
                  <div
                    key={`${ev.d}|${ev.c}|${ev.t}`}
                    style={{ paddingBottom: 10, borderBottom: '1px solid var(--border)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      {/* La hora NO lleva `dir` fijo a propósito. La arma
                          `toLocaleTimeString` con el idioma, así que en árabe
                          sale «١٠:١٣ م» con sus propias cifras: forzarle `ltr`
                          sería enmendarle la plana al formateador del
                          navegador. Solo se fija lo que NO es idioma. */}
                      <span
                        className="mono"
                        style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
                      >
                        {hora(ev.d)}
                      </span>

                      {/* El código de divisa SÍ va fijo en `ltr` —'USD' es un
                          código, no una palabra— pero YA NO va pintado por
                          impacto: en rojo se leía como «el dólar está mal», y
                          el calendario no dice eso. */}
                      <span
                        className="mono"
                        dir="ltr"
                        style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', flexShrink: 0, width: 34 }}
                      >
                        {ev.c}
                      </span>

                      {/* EL NOMBRE ORIGINAL SE CONSERVA, y la traducción va
                          entre paréntesis al lado. Lo pidió Néstor así y es lo
                          correcto: el nombre en inglés es el que va a ver en
                          cualquier otro calendario del mundo, así que
                          sustituirlo le quitaría el enlace con todo lo demás;
                          y el paréntesis le dice lo que es sin tener que
                          buscarlo.
                          ⚠️ El nombre va en `<bdi>`: es texto en inglés dentro
                          de una frase que en árabe se lee al revés, y sin
                          aislarlo el paréntesis acabaría en el lado que no es. */}
                      <span style={{ fontSize: 12.5, lineHeight: 1.4, minWidth: 0, flex: 1 }}>
                        <bdi>{ev.t}</bdi>
                        {cat ? <> ({t(`calendario.cat.${cat}`)})</> : null}
                      </span>
                    </div>

                    {/* Todo lo explicativo va en su propio renglón, sangrado a
                        la altura del nombre. En una sola línea no cabía en un
                        teléfono y se partía por donde no debía. */}
                    <div
                      style={{
                        marginTop: 4,
                        marginInlineStart: 88,
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      {imp && (
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: imp.color,
                            border: `1px solid ${imp.color}`,
                            borderRadius: 4,
                            padding: '1px 6px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t(imp.clave)}
                        </span>
                      )}

                      {/* Pronóstico y anterior solo cuando los hay.
                          ⚠️ ESTA LÍNEA MEZCLA PALABRA TRADUCIDA Y NÚMERO, y
                          por eso NO puede llevar `dir` fijo. Con `dir="ltr"`
                          en árabe el `%` se despegaba del número y «24.5K» se
                          partía en dos. Solo se aísla el VALOR, con `<bdi>`. */}
                      {(ev.f || ev.p) && (
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {ev.f ? <>{t('calendario.previsto')} <bdi>{ev.f}</bdi></> : null}
                          {ev.f && ev.p ? '  ·  ' : ''}
                          {ev.p ? <>{t('calendario.anterior')} <bdi>{ev.p}</bdi></> : null}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {/* «Se enseñan 6 de los 17 de esta semana». Nació de una confusión
              real: los dos números eran ciertos y medían cosas distintas, y
              sin decirlo al lado se lee como que la app se equivoca. */}
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {t('calendario.cuantos', { n: eventos.length, total: totalSemana(cal) })}
          </p>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {t('calendario.pie')}
          </p>
        </div>
      )}
    </div>
  )
}
