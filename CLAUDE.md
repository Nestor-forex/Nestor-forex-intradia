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

---

# Medir antes de creer (2026-08-12)

El día que la app pasó de "nos parece" a "lo medimos". Néstor lo pidió con
todas las letras: *"siento como que nos estancamos o volvemos a reversa,
necesito que seas sincero"*. Lo que sigue son números, no impresiones.

## El banco de pruebas y su vara de medir

`app/scripts/backtest.mjs` reconstruye, hora por hora, qué señales habría
dado la app sobre 7 meses de velas H1 reales, y las resuelve con el mismo
`resolver.mjs` del vigía. La regla de oro: para decidir la vela `i` solo se
le entregan velas hasta la `i`, y siempre las últimas 300 —exactamente lo
que ve el vigía en producción—. Hay prueba de que no mira el futuro.

Dos ideas que hay que conservar, porque son las que hacen que los números
signifiquen algo:

- **"por 1R"** (resultado por unidad de riesgo) es LA columna. Los pips
  engañan: una operación que gana 200 pips arriesgando 400 pierde dinero.
- **La geometría neutra (1:1)** es la vara de medir. Con stop y objetivo a
  la misma distancia, el resultado depende SOLO de acertar la dirección: por
  encima del 50% hay señal, por debajo hay señal con el signo cambiado, y en
  el 50% no hay nada. Sin esto, una geometría generosa disfraza de acierto
  lo que solo es un objetivo cercano.

## Lo que salió, sin adornos

Con la vara neutra y descontando 1,5 pips de spread por operación:

| | Ops | Acierto | por 1R |
|---|---:|---:|---:|
| Señales de **tendencia** (fuerza relativa) | 670 | 47% | −0,11 |
| Señales de **rango** | 409 | 54% | −0,01 |
| Señales de **retroceso** (nuevas) | 50 | 54% | +0,03 |

Con 670 operaciones ese 47% no es casualidad: **seguir la fuerza relativa en
velas de 1 hora pierde.** El rango llega a empate. El retroceso es lo único
positivo después de costes, y tiene demasiado pocas operaciones.

## Los tres cambios del día

1. **ADX de tendencia: 20 → 35.** El 20 de manual no hacía nada (quitaba 67
   operaciones de 1.210 y dejaba el resultado en el mismo −0,12). El tramo
   **20–25 resultó ser el peor de todos** (−0,25), peor que no tener
   tendencia. Con 35: −0,06. Sigue perdiendo, pero la mitad.

2. **Fuera la confirmación de 4 horas.** En 7 meses no vetó ni una señal:
   las velas H4 se arman con las mismas H1, así que casi nunca contradicen a
   la hora. Un filtro que nunca filtra hace creer que hay una protección que
   no existe. Se fueron `aH4`, `tendH4`, `exigirH4` y `vigilanciaH4`.

3. **Señal nueva de retroceso, EN LA SOMBRA.** Ver abajo.

## ⚠️ Dos trampas que casi cuelan un número falso

- **Un solo umbral para dos cosas opuestas.** El ADX lo quieren ALTO las de
  tendencia y BAJO las de rango, y salían de la misma constante. Subirlo a
  35 habría aflojado el modo rango sin querer. Ahora son `ADX_MIN = 35` y
  `ADX_MAX_RANGO = 20`, con prueba que falla si alguien vuelve a atarlas.
  El síntoma que lo delató: *"sin el filtro salen MENOS operaciones"*, que
  es imposible para un filtro.
- **`node --check` dice que la sintaxis está bien aunque falte un import.**
  Costó una corrida de CI entera. Por eso `.oxlintrc.json` tiene `no-undef`
  con `env: node` para `scripts/**/*.mjs`, y el lint va ANTES de descargar
  precios en el workflow.

## La sombra: cómo se prueba una regla sin arriesgar a nadie

La señal de retroceso (tendencia fuerte + el precio se devolvió a la EMA9
sin romper la EMA21) midió 54% y +0,03 con spread, **pero sobre 50
operaciones**, donde el margen de error es de ±14 puntos: ese 54% podría ser
un 40%. No alcanza para enseñarla, y no alcanza para tirarla.

Así que corre en la sombra: **el vigía la anota, todo lo demás la ignora.**

| | Qué ve |
|---|---|
| La app | nada — `derivarVista` sin `incluirRetrocesos` no las da |
| Los celulares | nada — los avisos salen de `nuevasVisibles` |
| Pantalla de Historial | nada — ni en la lista ni en el porcentaje |
| Registros del vigía | una línea aparte: *"En sombra (sin avisar)"* |

- `TIPOS_EN_SOMBRA` vive en `vigia-nucleo.mjs`, no suelto en `vigia.mjs`:
  es la promesa de que una regla sin aprobar no le llega a nadie, y eso
  tiene que poder comprobarse sin internet. Meter el siguiente experimento
  es añadir una palabra a ese Set.
- `sombra: true` **solo aparece cuando es verdad**, así que el historial ya
  escrito se sigue leyendo igual, sin migración.
- **NO pueden entrar en el porcentaje del Historial.** Ese es el número con
  el que Néstor decide si confiarle dinero a la app; contarían operaciones
  que nunca se le propusieron a nadie. Y no daría ningún síntoma: el número
  seguiría saliendo, solo que significando otra cosa.

