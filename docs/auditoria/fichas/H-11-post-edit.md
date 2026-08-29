# FICHA A — H-11 · `.claude/scripts/post-edit.js`

| | |
|---|---|
| **Archivo** | `templates/.claude/scripts/post-edit.js` · **Contexto** B · **Bloque** 1 · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

Corre Prettier sobre cada `.ts`/`.html`/`.scss`/`.css` recién editado.

**¿Coincide con lo que dice su propia documentación?**

`.claude/CLAUDE.md` lo resume en una línea: *«Prettier — cada archivo editado se formatea
automáticamente»*. En Node 20 —el mínimo que el propio CLI exige— eso no ocurre.

## 2. Disparo

- **Evento:** `PostToolUse` sobre `Edit|Write|MultiEdit`, segundo del grupo.
- **Condición:** `/\.(ts|html|scss|css)$/` sobre la ruta.
- **Nota de ubicación:** es el único hook cableado que **no** vive en `.claude/hooks/`. Por
  eso el registro cuenta 16 y son 17 (`INC-004`), y por eso no hereda el
  `package.json` con `"type": "commonjs"` de esa carpeta.

**¿Puede no dispararse cuando debería?**

Sí — puede no ejecutarse en absoluto. Ver campo 4.

## 3. Fail mode

- **Actual:** fail-open absoluto: todo el cuerpo dentro de un `try {} catch {}` vacío,
  comentado como *«Prettier not installed, file not found, or invalid JSON — silently skip»*.
- **¿Es la elección correcta acá?** Para un formateador, sí. **El problema es que ese
  `catch` también se traga el fallo de carga del propio módulo**, así que el hook puede
  estar muerto y nadie lo nota nunca.

| Escenario | Comportamiento | ¿Correcto? |
|---|---|---|
| Prettier no instalado | silencioso | sí |
| Node 20, sin `"type":"module"` | **el módulo no carga** | **no** → `DEC-003` |
| Node 22+ | corre, con warning en cada edición | parcial |
| Ruta con metacaracteres de shell | **ejecuta el comando inyectado** | **no** → `SEC-001` |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

Sandbox con un `package.json` como el que produce `ng new`: sin `"type": "module"`.

```bash
echo '{"name":"proyecto-angular","version":"0.0.0"}' > package.json
echo '{"tool_input":{"file_path":"src/app/a.component.ts"}}' | node .claude/scripts/post-edit.js
# Node 22:
#   Warning: Module type of …/post-edit.js is not specified and it doesn't parse as CommonJS.
#   Reparsing as ES module because module syntax was detected. This incurs a performance overhead.

# simulando Node 20 (sin detección automática de módulo):
… | node --no-experimental-detect-module .claude/scripts/post-edit.js
#   Warning: Failed to load the ES module: …/post-edit.js.
#   Make sure to set "type": "module" in the nearest package.json …
#   import { execSync } from 'child_process';
#   ^^^^^^ SyntaxError
```

**Qué pasó — dos hallazgos:**

**1. El hook usa `import` y vive bajo un `package.json` sin `"type": "module"`.**
`lib/config.js` declara `MIN_NODE_MAJOR = 20`, y la detección automática de sintaxis de
módulo recién es default en Node 22.7+. En Node 20 y 21 el módulo **no carga**: el
formateo automático que el harness promete no ocurre, y como el fallo es del cargador y no
del cuerpo, no hay ni un `catch` que lo registre. En Node 22+ funciona, pero imprime un
warning de reparseo en **cada edición**. → `DEC-003`

El resto de los hooks resuelve esto con `templates/.claude/hooks/package.json`, que fuerza
`{"type": "commonjs"}` y es una decisión documentada en `templates-contract.md`. La carpeta
`.claude/scripts/` no tiene package.json propio.

**2. La ruta se interpola en una cadena de shell sin escapar:**

```js
execSync(`npx prettier --write "${filePath}" --log-level warn`, { stdio: 'inherit', … });
```

```bash
echo '{"tool_input":{"file_path":"src/app/a.component.ts\"; touch /tmp/PWNED; echo \"x.ts"}}' \
  | node .claude/scripts/post-edit.js
test -f /tmp/PWNED   # → ⚠️ COMANDO INYECTADO EJECUTADO — /tmp/PWNED creado
```

Las comillas dobles alrededor de `${filePath}` no protegen: una ruta que las cierre ejecuta
lo que siga. `execSync` lanza un shell. → `SEC-001`

Es notable porque el repo anota `SEC-01` a `SEC-07` en el resto de los hooks —symlinks,
cap de stdin, allowlist de claves, normalización contra evasión— y esta superficie quedó
fuera de esa pasada.

**Veredicto:**
- [ ] Dispara ante su violación
- [x] **No corre en la versión mínima de Node que el CLI exige** → `DEC-003`
- [x] Ejecuta comandos arbitrarios desde la ruta del payload → `SEC-001`

## 5. Depende de

| Artefacto / formato | Qué asume | ¿Declarado? |
|---|---|---|
| `npx prettier` disponible | Silencioso si no está | sí, en el comentario |
| El `package.json` más cercano | Que permite `import` | **no, y no lo permite** |
| `input.tool_input.file_path` | Ruta confiable | **no lo es** |

## 6. Lo consumen

Nadie. Hook terminal, efecto solo en el filesystem.

## 7. Cobertura

- **Test que lo cubre:** **ninguno.** No existe `post-edit.test.js`.
- **¿El test ejecuta la ruta de fallo?** No hay test. Un test que simplemente cargara el
  módulo bajo el `package.json` de un proyecto Angular habría encontrado `DEC-003`.
- **¿Lo protege algún gate?** `harness-gate.js` sí lo cubre (`isCapabilityScript` matchea
  `.claude/scripts/*.js`), pero la capa 1 de `pre-write-guard` **no** lo protege: su lista
  es `.claude/hooks/`, `settings.json` y `architect.js`. El formateador es editable por el
  agente; los otros 16 hooks no.

## 8. Costo / beneficio

- **Qué cuesta:** un `npx prettier` con timeout de 15 s por edición, más el warning de
  reparseo en Node 22+. Cero contexto.
- **Qué evita:** ruido de formato en los diffs.
- **Veredicto:** el beneficio es real pero secundario, y hoy no se cobra en Node 20. Con
  `SEC-001` abierto, **el balance es negativo**: un formateador opcional no justifica una
  superficie de ejecución de comandos.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `SEC-001` | DEC | `post-edit.js` interpola la ruta del payload en una cadena de shell; una ruta con comillas ejecuta comandos arbitrarios |
| `DEC-003` | DEC | Usa `import` bajo un `package.json` sin `"type":"module"`: no carga en Node 20/21, que es el mínimo que el CLI exige |

> `SEC-001` usa el prefijo `SEC` como sub-tipo de `DEC` (un guardrail que además abre una
> superficie). Es la primera vez que la taxonomía se queda corta — anotarlo para el pase
> general y decidir si `SEC` merece ser un tipo propio.

## Notas para el pase general

- **Lente 3:** tercer hook sin test que resulta estar roto (`spec-diff-check`, los de
  `sdd/`, este). La correlación ya no es una hipótesis.
- **Lente 2:** la capa 1 de `pre-write-guard` protege `.claude/hooks/` pero no
  `.claude/scripts/`; `harness-gate` cubre la segunda pero no la primera. Dos protecciones
  del harness con superficies complementarias y ningún criterio común. Ninguna cubre
  `.claude/skills/` ni `.claude/agents/`.
