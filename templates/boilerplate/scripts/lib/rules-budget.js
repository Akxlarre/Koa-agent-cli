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
/**
 * Los dos topes que subieron, y a cambio de qué (HUE-027).
 *
 * Cada regla declara ahora en su frontmatter si la bloquea un mecanismo
 * (`enforcement: mecanizada  # ARCH-01, ARCH-02…`) o si es un acuerdo del
 * proyecto (`enforcement: social`). Son ~35 chars por regla, y una ruta que
 * matchea 14 reglas los paga 14 veces: +583 en el peor caso.
 *
 * Se subió a propósito, no por inercia. Lo que compra es que el agente sepa si
 * romper esa regla lo frena o no — la pregunta que ninguna de las 16 respondía,
 * y de la que dependen dos errores opuestos: confiar en un guardrail que no
 * existe, y no encontrar la regla que explica el bloqueo que sí ocurrió.
 *
 * Se pagó primero lo que se podía: la explicación de las sociales («nada la
 * bloquea: es un acuerdo, no un guardrail») estaba repetida 8 veces, ~450
 * chars, y vive una sola vez en `.claude/CLAUDE.md`. Los códigos de las
 * mecanizadas se quedan: eso es información, no explicación.
 */
export const TOPES = {
  // ruta                                        tope     medido al fijarlo
  'src/app/features/reportes/reportes.ts':      73_000, // 72.583 — el peor caso
  'src/app/features/reportes/reportes.html':    41_000, // 40.677
  'src/app/core/facades/reportes.facade.ts':    40_000, // 39.531
  'src/app/layout/sidebar/sidebar.ts':          33_000, // 32.477
  'src/app/shared/ui/kpi-card/kpi-card.ts':     25_500, // 25.013
  'src/app/core/models/reporte.model.ts':       19_000, // 18.387
  'src/styles/tokens/_variables.scss':          10_000, //  9.131
  'supabase/migrations/001_init.sql':            5_000, //  4.593
};

export const RUTAS_REPRESENTATIVAS = Object.keys(TOPES);

export function medirTodo(dirReglas, rutas = RUTAS_REPRESENTATIVAS) {
  const reglas = leerReglas(dirReglas);
  return rutas.map((r) => costoDe(r, reglas));
}
