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
    ['la config de supabase', 'supabase/config.toml'],
    ['prosa dentro de migrations/', 'supabase/migrations/README.md'],
    ['una edge function', 'supabase/functions/enviar-mail/index.ts'],
  ];

  for (const [nombre, ruta] of ignorados) {
    test(`ignora ${nombre}`, () => {
      correr(ruta);
      assert.equal(tracker(), null, `${ruta} no debería registrarse`);
    });
  }
});

describe('LAS MIGRACIONES SÍ SE RASTREAN (HUE-015)', () => {
  // Este caso vivía en el describe de arriba, como «ignora una migración».
  // Estaba fijado como comportamiento correcto y no lo era: `DATABASE.md` ES un
  // índice, y una migración es exactamente lo que lo desactualiza.
  //
  // Medido antes de moverlo: una sesión que escribe SOLO una migración no
  // produce `session-writes.json`, así que los tres consumidores quedan ciegos
  // a la vez — sync-check no avisa, spec-diff-check no bloquea, spec-reflection
  // cree que no pasó nada. Una sesión entera de esquema, invisible.

  test('una migración .sql se registra', () => {
    correr('supabase/migrations/20260101_pedidos.sql');
    assert.deepEqual(tracker(), ['supabase/migrations/20260101_pedidos.sql']);
  });

  test('y una sesión de puro esquema deja de ser invisible', () => {
    // El escenario completo del hallazgo: nada de src/app/ en toda la sesión.
    correr('supabase/migrations/001_pedidos.sql');
    correr('supabase/migrations/002_rls.sql');
    assert.equal(tracker().length, 2, 'el productor del contrato no vio nada');
  });

  test('pero una migración anidada en docs/ no — se compara por prefijo', () => {
    correr('docs/ejemplos/supabase/migrations/y.sql');
    assert.equal(tracker(), null);
  });
});

describe('PREFIJO, NO SUBSTRING — cerrado en la tanda 3', () => {
  // Estos tres fijaban el comportamiento anterior. Al migrar el hook a
  // lib/paths.js y lib/payload.js fallaron —la señal esperada— y se
  // actualizaron a propósito.

  test('docs/ejemplos/src/app/ ya NO se rastrea', () => {
    correr('docs/ejemplos/src/app/demo.component.ts');
    assert.equal(tracker(), null,
      'antes entraba: .includes("src/app/") daba verdadero');
  });

  test('node_modules tampoco', () => {
    correr('node_modules/algo/src/app/x.ts');
    assert.equal(tracker(), null);
  });

  test('un archivo fuera del proyecto no es de nadie', () => {
    correr('/otro/lado/src/app/x.ts');
    assert.equal(tracker(), null);
  });

  test('guarda la ruta RELATIVA, que es lo que declara el contrato', () => {
    // lib/contracts.js declara este artefacto como "array JSON de rutas
    // relativas con separadores /". Antes se guardaba tal como llegaba, o sea
    // absoluta si venía absoluta. sync-check acepta las dos.
    const abs = path.join(proyecto, 'src/app/x.ts');
    correr(abs);
    assert.deepEqual(tracker(), ['src/app/x.ts']);
  });

  test('una ruta relativa y su equivalente absoluta no se duplican', () => {
    correr('src/app/x.ts');
    correr(path.join(proyecto, 'src/app/x.ts'));
    assert.equal(tracker().length, 1, 'antes eran dos entradas distintas');
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
