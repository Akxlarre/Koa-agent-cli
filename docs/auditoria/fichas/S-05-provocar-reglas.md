# FICHA A — S-05 · `scripts/provocar-reglas.mjs`

| | |
|---|---|
| **Archivo** | `templates/boilerplate/scripts/provocar-reglas.mjs` (119 líneas) · **Contexto** B · **Bloque** 2 · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

Por cada regla del linter, arma un sandbox con el archivo que la viola, corre el linter ahí
y exige que su salida la nombre. **Una regla que no dispara ante su propia violación es
decoración.**

**¿Coincide con lo que dice su propia documentación?**

Sí, exactamente. El docblock es el mejor del repositorio: declara el mecanismo, declara la
excepción (`provocacion.baseline.json`, que *«sólo puede achicarse»*) y declara qué hace
fallar el chequeo (agregar una regla nueva sin fixture).

**Este es el script que define la tesis del proyecto.** Por eso su cobertura real importa
más que la de cualquier otra pieza.

## 2. Disparo

- **Invocación:** `npm run lint:arch:provocar`. No está cableado a ningún hook: se corre
  a mano, al cerrar una sesión.
- **Mecanismo:** por cada fixture, `mkdtemp` → escribe el archivo que viola → corre el
  linter en ese sandbox → exige que la salida nombre el código.
- **Modo:** `--actualizar-baseline` reescribe la lista de excepciones.

**¿Puede no dispararse cuando debería?**

Es al revés: **hoy dispara siempre**, y por el motivo equivocado. Ver campo 4.

## 3. Fail mode

- **Actual:** `exit 1` si una regla con fixture no dispara, si hay reglas nuevas sin
  fixture, o si el baseline quedó obsoleto.
- **¿Es la elección correcta acá?** Sí, y el ratchet está bien diseñado: el baseline solo
  puede achicarse, así que la deuda no puede crecer en silencio.

| Escenario | Comportamiento | ¿Correcto? |
|---|---|---|
| Regla con fixture que no dispara | `exit 1` nombrándola | sí |
| Regla nueva sin fixture y fuera del baseline | `exit 1` | sí — es el ratchet funcionando |
| Regla del baseline eliminada del linter | `exit 1` «el baseline quedó viejo» | sí |
| **24 de 28 reglas sin fixture** | **pasan sin comprobar** | es el diseño, y es el problema |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:** correrlo. Sandbox con el boilerplate real y
`typescript@5.9`.

```bash
node scripts/provocar-reglas.mjs
```

**Qué pasó:**

```
🎯 Provocación de reglas — ¿cada una puede fallar?

✅ ARCH-01 — dispara ante su violación
✅ ARCH-04 — dispara ante su violación
✅ ARCH-03 — dispara ante su violación
✅ ARCH-05 — dispara ante su violación

Sin fixture todavía (24/28): ARCH-11, ARCH-18, ARCH-21, ARCH-22, ARCH-15, ARCH-16,
ARCH-17, ARCH-19, ARCH-24, ARCH-23, ARCH-25, ARCH-26, NAV-01, A11Y-03, ICON-01,
ARCH-02, ARCH-06, ARCH-07, ARCH-08, ARCH-09, ARCH-10, SEC-RLS-01, SEC-RLS-02, SEC-RLS-03

🆕 3 regla(s) nuevas sin fixture: SEC-RLS-01, SEC-RLS-02, SEC-RLS-03
   El momento de escribir el fixture es cuando se escribe la regla.

exit=1
```

**Dos hallazgos, y el segundo es el que importa.**

**1. El script sale en 1 sobre un proyecto recién generado.** Las tres reglas `SEC-RLS`
existen en `architect.js` y no están en `provocacion.baseline.json` (21 entradas, ninguna
`SEC-RLS`). El ratchet está haciendo su trabajo —detecta reglas nuevas sin fixture— pero
nadie actualizó el baseline al agregarlas, así que `npm run lint:arch:provocar` viene
**rojo de fábrica** en cualquier proyecto scaffoldeado hoy. → `INC-009`

**2. El auditor de las reglas cubre 4 de 28 — el 14%.**

```
FIXTURES en lib/provocacion.js: ARCH-01, ARCH-03, ARCH-04, ARCH-05
```

