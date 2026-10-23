#!/usr/bin/env node
/**
 * Integridad de las specs: sus enlaces, su forma y el backlog.
 *
 *   node scripts/verificar-specs.mjs
 *
 * Una spec nueva casi siempre modifica specs ya escritas, y ese cambio se hace a
 * mano en las dos puntas. Esto verifica que las dos puntas existan.
 *
 * Y la forma que el SDD exige (`.claude/hooks/lib/sdd-forma.js`): una spec, una
 * historia; las tareas cortadas por slice y no por capa; el backlog de una línea
 * bien formado. El `spec-gate` hace las mismas preguntas sobre la spec ACTIVA en
 * cada escritura; acá se hacen sobre todas, y con el mismo código.
 *
 * Sin carpeta `specs/` no hace nada — igual que el spec-gate, el SDD viene
 * dormido y no molesta a quien no lo usa.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { auditarEnlaces } from './lib/spec-links.js';

const raizSpecs = path.join(process.cwd(), 'specs', 'specs');
const c = { gris: '\x1b[90m', rojo: '\x1b[31m', verde: '\x1b[32m', amarillo: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' };

if (!fs.existsSync(raizSpecs)) {
  console.log(`${c.gris}Sin specs/: nada que verificar.${c.reset}`);
  process.exit(0);
}

/**
 * `sdd-forma.js` vive en el harness, que es CommonJS. Este script corre en dos
 * layouts: en un proyecto generado `.claude/` está al lado de `scripts/`; en el
 * repo del CLI, dos niveles más arriba. Si no está en ninguno, se dice y se sale
 * en 1: «no se pudo verificar» no es «está bien» (HUE-018).
 */
function cargarForma() {
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const candidatos = [
    path.resolve(aqui, '..', '.claude', 'hooks', 'lib', 'sdd-forma.js'),
    path.resolve(aqui, '..', '..', '.claude', 'hooks', 'lib', 'sdd-forma.js'),
  ];
  const ruta = candidatos.find((p) => fs.existsSync(p));
  if (!ruta) {
    console.error(`${c.rojo}No se encontró .claude/hooks/lib/sdd-forma.js: la forma de las specs no se verificó.${c.reset}`);
    console.error(`${c.amarillo}Reinyectá el harness (npx create-koa-agent → Inject Only).${c.reset}`);
    process.exit(1);
  }
  return createRequire(import.meta.url)(ruta);
}
const forma = cargarForma();
const leer = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');

// Una spec es su carpeta `NNNN-nombre/`, y su fuente es TODO lo que hay adentro:
// una decisión puede estar en spec.md, en tasks.md o en decisiones.md, y exigir
// que el acuse viva en un archivo puntual sería inventar una regla que nadie
// recuerda.
const specs = [];
for (const carpeta of fs.readdirSync(raizSpecs).sort()) {
  const m = carpeta.match(/^(\d{4})-/);
  if (!m) continue;
  const dir = path.join(raizSpecs, carpeta);
  if (!fs.statSync(dir).isDirectory()) continue;

  const fuente = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n');

  specs.push({
    id: m[1],
    carpeta,
    fuente,
    spec: leer(path.join(dir, 'spec.md')),
    tareas: leer(path.join(dir, 'tasks.md')),
  });
}

console.log(`\n${c.cyan}🔗 Enlaces entre specs — ${specs.length} spec(s)${c.reset}\n`);

const { inexistentes, sinAcuse, sinDeclarar } = auditarEnlaces(specs);
let falla = false;

// ─── La forma: una historia, tareas por slice ───────────────────────────────
// Las specs cerradas no se juzgan: son registro de lo que pasó (sdd-forma.js).
const malFormadas = [];
for (const s of specs) {
  if (forma.CERRADAS.has(forma.estado(s.spec))) continue;
  for (const p of forma.revisarSpec(s.spec)) malFormadas.push(`${s.carpeta}/spec.md ${p}`);
  for (const p of forma.revisarTareas(s.tareas)) malFormadas.push(`${s.carpeta}/tasks.md ${p}`);
}
if (malFormadas.length > 0) {
  console.error(`${c.rojo}📐 Specs sin la forma del SDD:${c.reset}`);
  for (const p of malFormadas) console.error(`   ${p}`);
  console.error(`${c.amarillo}   El spec-gate bloquea el código de una spec activa así: se entrega por slices usables, una historia por spec.${c.reset}\n`);
  falla = true;
}

// ─── El backlog barato: `## Historias` de specs/ROADMAP.md ──────────────────
const roadmap = leer(path.join(process.cwd(), 'specs', 'ROADMAP.md'));
const backlog = forma.revisarBacklog(roadmap, specs.map((s) => s.id));
if (backlog.errores.length > 0) {
  console.error(`${c.rojo}📝 Backlog mal formado (specs/ROADMAP.md):${c.reset}`);
  for (const e of backlog.errores) console.error(`   ${e}`);
  console.error('');
  falla = true;
}
if (backlog.avisos.length > 0) {
  // Una sospecha no rompe: «quiero ver altas y bajas» puede ser una sola historia.
  console.log(`${c.amarillo}⚠️  Historias para mirar (no rompen):${c.reset}`);
  for (const a of backlog.avisos) console.log(`   ${a}`);
  console.log('');
}

if (inexistentes.length > 0) {
  console.error(`${c.rojo}❓ Enlaces a specs que no existen:${c.reset}`);
  for (const e of inexistentes) console.error(`   ${e.de} → ${e.a}`);
  console.error('');
  falla = true;
}

if (sinAcuse.length > 0) {
  console.error(`${c.rojo}➡️  Declaran modificar una spec que no acusa recibo:${c.reset}`);
  for (const e of sinAcuse) console.error(`   ${e.de} dice modificar la ${e.a}, y la ${e.a} ni la nombra`);
  console.error(`${c.amarillo}   La spec modificada sigue prometiendo lo viejo, y no se nota hasta construirla.${c.reset}\n`);
  falla = true;
}

if (sinDeclarar.length > 0) {
  console.error(`${c.rojo}⬅️  Modificadas sin que nadie lo declare:${c.reset}`);
  for (const e of sinDeclarar) {
    console.error(`   la ${e.modificada} dice que la ${e.por} le absorbió algo, y la ${e.por} no lo declara`);
  }
  console.error(`${c.amarillo}   Agregá "> **Modifica:** ${sinDeclarar[0].modificada}" a la cabecera de la spec que la absorbió.${c.reset}\n`);
  falla = true;
}

if (falla) process.exit(1);

const conEnlaces = specs.filter((s) => /\*\*Modifica:\*\*/.test(s.fuente)).length;
console.log(`${c.verde}✅ Enlaces íntegros${c.reset}${c.gris} — ${conEnlaces} spec(s) declaran modificar a otras${c.reset}`);
console.log(`${c.verde}✅ Forma del SDD${c.reset}${c.gris} — una historia por spec, tareas por slice, ${forma.backlog(roadmap).length} historia(s) en el backlog${c.reset}\n`);
