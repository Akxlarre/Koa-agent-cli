#!/usr/bin/env node
/**
 * doc-links.test.js — Contrato de referencias internas del harness
 *
 * Los mensajes de error del linter y de los hooks terminan en una linea
 * `Doc: docs/TECH-STACK-RULES.md#arch-07`. Si esa ancla no existe, el agente
 * (o la persona) recibe una instruccion que no lleva a ninguna parte, y nada
 * lo avisa: un enlace roto no rompe ningun build.
 *
 * Este archivo recorre TODO el payload buscando referencias a documentos y
 * anclas internas, y verifica que cada una resuelva. Existe porque dos anclas
 * se rompieron al agregar reglas nuevas sin actualizar el doc al que apuntan.
 *
 * Tambien verifica lo inverso: que toda regla que el harness EMITE este
 * documentada. Un `[ARCH-13]` en un mensaje de error sin seccion propia manda
 * al agente a buscar algo que no existe.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// tests/ → .claude/ → templates/
const PAYLOAD = path.resolve(__dirname, '..', '..');

/** Recorre el payload devolviendo rutas de archivos de texto. */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(md|js|json)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const FILES = walk(PAYLOAD);

/**
 * Los directorios donde vive el codigo que EMITE reglas.
 *
 * Este archivo corre en dos contextos: en el repo del CLI, donde los scripts
 * viven bajo `boilerplate/scripts/`, y dentro de un proyecto generado, donde
 * viven en `scripts/`. Mirar solo el primero hacia que en un proyecto generado
 * las reglas de `architect.js` parecieran no emitidas por nadie — lo cazo correr
 * la suite en el layout de un proyecto real, que es para lo que se corre ahi.
 */
function dirsDeCodigo() {
  return [
    path.join(PAYLOAD, '.claude', 'hooks'),
    path.join(PAYLOAD, 'boilerplate', 'scripts'),
    path.join(PAYLOAD, 'scripts'),
  ].filter((d) => fs.existsSync(d));
}

/**
 * Anclas disponibles en un markdown: las explicitas `<a id="...">` y los slugs
 * que GitHub deriva de los encabezados.
 */
