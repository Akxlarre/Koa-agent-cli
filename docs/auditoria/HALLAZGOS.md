# Registro de hallazgos

> **Cada hallazgo se describe UNA vez, acá.** Las fichas solo lo referencian por ID.
> Si un hallazgo vive dentro de una ficha, no se puede contar, ordenar por severidad ni
> agrupar por tipo — y el pase general se vuelve imposible.

## Taxonomía

Seis tipos, cerrados. Si algo no entra en ninguno, primero preguntate si realmente es un
hallazgo; recién después agregá un tipo (y documentalo acá).

| Tipo | Nombre | Qué es | Ejemplo del repo |
|---|---|---|---|
| `INC` | Inconsistencia | La documentación dice X, el código hace Y | `.claude/CLAUDE.md` habla de reglas ARCH hasta la 26; hay 22 activas |
| `DEC` | Chequeo decorativo | Existe, corre, pasa — y no puede fallar | ARCH-24 y ARCH-26, muertas hasta que existió `provocar-reglas.mjs` |
| `ACO` | Acoplamiento no declarado | Una pieza depende del formato de otra sin que figure en `templates-contract.md` | — |
| `DUP` | Autoridad duplicada | Dos piezas deciden lo mismo, posiblemente con criterios distintos | `session-start` y `discovery-tracker` escriben el mismo flag |
| `HUE` | Hueco | Nadie cubre esto: sin test, sin mecanismo, sin dueño | los hooks sin archivo de test |
| `CAR` | Carga | Correcto, pero cuesta más contexto/fricción de lo que aporta | una regla que se inyecta siempre y ningún mecanismo aplica |

> `CAR` es el tipo que casi nadie incluye y en un harness es central: **una pieza puede
> ser correcta y aun así ser neta negativa**, porque cada regla, cada skill
> model-invocable y cada inyección paga renta en la ventana de contexto.

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
| `INC-001` | S3 | `L-05` | `.claude/CLAUDE.md` y el mapa hablaban de 26 reglas ARCH; hay 22 códigos activos (faltan 12, 13, 14, 20) | abierto |
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

## INC-001 · Numeración de códigos ARCH

- **Tipo / severidad:** `INC` · S3
- **Unidad:** `L-05` (docs) — confirmar también en `S-01` (`architect.js`)
- **Contexto:** B (harness)

**Qué encontré**

`templates/boilerplate/scripts/architect.js` define 22 códigos `ARCH-*` activos,
numerados hasta ARCH-26. Los códigos 12, 13, 14 y 20 no existen en el archivo.
La documentación del harness describe el linter sin aclarar esa discontinuidad.

**Por qué importa**

Sola, la discontinuidad es cosmética. Lo que hay que resolver es **por qué** faltan: si
son reglas eliminadas sin limpiar la numeración, hay que verificar que nada siga
refiriéndose a ellas (baseline de provocación, docs, tests). Si son huecos reservados,
hay que documentarlo.

**Evidencia**

```bash
grep -oE "'ARCH-[0-9]+'" templates/boilerplate/scripts/architect.js | sort -u | wc -l
# → 22
```

**Propuesta**

Determinar el origen de los cuatro huecos durante la ficha `S-01` y, según el caso,
documentar la discontinuidad o renumerar. Actualizar la prosa que cuente reglas.

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
