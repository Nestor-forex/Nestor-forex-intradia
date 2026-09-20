// Comprobaciones de `src/lib/lss.js` — el NFX-LSS traducido del Pine.
//
// Sin internet y sin créditos: todo con velas inventadas a mano, diseñadas
// para que cada una aísle UNA cosa.
//
// ⚠️ Lo que más importa aquí son las tres comprobaciones que vigilan los
// fallos que tenía el Pine original y que NO se portaron. Si alguien
// «simplifica» esta lógica hacia el original, tienen que ponerse rojas.

import { pivotesConocidos, senalesLSS, atrWilder } from '../src/lib/lss.js'

let mal = 0
let n = 0
const ok = (cond, que) => {
  n++
  if (!cond) {
    mal++
    console.log(`  MAL — ${que}`)
  }
}
const titulo = (t) => console.log(`\n${t}`)

// Atajo: vela a partir de máximo, mínimo y cierre.
const V = (h, l, c) => ({ h, l, c })
// Una vela plana alrededor de un precio, para rellenar.
const plana = (p) => V(p + 1, p - 1, p)

// ───────────────────────────────────────────────────────────────────────────
titulo('1. Pivotes: qué es un pivote y CUÁNDO se puede usar')

{
  // Un pico claro en el índice 3, con 2 velas más bajas a cada lado.
  const velas = [plana(10), plana(10), plana(10), V(20, 18, 19), plana(10), plana(10), plana(10)]
  const { altos } = pivotesConocidos(velas, 2)

  ok(altos[3] === null, 'en la barra del pivote todavía NO se conoce')
  ok(altos[4] === null, 'una barra después tampoco')
  ok(altos[5] === 20, 'se conoce exactamente `n` barras después (retraso de confirmación)')
  ok(altos[6] === 20, 'y se sigue conociendo después')

  // ⚠️ ESTA ES LA QUE IMPIDE MIRAR EL FUTURO. Si alguien quitara el retraso,
  // `altos[3]` valdría 20 y la regla usaría en la barra 3 un dato que en la
  // barra 3 nadie tenía. Mediría de maravilla y sería imposible de operar.
  ok(
    altos.slice(0, 5).every((x) => x === null),
    'NINGUNA barra anterior a la confirmación conoce el pivote',
  )
}

{
  // Tramo plano: no hay pivote, porque no es estrictamente mayor.
  const velas = Array.from({ length: 9 }, () => plana(10))
  const { altos, bajos } = pivotesConocidos(velas, 2)
  ok(
    altos.every((x) => x === null) && bajos.every((x) => x === null),
    'un tramo plano no produce pivotes (hace falta ser estrictamente mayor)',
  )
}

{
  const velas = [plana(10), plana(10), V(20, 18, 19), plana(10)]
  ok(pivotesConocidos(velas, 5).altos.every((x) => x === null), 'sin velas suficientes no inventa pivotes')
  ok(pivotesConocidos([], 2).altos.length === 0, 'una serie vacía no revienta')
}

// ───────────────────────────────────────────────────────────────────────────
titulo('2. La señal completa: barrido + ruptura')

// Construye el caso de manual: pivote bajo, luego pivote alto, luego una vela
// que barre el mínimo y cierra dentro, y después una que rompe el máximo.
function mercadoConSenal({ separacion = 1 } = {}) {
  const velas = [
    plana(100), plana(100),
    V(101, 90, 100), // 2 — pivote BAJO en 90
    plana(100), plana(100),
    V(110, 99, 100), // 5 — pivote ALTO en 110
    plana(100), plana(100),
    V(101, 85, 100), // 8 — BARRIDO: mecha a 85, por debajo de 90, y cierra en 100
  ]
  for (let k = 0; k < separacion - 1; k++) velas.push(plana(100))
  velas.push(V(115, 99, 112)) // RUPTURA: cierra en 112, por encima de 110
  velas.push(plana(112))
  return velas
}

