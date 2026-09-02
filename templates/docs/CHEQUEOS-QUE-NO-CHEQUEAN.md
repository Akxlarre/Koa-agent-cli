# Los chequeos que no chequean

Un chequeo que sale 0 sin haber mirado nada es **peor que no tenerlo**. El ausente
se nota; el decorativo da sensación de estar protegido, y esa sensación es lo que
hace que nadie vuelva a mirar.

Este proyecto trae dos comandos que no preguntan si los chequeos pasan, sino si
**pueden fallar**. Es la pregunta que ningún CI hace.

```bash
npm run smoke:scripts        # ¿cada script de package.json comprueba algo?
npm run lint:arch:provocar   # ¿cada regla del linter dispara ante su violación?
```

Tardan. Van al cerrar una sesión o antes de publicar, no en cada guardado.

---

## De dónde salieron

Tres casos reales, todos del mismo proyecto, todos vivos durante meses:

**`tsc --noEmit -p tsconfig.json` compilaba cero archivos.** El `tsconfig.json`
raíz del Angular CLI es *solution-style*: `"files": []` más `references`. El
comando sale 0 sin mirar un solo archivo. Cuando por fin se apuntó a
`tsconfig.app.json` y `tsconfig.spec.json`, aparecieron **7 errores de tipos
dormidos** — entre ellos dos `pending()` de Jasmine que eran `ReferenceError`
esperando a que el fixture cambiara.

**`node --test supabase/functions/**/*.test.ts` fallaba siempre.** Son tests de
Deno con imports por URL; Node no los entiende. El script existía, se invocaba, y
su error se leía como "hay tests rotos". Con `deno test` pasan 40 tests que nunca
habían corrido.

**ARCH-26 estaba escrita, testeada y sin cablear.** Detector, tests en verde, cero
llamadores. Auditaba exactamente nada.

Los tres son el mismo modo de fallar: **algo que existe, está documentado, y nadie
ejecuta.**

---

## `smoke:scripts` — dos preguntas distintas

Por cada script de `package.json`:

1. **¿Pasa en un proyecto sano?** Si no, está roto — no es que encontró algo.
2. **¿Falla cuando algo está mal?** Si no, es decorativo.

La segunda es la que encuentra el caso `tsc`. Para los scripts que comprueban
código, el smoke **introduce un defecto a propósito** y exige que el script se dé
cuenta. Para los runners de tests, exige que su salida diga cuántos corrió: cero
tests con exit 0 es el mismo engaño con otra cara.

Los scripts que no terminan (`start`, `watch`), los que necesitan servicios de
afuera (`supabase:*`, `claude:*`) y los destructivos (`*reset*`) se saltean y se
listan. Los que no tienen forma declarada de fallar se reportan como
**sin comprobar**: no hacen fallar el smoke, pero se ven. Lo que no pueden es
pasar inadvertidos.

El archivo tocado se restaura siempre, con el respaldo en el temp del sistema —
un `.bak` olvidado en `src/` también rompe el build.

### De qué depende el smoke, dicho en voz alta

Dos cosas, y hasta hace poco ninguna estaba escrita (`ACO-010`).

**El nombre exacto de cada script.** `COMPROBACIONES` indexa por `lint:arch`,
`typecheck`, `test:ci`. Renombrar uno deja su comprobación huérfana, y una
huérfana no rompe nada: el script pasa a *sin comprobar*, que es informativo.
El smoke ahora lista las huérfanas en cada corrida, y del lado del generador hay
un test que las cuenta contra los scripts que el scaffolder escribe.

**Que la regla que el defecto viola siga activa.** El defecto arquitectónico es
un componente sin `OnPush`, o sea `ARCH-04`. Si esa regla se desactivara,
`lint:arch` pasaría con el defecto adentro y el smoke lo llamaría *decorativo*:
acusaría al linter de no mirar cuando el que dejó de mirar es el defecto. El
defecto declara su regla y se comprueba contra `architect.js` antes de juzgar;
si no está, el veredicto es *sin comprobar* y dice por qué.

## `lint:arch:provocar` — el paso siguiente al cableado

`rule-wiring.js` (ARCH-26) ya comprueba que toda regla registrada esté **cableada**.
Esto comprueba que ese cableado, puesto delante de una violación real, **dispare**.

Por cada regla con fixture: se arma un sandbox con el archivo mínimo que la viola,
se corre el linter con `cwd` ahí, y se exige que su salida la nombre. El linter no
necesitó cambios: ya lee de `process.cwd()`.

**El fixture es el archivo más chico posible.** Uno que viola tres reglas no
permite saber cuál disparó, y el día que una se rompa las otras dos la tapan.
Eso se mide: por cada fixture se anotan **todos** los códigos que la salida
nombra, y cualquiera que no sea el suyo tiene que estar declarado en `COLATERAL`
—hoy dos, los dos por un `.spec.ts` que falta— o la corrida falla. Esa lista
sólo puede achicarse.

### El contrato del que cuelga todo esto

El linter escribe `[ARCH-04]` **entre corchetes** cuando esa regla reportó algo,
y no lo escribe cuando no reportó nada: por eso el resumen «📋 Reglas validadas»
del final lista los códigos pelados. Es una convención de `architect.js` que la
provocación lee, y no estaba declarada en ninguna parte (`ACO-009`).

Vale la pena saber en qué dirección se rompe. Poniéndole corchetes a esa línea
del resumen —cuatro caracteres, una edición de consistencia perfectamente
razonable— y desactivando un detector:

```
resumen sin corchetes    🔇 ARCH-10 — NO dispara               exit 1
resumen con corchetes    ✅ 28 regla(s) y todas disparan       exit 0
```

Verde entero con una regla muerta adentro: el mecanismo que existe para cazar
chequeos decorativos, vuelto decorativo. El chequeo de colateral lo caza — con
el resumen entre corchetes cada fixture nombra 27 códigos ajenos y la corrida se
cae —, y el aviso vive en `reportError`, que es donde se rompe.

Las reglas sin fixture quedan en `scripts/provocacion.baseline.json`, que **sólo
puede achicarse**. Exigir un fixture para las 25 el primer día garantizaría que
alguien desactive el chequeo entero. Lo que sí falla es agregar una regla nueva
sin fixture: el momento de escribirlo es cuando se escribe la regla.

```bash
node scripts/provocar-reglas.mjs --actualizar-baseline   # después de sumar fixtures
```

---

## Cómo sumar un fixture

En `scripts/lib/provocacion.js`, agregá la entrada a `FIXTURES` y sacá la regla
del baseline. El fixture tiene que violar **su** regla y ninguna otra evidente —
por eso todos los componentes traen `OnPush` salvo el de ARCH-04, que si no
dispararían ARCH-04 de rebote. Hay un test que lo comprueba.

Después: `npm run lint:arch:provocar`. Si la regla no dispara, no es el fixture el
que está mal necesariamente — puede ser que la regla nunca haya funcionado.
