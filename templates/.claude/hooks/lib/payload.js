/**
 * lib/payload.js — La entrada de un hook
 *
 * Claude Code entrega el payload del evento por STDIN, en JSON. Es el único
 * contrato documentado. Diecisiete hooks lo leen así; uno leía
 * `process.env.TOOL_INPUT`, que no existe — y por eso `spec-diff-check` salía
 * siempre en 0 ante el caso exacto que debía bloquear (DEC-001).
 *
 * Es el mismo error que HUE-002 con `CLAUDE_SESSION_ID`: una variable de entorno
 * inventada no falla, devuelve vacío, y el guardrail queda decorativo. Por eso
 * este módulo NO acepta ninguna fuente alternativa: si el payload no llegó por
 * stdin, no llegó.
 *
 * Normaliza además los nombres que cambian entre herramientas —`file_path` vs
 * `path`, `new_string` vs `content`— que hoy cada hook resuelve por su cuenta
 * y no todos igual (HUE-010, ACO-012).
 *
 * Ver docs/diseno/ADR-001 §2.
 */

/** SEC-04: tope de stdin para que un payload fabricado no agote la memoria. */
const MAX_STDIN_BYTES = 10 * 1024 * 1024;

/**
 * Lee y normaliza el payload del evento.
 *
 * Nunca lanza: ante stdin vacío, JSON inválido o entrada gigante devuelve un
 * payload vacío con `ok:false`. El harness es fail-open — un hook jamás frena
 * una operación porque no supo leerse a sí mismo.
 *
 * @returns {Promise<{
 *   ok: boolean, raw: object,
 *   toolName: string, hookEvent: string,
 *   sessionId: string|null, agentId: string|null, agentType: string|null,
 *   source: string|null, cwd: string,
 *   filePath: string, newContent: string, command: string,
 * }>}
 */
function read({ maxBytes = MAX_STDIN_BYTES, stream = process.stdin } = {}) {
  return new Promise((resolve) => {
    let data = '';
    let size = 0;
    let terminado = false;

    const cerrar = (raw, ok) => {
      if (terminado) return;
      terminado = true;
      resolve(normalizar(raw, ok));
    };

    stream.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        stream.destroy?.();
        return cerrar({}, false);
      }
      data += chunk;
    });

    stream.on('error', () => cerrar({}, false));

    stream.on('end', () => {
      if (!data.trim()) return cerrar({}, false);
      try {
        const parsed = JSON.parse(data);
        // Un payload es un objeto plano. `null` y los arrays pasan el typeof y no
        // son payloads: se tratan como entrada inválida, no como objeto vacío.
        if (!esObjetoPlano(parsed)) return cerrar({}, false);
        cerrar(parsed, true);
      } catch {
        cerrar({}, false);
      }
    });
  });
}

function esObjetoPlano(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Misma normalización, sobre un objeto ya parseado. Útil en tests. */
function normalizar(raw, ok = true) {
  const r = esObjetoPlano(raw) ? raw : {};
  const input = esObjetoPlano(r.tool_input) ? r.tool_input : {};

  return {
    ok: ok && Object.keys(r).length > 0,
    raw: r,

    toolName: str(r.tool_name),
    hookEvent: str(r.hook_event_name),

    // Identidad. `session_id` y `agent_id` son campos documentados del payload;
    // no hay equivalente por variable de entorno y no se busca ninguno.
    sessionId: r.session_id ? str(r.session_id) : null,
    agentId: r.agent_id ? str(r.agent_id) : null,
    agentType: r.agent_type ? str(r.agent_type) : null,

    // `source` distingue startup de resume/compact/fork/clear en SessionStart (INC-020).
    source: r.source ? str(r.source) : null,

    cwd: str(r.cwd) || process.cwd(),

    // Los tres campos que cambian de nombre según la herramienta.
    filePath: str(input.file_path ?? input.path).replace(/\\/g, '/'),
    newContent: str(input.new_string ?? input.content ?? input.newString),
    command: str(input.command),
  };
}

function str(v) {
  return typeof v === 'string' ? v : (v == null ? '' : String(v));
}

module.exports = { read, normalizar, MAX_STDIN_BYTES };
