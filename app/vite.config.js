import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      // Antes el service worker lo generaba el plugin solo. Ahora lo escribimos
      // nosotros en src/sw.js, porque el generado no sabe recibir avisos push.
      // El plugin sigue encargándose de la caché: reemplaza `self.__WB_MANIFEST`
      // dentro de nuestro archivo por la lista real de archivos compilados.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      // Sin esto, en `npm run dev` no hay service worker, y los avisos no se
      // pueden probar sin compilar y publicar cada vez.
      devOptions: { enabled: true, type: 'module' },
      manifest: {
        name: 'Nestor Forex Intradía',
        short_name: 'NF Intradía',
        description: 'Barrido intradía (velas de 1 hora) del mercado Forex, diario de operaciones y gestión de riesgo.',
        theme_color: '#23262f',
        background_color: '#23262f',
        display: 'standalone',
        // start_url y scope se omiten a propósito: vite-plugin-pwa los deriva
        // del `base` de Vite. En producción el build pasa
        // --base=/Nestor-forex-intradia/, así que el ícono instalado abre la
        // app y no la raíz del dominio (que no existe). En local queda en '/'.
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
