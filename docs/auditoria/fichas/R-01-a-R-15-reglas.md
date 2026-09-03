# FICHA B — R-01 a R-15 · Las reglas path-scoped

| | |
|---|---|
| **Archivos** | `templates/.claude/rules/*.md` · **Tipo** regla · **Invocación** path-scoped · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Qué dicen

Quince archivos de prosa normativa que Claude Code inyecta **solo cuando el archivo editado
coincide** con su frontmatter `paths:`. Cubren arquitectura, facades, modelos, estado, SWR,
base de datos, selección de componentes, contrato de pantallas, layouts, sistema visual,
accesibilidad, legibilidad para agentes, notificaciones, TDD y delegación.

## 2. Disparo — cuántas se activan a la vez

La pregunta de la ficha B no es si el archivo existe sino **si se dispara cuando debe y si
cubre de más**. Medido, evaluando los `paths:` de las 15 contra archivos reales:

| Al editar… | Reglas | Skills | Peso de las reglas |
|---|---|---|---|
| `shared/components/x/x.component.ts` | **6** | 5 | **39.197 chars (~9.800 tokens)** |
| `features/x.component.html` | 5 | 4 | 33.746 chars (~8.400 tokens) |
| `core/facades/x.facade.ts` | 4 | 1 | 16.582 chars (~4.100 tokens) |
| `features/x.component.ts` | 2 | 5 | 7.761 chars |
| `supabase/migrations/001_x.sql` | 2 | 1 | 7.278 chars |
| `styles/tokens/_variables.scss` | 1 | 1 | 21.047 chars |

**Editar un componente de `shared/` inyecta seis reglas completas: ~9.800 tokens.** La
última fila es igual de reveladora: **una sola regla** —`visual-system.md`, 21.521
caracteres y 452 líneas— pesa más que cuatro juntas.

**¿Se disparan cuando deben?** Sí; los globs son razonables y ninguna regla queda sin
alcance. **¿Cubren de más?** `delegation.md` matchea `src/app/**/*.ts` + `.html` +
`supabase/migrations/**`, es decir **casi todo**, y su contenido —cuándo usar un
subagente— no depende del archivo que se esté editando. Es la candidata más clara a salir
del path-scoping.

## 3. ¿Es verdad hoy?

Barrido automatizado sobre las 15: cada ruta, cada comando y cada número verificado contra
el código.

- [x] Comandos `npm run` mencionados → **todos existen** en las 15 reglas
- [ ] Rutas mencionadas → **una rota**
- [x] Números → sin discrepancias

**La ruta rota:**

```
visual-system.md:444 → `src/styles/_view-transitions.scss`
ruta real            →  src/styles/motion/_view-transitions.scss
```

Falta el segmento `motion/`. Un agente que siga la referencia no encuentra el archivo.
→ `INC-014`

Un segundo caso, menor: `visual-system.md` cita
`scripts/lib/class-discipline.baseline.json`, que no se entrega en el payload — lo crea
`architect.js` en la primera corrida del ratchet. La referencia no está mal, pero describe
un archivo que no existe hasta que alguien corre el linter.

## 4. Colisiones

**Solapes reales**, del análisis de globs:

| Grupo | Reglas que se activan juntas | ¿Se contradicen? |
|---|---|---|
| Componentes de `shared/` | `architecture`, `component-selection`, `screen-contract`, `visual-system`, `ai-readability`, `delegation` | No — pero `component-selection` y `screen-contract` cubren terreno vecino (cuándo crear un componente / con qué piezas se arma una pantalla) |
| Templates HTML | `a11y-spec`, `ai-readability`, `visual-system`, `architecture`, `delegation` | No |
| Facades | `architecture`, `state-management`, `testing-tdd`, `delegation` | No |

**No encontré contradicciones entre reglas.** Es un resultado positivo y vale registrarlo:
15 archivos de prosa normativa escritos en momentos distintos y ninguno se pisa con otro.

## 5. Mecanismo — cuáles son guardrail y cuáles contrato social

Cruzando cada regla contra lo que `architect.js` y `pre-write-guard.js` emiten y citan:

| Estado | Reglas |
|---|---|
| **✓ Mecanizada** (10) | `a11y-spec`, `ai-readability`, `architecture`, `database`, `facades`, `models`, `notifications`, `screen-contract`, `swr-pattern`, `visual-system` |
| **· Solo prosa** (5) | `component-selection`, `delegation`, `layout-blueprints`, `state-management`, `testing-tdd` |

Las cinco sin mecanismo **son las correctas para no tenerlo**: son decisiones de diseño
—qué componente crear, cuándo delegar, qué arquetipo de página usar, qué estado va dónde,
qué testear— que no se pueden reducir a un regex. `.claude/CLAUDE.md` lo dice para el
grupo de anti-patrones: son las que «solo ve `code-judge` o una persona».

**El problema no es que existan, es que no están marcadas.** Nada distingue una regla que
un hook hace cumplir de una que solo se puede recordar. Un agente bajo presión de contexto
las trata igual, y son justo las que más fácil se ignoran.
→ `HUE-027`

## 6. Costo / beneficio

- **Cuándo se cargan:** solo al matchear. La decisión de path-scoping es correcta y es lo
  que evita que las 15 estén siempre presentes.
- **Cuánto pesan en el peor caso:** ~9.800 tokens editando un componente de `shared/`.
- **¿Alguien las lee?** Las diez mecanizadas sí, porque el error del linter las cita por
  ruta (`Doc: .claude/rules/facades.md`). Las cinco de prosa no tienen esa entrada.

**Veredicto:** vale la pena, con un caso a revisar:

- **`visual-system.md` (21.521 chars, 452 líneas)** es más de la mitad del peso de
  cualquier edición de UI y entra completa cada vez. Es candidata a partirse en
  «Quick Reference» + detalle, exactamente como los índices ya hacen con
  `<!-- DETAIL:BEGIN -->` (`ACO-005`). El mecanismo para resolverlo **ya existe en la casa**
  y no se aplicó a las reglas. → `CAR-003`
- **`delegation.md`** matchea casi todo y no depende del archivo editado.

---

## Hallazgos de estas unidades

| ID | Tipo | Una línea |
|---|---|---|
| `CAR-003` | CAR | Editar un componente de `shared/` inyecta 6 reglas completas (~9.800 tokens); `visual-system.md` sola son 21.521 chars y entra entera, sin el corte `DETAIL:BEGIN` que los índices ya usan |
| `HUE-027` | HUE | Nada distingue las 10 reglas mecanizadas de las 5 que son contrato social; el agente las trata igual y son las más fáciles de ignorar |
| `INC-014` | INC | `visual-system.md` cita `src/styles/_view-transitions.scss`; la ruta real lleva `motion/` |

## Notas para el pase general

- **Lente 4 — el número que faltaba.** Peor caso combinado en una sola edición de un
  componente de `shared/` con spec SDD activa: ~9.800 (reglas) + ~6.155 (`plan-injector`,
  `CAR-001`) + ~1.210 (descriptions siempre presentes) ≈ **17.000 tokens**, sin contar la
  capa 4 de `pre-write-guard`.
- **Lente 2 — resultado negativo que vale.** Buscando contradicciones entre las 15, no
  encontré ninguna. La duplicación del harness está en el **código** (cuatro definiciones
  de «código de producto», dos productores de `LESSONS_LEARNED.md`), no en la prosa.
- **La solución a `CAR-003` ya está inventada en el repo.** Los índices se cortan en
  `DETAIL:BEGIN` y `session-start.js` trunca a 2.500 chars. Las reglas no heredaron ninguna
  de las dos ideas.
