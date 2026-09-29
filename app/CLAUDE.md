
---

# El NFX-LSS en velas de 4 horas: NO PASA, pero el gradiente es REAL (2026-09-29)

Medición de ESTA app. H4 sale de **reagrupar** la descarga de H1 que el banco ya
paga: mismos 7 pares, mismos días, mismos parámetros. **Cero créditos.**

Vara neutra 1:1, spread por par. 19.897 velas H1 → 5.117 velas H4.

| qué se midió | ops | acierto | **bruto** | por 1R | 1ª mit | 2ª mit |
|---|---:|---:|---:|---:|---:|---:|
| **NFX-LSS en H4** | 596 | 50 % | **+0,00** | **−0,03** | +0,06 | −0,09 |
| CONTROL: solo la ruptura, H4 | 2.365 | 50 % | −0,01 | −0,03 | −0,00 | −0,06 |
| NFX-LSS en H1 | 2.249 | 46 % | −0,08 | −0,14 | −0,10 | −0,17 |
| CONTROL: solo la ruptura, H1 | 8.636 | 48 % | −0,05 | −0,09 | −0,06 | −0,13 |

**NO PASA. Falla 2 de 6:** no gana (−0,03) y no gana en las dos mitades
(+0,06 y −0,09). El veredicto lo calcula `juzgar()` en
`scripts/lib/preregistro-h4.mjs`, con fecha anterior a la primera corrida.

## ⚠️⚠️ El sexto criterio SÍ pasó, y es lo que hay que recordar de aquí

Se escribió porque el mecanismo contrario estaba medido el día anterior: la app
en M15 pierde el DOBLE que en H1 **acertando exactamente igual, 49 % en las
dos**. Subir de temporalidad ensancha el stop, el spread pesa menos y el número
mejora **sin que la regla acierte una vez más**. Eso sería pagar menos peaje por
la misma no-ventaja.

**Aquí no es eso:** sin costes, H4 da **0,000** contra **−0,080** de H1.

📌 **Subir de temporalidad mejora de verdad** — y aun así la regla no sirve,
porque **mejora hacia CERO, no hacia positivo**. Con la vara honesta, el NFX-LSS
en H4 no pierde por los costes: es que no tiene ninguna ventaja que perder.

## ⚠️ Y por eso NO se sube a semanal, aunque la condición se cumpliera

`SEMANAL_SOLO_SI` pedía «el H4 pasa el listón **o al menos confirma el gradiente
sin costes**». Se confirmó. Y la recomendación sigue siendo **no**:

1. **El destino del gradiente es cero, no ganancia.** Extrapolar de −0,08 → 0,00
   que el semanal dará positivo es suponer que la línea sigue subiendo después
   de cruzar el cero, y no hay razón para eso.
2. ⚠️ **En semanal manda el SWAP, no el spread.** Una operación semanal dura
   meses, y el swap no se conoce: cambia mes a mes y no hay histórico, que es
   por lo que el banco lo **barre** a cinco niveles. Sería cambiar el único coste
   medible por el único que no lo es. Con ~287 velas y ~150 operaciones el margen
   del peor caso es ±8 puntos, más ancho que el efecto buscado.

📌 Precedente exacto: la salida por estructura del v1.1 sostenía las operaciones
**52 días de media**, y con 0,25 pips de swap ya caía a −0,15.

⚠️ **La respuesta NO es aflojar un criterio.** Para eso se escribió antes.

## ⚠️ Y un número operativo: el banco ya va a 47 de sus 60 minutos

Medido en la corrida que dio la tabla de arriba (36501748726, intento 2): el
paso «Medir» corrió de 01:17:13 a 02:04:26, o sea **47 min 13 s** contra un
límite de 60. **Quedan 12 minutos y pico de margen.**

La duración anterior medida era 44:06, así que **el bloque de H4 costó unos 3
minutos**. Con eso a la vista:

⚠️ **Añadir otra sección grande al banco ya no es gratis.** Antes de meter una,
o se quita otra, o se sube el límite del workflow a conciencia — no cuando ya
haya fallado.

📌 **Y esto explica el fallo del primer intento.** Aquel murió a los 46:00, que
está DENTRO de la duración normal de este guion, no al final: no se colgó, lo
mataron a media faena. El diagnóstico de caída del runner queda confirmado por
la duración, no solo por eliminación — el código y la memoria ya se habían
descartado midiéndolos (124 MB y milisegundos el bloque de H4; +8 MB en seis
pasadas seguidas).
