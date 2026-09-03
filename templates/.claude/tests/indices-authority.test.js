#!/usr/bin/env node
/**
 * indices-authority.test.js — Quién manda sobre `indices/` (DUP-003)
 *
 * Tres piezas sincronizan índices y ninguna decía cuál usar cuándo:
 *
 *   scripts/indices-sync.js   el auto-indexer AST
 *   agents/index-syncer.md    el subagente
 *   skills/sync-indices       la skill que invoca el humano
 *
 * «Sin reparto» resultó ser demasiado suave. La skill no mencionaba **ni al
 * script ni al subagente**: leía cuatro índices, buscaba archivos cambiados y
 * reescribía las tablas a mano. Es decir, rehacía peor lo que el AST hace bien,
 * para 4 de los 15 índices, **editando dentro de los marcadores
 * `AUTO-GENERATED`** — o sea entregando trabajo que la próxima corrida del
 * script borra (`HUE-007`).
 *
 * Y no era un descuido de redacción: la skill tenía `allowed-tools: Read, Edit,
 * Glob, Grep`. Sin `Bash`, no podía correr `npm run indices:sync` **ni aunque
 * quisiera**. La duplicación estaba en el frontmatter.
 *
 * El reparto decidido, que es lo que estos tests fijan:
 *
 *   el script      LA AUTORIDAD sobre los 13 auto-generables
 *   el subagente   el ÚNICO que escribe indices/
 *   la skill       la PUERTA: delega, no edita
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CLAUDE = path.resolve(__dirname, '..');
const TEMPLATES = path.resolve(CLAUDE, '..');

/** El script vive en `scripts/` en el proyecto y en `boilerplate/scripts/` acá. */
function enRepo(rel) {
  const directa = path.join(TEMPLATES, rel);
  if (fs.existsSync(directa)) return directa;
  return path.join(TEMPLATES, 'boilerplate', rel);
}

const SKILL = fs.readFileSync(path.join(CLAUDE, 'skills', 'sync-indices', 'SKILL.md'), 'utf-8');
const AGENTE = fs.readFileSync(path.join(CLAUDE, 'agents', 'index-syncer.md'), 'utf-8');
const SCRIPT = fs.readFileSync(enRepo('scripts/indices-sync.js'), 'utf-8');

/** El valor de una clave del frontmatter YAML. */
function frontmatter(txt, clave) {
  const m = new RegExp(`^${clave}:\\s*(.+)$`, 'm').exec(txt.split(/^---$/m)[1] || '');
  return m ? m[1].trim() : null;
}

describe('DUP-003 — la skill es la puerta, no el mecanismo', () => {
  test('no tiene Edit ni Write: la restricción está en el frontmatter, no en la prosa', () => {
    // Es la mitad que importa. Pedirle en prosa que no edite es una guideline;
    // sacarle la herramienta es un hecho.
    const tools = frontmatter(SKILL, 'allowed-tools');
    assert.ok(tools, 'la skill no declara allowed-tools');
    assert.ok(!/\bEdit\b/.test(tools), `sigue pudiendo editar índices: ${tools}`);
    assert.ok(!/\bWrite\b/.test(tools), tools);
  });

  test('delega en el subagente', () => {
    assert.match(SKILL, /index-syncer/,
      'la versión anterior no nombraba ni al script ni al subagente');
  });

  test('y nombra al auto-indexer como la autoridad', () => {
    assert.match(SKILL, /indices:sync/);
  });

  test('advierte sobre editar dentro de los marcadores (HUE-007)', () => {
    assert.match(SKILL, /AUTO-GENERATED/);
  });
});

describe('DUP-003 — el subagente es el único que escribe indices/', () => {
  test('declara el reparto', () => {
    assert.match(AGENTE, /DUP-003/);
    assert.match(AGENTE, /indices:sync/, 'tiene que correr el script antes de completar a mano');
  });

  test('tiene las tools para hacerlo, a diferencia de la skill', () => {
    const tools = frontmatter(AGENTE, 'tools');
    assert.match(tools, /\bBash\b/, 'sin Bash no puede correr el auto-indexer');
    assert.match(tools, /\bEdit\b/, 'es el que completa a mano lo que el script no deduce');
  });
});

describe('DUP-003 — el script declara que es la autoridad', () => {
  test('lo dice en su docblock, donde lo lee quien lo va a tocar', () => {
    assert.match(SCRIPT, /DUP-003/);
    assert.match(SCRIPT, /AUTORIDAD/);
  });

  test('y nombra a las otras dos piezas', () => {
    // Que las tres se nombren entre sí es lo que impide que la cuarta versión
    // de alguna vuelva a resolver el problema por su cuenta.
    assert.match(SCRIPT, /index-syncer/);
    assert.match(SCRIPT, /sync-indices/);
  });
});
