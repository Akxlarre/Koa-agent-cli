#!/usr/bin/env node

import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

import { resolveStack, validateProjectName, BLUEPRINT_VERSION } from '../lib/config.js';
import { askWhatToBuild, esFullScaffold, applyAiTools } from '../lib/prompts.js';
import { preflight } from '../lib/preflight.js';
import { printBanner, printSuccess } from '../lib/ui.js';
import { copyTemplates, injectBoilerplate, writeBlueprintJson } from '../lib/scaffolder.js';
import { createAngularProject, installDependencies } from '../lib/installer.js';
import { runGenerate } from '../lib/generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.resolve(__dirname, '../templates');

async function main() {
    // ── Subcomando `generate` — se ejecuta dentro de un proyecto KoA existente.
    // No necesita preflight ni resolveStack (no instala nada, no crea proyectos).
    if (process.argv[2] === 'generate') {
        await runGenerate(process.argv.slice(3));
        return;
    }

    const stack = resolveStack();
    await preflight();
    printBanner();

    if (!stack.supabase || !stack.primeng) {
        const disabled = Object.entries({ supabase: stack.supabase, primeng: stack.primeng })
            .filter(([, v]) => !v)
            .map(([k]) => `--no-${k}`)
            .join(' ');
        console.log(chalk.yellow(`ℹ Modo parcial activo: ${disabled}`));
        console.log('');
    }
    if (stack.gsap) {
        console.log(chalk.cyan('ℹ GSAP animations incluido (--with-gsap)'));
        console.log('');
    }

    const answers = await askWhatToBuild();
    applyAiTools(stack, answers.aiTools);

    const isFull = esFullScaffold(answers.action);
    let targetDir = process.cwd();
    let tempDir = null;
    let tempParentDir = null;
    let finalDir = null;

    if (isFull) {
        const validation = validateProjectName(answers.projectName);
        if (!validation.ok) {
            console.error(chalk.red(`Nombre de proyecto inválido: ${validation.reason}`));
            process.exit(1);
        }
        answers.projectName = validation.name;

        finalDir = path.join(process.cwd(), answers.projectName);
        if (fs.existsSync(finalDir)) {
            console.error(chalk.red(`El directorio ya existe: ${finalDir}`));
            process.exit(1);
        }

        // SEC-05: Use cryptographically secure random bytes instead of Math.random()
        // to prevent TOCTOU race conditions on shared/CI systems.
        //
        // El temporal es el directorio PADRE, no el proyecto: `ng new` toma su
        // argumento posicional como nombre del proyecto y rechaza nombres que
        // empiecen con punto. Así el proyecto se llama como corresponde y el
        // scaffold sigue siendo atómico (se renombra recién al final).
        tempParentDir = path.join(process.cwd(), `koa-tmp-${randomBytes(8).toString('hex')}`);
        fs.mkdirSync(tempParentDir, { recursive: true });
        tempDir = path.join(tempParentDir, answers.projectName);
        targetDir = tempDir;

        try {
            await createAngularProject(answers.projectName, tempParentDir);
            await installDependencies(tempDir, stack);
        } catch {
            try { fs.rmSync(tempParentDir, { recursive: true, force: true }); } catch { /* ignore */ }
            process.exit(1);
        }
    }

    const projectName = answers.projectName || path.basename(targetDir);
    const spinnerBlueprint = ora({
        text: chalk.yellow(`Inyectando Koa Blueprint v${BLUEPRINT_VERSION}...`),
        color: 'blue',
    }).start();

    try {
        copyTemplates(TEMPLATES_DIR, targetDir, projectName, stack);
        spinnerBlueprint.succeed(chalk.green('Blueprint inyectado'));

        if (isFull) {
            injectBoilerplate(TEMPLATES_DIR, targetDir, stack);
        }

        if (isFull && tempDir && finalDir) {
            fs.renameSync(tempDir, finalDir);
            targetDir = finalDir;
            // El padre temporal queda vacío tras mover el proyecto.
            try { fs.rmSync(tempParentDir, { recursive: true, force: true }); } catch { /* ignore */ }
        }

        writeBlueprintJson(targetDir, projectName, isFull, stack);
        printSuccess(projectName, isFull, targetDir);
    } catch (err) {
        spinnerBlueprint.fail(chalk.red('Error al inyectar Blueprint'));
        console.error(chalk.gray(err.message));
        try { if (tempParentDir) fs.rmSync(tempParentDir, { recursive: true, force: true }); } catch { /* ignore */ }
        process.exit(1);
    }
}

main();
