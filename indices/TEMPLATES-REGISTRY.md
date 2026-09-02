# Templates Registry — Mapa del Payload

> Documenta qué hay en `templates/` y para qué sirve cada pieza.
> Actualiza esta tabla al agregar, modificar o eliminar contenido de templates/.

## Payload principal (siempre copiado)

| Ruta en templates/ | Destino en proyecto | Propósito |
|---|---|---|
| `templates/CLAUDE.md` | `CLAUDE.md` | Entry point para Claude Code. Stub que apunta a `.claude/CLAUDE.md`. Indica que otros AI tools deben usar `AGENTS.md`. Contiene `{{PROJECT_NAME}}` y `{{BLUEPRINT_VERSION}}`. |
| `templates/AGENTS.md` | `AGENTS.md` | **Master universal** self-contained para todos los AI tools (OpenCode, Copilot, Codex…). Workflow de 5 pasos, reglas arquitectónicas, anti-patterns, los 15 índices (eran 10 hasta `HUE-030`; `contracts.test.js` compara ahora esa lista contra `templates/indices/`). Contiene `{{PROJECT_NAME}}` y `{{BLUEPRINT_VERSION}}`. |
| `templates/gitignore.template` | `.gitignore` | .gitignore con entradas para Angular, Supabase, GSAP, Vitest, Playwright. |
| `templates/docs/` | `docs/` | Guías de usuario: HOOKS-SYSTEM.md, TECH-STACK-RULES.md, BRAND_GUIDELINES.md, PRODUCT-VISION.md, CLAUDE-USER-GUIDE.md, CHEQUEOS-QUE-NO-CHEQUEAN.md y **CONTRATOS.md** (los 21 artefactos compartidos: qué pieza los escribe, quién los lee, cuándo se borran — generado desde `contracts.js`, `ACO-013`). |
| `templates/indices/` | `indices/` | 15 índices. **13 se auto-generan** con `npm run indices:sync` (COMPONENTS, SERVICES, FACADES, MODELS, DIRECTIVES, GUARDS, UTILS, PIPES, STYLES, STORES, DATABASE, ROUTES, USAGE-MAP): el contenido va entre marcadores `<!-- AUTO-GENERATED:BEGIN/END -->` y se sobrescribe. Los 2 restantes (ANTI-PATTERNS, LAYOUTS) son manuales. **ANTI-PATTERNS.md no viene vacío**: 12 anti-patrones en dos grupos — AP-001→006 los bloquea el Architect Guard, AP-007→012 son de diseño y solo los ve `code-judge` o una persona. |
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
| `templates/.claude/settings.json` | `.claude/settings.json` | Cableado de hooks. **9 eventos**: SessionStart (con matcher `startup\|resume\|clear\|fork`), UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PostCompact, SessionEnd, SubagentStop, Stop. **18 hooks cableados**. `settings.test.js` verifica que cada comando apunte a un archivo que existe y que el evento sea real. |
| `templates/.claude/settings.local.json` | `.claude/settings.local.json` | Permisos de desarrollo pre-configurados. |
| `templates/.claude/author.local.json.example` | `.claude/author.local.json.example` | Plantilla del código de autor (una letra) para la capa multi-dev del SDD. Se copia a `author.local.json`, que va gitignored. |
| `templates/.claude/commands/` | `.claude/commands/` | 12 slash commands del SDD: `/spec-*` (5), `/fix-*` (2), `/hotfix`, `/hotfix-close`, `/assign-*` (3). |
| `templates/.claude/hooks/` | `.claude/hooks/` | 19 archivos: 17 cableados en settings.json (incl. `sdd/` y `harness-gate.js`; el 18º comando cableado es `.claude/scripts/post-edit.js`), `context-enrichment-guard.js` opt-in (no cableado), y `validators/validate-file-contains.js` invocado por skills (ver tabla de hooks abajo). |
| `templates/.claude/hooks/lib/` | `.claude/hooks/lib/` | Núcleo compartido (ADR-001), 9 módulos CommonJS: `payload` (stdin, la única fuente contractual), `session` (estado por sesión e hilo — `CLAUDE_SESSION_ID` no existe), `paths` (clasificación de rutas), `budget` (recorte, dedup por contenido y avisos), `contracts` (los artefactos del harness como datos, con test contra el filesystem), `blueprint` (validación de `blueprint.json`), `guard-rules` (las 20 reglas que emite el Architect Guard) `lessons` (el formato de `LESSONS_LEARNED.md`) e `indices` (qué está declarado en un índice: se pregunta por la FILA, no por el texto — `HUE-014`). |
| `templates/.claude/agents/` | `.claude/agents/` | 5 subagentes con ventana de contexto propia (ver tabla abajo). |
| `templates/.claude/rules/` | `.claude/rules/` | 15 reglas arquitectónicas path-scoped. |
| `templates/.claude/skills/` | `.claude/skills/` | 15 skills, incl. `harness-feedback` (ver tabla de skills abajo). |
| `templates/.claude/scripts/` | `.claude/scripts/` | post-edit.js (Prettier automático), `contracts-doc.js` (genera `docs/CONTRATOS.md` desde el registro; `--check` falla si quedó desfasado), más `package.json` que declara la carpeta como ESM — sin él, cada edición del proyecto generado imprime un `MODULE_TYPELESS_PACKAGE_JSON` (`DEC-003`). |
| `templates/.claude/tests/` | `.claude/tests/` | 33 archivos de tests de contrato, 893 tests (`node --test`, `npm run claude:test-hooks`). Incluye `doc-links.test.js`, que verifica que toda referencia `archivo.md#ancla` del payload resuelva y que toda regla emitida esté documentada, `harness-gate.test.js` (32 tests: el Generalization Gate, la localidad de `GATE-A1`, el Capability Guard `GATE-C1` y el Region Guard `GATE-D1`), `contracts.test.js`, que contrasta los **21 artefactos** del registro contra el filesystem y verifica que `docs/CONTRATOS.md` siga sincronizado, `task-spec.test.js`, que prueba las tres convenciones que atan a `/plan` con sus cinco consumidores, e `indices-authority.test.js`, que fija el reparto de `DUP-003`. |

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
| `templates/boilerplate/src/app/shared/components/section-hero/section-hero.component.ts` | `src/app/shared/components/section-hero/section-hero.component.ts` | **Cabecera canónica de sección.** Modo `full` y `slim`, KPIs integrados con sparkline, chips, menús desplegables y skeletons. Sin él cada página escribe su propio hero. Los mapeos dato → token del DS viven al lado, en `section-hero.tokens.ts` (`INC-008`): son puros y se testean sin montar el componente. | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/shared/components/tabs/tabs.component.ts` | `src/app/shared/components/tabs/tabs.component.ts` | Tabs con 3 variantes (line/segmented/pill) y colapso a select según `subnav-tier.utils`. | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/shared/components/badge/badge.component.ts` | `src/app/shared/components/badge/badge.component.ts` | Píldora de estado. Clases `badge-*` literales, nunca concatenadas: el scanner de Tailwind v4 poda por contenido. | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/layout/layout-drawer.component.ts` | `src/app/layout/layout-drawer.component.ts` | Panel lateral del shell. Empuja el contenido en desktop (con `.force-compact` en el bento), fullscreen en mobile. Consume `LayoutDrawerService`. | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/core/utils/request-guard.utils.ts` | `src/app/core/utils/request-guard.utils.ts` | `createRequestGuard()`: descarta respuestas de red fuera de orden en Facades con filtro variable. Ver `facades.md` §9. | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/core/utils/layout-tier.utils.ts` | `src/app/core/utils/layout-tier.utils.ts` | Functional Core del patrón App-like: `widthToTier`, `sliceByBudget`, `visibleWithLoadMore`. | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/core/utils/db-error.utils.ts` | `src/app/core/utils/db-error.utils.ts` | `mensajeSeguroDeBd()`: ÚNICO sanitizador de errores de BD (SQLSTATE → mensaje, heurística por texto para red/RLS sin código). `ErrorDeBd` conserva el SQLSTATE que `new Error(error.message)` tira. `BaseFacade.sanitizeError` delega acá. Ver `facades.md` §11. | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/core/utils/` (resto) | `src/app/core/utils/` | Funciones puras con sus specs: `validation` (email, con TLD obligatorio), `phone`, `name`, `percentage`, `search-filter` (normaliza acentos), `auth-errors` (mapea errores de Supabase a mensajes de UI), `date`. Todas exportadas por el barrel `index.ts`. | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/core/pipes/safe.pipe.ts` | `src/app/core/pipes/safe.pipe.ts` | Pipe `safe` para sanitizar URLs/HTML con DomSanitizer. | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/core/directives/` | `src/app/core/directives/` | 11 directivas: `animate-in`, `bento-grid-layout`, `bento-reveal` (pre-hide + reveal sin flash), `card-hover`, `click-outside`, `has-role`, `modal-overlay`, `press-feedback`, `scroll-container`, `scroll-reveal`, `search-shortcut`, `stable-width`. | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/core/models/layout.model.ts` | `src/app/core/models/layout.model.ts` | Tipo `LayoutTier` (`mobile \| tablet \| desktop`), resuelto por ancho de contenedor. | Siempre en Full Scaffold |
| `templates/boilerplate/src/` | `src/` | Código Angular inicial: layout, auth, dashboard, shared components | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/core/services/` | `src/app/core/services/` | Todos los servicios viven **planos** aquí. No hay subcarpetas: `core/services/ui/` existió por una copia mal hecha y se eliminó en 6.7. | Siempre en Full Scaffold |
| `templates/boilerplate/scripts/` | `scripts/` | `indices-sync.js` (auto-indexer AST con caché incremental: genera 13 índices), `architect.js` (linter arquitectónico, 28 reglas — incl. `SEC-RLS-01/02/03` sobre `supabase/migrations/`), `check-bento-classes.js` (ARCH-21, también suelto con `npm run check:bento`), `lint-arch-wrapper.js`, `set-env.js`, `assignments-sync.js` y `assignments-audit.js` (capa de asignaciones, encendida por `specs/AUTHORS.md` vía `lib/assignments-switch.js` — apagada salen en 0), más `package.json` que declara la carpeta como ESM. | Siempre en Full Scaffold |
| `templates/boilerplate/scripts/lib/` | `scripts/lib/` | Guardrails con tests propios (`npm run lint:arch:test`): `sql-schema` (migraciones → DATABASE.md), `theme-tokens` (ARCH-11/18), `icon-registry` (ICON-01), `a11y-guardrails` (A11Y-03), `tailwind-bare-utilities` (ARCH-22 y ARCH-26, también suelto con `node scripts/lib/tailwind-bare-utilities.js`), `bento-fill-rows` (ARCH-23), `class-discipline` (ARCH-15/16/17/19/24, ratchet), `contrast-check` (ARCH-25: contraste AA en los dos temas, ratchet propio), `nav-integrity` (NAV-01: toda entrada del menú resuelve a una ruta declarada), `rule-wiring` (audita el linter a sí mismo: toda regla registrada tiene que poder fallar), `typescript-guard` (el compilador se carga con un mensaje accionable en sus dos modos de fallo — falta el paquete, o la API cambió — `HUE-018`), `rules-budget` (lo que cada ruta paga en reglas path-scoped, con tope por ruta), `provocacion` (los fixtures: las **28** reglas puestas delante de su propia violación, baseline vacío) y `arch09-cuerpo` (que ARCH-09 mida la clase y no el template inline). **Koa se entrega sin baselines** —ni `class-discipline.baseline.json` ni `contrast.baseline.json`—: tolerancia cero. Se generan con `npm run lint:arch -- --update-ds-baseline` / `--update-contrast-baseline` si el proyecto adopta deuda a propósito. | Siempre en Full Scaffold |
| `templates/boilerplate/src/styles/` | `src/styles/` | `tokens/_variables.scss` (4 capas + vocabulario semántico: `.kpi-value`, `.micro-label`, `.item-title`, `.section-eyebrow`, `.badge-count`), `layout/` (bento con modificadores App-like + page-shell), `motion/`, `vendors/_primeng-overrides.scss`, `_animations.scss` (fallback CSS sin JS). Todo `.scss` bajo `styles/` **debe** estar alcanzable desde `src/styles.scss` vía `@use` — un parcial huérfano es código muerto que nadie nota. | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/core/services/error-sanitizer.service.ts` | `src/app/core/services/error-sanitizer.service.ts` | Convierte errores crudos (SQLSTATE de Postgres, HTTP, Auth de Supabase) en mensajes de usuario. Nunca expone `details`/`hint`, que filtran tablas y policies RLS. | Siempre en Full Scaffold |
| `templates/boilerplate/src/app/core/errors/global-error-handler.ts` | `src/app/core/errors/global-error-handler.ts` | `ErrorHandler` global: atrapa excepciones no manejadas y las muestra saneadas en un toast. Registrado en `app.config.ts`. | Siempre en Full Scaffold |
| `templates/boilerplate/vitest.config.ts` | `vitest.config.ts` | Config de Vitest (reemplaza Karma) | Siempre en Full Scaffold |
| `templates/boilerplate/postcss.config.json` | `postcss.config.json` | PostCSS para Tailwind v4 (.json obligatorio — Angular ignora .js/.mjs) | Siempre en Full Scaffold |
| `templates/boilerplate-e2e/` | `e2e/` + `playwright.config.ts` | Tests E2E con Playwright | `--with-e2e` |
| `templates/boilerplate-ngrx/src/` | `src/app/core/state/` | Signal Store boilerplate con ExampleStore | `--with-ngrx-signals` |