**Cuándo volver a mirarlo:** cuando la línea "En sombra" del vigía llegue a
150–200 operaciones. Ahí el número ya significará algo. Antes, no.

## Lo que queda abierto

- **La geometría del retroceso desperdicia la señal.** Con la vara neutra da
  54%, pero con el stop al otro lado de la EMA21 cae al 38% y a −0,01. La
  dirección tiene algo; dónde poner los niveles, no está resuelto. **No
  ajustarlo sobre 50 operaciones**: sería inventar un número que funciona en
  estos 7 meses y en ningún otro sitio.
- **Los avisos al celular siguen pausados** en las dos apps
  (`src/lib/push/pausa.js`), porque el historial real iba 0 de 6.
- **MT5 importa por los DATOS** (spread real, tick volume, velas más finas),
  no por la velocidad. No arregla una regla que pierde: primero la regla.

---

# El rompimiento del rango de apertura (2026-08-25): tampoco

Medido sobre los mismos ~35 meses de velas H1 reales, con la vara neutra 1:1
y spread descontado. **No funciona.**

| Cómo se define "rompió" | Ops | Acierto | Por 1R |
|---|---:|---:|---:|
| Cierra fuera, rango de 1h | 19.571 | 44% | −0,26 |
| Cierra fuera, rango de 2h | 15.509 | 45% | −0,20 |
| **Cierra fuera, rango de 3h** *(el mejor)* | **13.484** | **46%** | **−0,17** |
| Toca el borde, rango de 1h | 21.372 | 42% | −0,26 |
| Toca el borde, rango de 2h | 23.665 | 40% | −0,28 |
| Toca el borde, rango de 3h | 22.435 | 40% | −0,27 |

Y el mejor, troceado por todos lados: Londres 46%, Nueva York 45%, compras
46%, ventas 45%, pares con dólar 47%, cruces 43%. **Ningún corte llega a 50.**

Objetivos más lejos empeora (−0,13 → −0,21 al pasar de 1× a 3× el ancho).
Exigir rangos anchos mejora un poco pero no salva (−0,17 → −0,09 al exigir
2× la anchura media del día previo), y a costa de dejar solo un tercio de las
operaciones.

## Por qué este resultado pesa más que los anteriores

**Trece mil operaciones.** Con esa cantidad, el margen de error del 46% es de
menos de un punto: no es ruido, no es mala suerte, no es "una ventana corta".
Es un no.

Y `toque` va peor que `cierre` en todos los rangos, que es exactamente lo que
predice un mercado sin memoria más un coste fijo: tocar el borde dispara
muchas más veces, y cada disparo paga spread.

## Lo que esto cierra

Con esto van **tres familias de reglas distintas** medidas sobre años en esta
app, y las tres pierden después de costes:

| Familia | La idea | Resultado |
|---|---|---|
| Tendencia / fuerza relativa | perseguir a la divisa fuerte | 46%, −0,12 a −0,14 |
| Retroceso | esperar a que se devuelva | 45%, −0,14 |
| Rompimiento de apertura | seguir al volumen de la sesión | 46%, −0,17 |
| Rango | operar el lateral | 51%, +0,03 **antes** de spread |

El rango es lo único que roza el 50, y descontando spread se va a negativo.

⚠️ **No proponer una cuarta variante de lo mismo sin decir antes qué la hace
distinta de estas tres.** Las tres se probaron creyendo que eran distintas.
Si la siguiente idea también entra "cuando el precio hace X en velas de una
hora", ya está medida.

## Lo único que ha salido positivo, tres veces seguidas

Trocear por el RSI de entrada:

| Fuente | Extendido (RSI ≥70 o ≤30) | Zona sana (30–70) |
|---|---|---|
| Historial real, 37 ops (2026-08-24) | 12% · −0,74 | 50% · +0,22 |
| Medición 3 años | peor | mejor |
| Historial viejo, 11 ops | 0 de 6 | 2 de 5 |

Tres caminos independientes apuntando al mismo sitio: **lo que pierde dinero
es entrar cuando el movimiento ya se hizo.** Eso no es una regla nueva — es
un filtro sobre las que ya existen, y es lo siguiente que hay que medir de
frente en vez de trocear a posteriori.

## Detalle técnico que no hay que romper

`apertura.mjs` **no usa `par.atrAbs`** para filtrar rangos estrechos, aunque
sería lo cómodo. Ese ATR es el del final de toda la serie: usarlo para juzgar
una sesión de hace dos años es mirar el futuro. Usa la anchura media de las
24 velas anteriores al arranque de la sesión.

La comprobación 3 de `prueba-apertura.mjs` lo caza —corre sobre media serie y
sobre la serie entera y exige que el tramo común salga idéntico, también CON
el filtro puesto—. Si alguien "simplifica" eso a `par.atrAbs`, la prueba falla.

---

# El filtro del RSI, medido de frente (2026-08-25)

Lo que salió, sobre los mismos ~35 meses, solo señales de tendencia, vara
neutra 1:1 y spread descontado. La mitad parte en 2025-04-24.

