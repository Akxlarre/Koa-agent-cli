---
name: sdd
description: >
  Spec-Driven Development para Koa CLI. Activar cuando el usuario pida crear, planificar,
  ejecutar o verificar un feature/módulo, o cuando mencione "spec", "requerimiento",
  "historia de usuario", "backlog", "plan técnico", "acceptance criteria" o use cualquier
  comando /backlog, /spec-*, /fix-*, /hotfix o /assign-*. El SDD impone un contrato
  verificable (historia → spec → plan → slices → acceptance) antes de tocar código de
  producto, y se entrega por slices verticales, no por capas; la capa de Asignaciones
  (/assign-new, /assign-list, /assign-claim) reparte tareas de equipo antes de que cada
  quien escriba su propia spec.
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# SDD — Spec-Driven Development para Koa CLI

> Este skill convierte cada historia en un **contrato verificable** antes de tocar código.
> Cuatro artefactos por spec, validados por hooks. Stack-agnóstico (sirve para Angular,
> Next.js, Python, etc.) — el acoplamiento con el dominio del proyecto vive en sus índices
> y reglas locales, no acá.

## Lo que este SDD NO es

No es planificar todo por adelantado y entregárselo a un agente. Eso es cascada: se
decide la arquitectura cuando menos se sabe del problema, la IA rellena los huecos con
sobreingeniería, las tareas salen por capas —toda la BD, después todos los facades, al
final la UI—, nada funciona hasta la última fase y el humano termina revisando miles de
líneas leyendo, sin haber podido usar nada. Tres reglas lo evitan, y las tres las hace
cumplir un mecanismo, no esta prosa:

| Regla | Qué la hace cumplir |
|---|---|
| **El backlog es barato.** Una historia es una línea; el detalle se paga cuando se toma | `/backlog` + `npm run lint:specs` |
| **Una spec = una historia.** La segunda vuelve al backlog | `spec-gate` (bloquea el código) + `lint:specs` |
| **Se entrega por slices.** Cada uno cruza las capas que necesite, se usa (`verify`) y se revisa (`/review`) antes del siguiente | `spec-gate` + `lint:specs` sobre `tasks.md`; `commit-guard` (tests intocables, commits que entran en un `/review`) |

La IA escribe y el humano navega: decide qué se construye, qué no, y cuándo se
refactoriza. La IA ahorra escribir, no pensar.

## Cuándo activar este skill

- El usuario invoca `/backlog`, `/spec-new`, `/spec-activate`, `/spec-plan`, `/spec-tasks`, `/spec-verify`, `/fix-new`, `/fix-close`, `/hotfix`, `/hotfix-close`, `/assign-new`, `/assign-list` o `/assign-claim`.
- El usuario pide "anotá esta historia", "armemos el backlog", "creemos la spec de…", "planifiquemos el feature X", "verifica los AC", "asígnale esto a X", "qué me toca a mí", "designemos tareas al equipo".
- Vas a tocar `src/`, `app/`, `lib/` o `supabase/migrations/` y el proyecto tiene carpeta `specs/`
  (en ese caso el `spec-gate` te bloqueará si no hay spec activa — este skill te dice cómo desbloquearlo).

## El ciclo SDD

| Fase | Comando | Artefacto | Responsable |
|------|---------|-----------|-------------|
| 0. Backlog | `/backlog "Como…, quiero…, para…"` | una línea en `## Historias` de `specs/ROADMAP.md` | Usuario decide; Claude propone lo mínimo |
| 1. Spec | `/spec-new H-NNN` (o `"título"`) | `specs/specs/NNNN-slug/spec.md` — **una** historia | Usuario aprueba; Claude puede redactar borrador |
| 2. Activar | `/spec-activate NNNN` | `specs/.active` | Usuario |
| 3. Plan | `/spec-plan` | `specs/specs/NNNN-slug/plan.md`, con su tabla de slices | Claude redacta basado en spec + índices |
| 4. Slices | `/spec-tasks` | `specs/specs/NNNN-slug/tasks.md` — un `## Slice` por AC | Claude descompone el plan en slices usables |
| 5. Implementar | un slice a la vez | test en rojo commiteado → verde → `verify` → `/review` → commit | Claude escribe; el humano navega; los hooks validan |
| 6. Verificar | `/spec-verify` | `specs/specs/NNNN-slug/acceptance.md` | Claude (agente principal) marca AC con evidencia; el humano firma |