{
  const velas = mercadoConSenal()
  const s = senalesLSS(velas, { swingLen: 2, sweepWindow: 10, rr: 2 })

  ok(s.length === 1, `sale exactamente una señal (salieron ${s.length})`)
  const x = s[0] || {}
  ok(x.lado === 'COMPRA', 'es de COMPRA (se barrió abajo y se rompió arriba)')
  ok(x.i === 9, 'en la barra de la ruptura, no en la del barrido')
  ok(x.iSweep === 8, 'y recuerda en qué barra fue el barrido')
  ok(x.entrada === 112, 'la entrada es el cierre de la ruptura')

  // ⚠️ LA DECISIÓN DE NÉSTOR: el stop en la MECHA del barrido (85), no en el
  // pivote (90). Si alguien lo devuelve al pivote, esta se pone roja.
  ok(x.sl === 85, `el stop va en el mínimo de la vela barrida, no en el pivote (salió ${x.sl})`)
  ok(x.tp === 112 + (112 - 85) * 2, 'el objetivo está a `rr` veces el riesgo')
  ok(x.evento === 'BOS', 'sin tendencia previa contraria, el evento es BOS')
}

{
  // La misma ruptura, pero el barrido queda FUERA de la ventana.
  const velas = mercadoConSenal({ separacion: 12 })
  ok(senalesLSS(velas, { swingLen: 2, sweepWindow: 10, rr: 2 }).length === 0, 'fuera de la ventana no hay señal')
  ok(
    senalesLSS(velas, { swingLen: 2, sweepWindow: 20, rr: 2 }).length === 1,
    'y con la ventana más ancha, la misma ruptura sí da señal',
  )
}

{
  // Sin barrido ninguno: la ruptura sola no basta… salvo que se apague la exigencia.
  const velas = [
    plana(100), plana(100),
    V(101, 90, 100),
    plana(100), plana(100),
    V(110, 99, 100),
    plana(100), plana(100), plana(100),
    V(115, 99, 112),
    plana(112),
  ]
  ok(senalesLSS(velas, { swingLen: 2, sweepWindow: 10 }).length === 0, 'sin barrido no hay señal')
  ok(
    senalesLSS(velas, { swingLen: 2, sweepWindow: 10, exigirSweep: false }).length === 1,
    'con `exigirSweep: false` la ruptura sola sí señala (la fila de control)',
  )
}

// ───────────────────────────────────────────────────────────────────────────
titulo('3. En qué se aparta del Pine original, y por qué')

