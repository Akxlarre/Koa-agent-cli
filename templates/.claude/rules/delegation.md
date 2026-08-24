---
paths:
  - "src/app/**/*.ts"
  - "src/app/**/*.html"
  - "supabase/migrations/**"
---

# Regla: Delegación en subagentes

Los subagentes de `.claude/agents/` existen por una razón concreta: tu ventana de
contexto es un presupuesto, y la mayor parte se gasta en output que necesitas una
sola vez. Un `lint:arch` completo son miles de tokens de los que importan diez
líneas. Un índice entero para descubrir que el componente ya existía.

Un subagente corre en su propia ventana y te devuelve el resumen.

## Cuándo delegar

| Situación | Subagente | Por qué |
|---|---|---|
| Vas a crear un componente, facade o servicio | `discovery-scout` | Te dice qué reutilizar antes de que escribas un duplicado |
| Terminaste de escribir y quieres validar | `arch-auditor` | Devuelve violaciones accionables, no output de compilador |
| Vas a escribir un Repository, una query o una migración | `supabase-schema` | El esquema real sale de las migraciones, no de tu memoria |
| Vas a commitear algo no trivial | `/review` → `code-judge` | Juzga el diseño, que es lo que el regex no ve |
| Cerraste la tarea y tocaste `src/app/` | `index-syncer` | Reconcilia `indices/` con el código real |

## Cuándo NO delegar

Delegar no es gratis: cada subagente es una llamada completa al modelo, y arranca
sin nada de lo que ya sabes. Hazlo tú mismo cuando:

- **Ya tienes la respuesta en contexto.** Si Session Start te inyectó
  `COMPONENTS.md` y la pregunta es "¿existe un `app-kpi-card`?", léelo. Llamar a
  `discovery-scout` para eso paga una llamada por un dato que ya tienes.
- **El cambio es de un archivo y ya lo entiendes.** Renombrar una variable no
  necesita comité.
- **Necesitas el detalle, no el resumen.** Los subagentes comprimen a propósito.
  Si vas a refactorizar un servicio, lee el archivo — un resumen de treinta líneas
  te va a hacer perder el matiz que importa.
- **Estás dentro de un subagente.** No encadenes: devuelve tu resultado y deja que
  el agente principal decida el siguiente paso.

## Qué pedirles y qué no

Los subagentes **reportan**, no deciden. `arch-auditor` te dice qué está mal;
elegir el arreglo es tuyo. `code-judge` emite un veredicto; acatarlo o discutirlo
con el humano es tuyo.

Dos tienen permisos de escritura deliberadamente acotados:

- `index-syncer` escribe **solo** en `indices/`. Nunca en `src/app/`.
- `code-judge` no tiene `Write`, `Edit` **ni `Bash`**. Recibe el diff como archivo.
  No es una cuestión de confianza: un juez que puede editar el código que juzga
  deja de ser un juez, y con `Bash` podría escribir usando `>`.

Si un subagente te devuelve algo que contradice lo que ves en el filesystem, **gana
el filesystem** y lo reportas. Los índices se desincronizan; el código no miente.

## Delegar no te exime

El Discovery Gate, el Architect Guard y el Circuit Breaker se aplican igual a lo
que escribas después de consultar. Un veredicto de `discovery-scout` no es permiso
para saltarte una regla — es información para no duplicar trabajo.
