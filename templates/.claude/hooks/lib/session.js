/**
 * lib/session.js — Identidad de sesión y estado de los hooks
 *
 * El problema que resuelve (HUE-002): cinco hooks derivaban la identidad así
 *
 *     const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
 *
 * y esa variable NO EXISTE. No está entre las que Claude Code expone a los hooks,
 * así que `sessionId` era siempre 'default': un único bucket global compartido por
 * todas las sesiones y todos los proyectos de la máquina. Consecuencia medida: una
 * lectura de indices/ en un proyecto levantaba el Discovery Gate de otro, y como el
 * flag vivía en TMPDIR sin que nadie lo borrara, quedaba levantado para siempre.
 *
 * El campo documentado es `session_id`, en el payload de stdin. Es el primer nivel.
 *
 * Dos ámbitos, no uno (HUE-032 / ADR-003 §1). Los hooks corren TAMBIÉN dentro de los
 * subagentes, con el mismo session_id y un `agent_id` que los distingue. La regla:
 *
 *     si el artefacto describe LO QUE SE HIZO   → ámbito de sesión (compartido)
 *     si describe LO QUE YA SE DIJO             → ámbito de hilo   (por agente)
 *
 * Un aviso que el subagente consumió no debe callar al hilo principal.
 *
 * Ver docs/diseno/ADR-001 §1, ADR-002 §1, ADR-003 §1.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/** Ciclos de vida declarables (ADR-002 §1). `turno` lo gestiona cada hook. */
const LIFETIMES = ['turno', 'sesion', 'permanente'];

/** Umbral de `cleanup()`. Un estado más viejo que esto es de una sesión muerta. */
const MAX_EDAD_MS = 7 * 24 * 60 * 60 * 1000;

/** Orígenes de SessionStart en los que la sesión SIGUE VIVA (INC-020). */
const ORIGENES_CONTINUACION = new Set(['resume', 'compact', 'fork', 'clear']);

/**
 * Identidad de la sesión. Dos niveles, ninguno global.
 *
 *   1. payload.session_id — el campo documentado
 *   2. derivado del cwd   — acotado al proyecto, nunca 'default'
 *
 * No hay nivel de variable de entorno a propósito: `CLAUDE_SESSION_ID` no existe y
 * tratarla como fallback fue justamente el origen de HUE-002.
 */
function sessionId(payload) {
  const desdePayload = payload && typeof payload.session_id === 'string'
    ? payload.session_id.trim()
    : '';
  if (desdePayload) return sanear(desdePayload);
  return 'proj-' + crypto.createHash('sha1').update(process.cwd()).digest('hex').slice(0, 8);
}

/**
 * Identidad del hilo: el subagente que corre este hook, o el hilo principal.
 * `agent_id` está documentado y llega solo dentro de un subagente.
 */
function threadId(payload) {
  const id = payload && typeof payload.agent_id === 'string' ? payload.agent_id.trim() : '';
  return id ? sanear(id) : 'main';
}

/** Raíz del estado, dentro del proyecto. `.claude/temp/` ya está gitignored. */
function rootDir() {
  return path.join(process.cwd(), '.claude', 'temp', 'session');
}

/**
 * Estado compartido por la sesión entera, subagentes incluidos.
 * Para lo que describe LO QUE SE HIZO: session-writes.json, el discovery flag.
 */
function sessionScope(payload) {
  return path.join(rootDir(), sessionId(payload));
}

/**
 * Estado propio de este hilo de ejecución.
 * Para lo que describe LO QUE YA SE DIJO: dedup de avisos, anti-bucle, breaker.
 */
function threadScope(payload) {
  return path.join(sessionScope(payload), 'thread-' + threadId(payload));
}

function dirDe(payload, scope) {
  return scope === 'hilo' ? threadScope(payload) : sessionScope(payload);
}

/**
 * Lee un artefacto de estado. Devuelve `null` si no existe o está corrupto —
 * fail-open, como el resto del harness: un hook nunca frena por su propio estado.
 */
function readState(payload, key, { scope = 'sesion' } = {}) {
  try {
    const raw = fs.readFileSync(path.join(dirDe(payload, scope), sanear(key)), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Escribe un artefacto de estado. Devuelve `true` si quedó en disco. */
function writeState(payload, key, value, { scope = 'sesion' } = {}) {
  try {
    const dir = dirDe(payload, scope);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, sanear(key)), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Añade una línea a un artefacto de texto (el discovery flag es append-only). */
function appendState(payload, key, line, { scope = 'sesion' } = {}) {
  try {
    const dir = dirDe(payload, scope);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, sanear(key)), line.endsWith('\n') ? line : line + '\n');
    return true;
  } catch {
    return false;
  }
}

/** Contenido crudo de un artefacto de texto, o `''`. */
function readText(payload, key, { scope = 'sesion' } = {}) {
  try {
    return fs.readFileSync(path.join(dirDe(payload, scope), sanear(key)), 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Borra estado viejo. NUNCA el de la sesión en curso.
 *
 * `SessionStart` no corre una vez por sesión (INC-020): corre también en `resume`,
 * `clear`, `compact` y `fork`. Un cleanup ciego ahí borraría el discovery flag y
 * session-writes.json a mitad del trabajo, cada vez que el runtime compacta. Por eso
 * el criterio es la ANTIGÜEDAD y no «arrancó una sesión», y por eso se recibe el
 * origen: en una continuación no se borra nada.
 */
function cleanup(payload, { source = 'startup', maxEdadMs = MAX_EDAD_MS } = {}) {
  if (ORIGENES_CONTINUACION.has(source)) return 0;

  const root = rootDir();
  const viva = sessionId(payload);
  const corte = Date.now() - maxEdadMs;
  let borradas = 0;

  let entradas;
  try {
    entradas = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return 0;
  }

  for (const e of entradas) {
    if (!e.isDirectory() || e.name === viva) continue;
    const full = path.join(root, e.name);
    try {
      if (fs.statSync(full).mtimeMs >= corte) continue;
      fs.rmSync(full, { recursive: true, force: true });
      borradas++;
    } catch { /* fail-open */ }
  }
  return borradas;
}

/**
 * Un id de estado nunca debe poder escapar de su directorio.
 *
 * El punto se permite —`discovery.flag`, `writes.json`— así que hay que descartar
 * aparte los nombres que son SOLO puntos: `sanear('..')` devolvía `'..'`, y
 * `session/..` resuelve a `temp/`. Lo encontró su propio test.
 */
function sanear(s) {
  const limpio = String(s).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 128);
  if (!limpio || /^\.+$/.test(limpio)) return 'sin-nombre';
  return limpio;
}

module.exports = {
  sessionId,
  threadId,
  sessionScope,
  threadScope,
  readState,
  writeState,
  appendState,
  readText,
  cleanup,
  LIFETIMES,
  MAX_EDAD_MS,
  ORIGENES_CONTINUACION,
};
