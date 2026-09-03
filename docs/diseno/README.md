# Diseño de la remediación

Insumo: `docs/auditoria/` — 102 unidades revisadas, 76 hallazgos (7 `S1`, 35 `S2`, 34 `S3`),
más cuatro que encontró la verificación del runtime durante el diseño:
**80 (9 `S1`, 37 `S2`, 34 `S3`)**.

La auditoría **observa**. Esta carpeta **decide**. La regla que separaba las dos fases sigue
en pie al revés: acá no se audita nada nuevo; si aparece un hallazgo mientras diseñamos, se
anota en `HALLAZGOS.md` y se sigue.

---

## Los once clusters y dónde se resuelve cada uno

Los hallazgos, agrupados por *«qué arreglo los cierra»*.

> **El cluster no es la asignación.** Cubrir los once clusters no es lo mismo que darle
> destino a los 80 hallazgos: al cruzar los IDs, 44 no aparecían nombrados en ningún ADR, y
> uno era `S1`. La asignación uno por uno vive en [`COBERTURA.md`](./COBERTURA.md), y de ahí
> salió `ADR-006`.

| # | Cluster | Hallazgos | `S1` | Se resuelve en |
|---|---|---|---|---|
| 1 | Identidad de sesión | 5 | 2 | **ADR-001** §1 `lib/session.js` · **ADR-003** §1 (ámbito de hilo) |
| 2 | Ciclo de vida de los eventos | 6 | 1 | **ADR-002** · **ADR-003** §3 |
| 3 | Declarar los contratos | 11 | — | **ADR-001** §5 `lib/contracts.js` |
| 4 | Clasificación de rutas | 3 | — | **ADR-001** §3 `lib/paths.js` |
| 5 | Presupuesto de contexto | 4 | 1 | **ADR-001** §4 `lib/budget.js` |
| 6 | Entrada de los hooks | 3 | 1 | **ADR-001** §2 `lib/payload.js` |
| 7 | `post-edit` | 2 | 2 | ADR-001 · tanda 0 |
| 8 | Provocación de reglas | 5 | 1 | **ADR-005** §1 — **precondición** del cluster 11, no paralelo |
| 9 | Backlog de tests | 6 | — | ADR-001 · tanda 2 (**precondición** de la migración) |
| 10 | Capa de asignaciones | 4 | — | **ADR-004** — decidido: integrar |
| 11 | Deriva de documentación | 11 | — | **ADR-005** (`CAR-003`) · el resto, backlog en lote |

---

## Documentos

| ADR | Qué decide | Estado |
|---|---|---|
| [`ADR-001`](./ADR-001-nucleo-compartido-de-hooks.md) | `templates/.claude/hooks/lib/` con cinco módulos, y el plan de migración en cinco tandas | propuesto |
| [`ADR-002`](./ADR-002-semantica-de-stop.md) | Tres ciclos de vida con nombre; ningún hook de `Stop` borra estado de sesión; ninguna limpieza destructiva fuera de `startup` | propuesto |
| [`ADR-003`](./ADR-003-superficie-de-eventos-y-subagentes.md) | Ámbito de sesión vs. ámbito de hilo; qué eventos del runtime se cablean y cuáles no | propuesto |
| [`ADR-004`](./ADR-004-capa-de-asignaciones.md) | Integrar la capa de asignaciones tras un interruptor único, `specs/AUTHORS.md` | propuesto |
| [`ADR-005`](./ADR-005-presupuesto-de-las-reglas-inyectadas.md) | El contexto se paga por lo que ninguna máquina puede atrapar; las fixtures van antes que el recorte | propuesto |
| [`ADR-006`](./ADR-006-el-generador-falla-en-silencio.md) | El generador también falla en silencio: 19 parches condicionales sin `else` (**Contexto A**) | propuesto |
| [`COBERTURA`](./COBERTURA.md) | El pase que asigna los 80 hallazgos uno por uno | ejecutado |

---

## Las cuatro cosas que este diseño corrige de la propia auditoría

**1 · Las tres definiciones de ruta no son duplicación.** La ficha `H-03` las anotó como
«tres definiciones de lo mismo, colapsar en una». Son tres preguntas distintas y las tres
son legítimas: *¿es código de producto?*, *¿necesita descubrimiento?*, *¿va a un índice?*
El defecto es que están escritas tres veces sin nombre y sin test. `lib/paths.js` les pone
nombre, no las colapsa (ADR-001 §3).

**2 · El presupuesto de contexto no cierra `CAR-003`.** Las reglas path-scoped las inyecta
Claude Code al matchear `paths:` en el frontmatter, no un hook. Ningún módulo nuestro puede
interceptarlas: el arreglo es editorial y lo diseña `ADR-005`.

