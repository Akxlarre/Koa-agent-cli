# FICHA A — H-14 a H-19 · Cierre del bloque de hooks

> Seis unidades en una ficha, por una razón de método y no de comodidad: cuatro de las seis
> ya quedaron auditadas de hecho al revisar los contratos que producen o consumen
> (`spec-reflection` y `sync-check` en `C-02` y `C-03`, `validate-file-contains` en `C-03`),
> y las otras dos son hooks de <70 líneas. Repetir sus ocho campos completos habría sido
> transcripción, no auditoría. Cada unidad conserva su veredicto propio abajo.

| | |
|---|---|
| **Contexto** B · **Bloque** 1 · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## H-14 · `sdd/hotfix-autoclose.js` — Stop (1º)

**Contrato.** Si el track activo es un `hotfix-NNN`, lo marca `done` con fecha y limpia
`specs/.active`.

**Disparo y fail mode.** Fail-open declarado: *«si algo falla, no bloquea el cierre de
sesión»*. Correcto para un hook de limpieza.

**¿Puede fallar?** Verificado por lectura, no por ejecución. Comparte con los otros dos
hooks de `sdd/` la falta del cap SEC-04 (`HUE-010`) y la falta total de tests (`HUE-011`).

**El problema real es semántico y lo hereda de `ACO-001`:** `Stop` corre al final de **cada
respuesta**, no de la sesión. El docblock dice *«al terminar cada sesión»*, y su propio
nombre —«autoclose al terminar la sesión»— describe algo que el evento no garantiza. Un
hotfix se cierra al final del **primer turno** en que el agente responde, no cuando el
trabajo termina.

**Veredicto:** `INC-007`. Deuda: verificar por ejecución al cerrar `HUE-011`.

---

## H-15 · `spec-reflection.js` — Stop (2º)

Auditado en profundidad en `C-03` (task-spec). Resumen del veredicto:

- **Dispara correctamente** con casillas abiertas y al menos una marcada — comprobado.
- **`HUE-004`:** guarda silencio cuando `done === 0`, que es el caso que existe para
  atrapar.
- **`ACO-002`:** `spec-reflection-seen.json` es estado no declarado.
- **Cobertura:** `spec-reflection.test.js` ✔ — no cubre el caso `done === 0`.
- **Anti-bucle:** lo tiene, y es el **único** de los cuatro hooks de `Stop` que lo tiene.
  Ese contraste es lo que hace visible el problema de `H-17`.

**Veredicto:** cerrada en `C-03`. Sin hallazgos nuevos.

---

## H-16 · `sync-check.js` — Stop (3º)

Auditado en profundidad en `C-02` (session-writes). Resumen del veredicto:

- **`ACO-001`:** borra `session-writes.json` en **cada** `Stop` (por respuesta, no por
  sesión), dejando sin datos a los consumidores de turnos posteriores — comprobado
  ejecutando.
- **Duplica lógica** con `spec-reflection`: ambos calculan la misma comparación de `mtime`
  entre `writes` e `indices/`, con código casi idéntico, y este además borra el insumo del
  otro.
- **Cobertura:** ninguna. Aporta a `HUE-006`.

**Veredicto:** cerrada en `C-02`. Sin hallazgos nuevos.

---

## H-17 · `context-guardian.js` — Stop (4º)

**Contrato.** Al cerrar, pregunta si algo merece quedar en `context/learnings.md`; avisa si
lleva más de 14 días sin crecer.

**¿Puede fallar? · comprobado:**

```bash
touch -d '20 days ago' context/learnings.md
for i in 1 2 3; do node .claude/hooks/context-guardian.js; echo "cierre $i → exit=$?"; done
```

```
cierre 1 → exit=2
cierre 2 → exit=2
cierre 3 → exit=2
estado anti-bucle en el archivo: 0 referencias
```

**Avisa en cada respuesta, indefinidamente.** No tiene ninguna memoria de haber avisado —
`grep "seen\|tmpdir"` sobre el archivo devuelve 0 — y la condición (`mtime` de un archivo)
no cambia por el hecho de haber avisado. Una vez cruzados los 14 días, **todas** las
respuestas del agente terminan con el mismo bloque hasta que alguien toque el archivo.

