# FICHA A — H-00 · El cableado (`.claude/settings.json`)

| | |
|---|---|
| **Archivo** | `templates/.claude/settings.json` |
| **Contexto** | B (harness) |
| **Bloque** | 1 hooks |
| **Revisado** | 2026-08-29 |
| **Estado** | cerrada |

---

## 1. Contrato

Declara qué hooks corren, en qué evento y **en qué orden**.

**¿Coincide con lo que dice su propia documentación?**

**No en el conteo.** `TEMPLATES-REGISTRY.md` dice «7 eventos, 16 hooks cableados». Los
eventos son 7, correcto — pero los comandos cableados son **17**: SessionStart 1,
UserPromptSubmit 1, PreToolUse `Edit|Write|MultiEdit` 4, PreToolUse `Bash` 2, PostToolUse
`Read` 1, PostToolUse `Edit|…` 2, PostToolUseFailure 1, PostCompact 1 y Stop 4. Son 16
desde `hooks/` más `post-edit.js` desde `.claude/scripts/`, que el registro no cuenta.
→ `INC-004`

Lo que **no** documenta —ni acá ni en ningún lado— es que el **orden dentro de cada
evento es semántico**, y que varias piezas dependen de él.

## 2. Disparo

- **Evento / invocación:** lo lee Claude Code al arrancar la sesión.
- **Precondiciones que asume:** que los hooks de un mismo array corren en el orden
  escrito, y que `node` resuelve rutas relativas al directorio del proyecto.

**¿Puede no dispararse cuando debería?**

Dos hooks quedan fuera del cableado, ambos a propósito: `context-enrichment-guard.js`
(opt-in documentado) y `validators/validate-file-contains.js` (lo invocan las skills desde
su frontmatter). Ambos casos están explicados en el código.

## 3. Fail mode

- **Actual:** el archivo no tiene fail mode propio; lo tiene cada hook.
- **¿Es la elección correcta acá?** El problema no es el fail mode sino que **el orden es
  un contrato tácito**. Tres dependencias de orden encontradas, ninguna declarada:

| Dependencia | Dónde | Qué se rompe al reordenar |
|---|---|---|
| `spec-reflection` (Stop 2º) antes que `sync-check` (Stop 3º) | `C-02` | `sync-check` **borra** `session-writes.json`; si sube de posición, el bloque de evidencia de `spec-reflection` deja de tener datos |
| `spec-gate` (1º) antes que `plan-injector` (4º) | `sdd/plan-injector.js` | El docblock lo dice: *«se ejecuta DESPUÉS de spec-gate.js»*. Es la única de las tres escrita en alguna parte |
| `discovery-tracker` (PostToolUse Read) antes de cualquier Edit | `C-01` | Si el Read y el Edit ocurren en el mismo turno, el Gate depende de que el PostToolUse ya haya corrido |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

No hay forma de ejecutar `settings.json`: lo interpreta el runtime de Claude Code, no un
proceso propio. Lo que sí se puede comprobar es si el cableado y los archivos coinciden, y
si el orden declarado es el que las piezas asumen.

```bash
# Todo comando cableado apunta a un archivo que existe
python3 - <<'EOF'
import json,os
s=json.load(open('templates/.claude/settings.json'))
cmds=[h['command'] for ev in s['hooks'].values() for g in ev for h in g['hooks']]
for c in cmds:
    p='templates/'+c.replace('node ','')
    print(('  ✓ ' if os.path.exists(p) else '  ✗ FALTA '), c)
EOF
```

**Qué pasó:**

Los **17** comandos apuntan a archivos existentes; ninguno cuelga. De paso queda medido el
conteo real, que es donde el registro se equivocó.

La ruta de fallo real de esta unidad **no es ejecutable**: un reordenamiento no rompe nada
de forma visible, rompe una suposición. Por eso el hallazgo es de tipo `ACO`, no `DEC`.

**Veredicto:**
- [x] Dispara ante su violación — n/a: el archivo es declarativo, no ejecuta
- [x] La ruta de fallo (reordenar) no está protegida por nada → `ACO-004`

## 5. Depende de

| Artefacto / formato | Qué asume de él | ¿Declarado en templates-contract.md? |
|---|---|---|
| Los 17 archivos de hook | Que existen en esas rutas | parcial: la tabla lista hooks, no comandos |
| `node` en el PATH | — | no |
| Orden de ejecución dentro de cada array | Semántico en tres casos | **no → `ACO-004`** |

## 6. Lo consumen

| Consumidor | Qué toma de acá | ¿Se rompe si cambio el formato? |
|---|---|---|
| Claude Code (runtime) | Todo | sí |
| `pre-write-guard.js` (File Protection) | Lo **protege**: bloquea editarlo | no |
| `TEMPLATES-REGISTRY.md` | Cuenta hooks y eventos | se desactualiza en silencio |

**¿Alguien lo consume sin que esté declarado?**

`harness-gate.js` **no** cubre `settings.json` (su `isCapabilityScript` solo matchea
`.js`), pero `pre-write-guard.js` sí lo protege en su capa 1. La protección existe; está
en el hook que no lo documenta.

## 7. Cobertura

- **Test que lo cubre:** ninguno. No existe un test que verifique que los comandos
  cableados apuntan a archivos reales, ni que el orden se mantiene.
- **¿El test ejecuta la ruta de fallo?** No hay test. Un `settings.json` que apunte a un
  hook renombrado falla en silencio en el proyecto del usuario: Claude Code no encuentra el
  comando y el guardrail simplemente no corre. → `HUE-009`
- **¿Lo cubre `doc-links.test.js`?** No: verifica referencias entre documentos `.md`.

## 8. Costo / beneficio

- **Qué cuesta:** cero contexto. El archivo no se inyecta.
- **Qué evita:** es la pieza que convierte 17 scripts sueltos en un sistema.
- **Veredicto:** vale la pena, obviamente. El problema es que carga un contrato de orden
  que nadie escribió.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `ACO-004` | ACO | El orden dentro de cada evento es semántico en tres casos y no está declarado en ninguna parte |
| `HUE-009` | HUE | Ningún test verifica que los comandos cableados apunten a archivos existentes |
| `INC-004` | INC | `TEMPLATES-REGISTRY.md` dice 16 hooks cableados; son 17 (no cuenta `post-edit.js`) |

## Notas para el pase general

- **Lente 1:** el orden de ejecución es un contrato compartido que no está en la lista de
  cinco. Considerar agregarlo como `C-06` retroactivamente.
- **Lente 4:** cuatro hooks en `Stop` pueden emitir aviso en el mismo cierre
  (`hotfix-autoclose`, `spec-reflection`, `sync-check`, `context-guardian`). Medir cuántos
  hablan a la vez en un cierre real.
