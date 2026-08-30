#!/usr/bin/env node
/**
 * budget.test.js — Contract tests de lib/budget.js
 *
 * CAR-001: plan-injector inyectaba ~24.600 chars en cada Edit sin dedup ni techo.
 * DEC-006: el filtro de 80 chars no filtraba las plantillas de context/.
 * HUE-017: compact-recovery no tenia tope de tamano.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const B = require(path.resolve(__dirname, '..', 'hooks', 'lib', 'budget.js'));

const REPO_CONTEXT = path.resolve(__dirname, '..', '..', 'context');
const cwdOriginal = process.cwd();
let tmp;

function enProyecto(fn) {
  const dir = path.join(tmp, 'p');
  fs.mkdirSync(dir, { recursive: true });
  process.chdir(dir);
  try { return fn(); } finally { process.chdir(cwdOriginal); }
}

beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-budget-test-')); });
afterEach(() => { process.chdir(cwdOriginal); fs.rmSync(tmp, { recursive: true, force: true }); });

const P = { session_id: 'ses-1' };
const SUB = { session_id: 'ses-1', agent_id: 'ag-1' };

describe('CAR-001 — dedup: lo mismo no se dice dos veces', () => {
  test('la primera vez emite, la segunda no', () => {
    enProyecto(() => {
      assert.equal(B.inject(P, 'plan', 'el contrato SDD entero'), 'el contrato SDD entero');
      assert.equal(B.inject(P, 'plan', 'el contrato SDD entero'), null);
      assert.equal(B.inject(P, 'plan', 'el contrato SDD entero'), null);
    });
  });

  test('diez ediciones seguidas emiten UNA vez, no diez', () => {
    enProyecto(() => {
      const emisiones = Array.from({ length: 10 },
        () => B.inject(P, 'plan', 'x'.repeat(24000))).filter(Boolean);
      assert.equal(emisiones.length, 1, 'CAR-001: eran 10 × 24.000 chars');
    });
  });

  test('si el contenido CAMBIA se emite igual — es informacion nueva', () => {
    enProyecto(() => {
      assert.ok(B.inject(P, 'plan', 'spec v1'));
      assert.equal(B.inject(P, 'plan', 'spec v1'), null);
      assert.ok(B.inject(P, 'plan', 'spec v2'), 'la spec cambio: hay que decirlo');
    });
  });

  test('claves distintas no se pisan entre si', () => {
    enProyecto(() => {
      assert.ok(B.inject(P, 'plan', 'contenido'));
      assert.ok(B.inject(P, 'indices', 'contenido'), 'otra clave, otra cuota');
    });
  });

  test('repeatEvery permite insistir cada N', () => {
    enProyecto(() => {
      const r = Array.from({ length: 7 },
        () => B.inject(P, 'k', 'igual', { repeatEvery: 3 }));
      assert.deepEqual(r.map(Boolean), [true, false, false, true, false, false, true]);
    });
  });
});

describe('HUE-032 — la dedup es del hilo, no de la sesion', () => {
  test('lo que consumio el subagente NO calla al hilo principal', () => {
    enProyecto(() => {
      assert.ok(B.inject(SUB, 'aviso', 'la regla de arquitectura'));
      assert.ok(
        B.inject(P, 'aviso', 'la regla de arquitectura'),
        'el hilo principal nunca vio ese aviso',
      );
    });
  });

  test('dos subagentes distintos no se pisan', () => {
    enProyecto(() => {
      const otro = { session_id: 'ses-1', agent_id: 'ag-2' };
      assert.ok(B.inject(SUB, 'aviso', 'x'));
      assert.ok(B.inject(otro, 'aviso', 'x'));
    });
  });

  test('con scope "sesion" SI se comparte, cuando se pide a proposito', () => {
    enProyecto(() => {
      assert.ok(B.inject(P, 'k', 'x', { scope: 'sesion' }));
      assert.equal(B.inject(SUB, 'k', 'x', { scope: 'sesion' }), null);
    });
  });
});

describe('HUE-017 — techo de tamano', () => {
  test('recorta al techo y lo dice', () => {
    enProyecto(() => {
      const out = B.inject(P, 'k', 'y'.repeat(5000), { maxChars: 100 });
      assert.ok(out.length < 200, `esperaba ~100 chars, dio ${out.length}`);
      assert.match(out, /recortado/);
    });
  });

  test('sin techo no recorta', () => {
    enProyecto(() => {
      assert.equal(B.inject(P, 'k', 'y'.repeat(5000)).length, 5000);
    });
  });

  test('corta en DETAIL:BEGIN, como ya hacen los indices', () => {
    enProyecto(() => {
      const doc = `## Quick Reference\ntabla\n${B.DETAIL_MARKER}\n## Ejemplos\n${'z'.repeat(9000)}`;
      const out = B.inject(P, 'k', doc);
      assert.ok(!out.includes('Ejemplos'));
      assert.ok(out.includes('Quick Reference'));
    });
  });
});

describe('DEC-006 — las plantillas de context/ no valen un token', () => {
  const plantillas = ['brief', 'domain', 'constraints', 'learnings'];

  for (const nombre of plantillas) {
    test(`la plantilla real de context/${nombre}.md se detecta como vacia`, () => {
      const p = path.join(REPO_CONTEXT, `${nombre}.md`);
      if (!fs.existsSync(p)) return; // el repo puede no traerla
      const raw = fs.readFileSync(p, 'utf-8');
      assert.equal(
        B.isPlaceholder(raw), true,
        `hoy pasa el umbral de 80 porque el andamiaje markdown ya suma mas de 80`,
      );
    });
  }

  test('un brief realmente llenado NO se descarta', () => {
    const lleno = '# Brief\n\n> instruccion de la plantilla\n\n## Objetivo\n\n' +
      'Construir el modulo de reportes con filtros por fecha y export a CSV ' +
      'para el equipo de finanzas.\n';
    assert.equal(B.isPlaceholder(lleno), false);
  });

  test('skipPlaceholder impide la inyeccion', () => {
    enProyecto(() => {
      const plantilla = '# Brief\n\n<!-- instrucciones -->\n\n## Objetivo\n\n> completa esto\n';
      assert.equal(B.inject(P, 'brief', plantilla, { skipPlaceholder: true }), null);
    });
  });

  test('el andamiaje no cuenta: encabezados, blockquotes, bullets y tablas vacias', () => {
    assert.equal(B.contenidoReal('## Titulo\n> nota\n- \n| a | b |\n'), '');
  });
});

describe('ENTRADAS DEGENERADAS', () => {
  for (const [nombre, valor] of [['vacio', ''], ['null', null], ['undefined', undefined],
    ['solo espacios', '   \n\t ']]) {
    test(`${nombre} → null, sin lanzar`, () => {
      enProyecto(() => assert.equal(B.inject(P, 'k', valor), null));
    });
  }

  test('un payload sin session_id igual funciona (cae al id del proyecto)', () => {
    enProyecto(() => assert.ok(B.inject({}, 'k', 'contenido')));
  });

  test('yaEmitido no tiene efectos secundarios', () => {
    enProyecto(() => {
      assert.equal(B.yaEmitido(P, 'k'), false);
      assert.equal(B.yaEmitido(P, 'k'), false);
      B.inject(P, 'k', 'algo');
      assert.equal(B.yaEmitido(P, 'k'), true);
    });
  });
});
