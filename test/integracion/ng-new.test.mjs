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
 * El segundo bloque sí genera una feature y le corre `architect.js` encima
 * (HUE-021). El linter parsea con la API de TypeScript, y durante un tiempo eso
 * pareció exigir el `npm install` completo que este test evita — pero no: lo
 * único que falta es **un paquete**. Se instala `typescript` en la versión que
 * el propio `package.json` del proyecto declara, y con eso el linter corre.
 *
 * Instalar la versión declarada, y no una fijada acá, es deliberado: el día que
 * Angular mueva su rango de TypeScript a uno que rompa `architect.js`, este test
 * lo dice. Fijarla a mano convertiría ese aviso en silencio.
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
    writeBlueprintJson(proyecto, true, STACK);
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
        // test — de ahí salió INC-021, ya cerrado: la función aceptaba un
        // `projectName` que no usaba, y esa firma es lo que me hizo escribir
        // este test mal. Hoy no lo acepta.
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

// ─── HUE-021: el linter, contra una feature de verdad ───────────────────────

describe('EL LINTER CORRE SOBRE EL PROYECTO GENERADO (HUE-021)', () => {
    // Todo lo de arriba verifica la FORMA de los archivos. Esto verifica que el
    // guardrail principal del blueprint FUNCIONE ahí adentro: `architect.js`
    // tiene 28 reglas y hasta acá nadie lo había corrido nunca sobre la salida
    // real del generador, solo sobre sandboxes armados a mano.

    let typescriptListo = false;

    before(() => {
        if (!ngNewFuncionó) return;

        // La versión que declara el propio proyecto, no una elegida acá.
        const dev = leerJson('package.json').devDependencies || {};
        const rango = dev.typescript;
        if (!rango) return;

        const r = spawnSync('npm', ['install', '--no-save', '--no-audit', '--no-fund',
            `typescript@${rango}`], { cwd: proyecto, encoding: 'utf8', timeout: 5 * 60 * 1000 });
        typescriptListo = r.status === 0
            && fs.existsSync(path.join(proyecto, 'node_modules', 'typescript', 'package.json'));

        if (!typescriptListo) {
            console.error(`no se pudo instalar typescript@${rango} (status ${r.status}). `
                + `${(r.stderr || '').slice(0, 400)}`);
        }
    }, { timeout: 5 * 60 * 1000 });

    /** `architect.js` con el cwd en el proyecto generado, como lo corre el usuario. */
    function lintear() {
        const r = spawnSync('node', [path.join(proyecto, 'scripts', 'architect.js')],
            { cwd: proyecto, encoding: 'utf8', timeout: 3 * 60 * 1000 });
        return { exit: r.status, salida: `${r.stdout || ''}${r.stderr || ''}` };
    }

    /** Escribe un archivo dentro del proyecto, creando su carpeta. */
    function escribir(rel, contenido) {
        const destino = path.join(proyecto, rel);
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.writeFileSync(destino, contenido);
        return destino;
    }

    test('typescript se instaló: sin esto, lo de abajo pasaría por vacío', () => {
        assert.ok(ngNewFuncionó, 'este test necesita red');
        assert.ok(typescriptListo, 'sin typescript, architect.js no puede parsear nada');
    });

    test('el boilerplate que reparte el CLI pasa su propio linter', () => {
        // La afirmación que INC-008 destapó como falsa: durante toda la vida del
        // blueprint, el primer `npm run lint:arch` de cualquier proyecto generado
        // devolvía dos advertencias que el usuario no había causado.
        const { exit, salida } = lintear();
        assert.equal(exit, 0, salida);
        assert.match(salida, /0 errores, 0 advertencias/, salida);
    });

    test('y una feature que viola una regla NO pasa', () => {
        // La otra mitad, y la que importa: que el linter salga en 0 sobre el
        // boilerplate podría significar tanto «está limpio» como «no mira nada».
        escribir('src/app/features/roto/roto.component.ts',
            `import { Component } from '@angular/core';\n`
            + `import { createClient } from '@supabase/supabase-js';\n\n`
            + `@Component({\n`
            + `  selector: 'app-roto',\n`
            + `  standalone: true,\n`
            + `  template: '<p class="text-red-500">x</p>',\n`
            + `})\n`
            + `export class RotoComponent {\n`
            + `  private cliente = createClient('http://x', 'y');\n`
            + `}\n`);

        const { exit, salida } = lintear();
        assert.notEqual(exit, 0, `el linter dejó pasar la feature rota:\n${salida}`);
        assert.match(salida, /\[ARCH-01\]/, 'Supabase en la UI');   // el import
        assert.match(salida, /\[ARCH-04\]/, 'falta OnPush');        // el decorador
        assert.match(salida, /\[ARCH-08\]/, 'color crudo');         // el template

        fs.rmSync(path.join(proyecto, 'src', 'app', 'features', 'roto'),
            { recursive: true, force: true });
    });

    test('la suite de guardrails del linter corre en el proyecto generado', () => {
        // `scripts/lib/*.test.mjs` son los tests de las funciones puras de cada
        // regla. Se corren acá porque acá es donde `typescript` resuelve — que es
        // el motivo por el que en el repo del CLI se saltean.
        const r = spawnSync('node', ['--test', 'scripts/lib/'],
            { cwd: proyecto, encoding: 'utf8', timeout: 5 * 60 * 1000 });
        assert.equal(r.status, 0, `${r.stdout || ''}${r.stderr || ''}`.slice(-2000));
    });

    test('las 28 reglas disparan ante su propia violación, ahí adentro', () => {
        // `provocar-reglas.mjs` con el baseline vacío (DEC-004, HUE-019). Correrlo
        // sobre el proyecto generado prueba algo que el repo del CLI no puede:
        // que los fixtures y el linter que RECIBE el usuario están de acuerdo.
        const r = spawnSync('node', ['scripts/provocar-reglas.mjs'],
            { cwd: proyecto, encoding: 'utf8', timeout: 5 * 60 * 1000 });
        const salida = `${r.stdout || ''}${r.stderr || ''}`;
        assert.equal(r.status, 0, salida.slice(-2000));
        assert.match(salida, /28 regla\(s\) provocadas/, salida.slice(-500));
    });
});
