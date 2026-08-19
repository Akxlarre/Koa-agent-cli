#!/usr/bin/env node
/**
 * validate-file-contains.test.js — Contract tests del validador generico
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'validators', 'validate-file-contains.js');

const created = [];

function makeProject(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-vfc-'));
  created.push(root);
  fs.mkdirSync(path.join(root, 'specs'), { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, 'specs', name), body);
  }
  return root;
}

function run(root, args) {
  const r = spawnSync('node', [HOOK, ...args], { cwd: root, encoding: 'utf8' });
  return { exitCode: r.status, stderr: r.stderr || '' };
}

afterEach(() => {
  while (created.length) {
    try { fs.rmSync(created.pop(), { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

describe('VALIDATE FILE CONTAINS', () => {
  test('pasa cuando estan todas las secciones', () => {
    const root = makeProject({ 'a.md': '## Objetivo\nx\n## Done\ny\n' });
    const r = run(root, ['-d', 'specs', '-c', '## Objetivo', '-c', '## Done']);
    assert.equal(r.exitCode, 0);
  });

  test('bloquea y nombra las secciones que faltan', () => {
    const root = makeProject({ 'a.md': '## Objetivo\nx\n' });
    const r = run(root, ['-d', 'specs', '-c', '## Objetivo', '-c', '## Done', '-c', '## Reglas']);
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('## Done'));
    assert.ok(r.stderr.includes('## Reglas'));
    assert.ok(!r.stderr.includes('✗ ## Objetivo'), 'no debe listar la que si esta');
  });

  test('elige el archivo mas reciente cuando hay varios', () => {
    const root = makeProject({ 'viejo.md': '## Objetivo\n', 'nuevo.md': '## Objetivo\n## Done\n' });
    const past = Date.now() / 1000 - 3600;
    fs.utimesSync(path.join(root, 'specs', 'viejo.md'), past, past);
    const r = run(root, ['-d', 'specs', '-c', '## Done']);
    assert.equal(r.exitCode, 0, 'debe juzgar nuevo.md, no viejo.md');
  });

  test('respeta el glob de --pattern', () => {
    const root = makeProject({ 'otro.md': 'vacio', 'task-spec-1.md': '## Objetivo\n' });
    const r = run(root, ['-d', 'specs', '-p', 'task-spec-*.md', '-c', '## Objetivo']);
    assert.equal(r.exitCode, 0);
  });

  test('--max-age ignora archivos viejos', () => {
    const root = makeProject({ 'a.md': 'sin nada' });
    const past = Date.now() / 1000 - 7200;
    fs.utimesSync(path.join(root, 'specs', 'a.md'), past, past);
    const r = run(root, ['-d', 'specs', '-c', '## Objetivo', '--max-age', '10']);
    assert.equal(r.exitCode, 0, 'fuera de ventana = nada que validar');
  });

  test('sin archivos y sin --require-file: no hay nada que validar', () => {
    const r = run(makeProject(), ['-d', 'specs', '-c', '## Objetivo']);
    assert.equal(r.exitCode, 0);
  });

  test('sin archivos y con --require-file: bloquea', () => {
    const r = run(makeProject(), ['-d', 'specs', '-c', '## Objetivo', '--require-file']);
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('no se encontro'));
  });

  test('directorio inexistente sin --require-file: no bloquea', () => {
    const r = run(makeProject(), ['-d', 'no-existe', '-c', '## Objetivo']);
    assert.equal(r.exitCode, 0);
  });

  test('mal configurado (sin --contains) no bloquea nunca', () => {
    const r = run(makeProject({ 'a.md': 'x' }), ['-d', 'specs']);
    assert.equal(r.exitCode, 0, 'un validador roto no debe frenar al agente');
  });

  test('el glob no interpreta metacaracteres de regex como tales', () => {
    const root = makeProject({ 'a.b.md': '## Objetivo\n', 'axbxmd': 'nada' });
    const r = run(root, ['-d', 'specs', '-p', 'a.b.md', '-c', '## Objetivo']);
    assert.equal(r.exitCode, 0, 'el punto debe ser literal, no comodin');
  });
});

describe('VALIDATE FILE CONTAINS — contrato con /plan', () => {
  test('valida el task-spec real que genera la skill /plan', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-vfc-plan-'));
    created.push(root);
    fs.mkdirSync(path.join(root, '.claude', 'temp'), { recursive: true });
    fs.writeFileSync(path.join(root, '.claude', 'temp', 'task-spec-20260101-120000.md'),
      '# Task Spec\n## Objetivo\nx\n## Artefactos afectados\ny\n## Reglas que aplican\nz\n' +
      '## Pasos de ejecucion\n- [ ] a\n## Criterio de done\n- [ ] b\n');
    const args = ['-d', '.claude/temp', '-p', 'task-spec-*.md', '--require-file',
      '-c', '## Objetivo', '-c', '## Artefactos afectados', '-c', '## Reglas que aplican',
      '-c', '## Pasos de ejecucion', '-c', '## Criterio de done'];
    assert.equal(run(root, args).exitCode, 0);
  });
});
