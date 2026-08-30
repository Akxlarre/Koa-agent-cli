#!/usr/bin/env node
/**
 * discovery-tracker.js — PostToolUse Hook (Read)
 *
 * Rastrea cuando Claude lee archivos de indices/.
 * Crea un flag temporal por sesión que el Discovery Gate (pre-write-guard.js)
 * verifica antes de permitir escrituras en código fuente.
 *
 * Flujo:
 *   1. Claude hace Read("indices/COMPONENTS.md")
 *   2. Este hook detecta que es un archivo de indices/
 *   3. Crea/actualiza el flag: .claude/temp/session/<sid>/discovery.flag
 *   4. El Discovery Gate ya no bloquea escrituras para esta sesión
 */

const fs = require('fs');
const path = require('path');
const session = require('./lib/session.js');

// SEC-04: Limit stdin to 10 MB to prevent memory exhaustion from crafted hook inputs.
const MAX_STDIN_BYTES = 10 * 1024 * 1024;
let data = '';
let dataSize = 0;
process.stdin.on('data', chunk => {
  dataSize += chunk.length;
  if (dataSize > MAX_STDIN_BYTES) { process.exit(0); }
  data += chunk;
});
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = (input.tool_input?.file_path || '').replace(/\\/g, '/');
    const cwd = input.cwd || process.cwd();

    // Detectar lectura de índices estructurales o contexto semántico
    if (filePath.includes('indices/') || filePath.includes('context/')) {
      // HUE-002 / DUP-004: la clave sale del payload, y la linea registra el
      // ORIGEN para que el Gate pueda distinguir una lectura del hilo principal
      // de una de un subagente.
      const origen = input.agent_type ? `SUBAGENT:${input.agent_type}` : 'READ';
      session.appendState(
        input,
        'discovery.flag',
        `${new Date().toISOString()} | ${origen} | ${filePath}`,
      );
    }

    // ── Brief staleness check ──────────────────────────────────────────────
    // Si el agente acaba de leer context/brief.md, verificar si last_updated
    // es mayor a 7 días. Si es así, inyectar warning al contexto inmediatamente.
    if (filePath.includes('context/brief.md')) {
      try {
        const briefFullPath = path.join(cwd, 'context', 'brief.md');
        if (fs.existsSync(briefFullPath)) {
          const content = fs.readFileSync(briefFullPath, 'utf-8');
          const match = content.match(/\*\*last_updated:\*\*\s*(\d{4}-\d{2}-\d{2})/);
          if (match) {
            const daysSince = Math.floor((Date.now() - new Date(match[1]).getTime()) / 86400000);
            if (daysSince > 7) {
              process.stdout.write(JSON.stringify({
                message: `\u26A0\uFE0F BRIEF STALE (${daysSince}d): context/brief.md fue actualizado el ${match[1]}. Verifica con el humano si el objetivo de sesion sigue vigente antes de continuar.`
              }));
            }
          }
        }
      } catch { /* fail-open */ }
    }
  } catch {
    // Silently skip — no bloquear la operación de Read
  }

  process.exit(0);
});
