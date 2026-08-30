#!/usr/bin/env node
/**
 * failure-tracker.test.js — Contract tests de failure-tracker.js
 *
 * Es uno de los dos PRODUCTORES de .claude/temp/LESSONS_LEARNED.md (DUP-002; el
 * otro es scripts/lint-arch-wrapper.js) y el archivo es un contrato de
 * round-trip: el hook lo escribe como tabla markdown y lo vuelve a parsear en la
 * proxima falla.
 *
 * HUE-016 queda demostrado: el separador de la tabla es `|`, el mensaje de error
 * se escribe crudo, y un error que contiene `|` desplaza las columnas en el
 * siguiente parseo. El dano es acumulativo — cada falla posterior reescribe el
 * archivo a partir de lo mal parseado.
 *
 * TESTS DE CARACTERIZACION: describen el comportamiento ACTUAL.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'failure-tracker.js');
let proyecto;

const LESSONS = () => path.join(proyecto, '.claude', 'temp', 'LESSONS_LEARNED.md');

function fallar(tool, error, toolInput = {}) {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_name: tool, tool_input: toolInput, error }),
    encoding: 'utf8', cwd: proyecto,
  });
  let msg = '';
  try { msg = JSON.parse(r.stdout || '{}').message || ''; } catch { /* */ }
  return { exit: r.status, msg };
}

const leer = () => (fs.existsSync(LESSONS()) ? fs.readFileSync(LESSONS(), 'utf-8') : '');

/** Filas de datos de la tabla (sin encabezado ni separador). */
function filas() {
  return leer().split('\n')
    .filter((l) => l.startsWith('| ') && !l.includes('---') && !l.includes('| Date |'));
}

