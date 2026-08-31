#!/usr/bin/env node
/**
 * prompt-context.test.js — Contract tests del hook UserPromptSubmit
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'prompt-context.js');

const created = [];
let counter = 0;

function makeProject({ brief, spec } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-pc-'));
  created.push(root);
  fs.mkdirSync(path.join(root, '.claude', 'temp'), { recursive: true });
  if (brief !== undefined) {
    fs.mkdirSync(path.join(root, 'context'), { recursive: true });
    fs.writeFileSync(path.join(root, 'context', 'brief.md'), brief);
  }
  if (spec) fs.writeFileSync(path.join(root, '.claude', 'temp', spec.name), spec.body);
  return root;
}

function newSession() {
  return `pc-test-${Date.now()}-${counter++}`;
}

/**
 * El id de sesión va en el PAYLOAD, que es el único canal que existe.
 * Antes iba por `CLAUDE_SESSION_ID`, una variable inventada: el hook la leía
 * vacía, caía a `'default'` y todo el estado terminaba en un archivo único de
 * TMPDIR compartido por la máquina entera (HUE-002).
 */
function runHook(root, sessionId, prompt = 'haz algo') {
  const r = spawnSync('node', [HOOK], {
    cwd: root,
    input: JSON.stringify({ prompt, session_id: sessionId, cwd: root }),
    encoding: 'utf8',
  });
  let ctx = '';
  try { ctx = JSON.parse(r.stdout || '{}').hookSpecificOutput?.additionalContext || ''; } catch { /* ignore */ }
  return { exitCode: r.status, stdout: r.stdout || '', context: ctx };
}

