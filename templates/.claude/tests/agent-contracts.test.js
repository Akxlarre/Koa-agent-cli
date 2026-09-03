#!/usr/bin/env node
/**
 * agent-contracts.test.js — Lo verificable de un subagente (HUE-023, INC-026)
 *
 * El hallazgo decía que «la calidad del resumen de los subagentes no es
 * verificable por ningún mecanismo del repo». Es cierto y va a seguir siéndolo:
 * ningún test va a juzgar si un veredicto de `code-judge` estuvo bien pensado.
 *
 * Pero «la calidad» no es lo único que se afirma sobre un subagente, y el resto
 * sí se puede sostener:
 *
 *   el FORMATO que promete devolver   — está escrito en su propia definición
 *   los PERMISOS con los que corre    — están en su frontmatter
 *   lo que el harness AFIRMA de él    — está en `.claude/CLAUDE.md`
 *
 * Ese tercero es el que estaba suelto y el que produjo `INC-026`. La prosa
 * agrupaba a `index-syncer` y a `code-judge` bajo «permisos de escritura
 * acotados a propósito», y sólo uno los tiene: `index-syncer` corre con `Bash`,
 * `Write` y `Edit` porque necesita `npm run indices:sync`. El propio párrafo
 * explicaba, dos líneas más abajo, por qué `Bash` convierte una garantía en una
 * promesa — y se refutaba solo sin que nada lo notara.
 *
 * La diferencia importa cuando confiás: una la sostiene el sistema de permisos,
 * la otra la sostiene que el agente obedezca su prompt.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CLAUDE = path.resolve(__dirname, '..');
const AGENTES = path.join(CLAUDE, 'agents');

/** Herramientas que permiten escribir en el filesystem, de una forma u otra. */
const DE_ESCRITURA = ['Write', 'Edit', 'Bash'];

function agentes() {
  if (!fs.existsSync(AGENTES)) return [];
  return fs.readdirSync(AGENTES).filter((f) => f.endsWith('.md')).map((f) => {
    const txt = fs.readFileSync(path.join(AGENTES, f), 'utf-8');
    const fm = txt.split(/^---$/m)[1] || '';
    const tools = (/^tools:\s*(.+)$/m.exec(fm)?.[1] || '')
      .split(',').map((t) => t.trim()).filter(Boolean);
    return {
      archivo: f,
      nombre: /^name:\s*(\S+)/m.exec(fm)?.[1] || f.replace(/\.md$/, ''),
      tools,
      texto: txt,
      puedeEscribir: tools.some((t) => DE_ESCRITURA.includes(t)),
    };
  });
}

const TODOS = agentes();

describe('HUE-023 — lo que un subagente promete devolver', () => {
  test('hay subagentes que revisar', () => {
    assert.ok(TODOS.length >= 5, `solo ${TODOS.length} subagentes`);
  });

  for (const a of TODOS) {
    test(`${a.archivo} declara un formato de salida`, () => {
      // Es lo único del resumen que un mecanismo puede sostener. Un subagente
      // que dice «devuelve un veredicto» sin decir su forma no le sirve de
      // contrato a nadie: el llamador no puede depender de nada.
      assert.match(a.texto, /^## Formato de salida/m,
        'sin formato declarado, el resumen no tiene contrato que verificar');
    });

    test(`${a.archivo} muestra la forma, no solo la nombra`, () => {
      const bloque = /^## Formato de salida[^\n]*\n+```[\s\S]+?```/m.test(a.texto);
      assert.ok(bloque, 'la sección existe pero no trae el bloque con la forma concreta');
    });

    test(`${a.archivo} declara sus herramientas`, () => {
      // Sin `tools:` el subagente hereda todo, y cualquier afirmación sobre lo
      // que «no puede hacer» deja de tener respaldo.
      assert.ok(a.tools.length > 0, 'sin `tools:` en el frontmatter');
    });
  }
});

describe('INC-026 — una garantía de permisos no es lo mismo que una regla del prompt', () => {
  const CLAUDE_MD = fs.readFileSync(path.join(CLAUDE, 'CLAUDE.md'), 'utf-8');

  test('code-judge no puede escribir: eso sí lo sostiene el sistema', () => {
    // `.claude/CLAUDE.md` lo presenta como un hecho y tiene derecho a hacerlo.
    // Con `Bash` podría escribir con `>`, y dejaría de serlo.
    const juez = TODOS.find((a) => a.nombre === 'code-judge');
    assert.ok(juez, 'no existe code-judge');
    assert.deepEqual(juez.tools.filter((t) => DE_ESCRITURA.includes(t)), [],
      'el juez tiene una herramienta de escritura: «no arregla nada» pasó a ser promesa');
  });

  test('ningún agente con permisos de escritura se presenta como acotado', () => {
    // El detector: la prosa no puede decir «escribe **solo** en X» de un agente
    // que corre con Bash/Write/Edit. Es la frase exacta que había y la que se
    // refutaba sola dos líneas más abajo.
    const mentiras = TODOS
      .filter((a) => a.puedeEscribir)
      .filter((a) => new RegExp(`\`${a.nombre}\`[^.]{0,60}escribe \\*\\*solo\\*\\*`).test(CLAUDE_MD))
      .map((a) => `${a.nombre} (${a.tools.join(', ')})`);
    assert.deepEqual(mentiras, []);
  });

  test('y la prosa dice cuál de las dos cosas te está protegiendo', () => {
    // Sin esto el test anterior se satisface borrando la frase, que deja al
    // lector sin saber que `index-syncer` corre sin red.
    assert.match(CLAUDE_MD, /INC-026/,
      'CLAUDE.md tiene que distinguir el permiso de la regla del prompt, no callarse');
    assert.match(CLAUDE_MD, /promesa, no un hecho|no es un permiso|una regla de su prompt/);
  });

  test('index-syncer sigue teniendo Bash a propósito', () => {
    // No es un descuido que se pueda «arreglar» sacándole permisos: corre
    // `npm run indices:sync`, que es el mecanismo que lo hace útil. Lo que se
    // arregla es la afirmación, no la herramienta.
    const syncer = TODOS.find((a) => a.nombre === 'index-syncer');
    assert.ok(syncer, 'no existe index-syncer');
    assert.ok(syncer.tools.includes('Bash'),
      'si se le sacó Bash, revisá que siga pudiendo correr indices:sync');
  });
});