| Umbral | Ops | Señ/mes | Acierto | Por 1R | 1ª mitad | 2ª mitad |
|---|---:|---:|---:|---:|---:|---:|
| Sin filtro *(hoy)* | 7.340 | 207,7 | 46% | −0,12 | −0,12 | −0,13 |
| Rechaza si RSI ≥ 80 | 7.525 | 213,0 | 47% | −0,12 | −0,12 | −0,11 |
| Rechaza si RSI ≥ 75 | 6.877 | 194,6 | 47% | −0,11 | −0,12 | −0,10 |
| **Rechaza si RSI ≥ 70** | **4.975** | **140,8** | **47%** | **−0,10** | **−0,10** | **−0,11** |
| Rechaza si RSI ≥ 65 | 2.438 | 69,0 | 46% | −0,12 | −0,14 | −0,08 |
| Rechaza si RSI ≥ 60 | 606 | 17,1 | 44% | −0,17 | −0,16 | −0,20 |

## Lo bueno: se porta como una regla de verdad, no como una casualidad

Es la primera cosa medida en esta app que pasa las tres pruebas a la vez:

- **La curva es suave.** 80 → 75 → 70 mejora progresivamente y después
  empeora en 65 y 60. No es un pico aislado en un número exacto, que es la
  firma de una coincidencia.
- **Aguanta en las dos mitades.** En 70 da −0,10 y −0,11. El ADX en 35 fallaba
  justo aquí: mejoraba en una ventana y desaparecía en la otra.
- **Deja 141 señales al mes.** No enmudece la app. Ese fue el error de agosto.

## Lo malo, y es lo que decide: el efecto es DIEZ VECES más pequeño de lo
## que decían los troceos

Esta es la lección cara de este día:

| Fuente | Extendido | Zona sana | Diferencia |
|---|---|---|---|
| Historial real, 37 ops | 12% | 50% | **38 puntos** |
| **Medido de frente, 3 años** | — | — | **1 punto** (46% → 47%) |

Los tres "hallazgos" anteriores decían que entrar extendido era catastrófico.
Medido de frente sobre 7.340 operaciones, quitar las extendidas mueve el
acierto **un punto** y el resultado de −0,12 a −0,10.

Aquel 12% de acierto salía de **17 operaciones**. Con 17 tiradas, un 12% y un
45% son perfectamente compatibles con la misma moneda. Y que "saliera tres
veces" no lo confirmaba: las tres eran el mismo troceo a posteriori sobre
muestras chicas, no tres pruebas independientes.

⚠️ **La regla que queda escrita:** un troceo a posteriori sirve para tener una
IDEA, nunca para tener un NÚMERO. El número solo vale si la regla se escribe
de frente y se mide fuera de la muestra donde se le ocurrió a uno.

## Qué hacer con esto

`RSI_MAX` queda en `null` —apagado— hasta que Néstor decida. Encenderlo en 70
es defendible: mejora en las dos mitades, la curva es suave y sigue dando 141
señales al mes. Pero **no convierte la app en ganadora**: la deja en −0,10 por
unidad de riesgo en vez de −0,12. Sigue perdiendo.

Con la geometría real de la app (no la neutra) el efecto es aún menor:
−0,15 sin filtro contra −0,14 en 70.

---

# Lo que se hizo el 2026-09-02

Dos cosas grandes, las dos ya fusionadas, publicadas y comprobadas.

## 1. Contar lo que cuesta operar de verdad (PR #32)

El banco de pruebas descontaba **1 pip de spread, igual para los 18 pares, y
nada de swap**. Las dos cosas empujaban en la misma dirección: hacían que las
reglas parecieran mejores de lo que son.

### El spread ahora va por par

EUR/USD cuesta menos de 1 pip; NZD/CHF o EUR/NZD cuestan 3 o 4. Con un número
único los cruces salían baratos, y son la mitad de la lista. Aquí pesa más que
en swing: los objetivos son de decenas de pips, así que un pip de más se lleva
un pedazo grande del resultado.

Están en `app/scripts/lib/costes.mjs`, **a propósito en el lado alto de lo
normal**: si el número final sale bien con costes generosos, sale bien de
verdad. Para afinarlos, abrir la plataforma con el mercado abierto y cambiar el
número — es el único sitio donde hay que tocarlo.

### El swap SÍ aplica, aunque la app se llame Intradía

Parecía razonable ignorarlo. Pero eso es la INTENCIÓN, no lo que pasa. Medido
sobre las 42 operaciones reales ya resueltas:

| | |
|---|---:|
| duración mediana | 9 horas |
| duración media | 17,9 horas |
| la más larga | 102 horas |
| **cruzaron al menos una noche** | **22 de 42 (52%)** |

⚠️ **Y no se cuenta por duración sino por los cortes reales de las 22:00 UTC.**
Una operación de 6 horas abierta a las 20:00 cruza uno; una de 20 horas abierta
a las 23:00 no cruza ninguno. Depende de la hora de entrada. Eso es
`nochesEntre()`, y es **la diferencia grande con swing**, donde cada vela ES un
día y las noches salen solas de `diasTardados`.

No se elige un número de swap: depende del diferencial de tipos de cada momento
y del margen de cada bróker, cambia mes a mes y no hay histórico. Se barren
cinco niveles y se enseña **a partir de cuál cambia la conclusión**.

### Lo que más valió: sacar `medir()` del script

`medir()` y el barrido de swap vivían dentro de `backtest.mjs`, que necesita
descargar miles de velas para arrancar. De ellos salen TODOS los números con
los que se decide encender o apagar una regla, y eran lo único sin comprobar.
Ahora están en `lib/backtest-nucleo.mjs`, con `prueba-costes.mjs`: 47
comprobaciones en un segundo, sin gastar créditos.

