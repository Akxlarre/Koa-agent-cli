#!/usr/bin/env node
/**
 * pre-write-guard.test.js — Contract tests del hook principal
 *
 * Verifica que el ARCHITECT GUARD bloquee correctamente cada regla.
 * Usa node:test nativo (Node 18+) y child_process para simular el hook.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'pre-write-guard.js');

let sessionCounter = 0;

/**
 * Ejecuta el hook con un payload simulado.
 *
 * Cada llamada usa un session_id unico para que el dedup de Context Injection
 * y el Circuit Breaker no arrastren estado entre tests.
 *
 * Migrado en la tanda 3: el session_id va en el PAYLOAD, no en una variable de
 * entorno, y el discovery flag vive en el proyecto, no en TMPDIR (HUE-002). El
 * fixture usa lib/session.js para escribirlo, o sea el mismo contrato que lee
 * el hook — si el formato cambia, el test se entera.
 *
 * Por defecto se pre-crea el flag de descubrimiento: las capas del hook corren
 * en orden y el Discovery Gate (capa 2) bloquearia antes de llegar al Architect
 * Guard (capa 3), haciendo intesteable todo lo que va despues. Los tests que
 * quieren verificar el Gate en si pasan { discovered: false }.
 *
 * @param {object} input - { tool_name, tool_input: { file_path, content|new_string } }
 * @param {{ discovered?: boolean }} [opts]
 * @returns {{ exitCode: number, stdout: string, stderr: string, sessionId: string }}
 */
/** Deja el discovery flag donde el hook lo busca, usando su mismo modulo. */
function sembrarDescubrimiento(payload) {
  const session = require(path.resolve(__dirname, '..', 'hooks', 'lib', 'session.js'));
  session.appendState(payload, 'discovery.flag',
    `${new Date().toISOString()} | READ | indices/COMPONENTS.md`);
}

function runHook(input, opts = {}) {
  const { discovered = true } = opts;
  const sessionId = `test-session-${Date.now()}-${sessionCounter++}`;
  const proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-pwg-'));
  const payload = { ...input, session_id: sessionId, cwd: proyecto };

  if (discovered) {
    sembrarDescubrimiento(payload);
  }

  const result = spawnSync('node', [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    cwd: proyecto,
  });
  return {
    exitCode: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    sessionId
  };
}

/**
 * Ejecuta el hook N veces reusando la MISMA sesion — necesario para probar
 * el Circuit Breaker, que cuenta bloqueos identicos por sesion.
 */
function runHookRepeated(input, times) {
  const sessionId = `test-breaker-${Date.now()}-${sessionCounter++}`;
  const proyecto = fs.mkdtempSync(path.join(os.tmpdir(), 'koa-pwg-brk-'));
  const payload = { ...input, session_id: sessionId, cwd: proyecto };
  sembrarDescubrimiento(payload);

  const runs = [];
  for (let i = 0; i < times; i++) {
    const result = spawnSync('node', [HOOK], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      cwd: proyecto,
    });
    runs.push({ exitCode: result.status, stderr: result.stderr || '' });
  }
  return runs;
}

function makeInput(filePath, content, toolName = 'Write') {
  return {
    tool_name: toolName,
    tool_input: { file_path: filePath, content, new_string: content }
  };
}

// ─── FILE PROTECTOR tests ───────────────────────────────────────────────────
describe('FILE PROTECTOR', () => {
  test('bloquea edicion a .claude/hooks/', () => {
    const r = runHook(makeInput('/project/.claude/hooks/pre-write-guard.js', 'console.log("x")'));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('FILE PROTECTOR') || r.stderr.includes('guardrails'));
  });

  test('bloquea edicion a scripts/architect.js', () => {
    const r = runHook(makeInput('/project/scripts/architect.js', 'const x = 1'));
    assert.equal(r.exitCode, 2);
  });
});

// ─── ARCHITECT GUARD tests ──────────────────────────────────────────────────
describe('ARCHITECT GUARD — Angular', () => {
  const featurePath = '/project/src/app/features/dashboard/dashboard.component.ts';
  const sharedPath = '/project/src/app/shared/components/kpi-card/kpi-card.component.ts';
  const htmlPath = '/project/src/app/features/dashboard/dashboard.component.html';

  test('bloquea *ngIf en template TypeScript', () => {
    const r = runHook(makeInput(featurePath, 'template: `<div *ngIf="cond">x</div>`'));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('ngIf'));
  });

  test('permite @if en template TypeScript', () => {
    const r = runHook(makeInput(featurePath, 'template: `@if (cond) { <div>x</div> }`'));
    // No debe bloquear por ngIf (puede bloquear por OnPush si no lo tiene)
    assert.ok(r.exitCode !== 2 || !r.stderr.includes('ngIf'));
  });

  test('bloquea @Input() decorator', () => {
    const r = runHook(makeInput(featurePath, '@Input() public value: string;'));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('@Input'));
  });

  test('bloquea @Output() decorator', () => {
    const r = runHook(makeInput(featurePath, '@Output() public changed = new EventEmitter();'));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('@Output'));
  });

  test('bloquea color Tailwind hardcodeado', () => {
    const r = runHook(makeInput(featurePath, '<div class="text-red-500 bg-blue-200">x</div>'));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('hardcodeado') || r.stderr.includes('ARCHITECT'));
  });

  test('bloquea inject de Facade en Dumb component (shared/)', () => {
    const r = runHook(makeInput(sharedPath,
      'readonly facade = inject(AuthFacade); template: `<div>x</div>`',
      'Write'
    ));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('Dumb') || r.stderr.includes('Facade'));
  });

  test('bloquea @angular/animations', () => {
    const r = runHook(makeInput(featurePath, "import { animate } from '@angular/animations';"));
    assert.equal(r.exitCode, 2);
  });

  test('bloquea inject(MessageService) en componentes UI', () => {
    const r = runHook(makeInput(featurePath, 'inject(MessageService)'));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('MessageService') || r.stderr.includes('ToastService'));
  });
});

