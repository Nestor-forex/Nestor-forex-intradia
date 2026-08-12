import { useEffect, useState } from 'react'
import { useIdioma } from '../lib/i18n'
import { activar, desactivar, suscripcionActual } from '../lib/push'
import { motivoNoDisponible, permisoActual } from '../lib/push/soporte'
import { AVISOS_PAUSADOS } from '../lib/push/pausa'

// Interruptor de los avisos al celular.
//
// La mayor parte de este archivo no es el interruptor en sí (eso son tres
// líneas), sino explicar bien los casos en que NO se puede activar. Un
// "no disponible" a secas dejaría a Néstor sin saber si es culpa suya, del
// celular o de la app — y en iPhone el caso más común tiene solución, así
// que hay que decirla en vez de esconderla.

export default function AvisosCard({ uid }) {
  // El idioma se guarda junto a la suscripción: el vigía corre en un servidor
  // y no tiene otra forma de saber en qué idioma mandar el aviso.
  const { t, idioma } = useIdioma()
  const [suscrito, setSuscrito] = useState(null) // null = todavía averiguando
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [permiso, setPermiso] = useState(permisoActual())

  const motivo = motivoNoDisponible()

  useEffect(() => {
    let vivo = true
    suscripcionActual().then((s) => {
      if (vivo) setSuscrito(Boolean(s))
    })
    return () => {
      vivo = false
    }
  }, [])

  const alActivar = async () => {
    setOcupado(true)
    setError('')
    const r = await activar(uid, idioma)
    setPermiso(permisoActual())
    if (r.ok) {
      setSuscrito(true)
    } else if (r.motivo !== 'permiso-denied' && r.motivo !== 'permiso-default') {
      // Si dijo que no al permiso, el texto de "denegado" ya lo explica; sacar
      // además un error rojo sería regañarlo por una decisión suya.
      setError(t('avisos.fallo'))
    }
    setOcupado(false)
  }

  const alDesactivar = async () => {
    setOcupado(true)
    setError('')
    await desactivar(uid)
    setSuscrito(false)
    setOcupado(false)
  }

  // Aviso de prueba: lo dispara la propia app, sin pasar por el vigía. Sirve
  // para comprobar que el permiso y el service worker funcionan sin tener que
  // esperar a que aparezca una señal de verdad.
  const alProbar = async () => {
    const registro = await navigator.serviceWorker.ready
    await registro.showNotification(t('avisos.pruebaTitulo'), {
      body: t('avisos.pruebaCuerpo'),
      icon: 'pwa-192.png',
      tag: 'prueba',
    })
  }

  const conAviso = Boolean(motivo) || permiso === 'denied' || AVISOS_PAUSADOS

  // En pausa se muestra el motivo y NADA más: ni el botón de activar, ni el de
  // probar. Dejar el interruptor puesto sería prometer algo que no va a pasar,
  // y quien lo activara se quedaría esperando un aviso que nadie va a mandar.
  if (AVISOS_PAUSADOS) {
    return (
      <div className="card" style={{ borderColor: 'var(--amber)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t('avisos.titulo')}</div>
          <div style={{ ...TEXTO, color: 'var(--amber)', fontWeight: 600 }}>{t('avisos.pausados')}</div>
          <p style={TEXTO}>{t('avisos.pausadosPorque')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={conAviso ? { borderColor: 'var(--amber)' } : undefined}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t('avisos.titulo')}</div>
        <p style={TEXTO}>{t('avisos.desc')}</p>

        {motivo === 'no-soportado' && <p style={TEXTO}>{t('avisos.noSoportado')}</p>}
        {motivo === 'ios-sin-instalar' && <p style={TEXTO}>{t('avisos.iosSinInstalar')}</p>}
        {!motivo && permiso === 'denied' && <p style={TEXTO}>{t('avisos.denegado')}</p>}

        {!motivo && permiso !== 'denied' && (
          <>
            {suscrito === true && (
              <>
                <div style={{ ...TEXTO, color: 'var(--green)', fontWeight: 600 }}>
                  ✓ {t('avisos.activados')}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn-ghost" onClick={alDesactivar} disabled={ocupado}>
                    {t('avisos.desactivar')}
                  </button>
                  <button className="btn-ghost" onClick={alProbar} disabled={ocupado}>
                    {t('avisos.probar')}
                  </button>
                </div>
              </>
            )}

            {suscrito === false && (
              <button
                className="btn btn-primary"
                onClick={alActivar}
                disabled={ocupado}
                style={{ padding: '0 16px' }}
              >
                {ocupado ? t('avisos.activando') : t('avisos.activar')}
              </button>
            )}
          </>
        )}

        {error && <p style={{ ...TEXTO, color: 'var(--red)' }}>{error}</p>}

        {!motivo && permiso !== 'denied' && (
          <p style={{ ...TEXTO, fontSize: 11.5, color: 'var(--text-muted)' }}>
            {t('avisos.soloEsteAparato')}
          </p>
        )}
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
