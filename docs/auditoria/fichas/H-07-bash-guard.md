# FICHA A — H-07 · `bash-guard.js`

| | |
|---|---|
| **Archivo** | `templates/.claude/hooks/bash-guard.js` · **Contexto** B · **Bloque** 1 · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

Tres capas sobre cada comando Bash: no crear código fuente por shell, no destruir
directorios críticos, y no ejecutar operaciones irreversibles de base de datos.

**¿Coincide con lo que dice su propia documentación?**

Sí. El docblock lista tres protecciones y el código implementa tres. `.claude/CLAUDE.md`
además documenta el Approval Gate por separado y con precisión.

## 2. Disparo

- **Evento:** `PreToolUse` sobre `Bash`, **primero de dos**.
- **Normalización:** `command.replace(/\t/g,' ').replace(/  +/g,' ')` y luego prueba **cada
  patrón contra el original y contra el normalizado** — defensa explícita contra evasión por
  tabulaciones o espaciado raro (anotada como SEC-07).

**¿Puede no dispararse cuando debería?**

Es regex sobre una línea de shell, así que la evasión siempre es concebible (variables,
`eval`, base64). Pero la capa 1 cubre más de lo obvio: además de redirecciones cubre
`touch`/`cp`/`mv`/`install` y `ng generate`, que son las tres formas de producir un archivo
fuente sin que el Architect Guard vea nunca el contenido. Es de las piezas donde se nota
que alguien pensó en cómo la evadiría.

## 3. Fail mode

- **Actual:** fail-closed en las tres capas, fail-open en el `catch`.
- **¿Es la elección correcta acá?** Sí. Y el Approval Gate es la decisión más madura del
  harness: bloquea `supabase db push`, `db reset`, `migration repair`, `link` y SQL
  destructivo **aunque el propio humano se lo haya pedido en el prompt**, y el mensaje
  cierra anticipándose a la evasión: *«No busques una vía alterna: ni MCP con escritura, ni
  psql directo, ni scripts npm que envuelvan el mismo comando.»*

| Escenario | Comportamiento | ¿Correcto? |
|---|---|---|
| `cat > src/app/x.component.ts <<EOF` | bloquea | sí |
| `ng generate component x` | bloquea | sí |
| `rm -fr src/app` (flags invertidos) | bloquea (regex tolera el orden) | sí |
| `supabase db push` | Approval Gate | sí |
| stdin >10 MB | `exit 0` (tiene cap SEC-04) | sí |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"cat > src/app/x.component.ts <<EOF"}}' \
  | node .claude/hooks/bash-guard.js
```

**Qué pasó:**

```
→ exit 2   🚫 BASH GUARD: No crear archivos de codigo fuente mediante Bash.
```

Comprobado durante `DEC-001`, donde se usó justamente como **contraste**: `bash-guard` y
`spec-diff-check` corren sobre el mismo matcher; el primero lee stdin y bloquea, el segundo
lee una env var y nunca bloquea. La misma prueba que probó que uno funciona probó que el
otro no.

**Deuda:** de las tres capas, solo verifiqué ejecutando la 1. Las capas 2 y 3 quedaron
verificadas por lectura del regex. Es la única deuda de ejecución de esta ficha.

**Veredicto:**
- [x] Dispara ante su violación — comprobado en la capa 1
- [ ] Capas 2 y 3 por lectura → cerrar con fixtures cuando se escriba `bash-guard` en
      `provocar-reglas` (ver `HUE-012`)

## 5. Depende de

| Artefacto / formato | Qué asume | ¿Declarado? |
|---|---|---|
| `input.tool_input.command` por **stdin** | Payload estándar del hook | sí, implícitamente por convención |

Es el hook con **menos dependencias** del harness: no lee ningún archivo, no escribe estado,
no depende de ningún contrato. Decide solo con el comando que le llega. Por eso es también
el más robusto.

## 6. Lo consumen

| Consumidor | Qué toma | ¿Se rompe si cambio el formato? |
|---|---|---|
| El agente | stderr del bloqueo | no |
| `bash-guard.test.js` | Comportamiento | sí |

## 7. Cobertura

- **Test que lo cubre:** `bash-guard.test.js` ✔
- **¿El test ejecuta la ruta de fallo?** Sí. Junto con `harness-gate`, es de los mejor
  cubiertos.
- **¿Lo cubre `provocar-reglas.mjs`?** No — cae dentro de `HUE-012`.

## 8. Costo / beneficio

- **Qué cuesta:** ~15 regex por comando Bash. Cero contexto inyectado.
- **Qué evita:** que el agente rodee todos los guardrails de escritura usando `cat >`, y que
  ejecute una operación de base de datos sin vuelta atrás.
- **Veredicto:** vale la pena. **Es la mejor pieza de las trece revisadas hasta ahora**: sin
  dependencias, con test, con defensa explícita contra evasión y con un mensaje que
  anticipa el siguiente movimiento del agente.

---

## Hallazgos de esta unidad

Ninguno propio.

## Notas para el pase general

- **Contraste para la Lente 3:** `bash-guard` y `spec-diff-check` comparten matcher y
  propósito general (frenar cosas peligrosas en Bash). El primero tiene test y funciona; el
  segundo no tiene test y nunca funcionó. Es el par que mejor ilustra la correlación.
- Sirve de referencia de «cómo se ve un hook sano» para juzgar el resto.
