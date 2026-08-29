# Registro de hallazgos

> **Cada hallazgo se describe UNA vez, acá.** Las fichas solo lo referencian por ID.
> Si un hallazgo vive dentro de una ficha, no se puede contar, ordenar por severidad ni
> agrupar por tipo — y el pase general se vuelve imposible.

## Taxonomía

Seis tipos, cerrados. Si algo no entra en ninguno, primero preguntate si realmente es un
hallazgo; recién después agregá un tipo (y documentalo acá).

| Tipo | Nombre | Qué es | Ejemplo del repo |
|---|---|---|---|
| `INC` | Inconsistencia | La documentación dice X, el código hace Y | `TEMPLATES-REGISTRY.md` dice 16 hooks cableados; son 17 |
| `DEC` | Chequeo decorativo | Existe, corre, pasa — y no puede fallar | ARCH-24 y ARCH-26, muertas hasta que existió `provocar-reglas.mjs` |
| `ACO` | Acoplamiento no declarado | Una pieza depende del formato de otra sin que figure en `templates-contract.md` | — |
| `DUP` | Autoridad duplicada | Dos piezas deciden lo mismo, posiblemente con criterios distintos | `session-start` y `discovery-tracker` escriben el mismo flag |
| `HUE` | Hueco | Nadie cubre esto: sin test, sin mecanismo, sin dueño | los hooks sin archivo de test |
| `CAR` | Carga | Correcto, pero cuesta más contexto/fricción de lo que aporta | una regla que se inyecta siempre y ningún mecanismo aplica |

> `CAR` es el tipo que casi nadie incluye y en un harness es central: **una pieza puede
> ser correcta y aun así ser neta negativa**, porque cada regla, cada skill
> model-invocable y cada inyección paga renta en la ventana de contexto.

> `SEC-001` usó el prefijo `SEC` dentro del tipo `DEC` porque la taxonomía se quedó corta:
> un guardrail que además **abre** una superficie de ataque no es exactamente «un chequeo
> que no puede fallar». Se mantiene como `DEC` para no cambiar la taxonomía a mitad de la
> auditoría (regla 1 del README); decidir en el pase general si `SEC` merece ser un tipo
> propio y, si se agrega, reclasificar hacia atrás.

## Severidad

| Nivel | Criterio |
|---|---|
| `S1` | Rompe proyectos generados, o desactiva un guardrail sin que nadie se entere |
| `S2` | Comportamiento incorrecto o engañoso, con workaround conocido |
| `S3` | Deriva, redundancia o costo evitable. No rompe nada hoy |

> **Regla de ponderación por contexto:** un hallazgo en el **harness** (contexto B) sube
> un nivel respecto del mismo hallazgo en el **generador** (contexto A). El generador
> falla ruidoso y una vez; el harness falla en silencio y replicado en cada proyecto
> generado.

## Estado

`abierto` · `en análisis` · `aceptado` (se decide convivir, con motivo) · `resuelto` · `descartado`

---

# Registro

<!--
Formato de ID: <TIPO>-<NNN> correlativo dentro del tipo. Los IDs no se reutilizan.
Ordenar por ID, no por severidad — el orden por severidad se hace en el pase general.
Agregar filas al final; la ficha de detalle va debajo de la tabla.
-->

| ID | Sev | Unidad | Una línea | Estado |
|---|---|---|---|---|
| `INC-001` | S2 | `S-01` | **(reescrito)** El namespace ARCH está repartido en tres implementaciones sin registro único; `ARCH-14` está documentado y no lo emite nadie | abierto |
| `CAR-001` | **S1** | `H-06` | `plan-injector` inyecta ~6.155 tokens en CADA Edit, sin dedup ni techo — la única pieza del harness sin ningún control de costo | abierto |
| `DEC-002` | S2 | `H-05` | `GATE-A1` de `harness-gate` se satisface con la palabra «cuando»; 12 de 15 reglas reales ya lo cumplen sin intentarlo | abierto |
| `INC-005` | S2 | `H-03` | `spec-gate` y `plan-injector` clasifican el mismo archivo con listas de exención distintas | abierto |
| `HUE-010` | S2 | `H-03` | Los 3 hooks de `sdd/` y `context-enrichment-guard` leen stdin sin el cap SEC-04 | abierto |
| `HUE-011` | S2 | `H-03` | Cero tests en todo `sdd/`: 3 hooks, ~360 líneas, el motor SDD entero | abierto |
| `HUE-012` | S2 | `H-04` | Las ~20 reglas regex de `pre-write-guard` no las cubre `provocar-reglas.mjs` | abierto |
| `ACO-004` | S2 | `H-00` | El orden de los hooks dentro de cada evento es semántico en 3 casos y no está declarado | abierto |
| `INC-004` | S3 | `H-00` | `TEMPLATES-REGISTRY.md` dice 16 hooks cableados; son 17 | abierto |
| `HUE-009` | S3 | `H-00` | Ningún test verifica que los comandos cableados apunten a archivos existentes | abierto |
| `HUE-013` | S3 | `H-05` | `GATE-B1` bloquearía una regla que documenta un hook; latente, no activo hoy | abierto |
| `ACO-005` | S3 | `H-01` | `<!-- DETAIL:BEGIN -->` y `**last_updated:**` son contratos de 2-3 piezas sin declarar | abierto |
| `ACO-006` | S3 | `H-02` | `koa-prompt-ctx-{sessionId}.json` no declarado | abierto |
| `ACO-007` | S3 | `H-04` | `koa-breaker-*.json` y los 11 `koa-ctx-*.flag` no declarados | abierto |
| `SEC-001` | **S1** | `H-11` | `post-edit.js` interpola la ruta del payload en una cadena de shell: una ruta con comillas ejecuta comandos arbitrarios | abierto |
| `DEC-003` | **S1** | `H-11` | `post-edit.js` usa `import` bajo un `package.json` sin `type:module`: no carga en Node 20/21, el mínimo que el CLI exige | abierto |
| `HUE-016` | S2 | `H-12` | Un error con `\|` corrompe `LESSONS_LEARNED.md` en el siguiente parseo; se pierden firma y conteo, y el daño es acumulativo | abierto |
| `DUP-002` | S2 | `H-12` | `failure-tracker` y `lint-arch-wrapper` escriben ambos en `LESSONS_LEARNED.md` con formatos distintos | abierto |
| `CAR-002` | S2 | `H-17` | `context-guardian` avisa en cada respuesta indefinidamente: no tiene anti-bucle | abierto |
| `HUE-015` | S2 | `H-10` | `write-tracker` no rastrea `supabase/migrations/**`, que el Discovery Gate sí trata como código fuente | abierto |
| `INC-007` | S2 | `H-14` | `hotfix-autoclose` dice cerrar «al terminar la sesión»; `Stop` corre al final de cada respuesta | abierto |
| `HUE-017` | S3 | `H-13` | `compact-recovery` no tiene tope de tamaño: los 4 archivos de `context/` se inyectan enteros | abierto |
| `HUE-014` | S3 | `H-08` | El matching contra el índice es por substring: un nombre contenido en cualquier parte del `.md` pasa como registrado | abierto |
| `INC-006` | S3 | `H-09` | El docblock de `discovery-tracker` describe solo `indices/`; también escribe el flag ante `context/` | abierto |
| `ACO-008` | S3 | `H-12` | `LESSONS_LEARNED.md` es un contrato de round-trip con dos productores, sin declarar | abierto |
| `DEC-001` | **S1** | `C-02` | `spec-diff-check.js` lee el comando de `process.env.TOOL_INPUT` en vez de stdin — nunca bloquea ningún commit | abierto |
| `HUE-002` | **S1** | `C-01` | `sessionId` sale de una env var con fallback `'default'`; el flag es global en TMPDIR y nunca se borra | abierto |
| `HUE-005` | **S1** | `C-05` | `blueprint.json` no se valida dentro del proyecto generado, y su `stack` crudo decide qué guardrails corren | abierto |
| `ACO-001` | S2 | `C-02` | `sync-check` borra `session-writes.json` en cada `Stop` (que es por respuesta, no por sesión) | abierto |
| `HUE-001` | S2 | `C-01` | El Discovery Gate solo comprueba que el flag exista; leer `context/` lo levanta sin ningún índice | abierto |
| `HUE-003` | S2 | `C-01` | `compact-recovery` conoce 10 de 15 índices; GUARDS, LAYOUTS, ROUTES, USAGE-MAP y UTILS nunca se re-inyectan | abierto |
| `HUE-004` | S2 | `C-03` | `spec-reflection` calla cuando no hay ninguna casilla marcada — el caso exacto que debería atrapar | abierto |
| `HUE-006` | S2 | `C-02` | El contrato con más consumidores (4) es el único de los cinco sin ningún test | abierto |
| `INC-002` | S2 | `C-03` | `--max-age 60` + `--require-file` reportan "no existe ningún spec" cuando existe pero lleva >1h sin tocarse | abierto |
| `INC-003` | S2 | `C-05` | `pre-write-guard.js` no figura como consumidor del blueprint en ninguna documentación | abierto |
| `DUP-001` | S3 | `C-04` | Dos fail modes para el mismo contrato: `indices-sync` avisa y sigue, `assignments-sync` lanza | abierto |
| `ACO-002` | S3 | `C-03` | `spec-reflection-seen.json` no está declarado como artefacto | abierto |
| `ACO-003` | S3 | `C-04` | `indices-cache.json` decide qué se re-parsea y no está declarado como dependencia | abierto |
| `HUE-007` | S3 | `C-04` | Nada impide editar dentro de los marcadores y perder el trabajo en el siguiente sync | abierto |
| `HUE-008` | S3 | `C-04` | Ningún test fija la partición 13 auto-generados / 2 manuales | abierto |

