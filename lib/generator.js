/**
 * lib/generator.js — Generador de artefactos para proyectos KoA Blueprint
 *
 * Responsabilidades:
 *   - Detectar que estamos dentro de un proyecto KoA (blueprint.json)
 *   - Parsear el subcomando: `generate feature [nombre]`
 *   - Derivar variables de nomenclatura (domain / Domain / Domains)
 *   - Aplicar plantillas de feature-templates.js
 *   - Escribir archivos en las rutas canónicas (sin sobreescribir existentes)
 *
 * Sin lógica de scaffolding inicial ni npm — eso es installer.js / scaffolder.js.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { FEATURE_TEMPLATES } from './feature-templates.js';

// ─── Helpers de nomenclatura ─────────────────────────────────────────────────

/**
 * Convierte kebab-case a PascalCase.
 * Ejemplo: "mis-productos" → "MisProductos"
 */
function toPascalCase(str) {
    return str.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

/**
 * Deriva el singular de un nombre plural en kebab-case.
 * Heurística simple para español/inglés: elimina la 's' final.
 * El usuario siempre puede corregir en el prompt interactivo.
 *
 * Ejemplos:
 *   productos     → producto
 *   usuarios      → usuario
 *   notifications → notification
 *   categories    → categorie  (imperfecto)
 *
 * La heurística falla y va a seguir fallando: es una `s` menos, no morfología.
 * Lo que importa es que se pueda corregir en los DOS modos — el interactivo lo
 * ofrece como default editable, el no-interactivo lo imprime y acepta
 * `--singular <Nombre>` (INC-013).
 */
function deriveSingular(plural) {
    if (plural.endsWith('s') && plural.length > 2) return plural.slice(0, -1);
    return plural;
}

// ─── Helpers de template ─────────────────────────────────────────────────────

function applyTemplate(template, vars) {
    return template
        .replace(/\{\{domain\}\}/g, vars.domain)
        .replace(/\{\{Domain\}\}/g, vars.Domain)
        .replace(/\{\{Domains\}\}/g, vars.Domains);
}

// ─── Parser de argumentos ────────────────────────────────────────────────────

const VALID_TYPES = ['list', 'detail', 'form'];

/**
 * Extrae `--type <valor>`, `--singular <Valor>` y el dominio posicional de argv.
 *
 * INC-013: el docblock de `deriveSingular` se defendía con «el usuario siempre
 * puede corregir en el prompt interactivo», y en modo no-interactivo ese prompt
 * no existe. `categories` salía como `Categorie` en los nombres de clase, los
 * imports y los selectores de siete archivos, sin que nadie pudiera decir otra
 * cosa. `--singular` es la corrección que el docblock daba por hecha.
 *
 * @param {string[]} args
 * @returns {{ domain: string | null, type: string, singular: string | null }}
 */
function parseFeatureArgs(args) {
    let domain = null;
    let type = 'list';
    let singular = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--type' && args[i + 1]) {
            type = args[++i];
        } else if (args[i] === '--singular' && args[i + 1]) {
            singular = args[++i].trim();
        } else if (!args[i].startsWith('-')) {
            domain = args[i].trim();
        }
    }

    if (singular !== null && !/^[A-Z][a-zA-Z0-9]*$/.test(singular)) {
        console.error(chalk.red(
            `\n✗ --singular inválido: "${singular}". Debe ser PascalCase (ej: Categoria).\n`
        ));
        process.exit(1);
    }

    if (!VALID_TYPES.includes(type)) {
        console.error(chalk.red(
            `\n✗ Tipo inválido: "${type}".\n` +
            `  Tipos válidos: ${VALID_TYPES.join(', ')}\n`
        ));
        process.exit(1);
    }

    return { domain, type, singular };
}

// ─── Helpers de sistema de archivos ─────────────────────────────────────────

function writeFeatureFile(filePath, content) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

function checkKoaProject(cwd) {
    const bpPath = path.join(cwd, 'blueprint.json');
    if (!fs.existsSync(bpPath)) return null;
    try {
        return JSON.parse(fs.readFileSync(bpPath, 'utf8'));
    } catch {
        return null;
    }
}

// ─── Generación de feature ────────────────────────────────────────────────────

/**
 * Construye la lista de archivos a generar según el tipo de arquetipo.
 *
 * | Tipo   | Archivos | Componente de página |
 * |--------|----------|----------------------|
 * | list   | 7        | lista con bento-grid + dumb card/skeleton |
 * | detail | 5        | ficha individual (grid 2/3 + aside 1/3) |
 * | form   | 5        | formulario centrado (.page-narrow) |
 *
 * @param {string} srcDir
 * @param {string} domain
 * @param {'list'|'detail'|'form'} type
 */
