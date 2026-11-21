# La voz de los videos de Intradía

Los audios se generan **en el repositorio de Swing** (workflow «Generar la voz
de los videos», con el secreto `GOOGLE_TTS_KEY`, que solo vive allí). Su
`textos.json` junta los rótulos de las dos apps; aquí se copian solo los audios
que usan los videos de esta app, en `google-es-US-Studio-B/`.

Para regrabar un video con voz (desde `app/`):

1. `node scripts/videos/grabar.mjs --bajar <carpeta>`
2. `npx vite build --config scripts/videos/vite.config.js`
3. `node scripts/videos/grabar.mjs --textos --pronunciacion natural <carpeta> <ids>`
4. Copiar los textos nuevos al `textos.json` de Swing y lanzar allí el workflow.
5. Traer los `.ogg` nuevos a `google-es-US-Studio-B/` y grabar:
   `node scripts/videos/grabar.mjs --voz google-es-US-Studio-B --pronunciacion natural <carpeta> <ids>`

⚠️ La misma carpeta de datos en los pasos 3 y 5: los rótulos leen números de
la pantalla, y si cambian, el rótulo se queda mudo (se avisa).
