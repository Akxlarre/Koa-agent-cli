# Cobertura del diseño — los 80 hallazgos, uno por uno

> **Por qué existe este documento.** Al cerrar `ADR-005` afirmé que *«el diseño cubre los 11
> clusters»* y de ahí que cubría los hallazgos. **Son dos cosas distintas.** Cruzando los IDs
> del registro contra los seis ADR: 36 de 80 aparecen nombrados. Los otros 44 estaban
> cubiertos *por cluster* y sin destino verificable — y uno era `S1`.
>
> Es el mismo error que la auditoría prohíbe en su regla 4: *«ficha sin campo 4 con evidencia
> = ficha incompleta»*. Un cluster no es evidencia de cobertura; un ID nombrado sí.

---

## El estado

| | Hallazgos |
|---|---|
| En el registro | **80** |
| Con un ADR que los nombra | **36** |
| Asignados por este pase | **44** |
| Sin destino | **0** |

De los 44, seis motivaron un ADR nuevo (`ADR-006`, §1) y uno —`HUE-005`, el único `S1`
huérfano— resultó estar cubierto por `ADR-001` sin que el ADR lo nombrara (§1 bis). Los 37
restantes ya tenían destino o son backlog en lote; lo que faltaba era decirlo.

---

## 1 · Lo que motivó `ADR-006`

Seis hallazgos de `bin/`/`lib/` sin destino, porque **los cinco primeros ADR son casi
enteramente Contexto B**. El generador se quedó sin diseño.

| ID | Sev | Destino |
|---|---|---|
| `HUE-020` | S2 → **S1** | `ADR-006` §1 — `parseJsonc` rompe con cualquier `//` dentro de un string |
| `HUE-022` | S2 → **S1** | `ADR-006` §2, §3 — 19 parches condicionales, ninguno con `else` |
| `HUE-021` | S3 | `ADR-006` §3 |
| `INC-011`, `INC-012`, `INC-013`, `INC-018` | S3/S2 | `ADR-006` §5 |

---

## 1 bis · `HUE-005` — el `S1` huérfano, y dónde estaba

`blueprint.json` no se valida **dentro del proyecto generado**, y su `stack` crudo decide qué
guardrails corren. Dos consumidores lo leen así:

```
templates/.claude/hooks/pre-write-guard.js:29-32   if (bp.stack && typeof bp.stack === 'object') STACK = { ...STACK, ...bp.stack }
templates/boilerplate/scripts/architect.js:72      lee blueprint.json para saltar reglas según configuración
```

Un `blueprint.json` con un `stack` mal formado —editado a mano, de una versión anterior del
CLI, o escrito por el propio scaffolder tras el `⚠ blueprint.json existente ilegible`— **apaga
reglas en silencio**. Es Contexto B, no Contexto A: el archivo lo escribe el generador pero el
daño ocurre en el proyecto.

**Lo cierra `ADR-001` §5.** `blueprint.json` es un artefacto del registro con `format` y dos
`consumers` declarados; validar donde se lee es justamente lo que el registro habilita, y el
test del registro contra el filesystem lo cubre. El ADR no lo nombraba — ahora sí. Se cierra
junto a `INC-003`, que es el mismo artefacto sin declarar su consumidor.

---

## 2 · Los que `ADR-001` §5 ya cerraba y no nombré

El registro de contratos cierra **todo hallazgo cuya forma es «X depende del formato de Y sin
que figure en `templates-contract.md`»**. Son nueve, no los tres que el ADR citaba:

| ID | Contrato sin declarar |
|---|---|
| `ACO-002` | `spec-reflection-seen.json` |
| `ACO-003` | `indices-cache.json` |
| `ACO-005` | `<!-- DETAIL:BEGIN -->` y `last_updated:` |
| `ACO-008` | `LESSONS_LEARNED.md` como round-trip con dos productores |
| `ACO-009` | La provocación depende de que la salida de `architect.js` nombre el código |
| `ACO-010` | `smoke-scripts` depende de los nombres exactos de los scripts |
| `ACO-011` | `.claude/temp/review-diff.patch`, canal entre `/review` y `code-judge` |
| `HUE-008` | El test que fija la partición 13 auto-generados / 2 manuales |
| `HUE-030` | El mapa de índices completo |

El test que `ADR-001` §5 pide —el registro contrastado contra el filesystem— los verifica a
todos con la misma pieza.

---

## 3 · `LESSONS_LEARNED.md` — el hueco que quedó fuera de todos los ADR

Dos hallazgos que juntos son un bug real y que ningún ADR toca:

| ID | Sev | Qué |
|---|---|---|
| `DUP-002` | S2 | `failure-tracker` y `lint-arch-wrapper` escriben ambos, con formatos distintos |
| `HUE-016` | S2 | Un error que contiene `\|` corrompe el archivo en el siguiente parseo: se pierden firma y conteo, **y el daño es acumulativo** |

**Backlog con nombre propio, no ADR.** El arreglo es escapar el separador y unificar el
formato en el productor; no hay una decisión de diseño que tomar, solo trabajo. Pero
acumulativo y silencioso, así que va antes que el resto del backlog.

---

## 4 · Los que dependen del cluster 8 (`ADR-005` §1)

Cobertura de reglas. Se resuelven con el mismo orden que `ADR-005` fija, no en paralelo:

