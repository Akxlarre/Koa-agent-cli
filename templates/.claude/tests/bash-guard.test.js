#!/usr/bin/env node
/**
 * bash-guard.test.js — Contract tests del hook bash-guard
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');

const HOOK = path.resolve(__dirname, '..', 'hooks', 'bash-guard.js');

function runHook(cmd) {
  const input = JSON.stringify({ tool_name: 'Bash', tool_input: { command: cmd } });
  const result = spawnSync('node', [HOOK], {
    input,
    encoding: 'utf8',
    env: { ...process.env, TOOL_INPUT: input }
  });
  return { exitCode: result.status, stderr: result.stderr || '' };
}

describe('BASH GUARD — creacion de archivos', () => {
  test('bloquea creacion de .ts via touch', () => {
    const r = runHook('touch src/app/features/dashboard/new.component.ts');
    assert.equal(r.exitCode, 2);
  });

  test('bloquea creacion de .html via touch', () => {
    const r = runHook('touch src/app/shared/components/foo.component.html');
    assert.equal(r.exitCode, 2);
  });

  test('bloquea creacion de .scss via touch', () => {
    const r = runHook('touch src/app/core/styles/foo.scss');
    assert.equal(r.exitCode, 2);
  });

  test('permite comandos ng build', () => {
    const r = runHook('ng build --configuration production');
    assert.ok(r.exitCode !== 2);
  });

  test('permite npm run test', () => {
    const r = runHook('npm run test:ci');
    assert.ok(r.exitCode !== 2);
  });
});

describe('BASH GUARD — operaciones destructivas', () => {
  test('bloquea rm -rf en src/app', () => {
    const r = runHook('rm -rf src/app/features/dashboard');
    assert.equal(r.exitCode, 2);
  });

  test('bloquea rm -rf en .claude', () => {
    const r = runHook('rm -rf .claude');
    assert.equal(r.exitCode, 2);
  });
});

describe('APPROVAL GATE — operaciones DB irreversibles', () => {
  test('bloquea supabase db push', () => {
    const r = runHook('npx supabase db push');
    assert.equal(r.exitCode, 2);
    assert.ok(r.stderr.includes('APPROVAL GATE'));
  });

  test('bloquea supabase db reset', () => {
    const r = runHook('supabase db reset --linked');
    assert.equal(r.exitCode, 2);
  });

  test('bloquea supabase migration repair', () => {
    const r = runHook('supabase migration repair --status applied 20240101000000');
    assert.equal(r.exitCode, 2);
  });

  test('bloquea supabase link', () => {
    const r = runHook('npx supabase link --project-ref abcdefghijklmnop');
    assert.equal(r.exitCode, 2);
  });

  test('bloquea DROP TABLE via psql', () => {
    const r = runHook(`psql "$DB_URL" -c "DROP TABLE profiles"`);
    assert.equal(r.exitCode, 2);
  });

  test('permite supabase start (no destructivo)', () => {
    const r = runHook('npx supabase start');
    assert.equal(r.exitCode, 0);
  });

  test('permite crear una migracion nueva (solo escribe un archivo)', () => {
    const r = runHook('npx supabase migration new productos_create');
    assert.equal(r.exitCode, 0);
  });

  test('permite generar tipos (read-only)', () => {
    const r = runHook('npx supabase gen types typescript --local');
    assert.equal(r.exitCode, 0);
  });
});

describe('BASH GUARD — bypass de creacion sin redireccion', () => {
  test('bloquea cp hacia src/app', () => {
    const r = runHook('cp /tmp/foo.ts src/app/features/x/x.component.ts');
    assert.equal(r.exitCode, 2);
  });

  test('bloquea mv hacia supabase/migrations', () => {
    const r = runHook('mv /tmp/m.sql supabase/migrations/20240101000000_x.sql');
    assert.equal(r.exitCode, 2);
  });

  test('bloquea ng generate (escribe codigo sin pasar por los guards)', () => {
    const r = runHook('ng generate component features/productos');
    assert.equal(r.exitCode, 2);
  });
});
