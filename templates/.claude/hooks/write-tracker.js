#!/usr/bin/env node
/**
 * write-tracker.js — PostToolUse Hook (Edit|Write|MultiEdit)
 *
 * Rastrea qué archivos fuente Angular fueron modificados en esta sesión.
 * Escribe la lista en .claude/temp/session-writes.json.
 *
 * Es el PRODUCTOR del contrato con más consumidores del harness: sync-check,
 * spec-diff-check y spec-reflection leen ese archivo. Ver lib/contracts.js.
 *
 * El sync-check (Stop hook) lo usa para auditar si los índices necesitan
 * actualización sin leer toda la conversación — O(archivos) en vez de
 * O(tokens de conversación).
 *
 * Migrado en la tanda 3 (ADR-001):
 *   - la entrada sale de lib/payload.js, que normaliza file_path/path
 *   - la decisión de qué rastrear sale de lib/paths.js `belongsToIndex`, que
 *     compara por PREFIJO sobre la ruta relativa. Antes era
 *     `.includes('src/app/')`, que daba verdadero para
 *     docs/ejemplos/src/app/x.ts y para cualquier cosa bajo node_modules.
 *   - se guarda la ruta RELATIVA, que es lo que lib/contracts.js declara como
 *     formato de este artefacto. Antes se guardaba tal como llegaba.
 */

const fs = require('fs');
const path = require('path');
const payload = require('./lib/payload.js');
const paths = require('./lib/paths.js');

payload.read().then((input) => {
  try {
    if (!paths.belongsToIndex(input.filePath, input.cwd)) {
      return process.exit(0);
    }

    const rel = paths.rel(input.filePath, input.cwd);
    const tempDir = path.join(input.cwd, '.claude', 'temp');
    const trackerPath = path.join(tempDir, 'session-writes.json');

    fs.mkdirSync(tempDir, { recursive: true });

    let writes = [];
    if (fs.existsSync(trackerPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(trackerPath, 'utf-8'));
        if (Array.isArray(parsed)) writes = parsed;
      } catch { writes = []; }
    }

    if (!writes.includes(rel)) {
      writes.push(rel);
      fs.writeFileSync(trackerPath, JSON.stringify(writes, null, 2));
    }
  } catch {
    // fail-open — nunca bloquear el flujo de trabajo
  }
  process.exit(0);
});
