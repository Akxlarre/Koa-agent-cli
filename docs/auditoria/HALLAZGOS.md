# Registro de hallazgos

> **Cada hallazgo se describe UNA vez, acá.** Las fichas solo lo referencian por ID.
> Si un hallazgo vive dentro de una ficha, no se puede contar, ordenar por severidad ni
> agrupar por tipo — y el pase general se vuelve imposible.

## Taxonomía

Seis tipos, cerrados. Si algo no entra en ninguno, primero preguntate si realmente es un
hallazgo; recién después agregá un tipo (y documentalo acá).

| Tipo | Nombre | Qué es | Ejemplo del repo |
|---|---|---|---|
| `INC` | Inconsistencia | La documentación dice X, el código hace Y | `TEMPLATES-REGISTRY.md` dice 16 hooks cableados; son 17 |
| `DEC` | Chequeo decorativo | Existe, corre, pasa — y no puede fallar | ARCH-24 y ARCH-26, muertas hasta que existió `provocar-reglas.mjs` |
| `ACO` | Acoplamiento no declarado | Una pieza depende del formato de otra sin que figure en `templates-contract.md` | — |
| `DUP` | Autoridad duplicada | Dos piezas deciden lo mismo, posiblemente con criterios distintos | `session-start` y `discovery-tracker` escriben el mismo flag |
| `HUE` | Hueco | Nadie cubre esto: sin test, sin mecanismo, sin dueño | los hooks sin archivo de test |
| `CAR` | Carga | Correcto, pero cuesta más contexto/fricción de lo que aporta | una regla que se inyecta siempre y ningún mecanismo aplica |

> `CAR` es el tipo que casi nadie incluye y en un harness es central: **una pieza puede
> ser correcta y aun así ser neta negativa**, porque cada regla, cada skill
> model-invocable y cada inyección paga renta en la ventana de contexto.

> `SEC-001` usó el prefijo `SEC` dentro del tipo `DEC` porque la taxonomía se quedó corta:
> un guardrail que además **abre** una superficie de ataque no es exactamente «un chequeo
> que no puede fallar». Se mantiene como `DEC` para no cambiar la taxonomía a mitad de la
> auditoría (regla 1 del README); decidir en el pase general si `SEC` merece ser un tipo
> propio y, si se agrega, reclasificar hacia atrás.

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
| `INC-001` | S2 | `S-01` | **(reescrito)** El namespace ARCH está repartido en tres implementaciones sin registro único; `ARCH-14` está documentado y no lo emite nadie | resuelto en su mitad verificable · `lib/guard-rules.js` es el registro del guard; un test cruza los IDs emitidos contra el registro y contra sus anclas en el doc. `ARCH-14` sigue siendo fantasma (lo cubre `HUE-026`) |
| `CAR-001` | **S1** | `H-06` | `plan-injector` inyecta ~6.155 tokens en CADA Edit, sin dedup ni techo — la única pieza del harness sin ningún control de costo | resuelto · `lib/budget.js` — 246.220 → 24.330 chars en 10 ediciones |
| `DEC-002` | S2 | `H-05` | `GATE-A1` de `harness-gate` se satisface con la palabra «cuando»; 12 de 15 reglas reales ya lo cumplen sin intentarlo | resuelto · se evalúa por párrafo, no por archivo: era peor de lo descrito — una lección buena arriba absolvía todo lo de abajo, para siempre |
| `INC-005` | S2 | `H-03` | `spec-gate` y `plan-injector` clasifican el mismo archivo con listas de exención distintas | resuelto · las dos preguntas son `paths.isProductCode`; hay un test que compara gate contra injector archivo por archivo |
| `HUE-010` | S2 | `H-03` | Los 3 hooks de `sdd/` y `context-enrichment-guard` leen stdin sin el cap SEC-04 | resuelto · `spec-gate` y `context-enrichment-guard` migrados a `lib/payload.js`; ningún hook acumula stdin sin tope |
| `HUE-011` | S2 | `H-03` | Cero tests en todo `sdd/`: 3 hooks, ~360 líneas, el motor SDD entero | resuelto · los tres hooks de `sdd/` tienen test: 42 + 35 + 16 = 93 |
| `HUE-012` | S2 | `H-04` | Las ~20 reglas regex de `pre-write-guard` no las cubre `provocar-reglas.mjs` | resuelto · las 19 reglas mudas ahora dicen su ID y hay un fixture por regla que las provoca de verdad (`guard-rules.test.js`) |
| `ACO-004` | S2 | `H-00` | El orden de los hooks dentro de cada evento es semántico en 3 casos y no está declarado | resuelto · las dependencias de orden declaradas y testeadas; una de las tres se disolvió con `ACO-001` en vez de documentarse |
| `INC-004` | S3 | `H-00` | `TEMPLATES-REGISTRY.md` dice 16 hooks cableados; son 17 | abierto |
| `HUE-009` | S3 | `H-00` | Ningún test verifica que los comandos cableados apunten a archivos existentes | resuelto · `settings.test.js`: ruta, sintaxis, evento y los dos matchers con semántica |
| `HUE-013` | S3 | `H-05` | `GATE-B1` bloquearía una regla que documenta un hook; latente, no activo hoy | abierto |
| `ACO-005` | S3 | `H-01` | `<!-- DETAIL:BEGIN -->` y `**last_updated:**` son contratos de 2-3 piezas sin declarar | abierto |
| `ACO-006` | S3 | `H-02` | `koa-prompt-ctx-{sessionId}.json` no declarado | resuelto · el estado pasó a `budget-<clave>.json`, declarado en `contracts.js` |
| `ACO-007` | S3 | `H-04` | `koa-breaker-*.json` y los 11 `koa-ctx-*.flag` no declarados | resuelto · `breaker.json` y `ctx-<categoria>.json` declarados; un test lee las claves que los hooks escriben de verdad |
| `SEC-001` | **S1** | `H-11` | `post-edit.js` interpola la ruta del payload en una cadena de shell: una ruta con comillas ejecuta comandos arbitrarios | resuelto · `execFileSync` con argv — 6 cargas de ataque en el test |
| `DEC-003` | **S1** | `H-11` | `post-edit.js` usa `import` bajo un `package.json` sin `type:module`: no carga en Node 20/21, el mínimo que el CLI exige | descartado en su premisa · pero el costo real —un warning por cada edición, solo visible en el proyecto generado— existía y se cerró: `.claude/scripts/package.json` |
| `HUE-016` | S2 | `H-12` | **(remedido)** Un error con `\|` corrompe la fila UNA vez y se estabiliza; lo que se rompe para siempre es el dedup de esa entrada | resuelto · `lib/lessons.js` escapa el `|` y lo desescapa al leer; 5 fallas con pipe → 1 fila con contador 5 |
| `DUP-002` | S2 | `H-12` | `failure-tracker` y `lint-arch-wrapper` escriben ambos en `LESSONS_LEARNED.md` con formatos distintos | resuelto · la tabla vive entre marcadores `AUTO-GENERATED` y lo de afuera se preserva; verificado que una sección del wrapper sobrevive a 20 fallas |
| `CAR-002` | S2 | `H-17` | `context-guardian` avisa en cada respuesta indefinidamente: no tiene anti-bucle | resuelto · `budget.avisar()`, cuyo default es no repetir |
| `HUE-015` | S2 | `H-10` | `write-tracker` no rastrea `supabase/migrations/**`, que el Discovery Gate sí trata como código fuente | resuelto · una sesión de puro esquema dejaba ciegos a los **tres** consumidores a la vez; `DATABASE.md` es un índice y una migración es lo que lo desactualiza |
| `INC-007` | S2 | `H-14` | `hotfix-autoclose` dice cerrar «al terminar la sesión»; `Stop` corre al final de cada respuesta | resuelto · `/hotfix-close` explícito + el hook como red en `SessionEnd` |
| `HUE-017` | S3 | `H-13` | `compact-recovery` no tiene tope de tamaño: los 4 archivos de `context/` se inyectan enteros | abierto |
| `HUE-014` | S3 | `H-08` | El matching contra el índice es por substring: un nombre contenido en cualquier parte del `.md` pasa como registrado | abierto |
| `INC-006` | S3 | `H-09` | El docblock de `discovery-tracker` describe solo `indices/`; también escribe el flag ante `context/` | abierto |
| `ACO-008` | S3 | `H-12` | `LESSONS_LEARNED.md` es un contrato de round-trip con dos productores, sin declarar | abierto |
| `DEC-004` | **S1** | `S-05` | El auditor de reglas cubre 4 de 28 (14%); las 24 sin fixture incluyen las tres de seguridad RLS y las dos que motivaron escribir el script | resuelto · 4/28 → 18/28 → **28/28**. El baseline quedó vacío: no hay ninguna regla que no se haya puesto delante de su propia violación |
| `INC-009` | S2 | `S-05` | `SEC-RLS-01/02/03` no están en el baseline: `lint:arch:provocar` sale en 1 en cualquier proyecto recién generado | resuelto · las tres RLS tienen fixture; la corrida sale en 0 |
| `HUE-018` | S2 | `S-01` | `require('typescript')` sin guarda: con TypeScript 7 el linter muere con un `TypeError`, no con un mensaje | abierto |
| `INC-008` | S2 | `S-01` | El boilerplate que el CLI reparte incumple su propia `ARCH-09`: `section-hero.component.ts` tiene 1.170 líneas contra un límite de 200 | resuelto · la regla medía el `@Component` (template inline), no la clase: `tabs` era falso positivo; `section-hero` 258 → 198. `lint:arch` limpio |
| `HUE-019` | S2 | `S-11` | Reglas con test de función pura pero sin fixture: nadie comprueba que el linter las reporte de verdad — el hueco donde vivían `ARCH-24` y `ARCH-26` | resuelto · las 9 que faltaban tienen fixture; 7 dispararon a la primera, 1 era un fixture mal escrito y 1 destapó `INC-023` |
| `INC-010` | S2 | `S-08` | Los dos scripts de asignaciones salen en 1 en un proyecto que no las usa; `verificar-specs` resuelve el mismo caso con `exit 0` | resuelto · interruptor `specs/AUTHORS.md`: apagada → mensaje y `exit 0` |
| `DEC-005` | S3 | `S-06` | `smoke-scripts` imprime `✅ 0 script(s) comprobados` y sale 0: comete en pequeño el error que audita | abierto |
| `ACO-009` | S3 | `S-05` | La provocación depende de que la salida de `architect.js` nombre el código de la regla; ese formato no está declarado | abierto |
| `ACO-010` | S3 | `S-06` | `smoke-scripts` depende de los nombres exactos de los scripts de `package.json` y de que `ARCH-04` siga activa | abierto |
| `HUE-020` | **S1** | `G-02` | `parseJsonc` se come lo que siga a `//` dentro de un string: un `tsconfig.json` con `$schema` deja el proyecto sin path aliases y sin compilar | resuelto · `stripJsonComments` recorre respetando strings; el parche de `tsconfig` pasó a requerido |
| `HUE-022` | **S1** | `G-10` | Los 9 parches son condicionales: si `ng new` cambia de forma no fallan, no hacen nada. Ningún test de integración corre `ng new` | resuelto · `patch()` con `requerido` (los tres archivos sin los que no hay proyecto paran el CLI) + `npm run test:integracion`, que corre `ng new` de verdad |
| `HUE-025` | S2 | `T-01` | La cobertura mide que la lógica sea correcta, casi nunca que el sistema la ejecute ni que alguien intente evadirla | abierto |
| `HUE-021` | S3 | `G-08` | Ningún test genera una feature y le corre `architect.js` encima | resuelto · no hacía falta `npm install`, solo **un paquete**: se instala el `typescript` que el propio proyecto declara y el linter corre sobre la salida real de `ng new` |
| `HUE-023` | S3 | `A-01` | La calidad del resumen de los subagentes no es verificable por ningún mecanismo del repo | abierto |
| `HUE-024` | S3 | `A-01` | Nadie verifica que los comandos que los procedimientos de los subagentes mencionan existan en `package.json` | abierto |
| `HUE-026` | S3 | `T-01` | `doc-links.test.js` verifica «regla emitida → documentada» pero no la inversa; por eso no atrapó `ARCH-14` | resuelto · `doc-links.test.js` verifica las dos direcciones; encontró un segundo fantasma, `A11Y-04`, que la auditoría no tenía |
| `INC-011` | S3 | `G-01` | `bin/index.js` tiene 169 líneas contra el techo de ~150 que declara `cli-architecture.md` | resuelto · los prompts salieron a `lib/prompts.js`; 169 → 122 líneas, con test contra el techo de la regla |
| `INC-012` | S3 | `G-02` | Los nombres reservados de Windows solo se validan **en** Windows | resuelto · se validan siempre, no solo en win32 |
| `INC-013` | S3 | `G-07` | La mitigación de `deriveSingular` («el prompt permite corregirlo») no existe en modo no-interactivo | resuelto · `--singular <Nombre>` + se imprime lo derivado en modo no-interactivo |
| `ACO-011` | S3 | `A-01` | `.claude/temp/review-diff.patch` es el canal entre `/review` y `code-judge` y no está declarado | abierto |
| `ACO-012` | S3 | `T-01` | Ningún test fija el formato del payload que reciben los hooks; cada uno lo construye a mano | abierto |
| `CAR-003` | S2 | `R-01` | **(remedido)** Editar un componente de `features/` inyecta **13 reglas** completas (~19.100 tokens); `visual-system.md` sola es el 28% y matchea seis globs | resuelto · peor caso 76.391 → 71.975; `shared/` −38%, `.scss` −58%, SQL −40%; con tope testeado por ruta |
| `INC-015` | S2 | `K-07` | `sdd/SKILL.md` y dos comandos instruyen `npm run assignments:sync`/`audit`; el scaffolder nunca los escribe en `package.json` | resuelto · los dos npm scripts en `lib/scaffolder.js`, con test que ata comando y script |
| `INC-017` | S2 | `D-06` | Tres convenciones de ID para el mismo track: los comandos generan sin código de autor y `assignments-audit` lo exige. El bug ya ocurrió y se arregló el detector, no el generador | resuelto · una convención con dos formas y el interruptor decide; `parseTrackName` compartido, con test de las dos ramas |
| `DUP-003` | S2 | `K-04` | `/sync-indices`, `index-syncer` e `indices-sync.js` hacen el mismo trabajo en tres capas y nada dice cuál usar cuándo | resuelto · la skill no nombraba **ni al script ni al subagente** y editaba dentro de los marcadores; ahora delega, y sin `Edit` en su frontmatter |
| `HUE-027` | S3 | `R-01` | Nada distingue las 10 reglas mecanizadas de las 5 que son contrato social | abierto |
| `HUE-028` | S3 | `K-01` | El patrón de «skill con guardrail en su frontmatter» funciona y se usa una sola vez, en `/plan` | abierto |
| `INC-014` | S3 | `R-10` | `visual-system.md` cita `src/styles/_view-transitions.scss`; la ruta real lleva `motion/` | abierto |
| `INC-016` | S3 | `D-07` | `fix-close.md` manda registrar en `indices/DOMAIN-GOTCHAS.md`, que no existe | abierto |
| `DEC-006` | S2 | `L-02` | El umbral de 80 chars no salta las plantillas de `context/`: se inyectan enteras, ~3.240 tokens por compactación en un proyecto sin contexto llenado | resuelto · el detector es `budget.sinLlenar`, que mide contenido real |
| `HUE-030` | S2 | `L-05` | `AGENTS.md` y `compact-recovery.js` omiten exactamente los mismos cinco índices; agregar uno obliga a actualizar consumidores independientes y nada lo verifica | resuelto · el hook dejó de tener lista (la lee del disco) y el que sigue teniéndola tiene test |
| `INC-018` | S2 | `L-03` | Dos de tres servidores MCP usan `@latest`, incluido `@angular/cli@latest`, que `lib/config.js` prohíbe con tres párrafos | resuelto · `@angular/cli@{{ANGULAR_MAJOR}}`, sustituido por el scaffolder |
| `INC-019` | S3 | `L-05` | `CLAUDE-USER-GUIDE.md` dice que el linter valida 8 reglas; son 28 | resuelto · la frase se corrigió **y** la cifra dejó de escribirse a mano: un test la deriva de `RULES` y falla contra cualquier doc del payload que afirme otra |
| `HUE-029` | S3 | `L-04` | Los adapters no llevan ningún mecanismo y nada le dice al usuario que ahí las reglas son solo prosa | abierto |
| `ACO-013` | S2 | Lente 1 | 21 artefactos compartidos, 3 declarados. Y `templates-contract.md` vive en este repo, no en el payload: el proyecto generado no recibe ninguna declaración de sus propios contratos | resuelto · los **21** declarados en `contracts.js`, y `docs/CONTRATOS.md` —generado desde ahí, con test de sincronía— viaja al proyecto |
| `HUE-031` | S3 | Lente 2 | `pre-write-guard` capa 1 y `harness-gate` protegen superficies complementarias del harness sin criterio común; ninguno cubre `.claude/skills/` ni `.claude/agents/` | resuelto · `GATE-C1`: el frontmatter que reparte permisos (`tools:`, `hooks:`) no lo edita el agente. La garantía de que `code-judge` no tiene `Bash` la sostenía una línea que él mismo podía cambiar |
| `DEC-001` | **S1** | `C-02` | `spec-diff-check.js` lee el comando de `process.env.TOOL_INPUT` en vez de stdin — nunca bloquea ningún commit | resuelto · lee stdin vía `lib/payload.js` |
| `HUE-002` | **S1** | `C-01` | **(ampliado)** `CLAUDE_SESSION_ID` **no existe**: `sessionId` es siempre `'default'`. Demostrado que una lectura en un proyecto levanta el Discovery Gate de otro | resuelto · `lib/session.js`; los seis hooks migrados, `prompt-context` el último |
| `HUE-005` | **S1** | `C-05` | `blueprint.json` no se valida dentro del proyecto generado, y su `stack` crudo decide qué guardrails corren | resuelto · `lib/blueprint.js`, solo booleanos en claves conocidas |
| `ACO-001` | S2 | `C-02` | `sync-check` borra `session-writes.json` en cada `Stop` (que es por respuesta, no por sesión) | resuelto · la limpieza se mudó a `session-start` con origen `startup` |
| `HUE-001` | S2 | `C-01` | El Discovery Gate solo comprueba que el flag exista; leer `context/` lo levanta sin ningún índice | resuelto · el Gate exige una línea que nombre `indices/`; leer solo `context/` ya no lo levanta |
| `HUE-003` | S2 | `C-01` | `compact-recovery` conoce 10 de 15 índices; GUARDS, LAYOUTS, ROUTES, USAGE-MAP y UTILS nunca se re-inyectan | resuelto · la lista sale de `indices/` en el disco: 10 → 15, sin dejar de ser selectivo |
| `HUE-004` | S2 | `C-03` | `spec-reflection` calla cuando no hay ninguna casilla marcada — el caso exacto que debería atrapar | resuelto · lo que separa las dos situaciones son las escrituras de la sesión, no las casillas |
| `HUE-006` | S2 | `C-02` | El contrato con más consumidores (4) es el único de los cinco sin ningún test | resuelto · `task-spec.test.js`: las tres convenciones que atan al productor con sus cinco consumidores, con los consumidores corriendo de verdad |
| `INC-002` | S2 | `C-03` | `--max-age 60` + `--require-file` reportan "no existe ningún spec" cuando existe pero lleva >1h sin tocarse | resuelto · cuatro situaciones, cuatro mensajes; la estructura gana sobre la edad, y sin `--require-file` la edad sigue sin opinar |
| `INC-003` | S2 | `C-05` | `pre-write-guard.js` no figura como consumidor del blueprint en ninguna documentación | abierto |
| `DUP-001` | S3 | `C-04` | Dos fail modes para el mismo contrato: `indices-sync` avisa y sigue, `assignments-sync` lanza | resuelto · «nada que hacer» ≠ «algo roto» en los dos scripts, y el fallo de `sync` dejó de ser un stack trace |
| `ACO-002` | S3 | `C-03` | `spec-reflection-seen.json` no está declarado como artefacto | resuelto · declarado en `contracts.js` (lifetime `turno`, scope `hilo`) y publicado en `docs/CONTRATOS.md` |
| `ACO-003` | S3 | `C-04` | `indices-cache.json` decide qué se re-parsea y no está declarado como dependencia | resuelto · declarado — y al verificarlo apareció que su **ruta estaba mal**: el registro decía `scripts/` y se escribe en `.claude/temp/`. Ahora hay un test que contrasta cada `path` contra su productor |
| `HUE-007` | S3 | `C-04` | Nada impide editar dentro de los marcadores y perder el trabajo en el siguiente sync | resuelto · `GATE-D1`: la superficie se detecta por los marcadores **en disco**, no por una lista de rutas; el mensaje nombra el generador que corresponde |
| `HUE-008` | S3 | `C-04` | Ningún test fija la partición 13 auto-generados / 2 manuales | abierto |
| `INC-020` | **S1** | `diseño` | `SessionStart` no corre una vez por sesión: corre en `startup`, `resume`, `clear`, `compact` y `fork`, y el harness lo registra sin matcher | resuelto · matcher `startup\|resume\|clear\|fork` + `cleanup()` por antigüedad |
| `CAR-004` | S2 | `diseño` | Tras una compactación corren `session-start` **y** `compact-recovery`: 85% del output del primero es idéntico al del segundo | resuelto · 26.006 → 8.783 chars por compactación |
| `HUE-032` | **S1** | `diseño` | Los 18 hooks corren dentro de los 5 subagentes y ninguno lee `agent_id`: todo el estado de sesión es un pozo compartido entre el hilo principal y sus subagentes | resuelto · `threadScope()`; el estado de «lo ya dicho» es por hilo |
| `DEC-007` | S3 | `diseño` | Cuatro de las once extensiones exentas de `spec-gate` nunca disparan: `path.extname('.npmrc')` es `''`, y los dotfiles reales se llaman así enteros | resuelto · `lib/paths.js` compara también el basename |
| `DEC-008` | S2 | `diseño` | El detector de plantillas de `context-enrichment-guard` no dispara en un proyecto recién generado: `injectVars` borra el único marcador que buscaba | resuelto · `budget.sinLlenar` mide las tres formas de estar vacío; el motivo del opt-in pasó a ser cierto |
| `DUP-004` | S2 | `diseño` | `discovery-scout` levanta el Discovery Gate del hilo principal, que nunca vio un índice — y `session-start` recomienda esa ruta | resuelto · decidido y testeado: el descubrimiento delegado SÍ cuenta, y el flag registra quién descubrió (ADR-003 §2) |
| `DEC-009` | S2 | `diseño` | El provocador de reglas leía solo stdout: una regla que reporta con `reportWarning` no podía darse por probada nunca — el linter sale en 0 y su aviso va a stderr | resuelto · se leen las dos salidas; ARCH-11 pasó de muda a verde sin tocar la regla |
| `INC-021` | S3 | `diseño` | `writeBlueprintJson(targetDir, projectName, isFull, stack)` acepta `projectName` y no lo usa: el `name` del blueprint es una constante. Una firma que promete algo que la función ignora | abierto |
| `INC-022` | **S2** | `diseño` | La plantilla canónica de `ASSIGNMENTS.md` no traía **ningún** marcador `AUTO-GENERATED`, y `assignments-sync` se niega a escribir sin ellos: el único camino de escritura de la capa fallaba incluso en un proyecto que hubiera hecho todo bien | resuelto · marcadores en la plantilla + el error dice cómo arreglar un tablero viejo |
| `INC-023` | S2 | `S-01` | `ARCH-07` se llamaba «No @keyframes in app styles» y su mensaje decía «archivo de estilos», pero solo mira `src/app/**`. El blueprint reparte **siete** `@keyframes` en `src/styles/` que la lectura literal convertiría en violaciones | resuelto · el alcance era correcto y las palabras no: las tres puntas dicen «estilos de componente», como el hook siempre dijo |
| `HUE-033` | **S2** | `ejecución` | El trinquete de `CAR-003` estuvo **en rojo desde el commit siguiente al que lo fijó**, y no me enteré: la suite de `scripts/lib/` no entraba en la verificación de cada tanda. El mecanismo funcionó; el que no corría era yo | resuelto · el presupuesto vuelve a estar bajo el tope sin subirlo, y las cuatro suites entran en la verificación |

