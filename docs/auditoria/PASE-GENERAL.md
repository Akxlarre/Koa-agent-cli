# Pase general — las cuatro lentes

> **No se abre hasta que las 102 unidades estén cerradas.** Abrirlo antes convierte el
> pase en una impresión general en vez de en un cruce de datos.
>
> El pase general **no es releer las fichas**. Son cuatro consultas cruzadas sobre campos
> que las fichas ya dejaron llenos. Si al llegar acá los campos 5 y 6 de las fichas A no
> están literales, el pase no se puede hacer: volver a completarlos.

---

## Lente 1 · Matriz de contratos

**Pregunta:** ¿todo consumidor de un formato compartido está declarado?

**Insumo:** campos 5 y 6 de las 53 fichas A.

**Procedimiento:** por cada contrato del bloque 0, listar todos los consumidores que
aparecieron en algún campo 5, y contrastar contra la tabla de dependencias de
`.claude/rules/templates-contract.md`. Todo consumidor que no figure ahí es un `ACO`.

| Contrato | Productores declarados | Productores reales | Consumidores declarados | Consumidores reales | Δ |
|---|---|---|---|---|---|
| `C-01` discovery flag | | | | | |
| `C-02` session-writes | | | | | |
| `C-03` task-spec | | | | | |
| `C-04` marcadores auto-gen | | | | | |
| `C-05` blueprint.json | | | | | |

**Segunda pasada — contratos no declarados:** además de los cinco conocidos, buscar
formatos que emergieron durante la auditoría y que nadie registró como contrato
(`LESSONS_LEARNED.md`, `arch-last-failure.json`, `indices-cache.json`, `specs/.active`,
`author.local.json`, `provocacion.baseline.json`, `contrast.baseline.json`).

| Formato emergente | Productor | Consumidores | ¿Merece ser contrato declarado? |
|---|---|---|---|
| | | | |

**Salida esperada:** una lista de `ACO` y una actualización de la tabla de dependencias
de `templates-contract.md`.

---

## Lente 2 · Autoridad duplicada

**Pregunta:** ¿dos piezas deciden lo mismo, con criterios que pueden divergir?

**Insumo:** campo 1 de las fichas A + campo 4 de las fichas B.

**Procedimiento:** agrupar todas las unidades por **qué deciden**, no por dónde viven.
Cada grupo con más de un integrante se examina: ¿usan el mismo criterio? ¿qué pasa si
divergen? ¿cuál manda?

| Decisión | Piezas que la toman | ¿Mismo criterio? | ¿Cuál manda? | Veredicto |
|---|---|---|---|---|
| Escribir el discovery flag | `session-start`, `discovery-tracker` | | | |
| Sincronizar índices | `indices-sync.js`, `index-syncer`, `/sync-indices` | | | |
| Detectar índices desactualizados | `sync-check`, `spec-diff-check` | | | |
| Prohibir escribir en código sin contexto | `pre-write-guard` (Gate), `spec-gate`, `context-enrichment-guard` | | | |
| Validar arquitectura | `architect.js`, Architect Guard de `pre-write-guard`, `code-judge` | | | |
| Registrar aprendizajes | `failure-tracker`, `lint-arch-wrapper`, `context-guardian`, `/harness-feedback` | | | |
| Definir el stack | flags CLI, `koa-config.json`, `blueprint.json` | | | |
| *(agregar los que aparezcan)* | | | | |

> Las filas ya listadas son candidatos detectados al armar el mapa. Confirmarlos o
> descartarlos con las fichas en la mano, y agregar los que hayan surgido.

**Salida esperada:** lista de `DUP` con propuesta de cuál pieza debería ser la autoridad
única.

---

## Lente 3 · Cobertura real

**Pregunta:** ¿lo que decimos que está cubierto, está cubierto de verdad?

**Insumo:** cruce del campo 4 (¿puede fallar?) contra el campo 7 (cobertura) de las 53
fichas A.

**Procedimiento:** clasificar cada unidad en uno de los cuatro cuadrantes.

