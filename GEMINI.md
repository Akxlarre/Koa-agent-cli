# koa-agent-cli — CLI Development Instructions

> Gemini no resuelve los imports `@ruta` de Claude Code, así que las reglas van resumidas aquí.
> La guía completa está en `.claude/CLAUDE.md` — léela antes de modificar código.

**Lo esencial:**

- Este repo ES el generador (`create-koa-agent`), un CLI Node.js/ESM. **NO es un proyecto Angular.**
- **Contexto A — generador** (`bin/`, `lib/`): código que corre en `npx create-koa-agent`. Reglas en `.claude/rules/cli-architecture.md`.
- **Contexto B — payload** (`templates/`): archivos estáticos copiados al proyecto Angular generado. Editar aquí cambia lo que recibe el usuario final. Reglas en `.claude/rules/templates-contract.md`.
- Antes de escribir código, lee `indices/CLI-MODULES.md` e `indices/TEMPLATES-REGISTRY.md`.
- Imports locales con extensión `.js`; prohibido `require()` en `bin/` y `lib/` (ESM puro).
