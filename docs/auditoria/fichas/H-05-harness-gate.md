# FICHA A — H-05 · `harness-gate.js`

| | |
|---|---|
| **Archivo** | `templates/.claude/hooks/harness-gate.js` |
| **Contexto** | B (harness) · **Bloque** 1 hooks · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

Vigila las ediciones al **propio harness**: que una lección guardada sea un principio
reutilizable y no la receta de un track, y que la lógica determinista viva en código y la
prosa en prosa.

**¿Coincide con lo que dice su propia documentación?**

Sí en el alcance y en la intención, que además está bien argumentada (inspirada en
HarnessCompass). La exclusión deliberada de `specs/**` —*«ahí los track IDs SON el
contenido legítimo»*— es una distinción fina y correcta.

Lo que la documentación no dice es **cuán fácil es satisfacer el gate A1**.

## 2. Disparo

- **Evento:** `PreToolUse` sobre `Edit|Write|MultiEdit`, **tercero de cuatro**.
- **Superficie de guía:** `context/learnings.md`, `indices/ANTI-PATTERNS.md`,
  `.claude/rules/*.md`, cualquier `CLAUDE.md`.
- **Superficie de capacidad:** `scripts/*.js` (excepto `architect.js`), `.claude/scripts/*.js`.
- Si el archivo no cae en ninguna, `exit 0` inmediato.

**¿Puede no dispararse cuando debería?**

Sí, y es el hallazgo principal. `GATE-A1` bloquea cuando hay un track ID **y no hay**
marcador de generalización. El marcador se define así:

```js
/\b(cuando|siempre que|nunca|cada vez que|toda vez que|regla:|criterio|aplicabilidad|
   aplica cuando|no aplica|excepci[oó]n|independientemente de)\b/i
```

`cuando` y `nunca` son dos de las palabras más frecuentes de cualquier prosa técnica en
español. El gate se satisface con que aparezcan **en cualquier lugar del texto**, sin
ninguna relación con el criterio de aplicabilidad.

## 3. Fail mode

- **Actual:** fail-closed en las violaciones, fail-open en el `catch`.
- **¿Es la elección correcta acá?** Sí. Un gate sobre la memoria del harness debe ser
  ruidoso: lo que se cuela acá se replica en cada sesión futura.

| Escenario | Comportamiento | ¿Correcto? |
|---|---|---|
| Archivo fuera de ambas superficies | `exit 0` | sí |
| `new_string` vacío (borrado) | `exit 0` — no valida borrados | discutible |
| Receta con la palabra «cuando» | **pasa** | **no** → `DEC-002` |
| Regla que documenta un hook | **bloquea** (falso positivo) | **no** → `HUE-013` |
| stdin >10 MB | `exit 0` con mensaje a stderr | sí — es el único que lo explica |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

```bash
# A · receta pura: cita un track, sin ningún criterio
'{"file_path":".claude/rules/architecture.md",
  "new_string":"En fix-042 el boton no andaba. Le puse un margin-top de 4px."}'
# B · LA MISMA receta con la palabra "cuando" metida en cualquier lado
  "new_string":"En fix-042 el boton no andaba cuando lo probamos. Le puse un margin-top de 4px."
# C · una regla que DOCUMENTA un hook
  "new_string":"El hook lee el archivo con fs.readFileSync(ruta) y sale con process.exit(2) si falta."
```

**Qué pasó:**

```
A → exit 2  🧭 HARNESS GATE  ✔ atrapa la receta
B → exit 0                   ✘ la misma receta pasa por una palabra
C → exit 2  🧭 HARNESS GATE  ✘ falso positivo: documentar un hook queda bloqueado
```

Y midiendo la frecuencia del marcador en el contenido real del template:

```
12 de 15 reglas ya contienen un marcador de generalización
```

O sea: **el `GATE-A1` se satisface por defecto en el 80% de la superficie que vigila.**
Detecta el caso patológico puro —una receta escrita en telegrama— y nada más. → `DEC-002`

Sobre el falso positivo `GATE-B1`: verifiqué que **ninguna** regla actual del template ni
`.claude/rules/templates-contract.md` de este repo lo dispara hoy. Es un riesgo latente,
no un problema activo, y por eso queda en `S3` y no más arriba. Pero es exactamente el
patrón que aparecería al documentar el sistema de hooks dentro de una regla — que es lo
que el propio repo hace en `templates-contract.md`.

**Veredicto:**
- [x] Dispara ante su violación — solo en el caso puro
- [x] `GATE-A1` es trivialmente evitable → `DEC-002`
- [x] `GATE-B1` tiene falso positivo latente → `HUE-013`

## 5. Depende de

| Artefacto / formato | Qué asume | ¿Declarado? |
|---|---|---|
| Rutas de las superficies de guía | Regex sobre la ruta | sí, en el docblock |
| Nada más | **No lee ningún archivo del proyecto** | — |

Es el único hook del harness **sin dependencias de filesystem**: decide solo con la ruta y
el contenido que le llegan. Eso lo hace el más testeable y el más robusto de los seis
revisados en este bloque.

## 6. Lo consumen

| Consumidor | Qué toma | ¿Se rompe si cambio el formato? |
|---|---|---|
| El agente | stderr del bloqueo | no |
| `harness-gate.test.js` | 11 tests de comportamiento | sí |

## 7. Cobertura

- **Test que lo cubre:** `harness-gate.test.js` ✔ — 11 tests, la suite más grande del
  harness para un solo hook.
- **¿El test ejecuta la ruta de fallo?** Sí, y bien. Pero **ningún test cubre el caso B**:
  que el marcador de generalización se satisface con una palabra suelta. Los tests
  comprueban que el gate bloquea lo que debe bloquear; ninguno comprueba que **no** se
  pueda evadir. Es la diferencia entre testear un guardrail y provocarlo.

## 8. Costo / beneficio

- **Qué cuesta:** dos regex sobre el contenido, solo en archivos de guía o scripts. Cero
  contexto inyectado.
- **Qué evita:** en teoría, que el harness acumule recetas en vez de principios. En la
  práctica, solo las recetas más burdas.
- **Veredicto:** vale la pena **como esqueleto**. Hoy el beneficio real es menor que el que
  su documentación sugiere, y esa brecha entre lo prometido y lo entregado es el problema:
  induce a confiar en un filtro que casi no filtra.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `DEC-002` | DEC | `GATE-A1` se satisface con que aparezca «cuando» o «nunca» en cualquier lugar del texto; 12 de 15 reglas reales ya lo cumplen sin haberlo intentado |
| `HUE-013` | HUE | `GATE-B1` bloquea una regla que documenta un hook (menciona `fs.readFileSync`/`process.exit`); latente, no activo hoy |

## Notas para el pase general

- **Lente 3:** este hook tiene la mejor cobertura del harness (11 tests) y aun así su
  evasión más obvia no está cubierta. Sirve para afinar la pregunta de la lente: no es
  «¿hay test?» sino «¿algún test intenta **evadir** el guardrail?».
- El contraste con `provocar-reglas.mjs` es directo: ese script existe precisamente para
  hacer esa pregunta sobre el linter, y nadie la hace sobre los hooks.
- **Lente 2:** `harness-gate` y `pre-write-guard` (capa 1) protegen superficies distintas
  del mismo sistema sin coordinación: la capa 1 protege `.claude/hooks/` y `settings.json`;
  este protege `.claude/rules/` y los scripts. Ninguno cubre `.claude/skills/` ni
  `.claude/agents/`, que también son harness.
