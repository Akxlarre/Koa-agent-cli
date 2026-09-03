# FICHA A — T-01 / T-02 · Los tests del harness

> Última unidad del nivel A. Esta ficha es, además, **el insumo de la Lente 3**: acá se
> consolida el mapa de cobertura que las 51 fichas anteriores fueron levantando pieza por
> pieza.

| | |
|---|---|
| **Contexto** B (y A en el último lote) · **Bloque** 5 · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

`templates/.claude/tests/*.test.js` son tests de contrato de los hooks;
`scripts/lib/*.test.mjs` cubren la lógica pura extraída de los scripts.

**¿Coincide con lo que dice su documentación?** `templates-contract.md` es tajante:
*«Todo hook nuevo lleva su archivo de test»* y *«esto no es opcional:
`compact-recovery.js` estuvo con un error de sintaxis durante varias versiones —fallaba en
silencio en cada compactación— precisamente porque ningún test lo ejecutaba nunca»*.

**La regla existe, está justificada con un incidente real, y se cumple en 9 de 20 hooks.**

## 2. El estado real, medido

Las tres suites corren y pasan:

```
node --test templates/.claude/tests/*.test.js   → 121 tests, 0 fail
node --test scripts/lib/*.test.mjs              →  79 tests, 0 fail
npm test  (test/*.test.mjs)                     →  22 tests, 0 fail
                                                   ───
                                                   222 tests en verde
```

**T-01 · Los 9 archivos de `templates/.claude/tests/`:**

`bash-guard` · `compact-recovery` · `doc-links` · `harness-gate` · `pre-write-guard` ·
`prompt-context` · `session-start` · `spec-reflection` · `validate-file-contains`

**Los 11 hooks sin test — la lista completa, que era un entregable del bloque 1:**

```
✘ spec-gate                 ✘ post-edit                ✘ context-guardian
✘ plan-injector             ✘ failure-tracker          ✘ context-enrichment-guard
✘ spec-diff-check           ✘ hotfix-autoclose
✘ discovery-tracker         ✘ sync-check
✘ write-tracker
```

**T-02 · Los 13 módulos de `scripts/lib/`:** todos con test propio, 79 en total. Es la
única capa del repositorio con cobertura completa.

## 3. La correlación, ahora con datos

Cruzando la lista de arriba contra los 49 hallazgos de la auditoría:

| Hook | ¿Test? | Hallazgos |
|---|---|---|
| `spec-diff-check` | **no** | `DEC-001` (S1) — nunca bloqueó un commit |
| `post-edit` | **no** | `SEC-001` (S1), `DEC-003` (S1) |
| `plan-injector` | **no** | `CAR-001` (S1), `INC-005`, `HUE-010` |
| `spec-gate` | **no** | `INC-005`, `HUE-010`, `HUE-011` |
| `sync-check` | **no** | `ACO-001` (S2) |
| `context-guardian` | **no** | `CAR-002` (S2) |
| `failure-tracker` | **no** | `HUE-016`, `DUP-002` |
| `write-tracker` | **no** | `HUE-015` |
| `hotfix-autoclose` | **no** | `INC-007` |
| `discovery-tracker` | **no** | `INC-006` |
| — | | |
| `bash-guard` | sí | ninguno |
| `session-start` | sí | `ACO-005` (S3) |
| `prompt-context` | sí | `ACO-006` (S3) |
| `harness-gate` | sí | `DEC-002`, `HUE-013` |
| `pre-write-guard` | sí | `HUE-012`, `ACO-007` |
| `compact-recovery` | sí | `HUE-017` (S3) |

**Los seis `S1` del harness están, sin excepción, en hooks sin test.** Los hooks con test
tienen hallazgos de diseño (`DEC-002`) o de declaración (`ACO-*`), no de funcionamiento.

No es una coincidencia estadística sobre una muestra chica: es que un test que le pase el
payload por stdin habría encontrado `DEC-001` el primer día, y uno que cargara el módulo
bajo el `package.json` de un proyecto Angular habría encontrado `DEC-003`.

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**La pregunta aplicada a los tests mismos:** ¿estos 222 tests pueden fallar, o solo pasar?

**Comprobado indirectamente, tres veces, durante la auditoría:**

1. **`smoke-scripts.mjs`** introdujo un componente sin `OnPush` y `lint:arch` lo rechazó —
   la cadena test→detección funciona (`S-06`).
2. **`provocar-reglas.mjs`** confirmó que 4 reglas disparan ante su violación y detectó 3
   reglas nuevas sin fixture — el ratchet funciona (`S-05`).
3. **`lib/provocacion.test.mjs`** incluye el caso «una regla borrada del linter deja el
   baseline obsoleto», que es un test de la ruta de fallo, no del camino feliz.

**Los tres huecos que la auditoría encontró en la cobertura existente:**

