#!/usr/bin/env node
/**
 * guard-rules.test.js — Provocación de las reglas del GUARD
 *
 * HUE-012. `provocar-reglas.mjs` pregunta «¿cada regla del linter puede fallar?»
 * y deja fuera al otro motor de reglas del harness: los ~20 regex de
 * `pre-write-guard`, que bloquean escrituras en tiempo real y no los cubría
 * ninguna provocación.
 *
 * La razón por la que quedaban fuera no era desidia: **no se podían nombrar**.
 * De 25 violaciones que el guard empuja, solo seis decían su ID. Una regla que
 * no se anuncia no se puede provocar, ni contar, ni cruzar contra el doc — que
 * es la misma raíz de INC-001.
 *
 * Este archivo hace con el guard lo que `provocar-reglas.mjs` hace con el
 * linter: arma el archivo más chico que viola cada regla, corre el hook de
 * verdad, y exige que la salida NOMBRE la regla. Una regla que no dispara ante
 * su propia violación es decoración.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'pre-write-guard.js');
const TEMPLATES = path.resolve(__dirname, '..', '..');
const G = require(path.resolve(__dirname, '..', 'hooks', 'lib', 'guard-rules.js'));
const session = require(path.resolve(__dirname, '..', 'hooks', 'lib', 'session.js'));

let proyecto;
let contador = 0;

/**
 * Corre el guard sobre un fixture, en un proyecto donde el resto de las
 * compuertas ya está satisfecho: el Discovery Gate se siembra, porque si no
 * bloquearía antes de llegar al Architect Guard y todos los fixtures «pasarían»
 * por el motivo equivocado.
 */
function provocar(fixture) {
  const payload = {
    tool_name: fixture.tool || 'Edit',
    tool_input: {
      file_path: path.join(proyecto, fixture.ruta),
      content: fixture.contenido,
      new_string: fixture.contenido,
    },
    session_id: `prov-${Date.now()}-${contador++}`,
    cwd: proyecto,
  };
  session.appendState(payload, 'discovery.flag',
    `${new Date().toISOString()} | READ | indices/COMPONENTS.md`);

  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify(payload), encoding: 'utf8', cwd: proyecto,
  });
  return { exit: r.status, salida: `${r.stdout || ''}${r.stderr || ''}` };
}

beforeEach(() => {
  proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-gprov-'));
  // El stack completo: varias reglas están condicionadas por blueprint.json.
  fs.writeFileSync(path.join(proyecto, 'blueprint.json'), JSON.stringify({
    name: 'koa-agent-blueprint', version: '7.0.0', generatedAt: '2026-01-01',
    scaffoldMode: 'full-scaffold',
    stack: { angular: true, tailwind: true, primeng: true, gsap: true, supabase: true },
  }));
});
afterEach(() => { fs.rmSync(proyecto, { recursive: true, force: true }); });

describe('CADA REGLA DEL GUARD DISPARA ANTE SU PROPIA VIOLACIÓN', () => {
  for (const id of G.ids()) {
    test(`${id} — ${G.GUARD_RULES[id].que}`, () => {
      const r = provocar(G.GUARD_RULES[id].fixture);
      assert.equal(r.exit, 2, `${id} no bloqueó:\n${r.salida}`);
      assert.ok(G.disparo(r.salida, id),
        `${id} bloqueó pero no dijo su nombre:\n${r.salida}`);
    });
  }

  test('hay reglas que provocar', () => {
    // Si el registro quedara vacío, el describe entero pasaría por vacío.
    assert.ok(G.ids().length >= 15, `solo ${G.ids().length} reglas registradas`);
  });

  test('toda regla registrada tiene fixture', () => {
    // El momento de escribir el fixture es cuando se escribe la regla.
    assert.deepEqual(G.sinFixture(), []);
  });
});

describe('EL REGISTRO NO MIENTE', () => {
  test('todo ID que el guard emite está registrado', () => {
    // Al revés del test de arriba: una regla nueva que emita un ID sin entrada
    // en el registro se escapa de la provocación sin que nada lo note.
    const src = fs.readFileSync(HOOK, 'utf-8');
    const emitidos = [...new Set(
      [...src.matchAll(/violations\.push\(\s*\n?\s*'\[([A-Z0-9-]+)\]/g)].map((m) => m[1]),
    )];
    const huerfanos = emitidos.filter((id) => !G.ids().includes(id));
    assert.deepEqual(huerfanos, [], 'emiten un ID que el registro no conoce');
  });

  test('ninguna violación del guard sale sin nombre', () => {
    // Eran diecinueve de veinticinco: bloqueaban una escritura con una frase y
    // nada más, y varias ya estaban documentadas con ID en TECH-STACK-RULES.md.
    const src = fs.readFileSync(HOOK, 'utf-8');
    const sinNombre = [...src.matchAll(/violations\.push\(\s*\n?\s*'([^[])/g)]
      .map((m) => m[1]);
    assert.deepEqual(sinNombre, [],
      'una regla que no se anuncia no se puede provocar ni cruzar contra el doc');
  });

  test('cada regla apunta a un doc que existe', () => {
    for (const id of G.ids()) {
      const [archivo] = G.GUARD_RULES[id].doc.split('#');
      assert.ok(fs.existsSync(path.join(TEMPLATES, archivo)), `${id} → ${archivo}`);
    }
  });

  test('y a un ancla que existe en ese doc', () => {
    // doc-links.test.js hace esto para el linter; el guard no pasaba por ahí
    // porque sus reglas no declaraban `doc:` en ningún lado.
    for (const id of G.ids()) {
      const [archivo, ancla] = G.GUARD_RULES[id].doc.split('#');
      const md = fs.readFileSync(path.join(TEMPLATES, archivo), 'utf-8');
      assert.ok(md.toLowerCase().includes(`id="${ancla}"`), `falta el ancla ${ancla} en ${archivo}`);
    }
  });
});

describe('LA PROVOCACIÓN PUEDE FALLAR — si no, es decoración', () => {
  test('un fixture que no viola nada no dispara', () => {
    const r = provocar({
      ruta: 'src/app/features/x/x.component.html',
      contenido: '<div class="text-primary">@if (ok()) { <p>x</p> }</div>',
    });
    assert.notEqual(r.exit, 2, `bloqueó código correcto:\n${r.salida}`);
  });

  test('y una regla que dejara de dispararse se vería', () => {
    // Se comprueba el mecanismo, no la regla: `disparo` exige el ID entre
    // corchetes, así que un mensaje que lo pierda no cuenta como disparo.
    assert.equal(G.disparo('bloqueado por ARCH-06 sin corchetes', 'ARCH-06'), false);
    assert.equal(G.disparo('🚨 [ARCH-06] usa @if', 'ARCH-06'), true);
  });
});
