# FICHA A — H-04 · `pre-write-guard.js`

| | |
|---|---|
| **Archivo** | `templates/.claude/hooks/pre-write-guard.js` (607 líneas — el hook más grande) |
| **Contexto** | B (harness) · **Bloque** 1 hooks · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

Cuatro capas antes de cada escritura: proteger los archivos del propio sistema, exigir
índices en contexto, validar la arquitectura del contenido nuevo e inyectar contexto según
el tipo de archivo. Más un circuit breaker sobre todo lo anterior.

**¿Coincide con lo que dice su propia documentación?**

Sí en la estructura de cuatro capas. **No en la capa 2**, el Discovery Gate: promete
exigir índices y solo comprueba que exista un archivo flag que también escribe la lectura
de `context/` (ver `HUE-001`, ficha `C-01`).

## 2. Disparo

- **Evento:** `PreToolUse` sobre `Edit|Write|MultiEdit`, **segundo de cuatro**.
- **Alcance por capa:**

| Capa | Alcance |
|---|---|
| 1 · File Protection | `.claude/hooks/`, `settings.json`, `architect.js` |
| 2 · Discovery Gate | `src/app/` (sin `.spec.ts`) + `supabase/migrations/` |
| 3 · Architect Guard | `src/app/**` `.ts`/`.html`; A11Y solo `.html`; SCSS en `src/**` |
| 4 · Context Injection | 11 categorías según ruta, con dedup por sesión |

**¿Puede no dispararse cuando debería?**

Sí, un caso con consecuencia real: **el chequeo de `OnPush` solo corre con `Write`**, no
con `Edit`:

```js
toolName === 'Write' && normalizedPath.endsWith('.component.ts') && …
```

La justificación es razonable —un `Edit` ve un fragmento, no el archivo entero— pero
significa que un componente creado por partes con `Edit` nunca pasa por ese chequeo. Queda
cubierto después por `ARCH-04` en `architect.js`, así que es una capa de red, no un hueco.

## 3. Fail mode

- **Actual:** fail-closed en las capas 1-3 (`exit 2`), fail-open en el `catch` general.
- **¿Es la elección correcta acá?** Sí. Y la capa 1 es la decisión más importante del
  harness entero: **el agente no puede editar los archivos que lo frenan.**

| Escenario | Comportamiento | ¿Correcto? |
|---|---|---|
| Sin `blueprint.json` | defaults de `STACK` razonables | sí |
| `blueprint.json` con `stack` de tipos raros | spread crudo, sin validar | **no** → `HUE-005` |
| Flag de discovery vacío | Gate abre igual (solo `existsSync`) | **no** → `HUE-001` |
| Mismo bloqueo 3 veces | circuit breaker cambia el mensaje | sí |
| stdin >10 MB | `exit 0` (tiene cap SEC-04) | sí |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

```bash
# Capa 2 — Gate sin flag
… src/app/features/x.component.ts …        → exit 2  🔍 DISCOVERY GATE          ✔
# Capa 3 — import de Supabase en features/ (con el Gate levantado)
content: 'import { createClient } from "@supabase/supabase-js"; …'
                                            → exit 2  🚨 ARCHITECT GUARD         ✔
# Capa 3 desactivada por stack
blueprint.json {"stack":{"supabase":false}} → exit 0  (correcto: no aplica)      ✔
# Circuit breaker — misma violación, tercera vez
                                            → exit 2  🔴 CIRCUIT BREAKER: 3 intentos
```

**Qué pasó:**

Las tres capas comprobadas disparan ante su violación, y el **circuit breaker funciona**:
al tercer bloqueo idéntico el mensaje cambia de «así se arregla» a «pará y escalá al
humano». Es de las pocas piezas del harness que hace exactamente lo que promete, hasta el
detalle del umbral.

Lo que la capa 3 **no** puede hacer, por diseño, es ver más allá del fragmento que recibe.
Es regex sobre `new_string`/`content`: un `*ngIf` insertado por `Edit` en una línea que el
hook no recibe pasa limpio. Está declarado como «validación rápida» y `architect.js` cubre
el resto sobre el AST. No es un hallazgo, es la división de trabajo.

