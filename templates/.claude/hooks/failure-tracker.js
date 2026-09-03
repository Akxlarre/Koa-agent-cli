#!/usr/bin/env node
/**
 * failure-tracker.js — PostToolUseFailure Hook
 *
 * Captures tool execution failures and records them in LESSONS_LEARNED.md
 * with guardrails: max 20 entries, deduplication, automatic rotation.
 *
 * Input (stdin): JSON with tool_name, tool_input, error details
 * Output (stdout): JSON message acknowledging the failure was recorded
 *
 * El FORMATO del archivo vive en lib/lessons.js, no acá. Dos motivos, los dos
 * medidos:
 *
 *   HUE-016  un error con `|` partia la fila, y la firma —que es la clave del
 *            dedup— volvia truncada al re-parsear. Cinco fallas identicas
 *            producian cinco filas en vez de una con contador 5, y con
 *            MAX_ENTRIES = 20 la rotacion desalojaba lecciones buenas.
 *
 *   DUP-002  este hook reescribia el archivo ENTERO desde su modelo de tabla, y
 *            `lint-arch-wrapper` escribe secciones en prosa en el mismo archivo.
 *            Verificado: una seccion del wrapper desaparecia con la primera
 *            falla de cualquier otra tool. La tabla vive ahora entre marcadores
 *            AUTO-GENERATED y lo de afuera se preserva.
 */

const fs = require('fs');
const path = require('path');
const lessons = require('./lib/lessons.js');

const MAX_ENTRIES = 20;
const LESSONS_FILE = path.join(process.cwd(), '.claude', 'temp', 'LESSONS_LEARNED.md');
const TEMP_DIR = path.join(process.cwd(), '.claude', 'temp');

// Read stdin — SEC-04: cap at 10 MB to prevent memory exhaustion.
const MAX_STDIN_BYTES = 10 * 1024 * 1024;
let input = '';
let inputSize = 0;
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  inputSize += Buffer.byteLength(chunk, 'utf-8');
  if (inputSize > MAX_STDIN_BYTES) { process.exit(0); }
  input += chunk;
});
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input);
    const toolName = event.tool_name || 'unknown';
    const toolInput = event.tool_input || {};
    const error = event.error || event.stderr || 'Unknown error';

    // Extract a short signature for dedup (tool + first 80 chars of error)
    const errorSnippet = String(error).replace(/\s+/g, ' ').trim().slice(0, 80);
    const signature = `${toolName}:${errorSnippet}`;

    // Ensure temp dir exists
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    // Read existing lessons
    let existingContent = '';
    let entries = [];
    if (fs.existsSync(LESSONS_FILE)) {
      existingContent = fs.readFileSync(LESSONS_FILE, 'utf-8');
      entries = lessons.parse(existingContent);
    }
    // Todo lo que no es la tabla —las secciones de lint-arch-wrapper, notas a
    // mano— vuelve tal cual al reescribir (DUP-002).
    const resto = lessons.fueraDeLaRegion(existingContent);

    // Dedup: skip if same signature already exists
    const isDuplicate = entries.some((e) => e.signature === signature);
    if (isDuplicate) {
      // Update occurrence count on existing entry
      entries = entries.map((e) => {
        if (e.signature === signature) {
          e.occurrences = (e.occurrences || 1) + 1;
          e.lastSeen = new Date().toISOString().split('T')[0];
        }
        return e;
      });
    } else {
      // Add new entry
      const newEntry = {
        date: new Date().toISOString().split('T')[0],
        lastSeen: new Date().toISOString().split('T')[0],
        tool: toolName,
        error: errorSnippet,
        signature,
        occurrences: 1,
        context: typeof toolInput === 'object'
          ? (toolInput.file_path || toolInput.command || '').slice(0, 100)
          : '',
      };
      entries.push(newEntry);
    }

    // Rotation: keep only the most recent MAX_ENTRIES
    if (entries.length > MAX_ENTRIES) {
      entries = entries.slice(entries.length - MAX_ENTRIES);
    }

    // Write back
    fs.writeFileSync(LESSONS_FILE, lessons.render(entries, resto), 'utf-8');

    // Emit feedback to Claude context
    const msg = isDuplicate
      ? `Failure recorded (duplicate #${entries.find((e) => e.signature === signature)?.occurrences}): ${toolName} — ${errorSnippet}`
      : `New failure recorded: ${toolName} — ${errorSnippet}`;

    process.stdout.write(JSON.stringify({ message: msg }));
  } catch {
    // Silent fail — don't block Claude on tracker errors
    process.exit(0);
  }
});
