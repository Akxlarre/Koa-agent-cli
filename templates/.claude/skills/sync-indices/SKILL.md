---
name: sync-indices
description: >
  Sincronizar los índices del proyecto con el trabajo de la sesión actual.
  Invocar al final de cada sesión de trabajo para mantener la memoria institucional actualizada.
  Delega en el subagente index-syncer, que corre el auto-indexer AST y completa a mano
  solo lo que ese script no puede deducir.
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Glob, Grep, Task
---

# Sync Indices — la puerta, no el mecanismo

Tres piezas sincronizan índices en este proyecto, y hasta `DUP-003` ninguna decía
cuál usar cuándo. El reparto, ahora explícito:

| Pieza | Qué es | Alcance |
|---|---|---|
| `npm run indices:sync` (`scripts/indices-sync.js`) | **La autoridad.** Parsea con el AST de TypeScript y regenera los 13 índices auto-generables entre los marcadores `AUTO-GENERATED` | Determinista. Lo que deduce del código, manda |
| `index-syncer` (subagente) | **El único que escribe `indices/`.** Corre el script y completa a mano lo que el script no puede deducir | `ANTI-PATTERNS.md`, `LAYOUTS.md`, borrados, y el juicio |
| `/sync-indices` (esta skill) | **La puerta.** La invoca el humano y delega | No edita nada |

**Esta skill no edita índices.** No es una restricción decorativa: no tiene `Edit`
entre sus tools.

## Por qué

La versión anterior de esta skill hacía el trabajo a mano: leía cuatro índices,
buscaba archivos cambiados y actualizaba las tablas ella misma. Tres problemas, y
el tercero se comía a los otros dos:

1. Rehacía a mano lo que el AST ya hace bien, para 4 de los 15 índices.
2. **Editaba dentro de los marcadores `AUTO-GENERATED`**, así que el siguiente
   `npm run indices:sync` borraba ese trabajo (`HUE-007`).
3. No tenía `Bash`, así que no podía correr el script ni aunque quisiera. La
   duplicación no era un descuido de redacción: estaba en el frontmatter.

## Procedimiento

1. Delega en el subagente `index-syncer`. Él corre `npm run indices:sync`, lee
   `.claude/temp/session-writes.json` para saber qué tocó la sesión, y edita a
   mano **solo fuera** de los bloques auto-generados.

2. Cuando vuelva, muéstrale al usuario su resumen: qué índices cambiaron y qué
   entradas se agregaron, modificaron o marcaron como borradas.

3. Si el subagente reporta algo que no puede resolver —una entrada ambigua, un
   archivo que no sabe clasificar—, es una decisión del humano, no tuya.

## Lo que NO hace esta skill

- **No edita `indices/`.** Si te encontrás por escribir una fila de tabla acá, el
  reparto se rompió: eso es de `index-syncer`.
- **No toca nada entre `<!-- AUTO-GENERATED:BEGIN -->` y `END`.** Ahí manda el
  script; lo que escribas se pierde en la próxima corrida.
- **No sincroniza sin haber corrido el auto-indexer primero.** El orden importa:
  el script regenera, y recién después tiene sentido completar a mano lo que dejó
  afuera.
