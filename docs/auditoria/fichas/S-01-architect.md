# FICHA A — S-01 · `scripts/architect.js`

| | |
|---|---|
| **Archivo** | `templates/boilerplate/scripts/architect.js` (897 líneas) · **Contexto** B · **Bloque** 2 · **Revisado** 2026-08-29 · **Estado** cerrada |

---

## 1. Contrato

Linter arquitectónico sobre el AST real de TypeScript. Registra **28 reglas** y las reporta
con código, archivo, fix y doc.

**¿Coincide con lo que dice su propia documentación?**

El docblock enumera «reglas activas» agrupadas por mecanismo (AST, regex sobre `.html`,
regex sobre `.scss`) y es correcto en lo que enumera, pero se quedó corto: lista ~8 y el
objeto `RULES` tiene 28. Es documentación que envejeció, no que mienta.

Lo que ninguna documentación dice es que **el namespace es compartido con
`pre-write-guard.js`** (`INC-001`).

## 2. Disparo

- **Invocación:** `npm run lint:arch` (vía `lint-arch-wrapper.js`), el subagente
  `arch-auditor`, y `smoke-scripts.mjs` lo usa como sujeto de prueba.
- **Alcance:** recorre `src/` recursivamente; `supabase/migrations/` para SEC-RLS.
- **Adaptación por stack:** lee `blueprint.json` y salta reglas según `STACK` — el mismo
  patrón (y el mismo riesgo) que `pre-write-guard`: `JSON.parse` crudo, spread sin validar.
  Ver `HUE-005`.

## 3. Fail mode

- **Actual:** `exit 1` ante errores, `exit 0` con solo warnings. Fail-open al leer el
  blueprint.
- **¿Es la elección correcta acá?** Sí para el linter. **No para la carga de TypeScript**:

```js
const require = createRequire(import.meta.url);
const ts = require('typescript');     // sin try/catch, sin comprobar la API
```

| Escenario | Comportamiento | ¿Correcto? |
|---|---|---|
| TypeScript 5.x instalado | corre y reporta | sí |
| TypeScript **7.x** instalado | `TypeError: Cannot read properties of undefined (reading 'Latest')` | **no** → `HUE-018` |
| `typescript` ausente | `ERR_MODULE_NOT_FOUND` sin mensaje propio | no |
| `blueprint.json` con tipos raros | spread crudo | no → `HUE-005` |

## 4. ¿Puede fallar? · CAMPO OBLIGATORIO

**Qué intenté para hacerla fallar:**

Sandbox con el boilerplate real (`src/`, `scripts/`, `indices/`, migraciones) y TypeScript
instalado. El primer intento instaló `typescript` sin pinear y trajo la **7.0.2**:

```
🔍 Iniciando Auditoría Arquitectónica (AST Mode v2.0)...
architect.js:374   ts.ScriptTarget.Latest
TypeError: Cannot read properties of undefined (reading 'Latest')
exit=1
```

La API CommonJS de TypeScript 7 —el port nativo— ya no expone `ScriptTarget`:
`Object.keys(ts).length === 2`. El linter muere con un stack trace, no con un mensaje.

Con `typescript@5.9.3`, que es lo que instalaría un proyecto Angular real:

```
✅ Auditoría completada: 0 errores, 2 advertencias.
exit=0
```

**Qué pasó:**

**El linter funciona.** Recorre el boilerplate, aplica las reglas y reporta. Las dos
advertencias son reales y merecen registrarse aparte: `ARCH-09` (>200 líneas en un
componente de `shared/`) lo dispara **el propio boilerplate que el CLI reparte** —
`section-hero.component.ts` con **1.170 líneas** y `tabs.component.ts` con 298. El producto
incumple su propia regla en el archivo que entrega. → `INC-008`

Sobre TS 7: hoy no es lo que instala un proyecto Angular 21, así que **no es un fallo
activo**. Es la ausencia de un guardaespaldas en una dependencia que el repo ya sabe que se
mueve: `lib/config.js` pinea `ANGULAR_MAJOR` con un comentario largo sobre exactamente este
problema —el ecosistema tarda meses en seguir a un major— y esa misma lección no se aplicó
a `typescript`.

**Veredicto:**
- [x] Dispara ante su violación — comprobado ejecutando, con las 4 reglas que tienen
      fixture (ver `S-05`)
