# FICHA A — H-02 · `prompt-context.js`

| | |
|---|---|
| **Archivo** | `templates/.claude/hooks/prompt-context.js` |
| **Contexto** | B (harness) · **Bloque** 1 hooks · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

Antes de cada prompt del humano, re-inyecta solo lo que se degrada dentro de una sesión:
el `## Out of scope` del brief y las casillas pendientes del task-spec, con dedup.

**¿Coincide con lo que dice su propia documentación?**

Sí. El docblock es explícito sobre lo que **no** hace —repetir los índices que ya inyectó
`session-start`— y por qué: *«repetir 2 KB de índices en cada turno sería la forma más
cara posible de no aportar nada»*. Es el único hook que declara su presupuesto como
argumento de diseño.

## 2. Disparo

- **Evento:** `UserPromptSubmit`, sin matcher. Corre en **todos** los prompts.
- **Condición de inyección:** `shouldInject()` — bloque nunca visto, contenido cambiado, o
  `REPEAT_EVERY = 8` prompts desde la última vez.
- **Precondiciones:** `context/brief.md` con una sección `## Out of scope` no vacía;
  un task-spec con casillas abiertas.

**¿Puede no dispararse cuando debería?**

El estado de dedup vive en `$TMPDIR/koa-prompt-ctx-${sessionId}.json`, con el mismo
`sessionId` defectuoso de `HUE-002`. Con el fallback `'default'`, **el contador de prompts
y los hashes de contenido se comparten entre proyectos**: un bloque ya inyectado en el
proyecto A puede quedar silenciado en el proyecto B durante 8 prompts.

## 3. Fail mode

- **Actual:** fail-open absoluto. `emit()` entero envuelto en `try/catch`, `exit 0` siempre.
- **¿Es la elección correcta acá?** Sí, sin discusión: bloquear el prompt de un humano por
  un fallo de un hook informativo sería inaceptable. El docblock lo dice: *«este hook
  informa, nunca bloquea un prompt del humano»*.

| Escenario | Comportamiento | ¿Correcto? |
|---|---|---|
| Sin `brief.md` o sin `## Out of scope` | no inyecta ese bloque | sí |
| Sección presente pero solo comentarios HTML | `extractSection` devuelve `null` | sí |
| Estado corrupto en TMPDIR | `catch` → arranca de `{n:0, blocks:{}}` | sí |
| stdin >10 MB | `exit 0` (tiene el cap SEC-04) | sí |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

El caso interesante es `extractSection`, porque el propio código documenta un filo que ya
mordió: JavaScript no tiene `\Z` y `$` con la flag `m` significa fin de **línea**, así que
un regex con lookahead capturaría vacía la última sección del archivo — que es justo donde
suele estar `## Out of scope`. Por eso itera por líneas.

```bash
# brief con "## Out of scope" como ÚLTIMA sección del archivo
printf '# Brief\n\n## Objetivo\nx\n\n## Out of scope\n- no tocar auth\n' > context/brief.md
echo '{}' | node .claude/hooks/prompt-context.js
```

**Qué pasó:**

Inyecta correctamente el bloque `[FUERA DE ALCANCE esta sesión]` con la última sección del
archivo. La defensa contra el filo del regex **está implementada y funciona**: es un caso
donde el harness aprendió de un error y lo dejó escrito.

La segunda corrida del mismo comando no inyecta nada (dedup activo), y al cambiar el
contenido del brief vuelve a inyectar. Las tres ramas de `shouldInject` responden.

Cuarto caso comprobado: una sección `## Out of scope` que solo contiene
`<!-- completar -->` no se inyecta — el `replace` de comentarios HTML antes de medir
evita que la plantilla sin llenar entre al contexto como si fuera contenido.

**Veredicto:**
- [x] Dispara ante su violación — comprobado, incluido el caso de la última sección

## 5. Depende de

| Artefacto / formato | Qué asume | ¿Declarado? |
|---|---|---|
| `## Out of scope` — encabezado literal en `brief.md` | Regex `/^##\s*Out of scope\b/i` | sí, en `templates-contract.md` |
| Task-spec `C-03` | Casillas `- [ ]` | sí |
| `$TMPDIR/koa-prompt-ctx-{sessionId}.json` | Estado de dedup | **no → `ACO-006`** |
| `process.env.CLAUDE_SESSION_ID` | Aislamiento de sesión | **no** — ver `HUE-002` |

## 6. Lo consumen

| Consumidor | Qué toma | ¿Se rompe si cambio el formato? |
|---|---|---|
| El agente (`additionalContext`) | Los dos bloques | no |

Es un hook terminal: nadie depende de su salida más que el agente. Eso lo hace de bajo
riesgo estructural — su único acoplamiento peligroso es hacia arriba (el formato del brief
y del task-spec), no hacia abajo.

## 7. Cobertura

- **Test que lo cubre:** `prompt-context.test.js` ✔
- **¿El test ejecuta la ruta de fallo?** Sí: cubre la extracción de la última sección
  —el filo del regex— y el dedup. Es el hook con la mejor relación entre riesgo real y
  cobertura del harness.
- **Lo que no cubre:** la constante `REPEAT_EVERY = 8`, ni el comportamiento con el estado
  compartido entre proyectos.

## 8. Costo / beneficio

- **Qué cuesta:** corre en **cada prompt**, pero solo emite cuando `shouldInject` da true.
  El techo por inyección es el `## Out of scope` (decenas de líneas) más las casillas
  abiertas. Con `REPEAT_EVERY = 8`, un bloque estable se paga una vez cada ocho turnos.
- **Qué evita:** que el agente se salga de alcance a mitad de sesión, que es el olvido más
  caro porque nada en la conversación lo corrige.
- **Veredicto:** vale la pena, y es el modelo de cómo debería pensarse el costo en el resto
  del harness. Contrastar con `H-06` (`plan-injector`), que inyecta ~6.000 tokens en cada
  Edit sin ningún dedup: la misma casa, dos criterios opuestos.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `ACO-006` | ACO | El estado de dedup `koa-prompt-ctx-{sessionId}.json` no está declarado, y hereda el `sessionId` global de `HUE-002` |

## Notas para el pase general

- **Lente 4:** este hook y `plan-injector` son los dos extremos del presupuesto de
  contexto. Ponerlos lado a lado es probablemente la conclusión más útil de esa lente.
- **Lente 2:** tres hooks leen las casillas del task-spec con la misma regex
  (`session-start`, `prompt-context`, `compact-recovery`) y un cuarto la reimplementa
  (`spec-reflection`, que además cuenta las `[x]`). Cuatro copias del mismo parser.
