#!/usr/bin/env node
/**
 * compact-recovery.js — PostCompact Hook
 *
 * Se ejecuta automáticamente después de cada compactación de contexto.
 * Re-inyecta los índices del proyecto al contexto de Claude.
 *
 * Mejoras v2:
 *   - Inyección SELECTIVA: solo los índices que el agente ya había leído
 *     (más los 3 core siempre). Lee el discovery flag para decidir.
 *   - Inyección PARCIAL: corta en <!-- DETAIL:BEGIN --> para inyectar
 *     solo las tablas de Quick Reference, no los ejemplos de código.
 *
 * stdout → se agrega directamente al contexto de Claude.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const payload = require('./lib/payload.js');
const session = require('./lib/session.js');
const budget = require('./lib/budget.js');

// Lee su payload por stdin como el resto: de ahi sale el `session_id` que los
// cuatro hooks del discovery flag deben compartir. Con un id distinto,
// compact-recovery no encontraria lo que discovery-tracker escribio.
payload.read().then((PAYLOAD) => reinyectar(PAYLOAD, PAYLOAD.cwd));

function reinyectar(PAYLOAD, cwd) {
const DETAIL_MARKER = '<!-- DETAIL:BEGIN -->';

// El mismo techo por indice que session-start. Sin el, HUE-017: los indices
// entraban enteros y los cuatro context/*.md en crudo.
const MAX_INDEX_CHARS = 2500;

// Índices siempre inyectados (base de todo proyecto)
const CORE_INDICES = new Set(['COMPONENTS', 'SERVICES', 'FACADES']);

// Mapa completo de índices disponibles
const ALL_INDEX_FILES = {
  COMPONENTS: 'indices/COMPONENTS.md',
  SERVICES: 'indices/SERVICES.md',
  FACADES: 'indices/FACADES.md',
  MODELS: 'indices/MODELS.md',
  DATABASE: 'indices/DATABASE.md',
  DIRECTIVES: 'indices/DIRECTIVES.md',
  STYLES: 'indices/STYLES.md',
  PIPES: 'indices/PIPES.md',
  'ANTI-PATTERNS': 'indices/ANTI-PATTERNS.md',
  STORES: 'indices/STORES.md',
};

// ─── Leer discovery flag: qué índices leyó el agente antes del compact ───────
const touchedIndexNames = new Set(CORE_INDICES);
try {
  const flagContent = session.readText(PAYLOAD, 'discovery.flag');
  if (flagContent) {
    for (const line of flagContent.split('\n')) {
      const match = line.match(/indices\/([\w-]+)\.md/i);
      if (match) touchedIndexNames.add(match[1].toUpperCase());
    }
  }
} catch { /* fail-open — solo CORE */ }

// ─── Construir output ────────────────────────────────────────────────────────
let output = '';
output += '══════════════════════════════════════════════════════════════\n';
output += ' CONTEXTO RE-INYECTADO (post-compactacion por Koa Hooks)\n';
output += '══════════════════════════════════════════════════════════════\n\n';
output += 'Contexto compactado. Se restauran los indices que estabas usando\n';
output += '(Quick Reference — sin ejemplos de codigo para ahorrar tokens).\n\n';

let injectedCount = 0;

for (const [name, relativePath] of Object.entries(ALL_INDEX_FILES)) {
  if (!touchedIndexNames.has(name)) continue;

  const fullPath = path.join(cwd, relativePath);
  if (!fs.existsSync(fullPath)) continue;

  // HUE-017: no habia tope. Se corta en DETAIL:BEGIN y se aplica el mismo
  // techo por indice que usa session-start, para que una compactacion no
  // devuelva mas contexto del que el runtime acaba de liberar.
  const content = budget.recortar(fs.readFileSync(fullPath, 'utf-8').trim(),
    { maxChars: MAX_INDEX_CHARS });
  if (!content) continue;

  output += `--- ${relativePath} ---\n`;
  output += content + '\n\n';
  injectedCount++;
}

if (injectedCount === 0) {
  output += '(No se encontraron archivos de indices en el proyecto)\n';
} else {
  output += '══════════════════════════════════════════════════════════════\n';
  output += `${injectedCount} indices restaurados (Quick Reference).\n`;
  output += 'Para ver ejemplos completos: lee el archivo de indice directamente.\n';
  output += '══════════════════════════════════════════════════════════════\n';
}


// ─── Context files (domain + brief) ─────────────────────────────────────────────────────
// Inyectar contexto semantico privado si existe y tiene contenido util
const CONTEXT_FILES = [
  { label: 'context/domain.md',      path: 'context/domain.md'      },
  { label: 'context/brief.md',       path: 'context/brief.md'       },
  { label: 'context/constraints.md', path: 'context/constraints.md' },
  { label: 'context/learnings.md',   path: 'context/learnings.md'   },
];

let contextAdded = false;
for (const cf of CONTEXT_FILES) {
  const fullPath = path.join(cwd, cf.path);
  if (!fs.existsSync(fullPath)) continue;

  const raw = fs.readFileSync(fullPath, 'utf-8').trim();
  // DEC-006: el filtro anterior solo quitaba comentarios HTML, y las plantillas
  // de context/ pasaban igual porque su andamiaje markdown —encabezados y
  // blockquotes de instrucciones— ya supera los 80 chars por si solo. Medido:
  // brief 456, domain 760, constraints 327, learnings 457. budget.isPlaceholder
  // quita tambien ese andamiaje; las cuatro caen a 0-66.
  if (budget.isPlaceholder(raw)) continue;

  if (!contextAdded) {
    output += '\n─── Contexto del proyecto (context/) ───\n\n';
    contextAdded = true;
  }
  output += '--- ' + cf.label + ' ---\n';
  output += budget.recortar(raw, { maxChars: MAX_INDEX_CHARS, cutAt: null }) + '\n\n';
}

if (contextAdded) {
  output += '─── Fin contexto del proyecto ───\n\n';
}

// ─── Trabajo pendiente del task-spec activo ─────────────────────────────────
// Context Offloading: tras un compact solo se re-inyecta lo que sigue ABIERTO.
// Los pasos ya completados ([x]) se descartan — el agente no necesita recordar
// lo que ya hizo, solo lo que le falta.
try {
  const specDir = path.join(cwd, '.claude', 'temp');
  if (fs.existsSync(specDir)) {
    const specs = fs.readdirSync(specDir)
      .filter(f => f.startsWith('task-spec-') && f.endsWith('.md'))
      .sort();
    const latest = specs[specs.length - 1];
    if (latest) {
      const specRaw = fs.readFileSync(path.join(specDir, latest), 'utf-8');
      const pending = specRaw
        .split('\n')
        .filter(l => /^\s*-\s*\[ \]/.test(l))
        .map(l => l.trim());
      if (pending.length > 0) {
        output += '─── Task-spec activo: ' + latest + ' ───\n';
        output += 'Pendiente (los pasos completados se omiten a proposito):\n';
        output += pending.join('\n') + '\n\n';
        output += 'Lee .claude/temp/' + latest + ' si necesitas el objetivo completo.\n';
        output += '─── Fin task-spec ───\n\n';
      }
    }
  }
} catch { /* fail-open */ }

process.stdout.write(output);
} // fin de reinyectar()
