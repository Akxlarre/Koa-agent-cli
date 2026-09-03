#!/usr/bin/env node
/**
 * discovery-tracker.test.js — Contract tests de discovery-tracker.js
 *
 * Es el PRODUCTOR del discovery flag, el artefacto que levanta el guardrail
 * principal del harness. La auditoría lo encontró sin test.
 *
 * Dos huecos CERRADOS en la tanda 3:
 *
 *   HUE-002  la clave salía de CLAUDE_SESSION_ID, que no existe, así que el
 *            archivo era `koa-discovery-default.flag` en TMPDIR: uno solo para
 *            todas las sesiones y todos los proyectos de la máquina. Ahora sale
 *            del payload y el flag vive dentro del proyecto.
 *   DUP-004  escribía el flag ante cualquier Read de indices/ sin registrar quién
 *            leyó. Ahora la línea lleva el origen, así que el Gate puede
 *            distinguir una lectura de subagente — falta que la use.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'discovery-tracker.js');
let proyecto, tmpdir;

const SESION = 'sesion-1';

function correr(filePath, extra = {}) {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({
      tool_name: 'Read',
      tool_input: { file_path: filePath },
      session_id: SESION,
      cwd: proyecto,
      ...extra,
    }),
    encoding: 'utf8',
    cwd: proyecto,
    env: { ...process.env, TMPDIR: tmpdir },
  });
  return { exit: r.status, stdout: r.stdout || '' };
}

/** Las sesiones que dejaron flag, dentro del proyecto. */
const sesionesConFlag = () => {
  const raiz = path.join(proyecto, '.claude', 'temp', 'session');
  if (!fs.existsSync(raiz)) return [];
  return fs.readdirSync(raiz).filter((d) =>
    fs.existsSync(path.join(raiz, d, 'discovery.flag')));
};
const leerFlag = (sid = SESION) =>
  fs.readFileSync(path.join(proyecto, '.claude', 'temp', 'session', sid, 'discovery.flag'), 'utf-8');

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
    assert.deepEqual(sesionesConFlag(), [SESION]);
    assert.match(leerFlag(), /READ \| indices\/COMPONENTS\.md/);
  });

  test('leer context/ también escribe una línea — pero no abre el Gate (INC-006)', () => {
    // Este test se llamaba «leer context/ también lo levanta» y afirmaba, en su
    // mensaje, que «leer el brief satisface el Discovery Gate». Dejó de ser
    // cierto con HUE-001: el Gate pasó a exigir una línea con `indices/` y este
    // test siguió en verde, porque lo único que comprobaba es que el archivo
    // existiera. Un test que se queda con el nombre viejo defiende la conducta
    // vieja, y lo hace con la autoridad de estar en verde.
    //
    // Lo que es cierto y hay que fijar son las dos mitades:
    correr('context/brief.md');
    assert.equal(sesionesConFlag().length, 1, 'la lectura se registra: es información real');
    assert.doesNotMatch(leerFlag(), /indices\//,
      'y no nombra ningún índice, que es lo que el Gate exige para abrirse');
  });

  test('acumula una línea por lectura', () => {
    correr('indices/COMPONENTS.md');
    correr('indices/SERVICES.md');
    assert.equal(leerFlag().trim().split('\n').length, 2);
  });

  test('la línea conserva el formato "indices/NOMBRE.md" que compact-recovery parsea', () => {
    correr('indices/ANTI-PATTERNS.md');
    assert.match(leerFlag(), /indices\/ANTI-PATTERNS\.md/);
  });
});

describe('QUÉ NO LO LEVANTA', () => {
  for (const ruta of ['src/app/x.component.ts', 'README.md', '.claude/hooks/foo.js',
    'docs/guia.md', 'package.json']) {
    test(`leer ${ruta}`, () => {
      correr(ruta);
      assert.deepEqual(sesionesConFlag(), []);
    });
  }
});

describe('HUE-002 — CERRADO: la clave sale del payload', () => {
  test('el flag vive en el proyecto, no en TMPDIR', () => {
    correr('indices/COMPONENTS.md');
    assert.deepEqual(fs.readdirSync(tmpdir), [], 'TMPDIR queda intacto');
    assert.deepEqual(sesionesConFlag(), [SESION]);
  });

  test('dos session_id distintos escriben archivos DISTINTOS', () => {
    correr('indices/COMPONENTS.md', { session_id: 'sesion-AAA' });
    correr('indices/SERVICES.md', { session_id: 'sesion-ZZZ' });
    assert.deepEqual(sesionesConFlag().sort(), ['sesion-AAA', 'sesion-ZZZ']);
    assert.equal(leerFlag('sesion-AAA').trim().split('\n').length, 1);
    assert.equal(leerFlag('sesion-ZZZ').trim().split('\n').length, 1);
  });

  test('sin session_id en el payload, la clave se deriva del proyecto', () => {
    const r = spawnSync('node', [HOOK], {
      input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'indices/X.md' }, cwd: proyecto }),
      encoding: 'utf8', cwd: proyecto,
    });
    assert.equal(r.status, 0);
    assert.match(sesionesConFlag()[0], /^proj-[0-9a-f]{8}$/, 'nunca "default"');
  });
});

describe('DUP-004 — el flag ahora registra el origen', () => {
  test('una lectura de subagente queda marcada como tal', () => {
    correr('indices/COMPONENTS.md', { agent_id: 'ag-1', agent_type: 'discovery-scout' });
    assert.match(leerFlag(), /SUBAGENT:discovery-scout \| indices\/COMPONENTS\.md/,
      'el Gate ya puede distinguir quien descubrio');
  });

  test('una lectura del hilo principal se marca READ', () => {
    correr('indices/COMPONENTS.md');
    assert.match(leerFlag(), /\| READ \|/);
  });

  test('el subagente comparte el flag de la sesion, a proposito', () => {
    correr('indices/COMPONENTS.md', { agent_id: 'ag-1', agent_type: 'discovery-scout' });
    correr('indices/SERVICES.md');
    assert.equal(sesionesConFlag().length, 1, 'mismo session_id, mismo ambito');
    assert.equal(leerFlag().trim().split('\n').length, 2);
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
    assert.deepEqual(sesionesConFlag(), []);
  });

  test('sin file_path → exit 0, sin flag', () => {
    const r = spawnSync('node', [HOOK], {
      input: JSON.stringify({ tool_name: 'Read', tool_input: {} }),
      encoding: 'utf8', cwd: proyecto, env: { ...process.env, TMPDIR: tmpdir },
    });
    assert.equal(r.status, 0);
    assert.deepEqual(sesionesConFlag(), []);
  });

  test('siempre sale en 0 — nunca bloquea una lectura', () => {
    assert.equal(correr('indices/COMPONENTS.md').exit, 0);
    assert.equal(correr('cualquier/cosa.txt').exit, 0);
  });
});
