/**
 * Los cuatro chicos de ADR-006 §5 — donde el generador se contradice a sí mismo.
 *
 * No son un bug cada uno: son cuatro sitios donde el CLI dice una cosa y hace
 * otra, y ninguno falla al hacerlo.
 *
 * `node --test test/*.test.mjs`
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateProjectName, ANGULAR_MAJOR } from '../lib/config.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

describe('INC-012 — los nombres reservados de Windows se rechazan SIEMPRE', () => {
    // Se validaban solo `process.platform === 'win32'`. Un proyecto llamado `aux`
    // generado en Linux se crea sin problema y revienta al clonarlo en la máquina
    // del compañero, que es donde el error ya no tiene arreglo barato.
    const reservados = ['con', 'prn', 'aux', 'nul', 'com1', 'com9', 'lpt1', 'lpt9'];

    for (const nombre of reservados) {
        test(`${nombre} se rechaza corriendo en ${process.platform}`, () => {
            const r = validateProjectName(nombre);
            assert.equal(r.ok, false);
            assert.match(r.reason, /reservado en Windows/);
        });
    }

    test('el chequeo no depende de la plataforma', () => {
        const src = leer('lib/config.js');
        const linea = src.split('\n').find((l) => l.includes('windowsReserved.has(lower)'));
        assert.ok(linea, 'no se encontró el chequeo');
        assert.ok(!linea.includes('win32'),
            'el nombre viaja con el repo; la plataforma de quien lo generó, no');
    });

    test('y no se lleva puesto un nombre legítimo', () => {
        for (const nombre of ['mi-app', 'console', 'auxiliar', 'com', 'lpt']) {
            assert.equal(validateProjectName(nombre).ok, true, nombre);
        }
    });
});

describe('INC-018 — el CLI cumple su propia regla sobre @latest', () => {
    // `lib/config.js` prohíbe `@angular/cli@latest` con tres párrafos, y el
    // .mcp.json que el CLI reparte lo usaba.
    const mcp = leer('templates/.mcp.json');

    test('el servidor MCP de Angular no usa @latest', () => {
        assert.ok(!/["@]angular\/cli@latest/.test(mcp),
            'es exactamente lo que lib/config.js prohíbe con más énfasis que ninguna otra cosa');
    });

    test('sale de la misma constante que usa ng new', () => {
        assert.match(mcp, /@angular\/cli@\{\{ANGULAR_MAJOR\}\}/,
            'hardcodear el número lo deja divergir de ANGULAR_MAJOR en silencio');
    });

    test('el scaffolder sustituye la variable en .mcp.json', () => {
        const scaffolder = leer('lib/scaffolder.js');
        assert.match(scaffolder, /injectVars\(path\.join\(targetDir, '\.mcp\.json'\)/,
            'una variable en un archivo que nadie procesa queda literal en el proyecto');
        assert.match(scaffolder, /ANGULAR_MAJOR/);
    });

    test('ANGULAR_MAJOR es un número, no una etiqueta móvil', () => {
        assert.equal(typeof ANGULAR_MAJOR, 'number');
    });
});

describe('INC-011 — bin/index.js cabe en su propio techo', () => {
    // El techo lo declara .claude/rules/cli-architecture.md, que escribió este
    // mismo repo sobre sí mismo. Tenía 169 líneas.
    const TECHO = 150;

    test(`bin/index.js ≤ ${TECHO} líneas`, () => {
        const lineas = leer('bin/index.js').split('\n').length;
        assert.ok(lineas <= TECHO, `${lineas} líneas: extraé a lib/, o cambiá la regla a propósito`);
    });

    test('el techo del test es el que declara la regla', () => {
        // Si alguien sube el número en la regla y no acá, este test miente.
        assert.match(leer('.claude/rules/cli-architecture.md'), new RegExp(`~?${TECHO} líneas`));
    });

    test('bin/index.js ya no arma prompts: eso es de lib/prompts.js', () => {
        assert.ok(!leer('bin/index.js').includes("from 'inquirer'"),
            'el entry point orquesta; de dónde salen las respuestas es otra decisión');
    });
});

describe('INC-013 — la corrección del singular existe en los dos modos', () => {
    // El docblock de `deriveSingular` se defendía con «el usuario siempre puede
    // corregir en el prompt interactivo». En modo no-interactivo no hay prompt:
    // `categories` salía como `Categorie` en siete archivos, sin recurso.
    const gen = leer('lib/generator.js');

    test('parseFeatureArgs acepta --singular', () => {
        assert.match(gen, /args\[i\] === '--singular'/);
    });

    test('valida que sea PascalCase', () => {
        assert.match(gen, /--singular inválido/);
    });

    test('y cuando no se pasa, dice qué nombre derivó', () => {
        assert.match(gen, /Modelo derivado del plural/);
        assert.match(gen, /--singular <Nombre>/);
    });

    test('el docblock ya no promete una corrección que no existía', () => {
        const doc = gen.slice(gen.indexOf('Deriva el singular'), gen.indexOf('function deriveSingular'));
        assert.ok(!/el prompt permite corregirlo/.test(doc),
            'esa era la mitigación que el modo no-interactivo no tenía');
    });
});
