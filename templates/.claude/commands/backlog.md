---
description: Agregar historias de usuario de una línea al backlog barato (specs/ROADMAP.md), sin crear spec
argument-hint: "\"Como <rol>, quiero <capacidad> para <beneficio>\" [más historias]"
allowed-tools: Read, Edit, Write, Bash
hooks:
  Stop:
    - hooks:
        - type: command
          command: >-
            node $CLAUDE_PROJECT_DIR/.claude/hooks/validators/validate-file-contains.js
            --directory specs
            --pattern "ROADMAP.md"
            --recursive
            --max-age 60
            --contains "## Historias"
---

# /backlog — Historias de una línea, sin spec

Vas a agregar historias al backlog barato: la sección `## Historias` de
`specs/ROADMAP.md`. **No** se crea carpeta, ni plan, ni plantilla. Escribir una historia
cuesta una línea y descartarla también; el detalle técnico se paga recién cuando alguien
la toma con `/spec-new H-NNN`.

## Argumento recibido

**$ARGUMENTS**

Si está vacío, o el usuario trae una idea en vez de historias ("quiero un todo list"),
armalas con él: **una pregunta a la vez, con tu recomendación** (la regla de `grill_me`),
apuntando siempre a lo mínimo. Siempre es más barato agregar una historia después que
borrar cinco que nadie necesitaba.

## Procedimiento

### 1. El backlog vive en `specs/ROADMAP.md`

```bash
ls specs/ROADMAP.md
```

- Si **no existe `specs/`**, avisale al usuario antes de crearla: crear `specs/` despierta
  el `spec-gate`, que desde ahí exige una spec activa para tocar código. Si acepta, crea
  `specs/`, `specs/specs/`, `specs/.active` vacío y copia
  `.claude/skills/sdd/templates/ROADMAP.md` a `specs/ROADMAP.md`.
- Si existe pero **no tiene `## Historias`**, agregá la sección de la plantilla arriba de
  `## Activa`.

### 2. Una historia, una cosa

Cada línea tiene la forma:

```
- [ ] **H-NNN** · Como <rol>, quiero <capacidad> para <beneficio>.
```

Antes de escribir, revisá cada historia:

- **¿Hace una sola cosa?** Si lo que quiere lleva «y» —"quiero registrarme **y** crear
  tareas"— son dos. Proponé partirla, con las dos líneas ya escritas.
- **¿Tiene el para qué?** El beneficio es lo que dice si de verdad hace falta. Sin él,
  preguntalo; no lo inventes.
- **¿Ya está?** Si una historia del backlog o una spec existente dice lo mismo, decilo en
  vez de duplicarla.

### 3. Numerar y escribir

- `H-NNN` es secuencial, empieza en `H-001` y nunca se reutiliza: buscá el máximo en la
  sección (también entre las marcadas `[x]`) y sumá uno. La línea de ejemplo `H-000` de la
  plantilla no cuenta; borrala con la primera historia real.
- Agregá las líneas al final de la sección, en el orden que pidió el usuario. El orden es la
  prioridad: reordenar es mover líneas.

### 4. Verificar y reportar

```bash
npm run lint:specs
```

Tiene que salir en 0: revisa que los ids no se repitan y que cada historia tenga sus tres
partes. Si avisa de una historia que "quiere dos cosas", mostráselo al usuario: es una
sospecha, la decide él.

Imprime:

```
✅ <N> historia(s) en el backlog (specs/ROADMAP.md):
  H-004 · Como visitante, quiero registrarme con email para tener cuenta.
  H-005 · Como usuario, quiero crear una tarea para no olvidarme.

Para tomar una:  /spec-new H-004
```

## Reglas

- NO crear specs, carpetas ni planes: eso es `/spec-new H-NNN`, cuando la historia se toma.
- NO agregar detalle técnico (tablas, endpoints, componentes) a la línea: no es el momento.
- NO juntar dos capacidades en una historia.
- Si el proyecto usa la capa de Asignaciones, una historia del backlog NO es una Asignación:
  la Asignación reparte trabajo a una persona; la historia es la unidad de valor.
