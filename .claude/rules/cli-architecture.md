---
description: Reglas arquitectónicas para el código del generador CLI (bin/, lib/)
globs: ["bin/**", "lib/**"]
---

# Reglas: CLI Architecture

## Módulos y responsabilidades

`bin/index.js` — SOLO entry point: flags de entorno, inquirer prompts, orquestación.
Sin lógica de negocio. Si supera ~150 líneas, extraer a lib/.

| Módulo | Responsabilidad única |
|---|---|
| `lib/config.js` | Resolución de stack, validación de input, constantes globales |
| `lib/runner.js` | Wrapper spawn puro. Sin lógica de negocio. |
| `lib/preflight.js` | Checks de sistema (Node, npm, git). Sin instalaciones. |
| `lib/installer.js` | SOLO npm/npx. Importa `run` de runner.js. |
| `lib/scaffolder.js` | SOLO filesystem (copiar, parchear). Sin npm. |
| `lib/prompts.js` | SOLO inquirer y los modos de test. Sin FS, sin spawn. |
| `lib/ui.js` | SOLO chalk/console. Sin FS, sin spawn. |

## ESM — Reglas de importación

- Imports locales DEBEN incluir extensión `.js`: `import { run } from './runner.js'`
- PROHIBIDO `require()` en `bin/` o `lib/` — el proyecto es ESM puro (`"type": "module"`)
- Los hooks en `.claude/hooks/` son CommonJS (`require`) — no mezclar con lib/

## Constantes globales

- `BLUEPRINT_VERSION` vive en `lib/config.js` — importar, no redefinir
- `NPM` y `NPX` viven en `lib/runner.js` — importar en módulos que los necesiten

## No mezclar responsabilidades

- `lib/scaffolder.js` NO ejecuta npm (eso es installer.js)
- `lib/installer.js` NO copia archivos (eso es scaffolder.js)
- `bin/index.js` NO contiene lógica de patching (eso es scaffolder.js) ni arma prompts (eso es prompts.js)
- `lib/preflight.js` NO instala nada (solo verifica disponibilidad)
