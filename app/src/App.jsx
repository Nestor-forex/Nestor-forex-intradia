import { useEffect, useState } from 'react'
import Splash from './components/Splash'
import CargandoApp from './components/CargandoApp'
import Auth from './components/Auth'
import Pendiente from './components/Pendiente'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import BarridoTab from './components/BarridoTab'
import TableroCompleto from './components/TableroCompleto'
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
  const { authUser, cargandoAuth, perfilEstado, esAdmin, registrar, ingresar, salir } = useAuthUser()
  const mercado = useMarketData()
  const miembros = useMembers(esAdmin)
  const diario = useTrades(authUser?.uid)

  const [screen, setScreen] = useState('splash')
  const [tab, setTab] = useState('barrido')
  const [msgAuth, setMsgAuth] = useState('')

  useEffect(() => {
    if (authUser) setScreen('app')
  }, [authUser])

  useEffect(() => {
    if (perfilEstado === 'retirado') {
      setMsgAuth('Tu acceso fue retirado. Escríbele a Néstor si crees que es un error.')
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
          <Pendiente nombreApp={NOMBRE_APP} mensaje="Tu solicitud queda pendiente hasta que Néstor la autorice." onSalir={salirYVolver} />
        )}

        {authUser && perfilEstado === 'aprobado' && tab !== 'tablero' && (
          <>
            <Header nombreApp={NOMBRE_APP} saludo={esAdmin ? 'Administrador' : authUser.email || ''} onSalir={salirYVolver} />
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
                <DiarioTab trades={diario.trades} cargando={diario.cargando} onGuardar={diario.guardar} onBorrar={diario.borrar} onCerrar={diario.cerrar} />
              )}
              {tab === 'calc' && (
                <CalculadoraTab
                  ratesUSD={mercado.ratesUSD}
                  loadingTasas={mercado.loading}
                  errorTasas={mercado.sinConfigurar ? 'Todavía no está configurada la fuente de precios en vivo.' : mercado.error}
                />
              )}
              {tab === 'admin' && esAdmin && (
                <MiembrosTab usuarios={miembros.usuarios} cargando={miembros.cargando} onAprobar={miembros.aprobar} onRetirar={miembros.retirar} />
              )}
            </main>
            <BottomNav tab={tab} onTab={setTab} esAdmin={esAdmin} />
          </>
        )}

        {authUser && perfilEstado === 'aprobado' && tab === 'tablero' && (
          <TableroCompleto
            onVolver={() => setTab('barrido')}
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
            setups={mercado.setups}
            corte={mercado.corte}
          />
        )}
      </div>
    </div>
  )
}
