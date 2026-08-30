# Diseño de la remediación

Insumo: `docs/auditoria/` — 102 unidades revisadas, 76 hallazgos (7 `S1`, 35 `S2`, 34 `S3`).

La auditoría **observa**. Esta carpeta **decide**. La regla que separaba las dos fases sigue
en pie al revés: acá no se audita nada nuevo; si aparece un hallazgo mientras diseñamos, se
anota en `HALLAZGOS.md` y se sigue.

---

## Los once clusters y dónde se resuelve cada uno

Los 76 hallazgos, agrupados por *«qué arreglo los cierra»*:

| # | Cluster | Hallazgos | `S1` | Se resuelve en |
|---|---|---|---|---|
| 1 | Identidad de sesión | 3 | 1 | **ADR-001** §1 `lib/session.js` |
| 2 | Semántica de `Stop` | 4 | — | **ADR-002** |
| 3 | Declarar los contratos | 11 | — | **ADR-001** §5 `lib/contracts.js` |
| 4 | Clasificación de rutas | 3 | — | **ADR-001** §3 `lib/paths.js` |
| 5 | Presupuesto de contexto | 4 | 1 | **ADR-001** §4 `lib/budget.js` |
| 6 | Entrada de los hooks | 3 | 1 | **ADR-001** §2 `lib/payload.js` |
| 7 | `post-edit` | 2 | 2 | ADR-001 · tanda 0 |
| 8 | Provocación de reglas | 5 | 1 | backlog (24 fixtures, trabajo mecánico) |
| 9 | Backlog de tests | 6 | — | ADR-001 · tanda 2 (**precondición** de la migración) |
| 10 | Capa de asignaciones | 4 | — | **pendiente** — decisión de producto, no técnica |
| 11 | Deriva de documentación | 11 | — | backlog · incluye el arreglo editorial de `CAR-003` |

---

## Documentos

| ADR | Qué decide | Estado |
|---|---|---|
| [`ADR-001`](./ADR-001-nucleo-compartido-de-hooks.md) | `templates/.claude/hooks/lib/` con cinco módulos, y el plan de migración en cinco tandas | propuesto |
| [`ADR-002`](./ADR-002-semantica-de-stop.md) | Tres ciclos de vida con nombre; ningún hook de `Stop` borra estado de sesión | propuesto |

---

## Las dos cosas que este diseño corrige de la propia auditoría

**1 · Las tres definiciones de ruta no son duplicación.** La ficha `H-03` las anotó como
«tres definiciones de lo mismo, colapsar en una». Son tres preguntas distintas y las tres
son legítimas: *¿es código de producto?*, *¿necesita descubrimiento?*, *¿va a un índice?*
El defecto es que están escritas tres veces sin nombre y sin test. `lib/paths.js` les pone
nombre, no las colapsa (ADR-001 §3).

**2 · El presupuesto de contexto no cierra `CAR-003`.** Las seis reglas path-scoped que
suman ~9.800 tokens al editar un componente de `shared/` las inyecta Claude Code al matchear
`paths:` en el frontmatter, no un hook. Ningún módulo nuestro puede interceptarlas: el
arreglo es editorial y va en el cluster 11.

---

## Lo que hay que verificar antes de implementar

`ADR-002` se apoya en una afirmación sobre el runtime que la auditoría comprobó **por
comportamiento observado**, no leyendo la especificación de Claude Code. Está listada como
precondición dentro del ADR, no como supuesto. Si alguna resulta falsa, `ADR-002` cambia.

---

## Orden de ejecución

Cuando pasemos a código, el orden es el de `ADR-001` §Plan de migración:

```
tanda 0  S1 independientes del núcleo   riesgo nulo   SEC-001 · DEC-003 · test de post-edit
tanda 1  escribir el núcleo             riesgo nulo   cinco módulos + tests, sin tocar hooks
tanda 2  tests de los 11 hooks sin test riesgo nulo   contra el comportamiento actual, bugs incluidos
tanda 3  migrar módulo por módulo       acotado       payload → session → paths → budget → contracts
tanda 4  lo que el núcleo no cubre                    ADR-002 · fixtures · docs · asignaciones
```

> **Nunca se migra un hook que no tenga test. Si no lo tiene, el test va primero.**