---

## INC-001 · El namespace ARCH está repartido en tres implementaciones (reescrito)

- **Tipo / severidad:** `INC` · S2 *(era S3; la premisa original era incorrecta)*
- **Unidad:** `S-01` (`architect.js`) y `H-04` (`pre-write-guard.js`)
- **Contexto:** B (harness)

> **Corrección.** La versión anterior de este hallazgo decía que faltaban los códigos
> ARCH-12, 13, 14 y 20 porque no aparecían en `architect.js`. Eso salió de grepear
> literales de string en un solo archivo, y era una conclusión equivocada: tres de los
> cuatro existen, en otros archivos. El hallazgo real es distinto y más interesante.

**Qué encontré**

El namespace de códigos no vive en un solo lugar. Está repartido en tres superficies:

| Superficie | Códigos | Mecanismo |
|---|---|---|
| `scripts/architect.js` | ARCH-01…11, 15…19, 21…26 · A11Y-03 · SEC-RLS-01/02/03 | AST de TypeScript |
| `scripts/lib/a11y-guardrails.js` | ARCH-20 | función pura importada por `architect.js` |
| `.claude/hooks/pre-write-guard.js` | ARCH-12, ARCH-13 · A11Y-01, A11Y-02 · LLM-01, LLM-02 | regex, en tiempo de escritura |

No hay ningún hueco de numeración: 12, 13 y 20 existen. **La excepción es `ARCH-14`**, que
`skills/verify/SKILL.md` documenta como si existiera —«Íconos sin registrar en
`provideIcons()` | ARCH-14 + `icon-registry.js`»— y que ningún archivo emite. Solo aparece
además en un comentario de `class-discipline.js` que lo menciona de pasada.

(`ARCH-99` aparece en `provocacion.test.mjs`, pero es un fixture de test, no una regla.)

**Por qué importa**

Tres consecuencias:

1. **Nadie puede contar las reglas.** Responder «¿cuántas reglas tiene el linter?» exige
   grepear tres archivos y saber que dos de las superficies no son el linter.
2. **Nada previene una colisión.** Si alguien agrega un `ARCH-27` en el hook y otro en el
   linter, no hay registro que lo impida.
3. **`ARCH-14` es una regla fantasma**: documentada, referenciada desde una skill que el
   agente lee, y sin ninguna implementación detrás. Un agente que la busque para cumplirla
   no encuentra nada.

**Evidencia**

```bash
grep -rhoE "(ARCH|A11Y|LLM|SEC-RLS)-[0-9]+" templates/boilerplate/scripts/   templates/.claude/hooks/ | sort -u -V
# → ARCH-01 … ARCH-26 continuo, + ARCH-99 (fixture), A11Y-01..03, LLM-01/02, SEC-RLS-01..03

grep -rn "ARCH-14" templates/ | grep -v auditoria
# → class-discipline.js:22  (comentario: "igual que ARCH-14")
# → skills/verify/SKILL.md:346  (tabla, como si existiera)
#   ningún reportError, ninguna implementación
```

**Propuesta**

Un registro único de códigos —un `.md` o un `.json` que enumere código, superficie que lo
emite y regla— y un test que lo compare contra los tres archivos. Resolver `ARCH-14`:
implementarla o sacarla de `verify/SKILL.md`.

**Estado:** abierto

---

## DEC-001 · `spec-diff-check.js` lee el comando de una variable de entorno que nadie setea

