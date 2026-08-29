# FICHA A — H-03 · `sdd/spec-gate.js`

| | |
|---|---|
| **Archivo** | `templates/.claude/hooks/sdd/spec-gate.js` |
| **Contexto** | B (harness) · **Bloque** 1 hooks · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

Si el proyecto usa SDD, bloquea escrituras en código de producto cuando no hay una spec
activa con su plan. Sin carpeta `specs/`, no bloquea nada.

**¿Coincide con lo que dice su propia documentación?**

Sí. El docblock enumera los cinco casos y el código los implementa en ese orden. La
propiedad clave —*«fail-open por defecto: si un proyecto no tiene `specs/`, el hook no
bloquea nada, esto los hace seguros de embarcar por defecto»*— es real y es lo que permite
que el motor SDD venga dormido.

## 2. Disparo

- **Evento:** `PreToolUse` sobre `Edit|Write|MultiEdit`, **primero de cuatro**.
- **Cadena de gates:** proyecto sin `specs/` → exento · ruta o extensión exenta → exento ·
  no es código de producto → exento · sin `.active` → **bloquea** · `--bypass` → pasa ·
  `hotfix-` sin `hotfix.md` → **bloquea** · `fix-` sin `fix.md` → **bloquea** · spec sin
  `spec.md` o sin `plan.md` → **bloquea**.
- **Código de producto:** `src/`, `app/`, `lib/`, `supabase/migrations/`, `packages/*/src/`.

**¿Puede no dispararse cuando debería?**

El bypass está bien diseñado: escribir `--bypass <motivo>` en `specs/.active` es una
acción del humano, no del agente, y queda registrada en un archivo versionable.

## 3. Fail mode

- **Actual:** fail-open en el `catch` general (`process.exit(0)`), fail-closed en los gates.
- **¿Es la elección correcta acá?** Sí para el `catch` — pero **el `catch` se traga
  cualquier error**, incluido un `specs/.active` ilegible por permisos. Ahí el SDD se apaga
  entero sin decir nada.

| Escenario | Comportamiento | ¿Correcto? |
|---|---|---|
| Sin `specs/` | `exit 0` | sí, es el diseño |
| `.active` vacío | bloquea con instrucciones claras | sí |
| `.active` ilegible (permisos) | `catch` → `exit 0`, SDD desactivado en silencio | **no** |
| stdin >10 MB | **sin cap SEC-04** | **no** → `HUE-010` |
| Ruta absoluta fuera del proyecto | `path.relative` da `../…`, no matchea `src/` → exento | aceptable |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

```bash
# spec activa 0001-x con spec.md pero SIN plan.md
mkdir -p specs/specs/0001-x && echo "0001-x" > specs/.active
echo "# Spec" > specs/specs/0001-x/spec.md
echo '{"tool_input":{"file_path":"src/app/features/x.component.ts","content":"x"}}' \
  | node .claude/hooks/sdd/spec-gate.js
# → exit 2 "La spec 0001-x no tiene plan.md"          ✔

# el mismo archivo, pero .spec.ts
echo '{"tool_input":{"file_path":"src/app/features/x.spec.ts","content":"x"}}' | …
# → exit 0 (exento)                                    ✔
```

**Qué pasó:**

El gate bloquea correctamente sin `plan.md` y exime los archivos de test, como promete.
Verificado durante la investigación de `H-06`.

**Lo que sí falla es la coherencia con su vecino.** `spec-gate` y `plan-injector` corren
sobre el mismo matcher y clasifican el mismo archivo con **listas de exención distintas**:

| Categoría | Exime `spec-gate` pero **no** `plan-injector` |
|---|---|
| Prefijos | `supabase/seed`, `tests/`, `.next/`, `.angular/` |
| Extensiones | `.mdx`, `.gitignore`, `.npmrc`, `.env`, `.editorconfig` |
| Otros | `*.spec.ts`, `*.spec.js`, `*.test.{ts,js,tsx,jsx}`, `Dockerfile`, `Makefile`, `LICENSE`, `README` |

