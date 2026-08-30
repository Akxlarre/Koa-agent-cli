# ADR-005 · El presupuesto de las reglas inyectadas

**Estado:** propuesto · **Fecha:** 2026-08-30 · **Clusters:** 11 (editorial de `CAR-003`) y 8
(fixtures) · **Depende de:** nada del núcleo — es el único ADR que no toca código de hooks

---

## Contexto

`ADR-001` §4 dejó explícito que `lib/budget.js` **no** cierra `CAR-003`: las reglas
path-scoped las inyecta Claude Code al matchear `paths:` en el frontmatter, y ningún hook
puede interceptarlas. El arreglo es editorial. Este ADR lo diseña.

### Lo medido, y por qué `CAR-003` se quedó corto

La ficha `R-01` midió el caso de `src/app/shared/`: 6 reglas, ~9.800 tokens. Es el segundo
peor caso, no el peor. Cruzando los `paths:` de las 15 reglas contra rutas representativas:

| Archivo editado | Reglas | Chars | Tokens |
|---|---|---|---|
| `src/app/features/reportes/reportes.ts` | **13** | **76.391** | **~19.100** |
| `src/app/features/reportes/reportes.html` | 8 | 44.612 | ~11.150 |
| `src/app/core/facades/reportes.facade.ts` | 7 | 42.308 | ~10.580 |
| `src/app/shared/ui/kpi-card/kpi-card.ts` | 6 | 39.873 | ~9.970 ← lo que midió `R-01` |
| `src/app/core/models/reporte.model.ts` | 5 | 21.204 | ~5.300 |
| `supabase/migrations/001_init.sql` | 2 | 7.514 | ~1.880 |

**El caso peor es el caso común.** Un componente de `features/` es lo que más se edita en un
proyecto Angular, y paga ~19.100 tokens. Sumado a los ~6.155 de `plan-injector` en cada
`Edit` (`CAR-001`), un solo `Edit` de un componente de feature arrastra **~25.250 tokens**.

El pase general reportó ~17.200 como peor caso porque midió el de `shared/`. El real es
casi el doble.

### De dónde sale

`visual-system.md` son 21.228 chars —**el 28% del peor caso, una sola regla**— y matchea seis
globs, entre ellos `src/app/**/*.html` y `src/app/**/*.scss`: prácticamente todo lo visual.

Y no es un problema de ejemplos de código. Medido:

```
visual-system.md   21.228 chars   ejemplos  2.966 (14%)   normativo 18.263
facades.md         13.244         ejemplos  4.327 (33%)   normativo  8.918
swr-pattern.md      7.860         ejemplos  4.388 (56%)   normativo  3.473
```

`visual-system.md` es 86% prosa normativa, repartida en **18 secciones `##`** que hablan de
cosas distintas: tokens de color, iconos, tipografía, skeletons, bento grid, multi-brand,
animaciones, patrón app-like. Matchea seis globs porque es seis reglas en un archivo.

---

## El principio

**El contexto se paga por lo que ninguna máquina puede atrapar.**

Una regla que un linter verifica de forma determinista no necesita estar en la ventana de
contexto: puede vivir en el mensaje de error, que llega justo cuando hace falta y no antes.
Una regla que ningún chequeo puede verificar —«prioriza PrimeNG sobre HTML crudo», «la marca
se usa 3-2-1»— solo existe si está en el contexto.

Es la misma economía que el repo ya aplica a los índices con `<!-- DETAIL:BEGIN -->`:
inyectar la Quick Reference, dejar los ejemplos en el archivo. Las reglas no tienen ese
mecanismo —el runtime inyecta el archivo entero, no respeta marcadores— así que el
equivalente es **partir en dos archivos**: uno con `paths:` (se inyecta) y uno sin (se lee
bajo demanda).

---

## El bloqueo: la mitad barata está cerrada

En `visual-system.md`, 4.854 chars (líneas 93–200) son prosa que explica reglas que el
linter ya emite: ARCH-11, 15–19, 22, 24, 25, 26. Cambiarlas por el mensaje de error sería el
recorte más limpio del ADR.

**No se puede hacer todavía.** Cruzando las reglas citadas en `rules/*.md` contra
`provocacion.baseline.json`:

```
ARCH citadas en rules/     ARCH-11 13 15 16 17 18 19 22 23 24 25 26   (12)
ARCH sin fixture           ARCH-11 15 16 17 18 19 22 23 24 25 26 …    (21 en total)
                           ────────────────────────────────────────
intersección                                                    11 de 12
```

Fixtures que existen: **cuatro** — `ARCH-01`, `03`, `04`, `05`. **Ninguna de las cuatro está
citada en `rules/`.** La única citada que no aparece en el baseline es `ARCH-13`, y porque no
la emite el linter sino `pre-write-guard` (ver `INC-001`).

Dicho de otro modo: **de las once reglas cuya prosa querríamos cambiar por detección
automática, cero han demostrado que detectan algo.** El docblock de `provocar-reglas.mjs` lo
dice sin rodeos:

