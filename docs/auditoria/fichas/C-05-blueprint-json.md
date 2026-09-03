# FICHA A — C-05 · blueprint.json

| | |
|---|---|
| **Archivo** | `blueprint.json` (raíz del proyecto generado) |
| **Contexto** | **A y B** — el único contrato que cruza los dos |
| **Bloque** | 0 contratos |
| **Revisado** | 2026-08-29 |
| **Estado** | cerrada |

---

## 1. Contrato

Declara cómo se materializó el scaffold (CLI) y con qué profundidad metodológica
(Wikiflow), y sirve de marca de "esto es un proyecto Koa".

**¿Coincide con lo que dice su propia documentación?**

Sí en el lado del generador: `lib/config.js` documenta los dos productores y por qué los
campos de Wikiflow son opcionales, y `writeBlueprintJson` implementa el merge que describe.

**No en el lado del harness.** Ninguna documentación menciona que `pre-write-guard.js`
lee este archivo y que **su contenido decide qué guardrails corren**. Para el harness,
`blueprint.json` no es trazabilidad: es configuración ejecutable.

## 2. Disparo

- **Productores:** `lib/scaffolder.js → writeBlueprintJson()` (CLI) y Wikiflow (externo).
- **Consumidores:**
  - `lib/preflight.js` — valida con `validateBlueprintJson()` si existe en el cwd
  - `lib/generator.js → checkKoaProject()` — su existencia habilita `generate feature`
  - **`pre-write-guard.js`** — `JSON.parse` crudo, spread de `bp.stack` en `STACK`
- **Precondiciones que asume:** que `stack.*` son booleanos reales.

**¿Puede no dispararse cuando debería?**

`validateBlueprintJson()` vive en `lib/` y **solo se invoca desde `preflight()`**, es
decir, cuando alguien corre el CLI. Un `grep` sobre todo el repo lo confirma: las únicas
referencias están en `lib/config.js` (definición), `lib/preflight.js` (uso) y un comentario
en `lib/scaffolder.js`. **Dentro del proyecto generado no se valida nunca.**

## 3. Fail mode

- **Actual:** fail-open en los tres consumidores.
- **¿Es la elección correcta acá?** **no** para `pre-write-guard.js`. Ahí el fail-open no
  significa "seguir sin la información": significa **seguir con información equivocada**,
  porque el `catch` deja el `STACK` por defecto y el spread no valida tipos.

```js
// pre-write-guard.js — el único punto donde el harness lee el blueprint
let STACK = { angular: true, tailwind: true, primeng: true, gsap: false, supabase: true };
try {
  const bp = JSON.parse(fs.readFileSync(bpPath, 'utf8'));
  if (bp.stack && typeof bp.stack === 'object') STACK = { ...STACK, ...bp.stack };
} catch { /* fail-open */ }
```

`STACK.supabase` y `STACK.gsap` se usan en seis puntos del guard (líneas 171, 225, 292,
457, 543, 556) para decidir si una violación se reporta y qué consejo se inyecta.

| Escenario | Comportamiento actual | ¿Correcto? |
|---|---|---|
| Sin `blueprint.json` | defaults razonables | sí |
| JSON corrupto | `catch` → defaults | sí |
| `stack.supabase: "false"` (string) | **truthy → el guard queda activo** | **no** |
| Clave con typo (`supabse`) | se ignora, queda el default `true` | **no** |
| `stack` como array | `typeof === 'object'` pasa; el spread produce claves `0,1,2…` | no |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

Sandbox con el Gate ya levantado, escribiendo un componente que importa Supabase
directamente (violación ARCH-01), variando solo `blueprint.json`:

```bash
PAYLOAD='{"tool_input":{"file_path":"src/app/features/x.component.ts",
          "content":"import { createClient } from \"@supabase/supabase-js\";..."}}'
for BP in '{"stack":{"supabase":true}}' '{"stack":{"supabase":false}}' \
          '{"stack":{"supabase":"false"}}' '{"stack":{"supabse":false}}'; do
  echo "$BP" > blueprint.json
  echo "$PAYLOAD" | node .claude/hooks/pre-write-guard.js
done
```

**Qué pasó:**

```
{"stack":{"supabase":true}}     → exit 2  🚨 ARCHITECT GUARD: violación detectada   ✔
{"stack":{"supabase":false}}    → exit 0  (correcto: sin Supabase no aplica)        ✔
{"stack":{"supabase":"false"}}  → exit 2  🚨 ARCHITECT GUARD                        ✘ truthy
{"stack":{"supabse":false}}     → exit 2  🔴 CIRCUIT BREAKER: 3 intentos bloqueados
```

