# ADR-001 · Núcleo compartido para los hooks del harness

**Estado:** propuesto · **Fecha:** 2026-08-29 · **Insumo:** `docs/auditoria/` (76 hallazgos)

---

## Contexto

La auditoría cerró 102 unidades y produjo 76 hallazgos —78 tras los dos que encontró la
verificación del runtime durante el diseño (`INC-020`, `CAR-004`)—. Al agruparlos por
*«qué arreglo los cierra»*, se reducen a **once piezas de trabajo**:

| Cluster | Hallazgos | `S1` |
|---|---|---|
| 1 · Identidad de sesión | 3 | 1 |
| 2 · Ciclo de vida de los eventos | 6 | 1 |
| 3 · Declarar los contratos | 11 | — |
| 4 · Clasificación de rutas | 3 | — |
| 5 · Presupuesto de contexto | 4 | 1 |
| 6 · Entrada de los hooks | 3 | 1 |
| 7 · `post-edit` | 2 | 2 |
| 8 · Provocación de reglas | 5 | 1 |
| 9 · Backlog de tests | 6 | — |
| 10 · Capa de asignaciones | 4 | — |
| 11 · Deriva de documentación | 11 | — |

**Los clusters 1, 4, 5 y 6 —13 hallazgos, 2 de los siete `S1`— son el mismo hueco:** cada
uno de los 18 hooks resuelve por su cuenta la identidad de sesión, la lectura del payload,
la clasificación de rutas y el control de costo de inyección. No hay capa compartida.

La conclusión que encabeza el pase general —*«las herramientas están inventadas y la
aplicación quedó a medias»*, con ocho instancias medidas— tiene aquí su causa mecánica:
**cuando no hay un lugar donde vivan las decisiones comunes, cada pieza nueva las vuelve a
tomar**, y las toma distinto.

### El precedente está en el mismo repositorio

```
templates/boilerplate/scripts/lib/   13 módulos puros · 79 tests · 0 hallazgos S1/S2
templates/.claude/hooks/             18 hooks · sin lib/ · 6 de los 7 S1
```

`scripts/lib/` es exactamente este patrón, ya aplicado, ya funcionando y ya cubierto. Este
ADR **no propone una idea nueva: propone aplicar a `hooks/` lo que el repo ya hizo bien en
`scripts/`.**

---

## Decisión

Crear `templates/.claude/hooks/lib/` con **cinco módulos CommonJS**, y migrar los 18 hooks
para consumirlos.

CommonJS es obligatorio: `templates/.claude/hooks/package.json` declara
`{"type": "commonjs"}` y `templates-contract.md` lo marca como intencional. El núcleo vive
dentro de esa carpeta y hereda la declaración — que es, de paso, exactamente el mecanismo
cuya ausencia en `.claude/scripts/` produjo `DEC-003`.

---

## Las cinco piezas

### 1 · `lib/session.js` — identidad de sesión y estado

**Problema que resuelve.** Cinco hooks derivan la sesión así:

```js
const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
```

Ninguno lee `session_id` del payload de stdin, donde Claude Code lo entrega. Con el
fallback `'default'`, el discovery flag, el circuit breaker y los once flags de dedup son
**globales de la máquina**: comprobado, un proyecto levanta el Discovery Gate de otro
(`HUE-002`).

**API propuesta.**

```js
sessionId(payload)         // string, tres niveles, nunca global
sessionScope(payload)      // estado de la SESIÓN  — compartido con los subagentes
threadScope(payload)       // estado de ESTE HILO  — agent_id ?? 'main'   (ADR-003 §1)
readState(payload, key, { scope })
writeState(payload, key, value, { scope })
cleanup({ source })        // borra por ANTIGÜEDAD; nunca el estado de la sesión en curso
```

> **Segunda corrección (`HUE-032`).** `readState`/`writeState` llevan `scope` porque los
> hooks **corren también dentro de los subagentes** y comparten el `session_id`. Un solo
> ámbito convierte los flags de dedup en un pozo común de seis hilos: el subagente consume
> el aviso y el hilo principal escribe sin él. Ver `ADR-003` §1.

> **Corrección tras verificar el runtime (`INC-020`).** La primera versión decía
> `cleanup()` a secas, «en `SessionStart`». `SessionStart` **no corre una vez por sesión**:
> corre en `startup`, `resume`, `clear`, `compact` y `fork`, y el harness lo registra sin
> matcher. Un `cleanup()` ciego ahí borra el discovery flag y `session-writes.json` cada vez
> que el runtime compacta, a mitad del trabajo. Por eso la firma lleva `source` y el criterio
> de borrado es la antigüedad, no «arrancó una sesión». Ver `ADR-002` §1.

