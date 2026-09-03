#!/usr/bin/env node
/**
 * validate-file-contains.test.js — Contract tests del validador generico
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'validators', 'validate-file-contains.js');

const created = [];

function makeProject(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-vfc-'));
  created.push(root);
  fs.mkdirSync(path.join(root, 'specs'), { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, 'specs', name), body);
  }
  return root;
}

function run(root, args) {
  const r = spawnSync('node', [HOOK, ...args], { cwd: root, encoding: 'utf8' });
  return { exitCode: r.status, stderr: r.stderr || '' };
}

afterEach(() => {
  while (created.length) {
    try { fs.rmSync(created.pop(), { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

describe('VALIDATE FILE CONTAINS', () => {
  test('pasa cuando estan todas las secciones', () => {
    const root = makeProject({ 'a.md': '## Objetivo\nx\n## Done\ny\n' });
    const r = run(root, ['-d', 'specs', '-c', '## Objetivo', '-c', '## Done']);
    assert.equal(r.exitCode, 0);
  });

  test('bloquea y nombra las secciones que faltan', () => {
    const root = makeProject({ 'a.md': '## Objetivo\nx\n' });
    const r = run(root, ['-d', 'specs', '-c', '## Objetivo', '-c', '## Done', '-c', '## Reglas']);
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('## Done'));
    assert.ok(r.stderr.includes('## Reglas'));
    assert.ok(!r.stderr.includes('✗ ## Objetivo'), 'no debe listar la que si esta');
  });

  test('elige el archivo mas reciente cuando hay varios', () => {
    const root = makeProject({ 'viejo.md': '## Objetivo\n', 'nuevo.md': '## Objetivo\n## Done\n' });
    const past = Date.now() / 1000 - 3600;
    fs.utimesSync(path.join(root, 'specs', 'viejo.md'), past, past);
    const r = run(root, ['-d', 'specs', '-c', '## Done']);
    assert.equal(r.exitCode, 0, 'debe juzgar nuevo.md, no viejo.md');
  });

  test('respeta el glob de --pattern', () => {
    const root = makeProject({ 'otro.md': 'vacio', 'task-spec-1.md': '## Objetivo\n' });
    const r = run(root, ['-d', 'specs', '-p', 'task-spec-*.md', '-c', '## Objetivo']);
    assert.equal(r.exitCode, 0);
  });

  test('--max-age ignora archivos viejos', () => {
    const root = makeProject({ 'a.md': 'sin nada' });
    const past = Date.now() / 1000 - 7200;
    fs.utimesSync(path.join(root, 'specs', 'a.md'), past, past);
    const r = run(root, ['-d', 'specs', '-c', '## Objetivo', '--max-age', '10']);
    assert.equal(r.exitCode, 0, 'fuera de ventana = nada que validar');
  });

  test('sin archivos y sin --require-file: no hay nada que validar', () => {
    const r = run(makeProject(), ['-d', 'specs', '-c', '## Objetivo']);
    assert.equal(r.exitCode, 0);
  });

  test('sin archivos y con --require-file: bloquea', () => {
    const r = run(makeProject(), ['-d', 'specs', '-c', '## Objetivo', '--require-file']);
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('no se encontro'));
  });

  test('directorio inexistente sin --require-file: no bloquea', () => {
    const r = run(makeProject(), ['-d', 'no-existe', '-c', '## Objetivo']);
    assert.equal(r.exitCode, 0);
  });

  test('mal configurado (sin --contains) no bloquea nunca', () => {
    const r = run(makeProject({ 'a.md': 'x' }), ['-d', 'specs']);
    assert.equal(r.exitCode, 0, 'un validador roto no debe frenar al agente');
  });

  test('el glob no interpreta metacaracteres de regex como tales', () => {
    const root = makeProject({ 'a.b.md': '## Objetivo\n', 'axbxmd': 'nada' });
    const r = run(root, ['-d', 'specs', '-p', 'a.b.md', '-c', '## Objetivo']);
    assert.equal(r.exitCode, 0, 'el punto debe ser literal, no comodin');
  });
});

describe('VALIDATE FILE CONTAINS — contrato con /plan', () => {
  test('valida el task-spec real que genera la skill /plan', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-vfc-plan-'));
    created.push(root);
    fs.mkdirSync(path.join(root, '.claude', 'temp'), { recursive: true });
    fs.writeFileSync(path.join(root, '.claude', 'temp', 'task-spec-20260101-120000.md'),
      '# Task Spec\n## Objetivo\nx\n## Artefactos afectados\ny\n## Reglas que aplican\nz\n' +
      '## Pasos de ejecucion\n- [ ] a\n## Criterio de done\n- [ ] b\n');
    const args = ['-d', '.claude/temp', '-p', 'task-spec-*.md', '--require-file',
      '-c', '## Objetivo', '-c', '## Artefactos afectados', '-c', '## Reglas que aplican',
      '-c', '## Pasos de ejecucion', '-c', '## Criterio de done'];
    assert.equal(run(root, args).exitCode, 0);
  });
});

describe('INC-002 — «no existe» y «existe pero es viejo» son dos cosas', () => {
  // El filtro de edad vaciaba la lista de candidatos, y el único mensaje que
  // había decía «Crealo antes de terminar». En cualquier sesión de más de una
  // hora sin tocar el spec, el agente recibía la orden de crear un spec QUE YA
  // EXISTE. Si obedece, el duplicado pasa a ser «el más reciente por orden
  // alfabético» para los otros cuatro consumidores del contrato y el original
  // queda huérfano — un mensaje equivocado rompiendo el artefacto que vigila.

  const COMPLETO = '## Objetivo\nx\n## Criterio de done\n- [ ] y\n';
  const ARGS = ['-d', 'specs', '--pattern', 'spec-*.md', '--max-age', '60', '--require-file',
    '-c', '## Objetivo', '-c', '## Criterio de done'];

  /** Envejece un archivo del proyecto. */
  function envejecer(root, nombre, minutos) {
    const full = path.join(root, 'specs', nombre);
    const t = (Date.now() - minutos * 60_000) / 1000;
    fs.utimesSync(full, t, t);
  }

  test('un spec completo y fresco pasa', () => {
    const root = makeProject({ 'spec-1.md': COMPLETO });
    assert.equal(run(root, ARGS).exitCode, 0);
  });

  test('sin ningún spec: dice que lo cree', () => {
    const root = makeProject({});
    const r = run(root, ARGS);
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /no se encontro ningun archivo/);
    assert.match(r.stderr, /Crealo/);
  });

  test('con un spec viejo: NO dice que lo cree — dice que lo actualice', () => {
    const root = makeProject({ 'spec-1.md': COMPLETO });
    envejecer(root, 'spec-1.md', 120);
    const r = run(root, ARGS);
    assert.equal(r.exitCode, 2);
    assert.ok(!r.stderr.includes('no se encontro ningun archivo'),
      'este es el bug: decía que no existe un archivo que sí existe');
    assert.match(r.stderr, /NO crees uno nuevo/);
  });

  test('y lo nombra, con su antigüedad real', () => {
    // Sin el nombre, el agente no sabe cuál de los specs del directorio es.
    const root = makeProject({ 'spec-1.md': COMPLETO });
    envejecer(root, 'spec-1.md', 120);
    const r = run(root, ARGS);
    assert.match(r.stderr, /spec-1\.md/);
    assert.match(r.stderr, /120 min/);
  });

  test('avisa por qué duplicarlo es peor que dejarlo viejo', () => {
    const root = makeProject({ 'spec-1.md': COMPLETO });
    envejecer(root, 'spec-1.md', 120);
    assert.match(run(root, ARGS).stderr, /huerfano/);
  });

  test('viejo E incompleto: gana la estructura', () => {
    // Arreglar la sección actualiza el mtime, así que resuelve las dos cosas de
    // una vez. Al revés, el agente arregla la edad y vuelve a chocar.
    const root = makeProject({ 'spec-1.md': '## Objetivo\nx\n' });
    envejecer(root, 'spec-1.md', 120);
    const r = run(root, ARGS);
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /VALIDACION DE ESTRUCTURA/);
    assert.match(r.stderr, /Criterio de done/);
  });

  test('sin --max-age, la edad no opina', () => {
    const root = makeProject({ 'spec-1.md': COMPLETO });
    envejecer(root, 'spec-1.md', 100000);
    const sinEdad = ARGS.filter((a, i) => a !== '--max-age' && ARGS[i - 1] !== '--max-age');
    assert.equal(run(root, sinEdad).exitCode, 0);
  });
});

