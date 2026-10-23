# Tasks {{ID}} — {{TITLE}}

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** {{DATE}}

---

## Cómo usar este archivo

- Las tareas se cortan por **slice**, no por capa. Un slice es la porción más chica que
  alguien puede **usar**: cruza las capas que necesite (migración → repository → facade →
  página) y termina verificado en el navegador y revisado. El orden por dependencias vale
  **dentro** del slice, no entre todo el feature.
- El **S1** es el esqueleto que camina: el happy path más fino de punta a punta. Cada
  slice siguiente agrega un AC o un edge case.
- Se trabaja **un slice a la vez**. No se arranca el S2 con el S1 sin usar y sin revisar.
- Marcá `[x]` apenas una tarea pasa su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea que SÍ es parte del slice, agregala a ese slice antes de
  hacerla. Si está fuera del scope de la spec → **detenete**: va al backlog (`/backlog`).
- Esta forma la verifican `npm run lint:specs` y el `spec-gate`: un `tasks.md` sin
  secciones `## Slice`, o un slice que no termina en `verify` y `/review`, bloquea las
  escrituras de código de la spec.

---

## Slice S1 — {{lo que se puede usar al terminarlo: el happy path más fino}}

> **AC ref:** AC1

- [ ] **S1.1** — Test en rojo del comportamiento que pide el AC, y **commit del test solo**
  - **DoD:**
    - [ ] El test falla por la razón correcta (no por un import roto)
    - [ ] Commit `test(red): …` sin implementación. Desde acá el `commit-guard` no deja
          cambiar sus aserciones en el mismo commit que el código que lo pone en verde
- [ ] **S1.2** — Lo mínimo para ponerlo en verde, cruzando las capas que haga falta
  - **DoD:**
    - [ ] `npm run test:ci` en verde sin tocar las aserciones del S1.1
    - [ ] Solo lo que el AC pide: ni columnas, ni métodos, ni pantallas «por si acaso»
    - [ ] Cada capa tocada cumple su checklist (al final de este archivo)
- [ ] **S1.3** — Refactor con los tests en verde (si no hace falta, marcalo y seguí)
- [ ] **S1.V** — Verificación de uso: `verify` en el navegador del flujo del slice
  - **DoD:** el AC se cumple **usándolo**, no leyendo el código
- [ ] **S1.R** — `/review` del diff del slice y commit
  - **DoD:** veredicto `APROBADO`, o reservas mostradas al humano. El diff es chico
    porque es un slice; si no lo es, el slice estaba mal cortado

## Slice S2 — {{el siguiente AC o edge case, también usable al terminarlo}}

> **AC ref:** AC-E1

- [ ] **S2.1** — Test en rojo + commit del test solo
- [ ] **S2.2** — Lo mínimo para ponerlo en verde
- [ ] **S2.3** — Refactor (si hace falta)
- [ ] **S2.V** — Verificación de uso: `verify` del flujo del slice
- [ ] **S2.R** — `/review` del diff del slice y commit

(Un bloque de slice por cada AC o edge case. Un slice que no se puede usar al terminarlo
está cortado por capa o es demasiado fino: juntalo con el que lo vuelve usable.)

---

## Cierre

- [ ] **C.1** — `npm run lint:arch` limpio y `npm run test:ci` verde
- [ ] **C.2** — `/spec-verify` genera `acceptance.md` con evidencia por AC
- [ ] **C.3** — Índices al día (`/sync-indices`)
- [ ] **C.4** — Spec `done` en `ROADMAP.md` y `specs/.active` limpio (`/spec-activate --clear`)

---

## Checklist técnico por capa

> No son tareas: es lo que cada capa tiene que cumplir **dentro del slice que la toque**.
> Un slice que no toca una capa no le debe nada.

**Migración** (`supabase/migrations/`)
- Naming `YYYYMMDDHHMMSS_dominio_tipo_desc.sql`
- `ENABLE ROW LEVEL SECURITY` y policies SELECT/INSERT/UPDATE/DELETE
- Solo las columnas que el slice usa: el slice que necesite otra la agrega en su migración
- `npx supabase db reset` lo corre un humano (Approval Gate)

**Modelos** (`core/models/`)
- DTO en PascalCase singular, 1:1 con la tabla
- UI Model solo si el DTO no alcanza, y diciendo por qué

**Facade** (`core/facades/`)
- Su `.spec.ts` es el test en rojo del slice
- Estado privado → estado público readonly → métodos
- `catchError` en cada llamada async y signal de error expuesto
- SWR (`initialize()` con guard + `refreshSilently()`) solo si cachea entre navegaciones,
  conforme con `.claude/rules/swr-pattern.md`

**Smart Component** (`features/`)
- OnPush, inyecta la Facade, bento grid como raíz
- `destroyRef.onDestroy(() => facade.dispose())` si hay realtime

**Dumb Components** (`shared/components/`)
- OnPush, solo `input()` / `output()`, sin Facades
- Skeleton colocated si recibe data async
- Tokens de color, `<app-icon>` para íconos, `data-llm-*` donde corresponda
- Tests si tiene `computed()` o lógica derivada

**Animación**
- `GsapAnimationsService` con `clearProps: 'transform'`; nada de `@angular/animations`
  ni `@keyframes`

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo al
> slice que corresponda. Si está fuera de scope, va al backlog (`/backlog`).
