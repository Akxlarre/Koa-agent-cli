# Pase general — las cuatro lentes

> **Ejecutado el 2026-08-29**, con las 102 unidades cerradas y 74 hallazgos registrados.
> Cada lente es una consulta cruzada sobre los campos que las fichas dejaron llenos, no una
> relectura. Los números de abajo salieron de barridos y ejecuciones, no de memoria.

---

## Lente 1 · Matriz de contratos

**Pregunta:** ¿todo consumidor de un formato compartido está declarado?

**Procedimiento ejecutado:** barrido sobre los 18 hooks, los 11 scripts, los 5 subagentes,
las 15 skills, los 11 comandos y los 8 módulos de `lib/`, buscando todo artefacto de estado
que alguna pieza escriba o lea, y contrastándolo contra `.claude/rules/templates-contract.md`.

### El resultado

```
21 artefactos compartidos · 3 declarados · 18 NO declarados
```

| Declarados (3) | Consumidores |
|---|---|
| `koa-discovery-*.flag` | `pre-write-guard`, `compact-recovery` |
| `session-writes.json` | `sync-check`, `spec-diff-check`, `spec-reflection`, `index-syncer` |
| `task-spec-*.md` | `spec-reflection`, `prompt-context`, `compact-recovery`, `validate-file-contains`, `session-start` |

**Los 18 sin declarar**, agrupados por lo que rompen si cambian:

| Grupo | Artefactos | Consumidores reales |
|---|---|---|
| **Estado de sesión en `os.tmpdir()`** | `koa-breaker-*.json`, `koa-ctx-*-*.flag` (×11), `koa-prompt-ctx-*.json` | `pre-write-guard`, `prompt-context` |
| **Estado en `.claude/temp/`** | `LESSONS_LEARNED.md`, `spec-reflection-seen.json`, `indices-cache.json`, `arch-last-failure.json`, `review-diff.patch` | 8 piezas, incluidos 2 subagentes |
| **Formatos de texto** | `AUTO-GENERATED:BEGIN/END`, `DETAIL:BEGIN`, `**last_updated:**` | `indices-sync`, `assignments-sync`, `compact-recovery`, `session-start`, `discovery-tracker` |
| **Estado del proyecto** | `specs/.active`, `blueprint.json`, `author.local.json` | 10 comandos, 3 hooks, 4 módulos de `lib/` |
| **Baselines / allowlists** | `provocacion.baseline.json`, `class-discipline.baseline.json`, `contrast.baseline.json`, `bento-classes.allowlist.json` | `architect`, `provocar-reglas`, `check-bento` |

### Los dos hallazgos de la lente

**1. `specs/.active` es el contrato con más consumidores del sistema y no está declarado.**
Diez comandos lo escriben, tres hooks lo leen, y define si el motor SDD bloquea o no.
Supera a los tres declarados juntos.

**2. La declaración vive del lado equivocado.** `templates-contract.md` está en
`.claude/rules/` de **este repositorio**, no en el payload. Es una regla para quien
mantiene el CLI. **El proyecto generado no recibe ninguna declaración de sus propios
contratos** — un agente trabajando ahí no tiene forma de saber que `sync-check` borra el
archivo del que depende `spec-diff-check`. → `ACO-013`

### La correspondencia con el resto de la auditoría

`HUE-030` es esta lente en miniatura y por eso la valida: `AGENTS.md` y `compact-recovery`
omiten **exactamente los mismos cinco índices**. Ninguna ficha individual podía verlo;
la lente sí. Ese es el argumento entero a favor del método.

**Salida:** actualizar `templates-contract.md` con los 18, y decidir si una copia del
contrato debe viajar en el payload.

---

## Lente 2 · Autoridad duplicada

**Pregunta:** ¿dos piezas deciden lo mismo, con criterios que pueden divergir?

