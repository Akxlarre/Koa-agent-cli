#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const BLUEPRINT_VERSION = '6.1.0';
const MIN_NODE_MAJOR = 20;
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// Parse JSONC (JSON with comments) — strips // and /* */ comments before parsing
function parseJsonc(text) {
    const stripped = text
        .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
        .replace(/\/\/.*$/gm, '');           // line comments
    return JSON.parse(stripped);
}

function validateProjectName(name) {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) return { ok: false, reason: 'El nombre no puede estar vacío.' };
    if (trimmed.length > 214) return { ok: false, reason: 'Máximo 214 caracteres.' };
    if (!/^[a-z][a-z0-9-]*$/.test(trimmed)) {
        return { ok: false, reason: 'Usa minúsculas, números y guiones. Debe empezar con letra.' };
    }
    if (trimmed.includes('--')) return { ok: false, reason: 'No se permiten guiones consecutivos ("--").' };

    const lower = trimmed.toLowerCase();
    const windowsReserved = new Set([
        'con', 'prn', 'aux', 'nul',
        'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
        'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
    ]);
    if (process.platform === 'win32' && windowsReserved.has(lower)) {
        return { ok: false, reason: 'Nombre reservado en Windows (CON/PRN/AUX/NUL/COM1…/LPT1…).'}; 
    }

    return { ok: true, name: trimmed };
}

function parseMajor(versionLike) {
    const m = String(versionLike ?? '').trim().match(/^v?(\d+)\./);
    return m ? Number(m[1]) : null;
}

/**
 * Parse stack flags from process.argv.
 * - --no-supabase / --no-primeng: opt-out (default: enabled)
 * - --with-gsap: opt-in (default: disabled). --no-gsap kept as alias for compatibility.
 * - --with-ngrx-signals: opt-in NgRx Signal Store (default: disabled)
 * - --with-e2e: opt-in Playwright E2E testing (default: disabled)
 * Returns { supabase, gsap, primeng, ngrxSignals, e2e }.
 */
function parseCliFlags() {
    const args = process.argv.slice(2);
    return {
        supabase:     !args.includes('--no-supabase'),
        gsap:         args.includes('--with-gsap') && !args.includes('--no-gsap'),
        primeng:      !args.includes('--no-primeng'),
        ngrxSignals:  args.includes('--with-ngrx-signals'),
        e2e:          args.includes('--with-e2e'),
    };
}

/**
 * Read optional koa-config.json from cwd and merge with cliFlags.
 * koa-config.json can contain: { "stack": { "supabase": false, "gsap": false, "primeng": false } }
 */
function readKoaConfig(cliFlags) {
    const configPath = path.join(process.cwd(), 'koa-config.json');
    let fileFlags = {};
    if (fs.existsSync(configPath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (raw.stack && typeof raw.stack === 'object') fileFlags = raw.stack;
        } catch {
            console.warn(chalk.yellow('⚠ No se pudo parsear koa-config.json — usando valores por defecto.'));
        }
    }
    return {
        supabase:    (fileFlags.supabase    ?? true)  && cliFlags.supabase,
        gsap:        (fileFlags.gsap        ?? false) || cliFlags.gsap,
        primeng:     (fileFlags.primeng     ?? true)  && cliFlags.primeng,
        ngrxSignals: (fileFlags.ngrxSignals ?? false) || cliFlags.ngrxSignals,
        e2e:         (fileFlags.e2e         ?? false) || cliFlags.e2e,
    };
}

function checkCommand(cmd, args = [], { fatal = false, label = cmd, timeoutMs } = {}) {
    return new Promise((resolve) => {
        const proc = spawn(cmd, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: process.platform === 'win32',
        });
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', d => { stdout += d.toString(); });
        proc.stderr.on('data', d => { stderr += d.toString(); });

        let timeout;
        if (timeoutMs) {
            timeout = setTimeout(() => {
                proc.kill();
                resolve({ ok: !fatal, label, stdout: stdout.trim(), stderr: (stderr || 'timeout').trim(), timedOut: true });
            }, timeoutMs);
        }

        proc.on('close', (code) => {
            if (timeout) clearTimeout(timeout);
            const ok = code === 0;
            resolve({ ok: ok || !fatal, label, stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code });
        });
        proc.on('error', (err) => {
            if (timeout) clearTimeout(timeout);
            resolve({ ok: !fatal, label, stdout: stdout.trim(), stderr: String(err?.message || err).trim(), error: err });
        });
    });
}

