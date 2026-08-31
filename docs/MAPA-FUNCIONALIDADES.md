# Mapa de Funcionalidades — Koa Agent CLI + Harness del Template

> Vista panorámica de **qué hace cada pieza** y **cómo se conectan entre sí**.
> Para el detalle módulo a módulo: `indices/CLI-MODULES.md` (generador) y
> `indices/TEMPLATES-REGISTRY.md` (payload).
>
> Este repo tiene dos productos que nunca deben confundirse:
> **el vehículo** (`bin/`, `lib/`) y **el producto** (`templates/`).

---

## 0. La foto de 10.000 pies

```
┌──────────────────────────────────────────────────────────────────────────┐
│  CONTEXTO A — EL GENERADOR  (corre una vez, en la máquina del usuario)   │
│                                                                          │
│   npx create-koa-agent                                                   │
│        │                                                                 │
│        ├─ resolveStack ─ preflight ─ prompts ─ ng new ─ npm install      │
│        └─ copia templates/ ──────────────────────────┐                   │
│                                                      │                   │
│   npx create-koa-agent generate feature <dominio>    │  (post-scaffold)  │
│        └─ escribe 5-7 archivos ya cableados ─────────┤                   │
└──────────────────────────────────────────────────────┼───────────────────┘
                                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  CONTEXTO B — EL PAYLOAD  (vive para siempre en el proyecto generado)    │
│                                                                          │
│   Proyecto Angular 21 + Tailwind v4 + PrimeNG + Supabase + GSAP          │
│   + HARNESS AGÉNTICO:                                                    │
│        memoria (indices/, context/, docs/)                               │
│        reglas path-scoped (.claude/rules/)                               │
│        guardrails (.claude/hooks/)      ← lo que hace que las reglas     │
│        skills + commands + subagentes      no se puedan ignorar          │
│        scripts deterministas (scripts/)                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

**La tesis del producto**: sin hooks, las reglas de un proyecto son un contrato social
que el agente puede ignorar. Con hooks, son constraints del sistema. Todo el harness
existe para convertir *guidelines* en *guardrails*.

---

# PARTE 1 — El generador (Contexto A)

## 1.1 Superficie de comandos

| Invocación | Qué hace | Requisitos |
|---|---|---|
| `npx create-koa-agent` | Modo interactivo: **Full Scaffold** o **Inject-only** | Node 20+, npm, npx |
| `npx create-koa-agent generate feature [nombre] [--type list\|detail\|form]` | Genera un vertical slice completo dentro de un proyecto ya creado | `blueprint.json` + `src/app/` |
| `TEST_MODE=inject node bin/index.js` | Prueba el CLI sin scaffolding completo | — |

### Flags de stack

| Flag | Efecto | Default |
|---|---|---|
| `--no-supabase` | Sin `@supabase/supabase-js` ni `supabase init` | activo |
| `--no-primeng` | Sin PrimeNG ni el provider en `app.config.ts` | activo |
| `--with-gsap` | GSAP para transiciones de página (en vez de View Transitions) | off |
| `--with-ngrx-signals` | `@ngrx/signals` + boilerplate `core/state/` | off |
| `--with-e2e` | `@playwright/test` + `e2e/` + `playwright.config.ts` | off |
| `--with-cursor` / `--with-windsurf` | Adapters de reglas para esos editores | off |

> Los flags se combinan con `koa-config.json` del cwd (`resolveStack()`).
> Los booleanos de *desactivación* usan AND, los de *activación* usan OR.
> Solo se leen claves de una allowlist — nunca se hace spread del objeto crudo.

## 1.2 Los 8 módulos y su responsabilidad única

```
bin/index.js ─────────────── orquesta. Sin lógica de negocio.
   │
   ├─▶ lib/config.js ─────── resolveStack · validateProjectName · validateBlueprintJson
   │                         BLUEPRINT_VERSION (7.0.0) · ANGULAR_MAJOR (21, pineado)
   ├─▶ lib/preflight.js ──── Node/npm/npx (fatales) · git/docker (warnings)
   ├─▶ lib/installer.js ──── SOLO npm/npx: ng new + install + supabase init
   │        └─▶ lib/runner.js ── spawn puro (NPM/NPX, shell=true solo en Windows)
   ├─▶ lib/scaffolder.js ─── SOLO filesystem: copiar, parchear, blueprint.json
   ├─▶ lib/generator.js ──── subcomando `generate feature`
   │        └─▶ lib/feature-templates.js ── 11 plantillas de código (strings puros)
   └─▶ lib/ui.js ─────────── SOLO chalk. Banner + próximos pasos.
