import { useT } from '../lib/i18n'
import { DIAS_CICLO, diasRestantes, extender, hoyUTC } from '../lib/vencimientos'

// El color del aviso de vencimiento. Aquí SÍ hay colores —al revés que en la
// correlación o el COT— porque aquí el color sí afirma algo verdadero y
// accionable: cuánto falta para que esta persona pierda el acceso. No es una
// opinión sobre el mercado, es una cuenta de días.
function colorDe(dias) {
  if (dias === null) return 'var(--text-muted)'
  if (dias < 0) return 'oklch(0.7 0.12 25)'
  if (dias <= 3) return 'var(--amber)'
  return 'var(--text-secondary)'
}

export default function MiembrosTab({ usuarios, cargando, onAprobar, onRetirar, onFijarVence }) {
  const t = useT()
  const hoy = hoyUTC()

  const retirar = (uid, nombre) => {
    if (confirm(t('miembros.confirmarRetiro', { nombre }))) onRetirar(uid)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>{t('miembros.titulo')}</h2>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {t('miembros.intro')}
      </div>

      {/* ⚠️ Va ARRIBA, antes de la lista. Es la única forma de que Néstor
          entienda por qué unas fichas tienen fecha y otras no antes de
          empezar a tocar botones — y sobre todo, que «sin fecha» NO es un
          error: es acceso abierto. */}
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55, padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
        {t('miembros.venceAyuda')}
      </div>

      {cargando && (
        <div className="mono" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {t('miembros.cargando')}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {usuarios.map((u) => {
          const dias = diasRestantes(u.venceEl, hoy)
          const aprobado = u.estado === 'aprobado'
          const pendiente = u.estado === 'pendiente'

          return (
            <div key={u.uid} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{u.nombre}</div>
                <div className="mono" dir="ltr" style={{ fontSize: 12, color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
                  {u.email}
                </div>
                <div style={{ fontSize: 12, marginTop: 2 }}>
                  <span style={{ color: aprobado ? 'var(--green)' : pendiente ? 'var(--amber)' : 'oklch(0.7 0.12 25)' }}>
                    {t(aprobado ? 'miembros.estadoAprobado' : pendiente ? 'miembros.estadoPendiente' : 'miembros.estadoRetirado')}
                  </span>
                  {' · '}
                  {/* Se enseñan la FECHA y los días que faltan, no solo una de
                      las dos: la fecha sola obliga a contar con los dedos, y
                      los días solos no dejan comprobar si lo que se escribió
                      es lo que se quería escribir.

                      ⚠️ La FECHA va en su propio elemento con `ltr` fijo, y no
                      dentro de la frase traducida. Un código como 2026-10-15
                      metido en una frase en árabe se reordena y sale al revés
                      — es el error que ya mordió seis veces en este repo. El
                      número de días SÍ va dentro de la frase, porque ahí es
                      idioma y tiene que seguir al idioma. */}
                  <span style={{ color: colorDe(dias) }}>
                    {dias === null ? (
                      t('miembros.sinVence')
                    ) : (
                      <>
                        <span className="mono" dir="ltr">{u.venceEl}</span>
                        {' · '}
                        {dias === 0
                          ? t('miembros.venceHoy')
                          : dias < 0
                            ? t('miembros.vencioHace', { dias: -dias })
                            : t('miembros.venceEn', { dias })}
                      </>
                    )}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
                {/* El calendario del propio teléfono: sin librerías, y en el
                    idioma del aparato. Lo que viaja a Firestore es siempre
                    'AAAA-MM-DD', que es lo que el robot sabe leer. */}
                <input
                  type="date"
                  value={u.venceEl && /^\d{4}-\d{2}-\d{2}$/.test(u.venceEl) ? u.venceEl : ''}
                  onChange={(e) => onFijarVence(u.uid, e.target.value)}
                  aria-label={t('miembros.fechaVence')}
                  className="mono"
                  dir="ltr"
                  style={{ minHeight: 44, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elev)', color: 'var(--text)', fontSize: 13 }}
                />
                {/* El botón del carril manual: llega el pago por Binance o
                    Pago Móvil y esto es TODO lo que hay que hacer. Suma desde
                    la fecha que ya tenía, así que pagar temprano no cuesta
                    días. */}
                <button
                  onClick={() => onFijarVence(u.uid, extender(u.venceEl, hoy))}
                  style={{ minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {t('miembros.masCiclo', { dias: DIAS_CICLO })}
                </button>

                {/* ⚠️ ANTES ESTE BOTÓN SOLO SALÍA SI ESTABA «PENDIENTE», y eso
                    dejaba a los retirados sin forma de volver desde la app.
                    Con el robot cerrando cuentas cada mes, esa puerta tenía
                    que existir: si no, el primer suscriptor que renovara se
                    quedaría fuera para siempre. */}
                {!aprobado && (
                  <button
                    onClick={() => onAprobar(u.uid)}
                    style={{ minHeight: 44, padding: '0 14px', borderRadius: 8, border: 'none', background: 'var(--green)', color: 'oklch(0.15 0.01 255)', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {t(pendiente ? 'miembros.aprobar' : 'miembros.reactivar')}
                  </button>
                )}
                {/* También para «pendiente»: rechazar una solicitud es
                    retirarla. Solo sobra en quien YA está retirado. */}
                {u.estado !== 'retirado' && (
                  <button
                    onClick={() => retirar(u.uid, u.nombre)}
                    style={{ minHeight: 44, padding: '0 14px', borderRadius: 8, border: '1px solid oklch(0.45 0.08 25)', background: 'none', color: 'oklch(0.7 0.12 25)', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {t('miembros.retirar')}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {!cargando && usuarios.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('miembros.vacio')}</div>
      )}
    </div>
  )
}
