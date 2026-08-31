# ADR-003 · La superficie de eventos y los subagentes

**Estado:** implementado — §§1-3, salvo `PreCompact` (evaluación, no adopción) · **Fecha:** 2026-08-30 · **Depende de:** `ADR-001` (`lib/session.js`)
· **Origen:** la verificación de `ADR-002`

---

## Contexto

Verificar los supuestos de `ADR-002` contra la documentación de Claude Code no solo
encontró que uno era falso (`INC-020`). También dejó a la vista la lista completa de eventos
del runtime, y el contraste con lo que el harness usa:

```
eventos del runtime:  33
eventos cableados:     7   (SessionStart · UserPromptSubmit · PreToolUse
                            PostToolUse · PostToolUseFailure · PostCompact · Stop)
```

**Un harness no tiene por qué usarlos todos** — la mayoría de los 26 restantes no le sirven
de nada. Este ADR no propone cablear eventos por completitud. Propone decidir sobre **los
tres que cambian lo que el harness puede garantizar**, y sobre **uno que ya está pasando sin
que nadie lo haya decidido**.

---

## 1 · Lo que ya está pasando: los hooks corren dentro de los subagentes

Esto no es un evento sin cablear. Es comportamiento activo, hoy, en cada proyecto generado.

> *«Hooks from settings files […] also run inside subagents. When a subagent calls a tool,
> tool events such as `PreToolUse` and `PostToolUse` fire the same configured hooks as in
> the main conversation, and the input carries the `agent_id` and `agent_type` […] Use this
> to distinguish subagent hook calls from main-thread calls.»*

El campo existe precisamente para distinguir. El harness no lo usa:

```
grep -rn "agent_id\|agent_type" templates/.claude/hooks/   →  0 resultados
```

Y todo su estado va indexado por sesión, que los subagentes comparten:

| Estado | Dónde | Qué pasa al compartirlo |
|---|---|---|
| `koa-ctx-${categoría}-${sessionId}.flag` | `pre-write-guard:438` | El `Edit` de un subagente **consume el aviso**; el hilo principal escribe sin él |
| `koa-breaker-${sessionId}.json` | `pre-write-guard:50` | Un solo presupuesto de fallos para seis hilos |
| `koa-discovery-${sessionId}.flag` | `discovery-tracker:39` | `discovery-scout` levanta el Gate del hilo principal (§2) |

**Es `HUE-032`, y es `S1`:** un guardrail que deja de emitirse sin que nadie se entere es
exactamente el modo de fallo que este repo ya tuvo con `DEC-001`.

### Por qué esto entra en el diseño y no en el backlog

Porque **`ADR-001` y `ADR-002` lo reproducen ampliado**. `budget.inject()` deduplica por
sesión; `notify()` avisa «una vez por sesión». Con el estado compartido, la única emisión se
la lleva el primer subagente que edite algo, y el hilo principal —el que le está hablando a
la persona— no ve nada.

Sería el mismo error que `INC-020`: un supuesto sobre la plataforma, convertido en API.

### Decisión

**`lib/session.js` distingue dos ámbitos, y cada artefacto declara el suyo.**

```js
sessionScope(payload)   // .claude/temp/session/<sid>/          compartido a propósito
threadScope(payload)    // .claude/temp/session/<sid>/<agent>/  agent_id ?? 'main'
```

| Ámbito | Qué vive ahí | Por qué |
|---|---|---|
| `sesión` | `session-writes.json`, discovery flag | El trabajo del subagente **es** trabajo de la sesión: `sync-check` tiene que verlo |
| `hilo` | flags de dedup, anti-bucle, avisos, circuit breaker | Se refieren a **un contexto** — y el subagente tiene el suyo |

La regla que lo resume: **si el artefacto describe *lo que se hizo*, es de la sesión; si
describe *lo que ya se dijo*, es del hilo.** El circuit breaker cae del lado del hilo: un
subagente que falla cinco veces no debe agotar el presupuesto del hilo principal.

El campo `scope` se suma al registro de contratos (`ADR-001` §5) junto a `lifetime`
(`ADR-002` §1). Los dos son datos, y los dos los usa `session.js` para decidir la ruta.

---

## 2 · La decisión que nadie tomó: ¿el descubrimiento delegado cuenta?

`discovery-tracker.js` escribe el flag ante cualquier `Read` de `indices/` o `context/`, sin
mirar el origen. `discovery-scout` es un subagente cuyo trabajo entero es leer índices. Sus
lecturas levantan el Gate del hilo principal, que solo recibió el resumen.

**Y es la ruta que el harness recomienda**, en el output de `session-start.js`:

> *«Para un descubrimiento dirigido usa el subagente `discovery-scout` en vez de leerlos
> todos.»*