## Hooks en templates/.claude/hooks/

| Hook | Evento Claude Code | Propósito | Dependencias |
|---|---|---|---|
| `session-start.js` | SessionStart | Inyecta índices core, objetivo del brief y pendientes del último task-spec. Audita frescura del brief. **Escribe el discovery flag** | indices/, context/brief.md, task-spec |
| `prompt-context.js` | UserPromptSubmit | Reinyecta el `## Out of scope` del brief y las casillas abiertas del spec. Dedup por contenido, refresco cada 8 prompts | context/brief.md, task-spec |
| `sdd/spec-gate.js` | PreToolUse (Edit/Write) | Bloquea escrituras en código de producto si no hay spec activa con plan. **Fail-open**: sin carpeta `specs/` no bloquea nada | `specs/.active` |
| `pre-write-guard.js` | PreToolUse (Edit/Write) | 4 capas: File Protection, Discovery Gate, Architect Guard (ARCH-01→12, A11Y, LLM, SEC, **SEC-RLS-01/02**), Context Injection. Incluye **Circuit Breaker** (3 bloqueos idénticos → escalar al humano) | discovery flag, blueprint.json |
| `harness-gate.js` | PreToolUse (Edit/Write) | Generalization Gate + Placement Guard sobre el harness mismo (rules/, learnings.md, ANTI-PATTERNS.md, CLAUDE.md, scripts/) — ver HOOKS-SYSTEM.md §8 | — |
| `sdd/plan-injector.js` | PreToolUse (Edit/Write) | Inyecta la spec + plan activos como contexto en cada edición | `specs/.active` |
| `bash-guard.js` | PreToolUse (Bash) | Bloquea creación de fuentes via Bash (`>`, `touch`, `cp`, `mv`, `install`, `ng generate`), destructivos sobre dirs críticos, y **Approval Gate** de operaciones DB irreversibles | — |
| `spec-diff-check.js` | PreToolUse (Bash → git commit) | Bloquea el commit si hay componentes/facades nuevos sin registrar en índices | session-writes.json |
| `discovery-tracker.js` | PostToolUse (Read) | Crea/appendea el flag cuando se leen `indices/` o `context/` | — |
| `write-tracker.js` | PostToolUse (Edit/Write) | Registra archivos fuente modificados en session-writes.json | — |
| `failure-tracker.js` | PostToolUseFailure | Registra errores en LESSONS_LEARNED.md con dedup y rotación (max 20) | — |
| `compact-recovery.js` | PostCompact | Re-inyecta índices (selectivo + cortado en `DETAIL:BEGIN`) y **solo las casillas pendientes** del spec | discovery flag, task-spec |
| `subagent-cleanup.js` | SubagentStop | Cierra el ámbito de hilo del subagente que termina; el estado de sesión sobrevive | `thread-<agent_id>/` |
| `lib/lessons.js` | — | El formato de `LESSONS_LEARNED.md`: tabla entre marcadores `AUTO-GENERATED`, `\|` escapado. Sus dos productores viven en árboles distintos y no pueden importarse entre sí | `.claude/temp/LESSONS_LEARNED.md` |
| `lib/guard-rules.js` | — | Registro de las 20 reglas que emite `pre-write-guard`: qué detecta cada una, su doc y el fixture que la provoca | `docs/TECH-STACK-RULES.md` |
| `sdd/hotfix-autoclose.js` | SessionEnd | Red de seguridad del cierre de `hotfix-*`; el camino normal es `/hotfix-close` | `specs/.active` |
| `spec-reflection.js` | Stop | Verifica el "Criterio de done" del task-spec activo con evidencia del filesystem. Anti-bucle por estado del spec | task-spec, session-writes.json |
| `sync-check.js` | Stop | Compara mtime de fuentes vs índices al cerrar sesión | session-writes.json |
| `context-guardian.js` | Stop | Audita si `context/learnings.md` lleva >14d sin crecer. (La frescura del brief se auditó ya en SessionStart) | — |
| `context-enrichment-guard.js` | — (**OPT-IN**, no cableado) | Day 0 Context Guard: bloquea escribir código si `context/domain.md` o `indices/DATABASE.md` siguen vacíos. No viene activo porque bloquearía un proyecto recién generado | `context/domain.md` |
| `validators/validate-file-contains.js` | Invocado por skills | Validador genérico: `--directory`, `--pattern`, `--contains`, `--max-age`, `--require-file`. Lo usa `/plan` desde su frontmatter | — |
| `post-edit.js` (scripts/) | PostToolUse (Edit/Write) | Corre Prettier automáticamente tras cada escritura | — |

