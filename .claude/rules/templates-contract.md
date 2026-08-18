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
| `templates/boilerplate/` | Código Angular inicial (src/, scripts/) | Al actualizar el boilerplate base |
| `templates/docs/` | Documentación inyectada al proyecto | Al actualizar guías para el usuario final |
| `templates/indices/` | Índices vacíos para el proyecto generado | Al agregar nuevos tipos de índices |
| `templates/supabase/` | Migraciones iniciales | Al cambiar el esquema inicial |

## Regla de consistencia de hooks

Los hooks en `templates/.claude/hooks/` tienen dependencias entre sí.
Antes de modificar uno, verifica qué otros dependen de él.

| Hook | Depende de |
|---|---|
| `pre-write-guard.js` (Discovery Gate) | flag creado por `discovery-tracker.js` |
| `compact-recovery.js` | mismo flag, para inyectar solo los índices ya leídos |
| `sync-check.js` | `session-writes.json` que escribe `write-tracker.js` |
| `spec-diff-check.js` | `session-writes.json` |
| `spec-reflection.js` | task-spec que genera la skill `/plan` + `session-writes.json` |
| `compact-recovery.js` (bloque pendiente) | mismas casillas `- [ ]` del task-spec |

**Contrato del task-spec**: la skill `/plan`, `spec-reflection.js` y `compact-recovery.js`
comparten el formato de nombre `task-spec-YYYYMMDD-HHMMSS.md` y las casillas markdown
`- [ ]` / `- [x]`. Los dos hooks toman el spec **más reciente por orden alfabético**, lo
que solo coincide con el orden cronológico si el timestamp mantiene ese formato. Si
cambias el naming en `/plan`, cambia los dos hooks a la vez.

## Los hooks tienen tests — corrígelos ahí

`templates/.claude/tests/*.test.js` son tests de contrato de los hooks
(`node --test`). Todo hook nuevo lleva su archivo de test.

Corre la suite antes de dar por buena cualquier edición en `hooks/`:

```bash
cd templates/.claude/tests && node --test *.test.js
```

Esto no es opcional: `compact-recovery.js` estuvo con un error de sintaxis durante
varias versiones — fallaba en silencio en cada compactación — precisamente porque
ningún test lo ejecutaba nunca.

## CommonJS obligatorio en templates/.claude/hooks/

`templates/.claude/hooks/*.js` usan `require()` — no convertir a ESM.
El `package.json` en esa carpeta fuerza CommonJS. Esto es intencional.

## Variables de template

`{{PROJECT_NAME}}` y `{{BLUEPRINT_VERSION}}` se reemplazan al generar en:
- `templates/CLAUDE.md`
- `templates/.claude/CLAUDE.md`

No usar estas variables en archivos que el scaffolder no procesa (ej: hooks).
