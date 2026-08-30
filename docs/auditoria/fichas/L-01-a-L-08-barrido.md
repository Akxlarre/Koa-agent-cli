# NIVEL C — L-01 a L-08 · Barrido de la superficie declarativa

> Ocho lotes, sin ficha individual: es superficie donde el riesgo es **deriva**, no
> comportamiento. Todo lo de abajo salió de barridos automatizados sobre los ocho a la vez
> —cada número, cada ruta y cada comando contra el código— más tres ejecuciones en sandbox.

| | |
|---|---|
| **Contexto** B · **Nivel** C · **Revisado** 2026-08-29 · **Estado** cerrado |

---

## L-01 · Los 15 índices ✓

Los dos manuales vienen con contenido real, como promete `TEMPLATES-REGISTRY.md`:

```
LAYOUTS.md        15.377 chars   ← skeletons de arquetipos de página
ANTI-PATTERNS.md   7.255 chars   ← los 12 anti-patrones
COMPONENTS.md      7.258 chars   ← Quick Reference + AUTO-GENERATED vacío
STYLES.md          8.321 chars
```

Los 13 auto-generados traen su Quick Reference curada y los marcadores vacíos, listos para
el primer `indices:sync`. **La partición 13/2 se sostiene** (verificada ejecutando en
`S-03`).

**Sin hallazgos.** Es el lote más sano del nivel C.

---

## L-02 · Los 5 archivos de `context/` — el hallazgo del nivel

Tanto `session-start.js` como `compact-recovery.js` filtran las plantillas sin llenar con
el mismo umbral:

```js
const stripped = raw.replace(/<!--[\s\S]*?-->/g, '').trim();
if (stripped.length < 80) continue;   // saltar plantillas
```

El comentario de `compact-recovery.js` explica la intención: *«las plantillas de `context/`
son casi enteramente `<!-- instrucciones -->`, así que sin contenido real el resultado queda
por debajo del umbral»*.

**Medido sobre las plantillas reales del template:**

```
brief.md         456 chars útiles  → SE inyecta
constraints.md   327 chars útiles  → SE inyecta
domain.md        760 chars útiles  → SE inyecta
learnings.md     457 chars útiles  → SE inyecta
```

**Ninguna queda por debajo de 80.** Las plantillas no son «casi enteramente comentarios»:
tienen encabezados, blockquotes de instrucción y esqueletos de tabla **fuera** de los
comentarios HTML. El filtro no filtra.

**Comprobado ejecutando**, en un proyecto sin nada de contexto llenado:

```
SessionStart  → 3.991 chars inyectados, incluido context/brief.md sin llenar
PostCompact   → 12.964 chars, con los CUATRO archivos de context/ enteros
```

**~3.240 tokens en cada compactación de un proyecto que no ha escrito una sola línea de
contexto.** Y `compact-recovery` no tiene tope de tamaño (`HUE-017`), así que los inyecta
completos.

Es a la vez `CAR` y `DEC`: cuesta contexto sin aportar nada, y el guard que debería
evitarlo no puede fallar en la dirección correcta. → `DEC-006`

*(Nota de método: en mi sandbox `context/domain.md` mostraba `{{PROJECT_NAME}}` sin
sustituir porque copié los templates crudos sin correr el scaffolder. En un proyecto real
`copyTemplates` sí inyecta las variables en `context/*.md`. Eso no afecta al hallazgo: el
conteo de caracteres es el mismo.)*

---

## L-03 · `.mcp.json` — tres servidores

```
typescript   ✓ sin @latest    npx -y ts-lsp-mcp
angular      ⚠ @latest        npx -y @angular/cli@latest mcp
supabase     ⚠ @latest        npx -y @supabase/mcp-server-supabase@latest --read-only …
```

