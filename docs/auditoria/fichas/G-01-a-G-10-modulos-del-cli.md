# FICHA A — G-01 a G-10 · Los módulos del CLI

> Diez unidades en una ficha. **Es el primer bloque del contexto A**, y eso cambia la
> ponderación: el generador falla ruidoso y una vez, así que la misma clase de defecto pesa
> un nivel menos que en el harness. Cada módulo conserva su veredicto propio; los dos con
> superficie real (`G-02` y `G-06`) llevan los ocho campos.

| | |
|---|---|
| **Contexto** A (generador) · **Bloque** 3 · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## Lo primero: las fronteras se respetan

`.claude/rules/cli-architecture.md` declara cuatro prohibiciones. Las cuatro se cumplen:

```
scaffolder → ¿npm/spawn?      1 hit  → es el docblock: "Sin operaciones npm/spawn"
installer  → ¿copia archivos?  0 hits
ui         → ¿FS o spawn?      1 hit  → es el docblock: "Sin operaciones de filesystem"
preflight  → ¿instala algo?    0 hits
```

Los únicos «hits» son comentarios que dicen que no lo hacen. **La separación de
responsabilidades del CLI es real, no aspiracional** — algo que no se puede decir de todas
las reglas del repo (`DEC-002`).

---

## G-01 · `bin/index.js` — el orquestador

**Contrato.** Solo entry point: flags, prompts, orquestación. Sin lógica de negocio.

**¿Coincide con su documentación?** En el rol sí. En el tamaño no: la regla declara un
techo —*«si supera ~150 líneas, extraer a lib/»*— y el archivo tiene **169**.

```
wc -l bin/index.js → 169 líneas — ✘ EXCEDE el techo de la regla
```

**Qué hay de más.** Las líneas extra no son lógica de negocio colada: son el manejo del
directorio temporal (crear, renombrar, limpiar en tres `catch` distintos) y el bloque de
mensajes del modo parcial. El espíritu de la regla se respeta; la letra no.

**Veredicto:** `INC-011`. Es el caso más claro de la auditoría de una regla que el propio
repo escribió y no cumple — y de las tres «reglas» del CLI (techo de líneas, fronteras,
ESM), es la única que ningún mecanismo verifica.

---

## G-02 · `lib/config.js` — stack, validación y constantes

**Contrato.** Resolver el stack, validar el nombre de proyecto, validar `blueprint.json`,
exportar las constantes globales.

### ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:** ejercitar `parseJsonc` con las entradas que un
`tsconfig.json` real puede traer.

```js
parseJsonc('{"url": "https://supabase.co", "ok": true}')
parseJsonc('{"a":"x // y","b":1}')
parseJsonc('{ // comentario\n "a":1 /* bloque */ }')
```

**Qué pasó:**

```
{"url": "https://supabase.co", …}  → ✘ Unterminated string in JSON at position 15
{"a":"x // y","b":1}               → ✘ Unterminated string in JSON at position 8
{ // comentario  "a":1 /* … */ }   → ✓ {"a":1}
```

**`parseJsonc` no distingue un comentario de un `//` dentro de un string.** Su
implementación son dos `replace` sobre el texto crudo:

```js
.replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
.replace(/\/\/.*$/gm, '');           // line comments
```

La segunda línea se come todo lo que siga a `//` — incluido el resto de una URL y la
comilla que cierra el string.

**Y el impacto llega hasta el proyecto del usuario.** `scaffolder.js` usa `parseJsonc` para
parchear `tsconfig.json`. Con un `$schema` —cada vez más habitual— el parcheo se salta:

```
⚠ No se pudo parchear tsconfig.json: Bad control character in string literal…
── ¿quedaron los path aliases? → 0
   ✘ SIN aliases: todo import @core/* del boilerplate no compila
```

El proyecto se genera **sin `@core/*`, `@shared/*`, `@features/*`, `@layout/*`**, y el
boilerplate entero deja de compilar. El aviso es una línea amarilla en medio de la salida
del scaffold; el error real aparece mucho después, al buildear, y no menciona `tsconfig`.

