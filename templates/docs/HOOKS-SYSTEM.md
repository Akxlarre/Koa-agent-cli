# Sistema de Hooks — Guardrails Automáticos (Koa Blueprint v6.9)

> Este documento explica cómo el sistema de hooks convierte las reglas arquitectónicas
> en **constraints** reales que Claude no puede ignorar.

## El Problema que Resuelve

Sin hooks, las reglas del proyecto son un **contrato social**: Claude las lee en CLAUDE.md
pero puede ignorarlas. El humano tiene que recordarle en cada prompt que siga las reglas.

Con hooks, las reglas son **constraints del sistema**: Claude es bloqueado automáticamente
si intenta violar una regla, sin intervención humana.

## Arquitectura del Sistema

```
Claude recibe un prompt del humano
    │
    ├─ Intenta Read("indices/COMPONENTS.md")
    │   └─ PostToolUse → discovery-tracker.js → crea flag de sesión ✓
    │
    ├─ Intenta Edit("src/app/features/dashboard.component.ts")
    │   └─ PreToolUse → pre-write-guard.js
    │       ├─ ¿Flag de discovery existe? → NO → BLOQUEADO "Lee los índices primero"
    │       ├─ ¿Flag existe? → SÍ → continúa
    │       ├─ ¿Tiene *ngIf? → SÍ → BLOQUEADO "Usa @if"
    │       ├─ ¿Tiene OnPush? → NO → BLOQUEADO "Agrega OnPush"
    │       └─ Todo OK → PERMITIDO + inyecta reglas relevantes como contexto
    │                    (architecture.md, visual-system.md, database.md, skills)
    │
    ├─ PostToolUse → post-edit.js → Prettier formatea automáticamente
    │
    ├─ Intenta Bash("echo > src/app/nuevo.ts")
    │   └─ PreToolUse → bash-guard.js → BLOQUEADO "Usa Edit/Write"
    │
    ├─ Intenta Edit(".claude/rules/visual-system.md")
    │   └─ PreToolUse → harness-gate.js
    │       ├─ ¿Cita un fix-NNN sin criterio de aplicabilidad? → BLOQUEADO "Reescribe como regla"
    │       └─ Todo OK → PERMITIDO (esto es guía, no código de la app: pre-write-guard.js no aplica)
    │
    ├─ Claude termina de responder
    │   └─ Stop → sync-check.js → ¿fuentes más nuevos que los índices? → sí → sigue trabajando
    │
    ├─ Un tool falla
    │   └─ PostToolUseFailure → failure-tracker.js → registra en LESSONS_LEARNED.md
    │
    └─ Contexto se compacta
        └─ PostCompact → compact-recovery.js → re-inyecta índices
```

## Orden que importa

El orden de los hooks dentro de un evento **no es cosmético en todos los casos**, y
reordenar `settings.json` no rompe ningún build: rompe el harness en silencio. Estas
son las dependencias reales, y `settings.test.js` las verifica.

| Dependencia | Qué se rompe al invertirla |
|---|---|
| `sdd/spec-gate.js` **antes** que `sdd/plan-injector.js` (PreToolUse) | El injector inyectaría el contrato SDD sobre una escritura que el gate iba a bloquear: contexto pagado por un `Edit` que no va a ocurrir |
| `write-tracker.js` **antes** que `post-edit.js` (PostToolUse) | `post-edit` corre prettier y puede tardar; el tracker registra la escritura primero |

Y una dependencia **entre** eventos, que `settings.json` no puede expresar:

| Dependencia | Por qué |
|---|---|
| `discovery-tracker.js` (PostToolUse `Read`) antes de cualquier `Edit` | El Discovery Gate lee el flag que ese hook escribe. Si el `Read` del índice y el `Edit` ocurren en el mismo turno, el orden lo decide el runtime, no el harness — por eso `session-start` siembra el flag al arrancar en vez de confiar en que el agente lea primero |

Una dependencia que la auditoría encontró y que **ya no existe**: `sync-check` iba después
de `spec-reflection` porque borraba `session-writes.json`. Desde que dejó de borrarlo
(`ACO-001`) el orden entre esos dos da igual. Un contrato que deja de ser necesario se
saca, no se hereda.

## Hooks Activos

### 0. Session Start (`session-start.js`) y Prompt Context (`prompt-context.js`)

