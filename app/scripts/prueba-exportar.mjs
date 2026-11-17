// Comprobaciones de la exportación (2026-11-17), sin internet.
//
//   node scripts/prueba-exportar.mjs
//
// GEMELO: la tabla de la práctica y el texto del análisis son iguales en las
// dos apps.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COLUMNAS_PRACTICA,
  celdaCsv,
  csvDe,
  csvPractica,
  decimalDe,
  filasPractica,
  numeroCsv,
  separadorDe,
  textoAnalisis,
} from '../src/lib/exportar.js'
import { crearT } from '../src/lib/i18n/crearT.js'
import { IDIOMAS } from '../src/lib/i18n/idiomas.js'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (r) => readFileSync(join(RAIZ, r), 'utf8')
let mal = 0
function ok(cond, msg) {
  if (!cond) mal++
  console.log(`${cond ? '  ✓' : '  ✗ MAL'} ${msg}`)
}

console.log('\n1. El decimal y el separador salen del idioma')
ok(decimalDe('es-CO') === ',' && decimalDe('en-US') === '.', 'español con coma, inglés con punto')
ok(separadorDe(',') === ';' && separadorDe('.') === ',', 'con coma decimal la tabla va con punto y coma')
ok(decimalDe('esto-no-existe-xx') === '.' || decimalDe('esto-no-existe-xx') === ',', 'un idioma raro no revienta')
ok(numeroCsv(1.162903, 5, ',') === '1,16290', 'el número con la coma del idioma')
ok(numeroCsv(1234.5, 2, '.') === '1234.50', 'sin separador de miles')
ok(numeroCsv(null, 2) === '' && numeroCsv(NaN, 2) === '' && numeroCsv(0, 2) === '0.00', 'lo que no se sabe va vacío; un cero de verdad sale cero')

console.log('\n2. Las celdas se protegen')
ok(celdaCsv('a;b', ';') === '"a;b"', 'una celda con el separador va entre comillas')
ok(celdaCsv('di "hola"', ',') === '"di ""hola"""', 'las comillas se doblan')
ok(celdaCsv('1,5', ';') === '1,5', 'la coma decimal NO se cita si el separador es punto y coma')
const t0 = csvDe([['a', 'b'], ['1', '2']], { sep: ';' })
ok(t0.startsWith('﻿') && t0.includes('a;b\r\n1;2\r\n'), 'marca UTF-8 al principio y saltos de Windows')

console.log('\n3. La tabla de la práctica')
const creado = { toMillis: () => Date.UTC(2026, 10, 10, 14, 30) }
const OPS = [
  { par: 'EUR/USD', lado: 'COMPRA', entrada: 1.1, sl: 1.095, tp: 1.11, estado: 'ganada', r: 2, creado, app: 'swing', vela: '2026-11-10', velaResuelta: '2026-11-12', fuente: 'twelve', spread: 1, riesgoUsd: 50 },
  { par: 'USD/JPY', lado: 'VENTA', entrada: 150.5, sl: 151, tp: 149.5, creado, app: 'swing', vela: '2026-11-10' },
  { par: 'GBP/USD', lado: 'COMPRA', entrada: 1.3, sl: 1.29, tp: 1.31, estado: 'caducada', creado },
]
const fil = filasPractica(OPS, { decimal: '.' })
ok(fil.length === 3, 'una fila por operación, TAMBIÉN la abierta y la caducada')
ok(fil.every((f) => f.length === COLUMNAS_PRACTICA.length), 'cada fila tiene las mismas columnas que los títulos')
const col = (k) => COLUMNAS_PRACTICA.indexOf(k)
ok(fil[0][col('fecha')] === '2026-11-10 14:30', 'la fecha en UTC, AAAA-MM-DD HH:MM')
ok(fil[0][col('entrada')] === '1.10000' && fil[1][col('entrada')] === '150.500', 'cinco decimales y tres en los pares con yen')
ok(fil[0][col('rb')] === '2.00', 'el R/B')
ok(fil[0][col('rBruto')] === '2.00' && fil[0][col('spreadR')] === '-0.02', 'el bruto y el spread que se resta (1 pip sobre 50 de riesgo = 0,02 R)')
ok(fil[0][col('swapR')] === '' && fil[0][col('noches')] === '', 'sin swap guardado, el swap y las noches van VACÍOS, no en cero')
ok(fil[0][col('rNeto')] === '1.98' && fil[0][col('usdNeto')] === '99.00', 'el neto en R y en dólares')
ok(fil[1][col('rBruto')] === '' && fil[1][col('rNeto')] === '', 'la abierta no tiene resultado')
const conMt5 = filasPractica([{ ...OPS[0], fuente: 'mt5' }])[0]
ok(conMt5[col('spreadR')] === '' && conMt5[col('rNeto')] === '2.00', 'con entrada de MT5 el spread ya va en el precio: celda vacía y nada que restar')
const etq = filasPractica(OPS, { etiqueta: (k) => `<${k}>` })
ok(etq[0][col('lado')] === '<compra>' && etq[1][col('lado')] === '<venta>', 'el lado pasa por el idioma')
ok(etq[0][col('estado')] === '<est_ganada>' && etq[1][col('estado')] === '<esperando>' && etq[2][col('estado')] === '<est_caducada>', 'el estado pasa por el idioma')
ok(filasPractica(null).length === 0 && filasPractica([null]).length === 0, 'sin operaciones no revienta')