```

**Reglas de frontera** (`.claude/rules/cli-architecture.md`): scaffolder nunca ejecuta npm;
installer nunca copia archivos; ui nunca toca el FS; preflight nunca instala nada.

## 1.3 El flujo de un Full Scaffold

```
1. resolveStack()          flags CLI + koa-config.json
2. preflight()             Node 20+ · npm · npx · git? · docker? · valida blueprint.json si existe
3. printBanner()
4. inquirer                acción · nombre de proyecto · AI tools extra
5. mkdir koa-tmp-<random>  ← directorio PADRE temporal (crypto.randomBytes, no Math.random)
6. createAngularProject()  ng new <nombre> --standalone --routing --style=scss
7. installDependencies()   tailwind · postcss · @angular/animations(pineado) · lucide
                           · primeng(condicional) · gsap(SIEMPRE) · supabase(condicional)
                           · vitest + @analogjs (dev) · playwright/ngrx (condicionales)
8. copyTemplates()         todo templates/ excepto boilerplate*/ y adapters/
9. injectBoilerplate()     src/ + scripts/ + 9 parches de configuración
10. rename tmp → final     ← el scaffold es ATÓMICO: se renombra recién al final
11. writeBlueprintJson()   MERGE, no reemplazo
12. printSuccess()
```

Si algo falla en los pasos 6-11, el `koa-tmp-*` se borra completo y no queda basura.

### Los 9 parches de `injectBoilerplate()`

| # | Archivo | Qué se parchea | Por qué |
|---|---|---|---|
| 1 | `src/app/` | Borra el root de `ng new` (`app.ts/html/scss`) y apunta `main.ts` a `AppComponent` | Angular 21 genera un root propio; sin esto la app arranca con la demo de Angular |
| 2 | `tsconfig.json` | Path aliases `@core/*`, `@shared/*`, `@features/*`, `@layout/*` | — |
| 3 | `angular.json` | `src/tailwind.css` en styles · `inlineCritical: false` · target `test` con Vitest · `fileReplacements` de producción | Sin `fileReplacements`, un build prod sale con creds de dev |
| 4 | `src/index.html` | Meta CSP + preconnect de Google Fonts | Incluye `localhost:54321` porque el proyecto nace apuntando a Supabase local |
| 5 | `app.config.ts` | `providePrimeNG` + preset Aura + `cssLayer` ordenado con Tailwind | Solo si `stack.primeng` |
| 6 | `playwright.config.ts` + `e2e/` | Solo si `--with-e2e` | — |
| 7 | `core/state/` | NgRx Signal Store, solo si `--with-ngrx-signals` | — |
| 8 | `app.config.ts` | `withViewTransitions()`, solo si **no** hay GSAP | Las dos vías de transición son mutuamente excluyentes |
| 9 | `package.json` | ~25 scripts (`test:*`, `typecheck`, `lint:arch*`, `claude:*`, `supabase:*`, `indices:sync`) | Es la superficie que consumen los hooks y los subagentes |

## 1.4 Quién es dueño de qué (re-runs y upgrades)

Correr el CLI dentro de una carpeta que ya existe **no pisa el trabajo ajeno**:

| Zona | Comportamiento | Motivo |
|---|---|---|
| `.claude/`, `docs/`, `CLAUDE.md`, `AGENTS.md` (`CLI_OWNED`) | **Se sobrescribe siempre** | Es el harness: lo que el CLI mantiene y actualiza |
| `context/`, `indices/`, `supabase/`, `.gitignore` | **Se preserva si ya existe** | Es contenido del proyecto; puede venir de Wikiflow o del auto-indexer |
| `blueprint.json` | **Merge por campos** | Contrato de dos productores (ver abajo) |

### `blueprint.json` — contrato compartido

```jsonc
{
  // ── escribe el CLI ──
  "name": "koa-agent-blueprint", "version": "7.0.0", "generatedAt": "...",
  "scaffoldMode": "full-scaffold" | "inject-only",
  "managedPaths": [".claude/**", "docs/**", "CLAUDE.md", "AGENTS.md",
                   "scripts/architect.js", ".mcp.json"],
  "stack": { "angular": true, "primeng": true, "supabase": true, ... },

  // ── escribe Wikiflow (opcional, el CLI nunca lo pisa) ──
  "tier": "solo" | "starter" | "agency",
  "team": { "size": 3, "horizon6mo": "growing" },
  "product": { "complexity": "domain-heavy", "lifespan": "long-lived" }
}
```

En `inject-only` el CLI **no** reclama autoridad sobre `stack` (no instaló nada).
`managedPaths` se deriva de `CLI_OWNED` para que lo declarado y lo ejecutado no diverjan.

## 1.5 `generate feature` — el vertical slice

Tres arquetipos, misma arquitectura canónica **UI → Facade → Repository → SupabaseService**:

| `--type` | Archivos | Qué genera |
|---|---|---|
| `list` (default) | 7 | repository + facade + smart-page (bento-grid) + dumb-card + skeleton + 2 specs |
| `detail` | 5 | repository + facade-detail + smart-page-detail (grid 2/3 + aside) + 2 specs |
| `form` | 5 | repository + facade + smart-page-form (`.page-narrow`) + 2 specs |

Nomenclatura derivada de un solo input: `productos` → `{{domain}}=productos`,
`{{Domain}}=Producto`, `{{Domains}}=Productos`. Verifica conflictos **antes** de escribir
nada — o escribe todo, o no escribe ninguno.

---

# PARTE 2 — El harness del template (Contexto B)

Lo que recibe el proyecto generado. Seis capas que se refuerzan entre sí.

```
┌─ CAPA 1 · MEMORIA ────────────────────────────────────────────────┐
│  indices/ (15)  ·  context/ (5)  ·  docs/ (6)  ·  CLAUDE.md/AGENTS.md│
│  "qué existe ya" + "de qué se trata el negocio"                    │
└────────────────────────────────────────────────────────────────────┘
┌─ CAPA 2 · REGLAS path-scoped (15) ────────────────────────────────┐
│  .claude/rules/*.md — se inyectan SOLO si el archivo editado matchea│
└────────────────────────────────────────────────────────────────────┘
┌─ CAPA 3 · GUARDRAILS (18 hooks, 7 eventos) ───────────────────────┐
│  El único mecanismo que puede DECIR QUE NO. exit 2 = bloqueado.    │
└────────────────────────────────────────────────────────────────────┘
┌─ CAPA 4 · PROCEDIMIENTO (15 skills · 11 commands · 5 subagentes) ─┐
│  Cómo se hace cada cosa, y a quién se delega para no gastar contexto│
└────────────────────────────────────────────────────────────────────┘
┌─ CAPA 5 · VERIFICACIÓN DETERMINISTA (scripts/) ───────────────────┐
│  architect.js (AST, 26 reglas) · indices-sync.js · smoke · provocar│
└────────────────────────────────────────────────────────────────────┘
┌─ CAPA 6 · RUNTIME (boilerplate Angular + .mcp.json) ──────────────┐
│  BaseFacade/SWR · repositories · design system · MCP TS/Angular/SB │
└────────────────────────────────────────────────────────────────────┘
```

## 2.1 Capa 1 — Memoria

### `indices/` — 15 archivos, la memoria del **código**

13 se auto-generan con `npm run indices:sync` entre marcadores
`<!-- AUTO-GENERATED:BEGIN/END -->` (COMPONENTS, SERVICES, FACADES, MODELS, DIRECTIVES,
GUARDS, UTILS, PIPES, STYLES, STORES, DATABASE, ROUTES, USAGE-MAP). Dos son manuales:
**LAYOUTS.md** (skeletons de arquetipos de página) y **ANTI-PATTERNS.md** (12 anti-patrones:
AP-001→006 los bloquea el Architect Guard, AP-007→012 solo los ve `code-judge` o una persona).

### `context/` — 5 archivos, la memoria del **negocio** (gitignored)

| Archivo | Contenido | Quién lo consume |
|---|---|---|
| `brief.md` | Objetivo de la sesión + `## Out of scope` | `session-start.js`, `prompt-context.js` |
| `domain.md` | Entidades, reglas de dominio, terminología | `discovery-scout`, `code-judge` |
| `constraints.md` | Deuda aceptada, límites del cliente, integraciones | lectura bajo demanda |
| `learnings.md` | Insights validados por el humano | `context-guardian.js` (avisa a los 14 días) |
| `decisions/` | ADRs (`TEMPLATE.md` para copiar) | lectura bajo demanda |

## 2.2 Capa 2 — Las 15 reglas path-scoped

Se inyectan automáticamente **solo cuando el archivo editado coincide** con su frontmatter
`paths:`. No cargan todas al inicio — eso es lo que las hace baratas.

| Al editar… | Reglas que se activan |
|---|---|
| `src/app/**/*.ts` + `.html` | `architecture`, `facades`, `swr-pattern`, `testing-tdd`, `state-management` |
| `core/models/**`, `core/facades/**` | `models`, `facades` |
| `shared/**`, `features/**` | `component-selection`, `screen-contract` |
| `**/*.html`, `styles/**` | `visual-system`, `visual-tokens`, `ai-readability`, `a11y-spec` |
| `features/**`, `layout/**` | `notifications`, `layout-blueprints` |
| `supabase/**`, `core/services/**` | `database` |

## 2.3 Capa 3 — Los hooks (el corazón del producto)

**18 archivos**: 15 cableados en `.claude/settings.json` (+ `post-edit.js` desde `.claude/scripts/`),
1 opt-in (`context-enrichment-guard.js`) y 1 validador genérico invocado desde skills.

### Línea de tiempo de una sesión

```
▼ SessionStart
  session-start.js ········ inyecta índices core + objetivo del brief + pendientes del task-spec
                            y ESCRIBE el discovery flag (si ya tenés los índices, el Gate no aplica)

▼ UserPromptSubmit  (antes de que el agente vea el prompt)
  prompt-context.js ······· re-inyecta SOLO lo que se degrada: "Out of scope" + casillas pendientes
                            con dedup (nunca en cada turno: un recordatorio constante deja de leerse)

▼ PreToolUse · Edit|Write|MultiEdit   ← los 4 en cadena
  1. sdd/spec-gate.js ····· ¿hay specs/ y no hay spec activa con plan? → BLOQUEA
  2. pre-write-guard.js ··· 4 capas: File Protection · Discovery Gate · Architect Guard
                            · Context Injection (+ CIRCUIT BREAKER a los 3 bloqueos iguales)
  3. harness-gate.js ······ Generalization Gate sobre rules/, learnings, ANTI-PATTERNS, CLAUDE.md
  4. sdd/plan-injector.js · inyecta spec + plan + tasks vivos como contexto

▼ PreToolUse · Bash
  bash-guard.js ··········· prohíbe crear .ts/.html/.scss por Bash · rm destructivos
                            · install/uninstall sin confirmar · Approval Gate de Supabase
  spec-diff-check.js ······ intercepta `git commit`: ¿componentes/facades nuevos sin índice? → BLOQUEA

▼ PostToolUse · Read
  discovery-tracker.js ···· detectó Read("indices/*.md") → escribe el discovery flag

▼ PostToolUse · Edit|Write|MultiEdit
  write-tracker.js ········ apunta el archivo en .claude/temp/session-writes.json
  scripts/post-edit.js ···· Prettier automático

▼ PostToolUseFailure
  failure-tracker.js ······ registra el fallo en LESSONS_LEARNED.md (dedup, máx 20, rotación)

▼ PostCompact
  compact-recovery.js ····· re-inyecta los índices que el agente YA había leído (lee el flag),
                            y solo hasta <!-- DETAIL:BEGIN --> (Quick Reference, no ejemplos)

▼ Stop  (los 4 en cadena)
  sdd/hotfix-autoclose.js · SessionEnd: red de seguridad; cierra el hotfix que quedo abierto
  spec-reflection.js ······ devuelve las casillas `- [ ]` del task-spec que siguen abiertas
  sync-check.js ··········· compara mtime de session-writes vs indices/ → ¿faltó sincronizar?
  context-guardian.js ····· "¿aprendiste algo hoy?" si learnings.md lleva >14 días quieto
```

### Las 4 capas de `pre-write-guard.js`

| Capa | Qué hace |
|---|---|
| **File Protection** | Bloquea editar `.claude/hooks/`, `settings.json`, `architect.js` — el agente no puede desarmar sus propios frenos |
| **Discovery Gate** | Sin el flag de índices en contexto, no se escribe en `src/app/` |
| **Architect Guard** | Validación en tiempo real del contenido nuevo: `*ngIf`, `@Input()`, colores Tailwind hardcodeados, import de Supabase en UI, `@angular/animations`, `@keyframes`, RLS (`SEC-RLS-01/02/03`), a11y (`A11Y-03`) |
| **Context Injection** | Inyecta el contexto relevante al tipo de archivo, con dedup por sesión (1 vez por categoría) |
| **Circuit Breaker** | Si el mismo `{archivo, motivo}` se bloquea 3 veces, deja de explicar y ordena escalar al humano |

### El `harness-gate.js` — el hook que vigila al harness

Inspirado en HarnessCompass (arXiv:2608.01918). Dos familias:
- **A. Generalization Gate** — una "lección" que cita `fix-042` sin criterio de aplicabilidad es
  una receta, no una regla. Bloquea también los snippets de despacho por keyword-matching.
- **B. Placement** — la lógica determinista vive en código (scripts/hooks), nunca como prosa
  disfrazada de mecanismo, ni al revés (consejo sin mecanismo colado en un script).

`specs/**` queda deliberadamente **fuera** de este gate: ahí los track IDs *son* el contenido legítimo.

### Contratos compartidos entre hooks (romper uno rompe varios)

| Contrato | Formato | Quién escribe | Quién lee |
|---|---|---|---|
| **Discovery flag** | `$TMPDIR/koa-discovery-{sessionId}.flag`, líneas con `indices/NOMBRE.md` | `discovery-tracker.js`, `session-start.js` | `pre-write-guard.js`, `compact-recovery.js` |
| **session-writes** | `.claude/temp/session-writes.json` | `write-tracker.js` | `sync-check.js`, `spec-diff-check.js`, `spec-reflection.js`, `index-syncer` |
| **task-spec** | `task-spec-YYYYMMDD-HHMMSS.md`, casillas `- [ ]`, headers `##` exactos | skill `/plan` | `spec-reflection.js`, `prompt-context.js`, `compact-recovery.js`, el validador del frontmatter de `/plan` |
| **AUTO-GENERATED** | `<!-- AUTO-GENERATED:BEGIN/END -->` | `indices-sync.js`, `assignments-sync.js` | todo el que edite un índice a mano |

> Los hooks tienen **9 tests de contrato** (`npm run claude:test-hooks`).
> No son opcionales: `compact-recovery.js` estuvo roto durante versiones enteras
> precisamente porque ningún test lo ejecutaba nunca.

## 2.4 Capa 4 — Skills, comandos y subagentes

### Los 5 subagentes (ventana de contexto propia)

| Subagente | Para qué existe | Modelo | Tools |
|---|---|---|---|
| `discovery-scout` | "¿qué ya existe que pueda reutilizar?" → **veredicto corto**, nunca volcados de archivos | haiku | Read, Grep, Glob |
| `arch-auditor` | `lint:arch` + `tsc` comprimidos a las 10 líneas que importan de miles | haiku | Bash, Read, Grep |
| `index-syncer` | Reconcilia `indices/*.md` con el código real (arregla lo que `sync-check` solo detecta) | haiku | Bash, Read, Edit, Write, Grep, Glob |
| `supabase-schema` | Reconstruye el esquema real leyendo las migraciones en orden | haiku | Read, Grep, Glob, Bash |
| `code-judge` | Veredicto de **diseño** contra la rúbrica — lo que ningún regex ve | **opus** | Read, Grep, Glob |

Dos decisiones deliberadas: el juez usa un modelo **más capaz** que el que genera el código
(un evaluador que razona igual que el generador no ve sus errores), y `code-judge` **no tiene
`Bash`** — con `Bash` podría escribir con `>` y "el juez no arregla nada" pasaría de hecho a promesa.

### Las 15 skills

| Grupo | Skills | Rol |
|---|---|---|
| **Proceso** | `plan`, `review`, `sync-indices`, `harness-feedback`, `verify`, `grill_me` | El ciclo de trabajo. `/plan` tiene un **hook en su frontmatter** que valida el formato del task-spec: si falta una sección, la sesión no termina |
| **Angular** | `angular-component`, `angular-signals`, `angular-forms`, `angular-primeng` | Model-invoked por `paths:` — se activan al tocar el archivo correspondiente |
| **Diseño** | `design-system`, `form-ux` | Tokens, Frosted Cards, Bento Grid, dark mode |
| **Datos** | `supabase-data-model` | Migraciones, RLS, queries |
| **SDD** | `sdd` | Motor Spec-Driven Development (11 comandos) |
| **Meta** | `writing-great-skills` | Cómo escribir skills (referencia, user-invoked) |

### El motor SDD — incluido pero **dormido**

Sin carpeta `specs/`, `spec-gate.js` deja pasar todo. Es fail-open a propósito: se puede
embarcar por defecto sin romper a quien no lo usa.

```
CAPA DE EQUIPO (opcional)          CICLO SDD                        CIERRE
/assign-new  "hay que hacer X"     /spec-new    → spec.md      ┐
/assign-list "¿qué me toca?"       /spec-activate → .active    │  código + tests
/assign-claim ASG-A-003            /spec-plan   → plan.md      ├─ (hooks validan
      └─ genera el track con        /spec-tasks  → tasks.md     │   cada escritura)
         TU código de autor         ...implementar...          │
                                    /spec-verify → acceptance.md ┘

Tracks livianos:  /fix-new + /fix-close   (bug con root cause + test de regresión)
                  /hotfix                  (el "cómo" es obvio — cierra con /hotfix-close)
```

Numeración **por autor** (`spec-0004-A-slug`, `fix-012-B-slug`), no global: un contador global
hace que dos devs en ramas distintas saquen el mismo ID y git haga merge sin conflicto.
`assignments-sync.js` regenera las tablas del tablero; `assignments-audit.js` audita
naming, colisiones, refs colgantes y filas stale — sin escribir nada.

## 2.5 Capa 5 — Verificación determinista

| Script | Qué comprueba | Cuándo |
|---|---|---|
| `architect.js` | Reglas `ARCH-*` sobre el AST real de TypeScript (no regex sobre código): UI sin Supabase, componentes sin Services inyectados, facades/services con su `.spec.ts`, `OnPush` obligatorio, sin `@angular/animations`, sin `*ngIf`/`[ngClass]`, sin `@keyframes`, sin colores Tailwind hardcodeados, disciplina de clases del DS con ratchet, contraste AA, sprawl del bento | `npm run lint:arch` · `arch-auditor` |
| `lint-arch-wrapper.js` | Memoria de fallos: guarda el fallo en `arch-last-failure.json`, y cuando pasa escribe la lección en `LESSONS_LEARNED.md` | envuelve al anterior |
| `indices-sync.js` | Auto-indexer AST (1343 líneas) con caché incremental por mtime | `npm run indices:sync` · `index-syncer` |
| `check-bento-classes.js` | Freno al sprawl del bento contra un allowlist (cableado como ARCH-21) | `npm run check:bento` |
| `provocar-reglas.mjs` | **Pregunta si cada regla PUEDE fallar**: arma un sandbox que la viola y exige que el linter la nombre. Una regla que no dispara ante su propia violación es decoración | al cerrar sesión |
| `smoke-scripts.mjs` | Lo mismo para los scripts de `package.json`: mete un defecto a propósito y exige que el script se dé cuenta. Restaura siempre en el `finally` | al cerrar sesión |
| `verificar-specs.mjs` | Integridad de enlaces entre specs (las dos puntas existen) | `npm run lint:specs` |
| `set-env.js` | Inyecta creds en `environment.prod.ts` desde el entorno; falla si faltan | CI/CD |

> **El namespace de códigos está repartido en tres superficies**, sin registro único:
> `architect.js` (ARCH-01…11, 15…19, 21…26 · A11Y-03 · SEC-RLS-01/02/03, sobre AST),
> `scripts/lib/a11y-guardrails.js` (ARCH-20) y `.claude/hooks/pre-write-guard.js`
> (ARCH-12, ARCH-13 · A11Y-01, A11Y-02 · LLM-01, LLM-02, por regex en cada escritura).
> No hay hueco de numeración; la única regla documentada sin implementación es `ARCH-14`.
> Ver `docs/auditoria/HALLAZGOS.md` → `INC-001`.

> `provocar-reglas.mjs` y `smoke-scripts.mjs` son la respuesta a
> `docs/CHEQUEOS-QUE-NO-CHEQUEAN.md`: el problema de los chequeos verdes que nunca
> podrían haber salido rojos. `ARCH-24` y `ARCH-26` estuvieron muertas hasta que esto existió.

## 2.6 Capa 6 — Runtime del proyecto generado

### La arquitectura de datos (la ley que todo el harness protege)

```
Smart Component (features/)          ← inyecta SOLO Facades. OnPush obligatorio.
       │                               Llama facade.initialize() en ngOnInit y nada más.
       ▼
   Facade (core/facades/)            ← extiende BaseFacade<T>: patrón SWR completo
       │                               · 1ª carga → skeleton
       ▼                               · re-visita → cache inmediato + refresco silencioso
  Repository (core/repositories/)    ← ÚNICO lugar que llama .from('tabla')
       │
       ▼
  SupabaseService (core/services/)   ← ÚNICO lugar que conoce @supabase/supabase-js

Dumb Component (shared/components/)  ← signal inputs/outputs, cero inyección de datos
```

Cada eslabón de esa cadena tiene un guardrail que lo defiende: ARCH-01 (UI sin Supabase),
ARCH-02 (componentes sin Services), ARCH-03 (spec compañero), ARCH-04 (OnPush).

### Boilerplate incluido

- **Layout**: `app-shell`, `topbar`, `sidebar`, `layout-drawer`
- **Shared**: `kpi-card`, `alert-card`, `empty-state`, `error-state`, `skeleton-block`, `badge`, `tabs`, `drawer`, `icon`, `section-hero`
- **Directivas**: `animate-in`, `card-hover`, `press-feedback`, `bento-grid-layout`, `bento-reveal`, `scroll-reveal`, `modal-overlay`, `click-outside`, `has-role`, `search-shortcut`, `stable-width`, `scroll-container`
- **Core services**: auth facade, theme, layout, breadcrumb, notifications, toast, confirm-modal, modal-overlay, search-panel, gsap-animations, error-sanitizer
- **Seguridad**: guards (`auth`, `guest`, `role`), interceptor de auth, `global-error-handler`, migraciones de `profiles` + RLS de protección de roles
- **Estilos**: tokens, bento-grid, page-shell, view-transitions, overrides de PrimeNG

### `.mcp.json` — tres servidores MCP

| Servidor | Para qué | Nota de seguridad |
|---|---|---|
| `typescript` (`ts-lsp-mcp`) | Navegación de tipos real | — |
| `angular` (`@angular/cli mcp`) | Conocimiento del framework | — |
| `supabase` | Inspección del esquema | **`--read-only` + `--project-ref`** — mínimo privilegio. El token va por env var, nunca inline. Las escrituras van por migraciones versionadas que **corre un humano** |

---

# PARTE 3 — Cómo interactúa todo: el flujo de 5 pasos

```
1 · DESCUBRIR   SessionStart ya inyectó los índices core y el objetivo.
                ¿Necesitás descubrimiento dirigido? → discovery-scout (veredicto, no volcado).
                ⛔ El Discovery Gate te bloquea si escribís sin índices en contexto.

2 · PLANIFICAR  /plan → task-spec.
                ⛔ Su formato lo valida un hook del propio frontmatter de la skill:
                   si falta "## Criterio de done", la sesión no termina.
                Marcá las casillas [x] al avanzar: 3 hooks dependen de ellas.

3 · EJECUTAR    Escribís código.
                → las reglas path-scoped se inyectan solas según el archivo
                → spec-gate / pre-write-guard / harness-gate / plan-injector corren en cadena
                → write-tracker anota, post-edit formatea
                ⛔ 3 bloqueos idénticos = circuit breaker: parás y escalás al humano.

4 · VALIDAR     arch-auditor → lint:arch + tsc comprimidos.
                /review → code-judge juzga el DISEÑO contra la rúbrica.
                /verify → Playwright MCP confirma que renderiza de verdad, no que compila.

5 · SINCRONIZAR index-syncer reconcilia indices/*.md con el código real.
                ⛔ spec-diff-check bloquea el `git commit` si hay componentes o facades
                   nuevos sin registrar en su índice.
                Stop hooks: pendientes del spec · índices atrasados · "¿aprendiste algo?"
```

## El bucle de mejora del propio harness

Lo que distingue a este blueprint de un scaffold normal: **el harness se audita a sí mismo**.

```
failure-tracker  ──▶ LESSONS_LEARNED.md ──┐
lint-arch-wrapper ──▶ (lecciones de lint) ─┤
harness-feedback ──▶ fricción reportada ───┼──▶ context/learnings.md
context-guardian ──▶ "¿aprendiste algo?" ──┘         │
                                                     ▼
                                            harness-gate.js
                                    (¿es un principio reutilizable
                                     o una receta para un track?)
                                                     │
                                                     ▼
                                     .claude/rules/ · indices/ANTI-PATTERNS.md
```

Y en paralelo, la pregunta que ningún CI hace: `provocar-reglas.mjs` y `smoke-scripts.mjs`
verifican que los chequeos **puedan fallar**, no que pasen.

---

## Referencias

| Quiero entender… | Leer |
|---|---|
| Los módulos del generador uno por uno | `indices/CLI-MODULES.md` |
| Qué hay en `templates/` y a dónde va | `indices/TEMPLATES-REGISTRY.md` |
| El sistema de hooks en detalle | `templates/docs/HOOKS-SYSTEM.md` |
| Por qué existen `provocar` y `smoke` | `templates/docs/CHEQUEOS-QUE-NO-CHEQUEAN.md` |
| Las fronteras entre módulos del CLI | `.claude/rules/cli-architecture.md` |
| El contrato de `templates/` | `.claude/rules/templates-contract.md` |
| El ciclo SDD completo | `templates/.claude/skills/sdd/SKILL.md` |