Hoy el `tsconfig.json` de Angular 21 no trae `$schema` como valor de string —sus URLs están
dentro de comentarios de bloque, que se eliminan primero—, así que **no es un fallo activo**.
Es un parser incorrecto en un lugar donde una convención cada vez más común lo dispara.

**Otros dos ejercicios:**

- `validateProjectName` — sólido: rechaza vacío, >214, mayúsculas, guiones dobles y nombres
  reservados de Windows. La comprobación de reservados solo corre **si la plataforma es
  win32**, lo cual es deliberado pero significa que un nombre creado en Linux (`con`,
  `aux`) rompe el repositorio al clonarlo en Windows. Registro menor.
- `validateBlueprintJson` — correcto y bien argumentado. Es la única validación de schema
  del repo, y el problema no es ella sino **dónde corre**: solo en `preflight()`, nunca en
  el proyecto generado (`HUE-005`).

**Veredicto:** `HUE-020` (parseJsonc), `INC-012` (reservados de Windows).

---

## G-03 · `lib/runner.js` — el wrapper de spawn

**Contrato.** Ejecutar comandos externos, con soporte Windows.

**Lo que destaca** es el docblock: declara `SEC-02`, explica por qué `shell: true` es
necesario en Windows (ejecutar `.cmd`), reconoce el riesgo de inyección que abre, y
documenta la mitigación —*«TODOS los callers usan args estáticos o validados por
`validateProjectName()`»*— con la instrucción explícita: *«NUNCA pasar input de usuario sin
validar como elemento de args[]»*.

**Comprobé la mitigación:** los callers son `createAngularProject` (posicional validado por
`validateProjectName`, regex `^[a-z][a-z0-9-]*$`) e `installDependencies` (nombres de
paquete literales). La afirmación del docblock es cierta.

**Contraste que vale registrar:** este módulo razona su superficie de shell y la acota.
`post-edit.js` (`SEC-001`) interpola una ruta arbitraria en una cadena de shell sin ninguna
consideración. Mismo repositorio, dos criterios opuestos sobre el mismo riesgo.

**Veredicto:** cerrada, sin hallazgos. Pieza sana.

---

## G-04 · `lib/preflight.js` — checks de sistema

**Contrato.** Verificar Node/npm/npx (fatales) y git/docker (warnings). No instalar nada.

**Lo correcto:** la gradación fatal/warning está bien elegida (sin npm no hay scaffold; sin
docker sí), `checkCommand` soporta timeout —usado en `docker info`, que es el que puede
colgarse—, y no instala nada.

**Veredicto:** cerrada, sin hallazgos propios. Es el único lugar donde corre
`validateBlueprintJson`, lo que es el origen de `HUE-005`.

---

## G-05 · `lib/installer.js` — npm y npx

**Contrato.** `ng new`, instalar dependencias condicionales, `supabase init`.

**Lo que destaca:** tres decisiones difíciles, las tres con su porqué escrito:

- **`ANGULAR_MAJOR` pineado**, con un comentario que explica el modo de fallo completo
  («el día que Angular publica un major TODOS los scaffolds fallan con ERESOLVE»).
- **`@angular/animations` alineado** al major que instaló `ng new`, leyendo el
  `package.json` recién creado en vez de confiar en `latest`.
- **GSAP siempre instalado** aunque tenga flag, porque el boilerplate depende de él de
  forma dura y sin él el proyecto no compila.

Las tres son lecciones de producción escritas donde se aplican. **Es el módulo mejor
documentado del CLI** — y el contraste con `HUE-018` (`require('typescript')` sin ninguna
guarda) es directo: la misma clase de riesgo, tratada con cuidado acá y ignorada allá.

**Veredicto:** cerrada, sin hallazgos.

---

## G-06 · `lib/scaffolder.js` — el filesystem

**Contrato.** Copiar templates respetando lo que ya existe, parchear configs, mergear el
blueprint.

### ¿Puede fallar? · CAMPO OBLIGATORIO

**Comprobado ejecutando** — `test/scaffolder.test.mjs` corre con `node_modules` instalado:

```
npm test → # pass 22 · # fail 0   (17 tests de scaffolder + 5 de templates-sql)
```