afterEach(() => {
  while (created.length) {
    try { fs.rmSync(created.pop(), { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

const BRIEF_WITH_SCOPE = `# Brief
**last_updated:** 2026-08-18

## Objetivo
Tabla de clientes

## Out of scope (esta sesion)

- NO migrar la card de skeleton
- NO agregar validaciones todavia
`;

describe('PROMPT CONTEXT — out of scope', () => {
  test('inyecta el out-of-scope del brief en el primer prompt', () => {
    const r = runHook(makeProject({ brief: BRIEF_WITH_SCOPE }), newSession());
    assert.equal(r.exitCode, 0);
    assert.ok(r.context.includes('FUERA DE ALCANCE'));
    assert.ok(r.context.includes('NO migrar la card de skeleton'));
  });

  test('no inyecta el objetivo ni los indices (eso es SessionStart)', () => {
    const r = runHook(makeProject({ brief: BRIEF_WITH_SCOPE }), newSession());
    assert.ok(!r.context.includes('Tabla de clientes'), 'el objetivo lo inyecta SessionStart, no cada prompt');
  });

  test('brief sin seccion Out of scope no inyecta nada', () => {
    const r = runHook(makeProject({ brief: '# Brief\n## Objetivo\nalgo\n' }), newSession());
    assert.equal(r.context, '');
  });

  test('ignora una seccion Out of scope que es solo comentarios', () => {
    const brief = '# Brief\n## Out of scope (esta sesion)\n<!-- ejemplo de plantilla -->\n';
    const r = runHook(makeProject({ brief }), newSession());
    assert.equal(r.context, '');
  });
});

describe('PROMPT CONTEXT — dedup entre prompts', () => {
  test('no repite el mismo bloque en el prompt siguiente', () => {
    const root = makeProject({ brief: BRIEF_WITH_SCOPE });
    const sid = newSession();
    assert.ok(runHook(root, sid).context.includes('FUERA DE ALCANCE'));
    assert.equal(runHook(root, sid).context, '', 'el 2do prompt no debe repetirlo');
  });

  test('vuelve a inyectar si el contenido del brief cambia', () => {
    const root = makeProject({ brief: BRIEF_WITH_SCOPE });
    const sid = newSession();
    runHook(root, sid);
    fs.writeFileSync(
      path.join(root, 'context', 'brief.md'),
      BRIEF_WITH_SCOPE.replace('NO migrar la card de skeleton', 'NO tocar el modulo de pagos')
    );
    const r = runHook(root, sid);
    assert.ok(r.context.includes('NO tocar el modulo de pagos'));
  });

  test('reinyecta tras 8 prompts aunque no cambie', () => {
    const root = makeProject({ brief: BRIEF_WITH_SCOPE });
    const sid = newSession();
    const seen = [];
    for (let i = 0; i < 10; i++) seen.push(runHook(root, sid).context !== '');
    assert.equal(seen[0], true, 'prompt 1 inyecta');
    assert.ok(seen.slice(1, 8).every(v => v === false), 'prompts 2-8 callan');
    assert.equal(seen[8], true, 'prompt 9 reinyecta el recordatorio');
  });

  test('sesiones distintas tienen estado independiente', () => {
    const root = makeProject({ brief: BRIEF_WITH_SCOPE });
    const a = newSession();
    runHook(root, a);
    assert.equal(runHook(root, a).context, '');
    const b = newSession();
    assert.ok(runHook(root, b).context.includes('FUERA DE ALCANCE'), 'otra sesion arranca limpia');
  });
});

describe('HUE-002 — CERRADO: el ultimo CLAUDE_SESSION_ID del harness', () => {
  test('el hook ya no nombra la variable inexistente', () => {
    const src = fs.readFileSync(HOOK, 'utf-8');
    const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    assert.ok(!/CLAUDE_SESSION_ID/.test(codigo),
      'leerla no falla: devuelve vacio y el estado se vuelve global');
  });

  test('el estado vive dentro del proyecto, no en TMPDIR', () => {
    const root = makeProject({ brief: BRIEF_WITH_SCOPE });
    runHook(root, 's1');
    const dir = path.join(root, '.claude', 'temp', 'session', 's1', 'thread-main');
    assert.ok(fs.readdirSync(dir).some((f) => f.startsWith('budget-prompt-scope')),
      `nada en ${dir}`);
  });

  test('dos proyectos abiertos a la vez no se callan el recordatorio', () => {
    // Este era el dano medido: el estado era un unico archivo de TMPDIR bajo la
    // clave 'default', asi que el primer proyecto que inyectaba dejaba mudo al otro.
    const a = makeProject({ brief: BRIEF_WITH_SCOPE });
    const b = makeProject({ brief: BRIEF_WITH_SCOPE });
    assert.ok(runHook(a, 'misma-sesion').context.includes('FUERA DE ALCANCE'));
    assert.ok(runHook(b, 'misma-sesion').context.includes('FUERA DE ALCANCE'),
      'el otro proyecto tiene su propio brief y su propio estado');
  });

  test('sin session_id en el payload, el id sale del proyecto — nunca "default"', () => {
    const root = makeProject({ brief: BRIEF_WITH_SCOPE });
    const sinId = () => {
      const r = spawnSync('node', [HOOK], {
        cwd: root, input: JSON.stringify({ prompt: 'x', cwd: root }), encoding: 'utf8',
      });
      return r.stdout || '';
    };
    assert.ok(sinId().includes('FUERA DE ALCANCE'));
    assert.equal(sinId(), '', 'el fallback tambien tiene que ser estable');

    const dirs = fs.readdirSync(path.join(root, '.claude', 'temp', 'session'));
    assert.deepEqual(dirs.filter((d) => d === 'default'), [],
      'la clave global era justamente el bug');
    assert.ok(dirs.every((d) => d.startsWith('proj-')), dirs.join(','));
  });
});

describe('PROMPT CONTEXT — task-spec', () => {
  test('inyecta las casillas pendientes del spec activo', () => {
    const r = runHook(makeProject({
      spec: { name: 'task-spec-20260101-120000.md', body: '# S\n- [x] listo\n- [ ] falta-esto\n' },
    }), newSession());
    assert.ok(r.context.includes('falta-esto'));
    assert.ok(!r.context.includes('listo'));
  });

  test('no inyecta nada si el spec esta completo', () => {
    const r = runHook(makeProject({
      spec: { name: 'task-spec-20260101-120000.md', body: '# S\n- [x] listo\n' },
    }), newSession());
    assert.equal(r.context, '');
  });
});

describe('PROMPT CONTEXT — nunca bloquea', () => {
  test('proyecto vacio: exit 0 y sin salida', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-pc-empty-'));
    created.push(root);
    const r = runHook(root, newSession());
    assert.equal(r.exitCode, 0);
    assert.equal(r.stdout, '');
  });

  test('stdin invalido no rompe el prompt del humano', () => {
    const root = makeProject({ brief: BRIEF_WITH_SCOPE });
    const r = spawnSync('node', [HOOK], { cwd: root, input: 'no-es-json', encoding: 'utf8' });
    assert.equal(r.status, 0);
  });
});
