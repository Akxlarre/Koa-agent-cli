# Evaluación: gentle-ai (Gentleman Programming) — qué aprovechar para Koa

> Fecha: 2026-07-13
> Repo evaluado: https://github.com/Gentleman-Programming/gentle-ai (MIT, Go 1.24+, ~980 archivos)

## Qué es gentle-ai (y en qué se diferencia de Koa)

gentle-ai **no es un scaffolder**: es un "configurador de ecosistemas". Toma agentes de IA
ya instalados (Claude Code, Cursor, OpenCode, Gemini CLI... 15 en total) y les inyecta:
memoria persistente (Engram), workflow Spec-Driven Development (SDD), skills curados,
servidores MCP, persona y reglas de revisión — a nivel global o de workspace.

| | Koa Agent CLI | gentle-ai |
|---|---|---|
| Modelo | Genera proyectos Angular nuevos con harness incluido | Inyecta harness en agentes existentes |
| Stack | Node.js/ESM | Go + TUI (bubbletea) |
| Target | Claude Code (1 agente) | 15 agentes vía adapters |
| Payload | `templates/` copiado 1 vez | Assets embebidos, re-sincronizables (`sync`/`upgrade`) |
| Tests | Solo tests de hooks del template | Golden files + E2E en Docker (Ubuntu/Arch/Fedora) |

La diferencia arquitectónica clave: gentle-ai puede **actualizar** instalaciones existentes
de forma idempotente; Koa hoy solo genera de cero.

---

## Aprovechable — alto valor, bajo costo

### 1. Golden-file testing del scaffolder ⭐ (mayor ROI)

Koa no tiene tests del CLI (`npm test` da error). gentle-ai versiona en `testdata/golden/`
el output exacto que genera para cada agente/config, y los tests comparan contra esos
snapshots con un flag `-update` para regenerarlos.

Aplicación directa en Koa (con `node:test` o vitest, sin dependencias nuevas):
- Snapshot del `CLAUDE.md` generado con `{{PROJECT_NAME}}`/`{{BLUEPRINT_VERSION}}` reemplazados.
- Snapshot de `blueprint.json`.
- Snapshot del árbol de archivos que produce `copyTemplates` + `injectBoilerplate`.
- `TEST_MODE=inject` ya existe — es el punto de entrada natural para estos tests.

### 2. Trigger rules: triage determinista de revisión

gentle-ai inyecta en el prompt un router de decisión (no consejos) para revisar diffs:

- **Tier 1 — trivial** (solo docs/comentarios/formato): ninguna revisión. Costo 0x.
- **Tier 2 — estándar**: exactamente UNA lente según el riesgo dominante
  (readability / reliability / resilience / risk). Costo ~1x.
- **Tier 3 — hot path** (rutas auth/security/payments o >400 líneas): fan-out completo 4R. Costo ~4x.
- Presupuesto de convergencia: máximo 2 rondas de fix por revisión; lo que quede abierto se reporta.

Es puro texto — cero código. Aplicable tal cual al `templates/.claude/CLAUDE.md` para que
los proyectos Angular generados tengan revisión barata y predecible en vez de "revisa todo siempre".

### 3. Delegation triggers (mantener el hilo orquestador delgado)

Reglas concretas que complementan nuestro flujo DESCUBRIR→PLANIFICAR→EJECUTAR→SINCRONIZAR:

- **Regla de 4 archivos**: leer 4+ archivos para entender un flujo → delegar exploración a sub-agente.
- **Regla multi-archivo**: escribir 2+ archivos no triviales → un solo writer, revisión fresca después.
- **Regla de sesión larga**: ~20 tool calls / 5 lecturas exploratorias sin delegar → pausar y delegar.
- Tabla inline vs delegate: leer 1-3 archivos para decidir = inline; explorar = delegar;
  bash de estado (git) = inline; bash de ejecución (test/build) = delegar.

Se agregan como sección al CLAUDE.md del template.

### 4. Skill style guide + convención de frontmatter

gentle-ai tiene un contrato de autoría de skills (`docs/skill-style-guide.md`):

- `description` en UNA línea física, con las palabras trigger primero:
  `"Trigger: ... . {Qué hace el skill}."`, ≤160 chars (máx 250).
- Estructura fija: Activation Contract → Hard Rules → Decision Gates → Execution Steps
  → Output Contract → References.
- Presupuesto de tokens del cuerpo: 180–450 (máx duro 1000). Ejemplos y esquemas van a
  `references/` — esto Koa ya lo hace bien.
- Skills `delegate_only` con "orchestrator gate" explícito: si el orquestador carga el
  skill, la primera instrucción es STOP y delegar; solo el ejecutor continúa.

Los skills de Koa usan description multilínea (`>` folded) — funciona, pero la convención
de una línea con trigger-first hace el skill indexable y el matching más fiable.
Vale la pena adoptar el guide en `templates/` y normalizar los 8 skills existentes.

