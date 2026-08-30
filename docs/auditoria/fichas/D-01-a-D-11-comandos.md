# FICHA B — D-01 a D-11 · Los slash commands del SDD

| | |
|---|---|
| **Archivos** | `templates/.claude/commands/*.md` · **Tipo** comando · **Invocación** user-invocable · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Qué dicen

Once comandos que operan el motor SDD: cinco `/spec-*` (el ciclo completo), dos `/fix-*`,
`/hotfix`, y tres `/assign-*` (la capa de equipo, previa al track).

## 2. Disparo

Los once declaran `allowed-tools` explícito — ninguno omite el campo:

```
assign-claim    Read, Write, Bash, Glob        spec-activate   Read, Write, Bash, Glob
assign-list     Read, Bash, Glob               spec-new        Read, Write, Bash, Glob
assign-new      Read, Write, Bash, Glob        spec-plan       Read, Write, Glob, Grep, Bash
fix-close       Read, Write, Bash, Glob        spec-tasks      Read, Write, Bash
fix-new         Read, Write, Bash, Glob        spec-verify     Read, Write, Bash, Glob, Grep
hotfix          Read, Write, Bash, Glob
```

**Los grants son coherentes con cada rol.** `assign-list` es el único sin `Write` — y es el
único que solo lee. `spec-plan` y `spec-verify` suman `Grep` porque cruzan la spec contra
los índices y contra el código. `spec-tasks` es el más acotado (sin `Glob`) porque solo
transforma `plan.md` en `tasks.md`.

**Diez de los once tocan `specs/.active`**, que es el contrato que `spec-gate` y
`plan-injector` leen (`H-03`, `H-06`). La cadena comando → `.active` → hook está bien
cerrada: los comandos escriben exactamente lo que los hooks esperan encontrar.

## 3. ¿Es verdad hoy?

- [x] Rutas mencionadas → una rota (ver abajo)
- [ ] Comandos `npm run` → **uno no existe**
- [ ] Convención de IDs → **tres versiones distintas** (el hallazgo del bloque)

**La ruta rota:** `fix-close.md` instruye registrar aprendizajes en
`indices/DOMAIN-GOTCHAS.md` y dice *«ver convención al final de ese archivo»*. Ese archivo
**no existe**: los índices del template son quince y ninguno se llama así. El agente que
siga la instrucción crea un archivo nuevo sin la convención que se le pide seguir.
→ `INC-016`

**El comando inexistente:** `fix-close.md` y `assign-claim.md` mandan correr
`npm run assignments:sync`, que el scaffolder nunca escribe (`INC-015`, registrado en las
skills).

## 4. Colisiones — la convención de IDs, en tres versiones

Esta es la colisión real del bloque, y es de las mejores de toda la auditoría porque **el
repositorio ya la diagnosticó y solo arregló una punta.**

| Fuente | Convención que declara |
|---|---|
| `assignments-audit.js` (docblock + `parseTrackName`) | `<tipo>-NNN-<autor>-slug` — **con código de autor** |
| `sdd/SKILL.md`, diagrama de estructura (líneas 51-57) | `NNNN-X-slug`, `fix-NNN-X-slug` — **con autor** |
| `sdd/SKILL.md`, tabla del ciclo (líneas 33-38) | `specs/specs/NNNN-slug/` — **sin autor** |
| `fix-new.md` línea 45 | `fix-NNN-<slug>` (ej. `fix-001-mytasks-kpi-incorrecto`) — **sin autor** |
| `hotfix.md` línea 48 | `hotfix-NNN-<slug>` — **sin autor** |

**Los comandos que generan los nombres documentan la versión sin código de autor. El script
que los audita exige el código de autor.** Y el docblock de ese script cuenta que el bug ya
ocurrió:

> *«Encontró `fix-086-flota-kpi-en-taller-hero` sin código de autor — corregido a mano,
> este check evita que se repita.»*

