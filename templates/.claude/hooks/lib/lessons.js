/**
 * lib/lessons.js — El formato de LESSONS_LEARNED.md, en un solo lugar
 *
 * El archivo tiene DOS productores que no se conocen (DUP-002):
 *
 *   failure-tracker.js    hook, CommonJS   — una TABLA con dedup y rotación
 *   lint-arch-wrapper.js  script, ESM      — SECCIONES en prosa tras una recuperación
 *
 * Y el primero reescribía el archivo entero desde su modelo de tabla. Medido: una
 * sección que el wrapper había escrito —la lección de una regresión real del
 * linter— **desaparece con la primera falla de cualquier otra tool**. No es que
 * los formatos «sean distintos»: es que uno borra al otro.
 *
 * Los dos arreglos que vivían acá:
 *
 *   HUE-016  un error con `|` rompía la fila. La firma es la clave del dedup, y
 *            al re-parsear volvía truncada: cinco fallas idénticas producían
 *            cinco filas en vez de una con contador 5, y con MAX_ENTRIES = 20 la
 *            rotación desalojaba lecciones buenas. No se degradaba: se rompía
 *            para siempre en la primera falla con un pipe.
 *
 *   DUP-002  la tabla vive entre marcadores AUTO-GENERATED —el mismo patrón que
 *            `indices-sync` y `assignments-sync`— y todo lo que está fuera se
 *            preserva. El wrapper agrega debajo y nadie se pisa.
 *
 * Micro-suite: `node --test .claude/tests/lessons.test.js`
 */

const INICIO = '<!-- AUTO-GENERATED:BEGIN -->';
const FIN = '<!-- AUTO-GENERATED:END -->';

const ENCABEZADO = [
  '# Lessons Learned (Auto-generated)',
  '',
  '> La tabla la mantiene `failure-tracker`: máximo 20 entradas, las más viejas rotan,',
  '> los duplicados incrementan el contador. Lo que esté FUERA de los marcadores',
  '> `AUTO-GENERATED` no se toca — ahí escribe `lint-arch-wrapper` y podés escribir vos.',
  '',
].join('\n');

/**
 * Escapa lo que rompería una celda de tabla markdown.
 *
 * El `|` es el único carácter que parte una fila, y los saltos de línea la
 * terminan. Se escapan los dos: una celda tiene que ser una celda.
 */
function escapar(texto) {
  return String(texto ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

/** La inversa exacta de `escapar`. El round-trip es el contrato. */
function desescapar(texto) {
  return String(texto ?? '').replace(/\\\|/g, '|');
}

/** El cuerpo de la región auto-generada, o '' si no hay marcadores. */
function regionAuto(contenido) {
  const a = contenido.indexOf(INICIO);
  const b = contenido.indexOf(FIN, a);
  if (a === -1 || b === -1) return '';
  return contenido.slice(a + INICIO.length, b);
}

/**
 * Lo que NO es la tabla: encabezado propio, secciones del wrapper, notas a mano.
 * Es lo que hay que devolver intacto al reescribir.
 */
function fueraDeLaRegion(contenido) {
  const a = contenido.indexOf(INICIO);
  const b = contenido.indexOf(FIN, a);
  if (a === -1 || b === -1) {
    // Archivo viejo, sin marcadores: lo que no es fila de tabla ni encabezado de
    // la tabla se conserva. Migrar sin perder lo que ya había escrito el wrapper.
    return contenido
      .split('\n')
      .filter((l) => !esFila(l) && !esSeparador(l) && !esEncabezadoDeTabla(l))
      .join('\n')
      .replace(/^# Lessons Learned \(Auto-generated\)[\s\S]*?(?=\n#|\n\n|$)/, '')
      .trim();
  }
  return `${contenido.slice(0, a)}${contenido.slice(b + FIN.length)}`
    .replace(ENCABEZADO, '')
    .trim();
}

const esSeparador = (l) => /^\|[\s|:-]+\|$/.test(l.trim());
const esEncabezadoDeTabla = (l) => /^\|\s*Date\s*\|/i.test(l.trim());

function esFila(l) {
  const t = l.trim();
  return t.startsWith('|') && t.endsWith('|') && !esSeparador(t) && !esEncabezadoDeTabla(t);
}

/**
 * Las entradas de la tabla.
 *
 * Se parte por `|` NO escapados: `(?<!\\)\|`. Ese lookbehind es el arreglo de
 * HUE-016 del lado de la lectura — sin él, un error con pipe agrega columnas y
 * la firma vuelve cortada.
 */
function parse(contenido) {
  const fuente = regionAuto(contenido) || contenido;
  const entradas = [];

  for (const linea of fuente.split('\n')) {
    if (!esFila(linea)) continue;
    const celdas = linea.trim().slice(1, -1).split(/(?<!\\)\|/).map((c) => desescapar(c.trim()));
    if (celdas.length < 6) continue;

    const [fecha, tool, error, count, firma, contexto] = celdas;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;

    entradas.push({
      date: fecha,
      lastSeen: fecha,
      tool: tool.replace(/^`|`$/g, ''),
      error,
      occurrences: parseInt(count, 10) || 1,
      signature: firma.replace(/^`|`$/g, ''),
      context: contexto,
    });
  }
  return entradas;
}

/** El archivo completo: la tabla entre marcadores, y todo lo demás intacto. */
function render(entradas, resto = '') {
  const filas = entradas.map((e) => '| '
    + [
      e.lastSeen || e.date,
      `\`${escapar(e.tool)}\``,
      escapar(e.error),
      e.occurrences,
      `\`${escapar(e.signature)}\``,
      escapar(e.context),
    ].join(' | ')
    + ' |').join('\n');

  const tabla = [
    '| Date | Tool | Error | Count | Signature | Context |',
    '|------|------|-------|-------|-----------|---------|',
    filas,
  ].filter(Boolean).join('\n');

  const extra = String(resto || '').trim();
  return `${ENCABEZADO}\n${INICIO}\n${tabla}\n${FIN}\n${extra ? `\n${extra}\n` : ''}`;
}

module.exports = { parse, render, escapar, desescapar, fueraDeLaRegion, INICIO, FIN, ENCABEZADO };
