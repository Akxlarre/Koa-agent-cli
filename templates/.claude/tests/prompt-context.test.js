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
const states = [];
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
  const id = `pc-test-${Date.now()}-${counter++}`;
  states.push(path.join(os.tmpdir(), `koa-prompt-ctx-${id}.json`));
  return id;
}

function runHook(root, sessionId, prompt = 'haz algo') {
  const r = spawnSync('node', [HOOK], {
    cwd: root,
    input: JSON.stringify({ prompt }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_SESSION_ID: sessionId },
  });
  let ctx = '';
  try { ctx = JSON.parse(r.stdout || '{}').hookSpecificOutput?.additionalContext || ''; } catch { /* ignore */ }
  return { exitCode: r.status, stdout: r.stdout || '', context: ctx };
}

afterEach(() => {
  while (created.length) {
    try { fs.rmSync(created.pop(), { recursive: true, force: true }); } catch { /* ignore */ }
  }
  while (states.length) {
    try { fs.unlinkSync(states.pop()); } catch { /* ignore */ }
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
