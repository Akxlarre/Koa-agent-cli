# Unidades de auditoría — índice y estado

> 102 unidades en **orden de revisión por acoplamiento descendente**.
> No reordenar: el orden es el método. Ver `README.md`.
>
> Estado: `·` pendiente · `~` en curso · `✓` cerrada · `!` cerrada con hallazgo grave

**Progreso** — Nivel A: **53/53 ✅** · Nivel B: **41/41 ✅** · Nivel C: 0/8 · Pase general: pendiente
**Hallazgos abiertos** — 69: **7 `S1`**, 31 `S2`, 31 `S3`. Ver `HALLAZGOS.md`.

> ## NIVEL A COMPLETO — 2026-08-29
>
> Las 53 unidades con comportamiento, cerradas. **Los seis `S1` del harness están, sin
> excepción, en hooks sin test** (ver `T-01`), y el séptimo (`DEC-004`) es que el auditor
> de reglas cubre el 14% de lo que audita.
>
> **Los tres patrones estructurales que emergieron**, ninguno visible en una ficha
> individual:
> 1. **`Stop` malentendido.** `ACO-001`, `CAR-002` e `INC-007`: tres hooks asumen «fin de
>    sesión» donde el evento significa «fin de respuesta».
> 2. **Cobertura ↔ calidad.** Los hooks con test tienen hallazgos de diseño o de
>    declaración; los sin test tienen los seis `S1`.
> 3. **Las dos mitades del repo no están al mismo nivel.** El generador respeta sus cuatro
>    fronteras, documenta sus decisiones difíciles donde se aplican y tiene un solo hallazgo
>    con impacto real. El harness concentra los siete `S1`.
>
> Siguen el nivel B (41 unidades de prosa) y el nivel C (8 lotes).

---

# NIVEL A — ficha completa (53 unidades)

## Bloque 0 · Contratos compartidos (5)

> Se revisan primero porque definen el vocabulario con el que se juzga todo lo demás.
> No son archivos: son **formatos** con productores y consumidores.

| | ID | Unidad | Formato | Productores | Consumidores |
|---|---|---|---|---|---|
| ! | `C-01` | Discovery flag | `$TMPDIR/koa-discovery-{sessionId}.flag` | `discovery-tracker`, `session-start` | `pre-write-guard`, `compact-recovery` |
| ! | `C-02` | Session writes | `.claude/temp/session-writes.json` | `write-tracker` | `sync-check`, `spec-diff-check`, `spec-reflection`, `index-syncer` |
| ✓ | `C-03` | Task-spec | `task-spec-YYYYMMDD-HHMMSS.md` | skill `/plan` | `spec-reflection`, `prompt-context`, `compact-recovery`, `validate-file-contains` |
| ✓ | `C-04` | Marcadores auto-generados | `<!-- AUTO-GENERATED:BEGIN/END -->` | `indices-sync`, `assignments-sync` | todo editor manual de índices |
| ! | `C-05` | Blueprint | `blueprint.json` | `lib/scaffolder`, Wikiflow | `lib/preflight`, `lib/generator`, `pre-write-guard` |

> **Bloque cerrado — 2026-08-29.** Fichas en `fichas/C-0*.md`. 16 hallazgos, 3 de ellos
> `S1`. El más grave: `DEC-001` — `spec-diff-check.js` nunca bloqueó un commit porque lee
> el payload de una variable de entorno que nadie setea. Tres contratos quedaron marcados
> `!` (cerrados con hallazgo grave) y dos `✓`.
>
> **Deuda de esta ronda:** el campo 4 de `C-04` se verificó por inspección y no por
> ejecución (`indices-sync.js` necesita `node_modules`, ausente en el entorno). Cerrar en
> `S-03`. Lo mismo con `test/scaffolder.test.mjs` para `C-05` → cerrar en `G-06`.

**Preguntas propias del bloque** (además de la ficha A):
- ¿El formato está declarado en `.claude/rules/templates-contract.md`? ¿Completo?
- ¿Hay un consumidor que no aparece en la tabla de dependencias de esa regla? → `ACO`
- ¿Dos productores escriben el mismo artefacto con criterios distintos? → `DUP`
- ¿Qué pasa si el artefacto no existe, está vacío o está corrupto? (los cinco casos)

## Bloque 1 · Hooks, en orden de ejecución (20)

> El orden de esta tabla ES el orden en que corren en una sesión. Revisarlos así hace
> visible qué asume cada uno del anterior.

