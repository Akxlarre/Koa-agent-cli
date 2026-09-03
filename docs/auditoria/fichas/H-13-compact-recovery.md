# FICHA A — H-13 · `compact-recovery.js`

| | |
|---|---|
| **Archivo** | `templates/.claude/hooks/compact-recovery.js` · **Contexto** B · **Bloque** 1 · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

Tras cada compactación, re-inyecta **selectivamente** (solo los índices que el agente ya
había leído, más los tres core) y **parcialmente** (cortando en `<!-- DETAIL:BEGIN -->`),
más el contexto del proyecto y las casillas abiertas del task-spec.

**¿Coincide con lo que dice su propia documentación?**

Sí en el mecanismo. **No en el alcance**: el docblock habla de «los índices del proyecto»
sin decir que solo conoce diez de los quince.

## 2. Disparo

- **Evento:** `PostCompact`, sin matcher.
- **Selección:** parsea el discovery flag con `line.match(/indices\/([\w-]+)\.md/i)` y suma
  esos nombres a los tres core.
- **Corte:** `content.indexOf(DETAIL_MARKER)` — inyecta solo la Quick Reference.

**¿Puede no dispararse cuando debería?**

Sí. `ALL_INDEX_FILES` es un mapa **hardcodeado de diez entradas**. Los cinco índices que
faltan —`GUARDS`, `LAYOUTS`, `ROUTES`, `USAGE-MAP`, `UTILS`— nunca se re-inyectan, aunque
el flag registre que el agente los leyó. `LAYOUTS.md` es el caso más visible: el propio
mensaje del Discovery Gate lo ofrece en su lista de archivos que levantan el bloqueo.

## 3. Fail mode

- **Actual:** fail-open; cada bloque en su `try/catch`, y el fallback ante un flag ilegible
  es «solo los tres core».
- **¿Es la elección correcta acá?** Sí. Perder una re-inyección es recuperable; romper el
  post-compact no.

| Escenario | Comportamiento | ¿Correcto? |
|---|---|---|
| Sin flag | inyecta solo los tres core | sí |
| Índice sin `DETAIL:BEGIN` | inyecta el archivo entero | discutible — sin tope de tamaño |
| Índice leído fuera de los 10 conocidos | **no se re-inyecta** | **no** → `HUE-003` |
| Archivo de `context/` que es solo plantilla | se salta por el umbral de 80 chars | sí |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

```bash
node -e "
const all=['COMPONENTS','SERVICES','FACADES','MODELS','DATABASE','DIRECTIVES','STYLES',
           'PIPES','ANTI-PATTERNS','STORES'];
const real=require('fs').readdirSync('templates/indices').filter(f=>f.endsWith('.md'))
           .map(f=>f.replace('.md',''));
console.log('no re-inyectables:', real.filter(r=>!all.includes(r)).join(', '));"
```

**Qué pasó:**

```
índices en templates/indices/:            15
en ALL_INDEX_FILES de compact-recovery:   10
no re-inyectables: GUARDS, LAYOUTS, ROUTES, USAGE-MAP, UTILS
```

**El contexto de este hook importa más que el hallazgo.** `templates-contract.md` cuenta
que `compact-recovery.js` estuvo con un error de sintaxis durante varias versiones,
fallando en silencio en cada compactación, precisamente porque ningún test lo ejecutaba
nunca. Hoy tiene test —`compact-recovery.test.js`— y esa clase de fallo no volvería a
pasar. Pero el test verifica que el hook **corre y produce salida**, no que su mapa de
índices esté completo: el mismo archivo que motivó la regla de «los hooks tienen tests»
sigue teniendo un hueco que su test no ve.

**Veredicto:**
- [x] Corre y produce salida — cubierto por su test
- [x] Su mapa de índices está incompleto y nada lo detecta → `HUE-003` (registrado en `C-01`)

## 5. Depende de

| Artefacto / formato | Qué asume | ¿Declarado? |
|---|---|---|
| Discovery flag (`C-01`) | Líneas con `indices/NOMBRE.md` | sí |
| `<!-- DETAIL:BEGIN -->` | Marca de corte | **no → `ACO-005`** |
| Task-spec (`C-03`) | Casillas `- [ ]` | sí |
| `context/*.md` | 4 archivos hardcodeados, umbral de 80 chars sin comentarios | no |
| `CORE_INDICES` | Copia de la lista de `session-start.js` | **no — duplicada** |

## 6. Lo consumen

El agente. Hook terminal.

## 7. Cobertura

- **Test que lo cubre:** `compact-recovery.test.js` ✔
- **¿El test ejecuta la ruta de fallo?** Cubre la ejecución y el corte. **No cubre la
  completitud del mapa de índices**, que es su hallazgo abierto. Un test de tres líneas
  —«todo `.md` de `indices/` está en `ALL_INDEX_FILES`»— lo cerraría, igual que el test
  propuesto en `HUE-008`.

## 8. Costo / beneficio

- **Qué cuesta:** hasta 10 índices en Quick Reference + 4 archivos de `context/` **enteros**
  (`raw`, sin truncar) + las casillas abiertas. A diferencia de `session-start.js`, que
  tiene tope de 2.500 caracteres por índice, **este hook no tiene ningún tope de tamaño**.
  Un `context/domain.md` largo entra completo en cada compactación.
- **Qué evita:** que el agente pierda los índices justo después de una compactación, que es
  cuando más los necesita.
- **Veredicto:** vale la pena, pero **medir en la Lente 4**: es el segundo candidato a `CAR`
  después de `plan-injector`, y por el mismo motivo — inyección sin techo. Con el agravante
  de que corre justo cuando el contexto acaba de quedarse corto.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `HUE-017` | HUE | No tiene tope de tamaño: los 4 archivos de `context/` se inyectan enteros, a diferencia de `session-start.js` que trunca a 2.500 chars |

## Notas para el pase general

- **Lente 4:** medir el peor caso real de este hook. Corre en el momento de máxima presión
  de contexto y es el único inyector sin tope.
- **Lente 2:** `CORE_INDICES` y el umbral de 80 caracteres para `context/` están duplicados
  entre este hook y `session-start.js`. Dos copias, ninguna fuente.
- **Lente 3:** es el caso que fundó la regla de testear hooks, y su test sigue sin cubrir su
  hueco real. Buen recordatorio de que «tiene test» no es la pregunta.
