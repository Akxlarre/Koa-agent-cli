# Changelog — Koa Agent Blueprint

Formato basado en [Keep a Changelog](https://keepachangelog.com/). Solo se documentan **breaking changes** y **cambios que afectan proyectos generados**.

Para migrar un proyecto existente entre versiones, sigue las instrucciones de cada sección "Migración".

---

## [6.7.0] — 2026-08-19

Auditoría del **boilerplate**. Las versiones 6.5 y 6.6 trabajaron sobre el harness;
nadie había ejecutado nunca los scripts que se le envían al usuario final.

El hallazgo que resume todo: **el proyecto generado fallaba su propio linter**.
Un usuario corría `npx create-koa-agent`, después `npm run lint:arch`, y recibía
4 errores en un scaffold recién creado. El agente, en el paso VALIDAR, se
encontraba con que el proyecto estaba roto antes de escribir una línea.

### Fixed
- **`core/services/ui/` era una copia mal hecha.** Contenía un `gsap-animations.service.ts`
  duplicado (39 KB) y dos servicios de layout-drawer. Los tres sin `.spec.ts`, que es lo
  que producía 3 de los 4 errores de `lint:arch`.
  La copia de `ui/` resultó ser el **superset**: 46 métodos contra 39 del canónico, sin
  ninguna firma incompatible (la única diferencia era el nombre de un parámetro). Y
  `drawer.component.ts` importaba desde `ui/` precisamente porque necesitaba
  `animateDrawerEnter`/`animateDrawerLeave`, que solo existían allí. Se promovió la
  versión completa al path canónico, se movieron los layout-drawer a `core/services/`
  —donde viven todos los demás— y `ui/` desapareció.
- **`toast.service.ts` no tenía tests** (el 4º error de `lint:arch`). Ahora tiene spec,
  igual que `layout-drawer.service.ts` y `layout-drawer.facade.service.ts`.
- **`.animate-fade-in-up` y `.animate-stagger` no existían.** `styles/_animations.scss`
  las define, y `AGENTS.md`, `.claude/CLAUDE.md` y la inyección de contexto de
  `pre-write-guard.js` se las recomiendan a los proyectos **sin GSAP** — que es el
  default. Pero `styles.scss` nunca hacía `@use` del archivo: las clases existían solo
  en la documentación. Ahora está cableado y verificado en el CSS compilado.
- **5 parciales SCSS huérfanos eliminados** (~28 KB inalcanzables desde `styles.scss`):
  `styles/_view-transitions.scss`, `styles/_animations.scss` (este se cableó en vez de
  borrarse), y los directorios anidados `styles/layout/layout/` y `styles/motion/motion/`.
  Los anidados eran más nuevos y más ricos que los importados, pero **no se podían
  promover**: migran a container queries con `@container layoutmain (…)` y nada en el
  boilerplate declara `container-name: layoutmain` — sus breakpoints nunca habrían
  disparado. Son trabajo extraído de otro proyecto y nunca adaptado. Siguen en el
  historial de git si se quiere retomarlos, pero requieren además declarar ese container
  en el shell.

### Verificado
Los cuatro scripts del boilerplate se ejecutaron por primera vez contra un proyecto
generado real: `architect.js` (0 errores, 0 advertencias), `indices-sync.js` (incluida
la segunda corrida, que confirma el cache incremental), `lint-arch-wrapper.js` y
`set-env.js` (exit 1 sin variables de entorno, exit 0 y escritura correcta con ellas).

### Changed
- `indices/TEMPLATES-REGISTRY.md` y `indices/CLI-MODULES.md` sincronizados. El registry
  llevaba tres versiones desactualizado: decía 8 hooks (hay 12 + 1 validador), 7 skills
  (hay 9), 12 reglas (hay 13) y no mencionaba los subagentes. Ahora documenta también
  los dos contratos que se pueden romper en silencio: el del task-spec y el del
  discovery flag.

### Migración desde 6.6
1. Si tu proyecto importaba desde `@core/services/ui/…`, cambia a `@core/services/…`.
   El servicio de GSAP resultante es un superset — no pierdes métodos.
2. Agrega `@use "./styles/animations";` a `src/styles.scss` si usas las clases
   `.animate-*` sin GSAP.
3. Copia los tres `.spec.ts` nuevos si quieres que `lint:arch` pase en limpio.
4. Revisa si tienes parciales SCSS bajo `src/styles/` que ningún `@use` alcance.

---

## [6.6.0] — 2026-08-19

Los guardrails de 6.5 corrigen al agente **después** de que decidió mal. Esta versión
mueve la intervención hacia adelante: al arranque de la sesión y antes de cada prompt.

Cambios inspirados en revisar [disler/claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery),
que documenta los 13 hook events del ciclo de vida — Koa usaba 6.

### Added
- **`session-start.js`** (SessionStart) — inyecta los índices core (Quick Reference,
  truncados), el objetivo de `context/brief.md` y los pendientes del último task-spec
  al abrir la sesión. **Levanta el Discovery Gate** escribiendo el mismo flag que
  `discovery-tracker.js`: si el agente ya tiene los índices en contexto, bloquearlo por
  "no haberlos leído" sería falso. Si no hay índices, el flag no se escribe y el Gate
  sigue activo como red de seguridad.
- **`prompt-context.js`** (UserPromptSubmit) — corre antes de que Claude vea el prompt.
  No repite lo de SessionStart: solo lleva lo que se degrada dentro de una sesión — el
  `## Out of scope` del brief y las casillas abiertas del spec. Con dedup por contenido
  y refresco cada 8 prompts.
- **`validators/validate-file-contains.js`** — validador genérico parametrizado por
  flags (`--directory`, `--pattern`, `--contains`, `--max-age`, `--require-file`). No
  sabe nada del proyecto: un validador, muchos usos.
- **Hooks en el frontmatter de `/plan`** — la skill declara un hook de `Stop` que valida
  que el task-spec exista y contenga sus cinco secciones obligatorias. Pedir un formato
  en prosa es una guideline; esto lo convierte en guardrail.
- **Tests** para los tres hooks nuevos: 91 en total, todos en verde (6.5 cerró con 55).

### Changed
- **`code-judge` perdió `Bash`.** Ahora tiene solo `Read, Grep, Glob` y recibe el diff
  como archivo (`.claude/temp/review-diff.patch`, que deja `/review` con una
  redirección). Antes tenía `Bash` para correr `git diff`, y con `Bash` podía escribir
  usando `>` — la regla "el juez no arregla nada" dependía de que el juez se portara
  bien. Un juez que puede editar el código que juzga no es un juez.
- **`/review`** deja el diff en un archivo en vez de leerlo. El diff completo no entra
  al contexto principal: lo lee el juez en su propia ventana.
- **La frescura de `context/brief.md` se audita en SessionStart**, no en el Stop hook.
  Avisar al cerrar que el brief estaba viejo llega después de que el agente ya codeó
  contra el objetivo equivocado. `context-guardian.js` conserva el check de
  `learnings.md`, que sí tiene sentido al cerrar.

### Migración desde 6.5
1. Copiar `.claude/hooks/session-start.js`, `.claude/hooks/prompt-context.js` y
   `.claude/hooks/validators/` (carpeta nueva, con su `package.json` que fuerza CommonJS).
2. Registrar en `.claude/settings.json` los eventos `SessionStart` y `UserPromptSubmit`.
3. Reemplazar `.claude/hooks/context-guardian.js` (se le quitó el check de brief).
4. Reemplazar `.claude/agents/code-judge.md` y `.claude/skills/review/SKILL.md`.
5. Reemplazar `.claude/skills/plan/SKILL.md` — trae el hook de validación en su frontmatter.
6. Copiar los tests nuevos y correr `npm run claude:test-hooks`.

**Nota sobre los encabezados del task-spec**: ahora los valida un hook. Si tu `/plan`
está personalizado con otros nombres de sección, actualiza los `--contains` del
frontmatter o el hook bloqueará el cierre de cada tarea.

---

## [6.5.0] — 2026-08-18

Esta versión cierra los huecos agénticos del harness: hasta ahora los guardrails
detectaban **sintaxis** pero nada revisaba **diseño**, un agente bloqueado podía
reintentar sin límite, y el criterio de done que generaba `/plan` no lo verificaba nadie.

### Fixed
- **`compact-recovery.js` no compilaba.** Tenía saltos de línea literales dentro de
  strings con comillas simples: el hook PostCompact fallaba en silencio en cada
  compactación desde que se añadió el bloque de `context/`. La re-inyección de índices
  y contexto **no estaba ocurriendo** en ningún proyecto generado. Además el regex de
  detección de plantillas vacías usaba `[sS]` en vez de `[\s\S]`, con lo que no
  eliminaba comentarios HTML y trataba plantillas vacías como contenido real.
- **`bash-guard.js` no cubría `touch`, `cp`, `mv` ni `ng generate`.** Todos escriben
  archivos fuente a disco sin pasar por Edit/Write, así que el Architect Guard nunca
  veía el contenido. La suite de tests ya afirmaba que `touch` estaba bloqueado — el
  test decía la verdad y el hook no.
- **La suite de tests estaba roja (4 de 8).** `pre-write-guard.test.js` no compilaba
  (comillas simples anidadas) y su harness no creaba el flag de discovery, así que el
  Discovery Gate bloqueaba antes que el Architect Guard y todos los asserts sobre
  mensajes de violación fallaban. Ahora: **55 tests, 55 en verde.**

### Added
- **Subagentes (`.claude/agents/`)** — `discovery-scout`, `arch-auditor`, `index-syncer`,
  `supabase-schema`, `code-judge`. Corren en su propia ventana de contexto y devuelven
  un resumen en vez de volcar archivos al contexto principal.
- **Skill `/review` + subagente `code-judge`** — juez con rúbrica que califica el diff
  contra `ARCH-*`, `A11Y-*`, `.claude/rules/*` e `indices/ANTI-PATTERNS.md`. Cubre el
  diseño, que es lo que ni el regex del hook ni el AST del linter pueden ver. Corre con
  un modelo de razonamiento a propósito: un evaluador que razona igual que el generador
  comparte sus puntos ciegos.
- **Circuit Breaker** en `pre-write-guard.js` — cuenta bloqueos por `{archivo, violación}`
  y al 3º deja de explicar el arreglo y ordena escalar al humano, cerrando explícitamente
  las vías de escape (Bash, renombrar, trocear el cambio).
- **Approval Gate** en `bash-guard.js` — `supabase db push`, `db reset`, `migration repair`,
  `link` y SQL destructivo vía `psql` requieren un humano. `start`, `migration new` y
  `gen types` siguen permitidos.
- **`spec-reflection.js`** (Stop hook) — lee el "Criterio de done" del task-spec activo y
  devuelve los puntos sin cerrar, con evidencia del filesystem. Incluye anti-bucle: el
  mismo estado del spec no se reporta dos veces.
- **Context Offloading activo** — `compact-recovery.js` re-inyecta solo las casillas
  `- [ ]` pendientes del task-spec; lo completado se descarta del contexto.
- **Tests nuevos** — `spec-reflection.test.js` y `compact-recovery.test.js` (el hook que
  estuvo roto sin que nadie lo notara ahora tiene un test que verifica que simplemente corre).

### Changed
- **`.mcp.json` — mínimo privilegio.** El servidor MCP de Supabase venía con un Personal
  Access Token inline y sin acotar: escritura a nivel de cuenta sobre **todos** los
  proyectos del usuario, producción incluida. Ahora ships con `--read-only`,
  `--project-ref` y el token vía variable de entorno `SUPABASE_ACCESS_TOKEN` en vez de
  commiteado en el repo.
- **`skills/plan.md` → `skills/plan/SKILL.md`** — era la única skill suelta; el resto ya
  usaba la forma de directorio. El task-spec ahora incluye una sección de reutilización
  (alimentada por `discovery-scout`) y pasos de ejecución en casillas marcables.
- **Flujo de 5 pasos** — DESCUBRIR delega en `discovery-scout`, VALIDAR suma `arch-auditor`
  y `/review`, SINCRONIZAR delega en `index-syncer`.

### Migración desde 6.4
1. Copiar `.claude/agents/` completo (carpeta nueva).
2. Reemplazar `.claude/hooks/compact-recovery.js`, `pre-write-guard.js` y `bash-guard.js`.
3. Copiar `.claude/hooks/spec-reflection.js` y registrarlo en `.claude/settings.json`
   dentro de `Stop`, **antes** de `sync-check.js`.
4. Mover `.claude/skills/plan.md` a `.claude/skills/plan/SKILL.md` y copiar
   `.claude/skills/review/SKILL.md`.
5. **Revisar `.mcp.json`**: si ya pegaste un PAT inline, rótalo en
   supabase.com/dashboard/account/tokens — quedó en el historial de git — y pasa a
   `SUPABASE_ACCESS_TOKEN` + `--read-only` + `--project-ref`.
6. Copiar los tests nuevos y correr `npm run claude:test-hooks`.

**Nota sobre el Approval Gate**: si tu flujo dependía de que el agente corriera
`supabase db push`, ahora queda bloqueado a propósito. El agente escribe la migración
e informa el comando; lo aplica una persona.

---

## [6.1.0] — 2026-03-26

### Changed
- **indices-sync.js**: Ahora usa cache incremental por mtime. Solo re-parsea archivos modificados desde la última ejecución. Cache en `.claude/temp/indices-cache.json` (ya en `.gitignore`).
- **testing-tdd.md**: Dumb components sin lógica ya no requieren tests obligatorios. Solo obligatorio si tienen `computed()` o lógica derivada.
- **Bug Fix**: Se añadió `templates/.claude/hooks/package.json` para forzar `type: commonjs` en los hooks. Esto evita errores de `require is not defined` en proyectos que usan `type: module` (ESM).

### Migración desde 6.0
1. Reemplazar `scripts/indices-sync.js` con la versión nueva
2. Reemplazar `.claude/rules/testing-tdd.md` con la versión nueva
3. No hay breaking changes — el cache se genera automáticamente en la primera ejecución

---

## [6.0.0] — 2026-03-19

### Added
- `preflight()` + `checkCommand()` + `validateProjectName()` (regex, 214 chars, Windows reserved words)
- NPM/NPX con `.cmd` suffix en Windows + `shell: platform === 'win32'`
- Scaffold en directorio temporal con rollback automático via `fs.rmSync(tempDir)`
- `blueprint.json` en raíz del proyecto generado con versión y metadata
- Objeto `RULES` con doc links en `architect.js` + `reportError()`/`reportWarning()` con códigos `[ARCH-NN]`
- ARCH-09 (shared >200 líneas) y ARCH-10 (facade >5 inject o método >50 líneas) como warnings
- `indices/ANTI-PATTERNS.md` con 5 anti-patrones documentados
- `scripts/indices-sync.js` — auto-indexer AST para 4 índices (COMPONENTS, SERVICES, FACADES, MODELS)
- `scripts/lint-arch-wrapper.js` — memoria de fallos en `.claude/temp/arch-last-failure.json`
- Flags `--no-supabase`, `--no-gsap`, `--no-primeng` + `koa-config.json` opcional

### Migración desde 5.1
1. Agregar `blueprint.json` manualmente a la raíz del proyecto:
   ```json
   { "name": "koa-agent-blueprint", "version": "6.0.0", "stack": { "angular": true, "tailwind": true, "primeng": true, "gsap": true, "supabase": true } }
   ```
2. Agregar marcadores `<!-- AUTO-GENERATED:BEGIN -->` / `<!-- AUTO-GENERATED:END -->` a cada `indices/*.md`
3. Copiar `scripts/indices-sync.js` y `scripts/lint-arch-wrapper.js`
4. Agregar a `package.json`: `"indices:sync": "node scripts/indices-sync.js"`
5. Copiar `indices/ANTI-PATTERNS.md`

---

## [5.1.0] — 2026-03-16

### Added
- **ToastService** — wrapper sobre PrimeNG MessageService con duraciones pre-configuradas
- **core/utils/** — `date.utils.ts`, `validation.utils.ts` con barrel export
- **Tailwind @utility** — `btn-primary`, `btn-secondary`, `btn-ghost` con tokens semánticos
- **Lucide icons** expandidos de 24 a 58 iconos curados
- **linkedSignal()** — patrón de two-way binding en Facades para formularios
- **pre-write-guard.js** actualizado con checks para MessageService directo y context injection expandido

### Changed
- `_variables.scss` — eliminado branding específico, aliases legacy
- `_primeng-overrides.scss` — 1122 a 803 líneas (limpieza de dead code)
- `tailwind.css` — btn utilities usan tokens en vez de valores hardcodeados

### Migración desde 5.0
1. Crear `core/services/toast.service.ts` y reemplazar inyecciones directas de `MessageService` en componentes
2. Crear `core/utils/` con barrel export
3. Actualizar `tailwind.css` con las nuevas `@utility`
4. Actualizar `app.config.ts` con los 58 iconos Lucide

---

## [5.0.0] — 2026-03

### Added
- Sistema de hooks completo (7 hooks): pre-write-guard, discovery-tracker, bash-guard, compact-recovery, post-edit, sync-check, file-protector
- 9 reglas arquitectónicas en `.claude/rules/`
- 7 skills con frontmatter oficial
- 8 índices de memoria viva en `indices/`
- Boilerplate Angular completo con KPI card, skeleton, icon component
- Design system con Bento Grid, Frosted Cards, GSAP animations

### Notes
- Primera versión con sistema de guardrails automáticos
- No hay migración desde versiones anteriores — generar proyecto nuevo
