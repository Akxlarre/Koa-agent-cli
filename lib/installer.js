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
import ora from 'ora';
import path from 'path';
import { run, NPM, NPX } from './runner.js';
import { ANGULAR_CLI_VERSION } from './config.js';

/**
 * Ejecuta `ng new` en el directorio padre de tempDir.
 * El proyecto se llama projectName y se crea en path.basename(tempDir)
 * via --directory: el nombre posicional debe pasar la validación de schema
 * de ng new (rechaza el prefijo "." del directorio temporal), el directorio no.
 * --defaults evita que prompts interactivos nuevos de ng new cuelguen el
 * spawn (stdio pipe, sin TTY).
 */
export async function createAngularProject(projectName, tempDir) {
    const tmpName = path.basename(tempDir);
    const spinner = ora({
        text: chalk.yellow('Creando proyecto Angular (puede tardar 1-2 min)...'),
        color: 'yellow',
    }).start();

    try {
        await run(NPX, [
            '-y',
            `@angular/cli@${ANGULAR_CLI_VERSION}`,
            'new',
            projectName,
            '--directory',
            tmpName,
            '--standalone=true',
            '--routing=true',
            '--style=scss',
            '--skip-tests',
            '--skip-git=true',
            '--defaults',
        ]);
        spinner.succeed(chalk.green('Proyecto Angular creado'));
    } catch (e) {
        spinner.fail(chalk.red('Error al ejecutar ng new'));
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
        // Los paquetes del ecosistema Angular alinean su major con el de Angular
        // (PrimeNG 20 ↔ Angular 20, NgRx 20 ↔ Angular 20). Pinearlos al mismo
        // major que ANGULAR_CLI_VERSION evita ERESOLVE cuando upstream publica
        // majors nuevos (ej: @angular/animations@21 peer-conflicta con core@20).
        const ngMajor = ANGULAR_CLI_VERSION;
        // gsap NO es condicional: el boilerplate depende de él (directivas
        // animate-in/card-hover/press-feedback, theme.service, kpi-card, layout).
        // stack.gsap solo controla la estrategia de animación de rutas
        // (GSAP-first vs withViewTransitions — ver scaffolder.js paso 8).
        const installPkgs = [
            'tailwindcss@^4',
            '@tailwindcss/postcss@^4',
            'postcss',
            `@angular/animations@^${ngMajor}`,
            'lucide-angular',
            'gsap@^3',
            ...(stack.primeng  ? [`primeng@^${ngMajor}`, `@primeng/themes@^${ngMajor}`] : []),
            ...(stack.supabase ? ['@supabase/supabase-js@^2'] : []),
        ];
        await run(NPM, ['install', ...installPkgs], { cwd: targetDir });

        if (stack.ngrxSignals) {
            await run(NPM, ['install', `@ngrx/signals@^${ngMajor}`], { cwd: targetDir });
            console.log(chalk.green('   ✓ @ngrx/signals instalado'));
        }

        if (stack.e2e) {
            await run(NPM, ['install', '--save-dev', '@playwright/test'], { cwd: targetDir });
            console.log(chalk.green('   ✓ @playwright/test instalado'));
        }

        // vitest pineado a ^3: @angular/build@20 declara peerOptional vitest@^3.1.1.
        // Con vitest@4 el scaffold instala, pero cualquier `npm install` posterior
        // del usuario falla con ERESOLVE.
        const devInstallPkgs = ['vitest@^3', '@analogjs/vitest-angular@^2', 'jsdom'];
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
