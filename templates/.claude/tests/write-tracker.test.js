#!/usr/bin/env node
/**
 * write-tracker.test.js — Contract tests de write-tracker.js
 *
 * Es el PRODUCTOR de session-writes.json, el contrato con más consumidores del
 * harness (sync-check, spec-diff-check, spec-reflection) y el que la auditoría
 * encontró sin un solo test (HUE-006).
 *
 * TESTS DE CARACTERIZACIÓN: fijan el comportamiento ACTUAL, bugs incluidos. Los
 * marcados «(bug)» describen algo que la tanda 3 va a cambiar a propósito; cuando
 * eso pase, el test falla y hay que actualizarlo con intención.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'write-tracker.js');
let proyecto;

function correr(filePath, { toolName = 'Write' } = {}) {
  const input = JSON.stringify({
    tool_name: toolName,
    tool_input: { file_path: filePath, content: 'x' },
  });
  const r = spawnSync('node', [HOOK], { input, encoding: 'utf8', cwd: proyecto });
  return r.status;
}

function tracker() {
  const p = path.join(proyecto, '.claude', 'temp', 'session-writes.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

beforeEach(() => { proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-wt-')); });
afterEach(() => { fs.rmSync(proyecto, { recursive: true, force: true }); });

describe('QUÉ RASTREA', () => {
  test('un componente .ts bajo src/app/', () => {
    correr('src/app/features/x/x.component.ts');
    assert.deepEqual(tracker(), ['src/app/features/x/x.component.ts']);
  });

  test('también .html y .scss', () => {
    correr('src/app/features/x/x.component.html');
    correr('src/app/features/x/x.component.scss');
    assert.equal(tracker().length, 2);
  });

  test('crea .claude/temp/ si no existe', () => {
    assert.equal(fs.existsSync(path.join(proyecto, '.claude', 'temp')), false);
    correr('src/app/x.ts');
    assert.ok(fs.existsSync(path.join(proyecto, '.claude', 'temp')));
  });

  test('no duplica: el mismo archivo dos veces entra una', () => {
    correr('src/app/x.ts');
    correr('src/app/x.ts');
    assert.equal(tracker().length, 1);
  });

  test('acumula archivos distintos', () => {
    correr('src/app/a.ts');
    correr('src/app/b.ts');
    assert.deepEqual(tracker(), ['src/app/a.ts', 'src/app/b.ts']);
  });
});

describe('QUÉ NO RASTREA', () => {
  const ignorados = [
    ['un .spec.ts', 'src/app/x.component.spec.ts'],
    ['fuera de src/app/', 'src/main.ts'],
    ['una extensión que no describe ningún índice', 'src/app/x.css'],
    ['un índice', 'indices/COMPONENTS.md'],
    ['un hook', '.claude/hooks/foo.js'],
    ['una migración', 'supabase/migrations/1.sql'],
  ];

  for (const [nombre, ruta] of ignorados) {
    test(`ignora ${nombre}`, () => {
      correr(ruta);
      assert.equal(tracker(), null, `${ruta} no debería registrarse`);
    });
  }
});

describe('BUGS ACTUALES — caracterizados, no arreglados', () => {
  test('(bug) .includes("src/app/") rastrea rutas que no son de la app', () => {
    correr('docs/ejemplos/src/app/demo.component.ts');
    assert.deepEqual(
      tracker(), ['docs/ejemplos/src/app/demo.component.ts'],
      'la tanda 3 lo cambia por paths.belongsToIndex, que compara por prefijo',
    );
  });

  test('(bug) node_modules también entra', () => {
    correr('node_modules/algo/src/app/x.ts');
    assert.equal(tracker().length, 1);
  });

  test('guarda la ruta TAL COMO LLEGA — absoluta si vino absoluta', () => {
    // sync-check depende de esto: hace path.isAbsolute() antes de resolver.
    const abs = path.join(proyecto, 'src/app/x.ts');
    correr(abs);
    assert.deepEqual(tracker(), [abs.replace(/\\/g, '/')]);
  });
});

describe('FAIL-OPEN — nunca bloquea el flujo', () => {
  test('un tracker corrupto se reemplaza en vez de romper', () => {
    const dir = path.join(proyecto, '.claude', 'temp');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'session-writes.json'), '{ roto');
    assert.equal(correr('src/app/x.ts'), 0);
    assert.deepEqual(tracker(), ['src/app/x.ts']);
  });

  test('sin file_path sale en 0 y no escribe nada', () => {
    const r = spawnSync('node', [HOOK], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: {} }),
      encoding: 'utf8', cwd: proyecto,
    });
    assert.equal(r.status, 0);
    assert.equal(tracker(), null);
  });

  test('con stdin inválido sale en 0', () => {
    const r = spawnSync('node', [HOOK], { input: '{ no es json', encoding: 'utf8', cwd: proyecto });
    assert.equal(r.status, 0);
  });

  test('acepta tool_input.path además de file_path', () => {
    const r = spawnSync('node', [HOOK], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { path: 'src/app/x.ts' } }),
      encoding: 'utf8', cwd: proyecto,
    });
    assert.equal(r.status, 0);
    assert.deepEqual(tracker(), ['src/app/x.ts']);
  });

  test('normaliza separadores de Windows', () => {
    correr('src\\app\\x.component.ts');
    assert.deepEqual(tracker(), ['src/app/x.component.ts']);
  });
});
