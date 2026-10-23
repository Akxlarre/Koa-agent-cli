---
name: review
description: Juzgar un cambio de codigo contra la rubrica arquitectonica y de seguridad del proyecto antes de commitear. Usar cuando la tarea toca mas de 2 archivos, cuando se creo o modifico un Facade/Repository, cuando el diff toca supabase/migrations/, auth o guards, o antes de cualquier commit no trivial.
user-invocable: true
---

Los hooks del proyecto validan **sintaxis**: `*ngIf`, `@Input()`, colores hardcodeados,
falta de `OnPush`. Todo eso es regex y AST, y se atrapa solo.

Lo que ningun hook atrapa es el **diseno**: una facade que no respeta su contrato,
un Repository saltado, un Smart component disfrazado de Dumb, un nombre que
contradice `context/domain.md`. Esta skill cubre ese hueco.

## Cuando corre, y con cuantos jueces

El disparo es por **riesgo**, no por conteo de archivos. Una linea en una policy
RLS es mas peligrosa que cinco archivos de SCSS, y el criterio "mas de 2 archivos"
no distingue.

| Riesgo | Que lo define | Jueces |
|---|---|---|
| 🟢 Bajo | Solo `.scss`, docs, comentarios, tests | Ninguno — commitea |
| 🟡 Medio | Logica de componente, facade, repository, servicio | `code-judge` |
| 🔴 Alto | `supabase/migrations/**`, auth, guards, `has-role`, RPC, Storage | `code-judge` **+** `security-judge`, en paralelo |

Un diff 🔴 corre los dos jueces aunque toque un solo archivo. Un diff 🟢 no corre
ninguno aunque toque veinte.

## Pasos

1. Confirma que hay algo que juzgar:

   ```bash
   git diff --stat HEAD
   ```

   Si no hay cambios, detente y dilo. No revises codigo ya commiteado salvo que
   el humano lo pida explicitamente.

   **Se revisa por slice.** Si el diff pasa de ~400 lineas de codigo de producto
   (sin contar tests ni docs), no es un slice: es varios, y un juez que lee
   miles de lineas aprueba lo que no llego a mirar. Partilo y revisa cada parte;
   el `commit-guard` bloquearia ese commit igual (`COMMIT-02`).

2. Deja el diff en un archivo para el juez:

   ```bash
   mkdir -p .claude/temp && git diff HEAD > .claude/temp/review-diff.patch
   ```

   Redirigido a archivo, no a tu contexto: el diff completo puede ser enorme y no
   necesitas leerlo — lo lee el juez en su propia ventana. Si hay algo en stage,
   usa `git diff --staged` en su lugar.

3. Clasifica el riesgo del diff con la tabla de arriba:

   ```bash
   git diff --name-only HEAD
   ```

   Si aparece cualquier ruta 🔴 (`supabase/migrations/`, auth, guards, `has-role`),
   el riesgo es alto — aunque sea una sola linea.

4. Delega en los jueces. Ambos corren con un modelo mas capaz que el generador a
   proposito: el evaluador debe razonar mejor que quien escribio el codigo, no
   igual.

   Pasales: la ruta del patch y, en una frase, que se supone que hace el cambio
   (sacala del task-spec activo en `.claude/temp/` si existe).

   - **Riesgo 🟡** — solo `code-judge`.
   - **Riesgo 🔴** — `code-judge` **y** `security-judge`, lanzados **en la misma
     respuesta** para que corran en paralelo. Son ejes distintos: uno pregunta si
     el diseno esta bien, el otro si se puede romper. Un cambio puede aprobar uno
     y reprobar el otro, y esa combinacion es justamente la que importa —
     arquitectura impecable con la policy RLS al reves.

   No los encadenes: lanzados por separado pagas dos esperas por dos analisis que
   no dependen entre si.

5. Actua sobre los veredictos. Con dos jueces, **manda el peor**:

   | Veredicto | Que haces |
   |---|---|
   | Ambos `APROBADO` | Sigue al commit |
   | Alguno `APROBADO CON RESERVAS` | Muestra los hallazgos menores al humano y sigue |
   | Alguno `RECHAZADO` | Arregla los bloqueantes y vuelve al paso 2 |

   Un `RECHAZADO` de `security-judge` no se negocia con un `APROBADO` de
   `code-judge`. Que el diseno este bien no hace segura una policy abierta.

6. **Maximo 2 rondas.** Si tras el segundo intento el veredicto sigue siendo
   `RECHAZADO`, para y escala al humano con los hallazgos que quedaron abiertos.
   Un juez y un generador iterando sin limite se atascan negociando en vez de
   arreglar — por eso el corte es duro.

7. Si un juez reporta un `ANTI-PATRON NUEVO DETECTADO`, agregalo a
   `indices/ANTI-PATTERNS.md`. Ese indice es la memoria de errores del proyecto:
   lo que no se registra se repite.

## Por que un subagente y no una revision inline

El juez necesita leer las reglas de la rubrica completas para calificar bien.
Cargarlas en el contexto principal desplazaria el codigo en el que estas
trabajando. El subagente las lee en su propia ventana y devuelve treinta lineas
de veredicto.

## Por que el diff va por archivo

`code-judge` y `security-judge` solo tienen `Read`, `Grep` y `Glob` — **sin
`Bash`**. Podrian haber corrido `git diff` ellos mismos, pero entonces tendrian
shell, y con shell pueden escribir con `>`. La regla "el juez no arregla nada"
pasaria a depender de que el juez se porte bien.

Pasarles el diff como archivo es lo que permite quitarles `Bash` sin dejarlos
ciegos. Un juez que puede editar el codigo que juzga no es un juez.

## Por que dos jueces y no una rubrica mas larga

Agregar criterios de seguridad a `code-judge` habria sido mas barato: un solo
subagente, una sola llamada. No funciona.

La seguridad como criterio C11 de once compite por atencion con diez criterios de
arquitectura, y pierde: el modelo llega ahi con el analisis ya encaminado hacia
capas y contratos. Una escalada de privilegios no se encuentra de pasada — hay que
ir a buscarla con esa intencion desde el primer token.

Por eso `security-judge` arranca su ventana con una sola pregunta: *¿como rompo
esto?* Y por eso corre en paralelo y no despues: no debe ver el veredicto de
arquitectura antes de emitir el suyo.