**No es teórico:** al sacar el barrido de swap del script apareció que llamaba
a `generarSenales` con los argumentos cambiados. El linter no lo veía —los dos
nombres existían— y el fallo no habría salido hasta después de gastar los
créditos del día.

⚠️ **Lección al portar pruebas desde swing:** la de costes se copió tal cual y
fallaron 5 comprobaciones. No era un error del código: los datos de mentira de
swing traen `diasTardados`, que aquí no se mira. **Una prueba portada que falla
suele estar diciendo que las dos apps son distintas ahí, no que el código nuevo
esté mal.** Mirar eso primero.

También se añadió `sinJuzgar` al resultado de `medir` (ya estaba en swing): si
un cambio de reglas dejara la mitad de las señales sin resolver, el acierto
seguiría saliendo bonito sobre las pocas que cerraron y nadie vería el hueco.

## 2. La app ya no le pide los precios a Twelve Data (PR #33)

Swing funcionaba así desde el 2026-08-09. Aquí llegó ahora.

### Los dos problemas que cierra

1. **La llave viajaba dentro de la app.** Cualquiera que abriera la página
   podía sacarla del JavaScript descargado y gastar la cuota. Es el mismo
   agujero que ya se cerró con las credenciales de Capital.com, por el mismo
   camino: si el navegador es quien pregunta, el navegador lleva la credencial
   encima. Comprobado sobre el build: la llave ya no aparece en `dist/`, ni la
   palabra «twelvedata».

2. **El techo de suscriptores era MUCHO peor de lo que se dijo.** No eran ~20:
   cada apertura costaba 7 créditos **y se repetía cada 15 minutos con la app
   abierta**. Ocho horas abierta = 224 créditos. **Tres personas agotaban los
   800 del día.** Y al agotarse la app no avisa: deja de traer precios.

### Cómo quedó

El vigía sigue **exactamente igual, una vez por hora**. No se tocó a propósito:
anota las señales, las juzga y manda los avisos, y el historial es lo único de
este proyecto que no se puede recuperar si se estropea. Correrlo cada 30
minutos duplicaría las corridas anotadas y haría sonar el celular el doble.

Aparte va `app/scripts/publicar-barrido.mjs`, que **solo** baja, calcula y
escribe `estado/barrido.json` en la rama `datos`. Corre **cada 30 minutos**
(`.github/workflows/publicar-barrido.yml`, al minuto 50 — el vigía va al 20, y
cada barrido gasta 7 de los 8 créditos por minuto que da el plan gratuito, así
que no pueden coincidir).

| cadencia | créditos/día | por qué no |
|---|---:|---|
| solo el vigía, cada hora | 168 | el reloj de GitHub se salta horas (medidos huecos de 7,6 h): un salto dejaría la app con datos de la mañana por la tarde |
| cada 15 min | 672 | cabe en 800, pero sin sitio para el reporte diario ni el banco de pruebas |
| **cada 30 min** | **336** | menos de la mitad, y **cada hora tiene dos oportunidades** de publicarse |

Total del día: 168 (vigía) + 168 (publicador) + 7 (reporte) = **343 de 800**.

⚠️ **No se pierde ninguna señal.** La app calcula sobre velas de una hora YA
CERRADAS, y esas no se mueven. Solo el precio de la hora en curso pasa de
refrescarse cada 15 min a cada 30.

### La llave YA NO está en este repositorio (2026-09-03, PR #35)

Néstor creó el secreto `TWELVEDATA_KEY` y se borró la línea de
`.env.production`. **En ese orden** — al revés se habrían quedado sin precios el
vigía y el reporte diario.

Cómo se comprobó que el secreto servía **antes** de borrar nada: en el log del
reporte salía `TWELVEDATA_KEY: ***` (GitHub solo enmascara así un secreto que
existe y no está vacío) y el reporte salió con precios reales. Como `leerLlave`
usa **primero** el secreto, la llave que funcionó fue la del secreto. Y después
de borrarla, el publicador volvió a correr con éxito.

⚠️ **SI SE AÑADE UN WORKFLOW NUEVO** que llame a estos guiones, hay que pasarle
el secreto o fallará:

```yaml
    env:
      TWELVEDATA_KEY: ${{ secrets.TWELVEDATA_KEY }}
```

📌 **Esto no es hipotético.** Al hacer el cambio apareció que
`comparar-reglas.yml` llamaba a estos guiones y **se había quedado sin el
`env`**. Habría fallado la próxima vez que alguien lo lanzara, y con la llave ya
borrada, sin explicación. Se descubrió revisando los workflows uno por uno antes
de borrar nada. **Revisar TODOS, no solo los que uno recuerda.**

