# FICHA A — A-01 a A-05 · Los cinco subagentes

| | |
|---|---|
| **Archivos** | `templates/.claude/agents/*.md` · **Contexto** B · **Bloque** 4 · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

Cinco roles con ventana de contexto propia que devuelven un resumen, para que el agente
principal no gaste su contexto en output que necesita una sola vez.

**¿Coincide con lo que dice su documentación?** Sí. `.claude/CLAUDE.md` los tabula con su
propósito y modelo, y cada `description` explica cuándo invocarlo. Es la capa mejor
documentada del harness.

## 2. Disparo y grants — la tabla real

```
arch-auditor      model=haiku   tools = Bash, Read, Grep
code-judge        model=opus    tools = Read, Grep, Glob
discovery-scout   model=haiku   tools = Read, Grep, Glob
index-syncer      model=haiku   tools = Bash, Read, Edit, Write, Grep, Glob
supabase-schema   model=haiku   tools = Read, Grep, Glob, Bash
```

**Los grants son mínimos y coherentes con cada rol:**

| Subagente | Por qué ese set |
|---|---|
| `discovery-scout` | Solo lee. No tiene por qué escribir ni ejecutar |
| `code-judge` | Solo lee — **y la ausencia de `Bash` es deliberada y está argumentada** |
| `arch-auditor` | `Bash` porque corre `lint:arch` y `tsc`; sin `Write` ni `Edit` |
| `supabase-schema` | `Bash` para listar migraciones; sin escritura |
| `index-syncer` | El único con `Edit`/`Write` — es el que arregla lo que `sync-check` detecta |

**La decisión que vale destacar** está escrita en `.claude/CLAUDE.md`:

> `code-judge` no tiene `Write`, `Edit` **ni `Bash`** — recibe el diff como archivo. Con
> `Bash` podría escribir usando `>`, y "el juez no arregla nada" pasaría a ser una promesa
> en vez de un hecho.

Es razonamiento de seguridad correcto sobre una capacidad indirecta, y es exactamente el
tipo de análisis que **no** se hizo en `post-edit.js` (`SEC-001`). El repo sabe hacerlo.

**La segunda decisión que vale:** `code-judge` usa `opus` mientras los otros cuatro usan
`haiku`, con el motivo escrito — *«un evaluador que razona igual que el generador no
detecta los errores del generador»*. Es una elección de arquitectura, no de presupuesto.

## 3. Fail mode

- **Actual:** no aplica en el sentido de los hooks. Un subagente no bloquea nada; devuelve
  un resumen o falla y el agente principal sigue.
- **El fail mode real es la *calidad* del resumen**, y eso no es verificable de forma
  determinista.

| Escenario | Comportamiento | ¿Correcto? |
|---|---|---|
| El subagente devuelve un volcado en vez de un veredicto | nadie lo detecta | inherente al medio |
| `arch-auditor` corre `lint:arch` y typescript falta | hereda `HUE-018`: stack trace | no |
| `index-syncer` corre `indices:sync` con caché corrupta | hereda `ACO-003` | no |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:** acá el campo obligatorio choca con el medio, y hay que
decirlo en vez de fingir.

Un subagente es un **prompt**, no un programa. No tiene ruta de fallo ejecutable: no se
puede armar un fixture que lo viole y comprobar que se niega. Lo único verificable de forma
determinista es su **frontmatter** —el grant de tools y el modelo— y eso sí se comprobó:

```bash
for f in templates/.claude/agents/*.md; do grep -m1 '^tools:' $f; done
```

Los cinco declaran `tools:` explícitamente. Ninguno omite el campo (lo que le daría acceso
completo por defecto). Ninguno pide más de lo que su rol necesita. **El grant mínimo se
cumple en los cinco.**

Lo que **no** se puede comprobar sin ejecutarlos contra un proyecto real y juzgar sus
respuestas:

- si `discovery-scout` devuelve un veredicto corto o vuelca archivos
- si `arch-auditor` comprime a lo accionable o repite el output crudo
- si `code-judge` juzga contra la rúbrica o improvisa

Eso es evaluación de calidad de prompt, no auditoría de mecanismo — y requiere un método
distinto (evals con casos de referencia), que hoy el repo no tiene.

**Veredicto:**
- [x] El grant de tools es mínimo y correcto — comprobado en los cinco
- [ ] La calidad del resumen no es verificable con este método → `HUE-023`