---

## INC-001 · El namespace ARCH está repartido en tres implementaciones (reescrito)

- **Tipo / severidad:** `INC` · S2 *(era S3; la premisa original era incorrecta)*
- **Unidad:** `S-01` (`architect.js`) y `H-04` (`pre-write-guard.js`)
- **Contexto:** B (harness)

> **Corrección.** La versión anterior de este hallazgo decía que faltaban los códigos
> ARCH-12, 13, 14 y 20 porque no aparecían en `architect.js`. Eso salió de grepear
> literales de string en un solo archivo, y era una conclusión equivocada: tres de los
> cuatro existen, en otros archivos. El hallazgo real es distinto y más interesante.

**Qué encontré**

El namespace de códigos no vive en un solo lugar. Está repartido en tres superficies:

| Superficie | Códigos | Mecanismo |
|---|---|---|
| `scripts/architect.js` | ARCH-01…11, 15…19, 21…26 · A11Y-03 · SEC-RLS-01/02/03 | AST de TypeScript |
| `scripts/lib/a11y-guardrails.js` | ARCH-20 | función pura importada por `architect.js` |
| `.claude/hooks/pre-write-guard.js` | ARCH-01, 02, 04, 05, 06, 07, 08, 12, 13, 27, 28 · A11Y-01/02 · LLM-01/02 · SQL-01 · SEC-ENV-01 · SEC-RLS-01/02/03 | regex, en tiempo de escritura. Registro: `.claude/hooks/lib/guard-rules.js` |

No hay ningún hueco de numeración: 12, 13 y 20 existen. **La excepción es `ARCH-14`**, que
`skills/verify/SKILL.md` documenta como si existiera —«Íconos sin registrar en
`provideIcons()` | ARCH-14 + `icon-registry.js`»— y que ningún archivo emite. Solo aparece
además en un comentario de `class-discipline.js` que lo menciona de pasada.

(`ARCH-99` aparece en `provocacion.test.mjs`, pero es un fixture de test, no una regla.)

**Por qué importa**

Tres consecuencias:

1. **Nadie puede contar las reglas.** Responder «¿cuántas reglas tiene el linter?» exige
   grepear tres archivos y saber que dos de las superficies no son el linter.
2. **Nada previene una colisión.** Si alguien agrega un `ARCH-27` en el hook y otro en el
   linter, no hay registro que lo impida.
3. **`ARCH-14` es una regla fantasma**: documentada, referenciada desde una skill que el
   agente lee, y sin ninguna implementación detrás. Un agente que la busque para cumplirla
   no encuentra nada.

**Evidencia**

```bash
grep -rhoE "(ARCH|A11Y|LLM|SEC-RLS)-[0-9]+" templates/boilerplate/scripts/   templates/.claude/hooks/ | sort -u -V
# → ARCH-01 … ARCH-26 continuo, + ARCH-99 (fixture), A11Y-01..03, LLM-01/02, SEC-RLS-01..03

grep -rn "ARCH-14" templates/ | grep -v auditoria
# → class-discipline.js:22  (comentario: "igual que ARCH-14")
# → skills/verify/SKILL.md:346  (tabla, como si existiera)
#   ningún reportError, ninguna implementación
```

**Propuesta**

Un registro único de códigos —un `.md` o un `.json` que enumere código, superficie que lo
emite y regla— y un test que lo compare contra los tres archivos. Resolver `ARCH-14`:
implementarla o sacarla de `verify/SKILL.md`.

**Estado:** abierto

---

## DEC-001 · `spec-diff-check.js` lee el comando de una variable de entorno que nadie setea

- **Tipo / severidad:** `DEC` · **S1**
- **Unidad:** `C-02` (session-writes) — confirmar en `H-08`
- **Contexto:** B (harness)

**Qué encontré**

`spec-diff-check.js` está cableado como `PreToolUse` sobre `Bash` para bloquear el
`git commit` cuando hay componentes o facades sin registrar en sus índices. Obtiene el
comando así:

```js
const toolInput = process.env.TOOL_INPUT || '{}';
let cmd = '';
try { cmd = JSON.parse(toolInput).command || ''; } catch { /* ignore */ }
if (!cmd.includes('git') || !cmd.includes('commit')) process.exit(0);
```

Claude Code entrega el payload del hook por **stdin**, no por una variable `TOOL_INPUT`.
Los otros 17 hooks del harness leen stdin; este es el único que no. Sin esa variable,
`cmd` queda vacío, la condición se cumple y el hook hace `exit 0` antes de mirar nada.

**Por qué importa**

Es el guardrail que `.claude/CLAUDE.md` promete para el commit y no ha bloqueado nunca un
commit en ningún proyecto generado. Es el arquetipo exacto de lo que
`docs/CHEQUEOS-QUE-NO-CHEQUEAN.md` describe: un chequeo verde que no puede salir rojo.

Lo llamativo es que **la lógica de detección es correcta**: alimentado por la vía que él
espera, encuentra el componente sin registrar y bloquea con un mensaje útil. No hay que
reescribirlo, solo hay que darle el input por donde llega.

**Evidencia**

Sandbox con `session-writes.json` conteniendo un componente nuevo y un `COMPONENTS.md`
que no lo registra:

```bash
# A — como lo invoca Claude Code de verdad (stdin)
echo '{"tool_name":"Bash","tool_input":{"command":"git commit -m x"}}' \
  | node .claude/hooks/spec-diff-check.js
# → exit 0   (no bloquea)

# B — con la env var que el hook realmente lee
TOOL_INPUT='{"command":"git commit -m x"}' node .claude/hooks/spec-diff-check.js </dev/null
# → exit 2   📋 SPEC-DIFF-CHECK: <app-kpi-card> no está en indices/COMPONENTS.md

# C — contraste: bash-guard, mismo matcher, sí lee stdin
echo '{"tool_name":"Bash","tool_input":{"command":"cat > src/app/x.component.ts <<EOF"}}' \
  | node .claude/hooks/bash-guard.js
# → exit 2   🚫 BASH GUARD

# Es el único hook que usa env vars
grep -ln "process.env.TOOL_INPUT" templates/.claude/hooks/**/*.js
# → spec-diff-check.js
```

No existe `spec-diff-check.test.js`. Un test que le pasara el payload por stdin —como
hacen los otros ocho tests del harness— habría encontrado esto el primer día.

**Propuesta**

Leer el payload de stdin como el resto de los hooks, y escribir el test que faltaba. El
`ACO-001` de esta misma unidad hay que resolverlo a la vez: aunque se arregle la entrada,
el tracker ya está borrado en los turnos posteriores al primero.

**Estado:** abierto

---

## HUE-002 · La identidad de sesión sale de una env var, con fallback global

- **Tipo / severidad:** `HUE` · **S1**
- **Unidad:** `C-01` (discovery flag) — afecta también a `koa-breaker-*` y `koa-ctx-*`
- **Contexto:** B (harness)

**Qué encontré**

Cinco hooks derivan la identidad de sesión igual:

```js
const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
```

`pre-write-guard.js`, `prompt-context.js`, `compact-recovery.js`, `session-start.js` y
`discovery-tracker.js`. **Ningún hook lee `session_id` del payload de stdin**, donde
Claude Code lo entrega junto al resto de la información del tool.

Con ese fallback, todos los proyectos de la máquina comparten
`$TMPDIR/koa-discovery-default.flag` — y también `koa-breaker-default.json` (circuit
breaker) y los flags `koa-ctx-*-default.flag` (dedup de inyección de contexto).

**Por qué importa**

Tres consecuencias, todas silenciosas:

1. **Fuga entre proyectos.** Leer un índice en el proyecto A levanta el Discovery Gate del
   proyecto B, que nunca leyó nada.
2. **Fuga entre sesiones.** Nadie borra el flag: la segunda sesión del día en la misma
   máquina arranca con el Gate ya levantado.
3. **Circuit breaker y dedup contaminados.** El contador de bloqueos y los flags de
   "esta categoría ya se inyectó" se comparten entre proyectos y sesiones.

**Evidencia**

```bash
export TMPDIR=$SB/tmp ; unset CLAUDE_SESSION_ID

cd proyA && echo '{"tool_input":{"file_path":"context/domain.md"}}' \
  | node .claude/hooks/discovery-tracker.js
cat $TMPDIR/koa-discovery-default.flag
# → 2026-08-29T22:50:15.860Z | READ | context/domain.md

cd ../proyB   # nunca leyó nada
echo '{"tool_input":{"file_path":"src/app/features/y.component.ts","content":"y"}}' \
  | node .claude/hooks/pre-write-guard.js
# → exit 0   (pasa, heredando el flag de proyA)

grep -rn "unlinkSync" templates/.claude/hooks/*.js
# → solo spec-reflection.js y sync-check.js, para OTROS artefactos.
#   Nadie borra el discovery flag.
```

