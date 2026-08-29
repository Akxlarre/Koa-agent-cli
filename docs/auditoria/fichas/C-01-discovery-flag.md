# FICHA A — C-01 · Discovery flag

| | |
|---|---|
| **Archivo** | `$TMPDIR/koa-discovery-{sessionId}.flag` (formato, no archivo del repo) |
| **Contexto** | B (harness) |
| **Bloque** | 0 contratos |
| **Revisado** | 2026-08-29 |
| **Estado** | cerrada |

---

## 1. Contrato

Registra que el agente ya tiene los índices del proyecto en contexto, para que el
Discovery Gate lo deje escribir código.

**¿Coincide con lo que dice su propia documentación?**

**No.** `.claude/CLAUDE.md` lo describe como *«NO puedes escribir código en `src/app/` sin
antes tener los índices en contexto»* y el propio mensaje del Gate cierra con *«El bloqueo
se levantará automáticamente cuando leas cualquier archivo de indices/»*. Ninguna de las
dos afirmaciones es cierta: `discovery-tracker.js` también escribe el flag al leer
cualquier archivo de `context/`, y el Gate solo comprueba que el archivo **exista**, sin
mirar una sola línea de su contenido. → `HUE-001`

## 2. Disparo

- **Evento / invocación:** lo escriben `discovery-tracker.js` (PostToolUse Read) y
  `session-start.js` (SessionStart). Lo leen `pre-write-guard.js` (PreToolUse Edit) y
  `compact-recovery.js` (PostCompact).
- **Matcher o condición:** `filePath.includes('indices/') || filePath.includes('context/')`
- **Precondiciones que asume:** que `CLAUDE_SESSION_ID` esté seteada y que `os.tmpdir()`
  sea privado de la sesión. **Ninguna de las dos está garantizada.**

**¿Puede no dispararse cuando debería?**

Al revés: dispara **de más**. Y hay un problema mayor de identidad de sesión — los cinco
hooks derivan el id así:

```js
const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
```

Ningún hook lee `session_id` del payload de stdin, que es donde Claude Code lo entrega.
Sin la variable de entorno, todos los proyectos del equipo comparten
`$TMPDIR/koa-discovery-default.flag`. → `HUE-002`

## 3. Fail mode

- **Actual:** fail-open (todas las escrituras van en `try {} catch {}`)
- **¿Es la elección correcta acá?** discutible

Para el productor, fail-open es correcto: no poder escribir el flag no debería romper un
`Read`. Para el consumidor es al revés — si el flag no se puede escribir, el Gate queda
permanentemente cerrado y bloquea toda la sesión sin explicar por qué.

| Escenario | Comportamiento actual | ¿Correcto? |
|---|---|---|
| Input malformado / stdin vacío | `catch` silencioso, exit 0 | sí |
| Flag ausente | Gate bloquea con mensaje claro | sí |
| Flag presente pero vacío o corrupto | **Gate abre igual** — solo se comprueba `existsSync` | **no** → `HUE-001` |
| Error de filesystem al escribir | silencioso; el Gate queda cerrado sin causa visible | no |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

Sandbox con dos proyectos (`proyA`, `proyB`), `TMPDIR` propio y `CLAUDE_SESSION_ID` sin setear.

```bash
# T1 — Gate antes de leer nada
echo '{"tool_input":{"file_path":"src/app/features/x.component.ts","content":"x"}}' \
  | node .claude/hooks/pre-write-guard.js          # → exit 2 ✔ bloquea

# T2 — leer SOLO context/domain.md (ningún índice)
echo '{"tool_input":{"file_path":"context/domain.md"}}' \
  | node .claude/hooks/discovery-tracker.js
cat $TMPDIR/koa-discovery-default.flag
# → 2026-08-29T22:50:15.860Z | READ | context/domain.md

# T3 — Gate después
… | node .claude/hooks/pre-write-guard.js          # → exit 0 ✘ pasa

# T4 — proyB, que nunca leyó nada
cd ../proyB && … | node .claude/hooks/pre-write-guard.js   # → exit 0 ✘ pasa
```

**Qué pasó:**

- **T1** el Gate bloquea correctamente cuando no hay flag.
- **T3** leer `context/domain.md` — **cero índices** — levanta el Gate.
- **T4** un proyecto distinto, que nunca leyó nada, escribe código sin bloqueo, porque
  hereda el flag global del primero.
