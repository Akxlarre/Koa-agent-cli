#!/usr/bin/env node
/**
 * task-spec.test.js — El contrato del task-spec (HUE-006)
 *
 * Es el artefacto con más consumidores del harness: cinco piezas lo leen y una
 * lo produce. Y era el único de los cinco contratos declarados sin ningún test.
 *
 *   produce   .claude/skills/plan/SKILL.md
 *   consumen  spec-reflection.js · prompt-context.js · compact-recovery.js
 *             session-start.js · validators/validate-file-contains.js
 *
 * Los cinco consumidores tienen su propio archivo de test. Ninguno prueba lo
 * que los ata, que es donde se rompe: las tres convenciones que comparten sin
 * que ningún import las obligue a estar de acuerdo.
 *
 *   1. Los encabezados `##` exactos. `/plan` los escribe y el validador de su
 *      propio frontmatter los exige. Renombrar uno en un lado deja al otro
 *      rechazando el archivo que él mismo genera.
 *   2. El nombre `task-spec-YYYYMMDD-HHMMSS.md`. Los consumidores toman «el
 *      último por orden alfabético», que solo es el más reciente mientras el
 *      timestamp mantenga ese formato. Con `D-M-YYYY`, el activo pasa a ser
 *      otro y nada avisa.
 *   3. Las casillas `- [ ]` / `- [x]`. Tres piezas las parsean por separado.
 *
 * Los tests corren los consumidores DE VERDAD contra un spec armado con la
 * plantilla que `/plan` reparte: si alguno deja de entenderla, se ve acá.
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CLAUDE = path.resolve(__dirname, '..');
const SKILL = path.join(CLAUDE, 'skills', 'plan', 'SKILL.md');
const HOOKS = path.join(CLAUDE, 'hooks');

/** Los cinco encabezados que el contrato declara obligatorios. */
const SECCIONES = [
  '## Objetivo',
  '## Artefactos afectados',
  '## Reglas que aplican',
  '## Pasos de ejecucion',
  '## Criterio de done',
];

const fuenteSkill = fs.readFileSync(SKILL, 'utf-8');

// ─── 1. Los encabezados: quien los escribe y quien los exige ────────────────

describe('LOS ENCABEZADOS — el productor y su validador dicen lo mismo', () => {
  /** Los `--contains` del hook declarado en el frontmatter de la skill. */
  const exigidos = [...fuenteSkill.matchAll(/--contains\s+"([^"]+)"/g)].map((m) => m[1]);

  test('el frontmatter exige exactamente las cinco secciones', () => {
    assert.deepEqual(exigidos, SECCIONES);
  });

  test('y la plantilla que la skill reparte las escribe todas', () => {
    // Si alguien agrega un `--contains` sin agregar la sección a la plantilla,
    // /plan genera un spec que su propio hook de Stop rechaza.
    const faltan = exigidos.filter((s) => !fuenteSkill.includes(`\n${s}\n`));
    assert.deepEqual(faltan, [], 'la skill exige secciones que su plantilla no escribe');
  });

  test('el detector lee los --contains reales, no una lista inventada', () => {
    assert.ok(exigidos.length >= 5, `solo ${exigidos.length} --contains encontrados`);
  });
});

// ─── 2. El nombre ordena por fecha ──────────────────────────────────────────

describe('EL NOMBRE — orden alfabético == orden cronológico', () => {
  const NOMBRE = /^task-spec-\d{8}-\d{6}\.md$/;

  test('la skill documenta el formato del que dependen los hooks', () => {
    assert.match(fuenteSkill, /YYYYMMDD-HHMMSS/);
    assert.match(fuenteSkill, /orden alfabetico|orden alfabético/i);
  });

  test('con el formato del contrato, el último alfabético es el más reciente', () => {
    const cronologico = [
      'task-spec-20260101-090000.md',
      'task-spec-20260101-140000.md',
      'task-spec-20260202-080000.md',
      'task-spec-20261231-235959.md',
    ];
    for (const n of cronologico) assert.match(n, NOMBRE);
    assert.deepEqual([...cronologico].reverse().sort(), cronologico);
  });

  test('y con un formato humano deja de serlo — por eso el contrato es el que es', () => {
    // El modo de fallo que el test fija: `1-2-2026` es posterior a `31-1-2026`
    // en el calendario y anterior alfabéticamente. Los hooks tomarían el spec
    // viejo como activo, sin ningún error.
    const humano = ['task-spec-31-1-2026.md', 'task-spec-1-2-2026.md'];
    assert.notDeepEqual([...humano].sort().at(-1), humano.at(-1));
    for (const n of humano) assert.doesNotMatch(n, NOMBRE);
  });
});

// ─── 3. Las casillas: los consumidores, corriendo de verdad ─────────────────

const creados = [];

/** Un proyecto con un task-spec armado desde la plantilla de la skill. */
function conSpec(nombre = 'task-spec-20260101-120000.md', extra = '') {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-spec-'));
  creados.push(raiz);
  fs.mkdirSync(path.join(raiz, '.claude', 'temp'), { recursive: true });
  fs.writeFileSync(path.join(raiz, '.claude', 'temp', nombre),
    `# Task Spec — 20260101-120000\n\n`
    + `${SECCIONES.join('\n[contenido]\n\n')}\n`
    + `- [x] PASO-YA-HECHO\n`
    + `- [ ] PASO-PENDIENTE\n${extra}`);
  return raiz;
}

/** Corre un hook con el payload real por stdin. */
function correr(hook, raiz, payload = {}) {
  const r = spawnSync('node', [path.join(HOOKS, hook)], {
    input: JSON.stringify({ session_id: 'spec-test', cwd: raiz, ...payload }),
    cwd: raiz,
    encoding: 'utf8',
  });
  return { exit: r.status, salida: `${r.stdout || ''}${r.stderr || ''}` };
}

