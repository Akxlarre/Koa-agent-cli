# Roadmap SDD — {{PROYECTO}}

> Índice vivo de todas las specs del proyecto.
> Mantener actualizado: cada spec nueva o cambio de estado se refleja acá.

---

## Historias — backlog sin spec

> Una línea por historia, sin carpeta ni plantilla. Escribirla no cuesta nada y
> descartarla tampoco: el detalle técnico se paga recién cuando alguien la toma con
> `/spec-new H-NNN`, que crea la spec y marca la línea `[x] … → spec NNNN`.
> Se agregan con `/backlog`. Una historia hace UNA cosa: si lo que quiere lleva «y», son dos.
> Se reordenan moviendo líneas; la que deja de servir se borra.

- [ ] **H-000** · Como {{rol}}, quiero {{capacidad}} para {{beneficio}}.

---

## Activa

| ID | Título | Owner | Activada |
|----|--------|-------|----------|
| — | (ninguna) | — | — |

---

## Specs escritas, sin activar

| ID | Título | Prioridad | Owner | Notas |
|----|--------|-----------|-------|-------|

---

## En progreso

| ID | Título | % tareas | Última edición |
|----|--------|----------|----------------|

---

## Done

| ID | Título | Cerrada | Verificada por |
|----|--------|---------|----------------|

---

## Archived (descartadas / superseded)

| ID | Título | Motivo | Reemplazada por |
|----|--------|--------|-----------------|

---

## Convenciones

- **Historias:** `H-NNN`, secuencial, nunca se reutilizan. Viven arriba hasta que se toman
- **IDs de spec:** `NNNN-kebab-slug`, secuencial, nunca se reutilizan
- **Una spec = una historia.** La segunda vuelve al backlog
- **Prioridad:** P0 (bloquea producción) / P1 (necesario sprint) / P2 (nice-to-have)
- **Estado:** draft → approved → in_progress → done | archived
- **Owner:** quién es responsable de redactar + cerrar la spec
- `npm run lint:specs` verifica las historias (ids, forma, a qué spec dicen haberse vuelto)