El contraste está dentro del mismo evento: `spec-reflection.js`, que corre dos posiciones
antes, tiene anti-bucle explícito y su docblock explica por qué —*«sin esto el agente
responde, el hook lo frena, vuelve a responder, y el hook lo frena otra vez con lo mismo —
un bucle que quema tokens sin avanzar»*. El diagnóstico está escrito en la casa; este hook
no lo aplicó.

**Veredicto:** `CAR-002`. La pieza es correcta y su aviso es útil **una vez**.

---

## H-18 · `context-enrichment-guard.js` — opt-in, no cableado

**Contrato.** Day 0 Context Guard: bloquea escribir código mientras `context/domain.md` e
`indices/DATABASE.md` sigan siendo plantillas vacías.

**Estado.** Deliberadamente **no cableado**, y la razón está escrita en el propio archivo:
un proyecto recién generado trae esas plantillas vacías por diseño, así que cableado por
defecto bloquearía toda escritura desde el minuto cero. Las instrucciones de activación
están en el docblock.

Es el único hook del harness cuya **ausencia** del cableado está justificada por escrito.

**Hallazgos:** comparte `HUE-010` (sin cap SEC-04). Sin test — pero al no estar cableado, un
fallo suyo no afecta a nadie hasta que alguien lo active, y ahí es cuando lo descubriría.

**Veredicto:** cerrada, sin hallazgos propios.

---

## H-19 · `validators/validate-file-contains.js` — invocado desde skills

**Contrato.** Validador genérico parametrizado por flags: busca archivos por glob en un
directorio y exige substrings. No sabe nada del proyecto.

Auditado de hecho en `C-03`, donde es el consumidor que valida el formato del task-spec.

- **Dispara correctamente** con las cinco secciones presentes y ausentes — comprobado.
- **`INC-002`:** `--max-age 60` combinado con `--require-file` reporta «no existe ningún
  spec» cuando el spec existe pero lleva más de una hora sin tocarse.
- **Cobertura:** `validate-file-contains.test.js` ✔, con un caso explícito
  «contrato con /plan».

**Lo que merece registrarse aparte** es su diseño: es el único hook parametrizado del
harness —un validador, muchos usos— y su docblock explica la tesis del producto mejor que
ningún otro archivo: *«pedirle a un agente en prosa que "genera un archivo con estas
secciones" es una guideline, y las guidelines se ignoran. Esto la convierte en guardrail».*

Hoy lo usa **una sola skill** (`/plan`). Es capacidad instalada sin explotar, no un
problema.

**Veredicto:** cerrada en `C-03`. Sin hallazgos nuevos.

---

## Hallazgos de estas unidades

| ID | Tipo | Unidad | Una línea |
|---|---|---|---|
| `CAR-002` | CAR | `H-17` | `context-guardian` avisa en cada respuesta indefinidamente: sin anti-bucle, mientras `spec-reflection` sí lo tiene dos posiciones antes en el mismo evento |
| `INC-007` | INC | `H-14` | `hotfix-autoclose` dice cerrar «al terminar la sesión», pero `Stop` corre al final de cada respuesta: el hotfix se cierra en el primer turno |

## Notas para el pase general

- **Lente 4 — los cuatro hooks de `Stop`.** Esta ficha responde la pregunta que el bloque
  dejó abierta: sí se pisan. En una sesión con `learnings.md` viejo, task-spec abierto e
  índices atrasados, **tres de los cuatro emiten `exit 2` en el mismo cierre**, y solo uno
  tiene anti-bucle. Medirlo con números en la lente.
- **Lente 2 — la semántica de `Stop`.** Tres hallazgos independientes (`ACO-001`, `CAR-002`,
  `INC-007`) tienen la misma raíz: tres hooks distintos asumen que `Stop` significa «fin de
  sesión» cuando significa «fin de respuesta». No es un bug repetido, es un malentendido
  compartido sobre el evento. Probablemente sea una de las cinco conclusiones del pase
  general.
