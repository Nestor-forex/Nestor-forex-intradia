import { useRef, useState } from 'react'
import { PAIR_NAMES } from '../lib/pairs'
import { leerOperaciones, quitarRepetidas } from '../lib/importarOperaciones'
import { useT } from '../lib/i18n'

// Subir el informe del bróker y meter las operaciones en el Diario.
//
// Va colapsado por defecto, como el glosario: quien lleva el diario a mano no
// tiene por qué ver esto todos los días.
//
// ⚠️ NADA SE GUARDA HASTA QUE NÉSTOR LO CONFIRMA. Entre leer el archivo y
// escribir en Firestore hay una pantalla que dice cuántas entran, cuántas se
// saltaron y por qué, con el resultado total. Importar a ciegas 200
// operaciones y descubrir después que el par estaba mal leído significaría
// borrarlas de una en una.
export default function ImportarBroker({ trades, onImportar }) {
  const tr = useT()
  const archivoRef = useRef(null)
  const [abierto, setAbierto] = useState(false)
  const [previo, setPrevio] = useState(null)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho] = useState(null)

  const elegir = async (e) => {
    const archivo = e.target.files?.[0]
    // Se limpia el input SIEMPRE: si no, elegir el mismo archivo dos veces
    // seguidas no dispararía el evento y parecería que la app se colgó.
    e.target.value = ''
    if (!archivo) return

    setError(null)
    setHecho(null)
    setPrevio(null)

    try {
      const texto = await archivo.text()
      const { operaciones, avisos, leidas } = leerOperaciones(texto, PAIR_NAMES)
      const nuevas = quitarRepetidas(operaciones, trades)
      const repetidas = operaciones.length - nuevas.length
      setPrevio({ nombre: archivo.name, nuevas, avisos, leidas, repetidas })
    } catch {
      setError(tr('importar.errorLeer'))
    }
  }

  const confirmar = async () => {
    if (!previo?.nuevas.length) return
    setGuardando(true)
    try {
      for (const op of previo.nuevas) await onImportar(op)
      setHecho(previo.nuevas.length)
      setPrevio(null)
    } catch {
      setError(tr('importar.errorGuardar'))
    } finally {
      setGuardando(false)
    }
  }

  const totalPrevio = previo?.nuevas.reduce((a, o) => a + o.pl, 0) ?? 0

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button
        onClick={() => setAbierto((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'none',
          border: 'none',
          padding: 0,
          minHeight: 32,
          cursor: 'pointer',
          color: 'var(--text)',
          fontSize: 14,
          fontWeight: 600,
          textAlign: 'left',
        }}
        aria-expanded={abierto}
      >
        <span>{tr('importar.titulo')}</span>
        <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          {abierto ? '▾' : '▸'}
        </span>
      </button>

      {abierto && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {tr('importar.explicacion')}
          </div>

          <input
            ref={archivoRef}
            type="file"
            accept=".htm,.html,.csv,.tsv,.txt"
            onChange={elegir}
            style={{ display: 'none' }}
          />
          <button className="btn" onClick={() => archivoRef.current?.click()}>
            {tr('importar.elegir')}
          </button>

          {error && (
            <div className="mono" style={{ fontSize: 12.5, color: 'var(--red)' }}>
              {error}
            </div>
          )}

          {hecho !== null && (
            <div className="mono" style={{ fontSize: 12.5, color: 'var(--green)' }}>
              {tr('importar.hecho', { n: hecho })}
            </div>
          )}

          {previo && (
            <div
              style={{
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {previo.nombre}
              </div>

              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                <div>
                  <strong className="mono">{previo.nuevas.length}</strong> {tr('importar.entran')}
                </div>
                {previo.repetidas > 0 && (
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {tr('importar.repetidas', { n: previo.repetidas })}
                  </div>
                )}
                {previo.nuevas.length > 0 && (
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {tr('importar.resultadoTotal')}{' '}
                    <span
                      className="mono"
                      style={{ fontWeight: 700, color: totalPrevio >= 0 ? 'var(--green)' : 'var(--red)' }}
                    >
                      {(totalPrevio >= 0 ? '+' : '') + totalPrevio.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {previo.avisos.length > 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--amber)',
                    lineHeight: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  {/* Los avisos llegan como códigos y se traducen aquí: el
                      lector corre también en Node y no sabe el idioma. */}
                  {previo.avisos.map((a, i) => (
                    <div key={i}>· {tr(`importar.aviso.${a.codigo}`, a)}</div>
                  ))}
                </div>
              )}

              {/* Las primeras, para que se pueda comprobar de un vistazo que el
                  par y el resultado se leyeron bien antes de guardar 200. */}
              {previo.nuevas.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {previo.nuevas.slice(0, 5).map((o, i) => (
                    <div
                      key={i}
                      className="mono"
                      style={{ fontSize: 12, display: 'flex', gap: 8, color: 'var(--text-secondary)' }}
                    >
                      <span style={{ fontWeight: 700, color: 'var(--text)' }}>{o.par}</span>
                      <span style={{ color: o.dir === 'Compra' ? 'var(--green)' : 'var(--red)' }}>
                        {tr(`direccion.${o.dir}`)}
                      </span>
                      <span>{o.fecha}</span>
                      <span style={{ marginLeft: 'auto', color: o.pl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {(o.pl >= 0 ? '+' : '') + o.pl.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {previo.nuevas.length > 5 && (
                    <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {tr('importar.yMas', { n: previo.nuevas.length - 5 })}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={confirmar}
                  disabled={guardando || !previo.nuevas.length}
                >
                  {guardando ? tr('importar.guardando') : tr('importar.confirmar', { n: previo.nuevas.length })}
                </button>
                <button className="btn" onClick={() => setPrevio(null)} disabled={guardando}>
                  {tr('importar.cancelar')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
