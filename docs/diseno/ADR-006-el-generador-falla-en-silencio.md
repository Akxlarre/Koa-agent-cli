# ADR-006 · El generador también falla en silencio

**Estado:** implementado — §§1-5 · **Fecha:** 2026-08-30 · **Contexto A** — el único ADR sobre `bin/` y
`lib/` · **Origen:** el pase de cobertura del diseño

---

## Contexto

Los cinco ADR anteriores son casi enteramente Contexto B. `ADR-004` toca `lib/scaffolder.js`
en dos líneas y nada más. **El generador se quedó sin diseño**, y el pase de cobertura lo
encontró: seis hallazgos de `bin/`/`lib/` sin destino.

No fue un descuido de clasificación. Fue consecuencia de creerle a la regla de ponderación
de la auditoría.

### La premisa que hay que corregir

`HALLAZGOS.md` justifica subir un nivel a todo hallazgo del harness así:

> *«El generador falla **ruidoso y una vez**; el harness falla en silencio y replicado en
> cada proyecto generado.»*

La segunda mitad es cierta. **La primera es falsa para la fase de parcheo**, que es donde
vive el trabajo real del scaffolder:

```
lib/scaffolder.js   19 bloques  if (fs.existsSync(...))    ninguno con else
                     2 bloques  catch → chalk.yellow → y sigue
```

Un `if` sin `else` sobre un archivo que `ng new` dejó de emitir no falla: **no hace nada**, y
el proyecto sale distinto de lo que el CLI dice haber generado. Es el mismo modo de fallo que
`DEC-001` y que `HUE-032`, en el lado del repo donde la auditoría asumió que no podía ocurrir.

### Medido

`parseJsonc` (`lib/config.js:120`) borra todo lo que siga a `//`, **también dentro de un
string**. Ejecutado:

| Entrada | Resultado |
|---|---|
| `tsconfig.json` con `"$schema": "https://json.schemastore.org/tsconfig"` | ✗ `Bad control character in string literal` |
| cualquier valor con una URL | ✗ `Unterminated string in JSON` |
| comentario de línea legítimo | ✓ |

Y el llamador (`lib/scaffolder.js:247-263`) atrapa el error, imprime un `⚠` amarillo y
**continúa**:

```
   ⚠ No se pudo parchear tsconfig.json: …
```

El proyecto queda **sin los path aliases `@core/*`, `@shared/*`, `@features/*`, `@layout/*`**
— y el boilerplate que el scaffolder copia acto seguido los importa en todos lados. El
usuario recibe un proyecto que no compila, después de una línea amarilla entre veinte verdes.

`$schema` en `tsconfig.json` no es exótico: es lo que recomienda el propio schemastore, y
basta con que una versión de `ng new` lo agregue.

---

## Decisión

### 1 · `parseJsonc` deja de ser un `replace` y pasa a ser un scanner

Recorrer el texto respetando strings y escapes. Son ~20 líneas y un test con los tres casos
de arriba. **`HUE-020`.**

No es refactor por elegancia: hoy la función es correcta solo para JSON sin URLs, que no es
la clase de archivos que parsea.

### 2 · Los parches declaran qué esperaban encontrar

El patrón actual —`if (existsSync) { parchear }`— confunde *«este parche no aplica a esta
configuración»* con *«el archivo que esperaba no está»*. Son cosas distintas y hoy suenan
igual: silencio.

```js
patch(archivo, { requerido: true },  fn)   // ausente → error, el CLI para
patch(archivo, { requerido: false }, fn)   // ausente → línea informativa, sigue
```

`tsconfig.json`, `angular.json` y `package.json` son **requeridos**: si `ng new` no los
emitió, el generador no tiene nada que generar y debe decirlo antes de copiar 40 archivos
encima. Los de stack opcional (`playwright.config.ts`, e2e, Supabase) siguen siendo
condicionales, pero **impresos**, no mudos.

Y el fallo del parche de `tsconfig` deja de ser un `⚠`: sin path aliases el proyecto no
compila, así que es un error, no un aviso. **`HUE-022`, `HUE-020`.**

