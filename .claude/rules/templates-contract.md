---
description: Reglas para trabajar con templates/ — payload copiado al proyecto Angular generado
globs: ["templates/**"]
---

# Reglas: Templates Contract

## La regla fundamental

`templates/` NO es código del CLI. Es un payload estático que se COPIA al proyecto generado.
Cualquier cambio aquí afecta a TODOS los proyectos Angular generados futuros, no al CLI.

## Zonas dentro de templates/

| Zona | Qué es | Cuándo tocar |
|---|---|---|
| `templates/.claude/` | Harness Angular (hooks, rules, skills, agents) | Al evolucionar el blueprint agéntico |
| `templates/.claude/agents/` | Subagentes del proyecto generado | Al agregar o ajustar un rol especializado |
| `templates/.claude/hooks/validators/` | Validadores genéricos parametrizados (no saben del proyecto) | Al necesitar validar la estructura de un artefacto |
| `templates/boilerplate/` | Código Angular inicial (src/, scripts/) | Al actualizar el boilerplate base |
| `templates/docs/` | Documentación inyectada al proyecto | Al actualizar guías para el usuario final |
| `templates/indices/` | Índices vacíos para el proyecto generado | Al agregar nuevos tipos de índices |
| `templates/supabase/` | Migraciones iniciales | Al cambiar el esquema inicial |

## Regla de consistencia de hooks

Los hooks en `templates/.claude/hooks/` tienen dependencias entre sí.
Antes de modificar uno, verifica qué otros dependen de él.

**La fuente son los datos, no esta tabla.** Los 22 artefactos compartidos —qué pieza
escribe cada uno, quién lo lee, cuándo se borra y quién lo comparte— viven declarados en
`templates/.claude/hooks/lib/contracts.js`, y `contracts.test.js` los contrasta
contra el filesystem: agregar un consumidor sin declararlo rompe el test.

De ahí sale también `templates/docs/CONTRATOS.md`, que es la copia que **viaja al proyecto
generado** (`npm run contracts:doc`). Eso era `ACO-013`: la declaración vivía solo de este
lado, y un agente trabajando en un proyecto generado no tenía forma de enterarse de que
`sync-check` borraba el archivo del que depende `spec-diff-check`.

Lo de abajo es un resumen para orientarse rápido al editar `templates/`. Si difiere del
registro, **gana el registro**.

| Hook | Depende de |
|---|---|
| `pre-write-guard.js` (Discovery Gate) | flag creado por `discovery-tracker.js` |
| `compact-recovery.js` | mismo flag, para inyectar solo los índices ya leídos |
| `sync-check.js` | `session-writes.json` que escribe `write-tracker.js` |
| `spec-diff-check.js` | `session-writes.json` |
| `spec-reflection.js` | task-spec que genera la skill `/plan` + `session-writes.json` |
| `compact-recovery.js` (bloque pendiente) | mismas casillas `- [ ]` del task-spec |
| `prompt-context.js` | mismas casillas + sección `## Out of scope` de `context/brief.md` |
| `session-start.js` | escribe el mismo discovery flag que `discovery-tracker.js` |
| `/plan` (hook en su frontmatter) | encabezados `##` exactos del task-spec |

**Contrato del task-spec** — lo comparten cinco piezas:

- Nombre `task-spec-YYYYMMDD-HHMMSS.md`. Los hooks toman el spec **más reciente por
  orden alfabético**, lo que solo coincide con el orden cronológico si el timestamp
  mantiene ese formato.
- Casillas markdown `- [ ]` / `- [x]` — las leen `spec-reflection.js`,
  `prompt-context.js` y `compact-recovery.js`.
- Encabezados `##` exactos (`## Objetivo`, `## Artefactos afectados`,
  `## Reglas que aplican`, `## Pasos de ejecucion`, `## Criterio de done`) — los
  valida el hook declarado en el frontmatter de `/plan`.

Si cambias el naming o un encabezado en `/plan`, cambia los cuatro consumidores a la vez.

**Contrato del discovery flag**: `discovery-tracker.js` y `session-start.js` escriben
ambos en `.claude/temp/session/{sessionId}/discovery.flag`, y `pre-write-guard.js` (Gate) y
`compact-recovery.js` lo leen. El formato de línea debe seguir conteniendo
`indices/NOMBRE.md`: `compact-recovery.js` parsea justamente eso para decidir qué
índices re-inyectar.

> Vivía en `$TMPDIR` bajo la clave `'default'` porque `CLAUDE_SESSION_ID` **no existe**
> (`HUE-002`): una lectura en un proyecto levantaba el Gate de otro. El `sessionId` sale
> hoy del payload de stdin, vía `lib/session.js`.

## Los hooks tienen tests — corrígelos ahí

`templates/.claude/tests/*.test.js` son tests de contrato de los hooks
(`node --test`). Todo hook nuevo lleva su archivo de test.

Esto no es opcional: `compact-recovery.js` estuvo con un error de sintaxis durante
varias versiones — fallaba en silencio en cada compactación — precisamente porque
ningún test lo ejecutaba nunca.

**Son cuatro suites, no una** (`HUE-033`: el trinquete de presupuesto de reglas estuvo
en rojo tres tandas porque la verificación solo corría las dos primeras):

```bash
# 1. hooks del payload
cd templates/.claude/tests && node --test *.test.js

# 2. el CLI
npm test

# 3 y 4. guardrails del linter y provocación de reglas.
# Necesitan resolver `typescript`, así que corren en el layout de un proyecto
# generado (o cualquier árbol con node_modules), no desde este repo:
node --test scripts/lib/*.test.mjs
node scripts/provocar-reglas.mjs
```

## CommonJS obligatorio en templates/.claude/hooks/

`templates/.claude/hooks/*.js` usan `require()` — no convertir a ESM.
El `package.json` en esa carpeta fuerza CommonJS. Esto es intencional.

## Variables de template

`{{PROJECT_NAME}}` y `{{BLUEPRINT_VERSION}}` se reemplazan al generar en:
- `templates/CLAUDE.md`
- `templates/.claude/CLAUDE.md`

No usar estas variables en archivos que el scaffolder no procesa (ej: hooks).
