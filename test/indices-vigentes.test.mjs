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
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

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

    const contracts = require(path.join(RAIZ, 'templates', '.claude', 'hooks', 'lib', 'contracts.js'));
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

// ─── El mapa de funcionalidades cuenta lo mismo que el filesystem ───────────
//
// `docs/MAPA-FUNCIONALIDADES.md` es la puerta de entrada al repo: lo lee quien
// llega sin contexto. Es también el documento que más números da, y por eso el
// que más barato se desactualiza sin que nadie lo note. Medido cuando se
// escribió esto, decía «los 8 módulos» (eran 9 desde `INC-011`), «las 15 reglas
// path-scoped» (16) y que «la única regla documentada sin implementación es
// ARCH-14» — cuando `HUE-026` ya la había sacado junto con un segundo fantasma.
//
// Nada de esto verifica que la explicación sea buena. Verifica que los números
// que da salgan de contar, que es lo que separa un mapa de una anécdota.
describe('El mapa de funcionalidades no inventa números', () => {
  const MAPA = path.join(RAIZ, 'docs', 'MAPA-FUNCIONALIDADES.md');

  /** Sin los `> ` de blockquote: varias afirmaciones viven dentro de una cita. */
  const texto = fs.existsSync(MAPA)
    ? fs.readFileSync(MAPA, 'utf-8').replace(/^>\s?/gm, '')
    : '';

  function cuenta(dir, filtro) {
    return fs.readdirSync(path.join(RAIZ, dir)).filter(filtro).length;
  }

  /** Los códigos que `architect.js` registra, con el mismo patrón que usa la provocación. */
  function codigosDelLinter() {
    const t = fs.readFileSync(
      path.join(RAIZ, 'templates', 'boilerplate', 'scripts', 'architect.js'), 'utf-8');
    return [...t.matchAll(/^\s{4}'((?:ARCH|A11Y|LLM|SEC-RLS|NAV|ICON)-\d{2})':\s*\{/gm)].length;
  }

  /** Hooks de evento: sin `lib/` (núcleo compartido) ni `validators/` (los llama un frontmatter). */
  function hooksDeEvento(dir = path.join(RAIZ, 'templates', '.claude', 'hooks'), n = 0) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name === 'lib' || e.name === 'validators') continue;
        n = hooksDeEvento(path.join(dir, e.name), n);
      } else if (e.name.endsWith('.js')) n += 1;
    }
    return n;
  }

  const AFIRMACIONES = [
    ['módulos del generador', /Los (\d+) módulos/,
      () => cuenta('lib', (f) => f.endsWith('.js'))],
    ['reglas path-scoped', /Las (\d+) reglas path-scoped/,
      () => cuenta('templates/.claude/rules', (f) => f.endsWith('.md'))],
    ['artefactos compartidos', /\*\*(\d+) artefactos compartidos\*\*/,
      () => require('../templates/.claude/hooks/lib/contracts.js').all().length],
    ['códigos del linter', /emite\s+\*\*(\d+)\*\*\s+códigos/, codigosDelLinter],
    ['códigos del guard', /emite \*\*(\d+)\*\* por regex/,
      () => require('../templates/.claude/hooks/lib/guard-rules.js').ids().length],
    ['hooks de evento', /\((\d+) hooks, \d+ eventos\)/, hooksDeEvento],
    ['subagentes', /Los (\d+) subagentes/,
      () => cuenta('templates/.claude/agents', (f) => f.endsWith('.md'))],
    ['skills', /### Las (\d+) skills/,
      () => fs.readdirSync(path.join(RAIZ, 'templates/.claude/skills'))
        .filter((d) => fs.existsSync(path.join(RAIZ, 'templates/.claude/skills', d, 'SKILL.md'))).length],
    ['commands', /(\d+) commands ·/,
      () => cuenta('templates/.claude/commands', (f) => f.endsWith('.md'))],
  ];

  test('el mapa existe y da números', () => {
    assert.ok(texto.length > 0, 'no está docs/MAPA-FUNCIONALIDADES.md');
    const dados = AFIRMACIONES.filter(([, re]) => re.test(texto)).length;
    assert.ok(dados >= 5,
      `solo ${dados} de ${AFIRMACIONES.length} afirmaciones encontradas: ¿cambió la redacción?`);
  });

  for (const [etiqueta, re, real] of AFIRMACIONES) {
    test(`${etiqueta}: el número sale de contar`, () => {
      const m = re.exec(texto);
      if (!m) return; // la frase se reescribió; el test de arriba vigila que no sea todas
      assert.equal(Number(m[1]), real(),
        `el mapa dice ${m[1]} y son ${real()}`);
    });
  }
});
