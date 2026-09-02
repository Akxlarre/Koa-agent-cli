# {{PROJECT_NAME}} — Koa Agent Blueprint v{{BLUEPRINT_VERSION}}

Tu stack: **Angular + Tailwind v4 + PrimeNG + Supabase + GSAP**.

## Sistema de Hooks Activo

Este proyecto tiene guardrails automáticos que se ejecutan sin intervención humana:

- **Session Start** — Al abrir la sesión se te inyectan los índices core (COMPONENTS, SERVICES, FACADES), el objetivo de `context/brief.md` y el trabajo pendiente del último task-spec. No arrancas a ciegas.
- **Prompt Context** — Antes de cada prompt se te recuerda lo que está **fuera de alcance** esta sesión y qué queda pendiente del spec. Es lo primero que se olvida y nada en la conversación lo repite.
- **Discovery Gate** — NO puedes escribir código en `src/app/` sin antes tener los **índices** en contexto. Session Start suele resolverlo por ti; si no, serás bloqueado hasta que leas `indices/`. Leer `context/` no lo levanta: el bloqueo pide índices. Delegar en `discovery-scout` **sí** cuenta — el flag registra quién descubrió y qué.
- **Architect Guard** — Cada Edit/Write es validado en tiempo real. Se bloquean: `*ngIf`, `@Input()`, colores hardcodeados, imports de Supabase en UI, `@angular/animations`, `@keyframes` **en estilos de componente** (`src/app/`; la capa de motion del DS en `src/styles/` está fuera), y migraciones con problemas de RLS (`SEC-RLS-01/02`).
- **File Protector** — No puedes modificar los archivos del sistema de hooks (`.claude/hooks/`, `settings.json`, `architect.js`).
- **Bash Guard** — No puedes crear archivos `.ts/.html/.scss` via Bash. Usa Edit/Write.
- **Compact Recovery** — Si el contexto se compacta, los índices se re-inyectan automáticamente (PostCompact).
- **Failure Tracker** — Los errores de tools se registran en `.claude/temp/LESSONS_LEARNED.md` con dedup y rotación automática (max 20).
- **Circuit Breaker** — Si el mismo Edit se bloquea 3 veces por la misma violación, el guard deja de explicar el arreglo y te ordena parar y escalar al humano. No intentes rodearlo.
- **Subagent Cleanup** — Cuando un subagente termina, su estado de hilo (dedup de avisos, anti-bucle, breaker) se borra. Lo que descubrió o escribió no: eso es de la sesión.
- **Approval Gate** — Las operaciones irreversibles de base de datos (`supabase db push`, `db reset`, `migration repair`, `link`, SQL destructivo) las ejecuta un humano, no tú. Escribe la migración y pide que la corran.
- **Spec Reflection** — Al terminar de responder, se revisa el "Criterio de done" del task-spec activo y se te devuelven los puntos sin cerrar.
- **Harness Gate** — Cada edición a `.claude/rules/`, `context/learnings.md`, `indices/ANTI-PATTERNS.md`, `CLAUDE.md` o `scripts/*.js` se valida contra el Generalization Gate: bloquea lecciones que citan un track ID sin criterio de aplicabilidad, snippets de despacho por keyword-matching, código ejecutable colado en un archivo de guía, o consejos sin mecanismo colados en un script. Y en `.claude/agents/`, `.claude/skills/` y `.claude/commands/` bloquea tocar el **frontmatter que reparte permisos** (`tools:`, `hooks:`, `model:`): el texto de esos archivos es tuyo, esas claves las cambia el humano (`GATE-C1`). La prosa de este archivo no es decorativa — que `code-judge` no tenga `Bash` es la razón por la que «el juez no arregla nada» es un hecho y no una promesa. Y bloquea escribir **dentro** de una región `AUTO-GENERATED` (`GATE-D1`): eso no falla en el momento, desaparece en la próxima corrida del generador. Lo que quieras conservar va **fuera** de los marcadores, que es el lugar que existe para eso.
- **Sync Check** — Al terminar de responder, se verifica si los índices necesitan actualización.
- **Context Guardian** — Al terminar de responder, pregunta si algo de esta sesión merece quedar en `context/learnings.md` (avisa si lleva más de 14 días sin crecer). La frescura del brief se audita al **arrancar**, no al cerrar.
- **Spec Gate (SDD)** — Si el proyecto tiene carpeta `specs/`, no puedes tocar código de producto sin una spec activa con su plan. Sin `specs/`, no bloquea nada.
- **Prettier** — Cada archivo editado se formatea automáticamente.

