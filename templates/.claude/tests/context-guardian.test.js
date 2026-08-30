#!/usr/bin/env node
/**
 * context-guardian.test.js — Contract tests de context-guardian.js
 *
 * CAR-002. Avisa que context/learnings.md esta viejo. Su condicion es el mtime
 * de un archivo, que no cambia por haber avisado — y `Stop` corre en cada
 * respuesta. Resultado: el mismo aviso en todas, indefinidamente, hasta que
 * alguien toque el archivo.
 *
 * El contraste esta en la casa: spec-reflection, otro hook de Stop, tiene
 * anti-bucle explicito y su docblock explica por que. Este no lo aplico.
 *
 * TESTS DE CARACTERIZACION. ADR-002 §2 le pone lib/notify.js con default
 * «una vez»; cuando eso pase, el describe CAR-002 falla a proposito.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'context-guardian.js');
const DIA = 86400000;
let proyecto;

function correr() {
  const r = spawnSync('node', [HOOK], { input: '{}', encoding: 'utf8', cwd: proyecto });
  return { exit: r.status, stderr: r.stderr || '' };
}

/** Crea context/learnings.md con un mtime de hace N dias. */
function conLearnings(diasAtras) {
  const full = path.join(proyecto, 'context', 'learnings.md');
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, '# Learnings\n');
  const t = (Date.now() - diasAtras * DIA) / 1000;
  fs.utimesSync(full, t, t);
}

beforeEach(() => { proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-cg-')); });
afterEach(() => { fs.rmSync(proyecto, { recursive: true, force: true }); });

describe('CUANDO AVISA', () => {
  test('learnings.md sin tocar en mas de 14 dias', () => {
    conLearnings(30);
    const r = correr();
    assert.equal(r.exit, 2);
    assert.match(r.stderr, /LEARNINGS/);
    assert.match(r.stderr, /30 dias/);
    assert.match(r.stderr, /Context Guardian/);
  });

  test('el umbral es estricto: 15 dias avisa, 14 no', () => {
    conLearnings(15);
    assert.equal(correr().exit, 2);
    conLearnings(14);
    assert.equal(correr().exit, 0);
  });
});

describe('CUANDO CALLA', () => {
  test('learnings.md reciente', () => {
    conLearnings(1);
    assert.equal(correr().exit, 0);
  });

  test('sin carpeta context/', () => {
    assert.equal(correr().exit, 0);
  });

  test('sin learnings.md', () => {
    fs.mkdirSync(path.join(proyecto, 'context'), { recursive: true });
    assert.equal(correr().exit, 0);
  });

  test('ya no audita la frescura de brief.md — eso se mudo a session-start', () => {
    const brief = path.join(proyecto, 'context', 'brief.md');
    fs.mkdirSync(path.dirname(brief), { recursive: true });
    fs.writeFileSync(brief, '**last_updated:** 2020-01-01\n');
    assert.equal(correr().exit, 0, 'avisarlo al cerrar llega tarde');
  });
});

describe('CAR-002 — no tiene anti-bucle', () => {
  test('(bug) avisa igual en tres cierres seguidos', () => {
    conLearnings(30);
    const salidas = [correr(), correr(), correr()];
    assert.deepEqual(salidas.map((s) => s.exit), [2, 2, 2],
      'Stop corre por respuesta: esto se repite en cada una');
  });

  test('(bug) el mensaje es identico — nada registra que ya se dijo', () => {
    conLearnings(30);
    assert.equal(correr().stderr, correr().stderr);
  });

  test('(bug) haber avisado no cambia la condicion', () => {
    conLearnings(30);
    const antes = fs.statSync(path.join(proyecto, 'context', 'learnings.md')).mtimeMs;
    correr();
    const despues = fs.statSync(path.join(proyecto, 'context', 'learnings.md')).mtimeMs;
    assert.equal(antes, despues, 'el mtime es la condicion, y el hook no lo toca');
  });

  test('deja de avisar solo si alguien actualiza el archivo', () => {
    conLearnings(30);
    assert.equal(correr().exit, 2);
    conLearnings(0);
    assert.equal(correr().exit, 0);
  });

  test('no escribe ningun estado de anti-bucle', () => {
    conLearnings(30);
    correr();
    const temp = path.join(proyecto, '.claude', 'temp');
    assert.equal(fs.existsSync(temp), false,
      'spec-reflection si guarda una marca; este hook no');
  });
});
