# FICHA B — K-01 a K-15 · Las skills

| | |
|---|---|
| **Archivos** | `templates/.claude/skills/*/SKILL.md` · **Tipo** skill · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Qué dicen

Quince skills en tres modos de invocación: cinco path-scoped que se activan solas al tocar
un archivo, seis user-invocables que el humano escribe, tres híbridas, y una
(`writing-great-skills`) con `disable-model-invocation: true`.

## 2. Disparo

**El dato de costo, medido:**

```
14 skills model-invocables · 4.842 caracteres (~1.210 tokens) de description
                             presentes en CADA turno, se usen o no
```

Solo `writing-great-skills` se excluye con `disable-model-invocation: true` — y es
justamente la que menos falta hace en la ventana, porque es material de referencia para
escribir skills, no para usarlas.

**Solape por `paths:`** — al editar `src/app/features/x.component.ts` se activan **cinco
skills a la vez**: `angular-component`, `angular-signals`, `angular-forms`,
`angular-primeng` y `design-system`. Las cinco declaran globs que cubren
`src/app/**/*.component.ts`.

**¿Se disparan cuando deben?** Los globs son correctos pero deliberadamente anchos.
`angular-forms` se activa en **todo** componente, no solo en los que tienen formulario;
`angular-primeng` en todos, no solo en los que usan `p-*`. La discriminación fina queda
librada al criterio del agente, que es lo razonable para una skill — pero significa que la
activación por `paths:` es una señal débil.

**El caso bien resuelto:** `verify` declara su lista completa de tools de Playwright MCP en
el frontmatter, así que la skill no puede hacer más de lo que su contrato dice. Es la única
que acota capacidades, y sigue el mismo criterio que `code-judge` sin `Bash` (`A-05`).

## 3. ¿Es verdad hoy?

Barrido automatizado sobre las 15:

- [ ] Comandos `npm run` mencionados → **dos no existen**
- [ ] Rutas mencionadas → **una rota**
- [x] Números → sin discrepancias

**Los dos comandos inexistentes:**

```
npm run assignments:sync    ← citado por sdd/SKILL.md
npm run assignments:audit   ← citado por sdd/SKILL.md
```

Los archivos **sí existen** (`scripts/assignments-sync.js`, `scripts/assignments-audit.js`),
pero `lib/scaffolder.js` **nunca los escribe en `package.json`**: `grep -c "assignments"
lib/scaffolder.js` → **0**. De los 28 scripts que el scaffolder añade, ninguno es de
asignaciones.

`sdd/SKILL.md` documenta la capa de asignaciones como parte del producto —con su tablero,
su numeración por autor y su ratchet— e instruye correr dos comandos que en un proyecto
generado no existen. El agente que los ejecute recibe `npm ERR! Missing script`.
→ `INC-015`

**La ruta rota:** `supabase/seed.sql`, citada por `verify/SKILL.md`, no se entrega en el
payload. Es plausible que sea intencional (el usuario lo crea), pero la skill lo referencia
como si estuviera.

## 4. Colisiones

**La colisión estructural del grupo**, y es un `DUP` real:

| Pieza | Qué hace | Tipo |
|---|---|---|
| `/sync-indices` (`K-04`) | Skill que actualiza los índices | prosa |
| `index-syncer` (`A-03`) | Subagente que reconcilia los índices | prompt + tools |
| `indices-sync.js` (`S-03`) | Script AST que regenera los índices | código |

**Tres piezas para el mismo trabajo, en tres capas distintas.** El subagente corre el
script; la skill describe el procedimiento a mano. `.claude/CLAUDE.md` recomienda el
subagente en el paso 5 del flujo, pero la skill sigue existiendo y es user-invocable.

No es necesariamente un error —una es automatización, la otra es curación manual de lo que
el AST no ve— pero **nada dice cuál usar cuándo**, y eso es exactamente la definición de
autoridad duplicada. → `DUP-003`

