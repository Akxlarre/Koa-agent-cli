#!/usr/bin/env node
/**
 * spec-reflection.js — Stop Hook (command)
 *
 * Patron Reflection: cierra el bucle que /plan deja abierto.
 *
 * La skill /plan genera un task-spec con un "Criterio de done" en casillas
 * markdown. Hasta ahora nadie las verificaba nunca: el spec era write-only.
 * Este hook lee el task-spec activo al terminar la respuesta del agente y le
 * devuelve las casillas que siguen abiertas, con evidencia del filesystem
 * sobre las que puede comprobar por su cuenta.
 *
 * No re-evalua el codigo (eso es /review + code-judge). Solo comprueba que
 * lo que el agente declaro que iba a hacer, efectivamente lo hizo.
 *
 * Anti-bucle: el mismo spec no se reporta dos veces seguidas. Sin esto el
 * agente responde, el hook lo frena, vuelve a responder, y el hook lo frena
 * otra vez con lo mismo — un bucle que quema tokens sin avanzar.
 *
 * HUE-004: «ninguna casilla marcada» son dos situaciones, no una. Un spec recien
 * generado por /plan tambien tiene cero marcadas, y ahi callar es correcto; pero
 * doce archivos escritos con el criterio de done intacto es justo donde el aviso
 * mas falta. Lo que las separa no son las casillas, son las escrituras de la
 * sesion: sin ninguna, este hook calla.
 *
 * Exit codes:
 *   0 = nada que reportar
 *   2 = avisar al agente (stderr) que quedan pendientes
 */

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const TEMP_DIR = path.join(cwd, '.claude', 'temp');
const SEEN_FILE = path.join(TEMP_DIR, 'spec-reflection-seen.json');

function bail() { process.exit(0); }

if (!fs.existsSync(TEMP_DIR)) bail();

// ─── Localizar el task-spec activo ───────────────────────────────────────────
// /plan usa timestamps YYYYMMDD-HHMMSS, asi que el orden alfabetico es
// tambien el cronologico y el ultimo del sort es el mas reciente.
let specName;
try {
  const specs = fs.readdirSync(TEMP_DIR)
    .filter(f => f.startsWith('task-spec-') && f.endsWith('.md'))
    .sort();
  specName = specs[specs.length - 1];
} catch { bail(); }

if (!specName) bail();

const specPath = path.join(TEMP_DIR, specName);

let raw;
try { raw = fs.readFileSync(specPath, 'utf-8'); } catch { bail(); }

// ─── Extraer casillas ────────────────────────────────────────────────────────
const open = [];
let done = 0;
for (const line of raw.split('\n')) {
  if (/^\s*-\s*\[x\]/i.test(line)) { done++; continue; }
  const m = line.match(/^\s*-\s*\[ \]\s*(.+)$/);
  if (m) open.push(m[1].trim());
}

// Spec completo: limpiar la memoria de avisos para el proximo spec.
if (open.length === 0) {
  try { fs.unlinkSync(SEEN_FILE); } catch { /* ignore */ }
  bail();
}

// ─── Escrituras de la sesion ─────────────────────────────────────────────────
// Sirve para dos cosas: decidir si «ninguna casilla marcada» es un spec recien
// nacido o trabajo sin registrar, y armar la evidencia sobre los indices.
function escrituras() {
  try {
    const w = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, 'session-writes.json'), 'utf-8'));
    return Array.isArray(w) ? w : [];
  } catch {
    return [];
  }
}
const escritas = escrituras();

// HUE-004 — «ninguna casilla marcada» no es una sola situacion.
//
// El hook callaba ante `done === 0` razonando «el agente no adopto el flujo».
// Pero eso tapa el caso donde el aviso mas falta: doce archivos escritos y el
// criterio de done intacto. Lo que distingue una cosa de la otra no son las
// casillas, es si hubo trabajo: un spec recien generado por /plan tambien tiene
// cero marcadas, y ahi callar es correcto.
const nadaMarcado = done === 0;
if (nadaMarcado && escritas.length === 0) bail();

// ─── Anti-bucle: no repetir el mismo aviso ───────────────────────────────────
const signature = `${specName}:${open.length}:${done}`;
try {
  if (fs.existsSync(SEEN_FILE)) {
    const seen = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf-8'));
    if (seen.signature === signature) bail();
  }
} catch { /* fail-open */ }

try {
  fs.writeFileSync(SEEN_FILE, JSON.stringify({ signature, at: new Date().toISOString() }, null, 2));
} catch { /* fail-open */ }

// ─── Evidencia comprobable del filesystem ────────────────────────────────────
// Para las casillas que mencionan indices, el hook puede verificar por su
// cuenta si hubo escritura reciente y decirselo al agente.
const evidence = [];
try {
  const indexDir = path.join(cwd, 'indices');
  if (fs.existsSync(indexDir)) {
    const writes = escritas;
    if (writes.length > 0) {
      let lastIndexMtime = 0;
      for (const f of fs.readdirSync(indexDir).filter(f => f.endsWith('.md'))) {
        const st = fs.statSync(path.join(indexDir, f));
        if (st.mtimeMs > lastIndexMtime) lastIndexMtime = st.mtimeMs;
      }
      const stale = writes.filter(w => {
        const abs = path.isAbsolute(w) ? w : path.join(cwd, w);
        try { return fs.statSync(abs).mtimeMs > lastIndexMtime; } catch { return false; }
      });
      if (stale.length > 0) {
        evidence.push(`${stale.length} archivo(s) fuente son mas recientes que el ultimo indice — la casilla de indices sigue sin cumplirse de verdad.`);
      }
    }
  }
} catch { /* fail-open */ }

// ─── Reportar ────────────────────────────────────────────────────────────────
// Dos situaciones distintas, dos encabezados distintos: el que viene marcando
// casillas necesita saber que le falta; el que escribio sin marcar ninguna
// necesita saber que el criterio de done sigue intacto (HUE-004).
const encabezado = nadaMarcado
  ? `\u{1F9ED} SPEC REFLECTION: ${escritas.length} archivo(s) escrito(s) y ninguna casilla marcada en ${specName}.\n`
    + `   Los ${open.length} punto(s) del criterio de done siguen igual que cuando /plan lo genero.\n\n`
  : `\u{1F9ED} SPEC REFLECTION: ${specName} tiene ${open.length} punto(s) sin cerrar (${done} completado(s)).\n\n`;

process.stderr.write(
  encabezado +
  open.map(t => `  ☐ ${t}`).join('\n') + '\n\n' +
  (evidence.length > 0 ? evidence.map(e => `  ⚠️  ${e}`).join('\n') + '\n\n' : '') +
  `Para cada punto abierto, elige una:\n` +
  `  1. Cumplirlo ahora.\n` +
  `  2. Marcarlo [x] en ${specName} si ya esta hecho y solo faltaba registrarlo.\n` +
  `  3. Decirle al humano por que queda fuera de alcance.\n\n` +
  `No cierres la tarea dejando el criterio de done a medias en silencio.\n` +
  `Este aviso no se repite para el mismo estado del spec — si no cambia nada, no vuelve a salir.`
);
process.exit(2);