// ─── HUE-028: por qué el patrón se usaba una sola vez ───────────────────────
//
// El hallazgo decía que «skill con guardrail en su frontmatter funciona y se usa
// una sola vez, en /plan». La razón no era de gusto: sin recursión, el llamador
// tiene que poder NOMBRAR el directorio en el frontmatter, y toda la familia SDD
// escribe en `specs/{specs,fixes,hotfixes}/<id>/` — un nombre que no existe
// hasta que el comando corre. El único artefacto guardable era el de /plan,
// que vive en una carpeta plana.
describe('HUE-028 — --recursive destraba los artefactos anidados', () => {
  /** Un proyecto con un track SDD en su carpeta real, que nadie puede nombrar. */
  function conTrack(rel, body) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-vfc-sdd-'));
    created.push(root);
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
    return root;
  }

  const SPEC_OK = '# Spec\n## 2. User Stories\nx\n## 3. Acceptance Criteria (Gherkin)\ny\n## 4. Out of scope\nz\n';
  const ARGS = ['-d', 'specs', '-p', 'spec.md', '--require-file',
    '-c', '## 2. User Stories', '-c', '## 3. Acceptance Criteria', '-c', '## 4. Out of scope'];

  test('sin --recursive no llega al archivo: ese era el techo', () => {
    const root = conTrack('specs/specs/0001-demo/spec.md', SPEC_OK);
    const r = run(root, ARGS);
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /no se encontro ningun archivo/,
      'y lo peor es el consejo: manda crear un spec que ya existe');
  });

  test('con --recursive lo encuentra y lo aprueba', () => {
    const root = conTrack('specs/specs/0001-demo/spec.md', SPEC_OK);
    assert.equal(run(root, [...ARGS, '--recursive']).exitCode, 0);
  });

  test('y sigue juzgando la estructura, que es el punto', () => {
    const root = conTrack('specs/specs/0001-demo/spec.md', '# Spec\n## 2. User Stories\nx\n');
    const r = run(root, [...ARGS, '--recursive']);
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /## 4\. Out of scope/);
  });

  test('reporta la ruta REAL, no la que se pasó por flag', () => {
    // Con recursión, `target.name` es solo el basename: informar
    // `specs/spec.md` mandaría al agente a mirar un archivo que no existe.
    const root = conTrack('specs/fixes/fix-001-demo/fix.md', '# Fix\n## Root Cause\nx\n');
    const r = run(root, ['-d', 'specs', '-p', 'fix.md', '--recursive', '--require-file',
      '-c', '## Test de Regresión']);
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /specs[/\\]fixes[/\\]fix-001-demo[/\\]fix\.md/);
  });

  test('el mensaje de «no hay archivo» dice que también miró abajo', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-vfc-vacio-'));
    created.push(root);
    fs.mkdirSync(path.join(root, 'specs'), { recursive: true });
    const r = run(root, [...ARGS, '--recursive']);
    assert.equal(r.exitCode, 2);
    assert.match(r.stderr, /subdirectorios/);
  });

  test('no se mete en node_modules ni en .git', () => {
    // Esto corre en un hook de Stop, o sea en el camino crítico de cada
    // respuesta. Un recorrido sin podar convierte el guardrail en una espera.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-vfc-nm-'));
    created.push(root);
    for (const d of ['specs/node_modules/paquete', 'specs/.git/objects']) {
      fs.mkdirSync(path.join(root, d), { recursive: true });
      fs.writeFileSync(path.join(root, d, 'spec.md'), SPEC_OK);
    }
    const r = run(root, [...ARGS, '--recursive']);
    assert.equal(r.exitCode, 2, 'un spec dentro de node_modules no es un spec del proyecto');
  });

  test('la profundidad está topeada: 5 niveles ya no cuentan', () => {
    const root = conTrack('specs/a/b/c/d/e/spec.md', SPEC_OK);
    assert.equal(run(root, [...ARGS, '--recursive']).exitCode, 2);
  });
});