Consecuencia comprobada: al editar `src/app/features/x.spec.ts`, `spec-gate` sale en 0
(exento) y `plan-injector` inyecta **24.622 caracteres** de spec+plan+tasks. El primer
hook dice «esto no es código de producto» y el cuarto lo trata como si lo fuera.
→ `INC-005`

**Veredicto:**
- [x] Dispara ante su violación — comprobado
- [x] Con una divergencia de criterio contra el hook que depende de él → `INC-005`

## 5. Depende de

| Artefacto / formato | Qué asume | ¿Declarado? |
|---|---|---|
| `specs/.active` — primera línea = ID del track | `readFileSync().trim().split('\n')[0]` | sí, en `sdd/SKILL.md` |
| Convención de prefijos `hotfix-` / `fix-` / resto | Determina qué archivo exige | sí |
| Layout `specs/{specs,fixes,hotfixes}/<id>/` + rutas legacy | Dos ubicaciones toleradas por tipo | parcial |

## 6. Lo consumen

| Consumidor | Qué toma | ¿Se rompe si cambio el formato? |
|---|---|---|
| `sdd/plan-injector.js` | **Su decisión**: asume que si él corre, el gate no bloqueó | sí — y su lista de exención ya diverge |
| `sdd/hotfix-autoclose.js` | `specs/.active`, mismo formato | sí |
| Los 11 comandos `/spec-*`, `/fix-*`, `/hotfix` | Escriben lo que este gate exige | sí |

**¿Alguien lo consume sin que esté declarado?**

La dependencia de orden con `plan-injector` está escrita en el docblock de *aquel*, no de
este. Es la única de las tres dependencias de orden del harness que alguien documentó
(ver `ACO-004`).

## 7. Cobertura

- **Test que lo cubre:** **ninguno.** No existe `spec-gate.test.js`.
- **¿El test ejecuta la ruta de fallo?** No hay test. Es un hook de 176 líneas con ocho
  ramas de decisión y cero cobertura. → `HUE-011`
- Es especialmente notorio porque su lógica de rutas legacy (`fixes/hotfixes/` vs
  `hotfixes/`) es exactamente el tipo de cosa que se rompe en una migración.

## 8. Costo / beneficio

- **Qué cuesta:** un `existsSync` por Edit cuando no hay `specs/`. Prácticamente nada en el
  99% de los proyectos, que es el punto del diseño fail-open.
- **Qué evita:** que se escriba código de producto sin contrato declarado.
- **Veredicto:** vale la pena. El fail-open por ausencia de `specs/` es la decisión que
  hace embarcable un motor SDD completo sin imponérselo a nadie.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `INC-005` | INC | `spec-gate` y `plan-injector` clasifican el mismo archivo con listas de exención distintas: un `.spec.ts` está exento para uno y no para el otro |
| `HUE-010` | HUE | Los cuatro hooks de `sdd/` y `context-enrichment-guard` leen stdin sin el cap SEC-04 que sí tienen los demás |
| `HUE-011` | HUE | 176 líneas, ocho ramas de decisión, ningún test |

## Notas para el pase general

- **Lente 2:** la clasificación «¿esto es código de producto?» existe en **tres formas
  distintas** en el harness:

  | Pieza | Criterio |
  |---|---|
  | `spec-gate` + `plan-injector` | `src/`, `app/`, `lib/`, `supabase/migrations/`, `packages/*/src/` — **el bloque `isProductCode` es idéntico, copiado literal entre los dos**; lo que diverge son las listas de exención que corren antes (ver `INC-005`) |
  | `pre-write-guard` | `src/app/` + `supabase/migrations/`, excluyendo `.spec.ts` |
  | `write-tracker` | `src/app/` + `.ts`/`.html`/`.scss`, excluyendo `.spec.ts` |

  Tres definiciones y una copia literal, sin fuente única. Es el `DUP` estructural más
  grande encontrado hasta ahora.
- **Lente 3:** `HUE-010` es una regresión de alcance: SEC-04 se aplicó a los hooks de la
  raíz y el subdirectorio `sdd/` quedó afuera.
