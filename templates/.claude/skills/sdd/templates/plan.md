# Plan {{ID}} — {{TITLE}}

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** {{DATE}}

---

## 1. Resumen ejecutivo

(2-3 frases. Qué se va a construir técnicamente, en qué orden grueso.)

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/...` | (Smart/Dumb/Facade/Service/Migration) | … |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/...` | (agregar método X, extender tipo Y) | … |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|

---

## 3. Reutilización (Discovery)

> Salida del paso DESCUBRIR. Qué ya existe que vamos a aprovechar.
> Esto se cruza con `indices/*.md` del proyecto.

### Componentes existentes que reutilizamos
- `<app-componente-x>` — para …

### Facades/Services existentes que extendemos
- `XxxFacade.metodoY()` — agregar caso …

### Componentes/Facades que NO existen y debemos crear
- … (justificar: por qué no se puede reutilizar uno existente)

---

## 4. Modelo de datos

> Si la spec implica cambios en BD. Si no, marcar "N/A".

### Migración(es) requerida(s)

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_dominio_tipo_descripcion.sql
-- Pseudo-SQL del cambio. SQL final va en la tarea correspondiente de tasks.md.
```

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `xxx` | public | SELECT | … |
| `xxx` | editor | INSERT | … |

### Modelos UI/DTO

- `core/models/dto/xxx.model.ts` — mapea tabla `xxx`
- `core/models/ui/xxx-row.model.ts` — para componente `<app-xxx-table>`

---

## 5. Arquitectura del feature

### Diagrama de flujo (verbal o ASCII)

```
Usuario → <SmartComponent>
            ├─ inject(XxxFacade)
            ├─ effect: observa branchId()
            └─ <DumbComponent>
                  input: items
                  output: rowClicked
```

### Capas tocadas

- **Smart**: `features/.../xxx.component.ts`
- **Dumb**: `shared/components/.../yyy.component.ts`
- **Facade**: `core/facades/xxx.facade.ts`
- **Service**: (si aplica)
- **Migration**: `supabase/migrations/...`

---

## 6. Restricciones aplicables (referencia al sistema Koa)

> Marcar las reglas que aplican a este feature. Las completas viven en `.claude/rules/`.

- [ ] `architecture.md` — Patrón Facade, OnPush, Signals
- [ ] `facades.md` — Branch-scoped si aplica
- [ ] `models.md` — DTO vs UI separados
- [ ] `visual-tokens.md` / `visual-patterns.md` — Tokens, bento grid, sin colores hardcodeados
- [ ] `swr-pattern.md` — Si el Facade cachea entre navegaciones
- [ ] `notifications.md` — Si dispara toasts o notificaciones
- [ ] `testing-tdd.md` — .spec.ts obligatorios para facades y utils
- [ ] `ai-readability.md` — data-llm-* en botones de mutación

---

## 7. Plan de testing

> Cada slice arranca con su test en rojo, commiteado solo. Acá va qué prueba cada uno.

- Tests unitarios: …
- Tests de integración (si aplican): …
- QA manual (golden path + edge cases): …

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| … | Alta/Media/Baja | … |

---

## 9. Slices de entrega

> Se entrega por **slices verticales**, no por capas. Un slice es la porción más chica que
> alguien puede **usar**: cruza las capas que necesite (migración → repository → facade →
> página) y termina en algo que se prueba en el navegador. El orden por dependencias vale
> **dentro** del slice, no entre todo el feature.
>
> El S1 es el esqueleto que camina: el happy path más fino de punta a punta. Cada slice
> siguiente agrega un AC o un edge case. `/spec-tasks` convierte esta tabla en `tasks.md`.

| Slice | AC que cubre | Qué se puede usar al terminarlo | Capas que toca |
|-------|--------------|---------------------------------|----------------|
| S1 | AC1 | (ej. "me registro con email y contraseña y quedo con sesión") | migración, repository, facade, página |
| S2 | AC-E1 | … | … |

**Lo que no es un slice:** "toda la base de datos", "todos los facades", "la UI". Un plan
cortado así deja todo sin poder usarse hasta la última fase, y el diff que llega a revisión
es el feature entero.

---

## 10. Estimación

(Opcional. Horas, días, o "M/L/XL".)

---

## Changelog

- {{DATE}} — plan inicial
