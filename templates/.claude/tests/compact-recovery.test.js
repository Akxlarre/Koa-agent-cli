#!/usr/bin/env node
/**
 * compact-recovery.test.js — Contract tests del hook PostCompact
 *
 * Este hook estuvo roto por un error de sintaxis sin que nadie lo notara:
 * fallaba en silencio en cada compactacion. El primer test de aqui es el
 * mas importante — verifica que el archivo simplemente CORRE.
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'compact-recovery.js');

const created = [];

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-compact-'));
  created.push(root);
  fs.mkdirSync(path.join(root, 'indices'), { recursive: true });
  fs.mkdirSync(path.join(root, '.claude', 'temp'), { recursive: true });
  return root;
}

function runHook(root, sessionId = 'compact-test') {
  const r = spawnSync('node', [HOOK], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_SESSION_ID: sessionId },
  });
  return { exitCode: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

afterEach(() => {
  while (created.length) {
    try { fs.rmSync(created.pop(), { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

describe('COMPACT RECOVERY', () => {
  test('el hook se ejecuta sin errores (regresion: sintaxis rota)', () => {
    const r = runHook(makeProject());
    assert.equal(r.exitCode, 0);
    assert.equal(r.stderr, '', 'no debe emitir errores a stderr');
    assert.ok(r.stdout.includes('CONTEXTO RE-INYECTADO'));
  });

  test('inyecta los indices core siempre', () => {
    const root = makeProject();
    fs.writeFileSync(path.join(root, 'indices', 'COMPONENTS.md'), '# COMPONENTS\n- app-kpi-card');
    const r = runHook(root);
    assert.ok(r.stdout.includes('app-kpi-card'));
  });

  test('corta el indice en DETAIL:BEGIN (solo Quick Reference)', () => {
    const root = makeProject();
    fs.writeFileSync(
      path.join(root, 'indices', 'COMPONENTS.md'),
      '# COMPONENTS\nQUICK-REF-VISIBLE\n<!-- DETAIL:BEGIN -->\nEJEMPLO-LARGO-OCULTO\n'
    );
    const r = runHook(root);
    assert.ok(r.stdout.includes('QUICK-REF-VISIBLE'));
    assert.ok(!r.stdout.includes('EJEMPLO-LARGO-OCULTO'));
  });

  test('re-inyecta solo las casillas pendientes del task-spec', () => {
    const root = makeProject();
    fs.writeFileSync(
      path.join(root, '.claude', 'temp', 'task-spec-20260101-120000.md'),
      '# Spec\n- [x] paso-ya-hecho\n- [ ] paso-pendiente\n'
    );
    const r = runHook(root);
    assert.ok(r.stdout.includes('paso-pendiente'));
    assert.ok(!r.stdout.includes('paso-ya-hecho'), 'lo completado no debe volver al contexto');
  });

  test('omite la seccion de task-spec si no queda nada pendiente', () => {
    const root = makeProject();
    fs.writeFileSync(
      path.join(root, '.claude', 'temp', 'task-spec-20260101-120000.md'),
      '# Spec\n- [x] todo hecho\n'
    );
    const r = runHook(root);
    assert.ok(!r.stdout.includes('Task-spec activo'));
  });

  test('salta archivos de context/ que son solo plantilla vacia', () => {
    const root = makeProject();
    fs.mkdirSync(path.join(root, 'context'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'context', 'domain.md'),
      '# Domain\n<!-- ' + 'x'.repeat(400) + ' -->\n'
    );
    const r = runHook(root);
    assert.ok(!r.stdout.includes('context/domain.md'), 'una plantilla sin contenido real no se inyecta');
  });

  test('inyecta context/ cuando tiene contenido real', () => {
    const root = makeProject();
    fs.mkdirSync(path.join(root, 'context'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'context', 'domain.md'),
      '# Domain\nUn Pedido pertenece a un Cliente y tiene muchas Lineas de Pedido. '
      + 'El estado del Pedido lo gobierna la maquina de estados de facturacion.\n'
    );
    const r = runHook(root);
    assert.ok(r.stdout.includes('context/domain.md'));
    assert.ok(r.stdout.includes('maquina de estados'));
  });
});

describe('CAR-004 / HUE-017 / DEC-006 — presupuesto de la re-inyeccion', () => {
  const fs2 = require('fs');
  const os2 = require('os');
  const path2 = require('path');
  const { spawnSync: spawn2 } = require('child_process');
  const HOOK2 = path2.resolve(__dirname, '..', 'hooks', 'compact-recovery.js');
  const TPL = path2.resolve(__dirname, '..', '..');

  let proy;

  function conProyecto({ contextLleno = false } = {}) {
    proy = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'koa-cr-'));
    fs2.mkdirSync(path2.join(proy, 'indices'), { recursive: true });
    fs2.mkdirSync(path2.join(proy, 'context'), { recursive: true });

    // Indices grandes: Quick Reference + un bloque de ejemplos tras DETAIL:BEGIN
    for (const n of ['COMPONENTS', 'SERVICES', 'FACADES']) {
      fs2.writeFileSync(path2.join(proy, 'indices', `${n}.md`),
        `# ${n}\n\n## Quick Reference\n\n${'| fila muy larga para superar el techo |\n'.repeat(200)}` +
        `\n<!-- DETAIL:BEGIN -->\n${'// ejemplo\n'.repeat(300)}`);
    }
    // Las plantillas REALES de context/, sin llenar
    for (const f of ['brief', 'domain', 'constraints', 'learnings']) {
      const src = path2.join(TPL, 'context', `${f}.md`);
      if (fs2.existsSync(src)) fs2.copyFileSync(src, path2.join(proy, 'context', `${f}.md`));
    }
    if (contextLleno) {
      fs2.writeFileSync(path2.join(proy, 'context', 'brief.md'),
        '# Brief\n\n## Objetivo\n\nConstruir el modulo de reportes con filtros por fecha ' +
        'y export a CSV para el equipo de finanzas, sin tocar autenticacion.\n');
    }
    return proy;
  }

  function correr2() {
    const r = spawn2('node', [HOOK2], {
      input: JSON.stringify({ hook_event_name: 'PostCompact', session_id: 's1', cwd: proy }),
      encoding: 'utf8', cwd: proy,
    });
    return r.stdout || '';
  }

  afterEach(() => {
    if (proy) { try { fs2.rmSync(proy, { recursive: true, force: true }); } catch { /* */ } }
    proy = null;
  });

  test('HUE-017: hay techo por indice, y lo dice', () => {
    conProyecto();
    const out = correr2();
    assert.ok(out.includes('recortado'), 'antes no habia ningun tope');
    assert.ok(out.length < 20000, `la re-inyeccion no puede ser ilimitada: ${out.length} chars`);
  });

  test('corta en DETAIL:BEGIN — los ejemplos no vuelven', () => {
    conProyecto();
    assert.ok(!correr2().includes('// ejemplo'));
  });

  test('DEC-006: las plantillas vacias de context/ NO se inyectan', () => {
    conProyecto();
    const out = correr2();
    assert.ok(!out.includes('Contexto del proyecto'),
      'las cuatro plantillas pasaban el umbral de 80 por su propio andamiaje');
  });

  test('un context/brief.md REALMENTE llenado si se inyecta', () => {
    conProyecto({ contextLleno: true });
    const out = correr2();
    assert.match(out, /context\/brief\.md/);
    assert.match(out, /modulo de reportes/);
  });

  test('CAR-004: session-start no corre al compactar — el matcher lo excluye', () => {
    const cfg = JSON.parse(fs2.readFileSync(path2.join(TPL, '.claude', 'settings.json'), 'utf-8'));
    const entrada = cfg.hooks.SessionStart[0];
    assert.equal(typeof entrada.matcher, 'string', 'sin matcher corre en los cinco origenes');
    assert.ok(!entrada.matcher.includes('compact'),
      'compact lo cubre PostCompact; los dos juntos inyectaban lo mismo dos veces');
    for (const origen of ['startup', 'resume', 'clear', 'fork']) {
      assert.ok(entrada.matcher.includes(origen), `${origen} si debe arrancar la sesion`);
    }
  });
});
