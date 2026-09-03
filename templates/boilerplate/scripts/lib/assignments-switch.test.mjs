/**
 * Contrato del interruptor de asignaciones — ADR-004.
 *
 * La capa eran 886 líneas en seis archivos con CERO tests, cero cobertura en
 * `smoke-scripts` y su ruta documentada rota de punta a punta: `sdd/SKILL.md` la
 * instruía tres veces y el npm script que mandaba correr no existía.
 *
 * Acá se fija lo que la hace integrable en vez de un parche: los tres estados del
 * interruptor, y que generador y detector de IDs hablen el mismo idioma — que es
 * justo lo que faltaba cuando ocurrió INC-017.
 *
 * `node --test scripts/lib/assignments-switch.test.mjs`
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
    autoresDeclarados, avisoApagada, capaEncendida, formatoEsperado, parseTrackName,
} from './assignments-switch.js';

const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIT = path.join(SCRIPTS, 'assignments-audit.js');
const SYNC = path.join(SCRIPTS, 'assignments-sync.js');

let proyecto;
const specs = () => path.join(proyecto, 'specs');

function escribir(rel, contenido) {
    const full = path.join(proyecto, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contenido);
}

const AUTHORS = '# Autores\n\n| Código | Nombre |\n|---|---|\n| `b` | Benjamín |\n| `m` | María |\n';
/**
 * La forma REAL del tablero, con las secciones y los marcadores que
 * `assignments-sync` necesita para escribir. Copiada de
 * `.claude/skills/sdd/templates/ASSIGNMENTS.md` — que hasta INC-022 no traía
 * los marcadores, y por eso el único camino de escritura de la capa fallaba
 * incluso en un proyecto que había hecho todo bien.
 */
const TABLERO = [
    '# Asignaciones', '',
    '## Pendientes', '',
    '| ID | Título |', '|----|--------|', '',
    '## Reclamadas / En curso', '',
    '<!-- AUTO-GENERATED:BEGIN -->',
    '| ID | Título | Reclamado por | Track resultante | Fecha |',
    '|----|--------|----------------|-------------------|-------|',
    '<!-- AUTO-GENERATED:END -->', '',
    '## Completadas', '',
    '<!-- AUTO-GENERATED:BEGIN -->',
    '| ID | Título | Track resultante | Cerrada |',
    '|----|--------|-------------------|---------|',
    '<!-- AUTO-GENERATED:END -->', '',
    '## Convenciones', '',
].join('\n');

