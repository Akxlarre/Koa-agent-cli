# FICHA A — C-04 · Marcadores auto-generados

| | |
|---|---|
| **Archivo** | `<!-- AUTO-GENERATED:BEGIN -->` … `<!-- AUTO-GENERATED:END -->` |
| **Contexto** | B (harness) |
| **Bloque** | 0 contratos |
| **Revisado** | 2026-08-29 |
| **Estado** | cerrada |

---

## 1. Contrato

Delimita la región de un `.md` que un script puede reescribir, dejando intacto todo lo
que un humano curó a mano fuera de los marcadores.

**¿Coincide con lo que dice su propia documentación?**

Sí. `indices/TEMPLATES-REGISTRY.md` dice que 13 de los 15 índices se auto-generan y dos
son manuales, y el filesystem lo confirma exactamente:

```
✗ ANTI-PATTERNS.md — sin marcadores (manual)
✗ LAYOUTS.md       — sin marcadores (manual)
✓ los otros 13
```

Es el único de los cinco contratos donde documentación y realidad coinciden sin ninguna
divergencia.

## 2. Disparo

- **Evento / invocación:** `indices-sync.js` (`npm run indices:sync`, también invocado por
  el subagente `index-syncer`) y `assignments-sync.js` (`npm run assignments:sync`).
- **Condición:** el script busca `indexOf(MARKER_BEGIN)` y `indexOf(MARKER_END)` y
  reescribe solo lo que hay entre medio.
- **Precondiciones que asume:** que los marcadores existan, estén en ese orden y aparezcan
  una sola vez por sección.

**¿Puede no dispararse cuando debería?**

Sí: si alguien borra los marcadores al editar un índice a mano, ese índice deja de
sincronizarse. `indices-sync.js` avisa por consola y sigue (ver campo 3), así que el
índice queda congelado sin que ningún gate lo note.

## 3. Fail mode

- **Actual:** **dos fail modes distintos para el mismo contrato.**

```js
// indices-sync.js:1091 — avisa y continúa
console.warn(yellow(`  ⚠  Sin marcadores en ${basename} — agrega los marcadores AUTO-GENERATED`));

// assignments-sync.js:86 — lanza
throw new Error(`No se encontraron marcadores AUTO-GENERATED para "${sectionHeader}"`);
```

- **¿Es la elección correcta acá?** discutible, y sobre todo **incoherente**: el mismo
  contrato roto produce un warning amarillo en un caso y una excepción en el otro. Ninguna
  de las dos elecciones está justificada en el código. → `DUP-001`

| Escenario | Comportamiento actual | ¿Correcto? |
|---|---|---|
| Marcadores ausentes | warn+continúa (indices) / throw (assignments) | incoherente |
| Solo `BEGIN`, falta `END` | `endIdx = -1` → se salta el archivo | sí, conservador |
| `END` antes de `BEGIN` | no se valida el orden | riesgo teórico, no observado |
| Marcadores duplicados | usa el primer `BEGIN` y el primer `END` | contenido intermedio se pierde |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

```bash
# ¿Qué índices del template traen los marcadores?
for f in templates/indices/*.md; do
  grep -q "AUTO-GENERATED:BEGIN" "$f" && echo "✓ $(basename $f)" || echo "✗ $(basename $f)"
done

# ¿Qué hace cada script cuando faltan?
grep -n "Sin marcadores" templates/boilerplate/scripts/indices-sync.js
grep -n "No se encontraron marcadores" templates/boilerplate/scripts/assignments-sync.js
```

**Qué pasó:**

- La partición 13/2 es exacta y coincide con la documentación.
- La ruta de fallo **existe y está implementada** en ambos scripts: ninguno reescribe un
  archivo sin marcadores, que es lo que importa. El contrato protege lo que promete
  proteger.
- La incoherencia de severidad está confirmada por lectura directa del código.

No pude ejecutar `indices-sync.js` de punta a punta en este contenedor: necesita
`typescript` instalado para parsear el AST y `node_modules` no está disponible. La
verificación de la ruta de fallo es por inspección de código, no por ejecución.
→ pendiente de re-comprobar al auditar `S-03`.

