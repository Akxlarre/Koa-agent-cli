#!/usr/bin/env node
/**
 * context-enrichment-guard.test.js — Contract tests de context-enrichment-guard.js
 *
 * DEC-008. El hook bloquea escribir codigo si context/domain.md o
 * indices/DATABASE.md siguen siendo plantillas sin rellenar. Su detector:
 *
 *     PLACEHOLDER_MARKERS = ['[TODO]', '{{PROJECT_NAME}}', '<!-- template -->']
 *     MIN_MEANINGFUL_LENGTH = 50
 *
 * Ninguna de las dos condiciones se cumple en un proyecto recien generado: las
 * plantillas pasan los 50 chars por su propio andamiaje, y el unico marcador que
 * traian —{{PROJECT_NAME}} en domain.md— lo borra injectVars al generar.
 *
 * El hook es opt-in, y su docblock justifica eso diciendo que cableado
 * bloquearia todo desde el minuto cero. No bloquearia nada.
 *
 * TESTS DE CARACTERIZACION.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'context-enrichment-guard.js');
const TEMPLATES = path.resolve(__dirname, '..', '..');
let proyecto;

function correr(filePath) {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: filePath, content: 'x' },
    }),
    encoding: 'utf8', cwd: proyecto,
  });
  return { exit: r.status, stderr: r.stderr || '' };
}

function escribir(rel, contenido) {
  const full = path.join(proyecto, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contenido);
}

/** Contexto completo y creible: el caso en que el guard debe dejar pasar. */
function conContextoLleno() {
  escribir('context/domain.md',
    '# Dominio\n\nUn reporte agrupa mediciones por periodo. El cliente llama "corte" al cierre mensual.\n');
  escribir('indices/DATABASE.md',
    '# DATABASE\n\n| tabla | columnas |\n|---|---|\n| reportes | id, periodo, total |\n');
}