async function preflight() {
    const major = parseMajor(process.versions.node);
    if (!major || major < MIN_NODE_MAJOR) {
        console.error(chalk.red(`Node.js ${MIN_NODE_MAJOR}+ requerido. Detectado: ${process.versions.node}`));
        process.exit(1);
    }

    const npmRes = await checkCommand(NPM, ['--version'], { fatal: true, label: 'npm --version' });
    if (!npmRes.ok) {
        console.error(chalk.red(`Falta npm o no es ejecutable. Detalle: ${npmRes.stderr || 'desconocido'}`));
        process.exit(1);
    }

    const npxRes = await checkCommand(NPX, ['--version'], { fatal: true, label: 'npx --version' });
    if (!npxRes.ok) {
        console.error(chalk.red(`Falta npx o no es ejecutable. Detalle: ${npxRes.stderr || 'desconocido'}`));
        process.exit(1);
    }

    const gitRes = await checkCommand('git', ['--version'], { fatal: false, label: 'git --version' });
    if (!gitRes.ok) {
        console.warn(chalk.yellow('⚠ git no está disponible. Se recomienda instalarlo para versionar tu proyecto.'));
    }

    const dockerRes = await checkCommand('docker', ['info'], { fatal: false, label: 'docker info', timeoutMs: 3000 });
    if (!dockerRes.ok) {
        console.warn(chalk.yellow('⚠ docker no está disponible o no responde (ok si no usarás contenedores).'));
    }
}

// Run a command asynchronously so ora can animate freely
function run(cmd, args, opts = {}) {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, { ...opts, stdio: 'pipe', shell: process.platform === 'win32' });
        let stderr = '';
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('close', code => {
            if (code !== 0) reject(new Error(stderr.trim() || `Exit code ${code}`));
            else resolve();
        });
        proc.on('error', reject);
    });
}

// Resolving __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.resolve(__dirname, '../templates');

function printBanner() {
    const border = chalk.blue('║');
    const topBottom = chalk.blue;
    console.log('');
    console.log(topBottom('╔══════════════════════════════════════════════╗'));
    console.log(`${border}                                              ${border}`);
    console.log(`${border}   ${chalk.white.bold(`🧠  Koa Agent CLI  ·  Blueprint v${BLUEPRINT_VERSION}`)}   ${border}`);
    console.log(`${border}   ${chalk.blue('Angular · Tails · Supabase · AI-Native')}  ${border}`);
    console.log(`${border}                                              ${border}`);
    console.log(topBottom('╚══════════════════════════════════════════════╝'));
    console.log('');
}