| Decisión | Piezas que la toman | ¿Mismo criterio? | Veredicto |
|---|---|---|---|
| **¿Esto es código de producto?** | `spec-gate` + `plan-injector` (bloque idéntico, listas de exención distintas) · `pre-write-guard` (`src/app/` + migraciones) · `write-tracker` (`src/app/` + 3 extensiones) | **No** — tres criterios | `INC-005`, `HUE-015`. El más grande |
| **Sincronizar índices** | `indices-sync.js` · `index-syncer` · `/sync-indices` | Sí, pero sin reparto | `DUP-003` |
| **¿Los índices están al día?** | `sync-check` (avisa) · `spec-diff-check` (bloquea) | Mismo insumo, severidades distintas; uno borra el insumo del otro | `ACO-001` |
| **Escribir el discovery flag** | `discovery-tracker` (por lectura) · `session-start` (por inyección) | No | `HUE-001` |
| **Registrar aprendizajes** | `failure-tracker` · `lint-arch-wrapper` (mismo archivo, formatos distintos) · `context-guardian` · `/harness-feedback` | **No** | `DUP-002` |
| **Definir el stack** | flags CLI · `koa-config.json` · `blueprint.json` · defaults hardcodeados en `pre-write-guard` **y** en `architect.js` | Cinco fuentes | `HUE-005` |
| **Convención de ID de tracks** | `/fix-new`, `/hotfix` (sin autor) · `assignments-audit` (con autor) · `sdd/SKILL.md` (ambas) | **No** | `INC-017` |
| **Comparar mtime writes ↔ índices** | `sync-check` · `spec-reflection` | Código casi idéntico, duplicado | — |
| **Proteger el harness** | `pre-write-guard` capa 1 (`hooks/`, `settings.json`) · `harness-gate` (`rules/`, `scripts/`) | Superficies complementarias sin criterio común; **ninguno cubre `skills/` ni `agents/`** | `HUE-031` |
| **Cortar contenido para inyección** | `session-start` (2.500 chars + `DETAIL:BEGIN`) · `compact-recovery` (`DETAIL:BEGIN`, sin tope) · `plan-injector` (8.000/sección, sin tope) · reglas (sin corte) | Cuatro políticas | `CAR-001`, `CAR-003`, `HUE-017` |

### Lo que la lente dice de fondo

**Ninguna duplicación está en la prosa.** Las 15 reglas no se contradicen entre sí; las 15
skills reparten su terreno explícitamente cuando se solapan. **Toda la autoridad duplicada
está en el código**, y en los cinco casos el patrón es el mismo: cada capa resolvió el
problema otra vez sin mirar la anterior.

El caso más caro es «¿esto es código de producto?», porque de él dependen tres gates
distintos, y el más silencioso es «definir el stack», con cinco fuentes y ninguna
validación en el punto de lectura.

**Salida:** extraer un módulo compartido para la clasificación de rutas; decidir la
autoridad única en las otras cinco.

---

## Lente 3 · Cobertura real

**Pregunta:** ¿lo que decimos que está cubierto, está cubierto de verdad?

### Los cuadrantes

| | **Test que ejecuta la ruta de fallo** | **No** |
|---|---|---|
| **Comprobé que dispara** | ✅ `bash-guard`, `harness-gate`, `pre-write-guard`, `prompt-context`, `session-start`, `spec-reflection`, `compact-recovery`, `validate-file-contains`, los 13 módulos de `lib/` | ⚠️ `spec-gate`, `write-tracker`, `discovery-tracker`, `hotfix-autoclose` — funcionan hoy, nada los protege |
| **No dispara / no comprobado** | 🔴 — | 🔴🔴 `spec-diff-check` (`DEC-001`), `post-edit` (`SEC-001`, `DEC-003`), `plan-injector` (`CAR-001`), `sync-check` (`ACO-001`), `context-guardian` (`CAR-002`), `failure-tracker` (`HUE-016`) |

### Las dos preguntas que cierran la lente

**1. ¿Cuáles son los hooks sin test?** Once, enumerados:

```
spec-gate · plan-injector · spec-diff-check · discovery-tracker · write-tracker
post-edit · failure-tracker · hotfix-autoclose · sync-check · context-guardian
context-enrichment-guard
```

**Los seis `S1` del harness están, sin excepción, en esta lista.** Los hooks con test
tienen hallazgos de diseño (`DEC-002`) o de declaración (`ACO-005/006/007`), nunca de
funcionamiento.

**2. ¿Quién audita a los auditores?** Respuesta medida:

| Auditor | Qué promete | Qué entrega |
|---|---|---|
| `smoke-scripts.mjs` | que los scripts puedan fallar | **cumple** — verificado ejecutando |
| `provocar-reglas.mjs` | que las reglas puedan fallar | **4 de 28**, y sale en 1 de fábrica |

