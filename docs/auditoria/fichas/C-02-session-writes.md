# FICHA A — C-02 · Session writes

| | |
|---|---|
| **Archivo** | `.claude/temp/session-writes.json` |
| **Contexto** | B (harness) |
| **Bloque** | 0 contratos |
| **Revisado** | 2026-08-29 |
| **Estado** | cerrada |

---

## 1. Contrato

Lista de archivos fuente Angular escritos en la sesión, para que las auditorías de cierre
cuesten O(archivos) en vez de O(tokens de conversación).

**¿Coincide con lo que dice su propia documentación?**

Parcialmente. `templates-contract.md` lo declara correctamente. Lo que ninguna
documentación dice es **cuándo se borra**, que resulta ser lo que determina si sus cuatro
consumidores reciben datos o no.

## 2. Disparo

- **Evento / invocación:** lo escribe `write-tracker.js` (PostToolUse Edit|Write|MultiEdit).
  Lo leen `sync-check.js` y `spec-reflection.js` (Stop), `spec-diff-check.js` (PreToolUse
  Bash) y el subagente `index-syncer`.
- **Matcher o condición de captura:**
  ```js
  filePath.includes('src/app/') && !filePath.endsWith('.spec.ts') &&
  (filePath.endsWith('.ts') || .html || .scss)
  ```
- **Precondiciones que asume:** que el ciclo de vida del archivo es "una sesión".

**¿Puede no dispararse cuando debería?**

Sí, tres huecos de captura, todos deliberados pero ninguno documentado:

- **`supabase/migrations/**`** no se rastrea, aunque el Discovery Gate sí lo trata como
  código fuente. Una migración nueva nunca aparece en la auditoría de cierre.
- **`src/app/**/*.spec.ts`** excluido: escribir solo tests deja la sesión sin registro.
- **`scripts/`, `indices/`, `context/`** fuera de alcance por diseño.

## 3. Fail mode

- **Actual:** fail-open en el productor; los consumidores hacen `exit 0` si el archivo no
  existe o no parsea.
- **¿Es la elección correcta acá?** **no** — para `spec-diff-check.js`, que es un gate,
  "sin datos" debería ser distinguible de "todo en orden". Hoy son lo mismo.

| Escenario | Comportamiento actual | ¿Correcto? |
|---|---|---|
| Input malformado / stdin vacío | `catch`, exit 0 | sí |
| Archivo ausente | todos los consumidores `exit 0` en silencio | **no** para el gate |
| JSON corrupto | `catch { writes = [] }` y se sobrescribe | aceptable |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

```bash
# Un componente escrito en la sesión, con un índice MÁS NUEVO (nada que reportar)
printf '["src/app/features/a.component.ts"]' > .claude/temp/session-writes.json
touch indices/COMPONENTS.md
node .claude/hooks/sync-check.js ; echo $?
test -f .claude/temp/session-writes.json && echo SI || echo "NO — borrado"

# Después: un consumidor posterior
TOOL_INPUT='{"command":"git commit -m x"}' node .claude/hooks/spec-diff-check.js ; echo $?
```

**Qué pasó:**

```
sync-check → exit 0 (nada que reportar)
session-writes.json existe después: NO — borrado
spec-diff-check → exit 0 (pasa: tracker vacío)
```

`sync-check.js` ejecuta `fs.unlinkSync(trackerPath)` **incondicionalmente**, incluso
cuando no tenía nada que reportar. El comentario dice *«Limpiar tracker para la próxima
sesión»* — pero el hook `Stop` corre al final de **cada respuesta del agente**, no al
final de la sesión. El propio `spec-reflection.js` lo sabe: tiene lógica anti-bucle
precisamente porque se ejecuta una y otra vez dentro de la misma sesión.

Consecuencia: a partir del primer turno, el tracker solo contiene lo escrito en el turno
actual. Los consumidores que corren en turnos posteriores auditan una lista vacía y pasan
en verde. → `ACO-001`

**Veredicto:**
- [ ] Dispara ante su violación
- [x] Dispara **solo dentro del turno en que se escribió el archivo** → `ACO-001`

## 5. Depende de

| Artefacto / formato | Qué asume de él | ¿Declarado en templates-contract.md? |
|---|---|---|
| `process.cwd()` | Que es la raíz del proyecto | no |
| Array JSON de rutas relativas | Formato plano `string[]` | sí |

## 6. Lo consumen

| Consumidor | Qué toma de acá | ¿Se rompe si cambio el formato? |
|---|---|---|
| `sync-check.js` (Stop 3º) | La lista; compara mtime contra `indices/`. **Y la borra** | sí |
| `spec-reflection.js` (Stop 2º) | La lista, para el bloque de evidencia | sí |
| `spec-diff-check.js` (PreToolUse Bash) | La lista, para bloquear el commit | sí |
| `index-syncer` (subagente) | La lista, para saber qué reconciliar | sí |

**¿Alguien lo consume sin que esté declarado?**

Los cuatro están declarados. Lo que no está declarado es el **orden**, que acá es
semántico: `spec-reflection` (2º) corre antes que `sync-check` (3º), así que alcanza a ver
los datos. Si alguien reordena los hooks de `Stop` en `settings.json`, el bloque de
evidencia de `spec-reflection` deja de funcionar sin que nada avise. → registrar en `H-00`.

## 7. Cobertura

- **Test que lo cubre:** **ninguno.** No existe `write-tracker.test.js`, ni
  `sync-check.test.js`, ni `spec-diff-check.test.js`.
- **¿El test ejecuta la ruta de fallo?** No hay test. El contrato con más consumidores del
  harness (cuatro) es el único de los cinco sin ninguna cobertura. → `HUE-006`
- **¿Lo cubre `provocar-reglas.mjs` o `smoke-scripts.mjs`?** No.

## 8. Costo / beneficio

- **Qué cuesta:** un `readFileSync` + `writeFileSync` por edición. Despreciable.
- **Qué evita:** que la auditoría de cierre tenga que releer la conversación entera —
  el argumento O(archivos) vs O(tokens) es correcto y es el mejor de todo el harness.
- **Veredicto:** vale la pena. La idea es sólida; el ciclo de vida está mal.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `ACO-001` | ACO | `sync-check` borra el tracker en cada `Stop` (que es por respuesta, no por sesión); los consumidores de turnos posteriores auditan una lista vacía |
| `HUE-006` | HUE | El contrato con más consumidores no tiene ningún test |

## Notas para el pase general

- **Lente 2 (autoridad duplicada):** `sync-check` y `spec-reflection` calculan
  *exactamente* la misma comparación mtime entre `writes` y `indices/`, con código casi
  idéntico, en dos archivos. Dos implementaciones del mismo criterio, una de las cuales
  además borra el insumo de la otra.
- **Lente 2:** `sync-check` (avisa) y `spec-diff-check` (bloquea el commit) responden a la
  misma pregunta —¿los índices están al día?— con severidades distintas. Decidir cuál es
  la autoridad.
- Contrastar con `C-01`: aquel no se borra nunca, este se borra cada turno. Ninguna de las
  dos políticas parece deliberada.
