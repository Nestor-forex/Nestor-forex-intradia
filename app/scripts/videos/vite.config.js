// Construye el banco de grabación (2026-11-19). Ver `main.jsx`.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const dobles = fileURLToPath(new URL('./dobles.js', import.meta.url))
const DOBLADOS = ['/lib/useAuthUser', '/lib/useTrades', '/lib/usePractica', '/lib/useMembers', '/lib/usePlantillas', '/lib/useEstilo']

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  plugins: [
    react(),
    {
      name: 'dobles',
      enforce: 'pre',
      resolveId(id) {
        const limpio = id.replace(/\.js$/, '')
        if (DOBLADOS.some((d) => limpio.endsWith(d))) return dobles
      },
    },
  ],
  build: { outDir: fileURLToPath(new URL('../../_videos', import.meta.url)), emptyOutDir: true },
})
