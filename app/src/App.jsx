import { useEffect, useState } from 'react'
import Splash from './components/Splash'
import CargandoApp from './components/CargandoApp'
import Auth from './components/Auth'
import Pendiente from './components/Pendiente'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import BarridoTab from './components/BarridoTab'
import TableroCompleto from './components/TableroCompleto'
import SetupDetalle from './components/SetupDetalle'
import { useT } from './lib/i18n'
import DiarioTab from './components/DiarioTab'
import CalculadoraTab from './components/CalculadoraTab'
import MiembrosTab from './components/MiembrosTab'
import { firebaseListo } from './lib/firebase'
import { useAuthUser } from './lib/useAuthUser'
import { useMembers } from './lib/useMembers'
import { useTrades } from './lib/useTrades'
import { useMarketData } from './lib/useMarketData'

const NOMBRE_APP = 'NESTOR FOREX INTRADÍA'

function SinConfigurar() {
  return (
    <div style={{ flex: 1, padding: '48px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="eyebrow" style={{ fontSize: 11 }}>
        TRADING · FX
      </div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{NOMBRE_APP}</h1>
      <div className="card" style={{ borderColor: 'oklch(0.4 0.06 85)' }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Esta copia de la app todavía no tiene configuradas las claves de Firebase, así que el ingreso y el registro no van a
          funcionar. Configura las variables <code>VITE_FIREBASE_*</code> y vuelve a publicar.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const t = useT()
  const { authUser, cargandoAuth, perfilEstado, esAdmin, registrar, ingresar, salir } = useAuthUser()
  const mercado = useMarketData()
  const miembros = useMembers(esAdmin)
  const diario = useTrades(authUser?.uid)

  const [screen, setScreen] = useState('splash')
  const [tab, setTab] = useState('barrido')
  const [msgAuth, setMsgAuth] = useState('')
  // Setup abierto en la pantalla de detalle, guardado por nombre + lado en vez
  // de por objeto: así, cuando llega precio en vivo, el detalle se actualiza
  // solo en lugar de quedarse con los números del momento en que se abrió.
  const [detalleId, setDetalleId] = useState(null)
  // Datos con los que llega precargado el formulario del Diario cuando se
  // anota un setup desde su detalle.
  const [prellenarDiario, setPrellenarDiario] = useState(null)

  useEffect(() => {
    if (authUser) setScreen('app')
  }, [authUser])

  useEffect(() => {
    if (perfilEstado === 'retirado') {
      setMsgAuth(t('pendiente.retirado'))
      salir()
      setScreen('auth')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- salir() no cambia de identidad de forma relevante aquí
  }, [perfilEstado])

  if (!firebaseListo) {
    return (
      <div className="app-frame">
        <div className="app-screen">
          <SinConfigurar />
        </div>
      </div>
    )
  }

  if (cargandoAuth) {
    return (
      <div className="app-frame">
        <div className="app-screen">
          <CargandoApp nombreApp={NOMBRE_APP} />
        </div>
      </div>
    )
  }

  const registrarYSeguir = async (nombre, email, clave) => {
    const r = await registrar(nombre, email, clave)
    if (r.ok) setMsgAuth('')
    return r
  }

  const detalle = detalleId ? mercado.setups.find((s) => s.name + s.lado === detalleId) : null

  // Pasa el setup al Diario: llena el par, la dirección y una nota con los
  // niveles, y lo deja como operación abierta. El lote y el resultado los pone
  // Néstor, que son lo único que la app no puede saber.
  const anotarEnDiario = (s) => {
    const c = s.crudo
    const niveles = c ? ` · entrada ${c.precio.toFixed(c.dec)} · SL ${c.sl.toFixed(c.dec)} · TP ${c.tp.toFixed(c.dec)} · R/B 1:${c.rr.toFixed(1)}` : ''
    setPrellenarDiario({
      par: s.name,
      dir: s.lado === 'COMPRA' ? 'Compra' : 'Venta',
      nota: t('detalle.notaDiario', { niveles }),
      abierta: true,
    })
    setDetalleId(null)
    setTab('diario')
  }

  const ingresarYSeguir = async (email, clave) => {
    const r = await ingresar(email, clave)
    if (r.ok) setMsgAuth('')
    return r
  }

  const salirYVolver = () => {
    salir()
    setScreen('splash')
    setTab('barrido')
  }

  return (
    <div className="app-frame">
      <div className="app-screen">
        {screen === 'splash' && !authUser && (
          <Splash
            nombreApp={NOMBRE_APP}
            onEntrar={() => {
              setScreen('auth')
              setMsgAuth('')
            }}
          />
        )}

        {screen === 'auth' && !authUser && (
          <Auth nombreApp={NOMBRE_APP} msg={msgAuth} onRegistrar={registrarYSeguir} onIngresar={ingresarYSeguir} />
        )}

        {authUser && perfilEstado === 'cargando' && <CargandoApp nombreApp={NOMBRE_APP} />}

        {authUser && perfilEstado === 'pendiente' && (
          <Pendiente nombreApp={NOMBRE_APP} onSalir={salirYVolver} />
        )}

        {authUser && perfilEstado === 'aprobado' && !detalle && tab !== 'tablero' && (
          <>
            <Header nombreApp={NOMBRE_APP} saludo={esAdmin ? t('comun.administrador') : authUser.email || ''} onSalir={salirYVolver} />
            <main style={{ flex: 1, padding: '18px 18px 96px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {tab === 'barrido' && (
                <BarridoTab
                  loading={mercado.loading}
                  error={mercado.error}
                  sinConfigurar={mercado.sinConfigurar}
                  stale={mercado.stale}
                  guardadoEl={mercado.guardadoEl}
                  monedas={mercado.monedas}
                  pares={mercado.pares}
                  corte={mercado.corte}
                  onVerTablero={() => setTab('tablero')}
                />
              )}
              {tab === 'diario' && (
                <DiarioTab
                  trades={diario.trades}
                  cargando={diario.cargando}
                  onGuardar={diario.guardar}
                  onBorrar={diario.borrar}
                  onCerrar={diario.cerrar}
                  prellenar={prellenarDiario}
                  onPrellenado={() => setPrellenarDiario(null)}
                />
              )}
              {tab === 'calc' && (
                <CalculadoraTab
                  ratesUSD={mercado.ratesUSD}
                  loadingTasas={mercado.loading}
                  errorTasas={mercado.sinConfigurar ? t('barrido.sinConfigurar') : mercado.error}
                />
              )}
              {tab === 'admin' && esAdmin && (
                <MiembrosTab usuarios={miembros.usuarios} cargando={miembros.cargando} onAprobar={miembros.aprobar} onRetirar={miembros.retirar} />
              )}
            </main>
            <BottomNav tab={tab} onTab={setTab} esAdmin={esAdmin} />
          </>
        )}

        {authUser && perfilEstado === 'aprobado' && detalle && (
          <SetupDetalle setup={detalle} corte={mercado.corte} onVolver={() => setDetalleId(null)} onAnotar={anotarEnDiario} />
        )}

        {authUser && perfilEstado === 'aprobado' && !detalle && tab === 'tablero' && (
          <TableroCompleto
            onVolver={() => setTab('barrido')}
            onVerSetup={(s) => setDetalleId(s.name + s.lado)}
            loading={mercado.loading}
            error={mercado.error}
            sinConfigurar={mercado.sinConfigurar}
            stale={mercado.stale}
            guardadoEl={mercado.guardadoEl}
            monedas={mercado.monedas}
            pares={mercado.pares}
            compras={mercado.compras}
            ventas={mercado.ventas}
            vigilancia={mercado.vigilancia}
            rangos={mercado.rangos}
            sesion={mercado.sesion}
            setups={mercado.setups}
            corte={mercado.corte}
          />
        )}
      </div>
    </div>
  )
}
