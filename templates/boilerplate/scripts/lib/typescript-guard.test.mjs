/**
 * typescript-guard.test.mjs — HUE-018
 *
 * `architect.js` e `indices-sync.js` pedían el compilador con un `require`
 * pelado. Falla de dos formas distintas y las dos se ven igual de mal:
 *
 *   sin el paquete   veinte líneas de stack de `node:internal/modules/cjs/loader`
 *   TypeScript 7     un `TypeError: Cannot read properties of undefined` en
 *                    medio del recorrido del AST, apuntando a una línea del
 *                    linter que no tiene nada que ver con la causa
 *
 * Los dos aparecieron auditando este repo, no en teoría.
 *
 * Un guardrail que muere con un stack trace no es más estricto que uno que no
 * existe: es más caro, porque manda a depurar el lugar equivocado.
 *
 * Los dos escenarios se montan de verdad —un proyecto sin `node_modules` y otro
 * con un `typescript` falso que carga y no expone la API—, porque probar el
 * mensaje sin provocar el fallo sería exactamente el error que este repo audita.
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.resolve(AQUI, '..');

const creados = [];

/**
 * Un proyecto de juguete FUERA del árbol del repo.
 *
 * `os.tmpdir()` importa: si el sandbox viviera bajo un directorio con
 * `node_modules` en algún ancestro, Node resolvería `typescript` desde ahí y el
 * escenario «no está instalado» no se podría montar. Es el falso verde que este
 * archivo existe para evitar, y costó una corrida descubrirlo.
 */
function sandbox({ typescriptFalso = null } = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-tsguard-'));
  creados.push(raiz);
  fs.mkdirSync(path.join(raiz, 'src', 'app'), { recursive: true });
  fs.cpSync(SCRIPTS, path.join(raiz, 'scripts'), { recursive: true });

  if (typescriptFalso) {
    const mod = path.join(raiz, 'node_modules', 'typescript');
    fs.mkdirSync(mod, { recursive: true });
    fs.writeFileSync(path.join(mod, 'package.json'),
      JSON.stringify({ name: 'typescript', version: '7.0.0', main: 'index.js' }));
    fs.writeFileSync(path.join(mod, 'index.js'), typescriptFalso);
  }
  return raiz;
}

function correr(raiz, script) {
  const r = spawnSync(process.execPath, [path.join('scripts', script)],
    { cwd: raiz, encoding: 'utf8', timeout: 60_000 });
  return { exit: r.status, salida: `${r.stdout || ''}${r.stderr || ''}` };
}

after(() => {
  while (creados.length) {
    try { fs.rmSync(creados.pop(), { recursive: true, force: true }); } catch { /* */ }
  }
});

describe('HUE-018 — sin el paquete typescript', () => {
  const raiz = sandbox();

  for (const script of ['architect.js', 'indices-sync.js']) {
    test(`${script} dice qué falta y qué hacer`, () => {
      const { exit, salida } = correr(raiz, script);
      assert.equal(exit, 1, 'no puede salir en 0: el chequeo no corrió');
      assert.match(salida, /typescript` y no está instalado/);
      assert.match(salida, /npm install/, 'un error sin salida es un muro');
    });

    test(`${script} no vomita un stack de Node`, () => {
      // El síntoma exacto del bug: `Cannot find module` y veinte líneas de
      // `node:internal/modules/cjs/loader`.
      const { salida } = correr(raiz, script);
      assert.ok(!salida.includes('node:internal/modules'), salida.slice(0, 400));
      assert.ok(!salida.includes('Cannot find module'), salida.slice(0, 400));
    });
  }

  test('sale en 1, no en 2 — «no se pudo correr» ≠ «el código está mal»', () => {
    // Confundirlos haría que un `lint:arch` sin TypeScript se leyera como una
    // violación de regla, y mandaría a arreglar código que está bien.
    assert.equal(correr(raiz, 'architect.js').exit, 1);
  });
});

describe('HUE-018 — con un TypeScript que ya no expone la API', () => {
  const raiz = sandbox({
    typescriptFalso:
      "module.exports = { version: '7.0.0', createSourceFile: () => {}, forEachChild: () => {} };\n",
  });

  test('lo detecta al cargar, no a mitad del AST', () => {
    const { exit, salida } = correr(raiz, 'architect.js');
    assert.equal(exit, 1);
    assert.match(salida, /no expone/);
    assert.match(salida, /ScriptTarget/, 'tiene que nombrar QUÉ falta');
    assert.match(salida, /7\.0\.0/, 'y con qué versión pasó');
  });

  test('no revienta con un TypeError sin contexto', () => {
    const { salida } = correr(raiz, 'architect.js');
    assert.ok(!salida.includes('TypeError'), salida.slice(0, 400));
  });
});
