# Templates Registry — Mapa del Payload

> Documenta qué hay en `templates/` y para qué sirve cada pieza.
> Actualiza esta tabla al agregar, modificar o eliminar contenido de templates/.

## Payload principal (siempre copiado)

| Ruta en templates/ | Destino en proyecto | Propósito |
|---|---|---|
| `templates/CLAUDE.md` | `CLAUDE.md` | Instrucciones para Claude.ai Projects (non-CLI). Contiene `{{PROJECT_NAME}}` y `{{BLUEPRINT_VERSION}}`. |
| `templates/AGENTS.md` | `AGENTS.md` + `.cursorrules` | Reglas portables para Cursor/Copilot/Windsurf (sin deps de Claude Code). |
| `templates/gitignore.template` | `.gitignore` | .gitignore con entradas para Angular, Supabase, GSAP, Vitest, Playwright. |
| `templates/docs/` | `docs/` | Guías de usuario: HOOKS-SYSTEM.md, TECH-STACK-RULES.md, BRAND_GUIDELINES.md, PRODUCT-VISION.md. |
| `templates/indices/` | `indices/` | 8 índices vacíos con estructura lista para completar (COMPONENTS, SERVICES, FACADES, MODELS, DIRECTIVES, PIPES, STYLES, DATABASE). |
| `templates/supabase/` | `supabase/` | Config de Supabase local (config.toml). |

## Harness agéntico (siempre copiado)

| Ruta en templates/.claude/ | Destino | Propósito |
|---|---|---|
| `templates/.claude/CLAUDE.md` | `.claude/CLAUDE.md` | Instrucciones del agente para el proyecto Angular. Contiene `{{PROJECT_NAME}}` y `{{BLUEPRINT_VERSION}}`. |
| `templates/.claude/settings.json` | `.claude/settings.json` | Configuración de hooks para Claude Code (8 hooks activos). |
| `templates/.claude/settings.local.json` | `.claude/settings.local.json` | Permisos de desarrollo pre-configurados. |
| `templates/.claude/hooks/` | `.claude/hooks/` | 8 hooks de guardrails (ver tabla de hooks abajo). |
| `templates/.claude/rules/` | `.claude/rules/` | 11 reglas arquitectónicas path-scoped. |
| `templates/.claude/skills/` | `.claude/skills/` | 7 skills (angular-component, angular-signals, angular-forms, angular-primeng, design-system, supabase-data-model, sync-indices). |
| `templates/.claude/scripts/` | `.claude/scripts/` | post-edit.js (Prettier automático). |

## Boilerplate Angular (solo Full Scaffold)

| Ruta en templates/ | Destino | Propósito | Condición |
|---|---|---|---|
| `templates/boilerplate/src/` | `src/` | Código Angular inicial: layout, auth, dashboard, shared components | Siempre en Full Scaffold |
| `templates/boilerplate/scripts/` | `scripts/` | indices-sync.js, lint-arch-wrapper.js, architect.js | Siempre en Full Scaffold |
| `templates/boilerplate/vitest.config.ts` | `vitest.config.ts` | Config de Vitest (reemplaza Karma) | Siempre en Full Scaffold |
| `templates/boilerplate/postcss.config.json` | `postcss.config.json` | PostCSS para Tailwind v4 (.json obligatorio — Angular ignora .js/.mjs) | Siempre en Full Scaffold |
| `templates/boilerplate-e2e/` | `e2e/` + `playwright.config.ts` | Tests E2E con Playwright | `--with-e2e` |
| `templates/boilerplate-ngrx/src/` | `src/app/core/state/` | Signal Store boilerplate con ExampleStore | `--with-ngrx-signals` |

## Hooks en templates/.claude/hooks/

| Hook | Evento Claude Code | Propósito | Dependencias |
|---|---|---|---|
| `pre-write-guard.js` | PreToolUse (Edit/Write) | 4 capas: File Protection, Discovery Gate, Architect Guard, Context Injection | discovery-tracker flag, blueprint.json |
| `discovery-tracker.js` | PostToolUse (Read) | Crea flag cuando se leen indices/ — levanta el Discovery Gate | — |
| `failure-tracker.js` | PostToolUseFailure | Registra errores en LESSONS_LEARNED.md con dedup y rotación (max 20) | — |
| `bash-guard.js` | PreToolUse (Bash) | Bloquea creación de archivos .ts/.html/.scss via Bash | — |
| `compact-recovery.js` | PostCompact | Re-inyecta índices tras compactación de contexto | discovery-tracker flag |
| `write-tracker.js` | PostToolUse (Edit/Write) | Registra archivos modificados en session-writes.json | — |
| `sync-check.js` | Stop | Verifica si los índices necesitan actualización al cerrar sesión | write-tracker JSON |
| `post-edit.js` (scripts/) | PostToolUse (Edit/Write) | Corre Prettier automáticamente tras cada escritura | — |

## Reglas en templates/.claude/rules/

| Regla | Globs activos | Propósito |
|---|---|---|
| `architecture.md` | `src/app/**/*.ts`, `.html` | Patrón Facade, OnPush, Signals vs RxJS |
| `facades.md` | `core/facades/**`, `core/services/**` | Estructura SWR, signals privados/públicos |
| `models.md` | `core/models/**` | Interfaces globales, tipados strict |
| `visual-system.md` | `src/app/**/*.html`, `styles/**` | Tokens, Bento Grid, cards |
| `ai-readability.md` | `src/app/**/*.html` | data-llm-* atributos semánticos |
| `component-selection.md` | `src/app/shared/**`, `features/**` | Cuándo usar PrimeNG vs custom |
| `testing-tdd.md` | `**/*.spec.ts` | Vitest, equivalencias Jasmine→Vitest |
| `state-management.md` | `src/app/**/*.ts` | Facade vs Signal Store |
| `swr-pattern.md` | `core/services/**` | Stale-While-Revalidate en Facades |
| `notifications.md` | `features/**`, `layout/**` | ToastService, nunca MessageService directo |
| `database.md` | `supabase/**`, `core/services/**` | Migrations SQL, RLS obligatorio |
