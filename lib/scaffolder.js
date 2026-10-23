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
import { parseJsonc, BLUEPRINT_VERSION, ANGULAR_MAJOR } from './config.js';

// ─── Helpers privados ────────────────────────────────────────────────────────

/**
 * Rutas de las que el CLI es DUEÑO: el harness y sus puntos de entrada. Son las
 * únicas que se sobrescriben en una corrida sobre un proyecto que ya existe.
 *
 * Todo lo demás (`context/`, `indices/`, `supabase/`, `.gitignore`) es contenido
 * del proyecto. Si Wikiflow ya capturó el dominio en `context/domain.md`, o el ER
 * en `indices/DATABASE.md`, el CLI NO puede reemplazarlos por skeletons vacíos:
 * son el producto de un trabajo que el CLI no hizo.
 */
const CLI_OWNED = new Set(['.claude', 'docs', 'CLAUDE.md', 'AGENTS.md']);

/**
 * Aplica un parche sobre un archivo que la generación anterior debía haber dejado.
 *
 * HUE-022. El patrón que había —`if (existsSync) { parchear }`, diecinueve
 * veces, ninguna con `else`— confunde dos cosas distintas y las dice igual: en
 * silencio.
 *
 *   «este parche no aplica a esta configuración»   → correcto, no hay nada que hacer
 *   «el archivo que esperaba no está»              → el generador está roto
 *
 * Un `if` sin `else` sobre un archivo que `ng new` dejó de emitir no falla: no
 * hace nada, y el proyecto sale distinto de lo que el CLI dice haber generado.
 *
 * `requerido: true` se reserva para los tres archivos sin los cuales no hay
 * proyecto —`tsconfig.json`, `angular.json`, `package.json`—: si faltan, parar
 * antes de copiar cuarenta archivos encima es lo único útil que se puede hacer.
 * El resto sigue siendo condicional, pero se IMPRIME.
 *
 * @throws si el archivo es requerido y falta, o si su parche falla.
 */
function patch(rutaAbs, { requerido = false, que }, fn) {
    const nombre = path.basename(rutaAbs);

    if (!fs.existsSync(rutaAbs)) {
        if (requerido) {
            throw new Error(
                `Falta ${nombre}, que el generador necesita para ${que}.\n` +
                `   Esperado en: ${rutaAbs}\n` +
                `   El proyecto Angular no se creó como se esperaba: revisá la salida de 'ng new'.`,
            );
        }
        console.log(chalk.gray(`   · ${nombre} no está — se omite ${que}`));
        return false;
    }

    try {
        fn();
        return true;
    } catch (e) {
        if (requerido) {
            throw new Error(`No se pudo parchear ${nombre} (${que}): ${e.message}`);
        }
        console.warn(chalk.yellow(`   ⚠ No se pudo parchear ${nombre}: ${e.message}`));
        return false;
    }
}

function copyRecursiveSync(src, dest, opts = {}) {
    const { preserveExisting = false, preserved = null } = opts;

    // SEC-01: Use lstatSync (not statSync) to detect symlinks without following them.
    // Symlinks in templates/ are skipped to prevent supply-chain path traversal attacks.
    let lstats;
    try {
        lstats = fs.lstatSync(src);
    } catch {
        return; // src does not exist — skip silently
    }

    if (lstats.isSymbolicLink()) {
        // Never follow symlinks during template copy — skip and warn.
        console.warn(chalk.yellow(`   ⚠ Symlink ignorado (seguridad): ${src}`));
        return;
    }

    if (lstats.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(childItemName => {
            let destName = childItemName;
            if (childItemName === 'gitignore.template') destName = '.gitignore';
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, destName), opts);
        });
    } else {
        // Regla de precedencia: lo que ya existe gana. El CLI aporta el skeleton
        // sólo cuando no hay nada — nunca reemplaza contenido que no escribió.
        if (preserveExisting && fs.existsSync(dest)) {
            if (preserved) preserved.push(dest);
            return;
        }
        fs.copyFileSync(src, dest);
    }
}