**Propuesta**

Tomar `session_id` del payload de stdin, con la env var como respaldo y un tercer nivel
derivado de `process.cwd()` (un hash de la ruta del proyecto) antes de caer en `'default'`.
Es una corrección única que toca cinco archivos: candidata a helper compartido.

**Estado:** abierto

---

## HUE-005 · El blueprint decide qué guardrails corren, y nadie lo valida donde se lee

- **Tipo / severidad:** `HUE` · **S1**
- **Unidad:** `C-05` (blueprint.json)
- **Contexto:** A y B — el contrato cruza los dos

**Qué encontré**

`lib/config.js` define `BLUEPRINT_SCHEMA` y `validateBlueprintJson()`, con validación de
tipos por campo. Un `grep` sobre todo el repositorio muestra que esa función solo se
invoca desde `lib/preflight.js`, es decir **cuando alguien corre el CLI**.

En el proyecto generado, el consumidor real es `pre-write-guard.js`:

```js
let STACK = { angular: true, tailwind: true, primeng: true, gsap: false, supabase: true };
try {
  const bp = JSON.parse(fs.readFileSync(bpPath, 'utf8'));
  if (bp.stack && typeof bp.stack === 'object') STACK = { ...STACK, ...bp.stack };
} catch { /* fail-open */ }
```

`JSON.parse` crudo, spread sin validar tipos. `STACK.supabase` y `STACK.gsap` gobiernan
seis puntos del guard: si una violación se reporta, y qué consejo se inyecta.

**Por qué importa**

El schema vive en el contexto A y protege una lectura que ocurre en el contexto B, donde
no corre nunca. Un `blueprint.json` editado a mano —o producido por Wikiflow con un tipo
distinto— cambia qué guardrails se aplican, sin ningún aviso.

`pre-write-guard.js` tampoco figura como consumidor del contrato en ninguna documentación
(ver `INC-003`), así que quien edite el blueprint no tiene forma de saber que está tocando
la configuración del linter en vivo.

**Evidencia**

Misma escritura (un componente que importa Supabase directamente, violación ARCH-01),
variando solo el blueprint:

```
{"stack":{"supabase":true}}     → exit 2  🚨 ARCHITECT GUARD          ✔
{"stack":{"supabase":false}}    → exit 0  (correcto)                  ✔
{"stack":{"supabase":"false"}}  → exit 2  🚨 ARCHITECT GUARD          ✘ el string es truthy
{"stack":{"supabse":false}}     → exit 2  (typo ignorado, queda true) ✘

grep -rn "validateBlueprintJson" lib/ bin/ templates/
# → lib/config.js (definición), lib/preflight.js (uso), lib/scaffolder.js (comentario)
#   Ninguna referencia en templates/ — nunca corre en el proyecto generado.
```

**Propuesta**

Validar el `stack` en el punto de lectura del harness: coerción explícita a booleano y
descarte de claves desconocidas, con un aviso cuando el blueprint traiga algo que no se
entiende. Como principio general para la Lente 1: *un schema tiene que vivir donde se lee,
no donde se escribe.*

**Estado:** abierto

---

## ACO-001 · El tracker de sesión se borra en cada respuesta, no en cada sesión

- **Tipo / severidad:** `ACO` · S2
- **Unidad:** `C-02` (session-writes)
- **Contexto:** B (harness)

**Qué encontré**

`sync-check.js` termina con `fs.unlinkSync(trackerPath)` **incondicional**, comentado como
*«Limpiar tracker para la próxima sesión»*. Pero el hook `Stop` corre al final de **cada
respuesta del agente**, no al final de la sesión. El propio `spec-reflection.js` lo
asume: tiene lógica anti-bucle precisamente porque se ejecuta varias veces por sesión.

**Por qué importa**

A partir del primer turno, `session-writes.json` solo contiene lo escrito en el turno
actual. Los consumidores que corren después auditan una lista vacía y pasan en verde:

- `spec-diff-check.js` — un `git commit` en un turno posterior al de la escritura no tiene
  nada que auditar (agrava `DEC-001`: aunque se arregle la entrada, seguiría sin datos).
- El bloque de evidencia de `spec-reflection.js` se degrada en silencio.
- El subagente `index-syncer` recibe una lista incompleta de qué reconciliar.

**Evidencia**

```bash
printf '["src/app/features/a.component.ts"]' > .claude/temp/session-writes.json
touch indices/COMPONENTS.md          # índice más nuevo → nada que reportar
node .claude/hooks/sync-check.js     # → exit 0
test -f .claude/temp/session-writes.json || echo "borrado"
# → borrado (aun sin haber reportado nada)
```

**Propuesta**

No borrar en `Stop`. Si hace falta acotar el crecimiento, rotar por antigüedad o limpiar
en `SessionStart`, que sí ocurre una vez por sesión.

**Estado:** abierto

---

## HUE-001 · El Discovery Gate comprueba que el flag exista, no que se hayan leído índices

- **Tipo / severidad:** `HUE` · S2
- **Unidad:** `C-01` (discovery flag)
- **Contexto:** B (harness)

**Qué encontré**

`discovery-tracker.js` escribe el flag ante `indices/` **o** `context/`:

```js
if (filePath.includes('indices/') || filePath.includes('context/')) { … appendFileSync … }
```

Y el Gate solo comprueba existencia, sin abrir el archivo:

```js
const flagPath = path.join(os.tmpdir(), `koa-discovery-${sessionId}.flag`);
if (!fs.existsSync(flagPath)) { … process.exit(2); }
```

**Por qué importa**

El mensaje del propio Gate afirma: *«El bloqueo se levantará automáticamente cuando leas
cualquier archivo de indices/»*, y `.claude/CLAUDE.md` promete que no se puede escribir
código sin los índices en contexto. Leer `context/brief.md` —que el agente hace de rutina—
levanta el Gate sin haber mirado un solo índice.

Puede ser deliberado (leer el dominio también es descubrimiento), pero entonces la
documentación y el mensaje están mal. Hoy no hay forma de saber cuál de las dos cosas se
quiso.

**Evidencia**

```bash
# Gate antes de leer nada
… | node .claude/hooks/pre-write-guard.js   # → exit 2 ✔

# Leer SOLO context/domain.md
echo '{"tool_input":{"file_path":"context/domain.md"}}' | node .claude/hooks/discovery-tracker.js

# Gate después
… | node .claude/hooks/pre-write-guard.js   # → exit 0 ✘
```

**Propuesta**

Decidir la intención y alinear las tres puntas. Si el Gate exige índices, leer el
contenido del flag y buscar al menos una línea `indices/`. Si `context/` cuenta, corregir
el mensaje y la documentación.

**Estado:** abierto

---

## HUE-003 · `compact-recovery` conoce 10 de los 15 índices

- **Tipo / severidad:** `HUE` · S2
- **Unidad:** `C-01` (discovery flag) — confirmar en `H-13`
- **Contexto:** B (harness)

**Qué encontré**

`ALL_INDEX_FILES` en `compact-recovery.js` lista diez índices. El template trae quince.
Faltan `GUARDS`, `LAYOUTS`, `ROUTES`, `USAGE-MAP` y `UTILS`.

**Por qué importa**

Aunque el flag registre que el agente leyó `indices/ROUTES.md` antes de la compactación,
ese índice no se re-inyecta nunca: el agente lo pierde y no se entera. `LAYOUTS.md` es el
caso más visible, porque el propio Discovery Gate lo ofrece en su lista de archivos que
levantan el bloqueo.

**Evidencia**

```
índices en templates/indices/:                15
en ALL_INDEX_FILES de compact-recovery:       10
no re-inyectables: GUARDS, LAYOUTS, ROUTES, USAGE-MAP, UTILS
```

**Propuesta**

Derivar la lista del contenido de `indices/` en vez de mantenerla a mano, que es lo que
garantiza que vuelva a desincronizarse. Cubrirlo con un test que compare ambas listas.

**Resolución** — se hizo exactamente eso, y se cerró junto con `HUE-030`, que es el mismo
mapa visto desde el otro consumidor.

`ALL_INDEX_FILES` ya no existe. `indicesEnDisco(raiz)` hace `readdirSync('indices/')`: no
hay lista que actualizar, así que no hay lista que pueda quedarse atrás. Los tres `CORE`
siguen escritos a mano porque **sí** son una decisión —se inyectan aunque nadie los haya
abierto—, no un mapa.

Medido, con un proyecto de 15 índices y un flag que dice que se leyeron los 15:

```
antes:    10 índices re-inyectados
después:  15
la diferencia: GUARDS, LAYOUTS, ROUTES, USAGE-MAP, UTILS  ← los cinco del hallazgo
```

La corrección **no** se convirtió en «inyectar todo»: la selectividad es lo que `CAR-004`
acaba de comprar. Un test lo fija — leído `ROUTES`, vuelven `ROUTES` y los tres CORE, y
`USAGE-MAP` no vuelve.

`AGENTS.md` no puede derivar nada —es prosa para otras AI tools—, así que lista los quince
y un test compara esa lista contra `templates/indices/`. Y una comprobación inversa falla
si alguien vuelve a escribir un mapa literal en el hook: `contracts.js` conserva la lista
canónica de 15 y `CONSUMIDORES_DE_INDICES` quedó con un solo nombre, el que mantiene la
lista a mano.

Provocado: con el hook y el `AGENTS.md` de antes, **7 tests en rojo**.

**Estado:** resuelto · la lista sale del filesystem; 10 → 15 índices re-inyectables

---

## HUE-004 · `spec-reflection` calla cuando no hay ninguna casilla marcada

- **Tipo / severidad:** `HUE` · S2
- **Unidad:** `C-03` (task-spec)
- **Contexto:** B (harness)

**Qué encontré**

```js
if (open.length === 0 || done === 0) { … bail(); }
```

El comentario lo justifica: *«sin casillas marcadas nunca → el agente no adoptó el flujo
del task-spec»*.

**Por qué importa**

El hook guarda silencio exactamente en el caso que existe para atrapar: un agente que
declaró un criterio de done y no cumplió nada. Basta con no marcar ninguna casilla para
que la Reflection nunca hable — y no marcar casillas es justamente lo que hace un agente
que no está siguiendo el plan.

**Evidencia**

```bash
# spec con 2 casillas abiertas, ninguna marcada
node .claude/hooks/spec-reflection.js   # → exit 0 (silencio)

# el mismo spec con UNA marcada
sed -i 's/- \[ \] a/- [x] a/' "$SPEC"
node .claude/hooks/spec-reflection.js   # → exit 2 "1 punto(s) sin cerrar"
```

**Propuesta**

Distinguir los dos casos en vez de callarlos juntos. Con `done === 0` y casillas abiertas,
el mensaje correcto no es la lista de pendientes sino una pregunta: *«creaste un task-spec
y no marcaste nada — ¿lo estás siguiendo?»*.

**Estado:** abierto

---

## HUE-006 · El contrato con más consumidores no tiene ningún test

- **Tipo / severidad:** `HUE` · S2
- **Unidad:** `C-02` (session-writes)
- **Contexto:** B (harness)

**Qué encontré**

`session-writes.json` tiene cuatro consumidores (`sync-check`, `spec-reflection`,
`spec-diff-check`, `index-syncer`) y ninguna de las piezas que lo producen o lo consumen
directamente tiene archivo de test: no existen `write-tracker.test.js`,
`sync-check.test.js` ni `spec-diff-check.test.js`.

**Por qué importa**

Los dos hallazgos `S1`/`S2` más graves del bloque 0 (`DEC-001` y `ACO-001`) están los dos
en esta unidad. La correlación con `C-03` —cuatro tests, ningún hallazgo grave— es
directa: donde hay cobertura, el contrato se sostiene.

**Evidencia**

```bash
ls templates/.claude/tests/ | grep -E "write-tracker|sync-check|spec-diff"
# → (vacío)
```

**Propuesta**

Es la entrada más rentable del backlog de tests que salga de la Lente 3.

**Resolución** — primero hay que corregir el hallazgo: la premisa ya no se sostiene.
`write-tracker.test.js`, `sync-check.test.js` y `spec-diff-check.test.js` existen desde que
se cerró `DEC-001`, así que `session-writes.json` dejó de ser el contrato descubierto. El
que quedaba sin nada es el **task-spec**, con **cinco** consumidores — y `contracts.js` ya
lo decía en su nota, apuntando a este mismo `HUE-006`.

El detalle que importa: los cinco consumidores tienen su propio archivo de test. Lo que no
tenía ninguno era **lo que los ata**, que es exactamente donde esto se rompe: tres
convenciones que comparten sin que ningún `import` las obligue a estar de acuerdo.

`task-spec.test.js` prueba las tres:

1. **Los encabezados.** Los `--contains` del hook declarado en el frontmatter de `/plan` se
   extraen del archivo y se contrastan contra la plantilla que esa misma skill reparte.
   Renombrar una sección en un lado deja al otro rechazando el archivo que él mismo genera.
2. **El nombre.** Con `task-spec-YYYYMMDD-HHMMSS.md`, orden alfabético y cronológico
   coinciden. El test fija también el modo de fallo: con un formato humano, `1-2-2026` es
   posterior en el calendario y anterior alfabéticamente, y los hooks tomarían el spec
   viejo como activo sin ningún error.
3. **Las casillas.** `compact-recovery`, `prompt-context` y `session-start` **se ejecutan de
   verdad** contra un spec armado desde la plantilla: los tres tienen que ver lo pendiente,
   descartar lo hecho, y coincidir en cuál spec está activo. Un desacuerdo ahí es
   silencioso — cada uno trabajaría sobre un spec distinto.

Más el validador contra lo que `/plan` produce: acepta el spec completo, rechaza el que
perdió una sección (y dice cuál), rechaza que no haya ninguno.

Provocado: renombrando una sección en la plantilla y desactivando el filtro de casillas de
un consumidor, un test cae en cada caso.

**Estado:** resuelto · `task-spec.test.js`, 13 tests

---

## INC-002 · `--max-age 60` convierte "el spec está viejo" en "no existe ningún spec"

- **Tipo / severidad:** `INC` · S2
- **Unidad:** `C-03` (task-spec) — confirmar en `H-19`
- **Contexto:** B (harness)

**Qué encontré**

El frontmatter de `/plan` declara su validador con `--max-age 60 --require-file`. Con un
spec que existe y está completo pero lleva más de una hora sin modificarse, el validador
falla con: *«no se encontró ningún archivo task-spec-*.md en .claude/temp/ modificado en
los últimos 60 min. Créalo antes de terminar.»*

**Por qué importa**

En cualquier sesión de más de una hora en la que el spec no se edite, el agente recibe la
orden de crear un spec que ya existe. Si obedece, el duplicado pasa a ser "el más reciente
por orden alfabético" para los otros cuatro consumidores del contrato, y el original queda
huérfano.

**Evidencia**

```bash
node …/validate-file-contains.js --directory .claude/temp --pattern "task-spec-*.md" \
  --max-age 60 --require-file --contains "## Objetivo"
# spec recién escrito       → exit 0
touch -d '2 hours ago' "$SPEC"
# mismo spec, 2 h de antigüedad → exit 2, "no se encontró ningún archivo… Créalo"
```

**Propuesta**

Separar los dos mensajes: "no existe ningún spec" y "el spec existe pero es viejo" no son
la misma situación y no piden la misma acción. Revisar si 60 minutos es el umbral correcto
para una sesión de trabajo real.

**Estado:** abierto

---

## INC-003 · `pre-write-guard` no figura como consumidor del blueprint

- **Tipo / severidad:** `INC` · S2
- **Unidad:** `C-05` (blueprint.json)
- **Contexto:** B (harness)

**Qué encontré**

`.claude/rules/templates-contract.md` no lista `blueprint.json` entre los contratos
compartidos entre hooks. `lib/config.js` documenta dos productores (CLI y Wikiflow) pero
ningún consumidor del lado del harness. `managedPaths` tampoco lo incluye.

**Por qué importa**

Es la razón por la que `HUE-005` pasó desapercibido: nadie que edite el blueprint sabe que
está tocando la configuración del Architect Guard en vivo.

**Evidencia**

```bash
grep -n "blueprint" templates/.claude/rules/templates-contract.md   # → sin resultados
grep -n "blueprint.json" templates/.claude/hooks/pre-write-guard.js  # → sí, lo lee
```

