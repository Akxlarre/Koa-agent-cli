#!/usr/bin/env node
/**
 * harness-gate.js — PreToolUse Hook (Edit|Write|MultiEdit)
 *
 * Gobierna las ediciones a las superficies de MEMORIA/GUÍA del propio harness
 * (.claude/rules/*.md, context/learnings.md, indices/ANTI-PATTERNS.md, CLAUDE.md)
 * y a los scripts de CAPACIDAD (scripts/*.js, .claude/scripts/*.js).
 *
 * Inspirado en el "Generalization Gate" y la regla de "placement" de
 * HarnessCompass (arXiv:2608.01918): las lecciones que se acumulan en el
 * harness deben ser principios reutilizables (con criterio de aplicabilidad),
 * nunca una respuesta a un track puntual; y la lógica determinista vive en
 * código (scripts/hooks), nunca como prosa disfrazada de mecanismo.
 *
 * Nota de scope: este blueprint puede traer el motor SDD dormido en
 * `.claude/hooks/sdd/` (specs/, fix-NNN, spec-NNNN, hotfix-NNN). specs/**
 * queda deliberadamente FUERA de este gate: ahí los track IDs SON el
 * contenido legítimo (contratos de spec/fix/hotfix), no una superficie de
 * guía global. Este hook nunca matchea rutas bajo specs/.
 *
 * Dos familias de chequeos:
 *
 *   A. GENERALIZATION GATE (superficies de guía)
 *      A1. Cita un track ID (fix-NNN/spec-NNNN/hotfix-NNN/task-NNN) sin
 *          ningún marcador de generalización cerca → probable "receta" en
 *          vez de regla.
 *      A2. Contiene un snippet de despacho por keyword-matching literal
 *          (`if ("token" in text)`) → exactamente el patrón que HarnessCompass
 *          prohíbe en cualquier superficie, incluida la de guía.
 *
 *   B. PLACEMENT GUARD (separación capacidad vs. guía)
 *      B1. Un archivo de guía (rules/learnings/ANTI-PATTERNS/CLAUDE.md) mete
 *          lógica ejecutable real (require/process.exit/fs.*) → eso es código,
 *          no prosa; debe vivir en scripts/.
 *      B2. Un script de capacidad (scripts/*.js) agrega solo un mensaje
 *          consultivo (console.log/warn con verbo de consejo) sin ningún
 *          mecanismo de bloqueo → eso es guía disfrazada de código; debe vivir
 *          en .claude/rules/ o context/learnings.md.
 *
 * Exit codes:
 *   0 = permitir la operación
 *   2 = bloquear la operación (stderr se envía a Claude como feedback)
 */

const path = require('path');

/**
 * El texto partido en las unidades donde una lección cabe entera (DEC-002).
 *
 * Una línea suelta es demasiado poco —una lección bien escrita ocupa dos o tres
 * y el criterio puede ir en la segunda—; el archivo entero es demasiado, que es
 * justo el bug. El párrafo es la unidad: se corta en línea en blanco, y también
 * al empezar un ítem de lista o un encabezado, porque una lista de viñetas es
 * un solo párrafo markdown y cada viñeta es una lección distinta.
 *
 * Las líneas de continuación (indentadas) se quedan con su viñeta.
 */
