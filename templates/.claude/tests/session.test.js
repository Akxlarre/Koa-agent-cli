#!/usr/bin/env node
/**
 * session.test.js — Contract tests de lib/session.js
 *
 * Los tres primeros describes fijan lo que HUE-002 rompía en producción:
 * dos sesiones no comparten estado, dos proyectos tampoco, y ninguna clave
 * es 'default'. Si alguno vuelve a pasar, el Discovery Gate vuelve a quedar
 * desactivado en silencio.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const S = require(path.resolve(__dirname, '..', 'hooks', 'lib', 'session.js'));

const cwdOriginal = process.cwd();
let tmp;

/** Corre `fn` como si el proceso estuviera dentro de `dir`. */
function enProyecto(dir, fn) {
  fs.mkdirSync(dir, { recursive: true });
  process.chdir(dir);
  try { return fn(); } finally { process.chdir(cwdOriginal); }
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-session-test-'));
});

afterEach(() => {
  process.chdir(cwdOriginal);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('IDENTIDAD — nunca global (HUE-002)', () => {
  test('usa session_id del payload cuando viene', () => {
    enProyecto(path.join(tmp, 'p'), () => {
      assert.equal(S.sessionId({ session_id: 'abc123' }), 'abc123');
    });
  });

  test('sin payload, deriva del cwd y NUNCA devuelve "default"', () => {
    const id = enProyecto(path.join(tmp, 'p'), () => S.sessionId({}));
    assert.notEqual(id, 'default');
    assert.match(id, /^proj-[0-9a-f]{8}$/);
  });

  test('ignora CLAUDE_SESSION_ID aunque esté definida — no es un contrato', () => {
    const antes = process.env.CLAUDE_SESSION_ID;
    process.env.CLAUDE_SESSION_ID = 'del-entorno';
    try {
      const id = enProyecto(path.join(tmp, 'p'), () => S.sessionId({}));
      assert.notEqual(id, 'del-entorno');
    } finally {
      if (antes === undefined) delete process.env.CLAUDE_SESSION_ID;
      else process.env.CLAUDE_SESSION_ID = antes;
    }
  });

  test('dos proyectos distintos no comparten identidad', () => {
    const a = enProyecto(path.join(tmp, 'proyA'), () => S.sessionId({}));
    const b = enProyecto(path.join(tmp, 'proyB'), () => S.sessionId({}));
    assert.notEqual(a, b);
  });

  test('un session_id con separadores de ruta no escapa del directorio', () => {
    const dir = path.join(tmp, 'p');
    enProyecto(dir, () => {
      // La propiedad que importa no es «no contiene ..» —`.._.._etc` es un nombre de
      // directorio válido e inocuo— sino que la ruta resuelta siga estando bajo la raíz.
      const raiz = path.resolve(dir, '.claude', 'temp', 'session');
      for (const malicioso of ['../../../etc', '..', 'a/../../b', '/etc/passwd']) {
        const resuelta = path.resolve(S.sessionScope({ session_id: malicioso }));
        assert.equal(path.dirname(resuelta), raiz, `"${malicioso}" escapó a ${resuelta}`);
      }
    });
  });

  test('una key con separadores tampoco escapa', () => {
    const dir = path.join(tmp, 'p');
    enProyecto(dir, () => {
      S.writeState({ session_id: 's' }, '../../fuera.json', { v: 1 });
      assert.equal(fs.existsSync(path.join(dir, '.claude', 'fuera.json')), false);
      assert.equal(fs.existsSync(path.join(dir, 'fuera.json')), false);
    });
  });
});

describe('EL FALLO DE HUE-002 — no se puede reproducir', () => {
  test('una lectura del proyecto A no deja estado visible para el proyecto B', () => {
    enProyecto(path.join(tmp, 'proyA'), () => {
      S.appendState({ session_id: 'sesion-AAA' }, 'discovery.flag', 'READ | indices/COMPONENTS.md');
    });
    const visto = enProyecto(path.join(tmp, 'proyB'), () =>
      S.readText({ session_id: 'sesion-ZZZ' }, 'discovery.flag'));
    assert.equal(visto, '', 'el proyecto B no debe ver el flag del proyecto A');
  });

  test('dos sesiones del MISMO proyecto tampoco comparten', () => {
    enProyecto(path.join(tmp, 'p'), () => {
      S.appendState({ session_id: 'ses-1' }, 'discovery.flag', 'READ | indices/X.md');
      assert.equal(S.readText({ session_id: 'ses-2' }, 'discovery.flag'), '');
    });
  });
});

describe('ÁMBITOS — sesión vs hilo (HUE-032)', () => {
  test('el subagente comparte el ámbito de sesión con el hilo principal', () => {
    enProyecto(path.join(tmp, 'p'), () => {
      const main = { session_id: 's' };
      const sub = { session_id: 's', agent_id: 'ag-1' };
      S.writeState(main, 'writes.json', { n: 1 }, { scope: 'sesion' });
      assert.deepEqual(S.readState(sub, 'writes.json', { scope: 'sesion' }), { n: 1 });
    });
  });

  test('un aviso consumido por el subagente NO calla al hilo principal', () => {
    enProyecto(path.join(tmp, 'p'), () => {
      const main = { session_id: 's' };
      const sub = { session_id: 's', agent_id: 'ag-1' };
      S.writeState(sub, 'aviso-arquitectura.json', { visto: true }, { scope: 'hilo' });
      assert.equal(S.readState(main, 'aviso-arquitectura.json', { scope: 'hilo' }), null);
    });
  });

  test('dos subagentes distintos no comparten ámbito de hilo', () => {
    enProyecto(path.join(tmp, 'p'), () => {
      const a = { session_id: 's', agent_id: 'ag-1' };
      const b = { session_id: 's', agent_id: 'ag-2' };
      S.writeState(a, 'k.json', { v: 1 }, { scope: 'hilo' });
      assert.equal(S.readState(b, 'k.json', { scope: 'hilo' }), null);
    });
  });

  test('sin agent_id el hilo es "main"', () => {
    assert.equal(S.threadId({ session_id: 's' }), 'main');
  });
});

describe('CLEANUP — nunca borra la sesión viva (INC-020)', () => {
  const viejo = { session_id: 'vieja' };
  const viva = { session_id: 'viva' };

  function conUnaSesionVieja(dir) {
    S.writeState(viejo, 'k.json', { v: 1 });
    S.writeState(viva, 'k.json', { v: 2 });
    const d = path.join(dir, '.claude', 'temp', 'session', 'vieja');
    const hace30dias = Date.now() - 30 * 24 * 60 * 60 * 1000;
    fs.utimesSync(d, hace30dias / 1000, hace30dias / 1000);
  }

  test('borra el estado viejo en un arranque real', () => {
    const dir = path.join(tmp, 'p');
    enProyecto(dir, () => {
      conUnaSesionVieja(dir);
      assert.equal(S.cleanup(viva, { source: 'startup' }), 1);
      assert.deepEqual(S.readState(viva, 'k.json'), { v: 2 }, 'la sesión viva sobrevive');
      assert.equal(S.readState(viejo, 'k.json'), null);
    });
  });

  for (const source of ['resume', 'compact', 'fork', 'clear']) {
    test(`NO borra nada con source="${source}" — la sesión sigue viva`, () => {
      const dir = path.join(tmp, 'p');
      enProyecto(dir, () => {
        conUnaSesionVieja(dir);
        assert.equal(S.cleanup(viva, { source }), 0);
        assert.deepEqual(S.readState(viejo, 'k.json'), { v: 1 });
      });
    });
  }

  test('no borra estado reciente de otra sesión', () => {
    enProyecto(path.join(tmp, 'p'), () => {
      S.writeState({ session_id: 'otra-de-hoy' }, 'k.json', { v: 3 });
      assert.equal(S.cleanup(viva, { source: 'startup' }), 0);
    });
  });
});

describe('FAIL-OPEN — el estado propio nunca frena un hook', () => {
  test('readState devuelve null si el archivo no existe', () => {
    enProyecto(path.join(tmp, 'p'), () => {
      assert.equal(S.readState({ session_id: 's' }, 'no-existe.json'), null);
    });
  });

  test('readState devuelve null ante JSON corrupto', () => {
    const dir = path.join(tmp, 'p');
    enProyecto(dir, () => {
      const p = S.sessionScope({ session_id: 's' });
      fs.mkdirSync(p, { recursive: true });
      fs.writeFileSync(path.join(p, 'roto.json'), '{ esto no es json');
      assert.equal(S.readState({ session_id: 's' }, 'roto.json'), null);
    });
  });

  test('cleanup no lanza si el directorio raíz no existe', () => {
    enProyecto(path.join(tmp, 'vacio'), () => {
      assert.equal(S.cleanup({ session_id: 's' }, { source: 'startup' }), 0);
    });
  });
});
