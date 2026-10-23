#!/usr/bin/env node
/**
 * hook-wiring.test.js — ¿el sistema EJECUTA lo que estos tests prueban? (HUE-025)
 *
 * El hallazgo decía que «la cobertura mide que la lógica sea correcta, casi
 * nunca que el sistema la ejecute ni que alguien intente evadirla». Medido
 * sobre la suite antes de escribir esto, es cierto a medias y conviene separar
 * los dos ejes, porque están en estados muy distintos:
 *
 *   EVASIÓN    79 asserts de bloqueo (exit 2) contra 68 de paso (exit 0).
 *              La suite sí pone al hook delante de lo que debe frenar; es lo
 *              que más ejercita. Ese eje está mejor de lo que el hallazgo dice.
 *
 *   EJECUCIÓN  cero mecanismos. Nada comprueba que un hook con 40 tests en
 *              verde esté efectivamente cableado en `settings.json`. Borrás su
 *              entrada y la suite entera sigue verde mientras el hook deja de
 *              correr.
 *
 * Ese segundo es exactamente `ARCH-26` —detector escrito, tests en verde, cero
 * llamadores— que este repositorio ya aprendió del lado del linter cuando
 * escribió `rule-wiring.js`, y nunca aplicó a los hooks. Un guardrail
 * descableado es peor que ausente: el ausente se nota.
 *
 * Este archivo cubre el eje de ejecución en sus tres direcciones. La verdad se
 * DERIVA del filesystem y de `settings.json`; no hay lista que mantener salvo
 * la de los opt-in declarados, que sólo puede achicarse.
 *
 * Y una cuarta, que no mira si el hook corre sino lo que se AFIRMA de él
 * (INC-028): la prosa del harness no puede describir un hook que no existe.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CLAUDE = path.resolve(__dirname, '..');
const PROYECTO = path.resolve(CLAUDE, '..');
const HOOKS = path.join(CLAUDE, 'hooks');
const SETTINGS = path.join(CLAUDE, 'settings.json');

/**
 * Hooks que existen a propósito sin estar cableados.
 *
 * `context-enrichment-guard.js` es el Day 0 Context Guard: bloquea escribir
 * código mientras `context/domain.md` e `indices/DATABASE.md` sigan vacíos.
 * `.claude/CLAUDE.md` lo documenta como **opt-in** — se activa cuando el
 * dominio lo amerita. Está acá para que la excepción sea una decisión escrita y
 * no un descuido que se lee igual.
 */
const OPT_IN = ['context-enrichment-guard.js'];

const settings = fs.readFileSync(SETTINGS, 'utf-8');

/** Los hooks de primer nivel: los que `settings.json` debería nombrar. */
function hooksEnDisco() {
  return fs.readdirSync(HOOKS)
    .filter((f) => f.endsWith('.js'))
    .sort();
}

/** Toda ruta `.js` bajo `hooks/` que `settings.json` menciona. */
function rutasEnSettings() {
  return [...new Set(
    [...settings.matchAll(/[\w./$-]*hooks\/[\w./-]+\.js/g)].map((m) => m[0]),
  )];
}

