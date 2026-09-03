/**
 * lint-arch-wrapper.test.mjs — La memoria de fallos del linter
 *
 * `docs/auditoria/PASE-GENERAL.md` cerró declarando tres «deudas del método»:
 * verificaciones hechas por lectura y no por ejecución. Dos se pagaron —las
 * capas 2 y 3 de `bash-guard`, y `hotfix-autoclose`—, y ésta no: el camino de
 * fallo de `lint-arch-wrapper` seguía sin ejecutarse nunca. Se lo mencionaba
 * como contexto en `failure-tracker.test.js` y en `smoke-scripts.test.mjs`,
 * que es distinto de correrlo.
 *
 * Importa porque el wrapper es lo que `npm run lint:arch` invoca de verdad
 * —`architect.js` se corre a través de él, no directo— y porque es el segundo
 * productor de `LESSONS_LEARNED.md`, un archivo cuyo otro productor
 * (`failure-tracker`) REESCRIBE una región entera en cada corrida.
 *
 * Los dos viven en árboles distintos y no pueden importarse entre sí: el hook
 * es CommonJS bajo `.claude/hooks/`, el wrapper es ESM bajo `scripts/`. Que
 * convivan no lo garantiza ningún import compartido — lo garantiza que el
 * wrapper escriba FUERA de los marcadores, y eso nadie lo estaba comprobando.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WRAPPER = path.join(AQUI, '..', 'lint-arch-wrapper.js');

let proyecto;

/**
 * Un proyecto con un `architect.js` de mentira cuyo exit code se controla.
 *
 * El linter real necesita `typescript` y un árbol Angular entero; acá lo que se
 * prueba es el wrapper, y un doble hace la ruta de fallo reproducible en vez de
 * depender de conseguir que el linter falle de verdad.
 */
function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-law-'));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, '.claude', 'temp'), { recursive: true });
  fs.copyFileSync(WRAPPER, path.join(root, 'scripts', 'lint-arch-wrapper.js'));
  fs.writeFileSync(path.join(root, 'scripts', 'package.json'), '{"type":"module"}\n');
  fs.writeFileSync(path.join(root, 'scripts', 'architect.js'),
    '#!/usr/bin/env node\n'
    + 'console.log("VIOLACION [ARCH-04] " + process.argv.slice(2).join(" "));\n'
    + 'process.exit(Number(process.env.FAKE_EXIT || 0));\n');
  return root;
}

