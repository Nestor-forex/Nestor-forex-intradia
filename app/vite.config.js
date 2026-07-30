import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
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
