#!/usr/bin/env node
/**
 * Provoca cada regla del linter para comprobar que puede fallar.
 *
 *   node scripts/provocar-reglas.mjs
 *   node scripts/provocar-reglas.mjs --actualizar-baseline
 *
 * Por cada regla con fixture: arma un sandbox con el archivo que la viola, corre
 * el linter ahí, y exige que su salida la nombre. Una regla que no dispara ante
 * su propia violación es decoración.
 *
 * Las reglas sin fixture no hacen fallar esto — quedan en `provocacion.baseline.json`,
 * que sólo puede achicarse. Lo que sí falla es agregar una regla nueva sin fixture:
 * el momento de escribirlo es cuando se escribe la regla.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { extraerReglasRegistradas } from './lib/rule-wiring.js';
import {
  FIXTURES, archivosDe, auditarProvocacion, auditarColateral, codigosNombrados, disparo,
} from './lib/provocacion.js';

const raiz = process.cwd();
const architect = path.join(raiz, 'scripts', 'architect.js');
const rutaBaseline = path.join(raiz, 'scripts', 'provocacion.baseline.json');
const actualizar = process.argv.includes('--actualizar-baseline');

const c = { gris: '\x1b[90m', rojo: '\x1b[31m', verde: '\x1b[32m', amarillo: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' };

if (!fs.existsSync(architect)) {
  console.error(`${c.rojo}No se encontró scripts/architect.js${c.reset}`);
  process.exit(1);
}

const registradas = extraerReglasRegistradas(fs.readFileSync(architect, 'utf8'));
const baseline = fs.existsSync(rutaBaseline)
  ? JSON.parse(fs.readFileSync(rutaBaseline, 'utf8')).sinFixture ?? []
  : [];

console.log(`\n${c.cyan}🎯 Provocación de reglas — ¿cada una puede fallar?${c.reset}\n`);

/**
 * Corre el linter contra un sandbox que sólo contiene el fixture.
 *
 * Se leen las DOS salidas, siempre. La primera versión usaba `execFileSync`, que
 * devuelve stdout y descarta stderr cuando el proceso sale en 0 — y el linter
 * sale en 0 cuando lo único que encontró son ADVERTENCIAS. Con eso, una regla
 * que reporta con `reportWarning` (ARCH-11 entre ellas) no podía darse por
 * probada nunca: disparaba, y el provocador la veía muda. Que el mecanismo que
 * busca reglas decorativas tuviera su propio punto ciego es demasiado apropiado
 * para dejarlo pasar sin nombrarlo.
 */
function provocar(fixture) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'provocar-'));
  try {
    for (const { ruta, contenido } of archivosDe(fixture)) {
      const destino = path.join(sandbox, ruta);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, contenido);
    }
    const r = spawnSync(process.execPath, [architect], { cwd: sandbox, encoding: 'utf8' });
    return `${r.stdout ?? ''}${r.stderr ?? ''}`;
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

const mudas = [];
const nombradosPorFixture = {};
for (const [ruleId, fixture] of Object.entries(FIXTURES)) {
  if (!registradas.includes(ruleId)) {
    console.log(`${c.amarillo}❓ ${ruleId}${c.reset} ${c.gris}— hay fixture pero la regla ya no existe en architect.js${c.reset}`);
    continue;
  }
  const salida = provocar(fixture);
  nombradosPorFixture[ruleId] = codigosNombrados(salida);
  if (disparo(salida, ruleId)) {
    console.log(`${c.verde}✅ ${ruleId}${c.reset} ${c.gris}— dispara ante su violación${c.reset}`);
  } else {
    console.log(`${c.rojo}🔇 ${ruleId}${c.reset} ${c.gris}— NO dispara: la regla está registrada y no detecta nada${c.reset}`);
    mudas.push(ruleId);
  }
}

const { sinFixture, nuevasSinFixture, baselineObsoleto } = auditarProvocacion({
  registradas, conFixture: Object.keys(FIXTURES), baseline,
});

if (actualizar) {
  fs.writeFileSync(rutaBaseline, `${JSON.stringify({
    _comentario: 'Reglas sin fixture de provocación. Esta lista sólo puede achicarse: agregar una regla nueva sin fixture hace fallar el chequeo.',
    sinFixture,
  }, null, 2)}\n`);
  console.log(`\n${c.cyan}Baseline actualizado: ${sinFixture.length} regla(s) sin fixture.${c.reset}\n`);
  process.exit(0);
}

console.log('');
if (sinFixture.length > 0) {
  console.log(`${c.gris}Sin fixture todavía (${sinFixture.length}/${registradas.length}): ${sinFixture.join(', ')}${c.reset}\n`);
}

let falla = false;

if (mudas.length > 0) {
  console.error(`${c.rojo}🔇 ${mudas.length} regla(s) registradas que NO disparan ante su propia violación:${c.reset}`);
  for (const r of mudas) console.error(`   ${r}`);
  console.error(`${c.amarillo}   Una regla que no puede fallar da la sensación de estar protegido sin estarlo.${c.reset}\n`);
  falla = true;
}

if (nuevasSinFixture.length > 0) {
  console.error(`${c.rojo}🆕 ${nuevasSinFixture.length} regla(s) nuevas sin fixture: ${nuevasSinFixture.join(', ')}${c.reset}`);
  console.error(`${c.amarillo}   El momento de escribir el fixture es cuando se escribe la regla.${c.reset}\n`);
  falla = true;
}

if (baselineObsoleto.length > 0) {
  console.error(`${c.rojo}📉 El baseline quedó viejo: ${baselineObsoleto.join(', ')} ya no corresponde(n).${c.reset}`);
  console.error(`${c.amarillo}   Corré con --actualizar-baseline. Un baseline que no se achica es una lista de excusas.${c.reset}\n`);
  falla = true;
}

// ACO-009: que cada fixture nombre SÓLO su regla (más el colateral declarado)
// es lo que hace que `disparo()` signifique algo. Si el linter empezara a
// nombrar reglas que no dispararon —cambiando cómo imprime, o poniéndole
// corchetes al resumen de reglas validadas—, esto se cae acá en vez de dar 28
// verdes con una regla muerta adentro.
const { noDeclarado, yaNoOcurre } = auditarColateral(nombradosPorFixture);

if (noDeclarado.length > 0) {
  console.error(`${c.rojo}🔀 ${noDeclarado.length} fixture(s) hacen hablar a una regla ajena sin declararlo:${c.reset}`);
  for (const x of noDeclarado) console.error(`   ${x}`);
  console.error(`${c.amarillo}   Un fixture que viola dos reglas no permite saber cuál disparó: el día que${c.reset}`);
  console.error(`${c.amarillo}   una se rompa, la otra la tapa. Achicá el fixture o declaralo en COLATERAL.${c.reset}\n`);
  falla = true;
}

if (yaNoOcurre.length > 0) {
  console.error(`${c.rojo}📉 COLATERAL declara colateral que ya no ocurre: ${yaNoOcurre.join(', ')}.${c.reset}`);
  console.error(`${c.amarillo}   Sacalo. Esa lista sólo puede achicarse.${c.reset}\n`);
  falla = true;
}

if (falla) process.exit(1);

console.log(`${c.verde}✅ ${Object.keys(FIXTURES).length} regla(s) provocadas y todas disparan.${c.reset}\n`);
