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
  const RULES_DOC = path.join(PAYLOAD, 'docs', 'TECH-STACK-RULES.md');

  /** IDs de regla que los hooks y el linter emiten al usuario. */
  function emittedRuleIds() {
    const ids = new Set();
    const sources = [
      path.join(PAYLOAD, '.claude', 'hooks'),
      path.join(PAYLOAD, 'boilerplate', 'scripts'),
    ];
    for (const dir of sources) {
      if (!fs.existsSync(dir)) continue;
      for (const file of walk(dir)) {
        const txt = fs.readFileSync(file, 'utf-8');
        for (const m of txt.matchAll(/\[((?:ARCH|A11Y|LLM|SEC-RLS)-\d{2})\]/g)) ids.add(m[1]);
        for (const m of txt.matchAll(/'((?:ARCH|SEC-RLS)-\d{2})'/g)) ids.add(m[1]);
      }
    }
    return ids;
  }

  test('toda regla emitida tiene seccion documentada', () => {
    const ids = emittedRuleIds();
    assert.ok(ids.size > 0, 'no se detecto ningun ID de regla — revisa el regex');

    const anchors = anchorsOf(RULES_DOC);
    const undocumented = [...ids].filter(id => !anchors.has(id.toLowerCase())).sort();
    assert.deepEqual(
      undocumented, [],
      `reglas que el harness emite sin seccion en docs/TECH-STACK-RULES.md:\n  ${undocumented.join('\n  ')}\n` +
      `Cada mensaje de error incluye un "Doc:" que apunta ahi.`,
    );
  });

  test('las anclas de regla son explicitas, no slugs de titulo', () => {
    // Un slug derivado del titulo cambia si alguien reescribe el encabezado, y
    // el enlace se rompe en silencio. Las anclas <a id> sobreviven al retitulado.
    const txt = fs.readFileSync(RULES_DOC, 'utf-8');
    const explicit = new Set(
      [...txt.matchAll(/<a\s+(?:id|name)=["']([^"']+)["']/gi)].map(m => m[1].toLowerCase()),
    );
    const missing = [...emittedRuleIds()].filter(id => !explicit.has(id.toLowerCase())).sort();
    assert.deepEqual(missing, [], `reglas sin ancla explicita:\n  ${missing.join('\n  ')}`);
  });
});
