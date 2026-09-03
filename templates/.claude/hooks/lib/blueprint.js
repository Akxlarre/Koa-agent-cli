/**
 * lib/blueprint.js — Leer el `stack` de blueprint.json sin creerle
 *
 * HUE-002 era la identidad; esto es HUE-005 (S1). Dos consumidores leian el
 * archivo y hacian `{ ...DEFAULTS, ...bp.stack }`, que acepta cualquier cosa:
 * `pre-write-guard.js` y `boilerplate/scripts/architect.js`. Ese objeto decide
 * que guardrails corren — entre ellos SEC-RLS-01/02/03.
 *
 * Medido sobre el spread crudo:
 *
 *   { supabase: null }       → supabase falsy → reglas RLS APAGADAS
 *   { supabase: 0 }          → idem
 *   { supabase: "false" }    → truthy → ACTIVAS, aunque el humano quiso apagarlas
 *   { supabse: false }       → typo: se ignora en silencio
 *   stack como array         → se ignora en silencio
 *
 * Un blueprint.json mal formado —editado a mano, de una version anterior del
 * CLI, o reescrito por el propio scaffolder tras su aviso amarillo de
 * "blueprint.json existente ilegible"— apaga guardrails sin que nadie se entere.
 *
 * Regla: SOLO claves conocidas, SOLO booleanos. Todo lo demas se ignora y se
 * puede reportar. Fail-open en el resto: sin archivo, con JSON roto o con
 * permisos, se usan los defaults — un hook no frena por no poder leer su config.
 */

const fs = require('fs');
const path = require('path');

/**
 * Las banderas que el harness entiende. Es la lista canonica: `architect.js`
 * declara la misma y un test verifica que no diverjan.
 */
const STACK_KEYS = ['angular', 'tailwind', 'primeng', 'gsap', 'supabase'];

/** Lo que corre si no hay blueprint.json, o si el que hay no dice nada util. */
const DEFAULTS = Object.freeze({
  angular: true,
  tailwind: true,
  primeng: true,
  gsap: false,
  supabase: true,
});

/**
 * Normaliza un `stack` crudo contra la lista de claves conocidas.
 *
 * @returns {{ stack: object, ignoradas: string[] }} — `ignoradas` nombra lo que
 *   se descarto, para que un consumidor pueda avisar en vez de callar.
 */
function normalizarStack(crudo, defaults = DEFAULTS) {
  const stack = { ...defaults };
  const ignoradas = [];

  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) {
    if (crudo !== undefined && crudo !== null) ignoradas.push('<stack no es un objeto>');
    return { stack, ignoradas };
  }

  for (const [k, v] of Object.entries(crudo)) {
    if (!STACK_KEYS.includes(k)) {
      ignoradas.push(`${k} (clave desconocida)`);
      continue;
    }
    if (typeof v !== 'boolean') {
      ignoradas.push(`${k} (${JSON.stringify(v)} no es booleano)`);
      continue;
    }
    stack[k] = v;
  }
  return { stack, ignoradas };
}

/** Lee blueprint.json desde `cwd` y devuelve el stack ya validado. */
function readStack(cwd = process.cwd(), defaults = DEFAULTS) {
  try {
    const p = path.join(cwd, 'blueprint.json');
    if (!fs.existsSync(p)) return { stack: { ...defaults }, ignoradas: [] };
    const bp = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return normalizarStack(bp && bp.stack, defaults);
  } catch {
    return { stack: { ...defaults }, ignoradas: ['<blueprint.json ilegible>'] };
  }
}

module.exports = { readStack, normalizarStack, STACK_KEYS, DEFAULTS };
