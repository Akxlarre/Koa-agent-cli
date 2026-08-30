#!/usr/bin/env node
/**
 * spec-diff-check.test.js — Contract tests de spec-diff-check.js
 *
 * DEC-001 (S1) — CERRADO en la tanda 3.
 *
 * El hook leía `process.env.TOOL_INPUT` para saber qué comando se estaba por
 * correr. Esa variable no existe: no está entre las que Claude Code expone a los
 * hooks. Con el comando siempre vacío, la guarda `if (!cmd.includes('git'))`
 * cortaba en la primera línea y el chequeo no podía fallar nunca — el propio caso
 * que debe bloquear salía en 0.
 *
 * La lógica de detección estaba bien; estaba desconectada de su entrada. Migrado
 * a `lib/payload.js`, que lee stdin y no acepta ninguna fuente alternativa.
 *
 * El primer describe fijaba el bug como caracterización. Al migrar el hook falló
 * —la señal esperada— y se actualizó a propósito: ahora fija que el bug está
 * cerrado, y que una variable de entorno inventada no vuelve a ser una fuente.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'spec-diff-check.js');
let proyecto;

/** Corre el hook con el comando por stdin, que es el contrato documentado. */
function correr(comando) {
  const env = { ...process.env };
  delete env.TOOL_INPUT;   // se limpia a proposito: el hook ya no la mira
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: comando } }),
    encoding: 'utf8', cwd: proyecto, env,
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

describe('DEC-001 — CERRADO: la entrada llega por stdin', () => {
  // Estos tres fijaban el bug. Al migrar el hook a lib/payload.js (tanda 3)
  // fallaron, que era la señal esperada, y se actualizaron a proposito.
  // Antes: el hook leia process.env.TOOL_INPUT, que no existe, asi que el
  // comando llegaba vacio y este mismo escenario salia en 0.

  test('el caso exacto que debe bloquear, ahora bloquea', () => {
    escenarioComponenteSinRegistrar();
    const r = correr('git commit -m "wip"');
    assert.equal(r.exit, 2);
    assert.match(r.stderr, /SPEC-DIFF-CHECK/);
    assert.match(r.stderr, /kpi-card/);
  });

  test('TOOL_INPUT ya no participa: con stdin vacio no hay comando', () => {
    escenarioComponenteSinRegistrar();
    const r = spawnSync('node', [HOOK], {
      input: '',
      encoding: 'utf8',
      cwd: proyecto,
      env: { ...process.env, TOOL_INPUT: JSON.stringify({ command: 'git commit -m "x"' }) },
    });
    assert.equal(r.status, 0, 'una variable de entorno inventada no es una fuente');
  });

  test('y con TOOL_INPUT definida pero contradictoria, manda stdin', () => {
    escenarioComponenteSinRegistrar();
    const r = spawnSync('node', [HOOK], {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npm test' } }),
      encoding: 'utf8',
      cwd: proyecto,
      env: { ...process.env, TOOL_INPUT: JSON.stringify({ command: 'git commit -m "x"' }) },
    });
    assert.equal(r.status, 0, 'stdin dice "npm test": no es un commit, no se revisa');
  });
});

describe('LA LOGICA DE DETECCION', () => {

  test('deja pasar si el componente SI esta en el indice', () => {
    conWrites(['src/app/shared/components/kpi-card/kpi-card.component.ts']);
    escribir('indices/COMPONENTS.md', '# COMPONENTS\n\n| `<app-kpi-card>` | ... |\n');
    assert.equal(correr('git commit -m "ok"').exit, 0);
  });

  test('detecta una facade nueva ausente de FACADES.md', () => {
    conWrites(['src/app/core/services/auth.facade.ts']);
    escribir('indices/FACADES.md', '# FACADES\n\n(vacio)\n');
    const r = correr('git commit -m "wip"');
    assert.equal(r.exit, 2);
    assert.match(r.stderr, /AuthFacade/);
  });

  test('acepta la facade si esta registrada en SERVICES.md en vez de FACADES.md', () => {
    conWrites(['src/app/core/services/auth.facade.ts']);
    escribir('indices/FACADES.md', '# FACADES\n');
    escribir('indices/SERVICES.md', '# SERVICES\n\n| AuthFacade | ... |\n');
    assert.equal(correr('git commit -m "ok"').exit, 0);
  });

  test('convierte kebab-case a PascalCase para el nombre de la facade', () => {
    conWrites(['src/app/core/services/user-profile.facade.ts']);
    escribir('indices/FACADES.md', '# FACADES\n');
    assert.match(correr('git commit -m "wip"').stderr, /UserProfileFacade/);
  });

  test('solo mira comandos de git commit', () => {
    escenarioComponenteSinRegistrar();
    for (const cmd of ['npm test', 'git status', 'git push', 'ls']) {
      assert.equal(correr(cmd).exit, 0, `${cmd} no deberia disparar el chequeo`);
    }
  });
});

describe('FAIL-OPEN', () => {

  test('sin session-writes.json sale en 0', () => {
    assert.equal(correr('git commit -m "x"').exit, 0);
  });

  test('con el tracker vacio sale en 0', () => {
    conWrites([]);
    assert.equal(correr('git commit -m "x"').exit, 0);
  });

  test('con el tracker corrupto sale en 0', () => {
    escribir('.claude/temp/session-writes.json', '{ roto');
    assert.equal(correr('git commit -m "x"').exit, 0);
  });

  test('sin carpeta indices/ el indice se lee como vacio y bloquea', () => {
    conWrites(['src/app/shared/components/kpi-card/kpi-card.component.ts']);
    assert.equal(correr('git commit -m "x"').exit, 2);
  });

  test('un archivo rastreado que no es componente ni facade se ignora', () => {
    conWrites(['src/app/features/x/x.component.ts']);
    escribir('indices/COMPONENTS.md', '# COMPONENTS\n');
    assert.equal(correr('git commit -m "x"').exit, 0,
      'solo mira shared/components/ y core/services/*.facade.ts');
  });
});
