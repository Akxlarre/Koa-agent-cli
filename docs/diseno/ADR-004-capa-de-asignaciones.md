# ADR-004 · Integrar la capa de asignaciones

**Estado:** implementado · **Fecha:** 2026-08-30 · **Cluster:** 10 · **Decisión tomada con:** el
humano, sobre tres opciones (integrar · sacar · dejarla opcional explícita)

---

## Contexto

La capa de asignaciones son **886 líneas** en seis archivos:

| Archivo | Líneas |
|---|---|
| `boilerplate/scripts/assignments-audit.js` | 252 |
| `boilerplate/scripts/assignments-sync.js` | 177 |
| `.claude/commands/assign-claim.md` | 204 |
| `.claude/commands/assign-new.md` | 126 |
| `.claude/commands/assign-list.md` | 67 |
| `.claude/skills/sdd/templates/AUTHORS.md` | 60 |

Con **0 tests**, **0 cobertura en `smoke-scripts.mjs`**, **0 menciones en `templates/docs/`**
y cuatro hallazgos abiertos: `INC-010`, `INC-015`, `INC-017`, `DUP-001`.

**Su ruta documentada está rota de punta a punta.** `sdd/SKILL.md` la instruye tres veces
(`:85`, `:86`, `:194`) y `/assign-claim:155` manda correr `npm run assignments:sync`. Ese
script no existe: `lib/scaffolder.js` escribe 14 npm scripts y ninguno es `assignments:*`.
El único camino de escritura de la capa —regenerar las tablas auto-generadas de
`ASSIGNMENTS.md`— no se puede recorrer en ningún proyecto generado.

### Por qué integrarla y no sacarla

La lectura fiel del código es que **el diseño estaba bien y el cableado quedó a medias**, no
que la capa sobre. `INC-017` documenta que alguien la usó, encontró una colisión de
numeración, y arregló el detector. Sacar 886 líneas que alguien ejerció es tirar trabajo
hecho para no terminar el 5% que falta.

Es, además, la novena instancia del patrón que encabeza el pase general —*«las herramientas
están inventadas y la aplicación quedó a medias»*—, y la más literal de todas: las
herramientas existen, funcionan, y no hay forma de invocarlas.

---

## El principio ya está escrito en el repo

Tres líneas encima de donde faltan los scripts, `lib/scaffolder.js:470` dice cómo se
comporta una capa opcional en este blueprint:

```js
// Enlaces entre specs. Sin carpeta specs/ no hace nada, igual que el
// spec-gate: el SDD viene dormido y no molesta a quien no lo usa.
'lint:specs': 'node scripts/verificar-specs.mjs',
```

**«Viene dormido y no molesta a quien no lo usa».** Los dos scripts de asignaciones son los
únicos del blueprint que no lo cumplen: sin `specs/ASSIGNMENTS.md` salen en `exit 1` y ponen
rojo el CI de un proyecto que jamás pidió la capa (`INC-010`).

Igual que `ADR-001` no inventó `hooks/lib/` sino que aplicó a `hooks/` lo que el repo ya
hacía en `scripts/`, este ADR no inventa una política: **aplica a las asignaciones la que el
propio scaffolder ya escribió para el SDD.**

---

## Decisión

### 1 · Un solo interruptor: `specs/AUTHORS.md`

La capa entera se enciende con la presencia de un archivo, y ese hecho gobierna las tres
decisiones que hoy están tomadas por separado y en desacuerdo:

| Pregunta | Sin `AUTHORS.md` | Con `AUTHORS.md` |
|---|---|---|
| ¿Los scripts hacen algo? | mensaje y **`exit 0`** | corren de verdad |
| ¿Los IDs de track llevan código de autor? | **no** — `NNNN-slug` | **sí** — `NNNN-<autor>-slug` |
| ¿Los comandos `/assign-*` ofrecen el flujo? | avisan que la capa está apagada | flujo completo |

**Por qué `AUTHORS.md` y no `ASSIGNMENTS.md`.** El código de autor existe para evitar que dos
ramas saquen el mismo número y git las auto-resuelva sin conflicto —el fallo silencioso que
`/assign-new:67` describe—. Ese riesgo aparece cuando hay más de un autor, que es exactamente
lo que `AUTHORS.md` declara. `ASSIGNMENTS.md` es el tablero; `AUTHORS.md` es el hecho.