Sumando `HUE-012` (las ~20 reglas regex de `pre-write-guard`, sin provocación de ningún
tipo):

> **De las ~48 reglas que el harness aplica, 4 están comprobadas disparando ante su propia
> violación.**

### El refinamiento del criterio

«¿Tiene test?» resultó ser la pregunta equivocada. Son **tres niveles** y hay que contarlos
por separado (`HUE-019`, `HUE-025`):

| Nivel | Pregunta | Estado |
|---|---|---|
| 1 | ¿la lógica es correcta ante una entrada? | **222 tests, cubierto** |
| 2 | ¿el sistema la cablea y la ejecuta de verdad? | verificado para 4 reglas |
| 3 | ¿alguien intenta **evadirla**? | prácticamente nadie |

El nivel 2 es exactamente donde vivían `ARCH-24` y `ARCH-26` cuando estaban muertas. Y el
nivel 3 explica `DEC-002`: `harness-gate` tiene la mejor cobertura del repo —11 tests— y
ninguno intenta evadirlo, así que la evasión con la palabra «cuando» sobrevivió.

**Salida:** el backlog de tests, en orden de rentabilidad (ver más abajo).

---

## Lente 4 · Presupuesto de contexto

**Pregunta:** ¿el harness ahorra más contexto del que consume?

### Lo medido

| Inyección | Cuándo | Tamaño | Control de costo |
|---|---|---|---|
| Descriptions de 14 skills | **cada turno** | 4.842 chars (~1.210 tk) | n/a — es su naturaleza |
| `session-start` | cada sesión | 3.991 chars medidos | tope 2.500/índice + `DETAIL:BEGIN` |
| `prompt-context` | cada N prompts | decenas de líneas | dedup + `REPEAT_EVERY=8` |
| Reglas path-scoped | al matchear | **76.391 chars (~19.100 tk)** en `features/*.ts` | **ninguno** |
| `plan-injector` | **cada Edit** | **24.622 chars (~6.155 tk)** | **ninguno** |
| `compact-recovery` | cada compactación | 12.964 chars medidos | `DETAIL:BEGIN`, **sin tope** |
| Plantillas vacías de `context/` | dentro de las dos anteriores | ~3.240 tk | el filtro **no filtra** |
| Capa 4 de `pre-write-guard` | 1× por categoría | ~13 líneas | flag de dedup |

### El peor caso, sumado

> **Corregido al diseñar `ADR-005`.** Esta sección midió el caso de `src/app/shared/`, que
> es el **segundo** peor. Al cruzar los `paths:` de las 15 reglas contra rutas
> representativas, el peor es un componente de `features/` —13 reglas en vez de 6— y además
> es el archivo que más se edita en un proyecto Angular. **El peor caso es el caso común.**

Editar un componente de `features/` en un proyecto con spec SDD activa:

```
  reglas path-scoped (13 archivos)    ~19.100 tk
  plan-injector (spec+plan+tasks)      ~6.155 tk
  descriptions de skills (siempre)     ~1.210 tk
  capa 4 de pre-write-guard            ~   80 tk
  ─────────────────────────────────────────────
                                      ~26.500 tk   en UNA edición
```

Para comparar, el caso que midió `R-01` —`src/app/shared/`, 6 reglas— suma ~17.200 tk.

Y `plan-injector` **no tiene dedup**: diez ediciones en una sesión son ~61.000 tokens del
mismo contrato repetido.

### Las tres preguntas de la lente

**1. ¿Los cuatro hooks de `Stop` se pisan?** **Sí.** Con `learnings.md` viejo, task-spec
abierto e índices atrasados, **tres de los cuatro emiten `exit 2` en el mismo cierre**, y
solo `spec-reflection` tiene anti-bucle. `context-guardian` avisa en **todas** las
respuestas indefinidamente (`CAR-002`).

**2. ¿Cuánto pesan las descriptions siempre presentes?** ~1.210 tokens. **Es la capa mejor
administrada del harness** y sirve de línea de base: una funcionalidad que se usa varias
veces por sesión por un costo fijo modesto.

**3. ¿El harness ahorra más de lo que consume?** El ahorro real está en los subagentes
—que evitan miles de tokens de output de compilador— y **queda sobrepasado varias veces
por `plan-injector` en una sola sesión de edición**.

### El veredicto de la lente

**La economía de contexto está bien pensada en tres capas y ausente en dos.**

