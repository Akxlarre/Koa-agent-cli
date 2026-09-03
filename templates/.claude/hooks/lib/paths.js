/**
 * lib/paths.js — Qué es cada archivo, según quién pregunta
 *
 * TRES PREGUNTAS DISTINTAS, NO UNA DUPLICACIÓN.
 *
 * La ficha H-03 anotó estas definiciones como «tres definiciones de lo mismo,
 * colapsar en una». Al mirarlas de cerca son tres preguntas legítimas y
 * diferentes, y colapsarlas rompería tres hooks:
 *
 *   isProductCode(rel)   ¿necesita una spec activa para tocarse?
 *   needsDiscovery(rel)  ¿exige haber leído los índices antes?
 *   belongsToIndex(rel)  ¿su creación obliga a actualizar un índice?
 *
 * Un `.spec.ts` bajo src/app/ es código de producto (necesita spec) pero NO va a
 * ningún índice. Una migración de Supabase exige descubrimiento pero tampoco va a
 * COMPONENTS.md. No son la misma pregunta.
 *
 * El defecto real es que estaban escritas TRES VECES, sin nombre y sin test — y
 * por eso divergieron. Medido antes de escribir esto: editar `src/guia.mdx`
 * pasa el spec-gate («no es producto») y aun así plan-injector le inyecta el
 * contrato SDD entero («sí es producto»), porque `.mdx` está en la lista de
 * exentos de uno y no en la del otro.
 *
 * Y ninguna de las dos listas funciona para los dotfiles: `path.extname('.npmrc')`
 * devuelve `''`, así que `.env`, `.npmrc`, `.gitignore` y `.editorconfig` figuran
 * como exentos en spec-gate y aun así lo bloquean (DEC-007). Acá se compara
 * también contra el basename.
 *
 * Este módulo les pone NOMBRE, no las colapsa. Ver docs/diseno/ADR-001 §3.
 */

const path = require('path');

/**
 * Prefijos que nunca son código de producto: herramienta, documentación,
 * artefactos de build. Unión de las dos listas que existían.
 */
const PREFIJOS_EXENTOS = [
  'specs/', '.claude/', 'docs/', 'indices/', 'scripts/', 'context/',
  'node_modules/', '.git/', 'dist/', 'build/', 'coverage/', '.angular/',
];

/**
 * Extensiones que nunca son código de producto. Se toma la lista de spec-gate,
 * que era la más larga: exentar de más significa intervenir de menos, y ese es
 * el lado seguro cuando dos guardrails discrepan.
 */
const EXTENSIONES_EXENTAS = new Set([
  '.md', '.mdx', '.json', '.yaml', '.yml', '.toml', '.lock',
  '.gitignore', '.npmrc', '.env', '.editorconfig', '.txt',
]);

/** Archivos de configuración sin extensión. */
const BASENAMES_EXENTOS = new Set(['Dockerfile', 'Makefile', 'LICENSE', 'README', 'Procfile']);

/** Raíces donde vive el código de producto. */
const RAICES_PRODUCTO = ['src/', 'app/', 'lib/', 'supabase/migrations/'];
const RAIZ_MONOREPO = /^packages\/[^/]+\/src\//;

/** Lo que un índice describe: la superficie Angular de la app. */
const RAIZ_INDEXABLE = 'src/app/';
const EXTENSIONES_INDEXABLES = new Set(['.ts', '.html', '.scss']);

/**
 * Normaliza a ruta relativa al proyecto, con separadores `/`.
 *
 * Los hooks usaban `.includes('src/app/')`, que da verdadero para
 * `docs/ejemplos/src/app/x.ts`. Acá se compara por PREFIJO sobre la ruta
 * relativa, que es la pregunta que se quería hacer.
 */
function rel(filePath, cwd = process.cwd()) {
  if (!filePath) return '';
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  const r = path.relative(cwd, abs).replace(/\\/g, '/');
  return r.startsWith('..') ? '' : r; // fuera del proyecto: no es nuestro
}