function buildFileList(srcDir, domain, type = 'list') {
    const isDetail = type === 'detail';

    const base = [
        {
            tpl: 'repository',
            dest: path.join(srcDir, 'core', 'repositories', `${domain}.repository.ts`),
            label: `core/repositories/${domain}.repository.ts`,
        },
        {
            tpl: isDetail ? 'facade-detail' : 'facade',
            dest: path.join(srcDir, 'core', 'facades', `${domain}.facade.ts`),
            label: `core/facades/${domain}.facade.ts`,
        },
        {
            tpl: 'repository-spec',
            dest: path.join(srcDir, 'core', 'repositories', `${domain}.repository.spec.ts`),
            label: `core/repositories/${domain}.repository.spec.ts`,
        },
        {
            tpl: isDetail ? 'facade-detail-spec' : 'facade-spec',
            dest: path.join(srcDir, 'core', 'facades', `${domain}.facade.spec.ts`),
            label: `core/facades/${domain}.facade.spec.ts`,
        },
    ];

    if (type === 'list') {
        return [
            base[0], base[1],
            {
                tpl: 'smart-page',
                dest: path.join(srcDir, 'features', domain, `${domain}.component.ts`),
                label: `features/${domain}/${domain}.component.ts`,
            },
            {
                tpl: 'dumb-card',
                dest: path.join(srcDir, 'shared', 'components', `${domain}-card`, `${domain}-card.component.ts`),
                label: `shared/components/${domain}-card/${domain}-card.component.ts`,
            },
            {
                tpl: 'dumb-skeleton',
                dest: path.join(srcDir, 'shared', 'components', `${domain}-card`, `${domain}-card-skeleton.component.ts`),
                label: `shared/components/${domain}-card/${domain}-card-skeleton.component.ts`,
            },
            base[2], base[3],
        ];
    }

    if (type === 'detail') {
        return [
            base[0], base[1],
            {
                tpl: 'smart-page-detail',
                dest: path.join(srcDir, 'features', domain, `${domain}-detail.component.ts`),
                label: `features/${domain}/${domain}-detail.component.ts`,
            },
            base[2], base[3],
        ];
    }

    // type === 'form'
    return [
        base[0], base[1],
        {
            tpl: 'smart-page-form',
            dest: path.join(srcDir, 'features', domain, `${domain}-form.component.ts`),
            label: `features/${domain}/${domain}-form.component.ts`,
        },
        base[2], base[3],
    ];
}

