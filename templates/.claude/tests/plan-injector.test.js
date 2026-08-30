#!/usr/bin/env node
/**
 * plan-injector.test.js — Contract tests de sdd/plan-injector.js
 *
 * CAR-001 (S1). Inyecta el contrato SDD vivo en CADA Edit de codigo de produccion.
 *
 * Precision sobre la ficha: el hook SI tiene tope por seccion
 * (MAX_SECTION_CHARS = 8000, tres secciones). Lo que no tiene es DEDUP ni
 * presupuesto de sesion — asi que diez ediciones con la misma spec activa pagan
 * diez veces el mismo contenido. Eso es lo que cierra lib/budget.js.
 *
 * TESTS DE CARACTERIZACION: describen el comportamiento ACTUAL.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'sdd', 'plan-injector.js');
let proyecto;

function correr(filePath) {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({
      tool_name: 'Edit',
      tool_input: { file_path: path.join(proyecto, filePath), new_string: 'x' },
    }),
    encoding: 'utf8',
    cwd: proyecto,
  });
  const out = r.stdout || '';
  let contexto = '';
  if (out.trim()) {
    try { contexto = JSON.parse(out).hookSpecificOutput.additionalContext; } catch { /* */ }
  }
  return { exit: r.status, bytes: out.length, contexto };
}

function escribir(rel, contenido = 'contenido') {
  const full = path.join(proyecto, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contenido);
}

function conSpec(id = '0001-reportes', tam = 100) {
  escribir('specs/.active', id);
  escribir(`specs/specs/${id}/spec.md`, '# SPEC\n' + 'a'.repeat(tam));
  escribir(`specs/specs/${id}/plan.md`, '# PLAN\n' + 'b'.repeat(tam));
  escribir(`specs/specs/${id}/tasks.md`, '# TASKS\n' + 'c'.repeat(tam));
}