| | ID | Hook | Evento | Puede bloquear |
|---|---|---|---|---|
| ! | `H-00` | `.claude/settings.json` — el cableado | — | — |
| ✓ | `H-01` | `session-start.js` | SessionStart | no |
| ✓ | `H-02` | `prompt-context.js` | UserPromptSubmit | no |
| ! | `H-03` | `sdd/spec-gate.js` | PreToolUse `Edit\|Write\|MultiEdit` (1º) | **sí** |
| ! | `H-04` | `pre-write-guard.js` | PreToolUse `Edit\|Write\|MultiEdit` (2º) | **sí** |
| ! | `H-05` | `harness-gate.js` | PreToolUse `Edit\|Write\|MultiEdit` (3º) | **sí** |
| ! | `H-06` | `sdd/plan-injector.js` | PreToolUse `Edit\|Write\|MultiEdit` (4º) | no |
| ✓ | `H-07` | `bash-guard.js` | PreToolUse `Bash` (1º) | **sí** |
| ! | `H-08` | `spec-diff-check.js` | PreToolUse `Bash` (2º) | **sí** |
| ✓ | `H-09` | `discovery-tracker.js` | PostToolUse `Read` | no |
| ✓ | `H-10` | `write-tracker.js` | PostToolUse `Edit\|Write\|MultiEdit` | no |
| ! | `H-11` | `.claude/scripts/post-edit.js` | PostToolUse `Edit\|Write\|MultiEdit` | no |
| ! | `H-12` | `failure-tracker.js` | PostToolUseFailure | no |
| ✓ | `H-13` | `compact-recovery.js` | PostCompact | no |
| ✓ | `H-14` | `sdd/hotfix-autoclose.js` | Stop (1º) | no |
| ✓ | `H-15` | `spec-reflection.js` | Stop (2º) | **sí** |
| ! | `H-16` | `sync-check.js` | Stop (3º) | **sí** |
| ! | `H-17` | `context-guardian.js` | Stop (4º) | **sí** |
| ✓ | `H-18` | `context-enrichment-guard.js` | — (opt-in, no cableado) | **sí** |
| ✓ | `H-19` | `validators/validate-file-contains.js` | invocado desde frontmatter de skills | **sí** |


> **Bloque 1 cerrado — 2026-08-29.** Las 20 unidades. 24 hallazgos en total, tres `S1`:
> `CAR-001` (`plan-injector` inyecta ~6.155 tokens por Edit sin dedup), `SEC-001`
> (`post-edit.js` ejecuta comandos desde la ruta del payload) y `DEC-003` (`post-edit.js`
> no carga en Node 20, el mínimo que el CLI exige).
>
> **Las respuestas a las preguntas del bloque:**
> - *¿Los cuatro de `Stop` se pisan?* **Sí.** Con `learnings.md` viejo, task-spec abierto e
>   índices atrasados, tres de los cuatro emiten `exit 2` en el mismo cierre, y solo
>   `spec-reflection` tiene anti-bucle.
> - *¿Alguien asume un orden que nada garantiza?* **Sí, tres veces** → `ACO-004`.
> - *¿`H-18` y `H-19` siguen funcionando?* `H-19` sí y tiene test; `H-18` no está cableado
>   a propósito y su justificación está escrita en el archivo.
>
> **El patrón de fondo:** `ACO-001`, `CAR-002` e `INC-007` son tres hooks distintos que
> asumen que `Stop` significa «fin de sesión» cuando significa «fin de respuesta». No es un
> bug repetido: es un malentendido compartido sobre el evento. Candidato a conclusión del
> pase general.
>
> **Deuda de ejecución:** capas 2 y 3 de `bash-guard` y `hotfix-autoclose` verificados por
> lectura, no ejecutando. Cerrar al escribir los tests que pide `HUE-011`.

**Preguntas propias del bloque:**
- `H-00`: ¿el orden declarado en `settings.json` es el que las piezas asumen? ¿Un hook
  depende de que otro haya corrido antes, sin que nada lo garantice?
- Los cuatro de `PreToolUse Edit`: ¿qué pasa si el primero bloquea? ¿corren los demás?
  ¿alguno asume haber corrido cuando no corrió?
- Los cuatro de `Stop`: cuatro hooks que pueden avisar a la vez. ¿Se pisan? ¿El agente
  recibe cuatro mensajes en el mismo cierre? → posible `CAR`.
- `H-18` y `H-19`: no cableados. ¿Siguen funcionando? ¿Alguien los testea?

## Bloque 2 · Scripts deterministas (11)