- **Tipo / severidad:** `DEC` · **S1**
- **Unidad:** `C-02` (session-writes) — confirmar en `H-08`
- **Contexto:** B (harness)

**Qué encontré**

`spec-diff-check.js` está cableado como `PreToolUse` sobre `Bash` para bloquear el
`git commit` cuando hay componentes o facades sin registrar en sus índices. Obtiene el
comando así:

```js
const toolInput = process.env.TOOL_INPUT || '{}';
let cmd = '';
try { cmd = JSON.parse(toolInput).command || ''; } catch { /* ignore */ }
if (!cmd.includes('git') || !cmd.includes('commit')) process.exit(0);
```

Claude Code entrega el payload del hook por **stdin**, no por una variable `TOOL_INPUT`.
Los otros 17 hooks del harness leen stdin; este es el único que no. Sin esa variable,
`cmd` queda vacío, la condición se cumple y el hook hace `exit 0` antes de mirar nada.

**Por qué importa**

Es el guardrail que `.claude/CLAUDE.md` promete para el commit y no ha bloqueado nunca un
commit en ningún proyecto generado. Es el arquetipo exacto de lo que
`docs/CHEQUEOS-QUE-NO-CHEQUEAN.md` describe: un chequeo verde que no puede salir rojo.

Lo llamativo es que **la lógica de detección es correcta**: alimentado por la vía que él
espera, encuentra el componente sin registrar y bloquea con un mensaje útil. No hay que
reescribirlo, solo hay que darle el input por donde llega.

**Evidencia**

Sandbox con `session-writes.json` conteniendo un componente nuevo y un `COMPONENTS.md`
que no lo registra:

```bash
# A — como lo invoca Claude Code de verdad (stdin)
echo '{"tool_name":"Bash","tool_input":{"command":"git commit -m x"}}' \
  | node .claude/hooks/spec-diff-check.js
# → exit 0   (no bloquea)

# B — con la env var que el hook realmente lee
TOOL_INPUT='{"command":"git commit -m x"}' node .claude/hooks/spec-diff-check.js </dev/null
# → exit 2   📋 SPEC-DIFF-CHECK: <app-kpi-card> no está en indices/COMPONENTS.md

# C — contraste: bash-guard, mismo matcher, sí lee stdin
echo '{"tool_name":"Bash","tool_input":{"command":"cat > src/app/x.component.ts <<EOF"}}' \
  | node .claude/hooks/bash-guard.js
# → exit 2   🚫 BASH GUARD

# Es el único hook que usa env vars
grep -ln "process.env.TOOL_INPUT" templates/.claude/hooks/**/*.js
# → spec-diff-check.js
```

No existe `spec-diff-check.test.js`. Un test que le pasara el payload por stdin —como
hacen los otros ocho tests del harness— habría encontrado esto el primer día.

**Propuesta**

Leer el payload de stdin como el resto de los hooks, y escribir el test que faltaba. El
`ACO-001` de esta misma unidad hay que resolverlo a la vez: aunque se arregle la entrada,
el tracker ya está borrado en los turnos posteriores al primero.

**Estado:** abierto

---

## HUE-002 · La identidad de sesión sale de una env var, con fallback global

- **Tipo / severidad:** `HUE` · **S1**
- **Unidad:** `C-01` (discovery flag) — afecta también a `koa-breaker-*` y `koa-ctx-*`
- **Contexto:** B (harness)

**Qué encontré**

Cinco hooks derivan la identidad de sesión igual:

```js
const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
```

`pre-write-guard.js`, `prompt-context.js`, `compact-recovery.js`, `session-start.js` y
`discovery-tracker.js`. **Ningún hook lee `session_id` del payload de stdin**, donde
Claude Code lo entrega junto al resto de la información del tool.

Con ese fallback, todos los proyectos de la máquina comparten
`$TMPDIR/koa-discovery-default.flag` — y también `koa-breaker-default.json` (circuit
breaker) y los flags `koa-ctx-*-default.flag` (dedup de inyección de contexto).

**Por qué importa**

Tres consecuencias, todas silenciosas:

1. **Fuga entre proyectos.** Leer un índice en el proyecto A levanta el Discovery Gate del
   proyecto B, que nunca leyó nada.
2. **Fuga entre sesiones.** Nadie borra el flag: la segunda sesión del día en la misma
   máquina arranca con el Gate ya levantado.
3. **Circuit breaker y dedup contaminados.** El contador de bloqueos y los flags de
   "esta categoría ya se inyectó" se comparten entre proyectos y sesiones.

**Evidencia**

```bash
export TMPDIR=$SB/tmp ; unset CLAUDE_SESSION_ID

cd proyA && echo '{"tool_input":{"file_path":"context/domain.md"}}' \
  | node .claude/hooks/discovery-tracker.js
cat $TMPDIR/koa-discovery-default.flag
# → 2026-08-29T22:50:15.860Z | READ | context/domain.md

cd ../proyB   # nunca leyó nada
echo '{"tool_input":{"file_path":"src/app/features/y.component.ts","content":"y"}}' \
  | node .claude/hooks/pre-write-guard.js
# → exit 0   (pasa, heredando el flag de proyA)

grep -rn "unlinkSync" templates/.claude/hooks/*.js
# → solo spec-reflection.js y sync-check.js, para OTROS artefactos.
#   Nadie borra el discovery flag.
```

**Propuesta**

Tomar `session_id` del payload de stdin, con la env var como respaldo y un tercer nivel
derivado de `process.cwd()` (un hash de la ruta del proyecto) antes de caer en `'default'`.
Es una corrección única que toca cinco archivos: candidata a helper compartido.

**Estado:** abierto

---

## HUE-005 · El blueprint decide qué guardrails corren, y nadie lo valida donde se lee

- **Tipo / severidad:** `HUE` · **S1**
- **Unidad:** `C-05` (blueprint.json)
- **Contexto:** A y B — el contrato cruza los dos

**Qué encontré**

`lib/config.js` define `BLUEPRINT_SCHEMA` y `validateBlueprintJson()`, con validación de
tipos por campo. Un `grep` sobre todo el repositorio muestra que esa función solo se
invoca desde `lib/preflight.js`, es decir **cuando alguien corre el CLI**.

En el proyecto generado, el consumidor real es `pre-write-guard.js`:

```js
let STACK = { angular: true, tailwind: true, primeng: true, gsap: false, supabase: true };
try {
  const bp = JSON.parse(fs.readFileSync(bpPath, 'utf8'));
  if (bp.stack && typeof bp.stack === 'object') STACK = { ...STACK, ...bp.stack };
} catch { /* fail-open */ }
```