describe('ARCHITECT GUARD — A11Y', () => {
  const htmlPath = '/project/src/app/features/dashboard/dashboard.component.html';

  test('bloquea <app-icon> sin aria-label', () => {
    const r = runHook(makeInput(htmlPath, '<app-icon name="trash" />'));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('A11Y-01') || r.stderr.includes('aria-label'));
  });

  test('permite <app-icon> con aria-label', () => {
    const r = runHook(makeInput(htmlPath, `<app-icon name="trash" [attr.aria-label]="'Eliminar'" />`));
    // No debe bloquear por A11Y-01
    assert.ok(r.exitCode !== 2 || !r.stderr.includes('A11Y-01'));
  });

  test('bloquea <p-table> sin aria-label ni caption', () => {
    const r = runHook(makeInput(htmlPath, '<p-table [value]="data()"></p-table>'));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('A11Y-02') || r.stderr.includes('p-table'));
  });
});

describe('ARCHITECT GUARD — SQL', () => {
  const migrationPath = '/project/supabase/migrations/20240101000000_auth_create_profiles.sql';

  test('bloquea CREATE TABLE sin RLS', () => {
    const r = runHook(makeInput(migrationPath, 'CREATE TABLE public.users (id uuid PRIMARY KEY);'));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('RLS') || r.stderr.includes('ROW LEVEL SECURITY'));
  });

  test('permite CREATE TABLE con RLS y politica', () => {
    // Desde SEC-RLS-01, activar RLS ya no alcanza: una tabla con RLS y cero
    // politicas queda inaccesible. El contrato ahora es tabla + RLS + politica.
    const r = runHook(makeInput(migrationPath,
      'CREATE TABLE public.users (id uuid PRIMARY KEY);\n' +
      'ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;\n' +
      'CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);'
    ));
    assert.notEqual(r.exitCode, 2);
  });
});

describe('ARCHITECT GUARD — ARCH-13', () => {
  test('bloquea edicion manual de supabase.types.ts', () => {
    const r = runHook(makeInput(
      '/project/src/app/core/models/supabase.types.ts',
      'export type Database = {};'
    ));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('ARCH-13') || r.stderr.includes('AUTO-GENERADO'));
  });
});

// ─── CIRCUIT BREAKER tests ────────────────────────────────────────────────
describe('CIRCUIT BREAKER', () => {
  const htmlPath = '/project/src/app/features/dashboard/dashboard.component.html';
  const badContent = '<div *ngIf="cond">x</div>';

  test('avisa del contador a partir del 2do intento identico', () => {
    const runs = runHookRepeated(makeInput(htmlPath, badContent), 2);
    assert.equal(runs[0].exitCode, 2);
    assert.ok(!runs[0].stderr.includes('Intento'), 'el 1er intento no debe mencionar contador');
    assert.ok(runs[1].stderr.includes('Intento 2/3'));
  });

  test('escala a CIRCUIT BREAKER al 3er intento identico', () => {
    const runs = runHookRepeated(makeInput(htmlPath, badContent), 3);
    assert.equal(runs[2].exitCode, 2);
    assert.ok(runs[2].stderr.includes('CIRCUIT BREAKER'));
    assert.ok(runs[2].stderr.includes('DETENTE'));
  });

  test('el contador es por sesion — otra sesion arranca limpia', () => {
    runHookRepeated(makeInput(htmlPath, badContent), 3);
    const fresh = runHook(makeInput(htmlPath, badContent));
    assert.equal(fresh.exitCode, 2);
    assert.ok(!fresh.stderr.includes('CIRCUIT BREAKER'));
  });

  test('no escala si el codigo es valido (no hay bloqueo que contar)', () => {
    const runs = runHookRepeated(
      makeInput(htmlPath, '@if (cond) { <div>x</div> }'),
      3
    );
    assert.ok(runs.every(r => r.exitCode !== 2));
  });
});

