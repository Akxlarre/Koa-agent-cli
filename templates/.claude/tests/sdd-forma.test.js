#!/usr/bin/env node
/**
 * sdd-forma.test.js — La forma que el SDD le exige a specs, tareas y backlog
 *
 * Las tres reglas de `lib/sdd-forma.js` —una spec, una historia; tareas por
 * slice; backlog de una línea— las aplican dos piezas: `spec-gate` en cada
 * escritura y `lint:specs` sobre todas las specs. Acá se fija lo que las dos
 * preguntan, incluido lo que NO debe disparar: un chequeo de forma que se
 * equivoca hacia el bloqueo termina apagado.
 *
 * Las plantillas que reparte la skill `sdd` se corren contra el módulo: si la
 * plantilla de `tasks.md` dejara de pasar su propia regla, `/spec-tasks`
 * generaría un archivo que el gate rechaza.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const F = require(path.resolve(__dirname, '..', 'hooks', 'lib', 'sdd-forma.js'));
const PLANTILLAS = path.resolve(__dirname, '..', 'skills', 'sdd', 'templates');
const plantilla = (n) => fs.readFileSync(path.join(PLANTILLAS, n), 'utf-8');

const SLICE_BIEN = `## Slice S1 — me registro con email
- [ ] **S1.1** — Test en rojo
- [ ] **S1.2** — Lo mínimo para ponerlo en verde
- [ ] **S1.V** — Verificación de uso: \`verify\` del flujo
- [ ] **S1.R** — \`/review\` del diff del slice y commit
`;

describe('PLACEHOLDER — que el archivo exista no es que haya contenido', () => {
  test('el placeholder de /spec-new cuenta como vacío', () => {
    assert.equal(F.esPlaceholder('# (vacío — se genera con /spec-XXX cuando corresponda)\n'), true);
    assert.equal(F.esPlaceholder('# (vacio — sin tilde)'), true);
    assert.equal(F.esPlaceholder('   \n'), true);
  });

  test('un plan de verdad no', () => {
    assert.equal(F.esPlaceholder('# Plan\n'), false);
    assert.equal(F.esPlaceholder(plantilla('plan.md')), false);
  });
});

describe('UNA SPEC, UNA HISTORIA', () => {
  test('cuenta las historias reales e ignora los huecos de la plantilla', () => {
    const spec = '- **US1**: Como usuario, quiero registrarme para guardar mis tareas.\n'
      + '- **US2**: Como {{rol}}, quiero {{capacidad}} para {{outcome}}.\n'
      + '- **US3**: …\n';
    assert.deepEqual(F.historias(spec).map((h) => h.id), ['US1']);
  });

  test('con una sola historia la spec está bien', () => {
    assert.deepEqual(F.revisarSpec('- **US1**: Como admin, quiero ver altas para auditar.\n'), []);
  });

  test('con dos, dice cuántas y adónde va la segunda', () => {
    const r = F.revisarSpec('> **Status:** approved\n'
      + '- **US1**: Como visitante, quiero registrarme para tener cuenta.\n'
      + '- **US2**: Como usuario, quiero crear tareas para no olvidarme.\n');
    assert.equal(r.length, 1);
    assert.match(r[0], /2 historias \(US1, US2\)/);
    assert.match(r[0], /\/backlog/);
  });

  test('una spec done o archived no se juzga con la regla nueva', () => {
    const vieja = '- **US1**: Como a, quiero b para c.\n- **US2**: Como d, quiero e para f.\n';
    assert.deepEqual(F.revisarSpec(`> **Status:** done\n${vieja}`), []);
    assert.deepEqual(F.revisarSpec(`> **Status:** archived\n${vieja}`), []);
    assert.equal(F.revisarSpec(`> **Status:** in_progress\n${vieja}`).length, 1);
  });

  test('la plantilla que reparte la skill pasa su propia regla', () => {
    assert.deepEqual(F.revisarSpec(plantilla('spec.md')), []);
    assert.ok(F.historias(plantilla('spec.md')).length === 0, 'la plantilla es solo huecos');
  });

  test('el estado se lee de la cabecera', () => {
    assert.equal(F.estado('> **Status:** draft\n'), 'draft');
    assert.equal(F.estado('# sin cabecera'), null);
  });
});

describe('TAREAS POR SLICE, NO POR CAPA', () => {
  test('un tasks.md por capas se rechaza, y dice qué hacer', () => {
    const porCapas = '## Fase 1 — Datos y modelo\n- [ ] T1.1 migración\n'
      + '## Fase 2 — Capa Facade\n- [ ] T2.1 facade\n## Fase 3 — Capa UI\n- [ ] T3.1 página\n';
    const r = F.revisarTareas(porCapas);
    assert.equal(r.length, 1);
    assert.match(r[0], /cortado por capas/);
    assert.match(r[0], /\/spec-tasks/);
  });

  test('un slice que termina usado y revisado está bien', () => {
    assert.deepEqual(F.revisarTareas(SLICE_BIEN), []);
  });

  test('un slice sin verificación de uso no', () => {
    const r = F.revisarTareas(SLICE_BIEN.replace(/.*Verificación de uso.*\n/, ''));
    assert.equal(r.length, 1);
    assert.match(r[0], /Slice S1 no termina en una verificación de uso/);
  });

  test('un slice sin /review tampoco', () => {
    const r = F.revisarTareas(SLICE_BIEN.replace(/.*\/review.*\n/, ''));
    assert.equal(r.length, 1);
    assert.match(r[0], /Slice S1 no termina en \/review/);
  });

  test('cada slice se mira por separado', () => {
    const dos = `${SLICE_BIEN}\n## Slice S2 — veo el error de email repetido\n- [ ] **S2.1** — Test en rojo\n`;
    const r = F.revisarTareas(dos);
    assert.equal(r.length, 2, r.join('\n'));
    assert.ok(r.every((p) => p.includes('S2')));
  });

  test('el placeholder no se juzga: todavía no hay tareas', () => {
    assert.deepEqual(F.revisarTareas('# (vacío — se genera con /spec-tasks)\n'), []);
  });

  test('la plantilla de tasks.md que reparte la skill pasa su propia regla', () => {
    // Si no pasara, /spec-tasks generaría un archivo que el spec-gate rechaza.
    assert.deepEqual(F.revisarTareas(plantilla('tasks.md')), []);
    assert.ok(F.slices(plantilla('tasks.md')).length >= 2, 'la plantilla muestra más de un slice');
  });
});

describe('EL BACKLOG BARATO', () => {
  const ROADMAP = `# Roadmap

## Historias — backlog sin spec

- [ ] **H-001** · Como visitante, quiero registrarme con email para tener cuenta.
- [x] **H-002** · Como usuario, quiero crear tareas para no olvidarme. → spec 0001
- [ ] **H-003** · Como {{rol}}, quiero {{capacidad}} para {{beneficio}}.

## Activa
`;

  test('lee las historias de su sección, sin la línea de ejemplo', () => {
    const h = F.backlog(ROADMAP);
    assert.deepEqual(h.map((x) => x.id), ['H-001', 'H-002']);
    assert.equal(h[1].hecha, true);
    assert.equal(h[1].spec, '0001');
  });

  test('un backlog bien formado no tiene errores', () => {
    assert.deepEqual(F.revisarBacklog(ROADMAP, ['0001']), { errores: [], avisos: [] });
  });

  test('ids repetidos y forma incompleta son errores', () => {
    const malo = `## Historias\n- [ ] **H-001** · Como a, quiero b para c.\n`
      + `- [ ] **H-001** · Como d, quiero e para f.\n- [ ] **H-002** · Registrarse\n`;
    const { errores } = F.revisarBacklog(malo);
    assert.ok(errores.some((e) => /H-001 está repetida/.test(e)), errores.join('\n'));
    assert.ok(errores.some((e) => /H-002 no tiene la forma/.test(e)), errores.join('\n'));
  });

  test('una historia tomada que apunta a una spec que no está es un error', () => {
    const { errores } = F.revisarBacklog(ROADMAP, ['0002']);
    assert.ok(errores.some((e) => /H-002 .*spec 0001/.test(e)), errores.join('\n'));
  });

  test('querer dos cosas es un aviso, no un error — es una sospecha', () => {
    const doble = '## Historias\n- [ ] **H-001** · Como visitante, quiero registrarme y crear tareas para empezar.\n';
    const r = F.revisarBacklog(doble);
    assert.deepEqual(r.errores, []);
    assert.equal(r.avisos.length, 1);
    assert.match(r.avisos[0], /dos historias/);
  });

  test('un "y" en el beneficio no dispara nada', () => {
    const r = F.revisarBacklog('## Historias\n- [ ] **H-001** · Como admin, quiero exportar para auditar y archivar.\n');
    assert.deepEqual(r, { errores: [], avisos: [] });
  });

  test('sin sección de historias no hay nada que revisar', () => {
    assert.deepEqual(F.backlog('# Roadmap\n## Activa\n'), []);
  });

  test('la plantilla de ROADMAP trae la sección y su ejemplo no cuenta', () => {
    const r = plantilla('ROADMAP.md');
    assert.match(r, /^## Historias/m);
    assert.deepEqual(F.backlog(r), []);
  });
});