> Hook adicional **opt-in**: `context-enrichment-guard.js` (Day 0 Context Guard) bloquea escribir
> código mientras `context/domain.md` e `indices/DATABASE.md` sigan vacíos. No viene cableado —
> actívalo en `.claude/settings.json` cuando el dominio lo amerite.

Detalle completo: @docs/HOOKS-SYSTEM.md

## Comandos del proyecto

- Dev: `ng serve`
- Build: `ng build`
- Lint: `ng lint`
- Lint arquitectónico: `npm run lint:arch`
- Supabase local: `npx supabase start`

## Flujo obligatorio (5 pasos)

1. **DESCUBRIR** — Session Start ya te dio los índices core y el objetivo. Para descubrimiento dirigido ("¿qué existe que pueda reutilizar para X?") delega en `discovery-scout`, que te devuelve un veredicto en vez de volcarte archivos. Lee `context/domain.md` si necesitas el vocabulario del negocio. **El Discovery Gate te bloqueará si escribes sin los índices en contexto.**
2. **PLANIFICAR** — `/plan` genera el task-spec. Su formato **lo valida un hook**, no tu buena voluntad: si falta una sección obligatoria, no terminas. Marca las casillas `[x]` a medida que avanzas: Spec Reflection, Prompt Context y Compact Recovery dependen de eso.
3. **EJECUTAR** — Escribe el código. Reutiliza siempre lo existente primero. Los hooks validarán cada escritura en tiempo real.
4. **VALIDAR** — `arch-auditor` corre el linter y el build y te devuelve solo las violaciones. Después `/review` juzga el diseño contra la rúbrica, que es lo que los hooks de regex no pueden ver.
5. **SINCRONIZAR** — `index-syncer` reconcilia `indices/*.md` con el código real: corre `npm run indices:sync` (el AST manda sobre los 13 índices auto-generables) y completa a mano solo lo que ese script no puede deducir. Es el **único** que escribe en `indices/`. El Stop hook te lo recordará si lo olvidas.

## Skills disponibles

| Skill | Cuándo usar |
|---|---|
| `/plan` | SIEMPRE antes de una tarea no trivial (>2 archivos). Genera task-spec con artefactos afectados, reglas que aplican y criterio de done. |
| `/review` | Antes de commitear algo no trivial. Juzga el diseño contra la rúbrica del proyecto — lo que los guardrails de regex no alcanzan. |
| `/angular-component` | Crear o refactorizar un componente Angular |
| `/angular-signals` | Implementar estado reactivo con Signals |
| `/sync-indices` | Sincronizar índices al cerrar sesión. Es la **puerta**: delega en `index-syncer` y no edita nada (`DUP-003`) |
| `/harness-feedback` | Reportar fricción con el harness (hooks/rules/skills) al cerrar sesión — distinto de sync-indices |
| `sdd` | Ciclo Spec-Driven Development. Comandos: `/spec-new`, `/spec-activate`, `/spec-plan`, `/spec-tasks`, `/spec-verify`, `/fix-new`, `/fix-close`, `/hotfix`, `/hotfix-close`, `/assign-new`, `/assign-list`, `/assign-claim` (los `/assign-*` requieren `specs/AUTHORS.md`) |
| `verify` | Verificar visualmente en el navegador (Playwright MCP) que un cambio funciona de verdad — no solo que compila |
| `form-ux` | Diseñar o revisar la UX de un formulario |
| `grill_me` | Estresar una propuesta con preguntas antes de convertirla en spec |

### SDD — cómo activarlo

El motor SDD viene incluido pero **dormido**: sin carpeta `specs/`, el `spec-gate` deja pasar todo.
Para activarlo, ver la sección "Activar el SDD en este proyecto" en `.claude/skills/sdd/SKILL.md`.

## Subagentes disponibles

Corren en su propia ventana de contexto y devuelven un resumen. Úsalos para no
llenar tu contexto principal de output que solo necesitas una vez.

