/**
 * typescript-guard.mjs — Cargar el compilador, o decir por qué no (HUE-018)
 *
 * `architect.js` e `indices-sync.js` parsean con la API de TypeScript y la
 * pedían así:
 *
 *     const ts = require('typescript');
 *
 * Sin guarda ninguna, y falla de dos formas distintas que se ven igual de mal:
 *
 *   NO ESTÁ INSTALADO   `Error: Cannot find module 'typescript'` y veinte líneas
 *                       de stack de `node:internal/modules/cjs/loader`. El
 *                       usuario ve un crash de Node, no «te falta un paquete».
 *
 *   TYPESCRIPT 7        Carga bien, y revienta más tarde con un `TypeError:
 *                       Cannot read properties of undefined` en medio del
 *                       recorrido del AST, porque `ts.ScriptTarget` ya no está
 *                       donde estaba. El stack apunta a una línea del linter que
 *                       no tiene nada que ver con la causa.
 *
 * Los dos son reales: los dos aparecieron mientras se auditaba este repo.
 *
 * Un guardrail que muere con un stack trace no es más estricto que uno que no
 * existe — es más caro, porque además manda a depurar el lugar equivocado.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/** Lo mínimo que el linter usa de la API. Si falta, el resto no tiene sentido. */
const API_REQUERIDA = ['createSourceFile', 'forEachChild', 'ScriptTarget', 'SyntaxKind'];

/**
 * El compilador, o un mensaje y `process.exit(1)`.
 *
 * Sale en 1 y no en 2: esto no es una violación de una regla, es que el chequeo
 * no se pudo correr. Confundir las dos cosas haría que un `lint:arch` sin
 * TypeScript se leyera como «el código está mal».
 */
export function cargarTypescript({ quienLlama = 'este script' } = {}) {
  let ts;
  try {
    ts = require('typescript');
  } catch (e) {
    if (e && e.code !== 'MODULE_NOT_FOUND') throw e;
    fallar(
      `${quienLlama} necesita el paquete \`typescript\` y no está instalado.`,
      'TypeScript viene con Angular: `npm install` en la raíz del proyecto lo resuelve.',
      'Si estás corriendo esto fuera de un proyecto generado, no hay nada que auditar.',
    );
  }

  const faltan = API_REQUERIDA.filter((k) => ts[k] === undefined);
  if (faltan.length > 0) {
    fallar(
      `El \`typescript\` instalado (${ts.version || 'versión desconocida'}) no expone `
      + `${faltan.join(', ')}.`,
      'TypeScript 7 reorganizó la API del compilador y estos scripts todavía usan la de la 5.',
      'Fijá la versión que declara tu package.json (`npm install`) o abrí un issue del blueprint.',
    );
  }

  return ts;
}

function fallar(...lineas) {
  const rojo = '\x1b[31m%s\x1b[0m';
  console.error(rojo, `\n✖ ${lineas[0]}`);
  for (const l of lineas.slice(1)) console.error(`  ${l}`);
  console.error('');
  process.exit(1);
}
