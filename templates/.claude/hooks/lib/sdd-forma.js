/**
 * lib/sdd-forma.js — La forma que el SDD le exige a una spec, a sus tareas y al backlog
 *
 * Tres reglas, y las tres salen de la misma crítica al Spec-Driven Development:
 * planificar todo de una y entregar por capas deja el producto sin poder usarse
 * hasta el final, y al humano revisando miles de líneas leyendo en vez de usando.
 *
 *   1. UNA SPEC, UNA HISTORIA. La segunda historia va al backlog, no a la misma
 *      spec: escribirla cuesta una línea, descartarla también, y el detalle
 *      técnico se paga recién cuando alguien la toma.
 *   2. TAREAS POR SLICE, NO POR CAPA. Un slice cruza las capas que necesite
 *      —migración, repository, facade, página— y termina en algo que se puede
 *      USAR: verificado en el navegador y revisado con `/review`. «Primero toda
 *      la BD, después todos los facades, al final la UI» es el plan que esto
 *      rechaza: nada funciona hasta la última fase.
 *   3. EL BACKLOG ES BARATO. Una línea por historia —`Como…, quiero…, para…`—,
 *      sin carpeta ni plantilla. La spec nace cuando la historia se toma.
 *
 * Lo leen dos piezas de árboles distintos: `sdd/spec-gate.js`, en cada escritura
 * y sobre la spec ACTIVA, y `scripts/verificar-specs.mjs` (`npm run lint:specs`),
 * sobre todas. Por eso es CommonJS sin dependencias: el script ESM lo carga con
 * `createRequire` y los dos preguntan lo mismo con el mismo código.
 *
 * Micro-suite: `node --test .claude/tests/sdd-forma.test.js`
 */

/** Estados en los que una spec ya es historia: no se le exige la forma nueva. */
const CERRADAS = new Set(['done', 'archived']);

/**
 * ¿Es todavía el placeholder que deja `/spec-new`?
 *
 * `/spec-new` crea `plan.md`, `tasks.md` y `acceptance.md` con una sola línea
 * —`# (vacío — se genera con /spec-XXX…)`— para que la carpeta tenga su forma
 * final desde el principio. Que el archivo EXISTA no significa que haya plan.
 */
function esPlaceholder(md) {
  const t = String(md || '').trim();
  return t === '' || /^#\s*\(vac[ií]o\b/i.test(t);
}