**Puede estar bien.** Delegar el descubrimiento es justamente el ahorro de contexto que
justifica tener subagentes, y el resumen del scout puede ser mejor que el índice crudo. El
problema no es la respuesta: es que **no hay una**. Está ocurriendo, no está decidida, y no
hay test que la fije en ninguna de las dos direcciones.

### Decisión

**Sí cuenta, y queda escrito.** Un descubrimiento delegado satisface el Gate — pero el flag
registra quién descubrió y qué:

```
2026-08-30T14:22:01Z | READ | main            | indices/COMPONENTS.md
2026-08-30T14:22:40Z | SCOUT | discovery-scout | indices/SERVICES.md
```

Tres cosas se siguen de ahí, y ninguna es posible con el flag actual:

1. El Gate puede exigir **cobertura**, no mera existencia — que es lo que pide `HUE-001`.
2. `compact-recovery` re-inyecta lo que leyó el hilo principal, no lo que leyó el scout: el
   hilo principal nunca tuvo esos índices en contexto, re-inyectarlos no es *recuperar*.
3. La decisión queda testeada. Si mañana se decide lo contrario, cambia un test, no el
   comportamiento por accidente.

---

## 3 · Los tres eventos que sí cambian algo

De los 26 sin cablear, tres:

### `SessionEnd` — adoptado

Ya entró por `ADR-002` §3: red de seguridad del hotfix, y el lugar natural para la limpieza
que `INC-020` sacó de `SessionStart`. Matcher sobre el motivo:
`clear · resume · logout · prompt_input_exit · other`.

**Con una advertencia que va escrita en el hook:** un proceso que muere no dispara nada.
`SessionEnd` es red, no garantía; por eso el borrado por antigüedad de `cleanup()` no
desaparece.

### `SubagentStop` — adoptado, por un motivo distinto del que parecía

> **Corrección.** Al ver por primera vez la lista de eventos anoté que servía porque *«los
> cinco subagentes escriben sin pasar por ningún tracker»*. **Es falso**: los hooks sí corren
> dentro de los subagentes, así que `write-tracker` ya ve esas escrituras. Lo comprobó la
> misma consulta que trajo la cita de §1.

Sirve por otra cosa: es el único punto donde **cerrar el ámbito de hilo** que §1 introduce.
Cuando un subagente termina, sus flags de dedup, su anti-bucle y su circuit breaker dejan de
tener sentido y hay que borrarlos — si no, `threadScope` crece sin límite dentro de una
sesión larga. `SubagentStop` es el `SessionEnd` del hilo.

Su payload trae `last_assistant_message`, que además evita leer el transcript para saber qué
devolvió el subagente.

### `PreCompact` — evaluar, no adoptar todavía

Hoy `compact-recovery` **reconstruye** el contexto después de la compactación, a partir de
lo que el flag registró. `PreCompact` permitiría **persistirlo antes**, con el contexto
todavía completo.

Se deja como evaluación y no como decisión por dos razones:

- La documentación no describe un mecanismo para inyectar contexto en `PreCompact`; sí puede
  escribir a disco, que es lo que haría falta. Hay que confirmarlo con la misma disciplina
  que `ADR-002` — **verificar antes, no suponer**.
- `CAR-004` sugiere que el problema real de la compactación hoy no es reconstruir de menos
  sino inyectar de más: dos hooks poniendo 5.775 tokens, 2.024 de ellos repetidos. Arreglar
  eso primero cambia el diagnóstico.

**Nada más.** `Setup`, `PermissionRequest`, `Notification`, `MessageDisplay`, `TeammateIdle`,
`WorktreeCreate`, `PreModelSwitch` y los demás no tienen trabajo que hacer en este harness.
Cablear un evento cuesta un hook, un test y contexto en cada disparo; el default es no
cablearlo.

---

## Verificación — ejecutada, y encontró algo mayor

| Afirmación | Resultado |
|---|---|
| `agent_id` llega en el payload dentro de un subagente | ✅ documentado: *«the input carries the `agent_id` and `agent_type`»* |
| `SubagentStop` recibe `agent_id` | ✅ documentado como campo común del contexto de subagente |
| `PreCompact` puede escribir a disco antes de compactar | ✅ es un command hook síncrono, previo a la compactación |
| El `session_id` del subagente es el mismo que el del hilo principal | ⚠️ **no está documentado explícitamente** — ver abajo |

### La cuarta se volvió irrelevante, por un motivo peor

Al buscar si el `session_id` cambia dentro de un subagente apareció que **la variable de la
que hoy sale la identidad no existe.** `CLAUDE_SESSION_ID` no está entre las que la
documentación expone a los hooks, y en un runtime real:

```
$ env | grep -c '^CLAUDE_SESSION_ID='
0
```

Los cinco hooks que la leen resuelven a `'default'` **siempre**. Demostrado con dos proyectos
y dos sesiones distintas: una lectura de `indices/COMPONENTS.md` en el proyecto A deja el
Discovery Gate del proyecto B en `exit=0`. Ver la ampliación de `HUE-002`.