### 2 · `INC-017` — la convención de ID, medida

El hallazgo decía *«tres convenciones»*. Verificado en el código, es más nítido y más grave:

| Pieza | Qué produce o exige | Código de autor |
|---|---|---|
| `/spec-new:44` | `specs/specs/NNNN-slug/` | **no** |
| `/fix-new:45` | `fix-NNN-<slug>` | **no** |
| `/hotfix:48` | `hotfix-NNN-<slug>` | **no** |
| `/assign-claim:131` | `specs/specs/NNNN-<mi_codigo>-slug/` | sí |
| `/assign-new:56` | `ASG-<codigo>-NNN` | sí |
| `assignments-audit.js:59` | `^(\d{N})-([a-z]+)-(.+)$` | **lo exige** |

`processTrack` (`:125-130`) empuja un `namingViolation` por **cada** directorio que no
matchea. Es decir: **todo track creado por los tres comandos normales del SDD es una
violación de naming para el auditor.** No es un caso borde — es el caso común.

Y `/assign-claim:124` afirma que su regla con código de autor es *«exactamente la misma regla
que ya usan `/spec-new`, `/fix-new` y `/hotfix`»*. **Los tres comandos que cita no la
siguen.**

**Decisión: el código de autor es opcional en el formato, y el interruptor decide.**

```
sin AUTHORS.md   NNNN-slug              ← lo que generan hoy los tres comandos
con AUTHORS.md   NNNN-<autor>-slug      ← lo que exigen assignments-audit y /assign-claim
```

Ambas formas son válidas; **cuál es válida en este proyecto lo dice el interruptor**, y una
sola pieza lo implementa. Se descarta la alternativa obvia —poner el código de autor en los
tres comandos siempre— porque obliga a `.claude/author.local.json` a cada proyecto de una
sola persona, que es la mayoría, para prevenir una colisión que ahí no puede ocurrir.

### 3 · `DUP-001` — un solo modo de fallo

`indices-sync` avisa y sigue; `assignments-sync` lanza. Con el interruptor, la diferencia se
disuelve en la distinción que faltaba:

| Situación | Comportamiento |
|---|---|
| Capa apagada (sin `AUTHORS.md`) | mensaje, `exit 0` — no es un error, es una capa que no se usa |
| Encendida, con un problema de integridad real | `exit 1` — un script que escribe archivos no debe seguir sobre datos rotos |

`assignments-sync` no estaba mal en lanzar: estaba mal en no distinguir *«no hay nada que
hacer»* de *«hay algo roto»*. `verificar-specs.mjs` ya hace esa distinción y es el modelo.

### 4 · `INC-015` — el cableado

Dos líneas en `lib/scaffolder.js`, junto a `lint:specs` y bajo su mismo comentario:

```js
'assignments:sync':  'node scripts/assignments-sync.js',
'assignments:audit': 'node scripts/assignments-audit.js',
```

### 5 · Lo que convierte esto en integración y no en parche

Sin esto, en seis meses la capa vuelve a estar donde está:

- **Cobertura en `smoke:scripts`.** Los dos scripts entran en `smoke-scripts.mjs`, que es
  donde el repo verifica que un script corre sin explotar. Hoy es el único del boilerplate
  que no los mira.
- **Tests del interruptor**, en `scripts/lib/`: apagado → `exit 0`; encendido y sano →
  `exit 0` con trabajo hecho; encendido y roto → `exit 1`. Tres casos, la partición completa.
- **Un test de la convención de ID** que falla si un comando genera una forma que el auditor
  rechaza. Es el test que hubiera evitado `INC-017`: el bug ocurrió, se arregló el detector,
  y nada fijó que generador y detector hablaran el mismo idioma.
- **`templates/docs/`**: la capa se documenta para el usuario final, o no existe para él.

---

## Qué cierra

| Hallazgo | Cómo |
|---|---|
| `INC-010` (S2) | ✅ Interruptor: sin `AUTHORS.md`, mensaje y `exit 0` |
| `INC-015` (S2) | ✅ Los dos npm scripts en `lib/scaffolder.js`, con test que ata comando y script |
| `INC-017` (S2) | ✅ Una convención con dos formas, y el interruptor decide cuál — con test de las dos ramas |
| `DUP-001` (S3) | ✅ «Nada que hacer» ≠ «algo roto», en los dos scripts |
| `INC-022` (**S2**) | 🆕 Lo destapó encender la capa: la plantilla del tablero no tenía marcadores `AUTO-GENERATED` |

