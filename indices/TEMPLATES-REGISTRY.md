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
| `templates/indices/` | `indices/` | 11 índices con estructura lista para completar: COMPONENTS, SERVICES, FACADES, MODELS, DIRECTIVES, PIPES, STYLES, STORES, LAYOUTS, DATABASE, ANTI-PATTERNS. **ANTI-PATTERNS.md no viene vacío**: 12 anti-patrones en dos grupos — AP-001→006 los bloquea el Architect Guard, AP-007→012 son de diseño y solo los ve `code-judge` o una persona. |
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
| `templates/.claude/settings.json` | `.claude/settings.json` | Cableado de hooks. 7 eventos: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PostCompact, Stop. |
| `templates/.claude/settings.local.json` | `.claude/settings.local.json` | Permisos de desarrollo pre-configurados. |
| `templates/.claude/hooks/` | `.claude/hooks/` | 13 hooks de guardrails (ver tabla abajo). |
| `templates/.claude/hooks/validators/` | `.claude/hooks/validators/` | Validadores genéricos parametrizados por flags. No saben nada del proyecto. Trae su `package.json` que fuerza CommonJS. |
| `templates/.claude/agents/` | `.claude/agents/` | 5 subagentes con ventana de contexto propia (ver tabla abajo). |
| `templates/.claude/rules/` | `.claude/rules/` | 14 reglas arquitectónicas path-scoped. |
| `templates/.claude/skills/` | `.claude/skills/` | 10 skills (angular-component, angular-signals, angular-forms, angular-primeng, design-system, supabase-data-model, sync-indices, plan, review, harness-feedback). |
| `templates/.claude/scripts/` | `.claude/scripts/` | post-edit.js (Prettier automático). |
| `templates/.claude/tests/` | `.claude/tests/` | 8 archivos de tests de contrato (`node --test`). 110 tests. Incluye `doc-links.test.js`, que verifica que toda referencia `archivo.md#ancla` del payload resuelva y que toda regla emitida esté documentada. |

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
| `templates/boilerplate/src/app/core/services/` | `src/app/core/services/` | Todos los servicios viven **planos** aquí. No hay subcarpetas: `core/services/ui/` existió por una copia mal hecha y se eliminó en 6.7. | Siempre en Full Scaffold |
| `templates/boilerplate/src/styles/` | `src/styles/` | Todo `.scss` bajo `styles/` **debe** estar alcanzable desde `src/styles.scss` vía `@use`. Un parcial huérfano es código muerto que nadie nota. | Siempre en Full Scaffold |
| `templates/boilerplate/scripts/` | `scripts/` | indices-sync.js, lint-arch-wrapper.js, architect.js, set-env.js | Siempre en Full Scaffold |
| `templates/boilerplate/vitest.config.ts` | `vitest.config.ts` | Config de Vitest (reemplaza Karma) | Siempre en Full Scaffold |
| `templates/boilerplate/postcss.config.json` | `postcss.config.json` | PostCSS para Tailwind v4 (.json obligatorio — Angular ignora .js/.mjs) | Siempre en Full Scaffold |
| `templates/boilerplate-e2e/` | `e2e/` + `playwright.config.ts` | Tests E2E con Playwright | `--with-e2e` |
| `templates/boilerplate-ngrx/src/` | `src/app/core/state/` | Signal Store boilerplate con ExampleStore | `--with-ngrx-signals` |

## Hooks en templates/.claude/hooks/

