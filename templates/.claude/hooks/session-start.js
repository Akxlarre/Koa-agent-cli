#!/usr/bin/env node
/**
 * session-start.js — SessionStart Hook
 *
 * Vuelve PROACTIVO lo que hasta ahora era reactivo.
 *
 * Antes: el agente empezaba a ciegas, intentaba escribir, el Discovery Gate lo
 * bloqueaba, y recién ahí leía los índices. El bloqueo funcionaba, pero llegaba
 * tarde y costaba una ronda entera.
 *
 * Ahora: al abrir la sesión se inyectan los índices core y el objetivo del brief
 * antes de que el agente haga nada. El Gate queda como red de seguridad para el
 * caso en que esta inyección no ocurra (proyecto sin índices, hook desactivado),
 * no como el mecanismo principal.
 *
 * Efecto secundario deliberado: escribe el discovery flag. Si el agente YA tiene
 * los índices en contexto, bloquearlo por "no haberlos leído" sería falso — la
 * condición que el Gate protege está satisfecha.
 *
 * La frescura de context/brief.md se audita AQUÍ y no en el Stop hook: avisar al
 * final de la sesión que el brief estaba viejo llega después de que el agente ya
 * codeó con el objetivo equivocado.
 *
 * stdout → se agrega al contexto de Claude.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const cwd = process.cwd();
const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
const DETAIL_MARKER = '<!-- DETAIL:BEGIN -->';

// Presupuesto de tokens: esto se inyecta en CADA sesión, así que se mantiene
// deliberadamente corto. Los índices completos se leen bajo demanda.
const MAX_INDEX_CHARS = 2500;
const CORE_INDICES = ['COMPONENTS', 'SERVICES', 'FACADES'];

const parts = [];
const injectedIndices = [];

// ─── 1. Índices core (solo Quick Reference) ─────────────────────────────────
for (const name of CORE_INDICES) {
  const rel = `indices/${name}.md`;
  const full = path.join(cwd, rel);
  try {
    if (!fs.existsSync(full)) continue;
    let content = fs.readFileSync(full, 'utf-8').trim();
    if (!content) continue;

    const cutoff = content.indexOf(DETAIL_MARKER);
    if (cutoff > -1) content = content.slice(0, cutoff).trim();
    if (content.length > MAX_INDEX_CHARS) {
      content = content.slice(0, MAX_INDEX_CHARS).trimEnd() + '\n… (truncado — lee el archivo para el resto)';
    }

    parts.push(`--- ${rel} ---\n${content}`);
    injectedIndices.push(name);
  } catch { /* fail-open */ }
}

// ─── 2. Objetivo de la sesión (context/brief.md) ────────────────────────────
let briefWarning = null;
try {
  const briefPath = path.join(cwd, 'context', 'brief.md');
  if (fs.existsSync(briefPath)) {
    const raw = fs.readFileSync(briefPath, 'utf-8');

    // Frescura: se audita al ABRIR, no al cerrar.
    const m = raw.match(/\*\*last_updated:\*\*\s*(\d{4}-\d{2}-\d{2})/);
    if (m) {
      const days = Math.floor((Date.now() - new Date(m[1]).getTime()) / 86400000);
      if (days > 7) {
        briefWarning =
          `⚠️  BRIEF DESACTUALIZADO: context/brief.md se actualizó hace ${days} días (${m[1]}).\n` +
          `   Antes de escribir código, confirma con el humano que el objetivo sigue vigente.`;
      }
    }

    // Solo inyectar si tiene contenido real: la plantilla es casi toda comentarios HTML.
    const stripped = raw.replace(/<!--[\s\S]*?-->/g, '').trim();
    if (stripped.length >= 80) {
      parts.push(`--- context/brief.md (objetivo de esta sesión) ---\n${stripped}`);
    }
  }
} catch { /* fail-open */ }

// ─── 3. Task-spec con trabajo pendiente de una sesión anterior ──────────────
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
        parts.push(
          `--- Trabajo pendiente de ${latest} ---\n` +
          pending.join('\n') + '\n' +
          `Confirma con el humano si esta sesión continúa ese spec o empieza algo nuevo.`
        );
      }
    }
  }
} catch { /* fail-open */ }

// ─── 4. Levantar el Discovery Gate ──────────────────────────────────────────
// Si le dimos los índices, bloquearlo por "no leyó los índices" sería mentira.
if (injectedIndices.length > 0) {
  try {
    const flagPath = path.join(os.tmpdir(), `koa-discovery-${sessionId}.flag`);
    const stamp = new Date().toISOString();
    const entry = injectedIndices
      .map(n => `${stamp} | SESSION-START | indices/${n}.md\n`)
      .join('');
    fs.appendFileSync(flagPath, entry);
  } catch { /* fail-open — el Gate simplemente seguirá activo */ }
}

// ─── Emitir ─────────────────────────────────────────────────────────────────
if (parts.length === 0 && !briefWarning) process.exit(0);

let out = '';
out += '══════════════════════════════════════════════════════════════\n';
out += ' CONTEXTO DE ARRANQUE (Koa SessionStart)\n';
out += '══════════════════════════════════════════════════════════════\n\n';

if (briefWarning) out += briefWarning + '\n\n';
if (parts.length > 0) out += parts.join('\n\n') + '\n\n';

if (injectedIndices.length > 0) {
  out += `Índices ya en contexto: ${injectedIndices.join(', ')} (Quick Reference).\n`;
  out += 'Para el resto (MODELS, DATABASE, ANTI-PATTERNS, LAYOUTS…) o los ejemplos\n';
  out += 'completos, lee el archivo. Para un descubrimiento dirigido usa el\n';
  out += 'subagente discovery-scout en vez de leerlos todos.\n';
} else {
  out += 'No se encontraron índices en indices/ — el Discovery Gate sigue activo.\n';
}
out += '══════════════════════════════════════════════════════════════\n';

process.stdout.write(out);
process.exit(0);
