#!/usr/bin/env node
/**
 * indices.test.js — Micro-suite de lib/indices.js (HUE-014)
 *
 * `spec-diff-check` bloquea el commit cuando un componente o una facade nuevos
 * no figuran en su índice. Preguntaba con `String.includes` sobre el archivo
 * entero, así que casi nunca podía bloquear nada.
 *
 * Medido contra el `COMPONENTS.md` real del blueprint, con seis componentes
 * inventados que no existen en ningún lado: **los seis pasaban como
 * registrados**. `card` matchea dentro de `app-kpi-card`, `tabla` aparece en la
 * prosa del encabezado, y `x` es una sola letra.
 *
 * Los dos errores no cuestan lo mismo y el módulo está calibrado para eso:
 * dejar pasar un componente sin registrar desactualiza un índice; frenar un
 * commit por un componente que SÍ está registrado rompe el trabajo de alguien.
 * Por eso se aceptan las tres formas en que un índice escribe un identificador.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const I = require(path.resolve(__dirname, '..', 'hooks', 'lib', 'indices.js'));
const TEMPLATES = path.resolve(__dirname, '..', '..');

const TABLA = [
  '# Registro de Componentes',
  '',
  '> Antes de crear un componente, verifica en esta tabla si ya existe.',
  '',
  '| Componente | Descripción | Estado |',
  '|---|---|---|',
  '| `app-kpi-card` | KPI numérico | ✅ |',
  '| `skeleton-block` | Placeholder de carga | ✅ |',
  '| `<app-drawer>` | Panel lateral | ✅ |',
  '',
  '### app-kpi-card',
  '```html',
  '<app-kpi-card [value]="0" />',
  '```',
].join('\n');

describe('QUÉ CUENTA COMO DECLARADO', () => {
  test('solo las filas de tabla, no la prosa ni los ejemplos', () => {
    assert.deepEqual([...I.declarados(TABLA)].sort(),
      ['app-drawer', 'app-kpi-card', 'skeleton-block']);
  });

  test('el encabezado de la tabla no es un artefacto', () => {
    assert.ok(!I.declarados(TABLA).has('Componente'));
  });

  test('las tres formas de escribir un identificador valen', () => {
    // Backticks, backticks con <>, y pelado. El índice real del blueprint usa
    // dos de las tres en la misma tabla.
    for (const forma of ['app-kpi-card', 'kpi-card', '`app-kpi-card`', '<app-kpi-card>']) {
      assert.equal(I.registrado(TABLA, forma), true, forma);
    }
  });
});

describe('HUE-014 — lo que el substring dejaba pasar', () => {
  // Cada uno de estos matchea DENTRO de un nombre real, o en la prosa.
  const INVENTADOS = ['card', 'block', 'skeleton', 'kpi', 'tabla', 'x'];

  for (const nombre of INVENTADOS) {
    test(`"${nombre}" no está registrado`, () => {
      assert.equal(I.registrado(TABLA, `app-${nombre}`, nombre), false);
    });
  }

  test('y con includes() pasaban TODOS', () => {
    // La comprobación inversa: sin esto, los tests de arriba podrían estar
    // pasando porque el fixture no reproduce el bug.
    const conBug = INVENTADOS.filter((n) => TABLA.includes(`app-${n}`) || TABLA.includes(n));
    assert.equal(conBug.length, INVENTADOS.length,
      `el fixture ya no reproduce el bug: solo ${conBug.length} de ${INVENTADOS.length}`);
  });
});

describe('EL FALSO POSITIVO ES EL ERROR CARO', () => {
  // Este hook BLOQUEA un commit. Frenar por un componente que sí está
  // registrado es peor que dejar pasar uno que no lo está: lo primero rompe el
  // trabajo de alguien, lo segundo desactualiza un índice.
  test('los componentes reales del blueprint se reconocen todos', () => {
    const idx = fs.readFileSync(path.join(TEMPLATES, 'indices', 'COMPONENTS.md'), 'utf-8');
    const reales = ['kpi-card', 'skeleton-block', 'icon', 'alert-card', 'drawer', 'empty-state'];
    const noReconocidos = reales.filter((c) => !I.registrado(idx, `app-${c}`, c));
    assert.deepEqual(noReconocidos, []);
  });

  test('mayúsculas y espacios no cambian la respuesta', () => {
    // El orden dentro de `normalizar` importa: si se quita el prefijo antes de
    // bajar a minúsculas, un `APP-Kpi-Card` conserva su `APP-` y deja de
    // coincidir. Este test lo encontró.
    assert.equal(I.registrado(TABLA, '  APP-KPI-CARD  '), true);
    assert.equal(I.registrado(TABLA, 'Skeleton-Block'), true);
  });
});

describe('BORDES', () => {
  test('un índice vacío no declara nada, y no revienta', () => {
    assert.deepEqual([...I.declarados('')], []);
    assert.equal(I.registrado('', 'algo'), false);
    assert.equal(I.registrado(undefined, 'algo'), false);
  });

  test('un nombre vacío nunca cuenta como registrado', () => {
    assert.equal(I.registrado(TABLA, ''), false);
    assert.equal(I.registrado(TABLA, null, undefined), false);
  });

  test('una celda que no es un identificador no declara nada', () => {
    // `COMPONENTS.md` trae una tabla de rutas («`/app/dashboard` —
    // `DashboardComponent`») y filas con un guión de placeholder. Ninguna
    // declara un artefacto.
    const raro = '| Ruta | Componente |\n|---|---|\n| `/app/x` — `XComponent` | x |\n| — | — |\n';
    assert.deepEqual([...I.declarados(raro)], []);
  });
});
