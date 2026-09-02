# Contratos del harness

> **Generado** desde `.claude/hooks/lib/contracts.js` con `npm run contracts:doc`.
> Lo que está entre los marcadores `AUTO-GENERATED` se reescribe entero; lo de
> afuera se conserva. Si agregás un artefacto compartido, declaralo en el registro
> y volvé a generar — no edites la tabla.

Un **contrato** acá es un archivo o un formato que una pieza escribe y otra lee.
Ninguno lo impone el lenguaje: son acuerdos que se sostienen porque alguien los
respeta. Los dos campos que más cuesta adivinar leyendo el código:

- **lifetime** — cuándo se borra: `turno`, `sesion`, `permanente`.
- **scope** — quién lo comparte: `sesion` (todo el trabajo), `hilo` (el agente
  principal y cada subagente por separado), `proyecto` (vive en el repo).

<!-- AUTO-GENERATED:BEGIN -->
**21 artefactos declarados.**

| Artefacto | Ruta | Lo escribe | Lo lee | lifetime | scope |
|---|---|---|---|---|---|
| `session-writes.json` | `.claude/temp/session-writes.json` | `.claude/hooks/write-tracker.js` | `.claude/hooks/sync-check.js`<br>`.claude/hooks/spec-diff-check.js`<br>`.claude/hooks/spec-reflection.js` | sesion | sesion |
| `discovery-flag` | `.claude/temp/session/<sid>/discovery.flag` | `.claude/hooks/discovery-tracker.js`<br>`.claude/hooks/session-start.js` | `.claude/hooks/pre-write-guard.js`<br>`.claude/hooks/compact-recovery.js` | sesion | sesion |
| `spec-reflection-seen.json` | `.claude/temp/spec-reflection-seen.json` | `.claude/hooks/spec-reflection.js` | `.claude/hooks/spec-reflection.js` | turno | hilo |
| `breaker.json` | `.claude/temp/session/<sid>/thread-<tid>/breaker.json` | `.claude/hooks/pre-write-guard.js` | `.claude/hooks/pre-write-guard.js` | sesion | hilo |
| `ctx-<categoria>.json` | `.claude/temp/session/<sid>/thread-<tid>/ctx-<categoria>.json` | `.claude/hooks/pre-write-guard.js` | `.claude/hooks/pre-write-guard.js` | sesion | hilo |
| `budget-<clave>.json` | `.claude/temp/session/<sid>/thread-<tid>/budget-<clave>.json` | `.claude/hooks/lib/budget.js` | `.claude/hooks/lib/budget.js` | sesion | hilo |
| `task-spec` | `.claude/temp/task-spec-YYYYMMDD-HHMMSS.md` | `.claude/skills/plan/SKILL.md` | `.claude/hooks/spec-reflection.js`<br>`.claude/hooks/prompt-context.js`<br>`.claude/hooks/compact-recovery.js`<br>`.claude/hooks/session-start.js`<br>`.claude/hooks/validators/validate-file-contains.js` | permanente | proyecto |
| `blueprint.json` | `blueprint.json` | *el CLI, al generar* | `.claude/hooks/pre-write-guard.js`<br>`scripts/architect.js` | permanente | proyecto |
| `LESSONS_LEARNED.md` | `.claude/temp/LESSONS_LEARNED.md` | `.claude/hooks/failure-tracker.js`<br>`scripts/lint-arch-wrapper.js` | `.claude/hooks/pre-write-guard.js`<br>`.claude/hooks/lib/lessons.js` | permanente | proyecto |
| `indices-cache.json` | `.claude/temp/indices-cache.json` | `scripts/indices-sync.js` | `scripts/indices-sync.js` | sesion | proyecto |
| `specs/.active` | `specs/.active` | `.claude/commands/spec-activate.md`<br>`.claude/commands/hotfix.md` | `.claude/hooks/sdd/spec-gate.js`<br>`.claude/hooks/sdd/plan-injector.js`<br>`.claude/hooks/sdd/hotfix-autoclose.js` | permanente | proyecto |
| `review-diff.patch` | `.claude/temp/review-diff.patch` | `.claude/skills/review/SKILL.md` | `.claude/agents/code-judge.md` | turno | sesion |
| `DETAIL:BEGIN` | `indices/*.md` | `.claude/agents/index-syncer.md` | `.claude/hooks/session-start.js`<br>`.claude/hooks/compact-recovery.js`<br>`.claude/hooks/lib/budget.js` | permanente | proyecto |
| `last_updated:` | `context/brief.md` | *el humano* | `.claude/hooks/session-start.js`<br>`.claude/hooks/discovery-tracker.js` | permanente | proyecto |
| `provocacion.baseline.json` | `scripts/provocacion.baseline.json` | `scripts/provocar-reglas.mjs` | `scripts/provocar-reglas.mjs` | permanente | proyecto |
| `AUTO-GENERATED:BEGIN` | `indices/*.md, specs/ASSIGNMENTS.md, .claude/temp/LESSONS_LEARNED.md` | `scripts/indices-sync.js`<br>`scripts/assignments-sync.js`<br>`.claude/hooks/lib/lessons.js` | `scripts/indices-sync.js`<br>`scripts/assignments-sync.js`<br>`.claude/hooks/lib/lessons.js`<br>`.claude/agents/index-syncer.md`<br>`.claude/hooks/harness-gate.js` | permanente | proyecto |
| `author.local.json` | `.claude/author.local.json` | *el humano, copiando author.local.json.example* | `.claude/commands/assign-new.md`<br>`.claude/commands/assign-list.md`<br>`.claude/commands/assign-claim.md` | permanente | proyecto |
| `arch-last-failure.json` | `.claude/temp/arch-last-failure.json` | `scripts/lint-arch-wrapper.js` | `.claude/agents/arch-auditor.md` | sesion | proyecto |
| `class-discipline.baseline.json` | `scripts/class-discipline.baseline.json` | `scripts/architect.js` | `scripts/architect.js`<br>`scripts/lib/class-discipline.js` | permanente | proyecto |
| `contrast.baseline.json` | `scripts/contrast.baseline.json` | `scripts/architect.js` | `scripts/architect.js` | permanente | proyecto |
| `bento-classes.allowlist.json` | `scripts/lib/bento-classes.allowlist.json` | *el humano, al aprobar una clase nueva* | `scripts/architect.js`<br>`scripts/check-bento-classes.js` | permanente | proyecto |