**Propuesta**

Agregar `blueprint.json` a la tabla de contratos de `templates-contract.md`, nombrando a
`pre-write-guard.js` como consumidor y advirtiendo qué se rompe al editarlo.

**Estado:** abierto

---

## DUP-001 · Dos fail modes para el mismo contrato de marcadores

- **Tipo / severidad:** `DUP` · S3
- **Unidad:** `C-04` (marcadores auto-generados)
- **Contexto:** B (harness)

**Qué encontré**

```js
// indices-sync.js:1091
console.warn(yellow(`  ⚠  Sin marcadores en ${basename} — agrega los marcadores AUTO-GENERATED`));
// assignments-sync.js:86
throw new Error(`No se encontraron marcadores AUTO-GENERATED para "${sectionHeader}"`);
```

**Por qué importa**

El mismo contrato roto produce un warning amarillo en un script y una excepción en el
otro. Ninguna de las dos elecciones está justificada. La versión que avisa y sigue deja
índices congelados sin que ningún gate lo note.

**Propuesta**

Elegir una y aplicarla en ambos. Dado que un índice congelado es peor que un fallo
ruidoso, el `throw` parece la opción correcta.

**Estado:** abierto

---

## ACO-002 · `spec-reflection-seen.json` no está declarado

- **Tipo / severidad:** `ACO` · S3
- **Unidad:** `C-03` (task-spec)
- **Contexto:** B (harness)

**Qué encontré**

`spec-reflection.js` crea, lee y borra `.claude/temp/spec-reflection-seen.json` para su
memoria anti-bucle. No figura en `templates-contract.md`.

**Por qué importa**

Determina si el aviso de Reflection sale o no. Un archivo huérfano de una sesión anterior
puede silenciar el hook. Es un contrato de una pieza consigo misma, pero sigue siendo
estado persistente sin dueño declarado.

**Propuesta**

Declararlo junto al resto de los artefactos derivados que salgan de la Lente 1.

**Estado:** abierto

---

## ACO-003 · `indices-cache.json` no está declarado como dependencia

- **Tipo / severidad:** `ACO` · S3
- **Unidad:** `C-04` (marcadores auto-generados)
- **Contexto:** B (harness)

**Qué encontré**

`indices-sync.js` mantiene una caché incremental por `mtime` en
`.claude/temp/indices-cache.json` que decide qué archivos se re-parsean.

**Por qué importa**

Si la caché queda desfasada o corrupta, el índice se regenera incompleto sin ningún aviso
— y `sync-check` lo dará por actualizado porque solo mira `mtime`.

**Propuesta**

Declararlo, y verificar en la ficha `S-03` qué pasa exactamente con una caché corrupta.

**Estado:** abierto

---

## HUE-007 · Nada impide editar dentro de los marcadores

- **Tipo / severidad:** `HUE` · S3
- **Unidad:** `C-04` (marcadores auto-generados)
- **Contexto:** B (harness)

**Qué encontré**

Un agente que edita `indices/COMPONENTS.md` a mano dentro de la región
`AUTO-GENERATED` pierde su trabajo en el siguiente `indices:sync`, en silencio.
`harness-gate.js` vigila `indices/ANTI-PATTERNS.md`, que es justamente uno de los dos
índices **sin** marcadores.

**Por qué importa**

Es una regla real del harness que hoy solo existe como prosa. El repo tiene la costumbre
opuesta —convertir guidelines en guardrails— y este caso quedó del lado de la guideline.

**Propuesta**

Extender `harness-gate.js` o `pre-write-guard.js` para bloquear escrituras cuyo contenido
caiga dentro de los marcadores de un índice auto-generado.

**Estado:** abierto

---

## HUE-008 · Ningún test fija la partición 13 auto-generados / 2 manuales

- **Tipo / severidad:** `HUE` · S3
- **Unidad:** `C-04` (marcadores auto-generados)
- **Contexto:** B (harness)

**Qué encontré**

La partición es hoy exacta y coincide con `TEMPLATES-REGISTRY.md`, pero nada la fija. Un
índice nuevo sin marcadores, o uno manual al que alguien se los agregue, pasa sin ruido.

**Propuesta**

Test de tres líneas: todo índice sin `AUTO-GENERATED:BEGIN` tiene que estar en la lista de
manuales. Convierte una coincidencia afortunada en un invariante.

**Estado:** abierto

## CAR-001 · `plan-injector` inyecta ~6.155 tokens en cada Edit, sin ningún control de costo

- **Tipo / severidad:** `CAR` · **S1**
- **Unidad:** `H-06`
- **Contexto:** B (harness)

**Qué encontré**

`sdd/plan-injector.js` inyecta `spec.md` + `plan.md` + `tasks.md` como `additionalContext`
en cada `Edit`/`Write` sobre código de producto, con `MAX_SECTION_CHARS = 8000` por sección
y **sin techo agregado**. No tiene estado, ni caché, ni dedup: `grep -c "tmpdir|STATE|seen|cache"`
sobre el archivo devuelve 0.

**Por qué importa**

Medido en sandbox con tres artefactos de tamaño realista: **24.622 caracteres, ~6.155
tokens estimados, en una sola edición**. Diez ediciones en una sesión son ~61.000 tokens
del mismo contrato repetido palabra por palabra.

Lo decisivo es que la misma casa ya resolvió este problema tres veces y este hook no aplicó
ninguna solución:

| Pieza | Control de costo |
|---|---|
| `prompt-context.js` | dedup por contenido + `REPEAT_EVERY = 8` |
| `pre-write-guard.js` capa 4 | flag de dedup por categoría y sesión |
| `session-start.js` | tope de 2.500 chars + corte en `DETAIL:BEGIN` |
| **`plan-injector.js`** | **ninguno** |

Es `S1` y no `S2` porque un harness que agota la ventana de contexto fuerza compactaciones,
y cada compactación dispara `compact-recovery` — que re-inyecta más contexto. El costo no
es lineal.

**Evidencia**

```bash
echo "0001-x" > specs/.active   # spec.md, plan.md y tasks.md > 8000 chars cada uno
echo '{"tool_input":{"file_path":"src/app/features/x.component.ts","content":"x"}}' \
  | node .claude/hooks/sdd/plan-injector.js
# → caracteres inyectados: 24.622   (~6.155 tokens)
# → truncados a 8000: 3 de 3 secciones

grep -c "tmpdir\|STATE\|seen\|cache" templates/.claude/hooks/sdd/plan-injector.js
# → 0
```

**Propuesta**

Aplicar el patrón que ya usa `pre-write-guard` capa 4: un flag de dedup por track y sesión,
inyectando completo la primera vez y solo el delta de `tasks.md` después. Y un techo
agregado, no solo por sección.

**Estado:** abierto

---

## DEC-002 · El Generalization Gate se satisface con la palabra «cuando»

- **Tipo / severidad:** `DEC` · S2
- **Unidad:** `H-05` (`harness-gate.js`)
- **Contexto:** B (harness)

**Qué encontré**

`GATE-A1` bloquea cuando el contenido cita un track ID **y no contiene** un marcador de
generalización. El marcador se define como:

```js
/\b(cuando|siempre que|nunca|cada vez que|toda vez que|regla:|criterio|aplicabilidad|
   aplica cuando|no aplica|excepci[oó]n|independientemente de)\b/i
```

`cuando` y `nunca` son dos de las palabras más frecuentes de la prosa técnica en español.
El gate se satisface con que aparezcan en **cualquier** lugar del texto, sin ninguna
relación con el criterio de aplicabilidad que dice exigir.

**Por qué importa**

**12 de las 15 reglas reales del template ya contienen un marcador** sin habérselo
propuesto. El gate filtra solo el caso patológico puro —una receta escrita en telegrama— y
deja pasar cualquier receta redactada en español normal.

El daño no es que no filtre: es que su documentación promete un filtro fuerte, y eso induce
a confiar en que la memoria del harness está curada cuando no lo está.

**Evidencia**

```
A · "En fix-042 el boton no andaba. Le puse un margin-top de 4px."
    → exit 2  🧭 HARNESS GATE                      ✔ atrapa

B · "En fix-042 el boton no andaba cuando lo probamos. Le puse un margin-top de 4px."
    → exit 0                                        ✘ la misma receta pasa

12 de 15 reglas del template ya contienen un marcador de generalización
```

**Propuesta**

El problema es de fondo: un marcador léxico no puede distinguir un principio de una receta.
Dos caminos posibles — exigir que el marcador esté en la **misma frase** que el track ID
(más estricto, todavía evadible), o aceptar que este chequeo es heurístico y bajar el tono
de lo que promete. Lo que no puede quedar es la brecha entre ambas cosas.

**Resolución** — los dos caminos, porque no eran alternativos.

Al implementarlo apareció algo peor que el falso negativo suelto que el hallazgo describe.
El chequeo corría sobre el **texto entero del archivo**, y el archivo que vigila —
`context/learnings.md` — es el que **crece**. Una sola lección bien escrita arriba absolvía
a todas las recetas agregadas después, para siempre:

```
"## Cache
 Cuando una query se repite en dos facades, extraela a un repository.

 En fix-042 el boton no andaba. Le puse un margin-top de 4px."   ← receta pura

antes:    exit 0     el «Cuando» de la lección de arriba la cubría
después:  exit 2     y el mensaje cita el párrafo culpable
```

El gate no era débil: **se apagaba solo**, y el disparador era usarlo bien una vez.

La unidad de evaluación pasó a ser el **párrafo** (línea en blanco, ítem de lista o
encabezado abren uno nuevo): el criterio tiene que estar donde está el track. Una línea
suelta sería demasiado poco —una lección bien escrita ocupa dos o tres— y el archivo entero
era el bug. En una lista, cada viñeta se juzga sola.

Y el tono bajó donde correspondía: el mensaje ahora dice que es un chequeo léxico y que
busca el criterio *junto al track*, en vez de prometer un juicio que un regex no puede dar.

Verificado que no rompe lo que el blueprint reparte: las **16 reglas** del template, los dos
`CLAUDE.md`, `ANTI-PATTERNS.md` y `learnings.md` siguen pasando — hay un test que lo fija,
porque un gate más estricto que rechaza el contenido de su propia casa no es más estricto,
está roto.

Provocado: con el gate anterior, 3 tests en rojo.

**Estado:** resuelto · el criterio se busca en el párrafo del track, no en el archivo entero

---

## INC-005 · `spec-gate` y `plan-injector` clasifican el mismo archivo distinto

- **Tipo / severidad:** `INC` · S2
- **Unidad:** `H-03` / `H-06`
- **Contexto:** B (harness)

**Qué encontré**

Los dos hooks corren sobre el mismo matcher y comparten un bloque `isProductCode` **idéntico
carácter por carácter**. Lo que diverge son las listas de exención que corren antes:

| Categoría | Exime `spec-gate` pero **no** `plan-injector` |
|---|---|
| Prefijos | `supabase/seed`, `tests/`, `.next/`, `.angular/` |
| Extensiones | `.mdx`, `.gitignore`, `.npmrc`, `.env`, `.editorconfig` |
| Otros | `*.spec.ts`, `*.spec.js`, `*.test.{ts,js,tsx,jsx}`, `Dockerfile`, `Makefile`, `LICENSE`, `README` |

**Por qué importa**

El primer hook de la cadena declara «esto no es código de producto» y el cuarto le inyecta
el contrato completo igual. Al editar `src/app/features/x.spec.ts`: `spec-gate` sale en 0 y
`plan-injector` inyecta 24.622 caracteres. Multiplica `CAR-001` sobre toda la superficie de
tests, que es donde más ediciones hay en un flujo TDD.

**Evidencia**

```bash
'{"tool_input":{"file_path":"src/app/features/x.spec.ts","content":"x"}}'
  → spec-gate      exit 0  (exento)
  → plan-injector  SI — 24.622 caracteres
```

**Propuesta**

Extraer la clasificación a un módulo compartido en `sdd/`. Es copia-pega divergente, no un
desacuerdo de diseño: nadie decidió que un `.spec.ts` mereciera el contrato completo.

**Estado:** abierto

---

## HUE-010 · Los hooks de `sdd/` leen stdin sin el cap SEC-04

- **Tipo / severidad:** `HUE` · S2
- **Unidad:** `H-03` / `H-06`
- **Contexto:** B (harness)

**Qué encontré**

`MAX_STDIN_BYTES = 10 MB` se aplicó a los hooks de la raíz de `hooks/`. Los que leen stdin
**sin** el cap son exactamente los cuatro que quedaron fuera de esa pasada:
`sdd/spec-gate.js`, `sdd/plan-injector.js`, `sdd/hotfix-autoclose.js` y
`context-enrichment-guard.js`.

**Por qué importa**

Es una regresión de alcance, no una decisión: SEC-04 se aplicó por directorio y el
subdirectorio `sdd/` quedó afuera. Los tres hooks de SDD acumulan `data += chunk` sin
límite.

**Evidencia**

```bash
for f in templates/.claude/hooks/*.js templates/.claude/hooks/sdd/*.js; do
  grep -q "process.stdin" "$f" && ! grep -q "MAX_STDIN_BYTES" "$f" && basename "$f"
done
# → context-enrichment-guard.js, hotfix-autoclose.js, plan-injector.js, spec-gate.js
```

**Propuesta**

Aplicar el mismo cap. Es el ejemplo de por qué un chequeo de seguridad necesita un test que
lo verifique en **todos** los archivos, no una pasada manual.

**Estado:** abierto

---

## HUE-011 · Cero tests en todo `sdd/`

- **Tipo / severidad:** `HUE` · S2
- **Unidad:** `H-03` / `H-06` / `H-14`
- **Contexto:** B (harness)

**Qué encontré**

Los tres hooks del motor SDD —`spec-gate.js` (176 líneas, ocho ramas de decisión),
`plan-injector.js` (121) y `hotfix-autoclose.js` (65)— no tienen ningún archivo de test.

**Por qué importa**

`spec-gate` es un hook **que bloquea**, con lógica de rutas legacy (`fixes/hotfixes/` vs
`hotfixes/`) — exactamente el tipo de cosa que se rompe en una migración sin que nadie se
entere. Los dos hallazgos de esta ronda sobre `sdd/` (`INC-005`, `HUE-010`) los habría
encontrado cualquier suite mínima.

**Evidencia**

```bash
ls templates/.claude/tests/ | grep -E "spec-gate|plan-injector|hotfix"
# → (vacío)
```

**Propuesta**

Es la segunda entrada más rentable del backlog de tests, después de `HUE-006`.

**Estado:** abierto

---

## HUE-012 · Las reglas regex de `pre-write-guard` no están provocadas

- **Tipo / severidad:** `HUE` · S2
- **Unidad:** `H-04`
- **Contexto:** B (harness)

**Qué encontré**

`provocar-reglas.mjs` existe para responder «¿esta regla puede fallar?» y cubre las reglas
de `architect.js`. Las ~20 reglas regex de la capa 3 de `pre-write-guard.js` —`*ngIf`,
`@Input()`, colores hardcodeados, ARCH-12, ARCH-13, A11Y-01, A11Y-02, LLM-01, LLM-02— no
tienen ningún equivalente de provocación.

**Por qué importa**

Es la pregunta central del repo aplicada al revés. El linter AST corre cuando alguien
ejecuta `npm run lint:arch`; el guard regex corre **en cada escritura**. La mitad del
sistema de reglas que más veces se ejecuta es la que nadie provoca.

`pre-write-guard.test.js` existe y cubre algunas reglas, pero testear no es provocar:
comprueba que el guard bloquea lo que debe, no que cada regla individual siga viva.

**Propuesta**

Extender `provocar-reglas.mjs` con fixtures que se pasen al hook por stdin, o crear su
equivalente. Es el hallazgo con más apalancamiento de esta ronda: convierte ~20 reglas de
«asumimos que funcionan» a «comprobado».

**Estado:** abierto

---

## ACO-004 · El orden de los hooks es un contrato tácito

- **Tipo / severidad:** `ACO` · S2
- **Unidad:** `H-00`
- **Contexto:** B (harness)

**Qué encontré**

Tres dependencias de orden, de las cuales solo una está escrita:

