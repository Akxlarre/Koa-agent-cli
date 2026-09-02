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
const fs = require('fs');

const AUTO_INICIO = '<!-- AUTO-GENERATED:BEGIN -->';
const AUTO_FIN = '<!-- AUTO-GENERATED:END -->';

/** El cuerpo entre los marcadores, o `null` si el texto no los tiene. */
function regionAuto(texto) {
  const a = texto.indexOf(AUTO_INICIO);
  const b = texto.indexOf(AUTO_FIN, a);
  if (a === -1 || b === -1) return null;
  return texto.slice(a + AUTO_INICIO.length, b);
}

/** Quién regenera este archivo. Es lo que hay que decirle a quien fue frenado. */
function generadorDe(rutaNormalizada) {
  if (/(^|\/)indices\/[^/]+\.md$/.test(rutaNormalizada)) {
    return '`npm run indices:sync` (o delegá en el subagente `index-syncer`)';
  }
  if (/ASSIGNMENTS\.md$/.test(rutaNormalizada)) return '`npm run assignments:sync`';
  if (/LESSONS_LEARNED\.md$/.test(rutaNormalizada)) {
    return 'el hook `failure-tracker`, solo (no se edita a mano)';
  }
  return 'el generador que mantiene ese archivo';
}

/**
 * ¿La escritura cae DENTRO de la región auto-generada? (HUE-007)
 *
 * Se compara contra el archivo EN DISCO, que es lo único que dice dónde están
 * hoy los marcadores:
 *
 *   Edit  — `old_string` es el texto que se reemplaza. Si vive adentro de la
 *           región, el generador lo va a pisar.
 *   Write — reemplaza todo. Se comparan las dos regiones: si difieren, la
 *           escritura toca lo auto-generado. Si son idénticas, el cambio está
 *           afuera y pasa.
 *
 * Fail-open en todo lo demás: sin marcadores, sin archivo o sin permiso de
 * lectura, este guard no opina.
 */
function protegerRegionAuto(filePath, { oldString, contenidoCompleto }) {
  let enDisco;
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
    enDisco = fs.readFileSync(filePath, 'utf-8');
  } catch { return false; }

  const region = regionAuto(enDisco);
  if (region === null) return false;

  let motivo = null;
  if (oldString) {
    if (region.includes(oldString)) motivo = 'el texto que estás reemplazando vive adentro';
  } else if (contenidoCompleto) {
    const nueva = regionAuto(contenidoCompleto);
    if (nueva === null) motivo = 'el contenido nuevo ni siquiera conserva los marcadores';
    else if (nueva !== region) motivo = 'el contenido de la región cambia';
  }
  if (!motivo) return false;

  const normalizada = filePath.replace(/\\/g, '/');
  process.stderr.write(
    `\u{1F9ED} HARNESS GATE: ${path.basename(filePath)} tiene una región AUTO-GENERATED.\n` +
    `  ❌ [GATE-D1] Estás escribiendo DENTRO de esa región — ${motivo}.\n` +
    '     Lo de adentro lo reescribe entero su generador: tu cambio no falla ahora,\n' +
    '     desaparece en la próxima corrida y sin dejar rastro de qué había.\n' +
    `     Para cambiar lo de adentro: corré ${generadorDe(normalizada)}.\n` +
    '     Para agregar algo tuyo: escribilo FUERA de los marcadores — ese texto\n' +
    '     se conserva, y es el lugar que existe justamente para eso.\n'
  );
  return true;
}

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
    const oldString = input.tool_input?.old_string || '';
    const contenidoCompleto = input.tool_input?.content || '';
    const newContent = input.tool_input?.new_string || contenidoCompleto || '';
    const normalizedPath = filePath.replace(/\\/g, '/');

    if (!filePath || !newContent) {
      process.exit(0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // D. REGION GUARD — no escribir dentro de AUTO-GENERATED (HUE-007)
    // ═══════════════════════════════════════════════════════════════════════
    //
    // Es el patrón más reusado del blueprint: tres productores lo escriben
    // (`indices-sync`, `assignments-sync`, `lib/lessons`) y el trato es siempre
    // el mismo — adentro se reescribe entero, afuera no se toca nunca.
    //
    // El trato no lo sostenía nada. Escribir adentro no falla: falla DESPUÉS,
    // en la próxima corrida del generador, que borra el trabajo sin decir nada
    // y sin dejar rastro de qué había. `DUP-003` mostró que no es hipotético:
    // la propia skill `/sync-indices` editaba ahí adentro.
    //
    // La superficie no es una lista de rutas —eso se desactualiza, como en
    // `HUE-003`—: es «el archivo en disco tiene los marcadores».
    if (protegerRegionAuto(filePath, { oldString, contenidoCompleto })) {
      process.exit(2);
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

    // HUE-031: la tercera superficie, que no vigilaba nadie.
    //
    // El File Protector (pre-write-guard capa 1) bloquea lo EJECUTABLE que
    // decide —`hooks/`, `settings.json`, `architect.js`—. El Generalization
    // Gate valida la GUÍA —`rules/`, `learnings.md`, `CLAUDE.md`—. Entre las
    // dos quedaban afuera `.claude/agents/`, `.claude/skills/` y
    // `.claude/commands/`, y el criterio que las dejaba afuera era «son
    // markdown, o sea prosa».
    //
    // No lo son. Su frontmatter decide QUÉ PUEDE HACER el agente:
    //
    //   agents/code-judge.md      tools: Read, Grep, Glob   ← sin Write ni Bash
    //   skills/plan/SKILL.md      hooks: Stop → el validador del task-spec
    //
    // Y `.claude/CLAUDE.md` vende lo primero como una garantía dura: «con Bash
    // podría escribir usando `>`, y "el juez no arregla nada" pasaría a ser una
    // promesa en vez de un hecho». Esa garantía la sostenía una línea que el
    // propio agente podía editar. Lo mismo con `/plan`: borrás su `hooks:` y el
    // formato del task-spec deja de validarse.
    const isCapabilityDeclaration =
      /\.claude\/agents\/[^/]+\.md$/.test(normalizedPath) ||
      /\.claude\/skills\/.*SKILL\.md$/.test(normalizedPath) ||
      /\.claude\/commands\/[^/]+\.md$/.test(normalizedPath);

    if (!isGuidanceSurface && !isCapabilityScript && !isCapabilityDeclaration) {
      process.exit(0);
    }

    const violations = [];

    // ═══════════════════════════════════════════════════════════════════════
    // C. CAPABILITY GUARD — el frontmatter que reparte permisos (HUE-031)
    // ═══════════════════════════════════════════════════════════════════════
    if (isCapabilityDeclaration) {
      // Se mira solo la forma de clave de frontmatter, anclada a principio de
      // línea: una skill puede hablar DE las tools en su prosa sin disparar.
      const CLAVES = /^\s*(tools|allowed-tools|allowedTools|disallowed-tools|disallowedTools|hooks|model|permission-mode)\s*:/m;
      const m = CLAVES.exec(newContent);
      if (m) {
        violations.push(
          `[GATE-C1] Estás editando \`${m[1]}:\` en una declaración de capacidad.\n` +
          '     Esa línea no es documentación: decide qué puede hacer un agente o qué hook\n' +
          '     corre. `code-judge` no tiene Write ni Bash A PROPÓSITO, y `/plan` valida su\n' +
          '     propio formato porque declara un hook de Stop.\n' +
          '     Un agente que se amplía los permisos deja de estar acotado por nada.\n' +
          '     El texto del archivo es tuyo; estas claves las cambia el humano.'
        );
      }
    }

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
