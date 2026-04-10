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

/**
 * Ejecuta `ng new` en el directorio padre de tempDir.
 * El nombre del directorio creado es path.basename(tempDir).
 * El nombre del proyecto Angular es projectName.
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
            '@angular/cli@latest',
            'new',
            tmpName,
            '--name',
            projectName,
            '--standalone=true',
            '--routing=true',
            '--style=scss',
            '--skip-tests',
            '--skip-git=true',
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
        const installPkgs = [
            'tailwindcss',
            '@tailwindcss/postcss',
            'postcss',
            '@angular/animations',
            'lucide-angular',
            ...(stack.primeng  ? ['primeng', '@primeng/themes'] : []),
            ...(stack.gsap     ? ['gsap'] : []),
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

        const devInstallPkgs = ['vitest', '@analogjs/vitest-angular', 'jsdom'];
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