| | ID | Script | Qué verifica |
|---|---|---|---|
| ! | `S-01` | `scripts/architect.js` | Reglas `ARCH-*` + SEC-RLS + A11Y-03 sobre AST — **sub-tabla obligatoria** |
| ✓ | `S-02` | `scripts/lint-arch-wrapper.js` | memoria de fallos → `LESSONS_LEARNED.md` |
| ✓ | `S-03` | `scripts/indices-sync.js` | auto-indexer AST con caché por mtime (1343 líneas) |
| ✓ | `S-04` | `scripts/check-bento-classes.js` | allowlist del bento (cableado como ARCH-21) |
| ! | `S-05` | `scripts/provocar-reglas.mjs` | **que las reglas puedan fallar** |
| ✓ | `S-06` | `scripts/smoke-scripts.mjs` | **que los scripts puedan fallar** |
| ✓ | `S-07` | `scripts/verificar-specs.mjs` | enlaces entre specs |
| ! | `S-08` | `scripts/assignments-sync.js` | tablas auto-generadas de `ASSIGNMENTS.md` |
| ! | `S-09` | `scripts/assignments-audit.js` | naming, colisiones, refs colgantes |
| ✓ | `S-10` | `scripts/set-env.js` | credenciales en build de producción |
| ✓ | `S-11` | `scripts/lib/*.js` (13 módulos puros) | **en lote** — una ficha, tabla de 13 filas |

**Sub-tabla obligatoria en la ficha `S-01`** — una fila por código, no una ficha por código:

| Código | Qué prohíbe | ¿Tiene fixture en `provocacion.baseline.json`? | ¿Dispara? |
|---|---|---|---|
| ARCH-01 … ARCH-26 (los que emite este archivo) | | | |
| SEC-RLS-01/02/03 | | | |
| A11Y-03 | | | |

> **Ver `INC-001` (reescrito).** No hay hueco de numeración: ARCH-12 y ARCH-13 los emite
> `pre-write-guard.js` y ARCH-20 vive en `lib/a11y-guardrails.js`. La sub-tabla debe cubrir
> solo lo que emite **este** archivo, y la ficha debe cerrar el destino de `ARCH-14`, que
> `verify/SKILL.md` documenta y nadie implementa.

> **Bloque 2 cerrado — 2026-08-29.** Las 11 unidades, **ejecutadas de verdad**: sandbox con
> el boilerplate real y `typescript@5.9`. 9 hallazgos, uno `S1`.
>
> **La respuesta a la pregunta del bloque — ¿quién audita a los auditores?**
> `smoke-scripts` (`S-06`) **sí cumple**: introduce el defecto, verifica que el script lo
> detecte, y restaura sin residuos. `provocar-reglas` (`S-05`) **cubre 4 de 28 reglas**, y
> las 24 sin fixture incluyen las tres de seguridad RLS y las dos que la documentación cita
> como el episodio que motivó escribir el script. Además sale en 1 de fábrica, porque nadie
> puso `SEC-RLS-*` en el baseline.
>
> **Sumando con `HUE-012` (bloque 1):** de las ~48 reglas que el harness aplica entre el
> linter AST y el guard regex, **4 están comprobadas disparando**.
>
> **Deuda de `C-04` cerrada** en `S-03`, ejecutando: los 13 índices con marcadores se
> reescriben, los 2 manuales quedan intactos.
>
> **Deuda nueva:** el camino de fallo de `S-02` (guardar el fallo y convertirlo en lección)
> no se ejercitó.

**Preguntas propias del bloque:**
- `S-05` y `S-06` son los auditores del repo. **¿Quién los audita a ellos?** Si uno de
  los dos no puede fallar, toda la garantía que dan es falsa.
- ¿Qué reglas están en el baseline de provocación (sin fixture) y por qué?

## Bloque 3 · Módulos del CLI (10)

| | ID | Módulo | Responsabilidad declarada |
|---|---|---|---|
| ! | `G-01` | `bin/index.js` | orquestación, sin lógica de negocio (techo ~150 líneas) |
| ! | `G-02` | `lib/config.js` | stack, validación, constantes |
| ✓ | `G-03` | `lib/runner.js` | spawn puro |
| ✓ | `G-04` | `lib/preflight.js` | checks de sistema, sin instalar |
| ✓ | `G-05` | `lib/installer.js` | solo npm/npx |
| ✓ | `G-06` | `lib/scaffolder.js` | solo filesystem |
| ! | `G-07` | `lib/generator.js` | subcomando `generate feature` |
| ! | `G-08` | `lib/feature-templates.js` | 11 plantillas, strings puros |
| ✓ | `G-09` | `lib/ui.js` | solo chalk |
| ! | `G-10` | Los 9 parches de `injectBoilerplate()` | **en lote** — es donde se rompe el proyecto generado |

