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

describe('EL ORDEN QUE LLEVA SEMANTICA (ACO-004)', () => {
  // El orden de los hooks dentro de un evento era un contrato tacito: tres
  // dependencias reales y solo una escrita, en el docblock de plan-injector.
  // Reordenar settings.json no rompia ningun test — rompia el harness en silencio.
  //
  // Se declaran las que existen HOY. Una de las tres que encontro la auditoria ya
  // no existe: `sync-check` borraba session-writes.json y por eso tenia que ir
  // DESPUES de spec-reflection; desde ACO-001 no borra nada y la dependencia se
  // disolvio en vez de documentarse. Un contrato que deja de ser necesario se
  // saca, no se hereda.
  const DEPENDENCIAS = [
    {
      evento: 'PreToolUse',
      matcher: 'Edit|Write|MultiEdit',
      antes: 'sdd/spec-gate.js',
      despues: 'sdd/plan-injector.js',
      porque: 'el injector inyectaria el contrato SDD sobre una escritura que el gate iba a bloquear',
    },
    {
      evento: 'PostToolUse',
      matcher: 'Edit|Write|MultiEdit',
      antes: 'write-tracker.js',
      despues: 'post-edit.js',
      porque: 'post-edit corre prettier y puede tardar: el tracker registra la escritura primero',
    },
  ];

  /** Los comandos de un evento+matcher, en orden. */
  function ordenDe(evento, matcher) {
    const grupo = (SETTINGS.hooks[evento] || [])
      .find((g) => (g.matcher || null) === (matcher || null));
    return grupo ? (grupo.hooks || []).map((h) => h.command) : [];
  }

  for (const d of DEPENDENCIAS) {
    test(`${d.antes} antes que ${d.despues} — ${d.porque}`, () => {
      const orden = ordenDe(d.evento, d.matcher);
      const i = orden.findIndex((c) => c.includes(d.antes));
      const j = orden.findIndex((c) => c.includes(d.despues));
      assert.ok(i !== -1, `${d.antes} no esta cableado en ${d.evento}`);
      assert.ok(j !== -1, `${d.despues} no esta cableado en ${d.evento}`);
      assert.ok(i < j, `el orden actual es ${orden.join(' → ')}`);
    });
  }

  test('el detector lee el orden real, no uno inventado', () => {
    const orden = ordenDe('PreToolUse', 'Edit|Write|MultiEdit');
    assert.ok(orden.length >= 4, `solo ${orden.length} hooks en PreToolUse`);
    assert.ok(orden[0].includes('spec-gate'), orden.join(' → '));
  });

  test('la dependencia ENTRE eventos tambien queda escrita', () => {
    // discovery-tracker (PostToolUse Read) tiene que haber corrido antes de que
    // el Gate (PreToolUse Edit) mire el flag. No es orden DENTRO de un evento:
    // es que el evento que lo escribe ocurra antes que el que lo lee, y eso no
    // se puede fijar en settings.json — solo documentarse.
    const doc = fs.readFileSync(path.join(CLAUDE, '..', 'docs', 'HOOKS-SYSTEM.md'), 'utf-8');
    assert.match(doc, /Orden que importa/,
      'HOOKS-SYSTEM.md debe declarar las dependencias de orden');
    assert.match(doc, /discovery-tracker/);
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
