#!/usr/bin/env node
/**
 * compact-recovery.test.js — Contract tests del hook PostCompact
 *
 * Este hook estuvo roto por un error de sintaxis sin que nadie lo notara:
 * fallaba en silencio en cada compactacion. El primer test de aqui es el
 * mas importante — verifica que el archivo simplemente CORRE.
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'compact-recovery.js');

const created = [];

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-compact-'));
  created.push(root);
  fs.mkdirSync(path.join(root, 'indices'), { recursive: true });
  fs.mkdirSync(path.join(root, '.claude', 'temp'), { recursive: true });
  return root;
}

function runHook(root, sessionId = 'compact-test') {
  const r = spawnSync('node', [HOOK], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_SESSION_ID: sessionId },
  });
  return { exitCode: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

afterEach(() => {
  while (created.length) {
    try { fs.rmSync(created.pop(), { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

describe('COMPACT RECOVERY', () => {
  test('el hook se ejecuta sin errores (regresion: sintaxis rota)', () => {
    const r = runHook(makeProject());
    assert.equal(r.exitCode, 0);
    assert.equal(r.stderr, '', 'no debe emitir errores a stderr');
    assert.ok(r.stdout.includes('CONTEXTO RE-INYECTADO'));
  });

  test('inyecta los indices core siempre', () => {
    const root = makeProject();
    fs.writeFileSync(path.join(root, 'indices', 'COMPONENTS.md'), '# COMPONENTS\n- app-kpi-card');
    const r = runHook(root);
    assert.ok(r.stdout.includes('app-kpi-card'));
  });

  test('corta el indice en DETAIL:BEGIN (solo Quick Reference)', () => {
    const root = makeProject();
    fs.writeFileSync(
      path.join(root, 'indices', 'COMPONENTS.md'),
      '# COMPONENTS\nQUICK-REF-VISIBLE\n<!-- DETAIL:BEGIN -->\nEJEMPLO-LARGO-OCULTO\n'
    );
    const r = runHook(root);
    assert.ok(r.stdout.includes('QUICK-REF-VISIBLE'));
    assert.ok(!r.stdout.includes('EJEMPLO-LARGO-OCULTO'));
  });

  test('re-inyecta solo las casillas pendientes del task-spec', () => {
    const root = makeProject();
    fs.writeFileSync(
      path.join(root, '.claude', 'temp', 'task-spec-20260101-120000.md'),
      '# Spec\n- [x] paso-ya-hecho\n- [ ] paso-pendiente\n'
    );
    const r = runHook(root);
    assert.ok(r.stdout.includes('paso-pendiente'));
    assert.ok(!r.stdout.includes('paso-ya-hecho'), 'lo completado no debe volver al contexto');
  });

  test('omite la seccion de task-spec si no queda nada pendiente', () => {
    const root = makeProject();
    fs.writeFileSync(
      path.join(root, '.claude', 'temp', 'task-spec-20260101-120000.md'),
      '# Spec\n- [x] todo hecho\n'
    );
    const r = runHook(root);
    assert.ok(!r.stdout.includes('Task-spec activo'));
  });

  test('salta archivos de context/ que son solo plantilla vacia', () => {
    const root = makeProject();
    fs.mkdirSync(path.join(root, 'context'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'context', 'domain.md'),
      '# Domain\n<!-- ' + 'x'.repeat(400) + ' -->\n'
    );
    const r = runHook(root);
    assert.ok(!r.stdout.includes('context/domain.md'), 'una plantilla sin contenido real no se inyecta');
  });

  test('inyecta context/ cuando tiene contenido real', () => {
    const root = makeProject();
    fs.mkdirSync(path.join(root, 'context'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'context', 'domain.md'),
      '# Domain\nUn Pedido pertenece a un Cliente y tiene muchas Lineas de Pedido. '
      + 'El estado del Pedido lo gobierna la maquina de estados de facturacion.\n'
    );
    const r = runHook(root);
    assert.ok(r.stdout.includes('context/domain.md'));
    assert.ok(r.stdout.includes('maquina de estados'));
  });
});