| | **Tiene test que ejecuta la ruta de fallo** | **No** |
|---|---|---|
| **Comprobé que dispara** | ✅ Cubierto | ⚠️ Frágil — funciona hoy, nada lo protege → `HUE` |
| **No dispara / no comprobado** | 🔴 El test miente → `DEC` | 🔴🔴 Zona ciega |

| Unidad | Cuadrante | Acción |
|---|---|---|
| | | |

**Las dos preguntas que cierran la lente:**

1. **¿Cuáles son los hooks sin test?** (20 hooks, 9 archivos de test). Listarlos por
   nombre. Cada uno es un `compact-recovery.js` esperando a pasar.
2. **¿Quién audita a los auditores?** `provocar-reglas.mjs` y `smoke-scripts.mjs` son la
   garantía de que todo lo demás puede fallar. Si alguno de los dos no puede fallar, esa
   garantía es falsa y todos los ✅ de esta lente quedan en duda.

**Salida esperada:** la lista priorizada de `HUE` de cobertura, ordenada por severidad
del guardrail que queda desprotegido.

---

## Lente 4 · Presupuesto de contexto

**Pregunta:** ¿el harness ahorra más contexto del que consume?

**Insumo:** campo 8 de las fichas A + campo 6 de las fichas B.

**Procedimiento:** sumar el costo declarado por categoría y contrastarlo contra lo que
evita. Es la única lente cuyo resultado puede ser *"hay que sacar cosas"*.

| Categoría | Se carga cuándo | Costo aprox. | Qué evita | Veredicto |
|---|---|---|---|---|
| Inyección de `session-start` | cada sesión | | | |
| Inyección de `prompt-context` | cada N prompts | | | |
| Reglas path-scoped | al matchear | | | |
| Descriptions de skills model-invocables | **cada turno** | | | |
| Inyección de `plan-injector` | cada edit con spec activa | | | |
| Re-inyección de `compact-recovery` | cada compactación | | | |
| Avisos de los 4 hooks de Stop | cada cierre de respuesta | | | |

**Las tres preguntas de la lente:**

1. **El peor caso**: editar un `.ts` de `core/facades/` con una spec SDD activa dispara
   cuántas inyecciones simultáneas, y cuánto pesan sumadas?
2. **Los cuatro hooks de Stop** pueden avisar todos a la vez. ¿El agente recibe cuatro
   mensajes en el mismo cierre? ¿Cuántos lee?
3. **Descriptions siempre presentes**: cuántas skills son model-invocables y cuánto pesan
   sus descriptions sumadas, que están en la ventana en todos los turnos aunque no se use
   ninguna.

**Salida esperada:** lista de `CAR` con propuesta concreta — fusionar, estrechar el
`paths:`, pasar a user-invocable, o eliminar.

---

# Síntesis final

Cuando las cuatro lentes estén completas:

## Conteo

| Tipo | S1 | S2 | S3 | Total |
|---|---|---|---|---|
| `INC` | | | | |
| `DEC` | | | | |
| `ACO` | | | | |
| `DUP` | | | | |
| `HUE` | | | | |
| `CAR` | | | | |
| **Total** | | | | |

## Las cinco conclusiones

<!-- Cinco, no más. Si tenés quince, no terminaste de sintetizar.
     Cada una tiene que ser algo que NO se veía en ninguna ficha individual —
     ese es el único motivo por el que existe el pase general. -->

1.
2.
3.
4.
5.

## Qué hacer con esto

- [ ] Los `S1` se convierten en tracks (`/fix-new`) antes de la próxima release del blueprint
- [ ] Los `ACO` se resuelven actualizando `.claude/rules/templates-contract.md`
- [ ] Los `HUE` de cobertura se convierten en archivos de test
- [ ] Los `CAR` se llevan a decisión explícita: se aceptan con motivo escrito, o se sacan
- [ ] Los `INC` de documentación se corrigen en lote, en un solo commit
- [ ] Lo que se decide **no** arreglar queda como `aceptado` en `HALLAZGOS.md`, con motivo

> Un hallazgo `aceptado` con motivo escrito vale más que uno resuelto a las apuradas.
> Lo que no puede quedar es un hallazgo `abierto` que nadie volvió a mirar.