function parrafosDe(texto) {
  const unidades = [];
  let actual = [];
  const cerrar = () => { if (actual.length) { unidades.push(actual.join('\n')); actual = []; } };

  for (const linea of String(texto).split('\n')) {
    if (!linea.trim()) { cerrar(); continue; }
    if (/^\s{0,3}(?:[-*+]\s|\d+[.)]\s|#{1,6}\s|\|)/.test(linea)) cerrar();
    actual.push(linea);
  }
  cerrar();
  return unidades;
}

// SEC-04: Limit stdin to 10 MB to prevent memory exhaustion (DoS) from crafted hook inputs.
const MAX_STDIN_BYTES = 10 * 1024 * 1024;
let data = '';
let dataSize = 0;
process.stdin.on('data', chunk => {
  dataSize += chunk.length;
  if (dataSize > MAX_STDIN_BYTES) {
    process.stderr.write('harness-gate: stdin payload exceeds 10 MB limit — aborting (fail-open).\n');
    process.exit(0);
  }
  data += chunk;
});
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const filePath = input.tool_input?.file_path || input.tool_input?.path || '';
    const newContent = input.tool_input?.new_string || input.tool_input?.content || '';
    const normalizedPath = filePath.replace(/\\/g, '/');

    if (!filePath || !newContent) {
      process.exit(0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Clasificación de superficie
    // ═══════════════════════════════════════════════════════════════════════
    const isGuidanceSurface =
      normalizedPath.endsWith('context/learnings.md') ||
      normalizedPath.endsWith('indices/ANTI-PATTERNS.md') ||
      /\.claude\/rules\/[^/]+\.md$/.test(normalizedPath) ||
      /(^|\/)CLAUDE\.md$/.test(normalizedPath);

    const isCapabilityScript =
      (/(^|\/)scripts\/[^/]+\.js$/.test(normalizedPath) && !normalizedPath.endsWith('scripts/architect.js')) ||
      /\.claude\/scripts\/[^/]+\.js$/.test(normalizedPath);

    if (!isGuidanceSurface && !isCapabilityScript) {
      process.exit(0);
    }

    const violations = [];

    // ═══════════════════════════════════════════════════════════════════════
    // A. GENERALIZATION GATE — solo superficies de guía (nunca specs/**)
    // ═══════════════════════════════════════════════════════════════════════
    if (isGuidanceSurface) {
      const TRACK_ID_RE = /\b(?:fix|spec|hotfix|task)-\d{2,4}(?:-[a-z])?\b/i;
      const GENERALIZATION_MARKER_RE =
        /\b(cuando|siempre que|nunca|cada vez que|toda vez que|regla:|criterio|aplicabilidad|aplica cuando|no aplica|excepci[oó]n|independientemente de)\b/i;

      // DEC-002: esto se evaluaba sobre el TEXTO ENTERO, y «cuando» y «nunca»
      // son dos de las palabras mas frecuentes de la prosa tecnica en espanol.
      // Bastaba que el marcador apareciera en cualquier lugar del archivo, sin
      // ninguna relacion con el track citado. Medido: 13 de las 16 reglas del
      // template ya traen un marcador sin habérselo propuesto, y —lo peor— un
      // `learnings.md` con UNA sola leccion bien escrita arriba dejaba pasar
      // cualquier receta agregada despues, para siempre. El gate se apagaba
      // solo, a medida que crecia justo el archivo que vigila.
      //
      // Ahora se evalua por parrafo: el criterio tiene que estar DONDE esta el
      // track. Sigue siendo una heuristica lexica —lo dice el mensaje— y sigue
      // siendo evadible a proposito; lo que ya no hace es evadirse sola.
      const conRecetaSuelta = parrafosDe(newContent)
        .filter((p) => TRACK_ID_RE.test(p) && !GENERALIZATION_MARKER_RE.test(p));

      if (conRecetaSuelta.length > 0) {
        const muestra = conRecetaSuelta[0].trim().split('\n')[0].slice(0, 90);
        violations.push(
          `[GATE-A1] Citas un track (fix-/spec-/hotfix-/task-NNN) sin ningún criterio de aplicabilidad EN EL MISMO PÁRRAFO.\n` +
          `     Párrafo: "${muestra}${muestra.length >= 90 ? '…' : ''}"` +
          (conRecetaSuelta.length > 1 ? ` (y ${conRecetaSuelta.length - 1} más)` : '') + '\n' +
          '     Una lección de guía debe sobrevivir sin el ID: "cuando X, hacer Y; si Z, hacer W".\n' +
          '     El ID puede quedar como referencia histórica, pero el PRINCIPIO reusable tiene que estar escrito.\n' +
          '     Litmus test: ¿esto seguiría ayudando en un proyecto que nunca vio ese track?\n' +
          '     (Chequeo léxico: busca el criterio junto al track, no en el resto del archivo.)'
        );
      }

      const KEYWORD_DISPATCH_RE = /\bif\s*\([^)]{0,60}["'][\w][\w\- ]{2,}["'][^)]{0,60}\)/i;
      if (KEYWORD_DISPATCH_RE.test(newContent)) {
        violations.push(
          '[GATE-A2] Snippet de despacho por keyword-matching literal detectado (ej: if ("token" in text)).\n' +
          '     Ni siquiera como prosa/pseudo-código: una guía nunca debe codificar una rama que\n' +
          '     dispara solo con un token específico. Reescribe como un criterio evaluable en\n' +
          '     cualquier proyecto, o si de verdad necesita ser código determinista, va en scripts/.'
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // B1. PLACEMENT GUARD — código ejecutable colado en un archivo de guía
    // ═══════════════════════════════════════════════════════════════════════
    if (isGuidanceSurface) {
      const EXEC_CODE_RE = /(#!\/usr\/bin\/env node|\bprocess\.exit\s*\(|\brequire\s*\(\s*['"]|\bmodule\.exports\b|\bfs\.readFileSync\s*\(|\bfs\.writeFileSync\s*\()/;
      if (EXEC_CODE_RE.test(newContent)) {
        violations.push(
          '[GATE-B1] Este archivo de guía contiene lógica ejecutable real (require/process.exit/fs.*).\n' +
          '     Las superficies de guía (.claude/rules/, context/learnings.md, ANTI-PATTERNS.md, CLAUDE.md)\n' +
          '     son prosa que el agente lee — no código que corre. Si necesitas un chequeo determinista,\n' +
          '     créalo como script real en scripts/ (o .claude/scripts/) y referencia el resultado desde aquí.'
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // B2. PLACEMENT GUARD — consejo sin mecanismo colado en un script
    // ═══════════════════════════════════════════════════════════════════════
    if (isCapabilityScript) {
      const ADVICE_VERB_RE = /(recuerda|no olvides|aseg[uú]rate|considera|deber[ií]as|ten en cuenta|dile al agente|instruye)/i;
      const LOG_CALL_RE = /console\.(?:log|warn)\s*\(/;
      const HAS_GATE_RE = /process\.exit\(\s*2\s*\)/;

      if (LOG_CALL_RE.test(newContent) && ADVICE_VERB_RE.test(newContent) && !HAS_GATE_RE.test(newContent)) {
        violations.push(
          '[GATE-B2] Agregaste un console.log/warn con tono de consejo pero sin ningún process.exit(2)\n' +
          '     que lo respalde. Un script de capacidad debe DETECTAR algo observable y actuar\n' +
          '     (bloquear, inyectar contexto, escribir un archivo) — no solo narrar una recomendación.\n' +
          '     Si es puro consejo, esa lección va en .claude/rules/ o context/learnings.md, no en scripts/.'
        );
      }
    }

    // ─── Reportar violaciones ──────────────────────────────────────────────
    if (violations.length > 0) {
      process.stderr.write(
        `\u{1F9ED} HARNESS GATE: revisando ${path.basename(filePath)} como cambio al harness:\n` +
        violations.map(v => `  ❌ ${v}`).join('\n') +
        `\nCorrige el contenido antes de escribirlo.`
      );
      process.exit(2);
    }

    process.exit(0);
  } catch (e) {
    // Si el hook falla por error interno, permitir la operación (fail-open)
    process.exit(0);
  }
});