function anchorsOf(filePath) {
  const txt = fs.readFileSync(filePath, 'utf-8');
  const out = new Set();

  for (const m of txt.matchAll(/<a\s+(?:id|name)=["']([^"']+)["']/gi)) {
    out.add(m[1].toLowerCase());
  }
  for (const line of txt.split('\n')) {
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (!h) continue;
    const slug = h[1]
      .trim()
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[`*_[\]()]/g, '')
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (slug) out.add(slug);
  }
  return out;
}

/** Todas las referencias `ruta.md#ancla` que aparecen en el payload. */
function collectRefs() {
  const refs = [];
  const re = /((?:docs|indices|context|\.claude\/rules|\.claude\/agents|\.claude\/skills)\/[\w./-]+\.md)#([\w-]+)/g;
  for (const file of FILES) {
    const txt = fs.readFileSync(file, 'utf-8');
    for (const m of txt.matchAll(re)) {
      refs.push({ from: path.relative(PAYLOAD, file), target: m[1], anchor: m[2].toLowerCase() });
    }
  }
  return refs;
}

describe('DOC LINKS — anclas referenciadas', () => {
  const refs = collectRefs();

  test('hay referencias que verificar', () => {
    assert.ok(refs.length > 0, 'el barrido no encontro ninguna referencia — revisa el regex');
  });

  test('el archivo destino existe', () => {
    const missing = [];
    for (const r of refs) {
      if (!fs.existsSync(path.join(PAYLOAD, r.target))) missing.push(`${r.from} → ${r.target}`);
    }
    assert.deepEqual(missing, [], `documentos referenciados que no existen:\n  ${missing.join('\n  ')}`);
  });

  test('la ancla existe en el destino', () => {
    const broken = [];
    const cache = new Map();
    for (const r of refs) {
      const full = path.join(PAYLOAD, r.target);
      if (!fs.existsSync(full)) continue; // ya lo cubre el test anterior
      if (!cache.has(full)) cache.set(full, anchorsOf(full));
      if (!cache.get(full).has(r.anchor)) broken.push(`${r.from} → ${r.target}#${r.anchor}`);
    }
    assert.deepEqual(broken, [], `anclas rotas:\n  ${broken.join('\n  ')}`);
  });
});

describe('DOC LINKS — reglas emitidas vs documentadas', () => {
  // Fallback para reglas emitidas sin un campo `doc:` propio detectable (p.ej.
  // pre-write-guard.js, que hardcodea el mensaje sin pasar por un registro RULES).
  const DEFAULT_RULES_DOC = 'docs/TECH-STACK-RULES.md';

  /**
   * IDs de regla que los hooks y el linter emiten al usuario, junto con el
   * archivo de documentacion que le corresponde a CADA UNA. No todas viven en
   * el mismo doc: architect.js declara `doc:` por regla (algunas apuntan a
   * `.claude/rules/visual-system.md`, otras a `docs/TECH-STACK-RULES.md`), y
   * eso es intencional — cada regla se documenta cerca de su dominio, no todas
   * apiladas en un archivo generico.
   */
  function emittedRuleIds() {
    const ids = new Map(); // ID -> { file, anchor }
    for (const dir of dirsDeCodigo()) {
      for (const file of walk(dir)) {
        const txt = fs.readFileSync(file, 'utf-8');

        // Registro RULES = { 'ARCH-NN': { doc: 'ruta.md#ancla', ... } }: el
        // `doc:` de cada entrada manda sobre el fallback. Si trae `#ancla`
        // explicita se respeta tal cual (puede no coincidir con el ID, p.ej.
        // SEC-RLS-01 documentado bajo `#ap-012`); si no, el ancla esperada es
        // el propio ID en minuscula.
        for (const m of txt.matchAll(
          /'((?:ARCH|A11Y|LLM|SEC-RLS|NAV|ICON)-\d{2})':\s*\{[^}]*?doc:\s*'([^']+)'/gs,
        )) {
          const [, id, docRef] = m;
          const [file, anchor] = docRef.split('#');
          ids.set(id, { file, anchor: (anchor ?? id).toLowerCase() });
        }

        // IDs emitidos en mensajes de error que no vinieron de un registro
        // RULES (p.ej. pre-write-guard.js) — solo se agregan si todavia no
        // tienen un doc asignado, para no pisar el que sí declaró su target.
        for (const m of txt.matchAll(/\[((?:ARCH|A11Y|LLM|SEC-RLS)-\d{2})\]/g)) {
          if (!ids.has(m[1])) ids.set(m[1], { file: DEFAULT_RULES_DOC, anchor: m[1].toLowerCase() });
        }
        for (const m of txt.matchAll(/'((?:ARCH|SEC-RLS)-\d{2})'/g)) {
          if (!ids.has(m[1])) ids.set(m[1], { file: DEFAULT_RULES_DOC, anchor: m[1].toLowerCase() });
        }
      }
    }
    return ids;
  }

  test('toda regla emitida tiene seccion documentada', () => {
    const ids = emittedRuleIds();
    assert.ok(ids.size > 0, 'no se detecto ningun ID de regla — revisa el regex');

    const cache = new Map();
    const undocumented = [];
    for (const [id, { file, anchor }] of ids) {
      const full = path.join(PAYLOAD, file);
      if (!cache.has(full)) cache.set(full, fs.existsSync(full) ? anchorsOf(full) : new Set());
      if (!cache.get(full).has(anchor)) undocumented.push(`${id} (${file}#${anchor})`);
    }
    assert.deepEqual(
      undocumented.sort(), [],
      `reglas que el harness emite sin seccion en su doc declarado:\n  ${undocumented.join('\n  ')}\n` +
      `Cada mensaje de error incluye un "Doc:" que apunta ahi.`,
    );
  });

  test('las anclas de regla son explicitas, no slugs de titulo', () => {
    // Un slug derivado del titulo cambia si alguien reescribe el encabezado, y
    // el enlace se rompe en silencio. Las anclas <a id> sobreviven al retitulado.
    const ids = emittedRuleIds();
    const cache = new Map();
    const missing = [];
    for (const [id, { file, anchor }] of ids) {
      const full = path.join(PAYLOAD, file);
      if (!cache.has(full)) {
        const txt = fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : '';
        cache.set(full, new Set(
          [...txt.matchAll(/<a\s+(?:id|name)=["']([^"']+)["']/gi)].map(m => m[1].toLowerCase()),
        ));
      }
      if (!cache.get(full).has(anchor)) missing.push(`${id} (${file}#${anchor})`);
    }
    assert.deepEqual(missing.sort(), [], `reglas sin ancla explicita:\n  ${missing.join('\n  ')}`);
  });

  // ── HUE-026 — la direccion inversa, que es la que nadie miraba ─────────────
  //
  // Los dos tests de arriba preguntan «regla emitida → esta documentada?». La
  // pregunta que faltaba es «regla documentada → la emite alguien?», y su
  // ausencia es la razon exacta por la que ARCH-14 vivio meses como fantasma:
  // citada en verify/SKILL.md, con seccion propia en la doc, y sin un solo
  // detector detras.
  //
  // Una regla documentada que nadie emite es peor que una sin documentar: el
  // agente lee que existe un guardrail, confia en el, y no hay nadie del otro
  // lado.

  /** Los IDs con seccion propia en los docs del payload. */
  function documentedRuleIds() {
    const docs = new Map(); // ID -> archivo donde se documenta
    for (const file of FILES) {
      const rel = path.relative(PAYLOAD, file);
      if (!rel.startsWith('docs/')) continue;
      const txt = fs.readFileSync(file, 'utf-8');
      for (const m of txt.matchAll(/^#{2,4}\s+((?:ARCH|A11Y|LLM|SEC-RLS|SEC-ENV|SQL|NAV|ICON)-\d{2}):/gm)) {
        if (!docs.has(m[1])) docs.set(m[1], rel);
      }
    }
    return docs;
  }

  /**
   * Los IDs que alguien EMITE de verdad, mirando el codigo y no la doc.
   * Se busca la forma en que un mensaje o un registro nombra una regla; una
   * mencion en un comentario no cuenta como emitir.
   */
  function reallyEmittedIds() {
    const emitidos = new Set();
    const sinComentarios = (src) => src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

    for (const dir of dirsDeCodigo()) {
      for (const file of walk(dir)) {
        if (!file.endsWith('.js') && !file.endsWith('.mjs')) continue;
        const txt = sinComentarios(fs.readFileSync(file, 'utf-8'));
        for (const m of txt.matchAll(/\[((?:ARCH|A11Y|LLM|SEC-RLS|SEC-ENV|SQL|NAV|ICON)-\d{2})\]/g)) {
          emitidos.add(m[1]);
        }
        for (const m of txt.matchAll(/'((?:ARCH|A11Y|LLM|SEC-RLS|SEC-ENV|SQL|NAV|ICON)-\d{2})'/g)) {
          emitidos.add(m[1]);
        }
      }
    }
    return emitidos;
  }

  test('toda regla documentada la emite alguien', () => {
    const documentadas = documentedRuleIds();
    const emitidas = reallyEmittedIds();

    assert.ok(documentadas.size > 10, `solo ${documentadas.size} reglas documentadas — revisa el regex`);
    assert.ok(emitidas.size > 10, `solo ${emitidas.size} reglas emitidas — revisa el regex`);

    const fantasmas = [...documentadas.entries()]
      .filter(([id]) => !emitidas.has(id))
      .map(([id, archivo]) => `${id} (documentada en ${archivo})`);

    assert.deepEqual(fantasmas.sort(), [],
      `reglas documentadas que no emite nadie:\n  ${fantasmas.join('\n  ')}\n` +
      'El agente lee que existe el guardrail y no hay nadie del otro lado.');
  });

  test('y ninguna pieza del harness cita una regla que no existe', () => {
    // ARCH-14 no solo estaba documentada sin detector: verify/SKILL.md la citaba
    // como si fuera el mecanismo que atrapa los iconos sin registrar. El que los
    // atrapa es ICON-01.
    const conocidas = new Set([...documentedRuleIds().keys(), ...reallyEmittedIds()]);
    const citas = [];
    for (const file of FILES) {
      const rel = path.relative(PAYLOAD, file);
      if (!rel.endsWith('.md')) continue;
      const txt = fs.readFileSync(file, 'utf-8');
      for (const m of txt.matchAll(/\b((?:ARCH|A11Y|LLM|SEC-RLS|SEC-ENV|SQL|NAV|ICON)-\d{2})\b/g)) {
        if (!conocidas.has(m[1])) citas.push(`${m[1]} citada en ${rel}`);
      }
    }
    assert.deepEqual([...new Set(citas)].sort(), [],
      'una regla citada y no existente manda al agente a buscar algo que no esta');
  });

  test('y ningun doc miente sobre CUANTAS reglas valida el linter (INC-019)', () => {
    // `CLAUDE-USER-GUIDE.md` decia 8 y eran 28. No es un typo: describe un
    // linter con menos de un tercio de las reglas que tiene, y el usuario que
    // lee eso no corre `lint:arch` esperando que le encuentre algo.
    //
    // La cifra se deriva de RULES, que es la fuente. Cualquier frase del payload
    // que afirme un numero de reglas del linter tiene que coincidir con ella.
    const architect = dirsDeCodigo()
      .map((d) => path.join(d, 'architect.js'))
      .find((p) => fs.existsSync(p));
    assert.ok(architect, 'no se encontro architect.js');

    const reales = new Set(
      [...fs.readFileSync(architect, 'utf-8')
        .matchAll(/^\s{4}'((?:ARCH|A11Y|LLM|SEC-RLS|NAV|ICON)-\d{2})':\s*\{/gm)]
        .map((m) => m[1]),
    );
    assert.ok(reales.size >= 20, `solo ${reales.size} reglas detectadas en RULES — revisa el regex`);

    const mentiras = [];
    for (const file of FILES) {
      const rel = path.relative(PAYLOAD, file);
      if (!rel.endsWith('.md')) continue;
      const txt = fs.readFileSync(file, 'utf-8');
      for (const m of txt.matchAll(/\*{0,2}(\d{1,3})\*{0,2}\s+reglas?\b/gi)) {
        // Solo las frases que hablan del LINTER. `.claude/rules/` tiene su
        // propio conteo (16 reglas path-scoped) y no es esta cifra.
        const ventana = txt.slice(Math.max(0, m.index - 120), m.index + 40).toLowerCase();
        if (!/linter|lint:arch|architect/.test(ventana)) continue;
        if (Number(m[1]) !== reales.size) {
          mentiras.push(`${rel}: dice ${m[1]}, son ${reales.size}`);
        }
      }
    }
    assert.deepEqual(mentiras, [],
      'un doc afirma un numero de reglas del linter que no es el que tiene');
  });
});