// ─── Los comandos que declaran el guardrail lo declaran BIEN ────────────────
describe('HUE-028 — el frontmatter que cablea el validador', () => {
  const COMANDOS = path.resolve(__dirname, '..', 'commands');
  const SKILLS = path.resolve(__dirname, '..', 'skills');

  /** Todo archivo de skill o comando que invoque este validador. */
  function llamadores() {
    const out = [];
    const dirs = [];
    if (fs.existsSync(COMANDOS)) {
      for (const f of fs.readdirSync(COMANDOS).filter((x) => x.endsWith('.md'))) {
        dirs.push(path.join(COMANDOS, f));
      }
    }
    if (fs.existsSync(SKILLS)) {
      for (const d of fs.readdirSync(SKILLS)) {
        const s = path.join(SKILLS, d, 'SKILL.md');
        if (fs.existsSync(s)) dirs.push(s);
      }
    }
    for (const f of dirs) {
      const txt = fs.readFileSync(f, 'utf-8');
      if (txt.includes('validate-file-contains.js')) out.push({ f, txt });
    }
    return out;
  }

  const TODOS = llamadores();

  test('hay más de un llamador: el patrón dejó de usarse una sola vez', () => {
    assert.ok(TODOS.length >= 3,
      `solo ${TODOS.length} llamador(es); HUE-028 se cerró cableando /spec-new y /fix-new`);
  });

  for (const { f, txt } of TODOS) {
    const nombre = path.basename(path.dirname(f)) === 'commands'
      ? path.basename(f) : `${path.basename(path.dirname(f))}/SKILL.md`;

    test(`${nombre} pasa --directory y al menos un --contains`, () => {
      // Sin cualquiera de los dos el validador sale 0 sin mirar nada: mal
      // configurado = no validar, para que un validador roto no frene al agente.
      // Es la política correcta y por eso mismo el error es silencioso.
      assert.match(txt, /--directory\s+\S+/, 'sin --directory no valida nada');
      assert.match(txt, /--contains\s+"/, 'sin --contains tampoco');
    });

    test(`${nombre} usa --recursive si apunta a specs/`, () => {
      // `specs/` nunca tiene el artefacto en su raíz: los tracks viven en
      // specs/{specs,fixes,hotfixes}/<id>/. Apuntar ahí sin recursión produce
      // el peor mensaje posible — «crealo» sobre un archivo que ya está.
      if (!/--directory\s+specs\b/.test(txt)) return;
      assert.match(txt, /--recursive/, `${nombre} apunta a specs/ sin --recursive`);
    });
  }
});
