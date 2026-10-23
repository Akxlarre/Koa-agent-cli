/**
 * `npm run lint:specs` corrido de verdad, contra proyectos de juguete.
 *
 * Los módulos que usa tienen sus propios tests (`spec-links.test.mjs` acá y
 * `sdd-forma.test.js` en el harness). Lo que ninguno prueba es lo que los ata:
 * que el script encuentre `sdd-forma.js` en los dos layouts, que una spec mal
 * formada lo haga salir en 1, y que lo que es una sospecha —una historia que
 * quiere dos cosas— avise sin romper.
 */
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'verificar-specs.mjs');
const creados = [];

function proyecto(archivos) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-lintspecs-'));
  creados.push(raiz);
  for (const [rel, contenido] of Object.entries(archivos)) {
    const full = path.join(raiz, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contenido);
  }
  return raiz;
}

function correr(raiz) {
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: raiz, encoding: 'utf8' });
  return { exit: r.status, salida: `${r.stdout || ''}${r.stderr || ''}` };
}

after(() => {
  while (creados.length) {
    try { fs.rmSync(creados.pop(), { recursive: true, force: true }); } catch { /* */ }
  }
});

const UNA = '> **Status:** approved\n- **US1**: Como visitante, quiero registrarme para tener cuenta.\n';
const DOS = `${UNA}- **US2**: Como usuario, quiero crear tareas para no olvidarme.\n`;
const SLICE = '## Slice S1 — me registro\n- [ ] S1.1 test en rojo\n'
  + '- [ ] S1.V Verificación de uso: `verify`\n- [ ] S1.R `/review` del slice\n';

describe('lint:specs — la forma del SDD', () => {
  test('sin specs/ no hay nada que verificar', () => {
    assert.equal(correr(proyecto({ 'README.md': '#' })).exit, 0);
  });

  test('una spec con una historia y tareas por slice pasa', () => {
    const r = correr(proyecto({
      'specs/specs/0001-registro/spec.md': UNA,
      'specs/specs/0001-registro/tasks.md': SLICE,
    }));
    assert.equal(r.exit, 0, r.salida);
    assert.match(r.salida, /Forma del SDD/);
  });

  test('una spec con dos historias falla, y la nombra', () => {
    const r = correr(proyecto({ 'specs/specs/0001-registro/spec.md': DOS }));
    assert.equal(r.exit, 1, r.salida);
    assert.match(r.salida, /0001-registro\/spec\.md tiene 2 historias/);
  });

  test('unas tareas por capas fallan', () => {
    const r = correr(proyecto({
      'specs/specs/0001-registro/spec.md': UNA,
      'specs/specs/0001-registro/tasks.md': '## Fase 1 — Datos y modelo\n- [ ] T1.1\n',
    }));
    assert.equal(r.exit, 1, r.salida);
    assert.match(r.salida, /cortado por capas/);
  });

  test('una spec done con la forma vieja no se juzga', () => {
    const r = correr(proyecto({
      'specs/specs/0001-registro/spec.md': DOS.replace('approved', 'done'),
      'specs/specs/0001-registro/tasks.md': '## Fase 1 — Datos y modelo\n- [x] T1.1\n',
    }));
    assert.equal(r.exit, 0, r.salida);
  });
});

describe('lint:specs — el backlog barato', () => {
  test('una historia repetida falla', () => {
    const r = correr(proyecto({
      'specs/specs/0001-registro/spec.md': UNA,
      'specs/ROADMAP.md': '## Historias\n- [ ] **H-001** · Como a, quiero b para c.\n'
        + '- [ ] **H-001** · Como d, quiero e para f.\n',
    }));
    assert.equal(r.exit, 1, r.salida);
    assert.match(r.salida, /H-001 está repetida/);
  });

  test('una historia que quiere dos cosas avisa sin romper', () => {
    const r = correr(proyecto({
      'specs/specs/0001-registro/spec.md': UNA,
      'specs/ROADMAP.md': '## Historias\n'
        + '- [ ] **H-001** · Como visitante, quiero registrarme y crear tareas para empezar.\n',
    }));
    assert.equal(r.exit, 0, r.salida);
    assert.match(r.salida, /H-001 quiere dos cosas/);
  });
});
