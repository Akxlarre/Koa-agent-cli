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
 * CERRADO. El aviso pasa por budget.avisar(), cuyo default es no repetir. La
 * dedup es por CONTENIDO y en ambito de hilo: el dia que el contador de dias
 * suba, el texto cambia y el aviso vuelve solo; y un subagente que lo consuma no
 * deja mudo al hilo principal.
 *
 * ADR-002 §2 pedia un lib/notify.js aparte. Terminó siendo budget.avisar() —
 * misma maquinaria que inject, nombre propio y destino distinto (stderr).
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

function correr(extra = {}) {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify(extra), encoding: 'utf8', cwd: proyecto,
  });
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

describe('CAR-002 — CERRADO: avisa una vez, no en cada respuesta', () => {
  test('tres cierres seguidos: avisa el primero y calla los dos siguientes', () => {
    conLearnings(30);
    const salidas = [correr(), correr(), correr()];
    assert.deepEqual(salidas.map((s) => s.exit), [2, 0, 0],
      'Stop corre por respuesta; el aviso es uno por hilo');
  });

  test('el primero si trae el aviso entero', () => {
    conLearnings(30);
    const r = correr();
    assert.match(r.stderr, /LEARNINGS/);
    assert.match(r.stderr, /30 dias/);
    assert.equal(correr().stderr, '', 'el segundo no dice nada, ni el marco');
  });

  test('haber avisado no cambia la condicion — por eso hace falta el estado', () => {
    conLearnings(30);
    const antes = fs.statSync(path.join(proyecto, 'context', 'learnings.md')).mtimeMs;
    correr();
    const despues = fs.statSync(path.join(proyecto, 'context', 'learnings.md')).mtimeMs;
    assert.equal(antes, despues,
      'el mtime sigue igual: sin registrar lo dicho, el aviso volveria para siempre');
  });

  test('si el mensaje CAMBIA vuelve a decirse — la dedup es por contenido', () => {
    conLearnings(30);
    assert.equal(correr().exit, 2);
    assert.equal(correr().exit, 0);

    conLearnings(60);
    assert.equal(correr().exit, 2, 'otro numero de dias es otra informacion');
  });

  test('deja de avisar tambien si alguien actualiza el archivo', () => {
    conLearnings(30);
    assert.equal(correr().exit, 2);
    conLearnings(0);
    assert.equal(correr().exit, 0);
  });

  test('registra lo dicho en el ambito de HILO, no en el de sesion', () => {
    conLearnings(30);
    correr({ session_id: 's1' });
    const marca = path.join(proyecto, '.claude', 'temp', 'session', 's1',
      'thread-main', 'budget-aviso-learnings-viejo.json');
    assert.ok(fs.existsSync(marca), 'la marca vive junto al hilo que la consumio');
  });

  test('un subagente no se lleva el unico aviso del hilo principal', () => {
    conLearnings(30);
    assert.equal(correr({ session_id: 's1', agent_id: 'scout' }).exit, 2,
      'el subagente lo ve en su contexto');
    assert.equal(correr({ session_id: 's1' }).exit, 2,
      'y el hilo principal —el que le habla a la persona— tambien');
    assert.equal(correr({ session_id: 's1' }).exit, 0);
  });
});
