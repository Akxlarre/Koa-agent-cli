# FICHA A — C-03 · Task-spec

| | |
|---|---|
| **Archivo** | `.claude/temp/task-spec-YYYYMMDD-HHMMSS.md` |
| **Contexto** | B (harness) |
| **Bloque** | 0 contratos |
| **Revisado** | 2026-08-29 |
| **Estado** | cerrada |

---

## 1. Contrato

El agente declara por escrito qué va a hacer antes de escribir código, en un formato que
cuatro piezas pueden leer por su cuenta.

**¿Coincide con lo que dice su propia documentación?**

Sí, y es el contrato mejor documentado de los cinco: `templates-contract.md` nombra las
tres partes (naming, casillas, encabezados) y la propia `SKILL.md` de `/plan` explica por
qué el timestamp tiene ese formato y advierte *«si los renombras aquí, se rompen allá»*.
Es el ejemplo a seguir para los otros cuatro.

## 2. Disparo

- **Evento / invocación:** lo escribe la skill `/plan`. Lo leen `session-start.js`,
  `prompt-context.js`, `compact-recovery.js`, `spec-reflection.js` (Stop) y
  `validators/validate-file-contains.js` (hook declarado en el frontmatter de `/plan`).
- **Cómo se localiza el spec activo:** los cuatro hooks hacen lo mismo —
  `readdirSync().filter(startsWith('task-spec-')).sort()` y toman el último. Consistente.
- **Precondiciones que asume:** que el agente use el formato `YYYYMMDD-HHMMSS` (así orden
  alfabético = cronológico) y que marque las casillas a medida que avanza.

**¿Puede no dispararse cuando debería?**

Sí, dos casos, ambos comprobados abajo.

## 3. Fail mode

- **Actual:** mixto. Los lectores de contexto son fail-open; el validador de `/plan` y
  `spec-reflection` son fail-closed (`exit 2`).
- **¿Es la elección correcta acá?** sí en principio, **pero las dos condiciones de cierre
  están mal calibradas**.

| Escenario | Comportamiento actual | ¿Correcto? |
|---|---|---|
| No existe ningún task-spec | validador `exit 2`: "creálo antes de terminar" | sí |
| Existe pero con >60 min sin tocar | validador `exit 2` con el **mismo** mensaje | **no** → `INC-002` |
| Existe, casillas abiertas, **ninguna** marcada | `spec-reflection` guarda silencio | **no** → `HUE-004` |
| Falta un encabezado `##` | validador `exit 2` nombrando cuál | sí |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

```bash
SPEC=.claude/temp/task-spec-20260829-100000.md   # con las 5 secciones y 2 casillas abiertas

# 4.1 validador con el spec recién escrito
node .claude/hooks/validators/validate-file-contains.js --directory .claude/temp \
  --pattern "task-spec-*.md" --max-age 60 --require-file \
  --contains "## Objetivo" --contains "## Criterio de done"

# 4.2 mismo spec, mtime de hace 2 horas
touch -d '2 hours ago' "$SPEC" && <mismo comando>

# 4.3 spec-reflection sin ninguna casilla marcada
touch "$SPEC" && node .claude/hooks/spec-reflection.js

# 4.4 el mismo spec con UNA casilla marcada
sed -i 's/- \[ \] a/- [x] a/' "$SPEC" && node .claude/hooks/spec-reflection.js
```

**Qué pasó:**

```
4.1 → exit 0                                          ✔ correcto
4.2 → exit 2  "no se encontró ningún archivo task-spec-*.md
               modificado en los últimos 60 min. Créalo antes de terminar."
4.3 → exit 0  (silencio)                              ✘
4.4 → exit 2  "tiene 1 punto(s) sin cerrar (1 completado(s))"  ✔
```

**4.2** — `--max-age 60` combinado con `--require-file` convierte *«el spec está viejo»*
en *«no existe ningún spec»*. En una sesión de más de una hora donde el spec no se editó,
el validador le pide al agente que cree uno que ya existe, empujándolo a generar un
duplicado — que además pasará a ser el "más reciente por orden alfabético" para los otros
cuatro consumidores. → `INC-002`

**4.3 vs 4.4** — `spec-reflection.js` tiene esta guarda:

```js
if (open.length === 0 || done === 0) { … bail(); }
```

