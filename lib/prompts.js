/**
 * lib/prompts.js — De dónde salen las respuestas
 *
 * SOLO inquirer y las variables de entorno de test. Sin FS, sin spawn, sin
 * lógica de scaffolding: qué se hace con las respuestas es de `bin/index.js`.
 *
 * INC-011. `bin/index.js` tenía 169 líneas contra el techo de ~150 que declara
 * `.claude/rules/cli-architecture.md` — una regla que este repo se escribió a sí
 * mismo y no cumplía. De lo que había ahí, esto es lo único que no es
 * orquestación: **cómo se obtienen las respuestas** es una decisión aparte de
 * **qué se hace con ellas**, y se nota en que tiene tres implementaciones
 * (interactiva y dos modos de test) que a la orquestación no le importan.
 */

import path from 'path';
import inquirer from 'inquirer';

import { validateProjectName } from './config.js';

/** Las dos acciones del CLI. El texto es el contrato con `answers.action`. */
export const ACCION_FULL = 'Full Scaffold (Angular + Tailwind + Supabase + Boilerplate AI)';
export const ACCION_INJECT = 'Solo inyectar Memoria Koa Blueprint en carpeta actual';

/**
 * Pregunta qué generar. En modo test no pregunta: devuelve la respuesta fijada.
 *
 * @returns {Promise<{ action: string, projectName?: string, aiTools?: string[] }>}
 */
export async function askWhatToBuild() {
    if (process.env.TEST_MODE === 'inject') {
        return { action: ACCION_INJECT };
    }
    if (process.env.TEST_MODE) {
        return {
            action: ACCION_FULL,
            projectName: process.env.TEST_PROJECT_NAME || 'test-project',
        };
    }

    return inquirer.prompt([
        {
            type: 'rawlist',
            name: 'action',
            message: '¿Qué deseas hacer?',
            choices: [ACCION_FULL, ACCION_INJECT],
        },
        {
            type: 'input',
            name: 'projectName',
            message: '¿Cuál es el nombre del proyecto?',
            default: path.basename(process.cwd()),
            when: (ans) => esFullScaffold(ans.action),
            validate: (input) => {
                const res = validateProjectName(input);
                return res.ok ? true : res.reason;
            },
            filter: (input) => String(input ?? '').trim(),
        },
        {
            type: 'checkbox',
            name: 'aiTools',
            message: '¿Qué otros AI tools usarás? (Claude Code ya está incluido)',
            choices: [
                { name: 'Cursor  (.cursor/rules/*.mdc)', value: 'cursor' },
                { name: 'Windsurf (.windsurf/rules/*.md)', value: 'windsurf' },
            ],
            default: [],
        },
    ]);
}

/**
 * ¿La acción elegida es un scaffold completo?
 *
 * Se compara por substring y no por igualdad porque el texto de la opción cambió
 * más de una vez —«Angular 20 + PrimeNG + Supabase» vivió meses en la rama de
 * test mientras el prompt real decía otra cosa— y el CLI seguía funcionando.
 */
export function esFullScaffold(action) {
    return Boolean(action?.includes('Full Scaffold'));
}

/** Las selecciones del prompt se suman al stack; los flags ya ganaron en resolveStack. */
export function applyAiTools(stack, aiTools) {
    for (const tool of aiTools ?? []) {
        if (tool === 'cursor') stack.cursor = true;
        if (tool === 'windsurf') stack.windsurf = true;
    }
    return stack;
}