Los dos primeros hooks del ciclo. Existen para volver **proactivo** lo que antes
era reactivo.

Antes: el agente arrancaba a ciegas, intentaba escribir, el Discovery Gate lo
bloqueaba y recién ahí leía los índices. El bloqueo funcionaba, pero costaba una
ronda entera y llegaba después de que el agente ya había decidido qué hacer.

| Hook | Evento | Qué inyecta |
|---|---|---|
| `session-start.js` | SessionStart | Índices core (Quick Reference), objetivo de `context/brief.md`, pendientes del último task-spec |
| `prompt-context.js` | UserPromptSubmit | El "Out of scope" del brief y las casillas abiertas del spec |

**Session Start levanta el Discovery Gate.** Escribe el mismo flag que
`discovery-tracker.js`, marcado como `SESSION-START`. Es deliberado: si el agente
ya tiene los índices en contexto, bloquearlo por "no haberlos leído" sería falso —
la condición que el Gate protege está satisfecha. Si no hay índices que inyectar,
el flag no se escribe y el Gate sigue activo como red de seguridad.

**Prompt Context no repite lo de Session Start.** Corre en *cada* prompt, así que
reinyectar 2 KB de índices por turno sería la forma más cara posible de no aportar
nada. Solo lleva lo que se degrada dentro de una misma sesión: la restricción de
alcance (lo primero que el agente olvida, porque nada en la conversación se la
repite) y dónde iba el trabajo.

Con dedup: un bloque se reinyecta solo si su contenido cambió, o cada 8 prompts.
Un recordatorio que aparece en todos los turnos deja de leerse.

**Frescura del brief:** se audita en Session Start, no en el Stop hook. Avisar al
cerrar que el brief estaba viejo llega después de que el agente ya codeó contra el
objetivo equivocado.

### 1. Pre-Write Guard (`pre-write-guard.js`)
- **Evento**: PreToolUse
- **Matcher**: `Edit|Write|MultiEdit`
- **Función**: Cuádruple capa de protección antes de cada escritura

| Capa | Qué hace | Resultado si falla |
|------|----------|--------------------|
| File Protection | Bloquea edits a `.claude/hooks/`, `settings.json`, `architect.js` | BLOQUEADO: archivo protegido |
| Discovery Gate | Verifica que se leyeron los índices | BLOQUEADO: lee indices/ primero |
| Architect Guard | Valida reglas en el contenido nuevo | BLOQUEADO: violación específica |
| Context Injection | Inyecta rules y skills relevantes según tipo de archivo | Contexto adicional para Claude |

**Reglas validadas por el Architect Guard:**

| Regla | Archivos | Qué detecta |
|-------|----------|-------------|
| No `*ngIf` / `*ngFor` | .ts, .html | Directivas deprecadas de Angular |
| No `[ngClass]` / `[ngStyle]` | .ts, .html | Bindings deprecados |
| No `@Input()` / `@Output()` | .ts | Decoradores legacy (usar signal API) |
| No `@supabase/supabase-js` | .ts (UI) | Import directo en capa de presentación |
| No `@angular/animations` | .ts | Usar GSAP en vez de animations |
| OnPush obligatorio | .component.ts | Solo en Write (archivo completo) |
| No colores hardcodeados | .ts, .html, .scss | `text-red-500`, `bg-blue-200`, etc. |
| No `@keyframes` | .scss, .css | Usar GSAP para animaciones |
| No Facade en Dumb comp. | shared/.component.ts | Dumb components no inyectan Facades |
| Naming de migraciones | supabase/migrations/ | Formato: YYYYMMDDHHMMSS_dominio_tipo_desc.sql |
| RLS obligatorio | .sql con CREATE TABLE | Toda tabla nueva debe tener RLS activado |
| `SEC-RLS-01` | .sql con CREATE TABLE | RLS activado sin ninguna `CREATE POLICY` — la tabla queda inaccesible |
| `SEC-RLS-02` | .sql con CREATE POLICY | `USING (true)` / `WITH CHECK (true)` en ALL/INSERT/UPDATE/DELETE. Permitido en FOR SELECT |

### Hooks del harness y del SDD