/** De una ruta de `settings.json` a la ruta real en disco. */
function aDisco(ruta) {
  return path.join(CLAUDE, ruta.replace(/^.*?\.claude\//, ''));
}

describe('HUE-025 — que el sistema EJECUTE lo que la suite prueba', () => {
  test('hay hooks y hay settings.json que mirar', () => {
    // Sin esto, un `hooks/` que no se encuentra haría pasar todo lo de abajo
    // por vacuidad — el modo de fallar que este archivo persigue, cometido acá.
    assert.ok(hooksEnDisco().length >= 10, `solo ${hooksEnDisco().length} hooks`);
    assert.ok(rutasEnSettings().length >= 10, 'settings.json no nombra hooks');
  });

  test('todo hook en disco está cableado, o declarado opt-in', () => {
    // La dirección que importa: un hook con sus tests en verde que nadie
    // ejecuta. Es ARCH-26 aplicado al harness en vez de al linter.
    const sueltos = hooksEnDisco()
      .filter((h) => !settings.includes(h))
      .filter((h) => !OPT_IN.includes(h));
    assert.deepEqual(sueltos, [],
      'estos hooks existen, tienen tests, y el sistema no los corre nunca');
  });

  test('todo lo que settings.json nombra existe en disco', () => {
    // La dirección contraria, y falla distinto: un hook renombrado deja una
    // entrada muerta. Claude Code intenta ejecutar un archivo que no está.
    const muertas = rutasEnSettings().filter((r) => !fs.existsSync(aDisco(r)));
    assert.deepEqual(muertas, []);
  });

  test('lo declarado opt-in existe de verdad', () => {
    // Un opt-in que ya no está deja la excusa viva sin nada que excusar. La
    // lista sólo puede achicarse.
    const fantasmas = OPT_IN.filter((h) => !fs.existsSync(path.join(HOOKS, h)));
    assert.deepEqual(fantasmas, []);
  });

  test('y sigue siendo la excepción: como mucho un hook sin cablear', () => {
    // El número es el trinquete. Si mañana hay tres «opt-in», el patrón dejó de
    // ser una decisión y pasó a ser el lugar donde se guarda lo que no corre.
    assert.ok(OPT_IN.length <= 1, `${OPT_IN.length} hooks sin cablear`);
  });
});

describe('HUE-025 — los validadores que se cablean desde un frontmatter', () => {
  // `validate-file-contains.js` no vive en settings.json: lo invocan skills y
  // comandos desde su propio frontmatter (`/plan`, `/spec-new`, `/fix-new`).
  // Ahí el modo de fallar es otro y más callado: un typo en la ruta no rompe
  // nada visible — el comando simplemente deja de tener guardrail.
  const SUPERFICIES = [path.join(CLAUDE, 'commands'), path.join(CLAUDE, 'skills')];

  function referencias() {
    const out = [];
    const walk = (p) => {
      if (!fs.existsSync(p)) return;
      for (const e of fs.readdirSync(p, { withFileTypes: true })) {
        const full = path.join(p, e.name);
        if (e.isDirectory()) walk(full);
        else if (full.endsWith('.md')) {
          const txt = fs.readFileSync(full, 'utf-8');
          for (const m of txt.matchAll(/hooks\/validators\/[\w.-]+\.js/g)) {
            out.push({ desde: path.relative(CLAUDE, full), ruta: m[0] });
          }
        }
      }
    };
    SUPERFICIES.forEach(walk);
    return out;
  }

  const REFS = referencias();

  test('hay validadores cableados desde frontmatter', () => {
    assert.ok(REFS.length >= 3,
      `solo ${REFS.length} referencias; /plan, /spec-new y /fix-new deberían estar`);
  });

  for (const { desde, ruta } of REFS) {
    test(`${desde} apunta a un validador que existe`, () => {
      assert.ok(fs.existsSync(path.join(CLAUDE, ruta)),
        `${ruta} no está en disco: ese comando quedó sin guardrail y nada lo dice`);
    });
  }

  test('el validador referenciado es ejecutable como script', () => {
    // Que el archivo exista no basta: si no parsea, el hook falla en cada Stop.
    const { spawnSync } = require('child_process');
    for (const ruta of [...new Set(REFS.map((r) => r.ruta))]) {
      const r = spawnSync(process.execPath, ['--check', path.join(CLAUDE, ruta)],
        { encoding: 'utf8' });
      assert.equal(r.status, 0, `${ruta} no parsea:\n${r.stderr}`);
    }
  });
});

// ─── INC-028 — lo que la prosa dice que corre ───────────────────────────────

/**
 * La prosa del harness: lo que el agente lee y le cree.
 *
 * Los `.md` de `.claude/` —menos `temp/`, que es estado de sesión—, los de
 * `docs/` y los dos puntos de entrada. Los `.js` no: el comentario de
 * `sync-check.js` dice que «reemplaza el Stop prompt hook anterior», y eso es
 * historia, no una promesa.
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

/** Las líneas de un markdown, numeradas y sin el frontmatter: eso es cableado, no prosa. */
function lineas(texto) {
  const ls = texto.split('\n');
  const desde = ls[0].trim() === '---'
    ? ls.findIndex((l, i) => i > 0 && l.trim() === '---') + 1
    : 0;
  return ls.map((l, i) => ({ n: i + 1, l })).slice(desde);
}

/**
 * Las formas en que un texto describe un hook que evalúa un modelo.
 *
 * `prompt` y `agent` son los dos tipos de hook que le pasan la decisión a un
 * modelo en vez de correr un comando, y los dos responden `{ "ok": true }` o
 * `{ "ok": false, "reason": … }`: citar esa respuesta también es describir uno.
 */
const HOOK_DE_MODELO = [
  /\b(?:prompt|agent)(?:[ -]based)?[ -]hooks?\b/i,
  /\bhooks? (?:de tipo |basados? en |de )`?(?:prompt|agent)\b/i,
  /\*\*Tipo\*\*:\s*`(?:prompt|agent)`/i,
  /\btype:\s*["']?(?:prompt|agent)\b/i,
  /`\{\s*"?ok"?\s*:\s*(?:true|false)\b[^`]*`/i,
];

/** Las líneas de `texto` que describen un hook de prompt o de agente. */
function hooksDeModeloDescritos(texto) {
  return lineas(texto).filter(({ l }) => HOOK_DE_MODELO.some((re) => re.test(l)));
}

const CONFIG = JSON.parse(settings);

/**
 * Las filas de toda tabla `| Hook | Evento | …`: lo que un doc afirma que corre,
 * y cuándo. Se corta en `|` sin escapar — `Edit\|Write` es una sola celda.
 */
function filasDeHooks(texto) {
  const ls = texto.split('\n');
  const filas = [];
  ls.forEach((l, i) => {
    if (!/^\|\s*Hook\s*\|\s*Evento\s*\|/.test(l)) return;
    for (let j = i + 2; j < ls.length && ls[j].startsWith('|'); j++) {
      const [hook = '', evento = ''] = ls[j].split(/(?<!\\)\|/).slice(1).map((c) => c.trim());
      filas.push({ n: j + 1, hook, evento });
    }
  });
  return filas;
}

/**
 * La fila nombra un evento, y lo que nombra como hook no es un archivo que
 * `settings.json` corra en ese evento.
 *
 * Un evento `—` es la forma en que la doc dice «esto no es un hook»
 * (`lib/guard-rules.js`) o «no viene cableado» (los opt-in): no afirma que nada
 * corra, y no se juzga.
 */
function sinCablear({ hook, evento }) {
  const ev = /^[A-Z]\w+/.exec(evento)?.[0];
  if (!ev) return false;
  const archivo = /[\w./-]+\.js\b/.exec(hook)?.[0];
  if (!archivo) return true;
  const comandos = (CONFIG.hooks?.[ev] || []).flatMap((g) => (g.hooks || []).map((h) => h.command || ''));
  return !comandos.some((c) => c.includes(archivo));
}

describe('INC-028 — la prosa no describe hooks que el sistema no corre', () => {
  // Las tres direcciones de arriba miran el disco y `settings.json`. Faltaba la
  // que mira la PROSA. `sdd/SKILL.md` tenía una fila «AC verifier | Stop (prompt
  // hook) | Definido inline en `.claude/settings.json`», y dos plantillas del SDD
  // contaban con él. No había hook de tipo prompt, ni subagente, ni archivo: un
  // agente en un proyecto generado le confiaba el cierre de su spec a un
  // verificador que no existe.
  //
  // Es peor que un hook descableado, que por lo menos está en disco: a este no
  // había dónde ir a buscarlo.
  const PROSA = prosa();

  test('hay prosa que mirar', () => {
    // Sin esto, un `docs/` que no se encuentra deja todo lo de abajo en verde
    // sin haber leído nada.
    assert.ok(PROSA.length >= 20, `solo ${PROSA.length} archivos de prosa`);
    assert.ok(PROSA.some((p) => p.archivo.endsWith('HOOKS-SYSTEM.md')), 'no se encontró docs/HOOKS-SYSTEM.md');
  });

  test('ninguna describe un hook de prompt o de agente si no hay uno cableado', () => {
    // `settings.test.js` exige hoy que todo hook sea `command`, así que no puede
    // haber ninguno. El chequeo es grueso a propósito: el día que se cablee uno,
    // describirlo pasa a ser legítimo y esto deja de distinguir. Afinarlo es
    // parte de esa decisión, que no se toma sin tocar `settings.test.js`.
    const tipos = new Set(Object.values(CONFIG.hooks || {})
      .flatMap((grupos) => (grupos || []).flatMap((g) => (g.hooks || []).map((h) => h.type))));
    for (const { texto } of PROSA) {
      // Los `hooks:` de un frontmatter también cablean (`/plan`, `/spec-new`).
      const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(texto)?.[1] || '';
      if (/^hooks:/m.test(fm)) for (const m of fm.matchAll(/\btype:\s*["']?(\w+)/g)) tipos.add(m[1]);
    }
    if (tipos.has('prompt') || tipos.has('agent')) return;

    const descritos = PROSA.flatMap(({ archivo, texto }) =>
      hooksDeModeloDescritos(texto).map(({ n, l }) => `${archivo}:${n} — ${l.trim()}`));
    assert.deepEqual(descritos, [],
      'la prosa describe un hook que evalúa un modelo y no hay ninguno cableado. Si es historia ' +
      '(«antes era un prompt hook»), va en el CHANGELOG o en el comentario del hook: la prosa del ' +
      'payload describe lo que corre hoy');
  });

  test('y las cuatro formas que tenía el hallazgo no pasarían', () => {
    // Literales. Si el detector deja de ver alguna, el test de arriba pasa en
    // verde sin estar mirando.
    for (const l of [
      '| AC verifier | Stop (prompt hook) | Definido inline en `.claude/settings.json` |',
      '  - **DoD:** AC Verifier devuelve `{ok: true}` o tickets restantes resueltos',
      '### 6. Sync Check (prompt hook)',
      '- **Tipo**: `prompt` (evaluado por modelo Haiku)',
    ]) {
      assert.equal(hooksDeModeloDescritos(l).length, 1, l);
    }
  });

  test('toda fila de una tabla `| Hook | Evento |` es un archivo cableado en ese evento', () => {
    // La dirección literal del hallazgo: el texto nombra un hook y lo ubica en un
    // evento. Las dos cosas se pueden contrastar con `settings.json`.
    const filas = PROSA.flatMap(({ archivo, texto }) =>
      filasDeHooks(texto).map((f) => ({ archivo, ...f })));
    assert.ok(filas.filter((f) => /^[A-Z]/.test(f.evento)).length >= 5,
      `solo ${filas.length} filas en tablas de hooks: ¿cambió el encabezado?`);

    const fantasmas = filas.filter(sinCablear)
      .map((f) => `${f.archivo}:${f.n} — ${f.hook} | ${f.evento}`);
    assert.deepEqual(fantasmas, [],
      'la tabla describe un hook que el sistema no corre en ese evento');
  });

  test('y una fila sin archivo, o en el evento equivocado, no pasaría', () => {
    // Los dos modos de fallar: la fila del hallazgo, y la de `INC-007` (el
    // auto-cierre del hotfix vivió en Stop y es de SessionEnd).
    const tabla = [
      '| Hook | Evento | Función |',
      '|------|--------|---------|',
      '| AC verifier | Stop (prompt hook) | Definido inline en `.claude/settings.json` |',
      '| `hotfix-autoclose.js` | Stop | Cierra el hotfix abierto |',
      '| `hotfix-autoclose.js` | SessionEnd | Cierra el hotfix abierto |',
    ].join('\n');
    assert.deepEqual(filasDeHooks(tabla).filter(sinCablear).map((f) => f.n), [3, 4]);
  });
});
