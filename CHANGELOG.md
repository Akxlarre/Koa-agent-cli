# Changelog — Koa Agent Blueprint

Formato basado en [Keep a Changelog](https://keepachangelog.com/). Solo se documentan **breaking changes** y **cambios que afectan proyectos generados**.

Para migrar un proyecto existente entre versiones, sigue las instrucciones de cada sección "Migración".

---

## [Unreleased]

### Lo que cambia en un proyecto generado

- **El SDD ya no promete un verificador que no existe** (`INC-028`). `sdd/SKILL.md`
  describía un «AC verifier (Haiku)» como hook de prompt en `Stop`, «definido inline en
  `.claude/settings.json`», y lo llamaba la fuente de verdad del cierre; la plantilla de
  `tasks.md` esperaba que devolviera `{ok: true}` y la de `acceptance.md` lo ponía como
  firma. No había hook de prompt, ni subagente, ni archivo. La verificación de los AC es
  `/spec-verify`, que corre el agente principal cuando alguien lo invoca, y eso dicen
  ahora los tres archivos: nada se dispara solo, y el cierre lo decide el usuario.
- **`docs/HOOKS-SYSTEM.md` describe Sync Check como lo que es**: un hook `command` que
  compara fechas de modificación contra `indices/`, no un hook de prompt evaluado por
  Haiku. Es el documento al que `.claude/CLAUDE.md` manda para el detalle de los hooks. No
  lo encontró una lectura: lo encontró el detector nuevo.

### Para el que trabaja sobre este repositorio

- `hook-wiring.test.js` y `agent-contracts.test.js` miran también lo que la prosa del
  harness **afirma**, no solo lo que está cableado: toda fila de una tabla
  `| Hook | Evento |` tiene que ser un archivo que `settings.json` corre en ese evento,
  ningún texto describe un hook de prompt o de agente si no hay uno cableado, y todo
  modelo o subagente que la prosa nombra lo declara un frontmatter. De las diez líneas que
  describían mecanismos inexistentes atrapan ocho; las dos que se escapan nombraban al
  verificador sin describirlo («convive con AC Verifier»), y eso un regex no lo distingue
  sin una lista de nombres.

### Migración

Ninguna acción obligatoria. Para traer las plantillas corregidas, volvé a correr el CLI en
modo **Inject Only**. Los `acceptance.md` que ya escribiste siguen diciendo «Verifier:
ac-verifier (Haiku)»: es solo texto, y no lo lee ningún hook.

---

## [7.2.0] — 2026-09-03

La versión de la auditoría. 91 hallazgos registrados y cerrados sobre las 102 unidades
del harness y del generador, con una regla de método: **cada arreglo se midió antes y
después, y cada mecanismo se puso delante de su propia violación.** Una regla que no
dispara ante lo que prohíbe es decoración.

También es la primera versión que se publica en npm, como `create-koa-agent`.

### Lo que más importa si ya tenés un proyecto generado

**Los chequeos ahora se prueban a sí mismos.** `npm run lint:arch:provocar` arma un
sandbox por regla con el archivo mínimo que la viola y exige que el linter la nombre:
**28 de 28**, con el baseline vacío. `npm run smoke:scripts` hace lo mismo con los
scripts de `package.json` — les mete un defecto y exige que se den cuenta. Los dos
nacieron de tres bugs reales que vivieron meses: un `tsc` que compilaba cero archivos y
salía 0, un `node --test` sobre tests de Deno que fallaba siempre, y `ARCH-26` escrita,
testeada y sin cablear.

**Cada regla dice ahora si te frena o solo te pide.** Las 16 de `.claude/rules/` declaran
`enforcement: mecanizada` (con los códigos que la respaldan: `ARCH-01`, `A11Y-03`…) o
`enforcement: social`. Son **8 y 8**. Dos que se leían como acuerdos estaban mecanizadas
sin decirlo, así que un agente bloqueado con `[ARCH-12]` no tenía cómo llegar a la regla
que se lo explica.

**`docs/CONTRATOS.md`**, nuevo y generado: los 21 artefactos compartidos del harness —qué
pieza escribe cada uno, quién lo lee, cuándo se borra—. Antes eso vivía solo del lado del
CLI, así que un agente trabajando en tu proyecto no tenía forma de enterarse de que
`sync-check` borra el archivo del que depende `spec-diff-check`.

**Un segundo juez.** `security-judge` audita escalada de privilegios, RLS evadible y fuga
de datos — el fallo que pasa limpio por los checks deterministas. `/review` dispara por
**riesgo**, no por conteo de archivos: 🟢 estilos y docs no corren nada, 🟡 lógica corre
`code-judge`, 🔴 `supabase/migrations/`, auth o guards corren **los dos en paralelo y
manda el peor veredicto**. Y a los jueces se los mide: `.claude/evals/` trae 7 fixtures
con verdad de campo y `/eval-jueces` reporta recall y falsos positivos.

### Correcciones que cambian comportamiento

- **El Discovery Gate ya no se conforma con que el flag exista.** Exige una lectura de
  `indices/`. Abrir `context/brief.md` levantaba un bloqueo cuyo texto dice, literal,
  «lee los índices del proyecto».
- **El estado por sesión sale del payload de stdin.** `CLAUDE_SESSION_ID` no existe: todo
  vivía bajo la clave `'default'` en `$TMPDIR`, así que una lectura en un proyecto
  levantaba el Gate de otro.
- **`ARCH-09` mide el cuerpo de la clase, no el `@Component`.** Con template inline
  contaba HTML y lo llamaba «clase demasiado grande». `section-hero` pasó de 1.170 a 198
  líneas reales y `tabs` dejó de ser falso positivo.
- **`/fix-new` crea el track en `specs/fixes/<id>/`**, no en `specs/<id>/`. Enumeraba los
  IDs en un lado y creaba en otro: reutilizaba `fix-001` y producía lo que
  `assignments-audit.js` declara violación de naming.
- **`ARCH-07` no toca `src/styles/`.** La capa de motion del design system —view
  transitions, overrides de PrimeNG— tiene `@keyframes` curados a propósito.
- **El linter avisa cuándo NO pudo correr.** Sin el paquete `typescript` sale en 1 con el
  mensaje de qué falta, en vez de morir con un `TypeError` o —peor— reportar 28 reglas
  muertas que están vivas.

### Para el que trabaja sobre este repositorio

- **CI en GitHub Actions**, Node 20 y 22, corriendo las **cuatro** suites. Corría dos, y
  las dos que faltaban son justamente las que estuvieron en rojo tres tandas sin que
  nadie se enterara.
- `npm test` encadena las cuatro: `test:cli`, `test:hooks`, `test:guardrails`,
  `test:provocacion`. Más `test:integracion`, que corre `ng new` de verdad y le pasa el
  linter encima al proyecto generado.
- El paquete declara `files`: se publicaban 474 archivos y 2,9 MB, con los 38 de
  `docs/auditoria/` adentro.
- La versión del paquete y `BLUEPRINT_VERSION` se mueven juntas, con un test que lo
  verifica. Estaban en `1.0.0` y `7.1.0`, sin relación declarada.

### Migración

Ninguna acción obligatoria. Un proyecto generado con 7.1.0 sigue funcionando.

Para adoptar lo nuevo, volvé a correr el CLI en modo **Inject Only** sobre tu proyecto:
respeta lo que ya escribiste (`context/`, `indices/` y tu código quedan intactos) y
actualiza el harness. Después:

```bash
npm run contracts:doc        # genera docs/CONTRATOS.md desde el registro
npm run lint:arch:provocar   # confirma que las 28 reglas disparan en TU proyecto
npm run smoke:scripts        # confirma que tus scripts pueden fallar
```

Si tenés fix tracks abiertos en `specs/<id>/fix.md`, `/fix-close` sigue leyendo esa ruta
como fallback; los nuevos van a `specs/fixes/<id>/`.

---

## [7.1.0] — 2026-08-29

Continúa donde quedó 6.9.0. Aquel cierre puso guardrails deterministas sobre RLS
(`SEC-RLS-01/02/03`), que atrapan la política **ausente** o **obviamente abierta**.
Quedaba fuera la política **presente, acotada y aun así explotable** — y esa no la
ve ningún regex.

### Added
- **Subagente `security-judge`** (`.claude/agents/security-judge.md`, opus, sin
  `Bash`). Audita el diff con una sola pregunta: *¿cómo rompo esto?* Rúbrica de
  ocho criterios sobre el terreno que los checks deterministas no pisan: un `USING`
  más amplio que la escritura que hacía falta; escalada por columna dentro de la
  fila propia (`role = 'admin'` sobre tu propio perfil); ownership comparado contra
  una columna que el propio cliente escribe; `SECURITY DEFINER` sin `search_path`
  fijo; UI escondida por rol sin política que la respalde en la BD; fuga de esquema
  por errores que no pasan por `mensajeSeguroDeBd()`; `service_role` key en cliente;
  buckets de Storage sin políticas.
- **Semántica de `WITH CHECK` documentada en la rúbrica.** Un `WITH CHECK` ausente
  **no** es por sí solo un hallazgo: PostgreSQL reutiliza la expresión `USING` para
  validar la fila nueva. La rúbrica lleva los tres casos verificados contra
  PostgreSQL 16 —el falso positivo y las dos vulnerabilidades reales— para que el
  juez no grite lobo.
- **Regla del camino de explotación.** Todo `RECHAZADO` del nuevo juez debe nombrar
  atacante, petición y qué consigue leer o escribir. Sin eso no es un rechazo, es
  una observación, y baja a `APROBADO CON RESERVAS`. Un auditor que reporta
  sospechas en vez de fallos entrena al equipo a ignorarlo.
- **`/review` dispara por riesgo, no por conteo de archivos.** 🟢 solo estilos/docs
  → ningún juez; 🟡 lógica → `code-judge`; 🔴 `supabase/migrations/`, auth, guards,
  `has-role`, RPC o Storage → los dos jueces **en paralelo**, aunque el diff sea de
  una línea. El criterio viejo ("más de 2 archivos") trataba cinco archivos de SCSS
  como más riesgosos que una policy RLS invertida.
- **Manda el peor veredicto.** Un `RECHAZADO` de `security-judge` no lo compensa un
  `APROBADO` de `code-judge`.

- **Corpus de evals para los jueces** (`.claude/evals/`) y skill **`/eval-jueces`**.
  `provocar-reglas.mjs` ya medía si cada regla del linter puede fallar de verdad;
  su propia cabecera dice que *"una regla que nunca se pudo hacer fallar es
  decoración"*. Eso valía igual para los jueces y ahí nadie lo verificaba. El
  corpus trae 7 fixtures con verdad de campo: 4 vulnerables (uno por criterio) y
  **3 controles limpios**, porque un juez que rechaza todo saca 100% de recall.
  Dos de los limpios son trampas: un `WITH CHECK` omitido que es seguro, y un
  `USING (true)` legítimo sobre un catálogo público.
- **Baseline de criterios sin fixture**, con la misma regla que el del linter:
  solo puede achicarse. Los diez criterios de `code-judge` entran ahí — lleva
  versiones en producción sin una sola prueba de que detecte algo, y ahora eso
  está anotado en vez de ser invisible.

### Por qué dos jueces y no un criterio más en `code-judge`

Habría sido más barato: un subagente, una llamada. No funciona. La seguridad como
criterio C11 de once compite con diez criterios de arquitectura y pierde — el
modelo llega ahí con el análisis ya encaminado hacia capas y contratos. Una
escalada de privilegios no se encuentra de pasada; hay que ir a buscarla con esa
intención desde el primer token. Por eso corren en paralelo, y por eso
`security-judge` no ve el veredicto de arquitectura antes de emitir el suyo.

### Migración desde 7.0.0

Ninguna acción obligatoria. `create-koa-agent` sobrescribe `.claude/` (es
`CLI_OWNED`), así que el subagente y el `/review` nuevo llegan al regenerar. En un
proyecto existente que no quiera regenerar: copiar
`.claude/agents/security-judge.md` y reemplazar `.claude/skills/review/SKILL.md`.

No cambia ningún contrato de hooks ni de task-spec.

---

## [7.0.0] — 2026-08-24

Cosecha aprendizajes reales de Autoescuela (y de la spec 0002 de "app-familiar") hacia el
blueprint genérico, desarrollada en paralelo a 6.6.0→6.9.1. Esta versión reconcilia ambas
líneas de trabajo: nada de lo agregado en 6.5.0→6.9.1 (harness-gate.js, subagentes,
Circuit Breaker, Approval Gate, guardrails RLS) se perdió al integrar esto.

### Added
- **Motor SDD completo, dormido por defecto** (`.claude/hooks/sdd/`, `.claude/skills/sdd/`,
  `.claude/commands/`): `spec-gate.js`, `plan-injector.js`, `hotfix-autoclose.js`, 11 slash
  commands (`/spec-*`, `/fix-*`, `/hotfix`, `/assign-*`). Sin carpeta `specs/` no bloquea
  nada — es opt-in.
- **Patrón App-like (fill-screen)** + reparación del Full Scaffold.
- **Sistema de reveal del bento** + auto-indexer de 13 índices con caché incremental.
- **Guardrails nuevos en `architect.js`** (25 → 28 reglas con las `SEC-RLS-*` de 6.9.0):
  `ARCH-21` (allowlist del bento), `ARCH-23` (contrato App-like como guardrail, no prosa),
  `NAV-01` (el menú no puede apuntar a rutas inexistentes), `rule-wiring` (audita que toda
  regla registrada pueda fallar de verdad), integridad de enlaces entre specs.
- Componentes nuevos del boilerplate: `section-hero`, `tabs`, `badge`, `layout-drawer` con
  navegación interna (`back()`, inputs por nivel), sanitizador único de errores de BD
  (`db-error.utils.ts`, `error-sanitizer.service.ts`), `global-error-handler.ts`.
- Varias entradas de `LESSONS_LEARNED` documentando fricción real encontrada en el camino
  (migraciones semilla que nunca se pudieron aplicar, CSP bloqueando Supabase local, el CLI
  destruyendo contexto que no había escrito).

### Fixed
- **`indices/CLI-MODULES.md`** desactualizado respecto al schema real de `blueprint.json`
  (`scaffoldMode`, `tier`/`team`/`product` de Wikiflow, `ANGULAR_MAJOR`).
- **`doc-links.test.js`** asumía que toda regla emitida se documenta en un único archivo
  (`docs/TECH-STACK-RULES.md`). Ya no es cierto: `architect.js` declara un `doc:` por regla,
  y varias apuntan a `.claude/rules/visual-system.md`, `indices/STYLES.md`,
  `.claude/rules/a11y-spec.md`, `.claude/rules/screen-contract.md` o
  `.claude/skills/design-system/SKILL.md`. El test ahora resuelve el `doc:` real de cada
  regla en vez de asumir uno solo, y respeta el ancla explícita cuando difiere del ID
  (`SEC-RLS-01` documentada bajo `#ap-012`, no `#sec-rls-01`).
- **15 reglas del linter sin sección documentada** (`ARCH-11/15/16/17/18/19/21/22/23/24/25/26`,
  `A11Y-03`, `NAV-01`, `ICON-01`): la mayoría ya tenían prosa real escrita, solo faltaba el
  `<a id>` explícito; las que no tenían ninguna cobertura (`ARCH-11/15/16/17/18/19/22`,
  `NAV-01`, `ICON-01`) suman una sección mínima nueva.

- **Colisión de IDs resuelta**: `ARCH-11` significaba dos reglas distintas según quién lo
  emitía — `pre-write-guard.js` ("`supabase.types.ts` es auto-generado") vs `architect.js`
  ("clases de token muertas"), desarrolladas en paralelo sin verse. Se renumeró la de
  `pre-write-guard.js` a **`ARCH-13`** (la menos referenciada de las dos: `architect.js` ya
  tenía toda la documentación nueva de este release construida alrededor de su ARCH-11).
  `ARCH-12` (Repository boundary) no colisionaba y queda igual. Actualizado en
  `pre-write-guard.js`, su test, `docs/TECH-STACK-RULES.md` (reordenado a ARCH-10→12→13),
  `.claude/rules/database.md` y `docs/KOA-AGENT-CLI-DOCUMENTO-COMPLETO.md`.

### Migración desde 6.9.1
1. Copiar `.claude/hooks/sdd/`, `.claude/skills/sdd/`, `.claude/commands/` completos.
2. Copiar `.claude/hooks/context-enrichment-guard.js` (opt-in, no se cablea solo).
3. Reemplazar `scripts/architect.js`, `scripts/indices-sync.js`, `scripts/lib/` completo.
4. Reemplazar `.claude/rules/visual-system.md`, `a11y-spec.md`, `screen-contract.md` (si no
   los personalizaste) y `indices/STYLES.md` — traen las anclas nuevas de este release.
5. Copiar los componentes de boilerplate nuevos (`section-hero`, `tabs`, `badge`,
   `layout-drawer`, `error-sanitizer.service.ts`, `global-error-handler.ts`) si tu proyecto
   generado los necesita.
6. Correr `npm run claude:test-hooks` y `npm test` — ambas suites deben quedar en verde.

---

## [6.9.1] — 2026-08-19

Enlaces de documentación rotos y reglas sin documentar. Nada de esto rompe un
build, que es exactamente por qué llevaba tiempo pasando desapercibido.

### Fixed
- **Dos anclas rotas**, ambas introducidas en 6.9.0 al agregar los checks de RLS:
  `docs/TECH-STACK-RULES.md#database` y `indices/ANTI-PATTERNS.md#ap-012`. Cada
  mensaje de error del linter termina en una línea `Doc:` — si el ancla no existe,
  el agente recibe una instrucción que no lleva a ninguna parte.
- **9 reglas se emitían sin estar documentadas** en el archivo al que el propio
  mensaje de error apunta: `ARCH-11`, `ARCH-12`, `A11Y-01/02`, `LLM-01/02` y los
  tres `SEC-RLS-*`. Ahora tienen sección propia en `docs/TECH-STACK-RULES.md`.
- **`.claude/rules/database.md`** decía "activar RLS" y nada más. Ahora explica por
  qué activar RLS sin policies deja la tabla *inaccesible*, por qué `USING (true)`
  no es el arreglo, y qué check salta en cada caso — con SQL de los dos lados.

### Added
- **`doc-links.test.js`** — el fix real. Recorre todo el payload, junta cada
  referencia `archivo.md#ancla` y verifica que resuelva; además comprueba que toda
  regla que los hooks o el linter **emiten** tenga sección documentada, y que su
  ancla sea explícita (`<a id="…">`) en vez de un slug derivado del título, que se
  rompe en silencio si alguien reescribe el encabezado.

  Se verificó que el test falla de verdad: renombrando un ancla y simulando una
  regla nueva sin documentar, ambos casos quedan en rojo.

- **Anclas explícitas en los 12 anti-patrones** de `indices/ANTI-PATTERNS.md`.

### Nota
En el proceso reporté "12 anclas rotas". Era un error de mi verificación, que solo
miraba slugs de encabezados e ignoraba las etiquetas `<a id>` que ya existían. Las
rotas de verdad eran 2, y las dos las había introducido yo en 6.9.0. El test nuevo
usa el criterio correcto.

### Migración desde 6.9.0
1. Reemplazar `docs/TECH-STACK-RULES.md`, `.claude/rules/database.md` e
   `indices/ANTI-PATTERNS.md` (si no lo personalizaste).
2. Copiar `.claude/tests/doc-links.test.js` y correr `npm run claude:test-hooks`.

---

## [6.9.0] — 2026-08-19

Cierra el punto que 6.8 dejó documentado como sabido-y-no-resuelto: no había
guardrail para políticas RLS.

### Added
- **`SEC-RLS-01` — tabla creada sin ninguna política.** El guard ya exigía
  `ENABLE ROW LEVEL SECURITY`, pero nada verificaba que existiera una sola
  `CREATE POLICY`. Una tabla con RLS y cero políticas **no es segura: es
  inaccesible** — Postgres deniega por defecto, así que ni tu propia app puede
  leerla. El fallo aparece en runtime, lejos de la migración que lo causó.
- **`SEC-RLS-02` — política permisiva sobre una escritura.** El "arreglo" natural
  del bloqueo anterior es `USING (true)`, que abre la tabla a cualquier usuario
  autenticado: se pasa de inaccesible a totalmente abierta en un commit, y ambos
  extremos compilan. Se bloquea en `FOR ALL / INSERT / UPDATE / DELETE`, y también
  cuando **falta la cláusula `FOR`** — ahí Postgres asume `ALL`, que es el caso más
  permisivo y el más fácil de escribir por accidente.
  `FOR SELECT USING (true)` sigue permitido: una tabla de catálogo pública es
  legítima, y es la única forma en que `true` se defiende.
- **`architect.js` ahora audita `supabase/migrations/`.** Nunca lo había hecho: el
  linter solo escaneaba `src/app/**`, así que el SQL del proyecto no pasaba por
  ninguna auditoría completa. Suma `SEC-RLS-03` (tabla sin RLS en ninguna migración).

### Por qué el hook y el linter no son redundantes aquí

Es el único caso donde ambos miran lo mismo con criterios distintos, a propósito:

- El **hook** ve un archivo en el momento de escribirlo y exige el par
  tabla+política **juntos** — la convención del blueprint, que sus propias
  migraciones siguen.
- El **linter** ve todas las migraciones a la vez, reconstruye el esquema acumulado
  y detecta el agujero real: una tabla que, sumadas todas las migraciones, sigue sin
  políticas. Una tabla creada en la migración 3 con políticas en la 7 le parece bien,
  porque lo es.

Ninguno solo alcanza: el hook no puede ver los otros archivos, y el linter corre
después de que el código ya se escribió.

### Changed
- **Un test existente cambió de expectativa.** `permite CREATE TABLE con RLS`
  afirmaba que activar RLS bastaba. Desde `SEC-RLS-01` no basta, y el test lo
  detectó al primer intento. Ahora es `permite CREATE TABLE con RLS y politica`.
- **AP-012 se reescribió.** Estaba en el Grupo 2 ("invisibles para el regex") y ya
  no pertenece ahí. Se conserva porque el razonamiento —cómo se pasa de inaccesible
  a abierta— vale más que la regla, y ahora lista qué check lo vigila.
- 105 tests (6.8 cerró con 91). Incluye una regresión que verifica que las
  migraciones que envía el blueprint sigan pasando el guard: si un check nuevo las
  rompe, el proyecto generado arranca bloqueado.

### Migración desde 6.8
1. Reemplazar `.claude/hooks/pre-write-guard.js` y `scripts/architect.js`.
2. Correr `npm run lint:arch`. Si tenés tablas sin políticas o con `USING (true)`
   en operaciones de escritura, van a aparecer ahora. **No las silencies**: una
   tabla sin políticas está rota, y una permisiva está abierta.
3. Reemplazar `indices/ANTI-PATTERNS.md` (AP-012 reescrito) si no lo personalizaste.

---

## [6.8.0] — 2026-08-19

Dos huecos que quedaron abiertos al agregar los subagentes en 6.5.

### Added
- **`.claude/rules/delegation.md`** — los subagentes existían desde 6.5 pero solo
  estaban anunciados en `CLAUDE.md`, que es precisamente el tipo de *guideline* que
  este proyecto sostiene que no funciona. Ahora es una regla path-scoped: se carga
  sola al editar código, que es cuando la decisión de delegar se toma.

  La mitad útil de la regla es **cuándo NO delegar**. Cada subagente es una llamada
  completa que arranca sin nada de lo que el agente principal ya sabe: pedirle a
  `discovery-scout` un dato que Session Start ya inyectó paga una llamada por
  nada, y un resumen de treinta líneas es lo peor que puedes tener antes de
  refactorizar un servicio.

- **`indices/ANTI-PATTERNS.md` — 6 anti-patrones nuevos (AP-007→012).** El índice
  ya traía seis, pero los seis eran cosas que el Architect Guard bloquea por regex:
  documentaban lo que el hook ya impedía, sin aportar nada que el hook no supiera.

  Los nuevos son los que **ningún regex puede ver**: un Smart component disfrazado
  de Dumb, `effect()` usado para estado derivado, un Facade que expone su signal
  escribible, un Repository que filtra la forma de la respuesta de Supabase, un
  nombre que contradice `context/domain.md`, y una tabla con RLS activado pero sin
  políticas —el guard exige `ENABLE ROW LEVEL SECURITY` pero no verifica que exista
  una sola `CREATE POLICY`, y una tabla con RLS y cero políticas no es segura: es
  inaccesible, hasta que alguien la "arregla" con `USING (true)`.

  El archivo ahora explica esa división y cómo agregar entradas nuevas. Importa
  porque `code-judge` lee este índice como criterio C9 de su rúbrica: una entrada
  aquí se convierte en algo que se revisa en cada `/review`.

### Migración desde 6.7
1. Copiar `.claude/rules/delegation.md`.
2. Reemplazar `indices/ANTI-PATTERNS.md` — o, si ya lo llenaste con hallazgos
   propios, copiar solo el Grupo 2 y la sección "Cómo leer este índice". Tus
   entradas propias son más valiosas que las que trae el blueprint.

### Sabido y no resuelto
El Architect Guard no verifica que una migración con `CREATE TABLE` incluya
políticas RLS. Queda documentado como AP-012 y lo detecta `/review`, pero no hay
guardrail automático. Sería una regex más en `pre-write-guard.js`.

---

## [6.7.0] — 2026-08-19

Auditoría del **boilerplate**. Las versiones 6.5 y 6.6 trabajaron sobre el harness;
nadie había ejecutado nunca los scripts que se le envían al usuario final.

El hallazgo que resume todo: **el proyecto generado fallaba su propio linter**.
Un usuario corría `npx create-koa-agent`, después `npm run lint:arch`, y recibía
4 errores en un scaffold recién creado. El agente, en el paso VALIDAR, se
encontraba con que el proyecto estaba roto antes de escribir una línea.

### Fixed
- **`core/services/ui/` era una copia mal hecha.** Contenía un `gsap-animations.service.ts`
  duplicado (39 KB) y dos servicios de layout-drawer. Los tres sin `.spec.ts`, que es lo
  que producía 3 de los 4 errores de `lint:arch`.
  La copia de `ui/` resultó ser el **superset**: 46 métodos contra 39 del canónico, sin
  ninguna firma incompatible (la única diferencia era el nombre de un parámetro). Y
  `drawer.component.ts` importaba desde `ui/` precisamente porque necesitaba
  `animateDrawerEnter`/`animateDrawerLeave`, que solo existían allí. Se promovió la
  versión completa al path canónico, se movieron los layout-drawer a `core/services/`
  —donde viven todos los demás— y `ui/` desapareció.
- **`toast.service.ts` no tenía tests** (el 4º error de `lint:arch`). Ahora tiene spec,
  igual que `layout-drawer.service.ts` y `layout-drawer.facade.service.ts`.
- **`.animate-fade-in-up` y `.animate-stagger` no existían.** `styles/_animations.scss`
  las define, y `AGENTS.md`, `.claude/CLAUDE.md` y la inyección de contexto de
  `pre-write-guard.js` se las recomiendan a los proyectos **sin GSAP** — que es el
  default. Pero `styles.scss` nunca hacía `@use` del archivo: las clases existían solo
  en la documentación. Ahora está cableado y verificado en el CSS compilado.
- **5 parciales SCSS huérfanos eliminados** (~28 KB inalcanzables desde `styles.scss`):
  `styles/_view-transitions.scss`, `styles/_animations.scss` (este se cableó en vez de
  borrarse), y los directorios anidados `styles/layout/layout/` y `styles/motion/motion/`.
  Los anidados eran más nuevos y más ricos que los importados, pero **no se podían
  promover**: migran a container queries con `@container layoutmain (…)` y nada en el
  boilerplate declara `container-name: layoutmain` — sus breakpoints nunca habrían
  disparado. Son trabajo extraído de otro proyecto y nunca adaptado. Siguen en el
  historial de git si se quiere retomarlos, pero requieren además declarar ese container
  en el shell.

### Verificado
Los cuatro scripts del boilerplate se ejecutaron por primera vez contra un proyecto
generado real: `architect.js` (0 errores, 0 advertencias), `indices-sync.js` (incluida
la segunda corrida, que confirma el cache incremental), `lint-arch-wrapper.js` y
`set-env.js` (exit 1 sin variables de entorno, exit 0 y escritura correcta con ellas).

### Changed
- `indices/TEMPLATES-REGISTRY.md` y `indices/CLI-MODULES.md` sincronizados. El registry
  llevaba tres versiones desactualizado: decía 8 hooks (hay 12 + 1 validador), 7 skills
  (hay 9), 12 reglas (hay 13) y no mencionaba los subagentes. Ahora documenta también
  los dos contratos que se pueden romper en silencio: el del task-spec y el del
  discovery flag.

### Migración desde 6.6
1. Si tu proyecto importaba desde `@core/services/ui/…`, cambia a `@core/services/…`.
   El servicio de GSAP resultante es un superset — no pierdes métodos.
2. Agrega `@use "./styles/animations";` a `src/styles.scss` si usas las clases
   `.animate-*` sin GSAP.
3. Copia los tres `.spec.ts` nuevos si quieres que `lint:arch` pase en limpio.
4. Revisa si tienes parciales SCSS bajo `src/styles/` que ningún `@use` alcance.

---

## [6.6.0] — 2026-08-19

Los guardrails de 6.5 corrigen al agente **después** de que decidió mal. Esta versión
mueve la intervención hacia adelante: al arranque de la sesión y antes de cada prompt.

Cambios inspirados en revisar [disler/claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery),
que documenta los 13 hook events del ciclo de vida — Koa usaba 6.

### Added
- **`session-start.js`** (SessionStart) — inyecta los índices core (Quick Reference,
  truncados), el objetivo de `context/brief.md` y los pendientes del último task-spec
  al abrir la sesión. **Levanta el Discovery Gate** escribiendo el mismo flag que
  `discovery-tracker.js`: si el agente ya tiene los índices en contexto, bloquearlo por
  "no haberlos leído" sería falso. Si no hay índices, el flag no se escribe y el Gate
  sigue activo como red de seguridad.
- **`prompt-context.js`** (UserPromptSubmit) — corre antes de que Claude vea el prompt.
  No repite lo de SessionStart: solo lleva lo que se degrada dentro de una sesión — el
  `## Out of scope` del brief y las casillas abiertas del spec. Con dedup por contenido
  y refresco cada 8 prompts.
- **`validators/validate-file-contains.js`** — validador genérico parametrizado por
  flags (`--directory`, `--pattern`, `--contains`, `--max-age`, `--require-file`). No
  sabe nada del proyecto: un validador, muchos usos.
- **Hooks en el frontmatter de `/plan`** — la skill declara un hook de `Stop` que valida
  que el task-spec exista y contenga sus cinco secciones obligatorias. Pedir un formato
  en prosa es una guideline; esto lo convierte en guardrail.
- **Tests** para los tres hooks nuevos: 91 en total, todos en verde (6.5 cerró con 55).

### Changed
- **`code-judge` perdió `Bash`.** Ahora tiene solo `Read, Grep, Glob` y recibe el diff
  como archivo (`.claude/temp/review-diff.patch`, que deja `/review` con una
  redirección). Antes tenía `Bash` para correr `git diff`, y con `Bash` podía escribir
  usando `>` — la regla "el juez no arregla nada" dependía de que el juez se portara
  bien. Un juez que puede editar el código que juzga no es un juez.
- **`/review`** deja el diff en un archivo en vez de leerlo. El diff completo no entra
  al contexto principal: lo lee el juez en su propia ventana.
- **La frescura de `context/brief.md` se audita en SessionStart**, no en el Stop hook.
  Avisar al cerrar que el brief estaba viejo llega después de que el agente ya codeó
  contra el objetivo equivocado. `context-guardian.js` conserva el check de
  `learnings.md`, que sí tiene sentido al cerrar.

### Migración desde 6.5
1. Copiar `.claude/hooks/session-start.js`, `.claude/hooks/prompt-context.js` y
   `.claude/hooks/validators/` (carpeta nueva, con su `package.json` que fuerza CommonJS).
2. Registrar en `.claude/settings.json` los eventos `SessionStart` y `UserPromptSubmit`.
3. Reemplazar `.claude/hooks/context-guardian.js` (se le quitó el check de brief).
4. Reemplazar `.claude/agents/code-judge.md` y `.claude/skills/review/SKILL.md`.
5. Reemplazar `.claude/skills/plan/SKILL.md` — trae el hook de validación en su frontmatter.
6. Copiar los tests nuevos y correr `npm run claude:test-hooks`.

**Nota sobre los encabezados del task-spec**: ahora los valida un hook. Si tu `/plan`
está personalizado con otros nombres de sección, actualiza los `--contains` del
frontmatter o el hook bloqueará el cierre de cada tarea.

---

## [6.5.0] — 2026-08-19

Esta versión cierra los huecos agénticos del harness: hasta ahora los guardrails
detectaban **sintaxis** pero nada revisaba **diseño** ni gobernaba el harness mismo,
un agente bloqueado podía reintentar sin límite, y el criterio de done que generaba
`/plan` no lo verificaba nadie.

### Fixed
- **`compact-recovery.js` no compilaba.** Tenía saltos de línea literales dentro de
  strings con comillas simples: el hook PostCompact fallaba en silencio en cada
  compactación desde que se añadió el bloque de `context/`. La re-inyección de índices
  y contexto **no estaba ocurriendo** en ningún proyecto generado. Además el regex de
  detección de plantillas vacías usaba `[sS]` en vez de `[\s\S]`, con lo que no
  eliminaba comentarios HTML y trataba plantillas vacías como contenido real.
- **`bash-guard.js` no cubría `touch`, `cp`, `mv` ni `ng generate`.** Todos escriben
  archivos fuente a disco sin pasar por Edit/Write, así que el Architect Guard nunca
  veía el contenido. La suite de tests ya afirmaba que `touch` estaba bloqueado — el
  test decía la verdad y el hook no.
- **La suite de tests estaba roja (4 de 8).** `pre-write-guard.test.js` no compilaba
  (comillas simples anidadas) y su harness no creaba el flag de discovery, así que el
  Discovery Gate bloqueaba antes que el Architect Guard y todos los asserts sobre
  mensajes de violación fallaban. Ahora: **55 tests, 55 en verde.**

### Added
- **Subagentes (`.claude/agents/`)** — `discovery-scout`, `arch-auditor`, `index-syncer`,
  `supabase-schema`, `code-judge`. Corren en su propia ventana de contexto y devuelven
  un resumen en vez de volcar archivos al contexto principal.
- **Skill `/review` + subagente `code-judge`** — juez con rúbrica que califica el diff
  contra `ARCH-*`, `A11Y-*`, `.claude/rules/*` e `indices/ANTI-PATTERNS.md`. Cubre el
  diseño, que es lo que ni el regex del hook ni el AST del linter pueden ver. Corre con
  un modelo de razonamiento a propósito: un evaluador que razona igual que el generador
  comparte sus puntos ciegos.
- **Circuit Breaker** en `pre-write-guard.js` — cuenta bloqueos por `{archivo, violación}`
  y al 3º deja de explicar el arreglo y ordena escalar al humano, cerrando explícitamente
  las vías de escape (Bash, renombrar, trocear el cambio).
- **Approval Gate** en `bash-guard.js` — `supabase db push`, `db reset`, `migration repair`,
  `link` y SQL destructivo vía `psql` requieren un humano. `start`, `migration new` y
  `gen types` siguen permitidos.
- **`spec-reflection.js`** (Stop hook) — lee el "Criterio de done" del task-spec activo y
  devuelve los puntos sin cerrar, con evidencia del filesystem. Incluye anti-bucle: el
  mismo estado del spec no se reporta dos veces.
- **Context Offloading activo** — `compact-recovery.js` re-inyecta solo las casillas
  `- [ ]` pendientes del task-spec; lo completado se descarta del contexto.
- **`harness-gate.js`** (nuevo hook, PreToolUse Edit/Write/MultiEdit): Generalization Gate +
  Placement Guard sobre el harness mismo. Bloquea ediciones a `.claude/rules/*.md`,
  `context/learnings.md`, `indices/ANTI-PATTERNS.md` y `CLAUDE.md` que citan un track ID
  (`fix-NNN`/`spec-NNN`/`hotfix-NNN`/`task-NNN`) sin un criterio de aplicabilidad explícito,
  o que contienen snippets de despacho por keyword-matching literal / código ejecutable
  colado en un archivo de guía. También bloquea ediciones a `scripts/*.js` que solo agregan
  un mensaje consultivo sin ningún `process.exit(2)` que lo respalde. Inspirado en el
  "Generalization Gate" y la regla de placement capacidad/guía de HarnessCompass
  (arXiv:2608.01918).
- **`/harness-feedback`** (nuevo skill, user-invocable): reporte proactivo de fricción con
  el harness en dos pasadas (ciega, luego con hindsight tras correr `lint:arch`/`test:ci`),
  con grounding obligatorio contra evidencia de la sesión y enrutamiento a track
  estructural (hook/script) o guía (`rules/`/`learnings.md`/`ANTI-PATTERNS.md`), gateado
  por `harness-gate.js`.
- **Tests nuevos** — `spec-reflection.test.js` y `compact-recovery.test.js` (el hook que
  estuvo roto sin que nadie lo notara ahora tiene un test que verifica que simplemente corre).

### Changed
- **`.mcp.json` — mínimo privilegio.** El servidor MCP de Supabase venía con un Personal
  Access Token inline y sin acotar: escritura a nivel de cuenta sobre **todos** los
  proyectos del usuario, producción incluida. Ahora ships con `--read-only`,
  `--project-ref` y el token vía variable de entorno `SUPABASE_ACCESS_TOKEN` en vez de
  commiteado en el repo.
- **`skills/plan.md` → `skills/plan/SKILL.md`** — era la única skill suelta; el resto ya
  usaba la forma de directorio. El task-spec ahora incluye una sección de reutilización
  (alimentada por `discovery-scout`) y pasos de ejecución en casillas marcables.
- **Flujo de 5 pasos** — DESCUBRIR delega en `discovery-scout`, VALIDAR suma `arch-auditor`
  y `/review`, SINCRONIZAR delega en `index-syncer`.

### Migración desde 6.4
1. Copiar `.claude/agents/` completo (carpeta nueva).
2. Reemplazar `.claude/hooks/compact-recovery.js`, `pre-write-guard.js` y `bash-guard.js`.
3. Copiar `.claude/hooks/spec-reflection.js` y registrarlo en `.claude/settings.json`
   dentro de `Stop`, **antes** de `sync-check.js`.
4. Mover `.claude/skills/plan.md` a `.claude/skills/plan/SKILL.md` y copiar
   `.claude/skills/review/SKILL.md`.
5. Copiar `.claude/hooks/harness-gate.js` y registrarlo en `.claude/settings.json`
   (matcher `Edit|Write|MultiEdit`, junto a `pre-write-guard.js`); copiar
   `.claude/skills/harness-feedback/SKILL.md`.
6. **Revisar `.mcp.json`**: si ya pegaste un PAT inline, rótalo en
   supabase.com/dashboard/account/tokens — quedó en el historial de git — y pasa a
   `SUPABASE_ACCESS_TOKEN` + `--read-only` + `--project-ref`.
7. Copiar los tests nuevos y correr `npm run claude:test-hooks`.

**Nota sobre el Approval Gate**: si tu flujo dependía de que el agente corriera
`supabase db push`, ahora queda bloqueado a propósito. El agente escribe la migración
e informa el comando; lo aplica una persona.

---


## [6.1.0] — 2026-03-26

### Changed
- **indices-sync.js**: Ahora usa cache incremental por mtime. Solo re-parsea archivos modificados desde la última ejecución. Cache en `.claude/temp/indices-cache.json` (ya en `.gitignore`).
- **testing-tdd.md**: Dumb components sin lógica ya no requieren tests obligatorios. Solo obligatorio si tienen `computed()` o lógica derivada.
- **Bug Fix**: Se añadió `templates/.claude/hooks/package.json` para forzar `type: commonjs` en los hooks. Esto evita errores de `require is not defined` en proyectos que usan `type: module` (ESM).

### Migración desde 6.0
1. Reemplazar `scripts/indices-sync.js` con la versión nueva
2. Reemplazar `.claude/rules/testing-tdd.md` con la versión nueva
3. No hay breaking changes — el cache se genera automáticamente en la primera ejecución

---

## [6.0.0] — 2026-03-19

### Added
- `preflight()` + `checkCommand()` + `validateProjectName()` (regex, 214 chars, Windows reserved words)
- NPM/NPX con `.cmd` suffix en Windows + `shell: platform === 'win32'`
- Scaffold en directorio temporal con rollback automático via `fs.rmSync(tempDir)`
- `blueprint.json` en raíz del proyecto generado con versión y metadata
- Objeto `RULES` con doc links en `architect.js` + `reportError()`/`reportWarning()` con códigos `[ARCH-NN]`
- ARCH-09 (shared >200 líneas) y ARCH-10 (facade >5 inject o método >50 líneas) como warnings
- `indices/ANTI-PATTERNS.md` con 5 anti-patrones documentados
- `scripts/indices-sync.js` — auto-indexer AST para 4 índices (COMPONENTS, SERVICES, FACADES, MODELS)
- `scripts/lint-arch-wrapper.js` — memoria de fallos en `.claude/temp/arch-last-failure.json`
- Flags `--no-supabase`, `--no-gsap`, `--no-primeng` + `koa-config.json` opcional

### Migración desde 5.1
1. Agregar `blueprint.json` manualmente a la raíz del proyecto:
   ```json
   { "name": "koa-agent-blueprint", "version": "6.0.0", "stack": { "angular": true, "tailwind": true, "primeng": true, "gsap": true, "supabase": true } }
   ```
2. Agregar marcadores `<!-- AUTO-GENERATED:BEGIN -->` / `<!-- AUTO-GENERATED:END -->` a cada `indices/*.md`
3. Copiar `scripts/indices-sync.js` y `scripts/lint-arch-wrapper.js`
4. Agregar a `package.json`: `"indices:sync": "node scripts/indices-sync.js"`
5. Copiar `indices/ANTI-PATTERNS.md`

---

## [5.1.0] — 2026-03-16

### Added
- **ToastService** — wrapper sobre PrimeNG MessageService con duraciones pre-configuradas
- **core/utils/** — `date.utils.ts`, `validation.utils.ts` con barrel export
- **Tailwind @utility** — `btn-primary`, `btn-secondary`, `btn-ghost` con tokens semánticos
- **Lucide icons** expandidos de 24 a 58 iconos curados
- **linkedSignal()** — patrón de two-way binding en Facades para formularios
- **pre-write-guard.js** actualizado con checks para MessageService directo y context injection expandido

### Changed
- `_variables.scss` — eliminado branding específico, aliases legacy
- `_primeng-overrides.scss` — 1122 a 803 líneas (limpieza de dead code)
- `tailwind.css` — btn utilities usan tokens en vez de valores hardcodeados

### Migración desde 5.0
1. Crear `core/services/toast.service.ts` y reemplazar inyecciones directas de `MessageService` en componentes
2. Crear `core/utils/` con barrel export
3. Actualizar `tailwind.css` con las nuevas `@utility`
4. Actualizar `app.config.ts` con los 58 iconos Lucide

---

## [5.0.0] — 2026-03

### Added
- Sistema de hooks completo (7 hooks): pre-write-guard, discovery-tracker, bash-guard, compact-recovery, post-edit, sync-check, file-protector
- 9 reglas arquitectónicas en `.claude/rules/`
- 7 skills con frontmatter oficial
- 8 índices de memoria viva en `indices/`
- Boilerplate Angular completo con KPI card, skeleton, icon component
- Design system con Bento Grid, Frosted Cards, GSAP animations

### Notes
- Primera versión con sistema de guardrails automáticos
- No hay migración desde versiones anteriores — generar proyecto nuevo
