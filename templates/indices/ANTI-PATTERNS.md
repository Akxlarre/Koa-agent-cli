<!-- spec-version: {{GENERATED_AT}} -->
<!-- auto-refresh: indices:sync -->

# Anti-Patterns (NO HACER)

> Este índice enumera atajos comunes que degradan el sistema.
> **Regla:** si detectas uno, detente y refactoriza hacia el patrón canónico.

## Cómo leer este índice

Los anti-patrones vienen en dos grupos, y la diferencia importa:

- **AP-001 → AP-006 — los atrapa el Architect Guard.** Son sintaxis: regex y AST.
  Si escribes uno, el hook te bloquea antes de guardar y te dice cómo corregirlo.
  Están documentados aquí para que entiendas *por qué* te bloqueó, no porque
  necesites vigilarlos tú.
- **AP-007 en adelante — no los atrapa nada.** Son de diseño: un patrón mal
  aplicado, una capa saltada de forma que compila, un nombre que contradice el
  dominio. Ningún regex puede verlos. Estos dependen de que tú los conozcas, y de
  `/review` (que corre el subagente `code-judge` contra la rúbrica del proyecto).

**El segundo grupo es el que da valor a este archivo.** Cuando descubras un
anti-patrón nuevo en este proyecto, agrégalo abajo con el formato de los demás:
qué se hizo, por qué parecía razonable, y qué romper. Lo que no se registra se
repite — y el `code-judge` lee este índice como parte de su rúbrica, así que una
entrada aquí se convierte en algo que se revisa en cada `/review`.

---

## Grupo 1 — Bloqueados automáticamente por el Architect Guard

## AP-001 — `[ngClass]` (evitar)
- **NO** uses `[ngClass]`.
- **Sí** usa binding directo: `[class.active]="isActive()"`, `[class.foo]="cond()"`.

## AP-002 — `@Input()` / `@Output()` (evitar)
- **NO** uses `@Input()` / `@Output()`.
- **Sí** usa Signal Inputs/Outputs: `input()`, `output()`.

## AP-003 — `inject(SupabaseService)` en componentes (evitar)
- **NO** inyectes `SupabaseService` ni importes `@supabase/supabase-js` en `features/` o `shared/`.
- **Sí** usa un `*FacadeService` para datos/estado y expón Signals al template.

## AP-004 — Colores Tailwind hardcodeados (evitar)
- **NO** uses `text-red-500`, `bg-blue-200`, etc.
- **Sí** usa tokens semánticos (`text-primary`, `text-muted`, `bg-surface`, `bg-base`, `var(--ds-brand)`).

## AP-005 — `@angular/animations` (evitar)
- **NO** uses `@angular/animations`.
- **Sí** usa GSAP vía `GsapAnimationsService` (y View Transitions para navegación).

## AP-006 — `.db.from()` en un Facade (evitar)
- **NO** llames `inject(SupabaseService).db.from('tabla')` dentro de un Facade.
- El getter `.db` existe **solo para Repositories** (`core/repositories/`).
- **Sí** crea un `*Repository` que encapsula la query y haz que el Facade lo inyecte.
- Patrón canónico: `UI → Facade → Repository → SupabaseService.db`

---

## Grupo 2 — Invisibles para el regex

Estos compilan, pasan el linter y pasan los hooks. Solo los ve alguien que
entiende el diseño.

## AP-007 — Smart component disfrazado de Dumb

- **NO** pongas en `shared/` un componente que decide *qué* datos mostrar.
- Un componente de `shared/` que recibe un `id` por `input()` y busca el objeto
  por su cuenta es Smart, aunque no inyecte un Facade. El síntoma es que no se
  puede reutilizar en otra pantalla sin arrastrar su fuente de datos.
- **Sí**: `shared/` recibe el objeto ya resuelto. Quien lo resuelve es el Smart
  component de `features/`.