function injectVars(filePath, projectName, generatedAt) {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
        content = content.replace(/\{\{BLUEPRINT_VERSION\}\}/g, BLUEPRINT_VERSION);
        content = content.replace(/\{\{ANGULAR_MAJOR\}\}/g, String(ANGULAR_MAJOR));
        if (generatedAt) {
            content = content.replace(/\{\{GENERATED_AT\}\}/g, generatedAt);
        }
        fs.writeFileSync(filePath, content);
    }
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Copia todo templates/ (excepto boilerplate/ y adapters/) al directorio destino
 * e inyecta {{PROJECT_NAME}} y {{BLUEPRINT_VERSION}} en los archivos procesados.
 *
 * El harness (`CLI_OWNED`) se sobrescribe siempre — es lo que el CLI mantiene y
 * actualiza. El resto respeta lo que ya haya: correr el CLI dentro de una carpeta
 * exportada por Wikiflow tiene que dejar intacto el contexto capturado.
 */
export function copyTemplates(templatesDir, targetDir, projectName, stack = {}) {
    const EXCLUDED = new Set(['boilerplate', 'boilerplate-e2e', 'boilerplate-ngrx', 'adapters']);
    const preserved = [];

    fs.readdirSync(templatesDir).forEach(item => {
        if (!EXCLUDED.has(item)) {
            let destName = item;
            if (item === 'gitignore.template') destName = '.gitignore';
            copyRecursiveSync(
                path.join(templatesDir, item),
                path.join(targetDir, destName),
                { preserveExisting: !CLI_OWNED.has(destName), preserved },
            );
        }
    });

    if (preserved.length > 0) {
        const rel = preserved.map(p => path.relative(targetDir, p));
        console.log(chalk.cyan(`   ℹ ${rel.length} archivo(s) preservado(s) — ya existían y no los pisa el CLI:`));
        rel.slice(0, 8).forEach(r => console.log(chalk.gray(`     · ${r}`)));
        if (rel.length > 8) console.log(chalk.gray(`     · … y ${rel.length - 8} más`));
    }

    const generatedAt = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    injectVars(path.join(targetDir, 'CLAUDE.md'), projectName, generatedAt);
    injectVars(path.join(targetDir, 'AGENTS.md'), projectName, generatedAt);
    injectVars(path.join(targetDir, '.claude', 'CLAUDE.md'), projectName, generatedAt);
    // INC-018: el major de Angular del servidor MCP sale de la misma constante que
    // usa `ng new`. Estaba escrito `@angular/cli@latest` — exactamente lo que
    // `lib/config.js` prohíbe con tres párrafos, en la propia configuración del CLI.
    injectVars(path.join(targetDir, '.mcp.json'), projectName, generatedAt);

    // Inyectar variables en índices
    const indicesDir = path.join(targetDir, 'indices');
    if (fs.existsSync(indicesDir)) {
        fs.readdirSync(indicesDir).forEach(file => {
            if (file.endsWith('.md')) {
                injectVars(path.join(indicesDir, file), projectName, generatedAt);
            }
        });
    }

    // Inyectar variables en archivos de contexto semántico (context/)
    // Solo los .md directos — decisions/ contiene plantillas de ADRs sin {{PROJECT_NAME}}
    const contextDir = path.join(targetDir, 'context');
    if (fs.existsSync(contextDir)) {
        fs.readdirSync(contextDir).forEach(file => {
            if (file.endsWith('.md')) {
                injectVars(path.join(contextDir, file), projectName, generatedAt);
            }
        });
    }

    // Adapters de AI tools (siempre: Copilot; condicional: Cursor, Windsurf)
    copyAiAdapters(templatesDir, targetDir, projectName, stack, generatedAt);
}

/**
 * Copia los adapters de AI tools opcionales desde templates/adapters/.
 * GitHub Copilot siempre se genera. Cursor y Windsurf solo con stack.cursor / stack.windsurf.
 */
