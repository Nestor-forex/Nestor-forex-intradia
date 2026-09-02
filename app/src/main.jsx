import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { IdiomaProvider } from './lib/i18n'
import RedDeSeguridad from './components/RedDeSeguridad.jsx'

// `RedDeSeguridad` va POR FUERA de `IdiomaProvider`, no por dentro.
//
// Un componente solo captura los errores de lo que tiene debajo, así que
// ponerla dentro dejaría fuera al propio sistema de idiomas — y una pantalla
// en blanco por culpa del idioma se ve exactamente igual de mal que cualquier
// otra. Desde fuera cubre absolutamente todo lo que se dibuja.
//
// Puede estar fuera porque no necesita el contexto de idioma: lee el idioma
// guardado directamente del navegador. Ver el comentario largo en su archivo.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RedDeSeguridad>
      <IdiomaProvider>
        <App />
      </IdiomaProvider>
    </RedDeSeguridad>
  </StrictMode>,
)