**Qué significa para este ADR.** El §1 decía que el estado es un pozo compartido *entre el
hilo principal y sus subagentes*. Es cierto y se queda corto: **está compartido entre todo**
—sesiones, proyectos, máquina— porque la clave es una constante. La separación
`sessionScope` / `threadScope` sigue siendo la decisión correcta; lo que cambia es que **no
puede construirse encima de la identidad actual**, porque no hay ninguna.

Por eso `sessionId(payload)` pasa a ser lo primero de la tanda 0, antes que `SEC-001`, y el
nivel `process.env.CLAUDE_SESSION_ID` sale del diseño de `ADR-001` §1.

Que el `session_id` del payload sea o no el mismo dentro de un subagente deja de ser
bloqueante: `threadScope` se indexa por `agent_id ?? 'main'`, que está documentado y es
suficiente aunque el `session_id` coincida.

---

## Qué cierra

| Hallazgo | Cómo |
|---|---|
| `HUE-032` (**S1**) | `sessionScope` / `threadScope` y el campo `scope` en el registro |
| `DUP-004` (S2) | El flag registra origen; la decisión queda escrita y testeada |
| `HUE-001` (S2) | Con origen y contenido en el flag, el Gate puede exigir cobertura |

Y previene el defecto que `ADR-001` §4 y `ADR-002` §2 estaban por introducir: dedup y avisos
de ámbito de sesión, consumidos por un subagente.

---

## Riesgo

**El ámbito de hilo multiplica los directorios de estado.** Una sesión con cinco subagentes
tiene seis. Se acepta: son directorios vacíos o de pocos KB, `SubagentStop` los cierra, y
`cleanup()` barre lo que quedó. El costo alternativo —un guardrail que deja de emitirse sin
aviso— ya está medido y es peor.

**`agent_id` puede no llegar donde este ADR supone.** Es exactamente el riesgo de `INC-020`,
y por eso la verificación va en la tanda 0 y no después. Si no llega, §1 cae de vuelta a
distinguir hilos por otro medio, o se acepta el estado compartido **con motivo escrito** —
que es distinto de aceptarlo sin saberlo.


---

## Lo hecho

### §1 · Los dos ámbitos — cerrado en la tanda del núcleo

`lib/session.js` expone `sessionScope` y `threadScope`, y la regla que los reparte quedó
escrita donde se aplica: *si el artefacto describe **lo que se hizo**, es de la sesión; si
describe **lo que ya se dijo**, es del hilo* (`HUE-032`).

### §2 · El descubrimiento delegado — decidido, y con dos consecuencias

**Sí cuenta** (`DUP-004`). Está fijado por test, que era el punto: estaba ocurriendo sin que
nadie lo hubiera decidido. Si mañana se decide lo contrario, cambia un test y no el
comportamiento por accidente.

Y al mirar el flag con el origen ya registrado, quedó a la vista que el Gate no usaba nada de
eso: comprobaba `flag.trim()`, o sea *«existe alguna línea»*. Como `discovery-tracker`
escribe también ante una lectura de `context/`, **abrir `context/brief.md` levantaba un
bloqueo cuyo texto dice, con esas palabras, «lee los índices del proyecto»** (`HUE-001`).
Ahora se exige una línea que nombre `indices/` — que es lo que el mensaje ya pedía.

Las dos decisiones son independientes y ahora se leen así:

```
READ     | context/brief.md              → NO levanta el Gate   (HUE-001)
READ     | indices/COMPONENTS.md         → sí
SUBAGENT:discovery-scout | indices/…     → sí                   (DUP-004)
SUBAGENT:discovery-scout | context/…     → no
```

### §3 · `SubagentStop` — adoptado

`subagent-cleanup.js`. Un ámbito que se abre tiene que cerrarse: los cinco subagentes
arrancan y terminan varias veces en una sesión larga, y cada invocación dejaba su
`thread-<agent_id>/` con dedup, anti-bucle y breaker. Nadie los borraba.

Lo que el test fija es la mitad difícil —**que se lleve solo el hilo que termina**—: no el
estado de sesión (lo que el subagente descubrió sigue siendo cierto cuando se fue), no el
hilo de otro subagente que corre en paralelo, y nunca `thread-main`, que es la conversación
que continúa.

`SessionEnd` ya había entrado por `ADR-002` §3. **`PreCompact` sigue sin adoptarse**, y el
motivo escrito ahí se cumplió: `CAR-004` era el diagnóstico correcto —el problema de la
compactación era inyectar de más, no reconstruir de menos— y se arregló bajando de 26.006 a
8.783 chars. Volver a evaluar `PreCompact` después de eso es una decisión distinta, con otro
punto de partida.
