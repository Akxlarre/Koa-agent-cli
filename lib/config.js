/**
 * lib/config.js — Stack resolution & input validation
 *
 * Responsabilidades:
 *   - Resolver el stack final (CLI flags + koa-config.json)
 *   - Validar nombres de proyecto
 *   - Parsear JSONC (JSON con comentarios)
 *   - Exportar constantes globales: BLUEPRINT_VERSION, MIN_NODE_MAJOR
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

export const BLUEPRINT_VERSION = '6.4.0';
export const MIN_NODE_MAJOR = 20;
// Major de Angular CLI pineado: el blueprint (boilerplate, PrimeNG, reglas) está
// validado contra Angular 20. `@latest` apunta a majors nuevos con requisitos
// de Node distintos y breaking changes en ng new.
export const ANGULAR_CLI_VERSION = '20';

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

/**
 * Parsea JSON con comentarios de bloque y línea.
 * Recorre carácter a carácter para NO eliminar `//` dentro de strings
 * (ej: "https://example.com" en un tsconfig) — un regex global los rompería.
 */
export function parseJsonc(text) {
    let out = '';
    let i = 0;
    let inString = false;

    while (i < text.length) {
        const ch = text[i];
        const next = text[i + 1];

        if (inString) {
            out += ch;
            if (ch === '\\') { out += next ?? ''; i += 2; continue; }
            if (ch === '"') inString = false;
            i++;
            continue;
        }
        if (ch === '"') { inString = true; out += ch; i++; continue; }
        if (ch === '/' && next === '/') {
            while (i < text.length && text[i] !== '\n') i++;
            continue;
        }
        if (ch === '/' && next === '*') {
            i += 2;
            while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
            i += 2;
            continue;
        }
        out += ch;
        i++;
    }
    return JSON.parse(out);
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

/**
 * Devuelve el valor explícito de cada flag o null si no fue pasado.
 * null permite que koa-config.json (y luego el default) decidan —
 * un flag presente SIEMPRE gana sobre el archivo de config.
 */
function parseCliFlags() {
    const args = process.argv.slice(2);
    const tri = (withFlag, noFlag) =>
        args.includes(noFlag) ? false : (args.includes(withFlag) ? true : null);
    return {
        supabase:    args.includes('--no-supabase')  ? false : null,
        primeng:     args.includes('--no-primeng')   ? false : null,
        gsap:        tri('--with-gsap', '--no-gsap'),
        ngrxSignals: args.includes('--with-ngrx-signals') ? true : null,
        e2e:         args.includes('--with-e2e')      ? true : null,
        cursor:      args.includes('--with-cursor')   ? true : null,
        windsurf:    args.includes('--with-windsurf') ? true : null,
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
    // Precedencia uniforme: flag CLI explícito > koa-config.json > default
    return {
        supabase:    cliFlags.supabase    ?? fileFlags.supabase    ?? true,
        primeng:     cliFlags.primeng     ?? fileFlags.primeng     ?? true,
        gsap:        cliFlags.gsap        ?? fileFlags.gsap        ?? false,
        ngrxSignals: cliFlags.ngrxSignals ?? fileFlags.ngrxSignals ?? false,
        e2e:         cliFlags.e2e         ?? fileFlags.e2e         ?? false,
        cursor:      cliFlags.cursor      ?? fileFlags.cursor      ?? false,
        windsurf:    cliFlags.windsurf    ?? fileFlags.windsurf    ?? false,
    };
}

/** Resuelve el stack final combinando flags CLI y koa-config.json. */
export function resolveStack() {
    return readKoaConfig(parseCliFlags());
}