`JSON.parse` crudo, spread sin validar tipos. `STACK.supabase` y `STACK.gsap` gobiernan
seis puntos del guard: si una violación se reporta, y qué consejo se inyecta.

**Por qué importa**

El schema vive en el contexto A y protege una lectura que ocurre en el contexto B, donde
no corre nunca. Un `blueprint.json` editado a mano —o producido por Wikiflow con un tipo
distinto— cambia qué guardrails se aplican, sin ningún aviso.

`pre-write-guard.js` tampoco figura como consumidor del contrato en ninguna documentación
(ver `INC-003`), así que quien edite el blueprint no tiene forma de saber que está tocando
la configuración del linter en vivo.

**Evidencia**

Misma escritura (un componente que importa Supabase directamente, violación ARCH-01),
variando solo el blueprint:

```
{"stack":{"supabase":true}}     → exit 2  🚨 ARCHITECT GUARD          ✔
{"stack":{"supabase":false}}    → exit 0  (correcto)                  ✔
{"stack":{"supabase":"false"}}  → exit 2  🚨 ARCHITECT GUARD          ✘ el string es truthy
{"stack":{"supabse":false}}     → exit 2  (typo ignorado, queda true) ✘

grep -rn "validateBlueprintJson" lib/ bin/ templates/
# → lib/config.js (definición), lib/preflight.js (uso), lib/scaffolder.js (comentario)
#   Ninguna referencia en templates/ — nunca corre en el proyecto generado.
```

**Propuesta**

Validar el `stack` en el punto de lectura del harness: coerción explícita a booleano y
descarte de claves desconocidas, con un aviso cuando el blueprint traiga algo que no se
entiende. Como principio general para la Lente 1: *un schema tiene que vivir donde se lee,
no donde se escribe.*

**Estado:** abierto

---

## ACO-001 · El tracker de sesión se borra en cada respuesta, no en cada sesión

- **Tipo / severidad:** `ACO` · S2
- **Unidad:** `C-02` (session-writes)
- **Contexto:** B (harness)

**Qué encontré**

`sync-check.js` termina con `fs.unlinkSync(trackerPath)` **incondicional**, comentado como
*«Limpiar tracker para la próxima sesión»*. Pero el hook `Stop` corre al final de **cada
respuesta del agente**, no al final de la sesión. El propio `spec-reflection.js` lo
asume: tiene lógica anti-bucle precisamente porque se ejecuta varias veces por sesión.

**Por qué importa**

A partir del primer turno, `session-writes.json` solo contiene lo escrito en el turno
actual. Los consumidores que corren después auditan una lista vacía y pasan en verde:

- `spec-diff-check.js` — un `git commit` en un turno posterior al de la escritura no tiene
  nada que auditar (agrava `DEC-001`: aunque se arregle la entrada, seguiría sin datos).
- El bloque de evidencia de `spec-reflection.js` se degrada en silencio.
- El subagente `index-syncer` recibe una lista incompleta de qué reconciliar.

**Evidencia**

```bash
printf '["src/app/features/a.component.ts"]' > .claude/temp/session-writes.json
touch indices/COMPONENTS.md          # índice más nuevo → nada que reportar
node .claude/hooks/sync-check.js     # → exit 0
test -f .claude/temp/session-writes.json || echo "borrado"
# → borrado (aun sin haber reportado nada)
```

**Propuesta**

No borrar en `Stop`. Si hace falta acotar el crecimiento, rotar por antigüedad o limpiar
en `SessionStart`, que sí ocurre una vez por sesión.

**Estado:** abierto

---

## HUE-001 · El Discovery Gate comprueba que el flag exista, no que se hayan leído índices

- **Tipo / severidad:** `HUE` · S2
- **Unidad:** `C-01` (discovery flag)
- **Contexto:** B (harness)

**Qué encontré**

`discovery-tracker.js` escribe el flag ante `indices/` **o** `context/`:

```js
if (filePath.includes('indices/') || filePath.includes('context/')) { … appendFileSync … }
```

Y el Gate solo comprueba existencia, sin abrir el archivo:

```js
const flagPath = path.join(os.tmpdir(), `koa-discovery-${sessionId}.flag`);
if (!fs.existsSync(flagPath)) { … process.exit(2); }
```

**Por qué importa**

El mensaje del propio Gate afirma: *«El bloqueo se levantará automáticamente cuando leas
cualquier archivo de indices/»*, y `.claude/CLAUDE.md` promete que no se puede escribir
código sin los índices en contexto. Leer `context/brief.md` —que el agente hace de rutina—
levanta el Gate sin haber mirado un solo índice.

Puede ser deliberado (leer el dominio también es descubrimiento), pero entonces la
documentación y el mensaje están mal. Hoy no hay forma de saber cuál de las dos cosas se
quiso.

**Evidencia**

```bash
# Gate antes de leer nada
… | node .claude/hooks/pre-write-guard.js   # → exit 2 ✔

# Leer SOLO context/domain.md
echo '{"tool_input":{"file_path":"context/domain.md"}}' | node .claude/hooks/discovery-tracker.js

# Gate después
… | node .claude/hooks/pre-write-guard.js   # → exit 0 ✘
```

**Propuesta**

Decidir la intención y alinear las tres puntas. Si el Gate exige índices, leer el
contenido del flag y buscar al menos una línea `indices/`. Si `context/` cuenta, corregir
el mensaje y la documentación.

**Estado:** abierto

---

## HUE-003 · `compact-recovery` conoce 10 de los 15 índices

- **Tipo / severidad:** `HUE` · S2
- **Unidad:** `C-01` (discovery flag) — confirmar en `H-13`
- **Contexto:** B (harness)

**Qué encontré**

`ALL_INDEX_FILES` en `compact-recovery.js` lista diez índices. El template trae quince.
Faltan `GUARDS`, `LAYOUTS`, `ROUTES`, `USAGE-MAP` y `UTILS`.

**Por qué importa**

Aunque el flag registre que el agente leyó `indices/ROUTES.md` antes de la compactación,
ese índice no se re-inyecta nunca: el agente lo pierde y no se entera. `LAYOUTS.md` es el
caso más visible, porque el propio Discovery Gate lo ofrece en su lista de archivos que
levantan el bloqueo.

**Evidencia**

```
índices en templates/indices/:                15
en ALL_INDEX_FILES de compact-recovery:       10
no re-inyectables: GUARDS, LAYOUTS, ROUTES, USAGE-MAP, UTILS
```

**Propuesta**

Derivar la lista del contenido de `indices/` en vez de mantenerla a mano, que es lo que
garantiza que vuelva a desincronizarse. Cubrirlo con un test que compare ambas listas.