function correr(exitDelLinter, args = []) {
  const r = spawnSync(process.execPath,
    [path.join(proyecto, 'scripts', 'lint-arch-wrapper.js'), ...args],
    { cwd: proyecto, encoding: 'utf8', env: { ...process.env, FAKE_EXIT: String(exitDelLinter) } });
  return { exit: r.status, salida: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

const rutaFallo = () => path.join(proyecto, '.claude', 'temp', 'arch-last-failure.json');
const rutaLecciones = () => path.join(proyecto, '.claude', 'temp', 'LESSONS_LEARNED.md');

beforeEach(() => { proyecto = sandbox(); });
afterEach(() => { fs.rmSync(proyecto, { recursive: true, force: true }); });

describe('El camino de fallo, ejecutado', () => {
  test('cuando el linter falla, guarda la memoria y propaga el exit 1', () => {
    const r = correr(1);
    assert.equal(r.exit, 1, 'un wrapper que se come el exit code convierte el lint en decorativo');
    assert.ok(fs.existsSync(rutaFallo()));
    const guardado = JSON.parse(fs.readFileSync(rutaFallo(), 'utf-8'));
    assert.match(guardado.summary, /ARCH-04/, 'el resumen tiene que traer lo que falló');
    assert.equal(guardado.exitCode, 1);
  });

  test('y reimprime la salida del linter: el usuario ve el error, no el wrapper', () => {
    assert.match(correr(1).salida, /VIOLACION \[ARCH-04\]/);
  });

  test('cuando vuelve a pasar, convierte el fallo en lección y limpia', () => {
    correr(1);
    const r = correr(0);
    assert.equal(r.exit, 0);
    assert.ok(!fs.existsSync(rutaFallo()), 'la memoria del fallo tiene que consumirse');
    assert.match(fs.readFileSync(rutaLecciones(), 'utf-8'), /Recuperación tras fallo ARCH/);
  });

  test('si pasa sin fallo previo, no inventa una lección', () => {
    correr(0);
    assert.ok(!fs.existsSync(rutaLecciones()),
      'una lección sin fallo que la origine es ruido en un archivo que se lee');
  });

  test('memoria corrupta: falla abierto y no bloquea el lint', () => {
    // Un JSON roto no puede ser motivo para que `npm run lint:arch` deje de
    // correr. Lo que sí tiene que hacer es sacarse la basura de encima.
    fs.writeFileSync(rutaFallo(), 'esto no es json');
    const r = correr(0);
    assert.equal(r.exit, 0);
    assert.ok(!fs.existsSync(rutaFallo()));
  });

  test('sin architect.js sale 1 diciendo qué falta', () => {
    // No es lo mismo «el proyecto viola una regla» que «no encontré el linter».
    fs.rmSync(path.join(proyecto, 'scripts', 'architect.js'));
    const r = correr(0);
    assert.equal(r.exit, 1);
    assert.match(r.salida, /architect\.js/);
  });

  test('reenvía los flags al linter', () => {
    // Sin esto, `npm run lint:arch -- --update-ds-baseline` corría el linter sin
    // la bandera y no pasaba nada — y ese es el comando que el propio linter
    // imprime como la forma de fijar una mejora del ratchet.
    assert.match(correr(1, ['--update-ds-baseline']).salida, /--update-ds-baseline/);
  });
});

describe('Los dos productores de LESSONS_LEARNED.md conviven', () => {
  // `failure-tracker` (CommonJS, en .claude/hooks/) mantiene una TABLA entre
  // marcadores `AUTO-GENERATED` y la reescribe entera en cada corrida. El
  // wrapper (ESM, en scripts/) appendea PROSA al mismo archivo. Viven en
  // árboles distintos y no pueden importarse entre sí, así que nada en el
  // código los ata: lo único que los hace compatibles es que la prosa quede
  // fuera de la región, y eso no lo comprobaba nadie.
  // `lessons.js` está a distinta profundidad según el layout, y este archivo
  // viaja a los dos: en este repo el test vive en
  // `templates/boilerplate/scripts/lib/` y el hook en `templates/.claude/`;
  // en un proyecto generado son `scripts/lib/` y `.claude/`, un nivel menos.
  // Resolver contra uno solo es INC-024 otra vez — un test que sólo pasa donde
  // se escribió.
  const require = createRequire(import.meta.url);
  const CANDIDATOS = [
    path.join(AQUI, '..', '..', '.claude', 'hooks', 'lib', 'lessons.js'),
    path.join(AQUI, '..', '..', '..', '.claude', 'hooks', 'lib', 'lessons.js'),
  ];
  const RUTA_LESSONS = CANDIDATOS.find((p) => fs.existsSync(p));

  test('se encuentra el otro productor: sin eso no hay nada que comprobar', () => {
    // Y se falla en vez de saltear: «no lo encontré» y «conviven bien» no
    // pueden dar el mismo verde.
    assert.ok(RUTA_LESSONS, `lessons.js no está en ninguno de:\n  ${CANDIDATOS.join('\n  ')}`);
  });

  const lessons = RUTA_LESSONS ? require(RUTA_LESSONS) : null;

  test('la lección del wrapper queda FUERA de la región auto-generada', () => {
    fs.writeFileSync(rutaLecciones(),
      lessons.render([{ tool: 'Edit', error: 'algo', count: 2, last: '2026-09-03' }]));
    correr(1);
    correr(0);

    const txt = fs.readFileSync(rutaLecciones(), 'utf-8');
    assert.match(lessons.fueraDeLaRegion(txt), /Recuperación tras fallo ARCH/);
  });

  test('y sobrevive a que el failure-tracker regenere la tabla', () => {
    // La prueba que importa: si el wrapper escribiera adentro, esto la borraría
    // sin avisar — el modo de fallo que GATE-D1 existe para prevenir.
    fs.writeFileSync(rutaLecciones(),
      lessons.render([{ tool: 'Edit', error: 'algo', count: 2, last: '2026-09-03' }]));
    correr(1);
    correr(0);

    const txt = fs.readFileSync(rutaLecciones(), 'utf-8');
    const regenerado = lessons.render(
      [{ tool: 'Write', error: 'otro', count: 1, last: '2026-09-04' }],
      lessons.fueraDeLaRegion(txt),
    );
    assert.match(regenerado, /Recuperación tras fallo ARCH/,
      'la lección del wrapper desapareció al regenerar la tabla');
  });

  test('el wrapper crea el archivo con su propio encabezado si no existe', () => {
    correr(1);
    correr(0);
    assert.match(fs.readFileSync(rutaLecciones(), 'utf-8'), /# Lessons Learned/);
  });
});