### 3 · Un test de integración que corre `ng new`

`HUE-022` en su forma más simple: *«ningún test de integración corre `ng new`»*. Los 19
bloques condicionales son suposiciones sobre la forma de su salida, y ninguna está verificada.

Un test lento —minutos, no segundos— que genere un proyecto real y verifique el contrato del
scaffolder: los cuatro aliases en `tsconfig.json`, el target de test en `angular.json`, los
scripts en `package.json`, `blueprint.json` bien formado. Fuera de la suite rápida, en el
mismo lugar que `lint:arch:provocar` y `smoke:scripts` —los chequeos que el repo ya acepta
que tardan— y con la misma justificación escrita en `docs/CHEQUEOS-QUE-NO-CHEQUEAN.md`.

Se creía que cubría también `HUE-021` (nadie genera una feature y le corre `architect.js`
encima). **No lo cubre**: el test usa `--skip-install` y el linter necesita la API de
TypeScript. `HUE-021` sigue abierto, ahora con el motivo escrito.

### 4 · Re-ponderar, con el motivo escrito

`HUE-020` y `HUE-022` están clasificados `S2` bajo la premisa de que el generador falla
ruidoso. **Pasan a `S1`**: dejan al usuario con un proyecto que no compila, sin un error que
lo diga.

No se toca la regla de ponderación en sí —la mitad *«una vez vs. replicado»* sigue siendo
verdad y sigue justificando el +1 del harness—. Lo que se corrige es su aplicación: **el
silencio no es exclusivo del harness**, y donde el generador también calla, la diferencia
entre los dos contextos se achica.

Es, además, la explicación de por qué el pase general concluyó *«generador 0 `S1`, harness
7»*: la conclusión era correcta según la regla, y la regla estaba mal aplicada.

### 5 · Los cuatro chicos, en el mismo lote

| Hallazgo | Qué |
|---|---|
| `INC-011` | `bin/index.js` tiene 169 líneas contra el techo de ~150 que declara `cli-architecture.md`. O se extrae, o se sube el techo — pero la regla la escribió este repo sobre sí mismo |
| `INC-012` | Los nombres reservados de Windows solo se validan **en** Windows: un proyecto llamado `aux` generado en Linux revienta en la máquina del compañero |
| `INC-013` | La mitigación de `deriveSingular` («el prompt permite corregirlo») no existe en modo no-interactivo |
| `INC-018` | Dos servidores MCP usan `@latest`, incluido `@angular/cli@latest`, que `lib/config.js` prohíbe con tres párrafos |

`INC-018` es el más incómodo: el generador incumple, en su propia configuración MCP, la
regla que le impone al usuario con más énfasis que ninguna otra.

---

## Lo que este ADR NO arregla

**`INC-008`** — `section-hero.component.ts` del boilerplate tiene 1.170 líneas contra el
límite de 200 de `ARCH-09`. Es Contexto B (el payload), no el generador, y es trabajo de
refactor del boilerplate Angular, no de diseño del CLI. Va al backlog con nombre propio:
**el CLI reparte código que su propio linter rechaza**, y `ARCH-09` sí tiene quien la emita,
así que el primer `npm run lint:arch` de cualquier proyecto generado lo señala.

---

## Qué cierra