**3 · `CAR-003` estaba medido a la mitad.** La ficha `R-01` midió `src/app/shared/`: 6
reglas, ~9.800 tokens. El peor caso es un componente de `features/` —**13 reglas, ~19.100
tokens**— y es además el archivo que más se edita. Con `plan-injector`, un solo `Edit`
arrastra **~26.500 tokens**. El pase general está corregido.

**4 · La regla de ponderación estaba mal aplicada.** `HALLAZGOS.md` sube un nivel a todo
hallazgo del harness porque *«el generador falla ruidoso y una vez»*. `lib/scaffolder.js`
tiene **19 bloques `if (fs.existsSync(...))` y ninguno con `else`**, más dos `catch` que
avisan en amarillo y siguen: un `tsconfig.json` con `$schema` deja el proyecto sin path
aliases y sin compilar, tras una línea amarilla entre veinte verdes. La mitad *«una vez vs.
replicado»* sigue en pie; la del ruido, no. Es `ADR-006`.

---

## La verificación del runtime — hecha, y encontró un `S1`

`ADR-002` se apoyaba en cuatro afirmaciones sobre el runtime que la auditoría había
comprobado **por comportamiento observado**, no contra la documentación de Claude Code.
Estaban listadas como precondición, no como supuesto. Se verificaron:

| Afirmación | Resultado |
|---|---|
| `Stop` corre por respuesta, no por sesión | ✅ confirmada |
| `exit 2` en `Stop` continúa la conversación | ✅ confirmada |
| Existe un evento de fin de sesión | ✅ existe: `SessionEnd` |
| `SessionStart` corre una vez por sesión | ❌ **falsa** → `INC-020` (`S1`) |

**La cuarta era load-bearing.** Sobre ella descansaban la limpieza de `ADR-002` §1 y el
`cleanup()` de `ADR-001` §1; `SessionStart` corre también en `resume`, `clear`, `compact` y
`fork`, y el harness lo registra sin matcher, así que ambos diseños borraban estado vivo en
cada compactación. Los dos ADR están corregidos.

De ahí salió también `CAR-004`: tras una compactación corren `session-start` **y**
`compact-recovery`, y el 85% del output del primero es byte-idéntico al del segundo —
~2.000 tokens repetidos, medidos, en el momento en que el contexto es más escaso.

Y al leer la lista completa de eventos, dos más: los hooks **corren dentro de los
subagentes** y ninguno lee `agent_id`, así que el estado de dedup es un pozo compartido
entre seis hilos (`HUE-032`, `S1`) y `discovery-scout` levanta el Gate del hilo principal
(`DUP-004`). Es `ADR-003`.

Y la lista de `ADR-003`, ejecutada después, encontró lo mayor: **`CLAUDE_SESSION_ID` no
existe.** No está entre las variables que la documentación expone a los hooks, y en un
runtime real `env | grep -c '^CLAUDE_SESSION_ID='` da `0`. Los cinco hooks que la leen
resuelven a `'default'` siempre — no es un fallback, es el único valor. Demostrado con dos
proyectos y dos sesiones:

```
proyecto A, sesión AAA: lee indices/COMPONENTS.md  →  koa-discovery-default.flag
proyecto B, sesión ZZZ: intenta escribir           →  Discovery Gate exit=0
```

**El guardrail principal del harness está desactivado en toda sesión que no sea la primera de
la máquina**, y el flag vive en `TMPDIR` sin que nadie lo borre. `HUE-002` pasa a ser lo
primero de la tanda 0.

> Poner esas afirmaciones como precondición en vez de como supuesto es lo que hizo que los
> tres errores aparecieran en un documento y no en producción. **Cada ADR lleva su lista.**

---

## Orden de ejecución

Cuando pasemos a código, el orden es el de `ADR-001` §Plan de migración:

```
tanda 0  HUE-002 primero              ← el Gate está desactivado hoy, en toda sesión que
                                        no sea la primera de la máquina
         luego SEC-001 · DEC-003 · INC-020 · test de post-edit      riesgo nulo
tanda 1  escribir el núcleo             riesgo nulo   cinco módulos + tests, sin tocar hooks
tanda 2  tests de los 11 hooks sin test riesgo nulo   contra el comportamiento actual, bugs incluidos
tanda 3  migrar módulo por módulo       acotado       payload → session → paths → budget → contracts
tanda 4  lo que el núcleo no cubre                    ADR-002 · ADR-003 · ADR-004 · fixtures · docs
```

`ADR-004` y `ADR-006` son independientes del núcleo —no tocan ningún hook— así que pueden
adelantarse a cualquier tanda. Son también los dos únicos que editan `lib/` (Contexto A), y
los dos `S1` re-ponderados de `ADR-006` (`HUE-020`, `HUE-022`) dejan proyectos que no
compilan: **ese es el argumento para adelantar `ADR-006`, no dejarlo al final.**

> **Nunca se migra un hook que no tenga test. Si no lo tiene, el test va primero.**
