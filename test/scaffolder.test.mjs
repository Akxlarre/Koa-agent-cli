/**
 * Contrato de precedencia del scaffolder.
 *
 * Estas pruebas existen por un modo de fallo concreto: `copyRecursiveSync` hacía un
 * `fs.copyFileSync` pelado y `writeBlueprintJson` reescribía el archivo entero, así
 * que correr el CLI dentro de una carpeta exportada por Wikiflow —el paso 5 del
 * flujo que documenta el propio contrato— borraba `context/domain.md`,
 * `indices/DATABASE.md` y el `tier` del blueprint. Sin aviso.
 *
 * Una regresión acá no rompe un build: destruye trabajo del usuario en silencio.
 *
 * `node --test test/*.test.mjs`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { copyTemplates, writeBlueprintJson } from '../lib/scaffolder.js';
import { validateBlueprintJson } from '../lib/config.js';

const FULL_STACK = {
    primeng: true, gsap: true, supabase: true,
    ngrxSignals: false, e2e: false, cursor: false, windsurf: false,
};

function mkdtemp() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'koa-prec-'));
}

function write(root, rel, content) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
    return full;
}

const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (root, rel) => fs.existsSync(path.join(root, rel));

/** templates/ mínimo: una ruta del harness y varias de contenido del proyecto. */
function makeTemplates() {
    const dir = mkdtemp();
    write(dir, '.claude/CLAUDE.md', 'HARNESS v7');
    write(dir, 'docs/GUIDE.md', 'GUIA v7');
    write(dir, 'CLAUDE.md', 'RAIZ v7');
    write(dir, 'context/domain.md', 'SKELETON dominio (PENDING)');
    write(dir, 'context/brief.md', 'SKELETON brief (PENDING)');
    write(dir, 'indices/DATABASE.md', 'SKELETON database');
    write(dir, 'supabase/migrations/20240101000000_auth.sql', '-- seed auth');
    write(dir, 'gitignore.template', 'node_modules/');
    return dir;
}

// ─── copyTemplates: precedencia ──────────────────────────────────────────────

test('preserva el contexto capturado en vez de pisarlo con skeletons', () => {
    const tmpl = makeTemplates();
    const target = mkdtemp();
    write(target, 'context/domain.md', 'DOMINIO REAL — 8 contextos');
    write(target, 'indices/DATABASE.md', 'DATABASE REAL — 41 tablas');

    copyTemplates(tmpl, target, 'proyecto');

    assert.equal(read(target, 'context/domain.md'), 'DOMINIO REAL — 8 contextos');
    assert.equal(read(target, 'indices/DATABASE.md'), 'DATABASE REAL — 41 tablas');
});

test('sí escribe el skeleton cuando el archivo no existe', () => {
    const tmpl = makeTemplates();
    const target = mkdtemp();
    write(target, 'context/domain.md', 'DOMINIO REAL');

    copyTemplates(tmpl, target, 'proyecto');

    // domain.md existía y se preserva; brief.md no, así que llega el skeleton.
    assert.equal(read(target, 'context/domain.md'), 'DOMINIO REAL');
    assert.equal(read(target, 'context/brief.md'), 'SKELETON brief (PENDING)');
});

test('el harness SÍ se sobrescribe — es lo que el CLI mantiene', () => {
    const tmpl = makeTemplates();
    const target = mkdtemp();
    write(target, '.claude/CLAUDE.md', 'HARNESS v6 viejo');
    write(target, 'docs/GUIDE.md', 'GUIA v6 vieja');
    write(target, 'CLAUDE.md', 'RAIZ v6 vieja');

    copyTemplates(tmpl, target, 'proyecto');

    assert.equal(read(target, '.claude/CLAUDE.md'), 'HARNESS v7');
    assert.equal(read(target, 'docs/GUIDE.md'), 'GUIA v7');
    assert.equal(read(target, 'CLAUDE.md'), 'RAIZ v7');
});

