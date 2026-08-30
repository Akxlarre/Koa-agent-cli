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

**La regla que se deriva:** *ningún hook de `Stop` borra estado de ciclo `sesión`.* La
limpieza es de `SessionStart`, que es el único evento que ocurre una vez por sesión.

Eso arregla `ACO-001` por construcción: `sync-check` deja de borrar el archivo del que
dependen `spec-diff-check` y el bloque de evidencia de `spec-reflection`.

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

Un hotfix se cierra cuando **el trabajo** termina, y `Stop` no sabe eso. Dos opciones:

| Opción | Qué implica |
|---|---|
| **(a) Mover a `SessionEnd`** | Correcto conceptualmente, **si el runtime expone ese evento**. Hay que verificarlo antes de comprometerse |
| **(b) Cerrar explícitamente** | `/hotfix-close`, simétrico con `/fix-close`, que ya existe |

**Propuesta: (b), y evaluar (a) como mejora.** `(b)` no depende de ninguna capacidad del
runtime, es simétrica con un comando que ya existe, y devuelve la decisión a quien sabe si
el trabajo terminó. El auto-cierre es la promesa que `INC-007` incumple; mejor un cierre
explícito que funciona que uno automático que dispara antes de tiempo.

Si el runtime expone `SessionEnd`, `(a)` se suma después sin contradecir a `(b)`.

---

## Lo que hay que verificar antes de implementar

Este ADR hace una afirmación sobre el runtime que la auditoría comprobó **por
comportamiento observado**, no leyendo la especificación de Claude Code:

- [ ] Confirmar que `Stop` corre por respuesta y no por sesión
- [ ] Confirmar si existe un evento de fin de sesión y cómo se llama
- [ ] Confirmar que `SessionStart` corre exactamente una vez por sesión

**Si alguna resulta falsa, este ADR cambia.** La evidencia actual es fuerte —el anti-bucle
de `spec-reflection` solo tiene sentido si `Stop` se repite, y lo medimos repitiéndose—
pero es inferencia, no documentación. Va anotado como precondición y no como supuesto.

---

## Qué cierra

| Hallazgo | Cómo |
|---|---|
| `ACO-001` (S2) | La limpieza de ciclo `sesión` se muda a `SessionStart` |
| `CAR-002` (S2) | `notify()` con default «una vez» |
| `INC-007` (S2) | Cierre explícito del hotfix |
| `HUE-004` (S2) | Al revisar `spec-reflection`, distinguir «no marcaste nada» de «no hay nada abierto» — hoy calla en los dos casos |

Y previene la cuarta instancia: con `lifetime` en el registro y `notify()` en el núcleo, un
hook nuevo tiene que **elegir** su ciclo de vida en vez de suponerlo.

---

## Riesgo

**El cambio de `hotfix-autoclose` a cierre explícito es una regresión de comodidad.** Hoy
el hotfix se cierra solo — mal, pero solo. Con `(b)` alguien tiene que escribir
`/hotfix-close`.

Se acepta: un auto-cierre que dispara en el primer turno deja `specs/.active` vacío
mientras el trabajo sigue, y a partir de ahí el `spec-gate` bloquea cada escritura pidiendo
una spec que acaba de borrar. La comodidad actual es aparente.
