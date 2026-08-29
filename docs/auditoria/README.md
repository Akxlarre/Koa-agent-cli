# Auditoría sistemática de Koa — método y reglas de juego

> Objetivo: revisar **una por una** las funcionalidades del generador y del harness,
> registrar hallazgos comparables, y recién al final cruzarlos para encontrar
> inconsistencias, huecos y sobrecostos que no se ven pieza por pieza.

## Por qué este método y no un code review

Tres propiedades de Koa lo determinan:

1. **El producto es un sistema de guardrails.** La pregunta de cada pieza no es
   *"¿funciona?"* sino **"¿puede fallar?"**. Esa pregunta ya existe en el repo
   (`provocar-reglas.mjs`, `docs/CHEQUEOS-QUE-NO-CHEQUEAN.md`) pero solo se aplica al
   linter. Esta auditoría la extiende a todas las piezas.
2. **El riesgo real está en las costuras.** Hay contratos compartidos entre hooks y una
   tabla de dependencias en `.claude/rules/templates-contract.md`. Una pieza puede ser
   impecable en aislamiento y estar rota en conjunto — es exactamente lo que pasó con
   `compact-recovery.js`, que falló en silencio durante varias versiones.
3. **Los dos contextos fallan distinto.** El generador falla ruidoso y una vez
   (`exit 1`, se ve). El harness falla **en silencio y para siempre**, replicado en cada
   proyecto generado. La severidad de un hallazgo depende de en qué mitad esté.

## Los tres niveles

No todo merece ficha. Revisar 100 unidades en plano es donde estas auditorías mueren.

| Nivel | Qué incluye | Unidades | Tratamiento |
|---|---|---|---|
| **A** | Piezas con comportamiento que puede fallar callado: contratos, hooks, scripts, módulos CLI, subagentes, tests | 53 | Ficha completa (`plantillas/FICHA-A.md`) |
| **B** | Piezas de prosa: reglas, skills, comandos | 41 | Ficha corta (`plantillas/FICHA-B.md`) |
| **C** | Superficie declarativa: índices, context, MCP, adapters, docs, boilerplate | 8 lotes | Barrido en tabla dentro de `UNIDADES.md`, sin ficha |

Los 22 códigos ARCH no son 22 fichas: van como sub-tabla dentro de la ficha de
`architect.js`.

## Las cuatro reglas no negociables

### 1. La rúbrica es idéntica en todas las fichas del mismo nivel

Si cada ficha responde preguntas distintas, quedan 94 ensayos que no se pueden cruzar y
el pase general se vuelve imposible. Los campos de la plantilla no se cambian a mitad de
la auditoría. Si hay que agregar un campo, se agrega **a todas** las fichas ya escritas.

### 2. Ficha sin campo 4 con evidencia = ficha incompleta

El campo **"¿Puede fallar?"** exige decir *cómo lo comprobaste*, no si te parece que sí.
Una ficha que dice "funciona correctamente" sin evidencia de haberla visto fallar ante su
propia violación no vale y no cuenta como unidad cerrada.

Formas válidas de evidencia:
- Corriste el test que cubre la ruta de fallo y lo viste rojo al romper la condición.
- Armaste el input que debería disparar el bloqueo y lo viste bloquear.
- Encontraste que **no** puede fallar → eso es un hallazgo `DEC`, y la ficha se cierra igual.

### 3. Los campos de dependencia se llenan literales

Los campos **"Depende de"** y **"Lo consumen"** son la materia prima del pase general.
Nombres de archivo y de formato exactos, no descripciones. Sin ellos, el pase final no
tiene con qué trabajar y la auditoría termina siendo 94 opiniones sueltas.

### 4. Los hallazgos viven en `HALLAZGOS.md`, no dentro de las fichas

La ficha **referencia** el hallazgo por ID (`INC-003`). El hallazgo se describe una sola
vez en el registro. Si los hallazgos viven dentro de las fichas no se pueden contar,
ordenar por severidad ni agrupar por tipo.

## El orden de revisión

Por acoplamiento descendente, **nunca alfabético**:

```
0 · Contratos compartidos      ← definen el vocabulario del resto
1 · Hooks, en orden de ejecución   ← el orden ES semántico
2 · Scripts deterministas
3 · Módulos del CLI
4 · Subagentes
5 · Tests del harness
─────────────────────────────  fin del nivel A
6 · Reglas → 7 · Skills → 8 · Comandos     nivel B
9 · Barridos en lote                        nivel C
─────────────────────────────
10 · PASE GENERAL — cuatro lentes cruzados
```

Empezar por los contratos da el criterio para juzgar los hooks. Al revés, se revisan 19
hooks y después se descubre que el contrato que se asumía estaba mal definido.

## Ritmo

**6–8 fichas por sesión**, cerrando bloques temáticos completos, un commit por bloque.
Aproximadamente 8 sesiones para el nivel A, 4 para el B, 2 para el C y 1 para el pase
general.

Usá el propio harness para esto: cada bloque es una tarea de `/plan` con su task-spec y
sus casillas. Si el harness no aguanta auditar al harness, ese ya es el primer hallazgo.

## Archivos

| Archivo | Para qué |
|---|---|
| `UNIDADES.md` | El índice completo de las 102 unidades en orden de revisión, con su estado |
| `HALLAZGOS.md` | Registro único de hallazgos con ID, tipo, severidad y estado |
| `PASE-GENERAL.md` | Las cuatro lentes cruzadas, con las tablas listas para llenar al final |
| `plantillas/FICHA-A.md` | Plantilla nivel A — copiar a `fichas/<ID>-<nombre>.md` |
| `plantillas/FICHA-B.md` | Plantilla nivel B — copiar a `fichas/<ID>-<nombre>.md` |
| `fichas/` | Una ficha por unidad, nombrada `<ID>-<slug>.md` (ej: `H-04-pre-write-guard.md`) |

## El modo de fallo a evitar

**Hacer 94 fichas y que el pase general no encuentre nada**, porque en aislamiento todo se
veía razonable. Las reglas 2 y 3 son el antídoto: sin evidencia de fallo y sin
dependencias literales, el pase final no tiene sustrato.

El segundo modo de fallo: escribir fichas complacientes. Una ficha cuyo veredicto es
siempre "OK" no está auditando, está transcribiendo. Si un bloque completo sale sin un
solo hallazgo, revisá la rúbrica antes de seguir.