**Estado:** abierto

---

## HUE-004 · `spec-reflection` calla cuando no hay ninguna casilla marcada

- **Tipo / severidad:** `HUE` · S2
- **Unidad:** `C-03` (task-spec)
- **Contexto:** B (harness)

**Qué encontré**

```js
if (open.length === 0 || done === 0) { … bail(); }
```

El comentario lo justifica: *«sin casillas marcadas nunca → el agente no adoptó el flujo
del task-spec»*.

**Por qué importa**

El hook guarda silencio exactamente en el caso que existe para atrapar: un agente que
declaró un criterio de done y no cumplió nada. Basta con no marcar ninguna casilla para
que la Reflection nunca hable — y no marcar casillas es justamente lo que hace un agente
que no está siguiendo el plan.

**Evidencia**

```bash
# spec con 2 casillas abiertas, ninguna marcada
node .claude/hooks/spec-reflection.js   # → exit 0 (silencio)

# el mismo spec con UNA marcada
sed -i 's/- \[ \] a/- [x] a/' "$SPEC"
node .claude/hooks/spec-reflection.js   # → exit 2 "1 punto(s) sin cerrar"
```

**Propuesta**

Distinguir los dos casos en vez de callarlos juntos. Con `done === 0` y casillas abiertas,
el mensaje correcto no es la lista de pendientes sino una pregunta: *«creaste un task-spec
y no marcaste nada — ¿lo estás siguiendo?»*.

**Estado:** abierto

---

## HUE-006 · El contrato con más consumidores no tiene ningún test

- **Tipo / severidad:** `HUE` · S2
- **Unidad:** `C-02` (session-writes)
- **Contexto:** B (harness)

**Qué encontré**

`session-writes.json` tiene cuatro consumidores (`sync-check`, `spec-reflection`,
`spec-diff-check`, `index-syncer`) y ninguna de las piezas que lo producen o lo consumen
directamente tiene archivo de test: no existen `write-tracker.test.js`,
`sync-check.test.js` ni `spec-diff-check.test.js`.

**Por qué importa**

Los dos hallazgos `S1`/`S2` más graves del bloque 0 (`DEC-001` y `ACO-001`) están los dos
en esta unidad. La correlación con `C-03` —cuatro tests, ningún hallazgo grave— es
directa: donde hay cobertura, el contrato se sostiene.

**Evidencia**

```bash
ls templates/.claude/tests/ | grep -E "write-tracker|sync-check|spec-diff"
# → (vacío)
```

**Propuesta**

Es la entrada más rentable del backlog de tests que salga de la Lente 3.

**Estado:** abierto

---

## INC-002 · `--max-age 60` convierte "el spec está viejo" en "no existe ningún spec"

- **Tipo / severidad:** `INC` · S2
- **Unidad:** `C-03` (task-spec) — confirmar en `H-19`
- **Contexto:** B (harness)

**Qué encontré**

El frontmatter de `/plan` declara su validador con `--max-age 60 --require-file`. Con un
spec que existe y está completo pero lleva más de una hora sin modificarse, el validador
falla con: *«no se encontró ningún archivo task-spec-*.md en .claude/temp/ modificado en
los últimos 60 min. Créalo antes de terminar.»*

**Por qué importa**

En cualquier sesión de más de una hora en la que el spec no se edite, el agente recibe la
orden de crear un spec que ya existe. Si obedece, el duplicado pasa a ser "el más reciente
por orden alfabético" para los otros cuatro consumidores del contrato, y el original queda
huérfano.

**Evidencia**

```bash
node …/validate-file-contains.js --directory .claude/temp --pattern "task-spec-*.md" \
  --max-age 60 --require-file --contains "## Objetivo"
# spec recién escrito       → exit 0
touch -d '2 hours ago' "$SPEC"
# mismo spec, 2 h de antigüedad → exit 2, "no se encontró ningún archivo… Créalo"
```

**Propuesta**

Separar los dos mensajes: "no existe ningún spec" y "el spec existe pero es viejo" no son
la misma situación y no piden la misma acción. Revisar si 60 minutos es el umbral correcto
para una sesión de trabajo real.

**Estado:** abierto

---

## INC-003 · `pre-write-guard` no figura como consumidor del blueprint

- **Tipo / severidad:** `INC` · S2
- **Unidad:** `C-05` (blueprint.json)
- **Contexto:** B (harness)

**Qué encontré**

`.claude/rules/templates-contract.md` no lista `blueprint.json` entre los contratos
compartidos entre hooks. `lib/config.js` documenta dos productores (CLI y Wikiflow) pero
ningún consumidor del lado del harness. `managedPaths` tampoco lo incluye.

**Por qué importa**

Es la razón por la que `HUE-005` pasó desapercibido: nadie que edite el blueprint sabe que
está tocando la configuración del Architect Guard en vivo.

**Evidencia**

```bash
grep -n "blueprint" templates/.claude/rules/templates-contract.md   # → sin resultados
grep -n "blueprint.json" templates/.claude/hooks/pre-write-guard.js  # → sí, lo lee
```

**Propuesta**

Agregar `blueprint.json` a la tabla de contratos de `templates-contract.md`, nombrando a
`pre-write-guard.js` como consumidor y advirtiendo qué se rompe al editarlo.

**Estado:** abierto

---

## DUP-001 · Dos fail modes para el mismo contrato de marcadores

- **Tipo / severidad:** `DUP` · S3
- **Unidad:** `C-04` (marcadores auto-generados)
- **Contexto:** B (harness)

**Qué encontré**

```js
// indices-sync.js:1091
console.warn(yellow(`  ⚠  Sin marcadores en ${basename} — agrega los marcadores AUTO-GENERATED`));
// assignments-sync.js:86
throw new Error(`No se encontraron marcadores AUTO-GENERATED para "${sectionHeader}"`);
```

**Por qué importa**

El mismo contrato roto produce un warning amarillo en un script y una excepción en el
otro. Ninguna de las dos elecciones está justificada. La versión que avisa y sigue deja
índices congelados sin que ningún gate lo note.

**Propuesta**

Elegir una y aplicarla en ambos. Dado que un índice congelado es peor que un fallo
ruidoso, el `throw` parece la opción correcta.

**Estado:** abierto

---

## ACO-002 · `spec-reflection-seen.json` no está declarado

- **Tipo / severidad:** `ACO` · S3
- **Unidad:** `C-03` (task-spec)
- **Contexto:** B (harness)

**Qué encontré**

`spec-reflection.js` crea, lee y borra `.claude/temp/spec-reflection-seen.json` para su
memoria anti-bucle. No figura en `templates-contract.md`.