function correr(script) {
    const r = spawnSync('node', [script], { cwd: proyecto, encoding: 'utf8' });
    return { exit: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

beforeEach(() => { proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-asg-')); });
afterEach(() => { fs.rmSync(proyecto, { recursive: true, force: true }); });

describe('EL INTERRUPTOR — un archivo decide si la capa existe', () => {
    test('sin AUTHORS.md la capa está apagada', () => {
        assert.equal(capaEncendida(specs()), false);
        fs.mkdirSync(specs(), { recursive: true });
        assert.equal(capaEncendida(specs()), false, 'ni siquiera con specs/ vacío');
    });

    test('con AUTHORS.md, encendida', () => {
        escribir('specs/AUTHORS.md', AUTHORS);
        assert.equal(capaEncendida(specs()), true);
    });

    test('el tablero solo no la enciende: AUTHORS.md es el hecho', () => {
        // ASSIGNMENTS.md es el tablero; AUTHORS.md declara que hay más de un autor,
        // que es lo único que hace necesario el código de autor en los IDs.
        escribir('specs/ASSIGNMENTS.md', TABLERO);
        assert.equal(capaEncendida(specs()), false);
    });

    test('lee los códigos de autor de la tabla', () => {
        escribir('specs/AUTHORS.md', AUTHORS);
        assert.deepEqual([...autoresDeclarados(specs())].sort(), ['b', 'm']);
    });

    test('sin capa, cero autores y sin reventar', () => {
        assert.deepEqual([...autoresDeclarados(specs())], []);
    });
});

describe('LOS TRES ESTADOS — la partición completa (INC-010, DUP-001)', () => {
    // Los dos scripts eran los únicos del blueprint que no cumplían la política
    // que el propio scaffolder escribió para lint:specs: «viene dormido y no
    // molesta a quien no lo usa». Sin ASSIGNMENTS.md salían en 1 y ponían rojo el
    // CI de un proyecto que jamás pidió la capa.
    for (const [nombre, script] of [['audit', AUDIT], ['sync', SYNC]]) {
        test(`${nombre}: apagada → exit 0 con mensaje`, () => {
            const r = correr(script);
            assert.equal(r.exit, 0, 'un proyecto que no usa la capa no tiene el CI rojo por ella');
            assert.match(r.out, /apagada/);
            assert.match(r.out, /AUTHORS\.md/);
        });

        test(`${nombre}: encendida y sana → exit 0`, () => {
            escribir('specs/AUTHORS.md', AUTHORS);
            escribir('specs/ASSIGNMENTS.md', TABLERO);
            fs.mkdirSync(path.join(specs(), 'assignments'), { recursive: true });
            assert.equal(correr(script).exit, 0);
        });

        test(`${nombre}: encendida y a medias → exit 1`, () => {
            // Alguien declaró autores y no hay tablero: eso SÍ es un problema.
            escribir('specs/AUTHORS.md', AUTHORS);
            const r = correr(script);
            assert.equal(r.exit, 1);
            assert.match(r.out, /AUTHORS\.md existe/);
        });
    }

    test('apagada, sync no escribe nada', () => {
        const antes = fs.readdirSync(proyecto);
        correr(SYNC);
        assert.deepEqual(fs.readdirSync(proyecto), antes);
    });

    test('el aviso dice cómo encender la capa, no solo que está apagada', () => {
        assert.match(avisoApagada('x'), /Se enciende creando/);
    });
});

describe('LA CONVENCIÓN DE ID — el test que hubiera evitado INC-017', () => {
    // El auditor exigía `<tipo>-NNN-<autor>-slug` SIEMPRE, y /spec-new, /fix-new y
    // /hotfix generan sin código de autor: todo track del flujo normal era una
    // violación de naming. Y /assign-claim afirmaba que su regla era «exactamente
    // la misma que ya usan los tres», que no la siguen.
    const SIN = { conAutor: false };
    const CON = { conAutor: true };

    test('sin capa: lo que generan hoy /fix-new y /hotfix es válido', () => {
        assert.deepEqual(parseTrackName('fix', 'fix-001-kpi-en-cero', 3, SIN),
            { number: '001', author: null, slug: 'kpi-en-cero' });
        assert.deepEqual(parseTrackName('hotfix', 'hotfix-002-ts2345', 3, SIN),
            { number: '002', author: null, slug: 'ts2345' });
    });

    test('sin capa: lo que genera /spec-new también', () => {
        assert.deepEqual(parseTrackName('', '0001-reportes', 4, SIN),
            { number: '0001', author: null, slug: 'reportes' });
    });

    test('con capa: la forma con código de autor', () => {
        assert.deepEqual(parseTrackName('fix', 'fix-001-b-kpi-en-cero', 3, CON),
            { number: '001', author: 'b', slug: 'kpi-en-cero' });
        assert.deepEqual(parseTrackName('', '0001-b-reportes', 4, CON),
            { number: '0001', author: 'b', slug: 'reportes' });
    });

    test('un slug que empieza con letras no se confunde con un autor', () => {
        // `fix-001-kpi-en-cero` con conAutor leería `kpi` como autor. Por eso la
        // forma la decide el interruptor y no una heurística sobre el nombre.
        const comoAutor = parseTrackName('fix', 'fix-001-kpi-en-cero', 3, CON);
        assert.equal(comoAutor.author, 'kpi',
            'con la capa encendida, un track sin autor se lee mal — y el auditor lo reporta');
        assert.equal(parseTrackName('fix', 'fix-001-kpi-en-cero', 3, SIN).author, null);
    });

    test('lo que no matchea ninguna forma sigue sin matchear', () => {
        for (const malo of ['fix-kpi', 'fix-1-kpi', 'random', 'fix-0001-kpi']) {
            assert.equal(parseTrackName('fix', malo, 3, SIN), null, malo);
        }
    });

    test('el formato esperado se puede imprimir en el error', () => {
        assert.equal(formatoEsperado('fix', false), 'fix-NNN-slug');
        assert.equal(formatoEsperado('fix', true), 'fix-NNN-<autor>-slug');
        assert.equal(formatoEsperado('', false), 'NNNN-slug');
    });
});

describe('EL AUDITOR USA LA FORMA DEL PROYECTO, NO UNA FIJA', () => {
    test('sin autores declarados, un track del flujo normal NO es violación', () => {
        escribir('specs/AUTHORS.md', '# Autores\n\n(sin códigos todavía)\n');
        escribir('specs/ASSIGNMENTS.md', TABLERO);
        fs.mkdirSync(path.join(specs(), 'assignments'), { recursive: true });
        escribir('specs/fixes/fix-001-kpi-en-cero/fix.md', '# Fix\n> status: in_progress\n');

        const r = correr(AUDIT);
        assert.match(r.out, /Naming violations \(0\)/,
            'esto era el caso común y el auditor lo marcaba mal');
        assert.equal(r.exit, 0);
    });

    test('con autores declarados, uno sin código SÍ es violación', () => {
        escribir('specs/AUTHORS.md', AUTHORS);
        escribir('specs/ASSIGNMENTS.md', TABLERO);
        fs.mkdirSync(path.join(specs(), 'assignments'), { recursive: true });
        escribir('specs/fixes/fix-001-kpi-en-cero/fix.md', '# Fix\n> status: in_progress\n');

        const r = correr(AUDIT);
        assert.match(r.out, /Naming violations \(1\)/);
        assert.match(r.out, /fix-NNN-<autor>-slug/, 'el error dice qué forma esperaba');
        assert.equal(r.exit, 1);
    });

    test('y con autores declarados, el track bien formado pasa', () => {
        escribir('specs/AUTHORS.md', AUTHORS);
        escribir('specs/ASSIGNMENTS.md', TABLERO);
        fs.mkdirSync(path.join(specs(), 'assignments'), { recursive: true });
        escribir('specs/fixes/fix-001-b-kpi-en-cero/fix.md', '# Fix\n> status: in_progress\n');

        const r = correr(AUDIT);
        assert.match(r.out, /Naming violations \(0\)/);
        assert.equal(r.exit, 0);
    });

    test('un autor que no está en AUTHORS.md se reporta', () => {
        escribir('specs/AUTHORS.md', AUTHORS);
        escribir('specs/ASSIGNMENTS.md', TABLERO);
        fs.mkdirSync(path.join(specs(), 'assignments'), { recursive: true });
        escribir('specs/fixes/fix-001-z-kpi/fix.md', '# Fix\n> status: in_progress\n');

        const r = correr(AUDIT);
        assert.match(r.out, /autor 'z' no está/);
        assert.equal(r.exit, 1);
    });
});
