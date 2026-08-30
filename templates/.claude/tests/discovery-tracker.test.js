#!/usr/bin/env node
/**
 * discovery-tracker.test.js — Contract tests de discovery-tracker.js
 *
 * Es el PRODUCTOR del discovery flag, el artefacto que levanta el guardrail
 * principal del harness. La auditoría lo encontró sin test.
 *
 * Dos huecos quedan fijados acá tal como están hoy:
 *
 *   HUE-002  la clave del flag sale de CLAUDE_SESSION_ID, que no existe, así que
 *            el archivo es `koa-discovery-default.flag`: uno solo para todas las
 *            sesiones y todos los proyectos de la máquina.
 *   DUP-004  escribe el flag ante cualquier Read de indices/, sin mirar quién
 *            leyó — así que un subagente levanta el Gate del hilo principal.
 *
 * TESTS DE CARACTERIZACIÓN. La tanda 3 migra a lib/session.js y estos fallan:
 * hay que actualizarlos con intención.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'discovery-tracker.js');
let proyecto, tmpdir;

function correr(filePath, extra = {}) {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: filePath }, ...extra }),
    encoding: 'utf8',
    cwd: proyecto,
    env: { ...process.env, TMPDIR: tmpdir, CLAUDE_SESSION_ID: undefined },
  });
  return { exit: r.status, stdout: r.stdout || '' };
}

const flags = () => (fs.existsSync(tmpdir) ? fs.readdirSync(tmpdir) : []);
const leerFlag = (n) => fs.readFileSync(path.join(tmpdir, n), 'utf-8');

function escribir(rel, contenido) {
  const full = path.join(proyecto, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contenido);
}

beforeEach(() => {
  proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-dt-proj-'));
  tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-dt-tmp-'));
});
afterEach(() => {
  fs.rmSync(proyecto, { recursive: true, force: true });
  fs.rmSync(tmpdir, { recursive: true, force: true });
});

describe('QUÉ LEVANTA EL FLAG', () => {
  test('leer un índice', () => {
    correr('indices/COMPONENTS.md');
    assert.equal(flags().length, 1);
    assert.match(leerFlag(flags()[0]), /READ \| indices\/COMPONENTS\.md/);
  });

  test('leer context/ también lo levanta (HUE-001: el Gate no distingue)', () => {
    correr('context/brief.md');
    assert.equal(flags().length, 1, 'leer el brief satisface el Discovery Gate');
  });

  test('acumula una línea por lectura', () => {
    correr('indices/COMPONENTS.md');
    correr('indices/SERVICES.md');
    const lineas = leerFlag(flags()[0]).trim().split('\n');
    assert.equal(lineas.length, 2);
  });

  test('la línea conserva el formato "indices/NOMBRE.md" que compact-recovery parsea', () => {
    correr('indices/ANTI-PATTERNS.md');
    assert.match(leerFlag(flags()[0]), /indices\/ANTI-PATTERNS\.md/);
  });
});

describe('QUÉ NO LO LEVANTA', () => {
  for (const ruta of ['src/app/x.component.ts', 'README.md', '.claude/hooks/foo.js',
    'docs/guia.md', 'package.json']) {
    test(`leer ${ruta}`, () => {
      correr(ruta);
      assert.deepEqual(flags(), []);
    });
  }
});

describe('HUE-002 — la clave del flag es global', () => {
  test('(bug) el archivo se llama koa-discovery-default.flag', () => {
    correr('indices/COMPONENTS.md');
    assert.deepEqual(flags(), ['koa-discovery-default.flag'],
      'CLAUDE_SESSION_ID no existe, así que el id cae siempre a "default"');
  });

  test('(bug) dos session_id distintos escriben el MISMO archivo', () => {
    correr('indices/COMPONENTS.md', { session_id: 'sesion-AAA' });
    correr('indices/SERVICES.md', { session_id: 'sesion-ZZZ' });
    assert.equal(flags().length, 1, 'el session_id del payload se ignora');
    assert.equal(leerFlag(flags()[0]).trim().split('\n').length, 2);
  });
});

describe('DUP-004 — no mira quién leyó', () => {
  test('(bug) un subagente levanta el flag igual que el hilo principal', () => {
    correr('indices/COMPONENTS.md', { agent_id: 'ag-1', agent_type: 'discovery-scout' });
    assert.equal(flags().length, 1);
    assert.ok(!leerFlag(flags()[0]).includes('discovery-scout'),
      'el flag no registra el origen, así que el Gate no puede distinguirlo');
  });
});

describe('AVISO DE BRIEF VIEJO', () => {
  test('avisa si last_updated tiene más de 7 días', () => {
    const viejo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    escribir('context/brief.md', `# Brief\n\n**last_updated:** ${viejo}\n`);
    const r = correr('context/brief.md');
    assert.match(r.stdout, /BRIEF STALE/);
    assert.match(r.stdout, /30d|29d|31d/);
  });

  test('calla si el brief es reciente', () => {
    const hoy = new Date().toISOString().slice(0, 10);
    escribir('context/brief.md', `# Brief\n\n**last_updated:** ${hoy}\n`);
    assert.equal(correr('context/brief.md').stdout, '');
  });

  test('calla si el brief no declara last_updated', () => {
    escribir('context/brief.md', '# Brief\n\nsin fecha\n');
    assert.equal(correr('context/brief.md').stdout, '');
  });

  test('solo audita la frescura al leer brief.md, no cualquier índice', () => {
    const viejo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    escribir('context/brief.md', `**last_updated:** ${viejo}\n`);
    assert.equal(correr('indices/COMPONENTS.md').stdout, '');
  });
});

describe('FAIL-OPEN', () => {
  test('stdin inválido → exit 0, sin flag', () => {
    const r = spawnSync('node', [HOOK], {
      input: '{ roto', encoding: 'utf8', cwd: proyecto,
      env: { ...process.env, TMPDIR: tmpdir },
    });
    assert.equal(r.status, 0);
    assert.deepEqual(flags(), []);
  });

  test('sin file_path → exit 0, sin flag', () => {
    const r = spawnSync('node', [HOOK], {
      input: JSON.stringify({ tool_name: 'Read', tool_input: {} }),
      encoding: 'utf8', cwd: proyecto, env: { ...process.env, TMPDIR: tmpdir },
    });
    assert.equal(r.status, 0);
    assert.deepEqual(flags(), []);
  });

  test('siempre sale en 0 — nunca bloquea una lectura', () => {
    assert.equal(correr('indices/COMPONENTS.md').exit, 0);
    assert.equal(correr('cualquier/cosa.txt').exit, 0);
  });
});