> *«Una regla que no dispara ante su propia violación es decoración.»*

Cambiar prevención por detección sin haber probado la detección no ahorra contexto: apaga el
guardrail y deja la sensación de que sigue ahí.

### La consecuencia de orden

**El cluster 8 (fixtures) es precondición del cluster 11 (editorial), no una tarea paralela.**
El pase general los listó como dos entradas de backlog mecánico; son una secuencia. La
auditoría tenía los dos datos —`DEC-004` y `CAR-003`— y no cruzó los IDs.

---

## Decisión

### 1 · Primero las fixtures de las once, después el recorte

`DEC-004` deja de ser *«24 fixtures, trabajo mecánico e incremental»* y pasa a tener un orden
con criterio: **las once que desbloquean el recorte van primero**, no las que sean más
fáciles de escribir.

```
ARCH-11 15 16 17 18 19 22   disciplina de clases y tokens   ← visual-system.md:93
ARCH-24                     vocabulario de campos           ← visual-system.md:140
ARCH-25                     el contraste no se hereda       ← visual-system.md:167
ARCH-26                     nombrar tokens del @theme       ← visual-system.md:180
ARCH-23                                                     ← citada en otra regla
```

Cada fixture que pasa a verde autoriza a recortar su párrafo. **La medida del progreso deja
de ser «fixtures escritas» y pasa a ser «chars que salieron del contexto»** — que es lo que
`CAR-003` pedía.

### 2 · Partir `visual-system.md` por glob, no por tema

Sus 18 secciones se agrupan en tres archivos cuyos `paths:` son disjuntos donde hoy se
solapan:

| Archivo | Qué lleva | `paths:` |
|---|---|---|
| `visual-tokens.md` | Color, tipografía, iconos, contraste, `@theme`, claro/oscuro, multi-brand | `**/*.scss`, `**/*.html` |
| `visual-patterns.md` | App-like (6.562 chars), skeletons, superficies activas, bento, cards, animaciones | `features/**`, `layout/**` |
| `visual-system.md` | Prioridad de UI y la regla 3-2-1 — lo que ningún chequeo puede verificar | todos, pero corto |

El objetivo no es tener tres archivos: es que **editar un `.scss` deje de traer el patrón
app-like** y que editar un `.ts` de feature deje de traer la paleta de colores.

### 3 · Estrechar `delegation.md`

Matchea `src/app/**/*.ts`, `src/app/**/*.html` y `supabase/migrations/**`: **aparece en los
seis casos medidos**, incluida la migración SQL. Son 2.992 chars sobre cuándo delegar en un
subagente — una decisión de flujo de trabajo, no algo que dependa del archivo abierto.

Va a `CLAUDE.md`, que se carga una vez por sesión, y sale de `rules/`. Ahorra 2.992 chars
**por cada archivo abierto** a cambio de 2.992 una sola vez.

### 4 · La regla que impide la reincidencia

Un test sobre `rules/*.md`:

```
para cada ruta representativa:
    suma de las reglas que matchean  <  TOPE
```

Con el tope declarado y un caso por capa (`features/*.ts`, `*.html`, `*.scss`, `facades`,
`models`, `migrations`). Sin esto, la siguiente regla que alguien agregue con
`src/app/**/*.ts` vuelve a subir el peor caso sin que nadie lo note — que es exactamente
cómo se llegó a 76.391 chars.

**El tope es el entregable, no los tres archivos.** Partir `visual-system.md` sin fijar el
tope es reordenar el problema.

---

## Qué cierra

| Hallazgo | Cómo |
|---|---|
| `CAR-003` (S2) | Partición por glob + `delegation.md` a `CLAUDE.md` + el tope testeado |
| `DEC-004` (**S1**) | Le da orden y criterio de progreso a las 24 fixtures |
| `DEC-002`, `HUE-019` y el resto del cluster 8 | Quedan bajo el mismo orden |

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Cambiar prevención por detección cuesta un round-trip**: el agente escribe la violación, el linter la atrapa, hay que corregir | Es el trade que el ADR hace explícito. Paga cuando la regla es mecánica y el linter está probado; por eso las fixtures van primero. Para lo no verificable —«prioriza PrimeNG»— no se toca nada |
| **Partir un archivo pierde el hilo**: las secciones se escribieron juntas y se leen juntas | Los tres archivos se referencian entre sí. Y hoy el hilo tampoco se lee entero: se inyecta entero, que no es lo mismo |
| **El tope se vuelve un número que nadie sabe justificar** | Se fija con la medición de arriba como línea base y se anota de dónde salió. Un tope arbitrario que falla es mejor que ningún tope: obliga a la conversación cuando alguien lo cruza |
| **Once fixtures antes de ver un solo char de ahorro** | Es la razón de ser del orden, no un efecto secundario. Y las fixtures cierran un `S1` por sí solas: hoy once reglas citadas en la documentación no han demostrado que puedan fallar |
