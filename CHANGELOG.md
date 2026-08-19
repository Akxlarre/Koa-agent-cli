# Changelog — Koa Agent Blueprint

Formato basado en [Keep a Changelog](https://keepachangelog.com/). Solo se documentan **breaking changes** y **cambios que afectan proyectos generados**.

Para migrar un proyecto existente entre versiones, sigue las instrucciones de cada sección "Migración".

---

## [6.9.1] — 2026-08-19

Enlaces de documentación rotos y reglas sin documentar. Nada de esto rompe un
build, que es exactamente por qué llevaba tiempo pasando desapercibido.

### Fixed
- **Dos anclas rotas**, ambas introducidas en 6.9.0 al agregar los checks de RLS:
  `docs/TECH-STACK-RULES.md#database` y `indices/ANTI-PATTERNS.md#ap-012`. Cada
  mensaje de error del linter termina en una línea `Doc:` — si el ancla no existe,
  el agente recibe una instrucción que no lleva a ninguna parte.
- **9 reglas se emitían sin estar documentadas** en el archivo al que el propio
  mensaje de error apunta: `ARCH-11`, `ARCH-12`, `A11Y-01/02`, `LLM-01/02` y los
  tres `SEC-RLS-*`. Ahora tienen sección propia en `docs/TECH-STACK-RULES.md`.
- **`.claude/rules/database.md`** decía "activar RLS" y nada más. Ahora explica por
  qué activar RLS sin policies deja la tabla *inaccesible*, por qué `USING (true)`
  no es el arreglo, y qué check salta en cada caso — con SQL de los dos lados.

### Added
- **`doc-links.test.js`** — el fix real. Recorre todo el payload, junta cada
  referencia `archivo.md#ancla` y verifica que resuelva; además comprueba que toda
  regla que los hooks o el linter **emiten** tenga sección documentada, y que su
  ancla sea explícita (`<a id="…">`) en vez de un slug derivado del título, que se
  rompe en silencio si alguien reescribe el encabezado.

  Se verificó que el test falla de verdad: renombrando un ancla y simulando una
  regla nueva sin documentar, ambos casos quedan en rojo.

- **Anclas explícitas en los 12 anti-patrones** de `indices/ANTI-PATTERNS.md`.

### Nota
En el proceso reporté "12 anclas rotas". Era un error de mi verificación, que solo
miraba slugs de encabezados e ignoraba las etiquetas `<a id>` que ya existían. Las
rotas de verdad eran 2, y las dos las había introducido yo en 6.9.0. El test nuevo
usa el criterio correcto.

### Migración desde 6.9.0
1. Reemplazar `docs/TECH-STACK-RULES.md`, `.claude/rules/database.md` e
   `indices/ANTI-PATTERNS.md` (si no lo personalizaste).
2. Copiar `.claude/tests/doc-links.test.js` y correr `npm run claude:test-hooks`.

---

## [6.9.0] — 2026-08-19

Cierra el punto que 6.8 dejó documentado como sabido-y-no-resuelto: no había
guardrail para políticas RLS.

### Added
- **`SEC-RLS-01` — tabla creada sin ninguna política.** El guard ya exigía
  `ENABLE ROW LEVEL SECURITY`, pero nada verificaba que existiera una sola
  `CREATE POLICY`. Una tabla con RLS y cero políticas **no es segura: es
  inaccesible** — Postgres deniega por defecto, así que ni tu propia app puede
  leerla. El fallo aparece en runtime, lejos de la migración que lo causó.
- **`SEC-RLS-02` — política permisiva sobre una escritura.** El "arreglo" natural
  del bloqueo anterior es `USING (true)`, que abre la tabla a cualquier usuario
  autenticado: se pasa de inaccesible a totalmente abierta en un commit, y ambos
  extremos compilan. Se bloquea en `FOR ALL / INSERT / UPDATE / DELETE`, y también
  cuando **falta la cláusula `FOR`** — ahí Postgres asume `ALL`, que es el caso más
  permisivo y el más fácil de escribir por accidente.
  `FOR SELECT USING (true)` sigue permitido: una tabla de catálogo pública es
  legítima, y es la única forma en que `true` se defiende.
- **`architect.js` ahora audita `supabase/migrations/`.** Nunca lo había hecho: el
  linter solo escaneaba `src/app/**`, así que el SQL del proyecto no pasaba por
  ninguna auditoría completa. Suma `SEC-RLS-03` (tabla sin RLS en ninguna migración).

### Por qué el hook y el linter no son redundantes aquí

Es el único caso donde ambos miran lo mismo con criterios distintos, a propósito:

- El **hook** ve un archivo en el momento de escribirlo y exige el par
  tabla+política **juntos** — la convención del blueprint, que sus propias
  migraciones siguen.
- El **linter** ve todas las migraciones a la vez, reconstruye el esquema acumulado
  y detecta el agujero real: una tabla que, sumadas todas las migraciones, sigue sin
  políticas. Una tabla creada en la migración 3 con políticas en la 7 le parece bien,
  porque lo es.

Ninguno solo alcanza: el hook no puede ver los otros archivos, y el linter corre
después de que el código ya se escribió.

### Changed
- **Un test existente cambió de expectativa.** `permite CREATE TABLE con RLS`
  afirmaba que activar RLS bastaba. Desde `SEC-RLS-01` no basta, y el test lo
  detectó al primer intento. Ahora es `permite CREATE TABLE con RLS y politica`.
- **AP-012 se reescribió.** Estaba en el Grupo 2 ("invisibles para el regex") y ya
  no pertenece ahí. Se conserva porque el razonamiento —cómo se pasa de inaccesible
  a abierta— vale más que la regla, y ahora lista qué check lo vigila.
- 105 tests (6.8 cerró con 91). Incluye una regresión que verifica que las
  migraciones que envía el blueprint sigan pasando el guard: si un check nuevo las
  rompe, el proyecto generado arranca bloqueado.

### Migración desde 6.8
1. Reemplazar `.claude/hooks/pre-write-guard.js` y `scripts/architect.js`.
2. Correr `npm run lint:arch`. Si tenés tablas sin políticas o con `USING (true)`
   en operaciones de escritura, van a aparecer ahora. **No las silencies**: una
   tabla sin políticas está rota, y una permisiva está abierta.
3. Reemplazar `indices/ANTI-PATTERNS.md` (AP-012 reescrito) si no lo personalizaste.

---

## [6.8.0] — 2026-08-19

Dos huecos que quedaron abiertos al agregar los subagentes en 6.5.

### Added
- **`.claude/rules/delegation.md`** — los subagentes existían desde 6.5 pero solo
  estaban anunciados en `CLAUDE.md`, que es precisamente el tipo de *guideline* que
  este proyecto sostiene que no funciona. Ahora es una regla path-scoped: se carga
  sola al editar código, que es cuando la decisión de delegar se toma.

  La mitad útil de la regla es **cuándo NO delegar**. Cada subagente es una llamada
  completa que arranca sin nada de lo que el agente principal ya sabe: pedirle a
  `discovery-scout` un dato que Session Start ya inyectó paga una llamada por
  nada, y un resumen de treinta líneas es lo peor que puedes tener antes de
  refactorizar un servicio.

- **`indices/ANTI-PATTERNS.md` — 6 anti-patrones nuevos (AP-007→012).** El índice
  ya traía seis, pero los seis eran cosas que el Architect Guard bloquea por regex:
  documentaban lo que el hook ya impedía, sin aportar nada que el hook no supiera.

  Los nuevos son los que **ningún regex puede ver**: un Smart component disfrazado
  de Dumb, `effect()` usado para estado derivado, un Facade que expone su signal
  escribible, un Repository que filtra la forma de la respuesta de Supabase, un
  nombre que contradice `context/domain.md`, y una tabla con RLS activado pero sin
  políticas —el guard exige `ENABLE ROW LEVEL SECURITY` pero no verifica que exista
  una sola `CREATE POLICY`, y una tabla con RLS y cero políticas no es segura: es
  inaccesible, hasta que alguien la "arregla" con `USING (true)`.

  El archivo ahora explica esa división y cómo agregar entradas nuevas. Importa
  porque `code-judge` lee este índice como criterio C9 de su rúbrica: una entrada
  aquí se convierte en algo que se revisa en cada `/review`.

### Migración desde 6.7
1. Copiar `.claude/rules/delegation.md`.
2. Reemplazar `indices/ANTI-PATTERNS.md` — o, si ya lo llenaste con hallazgos
   propios, copiar solo el Grupo 2 y la sección "Cómo leer este índice". Tus
   entradas propias son más valiosas que las que trae el blueprint.

### Sabido y no resuelto
El Architect Guard no verifica que una migración con `CREATE TABLE` incluya
políticas RLS. Queda documentado como AP-012 y lo detecta `/review`, pero no hay
guardrail automático. Sería una regex más en `pre-write-guard.js`.

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