function printSuccess(projectName, isFull, targetDir) {
    const line = chalk.blue('──────────────────────────────────────────────');
    console.log('');
    console.log(line);
    console.log(`  ${chalk.green('✅')}  ${chalk.white.bold(projectName)} ${chalk.blue('·')} ${chalk.white(`Koa Blueprint v${BLUEPRINT_VERSION} inyectado`)}`);
    console.log(line);
    console.log('');
    console.log(chalk.white.bold('  Próximos pasos:'));
    console.log('');

    let step = 1;

    if (isFull) {
        console.log(`  ${chalk.blue.bold(step)}  ${chalk.cyan(`cd ${projectName}`)}`);
        console.log('');
        step++;
    }

    console.log(`  ${chalk.blue.bold(step)}  ${chalk.white('Configura Supabase MCP')}  ${chalk.gray('(opcional pero recomendado)')}`);
    console.log(`     ${chalk.gray('→')} Edita ${chalk.cyan('.mcp.json')}`);
    console.log(`     ${chalk.gray('→')} Obtén tu token en: ${chalk.cyan('supabase.com/dashboard/account/tokens')}`);
    console.log(`     ${chalk.gray('→')} Reemplaza ${chalk.yellow('YOUR_SUPABASE_PERSONAL_ACCESS_TOKEN')}`);
    console.log('');
    step++;

    if (isFull) {
        console.log(`  ${chalk.blue.bold(step)}  ${chalk.white('Inicia el servidor')}`);
        console.log(`     ${chalk.gray('→')} ${chalk.cyan('ng serve')}`);
        console.log('');
        step++;
    }

    console.log(`  ${chalk.blue.bold(step)}  ${chalk.white('Abre tu Terminal Agéntica (Claude Code) y escribe:')}`);
    console.log(`     ${chalk.cyan.italic('"Aplica las convenciones de CLAUDE.md y prepara el entorno."')}`);
    console.log('');

    if (isFull) {
        console.log(`  ${chalk.white('Shortcuts disponibles:')}`);
        console.log(`     ${chalk.cyan('npm run claude:review')}   ${chalk.gray('Auditoría de arquitectura')}`);
        console.log(`     ${chalk.cyan('npm run claude:sync')}     ${chalk.gray('Sincroniza índices del proyecto')}`);
        console.log(`     ${chalk.cyan('npm run claude:fix')}      ${chalk.gray('Corrige errores de lint automáticamente')}`);
        console.log('');
    }

    console.log(line);
    console.log('');
}