**Lo que sí es un hallazgo** salió al mapear los códigos: la capa 3 emite `ARCH-12`,
`ARCH-13`, `A11Y-01`, `A11Y-02`, `LLM-01` y `LLM-02` — códigos del **mismo namespace** que
usa `architect.js`, pero implementados acá. Ver `INC-001` reescrito.

**Veredicto:**
- [x] Dispara ante su violación — comprobado en capas 2, 3 y el breaker
- [ ] Capas 1 y 4 verificadas por lectura, no por ejecución → deuda menor

## 5. Depende de

| Artefacto / formato | Qué asume | ¿Declarado? |
|---|---|---|
| Discovery flag (`C-01`) | Su existencia = índices leídos | sí, pero mal (ver `HUE-001`) |
| `blueprint.json` → `stack` (`C-05`) | Booleanos reales | **no → `INC-003`** |
| `$TMPDIR/koa-breaker-{sessionId}.json` | Contador de bloqueos | **no → `ACO-007`** |
| `$TMPDIR/koa-ctx-{categoría}-{sessionId}.flag` | 11 flags de dedup de inyección | **no → `ACO-007`** |
| `.claude/temp/LESSONS_LEARNED.md` | Su existencia, para mencionarlo | **no** |

## 6. Lo consumen

| Consumidor | Qué toma | ¿Se rompe si cambio el formato? |
|---|---|---|
| El agente | `additionalContext` de la capa 4 y el stderr de los bloqueos | no |
| `pre-write-guard.test.js` | Comportamiento de las capas | sí |

Es un hook terminal: nadie depende de su salida. Su riesgo es de **entrada** —depende de
tres artefactos que no están declarados— y de **volumen**.

## 7. Cobertura

- **Test que lo cubre:** `pre-write-guard.test.js` ✔ — cubre `ARCH-13` explícitamente.
- **¿El test ejecuta la ruta de fallo?** Sí para las reglas cubiertas. Pero son **607
  líneas con ~20 reglas** en la capa 3 y 11 categorías en la capa 4: la cobertura es real
  pero parcial, y no hay forma de saber cuáles quedan sin test sin enumerarlas.
  → deuda para la Lente 3: hacer la sub-tabla regla por regla, como en `S-01`.
- **¿Lo cubre `provocar-reglas.mjs`?** **No** — y ahí está lo grave. Ese script provoca las
  reglas de `architect.js`. Las ~20 reglas regex de este hook **no tienen equivalente de
  provocación**: nadie comprueba que puedan fallar. → `HUE-012`

## 8. Costo / beneficio

- **Qué cuesta:** la capa 4 inyecta contexto por categoría, **una vez por categoría y por
  sesión** gracias al dedup por flag. El bloque de `features/` son ~13 líneas. Acotado.
- **Qué evita:** es la pieza central del producto. Sin ella el harness es documentación.
- **Veredicto:** vale la pena, con distancia. El dedup por categoría está bien pensado —
  contrastar con `plan-injector`, que no lo tiene.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `HUE-012` | HUE | Las ~20 reglas regex de la capa 3 no las cubre `provocar-reglas.mjs`; nadie comprueba que puedan fallar |
| `ACO-007` | ACO | `koa-breaker-*.json` y los 11 `koa-ctx-*.flag` son estado persistente no declarado, con el `sessionId` global de `HUE-002` |

## Notas para el pase general

- **Lente 3:** `HUE-012` es la respuesta a la pregunta «¿quién audita a los auditores?»
  aplicada al revés: `provocar-reglas.mjs` cubre el linter AST y deja fuera al guard regex,
  que es el que corre **en cada escritura**. La mitad del sistema de reglas no está
  provocada.
- **Lente 2:** el `STACK` por defecto está hardcodeado acá y es una cuarta fuente de verdad
  sobre el stack (junto a flags CLI, `koa-config.json` y `blueprint.json`).
- Evidencia del circuit breaker reutilizable: quedó comprobado durante `C-05`.