test('no pisa una migración propia y convive con los seeds', () => {
    const tmpl = makeTemplates();
    const target = mkdtemp();
    write(target, 'supabase/migrations/20260811000000_initial_schema.sql', '-- schema v2');

    copyTemplates(tmpl, target, 'proyecto');

    assert.equal(read(target, 'supabase/migrations/20260811000000_initial_schema.sql'), '-- schema v2');
    assert.ok(exists(target, 'supabase/migrations/20240101000000_auth.sql'));
});

test('respeta un .gitignore existente (gitignore.template no lo pisa)', () => {
    const tmpl = makeTemplates();
    const target = mkdtemp();
    write(target, '.gitignore', 'dist/\n.env.local');

    copyTemplates(tmpl, target, 'proyecto');

    assert.equal(read(target, '.gitignore'), 'dist/\n.env.local');
});

test('en un destino vacío copia todo', () => {
    const tmpl = makeTemplates();
    const target = mkdtemp();

    copyTemplates(tmpl, target, 'proyecto');

    for (const f of ['.claude/CLAUDE.md', 'docs/GUIDE.md', 'context/domain.md',
                     'indices/DATABASE.md', '.gitignore']) {
        assert.ok(exists(target, f), `falta ${f}`);
    }
});

// ─── writeBlueprintJson: merge ───────────────────────────────────────────────

const readBp = (dir) => JSON.parse(read(dir, 'blueprint.json'));

test('preserva los campos que escribe Wikiflow', () => {
    const target = mkdtemp();
    write(target, 'blueprint.json', JSON.stringify({
        name: 'koa-agent-blueprint', version: '6.5.0', generatedAt: '2026-01-01T00:00:00.000Z',
        scaffoldMode: 'inject-only',
        tier: 'agency',
        team: { size: 5, horizon6mo: 'growing' },
        product: { complexity: 'domain-heavy', lifespan: 'long-lived' },
        deployment: null,
        stack: { angular: true, tailwind: true, primeng: true, gsap: true, supabase: true, ngrxSignals: false, e2e: false, cursor: false, windsurf: false },
    }));

    writeBlueprintJson(target, 'proyecto', false, FULL_STACK);
    const bp = readBp(target);

    assert.equal(bp.tier, 'agency');
    assert.deepEqual(bp.team, { size: 5, horizon6mo: 'growing' });
    assert.deepEqual(bp.product, { complexity: 'domain-heavy', lifespan: 'long-lived' });
    assert.equal(bp.deployment, null);
});

test('en inject-only NO reescribe el stack — no instaló nada', () => {
    const target = mkdtemp();
    write(target, 'blueprint.json', JSON.stringify({
        name: 'koa-agent-blueprint', version: '6.5.0', generatedAt: '2026-01-01T00:00:00.000Z',
        scaffoldMode: 'inject-only',
        stack: { angular: true, tailwind: true, primeng: false, gsap: true, supabase: false, ngrxSignals: true, e2e: false, cursor: false, windsurf: false },
    }));

    writeBlueprintJson(target, 'proyecto', false, FULL_STACK);
    const bp = readBp(target);

    assert.equal(bp.stack.gsap, true);
    assert.equal(bp.stack.primeng, false);
    assert.equal(bp.stack.supabase, false);
    assert.equal(bp.stack.ngrxSignals, true);
});

test('en full-scaffold el stack SÍ lo escribe el CLI — refleja lo instalado', () => {
    const target = mkdtemp();
    write(target, 'blueprint.json', JSON.stringify({
        name: 'koa-agent-blueprint', version: '6.5.0', generatedAt: '2026-01-01T00:00:00.000Z',
        scaffoldMode: 'full-scaffold',
        stack: { angular: true, tailwind: true, primeng: false, gsap: false, supabase: false, ngrxSignals: false, e2e: false, cursor: false, windsurf: false },
    }));

    writeBlueprintJson(target, 'proyecto', true, FULL_STACK);
    const bp = readBp(target);

    assert.equal(bp.stack.gsap, true);
    assert.equal(bp.stack.primeng, true);
    assert.equal(bp.stack.supabase, true);
});

