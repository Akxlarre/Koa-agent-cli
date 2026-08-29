---
name: eval-jueces
description: Mide si los jueces (`code-judge`, `security-judge`) detectan de verdad lo que su rubrica promete. Corre el corpus de fixtures de `.claude/evals/` contra el juez y reporta recall, falsos positivos y precision de criterio. Usar SIEMPRE despues de editar el prompt de un juez o de agregar un criterio a su rubrica, y antes de confiar en un veredicto nuevo.
user-invocable: true
---

# Eval de jueces

`scripts/provocar-reglas.mjs` ya hace esto para el linter: arma un sandbox con el
archivo que viola la regla, corre el linter, y exige que dispare. Su comentario de
cabecera dice por que existe:

> *Una regla que nunca se pudo hacer fallar es decoracion: da la sensacion de estar
> protegido, que es peor que saberse desprotegido.*

Eso vale igual para `code-judge` y `security-judge`, y ahi nadie lo verifica. Un
juez con una rubrica de ocho criterios y cero pruebas de que detecte algo es
exactamente la decoracion que esa frase describe. Esta skill cierra ese hueco.

## Lo que cambia respecto de provocar reglas

No es el mismo problema con otra herramienta. Tres diferencias mandan sobre el
diseño:

| | Linter | Juez |
|---|---|---|
| Costo por corrida | cero | una llamada al modelo por fixture |
| Determinismo | total | estocastico: puede acertar 9 de 10 veces |
| Metrica | disparo / no disparo | recall **y** falsos positivos |

La tercera es la que mas importa. **Un juez que rechaza todo saca 100% de
recall.** Si el corpus solo tuviera fixtures vulnerables, premiaria al paranoico,
y un auditor que grita lobo se vuelve ruido que el equipo aprende a ignorar. Por
eso casi la mitad del corpus son controles limpios que el juez **debe** aprobar,
incluidas dos trampas que se parecen a una vulnerabilidad y no lo son.

## El corpus

`.claude/evals/fixtures/*.md`. Cada archivo es un caso con verdad de campo en el
frontmatter:

```yaml
juez: security-judge        # a quien se le pasa
esperado: RECHAZADO         # o APROBADO
criterio: S2                # el criterio que debe nombrar; "-" en los limpios
tambien_valido: [S5]        # opcional: criterios extra que NO son falsos positivos
nombre: ...
```

El cuerpo explica por que es vulnerable (o por que no), cual es el camino de
explotacion esperado, por que los checks deterministas no lo ven, y trae el diff
en un bloque ```diff.

Un fixture apunta a **un solo** criterio como causa, igual que en
`provocacion.js`: si apuntara a tres no se sabria cual disparo, y el dia que uno
se rompa los otros dos lo taparian.

Pero un fallo real puede encadenar. Borrar la proteccion de `role` habilita la
escalada (S2) y, como consecuencia, deja la autorizacion del front sin respaldo
(S5). El juez que reporta los dos no se equivoca: esta siguiendo el efecto. Por
eso `criterio` es la **causa** —el que tiene que aparecer si o si— y
`tambien_valido` lista los encadenados que no cuentan como ruido. Un criterio
fuera de ambas listas si es ruido, y se reporta.

## Pasos

1. Lee `.claude/evals/baseline.json` y los fixtures de `.claude/evals/fixtures/`.
   Si el usuario nombro un juez, filtra por `juez:`.

2. **Por cada fixture, uno a la vez:**

   a. Escribe su bloque ```diff en `.claude/temp/review-diff.patch`.

   b. Lanza el juez que dice el frontmatter con el `Task` tool, con el mismo
      prompt que usaria `/review`: la ruta del patch y una frase de que se supone
      que hace el cambio. **No le adelantes que es un fixture, ni que criterio
      esperas, ni si es vulnerable.** Un juez al que le avisas que busque una
      escalada de privilegios la encuentra siempre — y no habrias medido nada.

   c. Parsea de su respuesta la linea `VEREDICTO:` y, si rechazo, que criterios
      marco `RECHAZADO`.

   Van de a uno porque los jueces leen una ruta fija
   (`.claude/temp/review-diff.patch`): dos en paralelo se pisarian el archivo.

3. Clasifica cada resultado:

   | Caso | Resultado |
   |---|---|
   | Esperaba RECHAZADO, obtuvo RECHAZADO con el criterio correcto | ✅ acierto |
   | Esperaba RECHAZADO, obtuvo RECHAZADO con otro criterio | ⚠️ acierto por razon equivocada |
   | Esperaba RECHAZADO, obtuvo APROBADO | ❌ **fuga** |
   | Esperaba APROBADO, obtuvo APROBADO | ✅ acierto |
   | Esperaba APROBADO, obtuvo RECHAZADO | ❌ **falso positivo** |

   `APROBADO CON RESERVAS` cuenta como APROBADO para el veredicto, pero anotalo:
   reservas repetidas sobre los mismos limpios son un juez poniendose nervioso.

4. Audita el baseline. Cruza los criterios que la rubrica del juez declara contra
   los que tienen fixture:
   - Criterio nuevo sin fixture y **fuera** del baseline → falla. El momento de
     escribir el fixture es cuando se escribe el criterio.
   - Criterio en el baseline que **ya** tiene fixture → el baseline quedo viejo,
     hay que achicarlo. Un baseline que no se achica es una lista de excusas.

5. Reporta:

   ```
   ## Eval de jueces — <juez>

   | Fixture | Esperado | Obtenido | Resultado |
   |---|---|---|---|

   Recall .................. n/n vulnerables detectados
   Falsos positivos ........ n/n limpios rechazados
   Criterio correcto ....... n/n de los detectados
   Sin fixture todavia ..... <lista del baseline>
   ```

## Cuando falla

Falla duro con **una sola** fuga o **un solo** falso positivo. No hay umbral que
negociar: el corpus es chico y curado a mano, no una muestra estadistica. Un
fixture que el juez no detecta es un agujero conocido en la rubrica, y un limpio
que rechaza es ruido que ya esta produciendo.

Criterio equivocado no falla, pero se reporta: acertar el veredicto por la razon
equivocada significa que el hallazgo que le mostraria al humano seria el
incorrecto.

## Una corrida no es una medicion

El juez es estocastico. Puede detectar un fixture nueve de cada diez veces y
fallar justo en tu corrida — o al reves, acertar de casualidad uno que
normalmente se le escapa.

Una corrida es un **smoke test**: sirve para saber si algo se rompio del todo.
Para medir de verdad —antes de dar por buena una reescritura de rubrica— corre el
corpus tres veces y mira la dispersion. Un criterio que acierta 2 de 3 no esta
bien: esta a un lanzamiento de moneda de dejar pasar la vulnerabilidad.

Si el usuario pide repeticiones, corre el corpus completo N veces y reporta
aciertos sobre intentos por fixture, no solo el ultimo resultado.

## Lo que esta skill NO mide

Mide **jueces**, que emiten un veredicto estructurado y por lo tanto se pueden
comparar contra una verdad de campo.

No mide las **reglas de contexto** (`visual-system.md`, `architecture.md`, las que
se inyectan al editar codigo). Esas no producen veredicto: influyen en la
generacion, y evaluarlas exige generar codigo con y sin ellas y comparar el
resultado — otro problema, mucho mas caro, y todavia sin resolver aca.

Decirlo importa: que esta skill este en verde significa que los jueces detectan lo
que prometen, no que el harness completo funcione.