## Estructura canónica de un proyecto con SDD activo

```
<proyecto>/
├── specs/
│   ├── ROADMAP.md              # backlog de historias (H-NNN, una línea) + índice vivo de las specs
│   ├── ASSIGNMENTS.md          # tablero de Asignaciones de equipo (previo a un track) — opcional
│   ├── assignments/
│   │   └── ASG-X-NNN-slug.md     # brief de una Asignación (contexto para quien la reclame)
│   ├── .active                 # contiene el ID del track en ejecución, o vacío
│   ├── specs/
│   │   └── NNNN-X-slug/
│   │       ├── spec.md         # UNA historia: QUÉ + POR QUÉ + AC + out-of-scope
│   │       ├── plan.md         # CÓMO técnicamente + tabla de slices
│   │       ├── tasks.md        # un `## Slice` por AC: test en rojo → verde → verify → /review
│   │       └── acceptance.md   # AC marcados con evidencia (commit, test, screenshot)
│   ├── fixes/
│   │   └── fix-NNN-X-slug/
│   │       └── fix.md          # Root Cause + ACs afectados + test de regresión
│   └── hotfixes/
│       └── hotfix-NNN-X-slug/
│           └── hotfix.md       # Problema + Cambios (se cierra con /hotfix-close)
└── .claude/
    └── settings.json           # engancha los hooks SDD globales
```

## Asignaciones de equipo (capa previa, opcional)

Para equipos multi-dev (varios agentes/personas compartiendo `specs/` commiteado al repo —
en proyectos de un solo dev conviene gitignorarlo), existe una capa **antes**
de la spec: la **Asignación**. No es un 4to track — es cómo alguien designa
"esto hay que hacer" a un integrante del equipo (o lo deja abierto), y esa persona genera su propio
track real a partir de ahí, con contexto pre-cargado.

```
/assign-new "título"     → specs/ASSIGNMENTS.md ("Pendientes", visible para todo el equipo)
/assign-list             → cada dev ve qué le toca a él (o qué está libre para tomar)
/assign-claim <ASG-ID>   → resume la ASG y da a quien reclama una instancia breve para
                           confirmar u objetar la visión heredada, ANTES de generar el track
                           → genera spec/fix/hotfix con SU código de autor, contexto pre-cargado
                           → de ahí en más, flujo SDD normal (/spec-plan, /spec-tasks, etc.)
