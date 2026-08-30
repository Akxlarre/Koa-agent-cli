# ADR-002 · La semántica de `Stop` y el ciclo de vida del estado

**Estado:** propuesto · **Fecha:** 2026-08-29 · **Depende de:** `ADR-001` (`lib/session.js`)

---

## Contexto

Tres hallazgos que parecían independientes tienen la misma raíz:

| Hallazgo | Hook | Lo que asume |
|---|---|---|
| `ACO-001` | `sync-check` | *«Limpiar tracker para la próxima **sesión**»* — y borra en cada `Stop` |
| `CAR-002` | `context-guardian` | Avisar una vez al **cerrar** — y avisa en cada respuesta, indefinidamente |
| `INC-007` | `hotfix-autoclose` | *«Al terminar cada **sesión**»* — y cierra el hotfix en el primer turno |

**`Stop` corre al final de cada respuesta del agente, no al final de la sesión.**

No son tres bugs: es **un malentendido compartido sobre el evento**, y se nota porque un
cuarto hook sí lo entendió. `spec-reflection.js` tiene anti-bucle explícito y su docblock
dice por qué:

> *«Sin esto el agente responde, el hook lo frena, vuelve a responder, y el hook lo frena
> otra vez con lo mismo — un bucle que quema tokens sin avanzar.»*

El diagnóstico estaba escrito en la casa. Los otros tres no lo aplicaron.

### Lo medido

Con `learnings.md` viejo, task-spec abierto e índices atrasados, **tres de los cuatro hooks
de `Stop` emiten `exit 2` en el mismo cierre**. Y `context-guardian` lo hace en *todas* las
respuestas: su condición es el `mtime` de un archivo, que no cambia por haber avisado.

```
cierre 1 → exit=2      cierre 2 → exit=2      cierre 3 → exit=2
estado anti-bucle en el archivo: 0 referencias
```

---

## Decisión

**Nombrar el ciclo de vida de cada artefacto y de cada aviso, y hacer que el código lo
respete.** No alcanza con arreglar los tres hooks: hay que impedir que el cuarto vuelva a
equivocarse.

### 1 · Tres ciclos de vida, con nombre

| Ciclo | Qué significa | Quién lo delimita |
|---|---|---|
| `turno` | Una respuesta del agente | `Stop` |
| `sesión` | Desde `SessionStart` hasta que la sesión muere | `SessionStart` |
| `permanente` | Sobrevive a la sesión; lo borra una persona | nadie |

**Todo artefacto del registro (`ADR-001` §5) declara su `lifetime`.** Ese campo no es
documentación: `lib/session.js` lo usa para decidir dónde vive y quién lo borra.

| Artefacto | `lifetime` | Se borra en |
|---|---|---|
| `session-writes.json` | `sesión` | `SessionStart` — **no en `Stop`** |
| discovery flag | `sesión` | `SessionStart` |
| `koa-breaker`, `koa-ctx-*`, `koa-prompt-ctx` | `sesión` | `SessionStart` |
| `spec-reflection-seen.json` | `turno` | lo gestiona su propio hook |
| `LESSONS_LEARNED.md`, `indices-cache.json` | `permanente` | nadie |

**La regla que se deriva:** *ningún hook de `Stop` borra estado de ciclo `sesión`.*

Eso arregla `ACO-001` por construcción: `sync-check` deja de borrar el archivo del que
dependen `spec-diff-check` y el bloque de evidencia de `spec-reflection`.

#### Dónde va la limpieza, entonces — corregido tras verificar

La primera versión de este ADR decía: *«la limpieza es de `SessionStart`, que es el único
evento que ocurre una vez por sesión»*. **Es falso**, y la verificación lo encontró antes de
que se implementara (`INC-020`):

```
SessionStart acepta matcher sobre el origen:  startup · resume · clear · compact · fork
templates/.claude/settings.json lo registra   SIN MATCHER
```

`SessionStart` corre también al reanudar y **al compactar**. Poner ahí una limpieza
destructiva —que es exactamente lo que proponían este ADR y `ADR-001` §1— borra el discovery
flag y `session-writes.json` a mitad del trabajo, cada vez que el runtime compacta. El
guardrail no falla ruidoso: el Gate vuelve a bloquear pidiendo un descubrimiento que ya
ocurrió.

**La regla corregida, en dos partes:**

| Origen del `SessionStart` | Qué se hace con el estado de ciclo `sesión` |
|---|---|
| `startup` | se limpia — es una sesión nueva |
| `resume`, `compact`, `fork`, `clear` | **se preserva** — la sesión sigue viva |

Y como `SessionEnd` **sí existe** (ver §3), la limpieza tiene un segundo lugar natural:
borrar al cerrar, y en `startup` limpiar solo lo que quedó huérfano de una sesión que murió
sin cerrar. `session.js` expone `cleanup({ source })` y el hook le pasa el origen; ningún
hook decide por su cuenta si «esto es una sesión nueva».

**El matcher explícito va en `settings.json` igual**, aunque el hook ya lea el origen: es la
diferencia entre no correr y correr para no hacer nada, y `session-start.js` corriendo en
`compact` cuesta ~9.400 chars de inyección duplicada (`CAR-004`).

### 2 · `lib/notify.js` — un aviso, una vez

`spec-reflection` resolvió el anti-bucle para sí mismo. Se extrae al núcleo:

```js
notify(payload, key, message, {
  once = 'turno',   // 'turno' | 'sesión' | { everyTurns: N }
}) → boolean        // false = ya se avisó, no repetir
```

**El default es no repetir.** Un hook que quiera insistir tiene que pedirlo explícitamente,
que es la dirección correcta: hoy el default es insistir y hay que acordarse de evitarlo.

