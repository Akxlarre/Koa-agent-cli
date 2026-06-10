/**
 * lib/ui.js — Visual output (banner + success message)
 *
 * Responsabilidad única: salida chalk al terminal.
 * Sin operaciones de filesystem ni spawn.
 */

import chalk from 'chalk';
import { BLUEPRINT_VERSION } from './config.js';

export function printBanner() {
    const border = chalk.blue('║');
    const topBottom = chalk.blue;
    console.log('');
    console.log(topBottom('╔══════════════════════════════════════════════╗'));
    console.log(`${border}                                              ${border}`);
    console.log(`${border}    ${chalk.white.bold(`🧠  Koa Agent CLI  ·  Blueprint v${BLUEPRINT_VERSION}`)}    ${border}`);
    console.log(`${border}  ${chalk.blue('Angular · Tailwind · Supabase · AI-Native')}   ${border}`);
    console.log(`${border}                                              ${border}`);
    console.log(topBottom('╚══════════════════════════════════════════════╝'));
    console.log('');
}

/** Advierte qué archivos existentes serán sobrescritos por la inyección. */
export function printCollisionWarning(collisions) {
    console.log(chalk.yellow(`⚠ La inyección sobrescribirá ${collisions.length} archivo(s) existente(s):`));
    collisions.slice(0, 10).forEach(f => console.log(chalk.yellow(`   · ${f}`)));
    if (collisions.length > 10) {
        console.log(chalk.yellow(`   … y ${collisions.length - 10} más`));
    }
}

export function printSuccess(projectName, isFull, targetDir) {
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
        console.log(`  ${chalk.blue.bold(step)}  ${chalk.white('Configura tus credenciales Supabase')}`);
        console.log(`     ${chalk.gray('→')} Edita ${chalk.cyan('src/environments/environment.ts')} con tu URL y anon key`);
        console.log(`     ${chalk.gray('→')} Obtén las claves en: ${chalk.cyan('supabase.com/dashboard/project/_/settings/api')}`);
        console.log(`     ${chalk.gray('→')} Levanta Supabase local: ${chalk.cyan('npm run supabase:start')}`);
        console.log('');
        step++;

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