Esto **cierra la deuda registrada en `C-05`**: el fallo anterior (`ERR_MODULE_NOT_FOUND:
chalk`) era del entorno, no del código.

Y el parcheo de `tsconfig` se ejercitó de verdad al probar `G-02`: funciona con un
`tsconfig` normal y se salta con uno que lleve `$schema`.

**Las tres decisiones que sostienen el módulo, todas correctas:**

| Decisión | Por qué importa |
|---|---|
| `lstatSync` y no `statSync` | Detecta symlinks sin seguirlos; los salta con warning. Anotado `SEC-01`. Es defensa contra path traversal en la cadena de suministro |
| `CLI_OWNED` + `preserveExisting` | El harness se sobrescribe, el contenido del proyecto se preserva. Lo que ya existe gana |
| `managedPaths` derivado de `CLI_OWNED` | Lo declarado y lo ejecutado no pueden divergir — es la solución que le falta a media docena de contratos del harness |

**Veredicto:** cerrada. Sin hallazgos propios; los dos que lo tocan (`HUE-020` vía
`parseJsonc`, `HUE-005` vía blueprint) viven en `G-02` y `C-05`.

---

## G-07 · `lib/generator.js` — `generate feature`

**Contrato.** Generar un vertical slice de 5-7 archivos, sin sobrescribir.

**Lo correcto:** verifica **todos** los conflictos antes de escribir nada — o escribe los
siete archivos o no escribe ninguno. Y los próximos pasos que imprime incluyen la ruta lazy
exacta para `app.routes.ts`, que es el paso que un usuario olvidaría.

### ¿Puede fallar? · comprobado

`deriveSingular` es una heurística de una línea (`quitar la 's' final`). Ejercitada:

```
productos      → Producto      ✓        categories → Categorie   ✘
usuarios       → Usuario       ✓        paises     → Paise       ✘
notifications  → Notification  ✓        analisis   → Analisi     ✘
clientes       → Cliente       ✓        stock      → Stock       ✓ (por casualidad)
```

El docblock **admite** la imperfección: *«categories → categorie (imperfecto — el prompt
permite corregirlo)»*. Y ahí está el hueco: **el prompt solo existe en modo interactivo.**
En modo no-interactivo —`npx create-koa-agent generate feature categories`— el valor
derivado se usa directo:

```js
if (domain) {                                  // no-interactivo
    singularPascal = toPascalCase(deriveSingular(domain));   // sin confirmación
}
```

`CategorieRow`, `CategoriesFacade`, `CategorieCardComponent` quedan grabados en 7 archivos
sin que nadie pueda corregirlo. La mitigación que el comentario cita no cubre la mitad de
los casos de uso.

**Veredicto:** `INC-013`.

---

## G-08 · `lib/feature-templates.js` — las 11 plantillas

**Contrato.** Strings con `{{domain}}`, `{{Domain}}`, `{{Domains}}`. Sin lógica.

**Comprobado:** 780 líneas, ninguna función, ningún import. El contrato de «solo strings»
se cumple literalmente.

**Lo que sí merece nota:** los templates generan código que el propio harness va a
auditar — `BaseFacade`, `OnPush`, repository separado, spec compañero. Es decir, el
generador produce código que pasa `ARCH-01`, `ARCH-02`, `ARCH-03` y `ARCH-04` por
construcción. **Nadie lo verifica**: no hay ningún test que genere una feature y le corra
`architect.js` encima.

**Veredicto:** `HUE-021`.

---

## G-09 · `lib/ui.js` — banner y próximos pasos

**Contrato.** Solo chalk. Sin FS, sin spawn.

**Comprobado:** cumple. Los próximos pasos que imprime son correctos y ordenados, e incluyen
la configuración del MCP de Supabase con el detalle de mínimo privilegio (`--read-only`,
`--project-ref`, token por env var).

**Veredicto:** cerrada, sin hallazgos.

---

## G-10 · Los nueve parches de `injectBoilerplate()`

**Contrato.** Dejar el proyecto de `ng new` listo para el boilerplate.