## Por qué cada uno es como es

### `session-writes.json`

**Formato:** array JSON de rutas relativas, con separadores "/"

ACO-001: sync-check lo borraba en cada Stop, dejando sin datos a los otros dos.

### `discovery-flag`

**Formato:** lineas "ISO | ORIGEN | indices/NOMBRE.md" — compact-recovery parsea la ruta

HUE-002: vivia en TMPDIR bajo la clave "default", global a toda la maquina.

### `breaker.json`

**Formato:** objeto { "<archivo>::<violacion>": intentos }; al 3er intento corta y escala

ACO-007: no estaba declarado. Vivia en TMPDIR bajo la clave global "default" (HUE-002), asi que un proyecto cortaba el breaker de otro. Es de HILO (HUE-032): los tres intentos son de quien escribe, no de la sesion entera.

### `ctx-<categoria>.json`

**Formato:** marca { at: ISO } por categoria de archivo; su presencia significa "ya inyectado"

ACO-007: son 11 categorias (features, shared, layout, repositories, facades, services, utils, directives, migrations, html, scss). Ambito de HILO: describe LO QUE YA SE DIJO, y lo que oyo un subagente no lo oyo el hilo principal.

### `budget-<clave>.json`

**Formato:** { n, hash } — hash del ultimo texto emitido; la dedup es por CONTENIDO

Lo escribe budget.js por cuenta de quien lo llama: prompt-context —de donde salio el patron, y donde vivia como koa-prompt-ctx-*.json (ACO-006)—, plan-injector (CAR-001), compact-recovery (CAR-004) y context-guardian (CAR-002). Que la dedup sea por contenido es lo que hace que un aviso vuelva solo cuando cambia lo que dice, sin ninguna caducidad. compact-recovery lo borra con olvidar(): tras compactar, "ya lo dije" sigue siendo cierto pero "y vos lo tenes" ya no.

### `task-spec`

**Formato:** encabezados ## exactos + casillas "- [ ]" / "- [x]"; el nombre ordena por fecha