Con esto `context-guardian` avisa una vez por sesión (`CAR-002`), y los cuatro hooks de
`Stop` dejan de hablar todos a la vez.

### 3 · `hotfix-autoclose` deja de vivir en `Stop`

Un hotfix se cierra cuando **el trabajo** termina, y `Stop` no sabe eso. La primera versión
de este ADR dejó dos opciones abiertas porque no sabíamos si el runtime exponía un evento de
cierre. **Ya lo sabemos: `SessionEnd` existe**, con matcher sobre el motivo
(`clear`, `resume`, `logout`, `prompt_input_exit`, `other`).

**Se adoptan las dos, y no compiten:**

| | Qué hace | Por qué |
|---|---|---|
| **`/hotfix-close`** | Cierre explícito, simétrico con `/fix-close`, que ya existe | Es el camino correcto: quien sabe si el trabajo terminó es quien lo hizo |
| **`SessionEnd`** | Red de seguridad: cierra el hotfix que quedó abierto | Sin esto, olvidarse de `/hotfix-close` deja `specs/.active` sucio para la sesión siguiente |

La diferencia con hoy no es dónde corre el hook: es **qué evento significa lo que el hook
supone**. `Stop` significa «terminé de responder»; `SessionEnd` significa «terminé». El
auto-cierre nunca estuvo mal como idea — estaba enganchado al evento equivocado.

---

## Verificación — hecha

La primera versión de este ADR listaba tres afirmaciones sobre el runtime comprobadas **por
comportamiento observado**, no contra la documentación de Claude Code. Se verificaron:

| Afirmación | Resultado |
|---|---|
| `Stop` corre por respuesta, no por sesión | ✅ **confirmada** — *«once per turn: `UserPromptSubmit`, `Stop`, `StopFailure`»* · *«`Stop`: when Claude finishes responding»* |
| `exit 2` en `Stop` continúa la conversación | ✅ **confirmada** — *«Prevents Claude from stopping, continues the conversation»*. El bucle que `spec-reflection` documenta es real |
| Existe un evento de fin de sesión | ✅ **existe** — `SessionEnd`, con matcher `clear\|resume\|logout\|prompt_input_exit\|other` |
| `SessionStart` corre una vez por sesión | ❌ **FALSA** — corre en `startup`, `resume`, `clear`, `compact`, `fork` → `INC-020` |

**La cuarta era load-bearing y era falsa.** Sobre ella descansaban la limpieza de este ADR y
el `cleanup()` de `ADR-001` §1; con un `compact` a mitad de sesión, ambas borraban estado
vivo. Está corregida arriba (§1) y registrada como `INC-020` (`S1`), junto con la duplicación
de inyección que arrastra (`CAR-004`, ~2.000 tokens repetidos por compactación, medidos).

Poner la lista como precondición en vez de como supuesto es lo que hizo que el error se
encontrara en un documento y no en producción.

### Lo que la verificación dejó a la vista

El harness usa 7 de los 33 eventos disponibles. Tres de los no usados son directamente
relevantes y van al backlog de diseño, no a este ADR:

| Evento | Para qué serviría |
|---|---|
| `SessionEnd` | La red de seguridad de §3 |
| `SubagentStop` | Los cinco subagentes escriben sin pasar por ningún tracker |
| `PreCompact` | Persistir estado *antes* de compactar, en vez de reconstruirlo después |

---

## Qué cierra

| Hallazgo | Cómo |
|---|---|
| `ACO-001` (S2) | La limpieza de ciclo `sesión` sale de `Stop` — a `SessionEnd`, y a `SessionStart` **solo con origen `startup`** |
| `CAR-002` (S2) | `notify()` con default «una vez» |
| `INC-007` (S2) | `/hotfix-close` explícito + `SessionEnd` como red |
| `INC-020` (**S1**) | Matcher explícito en `settings.json` y `cleanup({ source })`; ninguna limpieza destructiva en `resume`/`compact`/`fork` |
| `CAR-004` (S2) | `session-start` deja de correr en `compact`; la mitad de la duplicación desaparece con el matcher, el resto con `budget.js` |
| `HUE-004` (S2) | Al revisar `spec-reflection`, distinguir «no marcaste nada» de «no hay nada abierto» — hoy calla en los dos casos |

Y previene la cuarta instancia: con `lifetime` en el registro y `notify()` en el núcleo, un
hook nuevo tiene que **elegir** su ciclo de vida en vez de suponerlo.

---

## Riesgos

**1 · `/hotfix-close` es una regresión de comodidad.** Hoy el hotfix se cierra solo — mal,
pero solo. Se acepta, y `SessionEnd` la amortigua: un auto-cierre que dispara en el primer
turno deja `specs/.active` vacío mientras el trabajo sigue, y a partir de ahí el `spec-gate`
bloquea cada escritura pidiendo una spec que acaba de borrar. La comodidad actual es
aparente.

**2 · `SessionEnd` puede no correr.** Un proceso que muere no dispara nada. Por eso la
limpieza en `startup` no desaparece: solo deja de ser destructiva en los otros cuatro
orígenes. Estado huérfano de una sesión anterior se borra por antigüedad —el `cleanup()` de
`ADR-001` §1—, no por asumir que el evento llegó.

**3 · Los matchers son una superficie nueva de error silencioso.** Un matcher mal escrito no
falla: el hook simplemente no corre, que es el modo de fallo más caro de este repo —
`DEC-001` vivió así. Va cubierto por el test de `settings.json` contra la lista de eventos
válidos, en la tanda 1 de `ADR-001`.
