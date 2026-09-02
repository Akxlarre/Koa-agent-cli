#!/usr/bin/env node
/**
 * post-edit.test.js — Contract tests de .claude/scripts/post-edit.js
 *
 * SEC-001 (S1) — CERRADO. La ruta se interpolaba en un string de shell:
 *
 *     execSync(`npx prettier --write "${filePath}" --log-level warn`)
 *
 * Un nombre con comillas rompe el entrecomillado y el shell ejecuta lo que
 * sigue. El primer describe lo intenta de verdad: crea un archivo centinela en
 * un directorio temporal y verifica que NO aparezca.
 *
 * El detalle que lo hacia explotable pese al filtro de extension: la carga tiene
 * que TERMINAR en .ts para pasar el regex. `x.ts" ; touch centinela ; echo "a.ts`
 * cumple las dos cosas. Un test que solo probara `x.ts" ; touch ...` daria falso
 * negativo — el regex lo frena antes de llegar al shell.
 *
 * Este hook era uno de los dos S1 en 25 lineas y no tenia ningun test.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'scripts', 'post-edit.js');
let dir;

function correr(filePath) {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: filePath } }),
    encoding: 'utf8',
    cwd: dir,
    timeout: 20000,
  });
  return { exit: r.status, stderr: r.stderr || '' };
}

beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-pe-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('SEC-001 — no hay shell que romper', () => {
  /** Cargas que terminan en una extension aceptada, para pasar el filtro. */
  const cargas = [
    ['comillas + punto y coma', (c) => `x.ts" ; touch ${c} ; echo "a.ts`],
    ['sustitucion de comando', (c) => `x.ts" ; $(touch ${c}) ; echo "a.ts`],
    ['backticks', (c) => 'x.ts" ; `touch ' + '${C}' + '` ; echo "a.ts'],
    ['encadenado con &&', (c) => `x.ts" && touch ${c} && echo "a.ts`],
    ['pipe', (c) => `x.ts" | touch ${c} ; echo "a.ts`],
    ['salto de linea', (c) => `x.ts"\ntouch ${c}\necho "a.ts`],
  ];

  for (const [nombre, construir] of cargas) {
    test(`no ejecuta nada con ${nombre}`, () => {
      const centinela = path.join(dir, 'CENTINELA');
      const carga = construir(centinela).replace('${C}', centinela);

      assert.ok(/\.(ts|html|scss|css)$/.test(carga),
        'la carga debe pasar el filtro de extension, si no el test es un falso negativo');

      correr(carga);
      assert.equal(fs.existsSync(centinela), false,
        `la carga "${nombre}" ejecuto un comando`);
    });
  }

  test('una ruta con espacios y comillas no rompe el hook', () => {
    const raro = path.join(dir, 'un "archivo" raro.ts');
    fs.writeFileSync(raro, 'const a=1\n');
    assert.equal(correr(raro).exit, 0, 'debe salir en 0 aunque prettier no este');
  });
});

describe('SOBRE QUE ARCHIVOS ACTUA', () => {
  // No se puede observar prettier sin instalarlo, asi que se verifica lo que si
  // es observable: que el hook nunca falle y no toque lo que no debe.
  const formatea = ['a.ts', 'a.html', 'a.scss', 'a.css'];
  const ignora = ['a.md', 'a.json', 'a.txt', 'a.py', 'sin-extension', ''];

  for (const f of [...formatea, ...ignora]) {
    test(`sale en 0 con ${f || '(vacio)'}`, () => {
      assert.equal(correr(f).exit, 0);
    });
  }

  test('un archivo ignorado no invoca a prettier', () => {
    // Si lo invocara, prettier se quejaria del archivo inexistente en stderr.
    assert.equal(correr('README.md').stderr, '');
  });

  test('la carpeta declara su tipo de modulo (DEC-003, L-08)', () => {
    // Este test existe porque el de arriba pasaba por el motivo equivocado.
    //
    // post-edit.js es ESM y .claude/scripts/ no tenia package.json: Node lo
    // reparseaba con un MODULE_TYPELESS_PACKAGE_JSON a stderr. En el repo del
    // CLI no se veia —el package.json raiz ya declara "module"— y el assert de
    // stderr vacio pasaba en verde. En un proyecto Angular generado el raiz no
    // lo declara, y el warning salia en CADA edicion: este hook corre en
    // PostToolUse. Se descubrio corriendo esta misma suite en el layout del
    // proyecto generado, que es donde el harness de verdad vive.
    const pkg = path.resolve(__dirname, '..', 'scripts', 'package.json');
    assert.ok(fs.existsSync(pkg), 'sin package.json el warning vuelve en el proyecto generado');
    assert.equal(JSON.parse(fs.readFileSync(pkg, 'utf-8')).type, 'module');
  });
});

describe('FAIL-OPEN — nunca bloquea una edicion', () => {
  test('stdin invalido: exit 0', () => {
    const r = spawnSync('node', [HOOK], { input: '{ roto', encoding: 'utf8', cwd: dir });
    assert.equal(r.status, 0);
  });

  test('sin tool_input: exit 0', () => {
    const r = spawnSync('node', [HOOK], {
      input: JSON.stringify({ tool_name: 'Edit' }), encoding: 'utf8', cwd: dir,
    });
    assert.equal(r.status, 0);
  });

  test('acepta path y new_file_path ademas de file_path', () => {
    for (const campo of ['path', 'new_file_path']) {
      const r = spawnSync('node', [HOOK], {
        input: JSON.stringify({ tool_input: { [campo]: 'a.ts' } }),
        encoding: 'utf8', cwd: dir, timeout: 20000,
      });
      assert.equal(r.status, 0, campo);
    }
  });
});

describe('EL HOOK CORRE — no es ESM roto (DEC-003)', () => {
  test('usa import y Node lo ejecuta igual', () => {
    const src = fs.readFileSync(HOOK, 'utf-8');
    assert.match(src, /^import /m, 'el archivo es ESM');
    assert.equal(correr('a.ts').exit, 0, 'y aun asi corre');
  });

  test('no importa execSync — solo execFileSync', () => {
    // Se mira el IMPORT, no el cuerpo: el docblock cita el execSync viejo como
    // ejemplo de lo que no hay que hacer, y un grep sobre el cuerpo lo confunde
    // con una llamada real. Lo que no se puede llamar es lo que no se importa.
    const src = fs.readFileSync(HOOK, 'utf-8');
    const importLine = src.split('\n').find((l) => l.startsWith('import '));
    assert.ok(importLine.includes('execFileSync'), importLine);
    assert.ok(!/\bexecSync\b/.test(importLine),
      'execSync interpreta su argumento como una linea de shell');
  });
});
