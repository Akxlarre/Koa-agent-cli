# Registro de hallazgos

> **Cada hallazgo se describe UNA vez, acá.** Las fichas solo lo referencian por ID.
> Si un hallazgo vive dentro de una ficha, no se puede contar, ordenar por severidad ni
> agrupar por tipo — y el pase general se vuelve imposible.

## Taxonomía

Seis tipos, cerrados. Si algo no entra en ninguno, primero preguntate si realmente es un
hallazgo; recién después agregá un tipo (y documentalo acá).

| Tipo | Nombre | Qué es | Ejemplo del repo |
|---|---|---|---|
| `INC` | Inconsistencia | La documentación dice X, el código hace Y | `.claude/CLAUDE.md` habla de reglas ARCH hasta la 26; hay 22 activas |
| `DEC` | Chequeo decorativo | Existe, corre, pasa — y no puede fallar | ARCH-24 y ARCH-26, muertas hasta que existió `provocar-reglas.mjs` |
| `ACO` | Acoplamiento no declarado | Una pieza depende del formato de otra sin que figure en `templates-contract.md` | — |
| `DUP` | Autoridad duplicada | Dos piezas deciden lo mismo, posiblemente con criterios distintos | `session-start` y `discovery-tracker` escriben el mismo flag |
| `HUE` | Hueco | Nadie cubre esto: sin test, sin mecanismo, sin dueño | los hooks sin archivo de test |
| `CAR` | Carga | Correcto, pero cuesta más contexto/fricción de lo que aporta | una regla que se inyecta siempre y ningún mecanismo aplica |

> `CAR` es el tipo que casi nadie incluye y en un harness es central: **una pieza puede
> ser correcta y aun así ser neta negativa**, porque cada regla, cada skill
> model-invocable y cada inyección paga renta en la ventana de contexto.

## Severidad

| Nivel | Criterio |
|---|---|
| `S1` | Rompe proyectos generados, o desactiva un guardrail sin que nadie se entere |
| `S2` | Comportamiento incorrecto o engañoso, con workaround conocido |
| `S3` | Deriva, redundancia o costo evitable. No rompe nada hoy |

> **Regla de ponderación por contexto:** un hallazgo en el **harness** (contexto B) sube
> un nivel respecto del mismo hallazgo en el **generador** (contexto A). El generador
> falla ruidoso y una vez; el harness falla en silencio y replicado en cada proyecto
> generado.

## Estado

`abierto` · `en análisis` · `aceptado` (se decide convivir, con motivo) · `resuelto` · `descartado`

---

# Registro

<!--
Formato de ID: <TIPO>-<NNN> correlativo dentro del tipo. Los IDs no se reutilizan.
Ordenar por ID, no por severidad — el orden por severidad se hace en el pase general.
Agregar filas al final; la ficha de detalle va debajo de la tabla.
-->

| ID | Sev | Unidad | Una línea | Estado |
|---|---|---|---|---|
| `INC-001` | S3 | `L-05` | `.claude/CLAUDE.md` y el mapa hablaban de 26 reglas ARCH; hay 22 códigos activos (faltan 12, 13, 14, 20) | abierto |

---

## INC-001 · Numeración de códigos ARCH

- **Tipo / severidad:** `INC` · S3
- **Unidad:** `L-05` (docs) — confirmar también en `S-01` (`architect.js`)
- **Contexto:** B (harness)

**Qué encontré**

`templates/boilerplate/scripts/architect.js` define 22 códigos `ARCH-*` activos,
numerados hasta ARCH-26. Los códigos 12, 13, 14 y 20 no existen en el archivo.
La documentación del harness describe el linter sin aclarar esa discontinuidad.

**Por qué importa**

Sola, la discontinuidad es cosmética. Lo que hay que resolver es **por qué** faltan: si
son reglas eliminadas sin limpiar la numeración, hay que verificar que nada siga
refiriéndose a ellas (baseline de provocación, docs, tests). Si son huecos reservados,
hay que documentarlo.

**Evidencia**

```bash
grep -oE "'ARCH-[0-9]+'" templates/boilerplate/scripts/architect.js | sort -u | wc -l
# → 22
```

**Propuesta**

Determinar el origen de los cuatro huecos durante la ficha `S-01` y, según el caso,
documentar la discontinuidad o renumerar. Actualizar la prosa que cuente reglas.

**Estado:** abierto

---

<!-- ═══ Plantilla para copiar al agregar un hallazgo ═══

## <ID> · <título en una línea>

- **Tipo / severidad:** `___` · S_
- **Unidad:** `___`
- **Contexto:** A (generador) · B (harness)

**Qué encontré**


**Por qué importa**
<!-- Consecuencia concreta. Si no la podés escribir, quizá no sea un hallazgo. -->


**Evidencia**
```
<comando, salida, fixture>
```

**Propuesta**
<!-- Qué haría falta. No hay que implementarlo ahora: la auditoría observa, no arregla.
     Arreglar mientras auditás rompe el ritmo y contamina la comparabilidad de las fichas. -->


**Estado:** abierto

═══ fin de plantilla ═══ -->
