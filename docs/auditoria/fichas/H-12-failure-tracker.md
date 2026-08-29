# FICHA A — H-12 · `failure-tracker.js`

| | |
|---|---|
| **Archivo** | `templates/.claude/hooks/failure-tracker.js` · **Contexto** B · **Bloque** 1 · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

Registra cada fallo de tool en `.claude/temp/LESSONS_LEARNED.md`, con dedup por firma,
conteo de ocurrencias y rotación a 20 entradas.

**¿Coincide con lo que dice su propia documentación?**

Sí en la descripción. Lo que no anticipa es que el archivo es a la vez **salida y entrada**:
en cada fallo se re-parsea la tabla markdown que él mismo escribió. Ese round-trip es el
punto débil.

## 2. Disparo

- **Evento:** `PostToolUseFailure`, sin matcher — todos los fallos de todos los tools.
- **Firma de dedup:** `${toolName}:${error.replace(/\s+/g,' ').slice(0,80)}`.

**¿Puede no dispararse cuando debería?** No: no tiene filtro, corre siempre.

## 3. Fail mode

- **Actual:** fail-open; `catch` silencioso.
- **¿Es la elección correcta acá?** Sí, es un registrador.

| Escenario | Comportamiento | ¿Correcto? |
|---|---|---|
| `LESSONS_LEARNED.md` inexistente | lo crea | sí |
| >20 entradas | `slice(length - 20)` conserva las 20 últimas | sí |
| Error idéntico repetido | incrementa `occurrences` | sí |
| **Error que contiene `\|`** | **rompe la tabla en el siguiente parseo** | **no** → `HUE-016` |
| stdin >10 MB | `exit 0` (tiene cap SEC-04) | sí |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

El formato de almacenamiento es una tabla markdown y `parseEntries()` la lee con un regex
de columnas separadas por `|`. `errorSnippet` normaliza espacios pero **no escapa pipes** —
y un mensaje de error de shell los tiene todo el tiempo.

```bash
echo '{"tool_name":"Bash","error":"comando falló: grep x | wc -l devolvió 2"}' \
  | node .claude/hooks/failure-tracker.js
tail -2 .claude/temp/LESSONS_LEARNED.md
# → | 2026-08-29 | `Bash` | comando falló: grep x | wc -l devolvió 2 | 1 | `Bash:…` |  |
#     ↑ la fila ya tiene 7 columnas en vez de 6

echo '{"tool_name":"Bash","error":"otro error distinto"}' \
  | node .claude/hooks/failure-tracker.js
tail -3 .claude/temp/LESSONS_LEARNED.md
```

**Qué pasó:**

Tras el segundo fallo, la primera entrada vuelve corrompida al re-parsearse:

```
| 2026-08-29 | `Bash` | comando falló: grep x | wc -l devolvió 2 | 1 | `Bash:comando falló: grep x` | wc -l devolvió 2` |
                                                                      └── el contenido migró de columna ──┘
```

La firma quedó truncada en `Bash:comando falló: grep x` y el resto se desplazó al campo
`context`. Consecuencias:

- **El dedup deja de funcionar para esa entrada**: la firma re-leída ya no coincide con la
  que se calcula al volver a fallar, así que el mismo error se registra otra vez como nuevo.
- **El conteo de ocurrencias se pierde**, que es justamente el dato por el que existe el
  archivo: saber qué falla repetidamente.
- La corrupción es **acumulativa**: cada fallo con pipe desplaza una fila más.

El caso es especialmente probable porque el tool que más falla es `Bash` y los mensajes de
error de shell contienen pipes con normalidad.

**Veredicto:**
- [x] Registra y deduplica correctamente en el caso limpio — comprobado
- [x] Corrompe su propio almacén con un carácter común → `HUE-016`

## 5. Depende de

| Artefacto / formato | Qué asume | ¿Declarado? |
|---|---|---|
| `.claude/temp/LESSONS_LEARNED.md` | Tabla markdown de 6 columnas, round-trip fiel | **no → `ACO-008`** |
| `event.error` o `event.stderr` | Uno de los dos existe | no |

## 6. Lo consumen

| Consumidor | Qué toma | ¿Se rompe si cambio el formato? |
|---|---|---|
| Él mismo, en el siguiente fallo | Re-parsea toda la tabla | **sí — y ya se rompe solo** |
| `pre-write-guard.js` capa 4 | Solo `existsSync`, para mencionarlo al agente | no |
| `lint-arch-wrapper.js` | **Escribe** en el mismo archivo | ver abajo |
| El agente / el humano | Lo lee | no |

**¿Alguien lo consume sin que esté declarado?**

Sí, y es un `DUP`: **`lint-arch-wrapper.js` escribe en el mismo `LESSONS_LEARNED.md`** con
su propio formato, sin conocer el esquema de tabla de este hook. Dos productores, un
archivo, ningún contrato común. Confirmar el formato exacto del wrapper en `S-02`.

## 7. Cobertura

- **Test que lo cubre:** **ninguno.** No existe `failure-tracker.test.js`.
- **¿El test ejecuta la ruta de fallo?** No hay test. Un test de round-trip
  —escribir una entrada, releerla, comparar— habría encontrado `HUE-016` de inmediato. Es
  el tipo de bug que solo aparece testeando el ciclo completo, no una escritura suelta.

## 8. Costo / beneficio

- **Qué cuesta:** un read+parse+write por fallo. Al contexto no entra: `pre-write-guard`
  solo menciona que el archivo existe.
- **Qué evita:** que el agente repita el mismo error sin memoria entre sesiones.
- **Veredicto:** vale la pena la idea; **la implementación entrega menos de lo que promete**,
  porque el dato que más importa (el conteo de repeticiones) es el primero que se pierde.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `HUE-016` | HUE | Un error que contenga `\|` corrompe la tabla de `LESSONS_LEARNED.md` en el siguiente parseo; se pierden la firma y el conteo, y el daño es acumulativo |
| `DUP-002` | DUP | `failure-tracker` y `lint-arch-wrapper` escriben ambos en `LESSONS_LEARNED.md` con formatos distintos y sin contrato común |
| `ACO-008` | ACO | `LESSONS_LEARNED.md` es un contrato de round-trip con dos productores y no está declarado |

## Notas para el pase general

- **Lente 1:** `LESSONS_LEARNED.md` es el sexto contrato compartido que aparece sin estar
  en la lista original de cinco. Junto con el orden de hooks (`ACO-004`), confirma que la
  segunda pasada de la Lente 1 —buscar contratos emergentes— va a encontrar varios.
- **Lente 2:** dos productores del mismo archivo. Decidir cuál es la autoridad del formato,
  o separarlos en dos archivos.
- Un formato con separador de columnas para almacenar mensajes de error arbitrarios es la
  decisión de fondo. JSON no tendría este problema.
