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

// ─── El paquete que se publica ──────────────────────────────────────────────
//
// Dos números de versión convivieron sin relación declarada: `package.json` en
// `1.0.0` y `BLUEPRINT_VERSION` en `7.1.0`. El segundo es el que el usuario ve
// escrito en su `CLAUDE.md` y en su `blueprint.json`; el primero es el que npm
// resuelve. Que uno avance y el otro no vuelve imposible saber qué blueprint
// trae una instalación.
//
// Y `npm publish` sin campo `files` reparte todo lo que no esté gitignoreado:
// medido antes de arreglarlo, 474 archivos y 2,9 MB, con los 38 de
// `docs/auditoria/` adentro. Quien corre `npx create-koa-agent` se bajaba el
// registro de la auditoría.
describe('El paquete publicable', () => {
  const pkg = require(path.join(RAIZ, 'package.json'));

  test('el binario es el nombre del paquete: `npx create-koa-agent` funciona', () => {
    // Si el paquete se llama distinto del comando, `npx <comando>` busca otro
    // paquete —o ninguno— y el Quick Start del README no se puede seguir.
    assert.ok(pkg.bin[pkg.name], `el paquete es ${pkg.name} y sus bin son ${Object.keys(pkg.bin)}`);
  });

  test('la versión del paquete y la del blueprint son la misma', () => {
    const cfg = fs.readFileSync(path.join(RAIZ, 'lib', 'config.js'), 'utf-8');
    const blueprint = /BLUEPRINT_VERSION\s*=\s*'([^']+)'/.exec(cfg)?.[1];
    assert.equal(pkg.version, blueprint,
      'se mueven juntas: el blueprint es lo que el usuario ve, la del paquete es lo que npm resuelve');
  });

  test('declara `files`: sin eso se publica el repositorio entero', () => {
    assert.ok(Array.isArray(pkg.files) && pkg.files.length > 0);
    for (const necesario of ['bin/', 'lib/', 'templates/']) {
      assert.ok(pkg.files.includes(necesario), `falta ${necesario} en files`);
    }
  });

  test('y no reparte la auditoría ni los tests del repo', () => {
    // El campo es una whitelist, así que esto no puede fallar por olvido — pero
    // sí si alguien agrega `docs/` o `test/` creyendo que hacen falta.
    for (const fuera of ['docs/', 'test/', 'indices/', '.github/', 'docs/auditoria/']) {
      assert.ok(!pkg.files.includes(fuera), `${fuera} no va al paquete`);
    }
  });

  test('el CHANGELOG documenta la versión que se va a publicar', () => {
    // Publicar una versión que el CHANGELOG no menciona deja al usuario sin
    // forma de saber qué cambió — y es el paso que más fácil se saltea.
    const log = fs.readFileSync(path.join(RAIZ, 'CHANGELOG.md'), 'utf-8');
    assert.ok(log.includes(`[${pkg.version}]`),
      `CHANGELOG.md no tiene entrada para ${pkg.version}`);
  });
});