| Hook | Evento | Función |
|------|--------|---------|
| `sdd/spec-gate.js` | PreToolUse (Edit/Write) | Bloquea escribir código de producto sin una spec activa con su plan. **Fail-open**: sin carpeta `specs/` no bloquea nada. |
| `sdd/plan-injector.js` | PreToolUse (Edit/Write) | Inyecta la spec y el plan activos como contexto en cada edición. |
| `lib/guard-rules.js` | — | No es un hook: es el registro de las reglas que emite `pre-write-guard`. Cada una con su ID, su doc y el fixture que la provoca. |
| `subagent-cleanup.js` | SubagentStop | Borra el estado de hilo del subagente que termina (dedup, anti-bucle, breaker). El estado de sesión —discovery flag, `session-writes.json`— sobrevive. |
| `sdd/hotfix-autoclose.js` | SessionEnd | Red de seguridad: cierra el track `hotfix-*` que quedó abierto. El cierre normal es `/hotfix-close`. |
| `context-enrichment-guard.js` | — (**OPT-IN**) | Day 0 Context Guard: impide escribir código mientras `context/domain.md` e `indices/DATABASE.md` sigan vacíos. **No viene cableado**: un proyecto recién generado los trae como plantilla, así que activarlo por defecto bloquearía todo desde el minuto cero. |

**Contexto inyectado por tipo de archivo (Context Injection):**

Cuando una escritura pasa todas las validaciones, el hook inyecta reglas relevantes
directamente en el contexto de Claude vía `additionalContext`. Esto hace que Claude
tenga las rules y skills presentes **sin tener que leerlas manualmente**.

| Archivo editado | Rules inyectadas | Skills referenciadas |
|----------------|-----------------|---------------------|
| `features/*.component.ts` | architecture.md (Smart), visual-tokens.md, visual-patterns.md (bento, GSAP) | angular-component, design-system, angular-signals |
| `shared/*.component.ts` | architecture.md (Dumb: solo input/output), visual-tokens.md | angular-component, design-system |
| `layout/*.component.ts` | architecture.md (Layout), visual-tokens.md (dark mode), visual-patterns.md | — |
| `core/services/*.facade.ts` | architecture.md (Facade pattern, toSignal) | angular-signals |
| `core/services/*.service.ts` | architecture.md (Core service, no UI injection) | angular-signals |
| `core/directives/*.ts` | architecture.md (directivas) | angular-component |
| `supabase/migrations/*.sql` | database.md (naming, RLS, idempotencia) | supabase-data-model |
| `*.html` (templates) | architecture.md (@if/@for), visual-tokens.md, ai-readability.md (data-llm-*) | angular-primeng |
| `*.scss` / `*.css` | visual-tokens.md (tokens, temas) | design-system |

### 2. Discovery Tracker (`discovery-tracker.js`)
- **Evento**: PostToolUse
- **Matcher**: `Read`
- **Función**: Cuando Claude lee un archivo de `indices/`, crea un flag temporal
  que desbloquea el Discovery Gate para el resto de la sesión.

### 3. Bash Guard (`bash-guard.js`)
- **Evento**: PreToolUse
- **Matcher**: `Bash`
- **Función**: Tres capas:
  - **Creación de archivos fuente** — `.ts/.html/.scss/.sql` via Bash queda bloqueado
    (debe usar Edit/Write). Cubre redirecciones (`>`, `cat`, `tee`), creación directa
    (`touch`, `cp`, `mv`) y generadores (`ng generate`). Todos esos caminos escriben
    código a disco **sin que el Architect Guard llegue a ver el contenido**.
  - **Operaciones destructivas** — `rm -rf` sobre directorios críticos.
  - **Approval Gate de base de datos** — ver abajo.

#### Approval Gate (dentro de bash-guard)

Las capas anteriores protegen el filesystem, que es recuperable con git.
Una migración aplicada contra una base remota no lo es.

| Comando | Por qué necesita un humano |
|---|---|
| `supabase db push` | Ejecuta DDL sin rollback automático |
| `supabase db reset` | Borra todos los datos |
| `supabase migration repair` | Reescribe el historial de migraciones |
| `supabase link` | Define contra qué base apuntan los comandos siguientes |
| `psql … DROP/TRUNCATE/DELETE/ALTER` | Cambios de esquema fuera de migraciones versionadas |

El agente **sí** escribe la migración en `supabase/migrations/`. Lo que no hace es
aplicarla: informa el comando exacto y espera. `supabase start`, `migration new` y
`gen types` no se ven afectados.

