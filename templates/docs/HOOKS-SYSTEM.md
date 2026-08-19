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
    ├─ Claude termina de responder
    │   └─ Stop → prompt hook → "¿Actualizaste los índices?" → si no → sigue trabajando
    │
    ├─ Un tool falla
    │   └─ PostToolUseFailure → failure-tracker.js → registra en LESSONS_LEARNED.md
    │
    └─ Contexto se compacta
        └─ PostCompact → compact-recovery.js → re-inyecta índices
```

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

**Contexto inyectado por tipo de archivo (Context Injection):**

Cuando una escritura pasa todas las validaciones, el hook inyecta reglas relevantes
directamente en el contexto de Claude vía `additionalContext`. Esto hace que Claude
tenga las rules y skills presentes **sin tener que leerlas manualmente**.

| Archivo editado | Rules inyectadas | Skills referenciadas |
|----------------|-----------------|---------------------|
| `features/*.component.ts` | architecture.md (Smart), visual-system.md (tokens, bento, GSAP) | angular-component, design-system, angular-signals |
| `shared/*.component.ts` | architecture.md (Dumb: solo input/output), visual-system.md (cards, radios) | angular-component, design-system |
| `layout/*.component.ts` | architecture.md (Layout), visual-system.md (dark mode) | — |
| `core/services/*.facade.ts` | architecture.md (Facade pattern, toSignal) | angular-signals |
| `core/services/*.service.ts` | architecture.md (Core service, no UI injection) | angular-signals |
| `core/directives/*.ts` | architecture.md (directivas) | angular-component |
| `supabase/migrations/*.sql` | database.md (naming, RLS, idempotencia) | supabase-data-model |
| `*.html` (templates) | architecture.md (@if/@for), visual-system.md (tokens, bento), ai-readability.md (data-llm-*) | angular-primeng |
| `*.scss` / `*.css` | visual-system.md (tokens, layouts, motion) | design-system |

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
    según el flag de discovery. No los 11.
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

### 6. Sync Check (prompt hook)
- **Evento**: Stop
- **Matcher**: ninguno (se ejecuta en cada respuesta)
- **Tipo**: `prompt` (evaluado por modelo Haiku)
- **Función**: Cuando Claude termina de responder, Haiku evalúa si se crearon
  componentes/servicios nuevos sin actualizar los índices. Si detecta drift,
  fuerza a Claude a continuar y actualizar los índices.

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

## Linter Arquitectónico Completo (`architect.js` v2.0)

El linter AST se ejecuta con `npm run lint:arch` y valida **8 reglas**:

| # | Regla | Método |
|---|-------|--------|
| 1 | Sin @supabase/supabase-js en UI | AST (import declaration) |
| 2 | Sin inject(*Service) en componentes vista | AST (call expression) |
| 3 | TDD: .spec.ts para facades/services en core/ | File existence check |
| 4 | OnPush en todos los componentes | AST (decorator) + text search |
| 5 | Sin @angular/animations | AST (import declaration) |
| 6 | Sin *ngIf/*ngFor/[ngClass]/[ngStyle] | Regex en .html |
| 7 | Sin @keyframes en SCSS | Regex en .scss/.css |
| 8 | Sin colores Tailwind hardcodeados | Regex en .ts/.html |
| SEC-RLS-01 | Tabla sin políticas RLS | Agregado **entre todas** las migraciones |
| SEC-RLS-02 | Política permisiva en operación de escritura | Regex por sentencia |
| SEC-RLS-03 | Tabla sin RLS activado | Agregado entre todas las migraciones |

### RLS: por qué el hook y el linter no son redundantes

Es el único caso donde los dos miran lo mismo con criterios distintos, y es a propósito:

- **El hook** ve un archivo en el momento de escribirlo. Exige el par tabla+política
  **juntos**, que es la convención del blueprint (sus propias migraciones lo hacen así).
- **El linter** ve todas las migraciones a la vez. Reconstruye el esquema acumulado y
  detecta el agujero real: una tabla que, sumadas todas las migraciones, sigue sin
  políticas. Una tabla creada en la migración 3 con políticas en la 7 le parece bien.

Por eso el linter es más permisivo en un eje y más completo en el otro. Ninguno de los
dos solo alcanza: el hook no puede ver los otros archivos, y el linter corre después.

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
