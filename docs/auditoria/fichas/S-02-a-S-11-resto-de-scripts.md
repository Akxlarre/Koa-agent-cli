# FICHA A — S-02, S-03, S-04, S-07 a S-11 · Resto de los scripts

> Ocho unidades en una ficha. Las ocho se ejecutaron de verdad en un sandbox con el
> boilerplate real y `typescript@5.9`; ninguna requirió los ocho campos completos porque
> ninguna tiene la superficie de `architect.js` ni el peso de los dos auditores. Cada una
> conserva su veredicto propio.

| | |
|---|---|
| **Contexto** B · **Bloque** 2 · **Revisado** 2026-08-29 · **Estado** cerrada |

**Corrida completa:**

```
── S-02 lint-arch-wrapper       exit=0
── S-03 indices-sync            exit=0 | ✅ 12 índice(s) actualizado(s)… luego "todos al día"
── S-04 check-bento             exit=0 | ✅ 31 clases, todas en el allowlist
── S-07 verificar-specs         exit=0 | Sin specs/: nada que verificar.
── S-09 assignments-audit       exit=1 | No se encontró specs/ASSIGNMENTS.md o specs/AUTHORS.md.
── S-08 assignments-sync        exit=1 | No se encontró specs/ASSIGNMENTS.md o specs/assignments/.
── S-10 set-env                 exit=1 | Configura estas variables en tu CI/CD…
── S-11 node --test lib/*.test.mjs → 79 tests, 79 pass, 0 fail
```

---

## S-02 · `lint-arch-wrapper.js` — memoria de fallos

**Contrato.** Envuelve a `architect.js`: si falla, guarda la salida en
`.claude/temp/arch-last-failure.json`; si pasa y había un fallo previo, escribe la lección
en `LESSONS_LEARNED.md` y borra el JSON.

**¿Puede fallar? · comprobado.** `exit 0` sobre el boilerplate limpio, sin efectos. El
camino de fallo (guardar y luego convertir en lección) no se ejercitó: exigiría romper el
boilerplate a propósito, que es justo lo que hace `S-06`. Deuda menor.

**Hallazgo.** Es el segundo productor de `LESSONS_LEARNED.md`, con formato propio y sin
conocer el esquema de tabla de `failure-tracker.js` — ya registrado como `DUP-002` en
`H-12`. Esta ficha lo confirma desde el otro extremo: son dos escritores independientes de
un archivo que uno de los dos re-parsea en cada uso.

**Veredicto:** cerrada. Sin hallazgos nuevos.

---

## S-03 · `indices-sync.js` — el auto-indexer · **cierra la deuda de `C-04`**

**Contrato.** Escanea el proyecto con el AST de TypeScript y reescribe solo lo que está
entre `<!-- AUTO-GENERATED:BEGIN/END -->`, con caché incremental por `mtime`.

**¿Puede fallar? · comprobado ejecutando** — esto es lo que quedaba pendiente de `C-04`,
donde el contrato de marcadores se había verificado solo por inspección:

```bash
node scripts/indices-sync.js
# 1ª corrida: ✅ 12 índice(s) actualizado(s): COMPONENTS.md, SERVICES.md, FACADES.md…
# 2ª corrida: ✅ Todos los índices están al día. Sin cambios.
```

Y la partición del contrato se sostiene en ejecución:

```
índices con marcadores: 13 → COMPONENTS, DATABASE, DIRECTIVES, FACADES, GUARDS,
                             MODELS, PIPES, ROUTES, SERVICES, STORES, STYLES,
                             USAGE-MAP, UTILS
ANTI-PATTERNS.md → 0 marcadores, intacto
LAYOUTS.md       → 0 marcadores, intacto
```

**El contrato `C-04` queda verificado por ejecución:** los 13 auto-generados se reescriben,
los 2 manuales no se tocan, y la reescritura respeta los marcadores. La deuda registrada en
el bloque 0 está cerrada.

Detalles que sí funcionan: la caché incremental por `mtime` (la 2ª corrida no re-parsea), y
el reporte por índice con conteos reales (`1 tablas, 0 vistas, 1 funciones` en DATABASE;
`6 rutas` en ROUTES; `3 páginas, 5 componentes, 5 directivas` en USAGE-MAP).