### 4. Compact Recovery (`compact-recovery.js`)
- **Evento**: PostCompact
- **Matcher**: ninguno (se ejecuta en cada compactación)
- **Función**: Cuando Claude Code compacta la conversación, re-inyecta el contexto
  que el agente estaba usando. Tres decisiones de diseño:
  - **Selectiva** — solo los índices que el agente había leído (más los 3 core),
    según el flag de discovery. No los 15.
  - **Sin lista propia** — los índices candidatos salen de `indices/` en el disco.
    Antes eran un mapa a mano de diez entradas contra los quince del template, y
    `GUARDS`, `LAYOUTS`, `ROUTES`, `USAGE-MAP` y `UTILS` no volvían nunca aunque el
    agente los hubiera leído (`HUE-003`). Si agregas `indices/NUEVO.md`, se re-inyecta
    solo: no hay nada que actualizar acá.
  - **Parcial** — corta cada índice en `<!-- DETAIL:BEGIN -->`: vuelve la Quick
    Reference, no los ejemplos de código.
  - **Solo lo pendiente** — del task-spec activo re-inyecta únicamente las casillas
    `- [ ]`. Lo ya completado se descarta a propósito (Context Offloading): el agente
    necesita saber qué le falta, no qué ya hizo.

### 5. Failure Tracker (`failure-tracker.js`)
- **Evento**: PostToolUseFailure
- **Matcher**: ninguno (captura todos los fallos de tools)
- **Función**: Registra errores de ejecución de tools en `.claude/temp/LESSONS_LEARNED.md`
  con guardrails automáticos:
  - **Max 20 entradas** — las más antiguas rotan automáticamente
  - **Deduplicación** — errores repetidos incrementan un contador en vez de duplicarse
  - **Contexto** — registra el tool, error y archivo/comando involucrado

### 6. Sync Check (`sync-check.js`)
- **Evento**: Stop
- **Matcher**: ninguno (se ejecuta en cada respuesta)
- **Función**: Cuando Claude termina de responder, compara la fecha de modificación de
  cada archivo de la sesión que va a un índice (`session-writes.json`, que deja
  `write-tracker.js`) contra la del índice más reciente de `indices/`. Si alguno es más
  nuevo, sale con `exit 2` y le lista a Claude esos archivos y los índices que
  probablemente toque, así que sigue trabajando. No lee la conversación ni le pregunta a
  un modelo: mira el filesystem.

### 7. Circuit Breaker (dentro de `pre-write-guard.js`)
- **Evento**: PreToolUse (Edit|Write|MultiEdit)
- **Función**: Un `exit 2` es un "no" sin memoria — el agente puede reintentar la
  misma escritura indefinidamente. El breaker cuenta bloqueos por `{archivo, violación}`
  en un estado de sesión (`$TMPDIR/koa-breaker-{sessionId}.json`):

  | Intento | Qué recibe el agente |
  |---|---|
  | 1º | Violación + cómo corregirla |
  | 2º | Lo mismo + aviso de que va 2/3 |
  | 3º | **STOP**: deja de explicar el arreglo y le ordena escalar al humano |

  El mensaje del 3º intento cierra explícitamente las vías de escape (Bash, renombrar
  el archivo, trocear el cambio) porque son los rodeos que un agente bloqueado intenta.

  Cuenta por la **primera** violación, no por la lista completa: el agente suele
  arreglar una y dejar otra, con lo que el conjunto cambia en cada intento aunque el
  problema de fondo sea el mismo.

### 8. Spec Reflection (`spec-reflection.js`)
- **Evento**: Stop
- **Función**: `/plan` genera un task-spec con un "Criterio de done" en casillas
  markdown. Hasta v6.4 nadie las verificaba nunca — el spec era write-only. Este hook
  lee el spec activo al terminar la respuesta y devuelve los puntos sin cerrar, más
  evidencia del filesystem sobre los que puede comprobar solo (p.ej. si los fuentes
  son más recientes que los índices, la casilla de índices no está cumplida de verdad).

  **No re-evalúa el código** — eso es `/review` + `code-judge`. Solo comprueba que lo
  que el agente declaró que iba a hacer, lo hizo.

  **Anti-bucle**: el mismo estado del spec no se reporta dos veces. Sin eso el agente
  responde, el hook lo frena, vuelve a responder y el hook lo frena otra vez con lo
  mismo. Si el spec avanza (o retrocede), el aviso vuelve a salir.

  Si el spec no tiene **ninguna** casilla marcada, el hook calla: el agente no está
  usando el flujo del task-spec y no tiene sentido reclamarle pendientes de un
  documento que no adoptó.