const es = crearT('es')
const csv = csvPractica(OPS, { locale: 'es-CO', titulo: (k) => es(`exp.${k}`), etiqueta: (k) => es(`prac.${k}`) })
const lineas = csv.replace('﻿', '').trim().split('\r\n')
ok(lineas.length === 4, 'títulos más tres filas')
ok(lineas[0].split(';')[0] === 'Fecha (UTC)', 'los títulos traducidos, separados por punto y coma en español')
ok(lineas[1].includes(';1,10000;'), 'y los números con coma decimal')

console.log('\n4. El texto del análisis')
const A = {
  par: 'EUR/USD', b: 'EUR', q: 'USD', dec: 5, lado: 'COMPRA', metodo: 'app', precio: 1.1,
  niveles: { sl: 1.095, tp: 1.11, pipRiesgo: 50, pipBeneficio: 100, rr: 2 },
  lote: { lote: 0.1, riesgoUsd: 50 },
  herramientas: { rsi: { v: 55.27 }, atr: { pips: 61.4 }, tendencia: { tend: 'Alcista' }, pivote: { p: 1.098, s1: 1.09, r1: 1.105 } },
}
const txt = textoAnalisis(A, { t: es, fecha: '17/11/26' })
ok(txt.startsWith('EUR/USD · COMPRA · 17/11/26'), 'arranca con par, dirección y fecha')
ok(txt.includes('Stop-loss 1.09500 (50 pips)') && txt.includes('Take-profit 1.11000 (100 pips)') && txt.includes('R/B 1:2.00'), 'los niveles con sus pips y el R/B')
ok(txt.includes('$50.00') && txt.includes('RSI 55.3') && txt.includes('ATR 61 pips') && txt.includes('1.09800'), 'el lote, el riesgo y las herramientas leídas')
ok(txt.trim().endsWith(es('exp.avisoAnalisis')), 'TERMINA con el aviso de que no es una señal')
ok(!/\b(compr[ae]|vend[ae])\b/i.test(es('exp.avisoAnalisis')), 'y el aviso no dice compra ni vende')
ok(textoAnalisis({ ...A, niveles: null }, { t: es }) === '', 'sin niveles no hay nada que exportar')
ok(textoAnalisis(A, {}) === '', 'sin idioma tampoco')
ok(!/undefined|NaN|\[object/.test(txt), 'nada de «undefined» ni «NaN» en el texto')

console.log('\n5. Las claves existen en los 13 idiomas')
const claves = [...COLUMNAS_PRACTICA, 'precio', 'metodo', 'lote', 'riesgo', 'soporte', 'resistencia', 'pivote', 'tendencia', 'fuerza', 'avisoAnalisis', 'descargarPractica', 'notaPractica', 'compartirAnalisis', 'compartido', 'descargado']
for (const { codigo } of IDIOMAS) {
  const tr = crearT(codigo)
  const espanol = codigo === 'es'
  const faltan = claves.filter((k) => {
    const v = tr(`exp.${k}`)
    return !v || (!espanol && v === es(`exp.${k}`) && !['sl', 'tp', 'rb', 'spreadR', 'swapR'].includes(k) && !['par', 'pivote', 'entrada', 'lote', 'fecha', 'estado', 'soporte', 'riesgoUsd', 'usdNeto', 'rBruto', 'rNeto', 'tendencia', 'precio'].includes(k))
  })
  ok(!faltan.length, `${codigo}: todas las claves${faltan.length ? ' (faltan: ' + faltan.join(', ') + ')' : ''}`)
  const t2 = textoAnalisis(A, { t: tr })
  ok(t2 && !/undefined|NaN/.test(t2) && t2.trim().endsWith(tr('exp.avisoAnalisis')), `${codigo}: el texto sale entero y termina en su aviso`)
}

console.log('\n6. Los botones están enchufados')
const pr = leer('src/components/Practica.jsx')
ok(/csvPractica\(ops,/.test(pr) && /descargar\(/.test(pr), 'la práctica descarga la tabla con TODAS sus operaciones')
ok(/tr\('exp\.descargarPractica'\)/.test(pr) && /tr\('exp\.notaPractica'\)/.test(pr), 'con su botón y su nota')
const an = leer('src/components/AnalizadorTab.jsx')
ok(/compartirODescargar\(textoAnalisis\(a,/.test(an), 'el Analizador comparte el texto de ESTE análisis')
ok(/\{a\.niveles && \(\s*<div>\s*<button[\s\S]{0,900}exp\.compartirAnalisis/.test(an), 'y solo sale con niveles (sin dirección no hay análisis)')

console.log(mal ? `\n✗ ${mal} comprobaciones fallaron\n` : '\n✓ todo bien\n')
process.exit(mal ? 1 : 0)
