---
description: Descomponer plan.md de la spec activa en slices verticales con DoD (tasks.md)
allowed-tools: Read, Write, Bash
hooks:
  Stop:
    - hooks:
        - type: command
          command: >-
            node $CLAUDE_PROJECT_DIR/.claude/hooks/validators/validate-file-contains.js
            --directory specs
            --pattern "tasks.md"
            --recursive
            --max-age 60
            --require-file
            --contains "## Slice S1"
            --contains "## Cierre"
---

# /spec-tasks — Descomponer el plan en slices

Vas a producir `tasks.md` de la spec activa transformando la tabla de slices del plan
(sección 9) en un checklist ejecutable, **un bloque por slice**.

## Procedimiento

### 1. Identificar la spec activa

```bash
cat specs/.active
```

- Si está vacío o tiene `--bypass` → abortar: "No hay spec activa."

### 2. Verificar que la spec tenga `plan.md` aprobado

- Leer `specs/<active>/plan.md`
- Si no existe, o es todavía el placeholder `# (vacío…` → abortar: "No hay plan. Corre /spec-plan primero."
- Si está marcado como `Status: draft`, advertir al usuario

### 3. Leer también `spec.md`

Necesitas los AC para cruzar cada slice con el AC que cubre (campo `AC ref:`).

### 4. Generar `tasks.md`

Lee la plantilla `.claude/skills/sdd/templates/tasks.md` y complétala:

#### Reemplazos básicos
- `{{ID}}`, `{{TITLE}}`, `{{DATE}}`

#### Un `## Slice` por fila de la tabla de slices del plan

Cada slice es la porción más chica que alguien puede **usar**, y cruza las capas que
necesite. Lleva siempre las mismas cinco tareas, en este orden:

1. **S·.1** — Test en rojo del AC, y commit del test solo
2. **S·.2** — Lo mínimo para ponerlo en verde, en todas las capas que haga falta
3. **S·.3** — Refactor con los tests en verde (si hace falta)
4. **S·.V** — Verificación de uso: `verify` en el navegador
5. **S·.R** — `/review` del diff del slice y commit

El **S1** es el esqueleto que camina: el happy path más fino de punta a punta. Después,
un slice por AC o edge case. Cerrá con la sección `## Cierre` de la plantilla y dejá el
**checklist técnico por capa** tal cual: es lo que cada capa cumple dentro del slice que
la toque.

#### Reglas para cada slice

- **Usable**: al terminarlo hay algo que se prueba en el navegador. Si no, está cortado
  por capa: juntalo con el slice que lo vuelve usable.
- **Chico**: su diff entra en un `/review` (el `commit-guard` bloquea commits de más de
  400 líneas de código de producto).
- **Trazable**: `AC ref:` con el AC o edge case que cubre.
- **Ordenado por dependencias adentro**: migración → repository → facade → página, pero
  solo lo que ESE slice usa. La columna que necesita el S3 la agrega la migración del S3.

#### Ejemplo de slice bien cortado

```markdown
## Slice S2 — el email repetido muestra "ese email ya está registrado"

> **AC ref:** AC-E1

- [ ] **S2.1** — Test en rojo en `auth.facade.spec.ts` + commit del test solo
- [ ] **S2.2** — `AuthFacade.register()` mapea el 23505 a ese mensaje; el form lo muestra
- [ ] **S2.3** — Refactor (si hace falta)
- [ ] **S2.V** — Verificación de uso: `verify` registrando dos veces el mismo email
- [ ] **S2.R** — `/review` del diff del slice y commit
```

#### Ejemplo de corte mal hecho (NO)

```markdown
## Fase 1 — Datos y modelo     ← por capa: nada se puede usar hasta la Fase 4
## Fase 2 — Capa Facade
## Fase 3 — Capa UI
```

### 5. Verificar la forma y reportar

```bash
npm run lint:specs
```

Tiene que salir en 0. El `spec-gate` hace la misma pregunta en cada escritura: con un
`tasks.md` sin `## Slice`, o con un slice que no termina en `verify` y `/review`, no deja
escribir código de esta spec.

Imprime:

```
✅ Tasks generadas: specs/<active>/tasks.md

Resumen:
  - <N> slices, cada uno usable al terminarlo
  - S1 (esqueleto): <qué se puede usar>
  - <X> AC y edge cases cubiertos

Para empezar:
  "Arranquemos el S1" — un slice a la vez: test en rojo, verde, usarlo, /review, commit.
```

## Reglas

- NO cortar por capas. "Toda la BD", "todos los facades", "la UI" no son slices.
- NO crear slices que no mapeen al `plan.md`. Si descubres algo no planificado, sugiere actualizar el plan primero.
- NO incluir DoD genéricos tipo "está terminado". DoD = lista verificable.
- Si el feature es trivial (1-2 archivos), es UN slice. No fuerces más.