### 9. Prettier (post-edit.js)
- **Evento**: PostToolUse
- **Matcher**: `Edit|Write|MultiEdit`
- **Función**: Formatea automáticamente con Prettier cada archivo editado.

### 10. Harness Gate (`harness-gate.js`)
- **Evento**: PreToolUse
- **Matcher**: `Edit|Write|MultiEdit`
- **Función**: Gobierna las ediciones al harness mismo (no al código de la app). Se activa
  solo sobre dos familias de superficies:

  | Superficie | Archivos | Rol |
  |---|---|---|
  | Guía | `.claude/rules/*.md`, `context/learnings.md`, `indices/ANTI-PATTERNS.md`, `CLAUDE.md` | Memoria/prosa que el agente lee |
  | Capacidad | `scripts/*.js`, `.claude/scripts/*.js` (excepto `scripts/architect.js`, ya protegido) | Código que corre y decide |

  Aplica dos disciplinas, inspiradas en el paper *HarnessCompass* (arXiv:2608.01918)
  sobre evolución automática de harnesses de agentes:

  | Chequeo | Superficie | Qué bloquea |
  |---|---|---|
  | GATE-A1 | Guía | Cita un track (`fix-NNN`/`spec-NNN`/`hotfix-NNN`/`task-NNN`) sin ningún criterio de aplicabilidad **en el mismo párrafo** — receta memorizada en vez de regla reusable |
  | GATE-A2 | Guía | Snippet de despacho por keyword-matching literal (`if ("token" in text)`) — ni siquiera como prosa/pseudo-código |
  | GATE-B1 | Guía | Lógica ejecutable real (`require`/`process.exit`/`fs.*`) colada en un archivo que debería ser solo prosa |
  | GATE-B2 | Capacidad | `console.log`/`console.warn` con tono de consejo y sin ningún `process.exit(2)` que lo respalde — guía disfrazada de script |
  | GATE-C1 | Capacidad declarada | Tocar `tools:`, `hooks:`, `model:` o `permission-mode:` en `.claude/agents/`, `.claude/skills/` o `.claude/commands/`. El texto de esos archivos es del agente; esas claves deciden qué puede hacer y las cambia el humano (`HUE-031`) |
  | GATE-D1 | Cualquier archivo con marcadores | Escribir DENTRO de una región `AUTO-GENERATED`. No falla ahora: desaparece en la próxima corrida del generador, sin rastro (`HUE-007`) |

  `GATE-A1` es un chequeo **léxico**, y su alcance es el párrafo a propósito: antes
  miraba el archivo entero, y como «cuando» y «nunca» son de las palabras más comunes
  de la prosa técnica en español, una sola lección bien escrita arriba de
  `learnings.md` absolvía a todas las recetas agregadas después (`DEC-002`). El
  guardrail se apagaba solo, y el disparador era usarlo bien una vez. No pretende
  distinguir un principio de una receta —un regex no puede—: pretende que el criterio
  esté escrito **donde está el track**.

  La intuición: una lección que sobrevive a una sesión debe quedar escrita como un
  **principio + criterio de cuándo aplica**, nunca como la respuesta memorizada a un
  track puntual; y la separación capacidad/guía evita que el harness acumule "consejo"
  en lugares donde nadie lo hace cumplir, o código real donde nadie lo lee como tal.
  Ver también el skill `/harness-feedback`, que alimenta estas superficies de guía con
  fricción real reportada por el propio agente al cerrar sesión.

## Linter Arquitectónico Completo (`architect.js` v2.0)

El linter AST se ejecuta con `npm run lint:arch` y valida **28 reglas**.

Analiza los `.ts`, los `.scss` y **los templates `template:` inline**, no solo los
`.html`: el boilerplate no tiene un solo archivo `.html`, así que sin eso las reglas
de markup no auditarían nada.

**Arquitectura (AST + regex):**

