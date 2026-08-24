#!/usr/bin/env node
/**
 * harness-gate.test.js — Contract tests del Generalization Gate / Placement Guard
 *
 * Verifica que harness-gate.js bloquee ediciones al harness que violan
 * el Generalization Gate o la separación capacidad/guía (HarnessCompass).
 * Usa node:test nativo (Node 18+) y child_process para simular el hook.
 */

const { test, describe } = require('node:test');
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