**Dos decisiones de fondo:**

**(a) Tres niveles de identidad, ninguno global.**

```
1. payload.session_id           ← lo que Claude Code entrega y hoy nadie lee
2. 'proj-' + sha1(process.cwd()).slice(0,8)   ← acotado al proyecto, nunca 'default'
```

El segundo nivel es lo que mata la fuga por construcción: aun sin ninguna señal de sesión,
dos proyectos distintos nunca comparten estado.

> **Verificado, y peor de lo registrado.** La primera versión ponía
> `process.env.CLAUDE_SESSION_ID` como segundo nivel, tratándolo como una fuente válida
> degradada. **Esa variable no existe**: no está entre las que la documentación expone a los
> hooks, y en un runtime real `env | grep -c '^CLAUDE_SESSION_ID='` da `0`. Existe
> `CLAUDE_CODE_SESSION_ID`, otro nombre, tampoco documentada como contrato.
>
> Entonces los cinco hooks no tienen un fallback riesgoso: **tienen `'default'` como único
> valor, siempre**. Demostrado de punta a punta —una lectura en el proyecto A levanta el
> Discovery Gate del proyecto B, en otra sesión— en la ampliación de `HUE-002`.
>
> Se saca del diseño: una variable de entorno no documentada no es un nivel de fallback, es
> la causa del problema. El campo `session_id` del payload sí está documentado.
>
> **Consecuencia de orden:** esto pasa a ser lo primero de la tanda 0. El Discovery Gate está
> desactivado en la práctica en toda sesión que no sea la primera de la máquina.

**(b) El estado se muda de `os.tmpdir()` a `.claude/temp/session/<id>/`.**

| | `os.tmpdir()` (hoy) | `.claude/temp/session/` (propuesto) |
|---|---|---|
| Aislamiento entre proyectos | **ninguno** con el fallback | por construcción: la ruta es del proyecto |
| Inspeccionable al depurar | difícil de encontrar | está en el proyecto |
| Ya gitignored | n/a | **sí** — `gitignore.template:30` |
| Se limpia solo | lo hace el SO | **hay que hacerlo** → `cleanup({source})`, por antigüedad |

El costo es real (hay que limpiar) y lo asumimos: mata `HUE-002` por construcción en vez de
por mejor derivación del ID, y de paso pone los artefactos donde ya viven
`session-writes.json` y `LESSONS_LEARNED.md`.

**Cierra:** `HUE-002` (S1), `HUE-032` (S1, con `ADR-003` §1), `ACO-006`, `ACO-007`.

---

### 2 · `lib/payload.js` — la entrada de todo hook

**Problema que resuelve.** `spec-diff-check.js` lee el comando de `process.env.TOOL_INPUT`,
una variable que nadie setea, y por eso **nunca bloqueó un commit** (`DEC-001`, S1). Es el
único de los 18 que lo hace así — pero nada lo impedía, porque **cada hook parsea el
payload a mano** y ningún test fija el formato (`ACO-012`).

**API propuesta.**

```js
read({ maxBytes = 10 * 1024 * 1024 }) → Promise<Payload>

// Payload normalizado, con los alias que hoy cada hook resuelve por su cuenta:
{ toolName, sessionId, filePath, newContent, command, raw }
//   file_path ?? path            new_string ?? content       tool_input.command
```

**Tres propiedades no negociables:**

- **Una sola forma de entrar.** Si el payload solo se lee acá, `DEC-001` deja de ser
  posible: no hay dónde inventar otra fuente.
- **El cap SEC-04 por construcción.** Hoy cuatro hooks leen stdin sin límite
  (`HUE-010`) porque la protección se aplicó archivo por archivo y `sdd/` quedó afuera.
  En el núcleo, el cap es la única implementación.
- **Fail-open explícito.** Un payload ilegible devuelve `null`; cada hook decide qué hacer,
  pero la decisión queda escrita en el hook, no escondida en un `catch` vacío.

**Cierra:** `DEC-001` (S1), `HUE-010`, `ACO-012`.

---

### 3 · `lib/paths.js` — las tres preguntas sobre una ruta

> **Corrección respecto de lo que la auditoría anotó primero.** En la ficha `H-03` registré
> esto como «tres definiciones de lo mismo, colapsar en una». Mirándolas de cerca, **no son
> la misma pregunta**:

