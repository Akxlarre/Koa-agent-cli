# Templates Registry — Mapa del Payload

> Documenta qué hay en `templates/` y para qué sirve cada pieza.
> Actualiza esta tabla al agregar, modificar o eliminar contenido de templates/.

## Payload principal (siempre copiado)

| Ruta en templates/ | Destino en proyecto | Propósito |
|---|---|---|
| `templates/CLAUDE.md` | `CLAUDE.md` | Entry point para Claude Code. Stub que apunta a `.claude/CLAUDE.md`. Indica que otros AI tools deben usar `AGENTS.md`. Contiene `{{PROJECT_NAME}}` y `{{BLUEPRINT_VERSION}}`. |
| `templates/AGENTS.md` | `AGENTS.md` | **Master universal** self-contained para todos los AI tools (OpenCode, Copilot, Codex…). Workflow de 5 pasos, reglas arquitectónicas, anti-patterns, los 10 índices. Contiene `{{PROJECT_NAME}}` y `{{BLUEPRINT_VERSION}}`. |
| `templates/gitignore.template` | `.gitignore` | .gitignore con entradas para Angular, Supabase, GSAP, Vitest, Playwright. |
| `templates/docs/` | `docs/` | Guías de usuario: HOOKS-SYSTEM.md, TECH-STACK-RULES.md, BRAND_GUIDELINES.md, PRODUCT-VISION.md. |
| `templates/indices/` | `indices/` | 10 índices vacíos con estructura lista para completar: COMPONENTS, SERVICES, FACADES, MODELS, DIRECTIVES, PIPES, STYLES, STORES, DATABASE, ANTI-PATTERNS. |
| `templates/context/domain.md` | `context/domain.md` | Entidades del negocio, reglas de dominio, terminología específica, stakeholders. Gitignored. |
| `templates/context/brief.md` | `context/brief.md` | Objetivo de la sesión actual (campo `last_updated`). Se actualiza al inicio de cada sesión. Gitignored. |
| `templates/context/constraints.md` | `context/constraints.md` | Restricciones del proyecto: integraciones externas, deuda técnica aceptada, entorno, límites del cliente. Gitignored. |
| `templates/context/learnings.md` | `context/learnings.md` | Insights validados por el humano: terminología, quirks de APIs, decisiones con motivo. Gitignored. |
| `templates/context/decisions/TEMPLATE.md` | `context/decisions/TEMPLATE.md` | Plantilla ADR-style para decisiones arquitectónicas. Copiar como ADR-NNN-nombre.md. Gitignored. |
| `templates/supabase/config.toml` | `supabase/config.toml` | Config de Supabase local. Requerido para `npx supabase start`. Puerto 54321 (API), 54323 (Studio), auth habilitado con redirect a localhost:4200. |
| `templates/supabase/migrations/` | `supabase/migrations/` | Migraciones iniciales: profiles + RLS role protection. |

## Harness agéntico (siempre copiado)

| Ruta en templates/.claude/ | Destino | Propósito |
|---|---|---|
| `templates/.claude/CLAUDE.md` | `.claude/CLAUDE.md` | Instrucciones del agente para el proyecto Angular. Contiene `{{PROJECT_NAME}}` y `{{BLUEPRINT_VERSION}}`. |
| `templates/.claude/settings.json` | `.claude/settings.json` | Configuración de hooks para Claude Code (9 hooks activos). |
| `templates/.claude/settings.local.json` | `.claude/settings.local.json` | Permisos de desarrollo pre-configurados. |
| `templates/.claude/hooks/` | `.claude/hooks/` | 9 hooks de guardrails (ver tabla de hooks abajo). |
| `templates/.claude/rules/` | `.claude/rules/` | 12 reglas arquitectónicas path-scoped. |
| `templates/.claude/skills/` | `.claude/skills/` | 8 skills (angular-component, angular-signals, angular-forms, angular-primeng, design-system, supabase-data-model, sync-indices, harness-feedback). |
| `templates/.claude/scripts/` | `.claude/scripts/` | post-edit.js (Prettier automático). |

## Adapters de AI tools (condicional)

> Copiados desde `templates/adapters/`. GitHub Copilot siempre se genera. Cursor y Windsurf solo con flag `--with-cursor` / `--with-windsurf` o selección en el prompt interactivo.

