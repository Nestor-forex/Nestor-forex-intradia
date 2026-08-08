# Nestor Forex Intradía — memoria del proyecto

App hermana de **Nestor Forex** (repositorio `nestor-forex/nestor-forex`),
pensada para operar el mismo día (abrir y cerrar en horas, no en días).
Mismas cuentas/administrador, mismo diseño y pantallas, pero con datos e
indicadores calibrados para intradía en vez de swing.

## Por qué existe esta app separada

El 24 de julio de 2026 el usuario (Néstor) pidió que la app le diera
"información real a cualquier hora" según qué sesión estuviera abierta
(Nueva York, Londres, Asia, Oceanía). Al explicarle que los datos diarios
del BCE (que usa Nestor Forex) sirven para posiciones de horas-a-días pero
no para intradía real, decidió **dejar Nestor Forex tal cual** y pedir una
copia nueva, calibrada para intradía, sin tocar la que ya funciona.

## Diferencias clave con Nestor Forex

| | Nestor Forex | Nestor Forex Intradía |
|---|---|---|
| Fuente de precios | `api.frankfurter.dev` (BCE, 1 cierre/día) | Twelve Data (`time_series`, velas H1, refresco cada 15 min) |
| Indicadores de tendencia | EMA20 / EMA50 | EMA9 / EMA21 |
| RSI | 14, sobre cierres diarios | 14, sobre velas H1 |
| ATR | % diario | % por hora |
| Fuerza relativa | ventanas 1d/5d/20d | ventanas 1h/4h/24h |
| Extra | — | Puntos pivote de sesión (P/S1/S2/R1/R2) |
| Diario de operaciones | colección `users/{uid}/trades` | colección `users/{uid}/trades_intradia` (mismo proyecto de Firebase, mismas cuentas, estadísticas separadas) |
| Ícono | acento verde | acento ámbar (para distinguirlas en el celular) |

El motor de cálculo (`app/src/lib/marketCalc.js`) es el mismo algoritmo
portado y recalibrado — ver el archivo hermano en el otro repositorio si
hace falta comparar línea a línea.

### Aproximación de los puntos pivote

Esta fuente de datos solo trae precio de **cierre** por hora, no
máximo/mínimo real intrabar. Los pivotes se calculan con el máximo, mínimo
y cierre de esos precios de cierre en las 24 horas previas (una
aproximación honesta del día anterior, documentada también en la propia
app junto a las demás limitaciones — igual de transparente que cómo
Nestor Forex ya documenta que su ATR es "proxy cierre-a-cierre").

## Estado actual (24 de julio de 2026)

- ✅ Repositorio creado, app copiada y adaptada (branding, motor de
  cálculo intradía, colección de Firestore separada, ícono ámbar).
- ✅ `npm run build` y `npm run lint` pasan sin errores.
- ✅ Probado visualmente con datos simulados (arnés temporal, revertido
  antes de commitear): pantalla sin configurar, tablero con pivotes y
  fuerza relativa por hora se ven correctos.
