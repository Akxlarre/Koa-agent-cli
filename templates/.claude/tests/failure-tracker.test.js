#!/usr/bin/env node
/**
 * failure-tracker.test.js — Contract tests de failure-tracker.js
 *
 * Es uno de los dos PRODUCTORES de .claude/temp/LESSONS_LEARNED.md (DUP-002; el
 * otro es scripts/lint-arch-wrapper.js) y el archivo es un contrato de
 * round-trip: el hook lo escribe como tabla markdown y lo vuelve a parsear en la
 * proxima falla.
 *
 * HUE-016 — CERRADO. El separador de la tabla es `|` y el mensaje de error se
 * escribia crudo: un error con `|` desplazaba las columnas en el siguiente
 * parseo. No era acumulativo —se corrompia una vez y llegaba a un punto fijo—
 * pero lo que se rompia era la FIRMA, que es la clave del dedup, y eso si era
 * permanente: cinco fallas identicas producian cinco filas.
 *
 * DUP-002 — CERRADO. Este hook reescribia el archivo entero desde su modelo de
 * tabla, y `lint-arch-wrapper` escribe secciones en prosa en el MISMO archivo.
 * Verificado antes del arreglo: una seccion del wrapper desaparecia con la
 * primera falla de cualquier otra tool.
 *
 * El formato vive ahora en lib/lessons.js, con la tabla entre marcadores
 * AUTO-GENERATED.
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

describe('HUE-016 — CERRADO: un "|" en el error ya no corrompe la tabla', () => {
  test('el pipe entra escapado', () => {
    fallar('Bash', 'grep foo | wc -l fallo');
    assert.match(leer(), /grep foo \\\| wc -l/, 'una celda tiene que ser una celda');
  });

  test('la fila sobrevive intacta al round-trip', () => {
    fallar('Bash', 'grep foo | wc -l fallo');
    const antes = filas()[0];

    // Segunda falla distinta: el hook re-parsea el archivo y lo reescribe.
    fallar('Edit', 'otra cosa');
    const despues = filas().find((f) => f.includes('grep foo'));

    assert.equal(antes, despues, 'el re-parseo la partia por el primer pipe');
  });

  test('la FIRMA vuelve entera, que es lo que rompia el dedup', () => {
    // Se escribia `Bash:a | b | c fallo` y volvia `Bash:a`. Desde ahi la firma
    // calculada no coincidia nunca mas con la guardada.
    fallar('Bash', 'a | b | c fallo');
    fallar('Edit', 'ruido');
    assert.match(leer(), /`Bash:a \\\| b \\\| c fallo`/);
    assert.ok(!/`Bash:a`/.test(leer()), 'no queda truncada en el primer pipe');
  });

  test('cinco veces el mismo error con pipes: UNA fila con contador 5', () => {
    for (let i = 0; i < 5; i++) {
      fallar('Bash', 'grep a | wc -l fallo');
      fallar('Edit', 'ruido');          // fuerza el re-parseo
    }
    const conPipe = filas().filter((f) => f.includes('grep a'));
    assert.equal(conPipe.length, 1, 'antes eran cinco: el dedup dejaba de funcionar');
    assert.match(conPipe[0], /\| 5 \|/);
  });

  test('un salto de linea en el error tampoco parte la fila', () => {
    fallar('Bash', 'linea uno\nlinea dos');
    assert.equal(filas().length, 1);
  });

  test('y una leccion buena ya no la desaloja la rotacion', () => {
    // Con MAX_ENTRIES = 20, un error recurrente con pipe generaba un duplicado
    // por vez y expulsaba por rotacion las entradas utiles.
    fallar('Edit', 'la leccion que importa');
    for (let i = 0; i < 22; i++) {
      fallar('Bash', 'grep a | wc -l fallo');
      fallar('Write', 'ruido');
    }
    assert.match(leer(), /la leccion que importa/);
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

describe('DUP-002 — CERRADO: los dos productores no se pisan', () => {
  // `lint-arch-wrapper` (ESM, en scripts/) agrega secciones en prosa al MISMO
  // archivo que este hook (CommonJS, en hooks/) reescribia entero desde su
  // modelo de tabla. No era que «los formatos son distintos»: uno borraba al otro.
  const SECCION_DEL_WRAPPER = [
    '## 2026-01-01T00:00:00.000Z — Recuperación tras fallo ARCH',
    '',
    '### Contexto',
    'El linter falló y luego fue corregido:',
    '',
    '```',
    '[ARCH-08] color hardcodeado en kpi-card',
    '```',
  ].join('\n');

  function conSeccionDelWrapper() {
    fs.mkdirSync(path.dirname(LESSONS()), { recursive: true });
    fs.writeFileSync(LESSONS(), `# Lessons Learned (lint:arch)\n\n${SECCION_DEL_WRAPPER}\n`);
  }

  test('la seccion del wrapper sobrevive a una falla de otra tool', () => {
    conSeccionDelWrapper();
    fallar('Bash', 'command not found: ng');

    assert.match(leer(), /Recuperación tras fallo ARCH/);
    assert.match(leer(), /color hardcodeado en kpi-card/);
  });

  test('y sobrevive a veinte', () => {
    conSeccionDelWrapper();
    for (let i = 0; i < 20; i++) fallar('Bash', `error numero ${i}`);
    assert.match(leer(), /color hardcodeado en kpi-card/);
  });

  test('la tabla queda entre marcadores AUTO-GENERATED', () => {
    // El mismo patron que indices-sync y assignments-sync: se reescribe lo de
    // adentro y se respeta lo de afuera.
    fallar('Bash', 'x');
    const md = leer();
    assert.match(md, /<!-- AUTO-GENERATED:BEGIN -->/);
    assert.match(md, /<!-- AUTO-GENERATED:END -->/);
    const region = md.slice(md.indexOf('BEGIN -->'), md.indexOf('<!-- AUTO-GENERATED:END'));
    assert.match(region, /\| Date \| Tool \|/, 'la tabla va adentro');
  });

  test('lo que escriba una persona a mano tambien se preserva', () => {
    fallar('Bash', 'x');
    fs.appendFileSync(LESSONS(), '\n## Nota a mano\n\nEsto lo escribio alguien.\n');
    fallar('Edit', 'otra falla');

    assert.match(leer(), /Esto lo escribio alguien/);
  });

  test('migra un archivo viejo sin marcadores sin perder sus entradas', () => {
    // Los proyectos generados antes de este cambio tienen la tabla suelta.
    fs.mkdirSync(path.dirname(LESSONS()), { recursive: true });
    fs.writeFileSync(LESSONS(), [
      '# Lessons Learned (Auto-generated)',
      '',
      '| Date | Tool | Error | Count | Signature | Context |',
      '|------|------|-------|-------|-----------|---------|',
      '| 2026-01-01 | `Bash` | error viejo | 3 | `Bash:error viejo` |  |',
      '',
      '## Seccion previa del wrapper',
      'texto que estaba ahi',
    ].join('\n'));

    fallar('Edit', 'falla nueva');
    const md = leer();
    assert.match(md, /error viejo/, 'la entrada vieja se conserva');
    assert.match(md, /\| 3 \|/, 'con su contador');
    assert.match(md, /texto que estaba ahi/, 'y la seccion previa tambien');
  });
});
