# FICHA A — H-06 · `sdd/plan-injector.js`

| | |
|---|---|
| **Archivo** | `templates/.claude/hooks/sdd/plan-injector.js` |
| **Contexto** | B (harness) · **Bloque** 1 hooks · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

Si hay un track SDD activo y el archivo es código de producto, inyecta el contrato vivo
—`spec.md` + `plan.md` + `tasks.md`, o `fix.md`, o `hotfix.md`— como contexto adicional.

**¿Coincide con lo que dice su propia documentación?**

Sí en lo que hace. El docblock es correcto y breve. Lo que no dice —y es lo que define su
comportamiento real— es **cuánto** inyecta y **con qué frecuencia**.

## 2. Disparo

- **Evento:** `PreToolUse` sobre `Edit|Write|MultiEdit`, **cuarto y último de la cadena**.
- **Condición:** existe `specs/`, hay `.active` con ID no-bypass, el directorio del track
  existe y el archivo pasa su lista de exención.
- **Precondición documentada:** *«se ejecuta DESPUÉS de spec-gate.js. Si el gate no
  bloqueó, este inyecta.»* Es la única dependencia de orden escrita en el harness.

**¿Puede no dispararse cuando debería?**

El problema es el contrario: **dispara de más**. Su lista de exención es un subconjunto
estricto de la de `spec-gate`, así que hay archivos que el gate declara «no es código de
producto» y este trata como si lo fueran.

## 3. Fail mode

- **Actual:** fail-open total. `exit 0` en todos los caminos, incluido el `catch`.
- **¿Es la elección correcta acá?** Sí — un hook que solo enriquece contexto nunca debería
  bloquear. La elección es correcta y consistente con su rol.

| Escenario | Comportamiento | ¿Correcto? |
|---|---|---|
| Sin `specs/` | `exit 0` | sí |
| `.active` con `--bypass` | `exit 0`, no inyecta | sí |
| Directorio del track ausente | `exit 0` | sí |
| Sección >8.000 chars | trunca con marca | sí, pero ver campo 8 |
| stdin >10 MB | **sin cap SEC-04** | **no** → `HUE-010` |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

Sandbox con una spec activa cuyos tres artefactos superan los 8.000 caracteres cada uno —
un tamaño realista para una spec con sus criterios de aceptación, su plan y su checklist.

```bash
echo "0001-x" > specs/.active
# spec.md, plan.md y tasks.md, cada uno > 8000 chars
echo '{"tool_input":{"file_path":"src/app/features/x.component.ts","content":"x"}}' \
  | node .claude/hooks/sdd/plan-injector.js
```

**Qué pasó:**

```
caracteres inyectados: 24.622   (~6.155 tokens estimados)
truncados a 8000: 3 de 3 secciones
```

**En cada Edit.** El hook no tiene estado, ni caché, ni dedup: un `grep` de
`tmpdir|STATE|seen|cache` sobre el archivo devuelve **cero**. Diez ediciones en una sesión
son ~61.000 tokens del mismo contrato repetido.

Y la segunda mitad del hallazgo:

```bash
# el mismo payload, pero sobre un archivo de TEST
'{"tool_input":{"file_path":"src/app/features/x.spec.ts","content":"x"}}'
→ SI — 24.622 caracteres al editar un .spec.ts
# ...y spec-gate, sobre ese mismo archivo:
→ exit 0 (lo exime)
```

El primer hook de la cadena dice «esto no es código de producto» y el cuarto le inyecta el
contrato completo igual. → `INC-005` (registrado en `H-03`), `CAR-001`.

**Veredicto:**
- [x] Hace lo que promete — comprobado
- [x] Sin ningún control de costo, sobre una superficie más ancha que la del gate que lo
  precede → `CAR-001`

## 5. Depende de

| Artefacto / formato | Qué asume | ¿Declarado? |
|---|---|---|
| `specs/.active` | Primera línea = ID | sí |
| Layout `specs/{specs,fixes,hotfixes}/<id>/` + 3 rutas legacy | Dos o tres ubicaciones toleradas | parcial |
| La decisión de `spec-gate` | Que si él corre, el gate no bloqueó | sí, en su docblock |
| `MAX_SECTION_CHARS = 8000` | Constante mágica, sin techo total | **no** |

## 6. Lo consumen

| Consumidor | Qué toma | ¿Se rompe si cambio el formato? |
|---|---|---|
| El agente (`additionalContext`) | Todo | no |

Hook terminal. Su riesgo es puramente de costo.

## 7. Cobertura

- **Test que lo cubre:** **ninguno.** No existe `plan-injector.test.js`.
- **¿El test ejecuta la ruta de fallo?** No hay test. Los tres hooks de `sdd/` —el 100% del
  motor SDD— no tienen ninguna cobertura. → refuerza `HUE-011`.
- **¿Lo cubre algo más?** No.

## 8. Costo / beneficio

- **Qué cuesta:** hasta **24.622 caracteres (~6.155 tokens) por cada Edit**, sin dedup y
  sin techo agregado. Es, por un margen enorme, la pieza más cara del harness.
- **Qué evita:** que el agente trabaje contra su recuerdo del contrato en vez de contra el
  contrato. El propósito es legítimo y valioso.
- **Veredicto:** **cuesta más de lo que aporta tal como está** → `CAR-001`.

  El diagnóstico no es «sacarlo»: es que la misma casa ya resolvió este problema dos veces
  y este hook no aplicó ninguna de las dos soluciones.

  | Pieza | Control de costo |
  |---|---|
  | `prompt-context.js` | dedup por contenido + `REPEAT_EVERY = 8` |
  | `pre-write-guard.js` capa 4 | flag de dedup por categoría y sesión |
  | `session-start.js` | tope de 2.500 chars + corte en `DETAIL:BEGIN` |
  | **`plan-injector.js`** | **ninguno** |

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `CAR-001` | CAR | Inyecta hasta ~6.155 tokens en cada Edit, sin dedup ni techo agregado — la pieza más cara del harness, y la única sin ningún control de costo |

## Notas para el pase general

- **Lente 4:** este es el resultado de la lente antes de correrla. El peor caso a medir:
  editar un `.ts` de `core/facades/` con spec SDD activa dispara `plan-injector` (24 KB) +
  la capa 4 de `pre-write-guard` (primera vez en la categoría) + las reglas path-scoped de
  `facades`/`models`/`swr-pattern`/`architecture` a la vez.
- **Lente 2:** con `H-02` forman el par de extremos del presupuesto de contexto. Dos hooks
  de la misma casa, escritos con criterios opuestos sobre lo que cuesta un token.
- **Lente 3:** cero tests en todo `sdd/`.
