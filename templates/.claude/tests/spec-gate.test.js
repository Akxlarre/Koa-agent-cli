#!/usr/bin/env node
/**
 * spec-gate.test.js — Contract tests de sdd/spec-gate.js
 *
 * El guardrail del motor SDD: bloquea escrituras de codigo de produccion sin un
 * contrato declarado. 176 lineas y cinco compuertas, sin un solo test.
 *
 * Lo que este archivo fija, y que la tanda 3 va a tocar:
 *
 *   - su lista de exentos, que DIVERGE de la de plan-injector. Medido: src/guia.mdx
 *     pasa el gate y aun asi plan-injector lo trata como codigo de produccion.
 *     lib/paths.js unifica las dos con la union de ambas listas.
 *   - el SDD viene dormido: sin carpeta specs/ no molesta a quien no lo usa.
 *
 * TESTS DE CARACTERIZACION: describen el comportamiento ACTUAL.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'sdd', 'spec-gate.js');
let proyecto;

function correr(filePath) {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: path.join(proyecto, filePath), content: 'x' },
    }),
    encoding: 'utf8',
    cwd: proyecto,
  });
  return { exit: r.status, stderr: r.stderr || '' };
}

function escribir(rel, contenido = 'contenido') {
  const full = path.join(proyecto, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contenido);
}

/** Una spec completa y activa: el camino feliz. */
function conSpecActiva(id = '0001-reportes') {
  escribir('specs/.active', id);
  escribir(`specs/specs/${id}/spec.md`, '# Spec\n');
  escribir(`specs/specs/${id}/plan.md`, '# Plan\n');
}

beforeEach(() => { proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-sg-')); });
afterEach(() => { fs.rmSync(proyecto, { recursive: true, force: true }); });

describe('EL SDD VIENE DORMIDO', () => {
  test('sin carpeta specs/, no molesta a nadie', () => {
    assert.equal(correr('src/app/x.component.ts').exit, 0);
  });

  test('con specs/ pero sin .active, SI bloquea codigo de produccion', () => {
    fs.mkdirSync(path.join(proyecto, 'specs'), { recursive: true });
    const r = correr('src/app/x.component.ts');
    assert.equal(r.exit, 2);
    assert.match(r.stderr, /SPEC GATE/);
    assert.match(r.stderr, /No hay spec SDD activa/);
  });

  test('el bypass de emergencia deja pasar', () => {
    escribir('specs/.active', '--bypass incidente en produccion');
    assert.equal(correr('src/app/x.component.ts').exit, 0);
  });
});

describe('QUE CONSIDERA CODIGO DE PRODUCCION', () => {
  beforeEach(() => { fs.mkdirSync(path.join(proyecto, 'specs'), { recursive: true }); });

  const producto = ['src/app/x.component.ts', 'src/main.ts', 'app/x.ts', 'lib/x.ts',
    'supabase/migrations/001_init.sql'];
  const noProducto = ['specs/notas.ts', '.claude/hooks/x.js', 'docs/guia.ts',
    'indices/COMPONENTS.ts', 'scripts/x.js', 'node_modules/a/b.ts',
    'README.md', 'package.json', 'tsconfig.yaml', 'Dockerfile', 'Makefile'];

  for (const p of producto) {
    test(`bloquea ${p}`, () => assert.equal(correr(p).exit, 2));
  }
  for (const p of noProducto) {
    test(`deja pasar ${p}`, () => assert.equal(correr(p).exit, 0));
  }
});

describe('LA DIVERGENCIA CON plan-injector (la cierra lib/paths.js)', () => {
  beforeEach(() => { fs.mkdirSync(path.join(proyecto, 'specs'), { recursive: true }); });

  // spec-gate exime .mdx; plan-injector NO. El mismo archivo es "no producto"
  // para uno y "producto" para el otro, asi que pasa el gate y le inyectan el
  // contrato SDD igual. lib/paths.js unifica con la union de ambas listas.
  test('src/guia.mdx — spec-gate lo exime, plan-injector no (la divergencia real)', () => {
    assert.equal(correr('src/guia.mdx').exit, 0);
  });

  // DEC-007 — CERRADO. Cuatro entradas de la lista de exentos no disparaban
  // nunca: `path.extname('.npmrc')` devuelve '' y los dotfiles reales se llaman
  // asi enteros, asi que figuraban como exentos y el gate los bloqueaba igual.
  // Solo funcionaban para un archivo llamado "x.npmrc", que nadie crea.
  for (const p of ['src/.npmrc', 'src/.env', 'src/.editorconfig', 'src/.gitignore']) {
    test(`CERRADO: ${p} esta exento y ahora si pasa — DEC-007`, () => {
      assert.equal(correr(p).exit, 0);
    });
  }

  test('esas mismas extensiones siguen eximiendo como sufijo', () => {
    assert.equal(correr('src/config.npmrc').exit, 0, 'extname devuelve ".npmrc" aca');
  });

  test('un dotfile que NO esta exento sigue bloqueando', () => {
    // El arreglo compara el basename contra la lista de exentos; no exime a
    // cualquier archivo que empiece con punto.
    assert.equal(correr('src/.secreto.ts').exit, 2);
  });
});

describe('HUE-010 / INC-005 — el gate usa el nucleo compartido', () => {
  test('lee stdin con el cap SEC-04', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '..', 'hooks', 'sdd', 'spec-gate.js'), 'utf-8');
    assert.match(src, /require\('\.\.\/lib\/payload\.js'\)/,
      'era uno de los dos hooks que acumulaban stdin sin tope');
    assert.ok(!/process\.stdin\.on/.test(src));
  });

  test('y la pregunta de "que es codigo de produccion" sale de lib/paths.js', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '..', 'hooks', 'sdd', 'spec-gate.js'), 'utf-8');
    assert.match(src, /paths\.isProductCode/);
    assert.ok(!/exemptPathPrefixes|exemptExtensions/.test(src),
      'la lista propia es lo que divergio de la de plan-injector');
  });

  test('gate e injector dan la MISMA respuesta sobre el mismo archivo', () => {
    // INC-005 medido: `src/guia.mdx` pasaba el gate y aun asi recibia el
    // contrato SDD entero. Ahora las dos preguntas son la misma funcion.
    //
    // Con specs/ y SIN spec activa: es el unico estado donde el gate contesta
    // «esto es codigo de produccion» con un bloqueo observable.
    escribir('specs/.gitkeep', '');
    const paths = require(path.resolve(__dirname, '..', 'hooks', 'lib', 'paths.js'));
    for (const p of ['src/guia.mdx', 'src/.npmrc', 'src/app/x.component.ts',
      'docs/x.ts', 'supabase/migrations/1.sql']) {
      const esProducto = paths.isProductCode(path.join(proyecto, p), proyecto);
      const bloquea = correr(p).exit === 2;
      assert.equal(bloquea, esProducto, `${p}: el gate y paths.js no coinciden`);
    }
  });
});

