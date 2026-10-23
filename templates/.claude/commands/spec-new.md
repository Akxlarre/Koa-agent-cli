---
description: Crear una nueva spec SDD (Spec-Driven Development) con scaffold completo
argument-hint: "<título del feature>"
allowed-tools: Read, Write, Bash, Glob
hooks:
  Stop:
    - hooks:
        - type: command
          command: >-
            node $CLAUDE_PROJECT_DIR/.claude/hooks/validators/validate-file-contains.js
            --directory specs
            --pattern "spec.md"
            --recursive
            --max-age 60
            --contains "## 2. User Stories"
            --contains "## 3. Acceptance Criteria"
            --contains "## 4. Out of scope"
---

# /spec-new — Crear nueva spec SDD

Vas a crear el scaffold completo de una nueva spec siguiendo el patrón SDD de Koa CLI.

## Argumento recibido

Título del feature, o el id de una historia del backlog: **$ARGUMENTS**

(Si está vacío, pídele al usuario que provea un título descriptivo. Ejemplo: "Registro de usuario con email".)

### Si el argumento es un `H-NNN` — la historia se vuelve spec

Es el camino normal: la historia esperó en el backlog de una línea y alguien la toma
ahora. Busca su línea en la sección `## Historias` de `specs/ROADMAP.md`:

- Si no está, o ya está marcada `[x]`, avísale al usuario y detente.
- El **título** sale de la capacidad de la historia (lo que va después de "quiero").
- La historia entera es la **US1** de la spec, tal cual está escrita. Es la única: una
  spec = una historia.
- En la cabecera, `> **Historia:** H-NNN`.
- Al terminar, marca la línea del backlog: `- [x] **H-NNN** · <texto> → spec NNNN`.

## Procedimiento

### 1. Verificar que el proyecto tenga SDD inicializado

```bash
ls specs/
```

- Si `specs/` no existe, créalo y copia `.claude/skills/sdd/templates/ROADMAP.md` a `specs/ROADMAP.md`. Crea también `specs/.active` vacío.

### 2. Determinar el próximo ID secuencial

- Lista las carpetas existentes en `specs/` con formato `NNNN-*`
- El próximo ID es el máximo encontrado + 1, formateado como 4 dígitos (`0001`, `0002`, etc.)
- Si no hay specs, empieza en `0001`

### 3. Generar slug del título

- Lowercase
- Sin acentos (á→a, é→e, etc.)
- Espacios → guiones
- Solo `[a-z0-9-]`
- Ejemplo: "Registro de Usuario con Email" → `registro-de-usuario-con-email`

### 4. Crear estructura de carpetas

```
specs/specs/NNNN-slug/
├── spec.md          (copiar desde .claude/skills/sdd/templates/spec.md)
├── plan.md          (vacío todavía — se genera con /spec-plan)
├── tasks.md         (vacío todavía — se genera con /spec-tasks)
└── acceptance.md    (vacío todavía — se genera con /spec-verify)
```

Para los 3 archivos vacíos por ahora, créalos con solo este placeholder:
```
# (vacío — se genera con /spec-XXX cuando corresponda)
```

### 5. Personalizar `spec.md`

Lee la plantilla `.claude/skills/sdd/templates/spec.md` y reemplaza los placeholders:
- `{{ID}}` → el ID nuevo (ej. `0001`)
- `{{TITLE}}` → el título del feature
- `{{DATE}}` → fecha actual en formato `YYYY-MM-DD`
- `{{OWNER}}` → el usuario (pregunta si no lo sabes)
- `{{P0|P1|P2}}` → pregúntale al usuario la prioridad

Las secciones internas (User Stories, AC, etc.) las dejas con los placeholders `{{...}}` para que el usuario las complete. NO inventes contenido de negocio. La excepción es la US1 cuando la spec nace de un `H-NNN`: esa ya la escribió el usuario en el backlog.

**Una sola historia.** Si al redactar aparece una segunda, no la sumes: agrégala al
backlog con `/backlog` y sigue con la primera. El `spec-gate` bloquea el código de una
spec activa con más de una historia.

### 6. Actualizar `specs/ROADMAP.md`

Agrega una fila a la tabla "Specs escritas, sin activar" con el nuevo ID, título, prioridad y dueño. Si la spec nació de un `H-NNN`, marca además esa historia como tomada (ver arriba).

### 7. Reportar al usuario

Imprime:

```
✅ Spec NNNN-slug creada en specs/specs/NNNN-slug/

Archivos:
  - spec.md (plantilla lista para completar)
  - plan.md (vacío)
  - tasks.md (vacío)
  - acceptance.md (vacío)

Próximos pasos:
  1. Completa las secciones de spec.md (User Stories, AC, Out of scope, etc.)
  2. Cambia el status de "draft" a "approved" cuando esté lista
  3. /spec-activate NNNN-slug para empezar a trabajarla
  4. /spec-plan para generar el plan técnico

¿Quieres que te ayude a redactar las User Stories y los Acceptance Criteria ahora?
```

## Reglas

- NO actives la spec automáticamente (eso es trabajo de `/spec-activate`).
- NO redactes user stories ni AC sin pedírselos al usuario — la spec es su contrato.
- NO metas dos historias en una spec: la segunda va al backlog (`/backlog`).
- NO toques `specs/.active` en este comando.
- Si el usuario invoca `/spec-new` sin argumento, pídele el título antes de hacer nada.