beforeEach(() => { proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-ceg-')); });
afterEach(() => { fs.rmSync(proyecto, { recursive: true, force: true }); });

describe('NO ESTA CABLEADO — es opt-in', () => {
  test('no figura en settings.json', () => {
    const s = fs.readFileSync(path.join(TEMPLATES, '.claude', 'settings.json'), 'utf-8');
    assert.ok(!s.includes('context-enrichment-guard'),
      'si alguien lo cablea, hay que revisar DEC-008 primero');
  });
});

describe('CUANDO BLOQUEA', () => {
  test('faltan los dos archivos', () => {
    const r = correr('src/app/x.component.ts');
    assert.equal(r.exit, 2);
    assert.match(r.stderr, /DAY 0 CONTEXT GUARD/);
    assert.match(r.stderr, /falta el archivo/);
  });

  test('los archivos existen pero son muy cortos', () => {
    escribir('context/domain.md', '# D\n');
    escribir('indices/DATABASE.md', '# DB\n');
    const r = correr('src/app/x.component.ts');
    assert.equal(r.exit, 2);
    assert.match(r.stderr, /está vacío/);
  });

  test('un marcador explicito lo delata', () => {
    conContextoLleno();
    escribir('context/domain.md', '# Dominio\n\n[TODO] describir el lenguaje ubicuo del negocio aqui.\n');
    const r = correr('src/app/x.component.ts');
    assert.equal(r.exit, 2);
    assert.match(r.stderr, /sigue siendo el template/);
  });

  test('tambien vigila las migraciones', () => {
    assert.equal(correr('supabase/migrations/001_init.sql').exit, 2);
  });
});

describe('CUANDO DEJA PASAR', () => {
  test('con contexto real, no molesta', () => {
    conContextoLleno();
    assert.equal(correr('src/app/x.component.ts').exit, 0);
  });

  test('no vigila un .spec.ts', () => {
    assert.equal(correr('src/app/x.component.spec.ts').exit, 0);
  });

  test('no vigila lo que no es codigo fuente', () => {
    for (const p of ['README.md', 'indices/COMPONENTS.md', '.claude/hooks/x.js', 'src/main.ts']) {
      assert.equal(correr(p).exit, 0, `${p} no deberia dispararlo`);
    }
  });
});

describe('DEC-008 — el detector no dispara en un proyecto recien generado', () => {
  // Se copian las plantillas REALES del repo, aplicando la misma sustitucion
  // de variables que hace el scaffolder.
  function conPlantillasReales({ conInjectVars }) {
    for (const rel of ['context/domain.md', 'indices/DATABASE.md']) {
      let c = fs.readFileSync(path.join(TEMPLATES, rel), 'utf-8');
      if (conInjectVars) c = c.replace(/\{\{PROJECT_NAME\}\}/g, 'demo')
        .replace(/\{\{BLUEPRINT_VERSION\}\}/g, '6.1.0');
      escribir(rel, c);
    }
  }

  test('(bug) con las plantillas tal como quedan al generar, NO bloquea', () => {
    conPlantillasReales({ conInjectVars: true });
    assert.equal(correr('src/app/x.component.ts').exit, 0,
      'es exactamente el escenario para el que se escribio el hook');
  });

  test('las dos plantillas superan MIN_MEANINGFUL_LENGTH por su andamiaje', () => {
    for (const rel of ['context/domain.md', 'indices/DATABASE.md']) {
      const len = fs.readFileSync(path.join(TEMPLATES, rel), 'utf-8').trim().length;
      assert.ok(len > 50, `${rel}: ${len} chars — el umbral de 50 no discrimina`);
    }
  });

  test('indices/DATABASE.md no trae ningun marcador, ni siquiera en templates/', () => {
    const c = fs.readFileSync(path.join(TEMPLATES, 'indices', 'DATABASE.md'), 'utf-8');
    for (const m of ['[TODO]', '{{PROJECT_NAME}}', '<!-- template -->']) {
      assert.ok(!c.includes(m), `si ahora trae ${m}, DEC-008 cambio: revisalo`);
    }
  });

  test('el marcador {{PROJECT_NAME}} distingue plantilla de proyecto generado', () => {
    // Este archivo corre en dos contextos. En el repo del CLI, domain.md
    // todavia trae {{PROJECT_NAME}} y el guard lo atrapa. En un proyecto ya
    // generado, injectVars lo borro y el guard se le escapa: ese es DEC-008.
    const c = fs.readFileSync(path.join(TEMPLATES, 'context', 'domain.md'), 'utf-8');
    const sinGenerar = c.includes('{{PROJECT_NAME}}');

    conPlantillasReales({ conInjectVars: false });
    assert.equal(correr('src/app/x.component.ts').exit, sinGenerar ? 2 : 0);

    conPlantillasReales({ conInjectVars: true });
    assert.equal(correr('src/app/x.component.ts').exit, 0,
      'una vez generado, el detector no dispara — DEC-008');
  });

  test('lib/budget.js SI las detecta — es el reemplazo del detector', () => {
    const B = require(path.resolve(__dirname, '..', 'hooks', 'lib', 'budget.js'));
    const c = fs.readFileSync(path.join(TEMPLATES, 'context', 'domain.md'), 'utf-8')
      .replace(/\{\{PROJECT_NAME\}\}/g, 'demo');
    assert.equal(B.isPlaceholder(c), true);
  });
});

describe('FAIL-OPEN', () => {
  test('stdin invalido: exit 0', () => {
    const r = spawnSync('node', [HOOK], { input: '{ roto', encoding: 'utf8', cwd: proyecto });
    assert.equal(r.status, 0);
  });

  test('sin file_path: exit 0', () => {
    const r = spawnSync('node', [HOOK], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: {} }),
      encoding: 'utf8', cwd: proyecto,
    });
    assert.equal(r.status, 0);
  });
});