- ✅ Néstor consiguió su llave gratuita de
  [twelvedata.com](https://twelvedata.com) y la pegó en
  `VITE_TWELVEDATA_KEY` (`app/.env.production`).
- ✅ Reglas de Firestore (con `trades_intradia`) publicadas en la consola
  de Firebase por Néstor. PR correspondiente (`nestor-forex/nestor-forex`
  #7) fusionado.
- ✅ Primera publicación en GitHub Pages hecha (hubo que activar
  manualmente "Source: GitHub Actions" en Settings → Pages del repo la
  primera vez — paso normal de GitHub para cualquier repo nuevo, no un
  error de configuración; ya quedó automático de ahí en adelante).
- ✅ **Confirmado con capturas del usuario contra la app publicada:** el
  fetch de Twelve Data (`useMarketData.js`) SÍ funciona contra la API
  real — fuerza relativa, pares, RSI, sparkline, %/20h y pivotes se ven
  con datos reales y coherentes. No hubo que tocar el parseo de la
  respuesta batch; el formato asumido (`{ [símbolo]: { values: [...] } }`)
  era correcto. También se confirmó que las 4 cuentas ya aprobadas en
  Nestor Forex aparecen automáticamente aprobadas aquí también (mismo
  proyecto de Firebase, sin necesidad de volver a registrarse), y que el
  Diario de esta app arranca vacío y separado del de la app hermana.
  **La app quedó completamente funcional de punta a punta.**

## Arquitectura

Misma que Nestor Forex (ver `README.md` del proyecto original para el
handoff de diseño completo) — `app/` es la app real, mismo stack
(React 19 + Vite 8 + PWA), mismos componentes de UI reutilizados tal cual
donde no había que tocar nada (Auth, Miembros, Calculadora, Pendiente,
CargandoApp, Glosario, Sparkline, etc.).

```
app/
  src/
    App.jsx                   # NOMBRE_APP = 'NESTOR FOREX INTRADÍA'
    lib/
      marketCalc.js            # motor recalibrado a H1 (EMA9/21, pivotes, fuerza 1h/4h/24h)
      useMarketData.js         # fetch a Twelve Data (time_series, H1), caché + refresco cada 15 min
      useTrades.js              # Firestore: users/{uid}/trades_intradia
      (el resto, igual que Nestor Forex)
firestore.rules                # copia idéntica a la del repo original (fuente de la verdad: el otro repo)
.github/workflows/preview-pages.yml   # build + deploy a GitHub Pages en push a main
```

## Convenciones de trabajo

Mismas que Nestor Forex: el usuario no sabe programar, cada paso que
requiera clics en GitHub/Firebase se da número por número, y se avisa
antes de cada fase grande. Rama de trabajo: se commitea directo a `main`
mientras el repo es nuevo (mismo patrón que el primer commit "Add files
via upload" del repo original); una vez publicada la primera versión,
usar ramas + PR como en Nestor Forex.

## Precio en vivo con TrueFX (2026-07-27/28, en curso)

El usuario pidió que la app diera "información real y precisa en tiempo
real" a cada suscriptor que la abre. Twelve Data (refresco cada 15 min)
se queda como la fuente del historial de 100 velas H1 — TrueFX no da
historial gratis, solo el precio del momento, así que **complementa, no
reemplaza**. Se evaluaron y descartaron antes de llegar aquí: subir de
plan en Twelve Data ($99/mes Pro para WebSocket real), OANDA (la cuenta
que abrió el usuario quedó en la división "OANDA Global Markets", que su
propia documentación excluye de la API v20 — además esa cuenta resultó
ser MT5, ni siquiera v20), AvaTrade (sin API pública para developers),
MetaApi.cloud (no es gratis, $30/mes mínimo), Interactive Brokers (las
cuentas demo no pueden recibir datos por API).

- **PR #1 (fusionado):** agrega `app/src/lib/useTrueFXLive.js` —
  mientras la app está abierta, abre sesión en TrueFX
  (`webrates.truefx.com/rates/connect.html`) y consulta cada 10s el
  precio de las 7 divisas. `useMarketData.js` reemplaza el cierre de la
  vela más reciente con ese precio en vivo antes de recalcular (EMA,
  RSI, fuerza relativa, pivotes) — si TrueFX falla, no pasa nada, la app
  sigue solo con Twelve Data, nunca se rompe por esto.
  `VITE_TRUEFX_USER`/`VITE_TRUEFX_PASS` en `.env.production`, mismo
  criterio que la llave de Twelve Data (cuenta de solo datos, sin
  fondos, bajo riesgo real de publicarla). Usuario: `NESTOR`.
- ⚠️ **Probado en la app real y TrueFX respondió `"not authorized"`**
  (confirmado con un script de diagnóstico corrido en GitHub Actions —
  PR #2, ya revertido/eliminado tras el diagnóstico, el entorno de
  desarrollo normal tiene bloqueado `webrates.truefx.com` igual que
  `api.twelvedata.com`). La app no se rompió (cayó de vuelta a "fuente:
  Twelve Data" sola, tal como se diseñó), pero el precio en vivo no
  funcionaba con TrueFX.
- ✅ **Causa real confirmada, y resuelta cambiando de proveedor:** no era
  la suscripción (el panel "Suscripciones" de Néstor mostraba "Vida /
  Gratis / Activo: Sí"). La verdadera razón: la página de precios
  actual de TrueFX (truefx.com) muestra planes de pago institucionales
  (uno visible en $7,450) — su API de streaming ya no es gratis para
  cuentas nuevas, pese a que la documentación de 2009-2019 (la única
  que se encontró al investigar) la describía como gratis con solo
  registrarse. Se abandonó TrueFX por completo.
- ✅ **PR #3 (fusionado):** se reemplazó por **Capital.com**
  (`useCapitalLive.js`), bróker de CFDs con API REST/WebSocket gratis
  confirmada en cuenta demo (sin fondos reales). Esta vez sí se probó
  con datos reales antes de fusionar (script de diagnóstico temporal en
  GitHub Actions): sesión exitosa, y los 7 precios de las divisas
  contra USD confirmados en una sola consulta batch
  (`GET /api/v1/markets?epics=...`). Credenciales en `.env.production`
  como `VITE_CAPITAL_API_KEY`/`VITE_CAPITAL_IDENTIFIER`/
  `VITE_CAPITAL_PASSWORD` (cuenta demo, mismo criterio de transparencia
  que las demás credenciales del archivo). Pendiente de confirmar en la
  app real: que el navegador no bloquee la llamada por CORS (no se pudo
  probar esa parte desde Node/GitHub Actions).
- **Aclaración importante sobre los 14 pares:** la app muestra 14 pares
  (7 "mayores" contra USD + 7 cruces como EUR/CHF, GBP/JPY, etc.), pero
  el motor (`computarBarrido` en `marketCalc.js`) calcula los cruces
  matemáticamente a partir de las 7 divisas contra USD — no hace falta
  pedirle datos en vivo de los 14 por separado a ningún proveedor. Con
  los 7 precios en vivo de Capital.com, los 14 pares completos quedan
  actualizados.

## Reporte diario automático (2026-07-27, en curso)

`reporte-diario.yml` corre cada día de semana a las 8:00 am hora de
Colombia (13:00 UTC), calcula el barrido con Twelve Data (necesita
internet real, por eso corre en GitHub Actions y no en el entorno de la
sesión de Claude) y **solo imprime el resultado en los logs** — nunca
lo envía a ningún lado por sí solo. Se creó una Routine (`trig_
01Gse2QF87kvjwVQD2dUzU4f`, cuenta de Néstor) que se dispara cada día de
semana a las 13:07 UTC, lee esos logs y le manda el reporte a Néstor por
este mismo chat. Advertencia real: al crearla, el sistema avisó que las
Routines no heredan automáticamente las herramientas de GitHub como un
"conector" — quedó atada a esta sesión (self-bind) en vez de crear una
sesión nueva en cada disparo, con la esperanza de que así sí mantenga
acceso. **No confirmado todavía si el primer disparo automático (mañana)
va a funcionar de punta a punta** — se hizo una prueba manual
(`fire_trigger`) pero no se alcanzó a verificar el resultado en esta
sesión antes de seguir con otras tareas.

## Avisos push al celular (fase 3, 2026-08-07)

Néstor eligió avisos **de la propia app** (Web Push) en vez de Telegram o
correo, sabiendo que tomaba más días, porque es lo único que permite que
**cualquier miembro aprobado** active sus propios avisos — no solo él. Eso
es lo que la vuelve vendible.

Usa el celular **Android y iPhone**, así que el soporte cubre los dos.

### Cómo funciona

El vigía (que ya corría cada hora anotando señales nuevas) ahora, además,
manda un aviso por cada señal nueva. El aviso **no pasa por ningún
servidor nuestro**: va de GitHub Actions directo al servicio de push de
Apple o de Google, cifrado con las claves que dio el navegador de cada
persona.

```
app/src/sw.js                    # el service worker: recibe el aviso y lo muestra
app/src/lib/push/vapid.js        # la clave pública, compartida por app y vigía
app/src/lib/push/soporte.js      # ¿puede este aparato?, y si no, por qué
app/src/lib/push/index.js        # activar/desactivar + guardar en Firestore
app/src/components/AvisosCard.jsx # el interruptor, en la pestaña Barrido
app/scripts/lib/firestore-rest.mjs # leer/borrar suscripciones desde Node
app/scripts/lib/push-envio.mjs     # armar el mensaje y mandarlo
app/scripts/prueba-push.mjs        # prueba completa, sin internet ni claves
```

### Decisiones que no hay que deshacer sin pensarlo

- **El service worker pasó de `generateSW` a `injectManifest`.** Era la
  única forma de manejar `push`. La caché sin internet sigue funcionando
  igual — la hace Workbox, solo que ahora la llamamos nosotros. ⚠️ El
  `sw.js` compilado tiene que quedar **autocontenido y parseable como
  script clásico**: `vite-plugin-pwa` lo registra sin `type: 'module'`, así
  que si alguien mete un `import` que no se pueda empaquetar, se rompe
  también la caché sin internet, y en silencio.
- **La clave VAPID pública vive en `vapid.js`, no en un `.env`.** No cambia
  entre entornos, y en un `.env` un build sin ese archivo compilaría igual
  y los avisos fallarían sin avisar. Vive sola en su archivo para que la
  app y el vigía usen la misma y no puedan desincronizarse.
- ⚠️ **Si se regenera el par de claves VAPID, todas las suscripciones
  guardadas dejan de servir**: hay que vaciar `pushSubs` y cada aparato
  tiene que volver a activar los avisos.
- **Una suscripción por APARATO, no por persona.** El id del documento sale
  de un hash del endpoint, así que reactivar en el mismo aparato sobrescribe
  en vez de duplicar (y hacer sonar el celular dos veces).
- **El idioma se guarda con la suscripción.** El vigía corre en un servidor
  y no tiene otra forma de saber en qué idioma mandar el aviso. `crearT`
  funciona en Node justamente para esto.
- **El envío va al final de `vigia.mjs`, aislado y con `import` dinámico.**
  Para cuando se llega ahí, el historial ya está escrito en disco. Ni un
  fallo de red, ni una clave mal puesta, ni que falte `web-push` instalado
  pueden costarnos esos datos, que son irrecuperables.
- **Filtro de calidad: R/B ≥ 1.5** (`PUSH_RB_MINIMO`). No es que las demás
  señales sean inválidas: es que no vale la pena que suene el celular por
  ellas. Es el mismo umbral que la app ya marca en ámbar.
- **En los logs nunca van las direcciones de envío** (son credenciales: con
  una, cualquiera le manda avisos a ese celular). Solo números y códigos de
  error. Los logs de Actions son públicos.
- **El caso de iPhone sin instalar se explica, no se esconde.** Apple solo
  entrega avisos a las apps instaladas en la pantalla de inicio. La tarjeta
  dice qué tocar en vez de mostrar un "no disponible" sin salida.

### Lo que Néstor tiene que hacer a mano (una sola vez)

No se pueden crear secretos del repositorio desde el entorno de la sesión
(el proxy de red bloquea esos endpoints de la API de Actions), así que:

1. `VAPID_PRIVATE_KEY` — secreto del repo (la mitad privada del par).
2. `FIREBASE_SERVICE_ACCOUNT` — secreto del repo, el JSON completo de una
   cuenta de servicio de Firebase. Es lo que deja al vigía leer las
   suscripciones de todos los usuarios saltándose las reglas.
3. **Publicar las reglas de Firestore** con la colección `pushSubs` en la
   consola de Firebase. Sin esto la app no puede guardar la suscripción.

Sin los dos secretos el vigía sigue funcionando igual y solo anota
`{"estado":"sin-configurar"}` — no falla.

### Estado: ✅ funcionando de punta a punta (2026-08-07)

PR #14 (la app y el envío) y #15 (la prueba a mano), los dos fusionados.
Néstor ya publicó las reglas y pegó los dos secretos.

**Verificado con un aviso real que le sonó en el celular**, no solo
compilando: la prueba a mano encontró 6 suscripciones en Firestore y
entregó 3 (las otras 3 dieron 410 — instalaciones viejas de cuando
desinstaló y volvió a instalar; el vigía las borra solo en su próximo
envío). Eso cubre la cadena entera: los dos secretos, el acceso a
`pushSubs`, que las claves VAPID casen y la entrega al aparato.

### Cómo probar los avisos (y por qué NO con el vigía)

`prueba-avisos.yml` (Actions → "Probar los avisos al celular" → Run
workflow) manda un aviso fijo a todos los aparatos suscritos. No toca la
fuente de precios ni gasta créditos.

⚠️ **No intentes probar los avisos lanzando el vigía a mano.** Ya se
intentó y no sirve, por dos motivos independientes:

1. Antes de llegar al código de los avisos descarga los precios, y el
   barrido gasta 7 de los 8 créditos por minuto del plan gratuito de
   Twelve Data. Va siempre al filo: el lanzamiento a mano del 7 de agosto
   se cayó con `HTTP 429` en `velas.mjs` tras 2 minutos de reintentos, sin
   ejecutar una sola línea de las notificaciones.
2. Aunque los precios bajen bien, solo manda algo si aparece una **señal
   nueva**, que puede tardar días.

### Dos cosas pendientes de decidir

- ⚠️ **El reloj de GitHub se salta horas.** El 7 de agosto, entre las 15:00
  y las 22:30 UTC debería haber corrido el vigía ~7 veces y corrió **2**
  (18:06 y 20:23, las dos bien). O sea que "cada hora" en la práctica es
  "cuando GitHub se acuerda". El propio `vigia.mjs` ya anota el minuto real
  de cada corrida justo para medir esto; con más días de datos habrá que
  decidir si se muda a otro servicio o se acepta.
- **El envío no tiene tiempos de espera.** Ni `firestore-rest.mjs` ni las
  llamadas de `web-push` cortan si el otro lado se queda callado. Como
  `vigia.yml` usa `concurrency` con `cancel-in-progress: false`, una corrida
  colgada haría cola con las siguientes. No ha pasado, pero conviene
  ponerles un límite antes de que pase.

## Historial de señales: ¿acierta la app? (2026-08-08)

Néstor pidió poder ver lo que el vigía guarda. El vigía ya anotaba las
señales, pero **no si acertaron**, que es la única pregunta que importa —
y sin ese dato no hay nada que vender.

```
app/scripts/lib/resolver.mjs      # decide ganada/perdida mirando las velas siguientes
app/src/lib/historialCalc.js      # las cuentas (compartido: lo usan Node y la app)
app/src/lib/useHistorial.js       # baja los datos de la rama `datos`
app/src/components/HistorialTab.jsx  # la pantalla (4ª pestaña)
app/scripts/prueba-resolver.mjs   # 22 comprobaciones, sin internet
```

### Decisiones que NO hay que ablandar

- **Si una vela toca el stop y el objetivo, cuenta como PERDIDA.** La vela
  solo guarda máximo y mínimo, no el orden, así que no se puede saber cuál
  llegó primero. Se elige el peor caso a propósito: un historial que se
  equivoca a favor propio no sirve para decidir si arriesgar dinero.
- **La vela en la que apareció la señal no cuenta**, solo las posteriores.
  La entrada es al cierre de esa vela.
- ⚠️ **En los 7 cruces (EUR/CHF, AUD/JPY…) el máximo y el mínimo son una
  cota MÁS ANCHA que la real** — `computarBarrido` los deriva de las
  divisas contra el dólar. Así que un nivel puede darse por tocado sin
  haberlo sido. Cada resultado lleva `exacto: true/false` y la pantalla
  enseña las dos cuentas por separado: el total y el de solo pares contra
  el dólar, que sí es exacto. **No mezclarlas en un solo porcentaje.**
- **Las señales se identifican por `id@vistoEl`**, no por `id`: la misma
  combinación par/lado/tipo reaparece con el tiempo y cada aparición es una
  operación distinta.
- Una señal cuya vela ya no está entre las 300 descargadas (~12 días) se
  marca `caducada` en vez de reintentarse cada hora para siempre.

### De dónde saca los datos la app

De la rama `datos` por https, con `raw.githubusercontent.com`. Sin base de
datos, sin servidor y sin costo; el repositorio es público. Guardarlo en
Firestore habrían sido miles de escrituras al mes para unos archivos que ya
existen y que además conviene que sean públicos: son la prueba de si la app
acierta.

### Estado

Verificado con `prueba-resolver.mjs` (22 comprobaciones) y en Chromium los
tres estados de la pantalla. ⚠️ **Sin datos reales todavía**: a 8 de agosto
el vigía no había encontrado ni una sola señal, así que la pantalla enseña
su estado vacío. Lo probado con datos es con datos inventados.