El check se escribió para que no se repitiera. **Pero se arregló el detector, no el
generador**: `/fix-new` sigue instruyendo el formato que produjo el bug. La próxima vez va
a volver a pasar, y esta vez el auditor lo detectará — si alguien puede correrlo, cosa que
`INC-015` impide (`npm run assignments:audit` no existe).

Tres capas del mismo subsistema con tres criterios, y el mecanismo que los reconciliaría es
inalcanzable. → `INC-017`

**Colisión menor:** `/fix-close` y `sdd/hotfix-autoclose.js` (`H-14`) cierran tracks, uno a
mano y el otro solo. No se pisan —cubren tipos distintos— pero `hotfix-autoclose` sufre
`INC-007` (cierra al final de la primera respuesta, no de la sesión), así que en la
práctica un hotfix se cierra antes de que `/fix-close` pudiera aplicarse.

## 5. Mecanismo

| Comando | Guardrail que lo respalda |
|---|---|
| Los diez que tocan `.active` | `sdd/spec-gate.js` bloquea escrituras sin spec activa |
| `/spec-plan` | El gate exige `plan.md`: sin correr este comando no se puede escribir código |
| `/hotfix` | `hotfix-autoclose.js` lo cierra al terminar |
| **Ninguno** | La convención de IDs — que es justo lo que `INC-017` rompe |

**El formato del contenido que escriben no lo valida nadie.** `/spec-new` produce un
`spec.md` y `spec-gate` solo comprueba que el **archivo exista**, no que tenga sus
secciones. El patrón que resolvería esto ya existe: `/plan` declara
`validate-file-contains.js` en su frontmatter y verifica sus cinco encabezados (`H-19`).
Ninguno de los once comandos lo usa. → refuerza `HUE-028`

## 6. Costo / beneficio

- **Cuándo se cargan:** solo al invocarse. Un comando no consume contexto hasta que el
  humano lo escribe.
- **Cuánto pesan:** irrelevante — es el modelo de invocación más barato del harness.
- **¿Alguien los lee?** Solo si el proyecto activó el SDD (existe `specs/`). En un proyecto
  sin SDD los once son peso muerto en disco, cero peso en contexto. Correcto.

**Veredicto:** vale la pena. La capa es barata, los grants están bien, y la cadena hacia los
hooks está cerrada. Lo que falla es la **coherencia interna del subsistema**, no su diseño.

---

## Hallazgos de estas unidades

| ID | Tipo | Una línea |
|---|---|---|
| `INC-017` | INC | Tres convenciones de ID para el mismo track: los comandos generan sin código de autor, `assignments-audit` lo exige, y `sdd/SKILL.md` usa las dos. El bug ya ocurrió y se arregló el detector, no el generador |
| `INC-016` | INC | `fix-close.md` manda registrar aprendizajes en `indices/DOMAIN-GOTCHAS.md`, que no existe, y seguir «la convención al final de ese archivo» |

## Notas para el pase general

- **`INC-017` es el mejor ejemplo del patrón de fondo de toda la auditoría.** El repo
  detecta un problema, escribe el mecanismo que lo detecta, y **no cierra el círculo hacia
  la fuente**. Mismo patrón que `DEC-004` (existe `provocar-reglas` y cubre el 14%),
  `HUE-028` (existe el guardrail de frontmatter y se usa una vez) y `CAR-003` (existe
  `DETAIL:BEGIN` y las reglas no lo heredaron). **Las herramientas están; la aplicación
  quedó a medias.** Es candidato firme a una de las cinco conclusiones.
- **Lente 1:** `specs/.active` es el noveno contrato compartido sin declarar en
  `templates-contract.md` — diez comandos lo escriben y tres hooks lo leen.
- **La capa de asignaciones está a medio integrar en tres lugares distintos:** `INC-010`
  (los scripts fallan si no se usa), `INC-015` (no hay `npm run`), `INC-017` (convención
  divergente). Tratarlas juntas en el backlog.
