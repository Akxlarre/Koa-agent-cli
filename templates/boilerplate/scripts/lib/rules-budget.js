/**
 * rules-budget.js — Cuánto contexto paga editar UN archivo.
 *
 * Las reglas de `.claude/rules/*.md` las inyecta Claude Code cuando el archivo
 * editado matchea algún glob de su frontmatter `paths:`. Ningún hook puede
 * interceptar eso — no hay dónde poner un tope en tiempo de ejecución.
 *
 * Lo que sí se puede es MEDIR y fijar el tope acá, como test. Sin esto, la
 * siguiente regla que alguien agregue con `src/app/**\/*.ts` vuelve a subir el
 * peor caso sin que nadie lo note: así se llegó a 76.391 chars por editar un
 * componente de feature (CAR-003, medido en ADR-005).
 *
 * El tope es el entregable, no la partición de los archivos.
 *
 * Micro-suite: `node --test scripts/lib/rules-budget.test.mjs`
 */

import fs from 'fs';
import path from 'path';

/**
 * Traduce un glob de `paths:` a un regex.
 *
 * Solo se soportan las tres formas que el frontmatter usa —`**`, `*` y el resto
 * literal—, y a propósito: un traductor de globs completo tendría casos que
 * nadie escribe y que nadie verificaría. `**\/` puede colapsar a nada, para que
 * `src/app/**\/*.ts` matchee `src/app/main.ts`.
 */
export function globARegex(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    if (glob.startsWith('**/', i)) { out += '(?:[^/]+/)*'; i += 2; continue; }
    if (glob.startsWith('**', i)) { out += '.*'; i += 1; continue; }
    if (glob[i] === '*') { out += '[^/]*'; continue; }
    out += glob[i].replace(/[.+^${}()|[\]\\?]/, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

/** Los globs declarados en el frontmatter, o `[]` si la regla no declara ninguno. */
export function pathsDe(contenido) {
  const fm = contenido.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return [];
  const bloque = fm[1].match(/paths:\n([\s\S]*?)(?:\n[a-z_]+:|$)/i);
  if (!bloque) return [];
  return [...bloque[1].matchAll(/^\s*-\s*["']?([^"'\n]+)["']?\s*$/gm)].map((m) => m[1].trim());
}

/** Lee `.claude/rules/*.md` y devuelve `[{ nombre, globs, chars }]`. */
export function leerReglas(dirReglas) {
  return fs.readdirSync(dirReglas)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => {
      const contenido = fs.readFileSync(path.join(dirReglas, f), 'utf-8');
      return { nombre: f, globs: pathsDe(contenido), chars: contenido.length };
    });
}

/** Las reglas que se inyectan al editar `ruta`, y cuánto suman. */
export function costoDe(ruta, reglas) {
  const matchean = reglas.filter((r) => r.globs.some((g) => globARegex(g).test(ruta)));
  return {
    ruta,
    reglas: matchean.map((r) => r.nombre),
    chars: matchean.reduce((a, r) => a + r.chars, 0),
  };
}

/**
 * Los topes, por ruta representativa. Una por capa, elegidas por lo que se edita
 * de verdad: un componente de `features/` es el archivo más tocado de un proyecto
 * Angular y es también el peor caso — no un caso extremo inventado.
 *
 * De dónde salen los números: son la medición de hoy más ~2% de aire. No son un
 * objetivo, son un TECHO, y un techo que solo puede bajar. Sirven para una cosa
 * concreta: que la próxima regla con `src/app/**\/*.ts` no vuelva a subir el peor
 * caso sin que nadie lo note, que es exactamente cómo se llegó a 76.391 chars.
 *
 * Cuando una regla se recorta de verdad, bajar el tope es parte del trabajo: un
 * tope que no se achica es la misma lista de excusas que un baseline que no se
 * achica.
 */
export const TOPES = {
  // ruta                                        tope     medido al fijarlo
  'src/app/features/reportes/reportes.ts':      72_000, // 71.975 — el peor caso
  'src/app/features/reportes/reportes.html':    41_000, // 40.196
  'src/app/core/facades/reportes.facade.ts':    40_000, // 39.316
  'src/app/layout/sidebar/sidebar.ts':          33_000, // 32.058
  'src/app/shared/ui/kpi-card/kpi-card.ts':     25_000, // 24.639
  'src/app/core/models/reporte.model.ts':       19_000, // 18.212
  'src/styles/tokens/_variables.scss':          10_000, //  8.986
  'supabase/migrations/001_init.sql':            5_000, //  4.522
};

export const RUTAS_REPRESENTATIVAS = Object.keys(TOPES);

export function medirTodo(dirReglas, rutas = RUTAS_REPRESENTATIVAS) {
  const reglas = leerReglas(dirReglas);
  return rutas.map((r) => costoDe(r, reglas));
}