**Hallazgo.** Ninguno propio. Con 1.343 líneas y cero tests directos —solo `lib/sql-schema.js`
está cubierto— es la pieza grande peor cubierta del bloque, pero su comportamiento observado
es correcto. Anotado para la Lente 3, no como hallazgo.

**Veredicto:** cerrada. **Cierra la deuda de ejecución de `C-04`.**

---

## S-04 · `check-bento-classes.js` — freno al sprawl

**Contrato.** Compara las clases `.bento-*` de `_bento-grid.scss` contra un allowlist y
falla si aparece una que nadie revisó. Cableado como `ARCH-21` dentro de `architect.js`.

**¿Puede fallar? · comprobado.**

```
✅ check-bento-classes: 31 clases, todas en el allowlist.
```

Sus funciones puras (`extractBentoClasses`, `diffBentoClasses`) tienen test propio
(`lib/bento-classes.test.mjs`, dentro de los 79 que pasan).

**Lo que destaca** es el criterio escrito en el docblock, que es el mejor argumento de
diseño del repo después del de `provocar-reglas`: *«el bento describe FORMAS, no
contenidos. Si el nombre alude a la sección de la app que la usa (`bento-invoices`), casi
siempre se resuelve con una proporción existente o con los data-attributes de placement.»*
Es una regla con criterio de aplicabilidad de verdad — el tipo de cosa que `harness-gate`
dice exigir y no exige (`DEC-002`).

**Hallazgo.** Ninguno. Junto con `bash-guard` y `smoke-scripts`, es de las piezas sanas.

**Veredicto:** cerrada.

---

## S-07 · `verificar-specs.mjs` — enlaces entre specs

**Contrato.** Verifica que las dos puntas de cada referencia entre specs existan. Sin
`specs/`, no hace nada.

**¿Puede fallar? · comprobado.**

```
Sin specs/: nada que verificar.   exit=0
```

El fail-open por ausencia de `specs/` es el mismo criterio que `spec-gate.js` y está
declarado en el docblock: *«igual que el spec-gate, el SDD viene dormido y no molesta a
quien no lo usa»*. Coherente.

**Veredicto:** cerrada. Sin hallazgos.

---

## S-08 y S-09 · `assignments-sync.js` y `assignments-audit.js`

**Contrato.** Regenerar las tablas auto-generadas del tablero de asignaciones, y auditar su
integridad (naming, colisiones de numeración, refs colgantes, filas stale).

**¿Puede fallar? · comprobado — y acá está el hallazgo:**

```
── S-09 assignments-audit   exit=1 | No se encontró specs/ASSIGNMENTS.md o specs/AUTHORS.md.
── S-08 assignments-sync    exit=1 | No se encontró specs/ASSIGNMENTS.md o specs/assignments/.
```

**Los dos salen en 1 sobre un proyecto que simplemente no usa asignaciones.**
`verificar-specs.mjs` —el tercer script de la misma familia SDD— resuelve el mismo caso con
`exit 0` y un mensaje explícito. Tres scripts del mismo subsistema, dos comportamientos.

Es la misma incoherencia de fail mode que `DUP-001` (donde `indices-sync` avisa y
`assignments-sync` lanza), ahora en el nivel del script completo: la capa de asignaciones
es **opcional dentro de un motor SDD que ya es opcional**, y `sdd/SKILL.md` lo dice —*«si
el equipo no la necesita, simplemente no se usa»*. Pero sus dos scripts tratan la ausencia
como error.

**Consecuencia práctica:** cualquier CI que corra los scripts de `package.json` en un
proyecto sin asignaciones se pone rojo por dos comandos que no tenían nada que hacer.

**Veredicto:** `INC-010`.

---

## S-10 · `set-env.js` — credenciales de producción

