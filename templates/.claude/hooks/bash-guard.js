#!/usr/bin/env node
/**
 * bash-guard.js — PreToolUse Hook (Bash)
 *
 * Protege contra:
 *   1. Creación de archivos .ts/.html/.scss via Bash (debe usar Edit/Write)
 *   2. Operaciones destructivas sobre directorios críticos del proyecto
 *   3. Instalación/desinstalación de dependencias sin confirmación explícita
 *
 * Exit codes:
 *   0 = permitir el comando
 *   2 = bloquear el comando
 */

// SEC-04: Limit stdin to 10 MB to prevent memory exhaustion.
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
    const command = input.tool_input?.command || '';

    // SEC-07: Normalize whitespace (tabs, multiple spaces) before matching
    // to prevent bypass via tab characters or non-standard spacing.
    const normalizedCmd = command.replace(/\t/g, ' ').replace(/  +/g, ' ');

    // ═══════════════════════════════════════════════════════════════════════
    // 1. Bloquear creación de archivos fuente via Bash
    // ═══════════════════════════════════════════════════════════════════════
    // SEC-07: Use both original and normalized command. Patterns now also catch
    // heredoc redirections (<<EOF) and process substitution variants.
    const fileCreationPatterns = [
      /(?:cat|echo|printf|tee)\b[^|]*>\s*.*src\/app\/.*\.(?:ts|html|scss)/,
      />\s*.*src\/app\/.*\.(?:ts|html|scss)/,
      /(?:cat|echo|printf|tee)\b[^|]*>\s*.*supabase\/migrations\/.*\.sql/,
      />\s*.*supabase\/migrations\/.*\.sql/,
      // Creacion sin redireccion: `touch`, `cp` y `mv` producen archivos fuente
      // sin pasar por Edit/Write, asi que el Architect Guard nunca ve el contenido.
      /\b(?:touch|cp|mv|install)\b[^|;&]*\bsrc\/app\/[^\s]*\.(?:ts|html|scss)/,
      /\b(?:touch|cp|mv|install)\b[^|;&]*\bsupabase\/migrations\/[^\s]*\.sql/,
      // Generadores de codigo: el schematic escribe el componente directo a disco.
      /\bng\s+(?:g|generate)\b/,
    ];

    for (const pattern of fileCreationPatterns) {
      if (pattern.test(command) || pattern.test(normalizedCmd)) {
        process.stderr.write(
          `\u{1F6AB} BASH GUARD: No crear archivos de codigo fuente mediante Bash.\n` +
          `Usa las herramientas Edit o Write para crear y modificar archivos .ts, .html, .scss y .sql.\n` +
          `Esto permite que los guardrails arquitectonicos validen tu codigo.`
        );
        process.exit(2);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. Bloquear operaciones destructivas en directorios críticos
    // ═══════════════════════════════════════════════════════════════════════
    // SEC-07: Patterns now match -rf, -fr, -r -f (any order) and double-dash
    // separator (rm -rf -- src/app) to prevent flag-reordering bypasses.
    const destructivePatterns = [
      {
        re: /\brm\b.*-[a-zA-Z]*r[a-zA-Z]*\b.*(?:src\/app|\.claude|indices|supabase)/,
        msg: 'Eliminacion recursiva de directorio critico',
      },
      {
        re: /\brm\b.*(?:\.claude\/hooks|\.claude\/settings|architect\.js)/,
        msg: 'Eliminacion de archivos del sistema de guardrails',
      },
      {
        re: />\s*(?:\.claude\/settings(?:\.local)?\.json|\.claude\/hooks\/)/,
        msg: 'Sobreescritura de configuracion de guardrails',
      },
    ];

    for (const { re, msg } of destructivePatterns) {
      if (re.test(command) || re.test(normalizedCmd)) {
        process.stderr.write(
          `\u{1F6E1}\u{FE0F} BASH GUARD: Operacion destructiva bloqueada.\n` +
          `Razon: ${msg}\n` +
          `Si realmente necesitas hacer esto, pide al humano que lo ejecute manualmente.`
        );
        process.exit(2);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3. APPROVAL GATE — Operaciones irreversibles sobre la base de datos
    // ═══════════════════════════════════════════════════════════════════════
    // Las capas 1 y 2 protegen el filesystem, que es recuperable con git.
    // Una migracion aplicada contra una base remota no lo es: no hay undo,
    // y `db reset` borra los datos. Estas operaciones las autoriza un humano,
    // no el agente — aunque el propio humano se lo haya pedido en el prompt.
    const dbApprovalPatterns = [
      {
        re: /\bsupabase\b[^|;&]*\bdb\s+push\b/,
        msg: 'Aplicar migraciones a la base de datos',
        why: 'Ejecuta DDL sin rollback automatico. Si la migracion esta mal, el esquema queda roto.',
      },
      {
        re: /\bsupabase\b[^|;&]*\bdb\s+reset\b/,
        msg: 'Reset de la base de datos',
        why: 'BORRA TODOS LOS DATOS y reaplica las migraciones desde cero.',
      },
      {
        re: /\bsupabase\b[^|;&]*\bmigration\s+repair\b/,
        msg: 'Reparacion del historial de migraciones',
        why: 'Reescribe el registro de migraciones aplicadas. Deja el esquema y el historial desalineados si se usa mal.',
      },
      {
        re: /\bsupabase\b[^|;&]*\blink\b/,
        msg: 'Vincular el proyecto local a un proyecto remoto',
        why: 'Define contra que base apuntan los comandos siguientes. Apuntar a produccion por error es como se rompe produccion.',
      },
      {
        re: /\b(?:psql|supabase\s+db\s+execute)\b[\s\S]*\b(?:DROP|TRUNCATE|DELETE\s+FROM|ALTER\s+TABLE)\b/i,
        msg: 'SQL destructivo ejecutado directamente',
        why: 'Los cambios de esquema van en migraciones versionadas en supabase/migrations/, no en SQL suelto.',
      },
    ];

    for (const { re, msg, why } of dbApprovalPatterns) {
      if (re.test(command) || re.test(normalizedCmd)) {
        process.stderr.write(
          `\u{1F9EF} APPROVAL GATE: Esta operacion la tiene que ejecutar un humano.\n\n` +
          `Comando: ${command.trim().slice(0, 200)}\n` +
          `Operacion: ${msg}\n` +
          `Por que: ${why}\n\n` +
          `Que hacer:\n` +
          `  1. Deja la migracion escrita en supabase/migrations/ (eso si es tu trabajo).\n` +
          `  2. Dile al humano el comando exacto que tiene que correr y contra que entorno.\n` +
          `  3. Espera confirmacion antes de dar la tarea por terminada.\n\n` +
          `No busques una via alterna: ni MCP con escritura, ni psql directo, ni scripts npm que\n` +
          `envuelvan el mismo comando. El gate existe justamente para que esto lo mire una persona.`
        );
        process.exit(2);
      }
    }

    process.exit(0);
  } catch {
    // Fail-open: si el hook falla, permitir el comando
    process.exit(0);
  }
});