test('escribe scaffoldMode y elimina el mode legacy', () => {
    const target = mkdtemp();
    write(target, 'blueprint.json', JSON.stringify({
        name: 'koa-agent-blueprint', version: '6.4.0', generatedAt: '2026-01-01T00:00:00.000Z',
        mode: 'full-scaffold',
        stack: { angular: true },
    }));

    writeBlueprintJson(target, 'proyecto', true, FULL_STACK);
    const bp = readBp(target);

    assert.equal(bp.scaffoldMode, 'full-scaffold');
    assert.ok(!('mode' in bp), 'el alias legacy no debe quedar duplicado');
});

test('managedPaths no declara indices/** — ahí escribe Wikiflow', () => {
    const target = mkdtemp();
    writeBlueprintJson(target, 'proyecto', true, FULL_STACK);
    const bp = readBp(target);

    assert.ok(!bp.managedPaths.includes('indices/**'));
    assert.ok(bp.managedPaths.includes('.claude/**'));
    assert.ok(bp.managedPaths.includes('docs/**'));
});

test('un blueprint corrupto no aborta el scaffold', () => {
    const target = mkdtemp();
    write(target, 'blueprint.json', '{ esto no es json');

    writeBlueprintJson(target, 'proyecto', true, FULL_STACK);
    const bp = readBp(target);

    // Ilegible ⇒ no hay nada que preservar: se reescribe entero y sigue siendo válido.
    assert.equal(bp.scaffoldMode, 'full-scaffold');
    assert.equal(bp.name, 'koa-agent-blueprint');
    assert.equal(bp.stack.gsap, true);
    assert.deepEqual(validateBlueprintJson(bp).errors, []);
});

// ─── validateBlueprintJson ───────────────────────────────────────────────────

const baseBp = {
    name: 'koa-agent-blueprint', version: '7.0.0', generatedAt: '2026-08-11T00:00:00.000Z',
    stack: { angular: true },
};

test('acepta scaffoldMode y también el mode legacy', () => {
    assert.ok(validateBlueprintJson({ ...baseBp, scaffoldMode: 'inject-only' }).ok);
    assert.ok(validateBlueprintJson({ ...baseBp, mode: 'inject-only' }).ok);
});

test('exige alguno de los dos', () => {
    const res = validateBlueprintJson(baseBp);
    assert.equal(res.ok, false);
    assert.match(res.errors.join(' '), /scaffoldMode/);
});

test('los campos de Wikiflow son opcionales', () => {
    // Un proyecto arrancado directo con el CLI nunca pasó por las fases.
    assert.ok(validateBlueprintJson({ ...baseBp, scaffoldMode: 'full-scaffold' }).ok);
});

test('valida tier, team y product cuando sí están', () => {
    const bad = validateBlueprintJson({
        ...baseBp, scaffoldMode: 'full-scaffold',
        tier: 'enterprise',
        team: { size: 'dos', horizon6mo: 'exploding' },
        product: { complexity: 'muy-compleja', lifespan: 'eterna' },
    });
    assert.equal(bad.ok, false);
    const msg = bad.errors.join(' | ');
    for (const campo of ['tier', 'team.size', 'team.horizon6mo', 'product.complexity', 'product.lifespan']) {
        assert.match(msg, new RegExp(campo.replace('.', '\\.')), `no reportó ${campo}`);
    }
});

test('acepta el blueprint real de Wikiflow para familiar v2', () => {
    const res = validateBlueprintJson({
        ...baseBp,
        scaffoldMode: 'inject-only',
        tier: 'starter',
        team: { size: 2, horizon6mo: 'stable' },
        product: { complexity: 'domain-heavy', lifespan: 'long-lived' },
        deployment: null,
    });
    assert.deepEqual(res.errors, []);
});
