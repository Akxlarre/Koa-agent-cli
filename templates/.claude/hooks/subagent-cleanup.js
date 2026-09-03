#!/usr/bin/env node
/**
 * subagent-cleanup.js — SubagentStop Hook (command)
 *
 * Cierra el ámbito de HILO cuando un subagente termina.
 *
 * `ADR-003` §1 partió el estado de los hooks en dos ámbitos: lo que describe **lo
 * que se hizo** es de la sesión (compartido con los subagentes), y lo que describe
 * **lo que ya se dijo** es del hilo (propio de cada uno). Sin esa división, el
 * primer subagente que cerrara se llevaba el único aviso y el hilo principal —el
 * que le habla a la persona— no veía nada (HUE-032).
 *
 * Pero un ámbito que se abre tiene que cerrarse. Los cinco subagentes del blueprint
 * arrancan y terminan varias veces dentro de una sesión larga, y cada uno deja su
 * dedup, su anti-bucle y su circuit breaker en `thread-<agent_id>/`. Nada los
 * borraba: `session/<sid>/` crecía con un directorio por invocación, todos muertos.
 *
 * `SubagentStop` es el `SessionEnd` del hilo. Es el único punto del runtime donde
 * se sabe que ese hilo no va a volver.
 *
 * Se borra SOLO el directorio del hilo que termina. El estado de sesión —el
 * discovery flag, `session-writes.json`— es de la sesión entera y sobrevive: lo
 * que el subagente descubrió o escribió sigue siendo cierto después de que se
 * fue. Ese es justamente el criterio con el que se repartieron los dos ámbitos.
 *
 * Exit 0 siempre: este hook limpia, nunca bloquea nada.
 */

const fs = require('fs');
const payload = require('./lib/payload.js');
const session = require('./lib/session.js');

payload.read().then((PAYLOAD) => {
  try {
    // Sin agent_id no hay hilo que cerrar: sería el directorio `thread-main`, que
    // es del hilo principal y sigue vivo. Un borrado ahí se llevaría puestos los
    // avisos de la conversación que continúa.
    const id = session.threadId(PAYLOAD);
    if (id === 'main') return process.exit(0);

    const dir = session.threadScope(PAYLOAD);
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* fail-open — un estado que no se borró no rompe nada */ }

  process.exit(0);
});
