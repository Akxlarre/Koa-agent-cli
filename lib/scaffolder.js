/**
 * lib/scaffolder.js — Filesystem operations
 *
 * Responsabilidades:
 *   - Copiar templates/ al directorio destino
 *   - Inyectar boilerplate Angular y parchear archivos de configuración
 *   - Escribir blueprint.json de trazabilidad
 *
 * Sin operaciones npm/spawn — eso es installer.js.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { parseJsonc, BLUEPRINT_VERSION } from './config.js';

// ─── Helpers privados ────────────────────────────────────────────────────────

function copyRecursiveSync(src, dest) {
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
}

function injectVars(filePath, projectName) {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
        content = content.replace(/\{\{BLUEPRINT_VERSION\}\}/g, BLUEPRINT_VERSION);
        fs.writeFileSync(filePath, content);
    }
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Copia todo templates/ (excepto boilerplate/) al directorio destino
 * e inyecta {{PROJECT_NAME}} y {{BLUEPRINT_VERSION}} en los CLAUDE.md.
 */
export function copyTemplates(templatesDir, targetDir, projectName) {
    fs.readdirSync(templatesDir).forEach(item => {
        if (item !== 'boilerplate') {
            let destName = item;
            if (item === 'gitignore.template') destName = '.gitignore';
            copyRecursiveSync(path.join(templatesDir, item), path.join(targetDir, destName));
        }
    });

    const agentsMdPath = path.join(targetDir, 'AGENTS.md');
    if (fs.existsSync(agentsMdPath)) {
        fs.copyFileSync(agentsMdPath, path.join(targetDir, '.cursorrules'));
        console.log(chalk.green('   ✓ .cursorrules creado (copia de AGENTS.md)'));
    }

    injectVars(path.join(targetDir, 'CLAUDE.md'), projectName);
    injectVars(path.join(targetDir, '.claude', 'CLAUDE.md'), projectName);
}

/**
 * Copia el boilerplate Angular (src/, scripts/, configs) y parchea los
 * archivos de configuración del proyecto (tsconfig, angular.json, etc.).
 * Solo llamar en modo Full Scaffold.
 */