| Dependencia | ¿Documentada? | Qué se rompe al reordenar |
|---|---|---|
| ~~`spec-reflection` (Stop 2º) antes que `sync-check` (Stop 3º)~~ | **no** | **Ya no aplica**: desde `ACO-001`, `sync-check` no borra `session-writes.json`. La dependencia se disolvió en vez de documentarse |
| `spec-gate` (1º) antes que `plan-injector` (4º) | sí, en el docblock de `plan-injector` | el injector inyectaría sobre escrituras que el gate iba a bloquear |
| `discovery-tracker` (PostToolUse Read) antes de cualquier Edit | **no** | el Gate depende de que el PostToolUse ya haya corrido |

**Por qué importa**

`settings.json` se lee como una lista de hooks, no como una secuencia. Alguien que reordene
por prolijidad rompe `C-02` sin ninguna señal.

**Propuesta**

Declarar el orden como contrato en `templates-contract.md`, con las tres dependencias
nombradas, y un comentario en el propio `settings.json`.

**Estado:** abierto

---

## INC-004 · El registro cuenta 16 hooks cableados; son 17

- **Tipo / severidad:** `INC` · S3
- **Unidad:** `H-00`
- **Contexto:** B (harness)

**Qué encontré**

`TEMPLATES-REGISTRY.md` dice «7 eventos, 16 hooks cableados». Los eventos son 7; los
comandos cableados son **17**. El que falta contar es `.claude/scripts/post-edit.js`, que
vive fuera de `hooks/` pero está cableado como hook de `PostToolUse`.

**Evidencia**

```
SessionStart 1 · UserPromptSubmit 1 · PreToolUse[Edit] 4 · PreToolUse[Bash] 2 ·
PostToolUse[Read] 1 · PostToolUse[Edit] 2 · PostToolUseFailure 1 · PostCompact 1 · Stop 4
TOTAL = 17     (17 comandos, 0 colgantes)
```

**Propuesta**

Corregir el número y decir «16 en `hooks/` + `post-edit.js` en `.claude/scripts/`», que es
la distinción que hace falta entender.

**Estado:** abierto

---

## HUE-009 · Nada verifica que el cableado apunte a archivos que existen

- **Tipo / severidad:** `HUE` · S3
- **Unidad:** `H-00`
- **Contexto:** B (harness)

**Qué encontré**

Ningún test comprueba que los comandos de `settings.json` resuelvan a archivos reales. Hoy
los 17 resuelven, pero es una coincidencia mantenida a mano.

**Por qué importa**

Un hook renombrado deja un comando colgante y Claude Code simplemente no lo ejecuta: el
guardrail desaparece del proyecto del usuario sin ningún error visible.

**Propuesta**

Test de cinco líneas, del mismo tipo que `HUE-008`. Barato y cierra una clase entera de
fallo silencioso.

**Estado:** abierto

---

## HUE-013 · `GATE-B1` bloquearía una regla que documenta un hook

- **Tipo / severidad:** `HUE` · S3
- **Unidad:** `H-05`
- **Contexto:** B (harness)

**Qué encontré**

`EXEC_CODE_RE` bloquea `require(`, `process.exit(`, `fs.readFileSync(` en cualquier
superficie de guía. Una regla que **documenta** cómo funciona un hook dispara el gate.

**Por qué importa**

Es exactamente lo que hace `.claude/rules/templates-contract.md`: explicar el
funcionamiento de los hooks dentro de un archivo de reglas.

Verificado que **ninguna** regla actual del template ni de este repo lo dispara hoy, así
que es riesgo latente y no un problema activo — por eso `S3`.

**Propuesta**

Excluir el contenido dentro de bloques de código markdown (``` ```` ```) del chequeo: ahí
el código es cita, no lógica.

**Estado:** abierto

---

## ACO-005 · `DETAIL:BEGIN` y `last_updated` son contratos sin declarar

- **Tipo / severidad:** `ACO` · S3
- **Unidad:** `H-01`
- **Contexto:** B (harness)

**Qué encontré**

- `<!-- DETAIL:BEGIN -->` — marca el corte entre Quick Reference y detalle. Lo usan
  `session-start.js`, `compact-recovery.js` y los propios índices.
- `**last_updated:** YYYY-MM-DD` — formato exacto que parsean `session-start.js` y
  `discovery-tracker.js` para la frescura del brief.

Ninguno figura en `templates-contract.md`.

**Por qué importa**

Un índice generado sin el marcador se inyecta entero, no su Quick Reference: el
presupuesto de `session-start` (2.500 chars) lo trunca a la mitad de una tabla.

**Estado:** abierto

---

## ACO-006 · `koa-prompt-ctx-{sessionId}.json` no declarado

- **Tipo / severidad:** `ACO` · S3
- **Unidad:** `H-02`
- **Contexto:** B (harness)

**Qué encontré**

`prompt-context.js` guarda su estado de dedup —contador de prompts y hash de cada bloque—
en `$TMPDIR/koa-prompt-ctx-{sessionId}.json`. No está declarado, y hereda el `sessionId`
global de `HUE-002`: con el fallback `'default'`, un bloque inyectado en un proyecto puede
quedar silenciado en otro durante 8 prompts.

**Estado:** abierto

---

## ACO-007 · El estado del circuit breaker y del dedup de contexto no está declarado

- **Tipo / severidad:** `ACO` · S3
- **Unidad:** `H-04`
- **Contexto:** B (harness)

**Qué encontré**

`pre-write-guard.js` mantiene dos familias de estado en `os.tmpdir()`:

- `koa-breaker-{sessionId}.json` — contador de bloqueos idénticos (umbral 3)
- `koa-ctx-{categoría}-{sessionId}.flag` — **once** flags, uno por categoría de inyección

Ninguno declarado, todos con el `sessionId` de `HUE-002`. Con el fallback, el contador del
breaker y los flags de dedup se comparten entre proyectos: el contexto de `features/` puede
no inyectarse nunca en un proyecto porque otro ya lo consumió.

**Estado:** abierto

## DEC-004 · El auditor de reglas cubre 4 de 28

- **Tipo / severidad:** `DEC` · **S1**
- **Unidad:** `S-05` (`provocar-reglas.mjs`)
- **Contexto:** B (harness)

**Qué encontré**

`provocar-reglas.mjs` existe para responder «¿cada regla puede fallar?». Corriéndolo sobre
el boilerplate real:

```
✅ ARCH-01, ARCH-04, ARCH-03, ARCH-05 — dispara ante su violación
Sin fixture todavía (24/28): ARCH-11, ARCH-18, ARCH-21, ARCH-22, ARCH-15, ARCH-16,
ARCH-17, ARCH-19, ARCH-24, ARCH-23, ARCH-25, ARCH-26, NAV-01, A11Y-03, ICON-01,
ARCH-02, ARCH-06, ARCH-07, ARCH-08, ARCH-09, ARCH-10, SEC-RLS-01/02/03
```

**Por qué importa**

Las cuatro comprobadas son las más antiguas y simples. Las 24 sin comprobar incluyen todo
lo agregado después: los ratchets del design system, el contraste AA, las colisiones con
Tailwind, la integridad de navegación, la accesibilidad, y **las tres reglas de seguridad
RLS** — las únicas del linter que protegen la base de datos.

Y el detalle que cierra el círculo: `ARCH-24` y `ARCH-26`, las dos que la documentación
cita como «estuvieron muertas hasta que existió `provocar-reglas`», **siguen en el baseline
sin fixture**. El episodio que motivó escribir el script no está cubierto por el script.

Cruzado con `HUE-012` (las ~20 reglas regex de `pre-write-guard`, sin provocación de ningún
tipo): **de las ~48 reglas que el harness aplica, 4 están comprobadas disparando.**

Es `S1` porque la garantía que este script da es la que justifica confiar en todo el
sistema de reglas, y hoy cubre el 14%.

**Propuesta**

Escribir fixtures. Cada uno son ~15 líneas y el ratchet del baseline ya impide que la deuda
crezca. Es el ítem con mejor relación esfuerzo/resultado de todo el backlog.

**Lo hecho** — 14 fixtures nuevos, en el orden que fijó `ADR-005` §1: primero las once cuya
prosa en `visual-system.md` queremos cambiar por el mensaje de error del linter, después las
tres de seguridad.

```
antes   ✅ 4/28   (14%)   — y la corrida salía en 1 (INC-009)
ahora   ✅ 18/28  (64%)   — «18 regla(s) provocadas y todas disparan», exit 0
```

Cubiertas: `ARCH-11 15 16 17 18 19 22 23 24 25 26` + `SEC-RLS-01/02/03`. Con eso quedan
cerrados los dos huecos que la ficha nombraba: las tres reglas de seguridad, y `ARCH-24` y
`ARCH-26` —las dos que motivaron escribir el script y no estaban cubiertas por él—.

Quedan diez en el baseline (`ARCH-02 06 07 08 09 10 21`, `NAV-01`, `A11Y-03`, `ICON-01`).
Siguen siendo deuda declarada, y el trinquete impide que crezca.

Dos cosas aparecieron al escribirlos:

- **El provocador tenía su propio punto ciego** (`DEC-009`): leía solo stdout, y una regla
  que reporta con `reportWarning` sale en 0 y escribe en stderr. `ARCH-11` disparaba desde
  siempre y el provocador la veía muda. Que el mecanismo que busca reglas decorativas
  tuviera una ceguera decorativa propia es demasiado apropiado para no dejarlo escrito.
- **Un fixture no siempre es un archivo.** `ARCH-11` compara el uso de una clase contra el
  `@theme`, que vive en otro archivo. El fixture pasó a admitir `archivos: []`.

**Estado:** resuelto en lo que la ficha nombraba — 18/28, corrida en verde

---

## INC-009 · `lint:arch:provocar` sale en 1 de fábrica

- **Tipo / severidad:** `INC` · S2 · **Unidad:** `S-05` · **Contexto:** B

**Qué encontré**

`architect.js` registra `SEC-RLS-01/02/03`; `provocacion.baseline.json` tiene 21 entradas y
ninguna es `SEC-RLS`. El ratchet las detecta como «reglas nuevas sin fixture» y sale en 1.

```
🆕 3 regla(s) nuevas sin fixture: SEC-RLS-01, SEC-RLS-02, SEC-RLS-03
exit=1
```

**Por qué importa**

`npm run lint:arch:provocar` viene rojo en cualquier proyecto scaffoldeado hoy. Un chequeo
que siempre sale rojo se aprende a ignorar, y con él se pierde la señal cuando alguien
agregue la regla 29 sin fixture. El ratchet funcionó; nadie le hizo caso al agregar RLS.

**Propuesta**

Escribir los tres fixtures (son reglas de seguridad: merecen fixture antes que baseline), o
como mínimo correr `--actualizar-baseline` y dejar registro de por qué.

**Estado:** abierto

---

## HUE-018 · El linter muere sin mensaje ante un major de TypeScript

- **Tipo / severidad:** `HUE` · S2 · **Unidad:** `S-01` · **Contexto:** B

**Qué encontré**

```js
const ts = require('typescript');   // sin try/catch, sin comprobar la API
```

Con `typescript@7.0.2` —el port nativo, cuya API CommonJS expone 2 claves y no
`ScriptTarget`— `architect.js` muere así:

```
TypeError: Cannot read properties of undefined (reading 'Latest')
    at analyzeTypeScript (scripts/architect.js:374:25)
```

Con `typescript@5.9.3` corre normalmente. `indices-sync.js` tiene el mismo patrón.

**Por qué importa**

Hoy no es un fallo activo: Angular 21 pinea TypeScript 5.x. Es la ausencia de un
guardaespaldas en una dependencia que el repo **ya sabe** que se mueve — `lib/config.js`
pinea `ANGULAR_MAJOR` con un comentario largo sobre exactamente este problema («el
ecosistema tarda semanas o meses en declarar soporte para un major nuevo»), y esa misma
lección no se aplicó a `typescript`.

Cuando llegue, el usuario ve un stack trace, no un mensaje.

**Propuesta**

Comprobar `ts.ScriptTarget` tras el require y fallar con un mensaje que nombre la versión
esperada.

**Estado:** abierto

---

## INC-008 · El boilerplate incumple su propia ARCH-09

- **Tipo / severidad:** `INC` · S2 · **Unidad:** `S-01`, confirmar en `L-06` · **Contexto:** B

**Qué encontré**

Corriendo `architect.js` sobre el boilerplate que el CLI reparte:

```
⚠️ [ARCH-09] Clase demasiado grande (1170 líneas). Límite recomendado: 200.
   src/app/shared/components/section-hero/section-hero.component.ts
⚠️ [ARCH-09] Clase demasiado grande (298 líneas). Límite recomendado: 200.
   src/app/shared/components/tabs/tabs.component.ts
```

**Por qué importa**

El producto incumple su propia regla en el archivo que entrega. Un usuario que corra
`npm run lint:arch` el primer día ve dos advertencias que no causó. Peor: enseña por
ejemplo que la regla es negociable.

`ARCH-09` es warning y no error, así que no rompe el build — de ahí `S2` y no `S1`.

**Propuesta**

Decidir explícitamente: dividir `section-hero`, o subir el límite con motivo escrito, o
excluir el boilerplate del chequeo. Lo que no puede quedar es el warning permanente.

**Resolución** — ninguna de las tres. Al medirlo apareció una cuarta: **la regla no medía
lo que dice medir**.

`ARCH-09` usaba el span del `ClassDeclaration`, y en el AST de TypeScript los decoradores
son parte de ese nodo. Todo este boilerplate escribe componentes con template inline, así
que la regla contaba HTML y lo reportaba como «clase demasiado grande»:

```
                span    @Component    clase
section-hero    1.170       910        258
tabs              298       248         48   ← una clase de 48 líneas, denunciada por 298
```

`tabs` nunca tuvo un problema. Su advertencia era falsa, y su fix («divide el componente,
extrae lógica a servicios») no describía nada que se pudiera hacer: no había lógica que
extraer. El usuario del primer día veía dos advertencias, y una de las dos era mentira.

Ahora mide el **cuerpo** (del primer miembro al último). El total sigue en el mensaje
cuando el decorador pesa más que la clase, porque un template inline enorme es una señal
real — pero es otra señal, y decirla con las palabras de esta no ayudaba a arreglar nada.
`tabs` quedó limpio sin tocarlo.

`section-hero` sí tenía un problema real: 258 líneas de cuerpo. Se hizo lo que el fix de la
propia regla dice — se extrajeron a `section-hero.tokens.ts` los mapeos puros dato → token
del DS, que se testean sin montar un componente. La clase conserva un método de una línea
por cada uno porque un template de Angular solo llama miembros de la clase; eso es
andamiaje, y la decisión de qué token corresponde a qué estado ya no vive ahí. De paso:

- `getChipStyle` y `getChipIconColor` eran **código muerto** — ningún template las llamaba.
- `chipVariant` y `getChipVariant` eran la **misma función con dos nombres**, una por rama
  del template. Quedó una.

Resultado: **258 → 198**, y `npm run lint:arch` sobre el boilerplate da **0 errores,
0 advertencias**.

Y `ARCH-09` salió del baseline de provocación: tiene fixture (9/28 sin fixture, era 10).
El fixture lleva template de una línea a propósito — uno con template largo habría
disparado también con la regla vieja, y no habría distinguido una regla arreglada de una
rota. La comprobación inversa —600 líneas de markup con 5 miembros **no** disparan— vive en
`scripts/lib/arch09-cuerpo.test.mjs`.

**Estado:** resuelto · la regla mide el cuerpo de la clase; el boilerplate pasa su propio linter

---

## HUE-019 · Reglas testeadas como función pura, pero sin provocación

- **Tipo / severidad:** `HUE` · S2 · **Unidad:** `S-11` · **Contexto:** B

**Qué encontré**

Los 13 módulos de `scripts/lib/` tienen 79 tests que pasan. Varias reglas están **testeadas
como función pura** y a la vez **sin fixture de provocación**: `ARCH-11`, `ARCH-15/16/17/19`,
`ARCH-20`, `ARCH-22`, `ARCH-25`, `ARCH-26`, `NAV-01`, `ICON-01`.

**Por qué importa**

Hay tres niveles de garantía y solo se cuentan dos:

1. la función pura devuelve lo correcto ante una entrada — **79 tests, cubierto**
2. `architect.js` la cablea y reporta el código — **sin verificar**
3. la regla dispara ante su propia violación — **solo 4 reglas**

El nivel 2 es exactamente el hueco donde vivían `ARCH-24` y `ARCH-26` cuando estaban
muertas: la lógica estaba bien, el cableado no.

**Propuesta**

Al escribir los fixtures de `DEC-004`, priorizar las reglas que ya tienen test de función
pura: ahí el fixture solo comprueba el cableado y es el más barato de escribir.