beforeEach(() => { proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-ft-')); });
afterEach(() => { fs.rmSync(proyecto, { recursive: true, force: true }); });

describe('REGISTRA LAS FALLAS', () => {
  test('crea el archivo y la tabla en la primera falla', () => {
    const r = fallar('Bash', 'command not found: ng');
    assert.match(r.msg, /New failure recorded/);
    assert.match(leer(), /# Lessons Learned/);
    assert.match(leer(), /\| Date \| Tool \| Error \| Count \| Signature \| Context \|/);
    assert.equal(filas().length, 1);
  });

  test('crea .claude/temp/ si no existe', () => {
    fallar('Bash', 'x');
    assert.ok(fs.existsSync(LESSONS()));
  });

  test('guarda el contexto: file_path o command', () => {
    fallar('Edit', 'no such file', { file_path: 'src/app/x.ts' });
    assert.match(leer(), /src\/app\/x\.ts/);
    fallar('Bash', 'exit 127', { command: 'ng build' });
    assert.match(leer(), /ng build/);
  });

  test('recorta el error a 80 chars para la firma', () => {
    fallar('Bash', 'E'.repeat(500));
    assert.ok(leer().length < 1000, 'no vuelca el error entero');
  });

  test('acepta el error en `error` o en `stderr`', () => {
    const r = spawnSync('node', [HOOK], {
      input: JSON.stringify({ tool_name: 'Bash', stderr: 'desde stderr' }),
      encoding: 'utf8', cwd: proyecto,
    });
    assert.equal(r.status, 0);
    assert.match(leer(), /desde stderr/);
  });
});

describe('DEDUP Y ROTACION', () => {
  test('la misma falla incrementa el contador, no agrega fila', () => {
    fallar('Bash', 'command not found: ng');
    const r = fallar('Bash', 'command not found: ng');
    assert.match(r.msg, /duplicate #2/);
    assert.equal(filas().length, 1);
    assert.match(leer(), /\| 2 \|/);
  });

  test('la firma incluye la herramienta: mismo error, otra tool, otra fila', () => {
    fallar('Bash', 'permiso denegado');
    fallar('Edit', 'permiso denegado');
    assert.equal(filas().length, 2);
  });

  test('errores distintos generan filas distintas', () => {
    fallar('Bash', 'error uno');
    fallar('Bash', 'error dos');
    assert.equal(filas().length, 2);
  });

  test('rota a 20 entradas y conserva las mas recientes', () => {
    for (let i = 1; i <= 25; i++) fallar('Bash', `fallo numero ${i}`);
    assert.equal(filas().length, 20);
    assert.ok(!leer().includes('fallo numero 1 '), 'las primeras cinco salieron');
    assert.match(leer(), /fallo numero 25/);
  });
});

describe('HUE-016 — un "|" en el error corrompe la tabla', () => {
  test('(bug) el error se escribe crudo, con el separador adentro', () => {
    fallar('Bash', 'grep foo | wc -l fallo');
    assert.match(leer(), /grep foo \| wc -l/, 'el pipe entra sin escapar');
  });

  test('(bug) en el siguiente parseo las columnas se desplazan', () => {
    fallar('Bash', 'grep foo | wc -l fallo');
    const antes = filas()[0];

    // Segunda falla distinta: el hook re-parsea el archivo y lo reescribe.
    fallar('Edit', 'otra cosa');
    const despues = filas().find((f) => f.includes('grep foo'));

    assert.notEqual(antes, despues,
      'la fila sobrevivio al round-trip cambiada: el pipe la partio');
  });

  test('la corrupcion ocurre UNA vez y se estabiliza — no es progresiva', () => {
    const fila = () => leer().split('\n').find((l) => l.includes('| `Bash` |'));

    fallar('Bash', 'a | b | c fallo');
    const ronda0 = fila();
    fallar('Edit', 'ruido 1');
    const ronda1 = fila();
    fallar('Edit', 'ruido 2');
    const ronda2 = fila();

    assert.notEqual(ronda0, ronda1, 'el primer re-parseo la parte');
    assert.equal(ronda1, ronda2, 'y de ahi queda igual: es un punto fijo');
  });

  test('(bug) lo que se pierde es la FIRMA, y con ella el dedup', () => {
    // La firma se escribe entera —`Bash:a | b | c fallo`— y al re-parsear queda
    // truncada en el primer pipe: `Bash:a`. Desde ahi la firma calculada nunca
    // vuelve a coincidir con la guardada.
    fallar('Bash', 'a | b | c fallo');
    assert.match(leer(), /`Bash:a \| b \| c fallo`/, 'la firma entra con los pipes');

    fallar('Edit', 'ruido');
    assert.match(leer(), /`Bash:a`/, 'y sale truncada');
  });

  test('(bug) la consecuencia: cinco veces el mismo error, cinco filas', () => {
    for (let i = 0; i < 5; i++) {
      fallar('Bash', 'grep a | wc -l fallo');
      fallar('Edit', 'ruido');          // fuerza el re-parseo
    }
    const conPipe = filas().filter((f) => f.includes('grep a')).length;
    assert.equal(conPipe, 5, 'el dedup dejo de funcionar para esa entrada');
  });

  test('el mismo error SIN pipe deduplica bien: una fila con contador 5', () => {
    for (let i = 0; i < 5; i++) {
      fallar('Bash', 'command not found: ng');
      fallar('Edit', 'ruido');
    }
    const sinPipe = filas().filter((f) => f.includes('command not found')).length;
    assert.equal(sinPipe, 1);
    assert.match(leer(), /command not found: ng \| 5 \|/);
  });

  test('(bug) y con MAX_ENTRIES=20, un error recurrente con pipe desaloja el resto', () => {
    fallar('Bash', 'entrada valiosa que hay que conservar');
    for (let i = 0; i < 22; i++) {
      fallar('Bash', 'ruidoso | con | pipes');
      fallar('Edit', `distinto ${i}`);
    }
    assert.ok(!leer().includes('entrada valiosa'),
      'la rotacion se la llevo, empujada por duplicados que no deberian existir');
  });

  test('un error SIN pipe sobrevive el round-trip intacto', () => {
    fallar('Bash', 'command not found: ng');
    const antes = filas()[0];
    fallar('Edit', 'otra cosa');
    assert.equal(filas().find((f) => f.includes('command not found')), antes);
  });
});

describe('FAIL-OPEN — nunca bloquea', () => {
  test('stdin invalido: exit 0, sin archivo', () => {
    const r = spawnSync('node', [HOOK], { input: '{ roto', encoding: 'utf8', cwd: proyecto });
    assert.equal(r.status, 0);
    assert.equal(leer(), '');
  });

  test('evento vacio: registra "unknown"', () => {
    const r = spawnSync('node', [HOOK], { input: '{}', encoding: 'utf8', cwd: proyecto });
    assert.equal(r.status, 0);
    assert.match(leer(), /unknown/);
  });

  test('un LESSONS_LEARNED.md que no es una tabla se reemplaza sin romper', () => {
    fs.mkdirSync(path.dirname(LESSONS()), { recursive: true });
    fs.writeFileSync(LESSONS(), 'esto no es una tabla markdown\n');
    fallar('Bash', 'algo');
    assert.equal(filas().length, 1);
  });

  test('tool_input que no es objeto no rompe', () => {
    const r = spawnSync('node', [HOOK], {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: 'texto', error: 'x' }),
      encoding: 'utf8', cwd: proyecto,
    });
    assert.equal(r.status, 0);
  });
});
