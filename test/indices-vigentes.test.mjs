/**
 * Los índices de este repo nombran archivos que existen.
 *
 * `indices/CLI-MODULES.md` y `indices/TEMPLATES-REGISTRY.md` son la memoria
 * institucional del repositorio y el paso 5 del flujo obligatorio manda
 * sincronizarlos. Nada comprobaba que lo estuvieran, y se notó: el registro
 * seguía diciendo `writeBlueprintJson(targetDir, projectName, isFull, stack)`
 * después de que `INC-021` sacara ese parámetro, y describía el discovery flag
 * en `$TMPDIR/koa-discovery-{sessionId}.flag`, que es exactamente la ruta que
 * `HUE-002` había dejado de usar.
 *
 * Es `HUE-003` otra vez —una lista a mano se desincroniza— aplicado al lugar
 * donde más caro sale: un índice desactualizado no falla, MIENTE, y el agente
 * que lo lee al arrancar arma su plan sobre eso.
 *
 * Esto no verifica que la descripción sea buena. Verifica lo único que una
 * máquina puede: que cada ruta citada exista. Es el piso, no el techo.
 *
 * `node --test test/*.test.mjs`
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDICES = path.join(RAIZ, 'indices');

/**
 * Las rutas que un índice cita entre backticks.
 *
 * Sólo se juzga lo que se parece a un archivo: tiene una extensión conocida y
 * un primer segmento que es un directorio del proyecto. Un `--recursive` o un
 * `npm run lint:arch` entre backticks no son rutas y no se cuentan.
 */
const RUTA_RE = /`([\w.@/-]+\.(?:js|mjs|ts|md|json|scss|sql))`/g;
const RAICES = ['bin', 'lib', 'test', 'templates', 'docs', 'indices', 'scripts',
  'src', 'supabase', 'context', 'specs'];

/**
 * Contra qué raíces se resuelve una ruta citada.
 *
 * `TEMPLATES-REGISTRY.md` describe el **proyecto generado**, no este repo: ahí
 * `docs/CONTRATOS.md` e `indices/DATABASE.md` son correctas y viven bajo
 * `templates/`, y `lib/session.js` es relativa a `.claude/hooks/`. La primera
 * versión de este test las marcó como fantasmas, y el que estaba mal era el
 * test — dar por sentado que toda ruta es relativa a la raíz del repositorio.
 */
const BASES = [
  '.',
  'templates',
  'templates/.claude',
  'templates/.claude/hooks',
  'templates/boilerplate',
  'templates/boilerplate/scripts',
];

/** `indices/NOMBRE.md`, `specs/<id>/fix.md`: forma, no archivo. */
const PLACEHOLDER = /(^|\/)(?:[A-Z]{3,}|<[^>]+>|\{[^}]+\}|\*)(\.[a-z]+)?$/;

function existeEnAlguna(rel) {
  return BASES.some((b) => fs.existsSync(path.join(RAIZ, b, rel)));
}

function rutasCitadas(archivo) {
  const txt = fs.readFileSync(path.join(INDICES, archivo), 'utf-8');
  return [...new Set([...txt.matchAll(RUTA_RE)].map((m) => m[1]))]
    .filter((r) => RAICES.includes(r.split('/')[0]))
    .filter((r) => !PLACEHOLDER.test(r));
}

const INDICES_MD = fs.readdirSync(INDICES).filter((f) => f.endsWith('.md'));

describe('Los índices no mienten sobre lo que existe', () => {
  test('hay índices que revisar', () => {
    assert.ok(INDICES_MD.length >= 2, `solo ${INDICES_MD.length} índices`);
  });

  for (const archivo of INDICES_MD) {
    const rutas = rutasCitadas(archivo);

    test(`${archivo} cita rutas de verdad`, () => {
      // Sin esto, un cambio de formato que rompiera la extracción dejaría el
      // test en verde sobre cero rutas — el falso verde de siempre.
      assert.ok(rutas.length >= 5,
        `solo ${rutas.length} rutas extraídas de ${archivo}: ¿cambió el formato?`);
    });

    test(`${archivo}: todas existen`, () => {
      const fantasmas = rutas.filter((r) => !existeEnAlguna(r));
      assert.deepEqual(fantasmas, [],
        'el índice nombra archivos que no están; un índice que miente es peor que uno vacío');
    });
  }
});

describe('Y los números que declaran salen de contarlos', () => {
  test('los artefactos compartidos que anuncia el registro son los que hay', async () => {
    // El registro dice «los 21 artefactos compartidos». Ese número se deriva de
    // `contracts.js`, así que puede contrastarse en vez de creerse.
    const registro = fs.readFileSync(path.join(INDICES, 'TEMPLATES-REGISTRY.md'), 'utf-8');
    const m = /(\d+)\s+artefactos compartidos/.exec(registro);
    if (!m) return; // el registro dejó de dar un número: nada que contrastar

    const mod = path.join(RAIZ, 'templates', '.claude', 'hooks', 'lib', 'contracts.js');
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const contracts = require(mod);
    const reales = contracts.all().length;

    assert.equal(Number(m[1]), reales,
      `el registro dice ${m[1]} artefactos y contracts.js declara ${reales}`);
  });

  test('el tamaño que declara para bin/index.js es el real', () => {
    // `cli-architecture.md` pone el techo en ~150 líneas y el índice anota el
    // tamaño actual. Anotarlo y no medirlo es cómo llegó a decir ~160 cuando
    // eran 122.
    const cli = fs.readFileSync(path.join(INDICES, 'CLI-MODULES.md'), 'utf-8');
    const m = /`bin\/index\.js`[^|]*\|[^|]*\|\s*(\d+)\s+líneas/.exec(cli);
    if (!m) return;
    const reales = fs.readFileSync(path.join(RAIZ, 'bin', 'index.js'), 'utf-8')
      .split('\n').length;
    assert.ok(Math.abs(Number(m[1]) - reales) <= 5,
      `el índice dice ${m[1]} líneas y son ${reales}`);
  });
});
