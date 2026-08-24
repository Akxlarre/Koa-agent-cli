#!/usr/bin/env node
/**
 * session-start.test.js — Contract tests del hook SessionStart
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'session-start.js');

const created = [];
const flags = [];
let counter = 0;

function makeProject({ indices = {}, brief, spec } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-ss-'));
  created.push(root);
  fs.mkdirSync(path.join(root, 'indices'), { recursive: true });
  fs.mkdirSync(path.join(root, '.claude', 'temp'), { recursive: true });

  for (const [name, body] of Object.entries(indices)) {
    fs.writeFileSync(path.join(root, 'indices', `${name}.md`), body);
  }
  if (brief !== undefined) {
    fs.mkdirSync(path.join(root, 'context'), { recursive: true });
    fs.writeFileSync(path.join(root, 'context', 'brief.md'), brief);
  }
  if (spec) {
    fs.writeFileSync(path.join(root, '.claude', 'temp', spec.name), spec.body);
  }
  return root;
}

function runHook(root) {
  const sessionId = `ss-test-${Date.now()}-${counter++}`;
  const flagPath = path.join(os.tmpdir(), `koa-discovery-${sessionId}.flag`);
  flags.push(flagPath);
  const r = spawnSync('node', [HOOK], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_SESSION_ID: sessionId },
  });
  return {
    exitCode: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    flagPath,
    flagExists: fs.existsSync(flagPath),
    flagContent: fs.existsSync(flagPath) ? fs.readFileSync(flagPath, 'utf-8') : '',
  };
}

afterEach(() => {
  while (created.length) {
    try { fs.rmSync(created.pop(), { recursive: true, force: true }); } catch { /* ignore */ }
  }
  while (flags.length) {
    try { fs.unlinkSync(flags.pop()); } catch { /* ignore */ }
  }
});

describe('SESSION START — inyeccion de indices', () => {
  test('inyecta los indices core', () => {
    const r = runHook(makeProject({
      indices: { COMPONENTS: '# COMPONENTS\n- app-kpi-card', FACADES: '# FACADES\n- ProductosFacade' },
    }));
    assert.equal(r.exitCode, 0);
    assert.ok(r.stdout.includes('app-kpi-card'));
    assert.ok(r.stdout.includes('ProductosFacade'));
  });

  test('corta en DETAIL:BEGIN — solo Quick Reference', () => {
    const r = runHook(makeProject({
      indices: { COMPONENTS: '# C\nQUICK-VISIBLE\n<!-- DETAIL:BEGIN -->\nLARGO-OCULTO' },
    }));
    assert.ok(r.stdout.includes('QUICK-VISIBLE'));
    assert.ok(!r.stdout.includes('LARGO-OCULTO'));
  });

  test('trunca indices desmedidos (presupuesto de tokens)', () => {
    const r = runHook(makeProject({
      indices: { COMPONENTS: '# C\n' + 'x'.repeat(9000) },
    }));
    assert.ok(r.stdout.includes('truncado'));
    assert.ok(r.stdout.length < 9000, 'no debe volcar el indice entero');
  });

  test('no inyecta indices que no son core', () => {
    const r = runHook(makeProject({
      indices: { COMPONENTS: '# C\ncore-ok', STYLES: '# S\nNO-CORE-TOKEN' },
    }));
    assert.ok(r.stdout.includes('core-ok'));
    assert.ok(!r.stdout.includes('NO-CORE-TOKEN'));
  });
});

describe('SESSION START — Discovery Gate', () => {
  test('escribe el discovery flag cuando inyecto indices', () => {
    const r = runHook(makeProject({ indices: { COMPONENTS: '# C\nx' } }));
    assert.ok(r.flagExists, 'el flag debe existir');
    assert.ok(r.flagContent.includes('SESSION-START'));
    assert.ok(r.flagContent.includes('indices/COMPONENTS.md'));
  });

  test('NO escribe el flag si no hay indices que inyectar', () => {
    const r = runHook(makeProject());
    assert.ok(!r.flagExists, 'sin indices el Gate debe seguir activo');
    assert.ok(r.stdout === '' || r.stdout.includes('Discovery Gate sigue activo'));
  });

  test('el flag que escribe es legible por compact-recovery', () => {
    // compact-recovery parsea /indices\/([\w-]+)\.md/i sobre el flag
    const r = runHook(makeProject({ indices: { FACADES: '# F\nx' } }));
    const m = r.flagContent.match(/indices\/([\w-]+)\.md/i);
    assert.ok(m, 'el formato del flag debe seguir el contrato');
    assert.equal(m[1].toUpperCase(), 'FACADES');
  });
});

describe('SESSION START — brief', () => {
  test('avisa si el brief tiene mas de 7 dias', () => {
    const old = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const r = runHook(makeProject({
      indices: { COMPONENTS: '# C\nx' },
      brief: `# Brief\n**last_updated:** ${old}\n## Objetivo\n` + 'contenido real del objetivo '.repeat(5),
    }));
    assert.ok(r.stdout.includes('BRIEF DESACTUALIZADO'));
    assert.ok(r.stdout.includes('30 días') || r.stdout.includes('30 dias'));
  });

  test('no avisa si el brief esta fresco', () => {
    const today = new Date().toISOString().slice(0, 10);
    const r = runHook(makeProject({
      indices: { COMPONENTS: '# C\nx' },
      brief: `# Brief\n**last_updated:** ${today}\n## Objetivo\n` + 'contenido real del objetivo '.repeat(5),
    }));
    assert.ok(!r.stdout.includes('BRIEF DESACTUALIZADO'));
  });

  test('salta el brief si es solo plantilla vacia', () => {
    const r = runHook(makeProject({
      indices: { COMPONENTS: '# C\nx' },
      brief: '# Brief\n<!-- ' + 'y'.repeat(400) + ' -->\n',
    }));
    assert.ok(!r.stdout.includes('objetivo de esta sesión'));
  });
});

describe('SESSION START — task-spec pendiente', () => {
  test('reporta trabajo pendiente de una sesion anterior', () => {
    const r = runHook(makeProject({
      indices: { COMPONENTS: '# C\nx' },
      spec: { name: 'task-spec-20260101-120000.md', body: '# S\n- [x] hecho\n- [ ] quedo-pendiente\n' },
    }));
    assert.ok(r.stdout.includes('quedo-pendiente'));
    assert.ok(!r.stdout.includes('hecho'));
  });

  test('no menciona el spec si esta completo', () => {
    const r = runHook(makeProject({
      indices: { COMPONENTS: '# C\nx' },
      spec: { name: 'task-spec-20260101-120000.md', body: '# S\n- [x] todo hecho\n' },
    }));
    assert.ok(!r.stdout.includes('Trabajo pendiente'));
  });
});

describe('SESSION START — fail-open', () => {
  test('proyecto vacio no revienta', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-ss-empty-'));
    created.push(root);
    const r = runHook(root);
    assert.equal(r.exitCode, 0);
    assert.equal(r.stderr, '');
  });
});
