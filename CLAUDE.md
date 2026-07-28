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
  Twelve Data" sola, tal como se diseñó), pero el precio en vivo
  **todavía no funciona**. Causa más probable: la cuenta de TrueFX se
  registró pero le falta activar algo — el panel "Mi cuenta" del
  usuario mostraba pestañas "Suscripciones" y "Pagos", sugiriendo que
  TrueFX ahora exige elegir/activar un plan (aunque sea gratuito) antes
  de dar acceso a la API, no solo registrarse. **Pendiente:** pedirle a
  Néstor que revise esas pestañas en `truefx.com/truefx-account/` y
  confirme si hay algo por activar/suscribir.
- Fuera de eso, la fórmula de conversión (TrueFX cotiza EUR/GBP/AUD/NZD
  como "USD por 1 X", hay que invertir esos 4; JPY/CHF/CAD ya vienen
  como "X por 1 USD", se usan tal cual) y el parseo del CSV
  (`bidGrande + bidPips/100000`, promedio bid/offer) están hechos según
  la documentación oficial de TrueFX pero **sin verificar contra una
  respuesta real con datos** (solo se pudo confirmar el mensaje de
  error) — revisar de nuevo esa parte en cuanto la cuenta quede
  autorizada, por si el formato real difiere del documentado.

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