**Resolución** — se escribieron los nueve que faltaban (`ARCH-02`, `ARCH-06`, `ARCH-07`,
`ARCH-08`, `ARCH-10`, `ARCH-21`, `A11Y-03`, `ICON-01`, `NAV-01`) y el baseline quedó
**vacío**: `28/28`, ninguna regla registrada sin haberse puesto delante de su propia
violación.

Siete dispararon en el primer intento — el nivel 2 estaba bien y nadie lo había mirado. Las
otras dos son la razón por la que el hallazgo valía la pena:

- **`NAV-01`** no disparó porque mi fixture escribía `route:` y el extractor busca
  `routerLink:`. Fixture mal escrito, regla sana. El fixture ahora usa la forma real del
  `menu-config.service.ts` que reparte el blueprint.
- **`ARCH-07`** no disparó con el fixture en `src/styles/`, y ahí había algo de verdad:
  → `INC-023`.

Dos fixtures llevan una advertencia escrita, porque la ruta **es** el fixture: el de
`ARCH-07` explica por qué no debe moverse a `src/styles/`, y el de `ICON-01` por qué el
icono va fuera de un `<button>` (dentro dispararía también `A11Y-03` y ya no se sabría cuál
de las dos habló).

**Estado:** resuelto · 28/28, baseline vacío

---

## INC-010 · Los scripts de asignaciones fallan en proyectos que no las usan

- **Tipo / severidad:** `INC` · S2 · **Unidad:** `S-08`/`S-09` · **Contexto:** B

**Qué encontré**

```
assignments-audit  exit=1 | No se encontró specs/ASSIGNMENTS.md o specs/AUTHORS.md.
assignments-sync   exit=1 | No se encontró specs/ASSIGNMENTS.md o specs/assignments/.
verificar-specs    exit=0 | Sin specs/: nada que verificar.
```

**Por qué importa**

La capa de asignaciones es opcional dentro de un motor SDD que ya es opcional —
`sdd/SKILL.md` lo dice: «si el equipo no la necesita, simplemente no se usa». Sus dos
scripts tratan la ausencia como error, mientras el tercer script de la misma familia la
trata como caso normal. Cualquier CI que corra los scripts de `package.json` en un proyecto
sin asignaciones se pone rojo por dos comandos que no tenían nada que hacer.

Misma raíz que `DUP-001`: falta de criterio común sobre qué hacer cuando el SDD no está
activo.

**Propuesta**

Adoptar el criterio de `verificar-specs`: sin `specs/ASSIGNMENTS.md`, mensaje y `exit 0`.

**Estado:** abierto

---

## DEC-005 · `smoke-scripts` sale verde con 0 comprobados

- **Tipo / severidad:** `DEC` · S3 · **Unidad:** `S-06` · **Contexto:** B

**Qué encontré**

```
🔥 Smoke de scripts — ¿pueden fallar, o sólo pasar?
✅ 0 script(s) comprobados
exit=0
```

**Por qué importa**

Es, en pequeño, el patrón que el script existe para condenar: un chequeo verde que no
comprobó nada. Un `package.json` sin los scripts esperados, o un `--solo` mal escrito,
producen un visto bueno vacío.

`S3` porque en un proyecto generado real los scripts existen; requiere que alguien los haya
borrado o se haya equivocado en el flag. Pero es el único caso de la auditoría donde un
auditor comete el error que audita.

**Propuesta**

`exit 1` cuando no hay nada que comprobar, con el mensaje explicando por qué.

**Estado:** abierto

---

## ACO-009 · La provocación depende del formato de salida del linter

- **Tipo / severidad:** `ACO` · S3 · **Unidad:** `S-05` · **Contexto:** B

`provocar-reglas.mjs` exige que la salida de `architect.js` **nombre el código** de la
regla. Ese formato de salida no está declarado en ninguna parte: si alguien cambia cómo
`reportError` imprime, la provocación empieza a reportar reglas muertas que no lo están.

**Estado:** abierto

---

## ACO-010 · `smoke-scripts` depende de nombres de script y de ARCH-04

- **Tipo / severidad:** `ACO` · S3 · **Unidad:** `S-06` · **Contexto:** B

Depende de los nombres exactos de `package.json` (`lint:arch`, `typecheck`, `test:ci`) y de
que **`ARCH-04` siga activa** — su defecto de arquitectura es un componente sin `OnPush`.
Si alguien desactivara `ARCH-04`, el smoke reportaría que `lint:arch` es decorativo cuando
el decorativo sería el smoke. Ninguna de las dos dependencias está declarada.

**Estado:** abierto

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

---

## INC-020 · `SessionStart` no corre una vez por sesión

**Tipo:** `INC` · **Severidad:** `S1` (contexto B) · **Unidad:** encontrado en fase de diseño ·
**Estado:** abierto

**Qué dice la documentación de Claude Code.** `SessionStart` acepta un matcher sobre *cómo
arrancó la sesión*, con cinco valores:

```
startup · resume · clear · compact · fork
```

**Qué hace el harness.** `templates/.claude/settings.json` registra `SessionStart` **sin
matcher**, así que `session-start.js` corre en los cinco casos. Su propio docblock supone
uno solo: *«al abrir la sesión se inyectan los índices core»*.

**Por qué es `S1` y no deriva de documentación.** Hoy el daño está acotado —el hook
*agrega* (`appendFileSync` al discovery flag) y no borra nada, así que un `resume` o un
`compact` solo cuestan la inyección de más (`CAR-004`)—. Pero el diseño que estábamos por
implementar convierte eso en pérdida de datos: `ADR-001` §1 pone `cleanup()` en
`SessionStart`, y `ADR-002` §1 muda ahí la limpieza de todo el estado de ciclo `sesión`
sobre la premisa —escrita textualmente— de que `SessionStart` *«es el único evento que
ocurre una vez por sesión»*. **Con un `compact` a mitad de sesión, esa limpieza borra el
discovery flag y `session-writes.json` mientras el trabajo sigue vivo.**

Se registra como `S1` porque desactiva un guardrail sin que nadie se entere: tras el
borrado, el Discovery Gate vuelve a bloquear escrituras pidiendo un descubrimiento que ya
ocurrió, y `sync-check` deja de ver los archivos escritos antes de la compactación.

**Cómo se verificó.** Consulta a la documentación de hooks de Claude Code
(`code.claude.com/docs/en/hooks`), contrastada con `templates/.claude/settings.json:3-12` y
el docblock de `session-start.js:1-25`. La misma consulta confirmó los otros dos supuestos
de `ADR-002` (que `Stop` corre por turno y que `exit 2` en `Stop` continúa la conversación)
y encontró que **`SessionEnd` sí existe**, lo que habilita la opción (a) que `ADR-002` §3
había dejado condicionada.

**Arreglo.** Matcher explícito en `settings.json` y lectura del origen en el hook: la
limpieza destructiva solo con `startup`; en `resume`/`compact`/`fork` el estado se preserva.
Es la corrección que `ADR-001` y `ADR-002` incorporan antes de implementarse.

---

## CAR-004 · Tras una compactación se inyecta el mismo contexto dos veces

**Tipo:** `CAR` · **Severidad:** `S2` (contexto B) · **Unidad:** encontrado en fase de
diseño · **Estado:** abierto

**Consecuencia directa de `INC-020`.** Una compactación dispara `PostCompact`
(`compact-recovery.js`) **y** `SessionStart` con origen `compact` (`session-start.js`).
Los dos inyectan los mismos tres índices core cortados en `<!-- DETAIL:BEGIN -->`, y los
dos inyectan `context/brief.md`.

**Medido** con tres índices core de ~7,3 KB cada uno y un `brief.md` con contenido real:

```
session-start.js   (SessionStart origen=compact)    9.363 chars
compact-recovery.js (PostCompact)                  13.738 chars
                                          TOTAL    23.101 chars  ≈ 5.775 tokens

de las 94 líneas de contenido de session-start, 80 (85%) son
byte-idénticas a líneas de compact-recovery  →  8.097 chars ≈ 2.024 tokens duplicados
```

**Por qué duele más de lo que el número sugiere.** Esto ocurre exactamente en el momento en
que el contexto es más escaso: el runtime acaba de compactar porque no había espacio, y el
harness responde ocupando ~5.800 tokens de los que ~2.000 son repetidos.

Ninguno de los dos hooks sabe del otro: `session-start.js` tiene tope por índice
(`MAX_INDEX_CHARS = 2500`) y `compact-recovery.js` **no tiene ninguno** —inyecta la Quick
Reference completa de hasta 10 índices y los cuatro `context/*.md` en crudo—. Es la misma
ausencia de presupuesto compartido que `CAR-001` y `DEC-006`, en su tercera manifestación.

**Arreglo.** Con el matcher de `INC-020`, `session-start.js` no corre en `compact`. Con
`lib/budget.js` (`ADR-001` §4) la dedup deja de depender de que cada hook conozca al resto.
Los dos arreglos son independientes y cualquiera de los dos reduce el costo; juntos lo
cierran.

---

## HUE-032 · El estado de sesión es un pozo compartido con los subagentes

**Tipo:** `HUE` · **Severidad:** `S1` (contexto B) · **Unidad:** encontrado en fase de diseño ·
**Estado:** abierto

**Qué dice la documentación de Claude Code.**

> *«Hooks from settings files, managed policy settings, and plugins also run inside
> subagents. When a subagent calls a tool, tool events such as `PreToolUse` and
> `PostToolUse` fire the same configured hooks as in the main conversation, and the input
> carries the `agent_id` and `agent_type` common input fields that identify the subagent.»*

`agent_id` existe **para poder distinguir** los dos casos: *«Use this to distinguish
subagent hook calls from main-thread calls»*.

**Qué hace el harness.**

```
grep -rn "agent_id\|agent_type" templates/.claude/hooks/   →  0 resultados
```

Ninguno de los 18 hooks lo lee. Y todo el estado va con la sesión, que los subagentes
comparten:

| Estado | Clave | Consecuencia de compartirlo |
|---|---|---|
| `koa-ctx-${categoría}-${sessionId}.flag` | `pre-write-guard:438` | Un `Edit` del subagente consume el aviso de esa categoría; **el hilo principal ya no lo recibe** |
| `koa-breaker-${sessionId}.json` | `pre-write-guard:50` | El presupuesto de fallos es uno solo para el hilo principal y los cinco subagentes |
| `koa-discovery-${sessionId}.flag` | `discovery-tracker:39` | Ver `DUP-004` |
| `koa-prompt-ctx-${sessionId}.json` | `prompt-context:31` | `UserPromptSubmit` no corre en subagentes: acá no hay daño |

**Por qué es `S1`.** No es una ineficiencia: es la desactivación silenciosa de dos
guardrails. Un aviso de contexto que el subagente consumió no vuelve a emitirse, y el
hilo principal escribe sin él sin que nada lo indique — el modo de fallo que este repo ya
tuvo con `DEC-001`.

**Y toca el diseño en curso.** `ADR-001` §4 (`budget.inject`, dedup por sesión) y `ADR-002`
§2 (`notify`, default «una vez por sesión») **reproducirían el mismo defecto ampliado**: un
subagente consumiría la única emisión. Igual que `INC-020`, se encuentra antes de escribir
el código, no después.

**Arreglo.** `lib/session.js` distingue *ámbito de sesión* de *ámbito de hilo*: el estado de
dedup y de avisos se indexa por `agent_id ?? 'main'`; el estado que sí es de la sesión
entera —`session-writes.json`— se comparte a propósito y queda declarado como tal en el
registro de contratos.

---

## DUP-004 · `discovery-scout` levanta el Gate del hilo que no descubrió nada

**Tipo:** `DUP` · **Severidad:** `S2` (contexto B) · **Unidad:** encontrado en fase de
diseño · **Estado:** abierto

**El mecanismo, verificado en el código.** `discovery-tracker.js` corre en
`PostToolUse:Read` y escribe el flag ante *cualquier* lectura cuya ruta contenga `indices/`
o `context/`, sin mirar quién leyó:

```js
const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
if (filePath.includes('indices/') || filePath.includes('context/')) {
  fs.appendFileSync(path.join(os.tmpdir(), `koa-discovery-${sessionId}.flag`), entry);
}
```

`discovery-scout` es un subagente cuyo trabajo entero es leer índices (`tools: Read, Grep,
Glob`). Sus `Read` disparan este hook con el mismo `sessionId`, así que **levantan el
Discovery Gate del hilo principal** — que solo recibe el resumen del scout, no los índices.

**No es un accidente de configuración: es la ruta recomendada.** El propio output de
`session-start.js` la sugiere:

> *«Para un descubrimiento dirigido usa el subagente `discovery-scout` en vez de leerlos
> todos.»*

**Lo que hay que decidir, no dar por sentado.** Puede ser correcto: el resumen del scout
*es* descubrimiento, y delegarlo es justamente el ahorro de contexto que el harness busca.
Pero hoy no está decidido — está ocurriendo. Y se apila sobre `HUE-001`: el Gate comprueba
que el flag exista, no qué contiene, así que tampoco puede distinguir *«el scout resumió
COMPONENTS»* de *«alguien abrió `context/brief.md`»*.

**Arreglo.** Que el flag registre el origen (`agent_type` o `main`) y que el Gate lo lea —
que es la misma capacidad que pide `HUE-001`. Con eso la decisión se vuelve explícita:
*«un descubrimiento delegado cuenta»*, escrito y testeado, en vez de emergente.

---

## INC-017 · Generador y detector de IDs de track no hablan el mismo idioma

**Tipo:** `INC` · **Severidad:** `S2` (contexto B) · **Unidad:** `D-06` · **Estado:** abierto
· **Detalle ampliado al diseñar `ADR-004`**

La ficha registró *«tres convenciones de ID»*. Verificado contra el código, es más nítido:

| Pieza | Qué produce o exige | Código de autor |
|---|---|---|
| `/spec-new:44` | `specs/specs/NNNN-slug/` | **no** |
| `/fix-new:45` | `fix-NNN-<slug>` | **no** |
| `/hotfix:48` | `hotfix-NNN-<slug>` | **no** |
| `/assign-claim:131` | `specs/specs/NNNN-<mi_codigo>-slug/` | sí |
| `/assign-new:56` | `ASG-<codigo>-NNN` | sí |
| `assignments-audit.js:59` | `^(\d{N})-([a-z]+)-(.+)$` | **lo exige** |

`processTrack` (`assignments-audit.js:125-130`) empuja un `namingViolation` por **cada**
directorio que no matchea. **Todo track creado por los tres comandos normales del SDD es una
violación de naming para el auditor** — el caso común, no un borde.

Y `/assign-claim:124` afirma que su regla con código de autor es *«exactamente la misma regla
que ya usan `/spec-new`, `/fix-new` y `/hotfix`»*. Los tres comandos que cita no la siguen.

**Lo que hace al hallazgo instructivo:** el bug de colisión ya ocurrió, y la reparación fue
endurecer el detector sin tocar el generador. Ninguna pieza fija que los dos hablen el mismo
idioma — no hay test que cruce lo que un comando genera con lo que el auditor acepta.

**Arreglo:** `ADR-004` §2 — dos formas válidas, el interruptor `specs/AUTHORS.md` decide
cuál, una sola implementación, y el test que cruza generador y detector.

---

## HUE-002 · Ampliación al diseñar: el fallback no es un fallback

**Añadido en fase de diseño, al ejecutar la lista de verificación de `ADR-003`.**

La ficha describía la consecuencia en condicional: *«con ese fallback, todos los proyectos de
la máquina comparten…»*. **El condicional sobra.**

**1 · `CLAUDE_SESSION_ID` no existe.** No está en la lista de variables de entorno que la
documentación de Claude Code expone a los hooks (`$CLAUDE_PROJECT_DIR`, `$CLAUDE_PLUGIN_ROOT`,
`$CLAUDE_PLUGIN_DATA`, `$CLAUDE_CODE_REMOTE`, `$CLAUDE_CODE_BRIDGE_SESSION_ID`,
`$CLAUDE_EFFORT`, `$CLAUDE_PLUGIN_OPTION_*`). Comprobado además en un runtime real:

```
$ env | grep -c '^CLAUDE_SESSION_ID='
0
```

Existe `CLAUDE_CODE_SESSION_ID` —otro nombre— y tampoco está documentada como contrato para
hooks. La que sí lo está es `session_id`, **en el payload de stdin**, que ningún hook lee.