| Regla | Qué detecta | Método |
|---|---|---|
| ARCH-01 | `@supabase/supabase-js` en UI | AST (import declaration) |
| ARCH-02 | `inject(*Service)` en componentes vista | AST (call expression) |
| ARCH-03 | Falta `.spec.ts` para facades/services de `core/` | File existence |
| ARCH-04 | Falta OnPush | AST (decorator) |
| ARCH-05 | `@angular/animations` | AST (import declaration) |
| ARCH-06 | `*ngIf` / `*ngFor` / `[ngClass]` / `[ngStyle]` | Regex en markup |
| ARCH-07 | `@keyframes` en estilos de componente | Regex en .scss/.css |
| ARCH-08 | Colores Tailwind hardcodeados | Regex en markup |
| ARCH-09 / ARCH-10 | Complejidad (componentes shared, facades) | AST (line span) |

**Design system:**

| Regla | Qué detecta |
|---|---|
| ARCH-11 | Clases de token muertas: no existen en `@theme`, Tailwind no genera CSS y la clase no hace nada |
| ARCH-18 | Alias prohibidos dentro del propio `@theme` |
| ARCH-21 | Clase `.bento-*` definida sin aprobar en `scripts/lib/bento-classes.allowlist.json`. Freno contra el sprawl del grid — ver el árbol de decisión en `indices/STYLES.md` |
| ARCH-22 | Una clase del DS con el nombre de una utilidad "pelada" de Tailwind. Tailwind genera SU regla homónima en `@layer utilities` y **se suma** a la tuya en vez de reemplazarla |
| ARCH-23 | Celda hija de un grid `.bento-grid--fill-screen*` que ocupa 2 filas (`.bento-hero`/`.bento-feature`/`.bento-tall` o `data-row-span="2"`). Desborda el `grid-template-rows` explícito: las filas implícitas se superponen sin lanzar ningún error — ver el patrón App-like en `.claude/rules/visual-patterns.md` |
| ARCH-25 | Par texto/fondo por debajo de WCAG AA, **en cualquiera de los dos temas**. Compone los fondos semi-transparentes antes de medir. Ratcheado con `scripts/lib/contrast.baseline.json` |
| ARCH-26 | Token del `@theme` con el nombre de un valor de escala nativa. `--color-base` genera `text-base` como utilidad de **color**, que le gana a la de tamaño: es el bug que dejó los inputs del login en 1.15:1, invisibles en producción |

**Disciplina de clases (con ratchet):**

| Regla | Qué detecta |
|---|---|
| ARCH-15 | Pill/badge ad-hoc (`rounded-full` + micro-texto + `px-`) en vez de `.badge-count` |
| ARCH-16 | Utilities de tamaño pisando un `.btn-*` |
| ARCH-17 | Tamaño de fuente arbitrario `text-[NNpx]` fuera de la escala |
| ARCH-19 | Cluster tipográfico ad-hoc en vez de `.micro-label` / `.item-title` / `.section-eyebrow` |
| ARCH-24 | Cluster de input ad-hoc (borde + fondo + padding + radio sobre un campo) en vez de `.field-input` / `.field-label` |

Estas cinco usan un **ratchet**: `scripts/lib/class-discipline.baseline.json` registra la
deuda tolerada por archivo y solo se reporta una **regresión** (un archivo supera su cuota).
El proyecto solo puede mejorar. Tras limpiar deuda, fijá la mejora con
`npm run lint:arch -- --update-ds-baseline`. Koa arranca **sin baseline**, es decir con
tolerancia cero.

**Accesibilidad e iconos:**

| Regla | Qué detecta |
|---|---|
| A11Y-03 | Botón cuyo único contenido es un icono y no tiene nombre accesible |
| ICON-01 | Icono usado en un template pero **no registrado** en el `LucideAngularModule.pick()` de `app.config.ts`. No rompe el build: lucide lanza en **runtime** |
| NAV-01 | Entrada del menú que no resuelve a ninguna ruta de `app.routes.ts`. El usuario hace clic y cae en el not-found, y nada en el build lo delata. Koa mismo nacía con una: `/app/settings` estaba en el menú sin existir como ruta |

Los guardrails viven en `scripts/lib/` con sus propios tests: `npm run lint:arch:test`.

**Seguridad de datos (RLS), sobre el estado acumulado de `supabase/migrations/`:**

| Regla | Qué detecta | Método |
|---|---|---|
| SEC-RLS-01 | Tabla con RLS activado pero **ninguna** `CREATE POLICY` en todas las migraciones juntas | Agregado entre todas las migraciones |
| SEC-RLS-02 | Política permisiva (`USING (true)` / `WITH CHECK (true)`) en `FOR ALL/INSERT/UPDATE/DELETE` (o sin cláusula `FOR`, que Postgres interpreta como `ALL`) | Regex por sentencia `CREATE POLICY` |
| SEC-RLS-03 | Tabla creada sin `ENABLE ROW LEVEL SECURITY` en ninguna migración | Agregado entre todas las migraciones |