**El riesgo estructural del bloque:** cada parche asume una forma concreta del output de
`ng new`, y esa forma cambia con cada major de Angular. El parche 1 lo demuestra —existe
porque Angular 21 cambió el root de `app.component.ts` a `app.ts`— y su comentario explica
que sin él *«la app arrancaría mostrando la demo de Angular con las rutas del proyecto
renderizadas debajo»*.

**Qué pasa cuando la forma cambia otra vez:** todos los parches son condicionales
(`if (fs.existsSync(...))`, `if (!indexHtml.includes(...))`). Un parche cuyo objetivo cambió
de nombre **no falla: no hace nada**. El scaffold termina en verde y el proyecto sale roto
de una manera distinta cada vez.

Los dos parches con más riesgo latente:

- **Parche 1** — depende de los nombres `app.ts`/`app.html` y de dos regex sobre `main.ts`
  (`import { App } from './app/app'` y `bootstrapApplication(App,`). Si Angular renombra o
  reformatea, el reemplazo no matchea y `main.ts` sigue apuntando al root borrado.
- **Parche 3** — `angular.json` se navega por `Object.keys(angularJson.projects)[0]` y por
  la ruta `architect.build.options`. Cualquier cambio de esquema tira una excepción o
  parchea el proyecto equivocado en un workspace multi-proyecto.

**Nada de esto está cubierto por un test de integración**: no hay ninguno que corra
`ng new` de verdad y verifique el resultado. Los 17 tests de `scaffolder.test.mjs` prueban
las funciones contra fixtures, no contra un proyecto Angular real.

**Veredicto:** `HUE-022`.

---

## Hallazgos de estas unidades

| ID | Tipo | Unidad | Una línea |
|---|---|---|---|
| `HUE-020` | HUE | `G-02` | `parseJsonc` se come todo lo que siga a `//` dentro de un string: un `tsconfig.json` con `$schema` deja el proyecto sin path aliases y sin compilar |
| `HUE-022` | HUE | `G-10` | Los 9 parches son condicionales: si `ng new` cambia de forma no fallan, no hacen nada. Ningún test de integración corre `ng new` de verdad |
| `HUE-021` | HUE | `G-08` | Ningún test genera una feature y le corre `architect.js` encima: nadie verifica que el generador produzca código que pase las reglas |
| `INC-011` | INC | `G-01` | `bin/index.js` tiene 169 líneas contra el techo de ~150 que declara `cli-architecture.md` |
| `INC-013` | INC | `G-07` | La mitigación de `deriveSingular` («el prompt permite corregirlo») no existe en modo no-interactivo |
| `INC-012` | INC | `G-02` | Los nombres reservados de Windows solo se validan **en** Windows: un proyecto llamado `con` creado en Linux rompe al clonarse |

## Notas para el pase general

- **Deuda de `C-05` cerrada:** `test/scaffolder.test.mjs` corre y pasa con `node_modules`
  instalado. El fallo anterior era del entorno.
- **Lente 3 — el contexto A tiene el mismo problema que el B, en menor escala:** 6 de 8
  módulos de `lib/` sin ninguna cobertura (`runner`, `preflight`, `installer`, `generator`,
  `feature-templates`, `ui`). Y las dos superficies de mayor riesgo del generador —los 9
  parches y la generación de features— no tienen test de integración.
- **Lente 2 — dos criterios opuestos sobre el mismo riesgo.** `runner.js` documenta su
  superficie de shell, explica la mitigación y prohíbe explícitamente pasar input sin
  validar. `post-edit.js` interpola una ruta arbitraria en un `execSync` (`SEC-001`). La
  lección existe escrita en el repo, en el módulo de al lado.
- **Lente 2 — la misma clase de riesgo, dos tratamientos.** `installer.js` pinea Angular
  con tres párrafos de justificación; `architect.js` hace `require('typescript')` sin
  guarda (`HUE-018`).
- **El generador está mejor construido que el harness.** Fronteras respetadas, decisiones
  difíciles documentadas donde se aplican, y un solo hallazgo con impacto real
  (`HUE-020`). La distancia entre las dos mitades del repo es el hallazgo estructural de
  este bloque.