| Hallazgo | Cómo |
|---|---|
| `HUE-020` (→ **S1**) | ✅ `stripJsonComments` recorre respetando strings — 20 tests |
| `HUE-022` (→ **S1**) | ✅ `patch()` con `requerido` + `npm run test:integracion`, que corre `ng new` de verdad |
| `HUE-021` (S3) | ⚠️ **no**: el test de integración usa `--skip-install`, y `architect.js` necesita la API de TypeScript. Sigue abierto |
| `INC-011`, `INC-012`, `INC-013`, `INC-018` | ✅ Lote, §5 |
| `INC-021` (S3) | 🆕 lo encontró el test de integración al primer intento (ver abajo) |

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| **Convertir avisos en errores rompe generaciones que hoy «funcionan»** | Es el punto: hoy no funcionan, salen sin aliases. Pero por eso `requerido: true` se limita a los tres archivos sin los cuales no hay proyecto, y no a los 19 bloques |
| **Un test que corre `ng new` es lento y depende de la red** | Va fuera de la suite rápida, junto a `lint:arch:provocar`. El repo ya tomó esa decisión una vez y la documentó |
| **Re-ponderar hallazgos a mitad de camino contradice la regla 1 del método** («no cambiar la taxonomía a mitad de la auditoría») | La auditoría está cerrada; esto es la fase de diseño. Y no se cambia la taxonomía ni la regla: se corrige la aplicación de una premisa que resultó falsa, con la medición al lado |


---

## Lo hecho

### §1 · `parseJsonc`

`stripJsonComments()` recorre el texto respetando strings y escapes. Verificado contra
el `tsconfig.json` que emite `ng new` hoy —dos comentarios de bloque con URLs adentro—
y contra los tres casos que rompían. El test cubre además lo inverso: un JSONC inválido
tiene que seguir fallando, porque un parser que «arregla» la entrada tapa errores reales
del archivo.

### §2 · `patch()`

Los tres requeridos paran el CLI; los opcionales imprimen una línea gris en vez de no
decir nada. La prueba de que los tests sirven: bajando `tsconfig.json` a
`requerido: false`, tres de ellos se ponen en rojo.

### §3 · El test de integración — corre, y encontró algo al primer intento

`npm run test:integracion` genera un proyecto Angular real y le corre el scaffolder
encima. Con `--skip-install`: lo que se verifica es la **forma** de los archivos de
configuración, que es lo que los parches suponen, no que compile. Baja de minutos a
segundos y sigue cubriendo el caso que importa —que Angular cambie esa forma—.

> **Ampliado al cerrar `HUE-021`.** El test corre además `architect.js` dentro del
> proyecto generado. Eso parecía exigir el `npm install` que este test evita, y no:
> exige **un paquete**. Se instala el `typescript` que el propio `package.json` declara
> —no uno fijado en el test, para que el día que Angular mueva su rango a una versión
> que rompa el linter esto lo diga— y con eso corren el linter, sus 141 tests de
> guardrails y las 28 provocaciones, sobre la salida real del generador.

En su primera corrida falló, y el que estaba mal era **el test**: esperaba que
`blueprint.json` llevara el nombre del proyecto. No: `name` identifica al *blueprint*
(`koa-agent-blueprint`), es constante a propósito y así está documentado. Corregido el
test, quedó a la vista lo que sí es un hallazgo — **`INC-021`**: `writeBlueprintJson`
acepta un parámetro `projectName` que **no usa**. Una firma que promete algo que la
función ignora es la clase de cosa que hace escribir un test equivocado.

### §5 · El lote

| Hallazgo | Qué se hizo |
|---|---|
| `INC-011` | Los prompts salieron a `lib/prompts.js`: 169 → **122** líneas. Y el techo tiene test, que además comprueba que el número del test sea el que declara la regla |
| `INC-012` | Los nombres reservados de Windows se validan siempre. El nombre viaja con el repo; la plataforma de quien lo generó, no |
| `INC-013` | `--singular <Nombre>`, y cuando no se pasa se imprime lo que se derivó. El docblock dejó de prometer una corrección que en modo no-interactivo no existía |
| `INC-018` | `@angular/cli@{{ANGULAR_MAJOR}}`, sustituido por el scaffolder. Sale de la misma constante que usa `ng new`, así que no puede divergir |

`INC-011` obligó a algo que vale la pena anotar: extraer a `lib/prompts.js` cambia la
tabla de módulos de `cli-architecture.md` y de `indices/CLI-MODULES.md`. La regla que
obliga a sincronizar índices es de este repo sobre sí mismo, igual que el techo de
líneas — y las dos veces se cumplió recién cuando hubo un test.
