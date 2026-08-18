---
name: review
description: Juzgar un cambio de codigo contra la rubrica arquitectonica del proyecto antes de commitear. Usar cuando la tarea toca mas de 2 archivos, cuando se creo o modifico un Facade/Repository, o antes de cualquier commit no trivial.
user-invocable: true
---

Los hooks del proyecto validan **sintaxis**: `*ngIf`, `@Input()`, colores hardcodeados,
falta de `OnPush`. Todo eso es regex y AST, y se atrapa solo.

Lo que ningun hook atrapa es el **diseno**: una facade que no respeta su contrato,
un Repository saltado, un Smart component disfrazado de Dumb, un nombre que
contradice `context/domain.md`. Esta skill cubre ese hueco.

## Pasos

1. Confirma que hay algo que juzgar:

   ```bash
   git diff --stat HEAD
   ```

   Si no hay cambios, detente y dilo. No revises codigo ya commiteado salvo que
   el humano lo pida explicitamente.

2. Delega en el subagente `code-judge`. Corre con un modelo mas capaz que el
   generador a proposito — el evaluador debe razonar mejor que quien escribio
   el codigo, no igual.

   Pasale: los archivos tocados y, en una frase, que se supone que hace el cambio
   (sacala del task-spec activo en `.claude/temp/` si existe).

3. Actua sobre el veredicto:

   | Veredicto | Que haces |
   |---|---|
   | `APROBADO` | Sigue al commit |
   | `APROBADO CON RESERVAS` | Muestra los hallazgos menores al humano y sigue |
   | `RECHAZADO` | Arregla los bloqueantes y vuelve al paso 1 |

4. **Maximo 2 rondas.** Si tras el segundo intento el veredicto sigue siendo
   `RECHAZADO`, para y escala al humano con los hallazgos que quedaron abiertos.
   Un juez y un generador iterando sin limite se atascan negociando en vez de
   arreglar — por eso el corte es duro.

5. Si el juez reporta un `ANTI-PATRON NUEVO DETECTADO`, agregalo a
   `indices/ANTI-PATTERNS.md`. Ese indice es la memoria de errores del proyecto:
   lo que no se registra se repite.

## Por que un subagente y no una revision inline

El juez necesita leer las reglas de la rubrica completas para calificar bien.
Cargarlas en el contexto principal desplazaria el codigo en el que estas
trabajando. El subagente las lee en su propia ventana y devuelve treinta lineas
de veredicto.
