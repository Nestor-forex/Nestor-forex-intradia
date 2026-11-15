// Prueba de los INTERRUPTORES DE EXPERIMENTOS (2026-11-15). Sin internet:
//
//     node scripts/prueba-avisos-experimento.mjs
//
// GEMELO: vale igual en las dos apps. Lo que cambia entre ellas (qué
// experimentos hay) lo lee de `experimentosAviso.js`, que es PRIMO.
//
// Lo que no puede pasar nunca:
//   1. que la pantalla y el programa que manda los avisos entiendan distinto
//      «qué está encendido» — habría interruptores encendidos que no suenan;
//   2. que la tarjeta se le enseñe a alguien que no es el administrador;
//   3. que un interruptor no tenga su texto en algún idioma (sale en blanco);
//   4. que «nunca eligió» y «lo apagó todo» se confundan.

import { readFileSync } from 'node:fs'
import { APP } from '../src/lib/identidad.js'
import { alternar, campoAvisosExp, clavesElegidas } from '../src/lib/avisosExperimento.js'
import { DEFECTO, DE_LA_APP, OPCIONES, claveDeSenal } from '../src/lib/experimentosAviso.js'
import { crearT } from '../src/lib/i18n/crearT.js'
import { IDIOMAS } from '../src/lib/i18n/idiomas.js'

let fallos = 0
const comprobar = (bien, que) => {
  console.log(`  ${bien ? '✓' : '✗'} ${que}`)
  if (!bien) fallos++
}
const leer = (r) => readFileSync(new URL(r, import.meta.url), 'utf8')

console.log('\n1. La cuenta de «qué está encendido»')
{
  const campo = campoAvisosExp(APP)
  comprobar(campo === `avisosExp_${APP}`, `el campo lleva el nombre de la app (${campo}): cada app guarda lo suyo`)
  const claves = OPCIONES.map((o) => o.clave)
  comprobar(JSON.stringify(clavesElegidas({}, APP, OPCIONES, DEFECTO)) === JSON.stringify(DEFECTO), 'sin el campo (nunca eligió) → lo de por defecto')
  comprobar(clavesElegidas({ [campo]: [] }, APP, OPCIONES, DEFECTO).length === 0, 'con la lista vacía (lo apagó todo) → nada, aunque el defecto tenga algo')
  comprobar(clavesElegidas({ [campo]: 'basura' }, APP, OPCIONES, DEFECTO).join() === DEFECTO.join(), 'un valor que no es lista se trata como «nunca eligió»')
  comprobar(clavesElegidas({ [campo]: [claves[0], claves[0], 'noExiste', 3] }, APP, OPCIONES, DEFECTO).join() === claves[0], 'sin repetidos ni claves que no existen')
  comprobar(clavesElegidas({ avisosExp_otraApp: [claves[0]] }, APP, OPCIONES, []).length === 0, 'lo de la otra app no se cuela')
  comprobar(alternar([], 'x').join() === 'x' && alternar(['x', 'y'], 'x').join() === 'y', 'tocar enciende lo apagado y apaga lo encendido')
  comprobar(alternar(null, 'x').join() === 'x', 'y no revienta si no había nada')
  comprobar(DEFECTO.every((c) => claves.includes(c)), 'lo de por defecto es un interruptor que existe')
  comprobar([...DE_LA_APP].every((c) => claves.includes(c)), 'las claves «de la app» son interruptores que existen')
  comprobar(claveDeSenal(null) === null && claveDeSenal({ tipo: 'loQueVenga', lado: 'COMPRA' }) === null, 'una señal desconocida no pertenece a ningún interruptor')
}

console.log('\n2. Cada interruptor tiene su texto en los 13 idiomas')
{
  const codigos = IDIOMAS.map((i) => i.codigo)
  comprobar(codigos.length === 13, `son ${codigos.length} idiomas`)
  const claves = ['titulo', 'noSonSenales', 'desc', 'nota', 'encendido', 'apagado', 'sinPermiso', 'noSeGuardo', 'push']
  const faltan = []
  for (const cod of codigos) {
    const t = crearT(cod)
    const es = crearT('es')
    for (const k of claves) if (!t(`avisosExp.${k}`)) faltan.push(`${cod}:${k}`)
    for (const o of OPCIONES) {
      const v = t(o.etiqueta)
      if (!v || v === o.etiqueta) faltan.push(`${cod}:${o.etiqueta}`)
      else if (cod !== 'es' && v === es(o.etiqueta)) faltan.push(`${cod}:${o.etiqueta} (en español)`)
    }
  }
  comprobar(!faltan.length, faltan.length ? `faltan: ${faltan.join(', ')}` : 'ninguno sale en blanco ni en español por respaldo')
}

console.log('\n3. La pantalla y el programa usan la MISMA cuenta')
{
  const tarjeta = leer('../src/components/AvisosExperimentos.jsx')
  comprobar(/clavesElegidas\(ficha, APP, OPCIONES, DEFECTO\)/.test(tarjeta), 'la tarjeta lee lo encendido con `clavesElegidas`')
  comprobar(/\[campoAvisosExp\(APP\)\]: alternar\(/.test(tarjeta), 'y guarda en el campo de esta app con `alternar`')
  comprobar(/permission-denied/.test(tarjeta), 'un permiso negado se dice como tal')
  comprobar(tarjeta.indexOf("avisosExp.noSonSenales") > 0 && tarjeta.indexOf("avisosExp.noSonSenales") < tarjeta.indexOf('OPCIONES.map'), 'el aviso de que NO son señales va ANTES de los interruptores')
  const envio = leer('./lib/push-envio.mjs')
  comprobar(/clavesElegidas\(fichasAdmin\[0\], APP, OPCIONES, DEFECTO\)/.test(envio), 'el programa de avisos lee lo encendido con la misma cuenta y el mismo defecto')
  comprobar(/DE_LA_APP\.has\(clave\) && !AVISOS_PAUSADOS/.test(envio), 'las señales de la app solo van por aquí mientras sus avisos estén en pausa')
}

console.log('\n4. Solo el administrador ve la tarjeta')
{
  const app = leer('../src/App.jsx')
  comprobar(/\{esAdmin && <AvisosExperimentos uid=\{authUser\.uid\} ficha=\{perfil\} \/>\}/.test(app), 'App.jsx la pinta solo con `esAdmin`')
  comprobar((app.match(/<AvisosExperimentos/g) || []).length === 1, 'y en un solo sitio')
}

console.log(fallos ? `\n✗ ${fallos} comprobaciones fallaron\n` : '\n✓ todo bien\n')
process.exit(fallos ? 1 : 0)
