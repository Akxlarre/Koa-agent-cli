#!/usr/bin/env node
/**
 * blueprint.test.js — Contract tests de lib/blueprint.js
 *
 * HUE-005 (S1). El `stack` de blueprint.json decide que guardrails corren, entre
 * ellos SEC-RLS-01/02/03. Sus dos consumidores hacian `{ ...DEFAULTS, ...bp.stack }`,
 * que acepta cualquier cosa. Medido sobre el spread crudo:
 *
 *   { supabase: null }     → falsy → reglas RLS APAGADAS, en silencio
 *   { supabase: 0 }        → idem
 *   { supabase: "false" }  → truthy → ACTIVAS, contra la intencion del humano
 *   { supabse: false }     → typo ignorado sin aviso
 *
 * El ultimo describe verifica que los dos consumidores —que viven en arboles
 * separados y no pueden importarse— declaren la MISMA lista de claves.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const B = require(path.resolve(__dirname, '..', 'hooks', 'lib', 'blueprint.js'));
const TEMPLATES = path.resolve(__dirname, '..', '..');

let proyecto;
beforeEach(() => { proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-bp-')); });
afterEach(() => { fs.rmSync(proyecto, { recursive: true, force: true }); });

const conBlueprint = (obj) =>
  fs.writeFileSync(path.join(proyecto, 'blueprint.json'),
    typeof obj === 'string' ? obj : JSON.stringify(obj));

describe('SOLO BOOLEANOS EN CLAVES CONOCIDAS', () => {
  test('un booleano valido si se aplica', () => {
    const r = B.normalizarStack({ supabase: false });
    assert.equal(r.stack.supabase, false);
    assert.deepEqual(r.ignoradas, []);
  });

  const rechazados = [
    ['string "false"', { supabase: 'false' }],
    ['string "true"', { supabase: 'true' }],
    ['null', { supabase: null }],
    ['cero', { supabase: 0 }],
    ['uno', { supabase: 1 }],
    ['objeto', { supabase: {} }],
    ['array', { supabase: [] }],
  ];

  for (const [nombre, crudo] of rechazados) {
    test(`${nombre} no apaga ni enciende nada`, () => {
      const r = B.normalizarStack(crudo);
      assert.equal(r.stack.supabase, B.DEFAULTS.supabase,
        'un valor que no es booleano no puede mover una bandera');
      assert.equal(r.ignoradas.length, 1);
      assert.match(r.ignoradas[0], /supabase/);
    });
  }

  test('una clave desconocida se ignora y se reporta', () => {
    const r = B.normalizarStack({ supabse: false });
    assert.deepEqual(r.stack, { ...B.DEFAULTS });
    assert.match(r.ignoradas[0], /supabse.*desconocida/);
  });

  test('lo valido se aplica aunque venga junto a basura', () => {
    const r = B.normalizarStack({ supabase: false, gsap: 'si', inventada: 1 });
    assert.equal(r.stack.supabase, false, 'esto era valido');
    assert.equal(r.stack.gsap, B.DEFAULTS.gsap, 'esto no');
    assert.equal(r.ignoradas.length, 2);
  });

  test('las cinco claves conocidas se aceptan', () => {
    const todas = Object.fromEntries(B.STACK_KEYS.map((k) => [k, false]));
    const r = B.normalizarStack(todas);
    assert.deepEqual(r.ignoradas, []);
    for (const k of B.STACK_KEYS) assert.equal(r.stack[k], false, k);
  });
});

describe('FORMAS DEGENERADAS DEL stack', () => {
  for (const [nombre, crudo] of [
    ['ausente', undefined], ['null', null],
    ['array', ['supabase']], ['string', 'supabase'], ['numero', 42],
  ]) {
    test(`stack ${nombre} → defaults intactos`, () => {
      const r = B.normalizarStack(crudo);
      assert.deepEqual(r.stack, { ...B.DEFAULTS });
    });
  }

  test('un stack vacio tampoco cambia nada', () => {
    assert.deepEqual(B.normalizarStack({}).stack, { ...B.DEFAULTS });
    assert.deepEqual(B.normalizarStack({}).ignoradas, []);
  });
});

describe('readStack — fail-open sobre el filesystem', () => {
  test('sin blueprint.json usa los defaults', () => {
    const r = B.readStack(proyecto);
    assert.deepEqual(r.stack, { ...B.DEFAULTS });
    assert.deepEqual(r.ignoradas, []);
  });

  test('con JSON roto usa los defaults y lo reporta', () => {
    conBlueprint('{ esto no es json');
    const r = B.readStack(proyecto);
    assert.deepEqual(r.stack, { ...B.DEFAULTS });
    assert.match(r.ignoradas[0], /ilegible/);
  });

  test('con un blueprint valido aplica el stack', () => {
    conBlueprint({ version: '6.1.0', stack: { supabase: false, gsap: true } });
    const r = B.readStack(proyecto);
    assert.equal(r.stack.supabase, false);
    assert.equal(r.stack.gsap, true);
  });

  test('un blueprint sin campo stack no rompe', () => {
    conBlueprint({ version: '6.1.0' });
    assert.deepEqual(B.readStack(proyecto).stack, { ...B.DEFAULTS });
  });

  test('nunca devuelve el objeto DEFAULTS compartido', () => {
    const r = B.readStack(proyecto);
    r.stack.supabase = 'mutado';
    assert.equal(B.DEFAULTS.supabase, true, 'DEFAULTS no debe poder mutarse');
  });
});

describe('LOS DOS CONSUMIDORES DECLARAN LA MISMA LISTA', () => {
  // pre-write-guard vive en .claude/hooks/ (CommonJS) y architect.js en
  // boilerplate/scripts/ (ESM). No pueden importarse, asi que la lista esta
  // escrita dos veces — declarado, y verificado aca.

  /** Quita comentarios de linea y de bloque, para no grepear sobre docblocks. */
  function sinComentarios(src) {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
  }

  function architectSrc() {
    for (const p of [
      path.join(TEMPLATES, 'boilerplate', 'scripts', 'architect.js'),
      path.join(TEMPLATES, 'scripts', 'architect.js'),
    ]) {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
    }
    return null;
  }

  test('architect.js declara STACK_KEYS y coincide con lib/blueprint.js', () => {
    const src = architectSrc();
    assert.ok(src, 'no se encontro architect.js');
    const m = src.match(/const STACK_KEYS = \[([^\]]+)\]/);
    assert.ok(m, 'architect.js debe declarar STACK_KEYS');
    const suyas = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
    assert.deepEqual(suyas.sort(), [...B.STACK_KEYS].sort(),
      'las dos listas divergieron: una bandera valida en un lado se ignora en el otro');
  });

  test('architect.js exige booleano, como lib/blueprint.js', () => {
    const src = architectSrc();
    assert.match(src, /typeof crudo\[k\] === 'boolean'/,
      'sin el chequeo de tipo, un null vuelve a apagar las reglas RLS');
  });

  test('pre-write-guard.js ya no hace el spread crudo', () => {
    const src = fs.readFileSync(
      path.join(TEMPLATES, '.claude', 'hooks', 'pre-write-guard.js'), 'utf-8');

    // Se mira el CODIGO, no los comentarios: el docblock cita `{ ...bp.stack }`
    // como ejemplo de lo que ya no se hace, y un grep sobre el archivo entero
    // lo confunde con una llamada real. (Me paso dos veces en esta tanda.)
    assert.ok(!/\.\.\.bp\.stack/.test(sinComentarios(src)),
      'el spread crudo acepta cualquier cosa');
    assert.match(src, /blueprint\.readStack/);
  });
});