- **T5** ningún hook borra el flag (`grep unlink` solo encuentra `spec-reflection.js` y
  `sync-check.js`, para otros artefactos). El flag sobrevive a la sesión: la segunda
  sesión del día en la misma máquina arranca con el Gate ya levantado.

**Veredicto:**
- [x] Dispara ante su violación — comprobado (T1)
- [x] Pero se levanta con condiciones que no son la que promete → `HUE-001`, `HUE-002`

## 5. Depende de

| Artefacto / formato | Qué asume de él | ¿Declarado en templates-contract.md? |
|---|---|---|
| `process.env.CLAUDE_SESSION_ID` | Que existe y aísla la sesión | **no → `ACO`** (el contrato documenta el flag, no de dónde sale el id) |
| `os.tmpdir()` | Que es privado de la sesión | **no** |
| Formato de línea `… | READ | indices/NOMBRE.md` | Que contiene `indices/NOMBRE.md` parseable | sí |

## 6. Lo consumen

| Consumidor | Qué toma de acá | ¿Se rompe si cambio el formato? |
|---|---|---|
| `pre-write-guard.js` (Gate) | **solo `existsSync`** — nunca abre el archivo | no: es inmune al formato porque no lo lee |
| `compact-recovery.js` | `line.match(/indices\/([\w-]+)\.md/i)` por línea | **sí** — depende del formato exacto |

**¿Alguien lo consume sin que esté declarado?**

No, los dos consumidores están declarados. Lo que no está declarado es la asimetría: uno
depende del formato y el otro ni siquiera lo lee.

Además, `compact-recovery.js` solo conoce **10 de los 15 índices** en su
`ALL_INDEX_FILES`. Faltan `GUARDS`, `LAYOUTS`, `ROUTES`, `USAGE-MAP` y `UTILS`: aunque el
flag registre que el agente los leyó, nunca se re-inyectan tras una compactación.
`LAYOUTS.md` es especialmente llamativo porque el propio Gate lo ofrece en su lista de
archivos que levantan el bloqueo. → `HUE-003`

## 7. Cobertura

- **Test que lo cubre:** `pre-write-guard.test.js`, `session-start.test.js`,
  `compact-recovery.test.js` — ninguno para `discovery-tracker.js`
- **¿El test ejecuta la ruta de fallo, o solo el camino feliz?**

Los tests cubren que el Gate bloquea sin flag y que `session-start` lo escribe. **Ninguno
cubre las tres rutas encontradas acá**: levantar el Gate leyendo `context/`, la colisión
entre proyectos con `sessionId = 'default'`, y los cinco índices ausentes de
`ALL_INDEX_FILES`.

- **¿Lo cubre `provocar-reglas.mjs` o `smoke-scripts.mjs`?** No: ambos cubren el linter y
  los scripts de `package.json`, no los hooks.

## 8. Costo / beneficio

- **Qué cuesta:** un `appendFileSync` por cada `Read`. Despreciable en tiempo. El costo
  real es de contexto, y lo paga `session-start`/`compact-recovery` (~2.500 caracteres por
  índice), no el flag.
- **Qué evita:** que el agente escriba código duplicando artefactos que ya existen.
- **Veredicto:** vale la pena — el mecanismo es correcto y barato. Lo que falla es la
  condición que comprueba, no la idea.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `HUE-001` | HUE | El Gate solo comprueba que el flag exista; leer `context/` lo levanta sin ningún índice |
| `HUE-002` | HUE | `sessionId` sale de una env var con fallback `'default'`; ningún hook lee `session_id` del payload |
| `HUE-003` | HUE | `compact-recovery` conoce 10 de 15 índices; 5 nunca se re-inyectan |

## Notas para el pase general

- Los cinco hooks que derivan `sessionId` comparten el mismo defecto. Es una corrección
  única que toca cinco archivos: candidato a helper compartido. Cruzar en la **Lente 2**.
- El flag no se borra nunca. Contrastar con `C-02`, que se borra **demasiado**: dos
  contratos del mismo sistema con políticas de vida opuestas y ninguna deliberada.
- Para la **Lente 3**: `discovery-tracker.js` es uno de los hooks sin test.
