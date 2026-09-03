#!/usr/bin/env node
/**
 * harness-gate.test.js — Contract tests del Generalization Gate / Placement Guard
 *
 * Verifica que harness-gate.js bloquee ediciones al harness que violan
 * el Generalization Gate o la separación capacidad/guía (HarnessCompass).
 * Usa node:test nativo (Node 18+) y child_process para simular el hook.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'harness-gate.js');

function runHook(input) {
  const result = spawnSync('node', [HOOK], {
    input: JSON.stringify(input),
    encoding: 'utf8',
  });
  return {
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function makeInput(filePath, content, toolName = 'Write') {
  return {
    tool_name: toolName,
    tool_input: { file_path: filePath, content, new_string: content },
  };
}

// ─── Fuera de scope ─────────────────────────────────────────────────────────
describe('HARNESS GATE — fuera de scope', () => {
  test('ignora archivos que no son superficies de guía ni scripts de capacidad', () => {
    const r = runHook(makeInput(
      '/project/src/app/features/dashboard/dashboard.component.ts',
      'if ("fix-042" in text) { doStuff(); }'
    ));
    assert.equal(r.exitCode, 0);
  });
});

// ─── GATE-A1: track ID sin generalización ──────────────────────────────────
describe('GATE-A1 — track ID sin criterio de aplicabilidad', () => {
  const rulePath = '/project/.claude/rules/visual-system.md';

  test('bloquea una entrada que solo cita un fix-ID sin criterio', () => {
    const r = runHook(makeInput(rulePath,
      'fix-042-b: el componente de pagos necesitaba manejar el caso de reintento.'
    ));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('GATE-A1'));
  });

  test('permite citar un fix-ID cuando va acompañado de un criterio de aplicabilidad', () => {
    const r = runHook(makeInput(rulePath,
      'Regla: cuando varias capas podrían parchearse, sigue el valor hasta el emisor real ' +
      '(precedente: fix-042-b).'
    ));
    assert.ok(r.exitCode !== 2 || !r.stderr.includes('GATE-A1'));
  });

  test('permite contenido sin ningún track ID', () => {
    const r = runHook(makeInput(rulePath, 'Usa siempre tokens semánticos en vez de colores hardcodeados.'));
    assert.equal(r.exitCode, 0);
  });
});

// ─── DEC-002: el criterio tiene que estar DONDE está el track ──────────────
describe('GATE-A1 — el gate se apagaba solo a medida que crecía el archivo (DEC-002)', () => {
  const learningsPath = '/project/context/learnings.md';

  // El chequeo corría sobre el TEXTO ENTERO. «cuando» y «nunca» son dos de las
  // palabras más frecuentes de la prosa técnica en español, así que bastaba que
  // aparecieran en cualquier lugar del archivo. Medido: 13 de las 16 reglas del
  // template ya traían un marcador sin habérselo propuesto.
  //
  // Lo grave no era el falso negativo suelto: era que `learnings.md` CRECE. Una
  // sola lección bien escrita arriba dejaba pasar todas las recetas agregadas
  // después, para siempre. El guardrail se desactivaba solo, en el único archivo
  // cuyo crecimiento vigila.

  const RECETA = 'En fix-042 el boton no andaba. Le puse un margin-top de 4px.';
  const BUENA = 'Cuando una query se repite en dos facades, extraela a un repository.';

  test('la receta sola sigue bloqueada', () => {
    assert.equal(runHook(makeInput(learningsPath, RECETA)).exitCode, 2);
  });

  test('una lección buena ARRIBA ya no absuelve a la receta de abajo', () => {
    const r = runHook(makeInput(learningsPath, `## Cache\n\n${BUENA}\n\n${RECETA}`));
    assert.equal(r.exitCode, 2, 'esto pasaba en verde: el marcador estaba en otro párrafo');
    assert.match(r.stderr, /GATE-A1/);
  });

  test('el mensaje señala QUÉ párrafo, no solo que hay uno', () => {
    const r = runHook(makeInput(learningsPath, `## Cache\n\n${BUENA}\n\n${RECETA}`));
    assert.match(r.stderr, /En fix-042 el boton no andaba/,
      'sin el párrafo citado, en un learnings.md largo el aviso es inaccionable');
  });

  test('en una lista, cada viñeta se juzga sola', () => {
    const r = runHook(makeInput(learningsPath,
      '- Cuando una migracion agrega una tabla, siempre lleva RLS.\n'
      + '- En spec-0012 faltaba el indice, lo agregue a mano.'));
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /spec-0012/);
  });

  test('una lección con su criterio en el MISMO párrafo pasa, aunque ocupe varias líneas', () => {
    const r = runHook(makeInput(learningsPath,
      '## Espaciado\n\n'
      + 'Cuando un boton queda pegado al borde en mobile, el problema es el contenedor,\n'
      + 'no el boton (visto en fix-042).'));
    assert.equal(r.exitCode, 0);
  });

  test('las 16 reglas reales del template siguen pasando', () => {
    // Un gate más estricto que rompe el contenido que el propio blueprint
    // reparte no es más estricto: está roto.
    const fs = require('fs');
    const dir = path.resolve(__dirname, '..', 'rules');
    const rotas = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).filter((f) => {
      const contenido = fs.readFileSync(path.join(dir, f), 'utf-8');
      return runHook(makeInput(`/project/.claude/rules/${f}`, contenido)).exitCode !== 0;
    });
    assert.deepEqual(rotas, []);
  });
});

// ─── GATE-C1: el frontmatter que reparte permisos (HUE-031) ────────────────
describe('GATE-C1 — la superficie que no vigilaba nadie', () => {
  // El File Protector bloquea lo ejecutable que decide (hooks/, settings.json,
  // architect.js). El Generalization Gate valida la guía (rules/, learnings.md,
  // CLAUDE.md). `.claude/agents/`, `.claude/skills/` y `.claude/commands/`
  // quedaban afuera, y el criterio que las dejaba afuera era «son markdown».
  //
  // No lo son. `code-judge.md` declara `tools: Read, Grep, Glob` —sin Write ni
  // Bash— y `.claude/CLAUDE.md` vende eso como una garantía dura. La sostenía
  // una línea que el propio agente podía editar.

  test('agregarle Bash al juez queda bloqueado', () => {
    const r = runHook(makeInput('/p/.claude/agents/code-judge.md',
      'tools: Read, Grep, Glob, Bash'));
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /GATE-C1/);
  });

  test('vaciar el hook de /plan también', () => {
    // Sin ese hook de Stop, las cinco secciones del task-spec dejan de
    // validarse y el contrato del artefacto con más consumidores se afloja.
    const r = runHook(makeInput('/p/.claude/skills/plan/SKILL.md', 'hooks:\n  Stop: []'));
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /GATE-C1/);
  });

  test('y un comando del SDD, igual', () => {
    assert.equal(
      runHook(makeInput('/p/.claude/commands/hotfix.md', 'allowed-tools: Bash')).exitCode, 2);
  });

  test('la PROSA de esos archivos sigue siendo editable', () => {
    // El objetivo no es congelar los archivos: es que el agente pueda mejorar
    // las instrucciones sin poder ampliarse los permisos.
    const r = runHook(makeInput('/p/.claude/agents/code-judge.md',
      'Eres el juez de codigo. Calificas contra una rubrica fija y no arreglas nada.'));
    assert.equal(r.exitCode, 0);
  });

  test('mencionar «tools» en prosa no dispara', () => {
    // Un regex sin anclar convertiría cada explicación del diseño en un bloqueo,
    // y un guardrail que estorba se termina desactivando.
    const r = runHook(makeInput('/p/.claude/skills/review/SKILL.md',
      'El juez no recibe tools de escritura, y eso es a proposito.'));
    assert.equal(r.exitCode, 0);
  });

  test('fuera de esas tres carpetas no aplica', () => {
    assert.equal(runHook(makeInput('/p/docs/GUIA.md', 'tools: Read, Bash')).exitCode, 0);
  });

  test('los agentes REALES del payload no se rompen con su propio contenido', () => {
    // Verificación inversa: la superficie tiene que aceptar lo que el blueprint
    // ya reparte cuando se edita su prosa. Solo el frontmatter se bloquea.
    const fs2 = require('fs');
    const dir = path.resolve(__dirname, '..', 'agents');
    for (const f of fs2.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      const cuerpo = fs2.readFileSync(path.join(dir, f), 'utf-8').split(/^---$/m).pop();
      const r = runHook(makeInput(`/p/.claude/agents/${f}`, cuerpo));
      assert.equal(r.exitCode, 0, `${f}: su propio cuerpo dispara el gate\n${r.stderr}`);
    }
  });
});

// ─── GATE-A2: keyword-matching literal ─────────────────────────────────────
describe('GATE-A2 — despacho por keyword-matching literal', () => {
  const learningsPath = '/project/context/learnings.md';

  test('bloquea un snippet if ("token" in text)', () => {
    const r = runHook(makeInput(learningsPath, 'Truco: if ("django" in repoName) { aplicarFixEspecial(); }'));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('GATE-A2'));
  });

  test('permite prosa sin snippets de despacho', () => {
    const r = runHook(makeInput(learningsPath, 'La API de pagos devuelve montos en centavos, no en la unidad base.'));
    assert.equal(r.exitCode, 0);
  });
});

// ─── GATE-B1: código ejecutable en archivo de guía ─────────────────────────
describe('GATE-B1 — lógica ejecutable colada en superficie de guía', () => {
  test('bloquea require()/process.exit() dentro de CLAUDE.md', () => {
    const r = runHook(makeInput('/project/CLAUDE.md', "const fs = require('fs'); process.exit(2);"));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('GATE-B1'));
  });

  test('permite un bloque de código Angular de ejemplo (sin APIs de Node)', () => {
    const r = runHook(makeInput('/project/.claude/rules/architecture.md',
      '```typescript\n@Component({ changeDetection: ChangeDetectionStrategy.OnPush })\nexport class Foo {}\n```'
    ));
    assert.equal(r.exitCode, 0);
  });

  // ── HUE-013: el código CITADO no es lógica colada ────────────────────────
  //
  // El hallazgo llamaba a esto «riesgo latente». Medido contra el hook, no lo
  // era: escribir una regla que DOCUMENTE un hook era imposible. Tres formas de
  // nombrar el mismo `require('fs')`, tres bloqueos — hasta la mención inline.
  //
  // En un proyecto generado eso significa no poder explicar el harness dentro
  // del harness, que es exactamente lo que hace, del lado del CLI, la regla
  // `templates-contract.md`. Zafaba por accidente de sintaxis: escribe
  // `require()` sin comillas, y el patrón pedía `require('`.
  const REGLA = '/project/.claude/rules/hooks-contract.md';

  test('una regla puede documentar un hook si el código va en una cerca ```', () => {
    const r = runHook(makeInput(REGLA,
      '# Contrato de los hooks\n\nUn hook mínimo se ve así:\n\n'
      + "```js\nconst fs = require('fs');\nif (algoMal) process.exit(2);\n```\n\n"
      + 'Nunca los conviertas a ESM.\n'
    ));
    assert.equal(r.exitCode, 0, r.stderr);
  });

  test('y también si sólo lo menciona inline entre backticks', () => {
    // El caso que la propuesta original del hallazgo —excluir sólo las cercas—
    // habría dejado bloqueado.
    const r = runHook(makeInput(REGLA,
      "Los hooks usan `require('fs')` y salen con `process.exit(2)`. No los toques.\n"
    ));
    assert.equal(r.exitCode, 0, r.stderr);
  });

  test('el mismo código SUELTO en la prosa sigue bloqueado', () => {
    // La diferencia entre citar y colar son tres backticks, y es toda la
    // diferencia: acá nadie está documentando nada.
    const r = runHook(makeInput(REGLA,
      "# Contrato de los hooks\n\nconst fs = require('fs');\nif (algoMal) process.exit(2);\n"
    ));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('GATE-B1'));
  });

  test('un archivo de guía con SHEBANG sigue bloqueado, esté citado o no', () => {
    // Nadie necesita la primera línea de un hook para explicar cómo funciona.
    // Su presencia dice «esto es un programa», no «esto es una cita», y es lo
    // que queda cerrado del hueco que la exclusión de cercas abre.
    const r = runHook(makeInput(REGLA,
      '# Hook de ejemplo\n\n```js\n#!/usr/bin/env node\nconsole.log("hola");\n```\n'
    ));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('GATE-B1'));
  });

  test('el mensaje dice cómo documentar sin disparar', () => {
    const r = runHook(makeInput(REGLA, "const fs = require('fs');\n"));
    assert.match(r.stderr, /cerca ```js|entre backticks/,
      'bloquear sin decir la salida deja al agente adivinando');
  });
});

// ─── GATE-B2: consejo sin mecanismo en script de capacidad ─────────────────
describe('GATE-B2 — consejo sin mecanismo en script', () => {
  test('bloquea console.warn con verbo de consejo y sin process.exit(2)', () => {
    const r = runHook(makeInput('/project/scripts/indices-sync.js',
      'console.warn("Recuerda actualizar el índice de componentes manualmente");'
    ));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('GATE-B2'));
  });

  test('permite console.warn con verbo de consejo cuando SÍ hay process.exit(2)', () => {
    const r = runHook(makeInput('/project/scripts/indices-sync.js',
      'if (missing) { console.warn("Recuerda actualizar el índice"); process.exit(2); }'
    ));
    assert.ok(r.exitCode !== 2 || !r.stderr.includes('GATE-B2'));
  });

  test('ignora scripts/architect.js (ya protegido por FILE PROTECTOR)', () => {
    const r = runHook(makeInput('/project/scripts/architect.js',
      'console.warn("Recuerda revisar esto");'
    ));
    assert.equal(r.exitCode, 0);
  });
});

// ─── GATE-D1: la región AUTO-GENERATED (HUE-007) ───────────────────────────
describe('GATE-D1 — escribir dentro de la región auto-generada', () => {
  // Es el patrón más reusado del blueprint —`indices-sync`, `assignments-sync`
  // y `lib/lessons` lo escriben— y el trato es siempre el mismo: adentro se
  // reescribe entero, afuera no se toca. El trato no lo sostenía nada.
  //
  // Escribir adentro no falla: falla DESPUÉS, en la próxima corrida del
  // generador, que borra el trabajo sin decir nada. Y no es hipotético: hasta
  // `DUP-003` la propia skill `/sync-indices` editaba ahí adentro.
  const fs2 = require('fs');
  const os2 = require('os');

  let dir;
  let archivo;

  const CONTENIDO = [
    '# COMPONENTS',
    '',
    'Notas a mano que quiero conservar.',
    '',
    '<!-- AUTO-GENERATED:BEGIN -->',
    '| Componente | Tipo |',
    '|---|---|',
    '| `app-kpi-card` | Molecula |',
    '<!-- AUTO-GENERATED:END -->',
    '',
    'Mas notas mias, abajo.',
    '',
  ].join('\n');

  beforeEach(() => {
    dir = fs2.mkdtempSync(path.join(os2.tmpdir(), 'koa-d1-'));
    fs2.mkdirSync(path.join(dir, 'indices'));
    archivo = path.join(dir, 'indices', 'COMPONENTS.md');
    fs2.writeFileSync(archivo, CONTENIDO);
  });

  afterEach(() => { try { fs2.rmSync(dir, { recursive: true, force: true }); } catch { /* */ } });

  const editar = (old_string, new_string) => runHook({
    tool_name: 'Edit', tool_input: { file_path: archivo, old_string, new_string },
  });
  const escribir = (content) => runHook({
    tool_name: 'Write', tool_input: { file_path: archivo, content },
  });

  test('un Edit DENTRO de la región queda bloqueado', () => {
    const r = editar('| `app-kpi-card` | Molecula |', '| `app-kpi-card` | Atomo |');
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /GATE-D1/);
  });

  test('un Edit FUERA pasa — el objetivo no es congelar el archivo', () => {
    // Lo de afuera existe justamente para escribir a mano. Un guard que
    // bloqueara el archivo entero rompería el patrón en vez de protegerlo.
    assert.equal(editar('Notas a mano que quiero conservar.', 'Notas ampliadas.').exitCode, 0);
  });

  test('un Write que cambia la región queda bloqueado', () => {
    assert.equal(escribir(CONTENIDO.replace('Molecula', 'Atomo')).exitCode, 2);
  });

  test('un Write que solo cambia lo de afuera pasa', () => {
    assert.equal(escribir(CONTENIDO.replace('Mas notas mias, abajo.', 'Mas notas.')).exitCode, 0);
  });

  test('y uno que borra los marcadores, también bloqueado', () => {
    // El modo de fallo más caro: sin marcadores, `assignments-sync` se niega a
    // escribir (INC-022) y `indices-sync` deja de tener dónde escribir.
    const r = escribir('# COMPONENTS\n\nsin marcadores\n');
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /marcadores/);
  });

  test('el mensaje nombra al generador que corresponde', () => {
    // Frenar sin decir el camino de salida convierte un guardrail en un muro.
    assert.match(editar('| `app-kpi-card` | Molecula |', 'x').stderr, /indices:sync/);
  });

  test('un archivo sin marcadores no le importa a este guard', () => {
    const otro = path.join(dir, 'indices', 'SUELTO.md');
    fs2.writeFileSync(otro, '# Suelto\n\ncontenido a mano\n');
    const r = runHook({
      tool_name: 'Edit',
      tool_input: { file_path: otro, old_string: 'contenido a mano', new_string: 'otro' },
    });
    assert.equal(r.exitCode, 0);
  });

  test('y un archivo que no existe tampoco — fail-open', () => {
    const r = runHook({
      tool_name: 'Write',
      tool_input: { file_path: path.join(dir, 'indices', 'NUEVO.md'), content: 'nuevo' },
    });
    assert.equal(r.exitCode, 0);
  });
});