async function runGenerateFeature(args, cwd) {
    let { domain, type, singular } = parseFeatureArgs(args);
    let singularPascal;

    if (domain) {
        // Modo no-interactivo: nombre pasado como argumento
        if (!/^[a-z][a-z0-9-]*$/.test(domain)) {
            console.error(chalk.red(`✗ Nombre inválido: "${domain}". Usa kebab-case en minúsculas (ej: mis-productos).`));
            process.exit(1);
        }
        // Modo no-interactivo: no hay prompt donde corregir la heurística, así que
        // se dice qué nombre se derivó y con qué flag cambiarlo (INC-013).
        if (singular) {
            singularPascal = singular;
        } else {
            singularPascal = toPascalCase(deriveSingular(domain));
            console.log(chalk.gray(
                `   · Modelo derivado del plural: ${singularPascal}. ` +
                `Si no es el nombre correcto, corré de nuevo con --singular <Nombre>.`
            ));
        }
    } else {
        // Modo interactivo
        const answers = await inquirer.prompt([
            {
                type: 'list',
                name: 'type',
                message: 'Tipo de página:',
                choices: [
                    { name: 'list   — lista con bento-grid + card/skeleton (7 archivos)', value: 'list' },
                    { name: 'detail — ficha individual con grid 2/3+1/3    (5 archivos)', value: 'detail' },
                    { name: 'form   — formulario centrado (.page-narrow)    (5 archivos)', value: 'form' },
                ],
                default: type,
            },
            {
                type: 'input',
                name: 'domain',
                message: 'Nombre del dominio (kebab-case, plural):',
                validate: v => /^[a-z][a-z0-9-]*$/.test(v.trim()) || 'Solo minúsculas, números y guiones. Debe empezar con letra.',
                filter: v => v.trim(),
            },
            {
                type: 'input',
                name: 'singular',
                message: 'Nombre del modelo (PascalCase, singular):',
                default: ans => toPascalCase(deriveSingular(ans.domain)),
                validate: v => /^[A-Z][a-zA-Z0-9]*$/.test(v.trim()) || 'Debe empezar con mayúscula (PascalCase).',
                filter: v => v.trim(),
            },
        ]);
        type = answers.type;
        domain = answers.domain;
        singularPascal = answers.singular;
    }

    const vars = {
        domain,
        Domain: singularPascal,
        Domains: toPascalCase(domain),
    };

    const srcDir = path.join(cwd, 'src', 'app');
    if (!fs.existsSync(srcDir)) {
        console.error(chalk.red('✗ No se encontró src/app/. Ejecuta este comando desde la raíz del proyecto Angular.'));
        process.exit(1);
    }

    const files = buildFileList(srcDir, domain, type);

    // Verificar conflictos antes de escribir nada
    const conflicts = files.filter(f => fs.existsSync(f.dest));
    if (conflicts.length > 0) {
        console.error(chalk.red('\n✗ Los siguientes archivos ya existen:'));
        conflicts.forEach(f => console.error(chalk.red(`  ${f.label}`)));
        console.error(chalk.yellow('\n  Elige otro nombre o elimina los archivos existentes antes de continuar.\n'));
        process.exit(1);
    }

    // Generar archivos
    console.log('');
    console.log(chalk.cyan(
        `Generando feature "${domain}" [${type}] (${vars.Domain} / ${vars.Domains}) — ${files.length} archivos...\n`
    ));

    for (const file of files) {
        const content = applyTemplate(FEATURE_TEMPLATES[file.tpl], vars);
        writeFeatureFile(file.dest, content);
        console.log(chalk.green(`  ✓ src/app/${file.label}`));
    }

    // Próximos pasos según tipo
    console.log('');
    console.log(chalk.bold('Próximos pasos:'));
    console.log(chalk.gray(`  1. Define la interfaz ${vars.Domain} en src/app/core/models/${domain}.model.ts`));
    console.log(chalk.gray(`     y reemplaza ${vars.Domain}Row en el repository y la facade`));

    if (type === 'list') {
        console.log(chalk.gray(`  2. Completa fetchData() en ${vars.Domains}Facade con la query real`));
        console.log(chalk.gray(`  3. Actualiza la card con los campos del modelo`));
        console.log(chalk.gray(`  4. Agrega la ruta en src/app/app.routes.ts:`));
        console.log('');
        console.log(chalk.white(
            `     { path: '${domain}', loadComponent: () =>\n` +
            `       import('./features/${domain}/${domain}.component')\n` +
            `         .then(m => m.${vars.Domains}Component) }`
        ));
    } else if (type === 'detail') {
        console.log(chalk.gray(`  2. Completa fetchData() en ${vars.Domains}Facade con findById(id)`));
        console.log(chalk.gray(`  3. Rellena el template detail con los campos del modelo`));
        console.log(chalk.gray(`  4. Agrega la ruta en src/app/app.routes.ts:`));
        console.log('');
        console.log(chalk.white(
            `     { path: '${domain}/:id', loadComponent: () =>\n` +
            `       import('./features/${domain}/${domain}-detail.component')\n` +
            `         .then(m => m.${vars.Domains}DetailComponent) }`
        ));
    } else {
        // form
        console.log(chalk.gray(`  2. Completa crear() en ${vars.Domains}Facade con la mutación real`));
        console.log(chalk.gray(`  3. Reemplaza exampleField con los campos del formulario real`));
        console.log(chalk.gray(`  4. Agrega la ruta en src/app/app.routes.ts:`));
        console.log('');
        console.log(chalk.white(
            `     { path: '${domain}/nuevo', loadComponent: () =>\n` +
            `       import('./features/${domain}/${domain}-form.component')\n` +
            `         .then(m => m.${vars.Domains}FormComponent) }`
        ));
    }

    console.log('');
    console.log(chalk.gray(`  5. Corre los tests base: npx vitest run src/app/core`));
    console.log(chalk.gray(`  6. Actualiza los índices: npm run indices:sync`));
    console.log('');
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Punto de entrada llamado desde bin/index.js cuando detecta `generate`.
 * @param {string[]} args — argv después de "generate"
 */
export async function runGenerate(args) {
    const cwd = process.cwd();

    const bp = checkKoaProject(cwd);
    if (!bp) {
        console.error(chalk.red(
            '\n✗ No se encontró blueprint.json en el directorio actual.\n' +
            '  Ejecuta este comando desde la raíz de un proyecto generado con create-koa-agent.\n'
        ));
        process.exit(1);
    }

    const subcommand = args[0];

    if (!subcommand || subcommand === 'feature') {
        await runGenerateFeature(args.slice(subcommand === 'feature' ? 1 : 0), cwd);
    } else {
        console.error(chalk.red(
            `\n✗ Subcomando desconocido: "${subcommand}".\n` +
            `  Uso: npx create-koa-agent generate feature [nombre]\n`
        ));
        process.exit(1);
    }
}
