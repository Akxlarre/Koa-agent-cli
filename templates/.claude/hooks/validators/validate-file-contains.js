#!/usr/bin/env node
/**
 * validate-file-contains.js — Validador genérico parametrizado
 *
 * A diferencia del resto de los hooks de Koa, este no sabe nada del proyecto:
 * recibe qué buscar por flags y sirve para cualquier artefacto cuya ESTRUCTURA
 * importe. Un validador, muchos usos.
 *
 * Existe porque pedirle a un agente en prosa que "genera un archivo con estas
 * secciones" es una guideline, y las guidelines se ignoran. Esto la convierte en
 * guardrail: si la sección falta, el agente no termina.
 *
 * Uso (como hook de Stop, normalmente desde el frontmatter de una skill):
 *
 *   node .claude/hooks/validators/validate-file-contains.js \
 *     --directory .claude/temp \
 *     --pattern "task-spec-*.md" \
 *     --contains "## Objetivo" \
 *     --contains "## Criterio de done" \
 *     --max-age 30
 *
 * Flags:
 *   --directory <dir>   Dónde buscar (relativo al cwd del proyecto). Requerido.
 *   --pattern <glob>    Glob simple sobre el nombre: solo `*` y `?`. Default: "*.md"
 *   --contains <str>    Substring requerido. Repetible.
 *   --max-age <min>     Solo considerar archivos modificados en los últimos N
 *                       minutos. Default: 0 (sin límite de edad).
 *   --require-file      Fallar si no existe ningún archivo que coincida.
 *                       Por defecto, sin archivos = nada que validar (exit 0).
 *
 * Exit codes:
 *   0 = validación superada, o nada que validar
 *   2 = falta contenido: stderr explica exactamente qué agregar
 */

const fs = require('fs');
const path = require('path');

// ─── Parseo de argumentos ────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = { directory: null, pattern: '*.md', contains: [], maxAge: 0, requireFile: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--directory' || a === '-d') opts.directory = argv[++i];
    else if (a === '--pattern' || a === '-p') opts.pattern = argv[++i];
    else if (a === '--contains' || a === '-c') opts.contains.push(argv[++i]);
    else if (a === '--max-age') opts.maxAge = Number(argv[++i]) || 0;
    else if (a === '--require-file') opts.requireFile = true;
  }
  return opts;
}

/** Convierte un glob simple (solo `*` y `?`) en RegExp anclado. */
function globToRegExp(glob) {
  const escaped = String(glob).replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
}

const opts = parseArgs(process.argv.slice(2));

// Mal configurado = no validar. Un validador roto no debe frenar al agente.
if (!opts.directory || opts.contains.length === 0) process.exit(0);

const dir = path.resolve(process.cwd(), opts.directory);
if (!fs.existsSync(dir)) {
  if (opts.requireFile) {
    process.stderr.write(
      `\u{1F4CB} VALIDACION: no existe el directorio ${opts.directory}/.\n` +
      `Se esperaba un archivo ${opts.pattern} ahi.`
    );
    process.exit(2);
  }
  process.exit(0);
}

// ─── Elegir el archivo objetivo: el más reciente que coincida ────────────────
const re = globToRegExp(opts.pattern);
let candidates = [];
try {
  candidates = fs.readdirSync(dir)
    .filter(f => re.test(f))
    .map(f => {
      const full = path.join(dir, f);
      try { return { name: f, full, mtime: fs.statSync(full).mtimeMs }; } catch { return null; }
    })
    .filter(Boolean);
} catch {
  process.exit(0); // fail-open
}

// INC-002: «no existe ninguno» y «existe pero es viejo» NO son la misma
// situacion y no piden la misma accion. El filtro de edad vaciaba la lista y el
// unico mensaje decia «Crealo antes de terminar», asi que en cualquier sesion de
// mas de una hora sin tocar el spec, el agente recibia la orden de crear un spec
// QUE YA EXISTE. Si obedece, el duplicado pasa a ser «el mas reciente por orden
// alfabetico» para los otros cuatro consumidores del contrato, y el original
// queda huerfano.
//
// Ahora se guarda la lista completa antes de filtrar por edad. Lo que la edad
// cambia es el CONSEJO, no si hay archivo que validar: la estructura del spec se
// verifica igual, porque un spec roto es un problema con o sin edad.
const todos = candidates.slice();
if (opts.maxAge > 0) {
  const cutoff = Date.now() - opts.maxAge * 60000;
  candidates = candidates.filter(c => c.mtime >= cutoff);
}

// Solo se cae al archivo viejo cuando el llamador EXIGE que haya uno. Sin
// `--require-file`, «fuera de ventana» sigue significando «nada que validar»,
// que es lo que `--max-age` promete por si solo: es el llamador el que decide
// si la ausencia importa.
const porEdad = candidates.length === 0 && todos.length > 0 && opts.requireFile;

if (todos.length === 0) {
  if (opts.requireFile) {
    process.stderr.write(
      `\u{1F4CB} VALIDACION: no se encontro ningun archivo ${opts.pattern} en ${opts.directory}/.\n` +
      `Crealo antes de terminar.`
    );
    process.exit(2);
  }
  process.exit(0);
}

if (candidates.length === 0 && !porEdad) process.exit(0);

const ordenados = (porEdad ? todos : candidates).sort((a, b) => b.mtime - a.mtime);
const target = ordenados[0];

// ─── Verificar substrings requeridos ─────────────────────────────────────────
let content;
try {
  content = fs.readFileSync(target.full, 'utf-8');
} catch {
  process.exit(0); // fail-open
}

const missing = opts.contains.filter(needle => !content.includes(needle));

// El orden importa: una seccion faltante es un problema mas duro que la edad, y
// arreglarla actualiza el mtime, o sea que resuelve las dos cosas de una vez.
// Al reves, el agente arreglaria la edad y volveria a chocar con la estructura.
if (missing.length === 0) {
  if (porEdad && opts.requireFile) {
    const minutos = Math.round((Date.now() - target.mtime) / 60000);
    process.stderr.write(
      `\u{1F4CB} VALIDACION: ${path.join(opts.directory, target.name)} existe y esta completo, ` +
      `pero lleva ${minutos} min sin tocarse (el umbral es ${opts.maxAge}).\n` +
      `NO crees uno nuevo: si es el spec de esta tarea, marca las casillas que hayas ` +
      `completado — eso lo actualiza.\n` +
      `Si estas en OTRA tarea, corre /plan para abrir su propio spec.\n` +
      `Duplicar el spec deja huerfano al original: los hooks toman el mas reciente.`
    );
    process.exit(2);
  }
  process.exit(0);
}

process.stderr.write(
  `\u{1F4CB} VALIDACION DE ESTRUCTURA: a ${path.join(opts.directory, target.name)} le faltan ` +
  `${missing.length} seccion(es) obligatoria(s):\n\n` +
  missing.map(m => `  ✗ ${m}`).join('\n') + '\n\n' +
  `Agregalas al archivo con contenido real — no como encabezado vacio.\n` +
  `El formato no es decorativo: otros hooks y skills leen estas secciones por nombre.`
);
process.exit(2);
