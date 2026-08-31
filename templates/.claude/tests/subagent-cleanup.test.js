#!/usr/bin/env node
/**
 * subagent-cleanup.test.js — Contract tests del hook de SubagentStop
 *
 * ADR-003 §3. El ámbito de hilo que introdujo §1 se abre solo: cada subagente
 * escribe su dedup, su anti-bucle y su breaker en `thread-<agent_id>/`. Nada los
 * cerraba, así que `session/<sid>/` acumulaba un directorio por invocación —
 * todos muertos— dentro de una sesión larga.
 *
 * Lo que este test fija es la mitad difícil: que se borre SOLO el hilo que
 * termina. Un hook de limpieza que se lleve de más es peor que no tenerlo.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'subagent-cleanup.js');
const session = require(path.resolve(__dirname, '..', 'hooks', 'lib', 'session.js'));

let proyecto;

const payloadDe = (extra) => ({ session_id: 's1', cwd: proyecto, ...extra });

function correr(extra) {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify(payloadDe(extra)), encoding: 'utf8', cwd: proyecto,
  });
  return { exit: r.status, stderr: r.stderr || '' };
}

/** Deja estado de hilo y de sesión, como lo dejarían los hooks reales. */
function sembrar(extra) {
  const p = payloadDe(extra);
  session.writeState(p, 'breaker.json', { 'x.ts::algo': 2 }, { scope: 'hilo' });
  session.writeState(p, 'budget-aviso-x.json', { n: 0, hash: 'abc' }, { scope: 'hilo' });
  session.appendState(p, 'discovery.flag', '2026-01-01 | READ | indices/COMPONENTS.md');
  return p;
}

const existeHilo = (extra) => fs.existsSync(session.threadScope(payloadDe(extra)));
const existeSesion = () => fs.existsSync(session.sessionScope(payloadDe({})));

beforeEach(() => { proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-sac-')); });
afterEach(() => { fs.rmSync(proyecto, { recursive: true, force: true }); });

describe('CIERRA EL HILO QUE TERMINA', () => {
  test('borra el estado del subagente', () => {
    const extra = { agent_id: 'scout-1', agent_type: 'discovery-scout' };
    sembrar(extra);
    assert.ok(existeHilo(extra), 'precondición: el hilo tenía estado');

    assert.equal(correr(extra).exit, 0);
    assert.equal(existeHilo(extra), false);
  });

  test('y no toca el estado de SESIÓN', () => {
    // El discovery flag y session-writes.json describen LO QUE SE HIZO: lo que el
    // subagente descubrió sigue siendo cierto después de que se fue. Ese es el
    // criterio con el que se repartieron los dos ámbitos (ADR-003 §1).
    const extra = { agent_id: 'scout-1', agent_type: 'discovery-scout' };
    sembrar(extra);
    correr(extra);

    assert.ok(existeSesion());
    assert.match(session.readText(payloadDe({}), 'discovery.flag'), /COMPONENTS/);
  });

  test('no toca el hilo de OTRO subagente que sigue corriendo', () => {
    const uno = { agent_id: 'scout-1', agent_type: 'discovery-scout' };
    const otro = { agent_id: 'auditor-9', agent_type: 'arch-auditor' };
    sembrar(uno);
    sembrar(otro);

    correr(uno);
    assert.equal(existeHilo(uno), false);
    assert.ok(existeHilo(otro), 'los subagentes corren en paralelo');
  });
});

describe('NUNCA SE LLEVA EL HILO PRINCIPAL', () => {
  test('sin agent_id no borra nada', () => {
    // `thread-main` es la conversación que continúa: borrar ahí se llevaría los
    // avisos que la persona todavía no vio.
    sembrar({});
    assert.equal(correr({}).exit, 0);
    assert.ok(existeHilo({}), 'un payload sin agent_id no cierra el hilo principal');
  });

  test('un agent_id vacío tampoco', () => {
    sembrar({});
    correr({ agent_id: '' });
    assert.ok(existeHilo({}));
  });
});

describe('FAIL-OPEN — limpia, no bloquea', () => {
  for (const [nombre, entrada] of [
    ['stdin inválido', '{ roto'],
    ['payload vacío', '{}'],
    ['stdin vacío', ''],
  ]) {
    test(`${nombre}: exit 0`, () => {
      const r = spawnSync('node', [HOOK], { input: entrada, encoding: 'utf8', cwd: proyecto });
      assert.equal(r.status, 0);
    });
  }

  test('sin nada que borrar tampoco falla', () => {
    assert.equal(correr({ agent_id: 'fantasma' }).exit, 0);
  });
});

describe('CABLEADO', () => {
  const settings = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '..', 'settings.json'), 'utf-8'));

  test('está en SubagentStop y en ningún otro evento', () => {
    const eventos = Object.entries(settings.hooks)
      .filter(([, grupos]) => grupos.some((g) => (g.hooks || [])
        .some((h) => h.command.includes('subagent-cleanup'))))
      .map(([e]) => e);
    assert.deepEqual(eventos, ['SubagentStop']);
  });
});
