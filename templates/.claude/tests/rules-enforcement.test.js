#!/usr/bin/env node
/**
 * rules-enforcement.test.js — Qué regla bloquea y cuál solo pide (HUE-027)
 *
 * `.claude/CLAUDE.md` presenta las 16 reglas de `.claude/rules/` como un bloque,
 * y no lo son. Medido antes de tocar nada:
 *
 *     16 reglas
 *      6  citaban un código que algún mecanismo emite
 *     10  no citaban ninguno
 *
 * Y dos de esas diez **sí estaban mecanizadas** — solo que sin decirlo:
 * `architecture.md` describe en prosa lo que `ARCH-01`, `ARCH-02` y `ARCH-12`
 * bloquean, y `testing-tdd.md` dice «el linter verifica» sin nombrar `ARCH-03`.
 * Un agente bloqueado con `[ARCH-12]` no tenía cómo llegar a la regla que se lo
 * explica, y tampoco cómo saber cuáles de las otras eran solo un acuerdo.
 *
 * Son dos daños distintos y opuestos: creer que algo te frena cuando no, y no
 * encontrar la explicación de lo que sí te frenó.
 *
 * El `enforcement:` del frontmatter lo dice ahora, y este test lo mantiene
 * honesto: la verdad se DERIVA de quién emite cada código —`guard-rules.js` y el
 * `RULES` de `architect.js`—, no de lo que la etiqueta afirme.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CLAUDE = path.resolve(__dirname, '..');
const TEMPLATES = path.resolve(CLAUDE, '..');
const REGLAS = path.join(CLAUDE, 'rules');

/** `architect.js` vive bajo `boilerplate/` en el repo y en `scripts/` en el proyecto. */
function architect() {
  for (const p of [path.join(TEMPLATES, 'boilerplate', 'scripts', 'architect.js'),
    path.join(TEMPLATES, 'scripts', 'architect.js')]) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
  }
  return '';
}