### 5. Skill registry auto-generado (index-first)

Koa ya tiene la filosofía correcta (índices en `indices/` + skill `sync-indices`), pero se
mantienen **a mano**. gentle-ai los genera: escanea frontmatter de todos los `SKILL.md`,
deduplica (proyecto gana sobre global) y escribe un índice con nombre + descripción completa
+ scope + **path exacto**. El orquestador pasa paths al sub-agente, nunca resúmenes
("index + paths preserva la intención del skill; los resúmenes la distorsionan").

Aplicación: un script Node en el harness generado (disparado por hook `SessionStart`,
como ya hace `discovery-tracker`) que regenere el índice de skills automáticamente.
Elimina la deriva índice-vs-realidad sin esfuerzo del usuario.

### 6. Comando `doctor` (health check read-only)

Koa tiene `preflight.js` (checks *antes* de generar). gentle-ai además tiene
`gentle-ai doctor` para diagnosticar *después*: binarios, estado, disco. El equivalente
Koa sería barato: validar que el harness generado está sano (hooks presentes,
`settings.json` parseable, índices existentes, versión de blueprint). Útil para soporte.

### 7. Skills portables listos para adaptar (MIT/Apache-2.0)

En `skills/` hay 6 skills agnósticos de stack que encajan en el harness del template:

- **work-unit-commits** — commits por unidad de trabajo revisable (nunca por tipo de
  archivo), tests junto al código, PRs <400 líneas.
- **branch-pr** / **chained-pr** — flujo de ramas y PRs encadenados para cambios grandes.
- **comment-writer** — cuándo/cómo comentar código.
- **cognitive-doc-design** — diseño de docs orientado a carga cognitiva.
- **issue-creation** — issues bien formados.

### 8. Patrón de inyección idempotente con markers (para un futuro `koa upgrade`)

gentle-ai edita archivos del usuario delimitando sus secciones con
`<!-- gentle-ai:trigger-rules -->` ... `<!-- /gentle-ai:trigger-rules -->`: correr sync dos
veces reemplaza la sección sin duplicar ni pisar el contenido del usuario. Además hace
backup automático (tar.gz, deduplicado, retiene 5) antes de cada operación.

Hoy Koa no lo necesita (solo genera de cero), pero es **el** patrón si algún día queremos
`npx create-koa-agent upgrade` para llevar mejoras del blueprint a proyectos ya generados
sin destruir personalizaciones. Anotarlo como decisión de diseño futura.

---

## Interesante pero NO copiar (por ahora)

- **Engram (memoria persistente)**: binario/servicio aparte con chunks, manifest, sync
  cloud. Complejidad alta para el beneficio en nuestro caso; el equivalente ligero ya
  existe en Koa (`.claude/temp/LESSONS_LEARNED.md`). A lo sumo, formalizar ese archivo
  como memoria del proyecto en el template.
- **SDD completo** (8 fases: explore→propose→spec→design→tasks→apply→verify→archive, con
  meta-comandos, asignación de modelo por fase, judgment-day con jueces ciegos): mucha
  ceremonia para proyectos Angular de producto. Tomar solo las ideas puntuales de §2, §3
  y el "orchestrator gate" de §4. Si el flujo de 4 pasos de Koa se queda corto, SDD es la
  referencia de hacia dónde crecer.
- **Aparato completo de review** (refuters con votación 2-de-3, ledgers persistidos,
  validación scoped): overkill; el triage de tiers (§2) captura el 80% del valor.
- **Multi-agente / adapters para 15 agentes**: Koa es mono-target (Claude Code) con
  `AGENTS.md` como puente portable — suficiente.
- **Go, TUI, goreleaser, homebrew tap**: stack distinto, irrelevante.

---

## Recomendación priorizada

| # | Acción | Contexto | Esfuerzo | Valor |
|---|---|---|---|---|
| 1 | Golden tests del scaffolder (`TEST_MODE=inject` + snapshots) | A (generador) | Medio | Alto — hoy no hay tests del CLI |
| 2 | Trigger rules (tiers de revisión) + delegation triggers en el CLAUDE.md del template | B (payload) | Bajo | Alto |
| 3 | Skill style guide + normalizar frontmatter (description 1 línea, trigger-first) | B (payload) | Bajo | Medio |
| 4 | Auto-registry de skills vía hook SessionStart en el template | B (payload) | Medio | Medio |
| 5 | Skills portables: adaptar `work-unit-commits` (y evaluar `comment-writer`) | B (payload) | Bajo | Medio |
| 6 | Comando `doctor` post-generación | A (generador) | Bajo | Bajo-Medio |
| 7 | Markers idempotentes + backups → diseño de futuro `upgrade` | A (generador) | Alto | Futuro |
