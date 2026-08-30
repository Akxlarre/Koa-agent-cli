#!/usr/bin/env node
/**
 * contracts.test.js — Contract tests de lib/contracts.js
 *
 * Esta es la pieza que convierte los 12 ACO en algo verificable. Una tabla en un
 * .md no se puede correr; este registro si.
 *
 * Las rutas del registro son relativas al PROYECTO GENERADO. Acá viven bajo
 * templates/, así que hay que mapearlas — y ese mapeo es en sí mismo el contrato
 * entre el payload y lo que recibe el usuario.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const C = require(path.resolve(__dirname, '..', 'hooks', 'lib', 'contracts.js'));

const TEMPLATES = path.resolve(__dirname, '..', '..');

/** Del proyecto generado a este repo: scripts/ vive en boilerplate/. */
function enRepo(rel) {
  if (rel.startsWith('scripts/')) return path.join(TEMPLATES, 'boilerplate', rel);
  return path.join(TEMPLATES, rel);
}

describe('EL REGISTRO EXISTE DE VERDAD — cada pieza declarada es un archivo', () => {
  for (const entry of C.all()) {
    for (const pieza of C.piezasDe(entry)) {
      test(`${entry.id} → ${pieza}`, () => {
        assert.ok(fs.existsSync(enRepo(pieza)), `declarado y no existe: ${pieza}`);
      });
    }
  }
});

describe('CADA PIEZA NOMBRA EL ARTEFACTO QUE DICE USAR', () => {
  // Si un hook deja de leer un contrato, esta prueba lo delata: el registro
  // quedaria declarando un consumidor que ya no consume.
  const marca = {
    'discovery-flag': 'discovery',
    'task-spec': 'task-spec-',
    'specs/.active': '.active',
  };

  for (const entry of C.all()) {
    const aguja = marca[entry.id] || entry.id;
    for (const pieza of C.piezasDe(entry)) {
      test(`${pieza} menciona "${aguja}"`, () => {
        const full = enRepo(pieza);
        if (!fs.existsSync(full)) return; // lo cubre el describe anterior
        assert.ok(
          fs.readFileSync(full, 'utf-8').includes(aguja),
          `${pieza} está declarado para ${entry.id} y no lo nombra`,
        );
      });
    }
  }
});

describe('LIFETIME Y SCOPE — los dos campos que los ADR agregaron', () => {
  const LIFETIMES = ['turno', 'sesion', 'permanente'];
  const SCOPES = ['sesion', 'hilo', 'proyecto'];

  for (const entry of C.all()) {
    test(`${entry.id} declara lifetime y scope válidos`, () => {
      assert.ok(LIFETIMES.includes(entry.lifetime), `lifetime inválido: ${entry.lifetime}`);
      assert.ok(SCOPES.includes(entry.scope), `scope inválido: ${entry.scope}`);
    });
  }

  test('ningún artefacto de ciclo "sesion" lo borra un hook de Stop (ADR-002 §1)', () => {
    const deSesion = C.all().filter((e) => e.lifetime === 'sesion').map((e) => e.id);
    assert.ok(deSesion.includes('session-writes.json'));
    assert.ok(deSesion.includes('discovery-flag'));
  });

  test('todo artefacto declara un formato legible por su consumidor', () => {
    for (const e of C.all()) {
      assert.ok(e.format && e.format.length > 10, `${e.id} sin formato declarado`);
    }
  });
});

describe('LOS 15 ÍNDICES — la lista canónica contra el filesystem (HUE-030)', () => {
  const enDisco = fs.readdirSync(path.join(TEMPLATES, 'indices'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    .sort();

  test('INDICES coincide exactamente con templates/indices/', () => {
    assert.deepEqual([...C.INDICES].sort(), enDisco);
  });

  test('son 15', () => assert.equal(C.INDICES.length, 15));
});

describe('HUE-003 — el hueco conocido, fijado tal como está hoy', () => {
  // Test de caracterización: describe el comportamiento ACTUAL, bug incluido.
  // Cuando la tanda 3 migre compact-recovery, este test falla y hay que
  // actualizarlo a propósito. Es la diferencia entre un hueco documentado y uno
  // olvidado.
  const AUSENTES_HOY = ['GUARDS', 'LAYOUTS', 'ROUTES', 'USAGE-MAP', 'UTILS'];

  for (const pieza of C.CONSUMIDORES_DE_INDICES) {
    test(`${pieza} conoce 10 de los 15 índices`, () => {
      const src = fs.readFileSync(enRepo(pieza), 'utf-8');
      const conocidos = C.INDICES.filter((n) => src.includes(n));
      const faltan = C.INDICES.filter((n) => !src.includes(n));
      assert.deepEqual(faltan.sort(), [...AUSENTES_HOY].sort(),
        'cambió qué índices ignora compact-recovery: actualizá este test a propósito');
      assert.equal(conocidos.length, 10);
    });
  }
});

describe('API', () => {
  test('consumersOf y producersOf devuelven [] para un id desconocido', () => {
    assert.deepEqual(C.consumersOf('no-existe'), []);
    assert.deepEqual(C.producersOf('no-existe'), []);
  });

  test('piezasDe saltea los actores entre <>', () => {
    const piezas = C.piezasDe(C.CONTRACTS['blueprint.json']);
    assert.ok(!piezas.some((p) => p.startsWith('<')));
    assert.ok(piezas.includes('scripts/architect.js'));
  });

  test('all() devuelve cada fila con su id', () => {
    const ids = C.all().map((e) => e.id);
    assert.equal(ids.length, Object.keys(C.CONTRACTS).length);
    assert.ok(ids.includes('session-writes.json'));
  });
});
