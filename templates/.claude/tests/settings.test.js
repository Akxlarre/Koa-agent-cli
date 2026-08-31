#!/usr/bin/env node
/**
 * settings.test.js — Contract tests de .claude/settings.json
 *
 * HUE-009. El cableado es la unica pieza sin la cual NADA del harness corre, y
 * no habia ningun test que lo mirara: un hook renombrado, un typo en la ruta o
 * un evento mal escrito no fallan ruidoso — el hook simplemente no corre nunca,
 * y el guardrail queda apagado en todos los proyectos generados.
 *
 * Se verifica lo que se puede verificar sin el runtime:
 *   1. Cada comando cableado apunta a un archivo que existe.
 *   2. Cada archivo referenciado se parsea (node --check).
 *   3. Los eventos son eventos que Claude Code emite de verdad.
 *   4. Los dos matchers que llevan semantica estan puestos.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CLAUDE = path.resolve(__dirname, '..');
const PROYECTO = path.resolve(CLAUDE, '..');
const SETTINGS = JSON.parse(fs.readFileSync(path.join(CLAUDE, 'settings.json'), 'utf-8'));

/** Los eventos que el runtime emite. Un typo aca es un hook que no corre jamas. */
const EVENTOS = new Set([
  'SessionStart', 'SessionEnd', 'UserPromptSubmit',
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'PreCompact', 'PostCompact',
  'Stop', 'StopFailure', 'SubagentStart', 'SubagentStop', 'Notification',
]);

/** Todos los { evento, matcher, comando } cableados. */
function cableados() {
  const out = [];
  for (const [evento, grupos] of Object.entries(SETTINGS.hooks || {})) {
    for (const g of grupos || []) {
      for (const h of g.hooks || []) {
        out.push({ evento, matcher: g.matcher || null, comando: h.command, tipo: h.type });
      }
    }
  }
  return out;
}

/** `node .claude/hooks/x.js` → la ruta, resuelta contra la raiz del proyecto. */
function archivoDe(comando) {
  const m = /(?:^|\s)((?:\.claude|scripts)\/[\w./-]+\.(?:js|mjs|cjs))/.exec(comando);
  return m ? path.join(PROYECTO, m[1]) : null;
}

const TODOS = cableados();

describe('CADA COMANDO CABLEADO APUNTA A UN ARCHIVO QUE EXISTE (HUE-009)', () => {
  for (const { evento, comando } of TODOS) {
    test(`${evento} → ${comando}`, () => {
      const archivo = archivoDe(comando);
      assert.ok(archivo, `no se pudo extraer una ruta de: ${comando}`);
      assert.ok(fs.existsSync(archivo), `cableado y no existe: ${archivo}`);
    });
  }

  test('el detector encuentra rutas de verdad', () => {
    // Si el regex fallara, el describe pasaria en verde sin mirar nada.
    assert.ok(TODOS.length >= 10, `solo ${TODOS.length} hooks cableados?`);
    assert.equal(
      archivoDe('node .claude/hooks/sync-check.js'),
      path.join(PROYECTO, '.claude/hooks/sync-check.js'));
  });

  test('y una ruta inventada lo romperia', () => {
    assert.equal(fs.existsSync(archivoDe('node .claude/hooks/no-existe.js')), false);
  });
});

describe('CADA HOOK CABLEADO SE PARSEA', () => {
  const vistos = new Set();
  for (const { comando } of TODOS) {
    const archivo = archivoDe(comando);
    if (!archivo || vistos.has(archivo)) continue;
    vistos.add(archivo);

    test(path.relative(PROYECTO, archivo), () => {
      if (!fs.existsSync(archivo)) return; // lo cubre el describe anterior
      const r = spawnSync('node', ['--check', archivo], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
    });
  }
});

describe('LOS EVENTOS EXISTEN', () => {
  for (const evento of Object.keys(SETTINGS.hooks || {})) {
    test(`${evento} es un evento del runtime`, () => {
      assert.ok(EVENTOS.has(evento), `"${evento}" no lo emite nadie: el hook nunca corre`);
    });
  }

  test('todo hook es de tipo command', () => {
    for (const h of TODOS) assert.equal(h.tipo, 'command', h.comando);
  });
});

describe('LOS MATCHERS QUE LLEVAN SEMANTICA', () => {
  test('SessionStart excluye compact (INC-020, CAR-004)', () => {
    const g = SETTINGS.hooks.SessionStart[0];
    assert.ok(g.matcher, 'sin matcher corre tambien en compact y duplica la inyeccion');
    assert.ok(!g.matcher.includes('compact'), g.matcher);
    assert.ok(g.matcher.includes('startup'), g.matcher);
  });

  test('el auto-cierre del hotfix vive en SessionEnd, no en Stop (INC-007)', () => {
    const donde = TODOS.filter((h) => h.comando.includes('hotfix-autoclose')).map((h) => h.evento);
    assert.deepEqual(donde, ['SessionEnd']);
  });
});