function esExento(r) {
  if (!r) return true;
  if (PREFIJOS_EXENTOS.some((p) => r.startsWith(p))) return true;

  const base = path.basename(r);
  if (BASENAMES_EXENTOS.has(base)) return true;

  // `path.extname('.npmrc')` devuelve '' — un dotfile sin más puntos no tiene
  // extensión para Node. Su nombre completo ES la extensión, así que se compara
  // también contra el basename. Lo encontró su propio test.
  if (base.startsWith('.') && EXTENSIONES_EXENTAS.has(base.toLowerCase())) return true;

  return EXTENSIONES_EXENTAS.has(path.extname(r).toLowerCase());
}

/**
 * ¿Necesita una spec activa para tocarse?
 * Lo preguntan `spec-gate` (para bloquear) y `plan-injector` (para inyectar).
 */
function isProductCode(filePath, cwd) {
  const r = rel(filePath, cwd);
  if (esExento(r)) return false;
  return RAICES_PRODUCTO.some((p) => r.startsWith(p)) || RAIZ_MONOREPO.test(r);
}

/**
 * ¿Exige haber leído los índices antes de escribir?
 * Lo pregunta el Discovery Gate de `pre-write-guard`.
 *
 * Más estrecho que `isProductCode`: un archivo suelto en `src/` no obliga a
 * descubrir nada; lo que sí obliga es tocar la app Angular o el esquema.
 */
function needsDiscovery(filePath, cwd) {
  const r = rel(filePath, cwd);
  if (!r || r.endsWith('.spec.ts')) return false;
  return r.startsWith(RAIZ_INDEXABLE) || r.startsWith('supabase/migrations/');
}

/**
 * ¿Su creación obliga a actualizar un índice?
 * Lo preguntan `write-tracker` (para registrar) y `sync-check` (para avisar).
 *
 * Más estrecho que las otras dos: solo la superficie que los índices describen.
 *
 * HUE-015: las migraciones estaban fuera, con este motivo escrito acá —«las
 * cubre DATABASE.md por otra vía»—. El motivo confundía dos cosas: QUIÉN genera
 * `DATABASE.md` (el auto-indexer, leyendo `supabase/migrations/`) con si la
 * escritura OBLIGA a actualizarlo, que es lo único que esta función pregunta.
 *
 * Medido: una sesión que escribe solo una migración no produce
 * `session-writes.json`, y entonces los tres consumidores quedan ciegos a la
 * vez — `sync-check` no avisa, `spec-diff-check` no bloquea, `spec-reflection`
 * cree que no pasó nada. Una sesión entera de esquema, invisible. Con un
 * componente en la misma sesión, `sync-check` sale en 2.
 *
 * `DATABASE.md` ES un índice, y una migración es exactamente lo que lo
 * desactualiza. Sin esto, el aviso de sincronizar depende de haber tocado
 * además algo de `src/app/`.
 */
function belongsToIndex(filePath, cwd) {
  const r = rel(filePath, cwd);
  if (!r || r.endsWith('.spec.ts')) return false;
  if (r.startsWith('supabase/migrations/')) return path.extname(r).toLowerCase() === '.sql';
  if (!r.startsWith(RAIZ_INDEXABLE)) return false;
  return EXTENSIONES_INDEXABLES.has(path.extname(r).toLowerCase());
}

/** Las tres respuestas de una vez, para el hook que necesita más de una. */
function classify(filePath, cwd) {
  const r = rel(filePath, cwd);
  return {
    rel: r,
    isProductCode: isProductCode(filePath, cwd),
    needsDiscovery: needsDiscovery(filePath, cwd),
    belongsToIndex: belongsToIndex(filePath, cwd),
  };
}

module.exports = {
  rel,
  isProductCode,
  needsDiscovery,
  belongsToIndex,
  classify,
  PREFIJOS_EXENTOS,
  EXTENSIONES_EXENTAS,
  BASENAMES_EXENTOS,
  RAICES_PRODUCTO,
};
