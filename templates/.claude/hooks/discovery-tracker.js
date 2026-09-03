#!/usr/bin/env node
/**
 * discovery-tracker.js — PostToolUse Hook (Read)
 *
 * Rastrea qué leyó el agente: `indices/` **y también** `context/`.
 * Escribe una línea por lectura en un flag temporal por sesión,
 * `.claude/temp/session/<sid>/discovery.flag`.
 *
 * Flujo:
 *   1. Claude hace Read("indices/COMPONENTS.md")
 *   2. Este hook detecta que es un archivo de indices/ o de context/
 *   3. Agrega la línea `<fecha> | <origen> | <ruta>` al flag
 *
 * ── Que este hook escriba la línea no significa que abra nada (INC-006) ─────
 *
 * El docblock decía «rastrea cuando Claude lee archivos de indices/» y que con
 * eso «el Discovery Gate ya no bloquea escrituras». Las dos mitades quedaron
 * viejas, y en direcciones distintas: escribe ante `context/` también, y desde
 * HUE-001 el Gate ya no se conforma con que el archivo exista.
 *
 * Los tres consumidores cortan la misma línea de forma distinta, y conviene
 * saberlo antes de tocar el formato:
 *
 *   `pre-write-guard.js`  (Discovery Gate) exige una línea con `indices/`.
 *                         Leer sólo `context/brief.md` NO levanta el bloqueo:
 *                         su mensaje dice «lee los índices del proyecto».
 *   `compact-recovery.js` parsea `indices/NOMBRE.md` para re-inyectar después
 *                         de una compactación sólo los índices ya leídos.
 *   `session-start.js`    escribe en el mismo flag, con origen `SESSION-START`.
 *
 * O sea: `context/` se registra —es información real sobre qué vio el agente—
 * y ninguno de los tres lo usa hoy para abrir nada. Si mañana alguno lo usara,
 * que sea una decisión y no una consecuencia de este `includes`.
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