export function injectBoilerplate(templatesDir, targetDir, stack) {
    const boilerplateDir = path.join(templatesDir, 'boilerplate');
    const boilerplateSrc = path.join(boilerplateDir, 'src');
    const boilerplateScripts = path.join(boilerplateDir, 'scripts');

    if (!fs.existsSync(boilerplateSrc)) return;

    // 1. Código fuente Angular
    copyRecursiveSync(boilerplateSrc, path.join(targetDir, 'src'));

    if (fs.existsSync(boilerplateScripts)) {
        copyRecursiveSync(boilerplateScripts, path.join(targetDir, 'scripts'));
        console.log(chalk.green('   ✓ scripts/ copiado'));
    }

    const vitestConfigSrc = path.join(boilerplateDir, 'vitest.config.ts');
    if (fs.existsSync(vitestConfigSrc)) {
        fs.copyFileSync(vitestConfigSrc, path.join(targetDir, 'vitest.config.ts'));
        console.log(chalk.green('   ✓ vitest.config.ts copiado'));
    }

    // NOTA: Angular @angular/build:application solo acepta .json, ignora .js/.mjs/.cjs
    const postcssConfigSrc = path.join(boilerplateDir, 'postcss.config.json');
    if (fs.existsSync(postcssConfigSrc)) {
        fs.copyFileSync(postcssConfigSrc, path.join(targetDir, 'postcss.config.json'));
        console.log(chalk.green('   ✓ postcss.config.json copiado'));
    }

    // 2. Patch tsconfig.json — path aliases @core/*, @shared/*, etc.
    const tsconfigPath = path.join(targetDir, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
        try {
            const tsconfig = parseJsonc(fs.readFileSync(tsconfigPath, 'utf8'));
            if (!tsconfig.compilerOptions) tsconfig.compilerOptions = {};
            if (!tsconfig.compilerOptions.baseUrl) tsconfig.compilerOptions.baseUrl = './';
            if (!tsconfig.compilerOptions.paths) tsconfig.compilerOptions.paths = {};
            Object.assign(tsconfig.compilerOptions.paths, {
                '@core/*':     ['src/app/core/*'],
                '@shared/*':   ['src/app/shared/*'],
                '@features/*': ['src/app/features/*'],
                '@layout/*':   ['src/app/layout/*'],
            });
            fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
            console.log(chalk.green('   ✓ tsconfig.json configurado (path aliases @core/*, @shared/*, @features/*, @layout/*)'));
        } catch (e) {
            console.warn(chalk.yellow('   ⚠ No se pudo parchear tsconfig.json:', e.message));
        }
    }

    // 3. Patch angular.json — tailwind.css + inlineCritical:false + test target Vitest
    const angularJsonPath = path.join(targetDir, 'angular.json');
    if (fs.existsSync(angularJsonPath)) {
        const angularJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));
        const projectKey = Object.keys(angularJson.projects)[0];
        const buildOptions = angularJson.projects[projectKey].architect.build.options;

        const styles = buildOptions.styles;
        if (styles && !styles.includes('src/tailwind.css')) {
            const scssIndex = styles.indexOf('src/styles.scss');
            if (scssIndex >= 0) styles.splice(scssIndex, 0, 'src/tailwind.css');
            else styles.unshift('src/tailwind.css');
        }

        if (!buildOptions.optimization || typeof buildOptions.optimization !== 'object') {
            buildOptions.optimization = {};
        }
        if (!buildOptions.optimization.styles || typeof buildOptions.optimization.styles !== 'object') {
            buildOptions.optimization.styles = {};
        }
        buildOptions.optimization.styles.inlineCritical = false;

        if (!angularJson.projects[projectKey].architect.test) {
            angularJson.projects[projectKey].architect.test = {
                builder: '@analogjs/vitest-angular:test',
                options: { configFile: 'vitest.config.ts' },
            };
        }

        fs.writeFileSync(angularJsonPath, JSON.stringify(angularJson, null, 2));
        console.log(chalk.green('   ✓ angular.json parcheado (tailwind.css + inlineCritical: false + test target Vitest)'));
    }

    // 4. Patch index.html — Google Fonts preconnect
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

    // 5. Patch app.config.ts — PrimeNG provider (solo si primeng activo)
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

    // 6. Playwright E2E boilerplate (solo si --with-e2e)
    if (stack.e2e) {
        const e2eBoilerplate = path.join(templatesDir, 'boilerplate-e2e');
        if (fs.existsSync(e2eBoilerplate)) {
            const playwrightConfigSrc = path.join(e2eBoilerplate, 'playwright.config.ts');
            if (fs.existsSync(playwrightConfigSrc)) {
                fs.copyFileSync(playwrightConfigSrc, path.join(targetDir, 'playwright.config.ts'));
            }
            const e2eSrc = path.join(e2eBoilerplate, 'e2e');
            if (fs.existsSync(e2eSrc)) {
                copyRecursiveSync(e2eSrc, path.join(targetDir, 'e2e'));
            }
            console.log(chalk.green('   ✓ Playwright E2E boilerplate copiado (e2e/, playwright.config.ts)'));
        }
    }

    // 7. NgRx Signal Store boilerplate (solo si --with-ngrx-signals)
    if (stack.ngrxSignals) {
        const ngrxBoilerplate = path.join(templatesDir, 'boilerplate-ngrx', 'src');
        if (fs.existsSync(ngrxBoilerplate)) {
            copyRecursiveSync(ngrxBoilerplate, path.join(targetDir, 'src'));
            console.log(chalk.green('   ✓ NgRx Signal Store boilerplate copiado (core/state/)'));
        }
    }

    // 8. View Transitions (solo si no hay GSAP)
    if (!stack.gsap && fs.existsSync(appConfigPath)) {
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

    // 9. Scripts claude:* en package.json
    const pkgPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkg.scripts = {
            ...pkg.scripts,
            'test':           'ng test',
            'test:watch':     'ng test --watch',
            'test:ci':        'ng test --watch=false --reporter=verbose',
            'test:coverage':  'ng test --watch=false --coverage',
            ...(stack.e2e ? {
                'e2e':        'playwright test',
                'e2e:ui':     'playwright test --ui',
                'e2e:headed': 'playwright test --headed',
                'e2e:report': 'playwright show-report',
            } : {}),
            'claude:review': 'claude -p "Revisa el código de esta sesión y sugiere mejoras de arquitectura" --allowedTools Read,Glob,Grep',
            'claude:sync':   'claude -p "Ejecuta /sync-indices para actualizar los índices del proyecto" --allowedTools Read,Edit,Glob,Grep',
            'claude:fix':    'claude -p "Ejecuta ng lint, identifica los errores y corrígelos" --allowedTools Read,Edit,Bash',
            'claude:tdd':    'claude -p "Ejecuta las pruebas unitarias (npm run test:ci). Si fallan, auto-corrige la lógica hasta que Vitest pase en verde." --allowedTools Read,Edit,Bash',
            'lint:arch':     'node scripts/lint-arch-wrapper.js',
            'indices:sync':  'node scripts/indices-sync.js',
        };
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
        console.log(chalk.green('   ✓ Scripts claude:* agregados'));
    }
}

/**
 * Escribe blueprint.json de trazabilidad en el directorio raíz del proyecto generado.
 */
export function writeBlueprintJson(targetDir, projectName, isFull, stack) {
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
            stack: {
                angular: true,
                tailwind: true,
                primeng: stack.primeng,
                gsap: stack.gsap,
                supabase: stack.supabase,
                ngrxSignals: stack.ngrxSignals,
                e2e: stack.e2e,
            },
        };
        fs.writeFileSync(blueprintPath, JSON.stringify(blueprint, null, 2));
    } catch (e) {
        console.warn(chalk.yellow(`   ⚠ No se pudo escribir blueprint.json: ${e.message}`));
    }
}