- **Bien:** skills, `prompt-context`, `session-start`, capa 4 de `pre-write-guard`, subagentes
- **Ausente:** `plan-injector` (`CAR-001`), reglas path-scoped (`CAR-003`)
- **Roto:** el filtro de plantillas de `context/` (`DEC-006`)

Y el dato que lo resume: **el mecanismo que resolvería los tres casos ya existe en la casa**
—dedup por flag, `DETAIL:BEGIN`, tope de caracteres— y no se aplicó a las piezas más caras.

---

# Síntesis final

## Conteo

| Tipo | S1 | S2 | S3 | Total |
|---|---|---|---|---|
| `HUE` Hueco | 3 | 13 | 14 | **30** |
| `INC` Inconsistencia | 0 | 10 | 9 | **19** |
| `ACO` Acoplamiento | 0 | 2 | 10 | **12** |
| `DEC` Decorativo | 3 | 2 | 1 | **6** |
| `CAR` Carga | 1 | 2 | 0 | **3** |
| `DUP` Duplicación | 0 | 3 | 0 | **3** |
| `SEC` (sub-tipo de DEC) | 1 | 0 | 0 | **1** |
| **Total** | **7** | **34** | **33** | **74** |

`HUE` domina con el 40%. **El repositorio casi nunca hace algo mal; deja cosas sin cubrir.**

## Las cinco conclusiones

Cinco, y ninguna es visible en una ficha individual — que es el único motivo por el que
existe este pase.

### 1. Las herramientas están inventadas; la aplicación quedó a medias

Es el patrón dominante, con **ocho instancias** medidas:

| El repo tiene… | …y no lo aplicó en |
|---|---|
| `ANGULAR_MAJOR` pineado, con 3 párrafos de porqué | `require('typescript')` sin guarda (`HUE-018`) · `@latest` en 2 MCP (`INC-018`) |
| `provocar-reglas.mjs` | 24 de 28 reglas sin fixture (`DEC-004`) · las ~20 regex del guard (`HUE-012`) |
| el auditor de naming SDD | los comandos que generan los nombres (`INC-017`) |
| el guardrail en frontmatter de `/plan` | las otras 25 skills y comandos (`HUE-028`) |
| el corte `DETAIL:BEGIN` y el tope de chars | las reglas (`CAR-003`) y `plan-injector` (`CAR-001`) |
| `package.json` de carpeta, ×4 | `.claude/scripts/` (`DEC-003`) |
| la regla «todo hook lleva test» | 11 de 20 hooks |
| el razonamiento sobre shell en `runner.js` | `post-edit.js` (`SEC-001`) |

**No es un problema de conocimiento ni de criterio: es de cierre.** Cada lección está
escrita, argumentada y aplicada una vez.

### 2. Los seis `S1` del harness están todos en hooks sin test

Correlación limpia, no estadística sobre muestra chica: un test que pasara el payload por
stdin habría encontrado `DEC-001` el primer día; uno que cargara el módulo bajo el
`package.json` de un proyecto Angular habría encontrado `DEC-003`.

### 3. `Stop` significa «fin de respuesta», y tres hooks creen que significa «fin de sesión»

`ACO-001` (borra el tracker que otros necesitan), `CAR-002` (avisa en cada respuesta) e
`INC-007` (cierra el hotfix en el primer turno). No son tres bugs: es **un malentendido
compartido sobre el evento**. `spec-reflection` es el único que lo entendió, y su docblock
explica por qué hace falta anti-bucle.

### 4. Las dos mitades del repositorio no están al mismo nivel

| | Generador (contexto A) | Harness (contexto B) |
|---|---|---|
| Fronteras declaradas | **4 de 4 respetadas** | 3 gates con criterios distintos |
| Decisiones difíciles | documentadas donde se aplican | documentadas y no propagadas |
| `S1` | 0 | **7** |
| Cobertura | 6 de 8 módulos sin test | 11 de 20 hooks sin test |

El generador está mejor construido. `runner.js` documenta su superficie de shell y prohíbe
pasar input sin validar; `post-edit.js`, en la otra mitad, interpola una ruta arbitraria en
un `execSync`.

### 5. La economía de contexto está resuelta donde no duele y ausente donde sí

