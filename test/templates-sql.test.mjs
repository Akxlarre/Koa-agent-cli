/**
 * Sintaxis de las migraciones que el CLI entrega en cada proyecto.
 *
 * Motivo: las dos semillas de auth usaban `CREATE POLICY IF NOT EXISTS`, que
 * PostgreSQL no soporta en ninguna versión. Fallaban con un error de sintaxis en
 * el primer `supabase db reset`, dejando `profiles` con RLS activo y CERO
 * policies — o sea, bloqueo total de auth en todo proyecto generado. Nadie lo
 * notó porque nadie había corrido las migraciones nunca.
 *
 * Un test que aplique SQL de verdad necesita Postgres, y no siempre está. Este
 * es estático a propósito: cuesta milisegundos y caza justo esta clase de error.
 *
 * `node --test test/*.test.mjs`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Objetos que NO aceptan `IF NOT EXISTS` en PostgreSQL. Para éstos la forma
 * idempotente correcta es `CREATE OR REPLACE` (funciones, vistas) o
 * `DROP ... IF EXISTS` seguido de `CREATE` (policies, triggers).
 *
 * Sí lo aceptan, y por eso no están acá: TABLE, INDEX, SCHEMA, SEQUENCE,
 * EXTENSION, VIEW y MATERIALIZED VIEW.
 */
const SIN_IF_NOT_EXISTS = ['POLICY', 'TRIGGER', 'FUNCTION', 'PROCEDURE', 'TYPE', 'RULE', 'DOMAIN'];

function migraciones() {
    const dir = path.join(ROOT, 'templates', 'supabase', 'migrations');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.sql'))
        .map(f => ({ nombre: f, sql: fs.readFileSync(path.join(dir, f), 'utf8') }));
}

test('hay migraciones que verificar', () => {
    assert.ok(migraciones().length > 0, 'no se encontró ninguna migración en templates/supabase/migrations');
});

test('ningún CREATE usa IF NOT EXISTS donde PostgreSQL no lo soporta', () => {
    const errores = [];
    for (const { nombre, sql } of migraciones()) {
        for (const objeto of SIN_IF_NOT_EXISTS) {
            const re = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?${objeto}\\s+IF\\s+NOT\\s+EXISTS`, 'gi');
            const hits = sql.match(re);
            if (hits) errores.push(`${nombre}: ${hits.length}× "${hits[0].replace(/\s+/g, ' ')}"`);
        }
    }
    assert.deepEqual(errores, [], `Sintaxis inválida — PostgreSQL rechaza estos CREATE:\n  ${errores.join('\n  ')}`);
});

test('cada policy se puede reaplicar (lleva su DROP POLICY IF EXISTS)', () => {
    const errores = [];
    for (const { nombre, sql } of migraciones()) {
        const creadas = [...sql.matchAll(/CREATE\s+POLICY\s+"?([\w-]+)"?/gi)].map(m => m[1]);
        const dropeadas = new Set(
            [...sql.matchAll(/DROP\s+POLICY\s+IF\s+EXISTS\s+"?([\w-]+)"?/gi)].map(m => m[1]),
        );
        for (const p of creadas) {
            if (!dropeadas.has(p)) errores.push(`${nombre}: policy "${p}" sin DROP previo`);
        }
    }
    assert.deepEqual(errores, [], `Migraciones no idempotentes:\n  ${errores.join('\n  ')}`);
});

test('cada trigger se puede reaplicar (lleva su DROP TRIGGER IF EXISTS)', () => {
    const errores = [];
    for (const { nombre, sql } of migraciones()) {
        const creados = [...sql.matchAll(/CREATE\s+TRIGGER\s+"?([\w-]+)"?/gi)].map(m => m[1]);
        const dropeados = new Set(
            [...sql.matchAll(/DROP\s+TRIGGER\s+IF\s+EXISTS\s+"?([\w-]+)"?/gi)].map(m => m[1]),
        );
        for (const t of creados) {
            if (!dropeados.has(t)) errores.push(`${nombre}: trigger "${t}" sin DROP previo`);
        }
    }
    assert.deepEqual(errores, [], `Triggers no idempotentes:\n  ${errores.join('\n  ')}`);
});

test('toda tabla creada activa RLS — es la regla del propio harness', () => {
    const errores = [];
    for (const { nombre, sql } of migraciones()) {
        const tablas = [...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(public\.\w+)/gi)]
            .map(m => m[1].toLowerCase());
        const conRls = new Set(
            [...sql.matchAll(/ALTER\s+TABLE\s+(public\.\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi)]
                .map(m => m[1].toLowerCase()),
        );
        for (const t of tablas) {
            if (!conRls.has(t)) errores.push(`${nombre}: ${t} sin ENABLE ROW LEVEL SECURITY`);
        }
    }
    assert.deepEqual(errores, [], `Tablas sin RLS:\n  ${errores.join('\n  ')}`);
});
