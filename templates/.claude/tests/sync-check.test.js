#!/usr/bin/env node
/**
 * sync-check.test.js — Contract tests de sync-check.js
 *
 * Es el CONSUMIDOR de session-writes.json que además lo borra. El describe
 * «ACO-001» fija ese borrado tal como ocurre hoy: en cada Stop —que corre por
 * respuesta, no por sesión— y aunque no haya nada que reportar.
 *
 * TESTS DE CARACTERIZACIÓN: describen el comportamiento ACTUAL. ADR-002 §1 muda
 * esa limpieza fuera de Stop; cuando eso pase, estos tests fallan y hay que
 * actualizarlos con intención.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'sync-check.js');
let proyecto;

const trackerPath = () => path.join(proyecto, '.claude', 'temp', 'session-writes.json');

function conTracker(rutas) {
  fs.mkdirSync(path.dirname(trackerPath()), { recursive: true });
  fs.writeFileSync(trackerPath(), JSON.stringify(rutas));
}

/** Crea un archivo con un mtime explícito, para controlar la comparación. */
function archivo(rel, hace_ms = 0) {
  const full = path.join(proyecto, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, 'contenido');
  const t = (Date.now() - hace_ms) / 1000;
  fs.utimesSync(full, t, t);
  return full;
}

function correr() {
  const r = spawnSync('node', [HOOK], { input: '{}', encoding: 'utf8', cwd: proyecto });
  return { exit: r.status, stderr: r.stderr || '' };
}

beforeEach(() => { proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-sc-')); });
afterEach(() => { fs.rmSync(proyecto, { recursive: true, force: true }); });

describe('CUÁNDO AVISA', () => {
  test('avisa si un fuente es más nuevo que el índice más nuevo', () => {
    archivo('indices/COMPONENTS.md', 60_000);   // hace un minuto
    archivo('src/app/x.component.ts', 0);        // ahora
    conTracker(['src/app/x.component.ts']);

    const r = correr();
    assert.equal(r.exit, 2);
    assert.match(r.stderr, /SYNC CHECK/);
    assert.match(r.stderr, /x\.component\.ts/);
  });

  test('NO avisa si el índice es más nuevo que el fuente', () => {
    archivo('src/app/x.component.ts', 60_000);
    archivo('indices/COMPONENTS.md', 0);
    conTracker(['src/app/x.component.ts']);

    assert.equal(correr().exit, 0);
  });

  test('basta UN índice reciente para tapar todos los fuentes', () => {
    archivo('src/app/a.ts', 60_000);
    archivo('src/app/b.ts', 60_000);
    archivo('indices/SERVICES.md', 0);
    conTracker(['src/app/a.ts', 'src/app/b.ts']);
    assert.equal(correr().exit, 0);
  });

  test('lista todos los fuentes más nuevos, no solo el primero', () => {
    archivo('indices/COMPONENTS.md', 60_000);
    archivo('src/app/a.component.ts', 0);
    archivo('src/app/b.component.ts', 0);
    conTracker(['src/app/a.component.ts', 'src/app/b.component.ts']);

    const r = correr();
    assert.equal(r.exit, 2);
    assert.match(r.stderr, /2 archivo\(s\)/);
  });

  test('sin carpeta indices/, cualquier fuente es más nuevo que "nada"', () => {
    archivo('src/app/x.ts', 0);
    conTracker(['src/app/x.ts']);
    assert.equal(correr().exit, 2);
  });
});

describe('CUÁNDO CALLA', () => {
  test('sin tracker, sale en 0', () => {
    assert.equal(correr().exit, 0);
  });

  test('con tracker vacío, sale en 0', () => {
    conTracker([]);
    assert.equal(correr().exit, 0);
  });

  test('con tracker corrupto, sale en 0', () => {
    fs.mkdirSync(path.dirname(trackerPath()), { recursive: true });
    fs.writeFileSync(trackerPath(), '{ roto');
    assert.equal(correr().exit, 0);
  });

  test('un archivo rastreado que ya no existe se saltea', () => {
    archivo('indices/COMPONENTS.md', 60_000);
    conTracker(['src/app/borrado.ts']);
    assert.equal(correr().exit, 0);
  });

  test('acepta rutas absolutas en el tracker', () => {
    archivo('indices/COMPONENTS.md', 60_000);
    const abs = archivo('src/app/x.ts', 0);
    conTracker([abs]);
    assert.equal(correr().exit, 2, 'write-tracker guarda absolutas si así llegan');
  });
});

describe('ACO-001 — CERRADO: sync-check ya no borra el tracker', () => {
  // Stop corre por RESPUESTA, no por sesión. El hook borraba
  // session-writes.json «para la próxima sesión» y dejaba sin datos a sus dos
  // co-consumidores —spec-diff-check y spec-reflection— desde el primer cierre.
  // La limpieza se mudó a session-start con origen `startup` (ADR-002 §1).

  test('el tracker sobrevive a un cierre sin nada que reportar', () => {
    archivo('src/app/x.ts', 60_000);
    archivo('indices/COMPONENTS.md', 0);
    conTracker(['src/app/x.ts']);

    assert.equal(correr().exit, 0);
    assert.ok(fs.existsSync(trackerPath()),
      'spec-diff-check lo necesita en el proximo git commit');
  });

  test('y tambien a un cierre que SI avisa', () => {
    archivo('indices/COMPONENTS.md', 60_000);
    archivo('src/app/x.ts', 0);
    conTracker(['src/app/x.ts']);

    assert.equal(correr().exit, 2);
    assert.ok(fs.existsSync(trackerPath()));
  });

  test('el segundo cierre del mismo trabajo sigue viendo el mismo estado', () => {
    archivo('indices/COMPONENTS.md', 60_000);
    archivo('src/app/x.ts', 0);
    conTracker(['src/app/x.ts']);

    assert.equal(correr().exit, 2, 'primer Stop: avisa');
    assert.equal(correr().exit, 2, 'segundo Stop: sigue avisando, el trabajo sigue');
    assert.deepEqual(JSON.parse(fs.readFileSync(trackerPath(), 'utf-8')), ['src/app/x.ts']);
  });

  test('el hook no llama a unlinkSync ni a rmSync', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '..', 'hooks', 'sync-check.js'), 'utf-8');
    const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    assert.ok(!/unlinkSync|rmSync/.test(codigo),
      'ningun hook de Stop borra estado de ciclo sesion');
  });
});
