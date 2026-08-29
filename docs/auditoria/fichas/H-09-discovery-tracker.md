# FICHA A — H-09 · `discovery-tracker.js`

| | |
|---|---|
| **Archivo** | `templates/.claude/hooks/discovery-tracker.js` · **Contexto** B · **Bloque** 1 · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

Registra en el discovery flag cada lectura de `indices/` o `context/`, y avisa si
`context/brief.md` está viejo cuando el agente lo lee.

**¿Coincide con lo que dice su propia documentación?**

**No.** El docblock dice *«rastrea cuando Claude lee archivos de `indices/`»* y describe el
flujo entero en esos términos. El código también escribe el flag ante cualquier lectura de
`context/`:

```js
if (filePath.includes('indices/') || filePath.includes('context/')) { … }
```

Esa segunda condición no aparece en el docblock, ni en `.claude/CLAUDE.md`, ni en el
mensaje del Gate. Es el origen de `HUE-001`.

## 2. Disparo

- **Evento:** `PostToolUse` sobre `Read`.
- **Condición:** la ruta contiene `indices/` **o** `context/`.
- **Segunda función, no anunciada en el nombre:** si el archivo leído es
  `context/brief.md`, calcula la frescura y escribe un aviso a stdout si supera 7 días.

**¿Puede no dispararse cuando debería?**

`filePath.includes('indices/')` es substring sobre la ruta, así que un `Read` de
`docs/mis-indices/algo.md` también levantaría el Gate. Es teórico, pero muestra que el
criterio es laxo por partida doble.

## 3. Fail mode

- **Actual:** fail-open total; `catch` silencioso y `exit 0` siempre.
- **¿Es la elección correcta acá?** Sí. Un tracker que rompe un `Read` sería inaceptable.

| Escenario | Comportamiento | ¿Correcto? |
|---|---|---|
| Ruta fuera de `indices/`/`context/` | no escribe | sí |
| No puede escribir el flag | silencioso; el Gate queda cerrado | sí, conservador |
| `brief.md` sin `**last_updated:**` | no avisa | sí |
| stdin >10 MB | `exit 0` (tiene cap SEC-04) | sí |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:** verificado en `C-01`.

```bash
echo '{"tool_input":{"file_path":"context/domain.md"}}' | node .claude/hooks/discovery-tracker.js
cat $TMPDIR/koa-discovery-default.flag
# → 2026-08-29T22:50:15.860Z | READ | context/domain.md
```

**Qué pasó:**

Escribe la entrada con el formato correcto. Y **levanta el Discovery Gate sin que se haya
leído un solo índice**, que es exactamente lo que promete no hacer.

Un detalle de diseño que sí funciona bien: la línea contiene la ruta completa, así que
`compact-recovery.js` puede filtrar solo las de `indices/` con su regex y las de `context/`
no le ensucian la re-inyección. El formato aguanta las dos semánticas; lo que no aguanta es
el consumidor que solo mira si el archivo existe.

**Veredicto:**
- [x] Hace lo que el código dice — comprobado
- [x] No hace lo que la documentación dice → `HUE-001` (registrado en `C-01`)

## 5. Depende de

| Artefacto / formato | Qué asume | ¿Declarado? |
|---|---|---|
| Discovery flag (`C-01`) | Lo escribe | sí |
| `**last_updated:** YYYY-MM-DD` en `brief.md` | Regex exacta | **no → `ACO-005`** |
| `process.env.CLAUDE_SESSION_ID` | Aislamiento | **no → `HUE-002`** |

## 6. Lo consumen

| Consumidor | Qué toma | ¿Se rompe si cambio el formato? |
|---|---|---|
| `pre-write-guard.js` (Gate) | Solo `existsSync` del flag | no |
| `compact-recovery.js` | Parsea `indices/NOMBRE.md` por línea | **sí** |

## 7. Cobertura

- **Test que lo cubre:** **ninguno.** No existe `discovery-tracker.test.js`.
- **¿El test ejecuta la ruta de fallo?** No hay test. Es el productor de uno de los cinco
  contratos y no tiene cobertura. → aporta a `HUE-006`.

## 8. Costo / beneficio

- **Qué cuesta:** un `appendFileSync` por `Read` que matchee. El flag crece durante toda la
  sesión y nunca se borra (`HUE-002`), pero son decenas de líneas: irrelevante en disco.
- **Qué evita:** que el Gate bloquee a quien ya hizo el descubrimiento.
- **Veredicto:** vale la pena. El mecanismo es correcto; el problema está en el consumidor.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `INC-006` | INC | El docblock describe solo `indices/`; el código también escribe el flag ante cualquier lectura de `context/` |

## Notas para el pase general

- **Lente 2:** con `session-start.js` son dos productores del mismo flag con criterios
  distintos (uno por lectura, otro por inyección). La duplicación está en la tabla de la
  Lente 2 desde el principio; esta ficha confirma que los criterios efectivamente difieren.
- El hook hace **dos cosas** (rastrear + auditar frescura del brief) y su nombre anuncia
  una. La segunda duplica lógica con `session-start.js`, que hace el mismo cálculo de
  7 días con la misma regex.