| Subagente | Para qué | Modelo |
|---|---|---|
| `discovery-scout` | Qué ya existe que puedas reutilizar (paso DESCUBRIR) | rápido |
| `arch-auditor` | `lint:arch` + `tsc` comprimidos a violaciones accionables | rápido |
| `index-syncer` | Reconciliar `indices/*.md` con el código real | rápido |
| `supabase-schema` | Esquema real de la BD a partir de las migraciones | rápido |
| `code-judge` | Veredicto de diseño contra la rúbrica (lo invoca `/review`) | razonador |

El juez usa a propósito un modelo más capaz que el que genera el código: un
evaluador que razona igual que el generador no detecta los errores del generador.

### Cuándo delegar

| Situación | Subagente |
|---|---|
| Vas a crear un componente, facade o servicio | `discovery-scout` — te dice qué reutilizar antes de que escribas un duplicado |
| Terminaste de escribir y quieres validar | `arch-auditor` — devuelve violaciones accionables, no output de compilador |
| Vas a escribir un Repository, una query o una migración | `supabase-schema` — el esquema real sale de las migraciones, no de tu memoria |
| Vas a commitear algo no trivial | `/review` → `code-judge` — juzga el diseño, que es lo que el regex no ve |
| Cerraste la tarea y tocaste `src/app/` | `index-syncer` — reconcilia `indices/` con el código real |

### Cuándo NO delegar

**Delegar no es gratis** — cada subagente es una llamada completa que arranca sin
nada de lo que ya sabes. Hazlo tú mismo cuando:

- **Ya tienes la respuesta en contexto.** Si Session Start te inyectó `COMPONENTS.md`
  y la pregunta es "¿existe un `app-kpi-card`?", léelo.
- **El cambio es de un archivo y ya lo entiendes.** Renombrar una variable no
  necesita comité.
- **Necesitas el detalle, no el resumen.** Los subagentes comprimen a propósito: si
  vas a refactorizar un servicio, lee el archivo.
- **Estás dentro de un subagente.** No encadenes: devuelve tu resultado y deja que el
  agente principal decida el siguiente paso.

Los subagentes **reportan**, no deciden: `arch-auditor` dice qué está mal, elegir el
arreglo es tuyo. Si uno te devuelve algo que contradice lo que ves en el filesystem,
**gana el filesystem** — los índices se desincronizan, el código no miente. Y delegar
no te exime: el Discovery Gate y el Architect Guard se aplican igual a lo que escribas
después de consultar.

Dos tienen permisos de escritura acotados a propósito. `index-syncer` escribe **solo**
en `indices/`. Y `code-judge` no tiene `Write`, `Edit` **ni `Bash`** — recibe el diff
como archivo (`.claude/temp/review-diff.patch`, que deja `/review`). Con `Bash` podría
escribir usando `>`, y "el juez no arregla nada" pasaría a ser una promesa en vez de un
hecho.

## Reglas del proyecto (path-scoped — se cargan automáticamente)

Las reglas viven en `.claude/rules/` con frontmatter `paths:`. Claude Code las inyecta
**solo cuando el archivo editado coincide con el path** — no se cargan todas al inicio.

| Archivos editados | Reglas activas |
|---|---|
| `src/app/**/*.ts` + `.html` | `architecture`, `facades`, `swr-pattern`, `testing-tdd`, `state-management` |
| `src/app/core/models/**` + `core/facades/**` | `models`, `facades` |
| `src/app/shared/**` + `features/**` | `component-selection` |
| `src/app/**/*.html` + `shared/**` + `styles/**` | `visual-system`, `visual-tokens`, `ai-readability` |
| `src/app/features/**` + `layout/**` | `notifications`, `layout-blueprints`, `visual-patterns` |
| `supabase/**` + `core/services/**` | `database` |

## Referencias (leer bajo demanda — no cargadas automáticamente)

- Stack completo: `docs/TECH-STACK-RULES.md`
- Brand & UI: `docs/BRAND_GUIDELINES.md`
- Sistema de Hooks: `docs/HOOKS-SYSTEM.md`
- Contratos del harness (qué escribe cada pieza y quién lo lee): `docs/CONTRATOS.md` — generado desde `.claude/hooks/lib/contracts.js` con `npm run contracts:doc`
- Visión del producto: `docs/PRODUCT-VISION.md`
