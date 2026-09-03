/**
 * ACO-010 · La frontera entre quién nombra los scripts y quién los audita.
 *
 * `COMPROBACIONES`, en `templates/boilerplate/scripts/lib/smoke-scripts.js`,
 * indexa **por nombre exacto de script de package.json**: `lint:arch`,
 * `typecheck`, `test:ci`. Y esos nombres no se escriben ahí — los escribe
 * `lib/scaffolder.js`, del otro lado de la dualidad del repo.
 *
 * Es la clase de dependencia que se rompe sin ruido. Renombrar un script en el
 * generador deja la entrada del payload huérfana, y una entrada huérfana no
 * hace fallar el smoke: el script cae en `sin-comprobar`, que es informativo.
 * O sea que el chequeo que existe para cazar comandos decorativos se volvería
 * decorativo él mismo, un script por vez, sin que nada se ponga en rojo.
 *
 * Este test es el único lugar del repositorio donde los dos lados se ven. Vive
 * del lado del generador porque es el lado que puede escribir un package.json y
 * saber qué stack lo produjo.
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
import { COMPROBACIONES, comprobacionesHuerfanas }
    from '../templates/boilerplate/scripts/lib/smoke-scripts.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = path.join(RAIZ, 'templates');

/**
 * Los scripts que trae `ng new` y el scaffolder nunca escribe.
 *
 * `build` está en COMPROBACIONES y sale de acá, así que también es una
 * dependencia declarada: si el Angular CLI dejara de generarlo, la comprobación
 * de `build` quedaría huérfana igual que si la renombrara el scaffolder.
 */
const DE_NG_NEW = ['ng', 'start', 'build', 'watch', 'test'];

/** Los que sólo existen con Supabase en el stack. Su ausencia es legítima. */
const CONDICIONALES = ['test:functions'];

let proyecto;
let restaurarConsola;

function comoNgNew(root) {
    fs.mkdirSync(path.join(root, 'src', 'app'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'main.ts'),
        "import { App } from './app/app';\nbootstrapApplication(App, {});\n");
    fs.writeFileSync(path.join(root, 'src', 'index.html'), '<html><head></head><body></body></html>');
    fs.writeFileSync(path.join(root, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { strict: true } }, null, 2));
    fs.writeFileSync(path.join(root, 'angular.json'), JSON.stringify({
        projects: { demo: { architect: { build: { options: { styles: [] }, configurations: { production: {} } } } } },
    }, null, 2));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
        name: 'demo',
        scripts: Object.fromEntries(DE_NG_NEW.map((n) => [n, `ng ${n}`])),
    }, null, 2));
}

function silenciarConsola() {
    const orig = { log: console.log, warn: console.warn };
    console.log = () => {};
    console.warn = () => {};
    restaurarConsola = () => { console.log = orig.log; console.warn = orig.warn; };
}

/** Los scripts que un proyecto realmente generado termina teniendo. */
function scriptsGenerados(stack) {
    silenciarConsola();
    injectBoilerplate(TEMPLATES, proyecto, stack);
    return JSON.parse(fs.readFileSync(path.join(proyecto, 'package.json'), 'utf8')).scripts;
}

const STACK = {
    primeng: true, gsap: true, supabase: true,
    ngrxSignals: false, e2e: false, cursor: false, windsurf: false,
};

beforeEach(() => {
    proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-smoke-'));
    comoNgNew(proyecto);
});

afterEach(() => {
    if (restaurarConsola) { restaurarConsola(); restaurarConsola = null; }
    fs.rmSync(proyecto, { recursive: true, force: true });
});

describe('ACO-010 — el smoke audita los scripts que el generador escribe', () => {
    test('con el stack completo, ninguna comprobación queda sin dueño', () => {
        const huerfanas = comprobacionesHuerfanas(scriptsGenerados(STACK));
        assert.deepEqual(huerfanas, [],
            'COMPROBACIONES nombra un script que ningún proyecto generado tiene: '
          + 'o alguien lo renombró en lib/scaffolder.js, o la entrada sobra');
    });

    test('sin Supabase, lo único huérfano es lo que Supabase aporta', () => {
        // La distinción importa: `test:functions` ausente es un proyecto sin
        // edge functions, no una tabla desactualizada. Cualquier otro nombre
        // en esta lista sí sería el bug.
        const huerfanas = comprobacionesHuerfanas(scriptsGenerados({ ...STACK, supabase: false }));
        assert.deepEqual(huerfanas.sort(), [...CONDICIONALES].sort());
    });

    test('los tres que provocan un defecto existen: son los que más importa no perder', () => {
        // Los de modo `contar` que se pierden degradan a `sin-comprobar`, que se
        // ve. Los de modo `provocar` son los que responden la pregunta cara
        // —«¿falla cuando algo está mal?»—, y son los que este repo escribió
        // por haber encontrado un `tsc` que compilaba cero archivos.
        const scripts = scriptsGenerados(STACK);
        for (const [nombre, c] of Object.entries(COMPROBACIONES)) {
            if (c.modo !== 'provocar') continue;
            assert.ok(nombre in scripts, `${nombre} no existe en el proyecto generado`);
        }
    });

    test('el detector detecta: un script renombrado deja su comprobación huérfana', () => {
        // Sin esto, los tres de arriba pasarían igual con `comprobacionesHuerfanas`
        // devolviendo siempre [].
        const scripts = scriptsGenerados(STACK);
        delete scripts['lint:arch'];
        scripts['lint:architecture'] = 'node scripts/lint-arch-wrapper.js';
        assert.deepEqual(comprobacionesHuerfanas(scripts), ['lint:arch']);
    });
});
