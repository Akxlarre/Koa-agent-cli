/**
 * lib/installer.js — npm/npx operations
 *
 * Responsabilidades:
 *   - Crear el proyecto Angular base con ng new
 *   - Instalar dependencias npm (condicionales por stack)
 *   - Inicializar Supabase CLI
 *
 * Cada función gestiona su propio spinner y lanza Error si falla.
 * El caller (bin/index.js) maneja cleanup y process.exit.
 */

import chalk from 'chalk';
import fs from 'fs';
import ora from 'ora';
import path from 'path';
import { run, NPM, NPX } from './runner.js';
import { ANGULAR_MAJOR } from './config.js';

/**
 * Lee el rango de `@angular/core` del proyecto recién creado por `ng new`,
 * para instalar los paquetes Angular satélite en el mismo major.
 * Si no se puede determinar, cae a `latest` (comportamiento previo).
 */
function resolveAngularRange(targetDir) {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
        const core = pkg.dependencies?.['@angular/core'];
        const major = core?.match(/(\d+)\./)?.[1];
        return major ? `^${major}.0.0` : 'latest';
    } catch {
        return 'latest';
    }
}

/**
 * Ejecuta `ng new <projectName>` DENTRO de tempParentDir.
 * El proyecto queda en `<tempParentDir>/<projectName>`.
 *
 * El nombre se pasa como argumento POSICIONAL, nunca vía `--name`: el schematic
 * de Angular ignora `--name` y deriva el nombre del posicional, así que pasar un
 * directorio temporal ahí bautizaba al proyecto con el nombre del temporal.
 * Además Angular valida ese nombre contra
 * `^(?:@…/)?[a-zA-Z0-9-~][a-zA-Z0-9-._~]*$`, que rechaza cualquier nombre
 * que empiece con punto — por eso el temporal es el directorio PADRE y no el
 * nombre del proyecto.
 */
export async function createAngularProject(projectName, tempParentDir) {
    const spinner = ora({
        text: chalk.yellow('Creando proyecto Angular (puede tardar 1-2 min)...'),
        color: 'yellow',
    }).start();

    try {
        await run(NPX, [
            '-y',
            `@angular/cli@^${ANGULAR_MAJOR}`,
            'new',
            projectName,
            '--standalone=true',
            '--routing=true',
            '--style=scss',
            '--skip-tests',
            '--skip-git=true',
        ], { cwd: tempParentDir });
        spinner.succeed(chalk.green('Proyecto Angular creado'));
    } catch (e) {
        spinner.fail(chalk.red('Error al ejecutar ng new'));
        console.error('');
        console.error(chalk.gray(e.message));
        console.error('');
        console.error(chalk.yellow('💡 Si el error dice "not available inside a workspace", significa que estás'));
        console.error(chalk.yellow('   intentando crear el proyecto DENTRO de otro workspace de Angular.'));
        console.error(chalk.yellow('   👉 Abre una nueva terminal en tu Escritorio o raíz del disco e inténtalo allí.'));
        throw e;
    }
}

/**
 * Instala dependencias npm en targetDir según el stack activo.
 * Incluye: Tailwind, PrimeNG, Supabase, GSAP, Vitest, NgRx, Playwright (condicionales).
 * Inicializa Supabase CLI si stack.supabase.
 */
export async function installDependencies(targetDir, stack) {
    const spinner = ora({
        text: chalk.yellow('Instalando dependencias (Tailwind, PrimeNG, Supabase...)...'),
        color: 'yellow',
    }).start();

    try {
        // `@angular/animations` debe seguir el mismo major que el Angular que
        // acaba de instalar `ng new`. Sin pinear, npm resuelve el `latest` del
        // paquete —que suele ir un major atrás— y el install aborta con
        // ERESOLVE por conflicto de peer con @angular/common.
        const animationsPkg = `@angular/animations@${resolveAngularRange(targetDir)}`;

        // PrimeNG versiona su major en paralelo al de Angular (PrimeNG 21 ↔ Angular 21)
        // y arrastra @angular/cdk del mismo major. Sin pinear, `latest` va por
        // delante del Angular pineado y rompe la resolución de peers.
        const primengPkgs = stack.primeng
            ? [`primeng@^${ANGULAR_MAJOR}`, `@primeng/themes@^${ANGULAR_MAJOR}`]
            : [];

        const installPkgs = [
            'tailwindcss',
            '@tailwindcss/postcss',
            'postcss',
            animationsPkg,
            'lucide-angular',
            ...primengPkgs,
            // GSAP NO es opcional: el boilerplate depende de él de forma dura
            // (directivas animate-in / card-hover / press-feedback / bento-grid-layout,
            // shimmer de los skeletons, contador animado del KPI card). El flag
            // `--with-gsap` solo elige GSAP vs View Transitions para las
            // transiciones de página; sin el paquete instalado, el proyecto
            // generado ni siquiera compila.
            'gsap',
            ...(stack.supabase ? ['@supabase/supabase-js'] : []),
        ];
        await run(NPM, ['install', ...installPkgs], { cwd: targetDir });

        if (stack.ngrxSignals) {
            await run(NPM, ['install', '@ngrx/signals'], { cwd: targetDir });
            console.log(chalk.green('   ✓ @ngrx/signals instalado'));
        }

        if (stack.e2e) {
            await run(NPM, ['install', '--save-dev', '@playwright/test'], { cwd: targetDir });
            console.log(chalk.green('   ✓ @playwright/test instalado'));
        }

        // `@analogjs/vite-plugin-angular` es el plugin que consume vitest.config.ts;
        // `@analogjs/vitest-angular` es el builder de `ng test`. Hacen falta los dos.
        const devInstallPkgs = [
            'vitest',
            '@analogjs/vite-plugin-angular',
            '@analogjs/vitest-angular',
            'jsdom',
        ];
        await run(NPM, ['install', '--save-dev', ...devInstallPkgs], { cwd: targetDir });
        spinner.succeed(chalk.green('Dependencias instaladas'));

        if (stack.supabase) {
            const spinnerSupabase = ora({
                text: chalk.yellow('Inicializando Supabase...'),
                color: 'yellow',
            }).start();
            try {
                await run(NPX, ['-y', 'supabase', 'init'], { cwd: targetDir });
                spinnerSupabase.succeed(chalk.green('Supabase inicializado'));
            } catch {
                spinnerSupabase.warn(chalk.yellow('No se pudo inicializar Supabase (¿CLI no instalada?)'));
            }
        }
    } catch (e) {
        spinner.fail(chalk.red('Error al instalar dependencias'));
        console.error(chalk.gray(e.message));
        throw e;
    }
}