## 5. Depende de

| Artefacto | Quién | ¿Declarado? |
|---|---|---|
| `npm run lint:arch`, `npx tsc` | `arch-auditor` | sí, en su procedimiento |
| `.claude/temp/arch-last-failure.json` | `arch-auditor` lo lee | **no** — es el archivo de `S-02` |
| `npm run indices:sync` + `session-writes.json` | `index-syncer` | sí / ver `ACO-001` |
| `.claude/temp/review-diff.patch` | `code-judge` lo recibe, lo deja `/review` | **no → `ACO-011`** |
| `indices/*.md`, `context/domain.md` | `discovery-scout`, `code-judge` | sí |
| `supabase/migrations/*.sql` en orden cronológico | `supabase-schema` | sí, con la advertencia de no reordenar por nombre |

## 6. Lo consumen

| Consumidor | Qué toma |
|---|---|
| El agente principal | El resumen de los cinco |
| La skill `/review` | Invoca a `code-judge` y le deja el diff |
| El flujo de 5 pasos de `.claude/CLAUDE.md` | Nombra a `discovery-scout` (paso 1), `arch-auditor` (4) e `index-syncer` (5) |
| `.claude/rules/delegation.md` | Decide cuándo vale la pena delegar |

**`index-syncer` es el único que cierra un bucle**: `sync-check` detecta que los índices
quedaron atrás y este los arregla. Los otros cuatro son consultivos.

## 7. Cobertura

- **Test que los cubre:** ninguno, y no puede haberlo en el sentido habitual.
- **¿Los cubre `doc-links.test.js`?** Parcialmente: verifica que las referencias `archivo.md#ancla`
  del payload resuelvan, así que atrapa un subagente que apunte a un doc inexistente.
- **Lo que sí se podría verificar y nadie verifica:** que los comandos que cada procedimiento
  menciona (`npm run lint:arch`, `npm run indices:sync`) existan en el `package.json` que el
  scaffolder escribe. Es el mismo test barato que pide `HUE-009` para el cableado de hooks.
  → `HUE-024`

## 8. Costo / beneficio

- **Qué cuesta:** cada invocación es una llamada completa que arranca sin nada de lo que el
  agente principal ya sabe. `.claude/rules/delegation.md` lo dice: *«delegar no es gratis»*.
- **Qué evita:** que miles de tokens de output de compilador entren al contexto principal.
- **Veredicto:** vale la pena, y es de las decisiones de diseño más sólidas del harness.
  La existencia de una regla dedicada a *cuándo no delegar* es señal de que el trade-off se
  pensó.

**Nota de contexto:** con `CAR-001` abierto (`plan-injector` inyecta ~6.155 tokens por
Edit), el ahorro que consiguen los subagentes queda sobrepasado varias veces por una sola
sesión de edición. La economía de contexto del harness está bien pensada en esta capa y no
en la de inyección.

---

## Hallazgos de estas unidades

| ID | Tipo | Una línea |
|---|---|---|
| `HUE-023` | HUE | La calidad del resumen de los cinco subagentes no es verificable por ningún mecanismo del repo; haría falta un método de evals que hoy no existe |
| `HUE-024` | HUE | Nadie verifica que los comandos que los procedimientos mencionan existan en el `package.json` que el scaffolder escribe |
| `ACO-011` | ACO | `.claude/temp/review-diff.patch` es el canal entre `/review` y `code-judge` y no está declarado como contrato |

## Notas para el pase general

- **Es la capa más sana del harness.** Grants mínimos en los cinco, modelo elegido con
  criterio, y la única decisión de seguridad del repo que razona sobre capacidades
  indirectas (`code-judge` sin `Bash`).
- **Lente 1:** `review-diff.patch` y `arch-last-failure.json` son el séptimo y octavo
  artefacto compartido sin declarar. La segunda pasada de la Lente 1 ya tiene ocho.
- **Lente 4:** el ahorro de contexto de esta capa es real pero está anulado por `CAR-001`.
  Ponerlos juntos en la lente da la conclusión sobre el presupuesto.
- **Límite del método, registrado:** la ficha A no sirve para auditar prompts. Las 41
  unidades del nivel B —reglas, skills, comandos— son todas de esa naturaleza, y la ficha B
  ya está diseñada para eso (pregunta por disparo, vigencia y colisiones, no por ruta de
  fallo). Este bloque confirma que esa separación era correcta.