// ─── DISCOVERY GATE tests ─────────────────────────────────────────────────
describe('DISCOVERY GATE', () => {
  const featurePath = '/project/src/app/features/dashboard/dashboard.component.ts';

  test('bloquea escritura en src/app sin haber leido indices', () => {
    const r = runHook(makeInput(featurePath, 'export class X {}'), { discovered: false });
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('DISCOVERY GATE'));
  });

  test('permite pasar del Gate una vez leidos los indices', () => {
    const r = runHook(makeInput(featurePath, 'export class X {}'), { discovered: true });
    assert.ok(!r.stderr.includes('DISCOVERY GATE'));
  });
});

// ─── RLS / migraciones SQL ────────────────────────────────────────────────
describe('ARCHITECT GUARD — RLS en migraciones', () => {
  const mig = '/project/supabase/migrations/20250101000000_pedidos_create.sql';
  const table = 'CREATE TABLE public.pedidos (id uuid);\n';
  const rls = 'ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;\n';

  test('bloquea CREATE TABLE sin RLS', () => {
    const r = runHook(makeInput(mig, table));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('ROW LEVEL SECURITY'));
  });

  test('[SEC-RLS-01] bloquea RLS activado sin ninguna politica', () => {
    const r = runHook(makeInput(mig, table + rls));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('SEC-RLS-01'));
    assert.ok(r.stderr.includes('inaccesible'), 'debe explicar que el efecto es denegar todo');
  });

  test('permite tabla con RLS y politica acotada', () => {
    const sql = table + rls +
      'CREATE POLICY "pedidos_select_own" ON public.pedidos FOR SELECT USING (auth.uid() = user_id);\n';
    const r = runHook(makeInput(mig, sql));
    assert.notEqual(r.exitCode, 2);
  });

  test('acepta CREATE POLICY IF NOT EXISTS (forma usada por el blueprint)', () => {
    const sql = table + rls +
      'CREATE POLICY IF NOT EXISTS "p" ON public.pedidos FOR SELECT USING (auth.uid() = user_id);\n';
    const r = runHook(makeInput(mig, sql));
    assert.notEqual(r.exitCode, 2);
  });

  test('no exige politicas en una migracion que no crea tablas', () => {
    // Agregar politicas a una tabla existente es un cambio valido por si solo.
    const r = runHook(makeInput(
      '/project/supabase/migrations/20250101000001_pedidos_rls.sql',
      'CREATE POLICY "p2" ON public.pedidos FOR SELECT USING (auth.uid() = user_id);\n',
    ));
    assert.notEqual(r.exitCode, 2);
  });
});

describe('ARCHITECT GUARD — politicas RLS permisivas', () => {
  const mig = '/project/supabase/migrations/20250101000000_pedidos_create.sql';
  const base = 'CREATE TABLE public.pedidos (id uuid);\nALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;\n';

  const blocked = ['ALL', 'UPDATE', 'DELETE', 'INSERT'];
  for (const cmd of blocked) {
    test(`[SEC-RLS-02] bloquea FOR ${cmd} con USING (true)`, () => {
      const r = runHook(makeInput(mig, base + `CREATE POLICY "p" ON public.pedidos FOR ${cmd} USING (true);\n`));
      assert.equal(r.exitCode, 2);
      assert.ok(r.stderr.includes('SEC-RLS-02'));
      assert.ok(r.stderr.includes(`FOR ${cmd}`));
    });
  }

  test('permite FOR SELECT con USING (true) — tabla de catalogo publica', () => {
    const r = runHook(makeInput(mig, base + 'CREATE POLICY "p" ON public.pedidos FOR SELECT USING (true);\n'));
    assert.notEqual(r.exitCode, 2);
  });

  test('bloquea una politica sin clausula FOR (Postgres asume ALL)', () => {
    const r = runHook(makeInput(mig, base + 'CREATE POLICY "p" ON public.pedidos USING (true);\n'));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('SEC-RLS-02'));
  });

  test('permite WITH CHECK (false) — insercion solo via trigger', () => {
    const r = runHook(makeInput(mig, base + 'CREATE POLICY "p" ON public.pedidos FOR INSERT WITH CHECK (false);\n'));
    assert.notEqual(r.exitCode, 2);
  });

  test('bloquea WITH CHECK (true) en una escritura', () => {
    const r = runHook(makeInput(mig, base + 'CREATE POLICY "p" ON public.pedidos FOR INSERT WITH CHECK (true);\n'));
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('SEC-RLS-02'));
  });

  test('las migraciones que envia el blueprint pasan el guard', () => {
    // Regresion: si un check nuevo rompe las migraciones propias, el proyecto
    // generado arranca bloqueado.
    const migDir = path.resolve(__dirname, '..', '..', 'supabase', 'migrations');
    const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql'));
    assert.ok(files.length > 0, 'deberia haber migraciones que verificar');
    for (const f of files) {
      const sql = fs.readFileSync(path.join(migDir, f), 'utf-8');
      const r = runHook(makeInput(`/project/supabase/migrations/${f}`, sql));
      assert.notEqual(r.exitCode, 2, `${f} quedo bloqueada: ${r.stderr}`);
    }
  });
});