| Pieza | La pregunta que realmente hace | Alcance |
|---|---|---|
| `spec-gate`, `plan-injector` | *¿es código de **producto**?* | `src/`, `app/`, `lib/`, `supabase/migrations/`, `packages/*/src/` |
| `pre-write-guard` | *¿necesita **descubrimiento** antes de escribir?* | `src/app/` + migraciones, sin `.spec.ts` |
| `write-tracker` | *¿va a un **índice**?* | `src/app/` + `.ts`/`.html`/`.scss`, sin `.spec.ts` |

Las tres respuestas son legítimas y distintas. **El error no es que existan tres: es que
están escritas tres veces, en tres archivos, sin nombre y sin test** — y por eso divergieron
donde no debían (`INC-005`: un `.spec.ts` está exento para `spec-gate` y recibe 24 KB de
`plan-injector`).

**API propuesta — las tres preguntas con nombre, una implementación:**

```js
isProductCode(rel)     // el contrato del SDD
needsDiscovery(rel)    // el alcance del Discovery Gate
belongsToIndex(rel)    // lo que el auto-indexer debe conocer
classify(filePath)     // { rel, isProductCode, needsDiscovery, belongsToIndex, category }
```

Más la **lista de exención única** que hoy `spec-gate` y `plan-injector` mantienen por
separado, y cuya divergencia es `INC-005`.

`category` reemplaza el `ctxCategory` de las once ramas de `pre-write-guard`.

**Cierra:** `INC-005`, `HUE-015` (migraciones fuera de `belongsToIndex`), `HUE-001`
(el Gate podrá preguntar por contenido, no solo por existencia del flag).

---

### 4 · `lib/budget.js` — presupuesto de inyección

**Problema que resuelve.** `plan-injector` inyecta **24.622 caracteres (~6.155 tokens) en
cada Edit**, sin dedup ni techo (`CAR-001`, S1). Diez ediciones son ~61.000 tokens del mismo
contrato. Y la casa ya resolvió esto tres veces —`prompt-context` con `REPEAT_EVERY`, la
capa 4 de `pre-write-guard` con flags por categoría, `session-start` con tope y corte en
`DETAIL:BEGIN`— con tres implementaciones distintas.

**API propuesta.**

```js
inject(payload, key, content, {
  maxChars,          // techo duro; trunca con marca visible
  repeatEvery,       // turnos antes de repetir contenido idéntico
  cutAt,             // marcador de corte, p.ej. '<!-- DETAIL:BEGIN -->'
}) → string | null   // null = no corresponde inyectar ahora
```

Una sola primitiva de *«esto ya lo dije, y esto es lo máximo que puedo decir»* — con la
dedup en **ámbito de hilo**, no de sesión: *«ya lo dije»* es una afirmación sobre un
contexto, y el subagente tiene el suyo (`ADR-003` §1).

**Cierra:** `CAR-001` (S1), `DEC-006`, `HUE-017`.

**Lo que NO cierra, y hay que decirlo:** `CAR-003` —las **13** reglas path-scoped que suman
~19.100 tokens al editar un componente de `features/`— **queda fuera del alcance de este
módulo**. Esas reglas las inyecta Claude Code al matchear el frontmatter `paths:`, no un
hook: ningún módulo nuestro puede interceptarlas. Su arreglo es editorial y lo diseña
**`ADR-005`**, que además encontró que el recorte barato está bloqueado por el cluster 8:
once de las doce reglas `ARCH-*` citadas en `rules/` no tienen fixture que demuestre que
pueden fallar.

---

### 5 · `lib/contracts.js` — el registro que nadie tenía

**Problema que resuelve.** 21 artefactos compartidos, **3 declarados**. Y la declaración
—`templates-contract.md`— vive en `.claude/rules/` de **este** repo, no en el payload: el
proyecto generado no recibe ninguna declaración de sus propios contratos (`ACO-013`).

**Propuesta: el registro es datos, no prosa.**

```js
module.exports = {
  'session-writes': {
    path: '.claude/temp/session-writes.json',
    format: 'string[] de rutas relativas',
    producers: ['write-tracker'],
    consumers: ['sync-check', 'spec-diff-check', 'spec-reflection', 'index-syncer'],
    lifetime: 'sesión',          // ← cuándo se borra          (ADR-002 §1)
    scope: 'sesión',             // ← quién lo comparte        (ADR-003 §1)
  },
  // … los 21
};
```

