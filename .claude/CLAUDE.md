# claude-agent-cli — CLI Development Guide

Este repositorio ES el generador Koa Agent CLI.
**NO es un proyecto Angular** — es un script Node.js/ESM que genera proyectos Angular.

## Qué es este repo

CLI Node.js (`create-koa-agent`) que scaffoldea proyectos Angular 20 + PrimeNG + Supabase
pre-configurados con harness agéntico para Claude Code.

Comandos:
- `node bin/index.js` — ejecutar el CLI localmente
- `TEST_MODE=inject node bin/index.js` — probar sin scaffolding completo
- `npm publish` — publicar en npm

## Dualidad crítica — LEER ANTES DE TOCAR CUALQUIER ARCHIVO

Este repo tiene DOS contextos que jamás deben confundirse:

**CONTEXTO A — El generador** (`bin/`, `lib/`)
- Código Node.js/ESM que corre cuando el usuario ejecuta `npx create-koa-agent`
- Aquí viven las reglas Node.js, módulos, lógica de scaffolding
- Reglas: `.claude/rules/cli-architecture.md`

**CONTEXTO B — El payload** (`templates/`)
- Archivos ESTÁTICOS que se copian al proyecto Angular generado
- `templates/.claude/` = harness para proyectos Angular (NO para este repo)
- `templates/boilerplate/` = código Angular inicial del proyecto generado
- Editar aquí = editar lo que recibe el usuario final
- Reglas: `.claude/rules/templates-contract.md`

**Regla de oro**: si abres un archivo en `templates/`, estás editando el producto, no el vehículo.

## Arquitectura del generador (Contexto A)

```
bin/
└── index.js          # Entry point: flags, inquirer, orquestación (~115 líneas)
lib/
├── config.js         # resolveStack, validateProjectName, parseJsonc, BLUEPRINT_VERSION
├── runner.js         # run() spawn wrapper, NPM, NPX constantes
├── preflight.js      # checkCommand, preflight() — verifica Node/npm/git/docker
├── installer.js      # createAngularProject, installDependencies — npm y npx ops
├── scaffolder.js     # copyTemplates, injectBoilerplate, writeBlueprintJson
└── ui.js             # printBanner, printSuccess — solo chalk, sin FS
```

## Reglas de arquitectura (path-scoped — auto-cargadas)

| Archivos editados | Regla activa |
|---|---|
| `bin/**` + `lib/**` | `.claude/rules/cli-architecture.md` |
| `templates/**` | `.claude/rules/templates-contract.md` |

## Índices del proyecto (leer antes de escribir código)

- `indices/CLI-MODULES.md` — mapa de lib/*.js y bin/
- `indices/TEMPLATES-REGISTRY.md` — mapa de templates/

## Flujo de trabajo (4 pasos)

1. **DESCUBRIR** — Lee `indices/CLI-MODULES.md`, `indices/TEMPLATES-REGISTRY.md`
   y `context/domain.md` + `context/brief.md` si existen.
2. **PLANIFICAR** — ¿Contexto A (generador) o Contexto B (payload)?
3. **EJECUTAR** — Código. Los hooks validarán cada escritura.
4. **SINCRONIZAR** — Actualiza el índice correspondiente.
