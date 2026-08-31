import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { archivosDe, auditarProvocacion, disparo, FIXTURES } from './provocacion.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

describe('disparo', () => {
  test('reconoce la regla en la salida del linter', () => {
    assert.equal(disparo('🚨 [ARCH-04] OnPush required: Componente sin…', 'ARCH-04'), true);
  });

  test('NO se conforma con el ID suelto', () => {
    // Al final de una corrida fallida, el linter imprime la lista de TODAS las
    // reglas validadas: "ARCH-04 — OnPush required — docs/…". Buscar el ID
    // pelado daría positivo para las 25 reglas, siempre. Es el falso verde que
    // este archivo existe para evitar, y casi se comete al escribirlo.
    const listaFinal = '📋 Reglas validadas:\n   ARCH-04 — OnPush required — docs/TECH-STACK-RULES.md';
    assert.equal(disparo(listaFinal, 'ARCH-04'), false);
  });
});

describe('auditarProvocacion', () => {
  const base = { registradas: ['ARCH-01', 'ARCH-02', 'ARCH-03'], conFixture: ['ARCH-01'] };

  test('lo que está en el baseline no falla: es deuda declarada', () => {
    const r = auditarProvocacion({ ...base, baseline: ['ARCH-02', 'ARCH-03'] });
    assert.deepEqual(r.sinFixture, ['ARCH-02', 'ARCH-03']);
    assert.deepEqual(r.nuevasSinFixture, []);
  });

  test('una regla nueva sin fixture SÍ falla', () => {
    // El momento de escribir el fixture es cuando se escribe la regla. Después
    // es cuando aparece ARCH-26: detector escrito, tests en verde, sin cablear.
    const r = auditarProvocacion({ ...base, baseline: ['ARCH-02'] });
    assert.deepEqual(r.nuevasSinFixture, ['ARCH-03']);
  });

  test('el baseline que ya no corresponde es un error, no un detalle', () => {
    // Un trinquete que no se achica es una lista de excusas. Si ARCH-01 ya tiene
    // fixture y sigue en el baseline, el número de "deuda" miente hacia arriba.
    const r = auditarProvocacion({ ...base, baseline: ['ARCH-01', 'ARCH-02', 'ARCH-03'] });
    assert.deepEqual(r.baselineObsoleto, ['ARCH-01']);
  });

  test('una regla borrada del linter también deja el baseline obsoleto', () => {
    const r = auditarProvocacion({ ...base, baseline: ['ARCH-02', 'ARCH-03', 'ARCH-99'] });
    assert.deepEqual(r.baselineObsoleto, ['ARCH-99']);
  });
});

describe('archivosDe', () => {
  test('normaliza la forma corta', () => {
    assert.deepEqual(archivosDe({ ruta: 'a.ts', contenido: 'x' }), [{ ruta: 'a.ts', contenido: 'x' }]);
  });

  test('y devuelve la forma larga tal cual', () => {
    const largos = [{ ruta: 'a.css', contenido: '1' }, { ruta: 'b.html', contenido: '2' }];
    assert.deepEqual(archivosDe({ archivos: largos }), largos);
  });

  test('un fixture vacío no rompe: devuelve []', () => {
    assert.deepEqual(archivosDe({}), []);
    assert.deepEqual(archivosDe(undefined), []);
  });
});

describe('FIXTURES', () => {
  test('cada fixture declara al menos un archivo con contenido', () => {
    for (const [ruleId, f] of Object.entries(FIXTURES)) {
      const archivos = archivosDe(f);
      assert.ok(archivos.length > 0, `${ruleId} sin archivos`);
      for (const a of archivos) {
        assert.ok(a.ruta, `${ruleId} con un archivo sin ruta`);
        assert.ok(a.contenido && a.contenido.trim().length > 0, `${ruleId}: ${a.ruta} vacío`);
      }
    }
  });

  test('ningún fixture arrastra ARCH-04 de rebote', () => {
    // Un fixture que viola tres reglas no permite saber cuál disparó, y el día
    // que una se rompa las otras dos la tapan.
    for (const [ruleId, f] of Object.entries(FIXTURES)) {
      if (ruleId === 'ARCH-04') continue;
      for (const { ruta, contenido } of archivosDe(f)) {
        if (!ruta.endsWith('.component.ts')) continue;
        assert.match(contenido, /ChangeDetectionStrategy\.OnPush/,
          `${ruleId} dispararía ARCH-04 de rebote`);
      }
    }
  });

  test('lo que tiene fixture no sigue contado como deuda en el baseline', () => {
    // El baseline es un trinquete: cada fixture que se escribe tiene que salir
    // de la lista. Uno que no se achica es una lista de excusas.
    const baseline = JSON.parse(
      fs.readFileSync(path.join(AQUI, '..', 'provocacion.baseline.json'), 'utf8')).sinFixture;
    const duplicadas = Object.keys(FIXTURES).filter((r) => baseline.includes(r));
    assert.deepEqual(duplicadas, []);
  });

  test('las once que desbloquean el recorte de visual-system.md tienen fixture', () => {
    // ADR-005 §1: cambiar la prosa de estas once por el mensaje de error del
    // linter solo es honesto una vez que la detección está probada.
    const once = ['ARCH-11', 'ARCH-15', 'ARCH-16', 'ARCH-17', 'ARCH-18',
      'ARCH-19', 'ARCH-22', 'ARCH-23', 'ARCH-24', 'ARCH-25', 'ARCH-26'];
    const faltan = once.filter((r) => !(r in FIXTURES));
    assert.deepEqual(faltan, []);
  });

  test('y las tres de seguridad tambien', () => {
    for (const r of ['SEC-RLS-01', 'SEC-RLS-02', 'SEC-RLS-03']) {
      assert.ok(r in FIXTURES, `${r} sin fixture: su silencio es lectura publica`);
    }
  });
});
