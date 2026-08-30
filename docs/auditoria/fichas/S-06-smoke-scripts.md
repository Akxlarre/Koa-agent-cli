# FICHA A — S-06 · `scripts/smoke-scripts.mjs`

| | |
|---|---|
| **Archivo** | `templates/boilerplate/scripts/smoke-scripts.mjs` (193 líneas) · **Contexto** B · **Bloque** 2 · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

Por cada script de `package.json` que comprueba código, introduce un defecto a propósito y
exige que el script se dé cuenta. Restaura el archivo siempre.

**¿Coincide con lo que dice su propia documentación?**

Sí. *«No pregunta si los scripts pasan. Pregunta si pueden fallar, que es la pregunta que
ningún CI hace y la única que encuentra un comando decorativo.»* Es exactamente lo que hace.

## 2. Disparo

- **Invocación:** `npm run smoke:scripts`, a mano al cerrar sesión o antes de publicar.
  `--solo typecheck,test:ci` acota.
- **Defectos:** dos, y ambos elegidos con criterio —el docblock explica que un defecto
  sutil produciría un falso «decorativo» y haría mentir al smoke en la dirección contraria:
  - `tipo`: `const __smokeDefecto: number = "no soy un número"` — ningún compilador lo pasa.
  - `arquitectura`: un componente sin `OnPush` en `features/` — `ARCH-04`, de las reglas más
    antiguas y menos probables de desactivar.

## 3. Fail mode

- **Actual:** `exit 1` si un script no detecta su defecto. **`exit 0` si no comprobó nada.**
- **¿Es la elección correcta acá?** No en el segundo caso. Ver campo 4.

| Escenario | Comportamiento | ¿Correcto? |
|---|---|---|
| Script detecta el defecto | ✅, sigue | sí |
| Script **no** detecta el defecto | `exit 1` nombrándolo | sí |
| Script ausente de `package.json` | se salta | sí |
| **Ningún script comprobable** | **`✅ 0 script(s) comprobados`, exit 0** | **no** → `DEC-005` |
| El proceso muere a mitad | `finally` restaura desde el temp del sistema | sí |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:** dos corridas, con y sin scripts que comprobar.

```bash
# 1 — sandbox con package.json sin scripts
node scripts/smoke-scripts.mjs
```
```
🔥 Smoke de scripts — ¿pueden fallar, o sólo pasar?

✅ 0 script(s) comprobados
exit=0
```

```bash
# 2 — con "lint:arch": "node scripts/architect.js" presente
node scripts/smoke-scripts.mjs --solo lint:arch
```
```
  lint:arch…✅ lint:arch — falla cuando tiene que fallar (0.5s)

✅ 1 script(s) comprobados
exit=0

── ¿quedó basura tras el smoke? ──
  ✓ restaurado, sin residuos
```

**Qué pasó:**

**El script funciona.** Creó el componente sin `OnPush`, corrió `lint:arch`, verificó que
lo rechazara, y restauró el sandbox sin dejar residuos. La parte que el propio docblock
señala como la que importa —*«si esto deja un defecto puesto, rompe el repositorio de quien
lo corrió»*— está bien resuelta: el respaldo va al temp del sistema, no al lado del
archivo, precisamente para que un `.bak` olvidado no ensucie `src/`.

**Lo que sí falla es el caso vacío.** Con nada que comprobar, imprime `✅ 0 script(s)
comprobados` y sale 0. Es, en pequeño, exactamente el patrón que el script existe para
condenar: un chequeo verde que no comprobó nada. Un `package.json` al que le falten los
scripts —o un `--solo` mal escrito— produce un visto bueno sin contenido. → `DEC-005`

La severidad es `S3` y no más: en un proyecto generado real `package.json` trae
`lint:arch`, `typecheck` y `test:ci`, así que el caso vacío requiere que alguien los haya
borrado o se haya equivocado en el `--solo`. Pero es el único caso en toda la auditoría
donde un auditor comete el error que audita.

**Veredicto:**
- [x] Dispara ante su violación — comprobado ejecutando, con restauración verificada
- [x] Sale verde cuando no comprobó nada → `DEC-005`

## 5. Depende de

| Artefacto / formato | Qué asume | ¿Declarado? |
|---|---|---|
| `lib/smoke-scripts.js` → `COMPROBACIONES` | Qué defecto va con qué script | sí, por import |
| `package.json` → `scripts` | Nombres exactos (`lint:arch`, `typecheck`, `test:ci`…) | **no → `ACO-010`** |
| `src/app/**` con al menos un `.ts` | Para inyectar el defecto de tipo | no |
| `ARCH-04` sigue activa en el linter | El defecto de arquitectura depende de esa regla | **no** |

La última fila es un acoplamiento fino: si alguien desactivara `ARCH-04`, este smoke
empezaría a reportar que `lint:arch` es decorativo, cuando el decorativo sería el smoke.

## 6. Lo consumen

| Consumidor | Qué toma | ¿Se rompe si cambio el formato? |
|---|---|---|
| `npm run smoke:scripts` | Su exit code | sí |
| `lib/smoke-scripts.test.mjs` | `clasificar`, `veredicto`, `resumir` como funciones puras | sí |
| El humano, al cerrar sesión | El reporte | no |

Igual que `S-05`: **nadie lo corre automáticamente**. No está en ningún hook.

## 7. Cobertura

- **Test que lo cubre:** `lib/smoke-scripts.test.mjs` ✔ — cubre las funciones puras.
- **¿Quién lo audita a él?** Su lógica de clasificación está testeada. Lo que ningún test
  cubre es el caso vacío (`DEC-005`), que es su propio punto ciego.
- **Comparado con `S-05`:** este auditor **sí entrega lo que promete**. La diferencia entre
  los dos es instructiva: `smoke-scripts` verifica un puñado de scripts y los verifica de
  verdad; `provocar-reglas` promete 28 reglas y verifica 4.

## 8. Costo / beneficio

- **Qué cuesta:** corre cada script con un defecto adentro, así que tarda. Está declarado:
  *«está pensado para correrse al cerrar una sesión o antes de publicar, no en cada
  guardado»*.
- **Qué evita:** que un script de `package.json` se vuelva decorativo — el caso
  `test:ci --reporter`, que el propio `scaffolder.js` documenta como bug histórico
  («era el comando que `testing-tdd.md` manda correr para auto-validar, o sea que la
  validación nunca corría»), es exactamente esto.
- **Veredicto:** vale la pena. **Es la pieza sana del bloque** y la que mejor cumple la
  tesis del repositorio.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `DEC-005` | DEC | Con nada que comprobar imprime `✅ 0 script(s) comprobados` y sale 0: el auditor de chequeos decorativos comete, en pequeño, el error que audita |
| `ACO-010` | ACO | Depende de los nombres exactos de los scripts de `package.json` y de que `ARCH-04` siga activa; ninguna de las dos cosas está declarada |

## Notas para el pase general

- **Lente 3:** `S-05` y `S-06` son los dos auditores del repo y dan resultados opuestos.
  Este cumple; aquel cubre el 14%. La conclusión no es «los auditores fallan» sino «uno de
  los dos nunca se terminó de escribir».
- **Lente 4 / disciplina:** ninguno de los dos está cableado a nada. Son garantías que solo
  existen si alguien se acuerda de invocarlas. Considerar si el `Stop` hook o el CI
  deberían correr al menos `provocar-reglas` — que es barato — aunque `smoke-scripts` sea
  demasiado lento para eso.
