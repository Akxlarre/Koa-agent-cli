/**
 * Contrato de `parseJsonc` — HUE-020.
 *
 * La versión anterior eran dos `replace`, y un `replace` no sabe si el `//` que
 * encontró está dentro de comillas. Medido sobre entradas reales antes del
 * arreglo:
 *
 *   { "$schema": "https://json.schemastore.org/tsconfig" }  → Bad control character
 *   { "url": "http://x.com/y" }                             → Unterminated string
 *
 * Y el llamador —el parche de `tsconfig.json`— atrapaba el error, imprimía un `⚠`
 * amarillo y seguía: el proyecto salía sin los path aliases que el boilerplate
 * importa en todos lados. Un proyecto que no compila, detrás de una línea amarilla.
 *
 * `node --test test/*.test.mjs`
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseJsonc, stripJsonComments } from '../lib/config.js';

describe('LO QUE ROMPÍA — un // dentro de un string', () => {
    test('$schema con URL, que es lo que recomienda schemastore', () => {
        const tsconfig = `{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": { "strict": true }
}`;
        const out = parseJsonc(tsconfig);
        assert.equal(out.$schema, 'https://json.schemastore.org/tsconfig');
        assert.equal(out.compilerOptions.strict, true);
    });

    test('cualquier valor con una URL', () => {
        assert.deepEqual(parseJsonc('{ "url": "http://x.com/y" }'), { url: 'http://x.com/y' });
    });

    test('un // literal en medio de un texto', () => {
        assert.deepEqual(parseJsonc('{ "a": "no // es comentario" }'), { a: 'no // es comentario' });
    });

    test('un /* */ literal tampoco', () => {
        assert.deepEqual(parseJsonc('{ "a": "no /* es */ comentario" }'), { a: 'no /* es */ comentario' });
    });

    test('y el caso completo: sin esto, el proyecto sale sin aliases', () => {
        // La forma exacta que tendría un tsconfig.json de `ng new` con $schema.
        const real = `{
  "$schema": "https://json.schemastore.org/tsconfig",
  // Editor: https://code.visualstudio.com/docs/languages/jsconfig
  "compileOnSave": false,
  "compilerOptions": {
    "baseUrl": "./",
    "paths": { "@core/*": ["src/app/core/*"] }
  }
}`;
        const out = parseJsonc(real);
        assert.deepEqual(out.compilerOptions.paths['@core/*'], ['src/app/core/*']);
    });
});

describe('LO QUE YA FUNCIONABA — sigue funcionando', () => {
    const casos = [
        ['comentario de línea', '{\n  // un comentario\n  "a": 1\n}', { a: 1 }],
        ['comentario de bloque', '/* hola */\n{ "a": 1 }', { a: 1 }],
        ['bloque multilínea', '{\n  /* uno\n     dos */\n  "a": 1\n}', { a: 1 }],
        ['comentario al final de línea', '{ "a": 1 } // fin', { a: 1 }],
        ['sin comentarios', '{ "a": [1, 2] }', { a: [1, 2] }],
        ['anidado', '{ "a": { "b": { "c": 1 } } }', { a: { b: { c: 1 } } }],
    ];

    for (const [nombre, texto, esperado] of casos) {
        test(nombre, () => assert.deepEqual(parseJsonc(texto), esperado));
    }
});

describe('ESCAPES — donde un scanner ingenuo se sale del string', () => {
    test('una comilla escapada no cierra el string', () => {
        assert.deepEqual(parseJsonc('{ "a": "dijo \\"hola\\" // no" }'), { a: 'dijo "hola" // no' });
    });

    test('una barra invertida al final del valor sí lo cierra', () => {
        assert.deepEqual(parseJsonc('{ "a": "fin\\\\", "b": 2 }'), { a: 'fin\\', b: 2 });
    });
});

describe('stripJsonComments — la mecánica', () => {
    test('conserva los saltos de línea: los números de línea no se mueven', () => {
        const src = '{\n// uno\n// dos\n"a": 1\n}';
        assert.equal(stripJsonComments(src).split('\n').length, src.split('\n').length);
    });

    test('un bloque sin cerrar no cuelga ni tira', () => {
        assert.equal(stripJsonComments('{ "a": 1 } /* sin cerrar').trim(), '{ "a": 1 }');
    });

    test('entrada vacía o rara no rompe', () => {
        assert.equal(stripJsonComments(''), '');
        assert.equal(stripJsonComments(null), 'null');
    });
});

describe('SIGUE SIENDO JSON — un JSONC inválido tiene que fallar', () => {
    // Un parser que "arregla" la entrada tapa errores reales del archivo.
    for (const [nombre, texto] of [
        ['objeto sin cerrar', '{ "a": 1'],
        ['coma colgante', '{ "a": 1, }'],
        ['comilla simple', "{ 'a': 1 }"],
        ['vacío', ''],
    ]) {
        test(nombre, () => assert.throws(() => parseJsonc(texto)));
    }
});