- Por qué no lo atrapa el guard: `inject(Facade)` sí se detecta por regex, pero
  "recibe un id y lo resuelve" es una decisión de diseño.

## AP-008 — `effect()` para estado derivado

- **NO** uses `effect()` para calcular un signal a partir de otros.
- `effect(() => this.total.set(this.items().length))` compila y funciona, pero
  crea un ciclo de escritura que Angular no puede optimizar, corre fuera del
  grafo de dependencias y produce un frame intermedio con el valor viejo.
- **Sí**: `readonly total = computed(() => this.items().length)`.
- `effect()` es para efectos de *salida* del grafo reactivo: DOM imperativo,
  logging, `localStorage`. Si el resultado es otro signal, es `computed()`.

## AP-009 — Facade que expone el signal escribible

- **NO** hagas `readonly items = this._items;` en un Facade.
- Devolver el `WritableSignal` deja que cualquier componente haga `.set()` sobre
  el estado del Facade. El Facade deja de ser la única fuente de mutación y el
  origen de un cambio de estado se vuelve imposible de rastrear.
- **Sí**: `readonly items = this._items.asReadonly();`
- Por qué no lo atrapa el guard: es una línea válida y frecuente. Solo se nota
  cuando alguien muta el estado desde la UI y nadie sabe por qué.

## AP-010 — Repository que devuelve la respuesta cruda de Supabase

- **NO** retornes `{ data, error }` desde un Repository.
- Si el objeto de Supabase sale del Repository, la forma del cliente se filtra a
  Facades y componentes. Cambiar de proveedor —o de versión del SDK— pasa a tocar
  toda la app en vez de una carpeta.
- **Sí**: el Repository desestructura, lanza o devuelve `null` en error, y retorna
  datos ya tipados con la interfaz del dominio.

## AP-011 — Nombre que contradice `context/domain.md`

- **NO** llames `Order` a lo que el negocio llama "solicitud".
- Cuando el código y el cliente usan vocabularios distintos, cada conversación
  necesita traducción, y las traducciones se pierden. Es la clase de deuda que no
  se nota hasta que alguien nuevo entra al proyecto.
- **Sí**: el nombre del dominio manda. Si el término del negocio cambió, se
  refactoriza el código y se actualiza `context/domain.md` en el mismo cambio.
- Por qué no lo atrapa el guard: es un identificador válido. Lo detecta
  `code-judge` (criterio C10) o una persona que conozca el dominio.

## AP-012 — Tabla sin políticas, o con una política permisiva

Este entró al Grupo 2 y **ya no pertenece ahí**: desde v6.9 hay guardrail. Se deja
documentado porque el razonamiento importa más que la regla.

- Una tabla con RLS activado y **cero políticas** no es segura: es *inaccesible*.
  Postgres deniega por defecto, así que sin políticas nadie lee la tabla — ni tu
  propia app. El fallo aparece en runtime, lejos de la migración.
- El "arreglo" natural de ese bloqueo es una política `USING (true)`, que abre la
  tabla a cualquier usuario autenticado. Se pasa de inaccesible a totalmente
  abierta en un solo commit, y ambos extremos compilan.
- **Sí**: toda tabla nueva lleva RLS **y** políticas explícitas por operación,
  acotadas al dueño del dato o al rol. Documentadas en `indices/DATABASE.md`.

Qué lo vigila ahora:

| Check | Dónde | Alcance |
|---|---|---|
| `SEC-RLS-01` | hook + `lint:arch` | Tabla creada sin ninguna política |
| `SEC-RLS-02` | hook + `lint:arch` | `USING (true)` / `WITH CHECK (true)` en ALL/INSERT/UPDATE/DELETE |
| `SEC-RLS-03` | `lint:arch` | Tabla sin `ENABLE ROW LEVEL SECURITY` en ninguna migración |

`USING (true)` sigue permitido en `FOR SELECT`: una tabla de catálogo pública es un
caso legítimo. Es la única forma en que `true` es defendible.
