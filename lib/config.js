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

export const BLUEPRINT_VERSION = '7.2.0';
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

/**
 * El blueprint es un contrato de DOS productores:
 *   · el CLI escribe cómo se materializó el scaffold (`mode`, `stack`, `managedPaths`)
 *   · Wikiflow escribe la profundidad metodológica (`tier`, `team`, `product`)
 *
 * Por eso los campos de Wikiflow son OPCIONALES y se validan sólo si están: un
 * proyecto arrancado directo con `npx create-koa-agent` no pasó por las fases y no
 * tiene por qué declarar un tier.
 *
 * `scaffoldMode` es el nombre nuevo de `mode`. Se acepta cualquiera de los dos —
 * exigir sólo `mode` rechazaba blueprints legítimos de Wikiflow.
 */
const BLUEPRINT_SCHEMA = {
    required: ['name', 'version', 'generatedAt', 'stack'],
    modes: ['full-scaffold', 'inject-only'],
    tiers: ['solo', 'starter', 'agency'],
    horizons: ['stable', 'growing', 'shrinking'],
    complexities: ['crud', 'domain-heavy', 'platform'],
    lifespans: ['prototype', 'mvp', 'long-lived'],
    stackFields: ['angular', 'tailwind', 'primeng', 'gsap', 'supabase', 'ngrxSignals', 'e2e', 'cursor', 'windsurf'],
};

/** Valida un valor opcional contra una lista cerrada. */
function checkEnum(errors, value, allowed, label) {
    if (value === undefined || value === null) return;
    if (!allowed.includes(value)) {
        errors.push(`${label} inválido: "${value}". Esperado: ${allowed.join(' | ')}.`);
    }
}

/**
 * Valida un objeto blueprint.json contra el schema canónico.
 * Retorna { ok: boolean, errors: string[] }.
 */
export function validateBlueprintJson(bp) {
    const errors = [];
    if (!bp || typeof bp !== 'object' || Array.isArray(bp)) {
        return { ok: false, errors: ['blueprint.json no es un objeto válido.'] };
    }
    for (const field of BLUEPRINT_SCHEMA.required) {
        if (!(field in bp)) errors.push(`Campo requerido faltante: "${field}".`);
    }

    const mode = bp.scaffoldMode ?? bp.mode;
    if (mode === undefined) {
        errors.push('Campo requerido faltante: "scaffoldMode" (o su alias legacy "mode").');
    } else {
        checkEnum(errors, mode, BLUEPRINT_SCHEMA.modes, 'scaffoldMode');
    }

    if (bp.stack && typeof bp.stack === 'object') {
        for (const key of BLUEPRINT_SCHEMA.stackFields) {
            if (key in bp.stack && typeof bp.stack[key] !== 'boolean') {
                errors.push(`stack.${key} debe ser boolean, recibido: ${typeof bp.stack[key]}.`);
            }
        }
    }

    // ── Campos de Wikiflow — opcionales, validados sólo si existen ──────────
    checkEnum(errors, bp.tier, BLUEPRINT_SCHEMA.tiers, 'tier');

    if (bp.team !== undefined && bp.team !== null) {
        if (typeof bp.team !== 'object' || Array.isArray(bp.team)) {
            errors.push('team debe ser un objeto.');
        } else {
            if ('size' in bp.team && !Number.isInteger(bp.team.size)) {
                errors.push(`team.size debe ser un entero, recibido: ${typeof bp.team.size}.`);
            }
            checkEnum(errors, bp.team.horizon6mo, BLUEPRINT_SCHEMA.horizons, 'team.horizon6mo');
        }
    }

    if (bp.product !== undefined && bp.product !== null) {
        if (typeof bp.product !== 'object' || Array.isArray(bp.product)) {
            errors.push('product debe ser un objeto.');
        } else {
            checkEnum(errors, bp.product.complexity, BLUEPRINT_SCHEMA.complexities, 'product.complexity');
            checkEnum(errors, bp.product.lifespan, BLUEPRINT_SCHEMA.lifespans, 'product.lifespan');
        }
    }

    return { ok: errors.length === 0, errors };
}

/**
 * Quita los comentarios de un JSONC, RESPETANDO los strings.
 *
 * HUE-020. La versión anterior eran dos `replace`, y un `replace` no sabe si el
 * `//` que encontró está dentro de comillas. Medido sobre entradas reales:
 *
 *   { "$schema": "https://json.schemastore.org/tsconfig" }  → SyntaxError
 *   { "url": "http://x.com/y" }                             → SyntaxError
 *
 * Y el llamador —el parche de `tsconfig.json` en scaffolder.js— atrapaba ese
 * error, imprimía un `⚠` amarillo y seguía: el proyecto salía sin los aliases
 * `@core/*`, `@shared/*`, `@features/*`, `@layout/*` que el boilerplate importa
 * en todos lados. Un proyecto que no compila, después de una línea amarilla
 * entre veinte verdes.
 *
 * `$schema` no es exótico: lo recomienda el propio schemastore, y basta con que
 * una versión de `ng new` lo agregue para que el generador deje de funcionar.
 *
 * Se recorre carácter por carácter. Son veinte líneas y no tiene el filo.
 */
export function stripJsonComments(text) {
    const src = String(text);
    let out = '';
    let enString = false;

    for (let i = 0; i < src.length; i++) {
        const c = src[i];

        if (enString) {
            out += c;
            if (c === '\\') { out += src[++i] ?? ''; continue; }  // escape: se copia el par
            if (c === '"') enString = false;
            continue;
        }

        if (c === '"') { enString = true; out += c; continue; }

        if (c === '/' && src[i + 1] === '/') {
            while (i < src.length && src[i] !== '\n') i++;
            out += '\n';               // se conserva el salto: los números de línea no se mueven
            continue;
        }

        if (c === '/' && src[i + 1] === '*') {
            const fin = src.indexOf('*/', i + 2);
            const bloque = fin === -1 ? src.slice(i) : src.slice(i, fin + 2);
            out += bloque.replace(/[^\n]/g, '');   // idem: se dejan los saltos
            i = fin === -1 ? src.length : fin + 1;
            continue;
        }

        out += c;
    }

    return out;
}

/** Parsea JSON con comentarios de bloque y línea. */
export function parseJsonc(text) {
    return JSON.parse(stripJsonComments(text));
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
    // INC-012: se valida SIEMPRE, no solo corriendo en Windows. Un proyecto
    // llamado `aux` generado en Linux se crea sin problema y revienta al clonarlo
    // en la máquina del compañero — que es donde el error ya no tiene arreglo
    // barato. El nombre viaja con el repo; la plataforma de quien lo generó, no.
    if (windowsReserved.has(lower)) {
        return { ok: false, reason: 'Nombre reservado en Windows (CON/PRN/AUX/NUL/COM1…/LPT1…): el repo no se puede clonar ahí.' };
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
