#!/usr/bin/env node
/**
 * context-guardian.js — Stop Hook (command)
 *
 * Vigila la frescura de los archivos de contexto semántico.
 * Complementa sync-check.js (que audita índices de código) con
 * una auditoría de la capa de contexto humano (context/).
 *
 * Checks:
 *   1. context/learnings.md → sin actualizar en >14 días: sugerir registrar aprendizajes
 *
 * La frescura de context/brief.md se auditaba aquí y se movió a session-start.js:
 * avisar en el Stop hook que el brief estaba viejo llega después de que el agente
 * ya codeó contra el objetivo equivocado. Ese aviso pertenece al arranque.
 * Lo que SÍ tiene sentido preguntar al cerrar es lo de abajo: "¿aprendiste algo hoy?".
 *
 * Exit codes:
 *   0 = ok / nada que reportar
 *   2 = avisar al agente (stderr) sobre contexto desactualizado
 */

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const warnings = [];

// ─── Check: learnings.md sin actualizar ───────────────────────────────────
const learningsPath = path.join(cwd, 'context', 'learnings.md');
if (fs.existsSync(learningsPath)) {
  try {
    const stat = fs.statSync(learningsPath);
    const daysSince = Math.floor((Date.now() - stat.mtimeMs) / 86400000);
    if (daysSince > 14) {
      warnings.push(
        `\u{1F4DA} LEARNINGS: context/learnings.md no ha sido actualizado en ${daysSince} dias.\n` +
        `   Si aprendiste algo esta sesion (quirks de APIs, terminologia del cliente,\n` +
        `   decisiones con motivo), considera registrarlo en context/learnings.md.`
      );
    }
  } catch { /* fail-open */ }
}

if (warnings.length === 0) {
  process.exit(0);
}

process.stderr.write(
  '\u2500\u2500\u2500 Context Guardian \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
  warnings.join('\n\n') + '\n' +
  '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
);
process.exit(2);