**Las otras colisiones son benignas:** las cinco skills de Angular se activan juntas pero
cubren capas distintas del mismo archivo (estructura, estado, formularios, componentes de
librería, tokens visuales) y no se contradicen. `form-ux` y `angular-forms` se reparten
explícitamente el terreno —la primera declara *«este skill define la capa visual; para la
lógica de validación usa `angular-forms`»*— que es cómo debería resolverse un solape.

## 5. Mecanismo

| Skill | Mecanismo que la respalda |
|---|---|
| `/plan` | **`validate-file-contains.js` en su propio frontmatter** — si falta una sección, la sesión no termina |
| `/review` | Invoca a `code-judge`, que tiene rúbrica y grants acotados |
| `verify` | Playwright MCP con tools declarados |
| `sdd` | Los tres hooks de `sdd/` |
| Las otras 11 | **Ninguno** |

`/plan` es el único caso del repositorio donde una skill declara su propio guardrail en el
frontmatter, y su docblock explica por qué: *«pedirle a un agente en prosa que "genera un
archivo con estas secciones" es una guideline, y las guidelines se ignoran bajo presión de
contexto»*. **El patrón está inventado, funciona (`H-19`), y se usa una sola vez.**

Es capacidad instalada sin explotar: `sync-indices` podría validar que los índices que dice
haber actualizado tengan `mtime` nuevo; `harness-feedback` podría exigir sus secciones.
→ `HUE-028`

## 6. Costo / beneficio

- **Cuándo se cargan:** las 14 descriptions, **en cada turno**. El cuerpo, solo al
  invocarse o al matchear.
- **Cuánto pesan:** ~1.210 tokens permanentes. Es un costo modesto y bien invertido: las
  descriptions son lo que permite que una skill se dispare sola.
- **¿Alguien las lee?** Las path-scoped sí. De las user-invocables, `/plan` y `/review`
  están en el flujo de 5 pasos de `.claude/CLAUDE.md`; `grill_me` y `harness-feedback`
  dependen de que el humano se acuerde.

**Veredicto:** vale la pena. **Es la única capa del harness donde no encontré ningún
problema de costo.** El contraste con `CAR-001` y `CAR-003` es claro: las skills pagan
~1.210 tokens fijos y bien empleados, mientras `plan-injector` paga 6.155 por edición sin
control alguno.

Una nota de calidad: `writing-great-skills` es el mejor documento del payload sobre cómo se
escribe una skill —distingue **context load** de **cognitive load**, explica el trade-off
de `disable-model-invocation`— y **las 14 skills restantes no lo siguen del todo**: ninguna
declara por qué eligió su modo de invocación. La guía existe y no se aplicó hacia adentro.

---

## Hallazgos de estas unidades

| ID | Tipo | Una línea |
|---|---|---|
| `INC-015` | INC | `sdd/SKILL.md` instruye correr `npm run assignments:sync` y `assignments:audit`; el scaffolder nunca los escribe en `package.json` |
| `DUP-003` | DUP | `/sync-indices`, `index-syncer` e `indices-sync.js` hacen el mismo trabajo en tres capas y nada dice cuál usar cuándo |
| `HUE-028` | HUE | El patrón de «skill con guardrail en su frontmatter» funciona y se usa una sola vez, en `/plan` |

## Notas para el pase general

- **Lente 2:** `DUP-003` es el segundo caso de autoridad triplicada, después de las tres
  definiciones de «código de producto» (`H-03`). En ambos, cada capa resolvió el problema
  otra vez sin mirar la anterior.
- **Lente 4:** las skills son la única capa que sale limpia. Sirve como línea de base para
  juzgar el resto: ~1.210 tokens fijos por una funcionalidad que se usa varias veces por
  sesión es una relación sana.
- **`INC-015` cruza los dos contextos.** El payload documenta una capacidad que el
  generador no cablea. Cruzarlo con `INC-010` (los mismos scripts fallan en proyectos sin
  asignaciones): la capa de asignaciones **está a medio integrar en las dos mitades**.
