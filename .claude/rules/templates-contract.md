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
| `templates/.claude/` | Harness Angular (hooks, rules, skills) | Al evolucionar el blueprint agéntico |
| `templates/boilerplate/` | Código Angular inicial (src/, scripts/) | Al actualizar el boilerplate base |
| `templates/docs/` | Documentación inyectada al proyecto | Al actualizar guías para el usuario final |
| `templates/indices/` | Índices vacíos para el proyecto generado | Al agregar nuevos tipos de índices |
| `templates/supabase/` | Migraciones iniciales | Al cambiar el esquema inicial |

## Regla de consistencia de hooks

Los hooks en `templates/.claude/hooks/` tienen dependencias entre sí.
Antes de modificar uno, verifica qué otros dependen de él.
Ejemplo clave: `pre-write-guard.js` lee el flag creado por `discovery-tracker.js`.

## CommonJS obligatorio en templates/.claude/hooks/

`templates/.claude/hooks/*.js` usan `require()` — no convertir a ESM.
El `package.json` en esa carpeta fuerza CommonJS. Esto es intencional.

## Variables de template

`{{PROJECT_NAME}}` y `{{BLUEPRINT_VERSION}}` se reemplazan al generar en:
- `templates/CLAUDE.md`
- `templates/.claude/CLAUDE.md`

No usar estas variables en archivos que el scaffolder no procesa (ej: hooks).