**Lo correcto:** los comentarios de mínimo privilegio del servidor de Supabase son
ejemplares — explican qué hace `--read-only`, qué pasa sin `--project-ref` («el token
alcanza TODOS tus proyectos, producción incluida»), por qué el token va por variable de
entorno, y cierran diciendo que las escrituras van por migraciones que corre un humano. Es
la mejor documentación de seguridad del repositorio.

**Lo que falta:** dos de los tres usan `@latest`. Y `@angular/cli@latest` es exactamente lo
que `lib/config.js` prohíbe para el scaffold, con tres párrafos explicando por qué:

> *«PINEADO A PROPÓSITO — no usar `@angular/cli@latest`. El ecosistema tarda semanas o
> meses en declarar soporte para un major nuevo.»*

**Tercer lugar donde la misma lección no se aplicó**, después de `HUE-018`
(`require('typescript')` sin guarda). → `INC-018`

---

## L-04 · Adapters + `AGENTS.md`

```
github/copilot-instructions.md      925 chars    hooks:0  guardrails:0
cursor/rules/architecture.mdc     1.886 chars    hooks:0  guardrails:0
cursor/rules/workflow.mdc         1.486 chars    hooks:0  guardrails:0
windsurf/rules/project.md         2.046 chars    hooks:0  guardrails:0
```

**Ninguno menciona hooks ni guardrails, y es correcto**: Cursor, Windsurf y Copilot no
ejecutan los hooks de Claude Code.

**Pero eso significa que en esos editores la tesis del producto no aplica.** Todo el harness
existe para convertir guidelines en guardrails; en los adapters solo viajan las guidelines.
Un usuario que scaffoldea con `--with-cursor` recibe cuatro archivos de reglas y **cero
mecanismos**, y nada se lo dice. → `HUE-029`

---

## L-05 · `templates/docs/` — dos derivas

**1. El conteo de reglas del linter.**

```
CLAUDE-USER-GUIDE.md:54 → "El linter arquitectonico (v2.0) valida 8 reglas via AST"
architect.js            →  28 reglas registradas en RULES
```

Es la deriva numérica más grande de la auditoría: la guía de usuario describe un linter con
menos de un tercio de las reglas que tiene. → `INC-019`

**2. `AGENTS.md` omite cinco índices — y son exactamente los mismos cinco.**

```
AGENTS.md omite:          GUARDS, LAYOUTS, ROUTES, USAGE-MAP, UTILS
compact-recovery omite:   GUARDS, LAYOUTS, ROUTES, USAGE-MAP, UTILS
¿los mismos cinco?        SÍ — mismo conjunto exacto
```

Esto convierte `HUE-003` (que parecía un mapa desactualizado en un hook) en **algo
estructural**: agregar un índice nuevo obliga a actualizar al menos dos consumidores
independientes —el hook de recuperación y el documento maestro para otros AI tools— y
**nada lo verifica**. Los cinco se agregaron después y los dos consumidores quedaron atrás,
en silencio y por separado. → `HUE-030`

`AGENTS.md` se describe a sí mismo como *«Master universal self-contained»*, y hoy cubre
diez de quince.

---

## L-06 · El boilerplate Angular

Ejecutado contra su propio linter, con `typescript@5.9` (ver `S-01`):

```
✅ Auditoría completada: 0 errores, 2 advertencias.
   ARCH-09  section-hero.component.ts  1.170 líneas (límite 200)
   ARCH-09  tabs.component.ts            298 líneas
```

**Cero errores** es un buen resultado: el código que se reparte pasa las 28 reglas salvo el
umbral de tamaño. Las dos advertencias ya están registradas como `INC-008`.

Y tras `indices:sync`, los 13 índices auto-generados quedan «al día» contra el boilerplate
real, con conteos correctos (`6 rutas`, `3 páginas, 5 componentes, 5 directivas`,
`1 tabla, 1 función`). **La correspondencia código ↔ índices se sostiene.**

---

## L-07 · `templates/supabase/` ✓

