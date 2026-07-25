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
- ✅ **(24 de julio de 2026, más tarde el mismo día)** Néstor consiguió su
  llave gratuita de [twelvedata.com](https://twelvedata.com) y la pegó en
  `VITE_TWELVEDATA_KEY` (`app/.env.production`).
  **Importante para la próxima sesión:** el fetch de Twelve Data
  (`useMarketData.js`) NO se pudo probar contra la API real desde este
  entorno de desarrollo (el proxy de red de la sesión bloquea
  `api.twelvedata.com`, igual que bloqueó otros dominios antes). Se
  publicó "a ciegas" confiando en la documentación de Twelve Data — si el
  usuario reporta que la pestaña Barrido muestra un error en vez de
  precios, el mensaje de error (viene de `e.message` en el catch de
  `useMarketData.js`, se muestra tal cual en pantalla) es la primera
  pista: probablemente el formato de la respuesta batch de `time_series`
  no es exactamente `{ [simbolo]: { values: [...] } }` como se asumió, o
  cambió algo en la API. Pedirle una captura de pantalla del error exacto
  y ajustar `obtenerVelas()` en consecuencia.
- ✅ Reglas de Firestore (con `trades_intradia`) publicadas en la consola
  de Firebase por Néstor. PR correspondiente (`nestor-forex/nestor-forex`
  #7) fusionado.
- ✅ Primera publicación en GitHub Pages hecha (hubo que activar
  manualmente "Source: GitHub Actions" en Settings → Pages del repo la
  primera vez — paso normal de GitHub para cualquier repo nuevo, no un
  error de configuración; ya quedó automático de ahí en adelante).

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
