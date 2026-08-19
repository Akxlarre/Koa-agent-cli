---
name: plan
description: Generar task-spec antes de implementar. Obliga al agente a declarar intencion antes de escribir codigo. Usar SIEMPRE antes de una tarea no trivial (>2 archivos o >1 dominio).
user-invocable: true
hooks:
  Stop:
    - hooks:
        - type: command
          command: >-
            node $CLAUDE_PROJECT_DIR/.claude/hooks/validators/validate-file-contains.js
            --directory .claude/temp
            --pattern "task-spec-*.md"
            --max-age 60
            --require-file
            --contains "## Objetivo"
            --contains "## Artefactos afectados"
            --contains "## Reglas que aplican"
            --contains "## Pasos de ejecucion"
            --contains "## Criterio de done"
---

Antes de escribir cualquier codigo, crea un task-spec en `.claude/temp/task-spec-{TIMESTAMP}.md`.

Usa formato `YYYYMMDD-HHMMSS` para el timestamp: los hooks toman **el ultimo spec
por orden alfabetico**, y ese formato hace que orden alfabetico y cronologico
coincidan.

## Pasos

1. Delega el descubrimiento en el subagente `discovery-scout`. Te devuelve que
   reutilizar y que crear sin volcarte los indices enteros al contexto.
   (Esto tambien satisface el Discovery Gate.)

2. Crea el archivo de spec en `.claude/temp/`:

```markdown
# Task Spec — {TIMESTAMP}

## Objetivo
[Que problema resuelve esta tarea — en 1-2 frases]

## Contexto de negocio
[Por que es necesario — referencia a context/brief.md si existe]

## Reutilizacion (segun discovery-scout)
[Que ya existe y se usa tal cual, en vez de recrearlo]

## Artefactos afectados
| Archivo | Cambio | Indice a actualizar |
|---------|--------|---------------------|
| `src/app/features/...` | Crear / Modificar / Eliminar | COMPONENTS.md |

## Reglas que aplican
[Lista de reglas relevantes: ARCH-01, A11Y-01, VISUAL-03, etc.]

## Pasos de ejecucion
- [ ] [paso 1 — concreto y verificable]
- [ ] [paso 2]

## Criterio de done
- [ ] ng build sin errores
- [ ] npm run lint:arch sin violaciones
- [ ] /review con veredicto APROBADO
- [ ] indices/ actualizados con nuevos artefactos
- [ ] Tests unitarios escritos (si aplica)
```

3. Muestra el task-spec al usuario y espera aprobacion antes de escribir codigo.

## Las casillas no son decorativas

**Marca `- [x]` en cuanto completes cada paso, no al final.** Dos mecanismos
dependen de eso:

- **Spec Reflection** (Stop hook) lee las casillas al terminar tu respuesta y te
  frena si quedan pendientes sin explicacion. Un criterio de done que nadie
  verifica no es un criterio, es un adorno.
- **Compact Recovery** (PostCompact) re-inyecta **solo las casillas abiertas**.
  Lo ya hecho se descarta del contexto. Si no las marcas, tras una compactacion
  vas a recuperar la lista completa y reharas trabajo terminado.

## El formato lo valida un hook, no la buena voluntad

Esta skill declara en su frontmatter un hook de `Stop` que verifica que el spec
exista y contenga las cinco secciones obligatorias. Si falta una, no terminas.

Es a proposito: pedirle a un agente en prosa que "genere un archivo con estas
secciones" es una guideline, y las guidelines se ignoran bajo presion de contexto.
Los encabezados de arriba son un contrato — `spec-reflection.js` y
`compact-recovery.js` los leen por nombre. Si los renombras aqui, se rompen alla.

## Por que

La intencion queda registrada y es trazable. Evita implementaciones sorpresa
y permite al humano redirigir antes de que se escriba codigo dificil de revertir.
