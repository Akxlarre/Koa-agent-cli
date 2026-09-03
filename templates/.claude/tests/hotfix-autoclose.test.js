#!/usr/bin/env node
/**
 * hotfix-autoclose.test.js — Contract tests de sdd/hotfix-autoclose.js
 *
 * INC-007 — CERRADO. El docblock decia «al terminar cada sesion» y el hook
 * corria en `Stop`, que corre al terminar cada RESPUESTA (verificado contra la
 * doc del runtime: «once per turn: UserPromptSubmit, Stop, StopFailure»).
 *
 * El hotfix se cerraba en el primer turno, con el trabajo empezando — y desde
 * ahi specs/.active quedaba vacio y el spec-gate bloqueaba cada escritura
 * pidiendo la spec que este hook acababa de borrar. El describe INC-007 encadena
 * los dos hooks para demostrar que ya no pasa.
 *
 * El comportamiento del hook no cambio: cambio CUANDO corre (`SessionEnd`) y que
 * dejo de ser el camino principal — ahora lo es `/hotfix-close` (ADR-002 §3).
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'sdd', 'hotfix-autoclose.js');
const GATE = path.resolve(__dirname, '..', 'hooks', 'sdd', 'spec-gate.js');
let proyecto;

const correr = () =>
  spawnSync('node', [HOOK], { input: '{}', encoding: 'utf8', cwd: proyecto }).status;

function correrGate(rel) {
  return spawnSync('node', [GATE], {
    input: JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: path.join(proyecto, rel), content: 'x' },
    }),
    encoding: 'utf8', cwd: proyecto,
  }).status;
}

function escribir(rel, contenido) {
  const full = path.join(proyecto, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contenido);
}

const leer = (rel) => fs.readFileSync(path.join(proyecto, rel), 'utf-8');

function conHotfixActivo(id = 'hotfix-001-ts2345', dir = 'hotfixes') {
  escribir('specs/.active', id);
  escribir(`specs/${dir}/${id}/hotfix.md`,
    `# Hotfix\n> status: in_progress\n\n## Problema\nalgo\n`);
  return id;
}

beforeEach(() => { proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-ha-')); });
afterEach(() => { fs.rmSync(proyecto, { recursive: true, force: true }); });

describe('QUE HACE AL CERRAR', () => {
  test('marca status: done y agrega closed con la fecha de hoy', () => {
    const id = conHotfixActivo();
    assert.equal(correr(), 0);

    const md = leer(`specs/hotfixes/${id}/hotfix.md`);
    assert.match(md, /> status: done/);
    assert.match(md, new RegExp(`> closed: ${new Date().toISOString().slice(0, 10)}`));
  });

  test('vacia specs/.active', () => {
    conHotfixActivo();
    correr();
    assert.equal(leer('specs/.active'), '');
  });

  test('no duplica closed si ya estaba', () => {
    const id = conHotfixActivo();
    escribir(`specs/${'hotfixes'}/${id}/hotfix.md`,
      '# Hotfix\n> status: done\n> closed: 2020-01-01\n');
    correr();
    const md = leer(`specs/hotfixes/${id}/hotfix.md`);
    assert.equal((md.match(/> closed:/g) || []).length, 1);
    assert.match(md, /2020-01-01/);
  });

  test('acepta la ruta legacy specs/fixes/hotfixes/', () => {
    const id = conHotfixActivo('hotfix-002-x', 'fixes/hotfixes');
    correr();
    assert.match(leer(`specs/fixes/hotfixes/${id}/hotfix.md`), /status: done/);
  });
});

describe('QUE NO TOCA', () => {
  test('un spec track queda intacto', () => {
    escribir('specs/.active', '0001-reportes');
    escribir('specs/specs/0001-reportes/spec.md', '# Spec\n> status: in_progress\n');
    correr();
    assert.equal(leer('specs/.active'), '0001-reportes');
    assert.match(leer('specs/specs/0001-reportes/spec.md'), /in_progress/);
  });

  test('un fix track queda intacto', () => {
    escribir('specs/.active', 'fix-001-kpi');
    escribir('specs/fixes/fix-001-kpi/fix.md', '# Fix\n> status: in_progress\n');
    correr();
    assert.equal(leer('specs/.active'), 'fix-001-kpi');
  });

  test('sin specs/.active no hace nada', () => {
    assert.equal(correr(), 0);
  });
});

describe('INC-007 — CERRADO: el evento es SessionEnd, no Stop', () => {
  const SETTINGS = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '..', 'settings.json'), 'utf-8'));

  /** Los comandos cableados a un evento. */
  const cableados = (evento) => (SETTINGS.hooks[evento] || [])
    .flatMap((g) => g.hooks || []).map((h) => h.command);

  test('esta cableado en SessionEnd', () => {
    assert.ok(cableados('SessionEnd').some((c) => c.includes('hotfix-autoclose')),
      'el auto-cierre solo tiene sentido cuando la sesion termina de verdad');
  });

  test('y NO en Stop, que corre por respuesta', () => {
    assert.equal(cableados('Stop').filter((c) => c.includes('hotfix-autoclose')).length, 0,
      'ahi cerraba el hotfix en el primer turno');
  });

  test('el trabajo de varias respuestas ya no pierde su track', () => {
    conHotfixActivo();

    // Tres respuestas del agente. En Stop, la primera ya habria cerrado todo.
    for (const hook of ['spec-reflection.js', 'sync-check.js', 'context-guardian.js']) {
      spawnSync('node', [path.resolve(__dirname, '..', 'hooks', hook)],
        { input: '{}', encoding: 'utf8', cwd: proyecto });
    }

    assert.equal(leer('specs/.active'), 'hotfix-001-ts2345',
      'ningun hook de Stop toca el track activo');
    assert.equal(correrGate('src/app/x.component.ts'), 0,
      'el gate sigue autorizando: el hotfix sigue vivo');
  });

  test('la red de seguridad si cierra cuando la sesion termina', () => {
    const id = conHotfixActivo();
    assert.equal(correr(), 0);
    assert.equal(leer('specs/.active'), '');
    assert.match(leer(`specs/hotfixes/${id}/hotfix.md`), /status: done/);
  });

  test('y es idempotente: correrla dos veces no rompe nada', () => {
    conHotfixActivo();
    correr();
    assert.equal(correr(), 0);
    assert.equal(leer('specs/.active'), '');
  });

  test('existe /hotfix-close, el camino explicito', () => {
    const cmd = path.resolve(__dirname, '..', 'commands', 'hotfix-close.md');
    assert.ok(fs.existsSync(cmd), 'sin el, la red de seguridad vuelve a ser el camino');
    const src = fs.readFileSync(cmd, 'utf-8');
    assert.match(src, /specs\/\.active/);
    assert.match(src, /status: done/);
  });
});

describe('FAIL-OPEN — nunca bloquea el cierre', () => {
  test('hotfix.md ausente: igual vacia .active y sale en 0', () => {
    escribir('specs/.active', 'hotfix-003-x');
    assert.equal(correr(), 0);
    assert.equal(leer('specs/.active'), '');
  });

  test('.active con varias lineas usa solo la primera', () => {
    escribir('specs/.active', 'hotfix-001-x\nbasura');
    escribir('specs/hotfixes/hotfix-001-x/hotfix.md', '> status: in_progress\n');
    correr();
    assert.match(leer('specs/hotfixes/hotfix-001-x/hotfix.md'), /status: done/);
  });

  test('hotfix.md sin la linea status queda sin closed, y no rompe', () => {
    escribir('specs/.active', 'hotfix-004-x');
    escribir('specs/hotfixes/hotfix-004-x/hotfix.md', '# Hotfix\nsin frontmatter\n');
    assert.equal(correr(), 0);
    assert.ok(!leer('specs/hotfixes/hotfix-004-x/hotfix.md').includes('closed:'));
  });
});