### RLS: por qué el hook y el linter no son redundantes

Es el único caso donde los dos miran lo mismo con criterios distintos, y es a propósito:

- **El hook** (`pre-write-guard.js`, ARCH Guard) ve un archivo en el momento de escribirlo.
  Exige el par tabla+política **juntos**, que es la convención del blueprint (sus propias
  migraciones lo hacen así).
- **El linter** ve todas las migraciones a la vez. Reconstruye el esquema acumulado y
  detecta el agujero real: una tabla que, sumadas todas las migraciones, sigue sin
  políticas. Una tabla creada en la migración 3 con políticas en la 7 le parece bien al
  hook (cada archivo por separado está OK), pero deja la tabla inaccesible entre medio.

Por eso el linter es más permisivo en un eje y más completo en el otro. Ninguno de los
dos solo alcanza: el hook no puede ver los otros archivos, y el linter corre después de
que el código ya se escribió.

### La invariante: toda regla registrada tiene que poder fallar

`scripts/lib/rule-wiring.js` audita el linter a sí mismo. No busca violaciones en tu código:
busca **reglas desconectadas** en `architect.js`.

Existe porque el mismo fallo ocurrió dos veces con distinto disfraz:

- **ARCH-24** tenía detector, tests y su llamada — y estaba fuera de `DS_RULES`, la lista fija
  que decide qué se compara contra el baseline. Encontraba 3 hits y reportaba 0.
- **ARCH-26** tenía detector y tests, y **no lo llamaba nadie**. Es el detector del token que
  dejó los inputs del login ilegibles en producción.

En los dos casos el linter dio verde, porque **una regla desconectada se ve exactamente igual
que una regla que pasa**: cero hallazgos, build limpio. Esa ambigüedad es el bug.

El test verifica tres cosas contra el `architect.js` real:

| Falla | Qué significa |
|---|---|
| **Huérfana** | Está en `RULES` y no tiene ningún camino a un `reportError`. No puede fallar nunca |
| **Fantasma** | Se reporta un ID que no está en `RULES`. El usuario ve un código sin nombre, sin doc y sin fix |
| **Ratchet incompleto** | La regla asoma en el circuito del ratchet (`add()` → `dsCounts` → `DS_RULES`) con un eslabón roto. Cuenta en silencio |

**Al agregar una regla nueva**, este test se rompe hasta que esté enchufada de punta a punta.
Es intencional: es la única señal que distingue "no hay violaciones" de "la regla no corre".

> Lo que **no** prueba: que el detector detecte bien. De eso se encarga la micro-suite de cada
> módulo. La división es deliberada — el fallo nunca fue "el detector está mal", siempre fue
> "el detector no está enchufado".

## Diferencia entre Hooks y Linter

| | Pre-Write Guard (Hook) | architect.js (Linter) |
|---|---|---|
| **Cuándo corre** | En cada Edit/Write individual | Bajo demanda (`npm run lint:arch`) |
| **Qué analiza** | Solo el contenido nuevo (diff) | Todo el proyecto completo |
| **Profundidad** | Regex rápido | AST completo de TypeScript |
| **Puede bloquear** | Sí (exit 2) | Sí (exit 1), pero post-hoc |
| **Detecta OnPush faltante** | Solo en Write (archivo nuevo) | Siempre (recorre todos los .component.ts) |

Juntos forman un sistema de **defensa en profundidad**: el hook atrapa violaciones
en tiempo real, el linter las atrapa en auditoría completa.

## Personalización

### Desactivar un hook específico

Edita `.claude/settings.json` y elimina el bloque del hook que quieres desactivar.

### Desactivar todos los hooks temporalmente

En Claude Code, ejecuta `/hooks` y usa el toggle al final del menú.

### Agregar reglas nuevas al Architect Guard

Edita `.claude/hooks/pre-write-guard.js` y agrega checks en la sección 3 (Architect Guard).
Para reglas que requieren AST, agrégalas en `scripts/architect.js`.

### Agregar archivos protegidos

Edita el array `protectedPatterns` en `pre-write-guard.js`.