beforeEach(() => { proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-pi-')); });
afterEach(() => { fs.rmSync(proyecto, { recursive: true, force: true }); });

describe('NUNCA BLOQUEA — solo enriquece', () => {
  test('siempre sale en 0, con o sin spec', () => {
    assert.equal(correr('src/app/x.component.ts').exit, 0);
    conSpec();
    assert.equal(correr('src/app/x.component.ts').exit, 0);
  });

  test('sin carpeta specs/, no inyecta nada', () => {
    assert.equal(correr('src/app/x.component.ts').bytes, 0);
  });

  test('sin .active, no inyecta nada', () => {
    fs.mkdirSync(path.join(proyecto, 'specs'), { recursive: true });
    assert.equal(correr('src/app/x.component.ts').bytes, 0);
  });

  test('con --bypass, no inyecta nada', () => {
    conSpec();
    escribir('specs/.active', '--bypass incidente');
    assert.equal(correr('src/app/x.component.ts').bytes, 0);
  });
});

describe('QUE INYECTA — un contrato distinto por tipo de track', () => {
  test('spec track: spec + plan + tasks', () => {
    conSpec();
    const c = correr('src/app/x.component.ts').contexto;
    assert.match(c, /SDD CONTEXT/);
    assert.match(c, /SPEC \(contrato\)/);
    assert.match(c, /PLAN \(como\)/);
    assert.match(c, /TASKS \(estado\)/);
  });

  test('fix track: solo fix.md', () => {
    escribir('specs/.active', 'fix-001-kpi');
    escribir('specs/fixes/fix-001-kpi/fix.md', '# FIX\ncausa raiz');
    const c = correr('src/app/x.component.ts').contexto;
    assert.match(c, /FIX TRACK/);
    assert.match(c, /FIX \(contrato\)/);
    assert.ok(!c.includes('PLAN (como)'), 'un fix no lleva plan');
  });

  test('hotfix track: solo hotfix.md', () => {
    escribir('specs/.active', 'hotfix-001-ts');
    escribir('specs/hotfixes/hotfix-001-ts/hotfix.md', '# HOTFIX\n');
    const c = correr('src/app/x.component.ts').contexto;
    assert.match(c, /HOTFIX TRACK/);
    assert.ok(!c.includes('TASKS'), 'un hotfix no lleva tasks');
  });

  test('cada track trae sus propias instrucciones', () => {
    conSpec();
    assert.match(correr('src/app/x.component.ts').contexto, /mapear a un AC/);
  });
});

describe('CAR-001 — tope por seccion, pero ninguna dedup', () => {
  test('tope de 8000 chars por seccion, y lo dice', () => {
    conSpec('0001-x', 20000);
    const c = correr('src/app/x.component.ts').contexto;
    assert.match(c, /\[truncado a 8000 chars\]/);
  });

  test('(bug) diez ediciones inyectan diez veces el mismo contrato', () => {
    conSpec('0001-x', 7900);
    const tamanos = Array.from({ length: 10 }, () => correr('src/app/x.component.ts').bytes);

    assert.ok(tamanos.every((t) => t > 20000), 'cada Edit paga el contrato entero');
    assert.equal(new Set(tamanos).size, 1, 'y siempre el mismo, byte por byte');

    const total = tamanos.reduce((a, b) => a + b, 0);
    assert.ok(total > 200000, `${total} chars en 10 ediciones — lo cierra lib/budget.js`);
  });

  test('el techo real de una sola inyeccion ronda los 24.000 chars', () => {
    conSpec('0001-x', 20000);
    const bytes = correr('src/app/x.component.ts').bytes;
    assert.ok(bytes > 24000 && bytes < 26000, `medido: ${bytes}`);
  });
});

describe('SOBRE QUE ARCHIVOS ACTUA', () => {
  beforeEach(() => conSpec());

  const inyecta = ['src/app/x.component.ts', 'src/main.ts', 'app/x.ts', 'lib/x.ts',
    'supabase/migrations/1.sql', 'packages/ui/src/boton.ts'];
  const noInyecta = ['specs/notas.ts', '.claude/hooks/x.js', 'docs/x.ts', 'indices/x.ts',
    'scripts/x.js', 'README.md', 'package.json', 'x.yaml', 'otro/x.ts'];

  for (const p of inyecta) {
    test(`inyecta en ${p}`, () => assert.ok(correr(p).bytes > 0));
  }
  for (const p of noInyecta) {
    test(`no inyecta en ${p}`, () => assert.equal(correr(p).bytes, 0));
  }

  test('(bug) .mdx NO esta en su lista de exentos, pero si en la de spec-gate', () => {
    assert.ok(correr('src/guia.mdx').bytes > 0,
      'la divergencia que cierra lib/paths.js con la union de ambas listas');
  });
});

describe('FAIL-OPEN', () => {
  test('stdin invalido: exit 0, sin salida', () => {
    const r = spawnSync('node', [HOOK], { input: '{ roto', encoding: 'utf8', cwd: proyecto });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  });

  test('sin file_path: exit 0', () => {
    const r = spawnSync('node', [HOOK], {
      input: JSON.stringify({ tool_name: 'Edit', tool_input: {} }),
      encoding: 'utf8', cwd: proyecto,
    });
    assert.equal(r.status, 0);
  });

  test('spec activa cuyo directorio no existe: no inyecta, no rompe', () => {
    escribir('specs/.active', '0009-fantasma');
    const r = correr('src/app/x.component.ts');
    assert.equal(r.exit, 0);
    assert.equal(r.bytes, 0);
  });

  test('spec con directorio pero sin archivos: inyecta solo el encabezado', () => {
    escribir('specs/.active', '0001-x');
    fs.mkdirSync(path.join(proyecto, 'specs', 'specs', '0001-x'), { recursive: true });
    const c = correr('src/app/x.component.ts').contexto;
    assert.match(c, /SDD CONTEXT/);
    assert.ok(!c.includes('SPEC (contrato)'));
  });
});