afterEach(() => {
  while (creados.length) {
    try { fs.rmSync(creados.pop(), { recursive: true, force: true }); } catch { /* */ }
  }
});

describe('LAS CASILLAS — los tres consumidores leen el mismo spec', () => {
  // Ninguno importa al otro. Que los tres entiendan `- [ ]` es una coincidencia
  // sostenida a mano, y esto es lo que la sostiene.
  const CONSUMIDORES = [
    { hook: 'compact-recovery.js', payload: { hook_event_name: 'PostCompact' } },
    { hook: 'prompt-context.js', payload: { prompt: 'seguimos' } },
    { hook: 'session-start.js', payload: { source: 'startup' } },
  ];

  for (const { hook, payload } of CONSUMIDORES) {
    test(`${hook} ve lo pendiente y descarta lo hecho`, () => {
      const { salida } = correr(hook, conSpec(), payload);
      assert.match(salida, /PASO-PENDIENTE/, `${hook} no leyó las casillas abiertas`);
      assert.ok(!salida.includes('PASO-YA-HECHO'),
        `${hook} re-inyecta trabajo terminado: eso es lo que el formato existe para evitar`);
    });
  }

  test('los tres coinciden en CUÁL spec está activo', () => {
    // El desacuerdo es silencioso: cada uno trabajaría sobre un spec distinto.
    const raiz = conSpec('task-spec-20260101-090000.md');
    fs.writeFileSync(
      path.join(raiz, '.claude', 'temp', 'task-spec-20260202-080000.md'),
      `# Task Spec\n\n${SECCIONES.join('\n[x]\n\n')}\n- [ ] EL-MAS-NUEVO\n`);

    for (const { hook, payload } of CONSUMIDORES) {
      const { salida } = correr(hook, raiz, payload);
      assert.match(salida, /EL-MAS-NUEVO/, `${hook} tomó un spec que no es el activo`);
      assert.ok(!salida.includes('PASO-PENDIENTE'), `${hook} leyó el spec viejo`);
    }
  });
});

// ─── El validador, contra el archivo que la skill genera ────────────────────

describe('EL VALIDADOR acepta lo que /plan produce y rechaza lo que le falta', () => {
  const VALIDADOR = path.join(HOOKS, 'validators', 'validate-file-contains.js');

  function validar(raiz) {
    const args = ['--directory', '.claude/temp', '--pattern', 'task-spec-*.md', '--require-file'];
    for (const s of SECCIONES) args.push('--contains', s);
    const r = spawnSync('node', [VALIDADOR, ...args], { cwd: raiz, encoding: 'utf8' });
    return { exit: r.status, salida: `${r.stdout || ''}${r.stderr || ''}` };
  }

  test('un spec completo pasa', () => {
    assert.equal(validar(conSpec()).exit, 0);
  });

  test('sin una sección, no pasa — y dice cuál', () => {
    const raiz = conSpec();
    const archivo = path.join(raiz, '.claude', 'temp', 'task-spec-20260101-120000.md');
    fs.writeFileSync(archivo,
      fs.readFileSync(archivo, 'utf-8').replace('## Criterio de done', '## Como se si termine'));
    const r = validar(raiz);
    assert.notEqual(r.exit, 0, 'un spec sin criterio de done no debería pasar');
    assert.match(r.salida, /Criterio de done/);
  });

  test('sin ningún spec tampoco pasa', () => {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-spec-'));
    creados.push(raiz);
    fs.mkdirSync(path.join(raiz, '.claude', 'temp'), { recursive: true });
    assert.notEqual(validar(raiz).exit, 0);
  });
});

// ─── La tabla de Artefactos afectados: el cuarto acuerdo ────────────────────

describe('ARTEFACTOS AFECTADOS — lo que /plan declara, spec-reflection lo coteja', () => {
  // La plantilla de la skill trae la tabla con una fila de ejemplo. Si la skill
  // cambiara su forma —otra columna primero, rutas sin backticks— el cotejo
  // dejaría de encontrar lo declarado y reportaría como deriva el trabajo pedido.
  const plantilla = /```markdown\n([\s\S]*?)\n```/.exec(fuenteSkill)[1];

  test('la plantilla declara con rutas entre backticks, como lee el hook', () => {
    assert.match(plantilla, /## Artefactos afectados\n\|[^\n]*\n\|[-| ]+\n\| `[^`]+` \|/);
  });

  test('un spec hecho con la plantilla coteja lo escrito contra lo declarado', () => {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-spec-'));
    creados.push(raiz);
    const temp = path.join(raiz, '.claude', 'temp');
    fs.mkdirSync(temp, { recursive: true });
    const nombre = 'task-spec-20260101-120000.md';
    fs.writeFileSync(path.join(temp, nombre), plantilla
      .replace('`src/app/features/...`', '`src/app/features/tareas/tareas.component.ts`')
      .replace(/- \[ \]/g, '- [x]'));

    const stop = () => spawnSync('node', [path.join(HOOKS, 'spec-reflection.js')], { cwd: raiz, encoding: 'utf8' });
    stop(); // el turno de /plan: la foto de lo que ya había
    fs.writeFileSync(path.join(temp, 'session-writes.json'), JSON.stringify([
      'src/app/features/tareas/tareas.component.ts',
      'src/app/features/tareas/tareas.component.html',
      'src/app/core/services/no-pedido.service.ts',
    ]));
    const r = stop();
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /no-pedido\.service\.ts/);
    assert.ok(!r.stderr.includes('✗ src/app/features/tareas/'), r.stderr);
  });
});
