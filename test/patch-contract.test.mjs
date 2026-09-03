/**
 * Contrato de los parches del scaffolder — HUE-022.
 *
 * El patrón que había era `if (fs.existsSync(x)) { parchear }`, diecinueve veces,
 * ninguna con `else`. Un `if` sin `else` sobre un archivo que `ng new` dejó de
 * emitir no falla: **no hace nada**, y el proyecto sale distinto de lo que el CLI
 * acaba de decir que generó.
 *
 * La premisa de la auditoría era que «el generador falla ruidoso y una vez». Para
 * la fase de parcheo era falsa, y estos tests son la prueba: se le saca a un
 * proyecto cada uno de los tres archivos sin los cuales no hay proyecto, y se
 * exige que el generador PARE en vez de seguir.
 *
 * `node --test test/*.test.mjs`
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { injectBoilerplate } from '../lib/scaffolder.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = path.join(RAIZ, 'templates');

const STACK = {
    primeng: true, gsap: true, supabase: true,
    ngrxSignals: false, e2e: false, cursor: false, windsurf: false,
};

let proyecto;
let silenciado;

/** Un proyecto con la forma que deja `ng new`, en lo que al scaffolder le importa. */
function comoNgNew(root) {
    fs.mkdirSync(path.join(root, 'src', 'app'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'main.ts'),
        "import { App } from './app/app';\nbootstrapApplication(App, {});\n");
    fs.writeFileSync(path.join(root, 'src', 'index.html'), '<html><head></head><body></body></html>');
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({
        $schema: 'https://json.schemastore.org/tsconfig',
        compilerOptions: { strict: true },
    }, null, 2));
    fs.writeFileSync(path.join(root, 'angular.json'), JSON.stringify({
        projects: {
            demo: {
                architect: {
                    build: {
                        options: { styles: ['src/styles.scss'] },
                        configurations: { production: {} },
                    },
                },
            },
        },
    }, null, 2));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'demo', scripts: {} }, null, 2));
}

const leerJson = (rel) => JSON.parse(fs.readFileSync(path.join(proyecto, rel), 'utf8'));

/** El scaffolder habla por consola; acá solo interesa lo que hace. */
function silenciarConsola() {
    const orig = { log: console.log, warn: console.warn };
    const lineas = [];
    console.log = (...a) => lineas.push(a.join(' '));
    console.warn = (...a) => lineas.push(a.join(' '));
    silenciado = () => { console.log = orig.log; console.warn = orig.warn; };
    return lineas;
}

beforeEach(() => {
    proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-patch-'));
    comoNgNew(proyecto);
});

afterEach(() => {
    if (silenciado) { silenciado(); silenciado = null; }
    fs.rmSync(proyecto, { recursive: true, force: true });
});

describe('EL CAMINO FELIZ — el contrato que el scaffolder promete', () => {
    test('deja los cuatro path aliases en tsconfig.json', () => {
        silenciarConsola();
        injectBoilerplate(TEMPLATES, proyecto, STACK);

        const paths = leerJson('tsconfig.json').compilerOptions.paths;
        for (const alias of ['@core/*', '@shared/*', '@features/*', '@layout/*']) {
            assert.ok(paths[alias], `falta el alias ${alias}`);
        }
    });

    test('y lo hace sobre un tsconfig.json con $schema — el caso que rompía (HUE-020)', () => {
        // Antes del scanner: parseJsonc tiraba, el catch imprimía un ⚠ y seguía.
        // El proyecto salía sin aliases y el boilerplate no compilaba.
        assert.match(fs.readFileSync(path.join(proyecto, 'tsconfig.json'), 'utf8'), /\$schema/);
        silenciarConsola();
        injectBoilerplate(TEMPLATES, proyecto, STACK);
        assert.ok(leerJson('tsconfig.json').compilerOptions.paths['@core/*']);
    });

    test('parchea angular.json: tailwind, Vitest y fileReplacements', () => {
        silenciarConsola();
        injectBoilerplate(TEMPLATES, proyecto, STACK);

        const build = leerJson('angular.json').projects.demo.architect.build;
        assert.ok(build.options.styles.includes('src/tailwind.css'));
        assert.equal(build.options.optimization.styles.inlineCritical, false);
        assert.ok(build.configurations.production.fileReplacements);
        assert.ok(leerJson('angular.json').projects.demo.architect.test);
    });

    test('agrega los scripts a package.json', () => {
        silenciarConsola();
        injectBoilerplate(TEMPLATES, proyecto, STACK);

        const scripts = leerJson('package.json').scripts;
        for (const s of ['test:ci', 'typecheck', 'lint:arch', 'lint:arch:provocar', 'claude:review']) {
            assert.ok(scripts[s], `falta el script ${s}`);
        }
    });
});

describe('LOS TRES REQUERIDOS — sin ellos el generador PARA', () => {
    // Antes seguía adelante y copiaba cuarenta archivos encima de un proyecto que
    // ya no podía compilar. El silencio no era neutral: era el peor resultado.
    const requeridos = [
        ['tsconfig.json', /tsconfig\.json/, 'sin los aliases, el boilerplate no compila'],
        ['angular.json', /angular\.json/, 'sin el parche, no hay tailwind ni target de test'],
        ['package.json', /package\.json/, 'sin scripts, nada de lo que el harness manda correr existe'],
    ];

    for (const [archivo, mensaje, porque] of requeridos) {
        test(`falta ${archivo} → error, no silencio (${porque})`, () => {
            fs.rmSync(path.join(proyecto, archivo));
            silenciarConsola();
            assert.throws(() => injectBoilerplate(TEMPLATES, proyecto, STACK), mensaje);
        });
    }

    test('un tsconfig.json ilegible también para el generador', () => {
        fs.writeFileSync(path.join(proyecto, 'tsconfig.json'), '{ esto no es json');
        silenciarConsola();
        assert.throws(() => injectBoilerplate(TEMPLATES, proyecto, STACK),
            /No se pudo parchear tsconfig\.json/);
    });

    test('el error dice dónde esperaba el archivo', () => {
        fs.rmSync(path.join(proyecto, 'tsconfig.json'));
        silenciarConsola();
        try {
            injectBoilerplate(TEMPLATES, proyecto, STACK);
            assert.fail('debía tirar');
        } catch (e) {
            assert.match(e.message, /Esperado en:/);
            assert.match(e.message, /ng new/);
        }
    });
});

describe('LOS OPCIONALES — se saltean, pero se DICEN', () => {
    test('un parche que no aplica deja una línea, no silencio', () => {
        fs.rmSync(path.join(proyecto, 'src', 'main.ts'));
        const lineas = silenciarConsola();
        injectBoilerplate(TEMPLATES, proyecto, STACK);

        const dicho = lineas.join('\n');
        assert.match(dicho, /main\.ts no está/);
        assert.match(dicho, /se omite/);
    });

    test('y el resto del scaffolding sigue: no es un error', () => {
        fs.rmSync(path.join(proyecto, 'src', 'main.ts'));
        silenciarConsola();
        injectBoilerplate(TEMPLATES, proyecto, STACK);
        assert.ok(leerJson('tsconfig.json').compilerOptions.paths['@core/*']);
    });
});