**2 · Entonces `sessionId` es siempre `'default'`.** Los cinco hooks resuelven a la misma
cadena en todas las sesiones y todos los proyectos de la máquina. No es el caso degradado: es
el único caso.

**3 · Demostrado de punta a punta.** Dos proyectos distintos, dos sesiones distintas:

```
PASO 1 — proyecto A, sesión 'sesion-AAA': el agente lee indices/COMPONENTS.md
   flag creado: koa-discovery-default.flag          ← una sola clave, global

PASO 2 — proyecto B, sesión 'sesion-ZZZ' (otro proyecto, otra sesión, nunca leyó nada)
   Discovery Gate exit=0   (2 = bloquea · 0 = deja pasar)
```

**El Discovery Gate del proyecto B se levanta con una lectura del proyecto A.** Y como el
flag vive en `TMPDIR` y nadie lo borra, queda levantado para toda sesión posterior en esa
máquina hasta que el SO limpie `/tmp`.

**Alcance real, corregido**

| Artefacto | Qué deja de funcionar |
|---|---|
| `koa-discovery-default.flag` | El Discovery Gate no bloquea desde la segunda sesión de la máquina, nunca más |
| `koa-ctx-${categoría}-default.flag` | Cada inyección de contexto por categoría ocurre **una vez por máquina**, no por sesión |
| `koa-breaker-default.json` | Un solo presupuesto de fallos para todas las sesiones y proyectos |
| `koa-prompt-ctx-default.json` | El contador de `REPEAT_EVERY=8` es compartido |

**Severidad:** sigue `S1`, pero por un motivo más fuerte que el registrado. No es *«el
fallback podría colisionar»*: es que **el guardrail principal del harness está desactivado en
la práctica en toda sesión que no sea la primera de la máquina**, y nada lo indica.

Refuerza también `HUE-032` y `DUP-004` (`ADR-003` §1-2): el estado no se comparte solo entre
hilos de una sesión — se comparte entre todo.

**Arreglo:** el ya diseñado en `ADR-001` §1, `sessionId(payload)`, cuyo primer nivel es
`payload.session_id` —el campo documentado— y cuyo último nivel deriva del `cwd`, nunca
`'default'`. Lo que cambia es la prioridad: pasa a ser lo primero de la tanda 0, antes que
`SEC-001`.

---

## DEC-007 · Cuatro exentos de `spec-gate` que nunca disparan

**Tipo:** `DEC` · **Severidad:** `S3` (contexto B) · **Unidad:** encontrado al escribir el
test de `spec-gate` (tanda 2) · **Estado:** abierto

`sdd/spec-gate.js:51` exime once extensiones. Cuatro de ellas solo existen como **nombre
completo de archivo**, y para esos `path.extname` devuelve cadena vacía:

```
entrada .md            archivo real guia.md          extname → ".md"    exime ✓
entrada .json          archivo real tsconfig.json    extname → ".json"  exime ✓
entrada .gitignore     archivo real .gitignore       extname → ""       NO exime ✗
entrada .npmrc         archivo real .npmrc           extname → ""       NO exime ✗
entrada .env           archivo real .env             extname → ""       NO exime ✗
entrada .editorconfig  archivo real .editorconfig    extname → ""       NO exime ✗
```

Solo dispararían para un archivo llamado `x.npmrc`, que nadie crea. En la práctica el gate
bloquea `src/.env` pidiendo una spec para tocarlo.

**Corrige una afirmación previa.** Al escribir `lib/paths.js` reporté que `src/.npmrc`
mostraba la divergencia entre `spec-gate` y `plan-injector`. **No es así**: el sandbox de
aquella medición tenía una spec completa y activa, así que `spec-gate` salía en `0` para
todo. La divergencia real existe y se demuestra con `src/guia.mdx` —`.mdx` sí está en la
lista de `spec-gate` y no en la de `plan-injector`—; `.npmrc` no diverge porque **ninguno de
los dos lo exime**.

**Ya está arreglado en el núcleo.** `lib/paths.js` compara también contra el basename cuando
el archivo empieza con punto, y tiene su propio test — de hecho ese test fue el que encontró
el bug del lado del núcleo antes de que apareciera acá.

---

## DEC-008 · El Day 0 Context Guard no puede disparar el Día 0

**Tipo:** `DEC` · **Severidad:** `S2` (contexto B) · **Unidad:** encontrado al escribir su
test (tanda 2) · **Estado:** abierto

`context-enrichment-guard.js` bloquea escribir código si `context/domain.md` o
`indices/DATABASE.md` siguen siendo plantillas sin rellenar. Detecta «plantilla» así:

```js
const PLACEHOLDER_MARKERS = ['[TODO]', '{{PROJECT_NAME}}', '<!-- template -->'];
const MIN_MEANINGFUL_LENGTH = 50;
```

**Ninguno de los dos archivos cumple ninguna de las dos condiciones**, medido sobre un
proyecto realmente generado con `copyTemplates`:

```
context/domain.md      len=2901   marcadores: NINGUNO   → el guard lo da por LLENO
indices/DATABASE.md    len=1353   marcadores: NINGUNO   → el guard lo da por LLENO
```

Las dos plantillas superan los 50 chars por su propio andamiaje —es el mismo mecanismo de
`DEC-006`— y el único marcador que sí traían, `{{PROJECT_NAME}}` en `domain.md`, **lo borra
el scaffolder**: `injectVars` lo reemplaza al generar. En `templates/` el guard todavía
atraparía `domain.md`; en el producto no.

**Lo que lo vuelve interesante:** el hook es opt-in y su docblock explica por qué.

> *«Wireado por defecto, este hook bloquearía TODA escritura de código desde el minuto cero,
> antes de que el usuario alcance a llenar nada.»*

Esa justificación es falsa. Cableado por defecto **no bloquearía nada**, porque su detector
no dispara nunca en el caso para el que fue escrito. La decisión de dejarlo apagado se tomó
para evitar un comportamiento que el hook no tiene.

**Arreglo:** `lib/budget.js` ya trae `isPlaceholder()`, que mide contenido real quitando
comentarios, encabezados, blockquotes y bullets vacíos —las cuatro plantillas de `context/`
caen a 0-66 chars con él—. Reemplazar el detector por esa función es el cambio; después hay
que **volver a decidir** si el hook se cablea, esta vez sabiendo qué hace.

---

## HUE-016 · Remedido al escribir su test: no es acumulativo, es un punto fijo

**Corrección de la ficha, hecha en la tanda 2.** `H-12` decía *«se pierden firma y conteo, y
el daño es acumulativo»*. Trazado ronda por ronda contra el hook real:

```
ronda 0 (escritura)      | … | `Bash` | a | b | c fallo | 1 | `Bash:a | b | c fallo` |  |
ronda 1 (tras re-parseo) | … | `Bash` | a | b | c fallo | 1 | `Bash:a` | b |
ronda 2                  | … | `Bash` | a | b | c fallo | 1 | `Bash:a` | b |
ronda 3                  | … | `Bash` | a | b | c fallo | 1 | `Bash:a` | b |
```

**Se corrompe una vez y se estabiliza.** No sigue degradándose: llega a un punto fijo.

**Pero la consecuencia real es peor que la descrita**, y es permanente. Lo que se parte es la
**firma**, que es la clave del dedup. La firma calculada para el mismo error sigue siendo
`Bash:a | b | c fallo` y la guardada quedó en `Bash:a`: no vuelven a coincidir nunca.
Medido, cinco fallas idénticas:

```
mismo error CON pipe   → 5 filas   (el dedup dejó de funcionar)
mismo error SIN pipe   → 1 fila con contador 5
```

Y con `MAX_ENTRIES = 20`, un error recurrente que contenga `|` genera un duplicado por vez y
**desaloja por rotación las entradas buenas**. Hay un test que lo demuestra: una lección
valiosa registrada primero desaparece tras 22 fallas de un error con pipes.

El arreglo no cambia: escapar el separador en el productor. Lo que cambia es el motivo por el
que urge — no es que el archivo se degrade, es que la memoria institucional se vacía sola.

---

## HUE-033 · El trinquete de `CAR-003` estuvo en rojo tres tandas y nadie lo miró

- **Tipo / severidad:** `HUE` · S2
- **Unidad:** encontrado ejecutando, no auditando
- **Contexto:** B (harness) — y sobre todo, sobre cómo se verifica el trabajo

**Qué encontré**

Al correr la suite de `scripts/lib/` —que no venía corriendo— apareció esto:

```
src/app/features/reportes/reportes.ts paga 72.216 chars (tope 72.000) en 14 reglas
```

El tope lo fijé yo al cerrar `CAR-003`, con la medición escrita al lado: `72.000 // 71.975`.
El commit **siguiente** (`cc3be68`, el que sacó la regla fantasma `A11Y-04`) agregó 241
caracteres de explicación a `a11y-spec.md`, y esa regla aplica a tres de las ocho rutas
medidas. Las tres subieron exactamente 241.

**Por qué importa**

El trinquete hizo exactamente su trabajo: detectó que una edición a las reglas encarecía
cada escritura en la ruta más cara del proyecto, y lo dijo. Estuvo diciéndolo durante tres
tandas de trabajo. Nadie escuchó, porque la verificación de cada tanda corría los hooks
(`.claude/tests/`) y el CLI (`test/`), y no la tercera suite.

Un mecanismo que nadie corre es indistinguible de uno que no existe — que es literalmente
la tesis de esta auditoría, aplicada a mí mismo. Y el modo de fallo es más incómodo que el
de una regla decorativa: acá el mecanismo *funcionaba*.

**Lo que agregaban esos 241 caracteres** también es parte del hallazgo. Eran tres líneas
explicando por qué `A11Y-04` había dejado de existir: arqueología del harness, correcta y
útil, metida en una regla *path-scoped* que se le inyecta al agente en **cada escritura**
de `reportes.ts`. El presupuesto existe para atrapar justamente eso.

**Arreglo**

El tope no se subió. Se recortó la prosa a lo que el agente necesita —los números los
emiten `LLM-01` y `LLM-02`— y el porqué histórico quedó donde va, en la auditoría:

```
antes:  72.216 / 72.000   EXCEDE
ahora:  71.951 / 72.000   ok
```

Y la verificación de cada tanda pasó a ser **cuatro** suites, no dos:
`.claude/tests/` (hooks), `test/` (CLI), `scripts/lib/*.test.mjs` (guardrails del linter) y
`provocar-reglas.mjs` (que cada regla pueda fallar) — las dos últimas en el layout de un
proyecto generado, que es donde el linter puede resolver `typescript`.

**Estado:** resuelto · el presupuesto está bajo el tope sin haberlo subido

---

## INC-023 · `ARCH-07` prometía todos los estilos y solo mira los de componente

- **Tipo / severidad:** `INC` · S2
- **Unidad:** `S-01` (`architect.js`) — encontrado escribiendo el fixture de `HUE-019`
- **Contexto:** B (harness)

**Qué encontré**

El fixture de `ARCH-07` no disparó. La primera hipótesis —regla muerta— era falsa: dispara
perfectamente con un `.scss` dentro de `src/app/**`. Lo que pasa es que el scanner recorre
solo cuatro directorios:

```js
const targetDirs = [ 'src/app/features', 'src/app/shared', 'src/app/core', 'src/app/layout' ];
```

`src/styles/` no está. Y ahí es exactamente donde uno escribiría un `@keyframes`:

```
src/styles/_animations.scss                 2 @keyframes
src/styles/motion/_view-transitions.scss    2
src/styles/tokens/_variables.scss           2
src/styles/vendors/_primeng-overrides.scss  1
```

**Siete**, en el código que el CLI reparte, bajo una regla cuyo nombre era *«No @keyframes
in app styles»* y cuyo mensaje decía *«@keyframes detectado en archivo de estilos»*.

**Por qué importa**

O el boilerplate viola su propia regla siete veces, o la regla no dice lo que hace. Es lo
segundo, y las dos lecturas tenían consecuencias opuestas: ampliar el alcance habría
marcado como violaciones las view transitions —que **no se pueden** hacer con GSAP— y los
overrides de un vendor.

El desempate estaba escrito en el propio harness. El hook `pre-write-guard` implementa la
misma regla así:

```js
const isComponentStyle = normalizedPath.includes('src/app/');
if (STACK.gsap && isComponentStyle && /@keyframes\s/.test(newContent))
  violations.push('[ARCH-07] No usar @keyframes en estilos de componente …');
```

Acota igual y **lo dice**. Las dos implementaciones hacían lo mismo; solo una lo contaba
bien. Es la misma forma de `INC-008`: el mecanismo es más angosto que su nombre, y quien lo
lee confía en la promesa.

**Arreglo**

El alcance no se tocó — era la decisión correcta. Se corrigieron las tres puntas que
mentían: el `name` de la regla, el texto del `reportError`, el docblock de cabecera de
`architect.js`, `TECH-STACK-RULES.md#arch-07` y la línea del Architect Guard en
`.claude/CLAUDE.md`. Todas dicen ahora **estilos de componente**, y la doc explica por qué
`src/styles/` es una excepción en vez de dejarla como un hueco sin nombre.

El fixture quedó en `src/app/features/` con una advertencia escrita al lado: moverlo a
`src/styles/` «para que sea más representativo» estaría provocando un hueco que es una
decisión.

**Estado:** resuelto · el alcance era correcto; las palabras no

---

## ACO-013 · La declaración de contratos vivía del lado equivocado

- **Tipo / severidad:** `ACO` · S2
- **Unidad:** Lente 1 del pase general — ninguna ficha individual podía verlo
- **Contexto:** B (harness)

**Qué encontré** *(resumen; el desarrollo está en `PASE-GENERAL.md`)*

Dos cosas, y la segunda es la que cuesta más:

1. **21 artefactos compartidos, 3 declarados.** `specs/.active` solo —diez comandos lo
   escriben, tres hooks lo leen, y define si el motor SDD bloquea— supera a los tres
   declarados juntos.
2. **`templates-contract.md` está en `.claude/rules/` de este repositorio.** Es una regla
   para quien mantiene el CLI. El proyecto generado no recibe **ninguna** declaración de
   sus propios contratos: un agente trabajando ahí no tenía forma de saber que
   `sync-check` borraba el archivo del que depende `spec-diff-check`.

**Resolución**

La primera mitad la cerró `lib/contracts.js` (ADR-001 §5), que ya viajaba en el payload.
Al ir a cerrar la segunda aparecieron **seis artefactos que el registro todavía no tenía**
—los que el pase general contó y nadie había pasado a datos—:

```
AUTO-GENERATED:BEGIN            3 productores; el patrón más reusado del blueprint
author.local.json               gitignored a propósito: dos clones con el mismo
                                código de autor colisionarían los track IDs
arch-last-failure.json          el único contrato cuyo consumidor es un subagente
class-discipline.baseline.json  ausentes de fábrica: Koa se entrega con
contrast.baseline.json          tolerancia cero, el ratchet es opt-in
bento-classes.allowlist.json    este SÍ viaja: no es deuda tolerada, es
                                vocabulario aprobado (ARCH-21)
```

Con esos seis, **21** — el número exacto del pase general.

La segunda mitad es `docs/CONTRATOS.md`, que ahora viaja al proyecto: la tabla de los 21
con productor, consumidor, `lifetime` y `scope`, más el porqué de cada uno. Y **se genera**
(`npm run contracts:doc`, `.claude/scripts/contracts-doc.js`), entre marcadores
`AUTO-GENERATED`, con `--check` en un test. Escrita a mano volvería a desactualizarse, que
es literalmente el hallazgo que cierra.

`templates-contract.md` dejó de ser la fuente y pasó a decirlo: el registro manda, y esa
tabla queda como resumen para orientarse al editar `templates/`. De paso se corrigió que
seguía describiendo el discovery flag en `$TMPDIR` bajo la clave `'default'`, tres tandas
después de que `HUE-002` lo moviera.

Provocado: agregando un artefacto al registro sin regenerar el doc, caen 4 tests —dos por
el consumidor que no lo nombra, dos por el doc desfasado.

**Estado:** resuelto · 21 declarados y la declaración viaja al proyecto generado

---

## HUE-021 · Ningún test corría el linter sobre lo que el CLI genera

- **Tipo / severidad:** `HUE` · S3
- **Unidad:** `G-08` (cobertura del generador)
- **Contexto:** A/B — el punto exacto donde se tocan

**Qué encontré**