| Hook | Evento Claude Code | Propósito | Dependencias |
|---|---|---|---|
| `session-start.js` | SessionStart | Inyecta índices core, objetivo del brief y pendientes del último task-spec. Audita frescura del brief. **Escribe el discovery flag** | indices/, context/brief.md, task-spec |
| `prompt-context.js` | UserPromptSubmit | Reinyecta el `## Out of scope` del brief y las casillas abiertas del spec. Dedup por contenido, refresco cada 8 prompts | context/brief.md, task-spec |
| `pre-write-guard.js` | PreToolUse (Edit/Write) | 4 capas: File Protection, Discovery Gate, Architect Guard (ARCH-01→12, A11Y, LLM, SEC, **SEC-RLS-01/02**), Context Injection. Incluye **Circuit Breaker** (3 bloqueos idénticos → escalar al humano) | discovery flag, blueprint.json |
| `harness-gate.js` | PreToolUse (Edit/Write) | Generalization Gate + Placement Guard sobre el harness mismo (rules/, learnings.md, ANTI-PATTERNS.md, CLAUDE.md, scripts/) — ver HOOKS-SYSTEM.md §8 | — |
| `bash-guard.js` | PreToolUse (Bash) | Bloquea creación de fuentes via Bash (`>`, `touch`, `cp`, `mv`, `ng generate`), destructivos sobre dirs críticos, y **Approval Gate** de operaciones DB irreversibles | — |
| `spec-diff-check.js` | PreToolUse (Bash → git commit) | Bloquea el commit si hay componentes/facades nuevos sin registrar en índices | session-writes.json |
| `discovery-tracker.js` | PostToolUse (Read) | Crea/appendea el flag cuando se leen `indices/` o `context/` | — |
| `write-tracker.js` | PostToolUse (Edit/Write) | Registra archivos fuente modificados en session-writes.json | — |
| `failure-tracker.js` | PostToolUseFailure | Registra errores en LESSONS_LEARNED.md con dedup y rotación (max 20) | — |
| `compact-recovery.js` | PostCompact | Re-inyecta índices (selectivo + cortado en `DETAIL:BEGIN`) y **solo las casillas pendientes** del spec | discovery flag, task-spec |
| `spec-reflection.js` | Stop | Verifica el "Criterio de done" del task-spec activo con evidencia del filesystem. Anti-bucle por estado del spec | task-spec, session-writes.json |
| `sync-check.js` | Stop | Compara mtime de fuentes vs índices al cerrar sesión | session-writes.json |
| `context-guardian.js` | Stop | Audita si `context/learnings.md` lleva >14d sin crecer. (La frescura del brief se auditó ya en SessionStart) | — |
| `validators/validate-file-contains.js` | Invocado por skills | Validador genérico: `--directory`, `--pattern`, `--contains`, `--max-age`, `--require-file`. Lo usa `/plan` desde su frontmatter | — |
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
| `a11y-spec.md` | `src/app/**/*.html` | Reglas de accesibilidad: aria-label en iconos de acción, caption en tablas |
| `delegation.md` | `src/app/**/*.ts`, `.html`, `supabase/migrations/**` | Cuándo delegar en un subagente y —más importante— cuándo no. Permisos acotados de `index-syncer` y `code-judge` |

## Subagentes en templates/.claude/agents/

> Corren en su propia ventana de contexto y devuelven un resumen, no volcados de archivos.
> El campo `model:` del frontmatter implementa escalation/fallback: rápido para lo
> mecánico, razonador para juzgar.

| Subagente | Devuelve | Modelo | Tools |
|---|---|---|---|
| `discovery-scout.md` | Qué reutilizar / qué crear / qué evitar | haiku | Read, Grep, Glob |
| `arch-auditor.md` | `lint:arch` + `tsc` comprimidos a violaciones accionables | haiku | Bash, Read, Grep |
| `index-syncer.md` | Diff de índices reconciliados contra el código real | haiku | Bash, Read, Edit, Write, Grep, Glob |
| `supabase-schema.md` | Tablas, FKs y políticas RLS reales según migraciones | haiku | Read, Grep, Glob, Bash |
| `code-judge.md` | Veredicto por criterio contra la rúbrica | opus | Read, Grep, Glob |

`code-judge` **no tiene `Bash`** a propósito: recibe el diff como archivo
(`.claude/temp/review-diff.patch`, que deja `/review`). Con shell podría escribir con
`>` y la regla "el juez no arregla nada" dependería de su buen comportamiento.

## Contratos entre piezas

Dos contratos se pueden romper sin que nada avise hasta que falla en producción:

**Task-spec** — lo comparten cinco piezas: la skill `/plan`, el hook de su frontmatter,
`spec-reflection.js`, `prompt-context.js` y `compact-recovery.js`.
- Nombre `task-spec-YYYYMMDD-HHMMSS.md` (los hooks toman el último por orden alfabético,
  que solo coincide con el cronológico si el formato se respeta)
- Casillas `- [ ]` / `- [x]`
- Encabezados `##` exactos: `Objetivo`, `Artefactos afectados`, `Reglas que aplican`,
  `Pasos de ejecucion`, `Criterio de done`

**Discovery flag** — `$TMPDIR/koa-discovery-{sessionId}.flag`. Lo escriben
`discovery-tracker.js` y `session-start.js`; lo leen el Discovery Gate de
`pre-write-guard.js` y `compact-recovery.js`. Cada línea debe seguir conteniendo
`indices/NOMBRE.md`: `compact-recovery.js` parsea eso para decidir qué re-inyectar.