El contrato con mas consumidores. Era el unico de los cinco sin test (HUE-006): los cinco consumidores tenian el suyo, y lo que NO tenia ninguno era lo que los ata — los encabezados, el orden del nombre y las casillas. Eso prueba .claude/tests/task-spec.test.js, corriendo los consumidores de verdad.

### `blueprint.json`

**Formato:** objeto JSON con `stack` como objeto de banderas booleanas

HUE-005 (S1): su `stack` crudo decide que guardrails corren y nadie lo valida.

### `LESSONS_LEARNED.md`

**Formato:** tabla markdown entre marcadores AUTO-GENERATED; fuera de ellos, prosa libre. El separador "|" va escapado — lo hace lib/lessons.js, que es quien conoce el formato

DUP-002 y HUE-016, cerrados. Eran: dos productores donde uno reescribia el archivo entero y borraba las secciones del otro; y un "|" sin escapar que partia la fila y devolvia la firma truncada, rompiendo el dedup para siempre.

### `indices-cache.json`

**Formato:** objeto JSON de mtimes; decide que se re-parsea

ACO-003. La ruta estaba MAL declarada —decia scripts/— y nada lo verificaba: el test miraba que las PIEZAS existieran, no que el `path` fuera real. Vive bajo .claude/temp/, que va gitignored y se limpia; por eso su lifetime es de sesion aunque el artefacto sobreviva a la corrida: perderlo solo cuesta un re-parseo.

### `review-diff.patch`

**Formato:** diff unificado; canal entre /review y el subagente code-judge

ACO-011: no estaba declarado en ningun lado.

### `DETAIL:BEGIN`

**Formato:** marcador HTML que separa Quick Reference de los ejemplos

ACO-005: contrato de 3 piezas sin declarar.

### `last_updated:`

**Formato:** **last_updated:** YYYY-MM-DD — la frescura se audita al abrir la sesion

ACO-005.

### `provocacion.baseline.json`

**Formato:** { sinFixture: string[] } — solo puede achicarse

ACO-009: la provocacion depende de que architect.js nombre el codigo de la regla. Hoy esta VACIO: las 28 reglas tienen fixture (DEC-004, HUE-019).

### `AUTO-GENERATED:BEGIN`

**Formato:** par de marcadores HTML; adentro se reescribe entero, afuera no se toca nunca

ACO-013: es el patron mas reusado del blueprint —tres productores— y no estaba declarado en ningun lado. INC-022: assignments-sync se niega a escribir sin marcadores, y la plantilla canonica no los traia. HUE-007, cerrado: nada impedia editar ADENTRO, y el trabajo no fallaba —desaparecia en la proxima corrida del generador, sin rastro—. Lo frena GATE-D1 en harness-gate, que detecta la superficie por los marcadores EN DISCO y no por una lista de rutas, que es lo que se desactualiza (HUE-003).

### `author.local.json`

**Formato:** { "code": "X" } — una letra; gitignored, es identidad local, no del repo

ACO-013. Va gitignored A PROPOSITO: si viajara en el repo, dos personas clonarian el mismo codigo de autor y los track IDs colisionarian.

### `arch-last-failure.json`

**Formato:** la ultima corrida fallida de lint:arch, para que el subagente no la repita

ACO-013: el canal entre un script y un subagente. El unico contrato del harness cuyo consumidor es un .md que describe a un agente, no codigo que lo lea.

### `class-discipline.baseline.json`

**Formato:** conteos por regla del DS; ratchet — un conteo solo puede bajar

ACO-013. Koa se entrega SIN este archivo: tolerancia cero. Se genera con `npm run lint:arch -- --update-ds-baseline` solo si el proyecto adopta deuda a proposito, y entonces el ratchet la congela en vez de dejarla crecer.

### `contrast.baseline.json`

**Formato:** pares token/fondo que hoy no llegan a AA; ratchet propio de ARCH-25

ACO-013. Tambien ausente de fabrica, y por el mismo motivo.

### `bento-classes.allowlist.json`

**Formato:** { classes: string[] } — toda clase .bento-* del SCSS tiene que estar aca

ACO-013 y ARCH-21: el freno contra el sprawl del bento. A diferencia de los dos baselines, este SI viaja en el payload — no es deuda tolerada, es el vocabulario aprobado.

<!-- AUTO-GENERATED:END -->