**Preguntas propias del bloque:**
- ¿Cada módulo respeta la frontera de `.claude/rules/cli-architecture.md`, o hay filtración?
- `G-10`: cada parche asume una forma concreta del output de `ng new`. ¿Qué pasa cuando
  Angular cambia esa forma? ¿Hay algo que lo detecte, o falla silenciosamente en el
  proyecto del usuario?
- La cobertura de `test/*.test.mjs` son 2 archivos para 10 módulos. ¿Qué queda sin tocar?

## Bloque 4 · Subagentes (5)

| | ID | Subagente | Modelo | Tools |
|---|---|---|---|---|
| ✓ | `A-01` | `discovery-scout` | haiku | Read, Grep, Glob |
| ✓ | `A-02` | `arch-auditor` | haiku | Bash, Read, Grep |
| ✓ | `A-03` | `index-syncer` | haiku | Bash, Read, Edit, Write, Grep, Glob |
| ✓ | `A-04` | `supabase-schema` | haiku | Read, Grep, Glob, Bash |
| ✓ | `A-05` | `code-judge` | opus | Read, Grep, Glob (**sin Bash, deliberado**) |

**Preguntas propias del bloque:**
- ¿El set de `tools` es el mínimo necesario? ¿Alguno puede hacer más de lo que su
  contrato promete? (el caso `code-judge` sin Bash es el precedente)
- ¿La `description` describe cuándo invocarlo con precisión suficiente para que se
  invoque solo, o depende de que el humano lo pida?
- ¿El modelo asignado es el correcto para la tarea?
- **¿Cuánto cuesta delegar vs. hacerlo inline?** Cruzar con `.claude/rules/delegation.md`.

## Bloque 5 · Tests del harness (2 lotes)

| | ID | Unidad | Contenido |
|---|---|---|---|
| ✓ | `T-01` | `templates/.claude/tests/*.test.js` | 9 archivos — **¿ejecutan la ruta de fallo?** |
| ✓ | `T-02` | `templates/boilerplate/scripts/lib/*.test.mjs` | 13 archivos de funciones puras |

**La pregunta del bloque**, que es la más importante de toda la auditoría:

> 20 hooks y solo 9 tests. **¿Cuáles son los 11 hooks sin test?** Cada uno es un
> `compact-recovery.js` esperando a pasar. Listarlos explícitamente es un entregable
> de este bloque.

---

# NIVEL B — ficha corta (41 unidades)

## Bloque 6 · Reglas path-scoped (15)

| | ID | Regla | `paths:` cubre |
|---|---|---|---|
| ✓ | `R-01` | `architecture.md` | `src/app/**` ts + html |
| ✓ | `R-02` | `facades.md` | `core/facades/**`, `core/services/**`, `features/**` |
| ✓ | `R-03` | `models.md` | `core/models/**`, `core/facades/**` |
| ✓ | `R-04` | `state-management.md` | `core/**`, `features/**` |
| ✓ | `R-05` | `swr-pattern.md` | `core/facades/**`, `features/**` |
| ✓ | `R-06` | `database.md` | `supabase/**`, `core/services/*` |
| ✓ | `R-07` | `component-selection.md` | `shared/**`, `features/**` |
| ✓ | `R-08` | `screen-contract.md` | `features/**`, `shared/**`, `layout/**` |
| ✓ | `R-09` | `layout-blueprints.md` | `features/**` |
| ! | `R-10` | `visual-system.md` | html, scss, shared, features, layout, styles |
| ✓ | `R-11` | `a11y-spec.md` | html, features, layout |
| ✓ | `R-12` | `ai-readability.md` | html, features, shared |
| ✓ | `R-13` | `notifications.md` | facades de notificación, toast, features, layout |
| ✓ | `R-14` | `testing-tdd.md` | `core/**`, `features/**`, `*.spec.ts` |
| ✓ | `R-15` | `delegation.md` | `src/app/**`, `supabase/migrations/**` |

> **Solape a verificar:** `R-01`, `R-04`, `R-14` y `R-15` matchean casi el mismo glob.
> Al editar un `.ts` de `core/` se inyectan varias a la vez. Medir cuánto pesa el total
> y si alguna es redundante → candidatas a `CAR` o a fusión.

## Bloque 7 · Skills (15)