Las cuatro comprobadas son las más antiguas y las más simples: import de Supabase en UI,
spec compañero, `OnPush`, `@angular/animations`. **Las 24 sin comprobar incluyen todo lo
que se agregó después**: la disciplina de clases del design system con sus ratchets
(`ARCH-15/16/17/19`), el contraste AA (`ARCH-25`), las colisiones con Tailwind
(`ARCH-22/26`), la integridad de navegación (`NAV-01`), la accesibilidad (`A11Y-03`) y las
tres de RLS —que son las únicas de **seguridad** del linter.

El `_comentario` del baseline lo dice sin rodeos: *«esta lista sólo puede achicarse»*. En
la práctica la lista es el 86% de las reglas y nunca se achicó lo suficiente. `ARCH-24` y
`ARCH-26` —las dos que la documentación cita como «estuvieron muertas hasta que existió
`provocar-reglas`»— **siguen en el baseline, sin fixture**: el episodio que motivó escribir
este script no está cubierto por el script. → `DEC-004`

**Veredicto:**
- [x] Dispara ante su violación — comprobado: el ratchet detectó las 3 reglas nuevas
- [x] Cubre el 14% de lo que dice auditar → `DEC-004`
- [x] Rojo de fábrica en un proyecto nuevo → `INC-009`

## 5. Depende de

| Artefacto / formato | Qué asume | ¿Declarado? |
|---|---|---|
| `lib/provocacion.js` → `FIXTURES` | 4 entradas con `ruta` y `contenido` | sí, por import |
| `provocacion.baseline.json` | `{ _comentario, sinFixture[] }` | sí |
| `scripts/architect.js` | Que su salida nombre el código de la regla | **no → `ACO-009`** |
| El objeto `RULES` de `architect.js` | Para saber qué reglas existen | sí, por lectura |

## 6. Lo consumen

| Consumidor | Qué toma | ¿Se rompe si cambio el formato? |
|---|---|---|
| `npm run lint:arch:provocar` | Su exit code | sí |
| `lib/provocacion.test.mjs` | `auditarProvocacion` como función pura | sí |
| El humano, al cerrar sesión | La lista de reglas sin fixture | no |

**Nadie lo corre automáticamente.** No está en ningún hook ni en `smoke-scripts`. Es una
garantía que solo existe si alguien se acuerda de invocarla — y que, cuando la invoca, sale
roja por un motivo que no es el suyo.

## 7. Cobertura

- **Test que lo cubre:** `lib/provocacion.test.mjs` ✔ — testea `auditarProvocacion` como
  función pura, incluido el caso «una regla borrada del linter deja el baseline obsoleto».
- **¿Quién lo audita a él?** Esta es la pregunta que el bloque venía a responder. La
  respuesta: **su lógica de auditoría sí está testeada; su cobertura no la mide nadie.**
  Nada comprueba que el conjunto de fixtures crezca, ni avisa de que lleva 24 reglas en el
  baseline. El ratchet impide que empeore, pero no exige que mejore.

## 8. Costo / beneficio

- **Qué cuesta:** un sandbox y una corrida del linter por fixture. Con 4 fixtures, segundos.
- **Qué evita:** que una regla se vuelva decorativa sin que nadie lo note — para 4 reglas.
- **Veredicto:** **la idea es la mejor del repositorio y la implementación entrega el 14%
  de la promesa.** Es la pieza con mayor distancia entre valor potencial y valor entregado
  de toda la auditoría, y también la más barata de cerrar: cada fixture son ~15 líneas.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `DEC-004` | DEC | El auditor de reglas cubre 4 de 28 (14%); las 24 sin fixture incluyen las tres de seguridad RLS y las dos que motivaron escribir el script |
| `INC-009` | INC | `SEC-RLS-01/02/03` no están en el baseline: `lint:arch:provocar` sale en 1 en cualquier proyecto recién generado |
| `ACO-009` | ACO | La provocación depende de que la salida de `architect.js` nombre el código de la regla; ese formato de salida no está declarado |

## Notas para el pase general

- **Lente 3 — la respuesta a «¿quién audita a los auditores?»** es la conclusión más
  importante de la auditoría hasta acá:
  - `provocar-reglas.mjs` audita 4 de las 28 reglas del linter, y **ninguna** de las ~20
    reglas regex de `pre-write-guard` (`HUE-012`).
  - `smoke-scripts.mjs` sí funciona (ver `S-06`) pero sale verde con 0 comprobados.
  - Sumando: **de las ~48 reglas que el harness aplica, 4 están comprobadas disparando.**
- El repo tiene la idea correcta y la disciplina escrita; lo que falta es el trabajo
  mecánico de escribir fixtures. Por eso es el ítem con mejor relación esfuerzo/resultado
  del backlog que salga del pase general.