Las skills pagan 1.210 tokens fijos bien empleados. `plan-injector` paga 6.155 **por
edición, sin dedup**. Las dos piezas más caras del harness son las únicas dos sin ningún
control de costo, y el mecanismo que las arreglaría ya está escrito tres veces en el mismo
repositorio.

---

# Qué hacer con esto

## Los 9 `S1` — antes de la próxima release del blueprint

| ID | Qué | Esfuerzo |
|---|---|---|
| `DEC-001` | `spec-diff-check` lee stdin como los otros 17 | bajo — más su test |
| `SEC-001` | `post-edit` sin interpolar la ruta en shell (`execFileSync`) | bajo |
| `DEC-003` | `package.json` de 3 líneas en `.claude/scripts/` | trivial |
| `HUE-002` | `session_id` del payload, con fallback derivado del cwd | bajo — toca 5 archivos |
| `HUE-005` | validar el `stack` del blueprint donde se lee | bajo |
| `CAR-001` | dedup por track y sesión en `plan-injector` | medio |
| `DEC-004` | fixtures para las 24 reglas sin cubrir | medio, pero incremental |
| `INC-020` | matcher `startup` en `SessionStart` + test de `settings.json` | bajo |
| `HUE-032` | separar ámbito de sesión y ámbito de hilo (`agent_id`) en el estado | medio |

**Seis de los nueve son de esfuerzo bajo o trivial.** `DEC-003` es un archivo de tres
líneas.

> Cuatro hallazgos —`INC-020`, `CAR-004`, `HUE-032`, `DUP-004`— no salieron de las 102
> unidades: los encontró la fase de diseño al verificar contra la documentación de Claude
> Code supuestos sobre el runtime que la auditoría había dado por buenos *por comportamiento
> observado*.
>
> **Es el hueco del propio método.** Las 102 unidades interrogan al repo: qué hace cada hook,
> qué contrato tiene con cuál, qué cubre cada test. Ninguna interroga a la plataforma: cuándo
> corre realmente cada evento, quién más dispara estos hooks. Dos de los nueve `S1` estaban
> ahí, invisibles para la matriz de contratos y para las cuatro lentes.
>
> Si hubiera un **Nivel D**, sería *«los supuestos sobre el runtime»*, y sus unidades serían
> los siete eventos cableados.

## El backlog de tests, por rentabilidad

1. `spec-diff-check` + `write-tracker` + `sync-check` — el contrato `C-02` entero
2. Los tres de `sdd/` (`HUE-011`)
3. `post-edit` — dos `S1` en 25 líneas
4. Fixtures de provocación, empezando por las que ya tienen test de función pura (`HUE-019`)
5. Un test que fije el formato del payload de los hooks (`ACO-012`)
6. Tests de tres líneas: cableado→archivos (`HUE-009`), partición 13/2 (`HUE-008`), mapa de
   índices completo (`HUE-030`)

## Lo demás

- [ ] Los 18 `ACO` se resuelven actualizando `templates-contract.md` en un solo commit
- [ ] Los `INC` de documentación, en lote — son ~19 y ninguno requiere pensar
- [ ] Los `CAR` van a decisión explícita: se aceptan con motivo escrito, o se arreglan
- [ ] Lo que se decida **no** arreglar queda `aceptado` en `HALLAZGOS.md`, con motivo

> Un hallazgo `aceptado` con motivo escrito vale más que uno resuelto a las apuradas.
> Lo que no puede quedar es un hallazgo `abierto` que nadie volvió a mirar.

## Sobre la taxonomía

`SEC-001` usó `SEC` como sub-tipo de `DEC` porque la taxonomía se quedó corta: un guardrail
que **abre** una superficie de ataque no es «un chequeo que no puede fallar». Se mantuvo
como `DEC` para no cambiar las reglas a mitad de la auditoría (regla 1 del README).
**Decisión pendiente:** si `SEC` pasa a ser un tipo propio, hay un solo hallazgo que
reclasificar.

## Deuda del método

Tres verificaciones quedaron por lectura y no por ejecución, todas registradas en su ficha:

- capas 2 y 3 de `bash-guard` (`H-07`)
- `hotfix-autoclose` (`H-14`)
- el camino de fallo de `lint-arch-wrapper` (`S-02`)

Las tres se cierran al escribir los tests que pide `HUE-011`. Las otras dos deudas
—`C-04` y `C-05`— **quedaron cerradas** durante la auditoría, en `S-03` y `G-06`.
