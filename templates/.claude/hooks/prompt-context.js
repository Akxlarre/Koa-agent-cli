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
 * stdout (JSON con additionalContext) → se agrega al contexto de Claude.
 * Exit 0 siempre: este hook informa, nunca bloquea un prompt del humano.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const cwd = process.cwd();
const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
const STATE_PATH = path.join(os.tmpdir(), `koa-prompt-ctx-${sessionId}.json`);

// Cada cuántos prompts se puede repetir un bloque cuyo contenido no cambió.
const REPEAT_EVERY = 8;

// SEC-04: cap de stdin igual que el resto de los hooks.
const MAX_STDIN_BYTES = 10 * 1024 * 1024;
let data = '';
let dataSize = 0;
process.stdin.on('data', chunk => {
  dataSize += chunk.length;
  if (dataSize > MAX_STDIN_BYTES) process.exit(0);
  data += chunk;
});

process.stdin.on('end', () => {
  try {
    emit();
  } catch {
    /* fail-open — jamás bloquear el prompt del humano */
  }
  process.exit(0);
});

function loadState() {
  try {
    if (fs.existsSync(STATE_PATH)) return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  } catch { /* ignore */ }
  return { n: 0, blocks: {} };
}

/**
 * Decide si un bloque debe inyectarse en este prompt.
 * Se inyecta si nunca se vio, si su contenido cambió, o si pasaron
 * REPEAT_EVERY prompts desde la última vez.
 */
function shouldInject(state, key, content) {
  const prev = state.blocks[key];
  if (!prev) return true;
  if (prev.content !== content) return true;
  return state.n - prev.at >= REPEAT_EVERY;
}

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

function emit() {
  const state = loadState();
  state.n = (state.n || 0) + 1;

  const parts = [];

  // ── 1. Out of scope del brief ─────────────────────────────────────────────
  try {
    const briefPath = path.join(cwd, 'context', 'brief.md');
    if (fs.existsSync(briefPath)) {
      const body = extractSection(fs.readFileSync(briefPath, 'utf-8'), /^##\s*Out of scope\b/i);
      if (body && shouldInject(state, 'scope', body)) {
        parts.push(`[FUERA DE ALCANCE esta sesión — no lo toques aunque parezca relacionado]\n${body}`);
        state.blocks.scope = { content: body, at: state.n };
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
          const body = pending.join('\n');
          if (shouldInject(state, 'spec', body)) {
            parts.push(`[PENDIENTE en ${latest}]\n${body}`);
            state.blocks.spec = { content: body, at: state.n };
          }
        }
      }
    }
  } catch { /* fail-open */ }

  try { fs.writeFileSync(STATE_PATH, JSON.stringify(state)); } catch { /* ignore */ }

  if (parts.length === 0) return;

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: parts.join('\n\n'),
    },
  }));
}