| Hueco | Dónde |
|---|---|
| `harness-gate` tiene 11 tests y **ninguno intenta evadirlo** — la evasión con la palabra «cuando» pasa | `DEC-002` |
| `compact-recovery` tiene test y **no cubre la completitud de su mapa** de índices — el archivo que fundó la regla de testear hooks sigue con un hueco que su test no ve | `HUE-003` |
| Reglas con test de función pura pero **sin verificar que el linter las reporte** | `HUE-019` |

**Los tres son la misma pregunta mal formulada.** «¿Tiene test?» no es la pregunta.
Las preguntas son tres, y hay que contarlas por separado:

1. ¿la lógica devuelve lo correcto ante una entrada? → **222 tests, cubierto**
2. ¿el sistema la cablea y la ejecuta de verdad? → **verificado para 4 reglas**
3. ¿alguien intenta **evadirla**? → **prácticamente nadie**

**Veredicto:**
- [x] Los 222 tests corren y pasan — comprobado
- [x] La cobertura mide el nivel 1 y casi nada del 2 y el 3 → `HUE-025`

## 5. Depende de

| Artefacto | Qué asume | ¿Declarado? |
|---|---|---|
| `node --test` (runner nativo) | Node 20+ | sí |
| `templates/.claude/tests/package.json` | Su propio `type` de módulo | sí |
| `npm run claude:test-hooks` | Que el script exista en el proyecto generado | sí, lo escribe `scaffolder.js` |
| El payload de stdin de los hooks | Formato del hook input de Claude Code | **no → es la raíz de `DEC-001`** |

La última fila es el hallazgo escondido de esta ficha: **ningún test declara ni fija el
formato del payload que los hooks reciben.** Cada test lo construye a mano. Por eso
`spec-diff-check` pudo leer de una env var durante versiones sin que nada chocara.

## 6. Lo consumen

| Consumidor | Qué toma |
|---|---|
| `npm run claude:test-hooks` | En el proyecto generado |
| `npm test` | En este repositorio, solo los 22 del CLI |
| `templates-contract.md` | Declara la regla de «todo hook lleva test» |

**Nadie los corre automáticamente.** No hay CI declarado en el repositorio, ni hook que los
dispare. Igual que `provocar-reglas` y `smoke-scripts` (`S-05`, `S-06`): las tres garantías
del repo dependen de que alguien se acuerde de invocarlas.

## 7. Cobertura de la cobertura

- `doc-links.test.js` es el más interesante de los nueve: verifica que toda referencia
  `archivo.md#ancla` del payload resuelva **y que toda regla emitida esté documentada**. Es
  el único test que audita la consistencia entre código y prosa — y es el que debería haber
  atrapado `INC-001` (`ARCH-14` documentada sin implementación). No lo hizo porque verifica
  la dirección contraria: regla emitida → documentada, no documentada → emitida.
  → `HUE-026`

## 8. Costo / beneficio

- **Qué cuesta:** ~2,5 s los 121, ~1 s los 79, <1 s los 22. Nada.
- **Qué evita:** los seis `S1` de esta auditoría, si existieran donde faltan.
- **Veredicto:** **es la inversión con mejor retorno del repositorio y está a mitad de
  hacer.** 11 archivos de test es el trabajo mecánico que separa al harness actual de uno
  en el que se pueda confiar.

---

## Hallazgos de estas unidades

| ID | Tipo | Una línea |
|---|---|---|
| `HUE-025` | HUE | La cobertura mide que la lógica sea correcta, casi nunca que el sistema la ejecute de verdad ni que alguien intente evadirla |
| `HUE-026` | HUE | `doc-links.test.js` verifica «regla emitida → documentada» pero no la inversa; por eso no atrapó `ARCH-14`, documentada y sin implementar |
| `ACO-012` | ACO | Ningún test fija el formato del payload que reciben los hooks; cada uno lo construye a mano, que es cómo `spec-diff-check` pudo leer de una env var sin que nada chocara |

## Notas para el pase general

- **Esta ficha es el insumo de la Lente 3.** El cuadrante que la lente pide ya está
  resuelto acá: los seis `S1` del harness están todos en hooks sin test; los hooks con test
  tienen hallazgos de diseño o de declaración, no de funcionamiento.
- **La conclusión candidata:** el repositorio tiene la disciplina escrita
  (`templates-contract.md` la declara, con un incidente real que la justifica), tiene las
  herramientas (`provocar-reglas`, `smoke-scripts`, 222 tests que pasan) y **no terminó de
  aplicarla**. Todos los hallazgos graves de la auditoría viven en la mitad que quedó sin
  cubrir.
- **Backlog de tests, en orden de rentabilidad**, cruzando esta ficha con `HUE-006`,
  `HUE-011` y `DEC-004`:
  1. `spec-diff-check` + `write-tracker` + `sync-check` — el contrato `C-02` entero
  2. Los tres de `sdd/` — `HUE-011`
  3. `post-edit` — dos `S1` en 25 líneas
  4. Fixtures de provocación para las 24 reglas sin cubrir — `DEC-004`
  5. Un test que fije el formato del payload de los hooks — `ACO-012`