El comentario la justifica: *«sin casillas marcadas nunca → el agente no adoptó el flujo
del task-spec»*. Pero el efecto es que el hook **guarda silencio exactamente en el caso
que existe para atrapar**: un agente que declaró un criterio de done y no cumplió nada.
Basta con no marcar ninguna casilla para que la Reflection nunca hable. → `HUE-004`

**Veredicto:**
- [x] Dispara ante su violación — comprobado (4.1, 4.4)
- [x] Con dos falsos: un falso positivo (`INC-002`) y un falso negativo (`HUE-004`)

## 5. Depende de

| Artefacto / formato | Qué asume de él | ¿Declarado en templates-contract.md? |
|---|---|---|
| Naming `task-spec-YYYYMMDD-HHMMSS.md` | Que orden alfabético = cronológico | sí |
| Casillas `- [ ]` / `- [x]` | Regex `/^\s*-\s*\[ \]\s*(.+)$/` | sí |
| Los 5 encabezados `##` exactos | Substring literal en el frontmatter de `/plan` | sí |
| `.claude/temp/session-writes.json` | Para el bloque de evidencia de `spec-reflection` | sí, pero ver `ACO-001` |
| `.claude/temp/spec-reflection-seen.json` | Memoria anti-bucle | **no → `ACO-002`** |

## 6. Lo consumen

| Consumidor | Qué toma de acá | ¿Se rompe si cambio el formato? |
|---|---|---|
| `session-start.js` | Casillas `- [ ]` del spec más reciente | sí |
| `prompt-context.js` | Ídem, con dedup por prompt | sí |
| `compact-recovery.js` | Ídem, descartando las `[x]` | sí |
| `spec-reflection.js` | Casillas + conteo de `[x]` | sí |
| `validate-file-contains.js` | Los 5 encabezados, vía flags de la skill | sí |

**¿Alguien lo consume sin que esté declarado?**

Los cinco están declarados. La documentación dice "cinco piezas" y son exactamente cinco.

Lo que **no** está declarado es `spec-reflection-seen.json`, un artefacto derivado que
`spec-reflection.js` crea y borra por su cuenta. Es un contrato de una sola pieza consigo
misma, pero determina si el aviso sale o no. → `ACO-002`

## 7. Cobertura

- **Test que lo cubre:** `spec-reflection.test.js`, `prompt-context.test.js`,
  `session-start.test.js`, `validate-file-contains.test.js` — **cuatro de los cinco
  consumidores tienen test.** Es, con diferencia, el contrato mejor cubierto.
- **¿El test ejecuta la ruta de fallo?** Sí: la suite de `validate-file-contains` incluye
  un caso explícito «contrato con /plan». Los 121 tests del harness pasan.
- **Lo que ningún test cubre:** los dos casos de 4.2 y 4.3. Un test de `--max-age` con
  archivo viejo y otro de `spec-reflection` con `done === 0` los habrían encontrado.

## 8. Costo / beneficio

- **Qué cuesta:** las casillas abiertas se inyectan en `SessionStart`, en
  `UserPromptSubmit` (con dedup) y en cada `PostCompact`. Es el artefacto que más veces
  entra al contexto.
- **Qué evita:** que el agente pierda el hilo de lo que declaró que iba a hacer, y que
  el criterio de done sea write-only.
- **Veredicto:** vale la pena. El riesgo no es el costo sino la **triple inyección**:
  medir en la Lente 4 si los tres puntos son necesarios o si `session-start` +
  `compact-recovery` ya alcanzan.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `INC-002` | INC | `--max-age 60` + `--require-file` reportan "no existe ningún spec" cuando el spec existe pero lleva >1h sin tocarse |
| `HUE-004` | HUE | `spec-reflection` calla cuando no hay ninguna casilla marcada — el caso exacto que debería atrapar |
| `ACO-002` | ACO | `spec-reflection-seen.json` no está declarado como artefacto en `templates-contract.md` |

## Notas para el pase general

- Este contrato es el **modelo a imitar**: naming justificado, consumidores enumerados,
  advertencia explícita de acoplamiento en la propia skill. Los otros cuatro deberían
  documentarse así.
- **Lente 4:** tres puntos de inyección para el mismo artefacto. Es el candidato más claro
  a `CAR` del bloque, pero hay que medirlo antes de afirmarlo.
- **Lente 3:** contraste fuerte — este contrato tiene 4 tests y ningún hallazgo `S1`;
  `C-02` tiene 0 tests y dos hallazgos. La correlación entre cobertura y calidad es
  directa y visible.
