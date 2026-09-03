# FICHA A — H-08 · `spec-diff-check.js`

| | |
|---|---|
| **Archivo** | `templates/.claude/hooks/spec-diff-check.js` · **Contexto** B · **Bloque** 1 · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

Intercepta el `git commit` y lo bloquea si hay componentes o facades creados en la sesión
que no están registrados en sus índices.

**¿Coincide con lo que dice su propia documentación?**

El docblock describe el flujo correctamente y `.claude/CLAUDE.md` lo promete como
guardrail del commit. **Ninguna de las dos afirmaciones se cumple en ejecución**: el hook
nunca ha bloqueado un commit en ningún proyecto generado. → `DEC-001`

## 2. Disparo

- **Evento:** `PreToolUse` sobre `Bash`, **segundo de dos** (después de `bash-guard`).
- **Condición declarada:** que el comando contenga `git` y `commit`.
- **Cómo obtiene el comando:**

```js
const toolInput = process.env.TOOL_INPUT || '{}';
let cmd = '';
try { cmd = JSON.parse(toolInput).command || ''; } catch { /* ignore */ }
if (!cmd.includes('git') || !cmd.includes('commit')) process.exit(0);
```

**¿Puede no dispararse cuando debería?**

**Nunca se dispara.** Claude Code entrega el payload por stdin; `TOOL_INPUT` no existe. Con
`cmd = ''` la condición se cumple y el hook sale en 0 antes de leer nada. Es el **único**
de los 17 hooks que lee de una variable de entorno — su vecino en el mismo matcher,
`bash-guard`, lee stdin correctamente.

## 3. Fail mode

- **Actual:** fail-open en todos los caminos.
- **¿Es la elección correcta acá?** **No.** Para un gate, «no tengo datos» y «todo en
  orden» deben ser distinguibles, y acá ambos son `exit 0` silencioso. Con la entrada
  arreglada seguiría fallando abierto ante un `session-writes.json` ausente — que después
  del primer `Stop` es el caso normal (`ACO-001`).

| Escenario | Comportamiento | ¿Correcto? |
|---|---|---|
| Payload por stdin (el caso real) | `exit 0` sin mirar nada | **no** → `DEC-001` |
| `session-writes.json` ausente | `exit 0` | **no** para un gate |
| Índice sin el componente (con `TOOL_INPUT`) | `exit 2` con mensaje útil | sí |
| stdin >10 MB | **sin cap SEC-04** | no |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

Sandbox con `session-writes.json` conteniendo un componente nuevo y un `COMPONENTS.md` que
no lo registra. Primer intento con un fixture defectuoso: el índice contenía literalmente
la cadena `kpi-card` en un comentario, y `componentsIndex.includes(componentName)` daba
verdadero. Repetido con un índice limpio:

```bash
# A — como lo invoca Claude Code (stdin)
echo '{"tool_name":"Bash","tool_input":{"command":"git commit -m x"}}' \
  | node .claude/hooks/spec-diff-check.js
# B — con la env var que el hook lee
TOOL_INPUT='{"command":"git commit -m x"}' node .claude/hooks/spec-diff-check.js </dev/null
# C — contraste: bash-guard, mismo matcher
echo '{"tool_name":"Bash","tool_input":{"command":"cat > src/app/x.component.ts <<EOF"}}' \
  | node .claude/hooks/bash-guard.js
```

**Qué pasó:**

```
A → exit 0                                                        ✘ no bloquea
B → exit 2  📋 <app-kpi-card> no está en indices/COMPONENTS.md     ✔ la lógica es correcta
C → exit 2  🚫 BASH GUARD                                          ✔ el vecino sí lee stdin
```

**La lógica de detección funciona.** No hay que reescribir el hook: hay que darle el input
por donde llega. Ese es el hallazgo más barato de arreglar y el más caro de haber tenido
abierto.

Dos observaciones menores de la lectura: hay una constante muerta (`componentRe`, declarada
y nunca usada) y el matching de componentes es por substring —
`componentsIndex.includes(componentName)` — que es lo que hizo pasar mi primer fixture y
produciría falsos negativos reales con nombres cortos o contenidos en otros.

**Veredicto:**
- [ ] Dispara ante su violación
- [x] **No dispara nunca** → `DEC-001`

## 5. Depende de

| Artefacto / formato | Qué asume | ¿Declarado? |
|---|---|---|
| `process.env.TOOL_INPUT` | Que existe | **no, y no existe** |
| `.claude/temp/session-writes.json` (`C-02`) | Lista de escrituras de la sesión | sí — pero ver `ACO-001` |
| `indices/COMPONENTS.md`, `FACADES.md`, `SERVICES.md` | Que el nombre aparezca como substring | no |

## 6. Lo consumen

| Consumidor | Qué toma | ¿Se rompe si cambio el formato? |
|---|---|---|
| El agente | stderr del bloqueo | no |

Hook terminal.

## 7. Cobertura

- **Test que lo cubre:** **ninguno.** No existe `spec-diff-check.test.js`.
- **¿El test ejecuta la ruta de fallo?** No hay test. **Un test que le pasara el payload
  por stdin —exactamente lo que hacen los otros ocho tests del harness— habría encontrado
  esto el primer día.** Es el caso más limpio de toda la auditoría para la correlación entre
  cobertura y guardrails muertos.

## 8. Costo / beneficio

- **Qué cuesta:** hoy, un proceso Node por cada comando Bash que no hace nada.
- **Qué evita:** hoy, nada. Con la entrada arreglada, evitaría commitear artefactos sin
  registrar — el olvido que `sync-check` solo detecta después.
- **Veredicto:** vale la pena **una vez arreglado**. Hay que resolver `ACO-001` a la vez:
  aunque lea stdin, el tracker ya está vacío en cualquier turno posterior al primero.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `DEC-001` | DEC | (registrado en `C-02`) Lee el comando de `process.env.TOOL_INPUT`; nunca bloquea nada |
| `HUE-014` | HUE | El matching contra el índice es por substring: un componente cuyo nombre esté contenido en cualquier parte del `.md` pasa como registrado |

## Notas para el pase general

- **Lente 3:** este hook es la prueba central. Único hook que lee de env var, único sin
  test, único que nunca funcionó. Las tres cosas son la misma cosa.
- **Lente 2:** con `sync-check` responden la misma pregunta —¿los índices están al día?—
  con severidades distintas (bloquear vs. avisar) y sobre el mismo insumo. Decidir cuál es
  la autoridad.
- Arreglar `DEC-001` sin arreglar `ACO-001` deja el hook igual de mudo.