**Por qué importa**

Determina si el aviso de Reflection sale o no. Un archivo huérfano de una sesión anterior
puede silenciar el hook. Es un contrato de una pieza consigo misma, pero sigue siendo
estado persistente sin dueño declarado.

**Propuesta**

Declararlo junto al resto de los artefactos derivados que salgan de la Lente 1.

**Estado:** abierto

---

## ACO-003 · `indices-cache.json` no está declarado como dependencia

- **Tipo / severidad:** `ACO` · S3
- **Unidad:** `C-04` (marcadores auto-generados)
- **Contexto:** B (harness)

**Qué encontré**

`indices-sync.js` mantiene una caché incremental por `mtime` en
`.claude/temp/indices-cache.json` que decide qué archivos se re-parsean.

**Por qué importa**

Si la caché queda desfasada o corrupta, el índice se regenera incompleto sin ningún aviso
— y `sync-check` lo dará por actualizado porque solo mira `mtime`.

**Propuesta**

Declararlo, y verificar en la ficha `S-03` qué pasa exactamente con una caché corrupta.

**Estado:** abierto

---

## HUE-007 · Nada impide editar dentro de los marcadores

- **Tipo / severidad:** `HUE` · S3
- **Unidad:** `C-04` (marcadores auto-generados)
- **Contexto:** B (harness)

**Qué encontré**

Un agente que edita `indices/COMPONENTS.md` a mano dentro de la región
`AUTO-GENERATED` pierde su trabajo en el siguiente `indices:sync`, en silencio.
`harness-gate.js` vigila `indices/ANTI-PATTERNS.md`, que es justamente uno de los dos
índices **sin** marcadores.

**Por qué importa**

Es una regla real del harness que hoy solo existe como prosa. El repo tiene la costumbre
opuesta —convertir guidelines en guardrails— y este caso quedó del lado de la guideline.

**Propuesta**

Extender `harness-gate.js` o `pre-write-guard.js` para bloquear escrituras cuyo contenido
caiga dentro de los marcadores de un índice auto-generado.

**Estado:** abierto

---

## HUE-008 · Ningún test fija la partición 13 auto-generados / 2 manuales

- **Tipo / severidad:** `HUE` · S3
- **Unidad:** `C-04` (marcadores auto-generados)
- **Contexto:** B (harness)

**Qué encontré**

La partición es hoy exacta y coincide con `TEMPLATES-REGISTRY.md`, pero nada la fija. Un
índice nuevo sin marcadores, o uno manual al que alguien se los agregue, pasa sin ruido.

**Propuesta**

Test de tres líneas: todo índice sin `AUTO-GENERATED:BEGIN` tiene que estar en la lista de
manuales. Convierte una coincidencia afortunada en un invariante.

**Estado:** abierto

## CAR-001 · `plan-injector` inyecta ~6.155 tokens en cada Edit, sin ningún control de costo

- **Tipo / severidad:** `CAR` · **S1**
- **Unidad:** `H-06`
- **Contexto:** B (harness)

**Qué encontré**

`sdd/plan-injector.js` inyecta `spec.md` + `plan.md` + `tasks.md` como `additionalContext`
en cada `Edit`/`Write` sobre código de producto, con `MAX_SECTION_CHARS = 8000` por sección
y **sin techo agregado**. No tiene estado, ni caché, ni dedup: `grep -c "tmpdir|STATE|seen|cache"`
sobre el archivo devuelve 0.

**Por qué importa**

Medido en sandbox con tres artefactos de tamaño realista: **24.622 caracteres, ~6.155
tokens estimados, en una sola edición**. Diez ediciones en una sesión son ~61.000 tokens
del mismo contrato repetido palabra por palabra.

Lo decisivo es que la misma casa ya resolvió este problema tres veces y este hook no aplicó
ninguna solución:

| Pieza | Control de costo |
|---|---|
| `prompt-context.js` | dedup por contenido + `REPEAT_EVERY = 8` |
| `pre-write-guard.js` capa 4 | flag de dedup por categoría y sesión |
| `session-start.js` | tope de 2.500 chars + corte en `DETAIL:BEGIN` |
| **`plan-injector.js`** | **ninguno** |

Es `S1` y no `S2` porque un harness que agota la ventana de contexto fuerza compactaciones,
y cada compactación dispara `compact-recovery` — que re-inyecta más contexto. El costo no
es lineal.

**Evidencia**

```bash
echo "0001-x" > specs/.active   # spec.md, plan.md y tasks.md > 8000 chars cada uno
echo '{"tool_input":{"file_path":"src/app/features/x.component.ts","content":"x"}}' \
  | node .claude/hooks/sdd/plan-injector.js
# → caracteres inyectados: 24.622   (~6.155 tokens)
# → truncados a 8000: 3 de 3 secciones

grep -c "tmpdir\|STATE\|seen\|cache" templates/.claude/hooks/sdd/plan-injector.js
# → 0
```

**Propuesta**

Aplicar el patrón que ya usa `pre-write-guard` capa 4: un flag de dedup por track y sesión,
inyectando completo la primera vez y solo el delta de `tasks.md` después. Y un techo
agregado, no solo por sección.

**Estado:** abierto

---

## DEC-002 · El Generalization Gate se satisface con la palabra «cuando»

- **Tipo / severidad:** `DEC` · S2
- **Unidad:** `H-05` (`harness-gate.js`)
- **Contexto:** B (harness)

**Qué encontré**

`GATE-A1` bloquea cuando el contenido cita un track ID **y no contiene** un marcador de
generalización. El marcador se define como:

```js
/\b(cuando|siempre que|nunca|cada vez que|toda vez que|regla:|criterio|aplicabilidad|
   aplica cuando|no aplica|excepci[oó]n|independientemente de)\b/i
```

`cuando` y `nunca` son dos de las palabras más frecuentes de la prosa técnica en español.
El gate se satisface con que aparezcan en **cualquier** lugar del texto, sin ninguna
relación con el criterio de aplicabilidad que dice exigir.

**Por qué importa**

**12 de las 15 reglas reales del template ya contienen un marcador** sin habérselo
propuesto. El gate filtra solo el caso patológico puro —una receta escrita en telegrama— y
deja pasar cualquier receta redactada en español normal.

El daño no es que no filtre: es que su documentación promete un filtro fuerte, y eso induce
a confiar en que la memoria del harness está curada cuando no lo está.

**Evidencia**