| Ruta en templates/adapters/ | Destino en proyecto | Cuándo | Propósito |
|---|---|---|---|
| `github/copilot-instructions.md` | `.github/copilot-instructions.md` | Siempre | Thin wrapper para GitHub Copilot. Apunta a `AGENTS.md` + reglas críticas inlineadas. |
| `cursor/rules/workflow.mdc` | `.cursor/rules/workflow.mdc` | `--with-cursor` | Workflow de 5 pasos en formato `.mdc` con `alwaysApply: true`. |
| `cursor/rules/architecture.mdc` | `.cursor/rules/architecture.mdc` | `--with-cursor` | Reglas de arquitectura y sistema visual. Path-scoped a `src/**/*.ts`, `.html`, `.scss`. |
| `windsurf/rules/project.md` | `.windsurf/rules/project.md` | `--with-windsurf` | Reglas condensadas en un archivo único (respeta límite 6k chars de Windsurf). |

## Boilerplate Angular (solo Full Scaffold)

| Ruta en templates/ | Destino | Propósito | Condición |
|---|---|---|---|
| `templates/boilerplate/src/app/core/facades/base.facade.ts` | `src/app/core/facades/base.facade.ts` | Clase base abstracta con SWR built-in. Todos los Facades de dominio la extienden. | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/core/facades/base.facade.spec.ts` | `src/app/core/facades/base.facade.spec.ts` | Tests de BaseFacade: primera carga, SWR re-entry, rollback, reset, dispose. | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/core/repositories/profiles.repository.ts` | `src/app/core/repositories/profiles.repository.ts` | Repository de ejemplo: único lugar con `.db.from('profiles')`. Patrón para nuevos repositories. | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/core/repositories/profiles.repository.spec.ts` | `src/app/core/repositories/profiles.repository.spec.ts` | Tests de ProfilesRepository: query chain, findById encontrado/null/error. | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/shared/components/error-state/error-state.component.ts` | `src/app/shared/components/error-state/error-state.component.ts` | Estado de error unificado para Facades. Envuelve `app-alert-card severity="error"` con output `(retry)`. Conectar a `facade.retryLoad()`. | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/shared/components/error-state/error-state.component.spec.ts` | `src/app/shared/components/error-state/error-state.component.spec.ts` | Tests: creación, renderizado de message, título default, emit retry al clic. | Siempre en Full Scaffold |
| `templates/boilerplate/src/` | `src/` | Código Angular inicial: layout, auth, dashboard, shared components | Siempre en Full Scaffold |
| `templates/boilerplate/scripts/` | `scripts/` | indices-sync.js, lint-arch-wrapper.js, architect.js, set-env.js | Siempre en Full Scaffold |
| `templates/boilerplate/vitest.config.ts` | `vitest.config.ts` | Config de Vitest (reemplaza Karma) | Siempre en Full Scaffold |
| `templates/boilerplate/postcss.config.json` | `postcss.config.json` | PostCSS para Tailwind v4 (.json obligatorio — Angular ignora .js/.mjs) | Siempre en Full Scaffold |
| `templates/boilerplate-e2e/` | `e2e/` + `playwright.config.ts` | Tests E2E con Playwright | `--with-e2e` |
| `templates/boilerplate-ngrx/src/` | `src/app/core/state/` | Signal Store boilerplate con ExampleStore | `--with-ngrx-signals` |

## Hooks en templates/.claude/hooks/

| Hook | Evento Claude Code | Propósito | Dependencias |
|---|---|---|---|
| `pre-write-guard.js` | PreToolUse (Edit/Write) | 4 capas: File Protection, Discovery Gate, Architect Guard (ARCH-01→12 + LLM-01→02), Context Injection | discovery-tracker flag, blueprint.json |
| `harness-gate.js` | PreToolUse (Edit/Write) | Generalization Gate + Placement Guard sobre el harness mismo (rules/, learnings.md, ANTI-PATTERNS.md, CLAUDE.md, scripts/) — ver HOOKS-SYSTEM.md §8 | — |
| `discovery-tracker.js` | PostToolUse (Read) | Crea flag cuando se leen indices/ — levanta el Discovery Gate | — |
| `failure-tracker.js` | PostToolUseFailure | Registra errores en LESSONS_LEARNED.md con dedup y rotación (max 20) | — |
| `bash-guard.js` | PreToolUse (Bash) | Bloquea creación de archivos .ts/.html/.scss via Bash | — |
| `compact-recovery.js` | PostCompact | Re-inyecta índices tras compactación de contexto | discovery-tracker flag |
| `write-tracker.js` | PostToolUse (Edit/Write) | Registra archivos modificados en session-writes.json | — |
| `sync-check.js` | Stop | Verifica si los índices necesitan actualización al cerrar sesión | write-tracker JSON |
| `context-guardian.js` | Stop | Audita frescura de context/: brief.md >7d y learnings.md >14d sin actualizar | — |
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
| `layout-blueprints.md` | `src/app/features/**` | 8 arquetipos de página: hero, grid, componentes por tipo |
