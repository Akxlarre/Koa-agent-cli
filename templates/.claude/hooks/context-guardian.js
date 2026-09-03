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
 *
 * CAR-002 — este hook avisaba en TODAS las respuestas, indefinidamente. Su
 * condicion es el mtime de learnings.md, que no cambia por haber avisado, y
 * `Stop` corre por respuesta. El diagnostico ya estaba escrito en la casa:
 * spec-reflection, otro hook de Stop, tiene anti-bucle explicito y su docblock
 * explica por que. Este no lo aplico.
 *
 * Ahora pasa por budget.avisar(), cuyo default es no repetir (ADR-002 §2).
 */

const fs = require('fs');
const path = require('path');
const payload = require('./lib/payload.js');
const budget = require('./lib/budget.js');

payload.read().then(vigilar);

function vigilar(PAYLOAD) {
const cwd = PAYLOAD.cwd;
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

// La condicion de este aviso es el mtime de learnings.md, que NO cambia por
// haber avisado. Sin esto, `Stop` —que corre por respuesta— lo repite en cada
// una hasta que la persona toque el archivo. `avisar` no repite por defecto, y
// el dia que learnings.md cambie de fecha el texto cambia con el, asi que la
// dedup por contenido lo deja pasar solo (CAR-002 / ADR-002 §2).
const mensaje = budget.avisar(PAYLOAD, 'learnings-viejo', warnings.join('\n\n'));
if (mensaje === null) {
  process.exit(0);
}

process.stderr.write(
  '\u2500\u2500\u2500 Context Guardian \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
  mensaje + '\n' +
  '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
);
process.exit(2);
} // fin de vigilar()
