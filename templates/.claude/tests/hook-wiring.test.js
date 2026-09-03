#!/usr/bin/env node
/**
 * hook-wiring.test.js — ¿el sistema EJECUTA lo que estos tests prueban? (HUE-025)
 *
 * El hallazgo decía que «la cobertura mide que la lógica sea correcta, casi
 * nunca que el sistema la ejecute ni que alguien intente evadirla». Medido
 * sobre la suite antes de escribir esto, es cierto a medias y conviene separar
 * los dos ejes, porque están en estados muy distintos:
 *
 *   EVASIÓN    79 asserts de bloqueo (exit 2) contra 68 de paso (exit 0).
 *              La suite sí pone al hook delante de lo que debe frenar; es lo
 *              que más ejercita. Ese eje está mejor de lo que el hallazgo dice.
 *
 *   EJECUCIÓN  cero mecanismos. Nada comprueba que un hook con 40 tests en
 *              verde esté efectivamente cableado en `settings.json`. Borrás su
 *              entrada y la suite entera sigue verde mientras el hook deja de
 *              correr.
 *
 * Ese segundo es exactamente `ARCH-26` —detector escrito, tests en verde, cero
 * llamadores— que este repositorio ya aprendió del lado del linter cuando
 * escribió `rule-wiring.js`, y nunca aplicó a los hooks. Un guardrail
 * descableado es peor que ausente: el ausente se nota.
 *
 * Este archivo cubre el eje de ejecución en sus tres direcciones. La verdad se
 * DERIVA del filesystem y de `settings.json`; no hay lista que mantener salvo
 * la de los opt-in declarados, que sólo puede achicarse.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CLAUDE = path.resolve(__dirname, '..');
const HOOKS = path.join(CLAUDE, 'hooks');
const SETTINGS = path.join(CLAUDE, 'settings.json');

/**
 * Hooks que existen a propósito sin estar cableados.
 *
 * `context-enrichment-guard.js` es el Day 0 Context Guard: bloquea escribir
 * código mientras `context/domain.md` e `indices/DATABASE.md` sigan vacíos.
 * `.claude/CLAUDE.md` lo documenta como **opt-in** — se activa cuando el
 * dominio lo amerita. Está acá para que la excepción sea una decisión escrita y
 * no un descuido que se lee igual.
 */
const OPT_IN = ['context-enrichment-guard.js'];

const settings = fs.readFileSync(SETTINGS, 'utf-8');

/** Los hooks de primer nivel: los que `settings.json` debería nombrar. */
function hooksEnDisco() {
  return fs.readdirSync(HOOKS)
    .filter((f) => f.endsWith('.js'))
    .sort();
}

/** Toda ruta `.js` bajo `hooks/` que `settings.json` menciona. */
function rutasEnSettings() {
  return [...new Set(
    [...settings.matchAll(/[\w./$-]*hooks\/[\w./-]+\.js/g)].map((m) => m[0]),
  )];
}

/** De una ruta de `settings.json` a la ruta real en disco. */
function aDisco(ruta) {
  return path.join(CLAUDE, ruta.replace(/^.*?\.claude\//, ''));
}

describe('HUE-025 — que el sistema EJECUTE lo que la suite prueba', () => {
  test('hay hooks y hay settings.json que mirar', () => {
    // Sin esto, un `hooks/` que no se encuentra haría pasar todo lo de abajo
    // por vacuidad — el modo de fallar que este archivo persigue, cometido acá.
    assert.ok(hooksEnDisco().length >= 10, `solo ${hooksEnDisco().length} hooks`);
    assert.ok(rutasEnSettings().length >= 10, 'settings.json no nombra hooks');
  });

  test('todo hook en disco está cableado, o declarado opt-in', () => {
    // La dirección que importa: un hook con sus tests en verde que nadie
    // ejecuta. Es ARCH-26 aplicado al harness en vez de al linter.
    const sueltos = hooksEnDisco()
      .filter((h) => !settings.includes(h))
      .filter((h) => !OPT_IN.includes(h));
    assert.deepEqual(sueltos, [],
      'estos hooks existen, tienen tests, y el sistema no los corre nunca');
  });

  test('todo lo que settings.json nombra existe en disco', () => {
    // La dirección contraria, y falla distinto: un hook renombrado deja una
    // entrada muerta. Claude Code intenta ejecutar un archivo que no está.
    const muertas = rutasEnSettings().filter((r) => !fs.existsSync(aDisco(r)));
    assert.deepEqual(muertas, []);
  });

  test('lo declarado opt-in existe de verdad', () => {
    // Un opt-in que ya no está deja la excusa viva sin nada que excusar. La
    // lista sólo puede achicarse.
    const fantasmas = OPT_IN.filter((h) => !fs.existsSync(path.join(HOOKS, h)));
    assert.deepEqual(fantasmas, []);
  });

  test('y sigue siendo la excepción: como mucho un hook sin cablear', () => {
    // El número es el trinquete. Si mañana hay tres «opt-in», el patrón dejó de
    // ser una decisión y pasó a ser el lugar donde se guarda lo que no corre.
    assert.ok(OPT_IN.length <= 1, `${OPT_IN.length} hooks sin cablear`);
  });
});

describe('HUE-025 — los validadores que se cablean desde un frontmatter', () => {
  // `validate-file-contains.js` no vive en settings.json: lo invocan skills y
  // comandos desde su propio frontmatter (`/plan`, `/spec-new`, `/fix-new`).
  // Ahí el modo de fallar es otro y más callado: un typo en la ruta no rompe
  // nada visible — el comando simplemente deja de tener guardrail.
  const SUPERFICIES = [path.join(CLAUDE, 'commands'), path.join(CLAUDE, 'skills')];

  function referencias() {
    const out = [];
    const walk = (p) => {
      if (!fs.existsSync(p)) return;
      for (const e of fs.readdirSync(p, { withFileTypes: true })) {
        const full = path.join(p, e.name);
        if (e.isDirectory()) walk(full);
        else if (full.endsWith('.md')) {
          const txt = fs.readFileSync(full, 'utf-8');
          for (const m of txt.matchAll(/hooks\/validators\/[\w.-]+\.js/g)) {
            out.push({ desde: path.relative(CLAUDE, full), ruta: m[0] });
          }
        }
      }
    };
    SUPERFICIES.forEach(walk);
    return out;
  }

  const REFS = referencias();

  test('hay validadores cableados desde frontmatter', () => {
    assert.ok(REFS.length >= 3,
      `solo ${REFS.length} referencias; /plan, /spec-new y /fix-new deberían estar`);
  });

  for (const { desde, ruta } of REFS) {
    test(`${desde} apunta a un validador que existe`, () => {
      assert.ok(fs.existsSync(path.join(CLAUDE, ruta)),
        `${ruta} no está en disco: ese comando quedó sin guardrail y nada lo dice`);
    });
  }

  test('el validador referenciado es ejecutable como script', () => {
    // Que el archivo exista no basta: si no parsea, el hook falla en cada Stop.
    const { spawnSync } = require('child_process');
    for (const ruta of [...new Set(REFS.map((r) => r.ruta))]) {
      const r = spawnSync(process.execPath, ['--check', path.join(CLAUDE, ruta)],
        { encoding: 'utf8' });
      assert.equal(r.status, 0, `${ruta} no parsea:\n${r.stderr}`);
    }
  });
});