```

- Vive en `specs/ASSIGNMENTS.md` (índice) + `specs/assignments/ASG-X-NNN-slug.md` (un archivo liviano por asignación).
- `ASG-<autor>-NNN` usa contador **por autor**, igual que spec/fix/hotfix (ver `specs/AUTHORS.md`). Un contador global provoca que dos devs en ramas distintas saquen el mismo ID y que git auto-resuelva el merge sin conflicto.
- Las tablas "Reclamadas / En curso" y "Completadas" de `ASSIGNMENTS.md` son **auto-generadas** por `npm run assignments:sync` desde el frontmatter de cada `ASG-*.md`, cruzado con el `status`/`closed` del track resultante. Solo "Pendientes" se mantiene a mano (tiene curación: flags de bloqueo, notas de solape, agrupación por reunión).
- `npm run assignments:audit` verifica integridad (naming, colisiones de numeración, refs colgantes, filas stale) sin escribir nada.
- **Riesgo multi-rama**: si cada dev trabaja en su propia rama, el tablero puede quedar desactualizado entre ramas. `/assign-new` y `/assign-claim` hacen un chequeo best-effort (`git fetch` + diff contra `origin/main`) y recuerdan commitear/pushear la reclamación de inmediato, separada del resto del trabajo de feature — ver la sección "Conflictos entre ramas" en `specs/ASSIGNMENTS.md`.
### El interruptor: `specs/AUTHORS.md`

**La capa entera se enciende con la presencia de `specs/AUTHORS.md`**, y ese único hecho
gobierna las tres decisiones:

| | Sin `AUTHORS.md` | Con `AUTHORS.md` |
|---|---|---|
| `assignments:audit` / `:sync` | mensaje y **exit 0** | corren de verdad |
| IDs de track | `NNNN-slug` | `NNNN-<autor>-slug` |
| `/assign-*` | avisan que la capa está apagada | flujo completo |

Es `AUTHORS.md` y no `ASSIGNMENTS.md` porque el código de autor existe para que dos ramas
no saquen el mismo número y git las auto-resuelva sin conflicto — y ese riesgo aparece
cuando hay más de un autor, que es justamente lo que `AUTHORS.md` declara. El tablero es
`ASSIGNMENTS.md`; el hecho es `AUTHORS.md`.

**Para encenderla:**

```bash
mkdir -p specs/assignments
cp .claude/skills/sdd/templates/AUTHORS.md specs/AUTHORS.md       # y completá la tabla
cp .claude/skills/sdd/templates/ASSIGNMENTS.md specs/ASSIGNMENTS.md
npm run assignments:audit   # debe salir en 0 y sin hallazgos
```

Las tablas auto-generadas de `ASSIGNMENTS.md` van entre marcadores
`<!-- AUTO-GENERATED:BEGIN/END -->`; `assignments:sync` solo reescribe lo que está entre
ellos y el resto del tablero es tuyo.

- Si el equipo no la necesita (proyecto de una sola persona), simplemente no se usa —
  `/spec-new` sigue funcionando igual, y los dos scripts salen en 0 diciendo que la capa
  está apagada en vez de poner el CI en rojo.

## Los hooks SDD (vendorizados en `.claude/hooks/sdd/`, activos solo si existe specs/)

| Hook | Evento | Función |
|------|--------|---------|
| `spec-gate.js` | PreToolUse Edit\|Write\|MultiEdit | Bloquea escrituras en código de producto si no hay spec activa, si su plan es todavía el placeholder de `/spec-new`, o si la spec no tiene la forma: más de una historia, o un `tasks.md` cortado por capas / con un slice que no termina en `verify` y `/review` |
| `plan-injector.js` | PreToolUse Edit\|Write\|MultiEdit | Inyecta spec + plan + slices activos como contexto adicional en cada edición |
| `hotfix-autoclose.js` | SessionEnd | Red de seguridad: cierra el `hotfix-*` que quedó abierto. El cierre normal es `/hotfix-close` |

La forma la define `.claude/hooks/lib/sdd-forma.js`, y la usan dos piezas con el mismo
código: el `spec-gate`, sobre la spec activa en cada escritura, y `npm run lint:specs`,
sobre todas las specs y el backlog. Fuera de esta carpeta, el `commit-guard` cuida lo que
un commit lleva (`COMMIT-01`: aserciones de tests existentes, `COMMIT-02`: tamaño) y
`spec-reflection` coteja lo escrito con lo declarado.

No hay un verificador automático de AC: los verifica `/spec-verify`, corrido por el agente
principal, y los firma el humano.

**Importante: los hooks son fail-open.** Si un proyecto no tiene `specs/`, el hook no bloquea
nada — esto los hace seguros de embarcar por defecto sin romper proyectos que no usan SDD.

## Convención de IDs

- Formato: `NNNN-kebab-slug` (ej: `0001-registro-de-usuario`)
- NNNN es secuencial de 4 dígitos, empieza en `0001`
- El slug se deriva del título: lowercase, sin acentos, espacios → guiones
- IDs nunca se reutilizan ni se renumeran

## Estado de specs (campo `status` en spec.md)

| Estado | Significado |
|--------|-------------|
| `draft` | Spec en redacción, no se puede activar |
| `approved` | Spec aprobada por el usuario, se puede activar |
| `in_progress` | Spec activa (referenciada por `.active`) |
| `done` | Todos los AC verificados con evidencia |
| `archived` | Descartada/superseded (mantener para historia) |

## Reglas de operación

1. **Una spec activa a la vez, y una historia por spec.** No hay paralelismo. Si necesitas cambiar de feature, cierra la actual o desactívala (`/spec-activate --clear`). La segunda historia va al backlog.
2. **No tocas código sin spec activa.** El spec-gate te bloquea. Si te bloquea, lee este skill y dile al usuario qué comando correr.
3. **El plan se deriva de la spec; los slices del plan.** Nunca al revés.
4. **Un slice a la vez.** Test en rojo commiteado solo, lo mínimo para el verde, usarlo con `verify`, `/review` de su diff, commit. No se arranca el siguiente con este sin usar.
5. **Out-of-scope es sagrado.** Si el usuario pide algo que está fuera del scope declarado, va al backlog con `/backlog`, no a la spec actual.
6. **Acceptance Criteria son Gherkin.** Given/When/Then. Verificables. Nada de "el sistema debe ser rápido".
7. **`/spec-verify` es la fuente de verdad del cierre.** No marques una spec como `done` sin haberlo pasado.

## Plantillas

Las plantillas viven en `.claude/skills/sdd/templates/` (vendorizadas en este proyecto, ver nota abajo):

- `spec.md` — el contrato de una historia
- `plan.md` — descomposición técnica y tabla de slices
- `tasks.md` — un bloque por slice, más el checklist técnico por capa
- `acceptance.md` — verificación final
- `ROADMAP.md` — backlog de historias de una línea + índice del proyecto

Los comandos `/spec-new`, `/spec-plan`, etc. copian estas plantillas como base.

## Conexión con el sistema Koa Blueprint existente

SDD **complementa**, no reemplaza, el sistema actual:

| Layer existente | Sigue funcionando |
|-----------------|-------------------|
| Discovery Gate (lee índices antes de código) | Sí — corre DESPUÉS del spec-gate |
| Architect Guard (valida forma del código) | Sí — sin cambios |
| Sync Check (índices actualizados) | Sí — sin cambios |
| Spec Reflection (criterio de done + deriva de alcance) | Sí — sobre el task-spec de `/plan`, que puede convivir con la spec |
| Commit Guard (tests intocables, commits revisables) | Sí — sobre todo commit, haya SDD o no |
| `indices/*.md` | Se referencian en `plan.md` para reutilizar |
| `.claude/rules/*.md` | Se mencionan en `plan.md` como restricciones |

**División de responsabilidades:**
- SDD = QUÉ construir (contrato de negocio)
- Koa Blueprint = CÓMO construirlo (contrato técnico)

## Anti-patrones (NO HACER)

- ❌ Escribir código sin spec activa (el gate te bloquea, no intentes pasarlo)
- ❌ Planificar el feature entero por capas ("primero toda la BD") → un slice usable a la vez
- ❌ Meter dos historias en una spec → la segunda va al backlog (`/backlog`)
- ❌ Cambiar las aserciones de un test en el mismo commit que el código que lo pone en verde
- ❌ Extender una spec activa para meter scope nuevo → va al backlog
- ❌ Marcar AC como cumplido sin evidencia (commit hash, archivo de test, ruta de screenshot)
- ❌ Editar specs `done` → si necesitan cambio, abrir spec nueva que la supersede
- ❌ Renumerar specs o reutilizar IDs
- ❌ Acoplar los hooks SDD a un stack específico (Angular, Next, etc.) — el SDD es agnóstico

## Activar el SDD en este proyecto

El motor SDD viene **vendorizado**: los comandos (`.claude/commands/`), este skill
(`.claude/skills/sdd/`) y los hooks (`.claude/hooks/sdd/`) ya están en el repo y se commitean
con él. No dependen de `~/.claude/` global — cualquier dev que clone el repo hereda el motor
completo con un `git pull`, sin pasos manuales.

Pero el SDD arranca **dormido**. `spec-gate.js` es fail-open: si no existe la carpeta `specs/`,
deja pasar toda escritura y el ciclo no te molesta. Para activarlo:

```bash
mkdir -p specs/specs specs/fixes specs/hotfixes
touch specs/.active
cp .claude/skills/sdd/templates/ROADMAP.md specs/ROADMAP.md
```

Desde ese momento, tocar código de producción (`src/`, `app/`, `lib/`, `supabase/migrations/`)
exige una spec activa con su `plan.md`. Para desactivarlo, basta con borrar `specs/`.

### Capa de Asignaciones (opcional)

`/assign-new`, `/assign-list` y `/assign-claim` sirven para repartir trabajo en equipos de 2+
devs. Requieren además:

```bash
cp .claude/skills/sdd/templates/ASSIGNMENTS.md specs/ASSIGNMENTS.md
mkdir -p specs/assignments
```

y los scripts `npm run assignments:sync` / `assignments:audit` (incluidos en `scripts/`).
En proyectos de un solo dev podés ignorar esta capa por completo: el ciclo
spec → plan → tasks → acceptance funciona sin ella.