/** Todo código que HOY emite alguien: el guard o el linter. La fuente, no la etiqueta. */
function codigosMecanizados() {
  const guard = require(path.join(CLAUDE, 'hooks', 'lib', 'guard-rules.js'));
  const delLinter = [...architect().matchAll(
    /^\s{4}'((?:ARCH|A11Y|LLM|SEC-RLS|NAV|ICON)-\d{2})':\s*\{/gm)].map((m) => m[1]);
  return new Set([...guard.ids(), ...delLinter]);
}

const MECANIZADOS = codigosMecanizados();

/** Cada regla, con lo que declara y lo que se puede verificar. */
function reglas() {
  return fs.readdirSync(REGLAS).filter((f) => f.endsWith('.md')).map((f) => {
    const txt = fs.readFileSync(path.join(REGLAS, f), 'utf-8');
    const frontmatter = (txt.split(/^---$/m)[1] || '');
    const m = /^enforcement:\s*(\w+)/m.exec(frontmatter);
    const citados = [...new Set(
      [...txt.matchAll(/\b((?:ARCH|A11Y|LLM|SEC-RLS|SEC-ENV|SQL|NAV|ICON)-\d{2})\b/g)]
        .map((x) => x[1]),
    )].filter((id) => MECANIZADOS.has(id));
    return { nombre: f, declara: m ? m[1] : null, citados };
  });
}

const TODAS = reglas();

describe('EL DETECTOR MIRA LA FUENTE, NO LA ETIQUETA', () => {
  test('hay códigos mecanizados de verdad', () => {
    // Sin esto, un `guard-rules` roto o un `architect.js` que no se encuentra
    // harían que todo se declarara «social» y el test pasaría en verde.
    assert.ok(MECANIZADOS.size >= 25, `solo ${MECANIZADOS.size} códigos detectados`);
    assert.ok(MECANIZADOS.has('ARCH-01'));
    assert.ok(MECANIZADOS.has('LLM-02'), 'el guard también emite, no solo el linter');
  });

  test('y hay 16 reglas que mirar', () => {
    assert.equal(TODAS.length, 16);
  });
});

describe('HUE-027 — cada regla declara si bloquea o solo pide', () => {
  for (const r of TODAS) {
    test(`${r.nombre} lo declara`, () => {
      assert.ok(r.declara, 'sin `enforcement:` en el frontmatter, el agente no puede saberlo');
      assert.ok(['mecanizada', 'social'].includes(r.declara), `valor inválido: ${r.declara}`);
    });
  }

  test('ninguna dice «mecanizada» sin un código que la respalde', () => {
    // La mentira cara: hace creer que algo te frena cuando no te frena nada.
    const mienten = TODAS.filter((r) => r.declara === 'mecanizada' && r.citados.length === 0);
    assert.deepEqual(mienten.map((r) => r.nombre), []);
  });

  test('ninguna dice «social» citando un código que sí la respalda', () => {
    // La otra mitad, y es la que estaba: `architecture.md` describía ARCH-01,
    // ARCH-02 y ARCH-12 en prosa sin nombrarlos, así que se leía como un
    // acuerdo. Un agente bloqueado por `[ARCH-12]` no llegaba a esta regla.
    const mienten = TODAS.filter((r) => r.declara === 'social' && r.citados.length > 0);
    assert.deepEqual(mienten.map((r) => `${r.nombre} (${r.citados.join(', ')})`), []);
  });

  test('la partición es la medida: 8 mecanizadas, 8 sociales', () => {
    // No es una lista de nombres a mano —eso se desactualiza (HUE-003)—: es el
    // conteo, para que agregar una regla sin decidir su enforcement se note.
    const mec = TODAS.filter((r) => r.declara === 'mecanizada').length;
    assert.equal(mec, 8, `${mec} mecanizadas`);
    assert.equal(TODAS.length - mec, 8);
  });
});

describe('LAS SOCIALES SON SOCIALES DE VERDAD', () => {
  test('ninguna cita un código de regla que ningún mecanismo emite', () => {
    // Una regla social que cita `ARCH-99` sería peor que una sin códigos: manda
    // a buscar un mecanismo inexistente. `doc-links` ya lo vigila para todo el
    // payload; acá se comprueba sobre la superficie donde más importa.
    const TODOS_LOS_CODIGOS = /\b((?:ARCH|A11Y|LLM|SEC-RLS|SEC-ENV|SQL|NAV|ICON)-\d{2})\b/g;
    const fantasmas = [];
    for (const r of TODAS) {
      const txt = fs.readFileSync(path.join(REGLAS, r.nombre), 'utf-8');
      for (const m of txt.matchAll(TODOS_LOS_CODIGOS)) {
        // SEC-ENV y SQL los emite el guard con ese prefijo; ya están en MECANIZADOS
        // si existen. Cualquier otro que no esté es un fantasma.
        if (!MECANIZADOS.has(m[1])) fantasmas.push(`${r.nombre} → ${m[1]}`);
      }
    }
    assert.deepEqual([...new Set(fantasmas)].sort(), []);
  });
});

describe('HUE-029 — en los adapters las reglas son prosa, y ahora lo dicen', () => {
  // Cursor, Windsurf y Copilot no ejecutan hooks de Claude Code. El harness
  // entero —Discovery Gate, Architect Guard, las 28 reglas del linter— no corre
  // ahí, y los adapters heredaban el lenguaje de un harness que no tienen: el
  // de Windsurf decía, literal, «the most critical rules **enforced on every
  // edit**». Nada las hace cumplir en ese editor.
  //
  // Es el mismo daño que HUE-027 pero peor de grado: no es una regla que no
  // frena, es un archivo entero que no frena, presentándose como si frenara.
  // Los adapters viven en DOS layouts distintos y este test viaja a los dos.
  //
  // En este repo son la fuente: `templates/adapters/{github,cursor,windsurf}`.
  // En un proyecto generado no existe esa carpeta —`copyTemplates` la excluye a
  // propósito— y los archivos aterrizan en su destino final: `.github/`,
  // `.cursor/rules/`, `.windsurf/rules/`. Mirar sólo la primera forma hacía que
  // este test fallara con «solo 0 archivos de adapter» en TODO proyecto
  // generado, o sea que `npm run claude:test-hooks` salía en rojo recién
  // scaffoldeado. Un test que sólo pasa donde se escribió es el mismo modo de
  // fallar que la auditoría persigue, cometido acá.
  // `TEMPLATES` es `templates/` en este repo y la RAÍZ del proyecto en uno
  // generado: la constante de arriba se llama así porque el layout es el mismo
  // un nivel más arriba de `.claude/`. Acá importa la diferencia, así que la
  // raíz se nombra por lo que es en cada caso.
  const FUENTE = path.resolve(TEMPLATES, 'adapters');
  const esFuente = fs.existsSync(FUENTE);
  const PROYECTO = TEMPLATES;

  const RAICES = esFuente
    ? [FUENTE]
    : [path.join(PROYECTO, '.github'), path.join(PROYECTO, '.cursor'),
      path.join(PROYECTO, '.windsurf')];

  function archivosDeAdapters(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) archivosDeAdapters(full, out);
      // En `.github/` viven también workflows y plantillas de PR, que no son
      // adapters: sólo cuenta lo que instruye a un AI tool.
      else if (/\.(md|mdc)$/.test(e.name) && /instructions|rules|project|workflow|architecture/.test(e.name)) {
        out.push(full);
      }
    }
    return out;
  }

  const TODOS = RAICES.flatMap((r) => archivosDeAdapters(r));

  test('hay adapters que revisar', () => {
    // Tres en la fuente; en un proyecto generado, al menos el de Copilot, que
    // es el único que se genera siempre (cursor y windsurf son opt-in).
    const minimo = esFuente ? 3 : 1;
    assert.ok(TODOS.length >= minimo,
      `solo ${TODOS.length} archivos de adapter (esperaba ${minimo}+ en ${esFuente ? 'la fuente' : 'el proyecto generado'})`);
  });

  for (const f of TODOS) {
    const rel = path.relative(esFuente ? TEMPLATES : PROYECTO, f);

    test(`${rel} avisa que ahí nada bloquea`, () => {
      const txt = fs.readFileSync(f, 'utf-8');
      assert.match(txt, /not guardrails/,
        'sin el aviso, el archivo se lee como si el harness corriera en ese editor');
      assert.match(txt, /lint:arch/, 'y tiene que decir cómo verificar de verdad');
    });

    test(`${rel} no dice que algo se hace cumplir en cada edición`, () => {
      // La frase exacta que había. Es la promesa que el editor no puede cumplir.
      const txt = fs.readFileSync(f, 'utf-8');
      assert.ok(!/rules enforced on every edit/i.test(txt), rel);
    });
  }
});