| | ID | Skill | Invocación |
|---|---|---|---|
| ✓ | `K-01` | `plan` | user-invocable + hook validador propio |
| ✓ | `K-02` | `review` | user-invocable → invoca `code-judge` |
| ✓ | `K-03` | `verify` | user-invocable, Playwright MCP |
| ! | `K-04` | `sync-indices` | user + model |
| ✓ | `K-05` | `harness-feedback` | user + model |
| ✓ | `K-06` | `grill_me` | model-invocable |
| ! | `K-07` | `sdd` | user + model, 11 comandos |
| ✓ | `K-08` | `angular-component` | path-scoped, no user-invocable |
| ✓ | `K-09` | `angular-signals` | path-scoped |
| ✓ | `K-10` | `angular-forms` | path-scoped |
| ✓ | `K-11` | `angular-primeng` | path-scoped |
| ✓ | `K-12` | `design-system` | path-scoped |
| ✓ | `K-13` | `form-ux` | user-invocable |
| ✓ | `K-14` | `supabase-data-model` | path-scoped |
| ✓ | `K-15` | `writing-great-skills` | `disable-model-invocation: true` |

> **Solape a verificar:** `K-08` a `K-12` matchean `src/app/**/*.component.ts` casi todas.
> ¿Se activan cinco skills a la vez? ¿Se contradicen en algo?
> **Frontera a verificar:** `K-04` (sync-indices) vs `A-03` (index-syncer) vs
> `S-03` (indices-sync.js) — tres piezas para el mismo trabajo. Fuerte candidato a `DUP`.

## Bloque 8 · Slash commands (11)

| | ID | Comando | Escribe |
|---|---|---|---|
| ✓ | `D-01` | `/spec-new` | `specs/specs/NNNN-slug/spec.md` |
| ✓ | `D-02` | `/spec-activate` | `specs/.active` |
| ✓ | `D-03` | `/spec-plan` | `plan.md` |
| ✓ | `D-04` | `/spec-tasks` | `tasks.md` |
| ✓ | `D-05` | `/spec-verify` | `acceptance.md` |
| ! | `D-06` | `/fix-new` | `specs/fixes/fix-NNN-X-slug/fix.md` |
| ! | `D-07` | `/fix-close` | cierra el track |
| ✓ | `D-08` | `/hotfix` | `specs/hotfixes/…` (auto-cierra en Stop) |
| ✓ | `D-09` | `/assign-new` | `specs/assignments/ASG-X-NNN-slug.md` |
| ✓ | `D-10` | `/assign-list` | — (solo lee) |
| ✓ | `D-11` | `/assign-claim` | genera track desde una asignación |

> **A verificar en bloque:** los comandos escriben lo que `spec-gate` y `plan-injector`
> después leen. ¿El formato que escriben es exactamente el que esos hooks esperan?
> ¿La convención de IDs (`NNNN-X-slug`, por autor) es consistente entre los 11?

---

# NIVEL C — barrido en lote (8 lotes, sin ficha)

> Se revisan como tabla dentro de este archivo, no como ficha individual.
> Criterio: superficie declarativa donde el riesgo es deriva, no comportamiento.

| | ID | Lote | Qué buscar |
|---|---|---|---|
| · | `L-01` | Los 15 índices de `templates/indices/` | ¿Los 13 auto-generados tienen sus marcadores bien puestos? ¿ANTI-PATTERNS y LAYOUTS están al día? ¿Algún índice quedó sin consumidor? |
| · | `L-02` | Los 5 archivos de `templates/context/` | ¿Los consume alguien? ¿El formato que `session-start` y `prompt-context` parsean está garantizado por la plantilla? |
| · | `L-03` | `templates/.mcp.json` | Tres servidores. ¿Los flags de mínimo privilegio siguen siendo los correctos? ¿`@latest` sin pinear es riesgo? |
| · | `L-04` | Adapters + `AGENTS.md` | Copilot, Cursor, Windsurf. ¿Dicen lo mismo que `.claude/CLAUDE.md` o ya divergieron? |
| · | `L-05` | `templates/docs/` (6 documentos) | **La mayor fuente de `INC`.** Cada número, ruta y comando contra el código real |
| · | `L-06` | `templates/boilerplate/src/` | Superficie grande. Barrido: ¿cada pieza está en su índice? ¿pasa su propio `lint:arch`? |
| · | `L-07` | `templates/supabase/` | config + 2 migraciones. ¿Las migraciones pasan su propio SEC-RLS? |
| · | `L-08` | Configuración suelta | `settings.local.json`, `author.local.json.example`, los 3 `package.json` de hooks/validators/tests, `gitignore.template` |

---

# Cierre

- [ ] Nivel A completo (53/53)
- [ ] Nivel B completo (41/41)
- [ ] Nivel C completo (8/8)
- [ ] **Pase general** — ver `PASE-GENERAL.md`
- [ ] Hallazgos priorizados y convertidos en tracks (`/fix-new` o backlog)