✅ **En Swing también está cerrado** (sus PR #34 y #35, el mismo día). Era **la
misma llave en los dos** y comparten los 800 créditos, así que no bastaba con
sacarla de aquí: mientras siguiera publicada allí, seguía a la vista. Ahora no
está en ninguno de los dos repositorios.

Si algún día hay que cambiarla, se cambia en **los dos** secretos.

### La prueba nueva, y por qué su mercado inventado costó varios intentos

`app/scripts/prueba-barrido-publicado.mjs` corre el barrido sobre un mercado
inventado, lo publica, lo relee **pasando por JSON como el navegador** y exige
que `derivarVista` saque la vista idéntica. Vigila los dos fallos invisibles:
que **falte un campo** (la app se ve rara, no da error) y que **se cuele una
serie larga** (18 KB → más de 400).

⚠️ El primer mercado era una tendencia limpia: daba ADX 100 y **cero setups**,
porque una tendencia sin retrocesos deja el RSI clavado arriba y el filtro los
rechaza todos. **La prueba pasaba comparando dos listas vacías.** Ahora cada
divisa lleva una onda de periodo medio **con su propia fase**. Si se toca ese
mercado, mirar que siga pasando la comprobación de "más de cero setups".

⚠️ `armarBarrido` quita las series largas **por nombre de lo que SALE**, no de
lo que entra. Al revés, el día que `computarBarrido` calcule un campo nuevo la
app se quedaría sin él y el fallo aparecería como una pantalla rara. De que no
se cuele otra serie larga se encarga la prueba (falla si un campo publicado
trae más de 30 números).

### Textos que habían quedado falsos

El pie decía «precio en vivo (se actualiza cada 15 min)», verdad cuando la app
llamaba a la API ella misma. Corregido en los **13 idiomas**, junto con
«Descargando velas H1 en vivo…».

⚠️ Esta app **no tiene** el comparador de diccionarios que sí tiene swing. Se
comprobó a mano (254 claves, mismos tipos en los 13). Si se vuelven a tocar los
idiomas, conviene portarlo.

### Cómo se verificó, y cómo verificar en este entorno

No solo compilando. Con **Chromium**, sirviendo la app compilada y
alimentándola con el `barrido.json` **real de producción**: la pestaña Barrido
y el tablero completo pintaron enteros, en español, con precios reales
(EUR/USD 1.1585, una señal de venta en USD/JPY con sus niveles) y **cero
errores de consola**. Ninguna llamada a Twelve Data.

⚠️ **GitHub Pages está bloqueado** desde el entorno de estas sesiones, así que
la app publicada no se puede abrir desde aquí; `raw.githubusercontent.com` sí.
Chromium tampoco sale a internet solo: hay que pasarle
`proxy: { server: process.env.HTTPS_PROXY }`, y aun así falla contra algunos
destinos. Lo que funciona siempre es bajar el archivo con `curl` e interceptar
la petición en Playwright con ese contenido. El binario está en
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.


## La API de GitHub Actions va con retraso — TODA, no solo el estado

Salió al verificar lo de la llave y vale para cualquier sesión futura que lance
un workflow y espere el resultado.

El **estado** dijo `in_progress` durante 10 minutos de un trabajo que había
terminado en 65 segundos. Ya había pasado el 2026-08-28.

📌 **Y aquí me equivoqué sobre la marcha, así que queda escrito:** al ver que
los logs daban 404 mientras el estado mentía, concluí que *los logs sí eran
fiables* —404 mientras corre, disponibles al terminar— y lo di por bueno. **Es
falso.** En la corrida siguiente los logs dieron 404 durante **13 minutos** de
un trabajo que también había terminado en 65 segundos. El 404 no distingue
«sigue corriendo» de «el log todavía no está publicado».

**Qué hacer entonces:** no deducir nada de que algo tarde en aparecer. Esperar,
reintentar, y **mirar las marcas de tiempo DENTRO del log** cuando por fin
llegue: ahí sí está cuándo empezó y cuándo terminó. Si el tiempo que dice el log
es el normal (una corrida del vigía son ~15 s, con reintentos por el límite de
Twelve Data unos 2 min y medio), no pasó nada raro por mucho que la API tardara
en contarlo.


---

# Fase 3 (2026-09-03): que las dos apps no se separen en silencio

Hecha en **las dos apps** a la vez, que es justo de lo que trata.

## El problema, con nombres y apellidos

Swing e Intradía viven en repositorios separados y son casi idénticas por
dentro. Cada arreglo hay que hacerlo **dos veces**, y cuando se olvida una, no
falla nada: las dos siguen compilando, las dos siguen publicándose, y la
diferencia queda ahí meses hasta que alguien la busca.

Ya había pasado cuatro veces documentadas:

- el `start_url` del ícono instalable apuntaba a la raíz del dominio en las dos;
- la pantalla de detalle de la señal se hizo en Intradía y hubo que portarla;
- la llave de Twelve Data se sacó de un repositorio y siguió publicada en el
  otro — y era **la misma llave**, así que no sirvió hasta hacerlo en los dos;
- y un cierre de etiqueta que quedó en otra línea sin ninguna razón, solo
  porque alguien editó una app y no la otra.

## Lo medido antes de tocar nada

De los 82 archivos de código, **76 existen con el mismo nombre en las dos
apps**. Comparándolos uno a uno salieron tres grupos:

| grupo | cuántos | qué son |
|---|---:|---|
| idénticos | 23 | el armazón: sesión, miembros, idioma, avisos, calculadora |
| casi idénticos (1-15%) | 13 | difieren por la identidad de la app… o por nada |
| genuinamente distintos | el resto | las apps de verdad |

## Lo que se hizo

**1. `src/lib/identidad.js`** — el único archivo de `src/` que sabe si esto es
Swing o Intradía: `APP`, `NOMBRE_APP` y `PREFIJO` (`nfs`/`nfi`). Tres líneas
distintas, el resto igual. Con eso, tres archivos más pasaron a ser idénticos.

**2. Se borró el ruido.** Cuatro archivos (`Auth`, `Pendiente`, `MiembrosTab`,
`CalculadoraTab`) diferían SOLO en dónde iba el cierre de una etiqueta. Se
comprobó por máquina que la diferencia era únicamente espacios antes de tocar
nada.

**3. `scripts/gemelos.mjs`** — el manifiesto: qué archivos DEBEN ser idénticos
(30 hoy) y, aparte, la lista de **PRIMOS** con el motivo escrito de por qué
cada uno difiere. Esa segunda lista es documentación pura y vale tanto como la
primera: evita que alguien "arregle" una diferencia que existe por una buena
razón.

**4. `scripts/prueba-gemelos.mjs` + `.github/workflows/gemelos.yml`** — compara
contra el otro repositorio (que es público, se clona sin credenciales) en cada
push, en cada PR y una vez al día. Lo del día suelto no sobra: **la divergencia
puede nacer de un cambio en el OTRO repositorio**, y eso no dispara nada aquí.

## Las dos decisiones que no hay que ablandar

⚠️ **La lista de gemelos va ESCRITA A MANO.** Sería más cómodo calcularla
("todos los que hoy son iguales") y sería inútil: en cuanto dos archivos se
separaran, saldrían solos de la lista y la prueba seguiría en verde. Una prueba
que se adapta a lo que encuentra no comprueba nada.

⚠️ **NO se unifica nada de trading.** Pares, umbrales, medias, geometría del
stop: distintos en cada app por buenas razones y medidos por separado. Está
comprobado que el filtro de RSI mejora Intradía y empeora Swing. `identidad.js`
lleva un aviso para que nadie meta ahí un número de esos.

## Dos fallos que salieron al probar la propia prueba

📌 **La prueba ignoraba la ruta que se le pasaba a mano.** La trataba como una
candidata más y, si no le cuadraba, seguía buscando por su cuenta — o sea que
un robot con la ruta mal escrita habría acabado comparando contra otra cosa y
pasando en verde. Corregido: si se le da una ruta, se usa **esa y ninguna
otra**, y si no vale, falla.

📌 **Y al comprobar que la prueba "muerde" me equivoqué yo:** el comando con el
que rompí un archivo a propósito no cambió nada (insertaba texto antes de un
`import` y ese archivo no tenía ninguno), así que interpreté un falso "no
detecta" como fallo de la prueba. Al romperlo de verdad, sí falló. **Antes de
concluir que una comprobación no muerde, comprobar que el daño se hizo.**

## Cómo se verificó

Lint, build y **todas** las pruebas sin internet en los dos repos. Y en
**Chromium**, las dos apps compiladas: arrancan en español, y al cambiar de
idioma cada una guarda con **su** prefijo (`nfs_idioma` / `nfi_idioma`) — que
era exactamente lo que podía romperse al extraer la identidad — con cero
errores de consola.


---

# El reloj de GitHub, medido de verdad (2026-09-03)

Néstor preguntó si el retraso de GitHub perjudica las señales. La respuesta
corta es **sí, pero no por donde él pensaba**, y el tamaño del problema era
peor de lo que estaba escrito.

## Lo medido, sobre las 184 corridas registradas del vigía

| | |
|---|---:|
| retraso mediano | **35 minutos** |
| corridas puntuales (<5 min) | **6 de 184 (3%)** |
| corridas con +30 min de retraso | **116 de 184 (63%)** |
| el peor hueco sin vigilar | **13,4 horas seguidas** |
| corridas perdidas en huecos | **220** |

## ⚠️ Y el contraste que lo explica todo: en Swing NO pasa

El vigía de Swing corre **una vez al día** y va **18 de 18 corridas**, con 10
minutos de retraso mediano. Impecable.

**El reloj de GitHub es fiable para tareas diarias y muy poco fiable para
tareas por hora.** No es un error de configuración y no hay ajuste que lo
corrija: cuando GitHub tiene carga, descarta las tareas frecuentes.

## Qué se pierde de verdad, y qué no

**NO se pierde el barrido que ve la app.** Lo publican DOS workflows
independientes (el vigía y `publicar-barrido`), y eso funciona: comprobado con
el archivo real, tenía 26 minutos de antigüedad.

**Sí se pierden dos cosas:**

1. **Avisos al celular.** Si el vigía debía correr a las 10:00 y no corre, una
   señal que apareció y se desvaneció dentro de esa hora no avisa nunca.
2. ⚠️ **Y el historial queda INCOMPLETO.** El banco de pruebas mide como si el
   vigía revisara cada hora; en la realidad revisa ~40% de las veces. O sea que
   las señales que entran al historial real son un subconjunto arbitrario de
   las medidas. **Eso puede explicar en parte por qué el historial real no
   cuadra con el backtest** (la reversión 0 de 5 en Swing, el 32% de aquí). No
   lo explica todo, pero es un factor que se estaba ignorando.

## Lo que se hizo, y la prueba de que funciona

Se añadió un segundo horario a `publicar-barrido.yml` (minutos 5 y 35, con el
vigía en el 20 → **tres intentos por hora**).

📌 **Antes de hacerlo se comprobó que la redundancia sirve, con datos.** La
duda era razonable: si GitHub descarta las tareas frecuentes bajo carga, poner
más podría no dar más corridas. Medido el 3 de septiembre, de 16 horas:

| | horas con datos nuevos |
|---|---:|
| solo con el vigía | **3 de 16** |
| con el vigía + el publicador | **7 de 16** |

**Los dos fallan de forma INDEPENDIENTE**, así que cada horario nuevo es una
oportunidad de verdad y no una repetición del mismo fallo.

Cuota: 48 corridas del publicador (336) + 24 del vigía (168) + 7 del reporte =
**511 de 800**, dejando ~289 libres para una corrida a mano del banco de
pruebas.

## Lo que NO se tocó, a propósito

⚠️ **El vigía sigue una vez por hora.** Duplicarlo duplicaría las corridas
anotadas y haría sonar el celular el doble. El historial es lo único de este
proyecto que no se puede recuperar si se estropea.

⚠️ **Swing no se tocó**: no tiene el problema (18 de 18).

## Lo que queda pendiente y es lo más valioso

Esto mejora **el barrido que ve la app**, no los **avisos**, que siguen
dependiendo del vigía. Para arreglar los avisos y el historial hay dos caminos:

1. **Un disparador externo** (un servicio gratuito que llame a la API de GitHub
   a la hora exacta). Puntual de verdad, pero añade una credencial que cuidar.
2. **Que el vigía RECUPERE los huecos**: tiene las últimas 300 velas, así que
   podría mirar hacia atrás y anotar las señales que se perdió mientras no
   corría. No arreglaría los avisos (una señal de hace 5 horas ya no sirve para
   operar) pero **sí completaría el historial**, que es lo que hace falta para
   saber si las señales sirven.

La 2 es más valiosa para el objetivo de fondo del proyecto y no añade
credenciales. No se ha hecho: toca el vigía, y eso pide mucho cuidado.


---

# Fase 4 en Intradía (2026-09-03): ninguna regla gana. Y el 54% era ruido

## El resultado del retroceso, que era la única candidata

564 operaciones, 33% cruzaron alguna noche, 0,47 de media:

| swap/noche | acierto | por 1R | coste medio |
|---|---:|---:|---:|
| sin costes | 45% | −0,110 | — |
| solo spread | 45% | **−0,164** | 2,0 pips |
| + 0,50 | 45% | −0,169 | 2,2 pips |
| + 2,00 | 45% | −0,185 | 2,9 pips |

**→ Pierde ya solo con el spread. El swap ni hace falta.**

Y acierta el **45%**: con la vara neutra 1:1, por debajo del 50% significa que
la señal apunta al **lado equivocado**.

## ⚠️ LA LECCIÓN, Y ES LA MÁS CARA DEL PROYECTO

Esta misma regla medía **54% y +0,03** cuando se decidió dejarla corriendo en
la sombra. Eran **50 operaciones**, con un margen de ±14 puntos. Ahora, con
**564 operaciones y costes honestos**, sale 45% y −0,164.

**Aquel 54% era ruido.** La advertencia estaba escrita en el pie del propio
informe («con menos de ~30 operaciones el porcentaje puede ser suerte, y con
100 un 58% puede ser en realidad un 49%») y aun así se guardó la esperanza en
ese número durante semanas.

📌 **Regla que sale de aquí: un número medido sobre menos de ~200 operaciones
no es un resultado, es una pista.** Y una pista no justifica dejar una regla
«en pruebas» esperando que se confirme: justifica medirla mejor.

## Las otras candidatas, para no dejar cabos sueltos

| regla | por 1R con costes |
|---|---:|
| Rompimiento del rango de apertura (6 variantes) | de −0,10 a −0,31 |
| Filtro de RSI (mejor umbral, 70) | −0,11 |
| La app tal cual | −0,096 |
| Las de RANGO de la app | +0,02 **sin** costes → negativo con ellos |

**Ninguna gana.**

## Un contraste con Swing que conviene tener claro

| | lo que mata el resultado |
|---|---|
| **Intradía** | **el spread** (de −0,029 a −0,096 de golpe); el swap añade poco, las operaciones duran 0,57 noches |
| **Swing** | **el swap** (de +0,085 a +0,016 a 1 pip); el spread pesa menos, los objetivos son largos |

Es la diferencia entre objetivos cortos y largos, y explica por qué las dos
apps necesitan modelos de coste distintos — lo que la Fase 2 hizo.

## Dónde está la ventaja, y dónde no

| | mejor regla | por 1R con costes |
|---|---|---:|
| **Swing** | reversión con el RSI estirado | **+0,051** |
| **Intradía** | ninguna | todas negativas |

⚠️ **La ventaja medida está en Swing.** No en esta app. Cualquier trabajo que
busque hacer vendibles las señales debería empezar por ahí, y no por seguir
buscando en Intradía, donde se han medido ya cuatro familias de reglas sin
encontrar una sola positiva después de costes.

---

# La reversión tampoco funciona en Intradía (2026-09-03)

Es la **quinta familia de reglas** que se mide aquí y la quinta que falla. Y
era la que más razones tenía para funcionar: es la única que ha dado positivo
en todo el proyecto (en Swing, +0,051 por 1R con costes) y tiene respaldo
publicado fuera de él —la investigación sobre reversión en velas horarias de
Forex encuentra rebotes generalizados y significativos, más fuertes en el
solape de Londres con Nueva York—.

Medido sobre ~19.000 velas de una hora, vara neutra 1:1, spread por par y medio
pip de swap por noche.

| regla | ops | acierto | sin costes | **con costes** |
|---|---:|---:|---:|---:|
| R1. Comprar lo débil, vender lo fuerte | 6.091 | 51% | +0,011 | **−0,056** |
| R2. …y solo con el RSI estirado (35/65) | 5.302 | 50% | −0,005 | **−0,074** |
| R3. …y solo lejos de la EMA21 | 6.084 | 51% | +0,011 | **−0,056** |
| R4. R2 solo en el solape Londres-NY | 1.824 | 51% | +0,019 | **−0,050** |
| R5. CONTROL: la inversión, de frente | 6.075 | 50% | +0,009 | **−0,058** |
| *(la app tal cual, misma vara)* | 7.217 | 49% | −0,028 | −0,104 |

**Las cinco pierden.** Y las tres que salen positivas sin costes lo hacen por
+0,01, que es nada: el spread solo ya se lleva 0,05 y las hunde a todas.

## Por qué falla aquí lo que en Swing funciona

**El spread.** Es el mismo en las dos apps —los mismos pares, los mismos 2
pips de media— pero en Intradía los objetivos son cortos, así que esos 2 pips
son una fracción mucho mayor del riesgo de cada operación. En Swing la misma
regla arranca de +0,103 y le sobra margen para pagarlos; aquí arranca de +0,011
y no le llega ni para eso.

O sea: **no es que la reversión no exista en velas de una hora.** Es que el
efecto es demasiado pequeño para pagar el peaje de entrar y salir. R1 gana
+0,011 por operación y el peaje cuesta 0,06.

## Lo que sí se ve, aunque no salve nada

**Por franja horaria (R2, con costes):**

| franja (UTC) | ops | acierto | por 1R |
|---|---:|---:|---:|
| Asia (0-7) | 1.378 | 49% | −0,089 |
| Londres sin NY (7-12) | 1.096 | 48% | −0,115 |
| SOLAPE Londres-NY (12-16) | 1.494 | 50% | −0,077 |
| **NY sin Londres (16-21)** | 939 | **53%** | **−0,012** |
| Noche (21-24) | 395 | 51% | −0,039 |

La franja de Nueva York sin Londres es claramente la mejor, y coincide con lo
que dice la literatura sobre reversiones en hora de Nueva York. **Pero sigue
siendo negativa**, y son 939 operaciones de una sola franja elegida DESPUÉS de
ver la tabla. No es un hallazgo: es, como mucho, dónde mirar si algún día se
retoma esto con costes más baratos.

**Barrido de umbrales del RSI** (la prueba de si el número lo elegí yo):

| RSI compra/venta | ops | por 1R | 1ª mitad | 2ª mitad |
|---|---:|---:|---:|---:|
| 25 / 75 | 2.446 | −0,092 | −0,117 | −0,059 |
| 30 / 70 | 4.121 | −0,077 | −0,080 | −0,073 |
| 35 / 65 | 5.302 | −0,074 | −0,084 | −0,060 |
| 40 / 60 | 5.883 | −0,061 | −0,058 | −0,065 |
| 45 / 55 | 6.052 | −0,058 | −0,052 | −0,067 |
| 50 / 50 | 6.086 | −0,056 | −0,049 | −0,067 |

La columna entera es negativa y cambia suave: no hay ningún umbral escondido
que funcione. Y fíjese en el sentido: **cuanto MENOS exigente es el filtro del
RSI, mejor sale** — o sea que el filtro no aporta nada, solo quita operaciones.
Justo lo contrario que en Swing, donde el filtro del RSI era lo único que hacía
sobrevivir a la regla.

⚠️ **Esto confirma otra vez la regla de "lo medido en una app no vale para la
otra".** Se resistió la tentación de copiar el umbral 35/65 de Swing y se barrió
en su lugar; de haberlo copiado, se habría elegido precisamente uno de los peores.

## El marcador de Intradía, completo

| familia | por 1R con costes |
|---|---:|
| La app tal cual (tendencia) | −0,096 |
| Las de RANGO de la app | negativo |
| Rompimiento del rango de apertura (6 variantes) | −0,10 a −0,31 |
| Retroceso (564 ops) | −0,164 |
| **Reversión (5 variantes)** | **−0,050 a −0,074** |

**Cinco familias, ninguna positiva.** Esto ya no parece mala suerte con las
reglas elegidas: coincide con [el estudio de los límites estructurales de las
señales intradía sobre OHLCV](https://arxiv.org/abs/2605.04004), que probó 14
familias sobre 947 días y no pasó ninguna, y concluye que una ventaja intradía
real necesita datos propios o ventajas de ejecución que no se obtienen de
máximo/mínimo/cierre por hora.

📌 **Consecuencia práctica: dejar de buscar reglas nuevas en Intradía con esta
fuente de datos.** No es que falte probar la correcta; es que la vía está
medida y agotada. Si alguna vez se retoma, tendría que ser con otra cosa
—datos de otro tipo, o costes mucho más baratos—, no con otro indicador sobre
las mismas velas.
