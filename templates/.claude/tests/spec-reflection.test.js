#!/usr/bin/env node
/**
 * spec-reflection.test.js — Contract tests del hook de Reflection
 *
 * El hook corre con cwd = raiz del proyecto, asi que cada test monta un
 * proyecto falso en un directorio temporal y lo corre ahi.
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'spec-reflection.js');

const created = [];

function makeProject({ spec, writes, indices } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-spec-'));
  created.push(root);
  fs.mkdirSync(path.join(root, '.claude', 'temp'), { recursive: true });

  if (spec) {
    fs.writeFileSync(path.join(root, '.claude', 'temp', spec.name), spec.body);
  }
  if (writes) {
    fs.writeFileSync(
      path.join(root, '.claude', 'temp', 'session-writes.json'),
      JSON.stringify(writes)
    );
  }
  if (indices) {
    fs.mkdirSync(path.join(root, 'indices'), { recursive: true });
    fs.writeFileSync(path.join(root, 'indices', 'COMPONENTS.md'), '# COMPONENTS');
  }
  return root;
}

function runHook(root) {
  const r = spawnSync('node', [HOOK], { cwd: root, encoding: 'utf8' });
  return { exitCode: r.status, stderr: r.stderr || '' };
}

afterEach(() => {
  while (created.length) {
    try { fs.rmSync(created.pop(), { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

describe('SPEC REFLECTION', () => {
  test('avisa cuando quedan casillas abiertas', () => {
    const root = makeProject({
      spec: {
        name: 'task-spec-20260101-120000.md',
        body: '## Done\n- [x] build ok\n- [ ] tests escritos\n',
      },
    });
    const r = runHook(root);
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('SPEC REFLECTION'));
    assert.ok(r.stderr.includes('tests escritos'));
  });

  test('calla cuando el spec esta completo', () => {
    const root = makeProject({
      spec: {
        name: 'task-spec-20260101-120000.md',
        body: '## Done\n- [x] build ok\n- [x] tests escritos\n',
      },
    });
    assert.equal(runHook(root).exitCode, 0);
  });

  test('calla ante un spec recien generado: cero marcadas y cero escrituras', () => {
    const root = makeProject({
      spec: {
        name: 'task-spec-20260101-120000.md',
        body: '## Done\n- [ ] a\n- [ ] b\n',
      },
    });
    assert.equal(runHook(root).exitCode, 0);
  });

  test('no repite el aviso para el mismo estado del spec (anti-bucle)', () => {
    const root = makeProject({
      spec: {
        name: 'task-spec-20260101-120000.md',
        body: '## Done\n- [x] build ok\n- [ ] tests escritos\n',
      },
    });
    assert.equal(runHook(root).exitCode, 2);
    assert.equal(runHook(root).exitCode, 0, 'el 2do aviso identico debe silenciarse');
  });

  test('vuelve a avisar si el estado del spec cambia', () => {
    const root = makeProject({
      spec: {
        name: 'task-spec-20260101-120000.md',
        body: '## Done\n- [x] a\n- [ ] b\n- [ ] c\n',
      },
    });
    assert.equal(runHook(root).exitCode, 2);
    fs.writeFileSync(
      path.join(root, '.claude', 'temp', 'task-spec-20260101-120000.md'),
      '## Done\n- [x] a\n- [x] b\n- [ ] c\n'
    );
    assert.equal(runHook(root).exitCode, 2, 'con menos pendientes debe volver a avisar');
  });

  test('toma el spec mas reciente cuando hay varios', () => {
    const root = makeProject({
      spec: {
        name: 'task-spec-20260101-120000.md',
        body: '## Done\n- [x] viejo\n- [ ] pendiente-viejo\n',
      },
    });
    fs.writeFileSync(
      path.join(root, '.claude', 'temp', 'task-spec-20260202-120000.md'),
      '## Done\n- [x] nuevo\n- [ ] pendiente-nuevo\n'
    );
    const r = runHook(root);
    assert.ok(r.stderr.includes('pendiente-nuevo'));
    assert.ok(!r.stderr.includes('pendiente-viejo'));
  });

  test('agrega evidencia cuando los fuentes son mas nuevos que los indices', () => {
    const root = makeProject({
      spec: {
        name: 'task-spec-20260101-120000.md',
        body: '## Done\n- [x] build\n- [ ] indices actualizados\n',
      },
      writes: ['src/app/features/x/x.component.ts'],
      indices: true,
    });
    const src = path.join(root, 'src', 'app', 'features', 'x');
    fs.mkdirSync(src, { recursive: true });
    const file = path.join(src, 'x.component.ts');
    fs.writeFileSync(file, 'export class X {}');
    const future = Date.now() / 1000 + 60;
    fs.utimesSync(file, future, future);

    const r = runHook(root);
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('mas recientes que el ultimo indice'));
  });

  test('fail-open: sin .claude/temp no revienta', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-spec-empty-'));
    created.push(root);
    assert.equal(runHook(root).exitCode, 0);
  });
});

describe('HUE-004 — CERRADO: "nada marcado" no es una sola situacion', () => {
  // El hook callaba ante `done === 0` razonando «el agente no adopto el flujo».
  // Eso tapaba el caso donde el aviso mas falta: trabajo escrito y criterio de
  // done intacto. Lo que separa las dos situaciones no son las casillas, son las
  // escrituras de la sesion.
  const SPEC = { name: 'task-spec-20260101-120000.md', body: '## Done\n- [ ] a\n- [ ] b\n' };

  test('con trabajo escrito y nada marcado, avisa', () => {
    const root = makeProject({ spec: SPEC, writes: ['src/app/x.component.ts'] });
    const r = runHook(root);
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /ninguna casilla marcada/);
    assert.match(r.stderr, /1 archivo\(s\) escrito\(s\)/);
  });

  test('y lista los puntos, que es lo que hay que mirar', () => {
    const root = makeProject({ spec: SPEC, writes: ['src/app/x.component.ts'] });
    const r = runHook(root);
    assert.ok(r.stderr.includes('☐ a') && r.stderr.includes('☐ b'), r.stderr);
  });

  test('el encabezado distingue las dos situaciones', () => {
    const sinMarcar = makeProject({ spec: SPEC, writes: ['src/app/x.ts'] });
    const conAlgunaMarcada = makeProject({
      spec: { name: SPEC.name, body: '## Done\n- [x] a\n- [ ] b\n' },
      writes: ['src/app/x.ts'],
    });
    assert.match(runHook(sinMarcar).stderr, /ninguna casilla marcada/);
    assert.match(runHook(conAlgunaMarcada).stderr, /1 punto\(s\) sin cerrar \(1 completado/);
  });

  test('sin escrituras sigue callando — un spec recien nacido no se regana', () => {
    assert.equal(runHook(makeProject({ spec: SPEC })).exitCode, 0);
    assert.equal(runHook(makeProject({ spec: SPEC, writes: [] })).exitCode, 0);
  });

  test('tampoco insiste: el anti-bucle vale igual para este aviso', () => {
    const root = makeProject({ spec: SPEC, writes: ['src/app/x.ts'] });
    assert.equal(runHook(root).exitCode, 2);
    assert.equal(runHook(root).exitCode, 0);
  });

  test('marcar una casilla cambia el aviso, no lo silencia', () => {
    const root = makeProject({ spec: SPEC, writes: ['src/app/x.ts'] });
    assert.equal(runHook(root).exitCode, 2);
    fs.writeFileSync(path.join(root, '.claude', 'temp', SPEC.name),
      '## Done\n- [x] a\n- [ ] b\n');
    const r = runHook(root);
    assert.equal(r.exitCode, 2, 'la firma incluye cuantas van marcadas');
    assert.ok(!r.stderr.includes('ninguna casilla marcada'));
  });
});