El guard **sí** dispara ante la violación, y **sí** respeta un `false` booleano. Pero un
`"false"` en string o una clave mal escrita cambian qué reglas corren, sin ningún aviso —
en la dirección segura en este caso, en la insegura si el error va al revés
(`"stack": {"supabase": 0}` apagaría los guards de Supabase en un proyecto que sí lo usa).

Como subproducto, la cuarta corrida es **evidencia directa de que el circuit breaker
funciona**: al tercer bloqueo idéntico cambió el mensaje. Anotado para la ficha `H-04`.

**Veredicto:**
- [x] Dispara ante su violación — comprobado
- [x] Pero el contrato que la gobierna no se valida en el lado que lo consume → `HUE-005`

## 5. Depende de

| Artefacto / formato | Qué asume de él | ¿Declarado en templates-contract.md? |
|---|---|---|
| `stack.*` como booleanos | Se usan directamente en condicionales | **no** — el contrato ni se menciona en el harness |
| `scaffoldMode` (alias legacy `mode`) | Ambos aceptados al leer, solo `scaffoldMode` al escribir | sí, en `lib/config.js` |
| `managedPaths` | Derivado de `CLI_OWNED` para que no diverjan | sí, en `lib/scaffolder.js` |

## 6. Lo consumen

| Consumidor | Qué toma de acá | ¿Se rompe si cambio el formato? |
|---|---|---|
| `lib/preflight.js` | Todo, para validar y reportar | no: valida antes de usar |
| `lib/generator.js` | Solo su existencia | no |
| **`pre-write-guard.js`** | `stack.supabase`, `stack.gsap` | **sí, en silencio** |

**¿Alguien lo consume sin que esté declarado?**

Sí, y es el hallazgo central: **`pre-write-guard.js` no figura como consumidor en ninguna
documentación del contrato.** `templates-contract.md` no lo lista, `lib/config.js` habla
de dos productores pero no de este consumidor, y el mapa de `managedPaths` no incluye
`blueprint.json` entre las rutas que el CLI gestiona.

Consecuencia práctica: el schema (`BLUEPRINT_SCHEMA`, `validateBlueprintJson`) vive en el
contexto A y protege una lectura que ocurre en el contexto B, donde nunca corre. El
validador y el consumidor real están en mitades distintas del producto. → `HUE-005`

## 7. Cobertura

- **Test que lo cubre:** `test/scaffolder.test.mjs` cubre el lado del CLI. **Ningún test
  cubre la lectura desde `pre-write-guard.js`.**
- **¿El test ejecuta la ruta de fallo?** No pude ejecutar `test/scaffolder.test.mjs` en
  este contenedor: falla con `ERR_MODULE_NOT_FOUND: chalk`, porque `node_modules` no está
  instalado. Es un fallo de entorno, no del código; los 121 tests del harness
  (`templates/.claude/tests`) sí pasan. → re-comprobar en `G-06`.
- **¿Lo cubre `provocar-reglas.mjs`?** No.

## 8. Costo / beneficio

- **Qué cuesta:** un `readFileSync` + `JSON.parse` por cada Edit/Write, en el arranque del
  módulo. Despreciable.
- **Qué evita:** que el harness reporte violaciones de Supabase en un proyecto sin
  Supabase, o que sugiera GSAP donde se eligió View Transitions. Es adaptación real, no
  decoración.
- **Veredicto:** vale la pena — con la salvedad de que hoy es configuración ejecutable
  disfrazada de archivo de trazabilidad.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `HUE-005` | HUE | `blueprint.json` nunca se valida dentro del proyecto generado, y `pre-write-guard` usa su `stack` crudo para decidir qué guardrails corren |
| `INC-003` | INC | `pre-write-guard.js` no figura como consumidor del blueprint en ninguna documentación del contrato |

## Notas para el pase general

- **Es el único contrato que cruza los dos contextos**, y por eso su validador quedó del
  lado equivocado. Vale como principio general para la Lente 1: *un schema tiene que vivir
  donde se lee, no donde se escribe.*
- **Lente 2:** tres fuentes definen el stack —flags CLI, `koa-config.json`,
  `blueprint.json`— con precedencias distintas en cada punto de lectura. Está en la tabla
  de la Lente 2; esta ficha aporta que hay un cuarto lector (el guard) con su propio
  conjunto de defaults hardcodeado.
- **Evidencia reutilizable:** el circuit breaker de `pre-write-guard.js` quedó comprobado
  funcionando (3 bloqueos idénticos → cambio de mensaje). Llevar a la ficha `H-04`.