| ID | Sev | Qué |
|---|---|---|
| `HUE-012` | S2 | Las ~20 reglas regex de `pre-write-guard` no las cubre `provocar-reglas.mjs` |
| `INC-009` | S2 | `SEC-RLS-01/02/03` fuera del baseline: `lint:arch:provocar` sale en 1 en un proyecto recién generado |
| `HUE-025` | S2 | La cobertura mide que la lógica sea correcta, casi nunca que el sistema la ejecute |
| `HUE-026` | S3 | `doc-links.test.js` verifica «regla emitida → documentada» pero no la inversa — por eso `ARCH-14` sobrevivió |
| `DEC-005` | S3 | `smoke-scripts` imprime `✅ 0 script(s) comprobados` y sale 0 |
| `ACO-009` | S3 | (también en §2) |

`INC-009` merece nota: **un proyecto recién generado tiene el `lint:arch:provocar` en rojo**.
Es la primera impresión del harness.

---

## 5 · Los que `ADR-001` tanda 2 cubre (tests de hooks)

| ID | Sev | Qué |
|---|---|---|
| `HUE-009` | S3 | Ningún test verifica que los comandos cableados apunten a archivos existentes |
| `HUE-014` | S3 | El matching contra el índice es por substring |
| `HUE-018` | S2 | `require('typescript')` sin guarda: con TypeScript 7 el linter muere con un `TypeError` |
| `HUE-013` | S3 | `GATE-B1` bloquearía una regla que documenta un hook; latente |
| `HUE-031` | S3 | `pre-write-guard` capa 1 y `harness-gate` protegen superficies complementarias |
| `ACO-004` | S2 | El orden de los hooks dentro de cada evento es semántico en 3 casos y no está declarado |

`ACO-004` y `HUE-018` son los dos que no son solo test: el orden va declarado en
`settings.json` con un comentario, y `require('typescript')` necesita su guarda —el que nos
mordió durante la auditoría—.

---

## 6 · Autoridad triplicada de índices

| ID | Sev | Qué |
|---|---|---|
| `DUP-003` | S2 | `/sync-indices`, `index-syncer` e `indices-sync.js` hacen el mismo trabajo en tres capas y nada dice cuál usar cuándo |
| `HUE-003` | S2 | `compact-recovery` conoce 10 de 15 índices: GUARDS, LAYOUTS, ROUTES, USAGE-MAP y UTILS nunca se re-inyectan — **resuelto** |

`HUE-003` lo cerró algo más barato que el registro de contratos: **borrar la lista**. El
hook lee `indices/` del disco, así que no hay nada que sincronizar (10 → 15 medido).
`HUE-030` era el mismo mapa en `AGENTS.md`, que no puede derivar nada por ser prosa: ahí la
lista quedó, y `contracts.js` le puso el test que la compara contra el filesystem. `DUP-003` es una
decisión pequeña —cuál es la autoridad y qué son las otras dos— que no llegó a merecer ADR
pero sí una línea escrita en `templates-contract.md`.

---

## 7 · Backlog en lote — deriva de documentación

Once `INC` que no requieren pensar, un commit:

`INC-004` (16 hooks vs 17) · `INC-006` (docblock de `discovery-tracker`) · `INC-014`
(`_view-transitions.scss` vs `motion/`) · `INC-016` (`DOMAIN-GOTCHAS.md` no existe) ·
`INC-019` (8 reglas vs 28) · `INC-002` · `INC-003` · `INC-001` (ya reescrito) — más los que
`ADR-005` genere al partir `visual-system.md`.

Y cinco `HUE` de la misma familia, que son documentación de lo que ya pasa:
`HUE-023` (la calidad del resumen de los subagentes no es verificable) · `HUE-024` ·
`HUE-027` (nada distingue las 10 reglas mecanizadas de las 5 que son contrato social) ·
`HUE-028` · `HUE-029` (los adapters no llevan mecanismo y nadie se lo dice al usuario).

`HUE-027` es el más útil de los cinco: la distinción entre *regla mecanizada* y *contrato
social* es exactamente el eje de `ADR-005`, y hoy nada la marca en los archivos.

---

## 8 · El que se quedó fuera a propósito

| ID | Sev | Por qué |
|---|---|---|
| `INC-008` | S2 | `section-hero.component.ts` tiene 1.170 líneas contra el límite de 200 de `ARCH-09`. Es refactor del boilerplate Angular, no diseño. Pero es el CLI repartiendo código que su propio linter rechaza: el primer `npm run lint:arch` de cualquier proyecto generado lo señala |

---

## Lo que este pase enseña sobre el diseño

**Los seis ADR cubren las decisiones; el backlog cubre el volumen.** De 80 hallazgos, unos 30
necesitaban que alguien decidiera algo y el resto necesitaba que alguien lo hiciera. Mezclar
las dos cosas fue lo que hizo que `HUE-005` y los seis del generador se perdieran: estaban
«en un cluster», que es donde van las cosas de las que nadie se hace cargo.

**Y el pase encontró un ADR entero.** No porque el generador fuera invisible, sino porque la
regla de ponderación de la auditoría decía que fallaba ruidoso — y `lib/scaffolder.js` tiene
19 bloques condicionales sin `else`. Creerle a una regla del propio método es el mismo error
que creerle a un supuesto sobre el runtime: los dos se arreglan midiendo.