/** El `> **Status:**` de la cabecera, en minúsculas, o `null`. */
function estado(specMd) {
  const m = /^>?\s*\*\*Status:\*\*\s*`?([\w-]+)/mi.exec(String(specMd || ''));
  return m ? m[1].toLowerCase() : null;
}

/**
 * Las historias de usuario REALES de una spec.
 *
 * Una línea `- **USn**: …` con contenido. Las de la plantilla —con `{{rol}}` o
 * con un `…` pelado— no cuentan: son el hueco que el usuario todavía no llenó.
 */
function historias(specMd) {
  const out = [];
  for (const m of String(specMd || '').matchAll(/^\s*-\s*\*\*(US\d+)\*\*\s*:?\s*(.*)$/gm)) {
    const texto = m[2].trim();
    if (!texto || texto.includes('{{') || /^(…|\.\.\.)$/.test(texto)) continue;
    out.push({ id: m[1], texto });
  }
  return out;
}

/**
 * Los problemas de forma de una spec. Vacío = bien formada.
 *
 * Una spec `done` o `archived` no se juzga: es registro de lo que pasó, y
 * exigirle la regla nueva solo obligaría a reescribir la historia.
 */
function revisarSpec(specMd) {
  if (CERRADAS.has(estado(specMd))) return [];
  const us = historias(specMd);
  if (us.length <= 1) return [];
  return [
    `tiene ${us.length} historias (${us.map((h) => h.id).join(', ')}). Una spec = una historia: `
    + 'la primera se queda, las demás van al backlog con /backlog y se toman después con /spec-new H-NNN.',
  ];
}

/** Los slices de un `tasks.md`: cada `## Slice …` con lo que trae adentro. */
function slices(tasksMd) {
  const out = [];
  const secciones = String(tasksMd || '').split(/^(?=##\s)/m);
  for (const s of secciones) {
    const h = /^##\s+Slice\s+([\w.-]+)\s*(?:[—–:-]\s*(.*))?$/mi.exec(s.split('\n')[0]);
    if (!h) continue;
    const casillas = s.split('\n').filter((l) => /^\s*-\s*\[[ xX]\]/.test(l));
    out.push({
      id: h[1],
      titulo: (h[2] || '').trim(),
      verifica: casillas.some((l) => /\bverify\b|verificaci[oó]n de uso/i.test(l)),
      revisa: casillas.some((l) => /\/review\b/.test(l)),
    });
  }
  return out;
}

/**
 * Los problemas de forma de un `tasks.md`. Vacío = bien formado.
 *
 * El placeholder no se juzga: todavía no hay tareas. Un `tasks.md` generado sin
 * ningún `## Slice` es el plan por capas que esta regla existe para rechazar.
 */
function revisarTareas(tasksMd) {
  if (esPlaceholder(tasksMd)) return [];
  const lista = slices(tasksMd);
  if (lista.length === 0) {
    return ['está cortado por capas: no tiene ninguna sección "## Slice". '
      + 'Regeneralo con /spec-tasks — cada slice cruza las capas que necesite y termina en algo que se puede usar.'];
  }
  const problemas = [];
  for (const s of lista) {
    if (!s.verifica) problemas.push(`el Slice ${s.id} no termina en una verificación de uso (verify en el navegador)`);
    if (!s.revisa) problemas.push(`el Slice ${s.id} no termina en /review de su propio diff`);
  }
  return problemas;
}

/** Las historias del backlog barato: la sección `## Historias` de `specs/ROADMAP.md`. */
function backlog(roadmapMd) {
  const seccion = /^##\s+Historias\b[^\n]*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/m.exec(String(roadmapMd || ''));
  if (!seccion) return [];
  const out = [];
  for (const m of seccion[1].matchAll(/^\s*-\s*\[([ xX])\]\s*\*\*(H-\d{3,})\*\*\s*[·:-]?\s*(.*)$/gm)) {
    const texto = m[3].trim();
    if (texto.includes('{{')) continue; // la línea de ejemplo de la plantilla
    const tomada = /→\s*spec\s+(\d{4})/i.exec(texto);
    out.push({ id: m[2], hecha: m[1] !== ' ', texto, spec: tomada ? tomada[1] : null });
  }
  return out;
}

/**
 * Los problemas del backlog: `{ errores, avisos }`.
 *
 * Errores son lo que se puede afirmar sin interpretar: ids repetidos, una
 * historia sin sus tres partes, una que dice haberse vuelto spec y la spec no
 * está. El aviso —un «y» en lo que se quiere— es una sospecha, no un hecho:
 * «quiero registrarme y entrar» son dos historias, «quiero ver altas y bajas»
 * puede ser una. Un chequeo que falla por una sospecha termina apagado.
 */
function revisarBacklog(roadmapMd, idsDeSpecs = []) {
  const errores = [];
  const avisos = [];
  const vistos = new Set();
  const specs = new Set(idsDeSpecs);
  for (const h of backlog(roadmapMd)) {
    if (vistos.has(h.id)) errores.push(`${h.id} está repetida`);
    vistos.add(h.id);
    const forma = /\bcomo\b(.+?),?\s+quiero\b(.+?)\bpara\b(.+)/i.exec(h.texto);
    if (!forma) {
      errores.push(`${h.id} no tiene la forma "Como <rol>, quiero <capacidad> para <beneficio>"`);
      continue;
    }
    if (/\sy\s/i.test(forma[2])) avisos.push(`${h.id} quiere dos cosas ("…${forma[2].trim()}…"): ¿son dos historias?`);
    if (h.spec && specs.size > 0 && !specs.has(h.spec)) {
      errores.push(`${h.id} dice que se volvió la spec ${h.spec}, y esa spec no existe`);
    }
  }
  return { errores, avisos };
}

module.exports = {
  CERRADAS,
  esPlaceholder,
  estado,
  historias,
  revisarSpec,
  slices,
  revisarTareas,
  backlog,
  revisarBacklog,
};
