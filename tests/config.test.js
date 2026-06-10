/**
 * tests/config.test.js — Tests unitarios de lib/config.js (node:test)
 *
 * Cubre la lógica pura sin filesystem: validación de nombres,
 * parseo de versiones, JSONC y schema de blueprint.json.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    validateProjectName,
    parseMajor,
    parseJsonc,
    validateBlueprintJson,
    BLUEPRINT_VERSION,
    ANGULAR_CLI_VERSION,
} from '../lib/config.js';

test('validateProjectName acepta kebab-case válido', () => {
    const res = validateProjectName('mi-app-2');
    assert.equal(res.ok, true);
    assert.equal(res.name, 'mi-app-2');
});

test('validateProjectName recorta espacios', () => {
    const res = validateProjectName('  mi-app  ');
    assert.equal(res.ok, true);
    assert.equal(res.name, 'mi-app');
});

test('validateProjectName rechaza vacío, mayúsculas, inicio numérico y guiones dobles', () => {
    assert.equal(validateProjectName('').ok, false);
    assert.equal(validateProjectName('MiApp').ok, false);
    assert.equal(validateProjectName('9app').ok, false);
    assert.equal(validateProjectName('mi--app').ok, false);
});

test('validateProjectName rechaza nombres de más de 214 caracteres', () => {
    assert.equal(validateProjectName('a'.repeat(215)).ok, false);
    assert.equal(validateProjectName('a'.repeat(214)).ok, true);
});

test('parseMajor extrae el major con y sin prefijo v', () => {
    assert.equal(parseMajor('v20.1.0'), 20);
    assert.equal(parseMajor('22.22.2'), 22);
    assert.equal(parseMajor('garbage'), null);
});

test('parseJsonc elimina comentarios de bloque y de línea', () => {
    const jsonc = `{
        /* comentario de bloque */
        "a": 1, // comentario de línea
        "b": [2, 3]
    }`;
    assert.deepEqual(parseJsonc(jsonc), { a: 1, b: [2, 3] });
});

test('validateBlueprintJson acepta un blueprint canónico', () => {
    const res = validateBlueprintJson({
        name: 'koa-agent-blueprint',
        version: BLUEPRINT_VERSION,
        generatedAt: new Date().toISOString(),
        mode: 'full-scaffold',
        stack: { angular: true, tailwind: true, primeng: true, gsap: false, supabase: true },
    });
    assert.equal(res.ok, true, res.errors.join('; '));
});

test('validateBlueprintJson reporta campos faltantes, mode inválido y tipos de stack', () => {
    const res = validateBlueprintJson({ mode: 'partial', stack: { primeng: 'yes' } });
    assert.equal(res.ok, false);
    assert.ok(res.errors.some(e => e.includes('"name"')));
    assert.ok(res.errors.some(e => e.includes('mode inválido')));
    assert.ok(res.errors.some(e => e.includes('stack.primeng')));
});

test('ANGULAR_CLI_VERSION es un major pineado, no "latest"', () => {
    assert.match(ANGULAR_CLI_VERSION, /^\d+$/);
});
