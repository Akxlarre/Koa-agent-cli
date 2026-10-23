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
 *
 * Y antes que todo eso, lo que la prosa afirma de un subagente que NO existe
 * (INC-028): «ac-verifier (Haiku)» firmaba cada `acceptance.md` sin que hubiera
 * ningún `ac-verifier` en `agents/`.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CLAUDE = path.resolve(__dirname, '..');
const PROYECTO = path.resolve(CLAUDE, '..');
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
      modelo: (/^model:\s*(\S+)/m.exec(fm)?.[1] || '').toLowerCase(),
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

// ─── INC-028 — un subagente que la prosa nombra tiene que existir ───────────

/**
 * La prosa del harness: los `.md` de `.claude/` —menos `temp/`, que es estado de
 * sesión—, los de `docs/` y los dos puntos de entrada.
 */
function prosa() {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'temp' || e.name === 'node_modules') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.md')) out.push(full);
    }
  };
  walk(CLAUDE);
  walk(path.join(PROYECTO, 'docs'));
  for (const f of ['CLAUDE.md', 'AGENTS.md']) {
    if (fs.existsSync(path.join(PROYECTO, f))) out.push(path.join(PROYECTO, f));
  }
  return out.map((f) => ({ archivo: path.relative(PROYECTO, f), texto: fs.readFileSync(f, 'utf-8') }));
}

/**
 * Las líneas de un markdown, numeradas y sin el frontmatter: el `model:` de un
 * agente es el hecho, no una mención.
 */
function lineas(texto) {
  const ls = texto.split('\n');
  const desde = ls[0].trim() === '---'
    ? ls.findIndex((l, i) => i > 0 && l.trim() === '---') + 1
    : 0;
  return ls.map((l, i) => ({ n: i + 1, l })).slice(desde);
}

/**
 * Las menciones de un modelo que ningún subagente de esa misma línea declara.
 *
 * La prosa del payload no nombra modelos —`.claude/CLAUDE.md` dice «rápido» y
 * «razonador»—: un modelo sólo es un hecho en el `model:` de un frontmatter.
 * «`code-judge` (opus)» se sostiene; «ac-verifier (Haiku)» presenta como
 * componente con modelo propio algo que no está en ningún lado.
 */
function modelosSinRespaldo(texto) {
  const out = [];
  for (const { n, l } of lineas(texto)) {
    for (const m of l.matchAll(/\b(haiku|sonnet|opus)\b/gi)) {
      const respaldo = TODOS.some((a) => a.modelo === m[1].toLowerCase() && l.includes(a.nombre));
      if (!respaldo) out.push({ n, modelo: m[0], l: l.trim() });
    }
  }
  return out;
}

/** Los nombres que la prosa presenta como subagente: «el subagente `x`», «`x` (subagente)». */
function subagentesNombrados(texto) {
  return [...texto.matchAll(/\bsubagentes?\s+`([\w-]+)`|`([\w-]+)`\s*\(subagente\)/gi)]
    .map((m) => m[1] || m[2]);
}

describe('INC-028 — la prosa no inventa subagentes', () => {
  const PROSA = prosa();
  const NOMBRES = new Set(TODOS.map((a) => a.nombre));

  test('todo modelo que la prosa nombra lo declara un subagente de esa línea', () => {
    // El hallazgo: «AC verifier (Haiku) marca AC con evidencia» en la tabla de
    // fases del SDD, y «Verifier: ac-verifier (Haiku)» en el encabezado de cada
    // `acceptance.md`. No había subagente: `/spec-verify` lo corre el agente
    // principal. Lo que la prosa le atribuía a un verificador aparte —otro
    // modelo, otra ventana— no lo daba nada.
    const huerfanos = PROSA.flatMap(({ archivo, texto }) =>
      modelosSinRespaldo(texto).map(({ n, modelo, l }) => `${archivo}:${n} — ${modelo}: ${l}`));
    assert.deepEqual(huerfanos, [],
      'la prosa nombra un modelo que ningún subagente declara. Si es de un subagente real, ' +
      'nombralo en la misma línea; si no, describí el rol («rápido», «razonador»), no el modelo');
  });

  test('y el detector distingue la afirmación respaldada de la inventada', () => {
    // Sin el control positivo, un detector que marcara TODA mención de modelo
    // pasaría igual el test de arriba — hoy no hay ninguna.
    assert.equal(modelosSinRespaldo('| `code-judge` | Veredicto por criterio | opus |').length, 0);
    assert.equal(modelosSinRespaldo('| `code-judge` | Veredicto por criterio | haiku |').length, 1,
      'un subagente real con el modelo equivocado también es una afirmación falsa');
    assert.equal(modelosSinRespaldo('> **Verifier:** ac-verifier (Haiku) · validado por {{OWNER}}').length, 1);
  });

  test('todo subagente que la prosa nombra como tal existe', () => {
    const nombrados = PROSA.flatMap(({ archivo, texto }) =>
      subagentesNombrados(texto).map((nombre) => ({ archivo, nombre })));
    assert.ok(nombrados.length >= 2, `solo ${nombrados.length} menciones: ¿cambió la redacción?`);

    const fantasmas = nombrados.filter(({ nombre }) => !NOMBRES.has(nombre))
      .map(({ archivo, nombre }) => `${archivo} → ${nombre}`);
    assert.deepEqual([...new Set(fantasmas)], [],
      'la prosa delega en un subagente que no está en .claude/agents/');
  });

  test('y uno inventado no pasaría', () => {
    assert.deepEqual(
      subagentesNombrados('Delega la verificación en el subagente `ac-verifier`.')
        .filter((n) => !NOMBRES.has(n)),
      ['ac-verifier']);
  });
});
