# {{PROJECT_NAME}} — Koa Agent Blueprint v{{BLUEPRINT_VERSION}}

Tu stack: **Angular + Tailwind v4 + PrimeNG + Supabase + GSAP**.

## Sistema de Hooks Activo

Este proyecto tiene guardrails automáticos que se ejecutan sin intervención humana:

- **Session Start** — Al abrir la sesión se te inyectan los índices core (COMPONENTS, SERVICES, FACADES), el objetivo de `context/brief.md` y el trabajo pendiente del último task-spec. No arrancas a ciegas.
- **Prompt Context** — Antes de cada prompt se te recuerda lo que está **fuera de alcance** esta sesión y qué queda pendiente del spec. Es lo primero que se olvida y nada en la conversación lo repite.
- **Discovery Gate** — NO puedes escribir código en `src/app/` sin antes tener los índices en contexto. Session Start suele resolverlo por ti; si no, serás bloqueado hasta que leas `indices/`.
- **Architect Guard** — Cada Edit/Write es validado en tiempo real. Se bloquean: `*ngIf`, `@Input()`, colores hardcodeados, imports de Supabase en UI, `@angular/animations`, `@keyframes`, y migraciones con problemas de RLS (`SEC-RLS-01/02`).
- **File Protector** — No puedes modificar los archivos del sistema de hooks (`.claude/hooks/`, `settings.json`, `architect.js`).
- **Bash Guard** — No puedes crear archivos `.ts/.html/.scss` via Bash. Usa Edit/Write.
- **Compact Recovery** — Si el contexto se compacta, los índices se re-inyectan automáticamente (PostCompact).
- **Failure Tracker** — Los errores de tools se registran en `.claude/temp/LESSONS_LEARNED.md` con dedup y rotación automática (max 20).
- **Circuit Breaker** — Si el mismo Edit se bloquea 3 veces por la misma violación, el guard deja de explicar el arreglo y te ordena parar y escalar al humano. No intentes rodearlo.
- **Approval Gate** — Las operaciones irreversibles de base de datos (`supabase db push`, `db reset`, `migration repair`, `link`, SQL destructivo) las ejecuta un humano, no tú. Escribe la migración y pide que la corran.
- **Spec Reflection** — Al terminar de responder, se revisa el "Criterio de done" del task-spec activo y se te devuelven los puntos sin cerrar.
- **Sync Check** — Al terminar de responder, se verifica si los índices necesitan actualización.
- **Context Guardian** — Al terminar de responder, pregunta si algo de esta sesión merece quedar en `context/learnings.md` (avisa si lleva más de 14 días sin crecer). La frescura del brief se audita al **arrancar**, no al cerrar.
- **Prettier** — Cada archivo editado se formatea automáticamente.

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
5. **SINCRONIZAR** — `index-syncer` reconcilia `indices/*.md` con el código real. El Stop hook te lo recordará si lo olvidas.

## Skills disponibles

| Skill | Cuándo usar |
|---|---|
| `/plan` | SIEMPRE antes de una tarea no trivial (>2 archivos). Genera task-spec con artefactos afectados, reglas que aplican y criterio de done. |
| `/review` | Antes de commitear algo no trivial. Juzga el diseño contra la rúbrica del proyecto — lo que los guardrails de regex no alcanzan. |
| `/angular-component` | Crear o refactorizar un componente Angular |
| `/angular-signals` | Implementar estado reactivo con Signals |
| `/sync-indices` | Sincronizar índices al cerrar sesión |

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

**Delegar no es gratis** — cada subagente es una llamada completa que arranca sin
nada de lo que ya sabes. `.claude/rules/delegation.md` (se carga sola al editar
código) dice cuándo vale la pena y cuándo hacerlo tú.

`code-judge` no tiene `Write`, `Edit` **ni `Bash`** — recibe el diff como archivo
(`.claude/temp/review-diff.patch`, que deja `/review`). Con `Bash` podría escribir
usando `>`, y "el juez no arregla nada" pasaría a ser una promesa en vez de un hecho.

## Reglas del proyecto (path-scoped — se cargan automáticamente)

Las reglas viven en `.claude/rules/` con frontmatter `paths:`. Claude Code las inyecta
**solo cuando el archivo editado coincide con el path** — no se cargan todas al inicio.

| Archivos editados | Reglas activas |
|---|---|
| `src/app/**/*.ts` + `.html` | `architecture`, `facades`, `swr-pattern`, `testing-tdd`, `state-management` |
| `src/app/core/models/**` + `core/facades/**` | `models`, `facades` |
| `src/app/shared/**` + `features/**` | `component-selection` |
| `src/app/**/*.html` + `shared/**` + `styles/**` | `visual-system`, `ai-readability` |
| `src/app/features/**` + `layout/**` | `notifications`, `layout-blueprints` |
| `supabase/**` + `core/services/**` | `database` |
| `src/app/**/*.ts` + `.html` + `supabase/migrations/**` | `delegation` (cuándo usar un subagente y cuándo no) |

## Referencias (leer bajo demanda — no cargadas automáticamente)

- Stack completo: `docs/TECH-STACK-RULES.md`
- Brand & UI: `docs/BRAND_GUIDELINES.md`
- Sistema de Hooks: `docs/HOOKS-SYSTEM.md`
- Visión del producto: `docs/PRODUCT-VISION.md`