Y **un test que lo verifica contra el filesystem**: todo hook que mencione un artefacto
tiene que figurar como productor o consumidor. Eso convierte los 12 `ACO` de *«nadie lo
declaró»* en *«no compila si no lo declarás»*.

La prosa de `templates-contract.md` se genera desde acá, no al revés — el mismo principio
que `managedPaths` derivado de `CLI_OWNED` en `lib/scaffolder.js`, que es la solución que el
generador ya aplica y el harness no.

**Cierra:** los 12 `ACO` y `HUE-030` (los cinco índices ausentes en dos consumidores
independientes: con registro, el test los detecta).

Y —según el pase de cobertura, que cruzó los IDs uno por uno— nueve más de la misma forma que
el ADR no nombraba: `ACO-002`, `ACO-003`, `ACO-005`, `ACO-008`, `ACO-009`, `ACO-010`,
`ACO-011`, `HUE-008`, `HUE-003`. Todo hallazgo cuya frase es *«X depende del formato de Y sin
que figure en `templates-contract.md`»* lo cierra esta pieza.

**Incluido `HUE-005` (`S1`)**: `blueprint.json` no se valida dentro del proyecto generado y su
`stack` crudo apaga reglas en silencio (`pre-write-guard.js:29`, `architect.js:72`). Es un
artefacto del registro con `format` y dos `consumers`; validar donde se lee es exactamente lo
que el registro habilita. Ver `COBERTURA.md` §1 bis.

---

## Lo que este ADR **no** resuelve

Honestidad sobre el alcance. De los 76 hallazgos, el núcleo cierra ~29. El resto necesita
trabajo propio:

| Cluster | Por qué queda fuera | Dónde va |
|---|---|---|
| 2 · Ciclo de vida de los eventos | Es un malentendido conceptual, no código compartido | **ADR-002** |
| 7 · `post-edit` | Dos `S1` de 2 líneas + 1 archivo; no espera al núcleo | **tanda 0** |
| 8 · Provocación de reglas | Escribir 24 fixtures. Trabajo mecánico, sin diseño | backlog |
| 9 · Backlog de tests | 11 archivos. Es la **precondición** de la migración, no su consecuencia | ver fases |
| 10 · Asignaciones | Decisión de producto: integrar o sacar. No es técnica | pendiente |
| 11 · Deriva de docs | 11 `INC` mecánicos, un solo commit | backlog |
| `CAR-003` | Lo inyecta Claude Code, no un hook | editorial |

---

## Plan de migración

**La regla que ordena todo:** los hooks **son el payload**. Un hook roto se replica en cada
proyecto generado. Y la auditoría demostró que los seis `S1` del harness están, sin
excepción, en hooks sin test.

> **Nunca se migra un hook que no tenga test. Si no lo tiene, el test va primero.**

Es la lección de la propia auditoría aplicada a la reparación.

### Tanda 0 · Los `S1` que no dependen del núcleo *(riesgo nulo)*

`SEC-001` (`execFileSync` en vez de interpolar en shell) · `DEC-003` (`package.json` de tres
líneas en `.claude/scripts/`) · `INC-020` (matcher `startup` en `SessionStart`, más el test
que valida `settings.json` contra la lista de eventos del runtime) · el test de `post-edit`
que no existía.

**No toca ningún otro hook.** Va primero porque son tres `S1` y no dependen de nada — y
`INC-020` además es precondición de `session.js`: mover el estado a `.claude/temp/` con
`SessionStart` sin matcher sería estrictamente peor que dejarlo en `os.tmpdir()`.

### Tanda 1 · Escribir el núcleo *(riesgo nulo)*

Los cinco módulos con sus tests, **sin tocar ni un hook**. El núcleo entra al repo probado y
sin consumidores. Si el diseño no aguanta el contacto con el código, se descubre acá.

### Tanda 2 · Tests para los 11 hooks sin test *(riesgo nulo, valor inmediato)*

```
spec-gate · plan-injector · spec-diff-check · discovery-tracker · write-tracker
post-edit(hecho en tanda 0) · failure-tracker · hotfix-autoclose · sync-check
context-guardian · context-enrichment-guard
```

Los tests se escriben **contra el comportamiento actual**, incluidos los bugs. Un test que
documenta `DEC-001` fallando es la red que permite arreglarlo sin romper otra cosa.
Cierra `HUE-006`, `HUE-011` y la deuda de ejecución del método (`bash-guard` capas 2-3,
`hotfix-autoclose`, `lint-arch-wrapper`).