// ─── El README es la portada en npm ─────────────────────────────────────────
//
// Es lo que ve quien llega sin saber nada, y el documento que más caro cuesta
// tener viejo: el badge decía v6.9.1 con el blueprint en 7.2.0, el árbol
// prometía «14 rules» y «8 skills» cuando son 16 y 16, y el Quick Start seguía
// diciendo «Not yet published to npm».
describe('El README no promete un producto distinto del que hay', () => {
  const README = path.join(RAIZ, 'README.md');
  const txt = fs.readFileSync(README, 'utf-8');
  const pkg = require(path.join(RAIZ, 'package.json'));

  const cuenta = (d, f) => fs.readdirSync(path.join(RAIZ, d)).filter(f).length;
  const md = (f) => f.endsWith('.md');

  // El badge de versión ya no es un número escrito a mano —así llegó a decir
  // v6.9.1 con el blueprint en 7.2.0—: lo lee el registry de npm en vivo. Un
  // badge que se actualiza solo no puede mentir, así que acá no hay nada que
  // contrastar; lo que se verifica es que ESTÉ, más abajo.
  const AFIRMACIONES = [
    ['subagentes', /# (\d+) subagents with their own/,
      () => String(cuenta('templates/.claude/agents', md))],
    ['reglas', /# (\d+) path-scoped rules/,
      () => String(cuenta('templates/.claude/rules', md))],
    ['skills', /# (\d+) agent skills/,
      () => String(fs.readdirSync(path.join(RAIZ, 'templates/.claude/skills'))
        .filter((d) => fs.existsSync(path.join(RAIZ, 'templates/.claude/skills', d, 'SKILL.md'))).length)],
    ['índices', /# (\d+) living indexes/,
      () => String(cuenta('templates/indices', md))],
  ];

  for (const [etiqueta, re, real] of AFIRMACIONES) {
    test(`${etiqueta}: coincide con lo que hay`, () => {
      const m = re.exec(txt);
      assert.ok(m, `no se encontró la afirmación de ${etiqueta}: ¿cambió la redacción?`);
      assert.equal(m[1], real(), `el README dice ${m[1]} y son ${real()}`);
    });
  }

  // ── Los patrones que la investigación de READMEs 2026 da por estándar ────
  //
  // Medidos sobre la versión anterior, que había crecido por acumulación:
  //
  //   primer comando ejecutable   palabra 274   (el estándar: dentro de las 200)
  //   tabla de contenidos         no había      (requerida arriba de 100 líneas)
  //   descripción corta           130 chars     (el estándar: menos de 120)
  //   badges                      5, uno vanity, y sin CI ni versión de npm
  //
  // La conclusión que más pesa de esa investigación no es de forma: un README no
  // se juzga por lo cuidado que se escribió el día uno, sino por seguir siendo
  // cierto el día doscientos. Por eso esto se verifica y no se revisa.

  test('el primer comando ejecutable está arriba de todo', () => {
    // El lector decide en la primera pantalla. Enterrar el comando bajo tres
    // párrafos de propuesta de valor es la forma más común de perderlo.
    const hasta = txt.slice(0, txt.indexOf(`npx ${pkg.name}`)).split(/\s+/).length;
    assert.ok(hasta <= 200, `el primer comando aparece en la palabra ${hasta}`);
  });

  test('tiene tabla de contenidos: pasa las 100 líneas', () => {
    if (txt.split('\n').length <= 100) return;
    assert.match(txt, /^## Table of Contents/m);
  });

  test('todas las anclas de la ToC tienen destino', () => {
    // Un link roto en la ToC es el primer clic que da el lector.
    const slug = (h) => h.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/ /g, '-');
    const headings = [...txt.matchAll(/^## (.+)$/gm)].map((m) => slug(m[1]));
    const anclas = [...txt.matchAll(/\]\(#([a-z0-9-]+)\)/g)].map((m) => m[1]);
    assert.deepEqual(anclas.filter((a) => !headings.includes(a)), []);
  });

  test('ningún link relativo está roto', () => {
    const links = [...new Set([...txt.matchAll(/\]\((\.\/[^)#]+)\)/g)].map((m) => m[1]))];
    assert.ok(links.length >= 4, `solo ${links.length} links: ¿cambió el formato?`);
    assert.deepEqual(links.filter((l) => !fs.existsSync(path.join(RAIZ, l))), []);
  });

  test('la descripción de npm es corta y es la misma que el tagline', () => {
    // npm y GitHub muestran la descripción del package.json; el README muestra
    // la suya. Que digan cosas distintas es la primera incoherencia que se ve.
    assert.ok(pkg.description.length < 120, `${pkg.description.length} chars`);
    assert.ok(txt.includes(pkg.description), 'el README no abre con la descripción de npm');
  });

  test('los badges dicen algo real', () => {
    // Estado de build y versión publicada son verificables; una fila de badges
    // decorativos es ruido que además envejece.
    assert.match(txt, /actions\/workflows\/ci\.yml\/badge\.svg/, 'falta el badge de CI');
    assert.match(txt, /img\.shields\.io\/npm\/v\//, 'falta el badge de versión de npm');
  });

  test('los `npm run` que cita existen de un lado o del otro', () => {
    // El README habla de dos superficies: los scripts de ESTE repo y los que el
    // scaffolder escribe en el proyecto generado. Un comando que no está en
    // ninguna es una promesa que el lector no puede cumplir.
    const propios = Object.keys(pkg.scripts);
    const scaffolder = fs.readFileSync(path.join(RAIZ, 'lib', 'scaffolder.js'), 'utf-8');
    const citados = [...new Set([...txt.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]))];
    assert.ok(citados.length >= 5, `solo ${citados.length} comandos citados`);
    const fantasmas = citados.filter((c) => !propios.includes(c) && !scaffolder.includes(`'${c}'`));
    assert.deepEqual(fantasmas, []);
  });

  test('License es la última sección', () => {
    // Standard Readme lo pide, y es donde el lector la busca.
    const h2 = [...txt.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    assert.equal(h2[h2.length - 1], 'License');
  });

  test('el Quick Start manda correr el paquete que existe', () => {
    // `npx <otro-nombre>` instala otro paquete, o ninguno.
    assert.match(txt, new RegExp(`npx ${pkg.name}\\b`),
      `el README no manda correr \`npx ${pkg.name}\``);
  });

  test('y no sigue diciendo que no está publicado', () => {
    assert.ok(!/Not yet published/i.test(txt));
  });
});
