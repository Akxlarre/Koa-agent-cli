#!/usr/bin/env node
/**
 * payload.test.js — Contract tests de lib/payload.js
 *
 * El describe «DEC-001» fija lo que hacía decorativo a spec-diff-check: leía
 * process.env.TOOL_INPUT, que no existe, así que el comando siempre llegaba
 * vacío y el hook salía en 0 ante el caso que debía bloquear.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const path = require('path');

const P = require(path.resolve(__dirname, '..', 'hooks', 'lib', 'payload.js'));

/** Simula el stdin que Claude Code le pasa a un hook. */
function conStdin(texto, opts = {}) {
  return P.read({ ...opts, stream: Readable.from([texto]) });
}

describe('LECTURA — stdin es la única fuente', () => {
  test('parsea un payload de PreToolUse', async () => {
    const p = await conStdin(JSON.stringify({
      session_id: 'ses-1',
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: 'src/app/x.ts', new_string: 'export class X {}' },
    }));
    assert.equal(p.ok, true);
    assert.equal(p.sessionId, 'ses-1');
    assert.equal(p.toolName, 'Edit');
    assert.equal(p.hookEvent, 'PreToolUse');
    assert.equal(p.filePath, 'src/app/x.ts');
    assert.equal(p.newContent, 'export class X {}');
  });

  test('expone agent_id y agent_type cuando el hook corre en un subagente', async () => {
    const p = await conStdin(JSON.stringify({
      session_id: 's', agent_id: 'ag-7', agent_type: 'index-syncer',
    }));
    assert.equal(p.agentId, 'ag-7');
    assert.equal(p.agentType, 'index-syncer');
  });

  test('en el hilo principal, agent_id es null', async () => {
    const p = await conStdin(JSON.stringify({ session_id: 's' }));
    assert.equal(p.agentId, null);
  });

  test('expone source, que distingue startup de compact (INC-020)', async () => {
    const p = await conStdin(JSON.stringify({ hook_event_name: 'SessionStart', source: 'compact' }));
    assert.equal(p.source, 'compact');
  });
});

describe('DEC-001 — no hay fuente alternativa al stdin', () => {
  test('con TOOL_INPUT definida y stdin vacío, el comando NO se lee de la env var', async () => {
    const antes = process.env.TOOL_INPUT;
    process.env.TOOL_INPUT = JSON.stringify({ command: 'git commit -m "wip"' });
    try {
      const p = await conStdin('');
      assert.equal(p.command, '', 'una variable de entorno inventada no es una fuente');
      assert.equal(p.ok, false);
    } finally {
      if (antes === undefined) delete process.env.TOOL_INPUT;
      else process.env.TOOL_INPUT = antes;
    }
  });

  test('el comando SÍ llega cuando viene por stdin, que es el contrato', async () => {
    const p = await conStdin(JSON.stringify({
      tool_name: 'Bash', tool_input: { command: 'git commit -m "wip"' },
    }));
    assert.equal(p.command, 'git commit -m "wip"');
  });
});

describe('NORMALIZACIÓN — los nombres cambian según la herramienta (HUE-010)', () => {
  test('file_path y path son el mismo campo', async () => {
    const a = await conStdin(JSON.stringify({ tool_input: { file_path: 'a/b.ts' } }));
    const b = await conStdin(JSON.stringify({ tool_input: { path: 'a/b.ts' } }));
    assert.equal(a.filePath, 'a/b.ts');
    assert.equal(b.filePath, 'a/b.ts');
  });

  test('new_string y content son el mismo campo', async () => {
    const a = await conStdin(JSON.stringify({ tool_input: { new_string: 'x' } }));
    const b = await conStdin(JSON.stringify({ tool_input: { content: 'x' } }));
    assert.equal(a.newContent, 'x');
    assert.equal(b.newContent, 'x');
  });

  test('las rutas de Windows se normalizan a "/"', async () => {
    const p = await conStdin(JSON.stringify({ tool_input: { file_path: 'src\\app\\x.ts' } }));
    assert.equal(p.filePath, 'src/app/x.ts');
  });

  test('file_path gana sobre path si vienen los dos', async () => {
    const p = await conStdin(JSON.stringify({ tool_input: { file_path: 'a.ts', path: 'b.ts' } }));
    assert.equal(p.filePath, 'a.ts');
  });
});

describe('FAIL-OPEN — leerse a sí mismo nunca frena una operación', () => {
  const casos = [
    ['stdin vacío', ''],
    ['solo espacios', '   \n  '],
    ['JSON inválido', '{ esto no es json'],
    ['JSON que no es objeto', '"una cadena"'],
    ['array en vez de objeto', '[1,2,3]'],
    ['null', 'null'],
  ];

  for (const [nombre, entrada] of casos) {
    test(`${nombre} → payload vacío, ok:false, sin lanzar`, async () => {
      const p = await conStdin(entrada);
      assert.equal(p.ok, false);
      assert.equal(p.filePath, '');
      assert.equal(p.command, '');
      assert.equal(p.toolName, '');
      assert.equal(p.sessionId, null);
    });
  }

  test('tool_input ausente no rompe la normalización', async () => {
    const p = await conStdin(JSON.stringify({ tool_name: 'Edit' }));
    assert.equal(p.toolName, 'Edit');
    assert.equal(p.filePath, '');
  });

  test('tool_input que no es objeto tampoco', async () => {
    const p = await conStdin(JSON.stringify({ tool_name: 'Edit', tool_input: 'no-soy-objeto' }));
    assert.equal(p.filePath, '');
  });

  test('cwd cae al del proceso si el payload no lo trae', async () => {
    const p = await conStdin(JSON.stringify({}));
    assert.equal(p.cwd, process.cwd());
  });
});

describe('SEC-04 — tope de entrada', () => {
  test('una entrada mayor al tope no se parsea y no agota memoria', async () => {
    const gigante = JSON.stringify({ tool_input: { content: 'x'.repeat(5000) } });
    const p = await conStdin(gigante, { maxBytes: 100 });
    assert.equal(p.ok, false);
    assert.equal(p.newContent, '');
  });

  test('una entrada justo por debajo del tope sí se parsea', async () => {
    const chico = JSON.stringify({ tool_input: { content: 'hola' } });
    const p = await conStdin(chico, { maxBytes: chico.length + 10 });
    assert.equal(p.newContent, 'hola');
  });
});
