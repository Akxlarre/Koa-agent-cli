/**
 * lib/config.js — Stack resolution & input validation
 *
 * Responsabilidades:
 *   - Resolver el stack final (CLI flags + koa-config.json)
 *   - Validar nombres de proyecto
 *   - Parsear JSONC (JSON con comentarios)
 *   - Exportar constantes globales: BLUEPRINT_VERSION, MIN_NODE_MAJOR, ANGULAR_MAJOR
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

export const BLUEPRINT_VERSION = '7.0.0';
export const MIN_NODE_MAJOR = 20;

/**
 * Major de Angular con el que se scaffoldea.
 *
 * PINEADO A PROPÓSITO — no usar `@angular/cli@latest`. El ecosistema del stack
 * (PrimeNG, lucide-angular, @analogjs/vitest-angular) tarda semanas o meses en
 * declarar soporte para un major nuevo de Angular. Con `latest`, el día que
 * Angular publica un major TODOS los scaffolds fallan con ERESOLVE:
 * `ng new` instala el major nuevo y el siguiente `npm install` no puede
 * resolver los peers de los satélites.
 *
 * Para subirlo: verificar primero que PrimeNG, lucide-angular y
 * @analogjs/vitest-angular declaren soporte, y recién ahí bumpear acá.
 */
export const ANGULAR_MAJOR = 21;

// ─── Blueprint JSON Schema ────────────────────────────────────────────────────

const BLUEPRINT_SCHEMA = {
    required: ['name', 'version', 'generatedAt', 'mode', 'stack'],
    modes: ['full-scaffold', 'inject-only'],
    stackFields: ['angular', 'tailwind', 'primeng', 'gsap', 'supabase', 'ngrxSignals', 'e2e', 'cursor', 'windsurf'],
};

/**
 * Valida un objeto blueprint.json contra el schema canónico.
 * Retorna { ok: boolean, errors: string[] }.
 */
export function validateBlueprintJson(bp) {
    const errors = [];
    if (!bp || typeof bp !== 'object') {
        return { ok: false, errors: ['blueprint.json no es un objeto válido.'] };
    }
    for (const field of BLUEPRINT_SCHEMA.required) {
        if (!(field in bp)) errors.push(`Campo requerido faltante: "${field}".`);
    }
    if (bp.mode && !BLUEPRINT_SCHEMA.modes.includes(bp.mode)) {
        errors.push(`mode inválido: "${bp.mode}". Esperado: ${BLUEPRINT_SCHEMA.modes.join(' | ')}.`);
    }
    if (bp.stack && typeof bp.stack === 'object') {
        for (const key of BLUEPRINT_SCHEMA.stackFields) {
            if (key in bp.stack && typeof bp.stack[key] !== 'boolean') {
                errors.push(`stack.${key} debe ser boolean, recibido: ${typeof bp.stack[key]}.`);
            }
        }
    }
    return { ok: errors.length === 0, errors };
}

/** Parsea JSON con comentarios de bloque y línea. */
export function parseJsonc(text) {
    const stripped = text
        .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
        .replace(/\/\/.*$/gm, '');           // line comments
    return JSON.parse(stripped);
}

/** Valida el nombre del proyecto. Devuelve { ok, name } o { ok, reason }. */
export function validateProjectName(name) {
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
        return { ok: false, reason: 'Nombre reservado en Windows (CON/PRN/AUX/NUL/COM1…/LPT1…).' };
    }

    return { ok: true, name: trimmed };
}

/** Extrae el major version de una string tipo "v20.1.0" → 20. */
export function parseMajor(versionLike) {
    const m = String(versionLike ?? '').trim().match(/^v?(\d+)\./);
    return m ? Number(m[1]) : null;
}

function parseCliFlags() {
    const args = process.argv.slice(2);
    return {
        supabase:    !args.includes('--no-supabase'),
        gsap:        args.includes('--with-gsap') && !args.includes('--no-gsap'),
        primeng:     !args.includes('--no-primeng'),
        ngrxSignals: args.includes('--with-ngrx-signals'),
        e2e:         args.includes('--with-e2e'),
        cursor:      args.includes('--with-cursor'),
        windsurf:    args.includes('--with-windsurf'),
    };
}

// SEC-06: Whitelist of allowed stack keys from koa-config.json.
// Prevents prototype pollution and injection of unexpected keys from user-controlled files.
const ALLOWED_STACK_KEYS = ['supabase', 'gsap', 'primeng', 'ngrxSignals', 'e2e', 'cursor', 'windsurf'];

function readKoaConfig(cliFlags) {
    const configPath = path.join(process.cwd(), 'koa-config.json');
    let fileFlags = {};
    if (fs.existsSync(configPath)) {
        try {
            const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            // SEC-06: Only extract explicitly allowed keys — never spread raw.stack directly.
            if (raw.stack && typeof raw.stack === 'object' && !Array.isArray(raw.stack)) {
                for (const key of ALLOWED_STACK_KEYS) {
                    if (Object.prototype.hasOwnProperty.call(raw.stack, key)) {
                        fileFlags[key] = Boolean(raw.stack[key]);
                    }
                }
            }
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
        cursor:      (fileFlags.cursor      ?? false) || cliFlags.cursor,
        windsurf:    (fileFlags.windsurf    ?? false) || cliFlags.windsurf,
    };
}

/** Resuelve el stack final combinando flags CLI y koa-config.json. */
export function resolveStack() {
    return readKoaConfig(parseCliFlags());
}