`architect.js` tiene 28 reglas y es el guardrail principal del blueprint. Se lo probaba
contra sandboxes armados a mano, nunca contra la salida real del generador. Nadie había
comprobado jamás que el linter que **recibe el usuario** funcione en el proyecto que
**recibe el usuario**.

**Por qué se quedó abierto tanto tiempo**

Cuando escribí el test de integración de `HUE-022` lo marqué resuelto de más y tuve que
corregirlo: el test usa `ng new --skip-install`, y el linter parsea con la API de
TypeScript. La conclusión que anoté entonces —«eso necesita el `npm install` que este test
evita a propósito»— era **falsa, y cara**: dio por bloqueado durante tres tandas algo que
no lo estaba.

No hace falta `npm install`. Hace falta **un paquete**.

**Resolución**

Se instala `typescript` en la versión que el propio `package.json` del proyecto declara —no
una fijada en el test— y con eso el linter corre. Instalar la declarada es deliberado: el
día que Angular mueva su rango a un TypeScript que rompa `architect.js`, el test lo dice;
fijarla a mano convertiría ese aviso en silencio. (No es hipotético: TypeScript 7 rompe
`architect.js` — `ts.ScriptTarget` viene `undefined`.)

Cinco tests nuevos sobre el proyecto real:

```
el boilerplate pasa su propio linter          0 errores, 0 advertencias
una feature que viola tres reglas NO pasa     ARCH-01 + ARCH-04 + ARCH-08, exit ≠ 0
scripts/lib/*.test.mjs corre ahí adentro      141 tests
provocar-reglas.mjs corre ahí adentro         28/28
```

Las dos primeras son una sola afirmación partida en dos, y por eso van juntas: que el
linter salga en 0 sobre el boilerplate podría significar «está limpio» o «no mira nada».
Con la feature rota al lado, solo puede significar lo primero.

Los dos últimos cierran un hueco de método, no solo de cobertura: esas suites **se saltean
en el repo del CLI** porque ahí `typescript` no resuelve. Ahora corren donde importa.

Medido: **15/15 en 61 segundos**, `ng new` real incluido.

Provocado devolviendo el bug de `ARCH-09` (`INC-008`): el test cae con
`0 errores, 2 advertencias`. Es la regresión que el usuario veía el primer día, y ahora hay
algo que la ve antes que él.

**Estado:** resuelto · el linter corre sobre la salida real de `ng new`

---

## HUE-031 · La superficie del harness que no vigilaba nadie

- **Tipo / severidad:** `HUE` · S3 *(la severidad quedó corta; ver abajo)*
- **Unidad:** Lente 2 del pase general
- **Contexto:** B (harness)

**Qué encontré**

Dos piezas protegen el harness y el criterio que las separa nunca se escribió:

| Pieza | Superficie | Postura |
|---|---|---|
| `pre-write-guard` capa 1 | `hooks/`, `settings.json`, `architect.js` | bloquea, sin excepción |
| `harness-gate` | `rules/`, `learnings.md`, `ANTI-PATTERNS.md`, `CLAUDE.md`, `scripts/` | valida y deja pasar |

Entre las dos quedaban afuera `.claude/agents/`, `.claude/skills/` y
`.claude/commands/`. El criterio implícito que las dejaba afuera: *son markdown, o sea
prosa*.

**Por qué importa más de lo que dice su S3**

No son prosa. Su frontmatter decide **qué puede hacer el agente**:

```yaml
# agents/code-judge.md
tools: Read, Grep, Glob      ← sin Write, sin Edit, sin Bash

# skills/plan/SKILL.md
hooks:
  Stop: … validate-file-contains --contains "## Criterio de done" …
```

Y `.claude/CLAUDE.md` vende lo primero como una garantía dura, con estas palabras: *«con
`Bash` podría escribir usando `>`, y "el juez no arregla nada" pasaría a ser una promesa en
vez de un hecho»*. Esa garantía la sostenía **una línea de YAML que el propio agente podía
editar**. Lo mismo con `/plan`: se le borra el bloque `hooks:` y el formato del task-spec
—el contrato con más consumidores— deja de validarse.

Un agente que puede ampliarse los permisos no está acotado por nada. Eso no es S3.

**Arreglo — `GATE-C1`**

`harness-gate` suma la tercera superficie con una postura propia, que no es ninguna de las
dos anteriores: **el texto es del agente, el frontmatter es del humano**. Se bloquea tocar
`tools:`, `allowed-tools:`, `hooks:`, `model:` y `permission-mode:` en
`.claude/agents/*.md`, `.claude/skills/**/SKILL.md` y `.claude/commands/*.md`.

El regex va anclado a principio de línea a propósito: una skill puede explicar *por qué* el
juez no recibe tools de escritura sin que eso la bloquee. Un guardrail que estorba se
termina desactivando, y entonces no protege nada.

Verificado que no rompe lo que el blueprint reparte: se le pasa a cada uno de los cinco
agentes su propio cuerpo y ninguno dispara.

Provocado: apagando `GATE-C1`, 3 tests en rojo.

**Estado:** resuelto · el frontmatter que reparte permisos ya no lo edita el agente

---

## DUP-003 · La autoridad triplicada de índices, decidida

- **Tipo / severidad:** `DUP` · S2
- **Unidad:** `K-04`
- **Contexto:** B (harness)

**Qué encontré** — y «sin reparto» resultó demasiado suave

El hallazgo decía que las tres piezas hacen el mismo trabajo y nada dice cuál usar cuándo.
Al abrirlas apareció algo peor: **`/sync-indices` no menciona ni al script ni al
subagente**. Su procedimiento era leer cuatro índices, buscar archivos cambiados y
reescribir las tablas a mano. O sea:

- rehacía a mano —y peor— lo que el AST ya hace bien, para **4 de los 15** índices;
- **editando dentro de los marcadores `AUTO-GENERATED`**, así que la próxima corrida de
  `npm run indices:sync` borraba ese trabajo. Es `HUE-007` con culpable: la skill que el
  propio blueprint le dice al usuario que invoque.

Y no era un descuido de redacción. Su frontmatter era `allowed-tools: Read, Edit, Glob,
Grep`: **sin `Bash`, no podía correr el auto-indexer ni aunque quisiera**. La duplicación
estaba en los permisos, no en la prosa.

**La decisión**

| Pieza | Rol | Alcance |
|---|---|---|
| `scripts/indices-sync.js` | **La autoridad** | Los 13 auto-generables. Lo que deduce del AST manda |
| `index-syncer` | **El único que escribe `indices/`** | Corre el script y completa lo que no deduce |
| `/sync-indices` | **La puerta** | Delega. No edita nada |

La skill se reescribió para delegar, y se le sacó `Edit` del frontmatter — pedirle en prosa
que no edite es una guideline; sacarle la herramienta es un hecho. Las tres piezas se
nombran entre sí, que es lo que impide que la cuarta versión de alguna vuelva a resolver el
problema por su cuenta.

Provocado: con la skill anterior, 4 tests en rojo.

**Estado:** resuelto · la autoridad es el script, el que escribe es el subagente, la skill delega

---

## HUE-015 · Una sesión de puro esquema era invisible para el harness

- **Tipo / severidad:** `HUE` · S2
- **Unidad:** `H-10` (`write-tracker`)
- **Contexto:** B (harness)

**Qué encontré**

El hallazgo original lo describía como una asimetría: el Discovery Gate trata
`supabase/migrations/**` como código fuente y `write-tracker` no lo rastrea. Medido, la
consecuencia es bastante más grande.

`write-tracker` es el **productor** de `session-writes.json`, el contrato con más
consumidores del harness. Si no registra nada, el archivo no existe, y entonces los tres
consumidores quedan ciegos **a la vez**:

```
sesión que escribe SOLO una migración
  session-writes.json   (no existe)
  sync-check            exit 0 — no avisa
  spec-diff-check       no bloquea el commit
  spec-reflection       cree que no se escribió nada

la misma sesión con un componente además
  sync-check            exit 2 ✔
```

Una sesión entera de trabajo de esquema no deja rastro, y `DATABASE.md` —el índice que esa
sesión desactualiza— se queda viejo en silencio.

**La causa: un motivo escrito que confundía dos cosas**

`belongsToIndex` excluía las migraciones con este comentario: *«las migraciones quedan
fuera a propósito — las cubre `DATABASE.md` por otra vía»*. Es cierto que el auto-indexer
genera `DATABASE.md` leyendo `supabase/migrations/`. Pero eso responde **quién lo genera**,
no **si la escritura obliga a actualizarlo**, que es lo único que esa función pregunta. Y
nada recuerda correr el auto-indexer, porque el recordatorio se dispara justo desde el
archivo que quedaba vacío.

**Arreglo**

`belongsToIndex` acepta `supabase/migrations/**.sql`. El borde queda fijado con test:
`config.toml`, un `README.md` dentro de `migrations/`, las edge functions y una migración
anidada bajo `docs/` siguen afuera — un guardrail que se dispara de más se termina
ignorando.

El aviso de `sync-check` también se corrigió: sugería cuatro índices de componentes y
ninguno era el que había que tocar. Ahora dice `DATABASE.md` cuando hubo migraciones, los
de código cuando hubo código, y nombra el camino de arreglo (`npm run indices:sync` vía
`index-syncer`, que es la autoridad decidida en `DUP-003`).

**Un test que estaba fijando el bug como si fuera correcto.** El caso vivía en
`write-tracker.test.js` bajo `QUÉ NO RASTREA`, como *«ignora una migración»*. Eso es lo que
hace un test de caracterización cuando nadie vuelve a mirarlo: deja de documentar un hueco
y pasa a defenderlo. Se movió a su propio describe, con el escenario completo.

Provocado: quitando la línea de `paths.js`, 3 tests en rojo; con el mensaje anterior de
`sync-check`, 2 más.

**Estado:** resuelto · las migraciones se rastrean, y el aviso nombra el índice correcto

---

## HUE-007 · El trato de los marcadores no lo sostenía nada

- **Tipo / severidad:** `HUE` · S3
- **Unidad:** `C-04` (marcadores `AUTO-GENERATED`)
- **Contexto:** B (harness)

**Qué encontré**

`AUTO-GENERATED:BEGIN`/`END` es el patrón más reusado del blueprint: tres productores lo
escriben (`indices-sync`, `assignments-sync`, `lib/lessons`) y el trato es siempre el mismo
— **adentro se reescribe entero, afuera no se toca nunca**. Nada lo sostenía.

**Por qué importa, y por qué el modo de fallo es peor que un error**

Escribir adentro **no falla**. Falla después, en la próxima corrida del generador, que pisa
el trabajo sin decir nada y sin dejar rastro de qué había. El agente no aprende: entre la
causa y el efecto hay una sesión entera.

Y no es hipotético. `DUP-003` lo encontró en el propio blueprint: la skill `/sync-indices`
—la que el harness le dice al usuario que invoque para sincronizar— editaba ahí adentro.

**Arreglo — `GATE-D1`**

En `harness-gate`, con una decisión que sale de `HUE-003`: **la superficie no es una lista
de rutas**. Una lista se desactualiza —es exactamente el bug de los diez índices—. La
superficie es *«el archivo en disco tiene los marcadores»*, y por eso cubre sin más
trabajo los tres artefactos declarados y cualquiera que se agregue después.

La detección se compara siempre contra el disco, que es lo único que dice dónde están hoy
los marcadores:

| Tool | Qué se mira |
|---|---|
| `Edit` | Si `old_string` vive dentro de la región, el generador lo va a pisar |
| `Write` | Se comparan las dos regiones; si difieren, la escritura toca lo auto-generado |

Editar **fuera** pasa, y eso es la mitad del diseño: congelar el archivo entero rompería el
patrón en vez de protegerlo. Lo de afuera existe justamente para escribir a mano.

Un caso más que el guard cubre y que `INC-022` volvió concreto: un `Write` que **borra los
marcadores** también se frena. Sin ellos `assignments-sync` se niega a escribir y
`indices-sync` no tiene dónde.

Y el mensaje nombra el generador que corresponde a ese archivo —`indices:sync`,
`assignments:sync`, o «lo escribe `failure-tracker`, no se edita a mano»—. Frenar sin decir
el camino de salida convierte un guardrail en un muro.

Provocado: apagando `GATE-D1`, 4 tests en rojo.

**Estado:** resuelto · la superficie se detecta por los marcadores en disco

---

## INC-002 · Un mensaje que mandaba a romper el artefacto que vigila

- **Tipo / severidad:** `INC` · S2
- **Unidad:** `C-03` (task-spec)
- **Contexto:** B (harness)

**Resolución**

El filtro de `--max-age` vaciaba la lista de candidatos, y el único mensaje que existía
decía *«Crealo antes de terminar»*. En cualquier sesión de más de una hora sin tocar el
spec, el agente recibía la orden de crear un spec **que ya existe**. Si obedece, el
duplicado pasa a ser «el más reciente por orden alfabético» para los otros cuatro
consumidores del contrato y el original queda huérfano: un mensaje equivocado rompiendo el
artefacto que el validador existe para proteger.

Ahora la lista completa se guarda antes de filtrar por edad, y hay cuatro situaciones con
cuatro respuestas:

| Situación | Qué dice |
|---|---|
| Completo y fresco | pasa |
| **No hay ninguno** | «no se encontró ningún archivo… creálo» |
| **Existe pero es viejo** | lo nombra, dice cuántos minutos lleva, y **«NO crees uno nuevo»** — marcá las casillas, o corré `/plan` si es otra tarea |
| Viejo **e** incompleto | gana la estructura |

Ese último orden es una decisión: arreglar la sección faltante actualiza el `mtime`, así
que resuelve las dos cosas de una vez. Al revés, el agente arregla la edad y vuelve a
chocar con la estructura en el turno siguiente.

El aviso de edad además dice **por qué** duplicar es peor que dejarlo viejo. Un guardrail
que solo prohíbe deja al agente eligiendo a ciegas entre dos caminos que se ven iguales.

**Un test existente marcó el borde correcto.** Al implementarlo se puso en rojo
*«`--max-age` ignora archivos viejos»*: yo había hecho que el archivo viejo se validara
siempre. Y el test tenía razón — sin `--require-file`, *«fuera de ventana»* significa
*«nada que validar»*, que es lo que `--max-age` promete por sí solo. La caída al archivo
viejo quedó acotada a cuando el llamador **exige** que haya uno.

El umbral de 60 minutos se deja como está: con el mensaje corregido, que un spec lleve una
hora sin tocarse **sí** es algo que vale la pena decir — lo que estaba mal no era el
umbral, era la conclusión que sacaba de él.

Provocado: con el validador anterior, 4 tests en rojo.

**Estado:** resuelto · cuatro situaciones, cuatro mensajes

---

## ACO-002 y ACO-003 · Las dos últimas filas sin declarar

- **Tipo / severidad:** `ACO` · S3 · **Unidades:** `C-03` y `C-04` · **Contexto:** B

Los dos los cerró `lib/contracts.js` al declarar los 21 artefactos: `spec-reflection-seen.json`
(lifetime `turno`, scope `hilo` — es la marca anti-bucle de un hook de `Stop`) e
`indices-cache.json`.

**Y verificar el segundo destapó algo.** Su ruta estaba **mal declarada**: el registro decía
`scripts/indices-cache.json` y `indices-sync.js` lo escribe en `.claude/temp/`. Nadie lo
notó en dos tandas, y desde `ACO-013` esa ruta equivocada además **viaja al proyecto
generado** dentro de `docs/CONTRATOS.md` — un agente que la siguiera no encontraría el
archivo.

El registro existe para ser verificable y ese campo no se verificaba: el test miraba que
las **piezas** existieran, no que el `path` fuera real. Ahora hay un test que lo contrasta
contra el código del productor. El detector tiene que distinguir un directorio de otro, no
solo el nombre del archivo —si no, la ruta equivocada habría pasado igual—, así que acepta
el literal completo o bien el nombre del archivo **más cada segmento del directorio** como
string, que es como se ve un `path.join(ROOT, '.claude', 'temp')`. Corre sobre los 11
artefactos de ruta concreta; los que nombran una familia (`ctx-<categoria>.json`) o llevan
un patrón (`task-spec-YYYYMMDD-HHMMSS.md`) quedan fuera por construcción.

De paso, su `lifetime` pasó de `permanente` a `sesion`: vive bajo `.claude/temp/`, que va
gitignored y se limpia. Perderlo solo cuesta un re-parseo.

Provocado: devolviendo la ruta vieja, 3 tests en rojo.

**Estado:** resueltos · declarados, y el `path` de cada artefacto ahora se verifica
