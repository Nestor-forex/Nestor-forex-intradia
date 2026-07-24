export function generarReporteMd({ fecha, sesion, corte, monedas, pares, compras, ventas, vigilancia, setups, limitaciones }) {
  const li = (xs) => (xs.length ? xs.map((x) => `- **${x.name}** — ${x.razon}`).join('\n') : '_Ninguno hoy._')

  return `# Reporte Forex — ${fecha}

**Sesión:** ${sesion}
**Corte de datos:** ${corte}

## Fuerza relativa (0-10)
${monedas.map((m) => `- ${m.cod}: ${m.score.toFixed(1)}`).join('\n')}

## Tabla de pares
| Par | Sesgo | Dif | Tendencia | RSI | ATR%* |
|---|---|---|---|---|---|
${pares.map((p) => `| ${p.name} | ${p.sesgo} | ${p.dif >= 0 ? '+' : ''}${p.dif.toFixed(1)} | ${p.tend} | ${p.rsi} | ${p.atr.toFixed(2)} |`).join('\n')}

\\* Volatilidad proxy cierre-a-cierre.

## Mejores para comprar
${li(compras)}

## Mejores para vender
${li(ventas)}

## En vigilancia
${li(vigilancia)}

## Setups
${
  setups.length
    ? setups
        .map(
          (s) => `### ${s.name} — ${s.lado}
- Soporte: ${s.sup} · Resistencia: ${s.res}
- Entrada: ${s.entrada}
- Stop-loss: ${s.sl}
- Take-profit: ${s.tp} (R/B ${s.rr})
- Invalida: ${s.inval}`
        )
        .join('\n\n')
    : '_Sin setups limpios hoy._'
}

## Riesgo
1-2% del capital por operación. Posiciones múltiples sobre la misma divisa cuentan como una sola apuesta ampliada.

## Limitaciones
${limitaciones}

---
_Análisis educativo, no asesoría financiera personalizada. El Forex conlleva riesgo de pérdida._
`
}

export function descargarMd(contenido, nombreArchivo) {
  const blob = new Blob([contenido], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nombreArchivo
  a.click()
  URL.revokeObjectURL(a.href)
}