function copyAiAdapters(templatesDir, targetDir, projectName, stack, generatedAt) {
    const adaptersDir = path.join(templatesDir, 'adapters');
    if (!fs.existsSync(adaptersDir)) return;

    // GitHub Copilot — siempre generado (archivo mínimo, universal)
    const copilotSrc = path.join(adaptersDir, 'github', 'copilot-instructions.md');
    const copilotDest = path.join(targetDir, '.github', 'copilot-instructions.md');
    if (fs.existsSync(copilotSrc)) {
        if (!fs.existsSync(path.join(targetDir, '.github'))) {
            fs.mkdirSync(path.join(targetDir, '.github'), { recursive: true });
        }
        fs.copyFileSync(copilotSrc, copilotDest);
        injectVars(copilotDest, projectName, generatedAt);
        console.log(chalk.green('   ✓ .github/copilot-instructions.md generado'));
    }

    // Cursor — solo con --with-cursor o selección en prompt
    if (stack.cursor) {
        const cursorSrc = path.join(adaptersDir, 'cursor', 'rules');
        const cursorDest = path.join(targetDir, '.cursor', 'rules');
        if (fs.existsSync(cursorSrc)) {
            copyRecursiveSync(cursorSrc, cursorDest);
            fs.readdirSync(cursorDest).forEach(file => {
                injectVars(path.join(cursorDest, file), projectName, generatedAt);
            });
            console.log(chalk.green('   ✓ .cursor/rules/ generado (workflow.mdc + architecture.mdc)'));
        }
    }

    // Windsurf — solo con --with-windsurf o selección en prompt
    if (stack.windsurf) {
        const windsurfSrc = path.join(adaptersDir, 'windsurf', 'rules');
        const windsurfDest = path.join(targetDir, '.windsurf', 'rules');
        if (fs.existsSync(windsurfSrc)) {
            copyRecursiveSync(windsurfSrc, windsurfDest);
            fs.readdirSync(windsurfDest).forEach(file => {
                injectVars(path.join(windsurfDest, file), projectName, generatedAt);
            });
            console.log(chalk.green('   ✓ .windsurf/rules/ generado (project.md)'));
        }
    }
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

    // 1b. Reemplazar el root component generado por `ng new`.
    //
    // Desde Angular 21 el root se genera como `app.ts` (clase `App`) con un
    // `app.html` externo que trae la página de bienvenida de Angular, y `main.ts`
    // bootstrapea ESA clase. El boilerplate aporta su propio `app.component.ts`
    // (clase `AppComponent`), que quedaría como código muerto: la app arrancaría
    // mostrando la demo de Angular con las rutas del proyecto renderizadas debajo.
    const generatedRootFiles = ['app.ts', 'app.html', 'app.scss', 'app.css', 'app.spec.ts'];
    for (const file of generatedRootFiles) {
        try { fs.rmSync(path.join(targetDir, 'src', 'app', file), { force: true }); } catch { /* ignore */ }
    }

    const mainTsPath = path.join(targetDir, 'src', 'main.ts');
    patch(mainTsPath, { que: 'apuntar el bootstrap a AppComponent' }, () => {
        let mainTs = fs.readFileSync(mainTsPath, 'utf8');
        mainTs = mainTs.replace(
            /import\s*\{\s*App\s*\}\s*from\s*['"]\.\/app\/app['"];?/,
            "import { AppComponent } from './app/app.component';"
        );
        mainTs = mainTs.replace(/bootstrapApplication\(\s*App\s*,/, 'bootstrapApplication(AppComponent,');
        fs.writeFileSync(mainTsPath, mainTs);
        console.log(chalk.green('   ✓ main.ts apuntado a AppComponent (root de ng new eliminado)'));
    });

    patch(boilerplateScripts, { que: 'copiar scripts/ (linter arquitectónico y utilidades)' }, () => {
        copyRecursiveSync(boilerplateScripts, path.join(targetDir, 'scripts'));
        console.log(chalk.green('   ✓ scripts/ copiado'));
    });

    const vitestConfigSrc = path.join(boilerplateDir, 'vitest.config.ts');
    patch(vitestConfigSrc, { que: 'copiar vitest.config.ts' }, () => {
        fs.copyFileSync(vitestConfigSrc, path.join(targetDir, 'vitest.config.ts'));
        console.log(chalk.green('   ✓ vitest.config.ts copiado'));
    });

    // NOTA: Angular @angular/build:application solo acepta .json, ignora .js/.mjs/.cjs
    const postcssConfigSrc = path.join(boilerplateDir, 'postcss.config.json');
    patch(postcssConfigSrc, { que: 'copiar postcss.config.json' }, () => {
        fs.copyFileSync(postcssConfigSrc, path.join(targetDir, 'postcss.config.json'));
        console.log(chalk.green('   ✓ postcss.config.json copiado'));
    });

    // 2. Patch tsconfig.json — path aliases @core/*, @shared/*, etc.
    // Requerido: sin los aliases, el boilerplate que se copia a continuación —que
    // los importa en todos lados— no compila. Era un `⚠` amarillo entre veinte
    // líneas verdes; es un error.
    const tsconfigPath = path.join(targetDir, 'tsconfig.json');
    patch(tsconfigPath, { requerido: true, que: 'los path aliases @core/*, @shared/*, @features/*, @layout/*' }, () => {
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
    });

    // 3. Patch angular.json — tailwind.css + inlineCritical:false + test target Vitest
    const angularJsonPath = path.join(targetDir, 'angular.json');
    patch(angularJsonPath, { requerido: true, que: 'el build (tailwind.css, Vitest, fileReplacements)' }, () => {
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

        // fileReplacements: sin esto, `environment.prod.ts` es código muerto y un
        // build de producción sale con `production: false` y las credenciales de
        // dev embebidas. Angular ya no lo cablea solo al crear el proyecto.
        const configs = angularJson.projects[projectKey].architect.build.configurations;
        if (configs?.production && !configs.production.fileReplacements) {
            configs.production.fileReplacements = [{
                replace: 'src/environments/environment.ts',
                with: 'src/environments/environment.prod.ts',
            }];
        }

        if (!angularJson.projects[projectKey].architect.test) {
            angularJson.projects[projectKey].architect.test = {
                builder: '@analogjs/vitest-angular:test',
                options: { configFile: 'vitest.config.ts' },
            };
        }

        fs.writeFileSync(angularJsonPath, JSON.stringify(angularJson, null, 2));
        console.log(chalk.green('   ✓ angular.json parcheado (tailwind.css + inlineCritical: false + Vitest + fileReplacements)'));
    });

    // 4. Patch index.html — CSP meta tag + Google Fonts preconnect
    const indexHtmlPath = path.join(targetDir, 'src', 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
        let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

        // SEC-T04: Content-Security-Policy meta tag.
        // Restricts resource loading to trusted origins only.
        // Supabase URL is kept as 'https://*.supabase.co' to cover all regions.
        // 'unsafe-inline' is required for Angular's component styles (view encapsulation).
        // In production, replace with nonce-based CSP via server headers for stricter control.
        if (!indexHtml.includes('Content-Security-Policy')) {
            const cspMeta =
                `\n    <meta http-equiv="Content-Security-Policy" content="` +
                `default-src 'self'; ` +
                `script-src 'self'; ` +
                `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ` +
                `font-src 'self' https://fonts.gstatic.com; ` +
                `img-src 'self' data: https:; ` +
                // Los orígenes locales van incluidos a propósito: el proyecto nace
                // apuntando a `npx supabase start` (environment.ts), y sin esto el
                // navegador bloquea hasta el login con un error de CSP que no menciona
                // Supabase por ningún lado. En producción no abren nada: sólo permiten
                // que la propia página hable con un puerto del equipo de quien la abre.
                `connect-src 'self' https://*.supabase.co wss://*.supabase.co ` +
                `http://localhost:54321 http://127.0.0.1:54321 ` +
                `ws://localhost:54321 ws://127.0.0.1:54321; ` +
                // frame-ancestors se omite a propósito: el navegador lo IGNORA cuando
                // llega por <meta> y solo ensucia la consola con un warning. Para
                // protección real contra clickjacking, mandarlo como header HTTP
                // (o X-Frame-Options) desde el servidor/CDN.
                `base-uri 'self'; ` +
                `form-action 'self'` +
                `">`;
            indexHtml = indexHtml.replace('<head>', `<head>${cspMeta}`);
            console.log(chalk.green('   ✓ index.html parcheado (Content-Security-Policy)'));
        }

        if (!indexHtml.includes('fonts.googleapis.com')) {
            const fontLinks =
                `\n    <link rel="preconnect" href="https://fonts.googleapis.com">` +
                `\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
                `\n    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap">`;
            indexHtml = indexHtml.replace('</head>', `${fontLinks}\n  </head>`);
            console.log(chalk.green('   ✓ index.html parcheado (Google Fonts preconnect)'));
        }

        fs.writeFileSync(indexHtmlPath, indexHtml);
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
    patch(pkgPath, { requerido: true, que: 'los scripts del proyecto (test, lint:arch, claude:*)' }, () => {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkg.scripts = {
            ...pkg.scripts,
            'test':           'ng test',
            'test:watch':     'ng test --watch',
            // `--reporter` NO existe en el builder de Vitest de Angular: `ng test`
            // aborta con "Unknown argument". Y era el comando que testing-tdd.md
            // manda correr para auto-validar, o sea que la validación nunca corría.
            'test:ci':        'ng test --watch=false',
            'test:coverage':  'ng test --watch=false --coverage',
            // El `tsconfig.json` que genera el Angular CLI es solution-style:
            // `"files": []` más `references`. `tsc --noEmit -p tsconfig.json` no
            // compila NADA y sale 0 — el reflejo de "chequeo de tipos rápido"
            // devuelve verde sin haber mirado un solo archivo. Hay que apuntar a
            // los proyectos hijos, y los specs son un proyecto aparte.
            'typecheck':      'tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.spec.json',
            ...(stack.e2e ? {
                'e2e':        'playwright test',
                'e2e:ui':     'playwright test --ui',
                'e2e:headed': 'playwright test --headed',
                'e2e:report': 'playwright show-report',
            } : {}),
            ...(stack.supabase ? {
                'supabase:start': 'supabase start',
                'supabase:stop':  'supabase stop',
                'supabase:reset': 'supabase db reset',
                'supabase:diff':  'supabase db diff --use-migra',
                'supabase:types': 'supabase gen types typescript --local > src/app/core/models/supabase.types.ts',
                // Las edge functions son Deno, no Node: `node --test` no puede
                // con sus imports por URL y falla siempre. Y `--node-modules-dir=none`
                // porque si no Deno adopta el node_modules del proyecto Angular y
                // se atraganta con @types/node.
                'test:functions':  'deno test --allow-all --node-modules-dir=none supabase/functions/_shared/',
                'check:functions': 'deno check supabase/functions/*/index.ts',
            } : {}),
            'claude:review':     'claude -p "Revisa el código de esta sesión y sugiere mejoras de arquitectura" --allowedTools Read,Glob,Grep',
            'claude:sync':       'claude -p "Ejecuta /sync-indices para actualizar los índices del proyecto" --allowedTools Read,Edit,Glob,Grep',
            'claude:fix':        'claude -p "Ejecuta ng lint, identifica los errores y corrígelos" --allowedTools Read,Edit,Bash',
            // El bucle «corregí hasta que pase» es justo donde un agente edita el
            // test en vez del código. Los permisos lo impiden, no el prompt: los
            // specs no se pueden editar, Bash solo corre los tests, y el bucle
            // tiene tope. El commit-guard cubre el resto (COMMIT-01).
            'claude:tdd':        'claude -p "Ejecuta las pruebas unitarias (npm run test:ci). Si fallan, corrige el código de producción hasta que pasen. Los tests son el contrato: no los edites. Si uno parece estar mal, detente y explica por qué." --allowedTools Read Glob Grep Edit "Bash(npm run test:ci)" --disallowedTools "Edit(**/*.spec.ts)" --max-turns 25',
            'claude:test-hooks': 'node --test .claude/tests/*.test.js',
            // docs/CONTRATOS.md se GENERA desde .claude/hooks/lib/contracts.js
            // (ACO-013). Una tabla de contratos escrita a mano vuelve a
            // desactualizarse, que es el hallazgo que ese doc cierra.
            'contracts:doc':     'node .claude/scripts/contracts-doc.js',
            'lint:arch':       'node scripts/lint-arch-wrapper.js',
            'lint:arch:test':  'node --test scripts/lib/*.test.mjs',
            // Las dos comprobaciones que preguntan si los chequeos pueden fallar,
            // no si pasan. Tardan: se corren al cerrar una sesión, no en cada
            // guardado. Ver docs/CHEQUEOS-QUE-NO-CHEQUEAN.md.
            'lint:arch:provocar': 'node scripts/provocar-reglas.mjs',
            'smoke:scripts':      'node scripts/smoke-scripts.mjs',
            // Enlaces entre specs. Sin carpeta specs/ no hace nada, igual que el
            // spec-gate: el SDD viene dormido y no molesta a quien no lo usa.
            'lint:specs':         'node scripts/verificar-specs.mjs',
            // Asignaciones — misma política: sin specs/AUTHORS.md la capa está
            // apagada y los dos salen en 0. Faltaban (INC-015): `sdd/SKILL.md` y
            // `/assign-claim` mandaban correr `assignments:sync` y el script no
            // existía en ningún proyecto generado, así que el único camino de
            // escritura de la capa no se podía recorrer.
            'assignments:audit': 'node scripts/assignments-audit.js',
            'assignments:sync':  'node scripts/assignments-sync.js',
            'indices:sync':    'node scripts/indices-sync.js',
            'check:bento':     'node scripts/check-bento-classes.js',
        };
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
        console.log(chalk.green('   ✓ Scripts claude:* agregados'));
    });
}

/**
 * Escribe blueprint.json de trazabilidad en el directorio raíz del proyecto generado.
 *
 * MERGE, no reemplazo. El blueprint es un contrato compartido: Wikiflow escribe la
 * profundidad metodológica (`tier`, `team`, `product`) y el CLI escribe cómo se
 * materializó el scaffold. Sobrescribir el archivo entero borraba en silencio el
 * resultado de las fases de captura, que es justo lo que el flujo documentado pide
 * hacer (descomprimir el ZIP y correr el CLI adentro).
 *
 * El CLI sólo pisa sus propios campos. `stack` es uno de ellos a propósito: refleja
 * lo que realmente se instaló, no lo que alguien declaró.
 */
/**
 * Escribe `blueprint.json` en el proyecto generado.
 *
 * INC-021: la firma era `(targetDir, projectName, isFull, stack)` y `projectName`
 * NO se usaba — el `name` del blueprint es la constante `koa-agent-blueprint`,
 * porque identifica al BLUEPRINT, no al proyecto. Una firma que promete algo que
 * la funcion ignora es la clase de cosa que hace escribir un test equivocado, y
 * eso paso literalmente: el test de integracion nacio esperando el nombre del
 * proyecto ahi, y el que estaba mal era el test.
 */
export function writeBlueprintJson(targetDir, isFull, stack) {
    try {
        const blueprintPath = path.join(targetDir, 'blueprint.json');

        let existing = {};
        if (fs.existsSync(blueprintPath)) {
            try {
                existing = parseJsonc(fs.readFileSync(blueprintPath, 'utf8'));
                if (!existing || typeof existing !== 'object' || Array.isArray(existing)) existing = {};
            } catch {
                console.warn(chalk.yellow('   ⚠ blueprint.json existente ilegible — se reemplaza.'));
                existing = {};
            }
        }

        // En inject-only el CLI no instala NADA, así que no tiene autoridad sobre el
        // stack: si el blueprint ya lo declara, ese gana. En full-scaffold sí la
        // tiene — ahí `stack` refleja lo que realmente se instaló.
        const ownsStack = isFull || !existing.stack;

        const cliOwnedKeys = ['name', 'version', 'generatedAt', 'scaffoldMode', 'mode', 'managedPaths'];
        if (ownsStack) cliOwnedKeys.push('stack');
        const preservedKeys = Object.keys(existing).filter(k => !cliOwnedKeys.includes(k));

        const blueprint = {
            ...existing,
            name: 'koa-agent-blueprint',
            version: BLUEPRINT_VERSION,
            generatedAt: new Date().toISOString(),
            // `scaffoldMode` es el nombre canónico desde el schema 6.5.0. Se elimina
            // el `mode` legacy para que no puedan divergir; validateBlueprintJson
            // sigue aceptando ambos al leer.
            scaffoldMode: isFull ? 'full-scaffold' : 'inject-only',
            // Derivado de CLI_OWNED para que el contrato declarado y el que ejecuta
            // copyTemplates no puedan divergir. `indices/**` ya NO está: los índices
            // son contenido del proyecto (Wikiflow genera DATABASE.md y MODELS.md
            // desde el ER, e indices-sync.js los regenera desde el código real).
            managedPaths: [
                ...[...CLI_OWNED].map(p => (p.endsWith('.md') ? p : `${p}/**`)),
                'scripts/architect.js',
                '.mcp.json',
            ],
            stack: ownsStack
                ? {
                    angular: true,
                    tailwind: true,
                    primeng: stack.primeng,
                    gsap: stack.gsap,
                    supabase: stack.supabase,
                    ngrxSignals: stack.ngrxSignals,
                    e2e: stack.e2e,
                    cursor: stack.cursor ?? false,
                    windsurf: stack.windsurf ?? false,
                }
                : existing.stack,
        };
        delete blueprint.mode;
        fs.writeFileSync(blueprintPath, JSON.stringify(blueprint, null, 2));
        if (preservedKeys.length > 0) {
            console.log(chalk.cyan(`   ℹ blueprint.json: campos preservados — ${preservedKeys.join(', ')}`));
        }
    } catch (e) {
        console.warn(chalk.yellow(`   ⚠ No se pudo escribir blueprint.json: ${e.message}`));
    }
}
