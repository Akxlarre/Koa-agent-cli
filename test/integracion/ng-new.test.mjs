/**
 * Integración: el scaffolder contra la salida REAL de `ng new`.
 *
 * ADR-006 §3 / HUE-022. Los parches del scaffolder son diecinueve
 * suposiciones sobre la forma de lo que `ng new` deja, y ninguna estaba
 * verificada contra `ng new` de verdad: los tests de contrato montan un proyecto
 * falso con la forma que creemos que tiene. Si Angular cambia esa forma, un test
 * sobre un proyecto falso sigue en verde y el generado sale roto.
 *
 * NO va en la suite rápida. `ng new` descarga el CLI de Angular y tarda: se corre
 * con `npm run test:integracion`, junto a `lint:arch:provocar` y `smoke:scripts`
 * —los chequeos que este repo ya aceptó que tardan— y por el mismo motivo escrito
 * en docs/CHEQUEOS-QUE-NO-CHEQUEAN.md.
 *
 * Se usa `--skip-install`: lo que se verifica es la FORMA de los archivos de
 * configuración, no que compile. Sin node_modules baja de minutos a segundos y
 * cubre exactamente lo que los parches suponen.
 *
 * Lo que este test NO cubre, para que no se confunda con lo que sí: no genera una
 * feature ni le corre `architect.js` encima (HUE-021). El linter usa la API de
 * TypeScript, así que eso necesita el `npm install` que este test evita a
 * propósito. Sigue abierto y con nombre.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { copyTemplates, injectBoilerplate, writeBlueprintJson } from '../../lib/scaffolder.js';
import { validateBlueprintJson, ANGULAR_MAJOR, parseJsonc } from '../../lib/config.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATES = path.join(RAIZ, 'templates');
const NOMBRE = 'demo-koa';
const STACK = {
    primeng: true, gsap: true, supabase: true,
    ngrxSignals: false, e2e: false, cursor: false, windsurf: false,
};

let padre = null;
let proyecto = null;
let ngNewFuncionó = false;

before(() => {
    padre = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-int-'));
    const r = spawnSync('npx', [
        '-y', `@angular/cli@${ANGULAR_MAJOR}`, 'new', NOMBRE,
        '--style=scss', '--ssr=false', '--skip-git', '--skip-install', '--defaults',
    ], { cwd: padre, encoding: 'utf8', timeout: 10 * 60 * 1000 });

    proyecto = path.join(padre, NOMBRE);
    ngNewFuncionó = r.status === 0 && fs.existsSync(path.join(proyecto, 'angular.json'));

    if (!ngNewFuncionó) {
        // Sin red no se puede verificar nada: se dice, no se aprueba en silencio.
        console.error(`ng new no pudo correr (status ${r.status}). ${(r.stderr || '').slice(0, 400)}`);
        return;
    }

    // El scaffold, tal cual lo hace bin/index.js para un Full Scaffold.
    copyTemplates(TEMPLATES, proyecto, NOMBRE, STACK);
    injectBoilerplate(TEMPLATES, proyecto, STACK);
    writeBlueprintJson(proyecto, NOMBRE, true, STACK);
}, { timeout: 10 * 60 * 1000 });

after(() => {
    if (padre) fs.rmSync(padre, { recursive: true, force: true });
});

const leer = (rel) => fs.readFileSync(path.join(proyecto, rel), 'utf8');
const leerJson = (rel) => JSON.parse(leer(rel));

describe('EL CONTRATO DEL SCAFFOLDER SOBRE UN ng new REAL', () => {
    test('ng new corrió: sin esto, todo lo de abajo pasaría por vacío', () => {
        assert.ok(ngNewFuncionó,
            'no se pudo generar el proyecto Angular — este test necesita red');
    });

    test('los cuatro path aliases quedaron en tsconfig.json', () => {
        // El parche más frágil: `ng new` emite tsconfig.json con dos comentarios
        // de bloque que contienen URLs, y de ahí salió HUE-020.
        const paths = parseJsonc(leer('tsconfig.json')).compilerOptions.paths;
        for (const alias of ['@core/*', '@shared/*', '@features/*', '@layout/*']) {
            assert.ok(paths?.[alias], `falta ${alias}`);
        }
    });

    test('el tsconfig.json real sigue siendo parseable por parseJsonc', () => {
        // Si una versión de ng new mete un $schema o una URL en un valor, la
        // versión vieja de parseJsonc moría acá y el CLI seguía adelante.
        assert.doesNotThrow(() => parseJsonc(leer('tsconfig.json')));
    });

    test('angular.json: tailwind.css, inlineCritical y target de test', () => {
        const angular = leerJson('angular.json');
        const proj = angular.projects[Object.keys(angular.projects)[0]];
        const build = proj.architect.build;

        assert.ok(build.options.styles.includes('src/tailwind.css'));
        assert.equal(build.options.optimization.styles.inlineCritical, false);
        assert.ok(build.configurations.production.fileReplacements,
            'sin esto un build de producción sale con las credenciales de dev');
        assert.ok(proj.architect.test, 'no hay target de test');
    });

    test('package.json trae los scripts que el harness manda correr', () => {
        const scripts = leerJson('package.json').scripts;
        for (const s of ['test:ci', 'typecheck', 'lint:arch', 'lint:arch:test',
            'lint:arch:provocar', 'smoke:scripts', 'claude:test-hooks']) {
            assert.ok(scripts[s], `falta ${s}`);
        }
    });

    test('blueprint.json queda bien formado', () => {
        const bp = leerJson('blueprint.json');
        const v = validateBlueprintJson(bp);
        assert.ok(v.ok, v.errors.join('; '));

        // `name` identifica al BLUEPRINT, no al proyecto: es constante a
        // propósito y así está documentado en MAPA-FUNCIONALIDADES.md. Escribí
        // este test esperando el nombre del proyecto y el que estaba mal era el
        // test — de ahí salió INC-021, que es otra cosa: el parámetro
        // `projectName` que la función acepta y no usa.
        assert.equal(bp.name, 'koa-agent-blueprint');
        assert.equal(bp.scaffoldMode, 'full-scaffold');
        assert.equal(bp.stack.supabase, true);
    });

    test('el .mcp.json sale con el major pineado, no con {{ANGULAR_MAJOR}}', () => {
        const mcp = leer('.mcp.json');
        assert.match(mcp, new RegExp(`@angular/cli@${ANGULAR_MAJOR}`));
        assert.ok(!mcp.includes('{{'), 'quedó una variable de template sin sustituir');
    });

    test('main.ts apunta a AppComponent, no al root que dejó ng new', () => {
        // Desde Angular 21 el root se genera como `app.ts` (clase `App`). Si el
        // parche no aplica, main.ts importa un archivo que el boilerplate borró.
        const main = leer('src/main.ts');
        assert.match(main, /AppComponent/);
        assert.ok(!fs.existsSync(path.join(proyecto, 'src', 'app', 'app.ts')),
            'el root de ng new debía eliminarse');
    });

    test('el harness llegó entero', () => {
        for (const rel of ['.claude/settings.json', '.claude/hooks/pre-write-guard.js',
            'scripts/architect.js', 'CLAUDE.md', 'indices/COMPONENTS.md']) {
            assert.ok(fs.existsSync(path.join(proyecto, rel)), `falta ${rel}`);
        }
    });

    test('no quedó ninguna variable de template sin sustituir en CLAUDE.md', () => {
        assert.ok(!leer('CLAUDE.md').includes('{{'));
        assert.ok(!leer('.claude/CLAUDE.md').includes('{{'));
    });
});
