#!/usr/bin/env node
// PostToolUse hook: runs prettier on edited .ts, .html, .scss files
// Receives tool use context as JSON via stdin
//
// SEC-001 — la ruta se interpolaba en un string de shell:
//
//     execSync(`npx prettier --write "${filePath}" --log-level warn`)
//
// Un nombre de archivo con comillas rompe el entrecomillado y lo que sigue lo
// ejecuta el shell. Demostrado con `x.ts" ; touch /tmp/PWNED ; echo "a.ts`, que
// ademas pasa el filtro de extension porque termina en .ts.
//
// execFileSync sin shell pasa el argumento tal cual: no hay string que romper.

import { execFileSync } from 'child_process';

let data = '';
process.stdin.on('data', chunk => (data += chunk));
process.stdin.on('end', () => {
  try {
    const tool = JSON.parse(data);
    const filePath =
      tool.tool_input?.file_path ||
      tool.tool_input?.path ||
      tool.tool_input?.new_file_path ||
      '';

    if (filePath && /\.(ts|html|scss|css)$/.test(filePath)) {
      // Sin shell: cada argumento va como argumento, no como texto a interpretar.
      execFileSync('npx', ['prettier', '--write', filePath, '--log-level', 'warn'], {
        stdio: 'inherit',
        timeout: 15000,
      });
    }
  } catch {
    // Prettier not installed, file not found, or invalid JSON — silently skip
  }
});
