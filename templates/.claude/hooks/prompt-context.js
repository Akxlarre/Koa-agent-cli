#!/usr/bin/env node
/**
 * prompt-context.js — UserPromptSubmit Hook
 *
 * El punto de intervención más temprano que existe: corre ANTES de que Claude
 * vea el prompt del humano.
 *
 * SessionStart ya inyectó lo pesado (índices + brief). Este hook NO lo repite:
 * corre en cada prompt, así que repetir 2 KB de índices en cada turno sería la
 * forma más cara posible de no aportar nada.
 *
 * Solo inyecta lo que se degrada con el tiempo dentro de una misma sesión:
 *
 *   1. El "Out of scope" del brief — la restricción que el agente olvida primero,
 *      porque nada en la conversación se la vuelve a recordar.
 *   2. Las casillas pendientes del task-spec activo — dónde iba el trabajo.
 *
 * Dedup: cada bloque se inyecta como máximo una vez cada N prompts, y solo si su
 * contenido cambió. Un recordatorio que aparece en cada turno deja de leerse.
 *
 * Esa dedup nació acá y hoy vive en `lib/budget.js`: este hook fue el único que
 * la tuvo, y los otros tres que inyectaban contexto pagaban el costo completo en
 * cada llamada (CAR-001, CAR-002, CAR-004). Este archivo es el que ahora la usa
 * en vez de tenerla.
 *
 * Con el mismo cambio se va el último `CLAUDE_SESSION_ID` del harness (HUE-002):
 * la variable no existe, así que `sessionId` era siempre `'default'` y el estado
 * de dedup era un archivo único en TMPDIR compartido por toda la máquina — dos
 * proyectos abiertos a la vez se callaban el recordatorio entre sí.
 *
 * stdout (JSON con additionalContext) → se agrega al contexto de Claude.
 * Exit 0 siempre: este hook informa, nunca bloquea un prompt del humano.
 */

const fs = require('fs');
const path = require('path');
const payload = require('./lib/payload.js');
const budget = require('./lib/budget.js');

// Cada cuántos prompts se puede repetir un bloque cuyo contenido no cambió.
const REPEAT_EVERY = 8;

payload.read().then((PAYLOAD) => {
  try {
    emit(PAYLOAD);
  } catch {
    /* fail-open — jamás bloquear el prompt del humano */
  }
  process.exit(0);
});

/**
 * Devuelve el cuerpo de una seccion markdown de nivel 2, sin comentarios HTML.
 *
 * Se recorre por lineas en vez de usar un regex con lookahead de fin de texto:
 * JavaScript no tiene `\Z`, y `$` bajo la flag `m` significa fin de LINEA, asi
 * que la ultima seccion del archivo — el caso normal para "Out of scope" — se
 * capturaria vacia. Iterar es mas largo y no tiene ese filo.
 *
 * @returns {string|null} cuerpo con contenido real, o null si falta o esta vacia
 */
function extractSection(raw, headingRe) {
  const lines = String(raw).split('\n');
  const start = lines.findIndex(l => headingRe.test(l));
  if (start === -1) return null;

  const body = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;  // proxima seccion de nivel 2
    body.push(lines[i]);
  }

  const cleaned = body.join('\n').replace(/<!--[\s\S]*?-->/g, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Pasa un bloque por el presupuesto y lo agrega si corresponde emitirlo.
 *
 * `cutAt: null` porque `DETAIL:BEGIN` es un marcador de los índices: acá cortaría
 * en medio de un brief que lo mencione. Ámbito de hilo (ADR-003 §1): «ya lo dije»
 * es una afirmación sobre un contexto, y el subagente tiene el suyo.
 */
function agregar(PAYLOAD, parts, key, encabezado, body) {
  const texto = budget.inject(PAYLOAD, `prompt-${key}`, body, {
    repeatEvery: REPEAT_EVERY,
    cutAt: null,
    scope: 'hilo',
  });
  if (texto !== null) parts.push(`${encabezado}\n${texto}`);
}

function emit(PAYLOAD) {
  const cwd = PAYLOAD.cwd;
  const parts = [];

  // ── 1. Out of scope del brief ─────────────────────────────────────────────
  try {
    const briefPath = path.join(cwd, 'context', 'brief.md');
    if (fs.existsSync(briefPath)) {
      const body = extractSection(fs.readFileSync(briefPath, 'utf-8'), /^##\s*Out of scope\b/i);
      if (body) {
        agregar(PAYLOAD, parts, 'scope',
          '[FUERA DE ALCANCE esta sesión — no lo toques aunque parezca relacionado]', body);
      }
    }
  } catch { /* fail-open */ }

  // ── 2. Pendientes del task-spec activo ────────────────────────────────────
  try {
    const tempDir = path.join(cwd, '.claude', 'temp');
    if (fs.existsSync(tempDir)) {
      const specs = fs.readdirSync(tempDir)
        .filter(f => f.startsWith('task-spec-') && f.endsWith('.md'))
        .sort();
      const latest = specs[specs.length - 1];
      if (latest) {
        const pending = fs.readFileSync(path.join(tempDir, latest), 'utf-8')
          .split('\n')
          .filter(l => /^\s*-\s*\[ \]/.test(l))
          .map(l => l.trim());
        if (pending.length > 0) {
          agregar(PAYLOAD, parts, 'spec', `[PENDIENTE en ${latest}]`, pending.join('\n'));
        }
      }
    }
  } catch { /* fail-open */ }

  if (parts.length === 0) return;

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: parts.join('\n\n'),
    },
  }));
}