## Skills en templates/.claude/skills/

| Skill | Propósito |
|---|---|
| `angular-component` | Crear/refactorizar componentes standalone v20+ |
| `angular-signals` | Estado reactivo con Signals |
| `angular-forms` | Formularios (Signal Forms / Reactive Forms) |
| `angular-primeng` | Uso correcto de componentes PrimeNG |
| `design-system` | Tokens, Frosted Cards, Bento Grid, dark mode |
| `supabase-data-model` | Tablas, migraciones, RLS |
| `sync-indices` | Sincronizar índices al cerrar sesión |
| `sdd` | **Spec-Driven Development**: ciclo spec → plan → tasks → acceptance + capa de Asignaciones. Stack-agnóstico |
| `verify` | Verificación visual real vía Playwright MCP (login, consola, red, detección de mocks) |
| `form-ux` | Patrones de UX en formularios |
| `grill_me` | Interroga una propuesta antes de volverla spec (Critic Loop) |
| `harness-feedback` | Capturar fricción del harness para mejorarlo |
| `writing-great-skills` | Meta-skill: cómo escribir skills |

## Reglas en templates/.claude/rules/

| Regla | Globs activos | Propósito |
|---|---|---|
| `architecture.md` | `src/app/**/*.ts`, `.html` | Patrón Facade, OnPush, Signals vs RxJS |
| `facades.md` | `core/facades/**`, `core/services/**` | Estructura SWR, signals privados/públicos |
| `models.md` | `core/models/**` | Interfaces globales, tipados strict |
| `visual-system.md` | `src/app/**/*.html`, `styles/**` | Prioridad de UI y la regla 3-2-1 — lo que ningún chequeo verifica |
| `visual-tokens.md` | `src/app/**/*.html`, `styles/**`, `features/**/*.ts`, `shared/**/*.ts` | Color, iconos, tipografía, temas, y lo que el linter ya detecta sobre clases del DS |
| `visual-patterns.md` | `features/**`, `layout/**` | App-like, skeletons, bento, cards, animaciones — la composición de pantalla |
| `ai-readability.md` | `src/app/**/*.html` | data-llm-* atributos semánticos |
| `component-selection.md` | `src/app/shared/**`, `features/**` | Cuándo usar PrimeNG vs custom |
| `testing-tdd.md` | `**/*.spec.ts` | Vitest, equivalencias Jasmine→Vitest |
| `state-management.md` | `src/app/**/*.ts` | Facade vs Signal Store |
| `swr-pattern.md` | `core/services/**` | Stale-While-Revalidate en Facades |
| `notifications.md` | `features/**`, `layout/**` | ToastService, nunca MessageService directo |
| `database.md` | `supabase/**`, `core/services/**` | Migrations SQL, RLS obligatorio |
| `layout-blueprints.md` | `src/app/features/**` | 8 arquetipos de página: hero, grid, componentes por tipo |
| `a11y-spec.md` | `src/app/**/*.html` | Reglas de accesibilidad: aria-label en iconos de acción, caption en tablas |

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