**Veredicto:**
- [x] Dispara ante su violación — comprobado por inspección; ejecución pendiente en `S-03`
- [x] Con severidad incoherente entre los dos productores → `DUP-001`

## 5. Depende de

| Artefacto / formato | Qué asume de él | ¿Declarado en templates-contract.md? |
|---|---|---|
| Literal exacto `<!-- AUTO-GENERATED:BEGIN -->` | Comparación por `indexOf`, sin tolerancia a espacios | **no** — corregido en el pase general: `templates-contract.md` no lo menciona |
| `.claude/temp/indices-cache.json` | Caché incremental por mtime | **no → `ACO-003`** |

`indices-cache.json` es un artefacto derivado que decide qué archivos se re-parsean. Si se
corrompe o queda desfasado, el índice se genera incompleto sin ningún aviso. No figura en
la tabla de dependencias.

## 6. Lo consumen

| Consumidor | Qué toma de acá | ¿Se rompe si cambio el formato? |
|---|---|---|
| `indices-sync.js` | Los límites de reescritura en 13 índices | sí (dependencia real, contrato no declarado) |
| `assignments-sync.js` | Ídem en 2 secciones de `ASSIGNMENTS.md` | sí |
| `index-syncer` (subagente) | Indirecto: corre `npm run indices:sync` | sí |
| Cualquier humano o agente que edite un índice | Debe escribir **fuera** de los marcadores | sí |

**¿Alguien lo consume sin que esté declarado?**

El último consumidor de la tabla es el interesante: es implícito y no tiene mecanismo. Un
agente que edita `indices/COMPONENTS.md` a mano **dentro** de los marcadores pierde su
trabajo en el siguiente `indices:sync`, en silencio. Ningún hook lo impide —
`harness-gate.js` cubre `indices/ANTI-PATTERNS.md`, que es justamente uno de los dos
**sin** marcadores. → `HUE-007`

## 7. Cobertura

- **Test que lo cubre:** ninguno directo. `doc-links.test.js` verifica referencias entre
  documentos, no marcadores.
- **¿El test ejecuta la ruta de fallo?** No hay test. Un test de tres líneas
  —"todo índice sin `AUTO-GENERATED:BEGIN` está en la lista de manuales"— habría
  convertido la partición 13/2 en un invariante en vez de una coincidencia afortunada.
  → `HUE-008`
- **¿Lo cubre `smoke-scripts.mjs`?** Cubre `indices:sync` como script de `package.json`,
  pero comprobar eso es parte de la ficha `S-06`.

## 8. Costo / beneficio

- **Qué cuesta:** dos líneas de comentario HTML por sección. Invisible para el agente:
  los comentarios ni siquiera se inyectan al contexto en la mayoría de los casos.
- **Qué evita:** que la automatización pise el contenido curado a mano — el problema que
  hace que la mayoría de los proyectos abandonen sus índices auto-generados.
- **Veredicto:** vale la pena. El contrato más barato y más limpio de los cinco.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `DUP-001` | DUP | Dos fail modes para el mismo contrato: `indices-sync` avisa y sigue, `assignments-sync` lanza |
| `ACO-003` | ACO | `indices-cache.json` decide qué se re-parsea y no está declarado como dependencia |
| `HUE-007` | HUE | Nada impide que un agente edite dentro de los marcadores y pierda el trabajo en el siguiente sync |
| `HUE-008` | HUE | Ningún test fija la partición 13 auto-generados / 2 manuales |

## Notas para el pase general

- Es el contrato **sano** del bloque: única fuente de verdad, documentación exacta, fail
  mode conservador. Sirve de vara para juzgar los otros cuatro.
- **Lente 1:** `indices-cache.json`, `spec-reflection-seen.json` (`C-03`) y
  `arch-last-failure.json` son tres artefactos derivados que nadie declaró. Buscar el
  resto en la segunda pasada de la Lente 1.
- **Lente 3:** el campo 4 quedó verificado por inspección, no por ejecución. Cerrar esa
  deuda en `S-03`, con `node_modules` instalado.