```
A · "En fix-042 el boton no andaba. Le puse un margin-top de 4px."
    → exit 2  🧭 HARNESS GATE                      ✔ atrapa

B · "En fix-042 el boton no andaba cuando lo probamos. Le puse un margin-top de 4px."
    → exit 0                                        ✘ la misma receta pasa

12 de 15 reglas del template ya contienen un marcador de generalización
```

**Propuesta**

El problema es de fondo: un marcador léxico no puede distinguir un principio de una receta.
Dos caminos posibles — exigir que el marcador esté en la **misma frase** que el track ID
(más estricto, todavía evadible), o aceptar que este chequeo es heurístico y bajar el tono
de lo que promete. Lo que no puede quedar es la brecha entre ambas cosas.

**Estado:** abierto

---

## INC-005 · `spec-gate` y `plan-injector` clasifican el mismo archivo distinto

- **Tipo / severidad:** `INC` · S2
- **Unidad:** `H-03` / `H-06`
- **Contexto:** B (harness)

**Qué encontré**

Los dos hooks corren sobre el mismo matcher y comparten un bloque `isProductCode` **idéntico
carácter por carácter**. Lo que diverge son las listas de exención que corren antes:

| Categoría | Exime `spec-gate` pero **no** `plan-injector` |
|---|---|
| Prefijos | `supabase/seed`, `tests/`, `.next/`, `.angular/` |
| Extensiones | `.mdx`, `.gitignore`, `.npmrc`, `.env`, `.editorconfig` |
| Otros | `*.spec.ts`, `*.spec.js`, `*.test.{ts,js,tsx,jsx}`, `Dockerfile`, `Makefile`, `LICENSE`, `README` |

**Por qué importa**

El primer hook de la cadena declara «esto no es código de producto» y el cuarto le inyecta
el contrato completo igual. Al editar `src/app/features/x.spec.ts`: `spec-gate` sale en 0 y
`plan-injector` inyecta 24.622 caracteres. Multiplica `CAR-001` sobre toda la superficie de
tests, que es donde más ediciones hay en un flujo TDD.

**Evidencia**

```bash
'{"tool_input":{"file_path":"src/app/features/x.spec.ts","content":"x"}}'
  → spec-gate      exit 0  (exento)
  → plan-injector  SI — 24.622 caracteres
```

**Propuesta**

Extraer la clasificación a un módulo compartido en `sdd/`. Es copia-pega divergente, no un
desacuerdo de diseño: nadie decidió que un `.spec.ts` mereciera el contrato completo.

**Estado:** abierto

---

## HUE-010 · Los hooks de `sdd/` leen stdin sin el cap SEC-04

- **Tipo / severidad:** `HUE` · S2
- **Unidad:** `H-03` / `H-06`
- **Contexto:** B (harness)

**Qué encontré**

`MAX_STDIN_BYTES = 10 MB` se aplicó a los hooks de la raíz de `hooks/`. Los que leen stdin
**sin** el cap son exactamente los cuatro que quedaron fuera de esa pasada:
`sdd/spec-gate.js`, `sdd/plan-injector.js`, `sdd/hotfix-autoclose.js` y
`context-enrichment-guard.js`.

**Por qué importa**

Es una regresión de alcance, no una decisión: SEC-04 se aplicó por directorio y el
subdirectorio `sdd/` quedó afuera. Los tres hooks de SDD acumulan `data += chunk` sin
límite.

**Evidencia**

```bash
for f in templates/.claude/hooks/*.js templates/.claude/hooks/sdd/*.js; do
  grep -q "process.stdin" "$f" && ! grep -q "MAX_STDIN_BYTES" "$f" && basename "$f"
done
# → context-enrichment-guard.js, hotfix-autoclose.js, plan-injector.js, spec-gate.js
```

**Propuesta**

Aplicar el mismo cap. Es el ejemplo de por qué un chequeo de seguridad necesita un test que
lo verifique en **todos** los archivos, no una pasada manual.

**Estado:** abierto

---

## HUE-011 · Cero tests en todo `sdd/`

- **Tipo / severidad:** `HUE` · S2
- **Unidad:** `H-03` / `H-06` / `H-14`
- **Contexto:** B (harness)

**Qué encontré**

Los tres hooks del motor SDD —`spec-gate.js` (176 líneas, ocho ramas de decisión),
`plan-injector.js` (121) y `hotfix-autoclose.js` (65)— no tienen ningún archivo de test.

**Por qué importa**

`spec-gate` es un hook **que bloquea**, con lógica de rutas legacy (`fixes/hotfixes/` vs
`hotfixes/`) — exactamente el tipo de cosa que se rompe en una migración sin que nadie se
entere. Los dos hallazgos de esta ronda sobre `sdd/` (`INC-005`, `HUE-010`) los habría
encontrado cualquier suite mínima.

**Evidencia**

```bash
ls templates/.claude/tests/ | grep -E "spec-gate|plan-injector|hotfix"
# → (vacío)
```

**Propuesta**

Es la segunda entrada más rentable del backlog de tests, después de `HUE-006`.

**Estado:** abierto

---

## HUE-012 · Las reglas regex de `pre-write-guard` no están provocadas

- **Tipo / severidad:** `HUE` · S2
- **Unidad:** `H-04`
- **Contexto:** B (harness)

**Qué encontré**

`provocar-reglas.mjs` existe para responder «¿esta regla puede fallar?» y cubre las reglas
de `architect.js`. Las ~20 reglas regex de la capa 3 de `pre-write-guard.js` —`*ngIf`,
`@Input()`, colores hardcodeados, ARCH-12, ARCH-13, A11Y-01, A11Y-02, LLM-01, LLM-02— no
tienen ningún equivalente de provocación.

**Por qué importa**

Es la pregunta central del repo aplicada al revés. El linter AST corre cuando alguien
ejecuta `npm run lint:arch`; el guard regex corre **en cada escritura**. La mitad del
sistema de reglas que más veces se ejecuta es la que nadie provoca.

`pre-write-guard.test.js` existe y cubre algunas reglas, pero testear no es provocar:
comprueba que el guard bloquea lo que debe, no que cada regla individual siga viva.

**Propuesta**

Extender `provocar-reglas.mjs` con fixtures que se pasen al hook por stdin, o crear su
equivalente. Es el hallazgo con más apalancamiento de esta ronda: convierte ~20 reglas de
«asumimos que funcionan» a «comprobado».

**Estado:** abierto

---

## ACO-004 · El orden de los hooks es un contrato tácito

- **Tipo / severidad:** `ACO` · S2
- **Unidad:** `H-00`
- **Contexto:** B (harness)

**Qué encontré**

Tres dependencias de orden, de las cuales solo una está escrita:

| Dependencia | ¿Documentada? | Qué se rompe al reordenar |
|---|---|---|
| `spec-reflection` (Stop 2º) antes que `sync-check` (Stop 3º) | **no** | `sync-check` borra `session-writes.json`; si sube, `spec-reflection` pierde su evidencia |
| `spec-gate` (1º) antes que `plan-injector` (4º) | sí, en el docblock de `plan-injector` | el injector inyectaría sobre escrituras que el gate iba a bloquear |
| `discovery-tracker` (PostToolUse Read) antes de cualquier Edit | **no** | el Gate depende de que el PostToolUse ya haya corrido |

**Por qué importa**

`settings.json` se lee como una lista de hooks, no como una secuencia. Alguien que reordene
por prolijidad rompe `C-02` sin ninguna señal.

**Propuesta**

Declarar el orden como contrato en `templates-contract.md`, con las tres dependencias
nombradas, y un comentario en el propio `settings.json`.

**Estado:** abierto

---

## INC-004 · El registro cuenta 16 hooks cableados; son 17

- **Tipo / severidad:** `INC` · S3
- **Unidad:** `H-00`
- **Contexto:** B (harness)

**Qué encontré**

`TEMPLATES-REGISTRY.md` dice «7 eventos, 16 hooks cableados». Los eventos son 7; los
comandos cableados son **17**. El que falta contar es `.claude/scripts/post-edit.js`, que
vive fuera de `hooks/` pero está cableado como hook de `PostToolUse`.

**Evidencia**

```
SessionStart 1 · UserPromptSubmit 1 · PreToolUse[Edit] 4 · PreToolUse[Bash] 2 ·
PostToolUse[Read] 1 · PostToolUse[Edit] 2 · PostToolUseFailure 1 · PostCompact 1 · Stop 4
TOTAL = 17     (17 comandos, 0 colgantes)
```

**Propuesta**

Corregir el número y decir «16 en `hooks/` + `post-edit.js` en `.claude/scripts/`», que es
la distinción que hace falta entender.

**Estado:** abierto

---

## HUE-009 · Nada verifica que el cableado apunte a archivos que existen

- **Tipo / severidad:** `HUE` · S3
- **Unidad:** `H-00`
- **Contexto:** B (harness)

**Qué encontré**

Ningún test comprueba que los comandos de `settings.json` resuelvan a archivos reales. Hoy
los 17 resuelven, pero es una coincidencia mantenida a mano.

**Por qué importa**

Un hook renombrado deja un comando colgante y Claude Code simplemente no lo ejecuta: el
guardrail desaparece del proyecto del usuario sin ningún error visible.

**Propuesta**

Test de cinco líneas, del mismo tipo que `HUE-008`. Barato y cierra una clase entera de
fallo silencioso.

**Estado:** abierto

---

## HUE-013 · `GATE-B1` bloquearía una regla que documenta un hook

- **Tipo / severidad:** `HUE` · S3
- **Unidad:** `H-05`
- **Contexto:** B (harness)

**Qué encontré**

`EXEC_CODE_RE` bloquea `require(`, `process.exit(`, `fs.readFileSync(` en cualquier
superficie de guía. Una regla que **documenta** cómo funciona un hook dispara el gate.

**Por qué importa**

Es exactamente lo que hace `.claude/rules/templates-contract.md`: explicar el
funcionamiento de los hooks dentro de un archivo de reglas.

Verificado que **ninguna** regla actual del template ni de este repo lo dispara hoy, así
que es riesgo latente y no un problema activo — por eso `S3`.

**Propuesta**

Excluir el contenido dentro de bloques de código markdown (``` ```` ```) del chequeo: ahí
el código es cita, no lógica.

**Estado:** abierto

---

## ACO-005 · `DETAIL:BEGIN` y `last_updated` son contratos sin declarar

- **Tipo / severidad:** `ACO` · S3
- **Unidad:** `H-01`
- **Contexto:** B (harness)

**Qué encontré**

- `<!-- DETAIL:BEGIN -->` — marca el corte entre Quick Reference y detalle. Lo usan
  `session-start.js`, `compact-recovery.js` y los propios índices.
- `**last_updated:** YYYY-MM-DD` — formato exacto que parsean `session-start.js` y
  `discovery-tracker.js` para la frescura del brief.

Ninguno figura en `templates-contract.md`.

**Por qué importa**

Un índice generado sin el marcador se inyecta entero, no su Quick Reference: el
presupuesto de `session-start` (2.500 chars) lo trunca a la mitad de una tabla.

**Estado:** abierto

---

## ACO-006 · `koa-prompt-ctx-{sessionId}.json` no declarado

- **Tipo / severidad:** `ACO` · S3
- **Unidad:** `H-02`
- **Contexto:** B (harness)

**Qué encontré**

`prompt-context.js` guarda su estado de dedup —contador de prompts y hash de cada bloque—
en `$TMPDIR/koa-prompt-ctx-{sessionId}.json`. No está declarado, y hereda el `sessionId`
global de `HUE-002`: con el fallback `'default'`, un bloque inyectado en un proyecto puede
quedar silenciado en otro durante 8 prompts.

**Estado:** abierto

---

## ACO-007 · El estado del circuit breaker y del dedup de contexto no está declarado

- **Tipo / severidad:** `ACO` · S3
- **Unidad:** `H-04`
- **Contexto:** B (harness)

**Qué encontré**

`pre-write-guard.js` mantiene dos familias de estado en `os.tmpdir()`:

- `koa-breaker-{sessionId}.json` — contador de bloqueos idénticos (umbral 3)
- `koa-ctx-{categoría}-{sessionId}.flag` — **once** flags, uno por categoría de inyección

Ninguno declarado, todos con el `sessionId` de `HUE-002`. Con el fallback, el contador del
breaker y los flags de dedup se comparten entre proyectos: el contexto de `features/` puede
no inyectarse nunca en un proyecto porque otro ya lo consumió.

**Estado:** abierto

<!-- ═══ Plantilla para copiar al agregar un hallazgo ═══

## <ID> · <título en una línea>

- **Tipo / severidad:** `___` · S_
- **Unidad:** `___`
- **Contexto:** A (generador) · B (harness)

**Qué encontré**


**Por qué importa**
<!-- Consecuencia concreta. Si no la podés escribir, quizá no sea un hallazgo. -->


**Evidencia**
```
<comando, salida, fixture>
```

**Propuesta**
<!-- Qué haría falta. No hay que implementarlo ahora: la auditoría observa, no arregla.
     Arreglar mientras auditás rompe el ritmo y contamina la comparabilidad de las fichas. -->


**Estado:** abierto

═══ fin de plantilla ═══ -->
