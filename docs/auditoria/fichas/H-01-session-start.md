# FICHA A — H-01 · `session-start.js`

| | |
|---|---|
| **Archivo** | `templates/.claude/hooks/session-start.js` |
| **Contexto** | B (harness) · **Bloque** 1 hooks · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

Al abrir la sesión inyecta los tres índices core, el objetivo del brief y los pendientes
del último task-spec, y levanta el Discovery Gate porque ya dio lo que el Gate exige.

**¿Coincide con lo que dice su propia documentación?**

Sí, y es de los hooks mejor argumentados del harness: el docblock explica por qué se
volvió proactivo (el Gate llegaba tarde y costaba una ronda entera) y por qué la frescura
del brief se audita al abrir y no al cerrar. Las tres decisiones están justificadas.

## 2. Disparo

- **Evento:** `SessionStart`, sin matcher.
- **Precondiciones:** que exista `indices/` con al menos uno de COMPONENTS, SERVICES o
  FACADES; que `context/brief.md` tenga contenido real (>80 caracteres sin comentarios).

**¿Puede no dispararse cuando debería?**

Sí, un caso: **no lee stdin**. Arranca, hace su trabajo síncrono y escribe a stdout. Si
el runtime le entrega el payload por stdin y nadie lo consume, el hook funciona igual —
pero es la razón por la que no puede tomar `session_id` de ahí (ver `HUE-002`).

## 3. Fail mode

- **Actual:** fail-open estricto. Cada bloque va en su propio `try {} catch {}`.
- **¿Es la elección correcta acá?** Sí, sin reparos. Un hook de arranque que rompe la
  sesión es peor que uno que no inyecta nada.

| Escenario | Comportamiento | ¿Correcto? |
|---|---|---|
| Sin `indices/` | inyecta lo demás y avisa «el Discovery Gate sigue activo» | sí |
| `brief.md` es solo plantilla | se salta por el umbral de 80 chars sin comentarios | sí |
| Índice >2500 chars | trunca con marca explícita | sí |
| No puede escribir el flag | silencioso; el Gate queda activo | sí (conservador) |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

Verificado durante `C-01`, con sandbox de proyecto vacío y de proyecto con índices:

```bash
# sin indices/ → el mensaje debe decir que el Gate sigue activo
node .claude/hooks/session-start.js
# con indices/COMPONENTS.md → debe inyectar y escribir el flag
echo "# Componentes" > indices/COMPONENTS.md && node .claude/hooks/session-start.js
ls $TMPDIR/koa-discovery-*.flag
```

**Qué pasó:**

Ambos caminos hacen lo que prometen: sin índices avisa y no levanta el Gate; con índices
inyecta la Quick Reference y escribe la entrada `SESSION-START | indices/COMPONENTS.md`.
El corte en `<!-- DETAIL:BEGIN -->` y el truncado a 2.500 caracteres funcionan.

Lo que **no** pude comprobar es el presupuesto real en un proyecto maduro: los índices
del template están vacíos, así que la inyección medida acá no representa la de un proyecto
con 40 componentes. → deuda para la Lente 4.

**Veredicto:**
- [x] Dispara ante su violación — comprobado
- [ ] Presupuesto real sin medir → pendiente Lente 4

## 5. Depende de

| Artefacto / formato | Qué asume | ¿Declarado? |
|---|---|---|
| `indices/{COMPONENTS,SERVICES,FACADES}.md` | Que los tres core son esos | **no** — la lista está hardcodeada acá y otra vez en `compact-recovery.js` |
| `<!-- DETAIL:BEGIN -->` | Marca de corte Quick Reference / detalle | **no → `ACO-005`** |
| `**last_updated:** YYYY-MM-DD` en `brief.md` | Regex exacta para la frescura | **no → `ACO-005`** |
| Discovery flag (`C-01`) | Lo escribe | sí |
| Task-spec (`C-03`) | Lee casillas `- [ ]` | sí |

## 6. Lo consumen

| Consumidor | Qué toma | ¿Se rompe si cambio el formato? |
|---|---|---|
| El agente (stdout → contexto) | Todo el bloque | no |
| `pre-write-guard.js` (Gate) | El flag que este hook escribe | sí |
| `compact-recovery.js` | El flag, para saber qué re-inyectar | sí |

**¿Alguien lo consume sin que esté declarado?**

No, pero hay **duplicación de definición**: `CORE_INDICES = ['COMPONENTS','SERVICES','FACADES']`
está escrito acá y otra vez en `compact-recovery.js`. Dos copias de la misma decisión, sin
fuente única. → aporta a `DUP` en la Lente 2.

Y el marcador `<!-- DETAIL:BEGIN -->` lo usan **tres** piezas (este hook,
`compact-recovery.js` y los propios índices) sin figurar en la tabla de contratos.

## 7. Cobertura

- **Test que lo cubre:** `session-start.test.js` ✔
- **¿El test ejecuta la ruta de fallo?** Sí — la suite cubre el caso sin índices, el corte
  en `DETAIL:BEGIN` y la escritura del flag. Es uno de los hooks bien cubiertos.
- **Lo que no cubre:** el umbral de 80 caracteres del brief y el cálculo de frescura de
  7 días, que son dos constantes mágicas sin test.

## 8. Costo / beneficio

- **Qué cuesta:** hasta 3 × 2.500 = **7.500 caracteres** de índices (~1.900 tokens), más
  el brief y los pendientes del spec. Una vez por sesión.
- **Qué evita:** la ronda entera que costaba el flujo reactivo (escribir → ser bloqueado →
  leer → reintentar).
- **Veredicto:** vale la pena. El presupuesto está acotado a propósito y el docblock lo
  dice: *«esto se inyecta en CADA sesión, así que se mantiene deliberadamente corto»*.
  Es el único hook que razona su costo por escrito.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `ACO-005` | ACO | `<!-- DETAIL:BEGIN -->` y el formato `**last_updated:**` son contratos usados por 2-3 piezas y no están declarados |

## Notas para el pase general

- **Lente 2:** `CORE_INDICES` duplicado entre este hook y `compact-recovery.js`.
- **Lente 4:** medir la inyección real en un proyecto con índices poblados, no con los
  del template vacíos.
- Es la referencia de cómo debería documentarse un hook: cada decisión trae su porqué.