async function main() {
    // Resolve stack flags (CLI args + optional koa-config.json)
    const stack = readKoaConfig(parseCliFlags());

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

    let answers;
    if (process.env.TEST_MODE === 'inject') {
        answers = { action: 'Solo inyectar Memoria Claude en carpeta actual' };
    } else if (process.env.TEST_MODE) {
        answers = {
            action: 'Full Scaffold (Angular 20 + PrimeNG + Supabase)',
            projectName: process.env.TEST_PROJECT_NAME || 'test-project'
        };
    } else {
        answers = await inquirer.prompt([
            {
                type: 'rawlist',
                name: 'action',
                message: '¿Qué deseas hacer?',
                choices: [
                    'Full Scaffold (Angular + Tailwind + Supabase + Boilerplate AI)',
                    'Solo inyectar Memoria Koa Blueprint en carpeta actual'
                ]
            },
            {
                type: 'input',
                name: 'projectName',
                message: '¿Cuál es el nombre del proyecto?',
                default: path.basename(process.cwd()),
                when: (ans) => ans.action.includes('Full Scaffold'),
                validate: (input) => {
                    const res = validateProjectName(input);
                    return res.ok ? true : res.reason;
                },
                filter: (input) => String(input ?? '').trim()
            }
        ]);
    }

    const isFull = answers.action && answers.action.includes('Full Scaffold');
    let targetDir = process.cwd();
    let finalDir = null;
    let tempDir = null;

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

        const tmpName =
            `.koa-tmp-${answers.projectName}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
        tempDir = path.join(process.cwd(), tmpName);
        targetDir = tempDir;

        // --- Spinner: ng new ---
        const spinnerNg = ora({
            text: chalk.yellow('Creando proyecto Angular (puede tardar 1-2 min)...'),
            color: 'yellow'
        }).start();

        try {
            await run(NPX, [
                '-y',
                '@angular/cli@latest',
                'new',
                tmpName,
                '--name',
                answers.projectName,
                '--standalone=true',
                '--routing=true',
                '--style=scss',
                '--skip-tests',
                '--skip-git=true',
            ]);
            spinnerNg.succeed(chalk.green('Proyecto Angular creado'));
        } catch (e) {
            spinnerNg.fail(chalk.red('Error al ejecutar ng new'));
            console.error('');
            console.error(chalk.yellow('💡 Si el error dice "not available inside a workspace", significa que estás'));
            console.error(chalk.yellow('   intentando crear el proyecto DENTRO de otro workspace de Angular.'));
            console.error(chalk.yellow('   👉 Abre una nueva terminal en tu Escritorio o raíz del disco e inténtalo allí.'));
            try { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
            process.exit(1);
        }

        // --- Spinner: npm install ---
        const spinnerNpm = ora({
            text: chalk.yellow('Instalando dependencias (Tailwind, PrimeNG, Supabase...)...'),
            color: 'yellow'
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

            // Optional: NgRx Signal Store
            if (stack.ngrxSignals) {
                await run(NPM, ['install', '@ngrx/signals'], { cwd: targetDir });
                console.log(chalk.green('   ✓ @ngrx/signals instalado'));
            }

            // Optional: Playwright E2E
            if (stack.e2e) {
                await run(NPM, ['install', '--save-dev', '@playwright/test'], { cwd: targetDir });
                console.log(chalk.green('   ✓ @playwright/test instalado'));
            }

            // Install Vitest devDependencies (Angular 21+ test runner)
            const devInstallPkgs = ['vitest', '@analogjs/vitest-angular', 'jsdom'];
            await run(NPM, ['install', '--save-dev', ...devInstallPkgs], { cwd: targetDir });
            spinnerNpm.succeed(chalk.green('Dependencias instaladas'));

            // Initialize Supabase (only if supabase is enabled)
            if (stack.supabase) {
                const spinnerSupabase = ora({
                    text: chalk.yellow('Inicializando Supabase...'),
                    color: 'yellow'
                }).start();
                try {
                    await run(NPX, ['-y', 'supabase', 'init'], { cwd: targetDir });
                    spinnerSupabase.succeed(chalk.green('Supabase inicializado'));
                } catch (e) {
                    spinnerSupabase.warn(chalk.yellow('No se pudo inicializar Supabase (¿CLI no instalada?)'));
                }
            }
        } catch (e) {
            spinnerNpm.fail(chalk.red('Error al instalar dependencias'));
            console.error(chalk.gray(e.message));
            try { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
            process.exit(1);
        }
    }

    // --- Spinner: template injection ---
    const spinnerBlueprint = ora({
        text: chalk.yellow(`Inyectando Koa Blueprint v${BLUEPRINT_VERSION}...`),
        color: 'blue'
    }).start();

    // Recursive copy helper
    const copyRecursiveSync = (src, dest) => {
        const exists = fs.existsSync(src);
        const stats = exists && fs.statSync(src);
        const isDirectory = exists && stats.isDirectory();

        if (isDirectory) {
            if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
            fs.readdirSync(src).forEach(childItemName => {
                let destName = childItemName;
                if (childItemName === 'gitignore.template') destName = '.gitignore';
                copyRecursiveSync(path.join(src, childItemName), path.join(dest, destName));
            });
        } else {
            fs.copyFileSync(src, dest);
        }
    };

    // Replace template variables in a file
    const injectVars = (filePath, projectName) => {
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');
            content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
            content = content.replace(/\{\{BLUEPRINT_VERSION\}\}/g, BLUEPRINT_VERSION);
            fs.writeFileSync(filePath, content);
        }
    };

    try {
        // 1. Copy everything from templates/ except boilerplate/
        fs.readdirSync(TEMPLATES_DIR).forEach(item => {
            if (item !== 'boilerplate') {
                let destName = item;
                if (item === 'gitignore.template') destName = '.gitignore';
                copyRecursiveSync(
                    path.join(TEMPLATES_DIR, item),
                    path.join(targetDir, destName)
                );
            }
        });

        const projectName = answers.projectName || path.basename(targetDir);

        // 2a. Copy AGENTS.md as .cursorrules (Cursor/Copilot/Windsurf compatibility)
        const agentsMdPath = path.join(targetDir, 'AGENTS.md');
        if (fs.existsSync(agentsMdPath)) {
            fs.copyFileSync(agentsMdPath, path.join(targetDir, '.cursorrules'));
            console.log(chalk.green('   ✓ .cursorrules creado (copia de AGENTS.md)'));
        }

        // 2. Inject project name into both CLAUDE.md locations
        injectVars(path.join(targetDir, 'CLAUDE.md'), projectName);
        injectVars(path.join(targetDir, '.claude', 'CLAUDE.md'), projectName);

        spinnerBlueprint.succeed(chalk.green('Blueprint inyectado'));

        // 3. If Full Scaffold: inject code boilerplate + patch app.config.ts + add npm scripts
        if (isFull) {
            const BOILERPLATE_DIR = path.join(TEMPLATES_DIR, 'boilerplate');
            const BOILERPLATE_SRC = path.join(BOILERPLATE_DIR, 'src');
            const BOILERPLATE_SCRIPTS = path.join(BOILERPLATE_DIR, 'scripts');

            if (fs.existsSync(BOILERPLATE_SRC)) {
                copyRecursiveSync(BOILERPLATE_SRC, path.join(targetDir, 'src'));

                if (fs.existsSync(BOILERPLATE_SCRIPTS)) {
                    copyRecursiveSync(BOILERPLATE_SCRIPTS, path.join(targetDir, 'scripts'));
                    console.log(chalk.green('   ✓ scripts/ copiado'));
                }

                // Copy vitest.config.ts to project root (Angular 21+ test runner)
                const vitestConfigSrc = path.join(BOILERPLATE_DIR, 'vitest.config.ts');
                if (fs.existsSync(vitestConfigSrc)) {
                    fs.copyFileSync(vitestConfigSrc, path.join(targetDir, 'vitest.config.ts'));
                    console.log(chalk.green('   ✓ vitest.config.ts copiado'));
                }

                // Copy postcss.config.json to project root (Tailwind v4)
                // NOTA: Angular @angular/build:application solo acepta .json, ignora .js/.mjs/.cjs
                const postcssConfigSrc = path.join(BOILERPLATE_DIR, 'postcss.config.json');
                if (fs.existsSync(postcssConfigSrc)) {
                    fs.copyFileSync(postcssConfigSrc, path.join(targetDir, 'postcss.config.json'));
                    console.log(chalk.green('   ✓ postcss.config.json copiado'));
                }

                // Patch tsconfig.json: add path aliases for @core/*, @shared/*, etc.
                const tsconfigPath = path.join(targetDir, 'tsconfig.json');
                if (fs.existsSync(tsconfigPath)) {
                    try {
                        const tsconfig = parseJsonc(fs.readFileSync(tsconfigPath, 'utf8'));
                        if (!tsconfig.compilerOptions) tsconfig.compilerOptions = {};
                        // baseUrl is required for path aliases to resolve correctly
                        if (!tsconfig.compilerOptions.baseUrl) {
                            tsconfig.compilerOptions.baseUrl = './';
                        }
                        if (!tsconfig.compilerOptions.paths) {
                            tsconfig.compilerOptions.paths = {};
                        }
                        Object.assign(tsconfig.compilerOptions.paths, {
                            '@core/*': ['src/app/core/*'],
                            '@shared/*': ['src/app/shared/*'],
                            '@features/*': ['src/app/features/*'],
                            '@layout/*': ['src/app/layout/*'],
                        });
                        fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
                        console.log(chalk.green('   ✓ tsconfig.json configurado (path aliases @core/*, @shared/*, @features/*, @layout/*)'));
                    } catch (e) {
                        console.warn(chalk.yellow('   ⚠ No se pudo parchear tsconfig.json:', e.message));
                    }
                }

                // Patch angular.json: add tailwind.css to styles + disable inlineCritical
                const angularJsonPath = path.join(targetDir, 'angular.json');
                if (fs.existsSync(angularJsonPath)) {
                    const angularJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));
                    const projectKey = Object.keys(angularJson.projects)[0];
                    const buildOptions = angularJson.projects[projectKey].architect.build.options;

                    // 1. Add tailwind.css before styles.scss
                    const styles = buildOptions.styles;
                    if (styles && !styles.includes('src/tailwind.css')) {
                        const scssIndex = styles.indexOf('src/styles.scss');
                        if (scssIndex >= 0) {
                            styles.splice(scssIndex, 0, 'src/tailwind.css');
                        } else {
                            styles.unshift('src/tailwind.css');
                        }
                    }

                    // 2. Disable inlineCritical — Beasties can't see inline-template classes
                    //    and would silently strip Tailwind utilities from the final bundle.
                    if (!buildOptions.optimization || typeof buildOptions.optimization !== 'object') {
                        buildOptions.optimization = {};
                    }
                    if (!buildOptions.optimization.styles || typeof buildOptions.optimization.styles !== 'object') {
                        buildOptions.optimization.styles = {};
                    }
                    buildOptions.optimization.styles.inlineCritical = false;

                    // 3. Add Vitest test target (replaces Karma which ng new skips with --skip-tests)
                    if (!angularJson.projects[projectKey].architect.test) {
                        angularJson.projects[projectKey].architect.test = {
                            builder: '@analogjs/vitest-angular:test',
                            options: { configFile: 'vitest.config.ts' },
                        };
                    }

                    fs.writeFileSync(angularJsonPath, JSON.stringify(angularJson, null, 2));
                    console.log(chalk.green('   ✓ angular.json parcheado (tailwind.css + inlineCritical: false + test target Vitest)'));
                }

                // Patch index.html: add Google Fonts <link preconnect> (avoids render-blocking @import)
                const indexHtmlPath = path.join(targetDir, 'src', 'index.html');
                if (fs.existsSync(indexHtmlPath)) {
                    let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
                    if (!indexHtml.includes('fonts.googleapis.com')) {
                        const fontLinks =
                            `\n    <link rel="preconnect" href="https://fonts.googleapis.com">` +
                            `\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
                            `\n    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap">`;
                        indexHtml = indexHtml.replace('</head>', `${fontLinks}\n  </head>`);
                        fs.writeFileSync(indexHtmlPath, indexHtml);
                        console.log(chalk.green('   ✓ index.html parcheado (Google Fonts preconnect)'));
                    }
                }

                // Patch app.config.ts with PrimeNG provider (only if primeng is enabled)
                const appConfigPath = path.join(targetDir, 'src', 'app', 'app.config.ts');
                if (stack.primeng && fs.existsSync(appConfigPath)) {
                    let configStr = fs.readFileSync(appConfigPath, 'utf8');
                    if (!configStr.includes('providePrimeNG')) {
                        const importsToAdd =
                            `import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';\n` +
                            `import { providePrimeNG } from 'primeng/config';\n` +
                            `import Aura from '@primeng/themes/aura';\n`;

                        configStr = importsToAdd + configStr;
                        configStr = configStr.replace(
                            /providers: \[([^\]]+)\]/,
                            `providers: [$1, provideAnimationsAsync(), providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.fake-dark-mode', cssLayer: { name: 'primeng', order: 'tailwind-base, primeng, tailwind-utilities' } } } })]`
                        );
                        fs.writeFileSync(appConfigPath, configStr);
                        console.log(chalk.green('   ✓ app.config.ts configurado'));
                    }
                }

                // Copy Playwright E2E boilerplate (only if --with-e2e)
                if (stack.e2e) {
                    const E2E_BOILERPLATE = path.join(TEMPLATES_DIR, 'boilerplate-e2e');
                    if (fs.existsSync(E2E_BOILERPLATE)) {
                        // Copy playwright.config.ts to project root
                        const playwrightConfigSrc = path.join(E2E_BOILERPLATE, 'playwright.config.ts');
                        if (fs.existsSync(playwrightConfigSrc)) {
                            fs.copyFileSync(playwrightConfigSrc, path.join(targetDir, 'playwright.config.ts'));
                        }
                        // Copy e2e/ directory
                        const e2eSrc = path.join(E2E_BOILERPLATE, 'e2e');
                        if (fs.existsSync(e2eSrc)) {
                            copyRecursiveSync(e2eSrc, path.join(targetDir, 'e2e'));
                        }
                        console.log(chalk.green('   ✓ Playwright E2E boilerplate copiado (e2e/, playwright.config.ts)'));
                    }
                }

                // Copy NgRx Signal Store boilerplate (only if --with-ngrx-signals)
                if (stack.ngrxSignals) {
                    const NGRX_BOILERPLATE = path.join(TEMPLATES_DIR, 'boilerplate-ngrx', 'src');
                    if (fs.existsSync(NGRX_BOILERPLATE)) {
                        copyRecursiveSync(NGRX_BOILERPLATE, path.join(targetDir, 'src'));
                        console.log(chalk.green('   ✓ NgRx Signal Store boilerplate copiado (core/state/)'));
                    }
                }

                // Add View Transitions router config and CSS animation files (only if no GSAP)
                if (!stack.gsap) {
                    // Patch app.config.ts to add withViewTransitions()
                    if (fs.existsSync(appConfigPath)) {
                        let configStr2 = fs.readFileSync(appConfigPath, 'utf8');
                        if (!configStr2.includes('withViewTransitions')) {
                            configStr2 = configStr2.replace(
                                /from '@angular\/router';/,
                                `from '@angular/router';\nimport { withViewTransitions } from '@angular/router';`
                            );
                            configStr2 = configStr2.replace(
                                /provideRouter\(routes\)/,
                                'provideRouter(routes, withViewTransitions())'
                            );
                            fs.writeFileSync(appConfigPath, configStr2);
                            console.log(chalk.green('   ✓ app.config.ts: withViewTransitions() agregado'));
                        }
                    }
                }

                // Inject claude headless scripts into package.json
                const pkgPath = path.join(targetDir, 'package.json');
                if (fs.existsSync(pkgPath)) {
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                    pkg.scripts = {
                        ...pkg.scripts,
                        'test': 'ng test',
                        'test:watch': 'ng test --watch',
                        'test:ci': 'ng test --watch=false --reporter=verbose',
                        'test:coverage': 'ng test --watch=false --coverage',
                        ...(stack.e2e ? {
                            'e2e': 'playwright test',
                            'e2e:ui': 'playwright test --ui',
                            'e2e:headed': 'playwright test --headed',
                            'e2e:report': 'playwright show-report',
                        } : {}),
                        'claude:review': 'claude -p "Revisa el código de esta sesión y sugiere mejoras de arquitectura" --allowedTools Read,Glob,Grep',
                        'claude:sync': 'claude -p "Ejecuta /sync-indices para actualizar los índices del proyecto" --allowedTools Read,Edit,Glob,Grep',
                        'claude:fix': 'claude -p "Ejecuta ng lint, identifica los errores y corrígelos" --allowedTools Read,Edit,Bash',
                        'claude:tdd': 'claude -p "Ejecuta las pruebas unitarias (npm run test:ci). Si fallan, auto-corrige la lógica hasta que Vitest pase en verde." --allowedTools Read,Edit,Bash',
                        'lint:arch': 'node scripts/lint-arch-wrapper.js',
                        'indices:sync': 'node scripts/indices-sync.js'
                    };
                    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
                    console.log(chalk.green('   ✓ Scripts claude:* agregados'));
                }
            }
        }

        if (isFull && tempDir && finalDir) {
            try {
                fs.renameSync(tempDir, finalDir);
                targetDir = finalDir;
            } catch (e) {
                throw new Error(`No se pudo mover el proyecto temporal al destino final: ${e.message}`);
            }
        }

        // 4. Write blueprint.json for traceability/versioning
        try {
            const blueprintPath = path.join(targetDir, 'blueprint.json');
            const blueprint = {
                name: 'koa-agent-blueprint',
                version: BLUEPRINT_VERSION,
                generatedAt: new Date().toISOString(),
                mode: isFull ? 'full-scaffold' : 'inject-only',
                managedPaths: [
                    '.claude/**',
                    'docs/**',
                    'indices/**',
                    'scripts/architect.js',
                    '.mcp.json',
                ],
                stack: { angular: true, tailwind: true, primeng: stack.primeng, gsap: stack.gsap, supabase: stack.supabase, ngrxSignals: stack.ngrxSignals, e2e: stack.e2e },
            };
            fs.writeFileSync(blueprintPath, JSON.stringify(blueprint, null, 2));
        } catch (e) {
            console.warn(chalk.yellow(`   ⚠ No se pudo escribir blueprint.json: ${e.message}`));
        }

        printSuccess(answers.projectName || path.basename(targetDir), isFull, targetDir);

    } catch (err) {
        spinnerBlueprint.fail(chalk.red('Error al inyectar Blueprint'));
        console.error(chalk.gray(err.message));
        try { if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
        process.exit(1);
    }
}

main();
