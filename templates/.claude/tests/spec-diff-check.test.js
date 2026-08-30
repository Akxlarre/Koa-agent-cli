#!/usr/bin/env node
/**
 * spec-diff-check.test.js — Contract tests de spec-diff-check.js
 *
 * DEC-001 (S1). Este hook lee `process.env.TOOL_INPUT` para saber qué comando se
 * está por correr. Esa variable NO existe: no está entre las que Claude Code
 * expone a los hooks. Con el comando siempre vacío, la guarda
 * `if (!cmd.includes('git'))` corta en la primera línea y el hook no puede fallar
 * nunca — el propio caso que debe bloquear sale en 0.
 *
 * Este archivo lo demuestra en los dos sentidos: con la variable puesta a mano el
 * hook funciona (su lógica está bien), y sin ella —como corre en producción— no
 * hace nada.
 *
 * TESTS DE CARACTERIZACIÓN. La tanda 3 migra este hook a lib/payload.js y el
 * describe «DEC-001» pasa a fallar: hay que actualizarlo con intención.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'spec-diff-check.js');
let proyecto;

/** Corre el hook. `viaEnv` simula lo que el hook espera y el runtime no da. */
function correr(comando, { viaEnv = false } = {}) {
  const payload = { tool_name: 'Bash', tool_input: { command: comando } };
  const env = { ...process.env };
  delete env.TOOL_INPUT;
  if (viaEnv) env.TOOL_INPUT = JSON.stringify(payload.tool_input);

  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify(payload), encoding: 'utf8', cwd: proyecto, env,
  });
  return { exit: r.status, stderr: r.stderr || '' };
}

function escribir(rel, contenido) {
  const full = path.join(proyecto, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contenido);
}

function conWrites(rutas) {
  escribir('.claude/temp/session-writes.json', JSON.stringify(rutas));
}

/** Un componente escrito en la sesión y ausente del índice: el caso a bloquear. */
function escenarioComponenteSinRegistrar() {
  conWrites(['src/app/shared/components/kpi-card/kpi-card.component.ts']);
  escribir('indices/COMPONENTS.md', '# COMPONENTS\n\n(ningun componente registrado)\n');
}

beforeEach(() => { proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-sdc-')); });
afterEach(() => { fs.rmSync(proyecto, { recursive: true, force: true }); });

describe('DEC-001 — el hook no puede fallar como corre en produccion', () => {
  test('(bug) el caso exacto que debe bloquear sale en 0', () => {
    escenarioComponenteSinRegistrar();
    const r = correr('git commit -m "wip"');
    assert.equal(r.exit, 0, 'deberia ser 2: el componente no esta en COMPONENTS.md');
    assert.equal(r.stderr, '');
  });

  test('la logica SI funciona cuando el comando le llega', () => {
    escenarioComponenteSinRegistrar();
    const r = correr('git commit -m "wip"', { viaEnv: true });
    assert.equal(r.exit, 2, 'el hook no esta roto: esta desconectado de su entrada');
    assert.match(r.stderr, /SPEC-DIFF-CHECK/);
    assert.match(r.stderr, /kpi-card/);
  });

  test('el payload por stdin —el contrato real— no lo lee', () => {
    escenarioComponenteSinRegistrar();
    // El comando va por stdin, que es como Claude Code lo entrega.
    assert.equal(correr('git commit -m "wip"').exit, 0);
  });
});

describe('LA LOGICA, ejercitada por la via que el hook espera hoy', () => {
  const via = { viaEnv: true };

  test('deja pasar si el componente SI esta en el indice', () => {
    conWrites(['src/app/shared/components/kpi-card/kpi-card.component.ts']);
    escribir('indices/COMPONENTS.md', '# COMPONENTS\n\n| `<app-kpi-card>` | ... |\n');
    assert.equal(correr('git commit -m "ok"', via).exit, 0);
  });

  test('detecta una facade nueva ausente de FACADES.md', () => {
    conWrites(['src/app/core/services/auth.facade.ts']);
    escribir('indices/FACADES.md', '# FACADES\n\n(vacio)\n');
    const r = correr('git commit -m "wip"', via);
    assert.equal(r.exit, 2);
    assert.match(r.stderr, /AuthFacade/);
  });

  test('acepta la facade si esta registrada en SERVICES.md en vez de FACADES.md', () => {
    conWrites(['src/app/core/services/auth.facade.ts']);
    escribir('indices/FACADES.md', '# FACADES\n');
    escribir('indices/SERVICES.md', '# SERVICES\n\n| AuthFacade | ... |\n');
    assert.equal(correr('git commit -m "ok"', via).exit, 0);
  });

  test('convierte kebab-case a PascalCase para el nombre de la facade', () => {
    conWrites(['src/app/core/services/user-profile.facade.ts']);
    escribir('indices/FACADES.md', '# FACADES\n');
    assert.match(correr('git commit -m "wip"', via).stderr, /UserProfileFacade/);
  });

  test('solo mira comandos de git commit', () => {
    escenarioComponenteSinRegistrar();
    for (const cmd of ['npm test', 'git status', 'git push', 'ls']) {
      assert.equal(correr(cmd, via).exit, 0, `${cmd} no deberia disparar el chequeo`);
    }
  });
});

describe('FAIL-OPEN', () => {
  const via = { viaEnv: true };

  test('sin session-writes.json sale en 0', () => {
    assert.equal(correr('git commit -m "x"', via).exit, 0);
  });

  test('con el tracker vacio sale en 0', () => {
    conWrites([]);
    assert.equal(correr('git commit -m "x"', via).exit, 0);
  });

  test('con el tracker corrupto sale en 0', () => {
    escribir('.claude/temp/session-writes.json', '{ roto');
    assert.equal(correr('git commit -m "x"', via).exit, 0);
  });

  test('sin carpeta indices/ el indice se lee como vacio y bloquea', () => {
    conWrites(['src/app/shared/components/kpi-card/kpi-card.component.ts']);
    assert.equal(correr('git commit -m "x"', via).exit, 2);
  });

  test('un archivo rastreado que no es componente ni facade se ignora', () => {
    conWrites(['src/app/features/x/x.component.ts']);
    escribir('indices/COMPONENTS.md', '# COMPONENTS\n');
    assert.equal(correr('git commit -m "x"', via).exit, 0,
      'solo mira shared/components/ y core/services/*.facade.ts');
  });
});