---

## Contexto A · esto toca el generador

**El único ADR que edita `lib/`.** `INC-015` se arregla en `lib/scaffolder.js`, que es
Contexto A: el vehículo, no el producto. Los otros cuatro puntos son Contexto B.

Es una distinción que este repo exige declarar (`CLAUDE.md`, *«Dualidad crítica»*) y que aquí
importa de verdad: la línea del npm script se ejecuta **al generar**, una vez y ruidosamente;
las 886 líneas de la capa se ejecutan **en el proyecto generado**, replicadas. El test de la
línea del scaffolder va en la suite del CLI; los del interruptor, en `scripts/lib/`.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Encender los scripts destapa fallos que hoy nadie ve** — nunca corrieron en un proyecto real | Es el objetivo, no el riesgo. Pero por eso `assignments:audit` (que no escribe) se cablea y se prueba antes que `assignments:sync` (que sí) |
| **`assignments-sync` reescribe tablas de `ASSIGNMENTS.md` en proyectos que ya las editaron a mano** | Mismo problema que `HUE-007` con los marcadores de índices. Se resuelve igual, y esta vez con test |
| **Dos formas de ID válidas son dos caminos que mantener** | Una sola implementación con un parámetro, y el test cubre las dos ramas. Es la lección de `paths.js` en `ADR-001` §3: el problema nunca fueron las variantes, sino escribirlas varias veces sin nombre ni test |
| **La decisión de integrar se toma sin uso real medido** | El humano la tomó con la evidencia arriba a la vista. Queda registrada acá; si en la práctica la capa no se usa, sacarla después cuesta menos que hoy, porque estará testeada y aislada tras un interruptor |


---

## Lo hecho

`scripts/lib/assignments-switch.js` es la pieza nueva: **una sola implementación** del
interruptor y de la convención de ID, con `parseTrackName(prefix, name, digitos, { conAutor })`
como la única función que sabe leer un nombre de track. Antes cada consumidor llevaba su
propio regex, y de ahí salió `INC-017`.

Los tres estados quedan fijados por test, que es la partición completa:

```
apagada (sin AUTHORS.md)        → mensaje y exit 0     ← INC-010
encendida y sana                → exit 0, trabajo hecho
encendida y a medias            → exit 1 con motivo    ← DUP-001
```

### Lo que apareció al encenderla — `INC-022`

El riesgo declarado arriba era *«encender los scripts destapa fallos que hoy nadie ve»*, y
apareció en la primera corrida contra un tablero creado con la plantilla oficial:

```
Error: No se encontró la sección "## Reclamadas / En curso" en ASSIGNMENTS.md
```

`assignments-sync` solo reescribe lo que está entre `<!-- AUTO-GENERATED:BEGIN/END -->` —el
mismo patrón que `indices-sync`— y **la plantilla canónica `sdd/templates/ASSIGNMENTS.md` no
traía ni un marcador**. Es decir: el único camino de escritura de la capa fallaba también en
un proyecto que hubiera hecho todo bien, no solo en uno sin los npm scripts. La plantilla ya
los trae, y el error dejó de ser un stack trace: dice qué falta y cómo envolver la tabla.

Es la confirmación de la lectura que motivó este ADR — *el diseño estaba bien y el cableado
quedó a medias*—: tres cortes distintos en el mismo camino (el npm script inexistente, el
`exit 1` sin capa, los marcadores ausentes), ninguno de los cuales fallaba ruidosamente.

### El mensaje de naming, corregido

Con la capa encendida, `fix-001-kpi-en-cero` **matchea** la forma con autor y lee `kpi` como
código. El auditor decía *«autor 'kpi' no está en specs/AUTHORS.md»*, que es cierto y no
sirve: el caso común no es un autor mal escrito, es un track creado por `/fix-new`, que no
pone código de autor. Ahora el mensaje nombra además la forma esperada.

### Cobertura

`smoke-scripts` clasifica los dos como `verificable` sin tocar nada —clasifica por patrón, no
por lista— así que entran en `npm run smoke:scripts` por el solo hecho de existir en
`package.json`. Verificado, no supuesto.