- [x] Muere sin mensaje ante un major de TypeScript → `HUE-018`

## Sub-tabla obligatoria — las 28 reglas registradas

| Grupo | Códigos | ¿Fixture de provocación? |
|---|---|---|
| **Con fixture — comprobadas disparando** | `ARCH-01`, `ARCH-03`, `ARCH-04`, `ARCH-05` | **4** |
| AST, sin fixture | `ARCH-02`, `ARCH-06`, `ARCH-07`, `ARCH-08`, `ARCH-09`, `ARCH-10` | no |
| Design system / ratchets, sin fixture | `ARCH-11`, `ARCH-15`, `ARCH-16`, `ARCH-17`, `ARCH-18`, `ARCH-19`, `ARCH-21`, `ARCH-22`, `ARCH-23`, `ARCH-24`, `ARCH-25`, `ARCH-26` | no |
| Otros, sin fixture | `NAV-01`, `ICON-01`, `A11Y-03` | no |
| **Nuevas y fuera del baseline** | `SEC-RLS-01`, `SEC-RLS-02`, `SEC-RLS-03` | no → hacen fallar `S-05` |

**4 de 28 comprobadas.** Ver `S-05`, donde está el hallazgo.

`ARCH-14` no figura: no lo registra este archivo ni ningún otro (`INC-001`).

## 5. Depende de

| Artefacto / formato | Qué asume | ¿Declarado? |
|---|---|---|
| `require('typescript')` con la API clásica | `ScriptTarget`, `createSourceFile`… | **no, y sin guarda** |
| `blueprint.json` → `stack` | Booleanos | **no** → `INC-003` |
| 8 módulos de `scripts/lib/` | Funciones puras | sí, por import |
| `check-bento-classes.js` | Importado para ARCH-21 | sí |
| `provocacion.baseline.json`, `contrast.baseline.json`, `class-discipline.baseline.json` | Ratchets | parcial |

## 6. Lo consumen

| Consumidor | Qué toma | ¿Se rompe si cambio el formato? |
|---|---|---|
| `lint-arch-wrapper.js` | Su exit code y su salida | sí |
| `arch-auditor` (subagente) | La salida, comprimida | sí |
| `smoke-scripts.mjs` | Que falle ante un defecto ARCH-04 | sí |
| `provocar-reglas.mjs` | Que su salida nombre el código | sí |

Es el script con más consumidores del harness, y **los tres últimos son sus propios
auditores**. Eso lo hace la pieza mejor vigilada del repo — con el matiz de `S-05`.

## 7. Cobertura

- **Test que lo cubre:** ninguno directo. Los 13 módulos de `scripts/lib/` tienen **79
  tests que pasan**, así que la lógica pura extraída sí está cubierta; lo que no tiene test
  es el orquestador.
- **¿Lo cubre `provocar-reglas.mjs`?** 4 de 28 → ver `S-05`.
- **¿Lo cubre `smoke-scripts.mjs`?** Sí, comprobado: introduce un componente sin `OnPush` y
  verifica que `lint:arch` lo rechace.

## 8. Costo / beneficio

- **Qué cuesta:** ~0,5 s sobre el boilerplate. No inyecta contexto.
- **Qué evita:** es el mecanismo que hace cumplir la arquitectura de datos entera.
- **Veredicto:** vale la pena, claramente. Es el corazón determinista del harness.

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| `HUE-018` | HUE | `require('typescript')` sin guarda de versión ni de API: con TypeScript 7 el linter muere con un `TypeError`, no con un mensaje |
| `INC-008` | INC | El boilerplate que el CLI reparte incumple su propia `ARCH-09`: `section-hero.component.ts` tiene 1.170 líneas contra un límite de 200 |

## Notas para el pase general

- **Lente 3:** este es el nodo central. `provocar-reglas`, `smoke-scripts` y `arch-auditor`
  existen todos para vigilarlo, y aun así 24 de sus 28 reglas nunca se comprobaron
  disparando.
- **Lente 2:** tercer lugar donde se lee `blueprint.json → stack` con spread crudo (los
  otros dos: `pre-write-guard`, y los defaults hardcodeados de cada uno). Tres copias de la
  misma decisión.
- `INC-008` es la primera pista de que `L-06` (barrido del boilerplate) va a dar trabajo:
  el código que se reparte no pasa las reglas que se reparten con él.
