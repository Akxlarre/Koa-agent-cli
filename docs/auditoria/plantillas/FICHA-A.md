# FICHA A — <ID> · <nombre de la unidad>

<!--
NIVEL A — piezas con comportamiento que puede fallar en silencio.
Copiar este archivo a ../fichas/<ID>-<slug>.md y llenar los 8 campos EN ORDEN.
No borrar campos. No agregar campos sin agregarlos también a las fichas ya cerradas.
-->

| | |
|---|---|
| **Archivo** | `ruta/exacta.js` |
| **Contexto** | A (generador) · B (harness) |
| **Bloque** | 0 contratos · 1 hooks · 2 scripts · 3 CLI · 4 subagentes · 5 tests |
| **Revisado** | YYYY-MM-DD |
| **Estado** | pendiente · en curso · cerrada |

---

## 1. Contrato

<!-- Qué promete esta pieza, en UNA frase. Si no entra en una frase, o hace dos cosas
     (posible hallazgo DUP) o no entendiste todavía qué hace. -->



**¿Coincide con lo que dice su propia documentación?**
<!-- Comparar contra su docblock, contra templates/.claude/CLAUDE.md y contra
     templates/docs/HOOKS-SYSTEM.md. Cualquier divergencia es un INC. -->



## 2. Disparo

<!-- Cuándo corre EXACTAMENTE. Evento, matcher, condición de entrada.
     Para scripts: qué comando lo invoca y desde dónde. -->

- **Evento / invocación:**
- **Matcher o condición:**
- **Precondiciones que asume:**

**¿Puede no dispararse cuando debería?**
<!-- Rutas por las que la pieza queda muda: matcher que no cubre un caso, un early return,
     un try/catch que se traga la condición. -->



## 3. Fail mode

- **Actual:** fail-open · fail-closed · mixto
- **¿Es la elección correcta acá?** sí · no · discutible

<!-- Justificar. Un guardrail fail-open que debería ser closed es un hueco silencioso.
     Un fail-closed en algo periférico rompe sesiones por nada. -->



**Qué pasa ante:**

| Escenario | Comportamiento actual | ¿Correcto? |
|---|---|---|
| Input malformado / stdin vacío | | |
| Archivo o dependencia ausente | | |
| Error de filesystem (permisos, disco) | | |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

<!-- LA pregunta central. No "¿funciona?" sino "¿lo vi negarse ante su propia violación?"
     Sin evidencia concreta acá, la ficha NO está cerrada. -->

**Qué intenté para hacerla fallar:**

```
<comando / input / fixture exacto>
```

**Qué pasó:**



**Veredicto:**
- [ ] Dispara ante su violación — comprobado
- [ ] No dispara → hallazgo `DEC-___`
- [ ] No pude comprobarlo → explicar por qué, y abrir `HUE-___`

## 5. Depende de

<!-- LITERAL: nombres de archivo, claves de JSON, formatos de línea, encabezados exactos.
     Este campo alimenta la Lente 1 del pase general. -->

| Artefacto / formato | Qué asume de él | ¿Declarado en templates-contract.md? |
|---|---|---|
| | | sí / **no → ACO-___** |

## 6. Lo consumen

<!-- Quién depende de ESTA pieza. Mismo rigor: literal, no descriptivo. -->

| Consumidor | Qué toma de acá | ¿Se rompe si cambio el formato? |
|---|---|---|
| | | |

**¿Alguien lo consume sin que esté declarado?**



## 7. Cobertura

- **Test que lo cubre:** `templates/.claude/tests/____.test.js` · **ninguno → `HUE-___`**
- **¿El test ejecuta la ruta de fallo, o solo el camino feliz?**

<!-- Un test que importa el módulo y verifica que no explota NO es cobertura del guardrail.
     Cruzar esta respuesta con el campo 4: si el campo 4 dice "dispara" pero ningún test
     lo comprueba, el día que alguien lo rompa nadie se entera. -->



- **¿Lo cubre `provocar-reglas.mjs` o `smoke-scripts.mjs`?**

## 8. Costo / beneficio

<!-- Específico de un harness: una pieza puede ser CORRECTA y aun así neta negativa,
     porque cada regla, skill e inyección paga renta en la ventana de contexto. -->

- **Qué cuesta:** <tokens inyectados por turno · latencia · fricción para el agente>
- **Qué evita:** <el error concreto que previene>
- **Veredicto:** vale la pena · marginal · **cuesta más de lo que aporta → `CAR-___`**

---

## Hallazgos de esta unidad

<!-- Solo los IDs y una línea. La descripción completa va en HALLAZGOS.md, una sola vez. -->

| ID | Tipo | Una línea |
|---|---|---|
| | | |

## Notas para el pase general

<!-- Lo que no es un hallazgo todavía pero querés recordar al cruzar:
     "esto se parece sospechosamente a lo que hace X", "acá hay dos criterios distintos
     para lo mismo", "esta pieza asume algo que nadie garantiza". -->

-