## Troubleshooting

### "Discovery Gate me bloquea pero ya leí los índices"
El flag es por sesión. Si reiniciaste Claude Code, debes leer un archivo
de `indices/` de nuevo. Cualquier archivo de esa carpeta sirve.

### "El hook falla con error de JSON parsing"
Verifica que tu `~/.zshrc` o `~/.bashrc` no imprima texto en shells no-interactivas.
Envuelve los `echo` en `if [[ $- == *i* ]]; then ... fi`.

### "Quiero editar un archivo protegido"
Los archivos del sistema de hooks están protegidos contra edición por Claude.
Edítalos manualmente en tu editor de texto.

---

## Subagentes (`.claude/agents/`)

Los hooks restringen al agente. Los subagentes le dan **presupuesto de contexto**:
corren en su propia ventana y devuelven un resumen en vez de volcar archivos.

| Subagente | Devuelve | Modelo | Puede escribir |
|---|---|---|---|
| `discovery-scout` | Qué reutilizar / qué crear / qué evitar | rápido | no |
| `arch-auditor` | Violaciones de `lint:arch` + `tsc`, comprimidas | rápido | no |
| `index-syncer` | Diff de índices actualizados | rápido | solo `indices/` |
| `supabase-schema` | Tablas, FKs y políticas RLS reales | rápido | no |
| `code-judge` | Veredicto por criterio contra la rúbrica | razonador | no |

### Por qué el juez usa un modelo más caro

`code-judge` corre con un modelo de razonamiento mientras el resto usa uno rápido.
Un evaluador que razona igual que el generador no detecta los errores del generador —
comparte sus puntos ciegos. El resto de subagentes hacen tareas mecánicas (correr un
comando, comparar dos listas) donde un modelo rápido rinde igual y cuesta menos.

### Qué cubre el juez que los hooks no

Los guardrails detectan **sintaxis**: `*ngIf`, `@Input()`, colores hardcodeados, falta
de `OnPush`. Todo eso es regex y AST, y se atrapa solo.

Lo que ningún hook atrapa es el **diseño**: una facade que no respeta su contrato, un
Repository saltado, un Smart component disfrazado de Dumb, un nombre que contradice
`context/domain.md`. Para eso hace falta un modelo leyendo la rúbrica, y por eso
`/review` existe además de `npm run lint:arch`.

---

## Validadores genéricos (`.claude/hooks/validators/`)

A diferencia del resto de los hooks, `validate-file-contains.js` no sabe nada del
proyecto: recibe qué buscar por flags. Un validador, muchos usos.

```bash
node .claude/hooks/validators/validate-file-contains.js \
  --directory .claude/temp \
  --pattern "task-spec-*.md" \
  --max-age 60 \
  --require-file \
  --contains "## Objetivo" \
  --contains "## Criterio de done"
```

| Flag | Qué hace |
|---|---|
| `--directory` | Dónde buscar (relativo a la raíz del proyecto). Requerido. |
| `--pattern` | Glob simple sobre el nombre (`*`, `?`). Default `*.md` |
| `--contains` | Substring requerido. Repetible. |
| `--max-age` | Solo archivos modificados en los últimos N minutos |
| `--require-file` | Fallar si no existe ningún archivo que coincida |

Sin `--require-file`, "no hay archivo" significa "nada que validar" y sale con 0.
Mal configurado (sin `--contains`) tampoco bloquea: un validador roto no debe
frenar al agente.

### Hooks declarados en el frontmatter de una skill

Las skills pueden declarar sus propios hooks, que corren solo mientras esa skill
está activa. `/plan` lo usa para validar su propia salida:

```yaml
---
name: plan
hooks:
  Stop:
    - hooks:
        - type: command
          command: >-
            node $CLAUDE_PROJECT_DIR/.claude/hooks/validators/validate-file-contains.js
            --directory .claude/temp --pattern "task-spec-*.md"
            --require-file --contains "## Objetivo" --contains "## Criterio de done"
---
```

Por qué importa: pedirle a un agente en prosa que "genere un archivo con estas
secciones" es una *guideline*, y las guidelines se ignoran bajo presión de
contexto. Esto la convierte en *guardrail*. Y los encabezados no son decorativos —
`spec-reflection.js`, `prompt-context.js` y `compact-recovery.js` los leen por
nombre, así que renombrarlos en `/plan` rompe tres hooks.
