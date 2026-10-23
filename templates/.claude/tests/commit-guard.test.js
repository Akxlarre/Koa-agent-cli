#!/usr/bin/env node
/**
 * commit-guard.test.js — Lo que un commit del agente puede llevar
 *
 * Cada test arma un repo git de verdad con un primer commit —un facade y su
 * spec—, le aplica un cambio y le pasa al hook el comando de commit por stdin,
 * que es el contrato documentado (lib/payload.js).
 *
 * Las dos direcciones importan igual. Un guard que bloquea el flujo legítimo
 * —el test en rojo commiteado solo, un caso nuevo en un spec existente— se
 * apaga a la semana, y entonces tampoco frena la trampa.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'commit-guard.js');
const { alcance, LIMITE_LINEAS } = require(HOOK);

const SPEC = 'src/app/core/facades/tareas.facade.spec.ts';
const FACADE = 'src/app/core/facades/tareas.facade.ts';

let repo;

function sh(...args) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

function escribir(rel, contenido) {
  const full = path.join(repo, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contenido);
}

function correr(comando) {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: comando }, cwd: repo }),
    cwd: repo,
    encoding: 'utf8',
  });
  return { exit: r.status, stderr: r.stderr || '' };
}

const lineas = (n, pref = 'const x') => Array.from({ length: n }, (_, i) => `${pref}${i} = ${i};`).join('\n');

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-cg-'));
  sh('init', '-q');
  sh('config', 'user.email', 'koa@test.local');
  sh('config', 'user.name', 'koa');
  sh('config', 'commit.gpgsign', 'false');
  escribir(SPEC, "describe('TareasFacade', () => {\n  it('suma', () => {\n    expect(sumar(1, 2)).toBe(3);\n  });\n});\n");
  escribir(FACADE, 'export const sumar = (a: number, b: number) => a + b;\n');
  sh('add', '-A');
  sh('commit', '-q', '-m', 'base');
});

afterEach(() => { fs.rmSync(repo, { recursive: true, force: true }); });

describe('COMMIT-01 — la trampa: cambiar el test en el mismo commit que el código', () => {
  test('cambiar una aserción existente junto con el código bloquea', () => {
    escribir(SPEC, fs.readFileSync(path.join(repo, SPEC), 'utf8').replace('toBe(3)', 'toBe(4)'));
    escribir(FACADE, 'export const sumar = (a: number, b: number) => a + b + 1;\n');
    sh('add', '-A');
    const r = correr('git commit -m "feat: sumar"');
    assert.equal(r.exit, 2, r.stderr);
    assert.match(r.stderr, /COMMIT-01/);
    assert.match(r.stderr, /tareas\.facade\.spec\.ts/);
    assert.match(r.stderr, /toBe\(3\)/, 'muestra QUÉ aserción se tocó');
    assert.match(r.stderr, /Doc: docs\/HOOKS-SYSTEM\.md#commit-guard/);
  });

  test('apagar un test con .skip junto con el código bloquea', () => {
    escribir(SPEC, fs.readFileSync(path.join(repo, SPEC), 'utf8').replace("it('suma'", "it.skip('suma'"));
    escribir(FACADE, 'export const sumar = () => 0;\n');
    sh('add', '-A');
    const r = correr('git commit -m "wip"');
    assert.equal(r.exit, 2);
    assert.match(r.stderr, /apaga tests/);
  });

  test('borrar el spec junto con el código bloquea', () => {
    fs.rmSync(path.join(repo, SPEC));
    escribir(FACADE, 'export const sumar = () => 0;\n');
    sh('add', '-A');
    assert.equal(correr('git commit -m "limpieza"').exit, 2);
  });

  test('un git add -A en el mismo comando no lo esconde: se mira lo que va a entrar', () => {
    // Cuando el hook corre, el `git add` todavía no corrió: nada está stageado.
    escribir(SPEC, fs.readFileSync(path.join(repo, SPEC), 'utf8').replace('toBe(3)', 'toBe(4)'));
    escribir(FACADE, 'export const sumar = (a: number, b: number) => a + b + 1;\n');
    assert.equal(correr('git add -A && git commit -m "feat"').exit, 2);
  });

  test('ni un commit -am', () => {
    escribir(SPEC, fs.readFileSync(path.join(repo, SPEC), 'utf8').replace('toBe(3)', 'toBe(4)'));
    escribir(FACADE, 'export const sumar = (a: number, b: number) => a + b + 1;\n');
    assert.equal(correr('git commit -am "feat"').exit, 2);
  });
});

describe('COMMIT-01 — lo que NO frena', () => {
  test('el test en rojo commiteado solo (el S·.1 de cada slice)', () => {
    escribir(SPEC, fs.readFileSync(path.join(repo, SPEC), 'utf8').replace('toBe(3)', 'toBe(4)'));
    sh('add', '-A');
    assert.equal(correr('git commit -m "test(red): sumar redondea"').exit, 0);
  });

  test('un caso nuevo en un spec existente, junto con su código', () => {
    escribir(SPEC, fs.readFileSync(path.join(repo, SPEC), 'utf8')
      .replace('});\n});', "});\n  it('resta', () => {\n    expect(restar(3, 1)).toBe(2);\n  });\n});"));
    escribir(FACADE, 'export const sumar = (a: number, b: number) => a + b;\nexport const restar = (a: number, b: number) => a - b;\n');
    sh('add', '-A');
    assert.equal(correr('git commit -m "feat: restar"').exit, 0);
  });

  test('un spec nuevo junto con su código', () => {
    escribir('src/app/core/utils/fecha.utils.spec.ts', "it('x', () => expect(1).toBe(1));\n");
    escribir('src/app/core/utils/fecha.utils.ts', 'export const hoy = () => new Date();\n');
    sh('add', '-A');
    assert.equal(correr('git commit -m "feat: fecha"').exit, 0);
  });

  test('un git add de rutas puntuales solo mira esas rutas', () => {
    // El spec tocado queda AFUERA del commit: no es asunto de este commit.
    escribir(SPEC, fs.readFileSync(path.join(repo, SPEC), 'utf8').replace('toBe(3)', 'toBe(4)'));
    escribir(FACADE, 'export const sumar = (a: number, b: number) => a + b + 1;\n');
    assert.equal(correr(`git add ${FACADE} && git commit -m "feat"`).exit, 0);
  });
});

describe('UN MONOREPO — la app en una subcarpeta del repo', () => {
  test('las rutas se leen relativas al proyecto, no a la raíz del repo', () => {
    // `git diff --numstat` da rutas desde la raíz: `frontend/src/app/x.ts` no es
    // código de producto para lib/paths.js, y sin --relative el guard callaría.
    const app = path.join(repo, 'frontend');
    for (const [rel, txt] of [[SPEC, fs.readFileSync(path.join(repo, SPEC), 'utf8')],
      [FACADE, fs.readFileSync(path.join(repo, FACADE), 'utf8')]]) {
      fs.mkdirSync(path.dirname(path.join(app, rel)), { recursive: true });
      fs.writeFileSync(path.join(app, rel), txt);
    }
    sh('add', '-A');
    sh('commit', '-q', '-m', 'app en subcarpeta');
    fs.writeFileSync(path.join(app, SPEC), fs.readFileSync(path.join(app, SPEC), 'utf8').replace('toBe(3)', 'toBe(4)'));
    fs.writeFileSync(path.join(app, FACADE), 'export const sumar = (a: number, b: number) => a + b + 1;\n');
    sh('add', '-A');
    const r = spawnSync('node', [HOOK], {
      input: JSON.stringify({ tool_input: { command: 'git commit -m feat' }, cwd: app }),
      cwd: app, encoding: 'utf8',
    });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /COMMIT-01/);
  });
});

describe('COMMIT-02 — un commit entra en un /review', () => {
  test(`más de ${LIMITE_LINEAS} líneas de código de producto bloquea`, () => {
    escribir('src/app/features/reportes/reportes.component.ts', lineas(LIMITE_LINEAS + 20));
    sh('add', '-A');
    const r = correr('git commit -m "feat: reportes"');
    assert.equal(r.exit, 2);
    assert.match(r.stderr, /COMMIT-02/);
    assert.match(r.stderr, /Partilo por slice/);
  });

  test('cuenta los archivos nuevos de un git add -A', () => {
    escribir('src/app/features/reportes/reportes.component.ts', lineas(LIMITE_LINEAS + 20));
    assert.equal(correr('git add -A && git commit -m "feat"').exit, 2);
  });

  test('un slice de tamaño normal pasa', () => {
    escribir('src/app/features/reportes/reportes.component.ts', lineas(120));
    sh('add', '-A');
    assert.equal(correr('git commit -m "feat: S1"').exit, 0);
  });

  test('no cuentan tests, docs ni tipos generados', () => {
    escribir('src/app/features/reportes/reportes.component.spec.ts', lineas(LIMITE_LINEAS + 50));
    escribir('docs/guia.md', lineas(LIMITE_LINEAS + 50, '- linea'));
    escribir('src/app/core/models/supabase.types.ts', lineas(LIMITE_LINEAS + 50));
    sh('add', '-A');
    assert.equal(correr('git commit -m "chore"').exit, 0);
  });
});

describe('LO QUE NO ES ASUNTO DEL GUARD', () => {
  test('comandos que no son un commit', () => {
    for (const c of ['git status', 'git log --oneline', 'npm test', 'git commit --dry-run -m x']) {
      assert.equal(correr(c).exit, 0, c);
    }
  });

  test('el primer commit de un repo: es el andamio, no un slice', () => {
    fs.rmSync(path.join(repo, '.git'), { recursive: true, force: true });
    sh('init', '-q');
    escribir('src/app/features/reportes/reportes.component.ts', lineas(LIMITE_LINEAS + 20));
    sh('add', '-A');
    assert.equal(correr('git commit -m "inicial"').exit, 0);
  });

  test('a mitad de un merge', () => {
    escribir('src/app/features/reportes/reportes.component.ts', lineas(LIMITE_LINEAS + 20));
    sh('add', '-A');
    fs.writeFileSync(path.join(repo, '.git', 'MERGE_HEAD'), sh('rev-parse', 'HEAD'));
    assert.equal(correr('git commit -m "merge"').exit, 0);
  });

  test('fail-open: fuera de un repo git', () => {
    const suelto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-cg-nogit-'));
    const r = spawnSync('node', [HOOK], {
      input: JSON.stringify({ tool_input: { command: 'git commit -m x' }, cwd: suelto }),
      cwd: suelto, encoding: 'utf8',
    });
    fs.rmSync(suelto, { recursive: true, force: true });
    assert.equal(r.status, 0);
  });

  test('fail-open: stdin inválido', () => {
    const r = spawnSync('node', [HOOK], { input: '{ roto', cwd: repo, encoding: 'utf8' });
    assert.equal(r.status, 0);
  });
});

describe('alcance() — qué va a entrar en el commit, leído del comando', () => {
  test('un commit pelado: solo lo stageado', () => {
    assert.deepEqual(alcance('git commit -m "x"'), { dir: null, todo: false, soloTracked: false, rutas: [] });
  });

  test('-a y -am suman todo lo trackeado, no lo nuevo', () => {
    assert.equal(alcance('git commit -a -m x').todo, true);
    assert.equal(alcance('git commit -am x').soloTracked, true);
  });

  test('git add -A antes en el mismo comando suma todo, incluso lo nuevo', () => {
    const a = alcance('git add -A && git commit -m x');
    assert.equal(a.todo, true);
    assert.equal(a.soloTracked, false);
  });

  test('git add de rutas suma esas rutas', () => {
    assert.deepEqual(alcance('git add src/a.ts src/b.ts && git commit -m x').rutas, ['src/a.ts', 'src/b.ts']);
  });

  test('-C cambia el directorio', () => {
    assert.equal(alcance('git -C otro/dir commit -m x').dir, 'otro/dir');
  });

  test('no confunde un commit con un comando que lo menciona', () => {
    assert.equal(alcance('git log --grep commit'), null);
    assert.equal(alcance('echo "git commit"'), null);
    assert.equal(alcance('git commit --help'), null);
  });
});