**Contrato.** Inyecta `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `environment.prod.ts` antes
del build; falla con `exit(1)` si faltan, para no buildear con credenciales vacías.

**¿Puede fallar? · comprobado.**

```
exit=1 | Configura estas variables en tu CI/CD o en un archivo .env antes de hacer build
```

Sin las variables de entorno falla y explica qué falta. **Es exactamente el fail-closed
correcto**: un build de producción con credenciales vacías es un fallo silencioso que se
descubre en producción.

**Veredicto:** cerrada. Sin hallazgos. Es la pieza más pequeña y una de las mejor resueltas.

---

## S-11 · `scripts/lib/*.js` — 13 módulos puros

**Contrato.** Lógica pura (Data In → Data Out) extraída de los scripts para poder testearla
sin filesystem.

**¿Puede fallar? · comprobado.**

```
node --test scripts/lib/*.test.mjs
# tests 79 · pass 79 · fail 0
```

| Módulo | Qué contiene |
|---|---|
| `a11y-guardrails.js` | `ARCH-20` — botones con icono sin nombre accesible |
| `bento-classes` (en `check-bento-classes.js`) | extracción y diff del allowlist |
| `bento-fill-rows.js` | violaciones de fill-screen en grid app-like |
| `class-discipline.js` | ratchets `ARCH-15/16/17/19` |
| `contrast-check.js` | `ARCH-25`, contraste AA |
| `icon-registry.js` | `ICON-01`, iconos sin registrar |
| `nav-integrity.js` | `NAV-01`, destinos huérfanos |
| `provocacion.js` | `FIXTURES` + `auditarProvocacion` |
| `rule-wiring.js` | cableado de reglas |
| `smoke-scripts.js` | `COMPROBACIONES`, `clasificar`, `veredicto` |
| `spec-links.js` | enlaces entre specs |
| `sql-schema.js` | parseo de migraciones → `DATABASE.md` |
| `tailwind-bare-utilities.js` | `ARCH-22`, `ARCH-26` |
| `theme-tokens.js` | `ARCH-11`, `ARCH-18` |

**Es la mejor decisión estructural del bloque.** Extraer la lógica a funciones puras es lo
que permite que 79 tests cubran reglas que de otro modo solo se podrían probar corriendo el
linter entero.

**La ironía que hay que registrar:** varias de estas reglas están **testeadas como función
pura** y a la vez **sin fixture de provocación** (`ARCH-11`, `ARCH-15/16/17/19`, `ARCH-20`,
`ARCH-22`, `ARCH-25`, `ARCH-26`, `NAV-01`, `ICON-01`). Es decir: se comprueba que la función
devuelve lo correcto ante una entrada, pero no que **el linter, corriendo de verdad, la
reporte**. Entre la función pura y la salida del linter hay un cableado que nadie prueba —
que es precisamente el hueco donde vivían `ARCH-24` y `ARCH-26` cuando estaban muertas.

**Veredicto:** cerrada. `HUE-019`.

---

## Hallazgos de estas unidades

| ID | Tipo | Unidad | Una línea |
|---|---|---|---|
| `INC-010` | INC | `S-08`/`S-09` | Los dos scripts de asignaciones salen en 1 en un proyecto que no usa asignaciones, mientras `verificar-specs` resuelve el mismo caso con `exit 0` |
| `HUE-019` | HUE | `S-11` | Reglas con test de función pura pero sin fixture de provocación: nadie comprueba que el linter las reporte de verdad, que es el hueco donde vivían `ARCH-24` y `ARCH-26` |

## Notas para el pase general

- **Deuda de `C-04` cerrada** por `S-03`, ejecutando.
- **Lente 3:** `HUE-019` afina la pregunta de la cobertura. Tres niveles distintos, y hay
  que contarlos por separado: *(1)* la función pura tiene test — 79 pasan; *(2)* el linter
  la cablea y la reporta — sin verificar salvo para 4 reglas; *(3)* la regla puede fallar
  ante su violación — solo esas mismas 4.
- **Lente 2:** `INC-010` y `DUP-001` son el mismo desacuerdo (qué hacer cuando el SDD no
  está activo) en dos niveles. `verificar-specs` tiene el criterio correcto; los dos de
  asignaciones no lo siguieron.
- Piezas sanas del bloque: `S-04`, `S-06`, `S-07`, `S-10`, `S-11`. Piezas con hallazgo:
  `S-01`, `S-05`, `S-08`, `S-09`.
