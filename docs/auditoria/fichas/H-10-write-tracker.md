# FICHA A — H-10 · `write-tracker.js`

| | |
|---|---|
| **Archivo** | `templates/.claude/hooks/write-tracker.js` · **Contexto** B · **Bloque** 1 · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

Anota en `session-writes.json` cada archivo fuente Angular escrito, para que las auditorías
de cierre cuesten O(archivos) y no O(tokens de conversación).

**¿Coincide con lo que dice su propia documentación?**

Sí, y el argumento del docblock —*«ventaja: O(archivos) vs O(tokens de conversación)»*— es
correcto y es la mejor idea estructural del harness.

## 2. Disparo

- **Evento:** `PostToolUse` sobre `Edit|Write|MultiEdit`.
- **Filtro:**

```js
filePath.includes('src/app/') && !filePath.endsWith('.spec.ts') &&
(filePath.endsWith('.ts') || filePath.endsWith('.html') || filePath.endsWith('.scss'))
```

**¿Puede no dispararse cuando debería?**

Sí, tres huecos de captura, todos deliberados y ninguno documentado:

| No captura | Consecuencia |
|---|---|
| `supabase/migrations/**` | El Discovery Gate **sí** lo trata como código fuente; una migración nueva nunca entra en la auditoría de cierre |
| `src/app/**/*.spec.ts` | Una sesión de solo tests deja el tracker vacío |
| `scripts/`, `indices/`, `context/` | Fuera de alcance por diseño |

El primero es el que importa: dos hooks del mismo sistema discrepan sobre si una migración
es código fuente.

## 3. Fail mode

- **Actual:** fail-open; `catch` silencioso.
- **¿Es la elección correcta acá?** Sí — es un tracker, no un gate.

| Escenario | Comportamiento | ¿Correcto? |
|---|---|---|
| `session-writes.json` corrupto | `catch { writes = [] }` y sobrescribe | aceptable, aunque pierde el historial |
| Archivo ya en la lista | no duplica | sí |
| `.claude/temp/` no existe | lo crea | sí |
| stdin >10 MB | `exit 0` (tiene cap SEC-04) | sí |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:** verificado indirectamente en `C-02`, donde el tracker
se pobló a mano y los consumidores lo leyeron. El productor en sí:

```bash
echo '{"tool_input":{"file_path":"src/app/features/a.component.ts"}}' \
  | node .claude/hooks/write-tracker.js
cat .claude/temp/session-writes.json     # → ["src/app/features/a.component.ts"]
echo '{"tool_input":{"file_path":"src/app/features/a.spec.ts"}}' | …
cat .claude/temp/session-writes.json     # → sin cambios (exento)
```

**Qué pasó:**

Captura lo que dice capturar y exime lo que dice eximir. El hook es correcto.

**Su problema no es propio: es que `sync-check` le borra el archivo en cada `Stop`**
(`ACO-001`). El productor funciona; el ciclo de vida del artefacto que produce está roto
por otro hook.

**Veredicto:**
- [x] Dispara ante su violación — comprobado

## 5. Depende de

| Artefacto / formato | Qué asume | ¿Declarado? |
|---|---|---|
| `.claude/temp/session-writes.json` (`C-02`) | Array plano de rutas | sí |
| `process.cwd()` = raíz del proyecto | — | no |

## 6. Lo consumen

Los cuatro consumidores de `C-02`: `sync-check`, `spec-reflection`, `spec-diff-check`,
`index-syncer`. Ver esa ficha.

## 7. Cobertura

- **Test que lo cubre:** **ninguno.** No existe `write-tracker.test.js`. → `HUE-006`.

## 8. Costo / beneficio

- **Qué cuesta:** un read+write de JSON por edición. Cero contexto.
- **Qué evita:** que la auditoría de cierre tenga que releer la conversación.
- **Veredicto:** vale la pena, claramente. Es una pieza correcta atrapada en un contrato
  mal administrado.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `HUE-015` | HUE | No rastrea `supabase/migrations/**`, que el Discovery Gate sí trata como código fuente: las migraciones nuevas quedan fuera de toda auditoría de cierre |

## Notas para el pase general

- **Lente 2:** cuarta variante de «¿qué es código fuente?» (ver `H-03`). Esta es la más
  estrecha de todas y la discrepancia con `pre-write-guard` produce `HUE-015`.
