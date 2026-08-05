# {{PROJECT_NAME}} — Koa Agent Blueprint v{{BLUEPRINT_VERSION}}

Tu stack: **Angular + Tailwind v4 + PrimeNG + Supabase + GSAP**.

## Sistema de Hooks Activo

Este proyecto tiene guardrails automáticos que se ejecutan sin intervención humana:

- **Discovery Gate** — NO puedes escribir código en `src/app/` sin antes leer al menos un archivo de `indices/`. Serás bloqueado automáticamente.
- **Architect Guard** — Cada Edit/Write es validado en tiempo real. Se bloquean: `*ngIf`, `@Input()`, colores hardcodeados, imports de Supabase en UI, `@angular/animations`, `@keyframes`.
- **File Protector** — No puedes modificar los archivos del sistema de hooks (`.claude/hooks/`, `settings.json`, `architect.js`).
- **Bash Guard** — No puedes crear archivos `.ts/.html/.scss` via Bash. Usa Edit/Write.
- **Compact Recovery** — Si el contexto se compacta, los índices se re-inyectan automáticamente (PostCompact).
- **Failure Tracker** — Los errores de tools se registran en `.claude/temp/LESSONS_LEARNED.md` con dedup y rotación automática (max 20).
- **Harness Gate** — Cada edición a `.claude/rules/`, `context/learnings.md`, `indices/ANTI-PATTERNS.md`, `CLAUDE.md` o `scripts/*.js` se valida contra el Generalization Gate: bloquea lecciones que citan un track ID sin criterio de aplicabilidad, snippets de despacho por keyword-matching, código ejecutable colado en un archivo de guía, o consejos sin mecanismo colados en un script.
- **Sync Check** — Al terminar de responder, se verifica si los índices necesitan actualización.
- **Context Guardian** — Al terminar de responder, audita la frescura del contexto semántico: avisa si `context/brief.md` tiene más de 7 días sin actualizar o si `context/learnings.md` lleva más de 14 días sin crecer.
- **Prettier** — Cada archivo editado se formatea automáticamente.

Detalle completo: @docs/HOOKS-SYSTEM.md

## Comandos del proyecto

- Dev: `ng serve`
- Build: `ng build`
- Lint: `ng lint`
- Lint arquitectónico: `npm run lint:arch`
- Supabase local: `npx supabase start`

## Flujo obligatorio (5 pasos)

1. **DESCUBRIR** — Lee los índices de `indices/` (COMPONENTS, SERVICES, FACADES, MODELS…) **y** `context/domain.md` + `context/brief.md` si existen. Los índices te dicen qué código hay; el contexto te dice qué es el negocio y qué se está construyendo hoy. **El Discovery Gate te bloqueará si no lees los índices.**
2. **PLANIFICAR** — Define qué vas a tocar sin violar las reglas de arquitectura.
3. **EJECUTAR** — Escribe el código. Reutiliza siempre lo existente primero. Los hooks validarán cada escritura en tiempo real.
4. **VALIDAR** — Corre `npm run lint:arch` para una auditoría completa del proyecto.
5. **SINCRONIZAR** — Actualiza `indices/*.md` con los componentes/servicios creados. El Stop hook te lo recordará si lo olvidas.

## Skills disponibles

| Skill | Cuándo usar |
|---|---|
| `/plan` | SIEMPRE antes de una tarea no trivial (>2 archivos). Genera task-spec con artefactos afectados, reglas que aplican y criterio de done. |
| `/angular-component` | Crear o refactorizar un componente Angular |
| `/angular-signals` | Implementar estado reactivo con Signals |
| `/sync-indices` | Sincronizar índices al cerrar sesión |
| `/harness-feedback` | Reportar fricción con el harness (hooks/rules/skills) al cerrar sesión — distinto de sync-indices |

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

## Referencias (leer bajo demanda — no cargadas automáticamente)

- Stack completo: `docs/TECH-STACK-RULES.md`
- Brand & UI: `docs/BRAND_GUIDELINES.md`
- Sistema de Hooks: `docs/HOOKS-SYSTEM.md`
- Visión del producto: `docs/PRODUCT-VISION.md`