### Tanda 3 · Migrar, de a un módulo *(riesgo acotado)*

En este orden, y cada paso con la suite en verde antes de seguir:

| Paso | Módulo | Hooks que toca | Cierra |
|---|---|---|---|
| 3a | `payload.js` | los 18 | `DEC-001`, `HUE-010`, `ACO-012` |
| 3b | `session.js` | 5 + los que usan estado | `HUE-002`, `ACO-006`, `ACO-007` |
| 3c | `paths.js` | `spec-gate`, `plan-injector`, `pre-write-guard`, `write-tracker` | `INC-005`, `HUE-015`, `HUE-001` |
| 3d | `budget.js` | `plan-injector`, `compact-recovery`, `session-start` | `CAR-001`, `DEC-006`, `HUE-017` |
| 3e | `contracts.js` | ninguno — solo el registro y su test | los 12 `ACO`, `HUE-030` |

`payload.js` va primero porque es el que menos supone y el que más desbloquea: una vez que
los 18 hooks entran por la misma puerta, los otros tres módulos reciben datos normalizados.

### Tanda 4 · Lo que el núcleo no cubre

`ADR-002` (semántica de `Stop`), fixtures de provocación, deriva de documentación,
decisión sobre asignaciones.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Migrar rompe un hook y se replica a todos los proyectos** | Tanda 2 antes de tanda 3. Ningún hook se migra sin test |
| **El núcleo agrega superficie** (5 archivos nuevos que también pueden fallar) | Son funciones puras salvo `session.js`. Tests propios desde la tanda 1. El precedente `scripts/lib/` tiene 79 tests y cero hallazgos graves |
| **`paths.js` cambia comportamiento en silencio** | Los tests de tanda 2 capturan el comportamiento actual **antes** de migrar. Toda diferencia queda visible como test que cambia |
| **Mover el estado a `.claude/temp/` lo hace crecer** | `cleanup({source})` con umbral de antigüedad explícito. Es la razón por la que `session.js` tiene esa función |
| **Un matcher de `settings.json` mal escrito no falla: el hook no corre** | Test en tanda 1 que valida las claves de `settings.json` contra la lista de eventos del runtime (`INC-020` se encontró justamente ahí) |
| **`require('./lib/...')` desde `sdd/` y `validators/`** | Rutas relativas (`../lib/`). Verificar en tanda 1 con un test que cargue los 18 hooks |
| **El scaffolder no copia `lib/`** | `copyRecursiveSync` es recursivo — pero hay que **comprobarlo**, no suponerlo. Test en tanda 1 |

---

## Criterio de done

- [ ] Los cinco módulos existen, con test propio y la suite en verde
- [ ] Los 18 hooks tienen test (de 9 a 20)
- [ ] Ningún hook lee `process.env` para datos del payload
- [ ] Ningún hook deriva `sessionId` por su cuenta
- [ ] Ninguna clasificación de rutas fuera de `paths.js`
- [ ] Ninguna inyección sin pasar por `budget.js`
- [ ] El registro de contratos cubre los 21, y su test falla si aparece un consumidor sin declarar
- [ ] `templates-contract.md` se genera desde el registro
- [ ] Ningún hook corre en un evento que no declara entender: `settings.json` con matcher
      explícito donde el origen cambia el comportamiento, y un test que lo valida
- [ ] Los `S1` del núcleo cerrados: `DEC-001`, `HUE-002`, `CAR-001`, `SEC-001`, `DEC-003`,
      `INC-020`
- [ ] `npm run claude:test-hooks` y `npm test` en verde
- [ ] Cada hallazgo cerrado, marcado `resuelto` en `HALLAZGOS.md` con el commit

---

## Alternativas descartadas

**Reparación por clusters sobre la arquitectura actual.** Once tandas independientes, más
conservador, cada una entregable por separado. Se descarta porque deja intacta la causa —
cuatro reimplementaciones de lo mismo— y el próximo hook nuevo la repite. La auditoría
midió ocho instancias de ese patrón; sin núcleo, la novena es cuestión de tiempo.

**Solo los siete `S1`.** Cinco son de esfuerzo bajo o trivial y se podrían cerrar hoy. Se
descarta como estrategia completa —aunque la **tanda 0 la adopta parcialmente**, porque dos
de esos `S1` no dependen del núcleo y no tiene sentido hacerlos esperar.