{
  // 📌 AQUÍ ME EQUIVOQUÉ Y LA PRUEBA LO DESTAPÓ.
  //
  // Afirmé que `ta.crossover(close, lastSwingHigh)` tenía un fallo: que al
  // aparecer un pivote más bajo que el precio, el nivel caería por debajo del
  // cierre y el cruce se dispararía solo. Escribí una comprobación para ello
  // y, al romper el código a propósito, **NO se puso roja** — o sea que no
  // medía nada.
  //
  // El motivo es estructural y ahora se comprueba de frente: un pivote en la
  // barra `p` se confirma en `p + n`, y exige que `p+1 … p+n` tengan máximos
  // MÁS BAJOS. Como `p+n` es una de ellas, su cierre queda por debajo del
  // nivel recién nacido. **El nivel nunca aparece ya rebasado.**
  const velas = []
  let precio = 100
  // Mercado al azar pero repetible, para que esto no dependa de la suerte.
  let semilla = 12345
  const azar = () => ((semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let i = 0; i < 400; i++) {
    precio += (azar() - 0.5) * 20
    velas.push(V(precio + azar() * 10, precio - azar() * 10, precio))
  }

  const { altos, bajos } = pivotesConocidos(velas, 3)
  let cambios = 0
  let yaRebasado = 0
  for (let i = 1; i < velas.length; i++) {
    if (altos[i] !== null && altos[i] !== altos[i - 1]) {
      cambios++
      if (velas[i].c > altos[i]) yaRebasado++
    }
    if (bajos[i] !== null && bajos[i] !== bajos[i - 1]) {
      cambios++
      if (velas[i].c < bajos[i]) yaRebasado++
    }
  }
  ok(cambios > 20, `el mercado de prueba mueve el nivel bastantes veces (${cambios})`)
  ok(yaRebasado === 0, `un nivel recién confirmado NUNCA nace ya rebasado (${yaRebasado} casos)`)
}

{
  // Y la consecuencia práctica: congelar el nivel o compararlo al estilo del
  // Pine da EXACTAMENTE las mismas rupturas. Si alguien cambia el significado
  // del nivel, esto se pone rojo.
  const velas = []
  let precio = 100
  let semilla = 99991
  const azar = () => ((semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let i = 0; i < 600; i++) {
    precio += (azar() - 0.5) * 20
    velas.push(V(precio + azar() * 10, precio - azar() * 10, precio))
  }

  const n = 3
  const { altos, bajos } = pivotesConocidos(velas, n)
  const congelado = []
  const estiloPine = []
  for (let i = 1; i < velas.length; i++) {
    const a = altos[i]
    const b = bajos[i]
    if (a !== null && velas[i - 1].c <= a && velas[i].c > a) congelado.push(`A${i}`)
    if (b !== null && velas[i - 1].c >= b && velas[i].c < b) congelado.push(`B${i}`)
    // Como el Pine: el cierre de ayer contra el nivel de AYER.
    const aPrev = altos[i - 1]
    const bPrev = bajos[i - 1]
    if (a !== null && aPrev !== null && velas[i - 1].c <= aPrev && velas[i].c > a) estiloPine.push(`A${i}`)
    if (b !== null && bPrev !== null && velas[i - 1].c >= bPrev && velas[i].c < b) estiloPine.push(`B${i}`)
  }
  ok(congelado.length > 10, `el mercado produce rupturas de sobra (${congelado.length})`)
  ok(
    congelado.join(',') === estiloPine.join(','),
    `congelar el nivel da las mismas rupturas que el estilo Pine (${congelado.length} vs ${estiloPine.length})`,
  )

  // ⚠️ Y AHORA SE ATA AL MÓDULO. Las dos listas de arriba se calculan aquí
  // mismo, así que por sí solas no vigilan `lss.js` — comprobarían su propia
  // aritmética aunque el módulo hiciera cualquier otra cosa. Esto exige que
  // cada señal REAL caiga en una de esas rupturas.
  const marcas = new Set(congelado)
  const reales = senalesLSS(velas, { swingLen: n, sweepWindow: 9999, exigirSweep: false })
  const huerfanas = reales.filter((x) => !marcas.has((x.lado === 'COMPRA' ? 'A' : 'B') + x.i))
  ok(reales.length > 5, `el módulo saca señales en ese mercado (${reales.length})`)
  ok(huerfanas.length === 0, `toda señal cae en una ruptura de la lista (${huerfanas.length} huérfanas)`)
}

{
  // ⚠️ ESTO SÍ ES UN FALLO DEL PINE, y está comprobado: allí la condición del
  // barrido lleva dentro `showLiquidity`, que es una casilla VISUAL. Al
  // desmarcarla el contador no se reinicia nunca y el indicador deja de dar
  // señales para siempre, sin decir por qué. Aquí la lógica no recibe ninguna
  // opción de dibujo; si alguien le añade una, tendrá que borrar esta.
  const velas = mercadoConSenal()
  const conTodo = senalesLSS(velas, { swingLen: 2, sweepWindow: 10 })
  const otraVez = senalesLSS(velas, { swingLen: 2, sweepWindow: 10, mostrarBarridos: false })
  ok(
    JSON.stringify(conTodo) === JSON.stringify(otraVez),
    'una opción de dibujo no cambia las señales (no existe tal opción)',
  )
}

{
  // ⚠️ Y ESTO TAMBIÉN: el Pine pone el stop en el pivote, que por definición
  // está POR ENCIMA del mínimo de la vela que acaba de barrerlo. Aquí va en la
  // mecha, como dice la guía de Néstor y como él decidió el 2026-09-18.
  const velas = mercadoConSenal()
  const s = senalesLSS(velas, { swingLen: 2, sweepWindow: 10 })
  for (const x of s) {
    const mecha = velas[x.iSweep]
    ok(
      x.lado === 'COMPRA' ? x.sl <= mecha.l : x.sl >= mecha.h,
      'el stop queda al otro lado de la mecha barrida, no dentro',
    )
  }
}

titulo('4. BOS contra CHoCH')

{
  // Primero rompe arriba (queda alcista) y luego rompe abajo: eso es CHoCH.
  const velas = [
    plana(100), plana(100),
    V(101, 90, 100), // pivote bajo 90
    plana(100), plana(100),
    V(110, 99, 100), // pivote alto 110
    plana(100), plana(100),
    V(101, 85, 100), // barrido abajo
    V(115, 99, 112), // ruptura arriba → alcista
    V(116, 111, 112), V(116, 111, 112),
    V(130, 111, 112), // pivote alto nuevo
    V(116, 111, 112), V(116, 111, 112),
    V(140, 111, 112), // barrido arriba (mecha sobre 130, cierra debajo)
    // ⚠️ El cierre tiene que quedar ESTRICTAMENTE por debajo del pivote bajo
    // (85). La primera versión de esta prueba cerraba justo en 85 y no rompía
    // nada — el fallo era del mercado inventado, no de la lógica.
    V(113, 78, 80), // ruptura abajo
    plana(80),
  ]
  const s = senalesLSS(velas, { swingLen: 2, sweepWindow: 10 })
  const compra = s.find((x) => x.lado === 'COMPRA')
  const venta = s.find((x) => x.lado === 'VENTA')
  ok(!!compra && compra.evento === 'BOS', 'la primera ruptura, sin tendencia previa, es BOS')
  ok(!!venta && venta.evento === 'CHoCH', 'la que gira la tendencia es CHoCH')
}

// ───────────────────────────────────────────────────────────────────────────
titulo('5. Cosas que no pueden pasar nunca')

{
  const velas = mercadoConSenal()
  for (const rr of [0.5, 1, 1.5, 2, 3]) {
    const s = senalesLSS(velas, { swingLen: 2, sweepWindow: 10, rr })
    for (const x of s) {
      const riesgo = x.lado === 'COMPRA' ? x.entrada - x.sl : x.sl - x.entrada
      const premio = x.lado === 'COMPRA' ? x.tp - x.entrada : x.entrada - x.tp
      ok(riesgo > 0, `el riesgo es positivo (rr ${rr})`)
      ok(Math.abs(premio / riesgo - rr) < 1e-9, `el objetivo respeta el ratio ${rr}`)
      ok(
        x.lado === 'COMPRA' ? x.sl < x.entrada && x.tp > x.entrada : x.sl > x.entrada && x.tp < x.entrada,
        `stop y objetivo en los lados correctos (rr ${rr})`,
      )
    }
  }
}

{
  // Series degeneradas: no debe reventar ninguna.
  ok(senalesLSS([], { swingLen: 2 }).length === 0, 'serie vacía')
  ok(senalesLSS([plana(1)], { swingLen: 2 }).length === 0, 'una sola vela')
  ok(senalesLSS(Array.from({ length: 50 }, () => plana(100)), { swingLen: 2 }).length === 0, 'mercado plano, cero señales')
}

{
  // Más sensibilidad = pivotes más frecuentes = no menos señales.
  const velas = mercadoConSenal()
  const corto = senalesLSS(velas, { swingLen: 2, sweepWindow: 10 }).length
  const largo = senalesLSS(velas, { swingLen: 8, sweepWindow: 10 }).length
  ok(largo <= corto, 'con pivotes más exigentes no salen más señales que con pivotes sensibles')
}

// ───────────────────────────────────────────────────────────────────────────
titulo('6. Los tres cambios de la v1.1')

// ⚠️ ANTES QUE NADA: que los tres sean ADITIVOS. Sin pedirlos, el indicador
// tiene que dar EXACTAMENTE lo mismo que antes de la v1.1 — si no, ninguna
// tabla vieja se podría comparar con ninguna nueva y las mediciones de ayer
// dejarían de valer sin que nadie se entere.
{
  const velas = mercadoConSenal()
  const antes = senalesLSS(velas, { swingLen: 2, sweepWindow: 10, rr: 2 })
  const conDefectos = senalesLSS(velas, { swingLen: 2, sweepWindow: 10, rr: 2, slBufferAtr: 0, atrLen: 14 })
  ok(
    JSON.stringify(antes.map((s) => [s.i, s.sl, s.tp])) === JSON.stringify(conDefectos.map((s) => [s.i, s.sl, s.tp])),
    'sin colchón, la v1.1 da EXACTAMENTE las mismas señales y niveles que antes',
  )
}

// ── 6a. El ATR de Wilder ───────────────────────────────────────────────────
{
  // Con velas de rango constante 10 y sin huecos, el ATR tiene que ser 10.
  const velas = []
  for (let i = 0; i < 40; i++) velas.push(V(105, 95, 100))
  const a = atrWilder(velas, 14)
  ok(a[0] === null, 'la primera vela no tiene ATR: no hay cierre anterior')
  ok(a[13] === null, 'ni antes de completar el periodo')
  ok(a[14] !== null && Math.abs(a[14] - 10) < 1e-9, `con rango constante 10, el ATR es 10 (salió ${a[14]})`)
  ok(Math.abs(a[39] - 10) < 1e-9, 'y se mantiene')

  // El hueco entre velas CUENTA: es lo que distingue el rango verdadero del
  // rango de la vela. Si alguien lo quita, el ATR sale corto y el colchón del
  // stop también.
  const salto = [V(105, 95, 100)]
  for (let i = 0; i < 20; i++) salto.push(V(205, 195, 200))
  // Con periodo 2 el ATR empieza en el índice 2: hacen falta DOS rangos
  // verdaderos, y el primero necesita el cierre anterior.
  const b = atrWilder(salto, 2)
  ok(b[1] === null, 'con periodo 2 todavía no hay ATR en la vela 1')
  ok(b[2] > 10, `un hueco de 100 da un rango verdadero mayor que el de la vela (salió ${b[2]})`)
}

// ── 6b. El colchón del stop ────────────────────────────────────────────────
{
  const velas = mercadoConSenal()
  const sin = senalesLSS(velas, { swingLen: 2, sweepWindow: 10, rr: 2 })[0]
  const con = senalesLSS(velas, { swingLen: 2, sweepWindow: 10, rr: 2, slBufferAtr: 0.15, atrLen: 3 })[0]

  ok(!!con, 'con colchón sigue saliendo la señal')
  if (con) {
    ok(con.i === sin.i && con.lado === sin.lado, 'es la misma señal: el colchón no cambia CUÁNDO se entra')
    // En una COMPRA el stop baja, nunca sube.
    ok(con.sl < sin.sl, `el stop se aleja: ${sin.sl} → ${con.sl}`)
    ok(con.entrada === sin.entrada, 'la entrada no se toca')
    // ⚠️ Y la consecuencia que hay que tener delante al leer la tabla: con el
    // stop más lejos, el riesgo es MAYOR, así que el objetivo a `rr` veces el
    // riesgo también se va más lejos. No es gratis.
    ok(con.tp > sin.tp, 'y como el riesgo crece, el objetivo a `rr` veces también se aleja')
    const riesgoSin = sin.entrada - sin.sl
    const riesgoCon = con.entrada - con.sl
    ok(riesgoCon > riesgoSin, 'el riesgo por operación es mayor con colchón — eso es lo que se paga')
  }
}

{
  // En una VENTA el colchón va hacia ARRIBA. Al revés dejaría el stop DENTRO
  // del recorrido, o sea más cerca de saltar: exactamente lo contrario de lo
  // que se pidió, y sin que nada falle.
  const velas = [
    plana(100), plana(100),
    V(110, 99, 100), // pivote ALTO en 110
    plana(100), plana(100),
    V(101, 90, 100), // pivote BAJO en 90
    plana(100), plana(100),
    V(115, 99, 100), // BARRIDO arriba: mecha a 115 y cierra dentro
    V(101, 85, 88), // RUPTURA abajo: cierra en 88, por debajo de 90
    plana(88),
  ]
  const sin = senalesLSS(velas, { swingLen: 2, sweepWindow: 10, rr: 2 })[0]
  const con = senalesLSS(velas, { swingLen: 2, sweepWindow: 10, rr: 2, slBufferAtr: 0.15, atrLen: 3 })[0]
  ok(sin && sin.lado === 'VENTA', 'el mercado de control da una VENTA')
  if (sin && con) {
    ok(con.sl > sin.sl, `en VENTA el colchón sube el stop, no lo baja (${sin.sl} → ${con.sl})`)
    ok(con.sl - con.entrada > sin.sl - sin.entrada, 'y el riesgo crece, igual que en la compra')
  }
}

{
  // Sin ATR todavía calculable, la señal se DESCARTA en vez de salir con un
  // stop a una distancia inventada. Es la misma asimetría de siempre: no
  // medir es más barato que medir mal.
  const velas = mercadoConSenal()
  const conAtrLargo = senalesLSS(velas, { swingLen: 2, sweepWindow: 10, rr: 2, slBufferAtr: 0.15, atrLen: 500 })
  ok(conAtrLargo.length === 0, 'si el ATR aún no existe, no se inventa el colchón: no hay señal')
}

// ── 6c. El sweep como etiqueta, no como filtro ─────────────────────────────
{
  const velas = mercadoConSenal({ separacion: 12 })
  // Barrido en la 8, ruptura 12 velas después: fuera de una ventana de 5.
  const estricto = senalesLSS(velas, { swingLen: 2, sweepWindow: 5, rr: 2, exigirSweep: true })
  const informativo = senalesLSS(velas, { swingLen: 2, sweepWindow: 5, rr: 2, exigirSweep: false })

  ok(estricto.length === 0, 'en modo estricto, un barrido viejo bloquea la señal')
  ok(informativo.length === 1, 'con el sweep informativo, la señal sale igual')
  // ⚠️ La etiqueta tiene que decir la VERDAD: aquí el barrido existió pero
  // quedó fuera de la ventana, así que NO cuenta como reciente. Marcarlo con
  // «⚡» sería decirle al usuario que hubo trampa de stops hace un momento
  // cuando fue hace doce velas.
  ok(informativo[0].huboSweep === false, 'y `huboSweep` es falso: el barrido quedó fuera de la ventana')
}

{
  const velas = mercadoConSenal({ separacion: 1 })
  const s = senalesLSS(velas, { swingLen: 2, sweepWindow: 10, rr: 2, exigirSweep: false })[0]
  ok(s && s.huboSweep === true, 'cuando el barrido SÍ es reciente, `huboSweep` es verdadero')
}

{
  // ⚠️ La comprobación que de verdad importa de este cambio: quitar el filtro
  // solo puede AÑADIR señales, nunca quitarlas. Si alguna vez saliera al
  // revés, es que el «filtro» estaba cambiando algo más que el filtrado.
  const velas = mercadoConSenal({ separacion: 12 })
  for (const w of [1, 3, 5, 10, 20]) {
    const estricto = senalesLSS(velas, { swingLen: 2, sweepWindow: w, rr: 2, exigirSweep: true })
    const informativo = senalesLSS(velas, { swingLen: 2, sweepWindow: w, rr: 2, exigirSweep: false })
    ok(informativo.length >= estricto.length, `con ventana ${w}, el modo informativo no da MENOS señales que el estricto`)
  }
}

// ── 6d. La salida por estructura contraria ─────────────────────────────────
{
  // Una compra, y después una ruptura hacia abajo que la cierra.
  const velas = [
    plana(100), plana(100),
    V(101, 90, 100), // 2 — pivote BAJO en 90
    plana(100), plana(100),
    V(110, 99, 100), // 5 — pivote ALTO en 110
    plana(100), plana(100),
    V(101, 85, 100), // 8 — barrido abajo
    V(115, 99, 112), // 9 — RUPTURA arriba → COMPRA
    plana(112), plana(112),
    V(113, 104, 112), // 12 — pivote BAJO en 104
    plana(112), plana(112),
    V(120, 111, 112), // 15 — pivote ALTO
    plana(112), plana(112),
    V(113, 100, 102), // 18 — RUPTURA abajo (rompe el 104) → salida de la compra
    plana(102),
  ]
  const s = senalesLSS(velas, { swingLen: 2, sweepWindow: 10, rr: 2, exigirSweep: false })
  const compra = s.find((x) => x.lado === 'COMPRA')
  ok(!!compra, 'sale la compra')
  if (compra) {
    ok(compra.iSalida === 18, `la salida por estructura es la ruptura contraria de la barra 18 (salió ${compra.iSalida})`)
    ok(compra.iSalida > compra.i, 'y siempre es POSTERIOR a la entrada')
  }
}

{
  // Si no hay ruptura contraria, `iSalida` es -1. ⚠️ Eso NO significa «no se
  // cerró»: significa que la serie se acabó antes. Quien mida tiene que
  // dejarla sin juzgar, no contarla como ganada.
  const velas = mercadoConSenal()
  const s = senalesLSS(velas, { swingLen: 2, sweepWindow: 10, rr: 2, exigirSweep: false })[0]
  ok(s && s.iSalida === -1, 'sin ruptura contraria después, `iSalida` es -1')
}

{
  // La salida se calcula sobre TODAS las rupturas, no solo sobre las que el
  // filtro del barrido dejó pasar como señal. Una posición abierta se cierra
  // cuando el mercado rompe en contra, haya habido barrido o no.
  const velas = [
    plana(100), plana(100),
    V(101, 90, 100),
    plana(100), plana(100),
    V(110, 99, 100),
    plana(100), plana(100),
    V(101, 85, 100), // barrido abajo
    V(115, 99, 112), // 9 — COMPRA (con barrido reciente)
    plana(112), plana(112),
    V(113, 104, 112), // 12 — pivote BAJO
    plana(112), plana(112),
    V(120, 111, 112), // 15 — pivote ALTO
    plana(112), plana(112),
    V(113, 100, 102), // 18 — ruptura abajo; su barrido (la 15) queda lejos
    plana(102),
  ]
  // 📌 La primera versión de esta comprobación usaba `sweepWindow: 3` y falló:
  // la vela 15 ES un barrido del máximo (mecha a 120 sobre un pivote de 115 y
  // cierre en 112, dentro), y queda a exactamente 3 velas de la ruptura, así
  // que el filtro la dejaba pasar. El fallo era del mercado que yo inventé, no
  // del código. Con ventana 1 la compra sigue pasando (su barrido está a una
  // vela) y la venta no, que es lo que esta comprobación quiere aislar.
  const estricto = senalesLSS(velas, { swingLen: 2, sweepWindow: 1, rr: 2, exigirSweep: true })
  const compra = estricto.find((x) => x.lado === 'COMPRA')
  ok(!!compra, 'en modo estricto sigue saliendo la compra (su barrido sí era reciente)')
  ok(
    estricto.every((x) => x.lado !== 'VENTA'),
    'y la ruptura de bajada NO es señal, porque no tuvo barrido reciente',
  )
  ok(compra && compra.iSalida === 18, 'pero SÍ sirve de salida: la posición se cierra igual')
}

console.log(`\n${mal ? `✗ ${mal} de ${n} MAL` : `✓ las ${n} comprobaciones pasan`}\n`)
process.exit(mal ? 1 : 0)