describe('TRACKS — cada tipo pide su propio contrato', () => {
  test('spec track completa: deja pasar', () => {
    conSpecActiva();
    assert.equal(correr('src/app/x.component.ts').exit, 0);
  });

  test('spec activa que no existe en disco: bloquea', () => {
    escribir('specs/.active', '0009-inexistente');
    const r = correr('src/app/x.component.ts');
    assert.equal(r.exit, 2);
    assert.match(r.stderr, /no existe en disco/);
  });

  test('spec sin plan.md: bloquea', () => {
    escribir('specs/.active', '0001-x');
    escribir('specs/specs/0001-x/spec.md', '# Spec\n');
    const r = correr('src/app/x.component.ts');
    assert.equal(r.exit, 2);
    assert.match(r.stderr, /no tiene plan\.md/);
  });

  test('fix track con fix.md: deja pasar, sin exigir plan', () => {
    escribir('specs/.active', 'fix-001-kpi');
    escribir('specs/fixes/fix-001-kpi/fix.md', '# Fix\n');
    assert.equal(correr('src/app/x.component.ts').exit, 0);
  });

  test('fix track sin fix.md: bloquea', () => {
    escribir('specs/.active', 'fix-001-kpi');
    fs.mkdirSync(path.join(proyecto, 'specs', 'fixes', 'fix-001-kpi'), { recursive: true });
    const r = correr('src/app/x.component.ts');
    assert.equal(r.exit, 2);
    assert.match(r.stderr, /no tiene fix\.md/);
  });

  test('hotfix track con hotfix.md: deja pasar', () => {
    escribir('specs/.active', 'hotfix-001-ts2345');
    escribir('specs/hotfixes/hotfix-001-ts2345/hotfix.md', '# Hotfix\n');
    assert.equal(correr('src/app/x.component.ts').exit, 0);
  });

  test('hotfix track sin hotfix.md: bloquea', () => {
    escribir('specs/.active', 'hotfix-001-ts2345');
    fs.mkdirSync(path.join(proyecto, 'specs'), { recursive: true });
    const r = correr('src/app/x.component.ts');
    assert.equal(r.exit, 2);
    assert.match(r.stderr, /no tiene hotfix\.md/);
  });
});

describe('RUTAS LEGACY — se aceptan las dos ubicaciones', () => {
  test('spec directamente bajo specs/<id>/', () => {
    escribir('specs/.active', '0001-x');
    escribir('specs/0001-x/spec.md', '# Spec\n');
    escribir('specs/0001-x/plan.md', '# Plan\n');
    assert.equal(correr('src/app/x.component.ts').exit, 0);
  });

  test('hotfix bajo specs/fixes/hotfixes/<id>/ (pre-migracion)', () => {
    escribir('specs/.active', 'hotfix-001-x');
    escribir('specs/fixes/hotfixes/hotfix-001-x/hotfix.md', '# Hotfix\n');
    assert.equal(correr('src/app/x.component.ts').exit, 0);
  });
});

describe('FAIL-OPEN', () => {
  test('stdin invalido: exit 0', () => {
    const r = spawnSync('node', [HOOK], { input: '{ roto', encoding: 'utf8', cwd: proyecto });
    assert.equal(r.status, 0);
  });

  test('sin file_path: exit 0', () => {
    const r = spawnSync('node', [HOOK], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: {} }),
      encoding: 'utf8', cwd: proyecto,
    });
    assert.equal(r.status, 0);
  });

  test('.active vacio se trata como "sin spec"', () => {
    escribir('specs/.active', '   \n');
    assert.equal(correr('src/app/x.component.ts').exit, 2);
  });

  test('.active con varias lineas usa solo la primera', () => {
    escribir('specs/.active', '0001-x\nbasura\nmas basura');
    escribir('specs/specs/0001-x/spec.md', '# Spec\n');
    escribir('specs/specs/0001-x/plan.md', '# Plan\n');
    assert.equal(correr('src/app/x.component.ts').exit, 0);
  });
});
