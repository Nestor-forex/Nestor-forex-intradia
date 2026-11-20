// Banco de grabación de los videos del curso (2026-11-19).
//
// La app ENTERA, con un usuario de ejemplo aprobado (ver `dobles.js`) y los
// datos REALES que publica la rama `datos` (los sirve `grabar.mjs`). No es
// parte de la app publicada: `vite.config.js` de aquí no la toca.
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import App from '../../src/App.jsx'
import { IdiomaProvider } from '../../src/lib/i18n'
import { aplicarVista } from '../../src/lib/vistaPantalla.js'

aplicarVista('vertical')
createRoot(document.getElementById('root')).render(
  <IdiomaProvider>
    <App />
  </IdiomaProvider>,
)