Las dos migraciones iniciales (`profiles` + RLS de protección de roles) **pasan los tres
chequeos `SEC-RLS` del propio linter**: la corrida sobre el sandbox no emitió ninguna
violación.

Es notable porque `SEC-RLS-01/02/03` son las tres reglas que `provocar-reglas.mjs` **no
puede comprobar** (`DEC-004`, `INC-009`). Que el contenido las cumpla no dice nada sobre si
las reglas pueden fallar — son dos preguntas distintas, y esta ficha solo responde la
primera.

**Sin hallazgos.**

---

## L-08 · Configuración suelta — la causa raíz de `DEC-003`

```
.claude/hooks/package.json              → "commonjs"
.claude/hooks/validators/package.json   → "commonjs"
.claude/tests/package.json              → "commonjs"
boilerplate/scripts/package.json        → "module"
.claude/scripts/package.json            → ✘ NO EXISTE
```

**Cuatro carpetas de código declaran su tipo de módulo. La quinta no.** Y es justo la que
contiene `post-edit.js`, que usa `import` — de ahí `DEC-003` (no carga en Node 20).

El `package.json` de `scripts/` incluso documenta por qué se declara con alcance de carpeta:
*«sin esta declaración Node los reparsea con un warning en cada corrida. Se declara acá,
con alcance de carpeta, en vez de en el package.json raíz, para no cambiar el tipo de
módulo del proyecto Angular»*.

**La solución a `DEC-003` es un archivo de tres líneas, y el patrón ya está aplicado cuatro
veces en el mismo payload.** Esto no agrega un hallazgo nuevo — cierra la causa raíz de uno
existente.

---

## Hallazgos de este nivel

| ID | Tipo | Lote | Una línea |
|---|---|---|---|
| `DEC-006` | DEC | `L-02` | El umbral de 80 chars que debería saltar las plantillas de `context/` no las salta: las cuatro tienen 327-760 chars fuera de los comentarios, y se inyectan enteras (~3.240 tokens por compactación en un proyecto sin contexto llenado) |
| `HUE-030` | HUE | `L-05` | `AGENTS.md` y `compact-recovery.js` omiten **exactamente los mismos cinco índices**: agregar uno obliga a actualizar consumidores independientes y nada lo verifica |
| `INC-019` | INC | `L-05` | `CLAUDE-USER-GUIDE.md` dice que el linter valida 8 reglas; son 28 |
| `INC-018` | INC | `L-03` | Dos de los tres servidores MCP usan `@latest`, incluido `@angular/cli@latest`, que es exactamente lo que `lib/config.js` prohíbe con tres párrafos de justificación |
| `HUE-029` | HUE | `L-04` | Los adapters de Cursor/Windsurf/Copilot no llevan ningún mecanismo —correcto, esos editores no ejecutan los hooks— pero nada le dice al usuario que ahí las reglas son solo prosa |

## Notas para el pase general

- **`HUE-030` reencuadra `HUE-003`.** Los mismos cinco índices faltan en dos consumidores
  que nadie relacionó. Es el ejemplo más limpio de por qué la **Lente 1** existe: ninguna
  ficha individual podía verlo.
- **`INC-018` es el tercer caso de la misma lección no aplicada** (`ANGULAR_MAJOR` pineado
  → `require('typescript')` sin guarda → `@latest` en el MCP). Con `INC-017`, `DEC-004`,
  `HUE-028` y `CAR-003`, ya son **siete instancias** del patrón «la lección está escrita en
  la casa y no se aplicó al lado». Es la conclusión que va a encabezar el pase general.
- **`L-08` cierra la causa raíz de `DEC-003`**: falta un `package.json` de tres líneas en
  `.claude/scripts/`, y el patrón está aplicado cuatro veces en el mismo payload.
- **Lente 4:** `DEC-006` suma al presupuesto. En un proyecto recién generado, cada
  compactación inyecta ~3.240 tokens de plantillas vacías, encima de los índices.
